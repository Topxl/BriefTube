"""Telegram Deliverer — sends audio summaries to users."""

import logging
from pathlib import Path
from telegram import Bot

from config import TELEGRAM_BOT_TOKEN

logger = logging.getLogger(__name__)

_bot: Bot | None = None


def get_bot() -> Bot:
    """Return the shared Bot singleton — creates it on first call."""
    global _bot
    if _bot is None:
        _bot = Bot(token=TELEGRAM_BOT_TOKEN)
    return _bot


def get_thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def escape_markdown(text: str) -> str:
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text


async def send_audio_to_user(
    chat_id: str,
    audio_path: Path,
    video_title: str,
    video_id: str,
    channel_id: str,
) -> bool:
    """Send thumbnail + audio to a Telegram user.

    Returns True if successful.
    """
    try:
        chat_id_int = int(chat_id)
    except (ValueError, TypeError):
        logger.error(f"Invalid chat_id format: {chat_id!r}")
        return False

    bot = get_bot()
    video_url = f"https://youtu.be/{video_id}"
    thumbnail_url = get_thumbnail_url(video_id)

    safe_title = escape_markdown(video_title)
    safe_url = escape_markdown(video_url)
    caption = f"*{safe_title}*\n\n{safe_url}"

    photo_msg = None
    try:
        # Send thumbnail
        photo_msg = await bot.send_photo(
            chat_id=chat_id_int,
            photo=thumbnail_url,
            caption=caption,
            parse_mode="MarkdownV2",
        )

        # Send voice as reply
        with open(audio_path, "rb") as f:
            await bot.send_voice(
                chat_id=chat_id_int,
                voice=f,
                reply_to_message_id=photo_msg.message_id,
            )

        logger.info(f"Delivered to chat {chat_id}: {video_title[:40]}")
        return True

    except Exception as e:
        logger.error(f"Failed to deliver to chat {chat_id}: {e}")

        if photo_msg is not None:
            # Thumbnail already sent — only the voice failed.
            # Retry the voice as a reply to the existing photo instead of
            # sending a new standalone message (which would create a duplicate).
            try:
                with open(audio_path, "rb") as f:
                    await bot.send_voice(
                        chat_id=chat_id_int,
                        voice=f,
                        reply_to_message_id=photo_msg.message_id,
                    )
                logger.info(f"Voice retry succeeded for chat {chat_id}: {video_title[:40]}")
                return True
            except Exception as e2:
                logger.error(f"Voice retry after photo also failed: {e2}")
                # Return True to prevent re-sending the thumbnail on the next
                # cycle; the user at least got the photo with the title.
                return True
        else:
            # Nothing sent yet — try voice-only fallback (no thumbnail)
            try:
                with open(audio_path, "rb") as f:
                    await bot.send_voice(
                        chat_id=chat_id_int,
                        voice=f,
                        caption=caption,
                        parse_mode="MarkdownV2",
                    )
                logger.info(f"Voice-only fallback succeeded for chat {chat_id}: {video_title[:40]}")
                return True
            except Exception as e2:
                logger.error(f"Fallback delivery also failed: {e2}")
                return False
