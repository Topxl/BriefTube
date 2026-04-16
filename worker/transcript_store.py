"""Permanent transcript archive on the VPS filesystem.

Stores full transcripts as JSON files in /home/brieftube/transcripts/ (production)
or worker/transcripts/ (local dev). Unlike the ephemeral transcript_cache (1h TTL,
200 entries), this archive is permanent and never evicted.

Each file is named {video_id}.json and contains:
  - text: full transcript
  - language: source language detected
  - source: extraction method (youtube_api, invidious, whisper, etc.)
  - cost: extraction cost in USD
  - saved_at: ISO timestamp

Usage:
    from transcript_store import transcript_store

    # Save after extraction
    transcript_store.save(video_id, text, language, source, cost)

    # Load for re-summarization
    entry = transcript_store.load(video_id)
    if entry:
        transcript = entry["text"]
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Production: /home/brieftube/transcripts/ (outside app dir, survives redeploys)
# Local dev: worker/transcripts/
_PROD_DIR = Path("/home/brieftube/transcripts")
_DEV_DIR = Path(__file__).parent / "transcripts"
_STORE_DIR = _PROD_DIR if _PROD_DIR.parent.exists() else _DEV_DIR


class TranscriptStore:
    """Permanent transcript file archive."""

    def __init__(self, store_dir: Path = _STORE_DIR) -> None:
        self._dir = store_dir
        self._dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Transcript store: {self._dir}")

    def save(
        self,
        video_id: str,
        text: str,
        language: str,
        source: str,
        cost: float = 0.0,
    ) -> None:
        """Save transcript to disk. Overwrites if already exists."""
        entry = {
            "text": text,
            "language": language,
            "source": source,
            "cost": cost,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        path = self._dir / f"{video_id}.json"
        try:
            path.write_text(json.dumps(entry, ensure_ascii=False))
            logger.debug(f"[{video_id}] Transcript archived ({len(text)} chars)")
        except Exception as e:
            logger.warning(f"[{video_id}] Transcript archive failed: {e}")

    def load(self, video_id: str) -> dict | None:
        """Load transcript from disk. Returns None if not found."""
        path = self._dir / f"{video_id}.json"
        if not path.exists():
            return None
        try:
            entry = json.loads(path.read_text())
            if entry.get("text"):
                return entry
        except Exception as e:
            logger.warning(f"[{video_id}] Transcript archive read failed: {e}")
        return None

    def exists(self, video_id: str) -> bool:
        """Check if transcript is archived."""
        return (self._dir / f"{video_id}.json").exists()

    def count(self) -> int:
        """Return number of archived transcripts."""
        return len(list(self._dir.glob("*.json")))

    @property
    def directory(self) -> Path:
        return self._dir


# Module-level singleton
transcript_store = TranscriptStore()
