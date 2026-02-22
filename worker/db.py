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


def mark_video_completed(video_id: str, summary: str, audio_url: str, metadata: dict = None, language: str = "fr"):
    sb = get_client()
    update_data = {
        "summary": summary,
        "audio_url": audio_url,
        "status": "completed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        update_data["metadata"] = metadata
    sb.table("processed_videos").update(update_data).eq("video_id", video_id).eq("language", language).execute()


def mark_video_failed(video_id: str, language: str = "fr"):
    sb = get_client()
    # Increment failure_count — use execute() (not .single()) to avoid throwing
    # if the row was deleted between job pick and failure handling.
    res = (
        sb.table("processed_videos")
        .select("failure_count")
        .eq("video_id", video_id)
        .eq("language", language)
        .execute()
    )
    if not res.data:
        return  # Row gone — nothing to update
    count = (res.data[0].get("failure_count") or 0) + 1
    status = "failed" if count >= 3 else "pending"
    sb.table("processed_videos").update({
        "failure_count": count,
        "status": status,
    }).eq("video_id", video_id).eq("language", language).execute()


def insert_new_video(video_id: str, channel_id: str, video_title: str, video_url: str, language: str = "fr"):
    """Insert a new video into processed_videos (status=pending) for a specific language.

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
        "language": language,
    }, on_conflict="video_id,language", ignore_duplicates=True).execute()


# ── Processing Queue ───────────────────────────────────────────

def enqueue_video(video_id: str, youtube_url: str, video_title: str, channel_id: str, language: str = "fr", tts_voice: str | None = None):
    """Enqueue a video for processing in a specific language.

    One job is created per unique (video_id, language) pair. If a job already
    exists for that pair (e.g. from a previous scan), it is left unchanged.
    """
    sb = get_client()
    row = {
        "video_id": video_id,
        "youtube_url": youtube_url,
        "video_title": video_title,
        "channel_id": channel_id,
        "status": "queued",
        "user_language": language,
    }
    if tts_voice:
        row["tts_voice"] = tts_voice
    # No unique constraint on (video_id, language) in processing_queue, so we
    # check manually: only insert if no queued/processing job exists for this pair.
    # Check all statuses — the unique constraint is on video_id alone, so any
    # existing row (queued, processing, completed, failed) blocks a new insert.
    existing = (
        sb.table("processing_queue")
        .select("id")
        .eq("video_id", video_id)
        .execute()
    )
    if not existing.data:
        sb.table("processing_queue").insert(row).execute()


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


def fail_job(job_id: str) -> bool:
    """Mark a job as failed. Returns True if this was a permanent failure (3rd attempt)."""
    sb = get_client()
    # Use execute() without .single() — avoids throwing if the job was deleted.
    res = sb.table("processing_queue").select("attempts, video_id, user_language").eq("id", job_id).execute()
    if not res.data:
        return False  # Job already gone — nothing to update
    attempts = (res.data[0].get("attempts") or 0) + 1
    user_language = res.data[0].get("user_language") or "fr"
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
            mark_video_failed(video_id, language=user_language)
        return True
    return False


def get_telegram_chat_ids_for_video(video_id: str) -> list[str]:
    """Return telegram_chat_id of all connected users with a pending delivery for this video."""
    sb = get_client()
    deliveries = (
        sb.table("deliveries")
        .select("user_id")
        .eq("video_id", video_id)
        .eq("status", "pending")
        .execute()
    )
    if not deliveries.data:
        return []
    user_ids = [d["user_id"] for d in deliveries.data]
    profiles = (
        sb.table("profiles")
        .select("telegram_chat_id")
        .in_("id", user_ids)
        .eq("telegram_connected", True)
        .not_.is_("telegram_chat_id", "null")
        .execute()
    )
    return [p["telegram_chat_id"] for p in (profiles.data or []) if p.get("telegram_chat_id")]


# ── Deliveries ─────────────────────────────────────────────────

def get_subscriber_languages(channel_id: str) -> list[dict]:
    """Return the distinct (language, tts_voice) pairs for active subscribers to a channel.

    Each unique preferred_language gets one entry, carrying a representative
    tts_voice for that language (the first one found among subscribers).
    """
    sb = get_client()
    subs = (
        sb.table("subscriptions")
        .select("user_id")
        .eq("channel_id", channel_id)
        .eq("active", True)
        .execute()
    )
    if not subs.data:
        return []

    user_ids = [s["user_id"] for s in subs.data]
    profiles = (
        sb.table("profiles")
        .select("preferred_language, tts_voice")
        .in_("id", user_ids)
        .execute()
    )

    seen: dict[str, str | None] = {}  # language → tts_voice
    for p in (profiles.data or []):
        lang = p.get("preferred_language") or "fr"
        if lang not in seen:
            seen[lang] = p.get("tts_voice")

    return [{"language": lang, "tts_voice": voice} for lang, voice in seen.items()]


def create_deliveries_for_video(video_id: str, channel_id: str, language: str = "fr"):
    """Create delivery entries for all users subscribed to this channel with the given language."""
    sb = get_client()
    # Get all users subscribed to this channel
    subs = (
        sb.table("subscriptions")
        .select("user_id")
        .eq("channel_id", channel_id)
        .eq("active", True)
        .execute()
    )
    if not subs.data:
        return

    # Deduplicate user_ids — a user may have multiple active subscriptions to
    # the same channel (e.g. direct + via a list), which would create duplicate
    # delivery rows and cause the same video to be sent multiple times.
    user_ids = list({s["user_id"] for s in subs.data})

    # Only create deliveries for users whose preferred_language matches
    profiles = (
        sb.table("profiles")
        .select("id, preferred_language")
        .in_("id", user_ids)
        .execute()
    )
    for profile in (profiles.data or []):
        user_lang = profile.get("preferred_language") or "fr"
        if user_lang != language:
            continue
        # Use select+insert instead of upsert(on_conflict=...) because the
        # deliveries table has no UNIQUE constraint on (user_id, video_id, language),
        # which would cause a 42P10 "no unique constraint" error on every new video.
        existing = (
            sb.table("deliveries")
            .select("id")
            .eq("user_id", profile["id"])
            .eq("video_id", video_id)
            .eq("language", language)
            .execute()
        )
        if not existing.data:
            sb.table("deliveries").insert({
                "user_id": profile["id"],
                "video_id": video_id,
                "status": "pending",
                "language": language,
            }).execute()


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
            .select("id, user_id, video_id, language")
            .eq("status", "pending")
            .in_("video_id", batch)
            .order("created_at")
            .limit(limit * 5)
            .execute()
        )
        raw_deliveries.extend(res.data or [])
        if len(raw_deliveries) >= limit * 5:
            break

    # Deduplicate by (user_id, video_id) — guard against duplicate delivery rows
    # that could cause the same video to be sent multiple times to the same user.
    seen_pairs: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for d in raw_deliveries:
        pair = (d["user_id"], d["video_id"])
        if pair not in seen_pairs:
            seen_pairs.add(pair)
            deduped.append(d)
    raw_deliveries = deduped

    if not raw_deliveries:
        return []

    # Build a fast lookup for video metadata keyed by (video_id, language)
    needed_pairs = list({(d["video_id"], d.get("language", "fr")) for d in raw_deliveries})
    needed_video_ids = list({p[0] for p in needed_pairs})
    pv_rows = (
        sb.table("processed_videos")
        .select("video_id, language, video_title, channel_id, summary, audio_url")
        .eq("status", "completed")
        .in_("video_id", needed_video_ids)
        .execute()
        .data or []
    )
    # key: (video_id, language)
    video_map = {(v["video_id"], v.get("language", "fr")): v for v in pv_rows}

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
        lang = d.get("language", "fr")
        v = video_map.get((d["video_id"], lang))
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
            "language": lang,
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


def claim_delivery(delivery_id: str) -> bool:
    """Atomically claim a delivery: pending → sending.

    Returns True only if this call successfully transitioned the row from
    'pending' to 'sending'. If another worker instance already claimed it
    (status is no longer 'pending'), returns False so the caller skips it.
    This prevents duplicate sends when two worker processes run simultaneously.
    """
    sb = get_client()
    res = (
        sb.table("deliveries")
        .update({"status": "sending"})
        .eq("id", delivery_id)
        .eq("status", "pending")
        .execute()
    )
    return len(res.data or []) > 0


def reset_stuck_processing_jobs(timeout_seconds: int = 700) -> int:
    """Reset processing_queue jobs stuck in 'processing' back to 'queued'.

    Called at startup to recover jobs that were being processed when the
    previous worker instance crashed. Uses started_at to detect genuine stalls
    (a job running < timeout_seconds may still be active on another instance).

    Each reset increments attempts so that a permanently broken video eventually
    reaches max_attempts and is marked 'failed' instead of looping forever.
    Returns the number of rows reset.
    """
    from datetime import timedelta

    sb = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)).isoformat()

    stuck = (
        sb.table("processing_queue")
        .select("id, attempts")
        .eq("status", "processing")
        .lt("started_at", cutoff)
        .execute()
    )
    if not stuck.data:
        return 0

    count = 0
    for row in stuck.data:
        new_attempts = (row.get("attempts") or 0) + 1
        new_status = "failed" if new_attempts >= 3 else "queued"
        sb.table("processing_queue").update({
            "status": new_status,
            "attempts": new_attempts,
        }).eq("id", row["id"]).execute()
        count += 1

    return count


def reset_sending_deliveries() -> int:
    """Reset deliveries stuck in 'sending' back to 'pending'.

    Called at startup to recover deliveries that were claimed but never
    completed because the previous worker instance crashed or was killed.
    Returns the number of rows reset.
    """
    sb = get_client()
    res = (
        sb.table("deliveries")
        .update({"status": "pending"})
        .eq("status", "sending")
        .execute()
    )
    return len(res.data or [])


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


# ── Shared Summaries ───────────────────────────────────────────

def get_profile_by_telegram(telegram_chat_id: str) -> dict | None:
    """Fetch id + subscription_status for a connected Telegram user."""
    sb = get_client()
    res = (
        sb.table("profiles")
        .select("id, subscription_status")
        .eq("telegram_chat_id", telegram_chat_id)
        .eq("telegram_connected", True)
        .execute()
    )
    return res.data[0] if res.data else None


def count_shares_today(user_id: str) -> int:
    """Count shares created today (UTC) by this user."""
    from datetime import date
    today_midnight = datetime.combine(date.today(), datetime.min.time()).replace(
        tzinfo=timezone.utc
    ).isoformat()
    sb = get_client()
    res = (
        sb.table("shared_summaries")
        .select("id", count="exact")
        .eq("shared_by", user_id)
        .gte("created_at", today_midnight)
        .execute()
    )
    return res.count or 0


def get_or_create_share(
    video_id: str,
    language: str,
    user_id: str,
    is_pro: bool,
    video_title: str,
) -> dict | None:
    """Return or create a shared_summaries row for (video_id, language, user_id).

    Returns None if the free daily limit (3 shares/day) has been reached.
    """
    import secrets

    # Free limit check
    if not is_pro and count_shares_today(user_id) >= 3:
        return None

    sb = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Re-use existing non-expired share for the same (video_id, language, user)
    existing = (
        sb.table("shared_summaries")
        .select("short_id")
        .eq("video_id", video_id)
        .eq("language", language)
        .eq("shared_by", user_id)
        .gt("expires_at", now)
        .execute()
    )
    if existing.data:
        return {"short_id": existing.data[0]["short_id"], "video_title": video_title}

    # Create new share
    short_id = secrets.token_urlsafe(6)
    sb.table("shared_summaries").insert({
        "short_id": short_id,
        "video_id": video_id,
        "language": language,
        "shared_by": user_id,
    }).execute()
    return {"short_id": short_id, "video_title": video_title}


def get_processed_video(video_id: str, language: str) -> dict | None:
    """Fetch a single processed_videos row by (video_id, language)."""
    sb = get_client()
    res = (
        sb.table("processed_videos")
        .select("video_id, video_title, channel_id, summary, audio_url, language")
        .eq("video_id", video_id)
        .eq("language", language)
        .execute()
    )
    return res.data[0] if res.data else None


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
                "language": "fr",  # language-agnostic sentinel; video_id in known_ids is enough
            },
            on_conflict="video_id,language",
            ignore_duplicates=True,
        ).execute()
