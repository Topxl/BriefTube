#!/usr/bin/env python3
"""
Backfill channel_id for videos in processed_videos where it's NULL or empty.

Fetches the real UC channel ID from YouTube by:
1. Calling oEmbed to get the channel handle (@xxx)
2. Scraping the channel page to get the real UC... ID

Usage:
    SUPABASE_SERVICE_ROLE_KEY=<key> python3 scripts/backfill-channel-ids.py
"""
import os
import re
import sys
import time
import json
from urllib.request import urlopen, Request
from urllib.parse import quote
from supabase import create_client

SUPABASE_URL = "https://zetpgbrzehchzxodwbps.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY env var required")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_video_metadata(video_id: str) -> dict:
    """Returns {title, channel_id, channel_name} using oEmbed + channel page scrape."""
    try:
        # Step 1: oEmbed for title + author_url (handle)
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=10) as resp:
            oembed = json.loads(resp.read().decode())

        title = oembed.get("title")
        author_url = oembed.get("author_url", "")
        handle_match = re.search(r"@([a-zA-Z0-9_-]+)", author_url)
        if not handle_match:
            return {"title": title, "channel_id": None, "channel_name": oembed.get("author_name")}

        handle = handle_match.group(1)

        # Step 2: Scrape the channel page to get the real UC ID
        channel_url = f"https://www.youtube.com/@{handle}"
        req = Request(channel_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        uc_match = re.search(r"channel/([A-Za-z0-9_-]{24})", html)
        channel_id = uc_match.group(1) if uc_match else None

        return {
            "title": title,
            "channel_id": channel_id,
            "channel_name": oembed.get("author_name"),
        }
    except Exception as e:
        return {"title": None, "channel_id": None, "channel_name": None, "error": str(e)}


def main():
    # Fetch all videos with empty/null channel_id
    result = sb.table("processed_videos") \
        .select("video_id, video_title") \
        .or_("channel_id.is.null,channel_id.eq.") \
        .execute()

    if not result.data:
        print("No videos to backfill")
        return

    unique_ids = list({v["video_id"] for v in result.data})
    print(f"Found {len(unique_ids)} unique videos to backfill")

    fixed = 0
    failed = 0
    for i, video_id in enumerate(unique_ids, 1):
        metadata = fetch_video_metadata(video_id)
        if not metadata.get("channel_id"):
            failed += 1
            print(f"  [{i}/{len(unique_ids)}] {video_id}: FAILED - {metadata.get('error', 'no channel found')}")
            time.sleep(0.3)
            continue

        # Update all rows (all languages) for this video
        try:
            update_data = {"channel_id": metadata["channel_id"]}
            if metadata.get("title"):
                update_data["video_title"] = metadata["title"]

            sb.table("processed_videos") \
                .update(update_data) \
                .eq("video_id", video_id) \
                .or_("channel_id.is.null,channel_id.eq.") \
                .execute()

            fixed += 1
            print(f"  [{i}/{len(unique_ids)}] {video_id}: OK -> {metadata['channel_id']}")
        except Exception as e:
            failed += 1
            print(f"  [{i}/{len(unique_ids)}] {video_id}: UPDATE FAILED - {e}")

        time.sleep(0.3)  # Rate limit

    print(f"\nDone: {fixed} fixed, {failed} failed / {len(unique_ids)} total")


if __name__ == "__main__":
    main()
