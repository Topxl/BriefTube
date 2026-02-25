#!/bin/bash
# Wrapper Infisical Universal Auth pour le log bot
set -e

TOKEN=$(infisical login \
  --method=universal-auth \
  --client-id="${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID}" \
  --client-secret="${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET}" \
  --plain --silent 2>/dev/null)

exec infisical run \
  --token="${TOKEN}" \
  --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 \
  --env=prod \
  --path=/worker \
  -- /home/brieftube/app/worker/venv/bin/python log_bot.py
