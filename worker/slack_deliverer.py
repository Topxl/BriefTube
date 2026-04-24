"""Slack Deliverer — sends a summary message to a Slack incoming webhook."""

import httpx
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def _validate_slack_webhook_url(url: str) -> bool:
    """Accept only https://hooks.slack.com/services/* webhooks.

    Prevents SSRF attacks via user-supplied malicious webhook URLs.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    if parsed.hostname != "hooks.slack.com":
        return False
    if not parsed.path.startswith("/services/"):
        return False
    return True


async def send_to_slack(
    webhook_url: str,
    video_title: str,
    video_id: str,
    summary: str,
    audio_url: str,
    language: str = "en",
) -> bool | None:
    """Post a summary to a Slack incoming webhook.

    Returns:
        True  — delivered successfully
        None  — permanent failure (webhook revoked/invalid) → triggers disconnect
        False — temporary failure (network error, 5xx) → retry later
    """
    if not webhook_url:
        logger.warning(f"Slack delivery skipped: no webhook URL for {video_id}")
        return False

    if not _validate_slack_webhook_url(webhook_url):
        logger.warning(
            f"Slack delivery rejected: invalid webhook URL for {video_id} — "
            f"must be https://hooks.slack.com/services/*"
        )
        return None  # Permanent failure — disconnect the platform connection

    excerpt = summary[:500].strip()
    if len(summary) > 500:
        excerpt += "…"

    blocks: list[dict] = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*<https://youtu.be/{video_id}|{video_title}>*",
            },
        },
    ]
    if excerpt:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": excerpt},
        })
    if audio_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Listen to summary"},
                    "url": audio_url,
                    "style": "primary",
                }
            ],
        })

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json={"blocks": blocks})

        # Slack returns HTTP 200 with body "no_service" when a webhook is deactivated
        if resp.status_code == 200 and resp.text.strip() == "no_service":
            logger.warning(f"Slack webhook deactivated (no_service): {webhook_url[:60]}…")
            return None  # Permanent — disconnect the user

        if resp.status_code in (401, 403, 404):
            logger.warning(
                f"Slack webhook invalid/revoked (HTTP {resp.status_code}): {webhook_url[:60]}…"
            )
            return None  # Permanent — disconnect the user

        if resp.status_code >= 500:
            logger.warning(f"Slack server error {resp.status_code} for {video_id}")
            return False  # Temporary — retry later

        resp.raise_for_status()
        logger.info(f"Slack delivered: {video_title[:50]}")
        return True

    except Exception as e:
        logger.error(f"Slack delivery failed for {video_id}: {e}")
        return False
