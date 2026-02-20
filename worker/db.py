"""Supabase database client for the worker."""

import logging
from datetime import datetime, timezone
import httpx
from supabase import create_client, Client, ClientOptions

from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger(__name__)

_client: Client = None


def _make_client() -> Client:
    """Create a Supabase client with HTTP/2 disabled.

    Supabase/Cloudflare sends HTTP/2 GOAWAY frames aggressively, which breaks
    persistent connections and causes 'ConnectionTerminated' / 'Server disconnected'
    errors. Using HTTP/1.1 avoids this entirely.
    """
    http_client = httpx.Client(http2=False, timeout=30.0)
    options = ClientOptions(httpx_client=http_client)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options=options)


def get_client() -> Client:
    global _client
    if _client is None:
        _client = _make_client()
    return _client


def reset_client() -> None:
    """Force-recreate the Supabase client on next get_client() call.

    Call this after a connection error so the stale HTTP connection is
    dropped and a fresh one is established.
    """
    global _client
    _client = None
    logger.info("Supabase client reset — will reconnect on next query")


# ── Subscriptions ──────────────────────────────────────────────

def get_all_channel_ids() -> list[str]:
    """Get all distinct channel IDs that at least one user is subscribed to."""
    sb = get_client()
    res = sb.table("subscriptions").select("channel_id").eq("active", True).execute()
    return list({row["channel_id"] for row in res.data})


# ── Processed Videos ───────────────────────────────────────────

def is_video_processed(video_id: str) -> bool:
    sb = get_client()
    res = sb.table("processed_videos").select("id").eq("video_id", video_id).execute()
    return len(res.data) > 0


def get_all_known_video_ids() -> set[str]:
    """Return the set of ALL video_ids already in processed_videos.

    Used by the RSS scanner to check new videos in O(1) locally instead
    of making one DB query per video (which causes 3000+ queries per scan).
    Paginates past the PostgREST 1000-row default limit so the full set is
    returned even when processed_videos has thousands of rows.
    """
    sb = get_client()
    known: set[str] = set()
    offset = 0
    while True:
        res = (
            sb.table("processed_videos")
            .select("video_id")
            .range(offset, offset + 999)
            .execute()
        )
        if not res.data:
            break
        for row in res.data:
            known.add(row["video_id"])
        if len(res.data) < 1000:
            break
        offset += 1000
    return known


def mark_video_completed(video_id: str, summary: str, audio_url: str, metadata: dict = None):
    sb = get_client()
    update_data = {
        "summary": summary,
        "audio_url": audio_url,
        "status": "completed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        update_data["metadata"] = metadata
    sb.table("processed_videos").update(update_data).eq("video_id", video_id).execute()


def mark_video_failed(video_id: str):
    sb = get_client()
    # Increment failure_count — use execute() (not .single()) to avoid throwing
    # if the row was deleted between job pick and failure handling.
    res = sb.table("processed_videos").select("failure_count").eq("video_id", video_id).execute()
    if not res.data:
        return  # Row gone — nothing to update
    count = (res.data[0].get("failure_count") or 0) + 1
    status = "failed" if count >= 3 else "pending"
    sb.table("processed_videos").update({
        "failure_count": count,
        "status": status,
    }).eq("video_id", video_id).execute()


def insert_new_video(video_id: str, channel_id: str, video_title: str, video_url: str):
    """Insert a new video into processed_videos (status=pending).

    Uses ignore_duplicates=True so existing records (skipped, completed, failed)
    are never overwritten — prevents the scanner from downgrading skipped videos
    back to pending when a pagination gap causes them to appear "unknown".
    """
    sb = get_client()
    sb.table("processed_videos").upsert({
        "video_id": video_id,
        "channel_id": channel_id,
        "video_title": video_title,
        "video_url": video_url,
        "status": "pending",
    }, on_conflict="video_id", ignore_duplicates=True).execute()


# ── Processing Queue ───────────────────────────────────────────

def enqueue_video(video_id: str, youtube_url: str, video_title: str, channel_id: str):
    sb = get_client()
    sb.table("processing_queue").upsert({
        "video_id": video_id,
        "youtube_url": youtube_url,
        "video_title": video_title,
        "channel_id": channel_id,
        "status": "queued",
    }, on_conflict="video_id", ignore_duplicates=True).execute()


def pick_next_job() -> dict | None:
    """Pick the next queued job (oldest first) atomically. Returns dict or None.

    Uses a PostgreSQL function with FOR UPDATE SKIP LOCKED so concurrent
    workers or rapid restarts never pick the same job twice.
    """
    sb = get_client()
    res = sb.rpc("pick_next_processing_job").execute()
    if not res.data:
        return None
    return res.data[0]


def complete_job(job_id: str):
    sb = get_client()
    sb.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()


def fail_job(job_id: str):
    sb = get_client()
    # Use execute() without .single() — avoids throwing if the job was deleted.
    res = sb.table("processing_queue").select("attempts, video_id").eq("id", job_id).execute()
    if not res.data:
        return  # Job already gone — nothing to update
    attempts = (res.data[0].get("attempts") or 0) + 1
    status = "failed" if attempts >= 3 else "queued"
    sb.table("processing_queue").update({
        "status": status,
        "attempts": attempts,
    }).eq("id", job_id).execute()
    # Keep processed_videos in sync: when the job permanently fails, mark the
    # video as failed too so it doesn't stay stuck in "pending" forever.
    if status == "failed":
        video_id = res.data[0].get("video_id")
        if video_id:
            mark_video_failed(video_id)


# ── Deliveries ─────────────────────────────────────────────────

def create_deliveries_for_video(video_id: str, channel_id: str):
    """Create delivery entries for all users subscribed to this channel."""
    sb = get_client()
    # Get all users subscribed to this channel
    subs = (
        sb.table("subscriptions")
        .select("user_id")
        .eq("channel_id", channel_id)
        .eq("active", True)
        .execute()
    )
    for sub in subs.data:
        sb.table("deliveries").upsert({
            "user_id": sub["user_id"],
            "video_id": video_id,
            "status": "pending",
        }, on_conflict="user_id,video_id").execute()


def get_pending_deliveries(limit: int = 20) -> list[dict]:
    """Get pending deliveries for completed videos.

    Starts from completed videos (not from the delivery queue) so that a large
    backlog of unprocessed-video deliveries cannot starve ready-to-send ones.
    Paginates processed_videos to handle tables larger than PostgREST's 1000-row
    default limit.
    """
    sb = get_client()

    # 1. Collect all completed video IDs (paginate past the 1000-row limit)
    completed_ids: list[str] = []
    offset = 0
    while True:
        res = (
            sb.table("processed_videos")
            .select("video_id, video_title, channel_id, summary, audio_url")
            .eq("status", "completed")
            .range(offset, offset + 999)
            .execute()
        )
        if not res.data:
            break
        for row in res.data:
            completed_ids.append(row["video_id"])
        if len(res.data) < 1000:
            break
        offset += 1000

    if not completed_ids:
        return []

    # 2. Find pending deliveries for those videos (batch by 100 to stay within URL limits)
    raw_deliveries: list[dict] = []
    for i in range(0, len(completed_ids), 100):
        batch = completed_ids[i : i + 100]
        res = (
            sb.table("deliveries")
            .select("id, user_id, video_id")
            .eq("status", "pending")
            .in_("video_id", batch)
            .order("created_at")
            .limit(limit * 5)
            .execute()
        )
        raw_deliveries.extend(res.data or [])
        if len(raw_deliveries) >= limit * 5:
            break

    if not raw_deliveries:
        return []

    # Build a fast lookup for video metadata
    video_map = {v["video_id"]: v for v in
                 (sb.table("processed_videos")
                  .select("video_id, video_title, channel_id, summary, audio_url")
                  .eq("status", "completed")
                  .in_("video_id", list({d["video_id"] for d in raw_deliveries}))
                  .execute().data or [])}

    # 3. User profiles
    user_ids = list({d["user_id"] for d in raw_deliveries})
    profiles_res = (
        sb.table("profiles")
        .select("id, telegram_chat_id, tts_voice, telegram_connected")
        .in_("id", user_ids)
        .execute()
    )
    profile_map = {p["id"]: p for p in (profiles_res.data or [])}

    results = []
    for d in raw_deliveries:
        v = video_map.get(d["video_id"])
        if not v:
            continue
        profile = profile_map.get(d["user_id"])
        if not profile or not profile.get("telegram_connected"):
            continue
        results.append({
            "delivery_id": d["id"],
            "chat_id": profile["telegram_chat_id"],
            "tts_voice": profile.get("tts_voice"),
            "video_id": v["video_id"],
            "video_title": v["video_title"],
            "channel_id": v["channel_id"],
            "summary": v["summary"],
            "audio_url": v["audio_url"],
        })
        if len(results) >= limit:
            break
    return results


def cleanup_undeliverable_deliveries() -> int:
    """Mark pending deliveries as failed when their video failed or when the
    user has no Telegram connected. Prevents stuck deliveries from blocking
    the queue forever. Returns the number of deliveries cleaned up."""
    sb = get_client()
    cleaned = 0

    # Failed videos → deliveries can never succeed
    failed_videos = (
        sb.table("processed_videos")
        .select("video_id")
        .eq("status", "failed")
        .execute()
    )
    if failed_videos.data:
        failed_ids = [v["video_id"] for v in failed_videos.data]
        # Process in batches of 100 to stay within PostgREST limits
        for i in range(0, len(failed_ids), 100):
            batch = failed_ids[i : i + 100]
            res = (
                sb.table("deliveries")
                .update({"status": "failed"})
                .eq("status", "pending")
                .in_("video_id", batch)
                .execute()
            )
            cleaned += len(res.data or [])

    # Users without Telegram → deliveries can never be sent
    disconnected = (
        sb.table("profiles")
        .select("id")
        .or_("telegram_connected.is.false,telegram_chat_id.is.null")
        .execute()
    )
    if disconnected.data:
        user_ids = [p["id"] for p in disconnected.data]
        for i in range(0, len(user_ids), 100):
            batch = user_ids[i : i + 100]
            res = (
                sb.table("deliveries")
                .update({"status": "failed"})
                .eq("status", "pending")
                .in_("user_id", batch)
                .execute()
            )
            cleaned += len(res.data or [])

    return cleaned


def mark_delivery_sent(delivery_id: str):
    sb = get_client()
    sb.table("deliveries").update({
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", delivery_id).execute()


def mark_delivery_failed(delivery_id: str):
    sb = get_client()
    sb.table("deliveries").update({"status": "failed"}).eq("id", delivery_id).execute()


def count_on_demand_this_month(user_id: str) -> int:
    """Count on-demand deliveries for a user in the current calendar month."""
    sb = get_client()
    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    res = (
        sb.table("deliveries")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("source", "on_demand")
        .gte("created_at", month_start)
        .execute()
    )
    return res.count or 0


def mark_existing_videos_as_skipped(channel_id: str):
    """Mark all existing RSS videos for a channel as skipped."""
    import feedparser

    sb = get_client()
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    feed = feedparser.parse(rss_url)

    for entry in feed.entries:
        video_id = getattr(entry, "yt_videoid", None)
        if not video_id:
            continue
        sb.table("processed_videos").upsert(
            {
                "video_id": video_id,
                "channel_id": channel_id,
                "video_title": entry.get("title", "[initial]"),
                "video_url": entry.get("link", f"https://www.youtube.com/watch?v={video_id}"),
                "status": "skipped",
            },
            on_conflict="video_id",
            ignore_duplicates=True,
        ).execute()
