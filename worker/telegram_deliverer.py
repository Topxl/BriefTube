"""Telegram Deliverer — sends audio summaries to users."""

import asyncio
import html as _html
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, LinkPreviewOptions

from config import TELEGRAM_BOT_TOKEN

logger = logging.getLogger(__name__)

_bot: Bot | None = None

# ffmpeg binary — prefer system PATH, fall back to Linuxbrew location
_FFMPEG = shutil.which("ffmpeg") or "/home/linuxbrew/.linuxbrew/bin/ffmpeg"


def get_bot() -> Bot:
    """Return the shared Bot singleton — creates it on first call."""
    global _bot
    if _bot is None:
        _bot = Bot(token=TELEGRAM_BOT_TOKEN)
    return _bot


def get_thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


async def _convert_to_ogg(mp3_path: Path) -> Path:
    """Convert an MP3 to OGG/OPUS so Telegram shows a voice waveform with speed control.

    Telegram's send_voice requires OGG encoded with OPUS for the waveform player
    (1×/1.5×/2× speed control).  MP3 sent via send_voice is accepted but rendered
    as a plain audio document without the speed slider.

    Returns the path to the temporary OGG file; caller is responsible for deleting it.
    Raises RuntimeError if ffmpeg exits with a non-zero status.
    """
    ogg_path = Path(tempfile.mktemp(suffix=".ogg"))
    cmd = [
        _FFMPEG,
        "-y",
        "-i", str(mp3_path),
        "-c:a", "libopus",
        "-b:a", "48k",
        "-ar", "48000",
        "-ac", "1",
        "-vn",
        str(ogg_path),
    ]
    proc = await asyncio.to_thread(
        subprocess.run, cmd, capture_output=True, timeout=120
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg exited {proc.returncode}: {proc.stderr.decode()[:200]}")
    return ogg_path


async def send_audio_to_user(
    chat_id: str,
    audio_path: Path,
    video_title: str,
    video_id: str,
    channel_id: str,
    language: str = "fr",
) -> bool:
    """Deliver an audio summary to a Telegram user as two visually linked messages.

    Message 1 — text with YouTube URL
        Telegram renders YouTube URLs as expandable inline previews with a play
        button.  This only works in plain text messages — link previews are NOT
        shown in media captions (Telegram platform limitation).

    Message 2 — voice reply (OGG/OPUS)
        Displayed with a waveform and speed-control buttons (1×/1.5×/2×).
        Appears as a reply to message 1 so both are visually grouped.
        Carries the ⋯ Options inline button.

    Returns True if the audio was delivered (or at least the preview link was sent).
    Returns False only if nothing reached the user at all.
    """
    try:
        chat_id_int = int(chat_id)
    except (ValueError, TypeError):
        logger.error(f"Invalid chat_id format: {chat_id!r}")
        return False

    bot = get_bot()
    video_url = f"https://youtu.be/{video_id}"

    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("⚙️", callback_data=f"options_{video_id}_{language}")
    ]])

    # ── Step 1: Convert MP3 → OGG/OPUS ─────────────────────────────────────
    ogg_path: Path | None = None
    try:
        ogg_path = await _convert_to_ogg(audio_path)
    except Exception as e:
        logger.warning(f"OGG conversion failed for {video_id} — will try MP3 via send_voice: {e}")

    # ── Step 2: Send text message with YouTube URL (inline preview) ─────────
    title_escaped = _html.escape(video_title)
    preview_msg = None
    try:
        preview_msg = await bot.send_message(
            chat_id=chat_id_int,
            text=f"<b>{title_escaped}</b>\n{video_url}",
            parse_mode="HTML",
            link_preview_options=LinkPreviewOptions(prefer_large_media=True),
        )
    except Exception as e:
        logger.warning(f"Preview message failed for chat {chat_id}: {e}")

    # ── Step 3: Send voice as a reply to the preview message ────────────────
    # Use OGG if available, otherwise fall back to the original MP3.
    # We do NOT retry after a failure to avoid sending duplicates
    # (a Telegram API error does not guarantee the message wasn't delivered).
    reply_to = preview_msg.message_id if preview_msg else None
    voice_file = ogg_path if (ogg_path and ogg_path.exists()) else audio_path

    try:
        with open(voice_file, "rb") as f:
            await bot.send_voice(
                chat_id=chat_id_int,
                voice=f,
                reply_to_message_id=reply_to,
                reply_markup=keyboard,
            )
        logger.info(f"Delivered to chat {chat_id}: {video_title[:60]}")
        return True

    except Exception as e:
        logger.error(f"send_voice failed for chat {chat_id}: {e}")

    finally:
        if ogg_path:
            try:
                ogg_path.unlink(missing_ok=True)
            except Exception:
                pass

    # Voice failed — if the preview went through, the user at least has the link
    if preview_msg:
        logger.warning(f"Audio failed but YouTube preview sent to chat {chat_id}: {video_title[:40]}")
        return True

    return False
