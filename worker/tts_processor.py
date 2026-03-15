"""TTS processor — Kokoro ONNX (primary) with Edge TTS fallback."""

import asyncio
import logging
import os
import tempfile
import time
import uuid
from pathlib import Path

# Limit ONNX/OpenMP threads before any import loads onnxruntime.
# Without this, each Kokoro inference spawns threads on all CPU cores,
# which saturates the VPS when multiple videos process concurrently.
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

import edge_tts

from config import DEFAULT_TTS_VOICE, AUDIO_DIR, KOKORO_MODELS_DIR

logger = logging.getLogger(__name__)

# ── Kokoro configuration ──────────────────────────────────────

KOKORO_ONNX_PATH = KOKORO_MODELS_DIR / "kokoro-v1.0.int8.onnx"
KOKORO_VOICES_PATH = KOKORO_MODELS_DIR / "voices-v1.0.bin"

# Language code → (kokoro_voice_id, kokoro_lang_code)
# Languages not listed here automatically fall back to Edge TTS.
_KOKORO_VOICE_MAP: dict[str, tuple[str, str]] = {
    "en": ("af_heart",    "en-us"),
    "fr": ("ff_siwis",   "fr-fr"),
    "es": ("ef_dora",    "es"),
    "it": ("if_sara",    "it"),
    "pt": ("pf_dora",    "pt-br"),
    "ja": ("jf_alpha",   "ja"),
    "zh": ("zf_xiaobei", "zh"),
    "ko": ("kf_dayoung", "ko"),
    "hi": ("hf_alpha",   "hi"),
}

_kokoro: object | None = None
_kokoro_init_attempted: bool = False
_kokoro_lock = asyncio.Lock()
# Limit concurrent Kokoro inferences to avoid saturating all CPU cores.
# ONNX uses all threads per call — more than 2 parallel calls kills the VPS.
_kokoro_sem = asyncio.Semaphore(2)


async def _get_kokoro() -> object | None:
    """Lazy-initialize Kokoro ONNX (once). Returns None if unavailable."""
    global _kokoro, _kokoro_init_attempted
    if _kokoro_init_attempted:
        return _kokoro
    async with _kokoro_lock:
        if _kokoro_init_attempted:
            return _kokoro
        _kokoro_init_attempted = True
        if not KOKORO_ONNX_PATH.exists() or not KOKORO_VOICES_PATH.exists():
            logger.warning(
                f"Kokoro models not found in {KOKORO_MODELS_DIR} — using Edge TTS only. "
                "Run download_kokoro.py to install."
            )
            return None
        try:
            from kokoro_onnx import Kokoro  # type: ignore
            _kokoro = await asyncio.to_thread(
                Kokoro, str(KOKORO_ONNX_PATH), str(KOKORO_VOICES_PATH)
            )
            logger.info("Kokoro TTS initialized (ONNX, OMP_NUM_THREADS=2)")
        except Exception as e:
            logger.error(f"Kokoro initialization failed: {e} — falling back to Edge TTS")
        return _kokoro


def _lang_from_voice(voice: str) -> str:
    """Extract ISO language code from an Edge TTS voice ID.

    Examples:
        'fr-FR-DeniseNeural' → 'fr'
        'en-US-JennyNeural'  → 'en'
        'zh-CN-XiaoxiaoNeural' → 'zh'
    """
    return voice.split("-")[0].lower() if voice and "-" in voice else "fr"


async def _kokoro_generate(kokoro: object, text: str, lang_code: str, output_path: Path) -> bool:
    """Generate audio with Kokoro and save as MP3. Returns True on success."""
    if lang_code not in _KOKORO_VOICE_MAP:
        return False  # Language not supported — caller will use Edge TTS

    kokoro_voice, kokoro_lang = _KOKORO_VOICE_MAP[lang_code]

    try:
        import soundfile as sf  # type: ignore

        async with _kokoro_sem:
            samples, sample_rate = await asyncio.to_thread(
                kokoro.create, text, voice=kokoro_voice, speed=1.0, lang=kokoro_lang
            )

        # Write WAV to a temp file, then encode to MP3 with ffmpeg
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_wav = Path(tmp.name)

        await asyncio.to_thread(sf.write, str(tmp_wav), samples, sample_rate)

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", str(tmp_wav),
            "-codec:a", "libmp3lame", "-qscale:a", "4",
            str(output_path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        tmp_wav.unlink(missing_ok=True)

        if proc.returncode != 0:
            logger.warning("ffmpeg MP3 encoding failed — falling back to Edge TTS")
            return False

        return True

    except Exception as e:
        logger.warning(f"Kokoro generation error ({lang_code}): {e}")
        return False


async def text_to_audio(text: str, voice: str = None, output_filename: str = None) -> Path:
    """Convert text to audio.

    Tries Kokoro ONNX first (better quality, free, on-CPU).
    Falls back to Edge TTS when:
    - Kokoro models are not installed
    - The target language is not supported by Kokoro
    - Kokoro or ffmpeg fails

    Args:
        text: The text to convert.
        voice: Edge TTS voice ID (e.g. 'fr-FR-DeniseNeural'). Used to detect language.
        output_filename: Filename without extension. Auto-generated if None.

    Returns:
        Path to the generated MP3 file.
    """
    voice = voice or DEFAULT_TTS_VOICE
    if not output_filename:
        output_filename = f"summary_{uuid.uuid4().hex[:8]}"

    output_path = AUDIO_DIR / f"{output_filename}.mp3"
    lang_code = _lang_from_voice(voice)

    # ── Try Kokoro ────────────────────────────────────────────
    kokoro = await _get_kokoro()
    if kokoro is not None:
        success = await _kokoro_generate(kokoro, text, lang_code, output_path)
        if success:
            logger.info(f"Audio generated (Kokoro/{lang_code}): {output_path.name}")
            return output_path
        if lang_code in _KOKORO_VOICE_MAP:
            logger.warning(f"Kokoro failed for lang '{lang_code}' — falling back to Edge TTS")

    # ── Fallback: Edge TTS ────────────────────────────────────
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))
    logger.info(f"Audio generated (Edge TTS): {output_path.name} ({voice})")
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
