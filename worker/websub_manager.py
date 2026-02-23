"""WebSub manager — subscribe to YouTube push notifications via PubSubHubbub."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

import aiohttp

import db
from config import APP_URL, WEBSUB_SECRET

logger = logging.getLogger(__name__)

WEBSUB_HUB = "https://pubsubhubbub.appspot.com/subscribe"
LEASE_SECONDS = 864000  # 10 days
CALLBACK_URL = f"{APP_URL}/api/webhooks/youtube"
_RENEW_BEFORE_SECONDS = 2 * 24 * 3600  # Renew if expiring within 2 days


def _rss_url(channel_id: str) -> str:
    return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


async def subscribe_channel(channel_id: str, session: aiohttp.ClientSession) -> bool:
    """Send a subscribe request to the WebSub hub for a YouTube channel.

    Returns True if the hub accepted the request (202 Accepted).
    The hub will later verify by calling GET /api/webhooks/youtube,
    at which point the subscription status is set to 'active'.
    """
    data = {
        "hub.mode": "subscribe",
        "hub.topic": _rss_url(channel_id),
        "hub.callback": CALLBACK_URL,
        "hub.lease_seconds": str(LEASE_SECONDS),
    }
    if WEBSUB_SECRET:
        data["hub.secret"] = WEBSUB_SECRET

    try:
        async with session.post(WEBSUB_HUB, data=data, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 202:
                # Mark as pending — hub will verify via GET callback
                db.upsert_websub_subscription(channel_id, status="pending")
                logger.debug(f"[WebSub] Subscribe requested: {channel_id}")
                return True
            body = await resp.text()
            logger.warning(f"[WebSub] Subscribe failed for {channel_id}: HTTP {resp.status} — {body[:100]}")
            db.upsert_websub_subscription(channel_id, status="failed")
            return False
    except Exception as e:
        logger.warning(f"[WebSub] Subscribe error for {channel_id}: {e}")
        db.upsert_websub_subscription(channel_id, status="failed")
        return False


async def sync_subscriptions(session: aiohttp.ClientSession) -> tuple[int, int]:
    """Subscribe new channels and renew expiring subscriptions.

    Returns (new_count, renewed_count).
    Processes up to 50 channels in parallel to handle large channel counts
    efficiently (50K channels × 0.1s sequential = 83min → ~30s with concurrency).
    """
    channel_ids = db.get_all_channel_ids()
    if not channel_ids:
        return 0, 0

    existing = db.get_websub_subscriptions()
    now = datetime.now(timezone.utc)
    renew_threshold = now + timedelta(seconds=_RENEW_BEFORE_SECONDS)

    # Classify channels into two lists
    to_subscribe: list[str] = []
    to_renew: list[str] = []

    for channel_id in channel_ids:
        sub = existing.get(channel_id)

        if sub is None or sub["status"] == "failed":
            to_subscribe.append(channel_id)
            continue

        if sub["status"] == "pending":
            continue  # Hub verification in progress — skip

        # Active — check if expiring soon
        expires_at = sub.get("expires_at")
        needs_renew = True
        if expires_at:
            try:
                exp_dt = (
                    datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                    if isinstance(expires_at, str)
                    else expires_at
                )
                if exp_dt > renew_threshold:
                    needs_renew = False
            except Exception:
                pass  # Malformed date — renew to be safe
        if needs_renew:
            to_renew.append(channel_id)

    if not to_subscribe and not to_renew:
        return 0, 0

    # Process both lists in parallel batches of 50
    semaphore = asyncio.Semaphore(50)

    async def _sub(channel_id: str) -> bool:
        async with semaphore:
            return await subscribe_channel(channel_id, session)

    new_results = await asyncio.gather(*[_sub(ch) for ch in to_subscribe])
    renewed_results = await asyncio.gather(*[_sub(ch) for ch in to_renew])

    new_count = sum(1 for r in new_results if r)
    renewed_count = sum(1 for r in renewed_results if r)

    if to_subscribe or to_renew:
        logger.info(
            f"[WebSub] Sync complete: {len(to_subscribe)} new requested, "
            f"{len(to_renew)} renewals requested "
            f"({new_count} accepted, {renewed_count} renewed)"
        )

    return new_count, renewed_count
