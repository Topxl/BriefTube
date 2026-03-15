"""RSS Scanner — checks all subscribed channels for new videos."""

import calendar
import logging
import re
import time
import feedparser
from concurrent.futures import ThreadPoolExecutor, as_completed

import db
from youtube_utils import extract_video_id as _yt_extract_video_id

logger = logging.getLogger(__name__)

# High-confidence music/ambient title patterns — only match clear-cut cases
# to avoid false positives (podcasts with "music" in channel name, etc.).
# English-only: language-agnostic detection is handled later via Invidious genre check.
_MUSIC_TITLE_RE = re.compile(
    r'\blofi\b'
    r'|\bchill beats?\b'
    r'|\b(?:study|sleep|relax(?:ing)?|focus)\s+music\b'
    r'|\b\d+\s*h(?:ours?)?\s+(?:of\s+)?(?:music|beats?|jazz|classical|lofi|ambient)\b'
    r'|\bbeats?\s+to\s+(?:study|relax|sleep|chill)\b'
    r'|\b(?:no[- ]copyright|background|bgm)\s+music\b'
    r'|\b(?:instrumental|ambient)\s+(?:music|mix|playlist)\b'
    r'|\b24/?7\s+(?:music|stream|radio|lofi|chill)\b'
    r'|\bmusic\s+(?:mix|playlist|24/?7|radio|live)\b',
    re.IGNORECASE,
)


def is_likely_music(title: str) -> bool:
    """Detect music/ambient videos by title. Returns True only for high-confidence matches."""
    return bool(_MUSIC_TITLE_RE.search(title))


def get_rss_url(channel_id: str) -> str:
    return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


def extract_video_id(url: str) -> str | None:
    """Delegate to the shared youtube_utils implementation."""
    return _yt_extract_video_id(url)


def is_youtube_short(url: str) -> bool:
    return "/shorts/" in url


def fetch_channel_videos(channel_id: str) -> list[dict]:
    """Fetch recent videos from a YouTube channel via RSS.

    Videos whose publish date is in the future (Premieres, scheduled drops)
    are skipped — they'll be picked up naturally on the next scan once live.
    """
    rss_url = get_rss_url(channel_id)
    feed = feedparser.parse(rss_url)
    now = time.time()

    videos = []
    for entry in feed.entries:
        video_id = entry.yt_videoid if hasattr(entry, "yt_videoid") else None
        if not video_id:
            video_id = extract_video_id(entry.link)
        if not video_id:
            continue

        # Skip videos scheduled for future publication (Premieres, etc.)
        published = getattr(entry, "published_parsed", None)
        if published:
            published_ts = calendar.timegm(published)  # UTC timestamp
            if published_ts > now + 60:  # 1-min grace to handle clock skew
                logger.debug(f"Skipping future video: {entry.title} (publishes in {int((published_ts - now) / 3600)}h)")
                continue

        videos.append({
            "video_id": video_id,
            "title": entry.title,
            "url": entry.link,
            "channel_id": channel_id,
            "channel_name": feed.feed.title if hasattr(feed.feed, "title") else "Unknown",
        })
    return videos


def scan_all_channels():
    """Scan all subscribed channels for new videos.

    Fetches all RSS feeds in parallel (up to 50 concurrent HTTP requests)
    then processes results sequentially for DB writes.
    """
    channel_ids = db.get_all_channel_ids()
    logger.info(f"Scanning {len(channel_ids)} channels...")

    # Load known video IDs once — avoids 3000+ individual DB queries per scan
    known_video_ids = db.get_all_known_video_ids()
    logger.info(f"Loaded {len(known_video_ids)} known video IDs into memory")

    # Fetch all RSS feeds in parallel — 50x faster than sequential
    channel_videos: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(fetch_channel_videos, ch): ch for ch in channel_ids}
        for future in as_completed(futures):
            ch = futures[future]
            try:
                channel_videos[ch] = future.result()
            except Exception as e:
                logger.error(f"Error fetching RSS for channel {ch}: {e}")

    new_count = 0
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

            logger.info(f"New video: {video['title']} ({vid})")

            try:
                # Get all distinct (language, tts_voice) pairs from current subscribers
                subscriber_langs = db.get_subscriber_languages(channel_id)
                if not subscriber_langs:
                    # Channel has no active subscribers — nothing to process
                    known_video_ids.add(vid)
                    continue

                for lang_info in subscriber_langs:
                    lang = lang_info["language"]
                    tts_voice = lang_info["tts_voice"]
                    db.insert_new_video(vid, channel_id, video["title"], video["url"], language=lang)
                    db.enqueue_video(vid, video["url"], video["title"], channel_id, language=lang, tts_voice=tts_voice)
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

    logger.info(f"Scan complete: {new_count} new videos found")
    return new_count
