"""Direct PostgreSQL implementation using psycopg2.

Drop-in replacement for db.py when the Supabase REST API (PostgREST) quota
is exceeded (HTTP 402). Direct psycopg2 connections bypass the PostgREST
quota enforcement layer.

Activated by setting SUPABASE_DB_URL in the environment:
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

All functions mirror the signatures in db.py exactly.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras
import psycopg2.pool

from config import SUPABASE_DB_URL

logger = logging.getLogger(__name__)

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1, maxconn=10,
            dsn=SUPABASE_DB_URL,
            connect_timeout=15,
        )
        logger.info("psycopg2 connection pool created (direct PostgreSQL)")
    return _pool


def reset_client() -> None:
    """No-op for direct psycopg2.

    The supabase-py code path calls reset_client() after HTTP/2 GOAWAY errors
    to drop the stale REST connection. psycopg2 pooled connections don't have
    that problem, and tearing down the pool while connections are checked out
    causes 'trying to put unkeyed connection' + connection leaks that exhaust
    the pool. Bad connections are dropped individually in _Conn.__exit__.
    """
    return


class _Conn:
    """Context manager: borrow a connection, return it to the SAME pool.

    Records the pool it borrowed from so a concurrent pool recreation can't
    cause the connection to be returned to a different pool ('unkeyed
    connection'). Broken connections are discarded (close=True) instead of
    being returned to the pool.
    """
    def __enter__(self):
        self._pool = _get_pool()
        self._conn = self._pool.getconn()
        self._conn.autocommit = True
        return self._conn

    def __exit__(self, exc_type, *_):
        try:
            self._pool.putconn(self._conn, close=exc_type is not None)
        except Exception as e:
            logger.warning(f"putconn failed (non-fatal), closing connection: {e}")
            try:
                self._conn.close()
            except Exception:
                pass


def _q(sql: str, params=None, *, fetchall: bool = True) -> list[dict]:
    with _Conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetchall:
                return [dict(r) for r in cur.fetchall()]
            return []


def _exec(sql: str, params=None) -> int:
    """Execute a DML statement, return rowcount."""
    with _Conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount


# ── Subscriptions ──────────────────────────────────────────────

def get_all_channel_ids() -> list[str]:
    rows = _q("SELECT DISTINCT channel_id FROM subscriptions")
    return [r["channel_id"] for r in rows]


def get_active_channel_ids() -> set[str]:
    now = datetime.now(timezone.utc)
    rows = _q("""
        SELECT DISTINCT s.channel_id
        FROM subscriptions s
        JOIN profiles p ON p.id = s.user_id
        WHERE s.active = true
          AND (
            p.subscription_status IN ('active', 'past_due')
            OR (p.subscription_status = 'free'
                AND p.trial_ends_at IS NOT NULL
                AND p.trial_ends_at > %s)
          )
    """, (now,))
    return {r["channel_id"] for r in rows}


def bulk_insert_channel_videos(videos: list[dict]) -> int:
    if not videos:
        return 0
    inserted = 0
    with _Conn() as conn:
        with conn.cursor() as cur:
            for v in videos:
                cur.execute("""
                    INSERT INTO channel_videos (video_id, channel_id, title, published_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (video_id) DO NOTHING
                """, (v["video_id"], v["channel_id"], v["title"], v["published_at"]))
                inserted += cur.rowcount
    return inserted


def get_subscriber_languages(channel_id: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows = _q("""
        SELECT
            p.id,
            COALESCE(p.preferred_language, 'fr') AS language,
            p.tts_voice,
            p.subscription_status,
            p.trial_ends_at,
            COALESCE(s.summary_length_pref, p.summary_length_pref) AS summary_length_pref,
            COALESCE(s.summary_style, p.summary_style) AS summary_style,
            COALESCE(s.summary_custom_instructions, p.summary_custom_instructions) AS summary_custom_instructions
        FROM subscriptions s
        JOIN profiles p ON p.id = s.user_id
        WHERE s.channel_id = %s AND s.active = true
    """, (channel_id,))

    seen: dict[str, dict] = {}
    for row in rows:
        status = row.get("subscription_status") or "free"
        trial = row.get("trial_ends_at")
        if status in ("active", "past_due"):
            pass
        elif status == "free" and trial:
            trial_dt = trial if isinstance(trial, datetime) else datetime.fromisoformat(str(trial))
            if trial_dt.tzinfo is None:
                trial_dt = trial_dt.replace(tzinfo=timezone.utc)
            if trial_dt <= now:
                continue
        else:
            continue
        lang = row.get("language") or "fr"
        if lang not in seen:
            seen[lang] = {
                "language": lang,
                "tts_voice": row.get("tts_voice"),
                "summary_length_pref": row.get("summary_length_pref"),
                "summary_style": row.get("summary_style"),
                "summary_custom_instructions": row.get("summary_custom_instructions"),
            }
    return list(seen.values())


# ── Processed Videos ───────────────────────────────────────────

def filter_known_video_ids(video_ids: list[str]) -> set[str]:
    if not video_ids:
        return set()
    rows = _q(
        "SELECT DISTINCT video_id FROM processed_videos WHERE video_id = ANY(%s)",
        (video_ids,)
    )
    return {r["video_id"] for r in rows}


def get_all_known_video_ids() -> set[str]:
    rows = _q("SELECT DISTINCT video_id FROM processed_videos")
    return {r["video_id"] for r in rows}


def get_recent_titles_by_channel(hours: int = 2) -> dict[str, set[str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = _q("""
        SELECT channel_id, video_title FROM processed_videos
        WHERE created_at >= %s AND channel_id IS NOT NULL AND video_title IS NOT NULL
    """, (cutoff,))
    result: dict[str, set[str]] = {}
    for row in rows:
        ch = row.get("channel_id")
        title = row.get("video_title")
        if ch and title:
            result.setdefault(ch, set()).add(title.lower().strip())
    return result


def is_video_processed(video_id: str) -> bool:
    rows = _q("SELECT 1 FROM processed_videos WHERE video_id = %s LIMIT 1", (video_id,))
    return bool(rows)


def insert_new_video(video_id: str, channel_id: str, video_title: str, video_url: str, language: str = "fr"):
    _exec("""
        INSERT INTO processed_videos (video_id, channel_id, video_title, video_url, status, language)
        VALUES (%s, %s, %s, %s, 'pending', %s)
        ON CONFLICT (video_id, language) DO NOTHING
    """, (video_id, channel_id, video_title, video_url, language))


def mark_video_completed(
    video_id: str,
    summary: str,
    audio_url: str | None = None,
    metadata: dict = None,
    language: str = "en",
    video_title: str | None = None,
    transcript_source: str | None = None,
    processing_time_s: float | None = None,
    audio_status: str = "completed",
    length_pref: str | None = None,
    style_pref: str | None = None,
    model_used: str | None = None,
    summary_cost_usd: float | None = None,
    summary_word_count: int | None = None,
):
    meta = dict(metadata) if metadata else {}
    if processing_time_s is not None:
        meta["processing_time_s"] = round(processing_time_s, 1)

    sets = [
        "summary = %s",
        "status = 'completed'",
        "processed_at = %s",
        "audio_status = %s",
    ]
    vals: list = [summary, datetime.now(timezone.utc), audio_status]

    if audio_url is not None:
        sets.append("audio_url = %s"); vals.append(audio_url)
    if metadata:
        sets += [
            "transcript_cost = %s",
            "transcript_length = %s",
            "source_language = %s",
            "summary_length = %s",
        ]
        vals += [
            metadata.get("transcript_cost", 0),
            metadata.get("transcript_length", 0),
            metadata.get("source_language", ""),
            metadata.get("summary_length", 0),
        ]
    if meta:
        sets.append("metadata = %s"); vals.append(json.dumps(meta))
    if transcript_source:
        sets.append("transcript_source = %s"); vals.append(transcript_source)
    if video_title:
        sets.append("video_title = %s"); vals.append(video_title)
    if length_pref is not None:
        sets.append("length_pref = %s"); vals.append(length_pref)
    if style_pref is not None:
        sets.append("style_pref = %s"); vals.append(style_pref)
    if model_used is not None:
        sets.append("model_used = %s"); vals.append(model_used)
    if summary_cost_usd is not None:
        sets.append("summary_cost_usd = %s"); vals.append(summary_cost_usd)
    if summary_word_count is not None:
        sets.append("summary_word_count = %s"); vals.append(summary_word_count)

    vals += [video_id, language]
    _exec(
        f"UPDATE processed_videos SET {', '.join(sets)} WHERE video_id = %s AND language = %s",
        vals,
    )


def update_video_audio(video_id: str, language: str, audio_url: str | None, audio_status: str, audio_duration_sec: float | None = None) -> None:
    sets = ["audio_status = %s"]
    vals: list = [audio_status]
    if audio_url is not None:
        sets.append("audio_url = %s"); vals.append(audio_url)
    if audio_duration_sec is not None:
        sets.append("audio_duration_sec = %s"); vals.append(audio_duration_sec)
    vals += [video_id, language]
    _exec(f"UPDATE processed_videos SET {', '.join(sets)} WHERE video_id = %s AND language = %s", vals)
    logger.info(f"[{video_id}] audio_status → {audio_status}")


def update_video_latency(video_id: str, language: str, latency_ms: dict) -> None:
    _exec(
        "UPDATE processed_videos SET generation_latency_ms = %s WHERE video_id = %s AND language = %s",
        (json.dumps(latency_ms), video_id, language),
    )


def save_transcript_text(video_id: str, text: str) -> None:
    if not text:
        return
    try:
        _exec("UPDATE processed_videos SET transcript_text = %s WHERE video_id = %s", (text, video_id))
    except Exception as e:
        logger.warning(f"[{video_id}] transcript_text write failed (non-fatal): {e}")


def mark_video_failed(video_id: str, language: str = "fr", immediate: bool = False, all_languages: bool = False, error_reason: str | None = None):
    meta_json = json.dumps({"error": error_reason}) if error_reason else None
    if all_languages:
        rows = _q("""
            SELECT failure_count, language FROM processed_videos
            WHERE video_id = %s AND status IN ('pending', 'processing')
        """, (video_id,))
        for row in rows:
            count = (row.get("failure_count") or 0) + 1
            status = "failed" if (immediate or count >= 3) else "pending"
            if meta_json:
                _exec("UPDATE processed_videos SET failure_count=%s, status=%s, metadata=%s WHERE video_id=%s AND language=%s",
                      (count, status, meta_json, video_id, row["language"]))
            else:
                _exec("UPDATE processed_videos SET failure_count=%s, status=%s WHERE video_id=%s AND language=%s",
                      (count, status, video_id, row["language"]))
        return

    rows = _q("SELECT failure_count FROM processed_videos WHERE video_id=%s AND language=%s", (video_id, language))
    if not rows:
        return
    count = (rows[0].get("failure_count") or 0) + 1
    status = "failed" if (immediate or count >= 3) else "pending"
    if meta_json:
        _exec("UPDATE processed_videos SET failure_count=%s, status=%s, metadata=%s WHERE video_id=%s AND language=%s",
              (count, status, meta_json, video_id, language))
    else:
        _exec("UPDATE processed_videos SET failure_count=%s, status=%s WHERE video_id=%s AND language=%s",
              (count, status, video_id, language))


def has_audio_subscribers(channel_id: str, language: str) -> bool:
    rows = _q("""
        SELECT 1 FROM subscriptions s
        JOIN profiles p ON p.id = s.user_id
        WHERE s.channel_id = %s AND s.active = true
          AND p.audio_enabled = true
          AND COALESCE(p.preferred_language, 'en') = %s
        LIMIT 1
    """, (channel_id, language))
    return bool(rows)


def get_processed_video(video_id: str, language: str) -> dict | None:
    rows = _q("""
        SELECT video_id, video_title, channel_id, summary, audio_url, language
        FROM processed_videos WHERE video_id=%s AND language=%s
    """, (video_id, language))
    return rows[0] if rows else None


def get_any_processed_video(video_id: str) -> dict | None:
    rows = _q("SELECT video_id, video_title, channel_id FROM processed_videos WHERE video_id=%s LIMIT 1", (video_id,))
    return rows[0] if rows else None


def get_available_languages_for_video(video_id: str) -> list[str]:
    rows = _q("SELECT language FROM processed_videos WHERE video_id=%s AND status='completed'", (video_id,))
    return [r["language"] for r in rows]


def get_next_pending_language_for_video(video_id: str, processed_language: str) -> str | None:
    rows = _q("""
        SELECT language FROM processed_videos
        WHERE video_id=%s AND status='pending' AND language != %s LIMIT 1
    """, (video_id, processed_language))
    return rows[0]["language"] if rows else None


def get_telegram_chat_ids_for_video(video_id: str) -> list[str]:
    rows = _q("SELECT channel_id FROM processed_videos WHERE video_id=%s AND channel_id != '' LIMIT 1", (video_id,))
    if not rows or not rows[0].get("channel_id"):
        return []
    channel_id = rows[0]["channel_id"]
    subs = _q("SELECT user_id FROM subscriptions WHERE channel_id=%s AND active=true", (channel_id,))
    if not subs:
        return []
    user_ids = [s["user_id"] for s in subs]
    conns = _q("""
        SELECT external_id FROM platform_connections
        WHERE user_id = ANY(%s::uuid[]) AND platform='telegram' AND connected=true
    """, (user_ids,))
    return [c["external_id"] for c in conns]


def clear_audio_url(video_id: str, language: str) -> None:
    _exec("UPDATE processed_videos SET audio_url = NULL WHERE video_id=%s AND language=%s", (video_id, language))


# ── Processing Queue ───────────────────────────────────────────

def enqueue_video(
    video_id: str, youtube_url: str, video_title: str, channel_id: str,
    language: str = "fr", tts_voice: str | None = None,
    summary_length_pref: str | None = None, summary_style: str | None = None,
    summary_custom_instructions: str | None = None,
):
    rows = _q("SELECT id, status FROM processing_queue WHERE video_id=%s", (video_id,))
    if not rows:
        cols = ["video_id", "youtube_url", "video_title", "channel_id", "status", "user_language"]
        vals: list = [video_id, youtube_url, video_title, channel_id, "queued", language]
        for col, val in [("tts_voice", tts_voice), ("summary_length_pref", summary_length_pref),
                         ("summary_style", summary_style), ("summary_custom_instructions", summary_custom_instructions)]:
            if val:
                cols.append(col); vals.append(val)
        placeholders = ", ".join(["%s"] * len(cols))
        _exec(f"INSERT INTO processing_queue ({', '.join(cols)}) VALUES ({placeholders})", vals)
        return
    job = rows[0]
    if job["status"] in ("queued", "processing"):
        return
    _exec("UPDATE processing_queue SET status='queued', user_language=%s, attempts=0, started_at=NULL WHERE id=%s",
          (language, job["id"]))


def enqueue_video_for_language(
    video_id: str, youtube_url: str, video_title: str, channel_id: str,
    language: str, tts_voice: str | None = None,
) -> bool:
    rows = _q("SELECT id, status FROM processing_queue WHERE video_id=%s", (video_id,))
    if not rows:
        _exec("""
            INSERT INTO processing_queue (video_id, youtube_url, video_title, channel_id, status, user_language, tts_voice)
            VALUES (%s, %s, %s, %s, 'queued', %s, %s)
        """, (video_id, youtube_url, video_title, channel_id, language, tts_voice))
        return True
    job = rows[0]
    if job["status"] in ("queued", "processing"):
        return False
    _exec("UPDATE processing_queue SET status='queued', user_language=%s, tts_voice=%s, attempts=0, started_at=NULL WHERE id=%s",
          (language, tts_voice, job["id"]))
    return True


def pick_next_job() -> dict | None:
    rows = _q("SELECT * FROM pick_next_processing_job()")
    return rows[0] if rows else None


def complete_job(job_id: str):
    _exec("DELETE FROM processing_queue WHERE id=%s", (job_id,))


def snooze_job(job_id: str, hours: int = 0, minutes: int = 0) -> None:
    retry_after = datetime.now(timezone.utc) + timedelta(hours=hours, minutes=minutes)
    _exec("UPDATE processing_queue SET status='queued', retry_after=%s, started_at=NULL WHERE id=%s",
          (retry_after, job_id))
    logger.info(f"Job {job_id} snoozed for {hours}h{minutes}min")


def fail_job(job_id: str, immediate: bool = False, retry_after_minutes: int = 0, error_reason: str | None = None) -> bool:
    rows = _q("SELECT attempts, video_id, user_language FROM processing_queue WHERE id=%s", (job_id,))
    if not rows:
        return False
    row = rows[0]
    attempts = (row.get("attempts") or 0) + 1
    user_language = row.get("user_language") or "fr"
    status = "failed" if (immediate or attempts >= 3) else "queued"

    if status == "failed":
        _exec("DELETE FROM processing_queue WHERE id=%s", (job_id,))
        video_id = row.get("video_id")
        if video_id:
            mark_video_failed(video_id, language=user_language, immediate=True, all_languages=True, error_reason=error_reason)
        return True

    if retry_after_minutes > 0:
        retry_after = datetime.now(timezone.utc) + timedelta(minutes=retry_after_minutes)
        _exec("UPDATE processing_queue SET status=%s, attempts=%s, retry_after=%s WHERE id=%s",
              (status, attempts, retry_after, job_id))
    else:
        _exec("UPDATE processing_queue SET status=%s, attempts=%s WHERE id=%s", (status, attempts, job_id))
    return False


def reset_stuck_processing_jobs(timeout_seconds: int = 700) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)
    rows = _q("""
        SELECT id, attempts FROM processing_queue
        WHERE status='processing' AND (started_at < %s OR started_at IS NULL)
    """, (cutoff,))
    count = 0
    for row in rows:
        new_attempts = (row.get("attempts") or 0) + 1
        new_status = "failed" if new_attempts >= 3 else "queued"
        _exec("UPDATE processing_queue SET status=%s, attempts=%s WHERE id=%s",
              (new_status, new_attempts, row["id"]))
        count += 1
    return count


# ── Platform Connections ────────────────────────────────────────

def get_platform_connections_for_users(user_ids: list[str]) -> list[dict]:
    if not user_ids:
        return []
    return _q("""
        SELECT user_id, platform, external_id, credentials
        FROM platform_connections WHERE user_id = ANY(%s::uuid[]) AND connected=true
    """, (user_ids,))


def mark_user_platform_disconnected(user_id: str, platform: str) -> None:
    try:
        _exec("UPDATE platform_connections SET connected=false WHERE user_id=%s AND platform=%s",
              (user_id, platform))
        logger.info(f"Marked user {user_id[:8]}… as {platform} disconnected")
    except Exception as e:
        logger.warning(f"Could not mark user {user_id[:8]}… as {platform} disconnected: {e}")


def mark_user_telegram_disconnected(user_id: str) -> None:
    mark_user_platform_disconnected(user_id, "telegram")


# ── Deliveries ─────────────────────────────────────────────────

def create_deliveries_for_video(video_id: str, channel_id: str, language: str = "en", audio_only: bool = False):
    now = datetime.now(timezone.utc)
    subs = _q("""
        SELECT p.id, COALESCE(p.audio_enabled, true) AS audio_enabled
        FROM subscriptions s
        JOIN profiles p ON p.id = s.user_id
        WHERE s.channel_id=%s AND s.active=true
          AND COALESCE(p.preferred_language, 'en') = %s
          AND (
            p.subscription_status = 'active'
            OR (p.subscription_status = 'free' AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > %s)
          )
    """, (channel_id, language, now))
    if not subs:
        return

    user_ids = [u["id"] for u in subs]
    audio_pref = {u["id"]: u.get("audio_enabled", True) for u in subs}

    existing = _q("""
        SELECT user_id, COALESCE(platform,'telegram') AS platform
        FROM deliveries WHERE video_id=%s AND language=%s AND user_id=ANY(%s::uuid[])
    """, (video_id, language, user_ids))
    existing_pairs = {(r["user_id"], r["platform"]) for r in existing}

    if audio_only:
        ids_for_conn = [uid for uid in user_ids if audio_pref.get(uid, True)]
    else:
        ids_for_conn = user_ids

    connections = _q("""
        SELECT user_id, platform FROM platform_connections
        WHERE user_id=ANY(%s::uuid[]) AND connected=true
    """, (ids_for_conn,)) if ids_for_conn else []

    to_insert: list[tuple] = []
    now_iso = now.isoformat()

    if audio_only:
        audio_set = {uid for uid in user_ids if audio_pref.get(uid, True)}
        for c in connections:
            uid, plat = c["user_id"], c["platform"]
            if uid in audio_set and (uid, plat) not in existing_pairs:
                to_insert.append((uid, video_id, "pending", language, plat, True, now_iso))
    else:
        non_audio_set = {uid for uid in user_ids if not audio_pref.get(uid, True)}
        for c in connections:
            uid, plat = c["user_id"], c["platform"]
            if uid in non_audio_set and (uid, plat) not in existing_pairs:
                to_insert.append((uid, video_id, "pending", language, plat, False, now_iso))
        existing_uids = {uid for uid, _ in existing_pairs}
        for uid in user_ids:
            if uid not in existing_uids:
                to_insert.append((uid, video_id, "sent", language, "web", False, now_iso))

    if to_insert:
        with _Conn() as conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO deliveries (user_id, video_id, status, language, platform, audio_required, created_at)
                    VALUES %s ON CONFLICT DO NOTHING
                """, to_insert)
        logger.info(f"Video {video_id}: {len(to_insert)} deliveries created")


def get_pending_deliveries(limit: int = 20) -> list[dict]:
    raw = _q("""
        SELECT id, user_id, video_id, language, platform, audio_required
        FROM deliveries WHERE status='pending'
        ORDER BY created_at LIMIT %s
    """, (limit * 5,))
    if not raw:
        return []

    video_ids = list({d["video_id"] for d in raw})
    pv = _q("""
        SELECT video_id, language, video_title, channel_id, summary, audio_url
        FROM processed_videos WHERE status='completed' AND video_id=ANY(%s)
    """, (video_ids,))
    video_map = {(v["video_id"], v.get("language") or "fr"): v for v in pv}
    completed_ids = {v["video_id"] for v in pv}

    raw = [d for d in raw if d["video_id"] in completed_ids]
    if not raw:
        return []

    seen: set[tuple] = set()
    deduped: list[dict] = []
    for d in raw:
        key = (d["user_id"], d["video_id"], d.get("platform") or "telegram")
        if key not in seen:
            seen.add(key)
            deduped.append(d)

    user_ids = list({d["user_id"] for d in deduped})
    profiles = _q("SELECT id, tts_voice FROM profiles WHERE id=ANY(%s::uuid[])", (user_ids,))
    profile_map = {p["id"]: p for p in profiles}
    conns = _q("""
        SELECT user_id, platform, external_id, credentials
        FROM platform_connections WHERE user_id=ANY(%s::uuid[]) AND connected=true
    """, (user_ids,))
    conn_map = {(c["user_id"], c["platform"]): c for c in conns}

    results = []
    for d in deduped:
        lang = d.get("language") or "fr"
        v = video_map.get((d["video_id"], lang))
        if not v:
            continue
        plat = d.get("platform") or "telegram"
        c = conn_map.get((d["user_id"], plat))
        if not c:
            continue
        p = profile_map.get(d["user_id"])
        results.append({
            "delivery_id": d["id"],
            "user_id": d["user_id"],
            "platform": plat,
            "external_id": c["external_id"],
            "credentials": c.get("credentials") or {},
            "tts_voice": p.get("tts_voice") if p else None,
            "video_id": v["video_id"],
            "language": lang,
            "video_title": v["video_title"],
            "channel_id": v["channel_id"],
            "summary": v["summary"],
            "audio_url": v["audio_url"],
            "audio_required": d.get("audio_required", True),
        })
        if len(results) >= limit:
            break
    return results


def claim_delivery(delivery_id: str) -> bool:
    return _exec("""
        UPDATE deliveries SET status='sending'
        WHERE id=%s AND status='pending'
    """, (delivery_id,)) > 0


def mark_delivery_sent(delivery_id: str):
    _exec("UPDATE deliveries SET status='sent', sent_at=%s WHERE id=%s",
          (datetime.now(timezone.utc), delivery_id))


def mark_delivery_failed(delivery_id: str):
    _exec("UPDATE deliveries SET status='failed' WHERE id=%s", (delivery_id,))


def reset_sending_deliveries() -> int:
    return _exec("UPDATE deliveries SET status='pending' WHERE status='sending'")


def cleanup_undeliverable_deliveries() -> int:
    # Simplified: just mark deliveries for failed videos as failed
    n = _exec("""
        UPDATE deliveries d SET status='failed'
        FROM processed_videos pv
        WHERE d.video_id=pv.video_id AND d.status='pending' AND pv.status='failed'
    """)
    return n


def recover_failed_deliveries() -> int:
    n = _exec("""
        UPDATE deliveries d SET status='pending'
        FROM processed_videos pv
        WHERE d.video_id=pv.video_id AND d.status='failed' AND d.sent_at IS NULL
          AND pv.status='completed' AND pv.audio_url IS NOT NULL
    """)
    if n:
        logger.info(f"Recovered {n} failed deliveries → pending")
    return n


def cleanup_old_channel_videos(days: int = 30) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return _exec("DELETE FROM channel_videos WHERE created_at < %s", (cutoff,))


def count_on_demand_this_month(user_id: str) -> int:
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = _q("""
        SELECT COUNT(*) AS n FROM deliveries
        WHERE user_id=%s AND source='on_demand' AND created_at>=%s
    """, (user_id, month_start))
    return rows[0]["n"] if rows else 0


# ── Shared Summaries ───────────────────────────────────────────

def get_profile_by_telegram(telegram_chat_id: str) -> dict | None:
    rows = _q("""
        SELECT p.id, p.subscription_status, p.trial_ends_at, p.max_channels,
               p.preferred_language, p.tts_voice, p.favorite_languages
        FROM platform_connections pc
        JOIN profiles p ON p.id = pc.user_id
        WHERE pc.platform='telegram' AND pc.external_id=%s AND pc.connected=true
    """, (telegram_chat_id,))
    return rows[0] if rows else None


# ── Subscriptions helpers ───────────────────────────────────────

def is_subscribed_to_channel(user_id: str, channel_id: str) -> bool:
    rows = _q("SELECT 1 FROM subscriptions WHERE user_id=%s AND channel_id=%s AND active=true LIMIT 1",
              (user_id, channel_id))
    return bool(rows)


def get_subscription_count(user_id: str) -> int:
    rows = _q("SELECT COUNT(*) AS n FROM subscriptions WHERE user_id=%s AND active=true", (user_id,))
    return rows[0]["n"] if rows else 0


# ── Worker Stats ───────────────────────────────────────────────

def save_worker_stats(date: str, data: dict) -> None:
    try:
        _exec("""
            INSERT INTO worker_stats (date, videos_processed, videos_failed, deliveries_sent, deliveries_failed, groq_seconds, groq_cost, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (date) DO UPDATE SET
              videos_processed=EXCLUDED.videos_processed,
              videos_failed=EXCLUDED.videos_failed,
              deliveries_sent=EXCLUDED.deliveries_sent,
              deliveries_failed=EXCLUDED.deliveries_failed,
              groq_seconds=EXCLUDED.groq_seconds,
              groq_cost=EXCLUDED.groq_cost,
              updated_at=EXCLUDED.updated_at
        """, (date, data.get("videos_processed",0), data.get("videos_failed",0),
              data.get("deliveries_sent",0), data.get("deliveries_failed",0),
              data.get("groq_seconds_today",0.0), data.get("groq_cost_today",0.0),
              datetime.now(timezone.utc)))
    except Exception as e:
        logger.warning(f"save_worker_stats failed (non-fatal): {e}")


def load_worker_stats(date: str) -> dict | None:
    try:
        rows = _q("SELECT * FROM worker_stats WHERE date=%s", (date,))
        return rows[0] if rows else None
    except Exception as e:
        logger.warning(f"load_worker_stats failed (non-fatal): {e}")
        return None


# ── R2 Audio Cleanup ───────────────────────────────────────────

PROTECTED_VIDEO_IDS = {"qp0HIF3SfI4", "nm1TxQj9IsQ"}


def get_stale_r2_urls(days: int = 7, limit: int = 100) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    candidates = _q("""
        SELECT video_id, language, audio_url FROM processed_videos
        WHERE status='completed' AND audio_url IS NOT NULL AND processed_at < %s
        LIMIT %s
    """, (cutoff, limit * 3))
    candidates = [r for r in candidates
                  if r["video_id"] not in PROTECTED_VIDEO_IDS
                  and r.get("audio_url")
                  and ("r2.dev" in r["audio_url"] or "brief-tube.com" in r["audio_url"])]
    if not candidates:
        return []
    video_ids = list({r["video_id"] for r in candidates})
    unsafe = _q("SELECT video_id FROM deliveries WHERE video_id=ANY(%s) AND status='pending'", (video_ids,))
    unsafe_ids = {r["video_id"] for r in unsafe}
    return [r for r in candidates if r["video_id"] not in unsafe_ids][:limit]
