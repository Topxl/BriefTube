"""Modal.com compute function for BriefTube video processing.

Handles the CPU/IO-intensive pipeline:
  1. Transcript extraction (youtube_api → invidious → piped → yt-dlp → Groq Whisper)
  2. AI summarization (Gemini → OpenRouter fallback)
  3. Text-to-speech (Edge TTS → gTTS fallback)
  4. Audio upload to Cloudflare R2

The Pi orchestrator calls compute_video.remote.aio() and handles all DB state
management, error routing, retry logic, and Telegram delivery.

Deploy: modal deploy worker/modal_processor.py  (run from repo root)
"""

import modal

APP_NAME = "brieftube"

app = modal.App(APP_NAME)

brieftube_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "curl")
    .pip_install(
        "edge-tts>=6.1.0",
        "python-dotenv>=1.0.0",
        "google-genai>=1.63.0",
        "youtube-transcript-api>=1.2.4",
        "groq>=1.0.0",
        "yt-dlp>=2026.2.0",
        "boto3>=1.34.0",
        "openai>=1.0.0",
        "gtts>=2.0.0",
        "aiohttp>=3.9.0",
        "supabase>=2.0.0",
        "psutil>=5.9.0",
    )
    # Add worker source code into the image at build time (Modal 1.x API)
    .add_local_dir("worker", remote_path="/worker")
)


@app.function(
    image=brieftube_image,
    secrets=[modal.Secret.from_name("brieftube-worker")],
    timeout=1200,
    retries=0,  # Pi handles retry logic
)
async def compute_video(
    video_id: str,
    youtube_url: str,
    video_title: str,
    user_language: str = "fr",
    summary_length_pref: str = "auto",
    summary_style: str = "narrative",
    summary_custom_instructions: str = "",
    audio_enabled: bool = True,
    tts_voice: str = "fr-FR-DeniseNeural",
    cached_transcript: str | None = None,
    cached_transcript_lang: str | None = None,
    cached_transcript_source: str | None = None,
    cached_transcript_cost: float = 0.0,
) -> dict:
    """Process a video and return computed results. Pi handles DB + delivery."""
    import sys
    import os
    import time
    import logging
    import subprocess

    sys.path.insert(0, "/worker")
    os.chdir("/worker")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    )
    log = logging.getLogger("modal")

    t0 = time.monotonic()
    result: dict = {
        "transcript": None,
        "source_lang": None,
        "transcript_source": None,
        "transcript_cost": 0.0,
        "invidious_title": "",
        "summary": None,
        "model_used": None,
        "summary_cost": 0.0,
        "audio_url": None,
        "audio_duration": None,
        "error": None,
        "error_type": None,
        "timings": {},
    }

    # ── 1. TRANSCRIPT ──────────────────────────────────────────────────────
    if cached_transcript:
        transcript = cached_transcript
        source_lang = cached_transcript_lang or "unknown"
        transcript_cost = cached_transcript_cost
        result["transcript_source"] = cached_transcript_source or "cache"
        result["invidious_title"] = ""
        log.info(f"[{video_id}] Using cached transcript ({len(transcript)} chars)")
    else:
        log.info(f"[{video_id}] Extracting transcript...")
        try:
            from transcript_extractor import TranscriptExtractor
            extractor = TranscriptExtractor(enable_whisper_fallback=True)
            transcript, source_lang, error, transcript_cost = extractor.get_transcript(
                youtube_url,
                preferred_languages=[user_language, "fr", "en"],
                video_title=video_title,
            )
            result["transcript_source"] = extractor.last_transcript_source or "unknown"
            result["invidious_title"] = extractor.last_video_metadata.get("title", "")
        except Exception as e:
            result["error"] = str(e)
            result["error_type"] = "transcript_exception"
            return result

        if not transcript:
            result["error"] = error or "no_transcript"
            result["error_type"] = "transcript_error"
            return result

    t_transcript = time.monotonic() - t0
    result.update({
        "transcript": transcript,
        "source_lang": source_lang,
        "transcript_cost": transcript_cost,
    })
    result["timings"]["transcript_ms"] = int(t_transcript * 1000)
    log.info(
        f"[{video_id}] Transcript: {len(transcript)} chars, "
        f"lang={source_lang}, cost=${transcript_cost:.4f}"
    )

    if len(transcript.strip()) < 200:
        result["error"] = "transcript_too_short"
        result["error_type"] = "transcript_error"
        return result

    # ── 2. SUMMARY ─────────────────────────────────────────────────────────
    log.info(f"[{video_id}] Generating summary...")
    summary = None
    sum_error = None
    model_used = None
    sum_cost: float = 0.0

    try:
        from gemini_api import GeminiSummarizer
        gemini = GeminiSummarizer()
        summary, sum_error, model_used, sum_cost = gemini.summarize(
            transcript=transcript,
            source_language=source_lang,
            target_language=user_language,
            length_pref=summary_length_pref,
            style_pref=summary_style,
            custom_instructions=summary_custom_instructions,
        )
    except Exception as e:
        result["error"] = str(e)
        result["error_type"] = "summary_exception"
        return result

    if not summary and sum_error == "rate_limited":
        try:
            from openrouter_api import OpenRouterSummarizer
            or_s = OpenRouterSummarizer()
            summary, or_error, model_used, sum_cost = or_s.summarize(
                transcript=transcript,
                source_language=source_lang,
                target_language=user_language,
                length_pref=summary_length_pref,
                style_pref=summary_style,
                custom_instructions=summary_custom_instructions,
            )
            if not summary:
                result["error"] = "rate_limited"
                result["error_type"] = "summary_error"
                return result
        except Exception as e:
            result["error"] = str(e)
            result["error_type"] = "summary_exception"
            return result
    elif not summary:
        result["error"] = sum_error or "summary_failed"
        result["error_type"] = "summary_error"
        return result

    t_summary = time.monotonic() - t0 - t_transcript
    result.update({
        "summary": summary,
        "model_used": model_used,
        "summary_cost": sum_cost or 0.0,
    })
    result["timings"]["summary_ms"] = int(t_summary * 1000)
    log.info(f"[{video_id}] Summary: {len(summary)} chars, model={model_used}")

    if not audio_enabled:
        result["timings"]["tts_ms"] = 0
        result["timings"]["upload_ms"] = 0
        return result

    # ── 3. TTS ─────────────────────────────────────────────────────────────
    log.info(f"[{video_id}] Generating audio (voice={tts_voice})...")
    try:
        from text_cleaner import clean_for_tts
        from tts_processor import text_to_audio
        clean_text = clean_for_tts(summary)
        audio_path = await text_to_audio(
            clean_text,
            voice=tts_voice,
            output_filename=f"video_{video_id}",
        )
    except Exception as e:
        log.warning(f"[{video_id}] TTS failed (non-fatal): {e}")
        result["timings"]["tts_ms"] = 0
        result["timings"]["upload_ms"] = 0
        return result

    t_tts = time.monotonic() - t0 - t_transcript - t_summary
    result["timings"]["tts_ms"] = int(t_tts * 1000)

    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
            capture_output=True, text=True,
        )
        if probe.returncode == 0:
            result["audio_duration"] = round(float(probe.stdout.strip()), 2)
    except Exception:
        pass

    # ── 4. R2 UPLOAD ───────────────────────────────────────────────────────
    log.info(f"[{video_id}] Uploading to R2...")
    try:
        import storage
        storage_key = f"audio/{video_id}_{user_language}.mp3"
        result["audio_url"] = storage.upload_audio(audio_path, storage_key)
        t_upload = time.monotonic() - t0 - t_transcript - t_summary - t_tts
        result["timings"]["upload_ms"] = int(t_upload * 1000)
        log.info(f"[{video_id}] Uploaded: {storage_key}")
    except Exception as e:
        log.warning(f"[{video_id}] R2 upload failed: {e}")
        result["timings"]["upload_ms"] = 0

    total = time.monotonic() - t0
    log.info(f"[{video_id}] Modal done in {total:.1f}s")
    return result
