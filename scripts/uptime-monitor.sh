#!/bin/bash
# BriefTube Uptime Monitor
# Run via cron every 5 minutes: */5 * * * * /path/to/uptime-monitor.sh

# Config - set these env vars or edit directly
SITE_URL="${BRIEFTUBE_URL:-https://www.brief-tube.com}"
TELEGRAM_BOT_TOKEN="${BRIEFTUBE_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${BRIEFTUBE_TELEGRAM_CHAT_ID:-}"
STATE_FILE="/tmp/brieftube-uptime-state"
TIMEOUT=15

# Check functions
check_url() {
    local url="$1"
    local name="$2"
    local status
    status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null)
    if [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
        echo "OK"
    else
        echo "FAIL:$status"
    fi
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

# Main checks
homepage=$(check_url "$SITE_URL" "Homepage")
logo=$(check_url "$SITE_URL/logo.svg" "Logo")

# Determine overall status
if [ "$homepage" = "OK" ] && [ "$logo" = "OK" ]; then
    current_status="UP"
else
    current_status="DOWN"
fi

# Read previous status
prev_status="UP"
[ -f "$STATE_FILE" ] && prev_status=$(cat "$STATE_FILE")

# Save current status
echo "$current_status" > "$STATE_FILE"

# Alert on status change
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
if [ "$current_status" = "DOWN" ] && [ "$prev_status" = "UP" ]; then
    send_telegram "🔴 <b>BriefTube DOWN</b>
$timestamp

Homepage: $homepage
Logo: $logo

Check: ssh brieftube-pi"
    echo "[$timestamp] ALERT: Site is DOWN (homepage=$homepage, logo=$logo)"
elif [ "$current_status" = "UP" ] && [ "$prev_status" = "DOWN" ]; then
    send_telegram "🟢 <b>BriefTube RECOVERED</b>
$timestamp

All checks passing."
    echo "[$timestamp] RECOVERED: Site is back UP"
fi
