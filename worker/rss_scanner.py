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
            for video in videos:
                vid = video["video_id"]

                # Skip if already known (local set lookup — no DB call)
                if vid in known_video_ids:
                    continue

                # Skip YouTube Shorts
                if is_youtube_short(video["url"]):
                    continue

                logger.info(f"New video: {video['title']} ({vid})")

                # Insert into processed_videos as pending
                db.insert_new_video(vid, channel_id, video["title"], video["url"])

                # Add to processing queue
                db.enqueue_video(vid, video["url"], video["title"], channel_id)

                # Create delivery entries for all subscribers
                db.create_deliveries_for_video(vid, channel_id)

                new_count += 1

        except Exception as e:
            logger.error(f"Error scanning channel {channel_id}: {e}")

    logger.info(f"Scan complete: {new_count} new videos found")
    return new_count
