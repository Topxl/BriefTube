#!/usr/bin/env bash
#
# Pre-deploy verification script for BriefTube
# Run this before pushing to main to catch issues early.
#
# Usage:
#   ./scripts/deploy-check.sh          # Full check (build + ts + lint + assets + env)
#   ./scripts/deploy-check.sh --quick  # Quick check (assets + env only)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Navigate to project root (parent of scripts/)
cd "$(dirname "$0")/.." || exit 1

QUICK=false
if [[ "$1" == "--quick" ]]; then
  QUICK=true
fi

# Track results: 0 = pass, 1 = fail, 2 = skipped
declare -A RESULTS
FAILED=0

run_check() {
  local name="$1"
  shift
  echo ""
  echo -e "${BOLD}--- $name ---${RESET}"
  if "$@"; then
    RESULTS["$name"]=0
  else
    RESULTS["$name"]=1
    FAILED=1
  fi
}

skip_check() {
  local name="$1"
  RESULTS["$name"]=2
}

# ---------- 1. Public assets check ----------
check_assets() {
  local assets=(
    "public/logo.svg"
    "public/logo-120.png"
    "public/logo-hd.png"
    "public/favicon.ico"
    "public/favicon.svg"
  )
  local missing=()
  for f in "${assets[@]}"; do
    if [[ ! -f "$f" ]]; then
      missing+=("$f")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${RED}Missing public assets:${RESET}"
    for f in "${missing[@]}"; do
      echo "  - $f"
    done
    return 1
  fi
  echo "All critical public assets present."
  return 0
}

# ---------- 2. Environment variables check ----------
check_env() {
  local env_file=".env.local"
  if [[ ! -f "$env_file" ]]; then
    echo -e "${RED}$env_file not found!${RESET}"
    return 1
  fi

  local vars=(
    "NEXT_PUBLIC_SITE_URL"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  )
  local missing=()
  for var in "${vars[@]}"; do
    if ! grep -q "^${var}=" "$env_file"; then
      missing+=("$var")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${RED}Missing env vars in $env_file:${RESET}"
    for v in "${missing[@]}"; do
      echo "  - $v"
    done
    return 1
  fi
  echo "All required env vars present (values not shown)."
  return 0
}

# ---------- 3. Build check ----------
check_build() {
  pnpm build
}

# ---------- 4. TypeScript check ----------
check_ts() {
  pnpm ts
}

# ---------- 5. Lint check ----------
check_lint() {
  pnpm lint:ci
}

# ========== Run checks ==========

run_check "Public assets" check_assets
run_check "Environment variables" check_env

if [[ "$QUICK" == true ]]; then
  skip_check "Build"
  skip_check "TypeScript"
  skip_check "Lint"
  echo ""
  echo -e "${BOLD}(--quick mode: skipping build, TypeScript, and lint checks)${RESET}"
else
  run_check "Build" check_build
  run_check "TypeScript" check_ts
  run_check "Lint" check_lint
fi

# ========== Summary ==========
echo ""
echo -e "${BOLD}========== Deploy Check Summary ==========${RESET}"

ORDER=("Public assets" "Environment variables" "Build" "TypeScript" "Lint")
for name in "${ORDER[@]}"; do
  case "${RESULTS[$name]}" in
    0) echo -e "  ✅  $name" ;;
    1) echo -e "  ❌  $name" ;;
    2) echo -e "  ⏭️   $name (skipped)" ;;
  esac
done

echo ""
if [[ "$FAILED" -eq 1 ]]; then
  echo -e "${RED}${BOLD}Some checks failed. Fix issues before pushing to main.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}All checks passed. Safe to push!${RESET}"
  exit 0
fi
