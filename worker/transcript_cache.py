"""Transcript cache — avoids re-extracting the same video's transcript.

In-memory LRU for hot lookups, backed by JSON files on disk so language-chained
jobs (which are separate _process_video calls) can reuse the transcript.
Thread-safe via threading.Lock (methods are called from asyncio.to_thread).
"""

import json
import logging
import threading
import time
from collections import OrderedDict
from pathlib import Path

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).parent / "cache"
_MAX_MEMORY_ENTRIES = 200
_TTL_SECONDS = 3600  # 1 hour — enough for language chaining


class TranscriptCache:
    """Thread-safe transcript cache with memory + disk backing."""

    def __init__(self) -> None:
        self._mem: OrderedDict[str, dict] = OrderedDict()
        self._lock = threading.Lock()
        _CACHE_DIR.mkdir(exist_ok=True)

    def get(self, video_id: str) -> dict | None:
        """Return cached transcript or None if miss/expired."""
        with self._lock:
            if video_id in self._mem:
                entry = self._mem[video_id]
                if time.time() - entry["cached_at"] < _TTL_SECONDS:
                    self._mem.move_to_end(video_id)
                    logger.info(f"[{video_id}] Transcript cache HIT (memory)")
                    return entry
                del self._mem[video_id]

        disk_path = _CACHE_DIR / f"{video_id}.json"
        if disk_path.exists():
            try:
                entry = json.loads(disk_path.read_text())
                if time.time() - entry.get("cached_at", 0) < _TTL_SECONDS:
                    with self._lock:
                        self._mem[video_id] = entry
                        self._evict()
                    logger.info(f"[{video_id}] Transcript cache HIT (disk)")
                    return entry
                disk_path.unlink(missing_ok=True)
            except Exception:
                disk_path.unlink(missing_ok=True)

        return None

    def put(self, video_id: str, text: str, language: str, cost: float, source: str) -> None:
        """Store transcript in cache (memory + disk)."""
        entry = {
            "text": text,
            "language": language,
            "cost": cost,
            "source": source,
            "cached_at": time.time(),
        }
        with self._lock:
            self._mem[video_id] = entry
            self._evict()

        try:
            (_CACHE_DIR / f"{video_id}.json").write_text(json.dumps(entry))
        except Exception as e:
            logger.warning(f"[{video_id}] Transcript cache disk write failed: {e}")

        logger.info(f"[{video_id}] Transcript cached ({len(text)} chars, source={source})")

    def _evict(self) -> None:
        """Evict oldest entries if over limit. Must hold lock."""
        while len(self._mem) > _MAX_MEMORY_ENTRIES:
            evicted_id, _ = self._mem.popitem(last=False)
            (_CACHE_DIR / f"{evicted_id}.json").unlink(missing_ok=True)


# Module-level singleton
transcript_cache = TranscriptCache()
