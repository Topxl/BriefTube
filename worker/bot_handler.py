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

from config import TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_CHAT_ID, APP_URL, LOG_BOT_TOKEN, LOG_BOT_ADMIN_CHAT_ID, FREE_CHANNELS_LIMIT
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
        # Log mode: "off" (no alerts/mirrors), "errors" (only ERROR/CRITICAL), "all" (everything)
        # Default is "errors" so failure/timeout alerts always reach the admin without manual activation.
        # Use /log_mode all to also mirror all deliveries, or /log_mode off to silence everything.
        self._log_mode: str = "errors"

    async def send_alert(self, message: str, level: str = "INFO"):
        """Queue an alert to be sent to admin via the log bot."""
        if not self._log_chat_id or not self._log_bot:
            return
        if self._log_mode == "off":
            return
        if self._log_mode == "errors" and level not in ("ERROR", "CRITICAL"):
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
        audio_path: Path | None,
    ) -> None:
        """Send a copy of a delivery to the admin log bot — once per video per session.

        Lets the admin see every video sent to users (title, YouTube link, audio)
        without receiving N duplicates when multiple subscribers get the same video.
        """
        if self._log_mode != "all":
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
            if audio_path and audio_path.exists():
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


async def send_kpi_report(alert_system: MonitoringAlert, period: str = "daily"):
    """Send a comprehensive KPI report to admin via the log bot (always sent, regardless of log_mode).

    Args:
        period: "morning", "evening", or "on-demand".
    """
    if not alert_system._log_bot or not alert_system._log_chat_id:
        return

    supabase = db.get_client()
    labels = {"morning": "Morning", "evening": "Evening", "on-demand": "On-Demand"}
    now_label = labels.get(period, "Daily")

    try:
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(hours=24)).isoformat()
        two_days_ago = (now - timedelta(hours=48)).isoformat()
        week_ago = (now - timedelta(days=7)).isoformat()
        two_weeks_ago = (now - timedelta(days=14)).isoformat()
        month_ago = (now - timedelta(days=30)).isoformat()

        # ── Users ────────────────────────────────────────────────
        total_users = supabase.table("profiles").select("id", count="exact").execute()
        pro_users = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "active").execute()
        free_users = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "free").execute()
        trial_users = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "free").gt("trial_ends_at", now.isoformat()).execute()
        churned = supabase.table("profiles").select("id", count="exact").in_("subscription_status", ["cancelled", "past_due"]).execute()
        signups_24h = supabase.table("profiles").select("id", count="exact").gte("created_at", day_ago).execute()
        signups_prev_24h = supabase.table("profiles").select("id", count="exact").gte("created_at", two_days_ago).lt("created_at", day_ago).execute()
        signups_7d = supabase.table("profiles").select("id", count="exact").gte("created_at", week_ago).execute()
        onboarded = supabase.table("profiles").select("id", count="exact").eq("onboarding_completed", True).execute()
        total_referrals = supabase.table("profiles").select("id", count="exact").not_.is_("referred_by", "null").execute()

        # ── Activation: users with at least 1 channel ────────────
        users_with_channels = supabase.rpc("get_feed_deliveries", {"p_user_id": "00000000-0000-0000-0000-000000000000", "p_limit": 0, "p_offset": 0}).execute()
        # Simpler: distinct user_ids in subscriptions
        sub_users_rows = supabase.table("subscriptions").select("user_id").execute()
        activated_user_ids = set(r["user_id"] for r in (sub_users_rows.data or []))
        n_activated = len(activated_user_ids)

        # Avg channels per user (among those who have channels)
        total_subs = supabase.table("subscriptions").select("id", count="exact").execute()
        avg_channels = ((total_subs.count or 0) / n_activated) if n_activated > 0 else 0

        # ── Platforms ────────────────────────────────────────────
        telegram_c = supabase.table("platform_connections").select("id", count="exact").eq("platform", "telegram").eq("connected", True).execute()
        discord_c = supabase.table("platform_connections").select("id", count="exact").eq("platform", "discord").eq("connected", True).execute()
        slack_c = supabase.table("platform_connections").select("id", count="exact").eq("platform", "slack").eq("connected", True).execute()
        active_channels = supabase.table("subscriptions").select("id", count="exact").eq("active", True).execute()
        paused_system = supabase.table("subscriptions").select("id", count="exact").eq("paused_by_system", True).execute()

        # ── Videos (24h + yesterday for delta) ───────────────────
        vc_q = supabase.table("processed_videos").select("id", count="exact").eq("status", "completed").gte("created_at", day_ago).execute()
        vf_q = supabase.table("processed_videos").select("id", count="exact").eq("status", "failed").gte("created_at", day_ago).execute()
        vp_q = supabase.table("processed_videos").select("id", count="exact").in_("status", ["pending", "processing"]).execute()
        vc_prev = supabase.table("processed_videos").select("id", count="exact").eq("status", "completed").gte("created_at", two_days_ago).lt("created_at", day_ago).execute()

        # ── Deliveries (24h + yesterday) by platform ─────────────
        del_total = supabase.table("deliveries").select("id", count="exact").gte("created_at", day_ago).execute()
        del_prev = supabase.table("deliveries").select("id", count="exact").gte("created_at", two_days_ago).lt("created_at", day_ago).execute()
        del_telegram = supabase.table("deliveries").select("id", count="exact").eq("platform", "telegram").gte("created_at", day_ago).execute()
        del_discord = supabase.table("deliveries").select("id", count="exact").eq("platform", "discord").gte("created_at", day_ago).execute()
        del_slack = supabase.table("deliveries").select("id", count="exact").eq("platform", "slack").gte("created_at", day_ago).execute()

        # ── Emails (24h + open rate 30d) ─────────────────────────
        emails_24h = supabase.table("email_logs").select("id", count="exact").gte("sent_at", day_ago).execute()
        emails_30d_total = supabase.table("email_logs").select("id", count="exact").gte("sent_at", month_ago).execute()
        emails_30d_opened = supabase.table("email_logs").select("id", count="exact").gte("sent_at", month_ago).not_.is_("opened_at", "null").execute()

        # ── Engagement: active users 7d + 14d ────────────────────
        active_7d_rows = supabase.table("deliveries").select("user_id").gte("created_at", week_ago).execute()
        active_7d_ids = set(r["user_id"] for r in (active_7d_rows.data or []))
        active_14d_rows = supabase.table("deliveries").select("user_id").gte("created_at", two_weeks_ago).lt("created_at", week_ago).execute()
        active_prev_7d_ids = set(r["user_id"] for r in (active_14d_rows.data or []))
        # Retention = users active in both weeks / users active previous week
        retained = active_7d_ids & active_prev_7d_ids
        retention_rate = (len(retained) / len(active_prev_7d_ids) * 100) if active_prev_7d_ids else 0

        # ── Trials expiring soon (7d) ────────────────────────────
        expiring_soon = (now + timedelta(days=7)).isoformat()
        expiring_trials = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "free").gt("trial_ends_at", now.isoformat()).lt("trial_ends_at", expiring_soon).execute()

        # ── Infrastructure costs (from worker_stats) ─────────────
        today_str = now.date().isoformat()
        yesterday_str = (now - timedelta(days=1)).date().isoformat()
        ws_today = supabase.table("worker_stats").select("groq_cost, groq_seconds").eq("date", today_str).maybe_single().execute()
        ws_yesterday = supabase.table("worker_stats").select("groq_cost, groq_seconds").eq("date", yesterday_str).maybe_single().execute()

        # ── Worker stats ─────────────────────────────────────────
        summary = stats.get_summary()
        system = get_system_info()

        # ── Build numbers ────────────────────────────────────────
        n_total = total_users.count or 0
        n_pro = pro_users.count or 0
        n_trial = trial_users.count or 0
        n_free = max(0, (free_users.count or 0) - n_trial)
        n_churned = churned.count or 0
        n_onboarded = onboarded.count or 0
        onboard_rate = (n_onboarded / n_total * 100) if n_total > 0 else 0
        activation_rate = (n_activated / n_total * 100) if n_total > 0 else 0
        conv_rate = (n_pro / (n_pro + n_churned) * 100) if (n_pro + n_churned) > 0 else 0

        vc = vc_q.count or 0
        vf = vf_q.count or 0
        v_rate = (vc / (vc + vf) * 100) if (vc + vf) > 0 else 0
        vc_y = vc_prev.count or 0

        dt = del_total.count or 0
        dt_y = del_prev.count or 0
        dtg = del_telegram.count or 0
        ddc = del_discord.count or 0
        dsl = del_slack.count or 0
        d_web = max(0, dt - dtg - ddc - dsl)

        su_24 = signups_24h.count or 0
        su_y = signups_prev_24h.count or 0

        email_open_rate = ((emails_30d_opened.count or 0) / (emails_30d_total.count or 1) * 100)

        groq_cost_today = ws_today.data.get("groq_cost", 0) if ws_today.data else 0
        groq_cost_yesterday = ws_yesterday.data.get("groq_cost", 0) if ws_yesterday.data else 0
        groq_sec_today = ws_today.data.get("groq_seconds", 0) if ws_today.data else 0

        # ── Delta helper ─────────────────────────────────────────
        def delta(current: int, previous: int) -> str:
            diff = current - previous
            if diff == 0:
                return ""
            arrow = "↑" if diff > 0 else "↓"
            return f" {arrow}{abs(diff)}"

        # ── Message 1: Users + Funnel + Engagement ───────────────
        msg1 = (
            f"📊 <b>{now_label} KPI Report</b>\n"
            f"<i>{now.strftime('%A %d %B %Y, %H:%M UTC')}</i>\n\n"

            f"👥 <b>Users ({n_total})</b>\n"
            f"  Pro: <b>{n_pro}</b> · Trial: {n_trial} · Free: {n_free}\n"
            f"  Churned: {n_churned} · Conv: <b>{conv_rate:.0f}%</b>\n"
            f"  Signups: <b>{su_24}</b>{delta(su_24, su_y)} (24h) · {signups_7d.count or 0} (7d)\n\n"

            f"🔑 <b>Activation Funnel</b>\n"
            f"  Onboarded: {onboard_rate:.0f}% · Added channels: <b>{activation_rate:.0f}%</b>\n"
            f"  Users with channels: {n_activated}/{n_total}\n"
            f"  Avg channels/user: {avg_channels:.0f}\n"
            f"  Trials expiring &lt;7d: {expiring_trials.count or 0}\n\n"

            f"📈 <b>Engagement</b>\n"
            f"  Active (7d): <b>{len(active_7d_ids)}</b>\n"
            f"  Retention (w/w): <b>{retention_rate:.0f}%</b> ({len(retained)}/{len(active_prev_7d_ids)})\n"
            f"  Referrals: {total_referrals.count or 0}\n\n"

            f"📡 <b>Platforms</b>\n"
            f"  TG: {telegram_c.count or 0} · DC: {discord_c.count or 0} · Slack: {slack_c.count or 0}\n"
            f"  Channels: {active_channels.count or 0} active · {paused_system.count or 0} paused"
        )

        # ── Message 2: Operations + Costs + System ───────────────
        msg2 = (
            f"🎬 <b>Videos (24h)</b>\n"
            f"  Done: <b>{vc}</b>{delta(vc, vc_y)} · Failed: {vf} · Queue: {vp_q.count or 0}\n"
            f"  Success: <b>{v_rate:.0f}%</b> · Avg: {summary['avg_processing_time']}s\n\n"

            f"📬 <b>Deliveries (24h): {dt}</b>{delta(dt, dt_y)}\n"
            f"  TG: {dtg} · DC: {ddc} · Slack: {dsl} · Web: {d_web}\n\n"

            f"✉️ <b>Emails</b>\n"
            f"  Sent (24h): {emails_24h.count or 0}\n"
            f"  Open rate (30d): <b>{email_open_rate:.0f}%</b> ({emails_30d_opened.count or 0}/{emails_30d_total.count or 0})\n\n"

            f"💰 <b>Infrastructure Costs</b>\n"
            f"  Groq today: <b>${groq_cost_today:.2f}</b>{delta(int(groq_cost_today*100), int(groq_cost_yesterday*100)).replace('↑', '↑$0.').replace('↓', '↓$0.') if groq_cost_today != groq_cost_yesterday else ''}\n"
            f"  Groq audio: {groq_sec_today:.0f}s / 28800s quota\n\n"

            f"💻 <b>System</b>\n"
            f"  CPU: {system.get('cpu_percent', '?')}% · RAM: {system.get('memory_percent', '?')}%\n"
            f"  Uptime: {summary['uptime']} · Errors: {len(summary['recent_errors'])}"
        )

        # ── Message 3: Health & Anomalies + UX + Conversion ────────
        try:
            # Health checks
            cutoff_15m = (now - timedelta(minutes=15)).isoformat()
            cutoff_30m = (now - timedelta(minutes=30)).isoformat()
            hour_ago = (now - timedelta(hours=1)).isoformat()

            stuck_deliveries = supabase.table("deliveries").select("id", count="exact").eq("status", "sending").lt("created_at", cutoff_15m).execute()
            n_stuck_del = stuck_deliveries.count or 0

            failed_1h = supabase.table("processed_videos").select("id", count="exact").eq("status", "failed").gte("created_at", hour_ago).execute()
            n_failed_1h = failed_1h.count or 0

            stuck_processing = supabase.table("processing_queue").select("id", count="exact").eq("status", "processing").lt("created_at", cutoff_30m).execute()
            n_stuck_proc = stuck_processing.count or 0

            auth_ok = "\u2705" if su_24 > 0 else "\u26a0\ufe0f"
            del_stuck_ok = "\u2705" if n_stuck_del == 0 else "\u26a0\ufe0f"
            failed_ok = "\u2705" if n_failed_1h <= 20 else "\u26a0\ufe0f"
            proc_ok = "\u2705" if n_stuck_proc == 0 else "\u26a0\ufe0f"

            # User experience metrics
            users_with_zero_channels = max(0, n_total - n_activated)
            zero_ch_pct = (users_with_zero_channels / n_total * 100) if n_total > 0 else 0

            expired_trial_no_upgrade = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "free").not_.is_("trial_ends_at", "null").lt("trial_ends_at", now.isoformat()).execute()
            n_expired_trial = expired_trial_no_upgrade.count or 0

            disconnected_24h = supabase.table("platform_connections").select("id", count="exact").eq("connected", False).gte("updated_at", day_ago).execute()
            n_disconnected = disconnected_24h.count or 0

            # Conversion snapshot
            # Free = subscription_status='free' AND (trial_ends_at IS NULL OR trial_ends_at < now)
            free_no_trial = supabase.table("profiles").select("id", count="exact").eq("subscription_status", "free").is_("trial_ends_at", "null").execute()
            free_expired_trial_count = n_expired_trial
            total_free = (free_no_trial.count or 0) + free_expired_trial_count
            # n_trial already computed above (active trial users)
            # n_pro already computed above (active paid users)
            # n_churned already computed above

            total_all = total_free + n_trial + n_pro + n_churned
            free_to_trial_pct = (n_trial / (total_free + n_trial) * 100) if (total_free + n_trial) > 0 else 0
            trial_to_paid_pct = (n_pro / (n_pro + n_trial + n_expired_trial) * 100) if (n_pro + n_trial + n_expired_trial) > 0 else 0
            paid_to_churned_pct = (n_churned / (n_pro + n_churned) * 100) if (n_pro + n_churned) > 0 else 0

            # Avg trial duration before upgrade (approximate: avg days from created_at to now for paid users)
            try:
                paid_users_data = supabase.table("profiles").select("created_at, updated_at").eq("subscription_status", "active").execute()
                if paid_users_data.data:
                    durations = []
                    for row in paid_users_data.data:
                        created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                        # Use updated_at as a proxy for when they upgraded
                        upgraded = datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
                        d = (upgraded - created).days
                        if 0 < d < 365:  # filter out unreasonable values
                            durations.append(d)
                    avg_trial_days = sum(durations) / len(durations) if durations else 0
                else:
                    avg_trial_days = 0
            except Exception:
                avg_trial_days = 0

            msg3 = (
                f"\U0001f50d <b>Health &amp; Anomalies</b>\n"
                f"  Auth: {auth_ok} {su_24} signups (24h)\n"
                f"  Deliveries stuck: {del_stuck_ok} {n_stuck_del} stuck &gt;15min\n"
                f"  Failed videos (1h): {failed_ok} {n_failed_1h}\n"
                f"  Processing queue: {proc_ok} {n_stuck_proc} stuck &gt;30min\n\n"

                f"\U0001f4f1 <b>User Experience</b>\n"
                f"  Avg channels/user: {avg_channels:.1f}\n"
                f"  Users with 0 channels: {users_with_zero_channels} ({zero_ch_pct:.0f}% of total)\n"
                f"  Expired trial (no upgrade): {n_expired_trial}\n"
                f"  Disconnected platforms (24h): {n_disconnected}\n\n"

                f"\U0001f3af <b>Conversion Snapshot</b>\n"
                f"  Free\u2192Trial: <b>{free_to_trial_pct:.0f}%</b>\n"
                f"  Trial\u2192Paid: <b>{trial_to_paid_pct:.0f}%</b>\n"
                f"  Paid\u2192Churned: <b>{paid_to_churned_pct:.0f}%</b>\n"
                f"  Avg trial duration before upgrade: {avg_trial_days:.0f} days"
            )
        except Exception as e:
            logger.warning(f"KPI msg3 build failed: {e}")
            msg3 = None

        bot = alert_system._log_bot
        chat = alert_system._log_chat_id
        await bot.send_message(chat_id=chat, text=msg1, parse_mode="HTML")
        await bot.send_message(chat_id=chat, text=msg2, parse_mode="HTML")
        if msg3:
            await bot.send_message(chat_id=chat, text=msg3, parse_mode="HTML")

    except Exception as e:
        logger.error(f"KPI report failed: {e}")
        import traceback as _tb
        logger.error(_tb.format_exc())


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
        f"Free plan: {ON_DEMAND_MONTHLY_LIMIT} on-demand summaries/month, {FREE_CHANNELS_LIMIT} channels\n"
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
    """Check if chat_id is admin (matches either main bot or log bot admin)."""
    cid = str(chat_id)
    return (ADMIN_TELEGRAM_CHAT_ID and cid == str(ADMIN_TELEGRAM_CHAT_ID)) or \
           (LOG_BOT_ADMIN_CHAT_ID and cid == str(LOG_BOT_ADMIN_CHAT_ID))


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


async def log_mode_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Set log mode: /log_mode [off|errors|all] (admin only).

    off    — no alerts, no delivery mirrors (default)
    errors — only ERROR/CRITICAL alerts, no delivery mirrors
    all    — all alerts + delivery mirrors (preview audio)
    """
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return
    alert = context.application.bot_data.get("alert_system")
    if not alert:
        await update.message.reply_text("Alert system not found.")
        return

    args = context.args
    valid_modes = ("off", "errors", "all")

    if not args or args[0] not in valid_modes:
        current = alert._log_mode
        await update.message.reply_text(
            f"Current mode: <b>{current}</b>\n\n"
            f"Usage: /log_mode [off|errors|all]\n"
            f"• <b>off</b> — silent, no alerts\n"
            f"• <b>errors</b> — only errors\n"
            f"• <b>all</b> — all alerts + delivery previews",
            parse_mode="HTML",
        )
        return

    alert._log_mode = args[0]
    await update.message.reply_text(f"Log mode set to <b>{args[0]}</b>", parse_mode="HTML")


async def kpi_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send KPI report on demand (admin only)."""
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return
    alert = context.application.bot_data.get("alert_system")
    if not alert:
        await update.message.reply_text("Alert system not found.")
        return
    await update.message.reply_text("Generating KPI report...")
    await send_kpi_report(alert, period="on-demand")


async def cookies_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show YouTube cookie health status (admin only)."""
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        await update.message.reply_text("⛔ Admin only command")
        return

    from transcript_extractor import validate_cookies, _COOKIES_FILE
    health = validate_cookies()

    icon = "✅" if health["ok"] else ("⚠️" if health["exists"] else "❌")
    lines = [f"{icon} <b>YouTube Cookies</b>", "", health["summary"], ""]

    if health["missing_critical"]:
        lines.append(f"🔴 Missing critical: {', '.join(health['missing_critical'])}")
    if health["missing_important"]:
        lines.append(f"🟡 Missing (optional): {', '.join(health['missing_important'])}")
    if health["expired"]:
        lines.append(f"⏰ Expired: {', '.join(health['expired'])}")

    lines += [
        "",
        f"📁 File: <code>{_COOKIES_FILE}</code>",
        f"🍪 Total cookies: {health['total']}",
        "",
        "To refresh: send a <code>cookies.txt</code> file (Netscape format) to this bot.",
    ]

    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def handle_document_upload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle admin uploading a cookies.txt file to refresh YouTube cookies."""
    chat_id = str(update.effective_chat.id)
    if not _is_admin(chat_id):
        return

    doc = update.message.document
    if not doc:
        return

    filename = doc.file_name or ""
    if not (filename.endswith(".txt") or "cookie" in filename.lower()):
        await update.message.reply_text("⚠️ Please send a .txt cookie file in Netscape format.")
        return

    try:
        file = await context.bot.get_file(doc.file_id)
        from transcript_extractor import _COOKIES_FILE, validate_cookies
        _COOKIES_FILE.parent.mkdir(parents=True, exist_ok=True)

        # Download to a temp path first, validate, then replace
        tmp_path = _COOKIES_FILE.with_suffix(".tmp")
        await file.download_to_drive(str(tmp_path))

        # Validate the new file before replacing
        import shutil
        old_path = _COOKIES_FILE.with_suffix(".bak")
        if _COOKIES_FILE.exists():
            shutil.copy2(str(_COOKIES_FILE), str(old_path))

        shutil.move(str(tmp_path), str(_COOKIES_FILE))

        health = validate_cookies()
        icon = "✅" if health["ok"] else "⚠️"
        await update.message.reply_text(
            f"{icon} <b>Cookies updated</b>\n\n{health['summary']}\n\n"
            + (f"⚠️ Still missing: {', '.join(health['missing_critical'])}" if health["missing_critical"] else ""),
            parse_mode="HTML",
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Failed to save cookies: {e}")


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
        .select("id, email, subscription_status, trial_ends_at, max_channels, preferred_language, tts_voice, favorite_languages, summary_length_pref, summary_style, summary_custom_instructions")
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
    if existing and existing.data:
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
    db.enqueue_video(
        video_id, video_url, video_title, channel_id,
        language=user_language, tts_voice=user_tts_voice,
        summary_length_pref=profile.get("summary_length_pref"),
        summary_style=profile.get("summary_style"),
        summary_custom_instructions=profile.get("summary_custom_instructions"),
    )
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

    # Validate video_id (YouTube video IDs are 11 chars, alphanumeric with - and _)
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        try:
            await query.answer("Invalid request")
        except Exception:
            pass
        return

    # Validate language (2-5 chars, alphanumeric with dash)
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', language):
        logger.warning(f"Invalid language in callback: {language!r}")
        try:
            await query.answer("Invalid request")
        except Exception:
            pass
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', language):
        logger.warning(f"Invalid language in callback: {language!r}")
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', language):
        logger.warning(f"Invalid language in callback: {language!r}")
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', current_lang):
        logger.warning(f"Invalid language in callback: {current_lang!r}")
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', new_lang):
        logger.warning(f"Invalid language in callback: {new_lang!r}")
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', current_lang):
        logger.warning(f"Invalid language in callback: {current_lang!r}")
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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', current_lang):
        logger.warning(f"Invalid language in callback: {current_lang!r}")
        return

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

    # Validate video_id and language
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.warning(f"Invalid video_id in callback: {video_id!r}")
        try:
            await query.answer("Invalid request")
        except Exception:
            pass
        return
    if not re.match(r'^[a-zA-Z]{2}(?:-[a-zA-Z]{2})?$', new_lang):
        logger.warning(f"Invalid language in callback: {new_lang!r}")
        try:
            await query.answer("Invalid request")
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
        max_ch = profile.get("max_channels", FREE_CHANNELS_LIMIT)
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
        max_ch = profile.get("max_channels", FREE_CHANNELS_LIMIT)
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

    # File upload handler for admin to send cookies.txt
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document_upload))

    # Message handler LAST — catches non-command text messages
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app


# ── Log Bot (admin-only) ─────────────────────────────────────────

async def log_bot_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help on the log bot."""
    await update.message.reply_text(
        "BriefTube Log Bot — Admin commands\n\n"
        "/kpi — KPI report\n"
        "/log_mode [off|errors|all] — Log notifications\n"
        "/monitor_status — Worker status\n"
        "/monitor_stats — Processing stats\n"
        "/monitor_logs [N] — Last N log lines\n"
        "/cookies — Cookie status\n"
        "/help — Show this message"
    )


def create_log_bot_application() -> Optional[Application]:
    """Create the log bot application with admin command handlers.

    Returns None if LOG_BOT_TOKEN is not configured.
    """
    if not LOG_BOT_TOKEN:
        return None

    app = Application.builder().token(LOG_BOT_TOKEN).updater(None).build()
    app.add_error_handler(_error_handler)

    app.add_handler(CommandHandler("help", log_bot_help_command))
    app.add_handler(CommandHandler("start", log_bot_help_command))
    app.add_handler(CommandHandler("monitor_status", monitor_status_command))
    app.add_handler(CommandHandler("monitor_stats", monitor_stats_command))
    app.add_handler(CommandHandler("monitor_logs", monitor_logs_command))
    app.add_handler(CommandHandler("log_mode", log_mode_command))
    app.add_handler(CommandHandler("kpi", kpi_command))
    app.add_handler(CommandHandler("cookies", cookies_command))

    return app
