#!/bin/bash
# Setup cron job for BriefTube uptime monitoring
# Uses the same TELEGRAM_BOT_TOKEN as the worker (see worker/.env.example)
# ADMIN_TELEGRAM_CHAT_ID is your personal Telegram chat ID

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_SCRIPT="$SCRIPT_DIR/uptime-monitor.sh"
LOG_FILE="/tmp/brieftube-uptime.log"
CRON_COMMENT="# BriefTube uptime monitor"

echo "=== BriefTube Uptime Monitor Setup ==="
echo ""

# Check monitor script exists
if [ ! -x "$MONITOR_SCRIPT" ]; then
    echo "ERROR: $MONITOR_SCRIPT not found or not executable"
    exit 1
fi

# Get Telegram bot token
if [ -z "$BRIEFTUBE_TELEGRAM_BOT_TOKEN" ]; then
    echo "Enter your Telegram Bot Token (same as worker's TELEGRAM_BOT_TOKEN):"
    read -r BRIEFTUBE_TELEGRAM_BOT_TOKEN
    if [ -z "$BRIEFTUBE_TELEGRAM_BOT_TOKEN" ]; then
        echo "ERROR: Bot token is required"
        exit 1
    fi
fi

# Get Telegram chat ID
if [ -z "$BRIEFTUBE_TELEGRAM_CHAT_ID" ]; then
    echo "Enter your Telegram Chat ID (same as worker's ADMIN_TELEGRAM_CHAT_ID):"
    echo "  (Get it by sending /start to @userinfobot on Telegram)"
    read -r BRIEFTUBE_TELEGRAM_CHAT_ID
    if [ -z "$BRIEFTUBE_TELEGRAM_CHAT_ID" ]; then
        echo "ERROR: Chat ID is required"
        exit 1
    fi
fi

# Build the cron line
CRON_LINE="*/5 * * * * BRIEFTUBE_TELEGRAM_BOT_TOKEN=$BRIEFTUBE_TELEGRAM_BOT_TOKEN BRIEFTUBE_TELEGRAM_CHAT_ID=$BRIEFTUBE_TELEGRAM_CHAT_ID $MONITOR_SCRIPT >> $LOG_FILE 2>&1"

# Check if already installed
if crontab -l 2>/dev/null | grep -qF "uptime-monitor.sh"; then
    echo ""
    echo "A cron entry for uptime-monitor.sh already exists."
    echo "Current entry:"
    crontab -l 2>/dev/null | grep "uptime-monitor.sh"
    echo ""
    echo "Replace it? [y/N]"
    read -r REPLACE
    if [ "$REPLACE" = "y" ] || [ "$REPLACE" = "Y" ]; then
        # Remove old entry and add new one
        (crontab -l 2>/dev/null | grep -v "uptime-monitor.sh" | grep -v "$CRON_COMMENT"; echo "$CRON_COMMENT"; echo "$CRON_LINE") | crontab -
        echo "Cron entry replaced."
    else
        echo "Aborted."
        exit 0
    fi
else
    # Add new entry
    (crontab -l 2>/dev/null; echo ""; echo "$CRON_COMMENT"; echo "$CRON_LINE") | crontab -
    echo ""
    echo "Cron entry added."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "The monitor will:"
echo "  - Check https://www.brief-tube.com every 5 minutes"
echo "  - Send a Telegram alert when the site goes DOWN"
echo "  - Send a Telegram alert when the site RECOVERS"
echo "  - Log to $LOG_FILE"
echo ""
echo "Commands:"
echo "  View logs:     tail -f $LOG_FILE"
echo "  Test now:      BRIEFTUBE_TELEGRAM_BOT_TOKEN=... BRIEFTUBE_TELEGRAM_CHAT_ID=... $MONITOR_SCRIPT"
echo "  Remove cron:   crontab -e  (delete the brieftube line)"
echo "  List crons:    crontab -l"
