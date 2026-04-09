#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/state.sh"
source "$SCRIPT_DIR/lib/slack.sh"

# --- Thresholds ---
DISK_WARN=80
DISK_CRIT=90
MEM_WARN=85
MEM_CRIT=95
CPU_WARN=80
CPU_CRIT=95
DOCKER_DISK_WARN_GB=15
DOCKER_DISK_CRIT_GB=25

# --- Actionable hints ---
declare -A WARN_HINTS
WARN_HINTS[disk]="ssh pillar-vm -> docker system prune -f -> du -sh /opt/pillar/"
WARN_HINTS[memory]="ssh pillar-vm -> docker stats --no-stream -> check for memory leaks in api/worker"
WARN_HINTS[cpu]="ssh pillar-vm -> top -bn1 -> docker stats --no-stream -> identify hot container"
WARN_HINTS[docker-disk]="ssh pillar-vm -> docker system prune -f -> docker image prune -a"

declare -A CRIT_HINTS
CRIT_HINTS[disk]="URGENT: ssh pillar-vm -> docker system prune -af -> check postgres WAL files"
CRIT_HINTS[memory]="URGENT: ssh pillar-vm -> docker compose restart api worker -> consider increasing VM RAM"
CRIT_HINTS[cpu]="URGENT: ssh pillar-vm -> docker compose restart api worker"
CRIT_HINTS[docker-disk]="URGENT: ssh pillar-vm -> docker system prune -af"

ensure_dirs

# --- Check functions ---
get_disk_pct() {
  df / | awk 'NR==2 {gsub(/%/,""); print $5}'
}

get_mem_pct() {
  free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}'
}

get_cpu_pct() {
  local load nproc_val
  load=$(cat /proc/loadavg | awk '{print $1}')
  nproc_val=$(nproc)
  awk "BEGIN {printf \"%.0f\", ($load / $nproc_val) * 100}"
}

get_docker_disk_gb() {
  docker system df --format '{{.Size}}' 2>/dev/null | \
    awk '{
      val=$1; unit=$1;
      gsub(/[0-9.]/, "", unit);
      gsub(/[A-Za-z]/, "", val);
      if (unit ~ /GB/) total += val;
      else if (unit ~ /MB/) total += val/1024;
      else if (unit ~ /kB/) total += val/1048576;
    } END {printf "%.1f", total}'
}

# --- Classify state ---
classify() {
  local val=$1 warn=$2 crit=$3
  if [[ $val -ge $crit ]]; then
    echo "critical"
  elif [[ $val -ge $warn ]]; then
    echo "warning"
  else
    echo "ok"
  fi
}

classify_float() {
  local val=$1 warn=$2 crit=$3
  awk "BEGIN {
    if ($val >= $crit) print \"critical\";
    else if ($val >= $warn) print \"warning\";
    else print \"ok\"
  }"
}

# --- Build status summary ---
build_resource_line() {
  local exclude="$1"
  local disk_pct mem_pct cpu_pct docker_gb
  disk_pct=$(get_disk_pct)
  mem_pct=$(get_mem_pct)
  cpu_pct=$(get_cpu_pct)
  docker_gb=$(get_docker_disk_gb)

  local line=""
  for resource in disk memory cpu docker-disk; do
    [[ "$resource" == "$exclude" ]] && continue
    local val icon=":white_check_mark:"
    case "$resource" in
      disk) val="${disk_pct}%" ;;
      memory) val="${mem_pct}%" ;;
      cpu) val="${cpu_pct}%" ;;
      docker-disk) val="${docker_gb}GB" ;;
    esac
    line+="$resource: $val $icon | "
  done
  echo "${line% | }"
}

# --- Process a resource check ---
process_resource() {
  local name="$1" current="$2" unit="$3" new_state="$4"
  local transition
  transition=$(check_transition "resources" "$name" "$new_state")

  if [[ "$transition" == "changed" ]]; then
    local resource_line
    resource_line=$(build_resource_line "$name")
    local old_state
    old_state=$(get_state "resources" "$name")

    if [[ "$new_state" == "ok" ]]; then
      save_state "resources" "$name" "$new_state"
      send_slack ":large_green_circle: *Pillar Resource Recovered: ${name}*
Was: ${old_state} | Now: ${current}${unit} (ok)
${resource_line}"

    elif [[ "$new_state" == "warning" ]]; then
      local hint="${WARN_HINTS[$name]:-}"
      save_state "resources" "$name" "$new_state"
      local msg=":warning: *Pillar Resource Warning: ${name} ${current}${unit}*
${resource_line}"
      [[ -n "$hint" ]] && msg+="\n> :bulb: ${hint}"
      send_slack "$msg"

    elif [[ "$new_state" == "critical" ]]; then
      local hint="${CRIT_HINTS[$name]:-}"
      save_state "resources" "$name" "$new_state"
      local msg=":red_circle: *Pillar Resource Critical: ${name} ${current}${unit}*
${resource_line}"
      [[ -n "$hint" ]] && msg+="\n> :bulb: ${hint}"
      send_slack "$msg"
    fi
  else
    local old_state
    old_state=$(get_state "resources" "$name")
    if [[ "$old_state" == "unknown" ]]; then
      save_state "resources" "$name" "$new_state"
    fi
  fi
}

# --- Run all checks ---
disk_pct=$(get_disk_pct)
mem_pct=$(get_mem_pct)
cpu_pct=$(get_cpu_pct)
docker_gb=$(get_docker_disk_gb)

disk_state=$(classify "$disk_pct" $DISK_WARN $DISK_CRIT)
mem_state=$(classify "$mem_pct" $MEM_WARN $MEM_CRIT)
cpu_state=$(classify "$cpu_pct" $CPU_WARN $CPU_CRIT)
docker_state=$(classify_float "$docker_gb" $DOCKER_DISK_WARN_GB $DOCKER_DISK_CRIT_GB)

process_resource "disk" "$disk_pct" "%" "$disk_state"
process_resource "memory" "$mem_pct" "%" "$mem_state"
process_resource "cpu" "$cpu_pct" "%" "$cpu_state"
process_resource "docker-disk" "$docker_gb" "GB" "$docker_state"
