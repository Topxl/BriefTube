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
    Rate-limited to 10 requests/second (0.1s sleep between requests).
    """
    channel_ids = db.get_all_channel_ids()
    if not channel_ids:
        return 0, 0

    existing = db.get_websub_subscriptions()
    now = datetime.now(timezone.utc)
    renew_threshold = now + timedelta(seconds=_RENEW_BEFORE_SECONDS)

    new_count = 0
    renewed_count = 0

    for channel_id in channel_ids:
        sub = existing.get(channel_id)

        if sub is None or sub["status"] == "failed":
            # New channel or previously failed — subscribe
            ok = await subscribe_channel(channel_id, session)
            if ok:
                new_count += 1
            await asyncio.sleep(0.1)
            continue

        if sub["status"] == "pending":
            # Already pending hub verification — skip
            continue

        # Active — check if it's expiring soon
        expires_at = sub.get("expires_at")
        if expires_at:
            try:
                if isinstance(expires_at, str):
                    # Parse ISO string from Supabase
                    exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                else:
                    exp_dt = expires_at
                if exp_dt > renew_threshold:
                    continue  # Still fresh — no renewal needed
            except Exception:
                pass  # Malformed date — renew to be safe

        # Renew
        ok = await subscribe_channel(channel_id, session)
        if ok:
            renewed_count += 1
        await asyncio.sleep(0.1)

    return new_count, renewed_count
