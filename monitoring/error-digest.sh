#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"
source "$SCRIPT_DIR/lib/slack.sh"

# --- Configuration ---
COMPOSE_DIR="/opt/pillar"
API_CONTAINER="pillar-api-1"
WORKER_CONTAINER="pillar-worker-1"
ERROR_SPIKE_THRESHOLD=10
SCAN_INTERVAL="5m"

# --- Error pattern hints ---
declare -A ERROR_HINTS
ERROR_HINTS["ConnectionError.*OpenRouter"]="LLM provider issue. Check https://openrouter.ai/status or switch model in /opt/pillar/backend/.env"
ERROR_HINTS["ConnectionError.*openai"]="Embeddings provider issue. Check https://status.openai.com"
ERROR_HINTS["OperationalError.*database"]="DB connection issue. Check PostgreSQL container + connection pool"
ERROR_HINTS["RedisError"]="Redis issue. docker compose restart redis"
ERROR_HINTS["ConnectionRefused.*6379"]="Redis issue. docker compose restart redis"
ERROR_HINTS["HatchetError"]="Background job failure. Check https://cloud.onhatchet.run dashboard"
ERROR_HINTS["TimeoutError"]="Request timeout. Check if API is overloaded: docker stats --no-stream"

ensure_dirs

STATE_DIR="/tmp/pillar-monitor"
LAST_SCAN_FILE="$STATE_DIR/errors/last_scan.ts"
LAST_HASH_FILE="$STATE_DIR/errors/last_digest.hash"

# --- Get scan window ---
get_since_arg() {
  if [[ -f "$LAST_SCAN_FILE" ]]; then
    cat "$LAST_SCAN_FILE"
  else
    echo "$SCAN_INTERVAL"
  fi
}

# --- Extract errors from a container's logs ---
get_errors() {
  local container="$1" since="$2"
  docker logs --since "$since" "$container" 2>&1 | \
    grep -iE '(ERROR|Traceback|Exception|CRITICAL)' | \
    grep -v '^$' || true
}

# --- Group and count similar errors ---
group_errors() {
  sort | \
    sed 's/^[0-9T:.Z -]*//' | \
    sed 's/  */ /g' | \
    sort | uniq -c | sort -rn | \
    awk '{count=$1; $1=""; sub(/^ /, ""); printf "%d|%s\n", count, $0}'
}

# --- Match error to hint ---
match_hint() {
  local error_line="$1"
  for pattern in "${!ERROR_HINTS[@]}"; do
    if echo "$error_line" | grep -qiE "$pattern"; then
      echo "${ERROR_HINTS[$pattern]}"
      return
    fi
  done
  echo ""
}

# --- Build digest message ---
build_digest() {
  local since
  since=$(get_since_arg)

  local api_errors worker_errors
  api_errors=$(get_errors "$API_CONTAINER" "$since")
  worker_errors=$(get_errors "$WORKER_CONTAINER" "$since")

  local api_count=0 worker_count=0
  [[ -n "$api_errors" ]] && api_count=$(echo "$api_errors" | wc -l | tr -d ' ')
  [[ -n "$worker_errors" ]] && worker_count=$(echo "$worker_errors" | wc -l | tr -d ' ')
  local total=$((api_count + worker_count))

  if [[ $total -eq 0 ]]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_SCAN_FILE"
    return 0
  fi

  local severity_icon=":warning:"
  local title="Pillar Error Digest (last 5min)"
  if [[ $total -ge $ERROR_SPIKE_THRESHOLD ]]; then
    severity_icon=":red_circle:"
    title="Pillar Error Spike: $total errors in 5min"
  fi

  local message="${severity_icon} *${title}*"

  if [[ $api_count -gt 0 ]]; then
    message+="\n\n*API ($api_count errors):*"
    while IFS='|' read -r count line; do
      message+="\n- ${line} — x${count}"
    done <<< "$(echo "$api_errors" | group_errors | head -10)"
  fi

  if [[ $worker_count -gt 0 ]]; then
    message+="\n\n*Worker ($worker_count errors):*"
    while IFS='|' read -r count line; do
      message+="\n- ${line} — x${count}"
    done <<< "$(echo "$worker_errors" | group_errors | head -10)"
  fi

  local all_errors="${api_errors}${worker_errors}"
  local top_error
  top_error=$(echo "$all_errors" | group_errors | head -1 | cut -d'|' -f2)
  local hint
  hint=$(match_hint "$top_error")
  if [[ -n "$hint" ]]; then
    message+="\n\n> :bulb: ${hint}"
  fi

  local digest_hash
  digest_hash=$(echo "$message" | md5sum | cut -d' ' -f1)
  if [[ -f "$LAST_HASH_FILE" ]] && [[ "$(cat "$LAST_HASH_FILE")" == "$digest_hash" ]]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_SCAN_FILE"
    return 0
  fi

  send_slack "$message"
  echo "$digest_hash" > "$LAST_HASH_FILE"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_SCAN_FILE"
}

build_digest
