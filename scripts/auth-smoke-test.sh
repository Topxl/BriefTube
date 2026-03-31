#!/bin/bash
# BriefTube Auth Smoke Test
# Verifies every link in the authentication chain without performing a real login.
# Run via cron every 10 minutes: */10 * * * * /path/to/auth-smoke-test.sh
#
# Checks:
#   1. Login page loads and contains Google sign-in button
#   2. /api/auth/google redirects to accounts.google.com (not 500)
#   3. Supabase auth service is reachable
#   4. Auth callback route exists (not a 500 crash)
#   5. OAuth state cookie is set by the Google auth endpoint

# ── Config ──────────────────────────────────────────────────────────────────────

SITE_URL="${BRIEFTUBE_URL:-https://www.brief-tube.com}"
SUPABASE_URL="https://zetpgbrzehchzxodwbps.supabase.co"
TELEGRAM_BOT_TOKEN="${BRIEFTUBE_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${BRIEFTUBE_TELEGRAM_CHAT_ID:-}"
STATE_FILE="/tmp/brieftube-auth-state"
TIMEOUT=15

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --url) SITE_URL="$2"; shift 2 ;;
        --supabase-url) SUPABASE_URL="$2"; shift 2 ;;
        *) echo "Usage: $0 [--url https://...] [--supabase-url https://...]"; exit 1 ;;
    esac
done

# ── Colors ──────────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    GREEN='' RED='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

# ── Helpers ─────────────────────────────────────────────────────────────────────

FAILURES=0
CHECKS=0

check_pass() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    printf "${GREEN}PASS${RESET}  %-40s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
}

check_fail() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    FAILURES=$((FAILURES + 1))
    printf "${RED}FAIL${RESET}  %-40s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
}

check_warn() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    printf "${YELLOW}WARN${RESET}  %-40s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
}

send_telegram() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=${message}" \
            -d "parse_mode=HTML" > /dev/null 2>&1
    fi
}

# Measure request time in ms
timed_curl() {
    curl --max-time "$TIMEOUT" -w "%{time_total}" "$@" 2>/dev/null
}

# ── Checks ──────────────────────────────────────────────────────────────────────

printf "\n${BOLD}BriefTube Auth Smoke Test${RESET}\n"
printf "Target: ${CYAN}%s${RESET}\n" "$SITE_URL"
printf "Time:   %s\n\n" "$(date '+%Y-%m-%d %H:%M:%S')"

DETAIL_LOG=""

# 1. Login page loads and contains Google sign-in content
tmpfile=$(mktemp)
time_s=$(timed_curl -sf -o "$tmpfile" "$SITE_URL/login")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
if [ -s "$tmpfile" ]; then
    if grep -qi "google\|sign.in\|continue.with" "$tmpfile"; then
        check_pass "Login page loads" "Contains Google sign-in" "$time_ms"
    else
        check_fail "Login page loads" "Page loaded but missing Google sign-in content" "$time_ms"
        DETAIL_LOG="${DETAIL_LOG}Login page missing Google content\n"
    fi
else
    check_fail "Login page loads" "Failed to load (timeout or error)" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}Login page failed to load\n"
fi
rm -f "$tmpfile"

# 2. Google OAuth endpoint returns redirect to accounts.google.com
tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$SITE_URL/api/auth/google")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
http_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
location=$(grep -i '^location:' "$tmpheaders" 2>/dev/null | head -1)
if echo "$http_code" | grep -qE '^3[0-9]{2}$'; then
    if echo "$location" | grep -qi 'accounts.google.com'; then
        check_pass "OAuth redirect" "→ accounts.google.com ($http_code)" "$time_ms"
    else
        check_fail "OAuth redirect" "Redirects but not to Google ($http_code)" "$time_ms"
        DETAIL_LOG="${DETAIL_LOG}OAuth redirects to wrong location\n"
    fi
elif [ "$http_code" = "500" ]; then
    check_fail "OAuth redirect" "Server error 500 — Google OAuth likely misconfigured" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}OAuth endpoint returned 500\n"
elif [ "$http_code" = "429" ]; then
    check_warn "OAuth redirect" "Rate limited ($http_code) — cannot verify" "$time_ms"
else
    check_fail "OAuth redirect" "Unexpected response: HTTP $http_code" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}OAuth endpoint returned HTTP $http_code\n"
fi
rm -f "$tmpheaders"

# 3. Supabase reachable (auth service responding)
# The /auth/v1/health endpoint returns 401 without an API key on Supabase hosted,
# but that still proves the auth service is up and responding. A timeout or 5xx means trouble.
supabase_tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$supabase_tmpheaders" "${SUPABASE_URL}/auth/v1/health")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
sb_code=$(head -1 "$supabase_tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$supabase_tmpheaders"
if [ -n "$sb_code" ] && [ "$sb_code" -lt 500 ] 2>/dev/null; then
    check_pass "Supabase auth reachable" "Auth service responding (HTTP $sb_code)" "$time_ms"
elif [ -n "$sb_code" ]; then
    check_fail "Supabase auth reachable" "Auth service error (HTTP $sb_code)" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}Supabase auth returned $sb_code\n"
else
    check_fail "Supabase auth reachable" "Supabase unreachable (timeout)" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}Supabase unreachable\n"
fi

# 4. Auth callback route exists (without params should redirect to /login, not crash)
tmpheaders2=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders2" "$SITE_URL/api/auth/google/callback")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
cb_code=$(head -1 "$tmpheaders2" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
if [ "$cb_code" = "500" ] || [ -z "$cb_code" ]; then
    check_fail "Callback route exists" "Server error or unreachable (HTTP $cb_code)" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}Callback route returned $cb_code\n"
else
    # 302/307 redirect to /login is expected (missing params → redirect)
    # 200 would also be OK (error page rendered)
    # 400 is OK (bad request due to missing params)
    check_pass "Callback route exists" "Route responds (HTTP $cb_code)" "$time_ms"
fi
rm -f "$tmpheaders2"

# 5. OAuth state cookie is set
cookie_jar=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -c "$cookie_jar" -D /dev/null "$SITE_URL/api/auth/google")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
if grep -q "google_oauth_state" "$cookie_jar" 2>/dev/null; then
    check_pass "OAuth state cookie" "google_oauth_state set" "$time_ms"
else
    # Rate limiting may prevent cookie from being set
    if [ "$http_code" = "429" ]; then
        check_warn "OAuth state cookie" "Rate limited — cannot verify cookie" "$time_ms"
    else
        check_fail "OAuth state cookie" "google_oauth_state not set" "$time_ms"
        DETAIL_LOG="${DETAIL_LOG}OAuth state cookie missing\n"
    fi
fi
rm -f "$cookie_jar"

# ── Summary ─────────────────────────────────────────────────────────────────────

echo ""
if [ "$FAILURES" -eq 0 ]; then
    printf "${GREEN}${BOLD}All %d checks passed${RESET}\n\n" "$CHECKS"
    current_status="UP"
else
    printf "${RED}${BOLD}%d/%d checks failed${RESET}\n\n" "$FAILURES" "$CHECKS"
    current_status="DOWN"
fi

# ── State tracking & Telegram alerts ────────────────────────────────────────────

prev_status="UP"
[ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")
echo "$current_status" > "$STATE_FILE"

timestamp=$(date '+%Y-%m-%d %H:%M:%S')

if [ "$current_status" = "DOWN" ] && [ "$prev_status" = "UP" ]; then
    send_telegram "🔴 <b>BriefTube AUTH DOWN</b>
$timestamp

Auth smoke test failed ($FAILURES/$CHECKS checks):
$(echo -e "$DETAIL_LOG")
Users CANNOT log in!

Check: ssh brieftube-vps"
    echo "[$timestamp] ALERT: Auth is broken ($FAILURES failures)"
elif [ "$current_status" = "UP" ] && [ "$prev_status" = "DOWN" ]; then
    send_telegram "🟢 <b>BriefTube AUTH RECOVERED</b>
$timestamp

All $CHECKS auth checks passing. Users can log in again."
    echo "[$timestamp] RECOVERED: Auth is working again"
fi

# Exit with failure code if any critical check failed
exit "$FAILURES"
