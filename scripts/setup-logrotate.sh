#!/bin/bash
set -e

echo "Setting up log rotation on VPS..."

# Copy config
scp "$(dirname "$0")/../vps/logrotate-worker.conf" brieftube-vps:/tmp/

# Install on VPS
ssh brieftube-vps << 'REMOTE'
sudo mv /tmp/logrotate-worker.conf /etc/logrotate.d/brieftube-worker
sudo chown root:root /etc/logrotate.d/brieftube-worker
sudo chmod 644 /etc/logrotate.d/brieftube-worker

# Test
echo "Testing logrotate config..."
sudo logrotate -d /etc/logrotate.d/brieftube-worker 2>&1 | head -20

# Show current log size
echo ""
echo "Current log size:"
ls -lh /home/brieftube/app/worker/worker.log

echo ""
echo "✅ Log rotation configured (daily, 7 days retention, max 50MB)"
REMOTE
