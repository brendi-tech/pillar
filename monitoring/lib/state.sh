#!/usr/bin/env bash
# State transition tracking for pillar-monitor
# States are stored as plain text files in /tmp/pillar-monitor/

STATE_DIR="/tmp/pillar-monitor"

ensure_dirs() {
  mkdir -p "$STATE_DIR/health" "$STATE_DIR/resources" "$STATE_DIR/errors"
}

# Read current saved state for a service
# Usage: get_state <category> <service>
# Returns: state string or "unknown" if no state file
get_state() {
  local category="$1" service="$2"
  local file="$STATE_DIR/$category/$service.state"
  if [[ -f "$file" ]]; then
    grep '^state=' "$file" | cut -d= -f2
  else
    echo "unknown"
  fi
}

# Save state + timestamp for a service
# Usage: save_state <category> <service> <state>
save_state() {
  local category="$1" service="$2" state="$3"
  local file="$STATE_DIR/$category/$service.state"
  ensure_dirs
  printf 'state=%s\nsince=%s\n' "$state" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$file"
}

# Check if state changed. Prints "changed" or "same".
# Usage: check_transition <category> <service> <new_state>
check_transition() {
  local category="$1" service="$2" new_state="$3"
  local old_state
  old_state=$(get_state "$category" "$service")
  if [[ "$old_state" == "$new_state" ]]; then
    echo "same"
  else
    echo "changed"
  fi
}

# Get the timestamp when the current state was saved
# Usage: get_since <category> <service>
get_since() {
  local category="$1" service="$2"
  local file="$STATE_DIR/$category/$service.state"
  if [[ -f "$file" ]]; then
    grep '^since=' "$file" | cut -d= -f2
  else
    echo ""
  fi
}

# Calculate human-readable downtime since state change
# Usage: get_downtime <category> <service>
# Returns: "~3 minutes", "~1 hour", etc.
get_downtime() {
  local category="$1" service="$2"
  local since
  since=$(get_since "$category" "$service")
  if [[ -z "$since" ]]; then
    echo "unknown"
    return
  fi
  local since_epoch now_epoch diff_seconds
  since_epoch=$(date -d "$since" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$since" +%s 2>/dev/null)
  now_epoch=$(date +%s)
  if [[ -z "$since_epoch" ]]; then
    echo "unknown"
    return
  fi
  diff_seconds=$((now_epoch - since_epoch))
  if [[ $diff_seconds -lt 60 ]]; then
    echo "~${diff_seconds}s"
  elif [[ $diff_seconds -lt 3600 ]]; then
    echo "~$((diff_seconds / 60)) minutes"
  elif [[ $diff_seconds -lt 86400 ]]; then
    echo "~$((diff_seconds / 3600)) hours"
  else
    echo "~$((diff_seconds / 86400)) days"
  fi
}
