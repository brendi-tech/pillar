# Pillar Monitoring Runbook

> This runbook covers every alert scenario from the Pillar monitoring system.
> It lives at `/opt/pillar/monitoring/RUNBOOK.md` on the VM.
> Last updated: 2026-04-08

---

## Table of Contents

- [1. VM Access and Quick Diagnostics](#1-vm-access-and-quick-diagnostics)
- [2. Service Down Alerts](#2-service-down-alerts)
  - [2.1 API (Internal) Down](#21-api-internal-down)
  - [2.2 API (External) Down, Internal UP](#22-api-external-down-internal-up)
  - [2.3 Both API Down](#23-both-api-down)
  - [2.4 PostgreSQL Down](#24-postgresql-down)
  - [2.5 Redis Down](#25-redis-down)
  - [2.6 Worker (Hatchet) Down](#26-worker-hatchet-down)
  - [2.7 Frontend (Next.js) Down](#27-frontend-nextjs-down)
- [3. Resource Alerts](#3-resource-alerts)
  - [3.1 Disk High](#31-disk-high)
  - [3.2 Memory High](#32-memory-high)
  - [3.3 CPU High](#33-cpu-high)
  - [3.4 Docker Disk High](#34-docker-disk-high)
- [4. Error Digest Alerts](#4-error-digest-alerts)
  - [4.1 OpenRouter / OpenAI Errors](#41-openrouter--openai-errors)
  - [4.2 Database Connection Errors](#42-database-connection-errors)
  - [4.3 Hatchet Errors](#43-hatchet-errors)
  - [4.4 Error Spike (>=10 in 5min)](#44-error-spike-10-in-5min)
- [5. Post-Incident Checklist](#5-post-incident-checklist)

---

## 1. VM Access and Quick Diagnostics

### SSH into the VM

```bash
gcloud compute ssh pillar-vm --zone=southamerica-east1-a
```

If you need to specify the project:

```bash
gcloud compute ssh pillar-vm --zone=southamerica-east1-a --project=brendi-app
```

### Quick Diagnostic Commands

Run these immediately after SSH to get a snapshot of the system:

```bash
# All container statuses
docker compose -f /opt/pillar/docker-compose.yml ps

# Resource usage per container (one-shot, no streaming)
docker stats --no-stream

# Recent logs for a specific service (api, worker, db, redis, frontend)
docker compose -f /opt/pillar/docker-compose.yml logs --tail 50 api
docker compose -f /opt/pillar/docker-compose.yml logs --tail 50 worker

# Disk usage
df -h /

# Memory overview
free -m

# CPU load
top -bn1 | head -20

# Monitoring state files (see what the monitors currently think)
ls -la /tmp/pillar-monitor/health/
cat /tmp/pillar-monitor/health/*.state

# Recent monitoring logs
tail -30 /opt/pillar/monitoring/logs/health-check.log
tail -30 /opt/pillar/monitoring/logs/error-digest.log
tail -30 /opt/pillar/monitoring/logs/resource-monitor.log
```

### Useful Aliases

Add these to your `.bashrc` on the VM for faster incident response:

```bash
alias pps='docker compose -f /opt/pillar/docker-compose.yml ps'
alias plogs='docker compose -f /opt/pillar/docker-compose.yml logs --tail 50'
alias prestart='docker compose -f /opt/pillar/docker-compose.yml restart'
alias pup='docker compose -f /opt/pillar/docker-compose.yml up -d'
```

---

## 2. Service Down Alerts

These alerts fire when `health-check.sh` detects a service transition from `up` to `down`.
Slack message format: `:red_circle: *Pillar DOWN: <service>*`

### 2.1 API (Internal) Down

**Alert:** `Pillar DOWN: api-internal`
**Check:** `curl -sf -m 5 http://localhost:8000/health/ready` fails.
**Meaning:** The API container (Gunicorn/Django) is not responding.

**Step-by-step:**

```bash
# 1. Check container status
docker compose -f /opt/pillar/docker-compose.yml ps api

# 2. Check recent logs for errors
docker compose -f /opt/pillar/docker-compose.yml logs --tail 100 api

# 3. Check if the container was OOM-killed
docker inspect pillar-api-1 --format='{{.State.OOMKilled}}'
docker inspect pillar-api-1 --format='{{.State.ExitCode}}'

# 4. If OOM-killed, check current memory limits
docker stats --no-stream pillar-api-1

# 5. Restart the API
docker compose -f /opt/pillar/docker-compose.yml restart api

# 6. If restart fails, check if migrations are pending
docker compose -f /opt/pillar/docker-compose.yml run --rm api python manage.py migrate --noinput

# 7. If migrations fail, check DB connectivity from inside the container
docker compose -f /opt/pillar/docker-compose.yml run --rm api python -c "
import django; django.setup()
from django.db import connection
connection.ensure_connection()
print('DB OK')
"

# 8. If nothing works, rebuild and restart
docker compose -f /opt/pillar/docker-compose.yml up -d --force-recreate api
```

**Common causes:**
- OOM kill: reduce `WEB_CONCURRENCY` in `/opt/pillar/backend/.env` or increase VM RAM
- Failed migration: check migration output for schema conflicts
- Corrupted Python environment: rebuild the image
- DB down: check PostgreSQL first (Section 2.4)

---

### 2.2 API (External) Down, Internal UP

**Alert:** `Pillar DOWN: api-external`
**Check:** `curl -sf -m 10 https://pillar-api.brendi.com.br/health/ready` fails, but internal check passes.
**Meaning:** Nginx reverse proxy or SSL issue. The API itself is healthy.

**Step-by-step:**

```bash
# 1. Test nginx configuration
sudo nginx -t

# 2. Check nginx status
sudo systemctl status nginx

# 3. Check nginx error logs
sudo tail -50 /var/log/nginx/error.log
sudo tail -50 /var/log/nginx/access.log | grep -i "pillar-api"

# 4. Restart nginx
sudo systemctl restart nginx

# 5. Test again
curl -sf -m 10 https://pillar-api.brendi.com.br/health/ready

# 6. If SSL error, check certificate expiry
sudo openssl s_client -connect pillar-api.brendi.com.br:443 -servername pillar-api.brendi.com.br 2>/dev/null | openssl x509 -noout -dates

# 7. If certificate expired, renew with certbot
sudo certbot renew --force-renewal
sudo systemctl reload nginx

# 8. If certbot renewal fails, check DNS and firewall
dig pillar-api.brendi.com.br
curl -I http://pillar-api.brendi.com.br  # test HTTP (non-SSL)

# 9. Check if nginx upstream is pointing to correct port
grep -r "proxy_pass" /etc/nginx/sites-enabled/ | grep pillar
# Should show proxy_pass http://localhost:8000 or similar
```

**Common causes:**
- Nginx crashed or was stopped: restart it
- SSL cert expired: renew with certbot
- Nginx config syntax error after manual edit: `nginx -t` will catch this
- Port mismatch between nginx config and docker-compose

---

### 2.3 Both API Down

**Alert:** Both `api-internal` and `api-external` show as down.
**Meaning:** The API container is completely unresponsive. May indicate broader infrastructure failure.

**Step-by-step:**

```bash
# 1. Check ALL container statuses
docker compose -f /opt/pillar/docker-compose.yml ps

# 2. Check if Docker daemon itself is healthy
docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker DEAD"

# 3. If Docker daemon is dead
sudo systemctl restart docker
# Wait for it to come back
sleep 10
docker compose -f /opt/pillar/docker-compose.yml ps

# 4. If Docker is fine, restart all services
docker compose -f /opt/pillar/docker-compose.yml down
docker compose -f /opt/pillar/docker-compose.yml up -d

# 5. Watch logs for startup errors
docker compose -f /opt/pillar/docker-compose.yml logs -f --tail 50

# 6. Check disk space (Docker won't start containers on full disk)
df -h /

# 7. Check system logs for kernel-level issues
sudo journalctl -u docker --since "30 min ago" --no-pager
sudo dmesg | tail -30
```

**Common causes:**
- Docker daemon crash: restart Docker
- Full disk: clear space first (Section 3.1), then restart
- VM reboot or crash: all containers may need `docker compose up -d`
- Kernel OOM killer: check `dmesg` for OOM messages

---

### 2.4 PostgreSQL Down

**Alert:** `Pillar DOWN: db`
**Check:** `docker exec pillar-db-1 pg_isready -U postgres` fails.
**Meaning:** PostgreSQL is not accepting connections.

> **CRITICAL: Check disk space FIRST. PostgreSQL crashes immediately on full disk and may corrupt data.**

**Step-by-step:**

```bash
# 1. CHECK DISK SPACE FIRST
df -h /
# If disk is >95% full, go to Section 3.1 BEFORE doing anything else

# 2. Check container status
docker compose -f /opt/pillar/docker-compose.yml ps db

# 3. Check PostgreSQL logs
docker compose -f /opt/pillar/docker-compose.yml logs --tail 100 db

# 4. Try a simple restart
docker compose -f /opt/pillar/docker-compose.yml restart db

# 5. Wait for healthcheck (30s start period + checks)
sleep 45
docker exec pillar-db-1 pg_isready -U postgres

# 6. If it won't start, check for data corruption
docker compose -f /opt/pillar/docker-compose.yml logs db 2>&1 | grep -i "corrupt\|invalid\|PANIC"

# 7. If WAL files are bloated (common after crash)
# Check WAL size from inside the container
docker exec pillar-db-1 du -sh /var/lib/postgresql/data/pg_wal/
# If huge (>1GB), there may be replication slots stuck
docker exec pillar-db-1 psql -U postgres -c "SELECT * FROM pg_replication_slots;"
# Drop stuck slots if any
docker exec pillar-db-1 psql -U postgres -c "SELECT pg_drop_replication_slot('slot_name');"

# 8. If data corruption suspected, try to start in recovery mode
docker compose -f /opt/pillar/docker-compose.yml stop db
# Check volume integrity
docker run --rm -v pillar_postgres_data:/data alpine ls -la /data/
# Restart and pray
docker compose -f /opt/pillar/docker-compose.yml up -d db

# 9. LAST RESORT: If data is irrecoverable, restore from backup
# (Document your backup location and restore process here)
```

**Common causes:**
- Full disk: PostgreSQL shuts down to prevent corruption. Free space, then restart
- WAL bloat: stuck replication slots or aggressive checkpoint settings
- OOM kill: system ran out of memory, kernel killed postgres
- Shared memory issues: check `dmesg` for shmem errors

---

### 2.5 Redis Down

**Alert:** `Pillar DOWN: redis`
**Check:** `docker exec pillar-redis-1 redis-cli ping` does not return `PONG`.

**Step-by-step:**

```bash
# 1. Check container status
docker compose -f /opt/pillar/docker-compose.yml ps redis

# 2. Check logs
docker compose -f /opt/pillar/docker-compose.yml logs --tail 50 redis

# 3. Restart Redis
docker compose -f /opt/pillar/docker-compose.yml restart redis

# 4. Verify it's back
docker exec pillar-redis-1 redis-cli ping

# 5. Check memory usage
docker exec pillar-redis-1 redis-cli info memory | grep -E "used_memory_human|maxmemory"

# 6. If AOF corruption (you'll see "Bad file format reading the append only file" in logs)
docker compose -f /opt/pillar/docker-compose.yml stop redis
# Fix the AOF file
docker run --rm -v pillar_redis_data:/data redis:7-alpine redis-check-aof --fix /data/appendonlydir/appendonly.aof.1.incr.aof
# Restart
docker compose -f /opt/pillar/docker-compose.yml up -d redis

# 7. If RDB corruption
docker run --rm -v pillar_redis_data:/data redis:7-alpine redis-check-rdb /data/dump.rdb

# 8. LAST RESORT: Clear all data and restart fresh
# WARNING: This loses all cached data and queued jobs
docker compose -f /opt/pillar/docker-compose.yml stop redis
docker volume rm pillar_redis_data
docker compose -f /opt/pillar/docker-compose.yml up -d redis
```

**Common causes:**
- OOM: Redis exceeded available memory. Set `maxmemory` in redis config
- AOF corruption: after unclean shutdown. Fix with `redis-check-aof --fix`
- Disk full: AOF/RDB can't write. Free disk first

**Note:** Redis runs with `--appendonly yes` (AOF persistence). Data survives restarts but AOF corruption is possible after hard crashes.

---

### 2.6 Worker (Hatchet) Down

**Alert:** `Pillar DOWN: worker`
**Check:** `docker ps --filter "name=pillar-worker-1" --filter "status=running"` finds no match.
**Meaning:** The Hatchet background worker container is not running.

> **Note:** The worker has a 240-second startup grace period. It may appear "starting" for up to 4 minutes after launch. Don't panic if it's not immediately "running" after a restart.

**Step-by-step:**

```bash
# 1. Check container status (look for "starting" vs "exited")
docker compose -f /opt/pillar/docker-compose.yml ps worker

# 2. If status is "starting", check how long it has been starting
docker inspect pillar-worker-1 --format='{{.State.StartedAt}}'
# If less than 240 seconds ago, wait

# 3. Check worker logs
docker compose -f /opt/pillar/docker-compose.yml logs --tail 100 worker

# 4. Common log patterns and their meanings:
#    "Connection refused" -> Hatchet Cloud is down or unreachable
#    "Token expired" -> HATCHET_CLIENT_TOKEN needs renewal
#    "Database connection" -> PostgreSQL is down (check Section 2.4)
#    "Redis connection" -> Redis is down (check Section 2.5)

# 5. Restart the worker
docker compose -f /opt/pillar/docker-compose.yml restart worker

# 6. Monitor startup (remember 240s grace period)
docker compose -f /opt/pillar/docker-compose.yml logs -f worker

# 7. If Hatchet Cloud connection issues
# Check Hatchet status: https://cloud.onhatchet.run
# Verify token in env
grep HATCHET_CLIENT_TOKEN /opt/pillar/backend/.env | head -c 50
echo "..." # don't print full token

# 8. If token expired, get a new one from Hatchet Cloud dashboard
# Update in /opt/pillar/backend/.env, then:
docker compose -f /opt/pillar/docker-compose.yml restart worker

# 9. If worker keeps crashing (restart loop)
docker compose -f /opt/pillar/docker-compose.yml logs --tail 200 worker | head -50
# Look for the first error after startup
```

**Common causes:**
- Hatchet Cloud outage: check https://cloud.onhatchet.run
- Expired token: regenerate from Hatchet dashboard
- DB not ready: worker starts before postgres. The healthcheck dependency should handle this, but race conditions happen
- Redis not ready: same as above

---

### 2.7 Frontend (Next.js) Down

**Alert:** `Pillar DOWN: frontend`
**Check:** `curl -sf -m 5 http://localhost:3000` fails.
**Meaning:** The Next.js frontend container is not responding.

**Step-by-step:**

```bash
# 1. Check container status
docker compose -f /opt/pillar/docker-compose.yml ps frontend

# 2. Check logs
docker compose -f /opt/pillar/docker-compose.yml logs --tail 50 frontend

# 3. Restart
docker compose -f /opt/pillar/docker-compose.yml restart frontend

# 4. If container exits immediately (build error)
docker compose -f /opt/pillar/docker-compose.yml logs frontend 2>&1 | grep -i "error\|failed\|module"

# 5. Check if the API dependency is healthy (frontend depends on api)
curl -sf http://localhost:8000/health/ready && echo "API OK" || echo "API DOWN"

# 6. If image is corrupted, rebuild
docker compose -f /opt/pillar/docker-compose.yml build frontend
docker compose -f /opt/pillar/docker-compose.yml up -d frontend

# 7. Check if port 3000 is in use by something else
ss -tlnp | grep :3000

# 8. If environment variable issues
docker compose -f /opt/pillar/docker-compose.yml exec frontend env | grep PILLAR
```

**Common causes:**
- API not available at startup: restart frontend after API is confirmed healthy
- Build error in the image: rebuild
- Port conflict: something else is using port 3000
- Missing environment variables: check docker-compose.yml `environment` section

---

## 3. Resource Alerts

These alerts fire when `resource-monitor.sh` detects threshold crossings.
- **Warning:** `:warning: Pillar Resource Warning: <resource>`
- **Critical:** `:red_circle: Pillar Resource Critical: <resource>`

Thresholds:
| Resource | Warning | Critical |
|---|---|---|
| Disk | 80% | 90% |
| Memory | 85% | 95% |
| CPU | 80% (load avg) | 95% (load avg) |
| Docker disk | 5 GB | 10 GB |

### 3.1 Disk High

**Alert:** `Pillar Resource Warning: disk 82%` or `Pillar Resource Critical: disk 93%`

**Step-by-step:**

```bash
# 1. See overall disk usage
df -h /

# 2. Find the biggest space consumers
du -sh /opt/pillar/* | sort -rh | head -10
du -sh /var/lib/docker/* | sort -rh | head -10
du -sh /var/log/* | sort -rh | head -10

# 3. Clean Docker resources (safe, removes unused images/containers/volumes)
docker system prune -f
# For more aggressive cleanup (removes ALL unused images, not just dangling):
docker system prune -af

# 4. Check PostgreSQL WAL files (common space hog)
docker exec pillar-db-1 du -sh /var/lib/postgresql/data/pg_wal/
# If WAL is huge, check for stuck replication slots
docker exec pillar-db-1 psql -U postgres -c "SELECT slot_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots;"

# 5. Clean old monitoring logs
ls -lh /opt/pillar/monitoring/logs/
# Truncate large logs
> /opt/pillar/monitoring/logs/health-check.log
> /opt/pillar/monitoring/logs/error-digest.log
> /opt/pillar/monitoring/logs/resource-monitor.log

# 6. Clean old Docker container logs
# Find large container log files
find /var/lib/docker/containers -name "*.log" -exec ls -sh {} \; | sort -rh | head -5
# Truncate them
truncate -s 0 /var/lib/docker/containers/*/*-json.log

# 7. Clean old system logs
sudo journalctl --vacuum-time=3d

# 8. If still critical, consider expanding the disk
# In GCP Console or via gcloud:
gcloud compute disks resize pillar-vm --size=50GB --zone=southamerica-east1-a
# Then resize the filesystem inside the VM:
sudo resize2fs /dev/sda1
```

**Prevention:**
- Set up log rotation for container logs in `/etc/docker/daemon.json`:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```
- After adding, restart Docker: `sudo systemctl restart docker`

---

### 3.2 Memory High

**Alert:** `Pillar Resource Warning: memory 87%` or `Pillar Resource Critical: memory 96%`

**Step-by-step:**

```bash
# 1. Identify the culprit container
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 2. Check system-wide memory breakdown
free -m
# Look at "available" — that's what actually matters

# 3. Check for memory leaks (compare current vs limits)
docker inspect pillar-api-1 --format='{{.HostConfig.Memory}}'
docker inspect pillar-worker-1 --format='{{.HostConfig.Memory}}'

# 4. Restart the highest-memory container
# Usually it's the API or worker
docker compose -f /opt/pillar/docker-compose.yml restart api
# or
docker compose -f /opt/pillar/docker-compose.yml restart worker

# 5. If API is the culprit, reduce concurrency
# Edit /opt/pillar/backend/.env:
#   WEB_CONCURRENCY=2  (reduce from current value)
# Then restart:
docker compose -f /opt/pillar/docker-compose.yml restart api

# 6. Check for OOM kills in system log
sudo dmesg | grep -i "oom\|killed" | tail -10

# 7. Clear OS caches (safe, no data loss)
sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

# 8. If persistent issue, consider VM upgrade
# Current VM type:
gcloud compute instances describe pillar-vm --zone=southamerica-east1-a --format='get(machineType)'
# Upgrade (requires VM stop):
gcloud compute instances stop pillar-vm --zone=southamerica-east1-a
gcloud compute instances set-machine-type pillar-vm --zone=southamerica-east1-a --machine-type=e2-standard-4
gcloud compute instances start pillar-vm --zone=southamerica-east1-a
```

**Common culprits:**
- API with high `WEB_CONCURRENCY`: each Gunicorn worker uses ~200-400MB
- Worker processing large AI payloads
- PostgreSQL with aggressive shared_buffers

---

### 3.3 CPU High

**Alert:** `Pillar Resource Warning: cpu 83%` or `Pillar Resource Critical: cpu 97%`

**Step-by-step:**

```bash
# 1. Identify the hot container
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 2. Check system-level processes
top -bn1 | head -20

# 3. If a specific container is hot, check what it's doing
# For API:
docker compose -f /opt/pillar/docker-compose.yml logs --tail 30 api
# For Worker:
docker compose -f /opt/pillar/docker-compose.yml logs --tail 30 worker

# 4. Check for runaway requests (stuck long-running requests)
# If API supports it:
curl -s http://localhost:8000/health/ready | python3 -m json.tool

# 5. Restart the hot container
docker compose -f /opt/pillar/docker-compose.yml restart api
# or
docker compose -f /opt/pillar/docker-compose.yml restart worker

# 6. If PostgreSQL is the culprit
docker exec pillar-db-1 psql -U postgres -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC
LIMIT 5;
"
# Kill a runaway query if needed
docker exec pillar-db-1 psql -U postgres -c "SELECT pg_cancel_backend(<pid>);"

# 7. If it's a sustained spike (not transient), check for infinite loops or stuck jobs
docker compose -f /opt/pillar/docker-compose.yml logs --since "10m" worker | grep -i "error\|timeout\|retry"
```

**Common causes:**
- AI model inference causing request spikes
- Stuck database queries (full table scans, missing indexes)
- Worker retry storm (failing job retried thousands of times)
- Cron jobs running simultaneously

---

### 3.4 Docker Disk High

**Alert:** `Pillar Resource Warning: docker-disk 6.2GB` or `Pillar Resource Critical: docker-disk 11.5GB`

**Step-by-step:**

```bash
# 1. See detailed Docker disk breakdown
docker system df -v

# 2. Remove unused images (safe)
docker image prune -f

# 3. Remove ALL unused images (including tagged ones not used by any container)
docker image prune -a -f

# 4. Remove build cache
docker builder prune -f

# 5. Remove stopped containers
docker container prune -f

# 6. Remove unused volumes (CAREFUL: don't remove data volumes)
# List volumes first:
docker volume ls
# Only prune if you're sure no important data is in dangling volumes:
docker volume prune -f

# 7. Nuclear option: remove everything unused
docker system prune -af --volumes
# WARNING: This removes ALL unused images, containers, networks, and volumes.
# Only data volumes actively mounted by running containers are safe.

# 8. Check what's left
docker system df
```

**Prevention:**
- After deployments, always clean up old images:
  ```bash
  docker image prune -f
  ```
- Keep only the last 2-3 image versions of each service

---

## 4. Error Digest Alerts

These alerts fire when `error-digest.sh` finds errors in API/Worker container logs.
- Regular digest: `:warning: Pillar Error Digest (last 5min)`
- Spike alert: `:red_circle: Pillar Error Spike: N errors in 5min`

### 4.1 OpenRouter / OpenAI Errors

**Alert pattern:** Digest contains `ConnectionError.*OpenRouter` or `ConnectionError.*openai`

**Step-by-step:**

```bash
# 1. Check provider status pages
# OpenRouter: https://openrouter.ai/status
# OpenAI: https://status.openai.com

# 2. Check API keys are set and valid
grep OPENROUTER_API_KEY /opt/pillar/backend/.env | head -c 30
echo "..."
grep OPENAI_API_KEY /opt/pillar/backend/.env | head -c 30
echo "..."

# 3. Test connectivity from the VM
curl -s -o /dev/null -w "%{http_code}" https://openrouter.ai/api/v1/models
curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $(grep OPENAI_API_KEY /opt/pillar/backend/.env | cut -d= -f2)"

# 4. Check if API credits are exhausted
# OpenRouter: https://openrouter.ai/settings/credits
# OpenAI: https://platform.openai.com/settings/organization/billing/overview

# 5. If provider is down, consider switching models
# Edit /opt/pillar/backend/.env and change the model configuration
# Then restart:
docker compose -f /opt/pillar/docker-compose.yml restart api worker

# 6. Check recent error patterns in logs
docker logs --since 10m pillar-api-1 2>&1 | grep -i "openrouter\|openai" | tail -20
```

**Common causes:**
- Provider outage: wait for recovery, or switch to alternative model
- Expired/invalid API key: regenerate from provider dashboard
- Rate limiting: reduce request concurrency or upgrade plan
- Credit exhaustion: top up credits

---

### 4.2 Database Connection Errors

**Alert pattern:** Digest contains `OperationalError.*database`

**Step-by-step:**

```bash
# 1. Check PostgreSQL is running
docker exec pillar-db-1 pg_isready -U postgres

# 2. If PostgreSQL is down, go to Section 2.4

# 3. If PostgreSQL is up but connections fail, check connection count
docker exec pillar-db-1 psql -U postgres -c "
SELECT count(*) AS total_connections,
       count(*) FILTER (WHERE state = 'active') AS active,
       count(*) FILTER (WHERE state = 'idle') AS idle,
       count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_txn
FROM pg_stat_activity;
"

# 4. Check max connections setting
docker exec pillar-db-1 psql -U postgres -c "SHOW max_connections;"

# 5. If connections are maxed out, kill idle-in-transaction connections
docker exec pillar-db-1 psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
AND query_start < now() - interval '5 minutes';
"

# 6. Restart API to release all connection pool connections
docker compose -f /opt/pillar/docker-compose.yml restart api

# 7. If the problem persists, check connection pool settings
grep -i "pool\|conn" /opt/pillar/backend/.env

# 8. Check for long-running transactions that may be holding connections
docker exec pillar-db-1 psql -U postgres -c "
SELECT pid, now() - xact_start AS xact_duration, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start ASC
LIMIT 10;
"
```

**Common causes:**
- Connection pool exhaustion: too many concurrent requests, pool too small
- Idle-in-transaction sessions: application bug not closing transactions
- PostgreSQL max_connections reached: increase or fix connection leaks

---

### 4.3 Hatchet Errors

**Alert pattern:** Digest contains `HatchetError`

**Step-by-step:**

```bash
# 1. Check Hatchet Cloud dashboard
# https://cloud.onhatchet.run

# 2. Check worker logs for details
docker compose -f /opt/pillar/docker-compose.yml logs --tail 100 worker | grep -i "hatchet"

# 3. Check worker container health
docker compose -f /opt/pillar/docker-compose.yml ps worker

# 4. Test connectivity to Hatchet Cloud from VM
curl -s -o /dev/null -w "%{http_code}" https://app.hatchet.run

# 5. If token expired, regenerate from Hatchet dashboard
# Update HATCHET_CLIENT_TOKEN in /opt/pillar/backend/.env
# Then restart:
docker compose -f /opt/pillar/docker-compose.yml restart worker

# 6. If specific workflow failures, check the Hatchet Cloud UI
# for failed runs and their error messages

# 7. Verify all env vars are set
grep HATCHET /opt/pillar/backend/.env
```

**Common causes:**
- Hatchet Cloud outage: check their status page
- Token expired/revoked: regenerate from dashboard
- Network connectivity: firewall or DNS issues from VM
- Worker crash loop: check logs for the root error before Hatchet errors

---

### 4.4 Error Spike (>=10 in 5min)

**Alert:** `:red_circle: Pillar Error Spike: N errors in 5min`
**Meaning:** 10 or more errors detected across API and Worker in a 5-minute window.

**Step-by-step:**

```bash
# 1. Read the Slack alert — it lists the top error patterns grouped by count

# 2. Get full error details
docker logs --since 10m pillar-api-1 2>&1 | grep -iE "ERROR|Exception|CRITICAL" | tail -30
docker logs --since 10m pillar-worker-1 2>&1 | grep -iE "ERROR|Exception|CRITICAL" | tail -30

# 3. Look for a pattern — is it one error repeated or many different errors?
docker logs --since 10m pillar-api-1 2>&1 | grep -iE "ERROR|Exception" | \
  sed 's/^[0-9T:.Z -]*//' | sort | uniq -c | sort -rn | head -10

# 4. Check if a recent deploy caused this
# When was the container last created?
docker inspect pillar-api-1 --format='{{.Created}}'
docker inspect pillar-worker-1 --format='{{.Created}}'
# If recent (last hour), the deploy might be the cause

# 5. If deploy-related, rollback
# Find the previous image tag/SHA
docker images pillar-api --format "{{.Tag}} {{.CreatedAt}}" | head -5
# Restart with previous image (update docker-compose.yml or use specific tag)

# 6. If NOT deploy-related, investigate root cause:
#    - Database errors → Section 4.2
#    - Provider errors → Section 4.1
#    - Hatchet errors → Section 4.3
#    - Timeout errors → check if services are overloaded (Section 3.3)

# 7. If errors are transient (network blip), monitor for 10 minutes
#    The monitoring system will send a recovery alert if errors stop
```

**Triage priorities:**
1. Is it affecting users right now? (Check if API health endpoint still passes)
2. Is it a single error type or many? (Single = likely one root cause)
3. Did it start after a deploy? (Check container creation time)
4. Is it an external dependency? (Provider outage, Hatchet down)

---

## 5. Post-Incident Checklist

After resolving any incident, go through this checklist:

```
[ ] Verify recovery alert was sent to #pillar-monitoring Slack channel
[ ] Check that ALL services are back up:
      curl -sf http://localhost:8000/health/ready && echo "API OK"
      curl -sf https://pillar-api.brendi.com.br/health/ready && echo "External OK"
      docker exec pillar-db-1 pg_isready -U postgres && echo "DB OK"
      docker exec pillar-redis-1 redis-cli ping
      docker ps --filter "name=pillar-worker-1" --filter "status=running" -q | grep -q . && echo "Worker OK"
      curl -sf http://localhost:3000 > /dev/null && echo "Frontend OK"

[ ] Check monitoring state files reflect reality:
      cat /tmp/pillar-monitor/health/*.state

[ ] If deploy-related: identify the commit that caused the issue
      git -C /opt/pillar/backend log --oneline -5

[ ] Review error digest — are errors still occurring?
      docker logs --since 5m pillar-api-1 2>&1 | grep -c -iE "ERROR|Exception"
      docker logs --since 5m pillar-worker-1 2>&1 | grep -c -iE "ERROR|Exception"

[ ] Check resource levels are back to normal:
      df -h /
      free -m
      docker stats --no-stream

[ ] Consider permanent fix if the issue was a workaround:
      - Was it a restart that fixed it? → investigate root cause
      - Was it disk space? → set up log rotation or expand disk
      - Was it memory? → adjust WEB_CONCURRENCY or upgrade VM
      - Was it a provider outage? → consider fallback provider config

[ ] Document the incident:
      - What happened (alert received)
      - What was the root cause
      - What was done to fix it
      - How to prevent recurrence
```

### Quick Verification One-Liner

Run this after any incident to verify all services at once:

```bash
echo "=== Pillar Health Check ===" && \
curl -sf -m 5 http://localhost:8000/health/ready > /dev/null && echo "API internal: OK" || echo "API internal: FAIL" && \
curl -sf -m 10 https://pillar-api.brendi.com.br/health/ready > /dev/null && echo "API external: OK" || echo "API external: FAIL" && \
docker exec pillar-db-1 pg_isready -U postgres > /dev/null 2>&1 && echo "PostgreSQL: OK" || echo "PostgreSQL: FAIL" && \
(docker exec pillar-redis-1 redis-cli ping 2>/dev/null | grep -q PONG && echo "Redis: OK" || echo "Redis: FAIL") && \
(docker ps --filter "name=pillar-worker-1" --filter "status=running" -q | grep -q . && echo "Worker: OK" || echo "Worker: FAIL") && \
curl -sf -m 5 http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: FAIL" && \
echo "=== Resources ===" && \
echo "Disk: $(df / | awk 'NR==2 {print $5}')" && \
echo "Memory: $(free | awk '/Mem:/ {printf "%.0f%%", ($3/$2)*100}')" && \
echo "=== Done ==="
```

---

## Appendix: Monitoring System Reference

### Scripts and Schedule

| Script | Cron | Purpose |
|---|---|---|
| `health-check.sh` | Every 1 minute | Checks API (internal/external), DB, Redis, Worker, Frontend |
| `error-digest.sh` | Every 5 minutes | Scans API/Worker logs for errors, groups and reports |
| `resource-monitor.sh` | Every 5 minutes | Checks disk, memory, CPU, Docker disk usage |

### State Files

Location: `/tmp/pillar-monitor/`

```
/tmp/pillar-monitor/
  health/
    api-internal.state
    api-external.state
    db.state
    redis.state
    worker.state
    frontend.state
  resources/
    disk.state
    memory.state
    cpu.state
    docker-disk.state
  errors/
    last_scan.ts
    last_digest.hash
```

Each `.state` file contains:
```
state=up        # or down, ok, warning, critical
since=2026-04-08T12:00:00Z
```

### Manually Resetting Alert State

If the monitoring system has stale state (e.g., thinks something is down when it's up):

```bash
# Reset all health states
rm -f /tmp/pillar-monitor/health/*.state

# Reset all resource states
rm -f /tmp/pillar-monitor/resources/*.state

# Reset error digest tracking
rm -f /tmp/pillar-monitor/errors/last_scan.ts
rm -f /tmp/pillar-monitor/errors/last_digest.hash
```

The next cron run will re-evaluate and set the correct states without firing transition alerts (first run after reset initializes state silently).

### Key Paths on the VM

| Path | What |
|---|---|
| `/opt/pillar/docker-compose.yml` | Docker Compose configuration |
| `/opt/pillar/backend/.env` | Backend environment variables (API keys, DB creds, etc.) |
| `/opt/pillar/monitoring/` | Monitoring scripts |
| `/opt/pillar/monitoring/.env` | Slack webhook URL |
| `/opt/pillar/monitoring/logs/` | Monitoring script logs |
| `/tmp/pillar-monitor/` | Monitoring state files (ephemeral) |
| `/var/lib/docker/` | Docker data (images, containers, volumes) |
| `/var/log/nginx/` | Nginx logs |

### External Service Dashboards

| Service | URL |
|---|---|
| OpenRouter Status | https://openrouter.ai/status |
| OpenAI Status | https://status.openai.com |
| Hatchet Cloud | https://cloud.onhatchet.run |
| GCE Console | https://console.cloud.google.com/compute/instances |
