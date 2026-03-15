"""TTS processor — converts text summaries to audio files."""

import asyncio
import logging
import time
import uuid
from pathlib import Path
import edge_tts

from config import DEFAULT_TTS_VOICE, AUDIO_DIR

logger = logging.getLogger(__name__)


async def text_to_audio(text: str, voice: str = None, output_filename: str = None) -> Path:
    """Convert text to audio using edge-tts.

    Args:
        text: The text to convert
        voice: TTS voice ID (e.g. 'fr-FR-DeniseNeural'). Uses default if None.
        output_filename: Optional filename (without extension)

    Returns:
        Path to the generated MP3 file
    """
    voice = voice or DEFAULT_TTS_VOICE
    if not output_filename:
        output_filename = f"summary_{uuid.uuid4().hex[:8]}"

    output_path = AUDIO_DIR / f"{output_filename}.mp3"

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))

    logger.info(f"Audio generated: {output_path.name} ({voice})")
    return output_path


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
