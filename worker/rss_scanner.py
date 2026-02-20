"""RSS Scanner — checks all subscribed channels for new videos."""

import calendar
import logging
import re
import time
import feedparser

import db

logger = logging.getLogger(__name__)


def get_rss_url(channel_id: str) -> str:
    return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


def extract_video_id(url: str) -> str | None:
    match = re.search(r"youtube\.com/watch\?[^\s]*v=([\w-]+)", url)
    if match:
        return match.group(1)
    match = re.search(r"youtu\.be/([\w-]+)", url)
    if match:
        return match.group(1)
    return None


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

    For each new video found:
    - Insert into processed_videos (pending)
    - Enqueue in processing_queue
    - Create deliveries for all subscribed users
    """
    channel_ids = db.get_all_channel_ids()
    logger.info(f"Scanning {len(channel_ids)} channels...")

    # Load all known video IDs once — avoids 3000+ individual DB queries per scan
    # (225 channels × 15 videos = up to 3375 is_video_processed calls otherwise).
    known_video_ids = db.get_all_known_video_ids()
    logger.info(f"Loaded {len(known_video_ids)} known video IDs into memory")

    new_count = 0
    for channel_id in channel_ids:
        try:
            videos = fetch_channel_videos(channel_id)
        except Exception as e:
            logger.error(f"Error fetching RSS for channel {channel_id}: {e}")
            continue

        for video in videos:
            vid = video["video_id"]

            # Skip if already known (local set lookup — no DB call)
            if vid in known_video_ids:
                continue

            # Skip YouTube Shorts
            if is_youtube_short(video["url"]):
                continue

            logger.info(f"New video: {video['title']} ({vid})")

            try:
                # Get all distinct (language, tts_voice) pairs from current subscribers
                subscriber_langs = db.get_subscriber_languages(channel_id)
                if not subscriber_langs:
                    # Channel has no active subscribers — nothing to process
                    known_video_ids.add(vid)
                    continue

                # Enqueue one job per unique subscriber language.
                # Each job generates a summary + audio in that language so that
                # every subscriber receives their preferred language.
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
                # If the error is a known constraint violation (duplicate key or
                # missing unique constraint), mark the video as known so the scanner
                # stops retrying it — deleting it would cause an infinite re-detect loop.
                if (
                    "23505" in error_str  # duplicate key
                    or "42P10" in error_str  # no unique constraint (harmless — row already inserted)
                    or "duplicate key" in error_str.lower()
                ):
                    known_video_ids.add(vid)
                else:
                    # Unexpected error — remove from processed_videos so the next
                    # scan retries it cleanly.
                    try:
                        db.get_client().table("processed_videos").delete().eq("video_id", vid).execute()
                    except Exception:
                        pass

    logger.info(f"Scan complete: {new_count} new videos found")
    return new_count
