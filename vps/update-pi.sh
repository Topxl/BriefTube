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
    # gtts pins click<8.2 but the modal/typer CLI needs click>=8.2 — gtts only
    # uses click for its gtts-cli entry point, which the worker never calls
    worker/venv/bin/pip install -q 'click>=8.2' >> "$LOG" 2>&1 || true
fi

# Redeploy Modal if worker code changed. Non-fatal: GitHub Actions also
# deploys Modal on push, and a local deploy failure (set -e) must never
# abort the script before the worker restart below.
if git diff --name-only "$LOCAL" "$REMOTE" | grep -q "^worker/"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Redeploying Modal function..." >> "$LOG"
    worker/venv/bin/modal deploy worker/modal_processor.py >> "$LOG" 2>&1 \
        || echo "[$(date '+%Y-%m-%d %H:%M:%S')] Modal deploy failed (non-fatal) — continuing" >> "$LOG"
fi

# Restart worker
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting worker..." >> "$LOG"
sudo systemctl restart brieftube-worker

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete." >> "$LOG"
