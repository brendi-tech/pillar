# Pillar Infrastructure

> Last updated: 2026-04-09

## Architecture Overview

Pillar runs on **Google Cloud Run** with 3 services, backed by **Supabase** (PostgreSQL), **Upstash** (Redis), and **Hatchet Cloud** (workflow orchestration).

```
                    ┌─────────────────────────────────────────────────┐
                    │                  Google Cloud Run                │
                    │                  (us-central1)                   │
                    │                                                  │
  Users ──────────►│  pillar-frontend  (Next.js)    :3000             │
                    │       │                                          │
                    │       ▼                                          │
  API clients ────►│  pillar-api       (Django/ASGI) :8000            │
                    │       │                                          │
                    │       ▼                                          │
                    │  pillar-worker   (Hatchet)     :8001 (health)   │
                    └──────┬──────────┬──────────┬────────────────────┘
                           │          │          │
                    ┌──────▼──┐ ┌─────▼────┐ ┌──▼──────────┐
                    │Supabase │ │ Upstash  │ │   Hatchet   │
                    │Postgres │ │  Redis   │ │   Cloud     │
                    │(8XL)    │ │(serverl.)│ │  (managed)  │
                    └─────────┘ └──────────┘ └─────────────┘
```

## Services

### pillar-api (Django)

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12, Django 5.2, ASGI (Uvicorn via Gunicorn) |
| Port | 8000 |
| CPU | 2 |
| Memory | 2Gi |
| Min instances | 1 |
| Max instances | 50 |
| Concurrency | 80 requests/instance |
| Timeout | 300s |
| VPC | vpc-connector-front (private-ranges-only) |
| Auth | Public (allow-unauthenticated) |

**What it does:** REST API for the Pillar platform. Handles authentication (JWT), knowledge base management, agent conversations (SSE streaming), MCP server, billing (Stripe), integrations (Slack, Discord, email), and analytics.

**Key endpoints:**
- `/health/ready/` — health check (used by Cloud Monitoring uptime check)
- `/api/` — REST API (DRF + Spectacular OpenAPI)
- `/admin/` — Django admin

**Gunicorn config (`gunicorn.conf.py`):**
- Worker class: `UvicornWorker` (ASGI for async/SSE support)
- Workers: `WEB_CONCURRENCY` env var (default 2)
- Keepalive: 65s (longer than Cloud Run LB 60s timeout)
- Request timeout: 300s (for long SSE chat streams)
- Worker recycling: max 1000 requests with jitter

### pillar-worker (Hatchet)

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 + Node.js 22 + Playwright Chromium |
| Port | 8001 (health check only) |
| CPU | 2 |
| Memory | 4Gi |
| Min instances | 1 |
| Max instances | 5 |
| Concurrency | 1 (one task at a time per instance) |
| CPU throttling | Disabled (`--no-cpu-throttling`) |
| Timeout | 900s (15 min) |
| VPC | vpc-connector-front |
| Auth | Internal only (no-allow-unauthenticated) |

**What it does:** Runs ~26 background workflows orchestrated by Hatchet Cloud. Handles knowledge indexing, web crawling, product sync, Slack/Discord integrations, billing operations, agent scoring (with browser automation via Playwright/OpenClaw).

**Entry point:** `hatchet-worker-healthcheck.py` — runs an HTTP health check server on port 8001 and the Hatchet worker in a background thread with 100 task slots.

**Workflows:**

| Domain | Workflows |
|--------|-----------|
| Knowledge | sync_source, process_item, index_knowledge_item, delete_knowledge_item_index, async_crawl_*, cleanup, resync |
| Products | sync_actions |
| Tools | endpoint_health_check, mcp_discovery, mcp_embed_descriptions, mcp_source_refresh, openapi_* |
| Integrations | slack_handle_message, slack_account_link, slack_tool_oauth, discord_handle_message, discord_account_link, handle_inbound_email |
| Billing | early_adopter_bonus, free_tier_early_adopter_bonus |
| Agent Score | http_probes, browser_analysis, analyze_and_score, signup_test, finalize_report, openclaw_test |

**Health check states:** starting → connected → retrying → dead. Startup grace period of 240s. Exponential backoff on retry (max 5 attempts).

### pillar-frontend (Next.js)

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20 (Alpine) |
| Port | 3000 |
| CPU | 1 |
| Memory | 512Mi |
| Min instances | 0 (scales to zero) |
| Max instances | 10 |
| Concurrency | 200 |
| Timeout | 60s |
| VPC | vpc-connector-front |
| Auth | Public (allow-unauthenticated) |

**What it does:** Next.js standalone app serving the Pillar admin dashboard, documentation, and marketing pages. Builds with MDX support for docs content.

**Build args baked at build time:**
- `NEXT_PUBLIC_PILLAR_API_URL` — API URL (https://pillar-api.brendi.com.br)
- `NEXT_PUBLIC_ENV` — environment name

## Database (Supabase PostgreSQL)

| Setting | Value |
|---------|-------|
| Instance | Brendi shared Supabase (8XL Compute) |
| Schema | `pillar` (isolated from Brendi's `public` schema) |
| User | `pillar_user` |
| Search path | `pillar, public` (set on role via `ALTER ROLE`) |
| Pooler port | 6543 (runtime connections) |
| Direct port | 5432 (migrations only) |
| Extensions | pgvector, pg_trgm (in `public` schema, shared with Brendi) |

**Schema isolation:** Django tables live in the `pillar` schema. The `pillar_user` role has `search_path = pillar, public` set at the role level. This works with Supabase's connection pooler (port 6543) which does **not** support the `options` startup parameter.

**Connection settings (Cloud Run):**
- `CONN_MAX_AGE=0` — no persistent connections (Cloud Run instances are ephemeral)
- TCP keepalive enabled (idle=30s, interval=10s, count=5)
- Health check interval on connections
- Server-side cursors disabled

**Migrations:** Must use direct connection (port 5432), not the pooler. Run via `python manage.py migrate`.

## Cache & Sessions (Upstash Redis)

| Setting | Value |
|---------|-------|
| Provider | Upstash (serverless Redis) |
| Protocol | rediss:// (TLS) |
| Cache timeout | 300s |
| Key prefix | help_center |
| Connection pool | max 50 |
| Health check | every 30s |

**Used for:**
- Django cache backend (django-redis)
- Session storage
- Channel layers (WebSocket/async support)
- Distributed semaphore (Playwright browser concurrency control in worker)

## Workflow Orchestration (Hatchet Cloud)

| Setting | Value |
|---------|-------|
| Provider | Hatchet Cloud (managed) |
| Server | https://app.hatchet.run |
| Namespace | `pillar` |
| Auth | `HATCHET_CLIENT_TOKEN` (Secret Manager) |

Hatchet orchestrates all background jobs. The worker connects to Hatchet Cloud, receives tasks, and executes them. Cron schedules are only registered for production namespaces (`pillar-dev`, `pillar-prod`, `pillar-hc-dev`, `pillar-hc-prod`, `help-center-dev`, `help-center-prod`).

## Storage (GCS)

| Bucket | Purpose |
|--------|---------|
| `pillar-storage` | Private uploads (knowledge base files, documents) |
| `pillar-public` | Public assets (served with signed URLs in production) |

Storage backend is configurable (`STORAGE_BACKEND`): `local`, `s3`, or `gcs`. Production uses `gcs` via django-storages.

## Secrets (GCP Secret Manager)

All secrets are stored in GCP Secret Manager with the `pillar-` prefix and injected into Cloud Run at deploy time via `--set-secrets`.

| Secret | Purpose |
|--------|---------|
| `pillar-django-secret-key` | Django app secret |
| `pillar-db-password` | Supabase PostgreSQL password |
| `pillar-hatchet-token` | Hatchet Cloud authentication |
| `pillar-field-encryption-key` | Fernet encryption for bot tokens |
| `pillar-openrouter-api-key` | LLM provider (multi-model routing) |
| `pillar-openai-api-key` | OpenAI API |
| `pillar-cohere-api-key` | Cohere reranking |
| `pillar-redis-url` | Upstash Redis connection string |

## Networking

All three Cloud Run services use the `vpc-connector-front` VPC connector with `private-ranges-only` egress. This allows services to communicate with internal resources (like Supabase direct connections) while external traffic goes through the public internet.

**Custom domains:**
- `pillar-api.brendi.com.br` → pillar-api Cloud Run service
- `pillar-admin.brendi.com.br` → pillar-frontend Cloud Run service
- CNAME → `ghs.googlehosted.com` (Google-managed SSL)

**CORS (production):**
- Marketing sites: trypillar.com, pillar.bot
- Custom origins via `CORS_ALLOWED_ORIGINS` env var
- Credentials allowed, custom headers for SDK and MCP

## CI/CD Pipeline

```
Push to main ──► GitHub Actions ──► Cloud Build ──► Cloud Run
     │                │
     │           Tests on PR:
     │           ├── test-backend.yml (pytest + coverage)
     │           ├── test-frontend.yml (typecheck + lint + vitest)
     │           ├── test-agent-e2e.yml (DeepEval, real LLMs)
     │           └── test-rag-e2e.yml (embeddings + vector search)
     │
     └── Triggers: backend/**, frontend/**, deploy/**
         + manual workflow_dispatch (select service)
```

### Deploy workflow (`deploy.yml`)

**Triggers:**
- Push to `main` with changes in `backend/**`, `frontend/**`, or `deploy/**`
- Manual via `workflow_dispatch` with service selector (api / worker / frontend / all)

**Jobs (parallel):**
1. `deploy--api` → `gcloud builds submit --config=deploy/cloudbuild-api.yaml` → health check
2. `deploy--worker` → `gcloud builds submit --config=deploy/cloudbuild-worker.yaml`
3. `deploy--frontend` → `gcloud builds submit --config=deploy/cloudbuild-frontend.yaml`

**Auth:** `google-github-actions/auth@v2` + `setup-gcloud@v2` with `GCP_SA_KEY` secret (service account `pillar-deploy@brendi-app.iam.gserviceaccount.com`).

**GitHub secrets needed:**
- `GCP_SA_KEY` — GCP service account key (JSON)
- `PILLAR_DB_HOST` — Supabase host
- `PILLAR_DB_USER` — `pillar_user`
- `PILLAR_CORS_ORIGINS` — allowed CORS origins
- `PILLAR_FRONTEND_URL` — frontend URL

### Test workflows

| Workflow | Trigger | What it tests |
|----------|---------|---------------|
| `test-backend.yml` | PR → backend/** | pytest on Django apps, coverage → Codecov |
| `test-frontend.yml` | PR → frontend/**, packages/sdk** | TypeScript type-check, ESLint, Vitest |
| `test-agent-e2e.yml` | PR → agent code | DeepEval with real LLM calls (13 parallel workers) |
| `test-rag-e2e.yml` | PR → RAG code | Embedding + reranking with real APIs |

### Docker images

All images are pushed to `gcr.io/brendi-app/`:
- `pillar-backend-base:latest` — Python 3.12 + system deps + Python packages
- `pillar-worker-base:latest` — Python 3.12 + Node 22 + Playwright + OpenClaw
- `pillar-api:<env>` — API app (extends backend-base)
- `pillar-worker:<env>` — Worker app (extends worker-base)
- `pillar-frontend:<env>` — Next.js standalone

**Important:** Base images must be built with `--platform linux/amd64` (dev machines are Mac ARM, Cloud Build is AMD64).

## Monitoring

### Cloud Monitoring (active)

| Check | Interval | Target |
|-------|----------|--------|
| Uptime check `pillar-api-health-xKFi-T8WiKI` | 5 min | `/health/ready/` |

**Alert policies:**
- "Pillar API Down" → Slack `#pillar-monitoring`
- "Pillar API 5xx Error Rate" → Slack `#pillar-monitoring`

### Observability stack

| Layer | Tool |
|-------|------|
| Tracing | OpenTelemetry → GCP Cloud Trace (always-on) |
| Error tracking | Sentry (when `SENTRY_DSN` configured) |
| Structured logging | JSON format → Cloud Logging (auto-parsed) |
| Analytics | PostHog (feature flags + product analytics) |
| Conversation analytics | Agnost |

### Logging

Production uses `CloudLoggingFormatter` (JSON) so Cloud Logging can auto-parse severity, message, and trace context. The worker has a separate handler that avoids JSON formatting for Hatchet-specific logs.

## AI/LLM Stack

| Component | Provider | Model |
|-----------|----------|-------|
| Default LLM | OpenRouter | `anthropic/flagship` |
| Vision LLM | OpenRouter | `anthropic/flagship` |
| Embeddings | Google | `gemini-embedding-001` (1536 dims) |
| Reranking | Cohere | `rerank-v3.5` |
| Browser automation | OpenClaw | Playwright + AI agent |

**RAG configuration:**
- Chunk size: 1024 tokens, overlap: 200
- Retrieval: top-k=5, similarity threshold=0.5
- Reranking: top-n=5

## Local Development

### Quick start

```bash
# Start services
docker compose up -d db redis

# Backend
cd backend
cp .env.example .env  # fill in values
uv sync
python manage.py migrate
python manage.py runserver 8000

# Worker (separate terminal)
python worker.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Docker compose services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| db | pgvector:pg18 | 5432 | PostgreSQL + pgvector |
| redis | redis:7-alpine | 6380→6379 | Cache, sessions, channels |
| api | pillar-api | 8000 | Django API |
| worker | pillar-worker | — | Hatchet worker |
| frontend | pillar-frontend | 3000 | Next.js app |

## Scaling Guide

**Current config** (up to ~1000 simultaneous users):

| Service | CPU | Memory | Min | Max | Concurrency |
|---------|-----|--------|-----|-----|-------------|
| API | 2 | 2Gi | 1 | 50 | 80 |
| Worker | 2 | 4Gi | 1 | 5 | 1 |
| Frontend | 1 | 512Mi | 0 | 10 | 200 |

**To scale further:**
```bash
# API: more instances, more resources
gcloud run services update pillar-api --max-instances=100 --memory=4Gi --cpu=4

# Worker: more instances for parallel background jobs
gcloud run services update pillar-worker --max-instances=10

# Frontend: generally fine, mostly static
gcloud run services update pillar-frontend --max-instances=20
```

**Bottlenecks to watch:**
- Supabase connection limits (pooler helps, but monitor active connections)
- Upstash Redis throughput (serverless, auto-scales, but check latency)
- Hatchet Cloud rate limits (check plan)
- LLM API rate limits (OpenRouter, Cohere)

## Branch Protection

- Squash-only merge on `main`
- 1 approval required
- Bypass: Jezin2004 (id 196103254)
