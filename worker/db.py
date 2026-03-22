"""Supabase database client for the worker."""

import logging
from datetime import datetime, timedelta, timezone
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


def get_all_known_video_ids(days: int = 30) -> set[str]:
    """Return video_ids created within the last `days` days.

    YouTube RSS feeds only contain the last ~15 videos per channel, which are
    always recent. Videos older than 30 days cannot appear in the current RSS
    feed and do not need to be in the cache — this keeps the set small even
    when processed_videos has millions of rows.
    """
    from datetime import timedelta
    sb = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    known: set[str] = set()
    offset = 0
    while True:
        res = (
            sb.table("processed_videos")
            .select("video_id")
            .gte("created_at", cutoff)
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


def mark_video_completed(
    video_id: str,
    summary: str,
    audio_url: str,
    metadata: dict = None,
    language: str = "fr",
    video_title: str | None = None,
    transcript_source: str | None = None,
    processing_time_s: float | None = None,
):
    sb = get_client()
    update_data = {
        "summary": summary,
        "audio_url": audio_url,
        "status": "completed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        # Save to proper columns (not only to the metadata JSON blob)
        update_data["transcript_cost"] = metadata.get("transcript_cost", 0)
        update_data["transcript_length"] = metadata.get("transcript_length", 0)
        update_data["source_language"] = metadata.get("source_language", "")
        update_data["summary_length"] = metadata.get("summary_length", 0)
        update_data["metadata"] = metadata
    if transcript_source:
        update_data["transcript_source"] = transcript_source
    if processing_time_s is not None:
        update_data["metadata"] = {**(update_data.get("metadata") or {}), "processing_time_s": round(processing_time_s, 1)}
    # Backfill title if the row was created without one (e.g. language-chained rows)
    if video_title:
        update_data["video_title"] = video_title
    sb.table("processed_videos").update(update_data).eq("video_id", video_id).eq("language", language).execute()


def mark_video_failed(video_id: str, language: str = "fr", immediate: bool = False, all_languages: bool = False):
    sb = get_client()
    # Increment failure_count — use execute() (not .single()) to avoid throwing
    # if the row was deleted between job pick and failure handling.
    if all_languages:
        # Update ALL pending language variants for this video (e.g. when the video
        # itself is unreachable — premiere stale, live expired — every language fails).
        res = (
            sb.table("processed_videos")
            .select("failure_count, language")
            .eq("video_id", video_id)
            .in_("status", ["pending", "processing"])
            .execute()
        )
        for row in (res.data or []):
            count = (row.get("failure_count") or 0) + 1
            status = "failed" if (immediate or count >= 3) else "pending"
            sb.table("processed_videos").update({
                "failure_count": count,
                "status": status,
            }).eq("video_id", video_id).eq("language", row["language"]).execute()
        return

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
    status = "failed" if (immediate or count >= 3) else "pending"
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

    - If no job exists → insert new job.
    - If job is completed/failed → reuse the slot (update to queued).
    - If job is queued/processing → do nothing (already active).

    This prevents on-demand re-submissions from being silently ignored when a
    completed job already exists in processing_queue from a previous run.
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

    existing = (
        sb.table("processing_queue")
        .select("id, status")
        .eq("video_id", video_id)
        .execute()
    )

    if not existing.data:
        sb.table("processing_queue").insert(row).execute()
        return

    job = existing.data[0]
    if job["status"] in ("queued", "processing"):
        return  # Already active — do not interrupt

    # Job is completed/failed — reuse the slot for a fresh run
    update = {"status": "queued", "user_language": language, "attempts": 0, "started_at": None}
    if tts_voice:
        update["tts_voice"] = tts_voice
    sb.table("processing_queue").update(update).eq("id", job["id"]).execute()


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


def snooze_job(job_id: str, hours: int) -> None:
    """Put a job back to queued with a retry_after delay (for premiere/scheduled videos).

    Does NOT increment attempts — this is not a failure, just a wait.
    """
    from datetime import datetime, timezone, timedelta
    retry_after = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    sb = get_client()
    sb.table("processing_queue").update({
        "status": "queued",
        "retry_after": retry_after,
        "started_at": None,
    }).eq("id", job_id).execute()
    logger.info(f"Job {job_id} snoozed for {hours}h (premiere/scheduled)")


def fail_job(job_id: str, immediate: bool = False, retry_after_minutes: int = 0) -> bool:
    """Mark a job as failed. Returns True if this was a permanent failure.

    immediate=True skips the 3-attempt retry cycle and fails permanently on
    the first call. Use for deterministic errors (no transcript available,
    music/ambient video) where retrying will never succeed.
    """
    sb = get_client()
    # Use execute() without .single() — avoids throwing if the job was deleted.
    res = sb.table("processing_queue").select("attempts, video_id, user_language").eq("id", job_id).execute()
    if not res.data:
        return False  # Job already gone — nothing to update
    attempts = (res.data[0].get("attempts") or 0) + 1
    user_language = res.data[0].get("user_language") or "fr"
    status = "failed" if (immediate or attempts >= 3) else "queued"
    update_data: dict = {"status": status, "attempts": attempts}
    if status == "queued" and retry_after_minutes > 0:
        from datetime import datetime, timezone, timedelta
        update_data["retry_after"] = (
            datetime.now(timezone.utc) + timedelta(minutes=retry_after_minutes)
        ).isoformat()
    sb.table("processing_queue").update(update_data).eq("id", job_id).execute()
    # Keep processed_videos in sync: when the job permanently fails, mark the
    # video as failed too so it doesn't stay stuck in "pending" forever.
    # Always use immediate=True here: processing_queue already decided this is
    # a permanent failure, so processed_videos must reflect that regardless of
    # its own failure_count (avoids the "pending forever" bug when failure_count < 3).
    if status == "failed":
        video_id = res.data[0].get("video_id")
        if video_id:
            # Sync ALL pending language variants — if a job fails permanently,
            # the video itself is unreachable so every language row must fail too.
            mark_video_failed(video_id, language=user_language, immediate=True, all_languages=True)
        return True
    return False


def get_platform_connections_for_users(user_ids: list[str]) -> list[dict]:
    """Return all active platform connections for the given user IDs."""
    sb = get_client()
    res = (
        sb.table("platform_connections")
        .select("user_id, platform, external_id, credentials")
        .in_("user_id", user_ids)
        .eq("connected", True)
        .execute()
    )
    return res.data or []


def mark_user_platform_disconnected(user_id: str, platform: str) -> None:
    """Mark a platform connection as disconnected (bot blocked, token revoked, etc.)."""
    sb = get_client()
    try:
        sb.table("platform_connections").update({"connected": False}).eq("user_id", user_id).eq("platform", platform).execute()
        logger.info(f"Marked user {user_id[:8]}… as {platform} disconnected")
    except Exception as e:
        logger.warning(f"Could not mark user {user_id[:8]}… as {platform} disconnected: {e}")


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
    """Create delivery entries for all users subscribed to this channel with the given language.

    Creates one delivery per user per active platform connection (Telegram, Notion, WhatsApp…).
    Uses a single bulk check + single batch insert — reduces DB round-trips from O(users) to O(1).
    """
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

    # Deduplicate user_ids
    user_ids = list({s["user_id"] for s in subs.data})

    # Filter users with matching preferred language
    profiles = (
        sb.table("profiles")
        .select("id, preferred_language")
        .in_("id", user_ids)
        .execute()
    )
    matching_ids = [
        p["id"] for p in (profiles.data or [])
        if (p.get("preferred_language") or "fr") == language
    ]
    if not matching_ids:
        return

    # Get all active platform connections for matching users
    connections = get_platform_connections_for_users(matching_ids)
    if not connections:
        return

    # Fetch all existing deliveries for this video+language (check by user+platform pair)
    existing = (
        sb.table("deliveries")
        .select("user_id, platform")
        .eq("video_id", video_id)
        .eq("language", language)
        .in_("user_id", matching_ids)
        .execute()
    )
    existing_pairs = {(d["user_id"], d.get("platform", "telegram")) for d in (existing.data or [])}

    # Batch insert one delivery per user per platform
    to_insert = [
        {
            "user_id": conn["user_id"],
            "video_id": video_id,
            "status": "pending",
            "language": language,
            "platform": conn["platform"],
        }
        for conn in connections
        if (conn["user_id"], conn["platform"]) not in existing_pairs
    ]
    if to_insert:
        sb.table("deliveries").insert(to_insert).execute()


def get_pending_deliveries(limit: int = 20) -> list[dict]:
    """Get pending deliveries for completed videos.

    Queries deliveries first (tiny set, usually 0-20 rows), then verifies
    their videos are completed. This is far cheaper than scanning all 16k+
    completed videos to find the handful of pending deliveries.
    """
    sb = get_client()

    # 1. Fetch pending deliveries directly — small set, indexed on (status, created_at)
    raw_deliveries = (
        sb.table("deliveries")
        .select("id, user_id, video_id, language, platform")
        .eq("status", "pending")
        .order("created_at")
        .limit(limit * 5)
        .execute()
        .data or []
    )

    if not raw_deliveries:
        return []

    # 2. Verify their videos are actually completed (guard against deliveries created before processing)
    video_ids = list({d["video_id"] for d in raw_deliveries})
    completed_res = (
        sb.table("processed_videos")
        .select("video_id")
        .eq("status", "completed")
        .in_("video_id", video_ids)
        .execute()
    )
    completed_ids = {r["video_id"] for r in (completed_res.data or [])}
    raw_deliveries = [d for d in raw_deliveries if d["video_id"] in completed_ids]

    # Deduplicate by (user_id, video_id, platform) — guard against duplicate delivery rows.
    # Must include platform: one user can have both Telegram and Discord deliveries for the same video.
    seen_pairs: set[tuple[str, str, str]] = set()
    deduped: list[dict] = []
    for d in raw_deliveries:
        pair = (d["user_id"], d["video_id"], d.get("platform", "telegram"))
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

    # 3. User profiles (for tts_voice) + platform connections
    user_ids = list({d["user_id"] for d in raw_deliveries})

    profiles_res = (
        sb.table("profiles")
        .select("id, tts_voice")
        .in_("id", user_ids)
        .execute()
    )
    profile_map = {p["id"]: p for p in (profiles_res.data or [])}

    # Build (user_id, platform) → connection map
    conn_res = (
        sb.table("platform_connections")
        .select("user_id, platform, external_id, credentials")
        .in_("user_id", user_ids)
        .eq("connected", True)
        .execute()
    )
    conn_map = {(c["user_id"], c["platform"]): c for c in (conn_res.data or [])}

    results = []
    for d in raw_deliveries:
        lang = d.get("language", "fr")
        v = video_map.get((d["video_id"], lang))
        if not v:
            continue
        platform = d.get("platform", "telegram")
        conn = conn_map.get((d["user_id"], platform))
        if not conn:
            continue
        profile = profile_map.get(d["user_id"])
        results.append({
            "delivery_id": d["id"],
            "user_id": d["user_id"],
            "platform": platform,
            "external_id": conn["external_id"],
            "credentials": conn.get("credentials") or {},
            "tts_voice": profile.get("tts_voice") if profile else None,
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
    """Clean up deliveries that can never be delivered.

    - Skipped videos   → DELETE the delivery (pre-subscription skip is intentional,
                         not a real failure — keeps the admin dashboard clean)
    - Failed videos    → mark as 'failed' (real processing error, worth tracking)
    - Disconnected platform connection → mark as 'failed'

    Returns the number of deliveries cleaned up.
    """
    sb = get_client()
    cleaned = 0

    # Skipped videos → DELETE silently (expected behaviour, not an error)
    # Only look at recently processed videos — older ones are already cleaned up
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    skipped_videos = (
        sb.table("processed_videos")
        .select("video_id")
        .eq("status", "skipped")
        .gte("processed_at", recent_cutoff)
        .execute()
    )
    if skipped_videos.data:
        skipped_ids = [v["video_id"] for v in skipped_videos.data]
        for i in range(0, len(skipped_ids), 100):
            batch = skipped_ids[i : i + 100]
            res = (
                sb.table("deliveries")
                .delete()
                .in_("status", ["pending", "failed"])
                .in_("video_id", batch)
                .execute()
            )
            cleaned += len(res.data or [])

    # Failed videos → mark as failed (real processing error)
    failed_videos = (
        sb.table("processed_videos")
        .select("video_id")
        .eq("status", "failed")
        .gte("processed_at", recent_cutoff)
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

    # Disconnected platform connections → deliveries for those platforms can never be sent
    disconnected_conns = (
        sb.table("platform_connections")
        .select("user_id, platform")
        .eq("connected", False)
        .execute()
    )
    if disconnected_conns.data:
        # Group by platform for efficient batched updates
        by_platform: dict[str, list[str]] = {}
        for conn in disconnected_conns.data:
            by_platform.setdefault(conn["platform"], []).append(conn["user_id"])
        for plat, uids in by_platform.items():
            for i in range(0, len(uids), 100):
                batch = uids[i : i + 100]
                res = (
                    sb.table("deliveries")
                    .update({"status": "failed"})
                    .eq("status", "pending")
                    .eq("platform", plat)
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


def mark_user_telegram_disconnected(user_id: str) -> None:
    """Mark a user's Telegram as disconnected. Delegates to mark_user_platform_disconnected."""
    mark_user_platform_disconnected(user_id, "telegram")


def recover_failed_deliveries() -> int:
    """Reset failed deliveries to pending when their video is now completed with audio.

    Handles the case where:
    - A video was initially failed → delivery marked failed by cleanup
    - The video was later re-processed successfully
    - Or a transient error caused the delivery to fail (not a Telegram rejection)

    Only recovers deliveries where sent_at IS NULL (never actually sent).
    Deliveries with sent_at set were already delivered and should not be retried.
    """
    sb = get_client()

    # Start from failed deliveries (small set) instead of scanning all completed videos
    failed_deliveries = (
        sb.table("deliveries")
        .select("id, video_id")
        .eq("status", "failed")
        .is_("sent_at", "null")
        .limit(200)
        .execute()
        .data or []
    )
    if not failed_deliveries:
        return 0

    # Check which of those video_ids are now completed with audio
    video_ids = list({d["video_id"] for d in failed_deliveries})
    completed = (
        sb.table("processed_videos")
        .select("video_id")
        .eq("status", "completed")
        .not_.is_("audio_url", "null")
        .in_("video_id", video_ids)
        .execute()
    )
    completed_ids = {r["video_id"] for r in (completed.data or [])}
    if not completed_ids:
        return 0

    delivery_ids = [d["id"] for d in failed_deliveries if d["video_id"] in completed_ids]
    recovered = 0
    for i in range(0, len(delivery_ids), 100):
        batch = delivery_ids[i : i + 100]
        res = (
            sb.table("deliveries")
            .update({"status": "pending"})
            .in_("id", batch)
            .execute()
        )
        recovered += len(res.data or [])

    if recovered:
        logger.info(f"Recovered {recovered} failed deliveries → pending")
    return recovered


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

    # Match jobs stuck in 'processing' with either:
    # - started_at older than the timeout (normal stuck case)
    # - started_at IS NULL (worker crashed before setting started_at)
    stuck_timed = (
        sb.table("processing_queue")
        .select("id, attempts")
        .eq("status", "processing")
        .lt("started_at", cutoff)
        .execute()
    )
    stuck_null = (
        sb.table("processing_queue")
        .select("id, attempts")
        .eq("status", "processing")
        .is_("started_at", "null")
        .execute()
    )
    # Merge and deduplicate by id
    seen_ids: set[str] = set()
    stuck_rows: list[dict] = []
    for row in (stuck_timed.data or []) + (stuck_null.data or []):
        if row["id"] not in seen_ids:
            seen_ids.add(row["id"])
            stuck_rows.append(row)

    if not stuck_rows:
        return 0

    count = 0
    for row in stuck_rows:
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
    """Fetch profile fields for a connected Telegram user via platform_connections."""
    sb = get_client()
    conn_res = (
        sb.table("platform_connections")
        .select("user_id")
        .eq("platform", "telegram")
        .eq("external_id", telegram_chat_id)
        .eq("connected", True)
        .execute()
    )
    if not conn_res.data:
        return None
    user_id = conn_res.data[0]["user_id"]
    res = (
        sb.table("profiles")
        .select("id, subscription_status, trial_ends_at, max_channels, preferred_language, tts_voice, favorite_languages")
        .eq("id", user_id)
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
    """Return or create a shared_summaries row for (video_id, language, user_id)."""
    import secrets

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


def get_telegram_chat_ids_for_video(video_id: str) -> list[str]:
    """Return Telegram chat IDs (external_id) for all users subscribed to the channel of this video.

    Used to notify users when a video permanently fails processing.
    Returns an empty list if the video has no channel or no connected Telegram users.
    """
    sb = get_client()
    # Get channel_id for this video
    pv_res = (
        sb.table("processed_videos")
        .select("channel_id")
        .eq("video_id", video_id)
        .neq("channel_id", "")
        .limit(1)
        .execute()
    )
    if not pv_res.data or not pv_res.data[0].get("channel_id"):
        return []
    channel_id = pv_res.data[0]["channel_id"]

    # Get users subscribed to this channel
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

    # Get Telegram external_ids for connected users
    conns = (
        sb.table("platform_connections")
        .select("external_id")
        .in_("user_id", user_ids)
        .eq("platform", "telegram")
        .eq("connected", True)
        .execute()
    )
    return [c["external_id"] for c in (conns.data or [])]


def get_video_channel(video_id: str) -> dict | None:
    """Look up channel_id and channel_name for a video from processed_videos.

    Returns None for on-demand videos (channel_id is empty).
    """
    sb = get_client()
    res = (
        sb.table("processed_videos")
        .select("channel_id")
        .eq("video_id", video_id)
        .neq("channel_id", "")
        .limit(1)
        .execute()
    )
    if not res.data or not res.data[0].get("channel_id"):
        return None
    channel_id = res.data[0]["channel_id"]
    name_res = (
        sb.table("subscriptions")
        .select("channel_name")
        .eq("channel_id", channel_id)
        .limit(1)
        .execute()
    )
    channel_name = name_res.data[0]["channel_name"] if name_res.data else channel_id
    return {"channel_id": channel_id, "channel_name": channel_name}


def get_available_languages_for_video(video_id: str) -> list[str]:
    """Return all languages with a completed summary for this video."""
    sb = get_client()
    res = (
        sb.table("processed_videos")
        .select("language")
        .eq("video_id", video_id)
        .eq("status", "completed")
        .execute()
    )
    return [row["language"] for row in res.data]


def get_next_pending_language_for_video(video_id: str, processed_language: str) -> str | None:
    """Return the first other pending language for this video.

    Used to chain multi-language processing: after language X completes,
    find the next language that still needs processing for the same video.
    Returns the language code, or None if no other languages are pending.
    """
    sb = get_client()
    res = (
        sb.table("processed_videos")
        .select("language")
        .eq("video_id", video_id)
        .eq("status", "pending")
        .neq("language", processed_language)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]["language"]


def get_any_processed_video(video_id: str) -> dict | None:
    """Fetch basic info for a video from any language row (for re-queuing in a new language)."""
    sb = get_client()
    res = (
        sb.table("processed_videos")
        .select("video_id, video_title, channel_id")
        .eq("video_id", video_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def enqueue_video_for_language(
    video_id: str,
    youtube_url: str,
    video_title: str,
    channel_id: str,
    language: str,
    tts_voice: str | None = None,
) -> bool:
    """Queue a video for processing in a specific language.

    - If no job exists in processing_queue → insert new job.
    - If job is completed/failed → update it to re-queue for the new language.
    - If job is queued/processing → do nothing (already active).

    Returns True if a job was created/updated, False if already active.
    """
    sb = get_client()

    existing = (
        sb.table("processing_queue")
        .select("id, status")
        .eq("video_id", video_id)
        .execute()
    )

    row = {
        "video_id": video_id,
        "youtube_url": youtube_url,
        "video_title": video_title,
        "channel_id": channel_id,
        "status": "queued",
        "user_language": language,
        "tts_voice": tts_voice,
    }

    if not existing.data:
        sb.table("processing_queue").insert(row).execute()
        return True

    job = existing.data[0]
    if job["status"] in ("queued", "processing"):
        return False  # Already active — do not interrupt

    # Job is completed/failed — reuse the slot and reset retry counters
    sb.table("processing_queue").update({
        "status": "queued",
        "user_language": language,
        "tts_voice": tts_voice,
        "attempts": 0,
        "started_at": None,
    }).eq("id", job["id"]).execute()
    return True


def is_subscribed_to_channel(user_id: str, channel_id: str) -> bool:
    """Return True if user has an active subscription to this channel."""
    sb = get_client()
    res = (
        sb.table("subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("channel_id", channel_id)
        .eq("active", True)
        .execute()
    )
    return bool(res.data)


def unsubscribe_channel(user_id: str, channel_id: str) -> bool:
    """Set subscription inactive. Returns True if a row was updated."""
    sb = get_client()
    res = (
        sb.table("subscriptions")
        .update({"active": False})
        .eq("user_id", user_id)
        .eq("channel_id", channel_id)
        .eq("active", True)
        .execute()
    )
    return bool(res.data)


def subscribe_to_channel(
    user_id: str,
    channel_id: str,
    channel_name: str,
    channel_avatar_url: str | None = None,
) -> bool:
    """Subscribe user to a channel.

    Reactivates if previously inactive.
    Returns True if subscription is now active (new or reactivated),
    False if the user was already subscribed.
    """
    sb = get_client()
    existing = (
        sb.table("subscriptions")
        .select("id, active")
        .eq("user_id", user_id)
        .eq("channel_id", channel_id)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        if row["active"]:
            return False  # already subscribed
        update_data: dict = {"active": True}
        if channel_avatar_url:
            update_data["channel_avatar_url"] = channel_avatar_url
        sb.table("subscriptions").update(update_data).eq("id", row["id"]).execute()
        return True
    sb.table("subscriptions").insert({
        "user_id": user_id,
        "channel_id": channel_id,
        "channel_name": channel_name,
        "channel_avatar_url": channel_avatar_url,
    }).execute()
    return True


def get_subscription_count(user_id: str) -> int:
    """Count active channel subscriptions for a user."""
    sb = get_client()
    res = (
        sb.table("subscriptions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    )
    return res.count or 0


# ── WebSub Subscriptions ────────────────────────────────────────

def get_websub_subscriptions() -> dict[str, dict]:
    """Return all WebSub subscriptions as {channel_id: {status, expires_at}}."""
    sb = get_client()
    res = sb.table("websub_subscriptions").select("channel_id, status, expires_at").execute()
    return {row["channel_id"]: {"status": row["status"], "expires_at": row["expires_at"]} for row in (res.data or [])}


def upsert_websub_subscription(channel_id: str, expires_at: str | None = None, status: str = "pending"):
    """Upsert a WebSub subscription record."""
    sb = get_client()
    row: dict = {"channel_id": channel_id, "status": status}
    if expires_at is not None:
        row["expires_at"] = expires_at
    sb.table("websub_subscriptions").upsert(row, on_conflict="channel_id").execute()


def update_websub_active(channel_id: str, expires_at: str):
    """Mark a WebSub subscription as active with the given expiry (called by GET webhook verification)."""
    sb = get_client()
    sb.table("websub_subscriptions").update({
        "status": "active",
        "expires_at": expires_at,
    }).eq("channel_id", channel_id).execute()


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


# ── Worker Stats ─────────────────────────────────────────────────

def save_worker_stats(date: str, data: dict) -> None:
    """Upsert daily worker stats into the worker_stats table.

    Args:
        date: ISO date string (YYYY-MM-DD)
        data: dict with keys: videos_processed, videos_failed, deliveries_sent,
              deliveries_failed, groq_seconds_today, groq_cost_today
    """
    sb = get_client()
    sb.table("worker_stats").upsert(
        {
            "date": date,
            "videos_processed": data.get("videos_processed", 0),
            "videos_failed": data.get("videos_failed", 0),
            "deliveries_sent": data.get("deliveries_sent", 0),
            "deliveries_failed": data.get("deliveries_failed", 0),
            "groq_seconds": data.get("groq_seconds_today", 0.0),
            "groq_cost": data.get("groq_cost_today", 0.0),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="date",
    ).execute()


def load_worker_stats(date: str) -> dict | None:
    """Load worker stats for a given date. Returns None if no row exists."""
    sb = get_client()
    res = sb.table("worker_stats").select("*").eq("date", date).execute()
    return res.data[0] if res.data else None


def get_stale_r2_urls(days: int = 7, limit: int = 100) -> list[dict]:
    """Return R2 audio files that are old enough and safe to delete.

    A file is safe to delete when:
    - processed_at is older than `days` days
    - every delivery for this video_id has status='sent'
    """
    sb = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Fetch candidates: any non-null audio_url older than cutoff
    res = (
        sb.table("processed_videos")
        .select("video_id, language, audio_url")
        .eq("status", "completed")
        .not_.is_("audio_url", "null")
        .lt("processed_at", cutoff)
        .limit(limit * 3)
        .execute()
    )
    # Keep only R2 URLs (discard legacy Supabase Storage URLs)
    candidates = [
        r for r in (res.data or [])
        if r.get("audio_url") and (
            "r2.dev" in r["audio_url"] or "brief-tube.com" in r["audio_url"]
        )
    ]
    if not candidates:
        return []

    # Find video_ids with pending deliveries (failed = already abandoned, safe to delete)
    video_ids = list({r["video_id"] for r in candidates})
    unsafe_res = (
        sb.table("deliveries")
        .select("video_id")
        .in_("video_id", video_ids)
        .eq("status", "pending")
        .execute()
    )
    unsafe_ids = {r["video_id"] for r in (unsafe_res.data or [])}

    return [r for r in candidates if r["video_id"] not in unsafe_ids][:limit]


def clear_audio_url(video_id: str, language: str) -> None:
    """Set audio_url = NULL after the R2 file has been deleted."""
    sb = get_client()
    (
        sb.table("processed_videos")
        .update({"audio_url": None})
        .eq("video_id", video_id)
        .eq("language", language)
        .execute()
    )
