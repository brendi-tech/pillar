#!/usr/bin/env bash
# Slack webhook sender for pillar-monitor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
ENV_FILE="$SCRIPT_DIR/.env"

# Load webhook URL from .env
load_slack_config() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "[ERROR] $ENV_FILE not found. Run install.sh first." >&2
    return 1
  fi
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
    echo "[ERROR] SLACK_WEBHOOK_URL not set in $ENV_FILE" >&2
    return 1
  fi
}

# Send a message to Slack via webhook
# Usage: send_slack "message text"
# Returns: 0 on success, 1 on failure
send_slack() {
  local message="$1"
  local payload max_retries=1 retry=0

  load_slack_config || return 1

  # Escape special JSON characters
  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"
  message="${message//$'\n'/\\n}"

  payload="{\"text\":\"${message}\"}"

  while [[ $retry -le $max_retries ]]; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d "$payload" \
      --max-time 10 \
      "$SLACK_WEBHOOK_URL")

    if [[ "$http_code" == "200" ]]; then
      return 0
    fi

    retry=$((retry + 1))
    if [[ $retry -le $max_retries ]]; then
      sleep 2
    fi
  done

  # Log failure
  mkdir -p "$LOG_DIR"
  printf '[%s] SLACK SEND FAILED (HTTP %s): %s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$http_code" "$message" \
    >> "$LOG_DIR/slack-failures.log"
  return 1
}
