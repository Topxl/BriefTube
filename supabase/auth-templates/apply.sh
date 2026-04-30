#!/usr/bin/env bash
# Push all generated Supabase Auth email templates to the live project.
#
# Requires:
#   SUPABASE_PROJECT_REF  (default: zetpgbrzehchzxodwbps)
#   SUPABASE_ACCESS_TOKEN (PAT from https://supabase.com/dashboard/account/tokens)
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx
#   bash supabase/auth-templates/apply.sh

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-zetpgbrzehchzxodwbps}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is required (Personal Access Token)." >&2
  echo "Generate one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

cd "$(dirname "$0")"

# Regenerate the payload from the .py source so committed payload.json never drifts.
python3 _generate.py >/dev/null

echo "Patching auth config for project ${PROJECT_REF}…"
HTTP_CODE=$(curl -sS -o /tmp/_supabase-auth-response.json -w "%{http_code}" \
  -X PATCH \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @payload.json \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth")

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "FAILED with HTTP ${HTTP_CODE}" >&2
  cat /tmp/_supabase-auth-response.json >&2
  exit 1
fi

echo "OK (HTTP 200). Verify subjects:"
python3 - <<'PY'
import json
d = json.load(open("/tmp/_supabase-auth-response.json"))
for k in sorted(k for k in d if k.startswith("mailer_subjects_")):
    print(f"  {k}: {d[k]}")
PY
