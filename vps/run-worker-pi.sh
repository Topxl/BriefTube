#!/bin/bash
# Startup script for BriefTube worker on Raspberry Pi
# Fetches secrets from Infisical and launches the worker

set -e

WORKER_DIR="$(cd "$(dirname "$0")/.." && pwd)/worker"
VENV="$WORKER_DIR/venv"

# Fetch Infisical token.
# Le CLI peut pendre indefiniment sur un futex quand son etat local (~/.infisical
# et le keyring) est corrompu : constate le 2026-08-17, login bloque a l'infini
# alors que l'API repondait en 0,9 s, et le service restait "active" sans jamais
# lancer le worker. Un timeout transforme ce blocage muet en echec franc, que
# systemd voit et retente. Contournement en cas de recidive : mettre de cote
# ~/.infisical (le CLI le recree, et le login repasse en 1 s).
TOKEN=$(timeout -k 10 60 infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" \
  --client-secret="$INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET" \
  --plain --silent < /dev/null 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "ECHEC : aucun token Infisical obtenu (login en timeout ou refuse)." >&2
    exit 1
fi

# Run worker with secrets injected
exec infisical run \
  --token="$TOKEN" \
  --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 \
  --env=prod \
  --path=/worker \
  -- "$VENV/bin/python" "$WORKER_DIR/main.py"
