"""Telegram bot command handlers and alert system for @brief_tube_bot."""

import asyncio
import html as _html
import re
import logging
import traceback
from pathlib import Path
from urllib.parse import quote as _url_quote
import aiohttp
import feedparser
from typing import Optional
from telegram import Bot, BotCommand, CopyTextButton, InlineKeyboardButton, InlineKeyboardMarkup, LinkPreviewOptions, Update
from telegram.error import Conflict
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from config import TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID, APP_URL, LOG_BOT_TOKEN, LOG_BOT_ADMIN_CHAT_ID
import db
from monitoring import stats, get_system_info, get_log_tail, format_log, _md_to_html

logger = logging.getLogger(__name__)


# ── Alert System ──────────────────────────────────────────────────

class MonitoringAlert:
    """Sends alerts to admin via the log bot (separate from the public user-facing bot)."""

    def __init__(self, bot_app, admin_chat_id: Optional[str] = None):
        self.bot_app = bot_app  # kept for user-facing notifications (e.g. video failure)
        self.admin_chat_id = admin_chat_id
        self.alert_queue = asyncio.Queue()
        self.is_running = False
        # Use the dedicated log bot for admin alerts so they don't appear in the public bot
        self._log_bot: Optional[Bot] = Bot(LOG_BOT_TOKEN) if LOG_BOT_TOKEN else None
        self._log_chat_id: str = LOG_BOT_ADMIN_CHAT_ID or admin_chat_id or ""
        # Track video_ids already mirrored this session (avoid sending N copies for N subscribers)
        self._mirrored_video_ids: set = set()
        self._mirror_enabled: bool = True  # Toggle via /log_toggle

    async def send_alert(self, message: str, level: str = "INFO"):
        """Queue an alert to be sent to admin via the log bot."""
        if not self._log_chat_id or not self._log_bot:
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
                    await self._log_bot.send_message(
                        chat_id=self._log_chat_id,
                        text=message,
                        parse_mode="HTML",
                    )
                except Exception as e:
                    logger.error(f"Failed to send alert: {e}")

                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Alert processing error: {e}")
                await asyncio.sleep(5)

    async def mirror_delivery(
        self,
        video_id: str,
        video_title: str,
        channel_id: str,
        audio_path: Path,
    ) -> None:
        """Send a copy of a delivery to the admin log bot — once per video per session.

        Lets the admin see every video sent to users (title, YouTube link, audio)
        without receiving N duplicates when multiple subscribers get the same video.
        """
        if not self._mirror_enabled:
            return
        if not self._log_bot or not self._log_chat_id:
            return
        if video_id in self._mirrored_video_ids:
            return
        self._mirrored_video_ids.add(video_id)

        video_url = f"https://youtu.be/{video_id}"
        title_esc = _html.escape(video_title)
        channel_esc = _html.escape(channel_id)

        # Text message with inline YouTube preview
        preview = None
        try:
            preview = await self._log_bot.send_message(
                chat_id=self._log_chat_id,
                text=f"📤 <b>{title_esc}</b>\n<i>{channel_esc}</i>\n{video_url}",
                parse_mode="HTML",
                link_preview_options=LinkPreviewOptions(prefer_large_media=True),
            )
        except Exception as e:
            logger.warning(f"Delivery mirror preview failed ({video_id}): {e}")

        # Audio voice message (MP3 sent directly — no OGG conversion needed for admin)
        try:
            if audio_path.exists():
                with open(audio_path, "rb") as f:
                    await self._log_bot.send_voice(
                        chat_id=self._log_chat_id,
                        voice=f,
                        reply_to_message_id=preview.message_id if preview else None,
                    )
        except Exception as e:
            logger.warning(f"Delivery mirror audio failed ({video_id}): {e}")

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

def _share_keyboard(url: str) -> InlineKeyboardMarkup:
    """Return keyboard for a share-link message: [Share →]"""
    tg_share_url = f"https://t.me/share/url?url={_url_quote(url)}"
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("Share →", url=tg_share_url),
    ]])


_LANG_LABELS: dict[str, str] = {
    "en": "English",
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
    "pt": "Português",
    "zh": "中文",
    "ja": "日本語",
    "ko": "한국어",
    "ar": "العربية",
    "hi": "हिन्दी",
    "ru": "Русский",
    "it": "Italiano",
    "nl": "Nederlands",
    "tr": "Türkçe",
    "pl": "Polski",
    "sv": "Svenska",
    "nb": "Norsk",
    "da": "Dansk",
    "fi": "Suomi",
    "id": "Indonesia",
    "ms": "Melayu",
    "vi": "Tiếng Việt",
    "th": "ภาษาไทย",
    "uk": "Українська",
    "cs": "Čeština",
    "ro": "Română",
    "hu": "Magyar",
    "el": "Ελληνικά",
    "he": "עברית",
    "bn": "বাংলা",
    "ur": "اردو",
    "fa": "فارسی",
    "fil": "Filipino",
    "ta": "தமிழ்",
    "te": "తెలుగు",
    "kn": "ಕನ್ನಡ",
    "ml": "മലയാളം",
    "gu": "ગુજરાતી",
    "mr": "मराठी",
    "pa": "ਪੰਜਾਬੀ",
    "sw": "Kiswahili",
    "bg": "Български",
    "hr": "Hrvatski",
    "sk": "Slovenčina",
    "lt": "Lietuvių",
    "lv": "Latviešu",
    "et": "Eesti",
    "ca": "Català",
    "sr": "Српски",
    "sl": "Slovenščina",
    "ne": "नेपाली",
    "am": "አማርኛ",
    "az": "Azərbaycan",
    "ka": "ქართული",
    "kk": "Қазақ",
}


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command. Links Telegram account if token is provided."""
    chat_id = str(update.effective_chat.id)

    # Check if a connect token was provided: /start TOKEN
    if context.args and len(context.args) == 1:
        token = context.args[0]

        sb = db.get_client()

        # Step 1: Find the user claiming this token
        token_res = sb.table("profiles").select("id, email, referral_code").eq("telegram_connect_token", token).execute()
        if not token_res.data:
            await update.message.reply_text(
                "Invalid or expired token.\n\n"
                "Go to your BriefTube dashboard (Settings) to generate a new connection link."
            )
            return

        user_id = token_res.data[0]["id"]
        email = token_res.data[0].get("email", "")
        ref_code = token_res.data[0].get("referral_code", "")

        # Step 2: Disconnect any OTHER user's Telegram connection with this chat_id
        sb.table("platform_connections").update({"connected": False}).eq("platform", "telegram").eq("external_id", chat_id).neq("user_id", user_id).execute()

        # Step 3: Upsert this user's Telegram connection
        sb.table("platform_connections").upsert(
            {"user_id": user_id, "platform": "telegram", "external_id": chat_id, "connected": True},
            on_conflict="user_id,platform",
        ).execute()

        # Step 4: Clear the connect token
        sb.table("profiles").update({"telegram_connect_token": None}).eq("id", user_id).execute()

        ref_text = (
            f"\n\nShare BriefTube with friends: {APP_URL}/?ref={ref_code}"
            if ref_code else ""
        )
        await update.message.reply_text(
            f"Connected! Your Telegram is now linked to {email}.\n\n"
            "You'll receive audio summaries here whenever new videos are published "
            f"on your subscribed channels.{ref_text}"
        )
        logger.info(f"Telegram connected: chat_id={chat_id}, email={email}")
    else:
        # No token — check if already connected
        logger.info(f"/start (no token) from chat_id={chat_id}")
        profile = _get_profile_by_chat_id(chat_id)
        if profile:
            plan = _get_plan_label(profile)
            await update.message.reply_text(
                f"You're connected as {profile['email']} ({plan}).\n\n"
                f"Manage your channels at {APP_URL}/dashboard"
            )
        else:
            await update.message.reply_text(
                "Your Telegram is not linked to a BriefTube account.\n\n"
                "If you already have an account:\n"
                f"→ {APP_URL}/dashboard/profile\n"
                "Go to <b>Delivery</b> and tap <b>Reconnect</b> to generate a new link.\n\n"
                "If you don't have an account yet:\n"
                f"→ {APP_URL}",
                parse_mode="HTML",
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
    profile = await asyncio.to_thread(_get_profile_by_chat_id, chat_id)

    if profile:
        plan = _get_plan_label(profile)
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


async def log_toggle_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Toggle delivery mirroring on/off (admin only)."""
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return
    # Find the alert_system via the application's bot_data
    alert = context.application.bot_data.get("alert_system")
    if not alert:
        await update.message.reply_text("Alert system not found.")
        return
    alert._mirror_enabled = not alert._mirror_enabled
    state = "enabled ✅" if alert._mirror_enabled else "disabled ⏸️"
    await update.message.reply_text(f"Delivery mirroring {state}")


def _calc_success_rate(summary: dict) -> int:
    """Calculate success rate percentage."""
    total = summary['videos_processed'] + summary['videos_failed']
    if total == 0:
        return 100
    return round((summary['videos_processed'] / total) * 100)


# ── Helper: get profile from chat_id ──────────────────────────

def _get_profile_by_chat_id(chat_id: str) -> dict | None:
    """Look up a connected profile by telegram chat_id via platform_connections."""
    sb = db.get_client()
    conn_res = (
        sb.table("platform_connections")
        .select("user_id")
        .eq("platform", "telegram")
        .eq("external_id", chat_id)
        .eq("connected", True)
        .execute()
    )
    if not conn_res.data:
        return None
    user_id = conn_res.data[0]["user_id"]
    res = (
        sb.table("profiles")
        .select("id, email, subscription_status, trial_ends_at, max_channels, preferred_language, tts_voice, favorite_languages")
        .eq("id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def _is_pro(profile: dict) -> bool:
    """Return True if the user has an active subscription OR an active trial."""
    from datetime import datetime, timezone
    if profile.get("subscription_status") == "active":
        return True
    trial_ends_at = profile.get("trial_ends_at")
    if trial_ends_at:
        try:
            ends = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
            return datetime.now(timezone.utc) <= ends
        except Exception:
            pass
    return False


def _get_plan_label(profile: dict) -> str:
    """Return a human-readable plan label: Pro / Trial (Xd left) / Free."""
    if profile.get("subscription_status") == "active":
        return "Pro"
    trial_ends_at = profile.get("trial_ends_at")
    if trial_ends_at:
        from datetime import datetime, timezone
        try:
            ends = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            days_left = (ends - now).days
            if days_left >= 0:
                return f"Trial · {days_left}d left"
        except Exception:
            pass
    return "Free"


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


async def _get_channel_for_video(video_id: str) -> dict | None:
    """Scrape the YouTube video page to extract channel_id + channel_name.

    Used as fallback when a video was processed on-demand and has no channel_id
    stored in the database (channel_id = "").
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
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

    name_match = (
        re.search(r'"channelMetadataRenderer":\{"title":"([^"]+)"', html) or
        re.search(r'"ownerChannelName":"([^"]+)"', html)
    )
    channel_name = name_match.group(1) if name_match else channel_id

    return {"channel_id": channel_id, "channel_name": channel_name}


async def _get_channel_avatar(channel_id: str) -> str | None:
    """Fetch channel avatar URL from the YouTube channel page (og:image meta tag)."""
    url = f"https://www.youtube.com/channel/{channel_id}"
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

    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    return m.group(1) if m else None


def _upsert_delivery(sb, user_id: str, video_id: str, language: str) -> None:
    """Insert or reset a delivery to pending.

    The supabase-py upsert() doesn't clear sent_at on conflict, leaving the
    row permanently stuck. Instead we check for an existing row and UPDATE it,
    or INSERT if it doesn't exist yet.
    """
    existing = (
        sb.table("deliveries")
        .select("id")
        .eq("user_id", user_id)
        .eq("video_id", video_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        sb.table("deliveries").update({
            "status": "pending",
            "source": "on_demand",
            "language": language,
            "sent_at": None,
        }).eq("id", existing.data["id"]).execute()
    else:
        sb.table("deliveries").insert({
            "user_id": user_id,
            "video_id": video_id,
            "status": "pending",
            "source": "on_demand",
            "language": language,
        }).execute()


def _get_channel_name_from_subscription(channel_id: str) -> str:
    """Return channel_name from subscriptions table, fallback to channel_id."""
    sb = db.get_client()
    res = (
        sb.table("subscriptions")
        .select("channel_name")
        .eq("channel_id", channel_id)
        .limit(1)
        .execute()
    )
    return res.data[0]["channel_name"] if res.data else channel_id


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
    is_pro = _is_pro(profile)
    used_this_month = 0

    # Check monthly limit for free users
    if not is_pro:
        used_this_month = db.count_on_demand_this_month(user_id)
        if used_this_month >= ON_DEMAND_MONTHLY_LIMIT:
            await update.message.reply_text(
                f"You've reached your monthly limit of {ON_DEMAND_MONTHLY_LIMIT} on-demand summaries.\n\n"
                f"Upgrade to Pro for unlimited summaries at {APP_URL}"
            )
            return

    sb = db.get_client()
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    user_language = profile.get("preferred_language") or "fr"
    user_tts_voice = profile.get("tts_voice") or None

    # Check if video already exists in the user's language
    existing = (
        sb.table("processed_videos")
        .select("status, channel_id")
        .eq("video_id", video_id)
        .eq("language", user_language)
        .execute()
    )

    if existing.data:
        video_row = existing.data[0]
        if video_row["status"] == "completed":
            logger.info(f"[{video_id}] Already completed — queuing delivery for user={user_id}")
            _upsert_delivery(sb, user_id, video_id, user_language)
            await update.message.reply_text(
                "This video was already summarized. Sending you the audio now..."
            )
            return
        elif video_row["status"] in ("pending", "processing"):
            logger.info(f"[{video_id}] Already in queue (status={video_row['status']}) — adding delivery for user={user_id}")
            _upsert_delivery(sb, user_id, video_id, user_language)
            await update.message.reply_text(
                "This video is being processed. You'll receive the audio summary shortly."
            )
            return

    # New video — send IMMEDIATE acknowledgment before the slow oEmbed network call
    if not is_pro:
        remaining = ON_DEMAND_MONTHLY_LIMIT - used_this_month - 1
        await update.message.reply_text(
            "Your video has been received and is queued for processing.\n"
            "You'll receive the audio summary soon.\n\n"
            f"({remaining} on-demand summaries left this month)"
        )
    else:
        await update.message.reply_text(
            "Your video has been received and is queued for processing.\n"
            "You'll receive the audio summary soon."
        )

    # Fetch title from oEmbed (slow — user already has acknowledgment above)
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

    # Insert into processed_videos + processing_queue + delivery (with user's language)
    channel_id = ""  # Unknown for on-demand, not tied to a channel subscription
    logger.info(f"[{video_id}] New on-demand video: title={video_title!r}, lang={user_language}, user={user_id}")
    db.insert_new_video(video_id, channel_id, video_title, video_url, language=user_language)
    db.enqueue_video(video_id, video_url, video_title, channel_id, language=user_language, tts_voice=user_tts_voice)
    sb.table("deliveries").upsert({
        "user_id": user_id,
        "video_id": video_id,
        "status": "pending",
        "source": "on_demand",
        "language": user_language,
    }, on_conflict="user_id,video_id").execute()
    logger.info(f"[{video_id}] On-demand queued — delivery will be sent when processing completes")


# ── Handler: subscribe to channel from Telegram ──────────────

async def handle_channel_subscribe(update: Update, profile: dict, text: str) -> None:
    """Handle a YouTube channel URL or @handle — check subscription then propose."""
    resolved = await _resolve_channel(text)
    if not resolved:
        await update.message.reply_text(
            "Could not find this YouTube channel.\n"
            "Try sending a channel URL (youtube.com/@handle) or @handle."
        )
        return

    channel_id = resolved["channel_id"]
    channel_name = resolved["channel_name"]

    already = await asyncio.to_thread(
        db.is_subscribed_to_channel, profile["id"], channel_id
    )

    if already:
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("❌ Unsubscribe", callback_data=f"unsubch_{channel_id}"),
        ]])
        await update.message.reply_text(
            f"You're already subscribed to <b>{_html.escape(channel_name)}</b>.",
            parse_mode="HTML",
            reply_markup=keyboard,
        )
    else:
        # Encode channel_name in callback_data (truncated to fit 64-byte limit).
        # Format: subch_{channel_id}!{channel_name_truncated}
        max_name = 63 - len("subch_") - len(channel_id) - 1  # 1 for "!"
        name_safe = channel_name[:max(max_name, 0)]
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("➕ Subscribe", callback_data=f"subch_{channel_id}!{name_safe}"),
        ]])
        await update.message.reply_text(
            f"<b>{_html.escape(channel_name)}</b>\n\n"
            "Subscribe to receive audio summaries when new videos are published?",
            parse_mode="HTML",
            reply_markup=keyboard,
        )


# ── Message router ────────────────────────────────────────────

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route text messages: video URLs → summary, channel URLs/@handles → subscribe."""
    if not update.message or not update.message.text:
        return

    chat_id = str(update.effective_chat.id)
    text = update.message.text.strip()
    logger.info(f"Message from chat_id={chat_id}: {text[:100]!r}")

    # Check if user is connected
    profile = await asyncio.to_thread(_get_profile_by_chat_id, chat_id)
    if not profile:
        logger.warning(f"Message from unconnected chat_id={chat_id}")
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
        logger.info(f"Video request: video_id={video_id} from user={profile['id']}")
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


async def handle_options_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the Options menu (⚙️ button on each delivered summary)."""
    query = update.callback_query
    logger.info(f"Options menu: data={query.data!r} from user={query.from_user.id}")
    try:
        await query.answer()
    except Exception:
        pass

    # callback_data: "options_{video_id}_{language}" — video IDs can contain underscores,
    # so we split at the LAST underscore to isolate the language code.
    _, _, rest = query.data.partition("_")  # strip "options_" prefix
    video_id, _, language = rest.rpartition("_")
    if not video_id or not language:
        return

    # Fetch profile and channel info in parallel
    try:
        profile, channel_info = await asyncio.wait_for(
            asyncio.gather(
                asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
                asyncio.to_thread(db.get_video_channel, video_id),
            ),
            timeout=15.0,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching profile/channel for options menu (video={video_id})")
        return

    # Fallback for on-demand videos (channel_id="" in DB) — scrape YouTube
    if not channel_info:
        channel_info = await _get_channel_for_video(video_id)

    # Determine which sub/unsub button to show (only one, based on current status)
    sub_row: list[InlineKeyboardButton] = []
    if channel_info and profile:
        is_subscribed = await asyncio.to_thread(
            db.is_subscribed_to_channel, profile["id"], channel_info["channel_id"]
        )
        if is_subscribed:
            sub_row = [InlineKeyboardButton("❌ Unsubscribe", callback_data=f"unsub_{video_id}_{language}")]
        else:
            sub_row = [InlineKeyboardButton("➕ Subscribe", callback_data=f"sub_{video_id}_{language}")]

    rows = [
        [InlineKeyboardButton("📄 Summary", callback_data=f"summary_{video_id}_{language}")],
        [InlineKeyboardButton("🌐 Language", callback_data=f"lang_{video_id}_{language}")],
        [InlineKeyboardButton("🔗 Share", callback_data=f"share_{video_id}_{language}")],
    ]
    if sub_row:
        rows.append(sub_row)

    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_summary_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send the full text summary for a delivered video."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, _, rest = query.data.partition("_")  # strip "summary_"
    video_id, _, language = rest.rpartition("_")
    if not video_id or not language:
        return

    pv = await asyncio.to_thread(db.get_processed_video, video_id, language)
    if not pv or not pv.get("summary"):
        try:
            await query.message.reply_text("Summary not available for this video.")
        except Exception:
            pass
        return

    summary = pv["summary"]
    # Telegram messages are capped at 4096 chars — split if needed
    MAX = 4096
    chunks = [summary[i : i + MAX] for i in range(0, len(summary), MAX)]
    for chunk in chunks:
        try:
            await query.message.reply_text(chunk)
        except Exception:
            pass


async def handle_share_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Generate and send a share link for this summary."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, _, rest = query.data.partition("_")  # strip "share_"
    video_id, _, language = rest.rpartition("_")
    if not video_id or not language:
        return

    # Fetch profile and video metadata in parallel — independent queries
    try:
        profile, pv = await asyncio.wait_for(
            asyncio.gather(
                asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
                asyncio.to_thread(db.get_processed_video, video_id, language),
            ),
            timeout=15.0,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching profile/video for share (video={video_id})")
        return
    if not profile:
        await query.message.reply_text("Connect your BriefTube account first (/start).")
        return

    is_pro = _is_pro(profile)
    video_title = pv.get("video_title", "this summary") if pv else "this summary"

    share = await asyncio.to_thread(
        db.get_or_create_share, video_id, language, profile["id"], is_pro, video_title
    )
    if share is None:
        return

    url = f"{APP_URL}/s/{share['short_id']}"
    share_keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("↗ Open link", url=url),
         InlineKeyboardButton("📋 Copy link", copy_text=CopyTextButton(text=url))],
        [InlineKeyboardButton("← Back", callback_data=f"options_{video_id}_{language}")],
    ])
    try:
        await query.message.edit_reply_markup(reply_markup=share_keyboard)
    except Exception:
        pass


async def handle_share_lang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show all supported languages for the share link (available ones marked with ✓)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, _, rest = query.data.partition("_")  # strip "shareLang_"
    video_id, _, current_lang = rest.rpartition("_")
    if not video_id:
        return

    available_set = set(await asyncio.to_thread(db.get_available_languages_for_video, video_id))

    buttons = [
        [InlineKeyboardButton(
            f"✓ {label}" if lang == current_lang
            else f"{label} *" if lang in available_set
            else label,
            callback_data=f"shareSetLang_{video_id}_{lang}",
        )]
        for lang, label in _LANG_LABELS.items()
    ]
    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(buttons))
    except Exception:
        pass


async def handle_share_set_lang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Switch share link language — if already processed: show link; if not: queue generation."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, _, rest = query.data.partition("_")  # strip "shareSetLang_"
    video_id, _, new_lang = rest.rpartition("_")
    if not video_id or not new_lang:
        return

    # Fetch profile and processed video in parallel — independent reads
    try:
        profile, pv = await asyncio.wait_for(
            asyncio.gather(
                asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
                asyncio.to_thread(db.get_processed_video, video_id, new_lang),
            ),
            timeout=15.0,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching profile/video for shareSetLang (video={video_id})")
        return
    if not profile:
        await query.message.reply_text("Connect your BriefTube account first (/start).")
        return

    lang_label = _LANG_LABELS.get(new_lang, new_lang.upper())
    is_pro = _is_pro(profile)

    # ── Case 1: already processed in this language ─────────────────
    if pv and pv.get("audio_url"):
        video_title = pv.get("video_title", "this summary")
        share = await asyncio.to_thread(
            db.get_or_create_share, video_id, new_lang, profile["id"], is_pro, video_title
        )
        if share is None:
            return

        # Also queue delivery so the user receives the audio
        await asyncio.to_thread(
            lambda: _upsert_delivery(db.get_client(), profile["id"], video_id, new_lang)
        )

        url = f"{APP_URL}/s/{share['short_id']}"
        try:
            await query.message.edit_text(
                f"<code>{url}</code>",
                parse_mode="HTML",
                reply_markup=_share_keyboard(url),
            )
        except Exception:
            pass
        return

    # ── Case 2: not yet processed — queue generation ────────────────
    base = await asyncio.to_thread(db.get_any_processed_video, video_id)
    if not base:
        try:
            await query.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        return

    video_title = base.get("video_title", video_id)
    channel_id = base.get("channel_id", "")
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    tts_voice = profile.get("tts_voice")

    def _queue_new_lang() -> bool:
        db.insert_new_video(video_id, channel_id, video_title, youtube_url, language=new_lang)
        queued = db.enqueue_video_for_language(
            video_id, youtube_url, video_title, channel_id, new_lang, tts_voice=tts_voice
        )
        _upsert_delivery(db.get_client(), profile["id"], video_id, new_lang)
        return queued

    queued = await asyncio.to_thread(_queue_new_lang)

    status_text = (
        f"Generating in {lang_label}... You'll receive it shortly and can share it then."
        if queued else
        f"Already being processed. You'll receive {lang_label} shortly."
    )
    try:
        await query.message.edit_text(status_text, reply_markup=None)
    except Exception:
        pass


async def handle_lang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Inline language picker — edits the current keyboard in place.

    Favorites (⭐) appear first; ✓ means the summary is already generated in that language.
    Picking a language queues delivery (or generation) without changing the global preference.
    """
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, _, rest = query.data.partition("_")  # strip "lang_"
    video_id, _, current_lang = rest.rpartition("_")
    if not video_id:
        return

    profile, available = await asyncio.gather(
        asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
        asyncio.to_thread(db.get_available_languages_for_video, video_id),
    )

    favorites: list[str] = (profile or {}).get("favorite_languages") or []
    available_set = set(available)

    fav_langs = [lang for lang in favorites if lang in _LANG_LABELS and lang != current_lang]
    # Already generated but not in favorites
    extra_available = [lang for lang in available_set if lang in _LANG_LABELS and lang != current_lang and lang not in fav_langs]

    def _btn(lang: str, show_star: bool = False) -> InlineKeyboardButton:
        label = _LANG_LABELS[lang]
        prefix = "⭐ " if show_star else ""
        suffix = " ✓" if lang in available_set else ""
        return InlineKeyboardButton(f"{prefix}{label}{suffix}", callback_data=f"setlang_{video_id}_{lang}")

    rows: list[list[InlineKeyboardButton]] = (
        [[_btn(lang, show_star=True)] for lang in fav_langs]
        + [[_btn(lang)] for lang in extra_available]
        + [[InlineKeyboardButton("Other languages ▼", callback_data=f"alllang_{video_id}_{current_lang}")]]
        + [[InlineKeyboardButton("⭐ Manage favorites", url=f"{APP_URL}/dashboard/profile")]]
        + [[InlineKeyboardButton("← Back", callback_data=f"options_{video_id}_{current_lang}")]]
    )

    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_alllang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show all available languages (expanded view)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    _, video_id, current_lang = query.data.split("_", 2)

    profile, available = await asyncio.gather(
        asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
        asyncio.to_thread(db.get_available_languages_for_video, video_id),
    )

    favorites: list[str] = (profile or {}).get("favorite_languages") or []
    available_set = set(available)

    def _btn(lang: str) -> InlineKeyboardButton:
        label = _LANG_LABELS[lang]
        prefix = "⭐ " if lang in favorites else ""
        suffix = " ✓" if lang in available_set else ""
        return InlineKeyboardButton(f"{prefix}{label}{suffix}", callback_data=f"setlang_{video_id}_{lang}")

    all_langs = [lang for lang in _LANG_LABELS if lang != current_lang]
    rows: list[list[InlineKeyboardButton]] = (
        [[_btn(lang)] for lang in all_langs]
        + [[InlineKeyboardButton("← Back", callback_data=f"lang_{video_id}_{current_lang}")]]
    )

    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_setlang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Queue delivery in a different language. Shows appropriate confirmation then restores Options."""
    query = update.callback_query

    _, _, rest = query.data.partition("_")  # strip "setlang_"
    video_id, _, new_lang = rest.rpartition("_")
    if not video_id or not new_lang:
        try:
            await query.answer()
        except Exception:
            pass
        return

    label = _LANG_LABELS.get(new_lang, new_lang)

    # Check if already generated to show the right confirmation
    profile, available = await asyncio.gather(
        asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
        asyncio.to_thread(db.get_available_languages_for_video, video_id),
    )

    already_done = new_lang in available
    if already_done:
        alert_text = f"✓ {label} — sending your summary now!"
    else:
        alert_text = f"⏳ Generating summary in {label}…\n\nYou'll receive it as a new message when ready."

    try:
        await query.answer(alert_text, show_alert=True)
    except Exception:
        pass

    if not profile:
        return

    def _queue_lang_delivery() -> None:
        sb = db.get_client()
        sb.table("deliveries").upsert({
            "user_id": profile["id"],
            "video_id": video_id,
            "status": "pending",
            "source": "on_demand",
            "language": new_lang,
        }, on_conflict="user_id,video_id").execute()

    await asyncio.to_thread(_queue_lang_delivery)

    # Restore Options keyboard (language updated so all callbacks stay coherent)
    rows = [
        [InlineKeyboardButton("📄 Summary", callback_data=f"summary_{video_id}_{new_lang}")],
        [InlineKeyboardButton("🌐 Language", callback_data=f"lang_{video_id}_{new_lang}")],
        [InlineKeyboardButton("🔗 Share", callback_data=f"share_{video_id}_{new_lang}")],
    ]
    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_sub_channel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Subscribe to the channel of a video (from Options menu)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    # sub_{video_id}_{language}
    rest = query.data[4:]  # strip "sub_"
    video_id, _, language = rest.rpartition("_")

    profile = await asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id))
    if not profile:
        try:
            await query.answer("Connect your BriefTube account first (/start).", show_alert=True)
        except Exception:
            pass
        return

    channel_info = await asyncio.to_thread(db.get_video_channel, video_id)
    if not channel_info:
        channel_info = await _get_channel_for_video(video_id)
    if not channel_info:
        try:
            await query.answer("Could not find the channel for this video.", show_alert=True)
        except Exception:
            pass
        return

    channel_id = channel_info["channel_id"]
    channel_name = channel_info["channel_name"]

    is_pro = _is_pro(profile)
    if not is_pro:
        count = await asyncio.to_thread(db.get_subscription_count, profile["id"])
        max_ch = profile.get("max_channels", 5)
        if count >= max_ch:
            try:
                await query.answer(
                    f"You've reached your limit of {max_ch} channels. Upgrade to Pro for unlimited.",
                    show_alert=True,
                )
            except Exception:
                pass
            return

    avatar_url = await _get_channel_avatar(channel_id)
    newly = await asyncio.to_thread(
        db.subscribe_to_channel, profile["id"], channel_id, channel_name, avatar_url
    )
    if newly:
        try:
            await asyncio.to_thread(db.mark_existing_videos_as_skipped, channel_id)
        except Exception:
            pass
        logger.info(f"Options subscribe: user={profile['id']}, channel={channel_name} ({channel_id})")

    try:
        await query.answer(
            f"✓ Subscribed to {channel_name}!" if newly else f"Already subscribed to {channel_name}.",
            show_alert=False,
        )
    except Exception:
        pass

    # Swap Subscribe → Unsubscribe inline
    rows = [
        [InlineKeyboardButton("📄 Summary", callback_data=f"summary_{video_id}_{language}")],
        [InlineKeyboardButton("🌐 Language", callback_data=f"lang_{video_id}_{language}")],
        [InlineKeyboardButton("🔗 Share", callback_data=f"share_{video_id}_{language}")],
        [InlineKeyboardButton("❌ Unsubscribe", callback_data=f"unsub_{video_id}_{language}")],
    ]
    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_unsub_channel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show inline confirmation before unsubscribing (edits the Options keyboard in place)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    # unsub_{video_id}_{language}
    rest = query.data[6:]  # strip "unsub_"
    video_id, _, language = rest.rpartition("_")

    channel_info = await asyncio.to_thread(db.get_video_channel, video_id)
    if not channel_info:
        channel_info = await _get_channel_for_video(video_id)
    if not channel_info:
        try:
            await query.answer("Could not find the channel for this video.", show_alert=True)
        except Exception:
            pass
        return

    channel_id = channel_info["channel_id"]
    channel_name = channel_info["channel_name"]

    # Edit keyboard in place to show confirmation
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"✓ Yes, unsubscribe from {channel_name}",
            callback_data=f"confirmUnsub_{channel_id}_{video_id}_{language}",
        )],
        [InlineKeyboardButton("← Cancel", callback_data=f"options_{video_id}_{language}")],
    ])
    try:
        await query.message.edit_reply_markup(reply_markup=keyboard)
    except Exception:
        pass


async def handle_confirm_unsub_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Actually unsubscribe after confirmation, then restore Options keyboard."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    # confirmUnsub_{channel_id}_{video_id}_{language}
    rest = query.data[len("confirmUnsub_"):]
    # channel_id can contain underscores (UCxxx) but video_id is 11 chars + language is 2 chars
    # Split from the right to get video_id and language reliably
    parts = rest.rsplit("_", 2)
    if len(parts) != 3:
        return
    channel_id, video_id, language = parts

    try:
        profile, channel_name = await asyncio.wait_for(
            asyncio.gather(
                asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id)),
                asyncio.to_thread(_get_channel_name_from_subscription, channel_id),
            ),
            timeout=15.0,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout fetching profile/channel for confirmUnsub (channel={channel_id})")
        return
    if not profile:
        return

    deactivated = await asyncio.to_thread(db.unsubscribe_channel, profile["id"], channel_id)
    if deactivated:
        logger.info(f"Options unsubscribe confirmed: user={profile['id']}, channel={channel_name} ({channel_id})")

    try:
        await query.answer(
            f"Unsubscribed from {channel_name}." if deactivated else f"Not subscribed to {channel_name}.",
            show_alert=False,
        )
    except Exception:
        pass

    # Restore Options keyboard with Subscribe button
    rows = [
        [InlineKeyboardButton("📄 Summary", callback_data=f"summary_{video_id}_{language}")],
        [InlineKeyboardButton("🌐 Language", callback_data=f"lang_{video_id}_{language}")],
        [InlineKeyboardButton("🔗 Share", callback_data=f"share_{video_id}_{language}")],
        [InlineKeyboardButton("➕ Subscribe", callback_data=f"sub_{video_id}_{language}")],
    ]
    try:
        await query.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(rows))
    except Exception:
        pass


async def handle_subch_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Confirm subscription to a channel (from channel link flow)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    # Format: subch_{channel_id}!{channel_name_truncated}
    rest = query.data[6:]  # strip "subch_"
    channel_id, _, channel_name = rest.partition("!")
    if not channel_name:
        channel_name = channel_id

    profile = await asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id))
    if not profile:
        await query.message.reply_text("Connect your BriefTube account first (/start).")
        return

    is_pro = _is_pro(profile)
    if not is_pro:
        count = await asyncio.to_thread(db.get_subscription_count, profile["id"])
        max_ch = profile.get("max_channels", 5)
        if count >= max_ch:
            await query.message.reply_text(
                f"You've reached your limit of {max_ch} channels.\n\n"
                f"Upgrade to Pro for unlimited channels: {APP_URL}/dashboard/profile"
            )
            return

    avatar_url = await _get_channel_avatar(channel_id)
    newly = await asyncio.to_thread(
        db.subscribe_to_channel, profile["id"], channel_id, channel_name, avatar_url
    )
    if newly:
        try:
            await asyncio.to_thread(db.mark_existing_videos_as_skipped, channel_id)
        except Exception:
            pass
        await query.message.reply_text(
            f"Subscribed to {channel_name}!\n\n"
            "You'll receive audio summaries when new videos are published."
        )
        logger.info(f"Channel link subscribe: user={profile['id']}, channel={channel_name} ({channel_id})")
    else:
        await query.message.reply_text(f"You're already subscribed to {channel_name}.")


async def handle_unsubch_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Confirm unsubscription from a channel (from channel link flow)."""
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass

    channel_id = query.data[8:]  # strip "unsubch_"

    profile = await asyncio.to_thread(db.get_profile_by_telegram, str(query.from_user.id))
    if not profile:
        await query.message.reply_text("Connect your BriefTube account first (/start).")
        return

    def _get_channel_name() -> str:
        sb = db.get_client()
        name_res = (
            sb.table("subscriptions")
            .select("channel_name")
            .eq("channel_id", channel_id)
            .eq("user_id", profile["id"])
            .limit(1)
            .execute()
        )
        return name_res.data[0]["channel_name"] if name_res.data else channel_id

    channel_name = await asyncio.to_thread(_get_channel_name)

    deactivated = await asyncio.to_thread(
        db.unsubscribe_channel, profile["id"], channel_id
    )
    if deactivated:
        await query.message.reply_text(f"Unsubscribed from {channel_name}.")
        logger.info(f"Channel link unsubscribe: user={profile['id']}, channel={channel_name} ({channel_id})")
    else:
        await query.message.reply_text(f"You're not subscribed to {channel_name}.")


async def _error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Suppress Conflict errors (another bot instance polling); log everything else."""
    if isinstance(context.error, Conflict):
        logger.debug("Bot polling conflict — another instance may be running (deliveries unaffected)")
        return
    tb = "".join(traceback.format_exception(type(context.error), context.error, context.error.__traceback__))
    logger.error(f"Bot error: {context.error}\n{tb}")


_BOT_COMMANDS = [
    BotCommand("start", "Connect your account"),
    BotCommand("status", "Check connection status"),
    BotCommand("help", "Show all commands"),
]


async def setup_bot_commands(app: Application) -> None:
    """Register the slash-command menu shown at the left of the Telegram input bar."""
    try:
        await app.bot.set_my_commands(_BOT_COMMANDS)
        logger.info("Bot command menu registered")
    except Exception as e:
        logger.warning(f"Could not set bot commands: {e}")


def create_bot_application() -> Application:
    """Create the Telegram bot application with command handlers."""
    # .updater(None) prevents PTB from creating an Updater, which would
    # auto-start its own getUpdates polling and conflict with our custom loop.
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).updater(None).build()

    app.add_error_handler(_error_handler)

    # User commands
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("status", status_command))

    # Admin monitoring commands
    app.add_handler(CommandHandler("monitor_status", monitor_status_command))
    app.add_handler(CommandHandler("monitor_stats", monitor_stats_command))
    app.add_handler(CommandHandler("monitor_logs", monitor_logs_command))
    app.add_handler(CommandHandler("log_toggle", log_toggle_command))

    # Inline keyboard callbacks — options menu and sub-actions
    app.add_handler(CallbackQueryHandler(handle_options_callback, pattern=r"^options_"))
    app.add_handler(CallbackQueryHandler(handle_summary_callback, pattern=r"^summary_"))
    app.add_handler(CallbackQueryHandler(handle_share_set_lang_callback, pattern=r"^shareSetLang_"))
    app.add_handler(CallbackQueryHandler(handle_share_lang_callback, pattern=r"^shareLang_"))
    app.add_handler(CallbackQueryHandler(handle_share_callback, pattern=r"^share_"))
    app.add_handler(CallbackQueryHandler(handle_lang_callback, pattern=r"^lang_"))
    app.add_handler(CallbackQueryHandler(handle_alllang_callback, pattern=r"^alllang_"))
    app.add_handler(CallbackQueryHandler(handle_setlang_callback, pattern=r"^setlang_"))
    app.add_handler(CallbackQueryHandler(handle_sub_channel_callback, pattern=r"^sub_"))
    app.add_handler(CallbackQueryHandler(handle_confirm_unsub_callback, pattern=r"^confirmUnsub_"))
    app.add_handler(CallbackQueryHandler(handle_unsub_channel_callback, pattern=r"^unsub_"))
    app.add_handler(CallbackQueryHandler(handle_subch_callback, pattern=r"^subch_"))
    app.add_handler(CallbackQueryHandler(handle_unsubch_callback, pattern=r"^unsubch_"))

    # Message handler LAST — catches non-command text messages
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app
