"""RSS Scanner — checks all subscribed channels for new videos."""

import calendar
import logging
import re
import time
import urllib.request
from datetime import datetime, timezone
import feedparser
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError

import db
from content_filter import is_music_title as is_likely_music
from content_filter import is_youtube_short
from youtube_utils import extract_video_id as _yt_extract_video_id

logger = logging.getLogger(__name__)


_VALID_CHANNEL_ID_RE = re.compile(r"^UC[a-zA-Z0-9_\-]{22}$")


def is_valid_channel_id(channel_id: str) -> bool:
    """Return True only for real YouTube channel IDs (UCxxxxxxxxxxxxxxxxxxxxxxxx).

    Guards against names / raw URLs accidentally stored in the DB — those would
    produce malformed RSS URLs and noisy errors on every scan.
    """
    return bool(_VALID_CHANNEL_ID_RE.match(channel_id))


def get_rss_url(channel_id: str) -> str:
    return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


def extract_video_id(url: str) -> str | None:
    """Delegate to the shared youtube_utils implementation."""
    return _yt_extract_video_id(url)


MAX_VIDEO_AGE_DAYS = 15  # Ignore videos published more than this many days ago
_RSS_FETCH_TIMEOUT = 30   # seconds per feed — prevents hung TCP from blocking a thread
_RSS_SCAN_TIMEOUT = 180   # seconds total for all feeds in one scan cycle


def fetch_channel_videos(channel_id: str) -> list[dict]:
    """Fetch recent videos from a YouTube channel via RSS.

    - Future videos (Premieres, scheduled) are skipped — picked up once live.
    - Videos older than MAX_VIDEO_AGE_DAYS are skipped — prevents RSS entries
      from weeks ago being re-queued when a new subscriber joins the channel.
    """
    rss_url = get_rss_url(channel_id)
    req = urllib.request.Request(rss_url)
    with urllib.request.urlopen(req, timeout=_RSS_FETCH_TIMEOUT) as response:
        content = response.read()
    feed = feedparser.parse(content)
    now = time.time()
    max_age_cutoff = now - MAX_VIDEO_AGE_DAYS * 86400

    videos = []
    for entry in feed.entries:
        video_id = entry.yt_videoid if hasattr(entry, "yt_videoid") else None
        if not video_id:
            video_id = extract_video_id(entry.link)
        if not video_id:
            continue

        published = getattr(entry, "published_parsed", None)
        published_ts = calendar.timegm(published) if published else None

        if published_ts is not None:
            # Skip future videos (Premieres, scheduled drops)
            if published_ts > now + 60:
                logger.debug(f"Skipping future video: {entry.title} (publishes in {int((published_ts - now) / 3600)}h)")
                continue
            # Skip videos too old to be relevant
            if published_ts < max_age_cutoff:
                continue

        videos.append({
            "video_id": video_id,
            "title": entry.title,
            "url": entry.link,
            "channel_id": channel_id,
            "channel_name": feed.feed.title if hasattr(feed.feed, "title") else "Unknown",
            "published_ts": published_ts,
        })
    return videos


def scan_all_channels():
    """Scan all subscribed channels for new videos.

    Fetches all RSS feeds in parallel (up to 50 concurrent HTTP requests)
    then processes results sequentially for DB writes.
    """
    channel_ids = db.get_all_channel_ids()
    active_channel_ids = db.get_active_channel_ids()
    logger.info(f"Scanning {len(channel_ids)} channels ({len(active_channel_ids)} active)...")

    # Drop invalid channel IDs before doing any work — these are names or URLs
    # accidentally stored in the DB (no UCxxx format). Log once so admins can
    # clean them up; don't spam an error on every scan.
    valid_channel_ids = [ch for ch in channel_ids if is_valid_channel_id(ch)]
    invalid = set(channel_ids) - set(valid_channel_ids)
    for ch in invalid:
        logger.warning(f"Skipping invalid channel_id (not a UC… ID): {ch!r}")

    # Load known video IDs once — avoids 3000+ individual DB queries per scan
    known_video_ids = db.get_all_known_video_ids()
    logger.info(f"Loaded {len(known_video_ids)} known video IDs into memory")

    # Load recent titles per channel (last 2h) for re-upload deduplication
    # Channels sometimes delete + re-upload the same video → new video_id, same title
    recent_titles_by_channel = db.get_recent_titles_by_channel(hours=2)
    logger.info(f"Loaded recent titles for {len(recent_titles_by_channel)} channels (2h window)")

    # Fetch all RSS feeds in parallel — limit concurrency to avoid CPU saturation.
    # 50 threads caused load 10-16 on the VPS (99% CPU, blocking all processing).
    # 20 threads keeps load < 4 while still being 20x faster than sequential.
    channel_videos: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_channel_videos, ch): ch for ch in valid_channel_ids}
        try:
            for future in as_completed(futures, timeout=_RSS_SCAN_TIMEOUT):
                ch = futures[future]
                try:
                    channel_videos[ch] = future.result()
                except Exception as e:
                    logger.error(f"Error fetching RSS for channel {ch}: {e}")
        except FuturesTimeoutError:
            timed_out = [ch for fut, ch in futures.items() if not fut.done()]
            logger.warning(f"RSS scan timeout: {len(timed_out)} channels skipped (did not respond in {_RSS_SCAN_TIMEOUT}s)")

    # Detect first-time channels: channels where NONE of their current RSS videos
    # are in known_video_ids. On first scan, the full 15-day RSS backlog looks
    # "new" — cap processing at 1 video to avoid a backlog explosion when a user
    # subscribes to a channel or the scanner gains access to new channels.
    first_time_channels: set[str] = {
        ch for ch, vids in channel_videos.items()
        if not any(v["video_id"] in known_video_ids for v in vids)
    }
    if first_time_channels:
        logger.info(
            f"First-time channels (will cap at 1 video each): {len(first_time_channels)}"
        )
    first_time_processed: dict[str, int] = {}  # channel_id → count processed

    new_count = 0
    inbox_batch: list[dict] = []
    for channel_id, videos in channel_videos.items():
        for video in videos:
            vid = video["video_id"]

            # Skip if already known (local set lookup — no DB call)
            if vid in known_video_ids:
                continue

            # Skip YouTube Shorts
            if is_youtube_short(video["url"]):
                continue

            # Skip music/ambient content by title — avoids wasting Groq Whisper quota.
            # Duration alone is NOT a signal (6h+ podcasts like Lex Fridman must pass).
            if is_likely_music(video["title"]):
                logger.info(f"Music/ambient skip (title): {video['title'][:80]} ({vid})")
                known_video_ids.add(vid)
                continue

            # Skip re-uploads: same title seen on this channel in the last 2h
            # (channels delete + re-upload → new video_id, identical title)
            title_lower = video["title"].lower().strip()
            if title_lower in recent_titles_by_channel.get(channel_id, set()):
                logger.info(
                    f"Duplicate title skip (re-upload, 2h window): "
                    f"{video['title'][:80]} ({vid})"
                )
                known_video_ids.add(vid)
                continue

            logger.info(f"New video: {video['title']} ({vid})")

            # Always record in channel_videos (inbox for all channels)
            inbox_batch.append({
                "video_id": vid,
                "channel_id": channel_id,
                "title": video["title"],
                "published_at": (
                    datetime.fromtimestamp(video["published_ts"], tz=timezone.utc).isoformat()
                    if video.get("published_ts")
                    else datetime.now(timezone.utc).isoformat()
                ),
            })

            try:
                # Only process videos from active channels
                if channel_id not in active_channel_ids:
                    known_video_ids.add(vid)
                    continue

                # First-time channel guard: cap at 1 video to prevent backlog flood.
                # RSS feeds are newest-first, so the first video we encounter is the
                # latest. Subsequent scans will pick up new videos normally.
                if channel_id in first_time_channels:
                    if first_time_processed.get(channel_id, 0) >= 1:
                        logger.debug(
                            f"First-scan cap: skip {video['title'][:60]} ({vid})"
                        )
                        known_video_ids.add(vid)
                        continue
                    first_time_processed[channel_id] = first_time_processed.get(channel_id, 0) + 1

                # Get all distinct (language, tts_voice, summary prefs) from current subscribers
                subscriber_langs = db.get_subscriber_languages(channel_id)
                if not subscriber_langs:
                    known_video_ids.add(vid)
                    continue

                for lang_info in subscriber_langs:
                    lang = lang_info["language"]
                    tts_voice = lang_info["tts_voice"]
                    db.insert_new_video(vid, channel_id, video["title"], video["url"], language=lang)
                    db.enqueue_video(
                        vid, video["url"], video["title"], channel_id,
                        language=lang, tts_voice=tts_voice,
                        summary_length_pref=lang_info.get("summary_length_pref"),
                        summary_style=lang_info.get("summary_style"),
                        summary_custom_instructions=lang_info.get("summary_custom_instructions"),
                    )
                    db.create_deliveries_for_video(vid, channel_id, language=lang)

                known_video_ids.add(vid)  # prevent double-insert within same scan
                new_count += 1
            except Exception as e:
                error_str = str(e)
                logger.error(f"Error queuing video {vid} ({video['title'][:40]}): {e}")
                if (
                    "23505" in error_str  # duplicate key
                    or "42P10" in error_str  # no unique constraint
                    or "duplicate key" in error_str.lower()
                ):
                    known_video_ids.add(vid)
                else:
                    try:
                        db.get_client().table("processed_videos").delete().eq("video_id", vid).execute()
                    except Exception:
                        pass

    # Flush inbox batch to channel_videos
    if inbox_batch:
        try:
            inserted = db.bulk_insert_channel_videos(inbox_batch)
            logger.info(f"Inbox: {inserted} new videos added to channel_videos ({len(inbox_batch)} candidates)")
        except Exception as e:
            logger.error(f"Failed to insert channel_videos batch: {e}")

    logger.info(f"Scan complete: {new_count} new videos queued for processing")
    return new_count
