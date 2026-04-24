"""Discord Deliverer — sends a summary embed to a Discord webhook."""

import httpx
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

DISCORD_COLOR = 0xDC2626  # BriefTube red


def _validate_discord_webhook_url(url: str) -> bool:
    """Accept only https://discord.com/api/webhooks/* and related Discord domains.

    Prevents SSRF attacks via user-supplied malicious webhook URLs.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    if parsed.hostname not in (
        "discord.com",
        "discordapp.com",
        "ptb.discord.com",
        "canary.discord.com",
    ):
        return False
    if not parsed.path.startswith("/api/webhooks/"):
        return False
    return True


async def send_to_discord(
    webhook_url: str,
    video_title: str,
    video_id: str,
    summary: str,
    audio_url: str,
    language: str = "en",
) -> bool | None:
    """Post a summary embed to a Discord webhook.

    Returns:
        True  — delivered successfully
        None  — permanent failure (webhook deleted/invalid) → triggers disconnect
        False — temporary failure (network error, 5xx) → retry later
    """
    if not webhook_url:
        logger.warning(f"Discord delivery skipped: no webhook URL for {video_id}")
        return False

    if not _validate_discord_webhook_url(webhook_url):
        logger.warning(
            f"Discord delivery rejected: invalid webhook URL for {video_id} — "
            f"must be https://discord.com/api/webhooks/*"
        )
        return None  # Permanent failure — disconnect the platform connection

    excerpt = summary[:500].strip()
    if len(summary) > 500:
        excerpt += "…"

    embed: dict = {
        "title": video_title[:256],
        "url": f"https://youtu.be/{video_id}",
        "color": DISCORD_COLOR,
    }
    if excerpt:
        embed["description"] = excerpt
    if audio_url:
        embed["fields"] = [
            {"name": "Audio", "value": f"[Listen to summary]({audio_url})", "inline": True}
        ]

    payload = {
        "username": "BriefTube",
        "embeds": [embed],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)

        if resp.status_code in (401, 403, 404):
            logger.warning(
                f"Discord webhook invalid/deleted (HTTP {resp.status_code}): {webhook_url[:60]}…"
            )
            return None  # Permanent — disconnect the user

        if resp.status_code >= 500:
            logger.warning(f"Discord server error {resp.status_code} for {video_id}")
            return False  # Temporary — retry later

        resp.raise_for_status()
        logger.info(f"Discord delivered: {video_title[:50]}")
        return True

    except Exception as e:
        logger.error(f"Discord delivery failed for {video_id}: {e}")
        return False
