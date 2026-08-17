#!/bin/bash
# BriefTube Onboarding Smoke Test
# Verifies every critical step of the user onboarding funnel.
# Run via cron every 10 minutes: */10 * * * * /path/to/onboarding-smoke-test.sh
#
# Sections:
#   1. Landing & Pages — Homepage, pricing, login, signup load
#   2. Auth Chain — OAuth redirect, callback, Supabase auth
#   3. Core API — Subscriptions, process-video, stripe/price, lists
#   4. Dashboard — Protected pages redirect to login, not crash
#   5. Worker Health — Worker responding on VPS (via SSH)
#   6. External Services — Supabase DB, Stripe API reachable

# Un seul passage a la fois : cron ne doit jamais empiler des instances si un
# appel reseau pend (voir db-health-check.sh, 1300 process empiles en 81 h).
exec 9> /tmp/brieftube-onboarding.lock
flock -n 9 || exit 0

# ── Config ──────────────────────────────────────────────────────────────────────

SITE_URL="${BRIEFTUBE_URL:-https://www.brief-tube.com}"
SUPABASE_URL="https://zetpgbrzehchzxodwbps.supabase.co"
TELEGRAM_BOT_TOKEN="${BRIEFTUBE_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${BRIEFTUBE_TELEGRAM_CHAT_ID:-}"
STATE_FILE="/tmp/brieftube-onboarding-state"
TIMEOUT=20

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

CRITICAL_FAILURES=0
WARNINGS=0
CHECKS=0
DETAIL_LOG=""

check_pass() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    printf "${GREEN}PASS${RESET}  %-45s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
}

check_fail() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
    printf "${RED}FAIL${RESET}  %-45s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}❌ ${name}: ${detail}\n"
}

check_warn() {
    local name="$1" detail="$2" time_ms="$3"
    CHECKS=$((CHECKS + 1))
    WARNINGS=$((WARNINGS + 1))
    printf "${YELLOW}WARN${RESET}  %-45s %s ${CYAN}(%s ms)${RESET}\n" "$name" "$detail" "$time_ms"
    DETAIL_LOG="${DETAIL_LOG}⚠️ ${name}: ${detail}\n"
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

# Re-check site + Supabase + Stripe after 30s to filter transient timeouts.
# Returns 0 if still down (alert), 1 if recovered (false positive, skip alert).
confirm_down() {
    sleep 30
    local sb_hdr; sb_hdr=$(mktemp)
    curl --max-time "$TIMEOUT" -sf -o /dev/null -D "$sb_hdr" "${SUPABASE_URL}/auth/v1/health" 2>/dev/null
    local sb_code; sb_code=$(head -1 "$sb_hdr" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
    rm -f "$sb_hdr"
    local site_code; site_code=$(curl --max-time "$TIMEOUT" -sf -o /dev/null -w "%{http_code}" "$SITE_URL/" 2>/dev/null)
    local stripe_code; stripe_code=$(curl --max-time "$TIMEOUT" -sf -o /dev/null -w "%{http_code}" "$SITE_URL/api/stripe/price" 2>/dev/null)
    if { [ -n "$sb_code" ] && [ "$sb_code" -lt 500 ] 2>/dev/null; } || \
       { [ -n "$site_code" ] && [ "$site_code" -ge 200 ] && [ "$site_code" -lt 500 ] 2>/dev/null; } || \
       { [ -n "$stripe_code" ] && [ "$stripe_code" -ge 200 ] && [ "$stripe_code" -lt 500 ] 2>/dev/null; }; then
        return 1  # Recovered — was a transient timeout
    fi
    return 0  # Still down — real outage
}

# Helper: GET a URL and check for expected HTTP status code
# Usage: check_http_status "Name" "URL" "expected_code" "critical|warning"
check_http_status() {
    local name="$1" url="$2" expected="$3" severity="${4:-critical}"
    local tmpheaders time_s time_ms http_code

    tmpheaders=$(mktemp)
    time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$url")
    time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
    http_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
    rm -f "$tmpheaders"

    if [ -z "$http_code" ]; then
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Unreachable (timeout)" "$time_ms"
        else
            check_fail "$name" "Unreachable (timeout)" "$time_ms"
        fi
        return 1
    fi

    # Check if code matches expected (supports multiple with |)
    if echo "$http_code" | grep -qE "^(${expected})$"; then
        check_pass "$name" "HTTP $http_code" "$time_ms"
        return 0
    elif [ "$http_code" = "500" ]; then
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Server error 500" "$time_ms"
        else
            check_fail "$name" "Server error 500" "$time_ms"
        fi
        return 1
    else
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Unexpected HTTP $http_code (expected $expected)" "$time_ms"
        else
            check_fail "$name" "Unexpected HTTP $http_code (expected $expected)" "$time_ms"
        fi
        return 1
    fi
}

# Helper: check redirect destination
check_redirect_to() {
    local name="$1" url="$2" expected_location="$3" severity="${4:-critical}"
    local tmpheaders time_s time_ms http_code location

    tmpheaders=$(mktemp)
    time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$url")
    time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
    http_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
    location=$(grep -i '^location:' "$tmpheaders" 2>/dev/null | head -1)
    rm -f "$tmpheaders"

    if [ -z "$http_code" ]; then
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Unreachable (timeout)" "$time_ms"
        else
            check_fail "$name" "Unreachable (timeout)" "$time_ms"
        fi
        return 1
    fi

    if echo "$http_code" | grep -qE '^3[0-9]{2}$'; then
        if echo "$location" | grep -qi "$expected_location"; then
            check_pass "$name" "→ $expected_location ($http_code)" "$time_ms"
            return 0
        else
            if [ "$severity" = "warning" ]; then
                check_warn "$name" "Redirects but not to $expected_location ($http_code)" "$time_ms"
            else
                check_fail "$name" "Redirects but not to $expected_location ($http_code)" "$time_ms"
            fi
            return 1
        fi
    elif [ "$http_code" = "500" ]; then
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Server error 500" "$time_ms"
        else
            check_fail "$name" "Server error 500" "$time_ms"
        fi
        return 1
    else
        if [ "$severity" = "warning" ]; then
            check_warn "$name" "Expected redirect, got HTTP $http_code" "$time_ms"
        else
            check_fail "$name" "Expected redirect, got HTTP $http_code" "$time_ms"
        fi
        return 1
    fi
}

# ── Banner ──────────────────────────────────────────────────────────────────────

printf "\n${BOLD}BriefTube Onboarding Smoke Test${RESET}\n"
printf "Target: ${CYAN}%s${RESET}\n" "$SITE_URL"
printf "Time:   %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# ── Section 1: Landing & Pages ──────────────────────────────────────────────────

printf "\n${BOLD}── Landing & Pages ──${RESET}\n"

check_http_status "Homepage loads"          "$SITE_URL/"        "200"
check_http_status "Pricing page loads"      "$SITE_URL/pricing" "200"
check_http_status "Login page loads"        "$SITE_URL/login"   "200"
check_http_status "Signup page loads"       "$SITE_URL/signup"  "200"

# ── Section 2: Auth Chain ────────────────────────────────────────────────────────

printf "\n${BOLD}── Auth Chain ──${RESET}\n"

# 5. OAuth redirect to Google
check_redirect_to "OAuth redirect"          "$SITE_URL/api/auth/google" "accounts.google.com"

# 6. OAuth callback handles errors gracefully (not 500)
tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$SITE_URL/api/auth/google/callback")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
cb_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$tmpheaders"
if [ "$cb_code" = "500" ] || [ -z "$cb_code" ]; then
    check_fail "OAuth callback graceful" "Server error or unreachable (HTTP $cb_code)" "$time_ms"
else
    check_pass "OAuth callback graceful" "Route responds (HTTP $cb_code)" "$time_ms"
fi

# 7. Supabase auth reachable
sb_tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$sb_tmpheaders" "${SUPABASE_URL}/auth/v1/health")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
sb_code=$(head -1 "$sb_tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$sb_tmpheaders"
if [ -n "$sb_code" ] && [ "$sb_code" -lt 500 ] 2>/dev/null; then
    check_pass "Supabase auth reachable" "Auth service responding (HTTP $sb_code)" "$time_ms"
elif [ -n "$sb_code" ]; then
    check_fail "Supabase auth reachable" "Auth service error (HTTP $sb_code)" "$time_ms"
else
    check_fail "Supabase auth reachable" "Supabase unreachable (timeout)" "$time_ms"
fi

# ── Section 3: Core API Endpoints ───────────────────────────────────────────────

printf "\n${BOLD}── Core API Endpoints ──${RESET}\n"

# 8. Subscriptions API responds (401 without auth, not 500)
check_http_status "Subscriptions API"       "$SITE_URL/api/subscriptions"   "401"

# 9. Process video API responds (POST, 401 without auth, not 500)
tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" -X POST "$SITE_URL/api/process-video")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
pv_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$tmpheaders"
if [ -z "$pv_code" ]; then
    check_fail "Process video API" "Unreachable (timeout)" "$time_ms"
elif [ "$pv_code" = "500" ]; then
    check_fail "Process video API" "Server error 500" "$time_ms"
elif [ "$pv_code" = "401" ]; then
    check_pass "Process video API" "HTTP $pv_code" "$time_ms"
else
    # 405 (Method Not Allowed) or 400 are also acceptable — the route exists
    check_pass "Process video API" "Route responds (HTTP $pv_code)" "$time_ms"
fi

# 10. Stripe price API responds
check_http_status "Stripe price API"        "$SITE_URL/api/stripe/price"    "200"

# 11. Lists API responds
check_http_status "Lists API"               "$SITE_URL/api/lists"           "200"

# ── Section 4: Dashboard Pages ──────────────────────────────────────────────────

printf "\n${BOLD}── Dashboard (redirect to login) ──${RESET}\n"

# 12. Dashboard redirects to login
tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$SITE_URL/dashboard")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
dash_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$tmpheaders"
if [ "$dash_code" = "500" ] || [ -z "$dash_code" ]; then
    check_fail "Dashboard redirects" "Server error or unreachable (HTTP $dash_code)" "$time_ms"
elif echo "$dash_code" | grep -qE '^3[0-9]{2}$'; then
    check_pass "Dashboard redirects" "Redirects to login ($dash_code)" "$time_ms"
elif [ "$dash_code" = "200" ]; then
    # 200 is acceptable — might render login inline or the page itself
    check_pass "Dashboard redirects" "Page renders (HTTP $dash_code)" "$time_ms"
else
    check_fail "Dashboard redirects" "Unexpected HTTP $dash_code" "$time_ms"
fi

# 13. Settings redirects to login
tmpheaders=$(mktemp)
time_s=$(timed_curl -s -o /dev/null -D "$tmpheaders" "$SITE_URL/dashboard/settings")
time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
settings_code=$(head -1 "$tmpheaders" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
rm -f "$tmpheaders"
if [ "$settings_code" = "500" ] || [ -z "$settings_code" ]; then
    check_fail "Settings redirects" "Server error or unreachable (HTTP $settings_code)" "$time_ms"
elif echo "$settings_code" | grep -qE '^3[0-9]{2}$'; then
    check_pass "Settings redirects" "Redirects to login ($settings_code)" "$time_ms"
elif [ "$settings_code" = "200" ]; then
    check_pass "Settings redirects" "Page renders (HTTP $settings_code)" "$time_ms"
else
    check_fail "Settings redirects" "Unexpected HTTP $settings_code" "$time_ms"
fi

# ── Section 5: Worker Health ─────────────────────────────────────────────────────

printf "\n${BOLD}── Worker Health (via SSH) ──${RESET}\n"

# 14. Worker health endpoint
start_time=$(date +%s%N)
worker_health=$(timeout -k 5 20 ssh -n -o ConnectTimeout=5 -o BatchMode=yes brieftube-vps "curl -sf --max-time 5 http://localhost:8080/health" 2>/dev/null)
end_time=$(date +%s%N)
time_ms=$(( (end_time - start_time) / 1000000 ))
ssh_exit=$?

if [ $ssh_exit -ne 0 ] && [ -z "$worker_health" ]; then
    check_warn "Worker health" "SSH connection failed — cannot verify" "$time_ms"
elif echo "$worker_health" | grep -qi "ok\|running\|healthy"; then
    check_pass "Worker health" "Worker responding" "$time_ms"
elif [ -n "$worker_health" ]; then
    check_warn "Worker health" "Unexpected response: $(echo "$worker_health" | head -c 80)" "$time_ms"
else
    check_warn "Worker health" "Worker not responding" "$time_ms"
fi

# 15. Worker services check
start_time=$(date +%s%N)
worker_services=$(timeout -k 5 20 ssh -n -o ConnectTimeout=5 -o BatchMode=yes brieftube-vps "curl -sf --max-time 5 http://localhost:8080/services" 2>/dev/null)
end_time=$(date +%s%N)
time_ms=$(( (end_time - start_time) / 1000000 ))
ssh_exit=$?

if [ $ssh_exit -ne 0 ] && [ -z "$worker_services" ]; then
    check_warn "Worker services" "SSH connection failed — cannot verify" "$time_ms"
elif [ -n "$worker_services" ]; then
    # Check for Telegram and Gemini in services response
    telegram_ok=$(echo "$worker_services" | grep -i "telegram" | grep -ci "ok\|true\|running")
    gemini_ok=$(echo "$worker_services" | grep -i "gemini" | grep -ci "ok\|true\|running")
    if [ "$telegram_ok" -gt 0 ] && [ "$gemini_ok" -gt 0 ]; then
        check_pass "Worker services" "Telegram + Gemini OK" "$time_ms"
    elif [ "$telegram_ok" -gt 0 ] || [ "$gemini_ok" -gt 0 ]; then
        check_warn "Worker services" "Partial: Telegram=$telegram_ok Gemini=$gemini_ok" "$time_ms"
    else
        check_warn "Worker services" "Services status unclear" "$time_ms"
    fi
else
    check_warn "Worker services" "No response from /services" "$time_ms"
fi

# ── Section 6: External Services ─────────────────────────────────────────────────

printf "\n${BOLD}── External Services ──${RESET}\n"

# 16. Supabase DB reachable (REST API with anon key from page source)
# First try to extract NEXT_PUBLIC_SUPABASE_ANON_KEY from homepage HTML
anon_key=""
homepage_html=$(curl -sf --max-time "$TIMEOUT" "$SITE_URL/" 2>/dev/null)
if [ -n "$homepage_html" ]; then
    anon_key=$(echo "$homepage_html" | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' | head -1)
fi

if [ -n "$anon_key" ]; then
    sb_rest_headers=$(mktemp)
    time_s=$(timed_curl -s -o /dev/null -D "$sb_rest_headers" \
        -H "apikey: $anon_key" \
        -H "Authorization: Bearer $anon_key" \
        "${SUPABASE_URL}/rest/v1/")
    time_ms=$(echo "$time_s" | awk '{printf "%d", $1 * 1000}')
    sb_rest_code=$(head -1 "$sb_rest_headers" 2>/dev/null | grep -oE '[0-9]{3}' | head -1)
    rm -f "$sb_rest_headers"

    if [ -n "$sb_rest_code" ] && [ "$sb_rest_code" -lt 500 ] 2>/dev/null; then
        check_pass "Supabase DB reachable" "REST API responding (HTTP $sb_rest_code)" "$time_ms"
    elif [ -n "$sb_rest_code" ]; then
        check_warn "Supabase DB reachable" "REST API error (HTTP $sb_rest_code)" "$time_ms"
    else
        check_warn "Supabase DB reachable" "REST API unreachable (timeout)" "$time_ms"
    fi
else
    check_warn "Supabase DB reachable" "Could not extract anon key from homepage" "0"
fi

# 17. Stripe API reachable (401 proves Stripe is up)
check_http_status "Stripe API reachable" "https://api.stripe.com/v1/prices" "401" "warning"

# ── Summary ─────────────────────────────────────────────────────────────────────

echo ""
total_issues=$((CRITICAL_FAILURES + WARNINGS))
if [ "$CRITICAL_FAILURES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    printf "${GREEN}${BOLD}All %d checks passed${RESET}\n\n" "$CHECKS"
    current_status="UP"
elif [ "$CRITICAL_FAILURES" -eq 0 ]; then
    printf "${YELLOW}${BOLD}%d/%d checks passed, %d warnings${RESET}\n\n" "$((CHECKS - WARNINGS))" "$CHECKS" "$WARNINGS"
    current_status="UP"
else
    printf "${RED}${BOLD}%d critical failures, %d warnings out of %d checks${RESET}\n\n" "$CRITICAL_FAILURES" "$WARNINGS" "$CHECKS"
    current_status="DOWN"
fi

# ── State Tracking & Telegram Alerts ─────────────────────────────────────────────

prev_status="UP"
[ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")
echo "$current_status" > "$STATE_FILE"

timestamp=$(date '+%Y-%m-%d %H:%M')

if [ "$current_status" = "DOWN" ] && [ "$prev_status" = "UP" ]; then
    echo "[$timestamp] Potential onboarding outage — confirming in 30s..."
    if confirm_down; then
        send_telegram "🔴 <b>BriefTube ONBOARDING BROKEN</b>
$timestamp

$(echo -e "$DETAIL_LOG")
Users CANNOT sign up!

Check: ssh brieftube-vps"
        echo "[$timestamp] ALERT: Onboarding broken ($CRITICAL_FAILURES critical failures, $WARNINGS warnings)"
    else
        echo "[$timestamp] False positive — recovered within 30s, skipping alert"
        echo "UP" > "$STATE_FILE"
    fi
elif [ "$current_status" = "UP" ] && [ "$prev_status" = "DOWN" ]; then
    send_telegram "🟢 <b>BriefTube ONBOARDING RECOVERED</b>
$timestamp

All $CHECKS onboarding checks passing. Users can sign up again."
    echo "[$timestamp] RECOVERED: Onboarding is working again"
fi

# Exit with critical failure count
exit "$CRITICAL_FAILURES"
