"""Telegram bot command handlers and alert system for @brief_tube_bot."""

import asyncio
import html as _html
import re
import logging
import aiohttp
import feedparser
from typing import Optional
from telegram import Update
from telegram.error import Conflict
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from config import TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID, APP_URL
import db
from monitoring import stats, get_system_info, get_log_tail, format_log, _md_to_html

logger = logging.getLogger(__name__)


# ── Alert System ──────────────────────────────────────────────────

class MonitoringAlert:
    """Sends alerts to admin Telegram chat."""

    def __init__(self, bot_app, admin_chat_id: Optional[str] = None):
        self.bot_app = bot_app
        self.admin_chat_id = admin_chat_id
        self.alert_queue = asyncio.Queue()
        self.is_running = False

    async def send_alert(self, message: str, level: str = "INFO"):
        """Queue an alert to be sent to admin."""
        if not self.admin_chat_id:
            return

        emoji = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "ERROR": "🔴",
            "CRITICAL": "🚨",
        }.get(level, "📢")

        safe_msg = _md_to_html(message)
        formatted = f"{emoji} <b>{level}</b>\n\n{safe_msg}"
        await self.alert_queue.put(formatted)

    async def process_alerts(self):
        """Background task to send queued alerts."""
        self.is_running = True
        logger.info("Monitoring alerts started")

        while self.is_running:
            try:
                try:
                    message = await asyncio.wait_for(self.alert_queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    continue

                try:
                    await self.bot_app.bot.send_message(
                        chat_id=self.admin_chat_id,
                        text=message,
                        parse_mode="HTML",
                    )
                except Exception as e:
                    logger.error(f"Failed to send alert: {e}")

                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Alert processing error: {e}")
                await asyncio.sleep(5)

    async def stop(self):
        """Stop the alert processor."""
        self.is_running = False


async def send_daily_report(alert_system: MonitoringAlert):
    """Send daily statistics report to admin."""
    summary = stats.get_summary()
    system = get_system_info()

    report = (
        f"📊 <b>Daily Worker Report</b>\n\n"
        f"<b>Uptime:</b> {summary['uptime']}\n\n"
        f"<b>Videos:</b>\n"
        f"• Processed: {summary['videos_processed']}\n"
        f"• Failed: {summary['videos_failed']}\n"
        f"• Avg time: {summary['avg_processing_time']}s\n\n"
        f"<b>RSS Scans:</b> {summary['rss_scans']}\n"
        f"<b>New videos found:</b> {summary['new_videos_found']}\n\n"
        f"<b>Deliveries:</b>\n"
        f"• Sent: {summary['deliveries_sent']}\n"
        f"• Failed: {summary['deliveries_failed']}\n\n"
        f"<b>System:</b>\n"
        f"• CPU: {system.get('cpu_percent', 'N/A')}%\n"
        f"• Memory: {system.get('memory_percent', 'N/A')}%\n"
        f"• Disk: {system.get('disk_free_gb', 'N/A')} GB free\n\n"
        f"<b>Recent Errors:</b> {len(summary['recent_errors'])}\n"
    )

    await alert_system.send_alert(report, level="INFO")


# ── URL detection patterns ────────────────────────────────────
VIDEO_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]{11})"
)
CHANNEL_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?youtube\.com/(?:channel/(UC[\w-]+)|c/([\w-]+)|@([\w.-]+))"
)
HANDLE_RE = re.compile(r"^@([\w.-]+)$")
ON_DEMAND_MONTHLY_LIMIT = 30


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command. Links Telegram account if token is provided."""
    chat_id = str(update.effective_chat.id)

    # Check if a connect token was provided: /start TOKEN
    if context.args and len(context.args) == 1:
        token = context.args[0]

        # Look up the token in profiles and link the chat_id
        sb = db.get_client()

        # Step 1: Unlink any other profile already connected to this chat_id
        # (a Telegram account can only be linked to ONE BriefTube account at a time)
        sb.table("profiles").update({
            "telegram_chat_id": None,
            "telegram_connected": False,
        }).eq("telegram_chat_id", chat_id).neq("telegram_connect_token", token).execute()

        # Step 2: Link this profile
        res = (
            sb.table("profiles")
            .update({
                "telegram_chat_id": chat_id,
                "telegram_connected": True,
                "telegram_connect_token": None,
            })
            .eq("telegram_connect_token", token)
            .execute()
        )

        if res.data:
            email = res.data[0].get("email", "")
            await update.message.reply_text(
                f"Connected! Your Telegram is now linked to {email}.\n\n"
                "You'll receive audio summaries here whenever new videos are published "
                "on your subscribed channels."
            )
            logger.info(f"Telegram connected: chat_id={chat_id}, email={email}")
        else:
            await update.message.reply_text(
                "Invalid or expired token.\n\n"
                "Go to your BriefTube dashboard (Settings) to generate a new connection link."
            )
    else:
        # No token, show welcome message
        await update.message.reply_text(
            "Welcome to BriefTube!\n\n"
            "To connect your account:\n"
            f"1. Sign up at {APP_URL}\n"
            "2. Go to Dashboard > Settings\n"
            "3. Click 'Generate link' and open it\n\n"
            "Once connected, you'll receive audio summaries of new YouTube videos "
            "from your subscribed channels."
        )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    await update.message.reply_text(
        "BriefTube — YouTube summaries as audio on Telegram\n\n"
        "Commands:\n"
        "/start — Connect your account\n"
        "/status — Check connection status\n"
        "/help — Show this message\n\n"
        "Send a YouTube video link → get an audio summary\n"
        "Send a channel link or @handle → subscribe to it\n\n"
        f"Free plan: {ON_DEMAND_MONTHLY_LIMIT} on-demand summaries/month, 5 channels\n"
        "Pro plan: unlimited\n\n"
        f"Manage your channels at {APP_URL}"
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    chat_id = str(update.effective_chat.id)
    sb = db.get_client()

    res = (
        sb.table("profiles")
        .select("email, subscription_status")
        .eq("telegram_chat_id", chat_id)
        .eq("telegram_connected", True)
        .execute()
    )

    if res.data:
        profile = res.data[0]
        plan = "Pro" if profile["subscription_status"] == "active" else "Free"
        await update.message.reply_text(
            f"Connected as: {profile['email']}\n"
            f"Plan: {plan}\n\n"
            f"Manage your channels at {APP_URL}"
        )
    else:
        await update.message.reply_text(
            "Your Telegram is not connected to any BriefTube account.\n\n"
            f"Go to {APP_URL} > Settings to connect."
        )


# ── Admin Monitoring Commands ─────────────────────────────────────

def _is_admin(chat_id: str) -> bool:
    """Check if chat_id is admin."""
    return ADMIN_TELEGRAM_CHAT_ID and chat_id == str(ADMIN_TELEGRAM_CHAT_ID)


async def monitor_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /monitor_status command (admin only)."""
    chat_id = str(update.effective_chat.id)

    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return

    summary = stats.get_summary()
    system = get_system_info()

    last_video = summary['last_video_time'][:16] if summary['last_video_time'] else 'N/A'
    status_msg = (
        f"<b>Worker Status</b>\n\n"
        f"Uptime: {summary['uptime']}  |  Started: {summary['start_time'][:16]}\n\n"
        f"<b>Videos</b>\n"
        f"• Processed: {summary['videos_processed']}\n"
        f"• Failed: {summary['videos_failed']}\n"
        f"• Success rate: {_calc_success_rate(summary)}%\n\n"
        f"<b>RSS Scanner</b>\n"
        f"• Scans: {summary['rss_scans']}\n"
        f"• New videos found: {summary['new_videos_found']}\n\n"
        f"<b>Deliveries</b>\n"
        f"• Sent: {summary['deliveries_sent']}\n"
        f"• Failed: {summary['deliveries_failed']}\n\n"
        f"<b>Performance</b>\n"
        f"• Avg processing: {summary['avg_processing_time']}s\n"
        f"• Last video: {last_video}\n\n"
        f"<b>System</b>\n"
        f"• CPU: {system.get('cpu_percent', 'N/A')}%\n"
        f"• Memory: {system.get('memory_percent', 'N/A')}% ({system.get('memory_used_mb', 'N/A')} MB)\n"
        f"• Disk: {system.get('disk_free_gb', 'N/A')} GB free"
    )

    await update.message.reply_text(status_msg, parse_mode="HTML")


async def monitor_stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /monitor_stats command (admin only)."""
    chat_id = str(update.effective_chat.id)

    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return

    summary = stats.get_summary()

    # Build error breakdown
    error_breakdown = "\n".join(
        f"• {error_type}: {count}"
        for error_type, count in summary['errors_by_type'].items()
    ) or "None"

    stats_msg = (
        f"<b>Detailed Statistics</b>\n\n"
        f"<b>Processing</b>\n"
        f"• Processed: {summary['videos_processed']}\n"
        f"• Failed: {summary['videos_failed']}\n"
        f"• Success rate: {_calc_success_rate(summary)}%\n"
        f"• Avg time: {summary['avg_processing_time']}s\n\n"
        f"<b>Error Breakdown</b>\n"
        f"{error_breakdown}\n\n"
        f"<b>Recent Errors</b>\n"
    )

    if summary['recent_errors']:
        for err in summary['recent_errors'][-5:]:
            time_str = err['time'][11:16]
            msg = _html.escape(err['message'][:80])
            stats_msg += f"<code>{time_str}</code> {msg}\n"
    else:
        stats_msg += "No recent errors"

    await update.message.reply_text(stats_msg, parse_mode="HTML")


async def monitor_logs_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /monitor_logs command (admin only)."""
    chat_id = str(update.effective_chat.id)

    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return

    # Get number of lines (default 30)
    lines = 30
    if context.args and context.args[0].isdigit():
        lines = min(int(context.args[0]), 100)

    formatted = format_log(get_log_tail(lines))
    await update.message.reply_text(
        f"<b>Last {lines} lines</b>\n\n{formatted}",
        parse_mode="HTML",
    )


def _calc_success_rate(summary: dict) -> int:
    """Calculate success rate percentage."""
    total = summary['videos_processed'] + summary['videos_failed']
    if total == 0:
        return 100
    return round((summary['videos_processed'] / total) * 100)


# ── Helper: get profile from chat_id ──────────────────────────

def _get_profile_by_chat_id(chat_id: str) -> dict | None:
    """Look up a connected profile by telegram chat_id."""
    sb = db.get_client()
    res = (
        sb.table("profiles")
        .select("id, email, subscription_status, max_channels")
        .eq("telegram_chat_id", chat_id)
        .eq("telegram_connected", True)
        .execute()
    )
    return res.data[0] if res.data else None


# ── Helper: resolve YouTube channel ──────────────────────────

async def _resolve_channel(text: str) -> dict | None:
    """Resolve a YouTube channel URL, @handle, or UC... ID to {channel_id, channel_name}.
    Returns None if resolution fails."""
    text = text.strip()

    # Direct UC channel ID
    if re.match(r"^UC[\w-]{22}$", text):
        name = await _get_channel_name_from_rss(text)
        return {"channel_id": text, "channel_name": name or text}

    # Channel URL patterns
    m = CHANNEL_URL_RE.search(text)
    if m:
        uc_id = m.group(1)  # /channel/UC...
        if uc_id:
            name = await _get_channel_name_from_rss(uc_id)
            return {"channel_id": uc_id, "channel_name": name or uc_id}
        # /c/name or /@handle — need to scrape the page
        handle = m.group(3) or m.group(2)
        if handle:
            return await _resolve_handle(handle)
        return None

    # Bare @handle
    hm = HANDLE_RE.match(text)
    if hm:
        return await _resolve_handle(hm.group(1))

    return None


async def _resolve_handle(handle: str) -> dict | None:
    """Fetch YouTube page for @handle and extract channel_id + name."""
    url = f"https://www.youtube.com/@{handle}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }) as resp:
                if resp.status != 200:
                    return None
                html = await resp.text()
    except Exception:
        return None

    id_match = (
        re.search(r'"channelId":"(UC[\w-]+)"', html) or
        re.search(r'"externalId":"(UC[\w-]+)"', html) or
        re.search(r'/channel/(UC[\w-]+)', html)
    )
    if not id_match:
        return None
    channel_id = id_match.group(1)

    name = await _get_channel_name_from_rss(channel_id)
    if not name:
        name_match = (
            re.search(r'"channelMetadataRenderer":\{"title":"([^"]+)"', html) or
            re.search(r'"ownerChannelName":"([^"]+)"', html)
        )
        name = name_match.group(1) if name_match else channel_id

    return {"channel_id": channel_id, "channel_name": name}


async def _get_channel_name_from_rss(channel_id: str) -> str | None:
    """Get channel name from YouTube RSS feed."""
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(rss_url) as resp:
                if resp.status != 200:
                    return None
                text = await resp.text()
        feed = feedparser.parse(text)
        title = feed.feed.get("title", "")
        if title and title != "YouTube":
            return title
    except Exception:
        pass
    return None


# ── Handler: on-demand video summary ─────────────────────────

async def handle_video_request(update: Update, profile: dict, video_id: str) -> None:
    """Handle a YouTube video URL — queue an on-demand summary."""
    user_id = profile["id"]
    is_pro = profile["subscription_status"] == "active"

    # Check monthly limit for free users
    if not is_pro:
        used = db.count_on_demand_this_month(user_id)
        if used >= ON_DEMAND_MONTHLY_LIMIT:
            await update.message.reply_text(
                f"You've reached your monthly limit of {ON_DEMAND_MONTHLY_LIMIT} on-demand summaries.\n\n"
                f"Upgrade to Pro for unlimited summaries at {APP_URL}"
            )
            return

    sb = db.get_client()
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    # Check if video already exists
    existing = sb.table("processed_videos").select("status, channel_id").eq("video_id", video_id).execute()

    if existing.data:
        video_row = existing.data[0]
        if video_row["status"] == "completed":
            # Already done — just create a delivery
            sb.table("deliveries").upsert({
                "user_id": user_id,
                "video_id": video_id,
                "status": "pending",
                "source": "on_demand",
            }, on_conflict="user_id,video_id").execute()
            await update.message.reply_text(
                "This video was already summarized. Sending you the audio now..."
            )
            return
        elif video_row["status"] in ("pending", "processing"):
            # In progress — create delivery, it'll be sent when done
            sb.table("deliveries").upsert({
                "user_id": user_id,
                "video_id": video_id,
                "status": "pending",
                "source": "on_demand",
            }, on_conflict="user_id,video_id").execute()
            await update.message.reply_text(
                "This video is being processed. You'll receive the audio summary shortly."
            )
            return

    # New video — get title from oEmbed API
    video_title = video_id
    try:
        async with aiohttp.ClientSession() as session:
            oembed_url = f"https://www.youtube.com/oembed?url={video_url}&format=json"
            async with session.get(oembed_url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    video_title = data.get("title", video_id)
    except Exception:
        pass

    # Insert into processed_videos + processing_queue + delivery
    channel_id = ""  # Unknown for on-demand, not tied to a channel subscription
    db.insert_new_video(video_id, channel_id, video_title, video_url)
    db.enqueue_video(video_id, video_url, video_title, channel_id)
    sb.table("deliveries").upsert({
        "user_id": user_id,
        "video_id": video_id,
        "status": "pending",
        "source": "on_demand",
    }, on_conflict="user_id,video_id").execute()

    if not is_pro:
        used = db.count_on_demand_this_month(user_id)
        remaining = ON_DEMAND_MONTHLY_LIMIT - used
        await update.message.reply_text(
            f"Processing: {video_title}\n\n"
            f"You'll receive the audio summary soon. ({remaining} on-demand left this month)"
        )
    else:
        await update.message.reply_text(
            f"Processing: {video_title}\n\n"
            "You'll receive the audio summary soon."
        )


# ── Handler: subscribe to channel from Telegram ──────────────

async def handle_channel_subscribe(update: Update, profile: dict, text: str) -> None:
    """Handle a YouTube channel URL or @handle — subscribe the user."""
    user_id = profile["id"]
    is_pro = profile["subscription_status"] == "active"

    resolved = await _resolve_channel(text)
    if not resolved:
        await update.message.reply_text(
            "Could not find this YouTube channel.\n"
            "Try sending a channel URL (youtube.com/@handle) or @handle."
        )
        return

    channel_id = resolved["channel_id"]
    channel_name = resolved["channel_name"]

    # Check subscription limit for free users
    if not is_pro:
        sb = db.get_client()
        count_res = (
            sb.table("subscriptions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("active", True)
            .execute()
        )
        current_count = count_res.count or 0
        max_channels = profile.get("max_channels", 5)
        if current_count >= max_channels:
            await update.message.reply_text(
                f"You've reached your limit of {max_channels} channels.\n\n"
                f"Upgrade to Pro for unlimited channels at {APP_URL}"
            )
            return

    # Insert subscription
    sb = db.get_client()
    try:
        sb.table("subscriptions").insert({
            "user_id": user_id,
            "channel_id": channel_id,
            "channel_name": channel_name,
        }).execute()
    except Exception as e:
        if "23505" in str(e):
            await update.message.reply_text(
                f"You're already subscribed to {channel_name}."
            )
            return
        logger.error(f"Subscription insert error: {e}")
        await update.message.reply_text("Failed to subscribe. Please try again.")
        return

    # Mark existing videos as skipped (non-blocking)
    try:
        db.mark_existing_videos_as_skipped(channel_id)
    except Exception:
        pass

    await update.message.reply_text(
        f"Subscribed to {channel_name}!\n\n"
        "You'll receive audio summaries when new videos are published."
    )
    logger.info(f"Telegram subscribe: user={user_id}, channel={channel_name} ({channel_id})")


# ── Message router ────────────────────────────────────────────

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route text messages: video URLs → summary, channel URLs/@handles → subscribe."""
    if not update.message or not update.message.text:
        return

    chat_id = str(update.effective_chat.id)
    text = update.message.text.strip()

    # Check if user is connected
    profile = _get_profile_by_chat_id(chat_id)
    if not profile:
        await update.message.reply_text(
            "Your Telegram is not connected to a BriefTube account.\n\n"
            f"1. Sign up at {APP_URL}\n"
            "2. Go to Settings and connect your Telegram"
        )
        return

    # Check for video URL
    video_match = VIDEO_RE.search(text)
    if video_match:
        video_id = video_match.group(1)
        await handle_video_request(update, profile, video_id)
        return

    # Check for channel URL or @handle
    if CHANNEL_URL_RE.search(text) or HANDLE_RE.match(text):
        await handle_channel_subscribe(update, profile, text)
        return

    # Unknown message
    await update.message.reply_text(
        "Send me a YouTube video link for an audio summary,\n"
        "or a channel link / @handle to subscribe.\n\n"
        "Type /help for more info."
    )


async def _error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Suppress Conflict errors (another bot instance polling); log everything else."""
    if isinstance(context.error, Conflict):
        logger.debug("Bot polling conflict — another instance may be running (deliveries unaffected)")
        return
    logger.error(f"Bot error: {context.error}")


def create_bot_application() -> Application:
    """Create the Telegram bot application with command handlers."""
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Silence Conflict errors in logs — deliveries work independently of polling
    app.add_error_handler(_error_handler)

    # User commands
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("status", status_command))

    # Admin monitoring commands
    app.add_handler(CommandHandler("monitor_status", monitor_status_command))
    app.add_handler(CommandHandler("monitor_stats", monitor_stats_command))
    app.add_handler(CommandHandler("monitor_logs", monitor_logs_command))

    # Message handler LAST — catches non-command text messages
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app
