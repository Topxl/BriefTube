#!/bin/bash
# BriefTube Database Health Check
# Detects silent failures in the onboarding/processing pipeline that HTTP checks miss.
# SSHes to the VPS and runs DB queries via the worker's Python environment.
#
# Run via cron every 15 minutes: */15 * * * * /path/to/db-health-check.sh
#
# Checks (critical):
#   1. Stuck processing jobs (processing > 30 min)
#   2. Failed videos piling up (>10 in last hour)
#   3. Stuck deliveries (sending > 10 min)
#   4. Pending delivery backlog (>50 pending)
#
# Checks (warning):
#   5. Processing backlog (pending job count)
#   6. Delivery success rate (last 24h)

# ── Verrou d'instance unique ────────────────────────────────────────────────────
# Ceinture de securite : meme si un appel distant echappait a son timeout, cron
# ne peut plus empiler une seconde instance toutes les 15 minutes.
exec 9> /tmp/brieftube-db-health.lock
if ! flock -n 9; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') deja en cours -- passage ignore" >&2
    exit 0
fi

# ── Config ──────────────────────────────────────────────────────────────────────

VPS_HOST="brieftube-pi"
VPS_APP_DIR="/home/pi/brieftube"
TELEGRAM_BOT_TOKEN="${BRIEFTUBE_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${BRIEFTUBE_TELEGRAM_CHAT_ID:-}"
STATE_FILE="/tmp/brieftube-db-state"
SSH_TIMEOUT=10
# ConnectTimeout ne couvre QUE l'etablissement de la connexion. Une commande
# distante qui pend (infisical login sans TTY) laisse le ssh vivant a l'infini :
# mesure le 2026-08-17, 326 ssh et 980 shells empiles en 81 h, plus 980 process
# infisical cote Pi. Tout appel distant doit donc porter son propre timeout.
CMD_TIMEOUT=180
SCP_TIMEOUT=60
REMOTE_LOGIN_TIMEOUT=45
REMOTE_RUN_TIMEOUT=90

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

check_pass() {
    local name="$1" detail="$2"
    CHECKS=$((CHECKS + 1))
    printf "${GREEN}PASS${RESET}  %-45s %s\n" "$name" "$detail"
}

check_fail() {
    local name="$1" detail="$2"
    CHECKS=$((CHECKS + 1))
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
    printf "${RED}CRIT${RESET}  %-45s %s\n" "$name" "$detail"
}

check_warn() {
    local name="$1" detail="$2"
    CHECKS=$((CHECKS + 1))
    WARNINGS=$((WARNINGS + 1))
    printf "${YELLOW}WARN${RESET}  %-45s %s\n" "$name" "$detail"
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

# Run a Python snippet on the VPS via SSH, using the worker's venv and env.
# The snippet must print a single value to stdout.
vps_query() {
    local python_code="$1"
    timeout -k 10 "$CMD_TIMEOUT" \
        ssh -n -o ConnectTimeout="$SSH_TIMEOUT" -o BatchMode=yes "$VPS_HOST" \
        "cd ${VPS_APP_DIR}/worker && source venv/bin/activate && python3 -c '${python_code}'" 2>/dev/null
}

# ── SSH connectivity check ──────────────────────────────────────────────────────

printf "\n${BOLD}BriefTube Database Health Check${RESET}\n"
printf "Pi:     ${CYAN}%s${RESET}\n" "$VPS_HOST"
printf "Time:   %s\n\n" "$(date '+%Y-%m-%d %H:%M:%S')"

if ! timeout -k 5 30 ssh -n -o ConnectTimeout="$SSH_TIMEOUT" -o BatchMode=yes "$VPS_HOST" "echo ok" > /dev/null 2>&1; then
    check_fail "SSH connectivity" "Cannot connect to $VPS_HOST"
    printf "\n${RED}${BOLD}Cannot reach Pi -- aborting${RESET}\n\n"

    prev_status="OK"
    [ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")
    echo "SSH_FAIL" > "$STATE_FILE"

    if [ "$prev_status" != "SSH_FAIL" ]; then
        send_telegram "🔴 <b>BriefTube DB Health Check</b>
$(date '+%Y-%m-%d %H:%M:%S')

Cannot SSH to Pi ($VPS_HOST).
All database checks skipped."
    fi
    exit 1
fi

# ── Fetch all metrics in a single SSH call ──────────────────────────────────────

# Copy query script to VPS and run it
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
timeout -k 10 "$SCP_TIMEOUT" \
    scp -o ConnectTimeout="$SSH_TIMEOUT" -q "${SCRIPT_DIR}/db-query.py" "$VPS_HOST":/home/pi/brieftube/worker/_db_health.py 2>/dev/null

# Chaque etage porte son timeout : le local coupe le ssh, les deux distants
# coupent infisical. Sans le timeout distant, tuer le ssh laisse le process
# infisical vivant sur le Pi. Le -n ferme stdin, pour qu'aucun outil distant
# ne puisse attendre une saisie qui ne viendra jamais depuis cron.
METRICS_JSON=$(timeout -k 10 "$CMD_TIMEOUT" \
    ssh -n -o ConnectTimeout="$SSH_TIMEOUT" -o BatchMode=yes "$VPS_HOST" \
    'source /home/pi/.brieftube-secrets.env 2>/dev/null; cd /home/pi/brieftube/worker && source venv/bin/activate && TOKEN=$(timeout -k 5 '"$REMOTE_LOGIN_TIMEOUT"' infisical login --method=universal-auth --client-id="${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID}" --client-secret="${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET}" --plain --silent 2>/dev/null) && timeout -k 10 '"$REMOTE_RUN_TIMEOUT"' infisical run --token="${TOKEN}" --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 --env=prod --path=/worker -- python3 _db_health.py; rc=$?; rm -f _db_health.py 2>/dev/null; exit $rc' 2>/dev/null)
# Extract only the JSON line
METRICS_JSON=$(echo "$METRICS_JSON" | grep '^{' | tail -1)

if [ -z "$METRICS_JSON" ] || ! echo "$METRICS_JSON" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    check_fail "DB query execution" "Failed to run queries on VPS"
    printf "\n${RED}${BOLD}Query execution failed -- aborting${RESET}\n\n"

    prev_status="OK"
    [ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")
    echo "QUERY_FAIL" > "$STATE_FILE"

    if [ "$prev_status" != "QUERY_FAIL" ]; then
        send_telegram "🔴 <b>BriefTube DB Health Check</b>
$(date '+%Y-%m-%d %H:%M:%S')

Failed to execute DB queries on VPS.
Worker Python env may be broken."
    fi
    exit 1
fi

# ── Parse metrics ───────────────────────────────────────────────────────────────

parse_metric() {
    echo "$METRICS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$1', 0))"
}

STUCK_PROCESSING=$(parse_metric "stuck_processing")
RECENT_FAILURES=$(parse_metric "recent_failures")
STUCK_DELIVERIES=$(parse_metric "stuck_deliveries")
PENDING_DELIVERIES=$(parse_metric "pending_deliveries")
PENDING_JOBS=$(parse_metric "pending_jobs")
SENT_24H=$(parse_metric "deliveries_sent_24h")
FAILED_24H=$(parse_metric "deliveries_failed_24h")

DETAIL_LOG=""

# ── Critical checks ────────────────────────────────────────────────────────────

# 1. Stuck processing jobs
if [ "$STUCK_PROCESSING" -gt 0 ] 2>/dev/null; then
    check_fail "Stuck processing jobs" "$STUCK_PROCESSING jobs processing > 30 min"
    DETAIL_LOG="${DETAIL_LOG}$STUCK_PROCESSING stuck processing jobs\n"
else
    check_pass "Stuck processing jobs" "None"
fi

# 2. Failed videos piling up
if [ "$RECENT_FAILURES" -gt 10 ] 2>/dev/null; then
    check_fail "Recent video failures" "$RECENT_FAILURES failed in last hour (threshold: 10)"
    DETAIL_LOG="${DETAIL_LOG}$RECENT_FAILURES video failures in last hour\n"
elif [ "$RECENT_FAILURES" -gt 5 ] 2>/dev/null; then
    check_warn "Recent video failures" "$RECENT_FAILURES failed in last hour"
else
    check_pass "Recent video failures" "$RECENT_FAILURES in last hour"
fi

# 3. Stuck deliveries
if [ "$STUCK_DELIVERIES" -gt 0 ] 2>/dev/null; then
    check_fail "Stuck deliveries" "$STUCK_DELIVERIES stuck in 'sending' > 10 min"
    DETAIL_LOG="${DETAIL_LOG}$STUCK_DELIVERIES stuck deliveries\n"
else
    check_pass "Stuck deliveries" "None"
fi

# 4. Pending delivery backlog
if [ "$PENDING_DELIVERIES" -gt 50 ] 2>/dev/null; then
    check_fail "Pending delivery backlog" "$PENDING_DELIVERIES pending (threshold: 50)"
    DETAIL_LOG="${DETAIL_LOG}$PENDING_DELIVERIES pending deliveries (backlog)\n"
elif [ "$PENDING_DELIVERIES" -gt 20 ] 2>/dev/null; then
    check_warn "Pending delivery backlog" "$PENDING_DELIVERIES pending"
else
    check_pass "Pending delivery backlog" "$PENDING_DELIVERIES pending"
fi

# ── Warning checks ─────────────────────────────────────────────────────────────

# 5. Processing backlog
if [ "$PENDING_JOBS" -gt 50 ] 2>/dev/null; then
    check_warn "Processing backlog" "$PENDING_JOBS pending jobs"
else
    check_pass "Processing backlog" "$PENDING_JOBS pending jobs"
fi

# 6. Delivery success rate (last 24h)
TOTAL_24H=$((SENT_24H + FAILED_24H))
if [ "$TOTAL_24H" -gt 0 ] 2>/dev/null; then
    SUCCESS_RATE=$(echo "scale=1; $SENT_24H * 100 / $TOTAL_24H" | bc 2>/dev/null || echo "?")
    if [ "$FAILED_24H" -gt "$SENT_24H" ] 2>/dev/null; then
        check_warn "Delivery success rate (24h)" "${SUCCESS_RATE}% ($SENT_24H sent, $FAILED_24H failed)"
    else
        check_pass "Delivery success rate (24h)" "${SUCCESS_RATE}% ($SENT_24H sent, $FAILED_24H failed)"
    fi
else
    check_pass "Delivery success rate (24h)" "No deliveries in last 24h"
fi

# ── Summary ─────────────────────────────────────────────────────────────────────

echo ""
if [ "$CRITICAL_FAILURES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    printf "${GREEN}${BOLD}All %d checks passed${RESET}\n\n" "$CHECKS"
    current_status="OK"
elif [ "$CRITICAL_FAILURES" -eq 0 ]; then
    printf "${YELLOW}${BOLD}%d warnings, no critical failures (%d checks)${RESET}\n\n" "$WARNINGS" "$CHECKS"
    current_status="WARN"
else
    printf "${RED}${BOLD}%d critical, %d warnings (%d checks)${RESET}\n\n" "$CRITICAL_FAILURES" "$WARNINGS" "$CHECKS"
    current_status="CRITICAL"
fi

# ── State tracking & Telegram alerts ────────────────────────────────────────────

prev_status="OK"
[ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")
echo "$current_status" > "$STATE_FILE"

timestamp=$(date '+%Y-%m-%d %H:%M:%S')

if [ "$current_status" = "CRITICAL" ] && [ "$prev_status" != "CRITICAL" ]; then
    send_telegram "🔴 <b>BriefTube DB ALERT</b>
$timestamp

Database health check found critical issues:
$(echo -e "$DETAIL_LOG")
Check: ssh brieftube-pi"
    echo "[$timestamp] ALERT: Critical DB issues detected"
elif [ "$current_status" != "CRITICAL" ] && [ "$prev_status" = "CRITICAL" ]; then
    send_telegram "🟢 <b>BriefTube DB RECOVERED</b>
$timestamp

All critical database checks passing again."
    echo "[$timestamp] RECOVERED: DB health restored"
fi

# Exit with failure code on critical issues
if [ "$CRITICAL_FAILURES" -gt 0 ]; then
    exit 1
fi
exit 0
