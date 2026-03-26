"""TTS processor — converts text summaries to audio files.

Fallback chain:
  1. Edge TTS (Microsoft, free) — 3 attempts with backoff
  2. gTTS (Google, free, lower quality) — emergency fallback
"""

import asyncio
import logging
import time
import uuid
from pathlib import Path
import edge_tts

from config import DEFAULT_TTS_VOICE, AUDIO_DIR

logger = logging.getLogger(__name__)

# Transient Edge TTS error keywords (WSS / server-side outage)
_EDGE_TTS_TRANSIENT = ("speech.platform.bing.com", "503", "websocket", "wss://")


def _is_edge_tts_outage(err: Exception) -> bool:
    """Check if an exception indicates a transient Edge TTS outage."""
    msg = str(err).lower()
    return any(kw in msg for kw in _EDGE_TTS_TRANSIENT)


async def text_to_audio(text: str, voice: str = None, output_filename: str = None) -> Path:
    """Convert text to audio. Tries Edge TTS (3×), then falls back to gTTS.

    Args:
        text: The text to convert
        voice: TTS voice ID (e.g. 'fr-FR-DeniseNeural'). Uses default if None.
        output_filename: Optional filename (without extension)

    Returns:
        Path to the generated MP3 file

    Raises:
        RuntimeError: If both Edge TTS and gTTS fallback fail
    """
    voice = voice or DEFAULT_TTS_VOICE
    if not output_filename:
        output_filename = f"summary_{uuid.uuid4().hex[:8]}"

    output_path = AUDIO_DIR / f"{output_filename}.mp3"

    # ── Step 1: Edge TTS with retry ───────────────────────────────────────
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_path))
            logger.info(f"Audio generated: {output_path.name} ({voice})")
            return output_path
        except Exception as e:
            last_err = e
            if _is_edge_tts_outage(e) and attempt < 2:
                wait = 2 ** (attempt + 1)  # 2s, 4s
                logger.warning(
                    f"Edge TTS attempt {attempt + 1}/3 failed ({e}) — retry in {wait}s"
                )
                await asyncio.sleep(wait)
            else:
                break  # Non-transient or last attempt — skip to fallback

    # ── Step 2: gTTS fallback ─────────────────────────────────────────────
    lang = (voice or DEFAULT_TTS_VOICE).split("-")[0].lower()  # "fr-FR-DeniseNeural" → "fr"
    logger.warning(
        f"Edge TTS failed ({last_err}) — falling back to gTTS (lang={lang})"
    )
    try:
        await asyncio.to_thread(_gtts_save, text, lang, output_path)
        logger.info(f"Audio generated via gTTS fallback: {output_path.name} (lang={lang})")
        return output_path
    except Exception as gtts_err:
        raise RuntimeError(
            f"Both Edge TTS and gTTS failed — Edge: {last_err} | gTTS: {gtts_err}"
        ) from gtts_err


def _gtts_save(text: str, lang: str, output_path: Path) -> None:
    """Blocking gTTS call — run in a thread via asyncio.to_thread."""
    from gtts import gTTS  # lazy import — only needed as fallback
    gTTS(text=text, lang=lang, slow=False).save(str(output_path))


def cleanup_audio_files(max_age_hours: int = 1) -> int:
    """Delete audio files older than max_age_hours."""
    count = 0
    now = time.time()
    for f in AUDIO_DIR.glob("*.mp3"):
        try:
            if now - f.stat().st_mtime > max_age_hours * 3600:
                f.unlink()
                count += 1
        except Exception as e:
            logger.warning(f"Could not delete audio file {f.name}: {e}")
    return count
