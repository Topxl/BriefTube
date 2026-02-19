#!/usr/bin/env python3
"""
BriefTube SaaS Worker

Three concurrent loops:
1. RSS Scanner   — checks channels for new videos (every 5 min)
2. Gemini Processor — summarizes + generates TTS audio
3. Telegram Deliverer — sends audio to subscribed users
"""

import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from config import RSS_CHECK_INTERVAL, TELEGRAM_BOT_TOKEN, SUPABASE_URL, ADMIN_TELEGRAM_CHAT_ID, MAX_CONCURRENT_VIDEOS
from transcript_extractor import TranscriptExtractor
from gemini_api import GeminiSummarizer
from text_cleaner import clean_for_tts
from tts_processor import text_to_audio, cleanup_audio_files
from telegram_deliverer import send_audio_to_user
from bot_handler import create_bot_application
from monitoring import stats, MonitoringAlert, send_daily_report
import rss_scanner
import db
from datetime import datetime, time as datetime_time

# ── Logging ────────────────────────────────────────────────────

LOG_FILE = Path(__file__).parent / "worker.log"
log_fmt = logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s")

root = logging.getLogger()
root.setLevel(logging.INFO)

fh = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8")
fh.setFormatter(log_fmt)
root.addHandler(fh)

ch = logging.StreamHandler()
ch.setFormatter(log_fmt)
root.addHandler(ch)

logger = logging.getLogger("worker")

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
# Suppress verbose Conflict errors from Updater polling (another instance may hold the session)
logging.getLogger("telegram.ext.Updater").setLevel(logging.CRITICAL)

# ── Constants ──────────────────────────────────────────────────

VIDEO_TIMEOUT = 600  # 10 minutes max per video


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
    alert_system: MonitoringAlert,
) -> None:
    """Process one video job: transcript → Gemini summary → TTS → upload → mark done."""
    video_id = job["video_id"]
    youtube_url = job["youtube_url"]
    video_title = job.get("video_title", video_id)
    start_time = datetime.now()

    logger.info(f"[{video_id}] Processing: {video_title}")

    try:
        user_language = job.get("user_language", "fr")
        tts_voice = job.get("tts_voice") or None

        # Step 1: Extract transcript
        logger.info(f"[{video_id}] Extracting transcript...")
        transcript, source_lang, error, transcript_cost = await asyncio.to_thread(
            transcript_extractor.get_transcript,
            youtube_url,
            preferred_languages=[user_language, 'fr', 'en']
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
            import re as _re
            m = _re.search(r"Used (\d+), Requested (\d+)", error)
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
            logger.error(f"[{video_id}] Transcript extraction failed: {error}")
            if TranscriptExtractor.should_retry(error):
                logger.info(f"[{video_id}] Will retry later")
                db.fail_job(job["id"])
            else:
                raise Exception(f"Transcript extraction failed: {error}")
            return

        logger.info(
            f"[{video_id}] Transcript: {len(transcript)} chars, "
            f"lang: {source_lang}, cost: ${transcript_cost:.4f}"
        )

        # Step 2: Summarize
        logger.info(f"[{video_id}] Generating summary...")
        summary, summary_error = await asyncio.to_thread(
            gemini_summarizer.summarize,
            transcript=transcript,
            source_language=source_lang,
            target_language=user_language,
            video_url=youtube_url
        )

        if not summary:
            raise Exception(f"Summary generation failed: {summary_error}")

        logger.info(f"[{video_id}] Summary: {len(summary)} chars")

        # Step 3: Clean + TTS
        clean_summary = clean_for_tts(summary)
        logger.info(f"[{video_id}] Generating audio...")
        audio_path = await text_to_audio(
            clean_summary,
            voice=tts_voice,
            output_filename=f"video_{video_id}"
        )

        # Step 4: Upload to Supabase Storage
        audio_url = ""
        try:
            sb = db.get_client()
            with open(audio_path, "rb") as f:
                storage_path = f"audio/{video_id}.mp3"
                sb.storage.from_("audio").upload(
                    storage_path,
                    f.read(),
                    {"content-type": "audio/mpeg", "upsert": "true"},
                )
            audio_url = sb.storage.from_("audio").get_public_url(storage_path)
        except Exception as e:
            logger.warning(f"[{video_id}] Storage upload failed (using local): {e}")
            audio_url = str(audio_path)

        # Step 5: Mark done
        db.mark_video_completed(
            video_id, summary, audio_url,
            metadata={
                "transcript_cost": transcript_cost,
                "transcript_length": len(transcript),
                "source_language": source_lang,
                "summary_length": len(summary),
            }
        )
        db.complete_job(job["id"])

        processing_time = (datetime.now() - start_time).total_seconds()
        stats.record_video_processed(processing_time)

        logger.info(
            f"✅ [{video_id}] Done: {video_title} "
            f"(transcript: ${transcript_cost:.4f}, source: {source_lang}, "
            f"summary: {len(summary)} chars, time: {processing_time:.1f}s)"
        )
        await alert_system.send_alert(
            f"✅ **Video processed**\n\n"
            f"Title: {video_title[:60]}\n"
            f"Time: {processing_time:.1f}s | Cost: ${transcript_cost:.4f}",
            level="SUCCESS"
        )

    except asyncio.TimeoutError:
        logger.error(f"[{video_id}] Timeout")
        db.fail_job(job["id"])
        db.mark_video_failed(video_id)
        stats.record_video_failed("Timeout", f"Timeout: {video_title}")
        await alert_system.send_alert(f"⏱️ **Timeout**\n\n{video_title[:80]}", level="WARNING")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{video_id}] Error: {error_msg}")
        db.fail_job(job["id"])
        db.mark_video_failed(video_id)
        stats.record_video_failed(type(e).__name__, error_msg)
        await alert_system.send_alert(
            f"🔴 **Error**\n\nVideo: {video_title[:60]}\nError: {error_msg[:100]}",
            level="ERROR"
        )


# ── Loop 2: Gemini Processor (concurrent) ─────────────────────

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

    # Semaphore: at most MAX_CONCURRENT_VIDEOS tasks running at once
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VIDEOS)

    while True:
        try:
            # Block here until a processing slot is free
            await semaphore.acquire()

            # Serialize job picking — prevents two concurrent tasks picking the same row
            async with _pick_lock:
                job = await asyncio.to_thread(db.pick_next_job)

            if not job:
                semaphore.release()
                await asyncio.sleep(10)
                continue

            # Dispatch to a background task; semaphore released when done
            async def _do(j: dict) -> None:
                try:
                    await _process_video(j, transcript_extractor, gemini_summarizer, alert_system)
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


# ── Loop 3: Telegram Deliverer ─────────────────────────────────

async def delivery_loop(alert_system: MonitoringAlert):
    """Send completed audio to subscribed users."""
    logger.info("Telegram Deliverer started")

    _cleanup_counter = 0  # Run cleanup every N cycles

    while True:
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

            # Get pending deliveries with retry on connection errors
            deliveries = []
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    deliveries = db.get_pending_deliveries(limit=10)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Delivery fetch failed (attempt {attempt + 1}/{max_retries}): {e}")
                        db.reset_client()  # Force reconnect before retry
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    else:
                        raise

            for d in deliveries:
                try:
                    video_id = d["video_id"]
                    audio_url = d.get("audio_url", "")

                    # Get or download audio file
                    audio_path = Path(__file__).parent / "audio" / f"video_{video_id}.mp3"

                    if not audio_path.exists() and audio_url and audio_url.startswith("http"):
                        # Download from Supabase Storage
                        import aiohttp
                        async with aiohttp.ClientSession() as session:
                            async with session.get(audio_url) as resp:
                                if resp.status == 200:
                                    audio_path.parent.mkdir(exist_ok=True)
                                    with open(audio_path, "wb") as f:
                                        f.write(await resp.read())

                    if not audio_path.exists():
                        # Regenerate audio from summary
                        if d.get("summary"):
                            voice = d.get("tts_voice") or None
                            audio_path = await text_to_audio(
                                d["summary"], voice=voice, output_filename=f"video_{video_id}"
                            )
                        else:
                            logger.warning(f"No audio for {video_id}")
                            db.mark_delivery_failed(d["delivery_id"])
                            continue

                    # Send to user
                    success = await send_audio_to_user(
                        chat_id=d["chat_id"],
                        audio_path=audio_path,
                        video_title=d["video_title"],
                        video_id=video_id,
                        channel_id=d["channel_id"],
                    )

                    if success:
                        # Retry marking as sent to survive transient Supabase
                        # errors — a failure here would leave the delivery
                        # "pending" and cause a re-send on the next cycle.
                        for _attempt in range(3):
                            try:
                                db.mark_delivery_sent(d["delivery_id"])
                                stats.record_delivery_sent()
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
                    else:
                        db.mark_delivery_failed(d["delivery_id"])
                        stats.record_delivery_failed()

                    # Rate limit: 1 message per second
                    await asyncio.sleep(1)

                except Exception as e:
                    logger.error(f"Delivery error: {e}")
                    db.mark_delivery_failed(d["delivery_id"])

            if not deliveries:
                await asyncio.sleep(15)

            # Cleanup old audio files every cycle
            cleanup_audio_files(max_age_hours=1)

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


# ── Main ───────────────────────────────────────────────────────

async def main():
    logger.info("=" * 50)
    logger.info("BriefTube SaaS Worker starting...")
    logger.info("=" * 50)

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

    # Start Telegram bot (polling in background)
    # Polling is optional: if another instance already holds the session, we
    # skip command handling but keep delivery (which uses Bot directly).
    bot_app = create_bot_application()
    await bot_app.initialize()
    await bot_app.start()
    try:
        await bot_app.updater.start_polling(allowed_updates=["message"], drop_pending_updates=True)
        logger.info("Telegram bot polling started")
    except Exception as e:
        logger.warning(f"Bot polling failed to start (another instance may be running): {e}")
        logger.info("Continuing without command handler — deliveries will still work")

    # Initialize monitoring alert system
    alert_system = MonitoringAlert(bot_app, ADMIN_TELEGRAM_CHAT_ID)

    # Send startup alert
    if ADMIN_TELEGRAM_CHAT_ID:
        await alert_system.send_alert(
            "🚀 **Worker Started**\n\n"
            f"RSS interval: {RSS_CHECK_INTERVAL}s\n"
            "All systems operational",
            level="INFO"
        )

    try:
        # Run all loops concurrently (including alert processor)
        tasks = [
            rss_loop(alert_system),
            processor_loop(alert_system),
            delivery_loop(alert_system),
        ]

        # Add alert processor if admin configured
        if ADMIN_TELEGRAM_CHAT_ID:
            tasks.append(alert_system.process_alerts())

        await asyncio.gather(*tasks)

    finally:
        # Send shutdown alert
        if ADMIN_TELEGRAM_CHAT_ID:
            await alert_system.send_alert(
                "🛑 **Worker Stopped**\n\n"
                f"Uptime: {stats.get_uptime()}\n"
                f"Videos processed: {stats.videos_processed}",
                level="WARNING"
            )
            await alert_system.stop()

        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
