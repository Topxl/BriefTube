#!/usr/bin/env python3
"""
BriefTube SaaS Worker

Three concurrent loops:
1. RSS Scanner   — checks channels for new videos (every 5 min)
2. Gemini Processor — summarizes + generates TTS audio
3. Telegram Deliverer — sends audio to subscribed users
"""

import asyncio
import atexit
import logging
import os
import re
import signal
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

import aiohttp
import psutil

from config import RSS_CHECK_INTERVAL, TELEGRAM_BOT_TOKEN, SUPABASE_URL, ADMIN_TELEGRAM_CHAT_ID, MAX_CONCURRENT_VIDEOS, MAX_CPU_PERCENT, MAX_LOAD_PER_CPU, MIN_FREE_RAM_MB, CPU_CHECK_INTERVAL, HEALTH_PORT, WORKER_INSTANCE, APP_URL, WORKER_API_SECRET, PUSH_NOTIFY_SECRET
from transcript_extractor import TranscriptExtractor, validate_cookies
from gemini_api import GeminiSummarizer
from openrouter_api import OpenRouterSummarizer
from text_cleaner import clean_for_tts
from tts_processor import text_to_audio, cleanup_audio_files
from telegram_deliverer import send_audio_to_user
from notion_deliverer import send_to_notion
from whatsapp_deliverer import send_to_whatsapp
from discord_deliverer import send_to_discord
from slack_deliverer import send_to_slack
from bot_handler import create_bot_application, setup_bot_commands, MonitoringAlert, send_daily_report
from monitoring import stats
import rss_scanner
import storage
import db
import websub_manager
from datetime import datetime, time as datetime_time, timezone

# ── Delivery loop watchdog ─────────────────────────────────────
# Updated at the start of every delivery_loop iteration.
# _supervised_delivery_loop monitors this and restarts the task if stuck.
_delivery_last_beat: float = 0.0

# ── Logging ────────────────────────────────────────────────────

# Ensure deno (used by yt-dlp for YouTube JS extraction) is in PATH
_deno = Path.home() / ".deno" / "bin"
if _deno.exists() and str(_deno) not in os.environ.get("PATH", ""):
    os.environ["PATH"] = str(_deno) + ":" + os.environ.get("PATH", "")

LOG_FILE = Path(__file__).parent / "worker.log"
log_fmt = logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s")

root = logging.getLogger()
root.setLevel(logging.INFO)

fh = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8")
fh.setFormatter(log_fmt)
root.addHandler(fh)

# StreamHandler only when running manually (not under systemd).
# Under systemd stdout/stderr are redirected to the same log file, causing
# every line to be written twice. INVOCATION_ID is set by systemd.
if not os.environ.get("INVOCATION_ID"):
    ch = logging.StreamHandler()
    ch.setFormatter(log_fmt)
    root.addHandler(ch)

logger = logging.getLogger("worker")

logging.getLogger("httpx").setLevel(logging.WARNING)

# ── Single-instance enforcement ────────────────────────────────

PID_FILE = Path(__file__).parent / "worker.pid"


def _cleanup_pid_file() -> None:
    """Remove the PID file on clean exit (only if it belongs to this process)."""
    try:
        if PID_FILE.exists() and PID_FILE.read_text().strip() == str(os.getpid()):
            PID_FILE.unlink()
    except Exception:
        pass


def _enforce_single_instance() -> None:
    """Kill any previous worker instance and register this process's PID.

    Prevents two simultaneous workers from processing the same deliveries,
    writing to the same log file, or holding the Telegram polling session.
    """
    if PID_FILE.exists():
        try:
            old_pid = int(PID_FILE.read_text().strip())
            os.kill(old_pid, 0)  # Raises ProcessLookupError if already dead
            logger.warning(f"Stale worker instance found (PID {old_pid}) — sending SIGTERM")
            os.kill(old_pid, signal.SIGTERM)
            for _ in range(20):  # Wait up to 10 s
                time.sleep(0.5)
                try:
                    os.kill(old_pid, 0)
                except ProcessLookupError:
                    logger.info(f"Previous worker (PID {old_pid}) terminated cleanly")
                    break
            else:
                logger.warning(f"PID {old_pid} did not exit after SIGTERM — sending SIGKILL")
                try:
                    os.kill(old_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        except (ProcessLookupError, ValueError):
            pass  # Process already dead or PID file is corrupt — nothing to do

    PID_FILE.write_text(str(os.getpid()))
    atexit.register(_cleanup_pid_file)
    logger.info(f"Single-instance lock acquired (PID {os.getpid()}, file: {PID_FILE})")
logging.getLogger("httpcore").setLevel(logging.WARNING)


# ── Null alert system for processor-only mode ──────────────────

class _NullAlert:
    """No-op MonitoringAlert used in processor mode (no Telegram bot available).

    Processor instances don't need to send admin alerts or user notifications
    directly — the primary 'full' instance handles those. This class lets
    processor_loop and _process_video call alert_system.* without branching.
    """
    bot_app = None  # Signals _notify_video_failure to skip user notifications

    async def send_alert(self, message: str, level: str = "INFO") -> None:
        pass  # Silent — no bot to send to

    async def process_alerts(self) -> None:
        pass

    async def stop(self) -> None:
        pass


# ── Constants ──────────────────────────────────────────────────

VIDEO_TIMEOUT = 1200  # 20 minutes max per video (Whisper fallback on long videos needs more time)

# Default TTS voice per language code — mirrors src/lib/languages.ts
_DEFAULT_VOICES: dict[str, str] = {
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "ar": "ar-SA-ZariyahNeural",
    "hi": "hi-IN-SwaraNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "it": "it-IT-ElsaNeural",
    "nl": "nl-NL-ColetteNeural",
    "tr": "tr-TR-EmelNeural",
    "pl": "pl-PL-ZofiaNeural",
    "sv": "sv-SE-SofieNeural",
    "nb": "nb-NO-PernilleNeural",
    "da": "da-DK-ChristelNeural",
    "fi": "fi-FI-SelmaNeural",
    "id": "id-ID-GadisNeural",
    "ms": "ms-MY-YasminNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "th": "th-TH-PremwadeeNeural",
    "uk": "uk-UA-PolinaNeural",
    "cs": "cs-CZ-VlastaNeural",
    "ro": "ro-RO-AlinaNeural",
    "hu": "hu-HU-NoemiNeural",
    "el": "el-GR-AthinaNeural",
    "he": "he-IL-HilaNeural",
    "bn": "bn-IN-TanishaaNeural",
    "ur": "ur-PK-UzmaNeural",
    "fa": "fa-IR-DilaraNeural",
    "fil": "fil-PH-BlessicaNeural",
    "ta": "ta-IN-PallaviNeural",
    "sw": "sw-KE-ZuriNeural",
}


def _resolve_tts_voice(voice: str | None, language: str) -> str | None:
    """Return a TTS voice that is intelligible for the target language.

    If the configured voice prefix doesn't match the target language (e.g.
    a French voice for an Arabic summary), fall back to the canonical default
    voice for that language so the audio is actually listenable.
    """
    default = _DEFAULT_VOICES.get(language)
    if not voice:
        return default
    # Voice IDs are formatted as "{lang}-{region}-{Name}Neural"
    voice_lang = voice.split("-")[0] if "-" in voice else ""
    if voice_lang == language:
        return voice  # Voice already matches target language
    # Mismatch — override with language-appropriate default
    return default or voice


# ── Video failure notification ────────────────────────────────

# Human-readable labels for common error codes
_ERROR_LABELS: dict[str, str] = {
    "transcripts_disabled": "No captions available on this video",
    "no_transcript_available": "No transcript found",
    "video_unavailable": "Video is private or deleted",
    "youtube_auth_required": "YouTube bot-detection (temporary)",
    "likely_music_no_speech": "Music / no speech detected",
    "audio_too_large_for_speech": "Audio file too large",
    "transcript_too_short": "Transcript too short to summarize",
    "video_is_live": "Live stream — no transcript yet",
}

async def _notify_video_failure(
    video_id: str,
    alert_system,
    video_title: str = "",
    error_reason: str = "",
) -> None:
    """Notify all affected Telegram users that a video permanently failed."""
    if getattr(alert_system, "bot_app", None) is None:
        return  # Processor-only mode — primary worker handles user notifications
    try:
        chat_ids = await asyncio.to_thread(db.get_telegram_chat_ids_for_video, video_id)
    except Exception as e:
        logger.warning(f"[{video_id}] Could not fetch chat_ids for failure notification: {e}")
        return
    if not chat_ids:
        return

    reason_label = _ERROR_LABELS.get(error_reason, error_reason or "Unknown error")
    title_line = f"\n<b>{video_title[:80]}</b>" if video_title else ""
    msg = (
        f"A video from one of your channels couldn't be processed.{title_line}\n\n"
        f"Reason: {reason_label}\n\n"
        f'<a href="https://youtu.be/{video_id}">Watch on YouTube</a>'
    )
    for chat_id in chat_ids:
        try:
            await alert_system.bot_app.bot.send_message(
                chat_id=int(chat_id), text=msg, parse_mode="HTML"
            )
        except Exception as e:
            logger.warning(f"[{video_id}] Failed to notify user {chat_id} of failure: {e}")


async def _notify_push(
    session: aiohttp.ClientSession,
    user_id: str,
    video_id: str,
    video_title: str,
) -> None:
    """Best-effort web push notification after a successful Telegram delivery."""
    try:
        await session.post(
            f"{APP_URL}/api/push/send",
            json={
                "userId": user_id,
                "title": "New summary available",
                "body": video_title,
                "url": f"https://youtu.be/{video_id}",
            },
            headers={"x-push-secret": PUSH_NOTIFY_SECRET},
            timeout=aiohttp.ClientTimeout(total=5),
        )
    except Exception as e:
        logger.debug(f"Push notify failed for user {user_id}: {e}")


async def _notify_first_summary(
    session: aiohttp.ClientSession,
    user_id: str,
    video_id: str,
) -> None:
    """Best-effort first-summary email trigger after a successful delivery."""
    try:
        await session.post(
            f"{APP_URL}/api/email/first-summary",
            json={"userId": user_id, "videoId": video_id},
            headers={"x-push-secret": PUSH_NOTIFY_SECRET},
            timeout=aiohttp.ClientTimeout(total=5),
        )
    except Exception as e:
        logger.debug(f"First-summary email notify failed for user {user_id}: {e}")


# ── Loop 1: RSS Scanner ───────────────────────────────────────

async def rss_loop(alert_system: MonitoringAlert):
    """Periodically scan all subscribed channels for new videos."""
    logger.info(f"RSS Scanner started (interval: {RSS_CHECK_INTERVAL}s)")

    while True:
        try:
            new = await asyncio.to_thread(rss_scanner.scan_all_channels)
            stats.record_rss_scan(new)
            if new:
                logger.info(f"RSS: {new} new videos queued")
                await alert_system.send_alert(
                    f"📹 **{new} new videos** found and queued for processing",
                    level="SUCCESS"
                )
        except Exception as e:
            error_msg = str(e)
            logger.error(f"RSS loop error: {error_msg}")
            if "Server disconnected" in error_msg or "ConnectionTerminated" in error_msg:
                logger.warning("Supabase connection issue in RSS loop - resetting client")
                db.reset_client()
            else:
                await alert_system.send_alert(
                    f"RSS Scanner error: {error_msg}",
                    level="ERROR"
                )

        await asyncio.sleep(RSS_CHECK_INTERVAL)


# ── Processor: single video ────────────────────────────────────

async def _process_video(
    job: dict,
    transcript_extractor: TranscriptExtractor,
    gemini_summarizer: GeminiSummarizer,
    openrouter_summarizer: "OpenRouterSummarizer | None",
    alert_system: MonitoringAlert,
) -> None:
    """Process one video job: transcript → Gemini summary → TTS → upload → mark done."""
    video_id = job["video_id"]
    youtube_url = job["youtube_url"]
    video_title = job.get("video_title", video_id)
    start_time = datetime.now()
    _t0 = time.monotonic()

    logger.info(f"[{video_id}] Processing: {video_title}")

    # Resolve language/voice early (before the try block) so the exception
    # handlers can reference user_language when calling mark_video_failed.
    user_language = job.get("user_language") or "fr"
    tts_voice = _resolve_tts_voice(job.get("tts_voice"), user_language)
    if tts_voice != (job.get("tts_voice") or None):
        logger.info(f"[{video_id}] Voice overridden: '{job.get('tts_voice')}' → '{tts_voice}' (language: {user_language})")

    # Flag set to True once mark_video_completed succeeds.
    # Prevents the exception handlers from overwriting a successfully completed
    # video with status='failed' when a bookkeeping call (complete_job,
    # get_next_pending_language_for_video, etc.) raises a transient DB error.
    _video_completed = False

    try:

        # Step 1: Extract transcript
        logger.info(f"[{video_id}] Extracting transcript...")
        transcript, source_lang, error, transcript_cost = await asyncio.to_thread(
            transcript_extractor.get_transcript,
            youtube_url,
            preferred_languages=[user_language, 'fr', 'en'],
            video_title=video_title,
        )

        # ── Post-transcript alerts ──────────────────────────────────────

        # Alert once per day if YouTube is IP-blocking this server
        if transcript_extractor.last_ip_blocked and not stats.ip_block_alert_sent:
            stats.ip_block_alert_sent = True
            await alert_system.send_alert(
                "⚠️ **YouTube bloque les requêtes transcripts**\n\n"
                "L'IP du serveur est bloquée par YouTube — Whisper (Groq) "
                "sera utilisé en fallback. Surveille le quota Groq.\n\n"
                "Solution : ajoute un fichier cookies YouTube dans "
                "<code>worker/cookies/youtube.txt</code>.",
                level="WARNING",
            )

        # Track Groq usage and alert on quota milestones
        if transcript_cost > 0:
            groq_seconds = (transcript_cost / 0.00067) * 60
            stats.record_groq_usage(groq_seconds, transcript_cost)
            if stats.groq_quota_pct >= 80 and not stats.groq_alert_80_sent:
                stats.groq_alert_80_sent = True
                await alert_system.send_alert(
                    f"⚠️ **Quota Groq à {stats.groq_quota_pct:.0f}%**\n\n"
                    f"Utilisé : {stats.groq_seconds_today:.0f} / 28800s\n"
                    f"Coût du jour : ${stats.groq_cost_today:.3f}\n"
                    "Reset à minuit UTC.",
                    level="WARNING",
                )

        # Alert on Groq rate-limit 429 (quota exhausted)
        if error and ("rate_limit_exceeded" in error or "429" in error):
            m = re.search(r"Used (\d+), Requested (\d+)", error)
            quota_info = ""
            if m:
                used, req = int(m.group(1)), int(m.group(2))
                quota_info = f"\n{used}/{used + req}s utilisés ({used/28800*100:.0f}%)"
            await alert_system.send_alert(
                f"🔴 **Quota Groq épuisé**{quota_info}\n\n"
                "Les vidéos sans transcript YouTube échoueront jusqu'au reset "
                "à minuit UTC.",
                level="ERROR",
            )

        if not transcript:
            # Music/ambient videos — silently discard, no alert
            _MUSIC_SKIP_ERRORS = ("likely_music_no_speech", "audio_too_large_for_speech", "audio_unsupported_format", "music_content")
            if error in _MUSIC_SKIP_ERRORS:
                logger.info(
                    f"[{video_id}] Skipping permanently ({error}): {video_title[:80]}"
                )
                db.fail_job(job["id"], immediate=True)
                return

            # Premiere/scheduled video — snooze until it starts, no failure notification.
            # Give up after 7 days — the premiere was cancelled or already aired.
            if error and error.startswith("premiere_not_available_yet:"):
                try:
                    hours = int(error.split(":")[1])
                except (IndexError, ValueError):
                    hours = 2
                job_age_hours = 0.0
                try:
                    created_dt = datetime.fromisoformat(
                        job.get("created_at", "").replace("Z", "+00:00")
                    )
                    job_age_hours = (
                        datetime.now(timezone.utc) - created_dt
                    ).total_seconds() / 3600
                except Exception:
                    pass
                if job_age_hours > 7 * 24:
                    logger.info(
                        f"[{video_id}] Premiere stale (>7 days) — failing permanently: {video_title[:80]}"
                    )
                    db.fail_job(job["id"], immediate=True)
                else:
                    logger.info(
                        f"[{video_id}] Premiere/scheduled — snoozed for {hours}h: {video_title[:80]}"
                    )
                    db.snooze_job(job["id"], hours=hours)
                return

            # Live stream currently broadcasting — no transcript/audio yet.
            # Snooze for 2h, but give up after 48h — the stream has ended by then
            # and will never get a transcript (or it's a permanent live channel).
            if error == "video_is_live":
                job_age_hours = 0.0
                try:
                    created_dt = datetime.fromisoformat(
                        job.get("created_at", "").replace("Z", "+00:00")
                    )
                    job_age_hours = (
                        datetime.now(timezone.utc) - created_dt
                    ).total_seconds() / 3600
                except Exception:
                    pass
                if job_age_hours > 48:
                    logger.info(
                        f"[{video_id}] Live stream stale (>48h) — failing permanently: {video_title[:80]}"
                    )
                    db.fail_job(job["id"], immediate=True)
                else:
                    logger.info(
                        f"[{video_id}] Live stream in progress — snoozed 2h: {video_title[:80]}"
                    )
                    db.snooze_job(job["id"], hours=2)
                return

            logger.error(f"[{video_id}] Transcript extraction failed: {error}")

            # Always alert the admin log bot for transcript failures
            await alert_system.send_alert(
                f"🔴 <b>Transcript failed</b>\n\n"
                f"<b>{video_title[:60]}</b>\n"
                f"Reason: {error or 'unknown'}\n"
                f"https://youtu.be/{video_id}",
                level="ERROR",
            )

            if TranscriptExtractor.should_retry(error):
                # Transient error — retry later. Only notify user if permanently exhausted.
                logger.info(f"[{video_id}] Will retry later")
                permanent = db.fail_job(
                    job["id"],
                    retry_after_minutes=30 if error == "youtube_auth_required" else 0,
                )
                if permanent:
                    await _notify_video_failure(video_id, alert_system, video_title, error)
            else:
                # Deterministic failure — fail immediately, notify user.
                logger.info(f"[{video_id}] Permanent transcript failure ({error}) — no retry")
                db.fail_job(job["id"], immediate=True)
                stats.record_video_failed("TranscriptUnavailable", error or "no_transcript")
                await _notify_video_failure(video_id, alert_system, video_title, error)
            return

        logger.info(
            f"[{video_id}] Transcript: {len(transcript)} chars, "
            f"lang: {source_lang}, cost: ${transcript_cost:.4f}"
        )
        _t_transcript = time.monotonic() - _t0

        # Backfill title from Invidious metadata if the job title is just the raw
        # video_id (happens when triggered via /api/process-video without a real title).
        invidious_title = transcript_extractor.last_video_metadata.get("title", "")
        if invidious_title and (not video_title or video_title == video_id):
            video_title = invidious_title
            logger.info(f"[{video_id}] Title backfilled from Invidious: {video_title[:80]}")

        # Step 2: Summarize
        logger.info(f"[{video_id}] Generating summary...")
        summary, summary_error = await asyncio.to_thread(
            gemini_summarizer.summarize,
            transcript=transcript,
            source_language=source_lang,
            target_language=user_language,
        )

        if not summary:
            if summary_error == "transcript_too_short":
                logger.info(f"[{video_id}] Transcript too short — skipping permanently: {video_title[:80]}")
                db.fail_job(job["id"], immediate=True)
                return

            # Gemini failed — try OpenRouter as fallback
            if openrouter_summarizer:
                logger.warning(
                    f"[{video_id}] Gemini failed ({summary_error}) — trying OpenRouter fallback"
                )
                summary, or_error = await asyncio.to_thread(
                    openrouter_summarizer.summarize,
                    transcript=transcript,
                    source_language=source_lang,
                    target_language=user_language,
                )
                if not summary:
                    # Both Gemini and OpenRouter failed
                    if summary_error == "rate_limited" or or_error == "rate_limited":
                        logger.warning(f"[{video_id}] All summarizers rate-limited — snoozed 30min")
                        db.snooze_job(job["id"], minutes=30)
                        return
                    raise Exception(
                        f"All summarizers failed: gemini={summary_error}, openrouter={or_error}"
                    )
                logger.info(f"[{video_id}] OpenRouter summary: {len(summary)} chars")
            else:
                # No OpenRouter — degrade gracefully
                if summary_error == "rate_limited":
                    logger.warning(f"[{video_id}] Gemini rate-limited, no OpenRouter — snoozed 30min")
                    db.snooze_job(job["id"], minutes=30)
                    return
                raise Exception(f"Summary generation failed: {summary_error}")

        logger.info(f"[{video_id}] Summary: {len(summary)} chars")
        _t_summary = time.monotonic() - _t0 - _t_transcript

        # Step 3: Clean + TTS
        clean_summary = clean_for_tts(summary)
        logger.info(f"[{video_id}] Generating audio...")
        audio_path = await text_to_audio(
            clean_summary,
            voice=tts_voice,
            output_filename=f"video_{video_id}"
        )
        _t_audio = time.monotonic() - _t0 - _t_transcript - _t_summary

        # Step 4: Upload to Cloudflare R2 (zero egress cost)
        storage_key = f"audio/{video_id}_{user_language}.mp3"
        audio_url = ""
        try:
            audio_url = storage.upload_audio(audio_path, storage_key)
            logger.info(f"[{video_id}] Uploaded to R2: {storage_key}")
        except Exception as e:
            logger.warning(f"[{video_id}] R2 upload failed (using local path): {e}")
            audio_url = str(audio_path)
        _t_upload = time.monotonic() - _t0 - _t_transcript - _t_summary - _t_audio

        # Step 5: Mark done (per language)
        processing_time = (datetime.now() - start_time).total_seconds()
        # Merge Invidious-fetched YouTube metadata (genre, keywords, duration, views, …)
        # with processing stats. Stored as JSONB — useful for future recommendation
        # algorithms, analytics, and content filtering.
        video_metadata = {
            **transcript_extractor.last_video_metadata,  # genre, keywords, duration_seconds, …
            "transcript_cost": transcript_cost,
            "transcript_length": len(transcript),
            "source_language": source_lang,
            "summary_length": len(summary),
        }
        db.mark_video_completed(
            video_id, summary, audio_url,
            metadata=video_metadata,
            language=user_language,
            video_title=video_title or None,
            transcript_source=transcript_extractor.last_transcript_source or None,
            processing_time_s=processing_time,
        )
        _video_completed = True  # Do not call mark_video_failed after this point
        db.complete_job(job["id"])

        # Chain: re-queue for the next pending language (e.g. "en" after "fr").
        # Each language is processed sequentially, reusing the same job slot.
        next_lang = await asyncio.to_thread(
            db.get_next_pending_language_for_video, video_id, user_language
        )
        if next_lang:
            re_queued = await asyncio.to_thread(
                db.enqueue_video_for_language,
                video_id, youtube_url, video_title,
                job.get("channel_id", ""), next_lang,
                None,  # tts_voice resolved at processing time by _resolve_tts_voice
            )
            if re_queued:
                logger.info(f"[{video_id}] Queued for next language: {next_lang}")

        stats.record_video_processed(processing_time)

        logger.info(
            f"✅ [{video_id}] Done: {video_title} "
            f"(transcript: ${transcript_cost:.4f}, source: {source_lang}, "
            f"transcript_source: {transcript_extractor.last_transcript_source}, "
            f"summary: {len(summary)} chars, time: {processing_time:.1f}s | "
            f"steps: transcript={_t_transcript:.1f}s summary={_t_summary:.1f}s "
            f"tts={_t_audio:.1f}s upload={_t_upload:.1f}s)"
        )

    except asyncio.TimeoutError:
        logger.error(f"[{video_id}] Timeout")
        permanent = db.fail_job(job["id"])
        if not _video_completed:
            db.mark_video_failed(video_id, language=user_language)
            if permanent:
                await _notify_video_failure(video_id, alert_system, video_title, "timeout")
        else:
            logger.warning(f"[{video_id}] Timeout after successful completion — not marking as failed")
        stats.record_video_failed("Timeout", f"Timeout: {video_title}")
        await alert_system.send_alert(f"⏱️ **Timeout**\n\n{video_title[:80]}", level="WARNING")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{video_id}] Error: {error_msg}")

        permanent = db.fail_job(job["id"])
        if not _video_completed:
            db.mark_video_failed(video_id, language=user_language)
            if permanent:
                await _notify_video_failure(video_id, alert_system, video_title, type(e).__name__)
        else:
            logger.warning(f"[{video_id}] Post-completion error (bookkeeping) — not marking as failed: {error_msg}")
        stats.record_video_failed(type(e).__name__, error_msg)
        await alert_system.send_alert(
            f"🔴 **Error**\n\nVideo: {video_title[:60]}\nError: {error_msg[:100]}",
            level="ERROR"
        )


# ── Resource throttle helper ──────────────────────────────────

_CPU_COUNT = psutil.cpu_count(logical=True) or 1

async def _wait_for_headroom() -> None:
    """Pause before starting a new video job if the system is under pressure.

    Three independent checks run in a thread to keep the event loop free:
      1. CPU usage (1-second sample) > MAX_CPU_PERCENT
      2. 1-minute load average > CPU_COUNT × MAX_LOAD_PER_CPU
      3. Available RAM < MIN_FREE_RAM_MB

    All three must be satisfied simultaneously before a new slot is granted.
    Set MAX_CPU_PERCENT=100 to disable all checks.
    """
    if MAX_CPU_PERCENT >= 100:
        return  # Throttling disabled

    while True:
        def _check() -> tuple[float, float, int]:
            cpu  = psutil.cpu_percent(1)
            load = os.getloadavg()[0]          # 1-minute load average
            ram  = psutil.virtual_memory().available // (1024 * 1024)  # MB
            return cpu, load, ram

        cpu, load, ram = await asyncio.to_thread(_check)
        load_limit = _CPU_COUNT * MAX_LOAD_PER_CPU

        reasons = []
        if cpu >= MAX_CPU_PERCENT:
            reasons.append(f"CPU {cpu:.0f}%>{MAX_CPU_PERCENT}%")
        if load >= load_limit:
            reasons.append(f"load {load:.2f}>{load_limit:.2f}")
        if ram < MIN_FREE_RAM_MB:
            reasons.append(f"RAM {ram}MB<{MIN_FREE_RAM_MB}MB")

        if not reasons:
            return
        logger.info(f"Throttle ({', '.join(reasons)}) — waiting {CPU_CHECK_INTERVAL:.0f}s before next job")
        await asyncio.sleep(CPU_CHECK_INTERVAL)


# ── Loop 2: WebSub Manager ─────────────────────────────────────

async def websub_loop(alert_system: MonitoringAlert):
    """Subscribe all channels to WebSub and renew expiring subscriptions every hour."""
    callback_url = websub_manager.CALLBACK_URL
    if "localhost" in APP_URL or "127.0.0.1" in APP_URL:
        logger.warning(
            f"[WebSub] APP_URL looks local ({APP_URL}) — YouTube cannot reach the callback. "
            "Set APP_URL to the public Next.js URL (e.g. https://www.brief-tube.com)."
        )
    logger.info(f"WebSub manager started — callback: {callback_url}")

    while True:
        try:
            async with aiohttp.ClientSession() as session:
                new, renewed = await websub_manager.sync_subscriptions(session)
                if new or renewed:
                    logger.info(f"WebSub: {new} new subscriptions, {renewed} renewed")
        except Exception as e:
            logger.error(f"WebSub loop error: {e}")

        await asyncio.sleep(3600)  # Run every hour


# ── Loop 4: Gemini Processor (concurrent) ─────────────────────

# Serialize job picking so concurrent tasks never grab the same row
_pick_lock = asyncio.Lock()


async def processor_loop(alert_system: MonitoringAlert):
    """Pick jobs from processing_queue and process up to MAX_CONCURRENT_VIDEOS in parallel.

    Uses an asyncio.Semaphore to cap concurrency and a Lock to make job
    picking atomic, preventing two tasks from selecting the same row.
    """
    logger.info(f"Processor started ({MAX_CONCURRENT_VIDEOS} concurrent slots)")

    transcript_extractor = TranscriptExtractor(enable_whisper_fallback=True)
    logger.info("Transcript extractor ready (YouTube + Groq fallback)")

    try:
        gemini_summarizer = GeminiSummarizer()
        logger.info("Gemini summarizer ready")
    except ValueError as e:
        logger.error(f"Failed to initialize Gemini: {e}")
        return

    # Initialize OpenRouter (optional fallback — graceful if key missing)
    openrouter_summarizer = None
    try:
        openrouter_summarizer = OpenRouterSummarizer()
        logger.info("OpenRouter summarizer ready (fallback)")
    except ValueError:
        logger.warning("OPENROUTER_API_KEY not set — OpenRouter fallback disabled")

    # Semaphore: at most MAX_CONCURRENT_VIDEOS tasks running at once
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VIDEOS)

    while True:
        try:
            # Block here until a processing slot is free
            await semaphore.acquire()

            # Throttle: wait until CPU/load/RAM are within limits before picking a job
            await _wait_for_headroom()

            # Serialize job picking — prevents two concurrent tasks picking the same row
            async with _pick_lock:
                job = await asyncio.to_thread(db.pick_next_job)

            if not job:
                semaphore.release()
                logger.debug("Queue empty — no jobs available, waiting 10s")
                await asyncio.sleep(10)
                continue

            # Dispatch to a background task; semaphore released when done.
            # VIDEO_TIMEOUT caps each job so a hung video never blocks a slot forever.
            async def _do(j: dict) -> None:
                try:
                    await asyncio.wait_for(
                        _process_video(j, transcript_extractor, gemini_summarizer, openrouter_summarizer, alert_system),
                        timeout=VIDEO_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    logger.error(f"[{j['video_id']}] Timed out after {VIDEO_TIMEOUT}s — marking failed")
                    try:
                        permanent = db.fail_job(j["id"])
                        db.mark_video_failed(j["video_id"], language=j.get("user_language", "fr"))
                        if permanent:
                            await _notify_video_failure(j["video_id"], alert_system, j.get("video_title", ""), "permanent_failure")
                    except Exception:
                        pass
                finally:
                    semaphore.release()

            asyncio.create_task(_do(job))

        except Exception as e:
            logger.error(f"Processor loop error: {e}")
            try:
                semaphore.release()
            except ValueError:
                pass
            await asyncio.sleep(10)


# ── Loop 5: Telegram Deliverer ─────────────────────────────────

async def _dispatch_delivery(d: dict, audio_path: Path) -> bool | None:
    """Dispatch a delivery to the appropriate platform handler."""
    platform = d.get("platform", "telegram")
    if platform == "telegram":
        return await send_audio_to_user(
            chat_id=d["external_id"],
            audio_path=audio_path,
            video_title=d["video_title"],
            video_id=d["video_id"],
            channel_id=d["channel_id"],
            language=d.get("language", "fr"),
        )
    elif platform == "notion":
        creds = d.get("credentials") or {}
        return await send_to_notion(
            access_token=creds.get("access_token", ""),
            database_id=creds.get("database_id", ""),
            video_title=d["video_title"],
            video_id=d["video_id"],
            summary=d.get("summary", ""),
            audio_url=d.get("audio_url", ""),
            language=d.get("language", "fr"),
        )
    elif platform == "whatsapp":
        return await send_to_whatsapp(
            phone=d["external_id"],
            video_title=d["video_title"],
            video_id=d["video_id"],
            audio_url=d.get("audio_url", ""),
        )
    elif platform == "discord":
        return await send_to_discord(
            webhook_url=d["external_id"],
            video_title=d["video_title"],
            video_id=d["video_id"],
            summary=d.get("summary", ""),
            audio_url=d.get("audio_url", ""),
            language=d.get("language", "en"),
        )
    elif platform == "slack":
        return await send_to_slack(
            webhook_url=d["external_id"],
            video_title=d["video_title"],
            video_id=d["video_id"],
            summary=d.get("summary", ""),
            audio_url=d.get("audio_url", ""),
            language=d.get("language", "en"),
        )
    else:
        logger.error(f"Unknown delivery platform: {platform}")
        return False


def _cleanup_stale_r2_audio(days: int = 7, batch: int = 100) -> None:
    """Delete R2 audio files older than `days` days whose deliveries are all sent."""
    from config import R2_PUBLIC_URL
    if not storage.is_configured():
        return
    rows = db.get_stale_r2_urls(days=days, limit=batch)
    if not rows:
        return
    logger.info(f"R2 cleanup: {len(rows)} files to delete (> {days} days, fully delivered)")
    deleted = 0
    for row in rows:
        audio_url = row["audio_url"]
        # Extract storage key: strip the public base URL prefix
        if R2_PUBLIC_URL and audio_url.startswith(R2_PUBLIC_URL.rstrip("/")):
            key = audio_url[len(R2_PUBLIC_URL.rstrip("/")) + 1:]
        else:
            parts = audio_url.rsplit("/", 2)
            key = "/".join(parts[-2:]) if len(parts) >= 2 else audio_url
        storage.delete_audio(key)
        db.clear_audio_url(row["video_id"], row["language"])
        deleted += 1
    logger.info(f"R2 cleanup done: {deleted} files deleted")


async def delivery_loop(alert_system: MonitoringAlert):
    """Send completed audio to subscribed users."""
    global _delivery_last_beat
    logger.info("Telegram Deliverer started")

    _cleanup_counter = 0       # Run delivery cleanup every N cycles
    _recover_counter = 0       # Run delivery recovery every N cycles
    _audio_cleanup_counter = 0  # Run audio file cleanup every N cycles
    _last_r2_cleanup = datetime.now(timezone.utc)  # R2 audio cleanup (every 6h)

    # Persistent HTTP session for audio downloads — reused across all deliveries
    # to avoid the overhead of a new TCP+TLS handshake per audio file.
    _http_session = aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=120),
    )

    while True:
        _delivery_last_beat = time.monotonic()  # Heartbeat — monitored by _supervised_delivery_loop
        try:
            # Periodically clean up undeliverable deliveries (failed videos /
            # disconnected users) so they don't block the queue.
            _cleanup_counter += 1
            if _cleanup_counter >= 20:  # every ~5 min (20 × 15s sleep)
                _cleanup_counter = 0
                try:
                    cleaned = await asyncio.to_thread(db.cleanup_undeliverable_deliveries)
                    if cleaned:
                        logger.info(f"Cleaned up {cleaned} undeliverable deliveries")
                except Exception as e:
                    logger.warning(f"Cleanup error (non-fatal): {e}")

            # Periodically recover failed deliveries whose video is now completed.
            # Handles re-processed videos and transient send failures.
            _recover_counter += 1
            if _recover_counter >= 40:  # every ~10 min (40 × 15s sleep)
                _recover_counter = 0
                try:
                    await asyncio.to_thread(db.recover_failed_deliveries)
                except Exception as e:
                    logger.warning(f"Recovery error (non-fatal): {e}")

            # Get pending deliveries with retry on connection errors.
            # wait_for(60s) prevents an indefinite hang if the DB connection is stuck
            # (the thread keeps running but the asyncio await is released after timeout).
            deliveries = []
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    deliveries = await asyncio.wait_for(
                        asyncio.to_thread(db.get_pending_deliveries, 30),
                        timeout=60.0,
                    )
                    break
                except asyncio.TimeoutError:
                    logger.error(
                        f"get_pending_deliveries timed out (attempt {attempt + 1}/{max_retries})"
                        " — resetting DB client"
                    )
                    db.reset_client()
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        deliveries = []  # Give up this cycle, retry next iteration
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Delivery fetch failed (attempt {attempt + 1}/{max_retries}): {e}")
                        db.reset_client()  # Force reconnect before retry
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    else:
                        raise

            for d in deliveries:
                # ── Step 1: Claim (pending → sending) ──────────────────
                # Isolated try/except: if the claim fails (DB error, network),
                # the delivery stays at 'pending' and will be retried next cycle.
                # We must NOT mark it as 'failed' here — it was never attempted.
                try:
                    claimed = await asyncio.to_thread(db.claim_delivery, d["delivery_id"])
                    if not claimed:
                        logger.debug(f"Delivery {d['delivery_id']} already claimed — skipping")
                        continue
                except Exception as e:
                    logger.warning(f"Could not claim delivery {d['delivery_id']} (will retry): {e}")
                    continue  # Delivery stays 'pending' — retried next cycle

                # ── Step 2: Send ────────────────────────────────────────
                # Delivery is now 'sending'. Any unhandled exception leaves it
                # at 'sending'; reset_sending_deliveries() at next startup will
                # bring it back to 'pending' for a retry.
                try:
                    video_id = d["video_id"]
                    audio_url = d.get("audio_url") or ""
                    delivery_language = d.get("language", "fr")

                    # Get or download audio file (one file per video+language)
                    audio_path = Path(__file__).parent / "audio" / f"video_{video_id}_{delivery_language}.mp3"

                    if not audio_path.exists() and audio_url and audio_url.startswith("http"):
                        async with _http_session.get(audio_url) as resp:
                            if resp.status == 200:
                                audio_path.parent.mkdir(exist_ok=True)
                                with open(audio_path, "wb") as f:
                                    f.write(await resp.read())

                    if not audio_path.exists():
                        if d.get("summary"):
                            voice = d.get("tts_voice") or None
                            audio_path = await text_to_audio(
                                d["summary"], voice=voice, output_filename=f"video_{video_id}"
                            )
                        else:
                            logger.warning(f"No audio for {video_id} — marking failed")
                            await asyncio.to_thread(db.mark_delivery_failed, d["delivery_id"])
                            continue

                    result = await _dispatch_delivery(d, audio_path)

                    if result:
                        # Retry marking as sent to survive transient Supabase errors.
                        _sent_marked = False
                        for _attempt in range(3):
                            try:
                                await asyncio.to_thread(db.mark_delivery_sent, d["delivery_id"])
                                stats.record_delivery_sent()
                                _sent_marked = True
                                break
                            except Exception as mark_err:
                                if _attempt < 2:
                                    logger.warning(
                                        f"mark_delivery_sent failed (attempt {_attempt + 1}/3): {mark_err}"
                                    )
                                    db.reset_client()
                                    await asyncio.sleep(1)
                                else:
                                    logger.error(
                                        f"Could not mark delivery {d['delivery_id']} as sent "
                                        f"after 3 attempts — audio was already sent to user"
                                    )
                        # Mirror to admin log bot only if DB update succeeded.
                        # If mark_delivery_sent failed, delivery stays 'sending' and
                        # will be reset to 'pending' on next restart — skip mirror to
                        # avoid a false-positive success signal in the admin logs.
                        if _sent_marked:
                            asyncio.create_task(alert_system.mirror_delivery(
                                video_id=video_id,
                                video_title=d["video_title"],
                                channel_id=d["channel_id"],
                                audio_path=audio_path,
                            ))
                            # Best-effort web push notification (non-blocking)
                            if PUSH_NOTIFY_SECRET and APP_URL:
                                asyncio.create_task(_notify_push(
                                    session=_http_session,
                                    user_id=d["user_id"],
                                    video_id=video_id,
                                    video_title=d["video_title"],
                                ))
                                asyncio.create_task(_notify_first_summary(
                                    session=_http_session,
                                    user_id=d["user_id"],
                                    video_id=video_id,
                                ))
                    elif result is None:
                        # send_audio_to_user returned None: permanent rejection
                        # (bot blocked, chat not found). Disconnect the user.
                        await asyncio.to_thread(db.mark_delivery_failed, d["delivery_id"])
                        await asyncio.to_thread(db.mark_user_platform_disconnected, d["user_id"], d.get("platform", "telegram"))
                        stats.record_delivery_failed()
                    else:
                        # send_audio_to_user returned False: temporary failure
                        # (timeout, network error). Keep user connected, retry later.
                        logger.warning(f"Temporary delivery failure for {d['delivery_id']} — keeping user connected")
                        stats.record_delivery_failed()

                    await asyncio.sleep(0.05)

                except Exception as e:
                    # Unexpected error during send (network, audio file issue...).
                    # Delivery stays at 'sending' — it will be reset to 'pending'
                    # by reset_sending_deliveries() on next worker startup.
                    logger.error(f"Delivery error for {d['delivery_id']} ({d.get('video_id', '?')}): {e}")

            if not deliveries:
                await asyncio.sleep(15)

            # Cleanup old audio files every ~10 min (40 × 15s sleep)
            _audio_cleanup_counter += 1
            if _audio_cleanup_counter >= 40:
                _audio_cleanup_counter = 0
                cleanup_audio_files(max_age_hours=1)

            # Cleanup stale R2 audio files every 6h (files > 7 days, all delivered)
            _now = datetime.now(timezone.utc)
            if (_now - _last_r2_cleanup).total_seconds() >= 6 * 3600:
                _last_r2_cleanup = _now
                try:
                    await asyncio.to_thread(_cleanup_stale_r2_audio)
                except Exception as e:
                    logger.warning(f"R2 audio cleanup error (non-fatal): {e}")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Delivery loop error: {error_msg}")

            # Alert on persistent delivery errors
            if "Server disconnected" in error_msg or "ConnectionTerminated" in error_msg:
                logger.warning("Supabase connection issue - resetting client and retrying")
                db.reset_client()  # Drop stale connection so next iteration reconnects
                await asyncio.sleep(10)
            else:
                await alert_system.send_alert(
                    f"🔴 **Delivery Loop Error**\n\n{error_msg[:150]}",
                    level="ERROR"
                )
                await asyncio.sleep(15)


# ── Delivery loop supervisor ───────────────────────────────────

async def _supervised_delivery_loop(alert_system: MonitoringAlert):
    """Wraps delivery_loop and restarts it automatically if it gets stuck.

    delivery_loop updates _delivery_last_beat at the start of every iteration.
    If the heartbeat stops advancing for WATCHDOG_TIMEOUT seconds (DB hang,
    asyncio deadlock, etc.) this supervisor cancels the stuck task and starts
    a fresh one — without taking down the entire worker process.
    """
    WATCHDOG_TIMEOUT = 300  # seconds without a heartbeat before declaring stuck
    CHECK_INTERVAL   = 60   # how often to check the heartbeat

    while True:
        task = asyncio.create_task(delivery_loop(alert_system))
        logger.info("Delivery task started (supervised)")

        while not task.done():
            await asyncio.sleep(CHECK_INTERVAL)
            if _delivery_last_beat > 0:
                age = time.monotonic() - _delivery_last_beat
                if age > WATCHDOG_TIMEOUT:
                    logger.error(
                        f"Delivery loop has not progressed for {age:.0f}s "
                        f"(threshold: {WATCHDOG_TIMEOUT}s) — cancelling and restarting"
                    )
                    await alert_system.send_alert(
                        f"⚠️ **Delivery loop stuck** ({age:.0f}s) — restarting automatically",
                        level="WARNING",
                    )
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass
                    break

        if task.done() and not task.cancelled():
            try:
                exc = task.exception()
                if exc:
                    logger.error(f"Delivery task exited with exception: {exc}")
            except (asyncio.CancelledError, asyncio.InvalidStateError):
                pass

        logger.info("Delivery task restarting in 5s")
        await asyncio.sleep(5)


# ── Loop 6: Telegram Bot Polling ──────────────────────────────

async def _bot_poll_loop(bot_app) -> None:
    """Custom long-polling loop for the Telegram bot.

    PTB's built-in Updater calls deleteWebhook on every startup which resets
    Telegram's server-side allowed_updates to ["message"], silently dropping
    callback_query events.  This custom loop uses aiohttp directly so that
    allowed_updates=["message","callback_query"] is sent on every request and
    is never overwritten by a bootstrap deleteWebhook call.
    """
    from telegram import Update as TGUpdate

    ALLOWED = ["message", "callback_query"]
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    offset = 0

    async def _make_session() -> aiohttp.ClientSession:
        connector = aiohttp.TCPConnector(
            enable_cleanup_closed=True,
            keepalive_timeout=60,   # Reuse SSL connections for 60s (avoids 6s handshake per request)
            limit=5,
        )
        return aiohttp.ClientSession(connector=connector)

    session = await _make_session()
    try:
        # Acknowledge all pending updates accumulated while the worker was down.
        # We fetch with timeout=0 (instant return) and no offset, which returns
        # any unacknowledged updates.  We then advance past them so we don't
        # re-deliver stale summaries.
        try:
            async with session.post(
                url,
                json={"timeout": 0, "allowed_updates": ALLOWED},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                data = await resp.json()
                if data.get("ok") and data.get("result"):
                    offset = data["result"][-1]["update_id"] + 1
                    logger.info(f"Bot startup: skipped {len(data['result'])} pending updates (offset now {offset})")
        except Exception as e:
            logger.warning(f"Bot startup: could not drop pending updates: {e}")

        logger.info("Telegram bot polling started")

        consecutive_errors = 0
        while True:
            try:
                async with session.post(
                    url,
                    json={"offset": offset, "timeout": 10, "allowed_updates": ALLOWED},
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as resp:
                    data = await resp.json()

                consecutive_errors = 0

                if not data.get("ok"):
                    logger.warning(f"getUpdates error: {data.get('description', 'unknown')}")
                    await asyncio.sleep(5)
                    continue

                for raw in data.get("result", []):
                    update = TGUpdate.de_json(raw, bot_app.bot)
                    asyncio.create_task(bot_app.process_update(update))
                    offset = raw["update_id"] + 1

            except asyncio.CancelledError:
                raise
            except Exception as e:
                consecutive_errors += 1
                err_type = type(e).__name__
                logger.error(f"Bot poll error ({err_type}): {e or 'timeout'}")
                # After 3 consecutive failures, recreate the session to clear stale connections
                if consecutive_errors >= 3:
                    logger.warning("Bot poll: recreating session after repeated failures")
                    await session.close()
                    session = await _make_session()
                    consecutive_errors = 0
                    await asyncio.sleep(10)
                else:
                    await asyncio.sleep(5)
    finally:
        await session.close()


# ── Loop : Health Check HTTP ───────────────────────────────────

async def health_loop():
    """Minimal HTTP server for uptime monitoring and admin panel.

    GET /health → {"status": "ok", "uptime": "...", ...}
    GET /logs?token=SECRET → last 60 log lines + systemd status (admin panel)
    """
    from aiohttp import web

    async def handle_health(request):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if WORKER_API_SECRET and token != WORKER_API_SECRET:
            return web.json_response({"error": "Unauthorized"}, status=401)
        return web.json_response({
            "status": "ok",
            "uptime": stats.get_uptime(),
            "videos_processed": stats.videos_processed,
            "deliveries_sent": stats.deliveries_sent,
            "groq_quota_pct": round(stats.groq_quota_pct, 1),
        })

    async def handle_logs(request):
        # Token auth via Authorization: Bearer header
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if WORKER_API_SECRET and token != WORKER_API_SECRET:
            return web.json_response({"error": "Unauthorized"}, status=401)

        # Read log file
        log_lines: list = []
        recent_errors: list = []
        error_count = 0
        try:
            content = LOG_FILE.read_text(encoding="utf-8", errors="replace")
            all_lines = [l for l in content.split("\n") if l]
            deduped = [l for i, l in enumerate(all_lines) if i == 0 or l != all_lines[i - 1]]
            log_lines = deduped[-60:]
            last_200 = deduped[-200:]
            error_count = sum(1 for l in last_200 if "] ERROR" in l or "] CRITICAL" in l)
            recent_errors = [
                l for l in last_200
                if "] ERROR" in l or "] CRITICAL" in l or "] WARNING" in l
            ][-10:]
        except Exception:
            log_lines = ["Log file not accessible"]

        # Systemd status
        worker_status: dict = {
            "active": False, "status": "unknown",
            "pid": None, "memory": None, "cpu": None, "since": None,
        }
        try:
            proc = await asyncio.create_subprocess_exec(
                "systemctl", "status", "brieftube-worker", "--no-pager",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
            stdout = stdout_bytes.decode(errors="replace")
            active_match = re.search(r"Active: (.+)", stdout)
            pid_match = re.search(r"Main PID: (\d+)", stdout)
            mem_match = re.search(r"Memory: ([^\n(]+)", stdout)
            cpu_match = re.search(r"CPU: ([^\n]+)", stdout)
            since_match = re.search(r"since [A-Za-z]+ (.+?);", stdout)
            active_str = active_match.group(1) if active_match else ""
            worker_status["active"] = "active (running)" in active_str
            worker_status["status"] = active_str.strip().split(";")[0].strip() or "unknown"
            worker_status["pid"] = pid_match.group(1) if pid_match else None
            worker_status["memory"] = mem_match.group(1).strip() if mem_match else None
            worker_status["cpu"] = cpu_match.group(1).strip() if cpu_match else None
            worker_status["since"] = since_match.group(1).strip() if since_match else None
        except Exception:
            worker_status["status"] = "error reading status"

        return web.json_response({
            "workerStatus": worker_status,
            "logLines": log_lines,
            "recentErrors": recent_errors,
            "errorCount": error_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def handle_services(request):
        """Ping each external service and return their status."""
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if WORKER_API_SECRET and token != WORKER_API_SECRET:
            return web.json_response({"error": "Unauthorized"}, status=401)

        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        groq_key = os.environ.get("GROQ_API_KEY", "")

        from youtube_utils import INVIDIOUS_INSTANCES

        async def _check(name, coro):
            try:
                return await coro
            except Exception as e:
                return {"name": name, "status": "error", "detail": str(e)[:80]}

        async def check_gemini():
            if not gemini_key:
                return {"name": "Gemini", "status": "not_configured"}
            async with aiohttp.ClientSession() as s:
                async with s.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}",
                    timeout=aiohttp.ClientTimeout(total=6),
                ) as r:
                    return {"name": "Gemini", "status": "ok" if r.status == 200 else "error", "code": r.status}

        async def check_groq():
            if not groq_key:
                return {"name": "Groq / Whisper", "status": "not_configured"}
            async with aiohttp.ClientSession() as s:
                async with s.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    timeout=aiohttp.ClientTimeout(total=6),
                ) as r:
                    return {"name": "Groq / Whisper", "status": "ok" if r.status == 200 else "error", "code": r.status}

        async def check_telegram():
            if not TELEGRAM_BOT_TOKEN:
                return {"name": "Telegram", "status": "not_configured"}
            async with aiohttp.ClientSession() as s:
                async with s.get(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe",
                    timeout=aiohttp.ClientTimeout(total=6),
                ) as r:
                    data = await r.json()
                    if data.get("ok"):
                        username = data.get("result", {}).get("username", "")
                        return {"name": "Telegram", "status": "ok", "detail": f"@{username}"}
                    return {"name": "Telegram", "status": "error", "detail": str(data.get("description", ""))}

        async def check_youtube_direct():
            """Test if YouTube is directly accessible (no proxy)."""
            try:
                async with aiohttp.ClientSession() as s:
                    async with s.get(
                        "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=jNQXAC9IVRw&format=json",
                        timeout=aiohttp.ClientTimeout(total=7),
                    ) as r:
                        if r.status == 200:
                            return {"name": "YouTube Direct", "status": "ok", "detail": "accessible"}
                        elif r.status in (403, 429):
                            return {"name": "YouTube Direct", "status": "error", "detail": f"bloqué (HTTP {r.status})"}
                        else:
                            return {"name": "YouTube Direct", "status": "error", "detail": f"HTTP {r.status}"}
            except Exception as e:
                return {"name": "YouTube Direct", "status": "error", "detail": str(e)[:80]}

        async def check_invidious():
            async with aiohttp.ClientSession() as s:
                for instance in INVIDIOUS_INSTANCES[:4]:
                    try:
                        async with s.get(
                            f"{instance}/api/v1/stats",
                            timeout=aiohttp.ClientTimeout(total=5),
                        ) as r:
                            if r.status == 200:
                                host = instance.replace("https://", "").replace("http://", "")
                                return {"name": "Invidious", "status": "ok", "detail": host}
                    except Exception:
                        continue
            return {"name": "Invidious", "status": "error", "detail": "All instances unreachable"}

        async def check_webshare():
            """Test Webshare residential proxy against YouTube."""
            proxy_url = os.environ.get("YOUTUBE_PROXY_HTTP", "")
            if not proxy_url:
                return {"name": "Webshare", "status": "not_configured"}
            try:
                async with aiohttp.ClientSession() as s:
                    async with s.get(
                        "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=jNQXAC9IVRw&format=json",
                        proxy=proxy_url,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as r:
                        if r.status == 200:
                            return {"name": "Webshare", "status": "ok", "detail": "proxy résidentiel actif"}
                        elif r.status == 402:
                            return {"name": "Webshare", "status": "error", "detail": "quota épuisé (402)"}
                        else:
                            return {"name": "Webshare", "status": "error", "detail": f"HTTP {r.status}"}
            except Exception as e:
                return {"name": "Webshare", "status": "error", "detail": str(e)[:80]}

        (yt_direct, webshare, invidious, groq, gemini, telegram) = await asyncio.gather(
            _check("YouTube Direct", check_youtube_direct()),
            _check("Webshare", check_webshare()),
            _check("Invidious", check_invidious()),
            _check("Groq / Whisper", check_groq()),
            _check("Gemini", check_gemini()),
            _check("Telegram", check_telegram()),
        )

        groups = [
            {
                "id": "rss",
                "label": "Surveillance RSS",
                "services": [{"name": "Worker", "status": "ok", "detail": "en cours d'exécution"}],
            },
            {
                "id": "transcript",
                "label": "Transcription",
                "services": [yt_direct, webshare, invidious, groq],
            },
            {
                "id": "summary",
                "label": "Résumé IA",
                "services": [gemini],
            },
            {
                "id": "tts",
                "label": "Synthèse vocale",
                "services": [{"name": "Edge TTS", "status": "ok", "detail": "Microsoft (gratuit)"}],
            },
            {
                "id": "delivery",
                "label": "Livraison",
                "services": [telegram],
            },
        ]

        return web.json_response({
            "groups": groups,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def handle_get_whatsapp_link(request):
        """Get WhatsApp magic link (GET /get-whatsapp-link?token=<token>).

        Query params: token (required)
        Auth: Authorization: Bearer <WORKER_API_SECRET>
        Returns: { "waLink": "https://wa.me/14155238886?text=bt-A1B2C3" }
        """
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if WORKER_API_SECRET and token != WORKER_API_SECRET:
            return web.json_response({"error": "Unauthorized"}, status=401)

        token_param = request.query.get("token", "").strip()
        if not token_param:
            return web.json_response({"error": "token query param required"}, status=400)

        from_number = os.environ.get("TWILIO_WHATSAPP_FROM", "")
        if not from_number:
            logger.warning("WhatsApp link generation failed: TWILIO_WHATSAPP_FROM not set")
            return web.json_response({"error": "WhatsApp not configured"}, status=503)

        number_without_plus = from_number.lstrip("+")
        wa_link = f"https://wa.me/{number_without_plus}?text={token_param}"
        return web.json_response({"waLink": wa_link})

    port = HEALTH_PORT + WORKER_INSTANCE  # Instance 0→8080, 1→8081, 2→8082, …
    app = web.Application()
    app.router.add_get("/health", handle_health)
    app.router.add_get("/logs", handle_logs)
    app.router.add_get("/services", handle_services)
    app.router.add_get("/get-whatsapp-link", handle_get_whatsapp_link)
    # Disable HTTP access logging — every /logs poll would otherwise write
    # a line into worker.log, creating a feedback loop that drowns real logs.
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info(f"Health check server started on :{port}/health and :{port}/logs")
    await asyncio.Event().wait()  # Keep running forever alongside other loops


# ── Loop: Worker Stats persistence ────────────────────────────

async def stats_save_loop():
    """Restore today's WorkerStats from Supabase at startup, then save every 5 min.

    Prevents counters from resetting to zero when the worker is restarted
    (e.g., after a deploy or crash). Uses a dedicated worker_stats table keyed
    by UTC date so daily totals are accumulated correctly.
    """
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        row = await asyncio.to_thread(db.load_worker_stats, today)
        if row:
            stats.videos_processed = row.get("videos_processed", 0)
            stats.videos_failed = row.get("videos_failed", 0)
            stats.deliveries_sent = row.get("deliveries_sent", 0)
            stats.deliveries_failed = row.get("deliveries_failed", 0)
            stats.groq_seconds_today = float(row.get("groq_seconds", 0.0))
            stats.groq_cost_today = float(row.get("groq_cost", 0.0))
            logger.info(
                f"WorkerStats restored from DB: {stats.videos_processed} videos processed, "
                f"{stats.deliveries_sent} deliveries sent today"
            )
    except Exception as e:
        logger.warning(f"Could not restore WorkerStats from DB: {e}")

    while True:
        await asyncio.sleep(300)  # Save every 5 minutes
        try:
            save_today = datetime.now(timezone.utc).date().isoformat()
            await asyncio.to_thread(db.save_worker_stats, save_today, {
                "videos_processed": stats.videos_processed,
                "videos_failed": stats.videos_failed,
                "deliveries_sent": stats.deliveries_sent,
                "deliveries_failed": stats.deliveries_failed,
                "groq_seconds_today": stats.groq_seconds_today,
                "groq_cost_today": stats.groq_cost_today,
            })
        except Exception as e:
            logger.warning(f"WorkerStats periodic save failed: {e}")


# ── Main ───────────────────────────────────────────────────────

async def main():
    logger.info("=" * 50)
    logger.info("BriefTube SaaS Worker starting...")
    logger.info("=" * 50)

    # Enforce single instance: kill stale process, write PID file.
    # Must run before any loops start so orphan processes can't race.
    _enforce_single_instance()

    # ── Crash recovery ─────────────────────────────────────────────
    # Reset deliveries stuck in 'sending' — claimed but never completed.
    try:
        n = db.reset_sending_deliveries()
        if n:
            logger.warning(f"Crash recovery: reset {n} stuck 'sending' deliveries → 'pending'")
    except Exception as e:
        logger.warning(f"Could not reset sending deliveries: {e}")

    # Reset processing_queue jobs stuck in 'processing' — worker crashed mid-job.
    try:
        n = db.reset_stuck_processing_jobs(timeout_seconds=VIDEO_TIMEOUT + 100)
        if n:
            logger.warning(f"Crash recovery: reset {n} stuck 'processing' jobs → 'queued'")
    except Exception as e:
        logger.warning(f"Could not reset stuck processing jobs: {e}")

    # Lower process priority so the worker never starves other applications.
    # nice=10 means any normal-priority process (nice=0) will be preferred by
    # the kernel scheduler. Has no effect on I/O-bound work (network, Supabase).
    try:
        os.nice(10)
        logger.info("Process priority lowered (nice=10) — system stays responsive")
    except OSError as e:
        logger.warning(f"Could not set nice value: {e}")

    logger.info(f"Resource throttle: CPU>{MAX_CPU_PERCENT}% | load>{_CPU_COUNT * MAX_LOAD_PER_CPU:.1f} | RAM<{MIN_FREE_RAM_MB}MB → pause before next job")

    # Validate config
    if not SUPABASE_URL:
        logger.error("SUPABASE_URL not set")
        return
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        return

    logger.info(f"Supabase: {SUPABASE_URL[:30]}...")
    logger.info(f"RSS interval: {RSS_CHECK_INTERVAL}s")
    if ADMIN_TELEGRAM_CHAT_ID:
        logger.info(f"Monitoring enabled for chat_id: {ADMIN_TELEGRAM_CHAT_ID}")
    else:
        logger.warning("No ADMIN_TELEGRAM_CHAT_ID set - monitoring alerts disabled")

    # Start Telegram bot
    bot_app = create_bot_application()
    await bot_app.initialize()
    await bot_app.start()

    # Register the slash-command menu (left of the Telegram input bar)
    await setup_bot_commands(bot_app)

    # Initialize monitoring alert system
    alert_system = MonitoringAlert(bot_app, ADMIN_TELEGRAM_CHAT_ID)
    bot_app.bot_data["alert_system"] = alert_system

    # Send startup alert
    if ADMIN_TELEGRAM_CHAT_ID:
        await alert_system.send_alert(
            "🚀 **Worker Started**\n\n"
            f"RSS interval: {RSS_CHECK_INTERVAL}s\n"
            "All systems operational",
            level="INFO"
        )

    # Check cookie health and alert if degraded
    cookie_health = validate_cookies()
    if not cookie_health["ok"]:
        missing = cookie_health["missing_critical"]
        expired = cookie_health["expired"]
        parts = []
        if missing:
            parts.append(f"Missing critical: {', '.join(missing)}")
        if expired:
            parts.append(f"Expired: {', '.join(expired)}")
        await alert_system.send_alert(
            f"⚠️ <b>YouTube cookies degraded</b>\n\n"
            f"{chr(10).join(parts)}\n\n"
            f"Send a fresh <code>cookies.txt</code> file to this log bot to update.\n"
            f"Export from Chrome: <i>EditThisCookie</i> or <i>Get cookies.txt LOCALLY</i> extension.\n"
            f"Must be logged in to youtube.com.",
            level="WARNING",
        )
    elif cookie_health.get("age_days", 0) > 14:
        await alert_system.send_alert(
            f"ℹ️ YouTube cookies are {cookie_health['age_days']} days old — consider refreshing.",
            level="INFO",
        )

    try:
        # Run all loops concurrently (including alert processor)
        tasks = [
            rss_loop(alert_system),
            websub_loop(alert_system),
            processor_loop(alert_system),
            _supervised_delivery_loop(alert_system),  # self-healing wrapper
            _bot_poll_loop(bot_app),
            health_loop(),
            stats_save_loop(),
        ]

        # Add alert processor if admin configured
        if ADMIN_TELEGRAM_CHAT_ID:
            tasks.append(alert_system.process_alerts())

        await asyncio.gather(*tasks)

    finally:
        # Save stats before shutdown so today's counters survive the restart
        try:
            shutdown_date = datetime.now(timezone.utc).date().isoformat()
            await asyncio.to_thread(db.save_worker_stats, shutdown_date, {
                "videos_processed": stats.videos_processed,
                "videos_failed": stats.videos_failed,
                "deliveries_sent": stats.deliveries_sent,
                "deliveries_failed": stats.deliveries_failed,
                "groq_seconds_today": stats.groq_seconds_today,
                "groq_cost_today": stats.groq_cost_today,
            })
            logger.info("WorkerStats saved on shutdown")
        except Exception as e:
            logger.warning(f"Could not save WorkerStats on shutdown: {e}")

        # Send shutdown alert
        if ADMIN_TELEGRAM_CHAT_ID:
            await alert_system.send_alert(
                "🛑 **Worker Stopped**\n\n"
                f"Uptime: {stats.get_uptime()}\n"
                f"Videos processed: {stats.videos_processed}",
                level="WARNING"
            )
            await alert_system.stop()

        await bot_app.stop()
        await bot_app.shutdown()


async def processor_main():
    """Processor-only mode: picks and processes jobs from the shared queue.

    Designed to run as N parallel instances on the same machine or across
    different VPS nodes. Each instance claims jobs atomically via PostgreSQL
    FOR UPDATE SKIP LOCKED — no job is ever processed twice.

    Start instance 0 : WORKER_MODE=processor WORKER_INSTANCE=0
    Start instance 1 : WORKER_MODE=processor WORKER_INSTANCE=1
    (Each gets its own health check port: 8080+N)
    """
    label = f"Processor#{WORKER_INSTANCE}"
    logger.info("=" * 50)
    logger.info(f"BriefTube {label} starting...")
    logger.info("=" * 50)

    # Crash recovery: reset jobs this instance may have left stuck in 'processing'.
    try:
        n = db.reset_stuck_processing_jobs(timeout_seconds=VIDEO_TIMEOUT + 100)
        if n:
            logger.warning(f"[{label}] Crash recovery: reset {n} stuck 'processing' jobs → 'queued'")
    except Exception as e:
        logger.warning(f"[{label}] Could not reset stuck processing jobs: {e}")

    try:
        os.nice(10)
    except OSError:
        pass

    logger.info(f"[{label}] Resource throttle: CPU>{MAX_CPU_PERCENT}% | load>{_CPU_COUNT * MAX_LOAD_PER_CPU:.1f} | RAM<{MIN_FREE_RAM_MB}MB")
    logger.info(f"[{label}] Concurrent slots: {MAX_CONCURRENT_VIDEOS}")

    # No Telegram bot, no scanner, no deliverer — null alert system is sufficient.
    alert_system = _NullAlert()

    await asyncio.gather(
        processor_loop(alert_system),
        health_loop(),
    )


if __name__ == "__main__":
    import sys
    worker_mode = os.getenv("WORKER_MODE", "full")
    if worker_mode == "processor":
        asyncio.run(processor_main())
    else:
        asyncio.run(main())
