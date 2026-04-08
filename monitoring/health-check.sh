#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"
source "$SCRIPT_DIR/lib/slack.sh"

# --- Configuration ---
API_INTERNAL_URL="http://localhost:8000/health/ready"
API_EXTERNAL_URL="https://pillar-api.brendi.com.br/health/ready"
FRONTEND_URL="http://localhost:3000"
COMPOSE_DIR="/opt/pillar"

# Container names (docker compose project "pillar")
DB_CONTAINER="pillar-db-1"
REDIS_CONTAINER="pillar-redis-1"
WORKER_CONTAINER="pillar-worker-1"

# --- Actionable hints ---
declare -A HINTS
HINTS[api-internal]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml logs api --tail 50 -> docker compose -f $COMPOSE_DIR/docker-compose.yml restart api"
HINTS[api-external]="Nginx issue. ssh pillar-vm -> sudo nginx -t -> sudo systemctl restart nginx"
HINTS[api-both]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml ps -> docker compose -f $COMPOSE_DIR/docker-compose.yml up -d api"
HINTS[db]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml logs db --tail 30 -> docker compose -f $COMPOSE_DIR/docker-compose.yml restart db (check disk space first)"
HINTS[redis]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml restart redis"
HINTS[worker]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml logs worker --tail 50 -> docker compose -f $COMPOSE_DIR/docker-compose.yml restart worker"
HINTS[frontend]="ssh pillar-vm -> docker compose -f $COMPOSE_DIR/docker-compose.yml logs frontend --tail 30 -> docker compose -f $COMPOSE_DIR/docker-compose.yml restart frontend"

ensure_dirs

# --- Check functions ---
check_api_internal() {
  if curl -sf -m 5 "$API_INTERNAL_URL" > /dev/null 2>&1; then
    echo "up"
  else
    echo "down"
  fi
}

check_api_external() {
  if curl -sf -m 10 "$API_EXTERNAL_URL" > /dev/null 2>&1; then
    echo "up"
  else
    echo "down"
  fi
}

check_db() {
  if docker exec "$DB_CONTAINER" pg_isready -U postgres > /dev/null 2>&1; then
    echo "up"
  else
    echo "down"
  fi
}

check_redis() {
  local result
  result=$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)
  if [[ "$result" == "PONG" ]]; then
    echo "up"
  else
    echo "down"
  fi
}

check_worker() {
  if docker ps --filter "name=$WORKER_CONTAINER" --filter "status=running" -q | grep -q .; then
    echo "up"
  else
    echo "down"
  fi
}

check_frontend() {
  if curl -sf -m 5 "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "up"
  else
    echo "down"
  fi
}

# --- Build status line ---
build_status_line() {
  local exclude="$1"
  local line=""
  local -A states
  states[api-internal]=$(check_api_internal)
  states[api-external]=$(check_api_external)
  states[db]=$(check_db)
  states[redis]=$(check_redis)
  states[worker]=$(check_worker)
  states[frontend]=$(check_frontend)

  for svc in api-internal api-external db redis worker frontend; do
    [[ "$svc" == "$exclude" ]] && continue
    local icon=":white_check_mark:"
    [[ "${states[$svc]}" == "down" ]] && icon=":x:"
    line+="$svc: $icon | "
  done
  echo "${line% | }"
}

# --- Get hint for a service ---
get_hint() {
  local service="$1"
  local api_int_state api_ext_state
  if [[ "$service" == "api-internal" || "$service" == "api-external" ]]; then
    api_int_state=$(get_state "health" "api-internal")
    api_ext_state=$(get_state "health" "api-external")
    if [[ "$api_int_state" == "down" && "$api_ext_state" == "down" ]]; then
      echo "${HINTS[api-both]}"
      return
    fi
  fi
  echo "${HINTS[$service]:-No hint available}"
}

# --- Alert on transition ---
process_check() {
  local service="$1" new_state="$2"
  local transition
  transition=$(check_transition "health" "$service" "$new_state")

  if [[ "$transition" == "changed" ]]; then
    local status_line
    status_line=$(build_status_line "$service")

    if [[ "$new_state" == "down" ]]; then
      local hint
      hint=$(get_hint "$service")
      save_state "health" "$service" "$new_state"
      send_slack ":red_circle: *Pillar DOWN: ${service}*
Health check failed
${status_line}
> :bulb: ${hint}"
    else
      local downtime
      downtime=$(get_downtime "health" "$service")
      save_state "health" "$service" "$new_state"
      send_slack ":large_green_circle: *Pillar RECOVERED: ${service}*
Downtime: ${downtime}
${status_line}"
    fi
  else
    local old_state
    old_state=$(get_state "health" "$service")
    if [[ "$old_state" == "unknown" ]]; then
      save_state "health" "$service" "$new_state"
    fi
  fi
}

# --- Run all checks ---
process_check "api-internal" "$(check_api_internal)"
process_check "api-external" "$(check_api_external)"
process_check "db" "$(check_db)"
process_check "redis" "$(check_redis)"
process_check "worker" "$(check_worker)"
process_check "frontend" "$(check_frontend)"
