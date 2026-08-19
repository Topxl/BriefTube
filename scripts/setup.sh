#!/usr/bin/env bash
#
# Self-hosting bootstrap for BriefTube.
# Checks the prerequisites, creates .env from the template, and prints the
# manual steps that no script can do for you.
#
# Safe to re-run: an existing .env is never overwritten.
#
# Usage:
#   ./scripts/setup.sh

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Navigate to project root (parent of scripts/)
cd "$(dirname "$0")/.." || exit 1

echo ""
echo -e "${BOLD}BriefTube — self-hosting setup${RESET}"
echo "=================================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
echo -e "${BOLD}--- Prerequisites ---${RESET}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}FAIL${RESET}  docker is not installed"
  echo "      Install it from https://docs.docker.com/get-docker/"
  exit 1
fi
echo -e "${GREEN}OK${RESET}    docker $(docker --version | awk '{print $3}' | tr -d ',')"

if ! docker compose version &> /dev/null; then
  echo -e "${RED}FAIL${RESET}  the 'docker compose' plugin is not available"
  echo "      Install it from https://docs.docker.com/compose/install/"
  echo "      (the standalone 'docker-compose' v1 binary is not supported)"
  exit 1
fi
echo -e "${GREEN}OK${RESET}    docker compose $(docker compose version --short)"

if ! docker info &> /dev/null; then
  echo -e "${RED}FAIL${RESET}  the docker daemon is not reachable"
  echo "      Start Docker, or add your user to the 'docker' group."
  exit 1
fi
echo -e "${GREEN}OK${RESET}    docker daemon is running"

# ---------------------------------------------------------------------------
# 2. Environment file
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- Environment ---${RESET}"

if [ ! -f ".env.example" ]; then
  echo -e "${RED}FAIL${RESET}  .env.example is missing from the repository root"
  exit 1
fi

if [ -f ".env" ]; then
  echo -e "${GREEN}OK${RESET}    .env already exists — left untouched"
else
  cp .env.example .env
  echo -e "${GREEN}OK${RESET}    .env created from .env.example"
fi

# Warn about the values that are still placeholders.
MISSING=()
check_var() {
  local key="$1"
  local value
  value=$(grep -E "^${key}=" .env | head -n 1 | cut -d '=' -f2- || true)
  case "$value" in
    "" | *your-* | *AIzaSy... | 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ)
      MISSING+=("$key")
      ;;
  esac
}

check_var NEXT_PUBLIC_SUPABASE_URL
check_var NEXT_PUBLIC_SUPABASE_ANON_KEY
check_var SUPABASE_URL
check_var SUPABASE_SERVICE_ROLE_KEY
check_var GEMINI_API_KEY
check_var TELEGRAM_BOT_TOKEN

if [ ${#MISSING[@]} -eq 0 ]; then
  echo -e "${GREEN}OK${RESET}    the 6 required variables are filled in"
else
  echo -e "${YELLOW}TODO${RESET}  still using placeholder values:"
  for key in "${MISSING[@]}"; do
    echo "        - $key"
  done
fi

# ---------------------------------------------------------------------------
# 3. Manual steps
# ---------------------------------------------------------------------------
cat <<'STEPS'

--------------------------------------------------
Four manual steps remain. None of them can be automated.

1. Create a Supabase project
   https://supabase.com/dashboard  ->  New project  (the free tier is enough)
   Project Settings -> API, then copy into .env:
     NEXT_PUBLIC_SUPABASE_URL   and   SUPABASE_URL   <- Project URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY                   <- anon / public key
     SUPABASE_SERVICE_ROLE_KEY                       <- service_role key
   Then enable Google in Authentication -> Providers, so users can sign in.

2. Apply the database schema
   One file creates everything (tables, RLS policies, triggers, storage):
     migrations/00000000_initial_schema.sql
   Paste it into the Supabase SQL editor, or from a terminal:
     psql "$SUPABASE_DB_URL" -f migrations/00000000_initial_schema.sql
   Do NOT run the other files in migrations/ — they are the historical log of
   the hosted instance and are already folded into that snapshot.
   Details: migrations/README.md

3. Create a Telegram bot
   Message https://t.me/BotFather  ->  /newbot  ->  copy the token into .env:
     TELEGRAM_BOT_TOKEN=...
   This is the bot that will deliver the audio summaries.

4. Get a Google Gemini API key
   https://aistudio.google.com/apikey  ->  Create API key, then in .env:
     GEMINI_API_KEY=...
   The free tier covers personal usage.

--------------------------------------------------
Once .env is filled in:

   docker compose up -d --build      # build and start web + worker
   docker compose ps                 # both services should be "healthy"
   docker compose logs -f worker     # follow the pipeline

The app is then served on http://localhost:3000

Reminder: NEXT_PUBLIC_* values are baked into the browser bundle at build
time. After changing one, rebuild with:

   docker compose up -d --build web

STEPS
