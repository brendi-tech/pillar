#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_TAG="# pillar-monitor"

echo "=== Pillar Monitoring Setup ==="
echo ""

# --- Step 1: Configure Slack webhook ---
if [[ -f "$SCRIPT_DIR/.env" ]] && grep -q 'SLACK_WEBHOOK_URL=https://' "$SCRIPT_DIR/.env"; then
  echo "[OK] .env already configured"
else
  echo "Enter your Slack webhook URL for #pillar-monitoring:"
  read -r webhook_url
  if [[ -z "$webhook_url" ]]; then
    echo "[ERROR] Webhook URL cannot be empty" >&2
    exit 1
  fi
  echo "SLACK_WEBHOOK_URL=$webhook_url" > "$SCRIPT_DIR/.env"
  echo "[OK] Webhook saved to .env"
fi

# --- Step 2: Create directories ---
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p /tmp/pillar-monitor/{health,resources,errors}
echo "[OK] Directories created"

# --- Step 3: Make scripts executable ---
chmod +x "$SCRIPT_DIR/health-check.sh"
chmod +x "$SCRIPT_DIR/error-digest.sh"
chmod +x "$SCRIPT_DIR/resource-monitor.sh"
chmod +x "$SCRIPT_DIR/lib/state.sh"
chmod +x "$SCRIPT_DIR/lib/slack.sh"
echo "[OK] Scripts made executable"

# --- Step 4: Verify Docker container names ---
echo ""
echo "Verifying Docker containers..."
local_errors=0
for container in pillar-db-1 pillar-redis-1 pillar-api-1 pillar-worker-1 pillar-frontend-1; do
  if docker ps --filter "name=$container" -q | grep -q .; then
    echo "  [OK] $container running"
  else
    echo "  [WARN] $container not found or not running"
    local_errors=$((local_errors + 1))
  fi
done
if [[ $local_errors -gt 0 ]]; then
  echo ""
  echo "[WARN] Some containers not found. Container names may differ."
  echo "  Check with: docker ps --format '{{.Names}}'"
  echo "  Update container names in health-check.sh and error-digest.sh if needed."
  echo ""
fi

# --- Step 5: Install crontab ---
crontab -l 2>/dev/null | grep -v "$CRON_TAG" > /tmp/pillar-cron-tmp || true

cat >> /tmp/pillar-cron-tmp << EOF
* * * * * $SCRIPT_DIR/health-check.sh >> $SCRIPT_DIR/logs/health-check.log 2>&1 $CRON_TAG
*/5 * * * * $SCRIPT_DIR/error-digest.sh >> $SCRIPT_DIR/logs/error-digest.log 2>&1 $CRON_TAG
*/5 * * * * $SCRIPT_DIR/resource-monitor.sh >> $SCRIPT_DIR/logs/resource-monitor.log 2>&1 $CRON_TAG
EOF

crontab /tmp/pillar-cron-tmp
rm /tmp/pillar-cron-tmp
echo "[OK] Crontab entries installed"

# --- Step 6: Run test health check ---
echo ""
echo "Running test health check..."
source "$SCRIPT_DIR/lib/slack.sh"
send_slack ":white_check_mark: *Pillar Monitoring installed successfully*
Health checks: every 1 min
Error digest: every 5 min
Resource monitor: every 5 min"

if [[ $? -eq 0 ]]; then
  echo "[OK] Test message sent to #pillar-monitoring"
else
  echo "[ERROR] Failed to send test message. Check webhook URL in .env"
  exit 1
fi

echo ""
echo "=== Setup complete ==="
echo "Logs: $SCRIPT_DIR/logs/"
echo "State: /tmp/pillar-monitor/"
echo "To uninstall: $SCRIPT_DIR/uninstall.sh"
