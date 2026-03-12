"""WhatsApp Deliverer — envoie un message audio via Twilio."""

import httpx
import logging
import os

logger = logging.getLogger(__name__)
TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts"


async def send_to_whatsapp(
    phone: str,
    video_title: str,
    video_id: str,
    audio_url: str,
) -> bool:
    """Send an audio summary to a WhatsApp number via Twilio."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM")

    if not account_sid or not auth_token or not from_number:
        logger.warning("WhatsApp delivery skipped: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_WHATSAPP_FROM not set")
        return False

    if not audio_url:
        logger.warning(f"WhatsApp delivery skipped: no audio_url for {video_id}")
        return False

    payload = {
        "From": f"whatsapp:{from_number}",
        "To": f"whatsapp:{phone}",
        "Body": f"BriefTube — {video_title}",
        "MediaUrl": audio_url,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{TWILIO_API}/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data=payload,
            )

        if resp.status_code in (400, 401, 403):
            logger.warning(f"WhatsApp permanent error for {phone}: {resp.text[:200]}")
            return False  # Triggers mark_user_platform_disconnected
        resp.raise_for_status()
        logger.info(f"WhatsApp delivered to {phone}: {video_title[:50]}")
        return True
    except Exception as e:
        logger.error(f"WhatsApp delivery failed for {video_id} → {phone}: {e}")
        return False
