#!/usr/bin/env bash
set -euo pipefail

CRON_TAG="# pillar-monitor"

echo "=== Pillar Monitoring Uninstall ==="

# Remove crontab entries
crontab -l 2>/dev/null | grep -v "$CRON_TAG" > /tmp/pillar-cron-tmp || true
crontab /tmp/pillar-cron-tmp
rm /tmp/pillar-cron-tmp
echo "[OK] Crontab entries removed"

# Clean state
rm -rf /tmp/pillar-monitor
echo "[OK] State directory removed"

echo ""
echo "=== Uninstall complete ==="
echo "Note: .env and logs/ were NOT removed. Delete manually if needed."
