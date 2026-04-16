"""Regenerate audio files for landing page demo videos.

These videos have summaries in the DB but their audio was deleted by the
automatic R2 cleanup. This script re-generates audio from existing summaries
using Edge TTS and re-uploads to R2.

Usage (on VPS):
    cd /home/brieftube/app/worker
    infisical run -- python regenerate_demo_audio.py
    infisical run -- python regenerate_demo_audio.py --dry-run
"""

import argparse
import asyncio
import logging
import sys

from dotenv import load_dotenv

load_dotenv(override=True)

import db
import storage
from text_cleaner import clean_for_tts
from tts_processor import text_to_audio

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Landing page demo videos — must match hero-player.tsx and db.PROTECTED_VIDEO_IDS
DEMO_VIDEOS = [
    {"video_id": "qp0HIF3SfI4", "language": "en"},
    {"video_id": "nm1TxQj9IsQ", "language": "en"},
]

VOICE = "en-US-JennyNeural"


async def regenerate(dry_run: bool = False) -> None:
    sb = db.get_client()

    for demo in DEMO_VIDEOS:
        vid = demo["video_id"]
        lang = demo["language"]
        storage_key = f"audio/{vid}_{lang}.mp3"

        # Fetch summary from DB
        res = (
            sb.table("processed_videos")
            .select("video_id, video_title, summary, audio_url")
            .eq("video_id", vid)
            .execute()
        )
        if not res.data:
            logger.error(f"[{vid}] Not found in DB — skipping")
            continue

        row = res.data[0]
        if row.get("audio_url"):
            logger.info(f"[{vid}] Already has audio_url — skipping: {row['audio_url']}")
            continue

        if not row.get("summary"):
            logger.error(f"[{vid}] No summary in DB — cannot regenerate")
            continue

        title = row.get("video_title", vid)
        logger.info(f"[{vid}] {title}")
        logger.info(f"  Summary: {len(row['summary'])} chars")

        if dry_run:
            logger.info(f"  [DRY RUN] Would generate audio → {storage_key}")
            continue

        # Clean text for TTS
        clean_text = clean_for_tts(row["summary"])
        logger.info(f"  Cleaned text: {len(clean_text)} chars")

        # Generate audio
        logger.info(f"  Generating audio with {VOICE}...")
        audio_path = await text_to_audio(
            text=clean_text,
            voice=VOICE,
            output_filename=f"{vid}_{lang}",
        )
        logger.info(f"  Audio generated: {audio_path} ({audio_path.stat().st_size / 1024:.0f} KB)")

        # Upload to R2
        logger.info(f"  Uploading to R2: {storage_key}")
        url = storage.upload_audio(audio_path, storage_key)
        logger.info(f"  Uploaded: {url}")

        # Update DB
        (
            sb.table("processed_videos")
            .update({"audio_url": url})
            .eq("video_id", vid)
            .eq("language", lang)
            .execute()
        )
        logger.info(f"  DB updated with audio_url")

        # Clean up local file
        audio_path.unlink(missing_ok=True)
        logger.info(f"  Done!")

    logger.info("\nAll demo videos processed.")


def main():
    parser = argparse.ArgumentParser(description="Regenerate landing page demo audio")
    parser.add_argument("--dry-run", action="store_true", help="Preview without generating")
    args = parser.parse_args()

    if not storage.is_configured():
        logger.error("R2 storage not configured. Set R2_* env vars.")
        sys.exit(1)

    asyncio.run(regenerate(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
