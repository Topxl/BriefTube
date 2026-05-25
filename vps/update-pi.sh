#!/bin/bash
# Auto-update script for Raspberry Pi — run via cron every 5 min
# Pulls latest code, redeploys Modal, restarts worker only on changes

set -e
REPO="/home/pi/brieftube"
LOG="$REPO/worker/update.log"

cd "$REPO"
git fetch origin main --quiet 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] New commit detected — updating..." >> "$LOG"

git reset --hard origin/main >> "$LOG" 2>&1

# Reinstall Python dependencies if requirements changed
if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "worker/requirements.txt"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updating Python dependencies..." >> "$LOG"
    worker/venv/bin/pip install -r worker/requirements.txt -q >> "$LOG" 2>&1
fi

# Redeploy Modal if worker code changed
if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^worker/"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redeploying Modal function..." >> "$LOG"
    worker/venv/bin/modal deploy worker/modal_processor.py >> "$LOG" 2>&1
fi

# Restart worker
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting worker..." >> "$LOG"
sudo systemctl restart brieftube-worker

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete." >> "$LOG"
