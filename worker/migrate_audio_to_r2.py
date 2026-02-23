"""Migration script: Supabase Storage → Cloudflare R2.

Downloads every audio file currently stored in Supabase Storage,
re-uploads it to R2, and updates the audio_url in processed_videos.

Run once after configuring R2 credentials:
    python migrate_audio_to_r2.py

Options:
    --dry-run   Print what would be migrated without making changes.
    --limit N   Only migrate the first N rows (useful for testing).
"""

import argparse
import logging
import sys
import time
from pathlib import Path
import tempfile

import requests
from dotenv import load_dotenv

load_dotenv(override=True)

import db
import storage
from config import SUPABASE_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SUPABASE_STORAGE_PREFIX = f"{SUPABASE_URL}/storage/v1/object/public/"


def is_supabase_url(url: str) -> bool:
    return url.startswith(SUPABASE_STORAGE_PREFIX) or ".supabase.co/storage" in url


def storage_key_from_url(url: str) -> str:
    """Extract the R2 storage key from a Supabase public URL.

    e.g. https://xxx.supabase.co/storage/v1/object/public/audio/abc_fr.mp3
    →    audio/abc_fr.mp3
    """
    # Strip everything up to and including /public/
    marker = "/object/public/"
    idx = url.find(marker)
    if idx == -1:
        # Fallback: use last two path segments (bucket/key)
        parts = url.rstrip("/").rsplit("/", 2)
        return "/".join(parts[-2:]) if len(parts) >= 2 else url
    return url[idx + len(marker):]


def migrate(dry_run: bool = False, limit: int = 0) -> None:
    if not storage.is_configured():
        logger.error("R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
                     "R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL in .env")
        sys.exit(1)

    sb = db.get_client()

    # Fetch all rows that still point to Supabase Storage
    query = (
        sb.table("processed_videos")
        .select("video_id, language, audio_url")
        .eq("status", "completed")
        .not_.is_("audio_url", "null")
    )
    if limit:
        query = query.limit(limit)

    rows = query.execute().data or []
    supabase_rows = [r for r in rows if r.get("audio_url") and is_supabase_url(r["audio_url"])]

    logger.info(f"Found {len(rows)} completed videos — {len(supabase_rows)} still on Supabase Storage")

    if not supabase_rows:
        logger.info("Nothing to migrate.")
        return

    ok = 0
    failed = 0

    for i, row in enumerate(supabase_rows, 1):
        video_id = row["video_id"]
        language = row["language"]
        old_url = row["audio_url"]
        storage_key = storage_key_from_url(old_url)

        logger.info(f"[{i}/{len(supabase_rows)}] {video_id} ({language}) — {storage_key}")

        if dry_run:
            logger.info(f"  DRY RUN: would upload → {storage_key}")
            continue

        # Download from Supabase Storage
        try:
            resp = requests.get(old_url, timeout=60)
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"  Download failed: {e}")
            failed += 1
            continue

        # Upload to R2
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp.write(resp.content)
                tmp_path = Path(tmp.name)

            new_url = storage.upload_audio(tmp_path, storage_key)
            tmp_path.unlink(missing_ok=True)
        except Exception as e:
            logger.error(f"  R2 upload failed: {e}")
            failed += 1
            tmp_path.unlink(missing_ok=True)
            continue

        # Update DB
        try:
            sb.table("processed_videos").update({"audio_url": new_url}).eq(
                "video_id", video_id
            ).eq("language", language).execute()
        except Exception as e:
            logger.error(f"  DB update failed: {e}")
            failed += 1
            continue

        logger.info(f"  ✓ {old_url[:60]}... → {new_url[:60]}...")
        ok += 1

        # Be gentle with the Supabase Storage rate limiter
        time.sleep(0.2)

    logger.info(f"\nDone — {ok} migrated, {failed} failed" + (" (dry run)" if dry_run else ""))
    if failed:
        logger.warning("Some files failed — re-run the script to retry.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate audio from Supabase Storage to Cloudflare R2")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    parser.add_argument("--limit", type=int, default=0, help="Migrate only first N rows")
    args = parser.parse_args()

    migrate(dry_run=args.dry_run, limit=args.limit)
