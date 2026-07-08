#!/bin/bash
# Supabase auto-restart watchdog runner for the Raspberry Pi.
# Fetches secrets from Infisical and runs supabase_watchdog.py.
# Intended to be called every ~5 min from cron, e.g.:
#   */5 * * * * flock -n /tmp/sb-watchdog.lock /home/pi/brieftube/vps/run-watchdog.sh >> /home/pi/brieftube/worker/watchdog.log 2>&1
#
# Infisical Universal Auth creds are expected in /home/pi/.brieftube-secrets.env.

set -e

WORKER_DIR="$(cd "$(dirname "$0")/.." && pwd)/worker"
VENV="$WORKER_DIR/venv"

# shellcheck disable=SC1091
set -a; source /home/pi/.brieftube-secrets.env; set +a

TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" \
  --client-secret="$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" \
  --plain --silent 2>/dev/null)

exec infisical run \
  --token="$TOKEN" \
  --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 \
  --env=prod \
  --path=/worker \
  -- "$VENV/bin/python" "$WORKER_DIR/supabase_watchdog.py"
