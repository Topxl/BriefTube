#!/bin/bash
# Startup script for BriefTube worker on Raspberry Pi
# Fetches secrets from Infisical and launches the worker

set -e

WORKER_DIR="$(cd "$(dirname "$0")/.." && pwd)/worker"
VENV="$WORKER_DIR/venv"

# Fetch Infisical token
TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" \
  --client-secret="$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" \
  --plain --silent 2>/dev/null)

# Run worker with secrets injected
exec infisical run \
  --token="$TOKEN" \
  --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 \
  --env=prod \
  --path=/worker \
  -- "$VENV/bin/python" "$WORKER_DIR/main.py"
