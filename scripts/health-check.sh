#!/usr/bin/env bash
#
# BriefTube Post-Deploy Health Check
# Usage: ./health-check.sh [--remote] [--url <base_url>]
#

set -euo pipefail

# --- Colors & symbols ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}✅ PASS${RESET}"
FAIL="${RED}❌ FAIL${RESET}"
WARN="${YELLOW}⚠️  WARN${RESET}"

# --- Defaults ---
BASE_URL="https://www.brief-tube.com"
REMOTE=false
TIMEOUT=10
CRITICAL_FAILED=0
WARNINGS=0
TOTAL=0

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --remote)
            REMOTE=true
            shift
            ;;
        --url)
            BASE_URL="${2%/}"
            shift 2
            ;;
        *)
            echo "Usage: $0 [--remote] [--url <base_url>]"
            exit 1
            ;;
    esac
done

# --- Helpers ---
check_critical() {
    local label="$1"
    local url="$2"
    TOTAL=$((TOTAL + 1))

    local start end elapsed http_code
    start=$(date +%s%N)
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null) || http_code="000"
    end=$(date +%s%N)
    elapsed=$(( (end - start) / 1000000 ))

    if [[ "$http_code" == "200" ]]; then
        printf "  ${PASS}  %-30s  %s  (%d ms)\n" "$label" "${GREEN}HTTP ${http_code}${RESET}" "$elapsed"
    else
        printf "  ${FAIL}  %-30s  %s  (%d ms)\n" "$label" "${RED}HTTP ${http_code}${RESET}" "$elapsed"
        CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
    fi
}

check_non_critical() {
    local label="$1"
    local url="$2"
    TOTAL=$((TOTAL + 1))

    local start end elapsed http_code
    start=$(date +%s%N)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null) || http_code="000"
    end=$(date +%s%N)
    elapsed=$(( (end - start) / 1000000 ))

    if [[ "$http_code" == "000" ]]; then
        printf "  ${FAIL}  %-30s  %s  (%d ms)\n" "$label" "${RED}TIMEOUT/REFUSED${RESET}" "$elapsed"
        WARNINGS=$((WARNINGS + 1))
    elif [[ "$http_code" =~ ^(4[0-9]{2}|5[0-9]{2})$ && "$http_code" != "403" ]]; then
        printf "  ${WARN}  %-30s  %s  (%d ms)\n" "$label" "${YELLOW}HTTP ${http_code}${RESET}" "$elapsed"
        WARNINGS=$((WARNINGS + 1))
    else
        printf "  ${PASS}  %-30s  %s  (%d ms)\n" "$label" "${GREEN}HTTP ${http_code}${RESET}" "$elapsed"
    fi
}

check_ssl() {
    local label="SSL Certificate"
    TOTAL=$((TOTAL + 1))

    local host
    host=$(echo "$BASE_URL" | sed -E 's|https?://([^/]+).*|\1|')

    local expiry_str expiry_epoch now_epoch days_left
    expiry_str=$(echo | openssl s_client -servername "$host" -connect "${host}:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null \
        | sed 's/notAfter=//')

    if [[ -z "$expiry_str" ]]; then
        printf "  ${FAIL}  %-30s  %s\n" "$label" "${RED}Could not retrieve certificate${RESET}"
        CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
        return
    fi

    expiry_epoch=$(date -d "$expiry_str" +%s 2>/dev/null) || expiry_epoch=0
    now_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

    if [[ $days_left -lt 0 ]]; then
        printf "  ${FAIL}  %-30s  %s\n" "$label" "${RED}EXPIRED ${days_left}d ago${RESET}"
        CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
    elif [[ $days_left -lt 14 ]]; then
        printf "  ${WARN}  %-30s  %s\n" "$label" "${YELLOW}Expires in ${days_left}d (${expiry_str})${RESET}"
        WARNINGS=$((WARNINGS + 1))
    else
        printf "  ${PASS}  %-30s  %s\n" "$label" "${GREEN}Valid for ${days_left}d (${expiry_str})${RESET}"
    fi
}

# --- Header ---
echo ""
printf "${BOLD}${CYAN}  BriefTube Health Check${RESET}\n"
printf "  Target: ${BOLD}%s${RESET}\n" "$BASE_URL"
printf "  Date:   %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
echo ""
printf "${BOLD}  --- HTTP Checks (critical) ---${RESET}\n"

# --- Critical checks ---
check_critical "Homepage" "${BASE_URL}/"
check_critical "Logo SVG" "${BASE_URL}/logo.svg"
check_critical "Logo PNG" "${BASE_URL}/logo-120.png"
check_critical "Favicon" "${BASE_URL}/favicon.ico"

echo ""
printf "${BOLD}  --- HTTP Checks (non-critical) ---${RESET}\n"

# --- Non-critical checks ---
check_non_critical "API auth endpoint" "${BASE_URL}/api/auth/google"
check_non_critical "PostHog proxy" "${BASE_URL}/a/static/array.js"

echo ""
printf "${BOLD}  --- SSL ---${RESET}\n"

check_ssl

# --- Remote checks ---
if [[ "$REMOTE" == true ]]; then
    echo ""
    printf "${BOLD}  --- VPS Remote Checks (brieftube-vps) ---${RESET}\n"

    # Systemd service status
    service_status=$(ssh brieftube-vps "systemctl is-active brieftube-worker 2>/dev/null" 2>/dev/null) || service_status="unknown"
    TOTAL=$((TOTAL + 1))
    if [[ "$service_status" == "active" ]]; then
        printf "  ${PASS}  %-30s  %s\n" "Worker service" "${GREEN}${service_status}${RESET}"
    else
        printf "  ${FAIL}  %-30s  %s\n" "Worker service" "${RED}${service_status}${RESET}"
        CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
    fi

    # Disk usage
    disk_usage=$(ssh brieftube-vps "df -h / | tail -1 | awk '{print \$5}'" 2>/dev/null) || disk_usage="unknown"
    disk_pct=${disk_usage//%/}
    TOTAL=$((TOTAL + 1))
    if [[ "$disk_pct" =~ ^[0-9]+$ ]] && [[ $disk_pct -lt 85 ]]; then
        printf "  ${PASS}  %-30s  %s\n" "Disk usage" "${GREEN}${disk_usage}${RESET}"
    elif [[ "$disk_pct" =~ ^[0-9]+$ ]] && [[ $disk_pct -lt 95 ]]; then
        printf "  ${WARN}  %-30s  %s\n" "Disk usage" "${YELLOW}${disk_usage}${RESET}"
        WARNINGS=$((WARNINGS + 1))
    else
        printf "  ${FAIL}  %-30s  %s\n" "Disk usage" "${RED}${disk_usage}${RESET}"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Recent worker logs (last 10 lines)
    echo ""
    printf "${BOLD}  --- Recent Worker Logs ---${RESET}\n"
    ssh brieftube-vps "journalctl -u brieftube-worker --no-pager -n 10 2>/dev/null || tail -10 /home/brieftube/app/worker/worker.log 2>/dev/null || echo 'No logs found'" 2>/dev/null | while IFS= read -r line; do
        printf "    %s\n" "$line"
    done
fi

# --- Summary ---
echo ""
printf "${BOLD}  --- Summary ---${RESET}\n"
printf "  Checks: %d  |  " "$TOTAL"

if [[ $CRITICAL_FAILED -gt 0 ]]; then
    printf "${RED}Critical failures: %d${RESET}  |  " "$CRITICAL_FAILED"
else
    printf "${GREEN}Critical failures: 0${RESET}  |  "
fi

if [[ $WARNINGS -gt 0 ]]; then
    printf "${YELLOW}Warnings: %d${RESET}\n" "$WARNINGS"
else
    printf "${GREEN}Warnings: 0${RESET}\n"
fi

echo ""

if [[ $CRITICAL_FAILED -gt 0 ]]; then
    printf "  ${RED}${BOLD}DEPLOYMENT UNHEALTHY${RESET}\n\n"
    exit 1
else
    printf "  ${GREEN}${BOLD}DEPLOYMENT HEALTHY${RESET}\n\n"
    exit 0
fi
