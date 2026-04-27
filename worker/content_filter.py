"""Centralized content filtering — single source of truth for skip rules.

All title-based, genre-based, category+duration, and keyword filters live here.
Consumers: rss_scanner.py (RSS scan), main.py (processor pre-filter),
transcript_extractor.py (Invidious metadata gate, Whisper pre-filter).

Adding a new filter:
1. Add patterns/phrases to the appropriate constant below
2. All 3 pipeline stages pick it up automatically — no copy-paste needed
"""

import logging
import re

logger = logging.getLogger(__name__)


# ── Title-based music/ambient detection (regex) ─────────────────────────────
#
# High-confidence patterns only — avoids false positives on podcasts about music.
# English-centric: language-agnostic detection is handled by genre check.

MUSIC_TITLE_RE = re.compile(
    # Generic lofi / beats
    r'\blofi\b'
    r'|\bchill beats?\b'
    r'|\b(?:study|sleep|relax(?:ing)?|focus)\s+music\b'
    r'|\b\d+\s*h(?:ours?)?\s+(?:of\s+)?(?:music|beats?|jazz|classical|lofi|ambient)\b'
    r'|\bbeats?\s+to\s+(?:study|relax|sleep|chill)\b'
    r'|\b(?:no[- ]copyright|background|bgm)\s+music\b'
    r'|\b(?:instrumental|ambient)\s+(?:music|mix|playlist)\b'
    r'|\b24/?7\s+(?:music|stream|radio|lofi|chill)\b'
    r'|\bmusic\s+(?:mix|playlist|24/?7|radio|live)\b'
    # Official audio / Topic channels
    r'|\(official\s+audio\)'
    r'|\s-\s+Topic$'
    # Worship / gospel / Christian praise music
    r'|\bworship\s+(?:songs?|music|anthems?)\b'
    r'|\bpraise\s+(?:&\s*)?worship\b'
    r'|\bchristian\s+(?:praise|songs?|music)\b'
    r'|\bgospel\s+(?:songs?|music)\b'
    r'|\bhillsong\b'
    r'|\bnonstop\s+(?:worship|praise|christian|gospel)\b'
    r'|\bpraise\s+(?:songs?|collection|music)\b'
    # Hindu / South Asian devotional music
    r'|\bbhajan\b'
    r'|\baarti\b'
    r'|\bchalisa\b'
    r'|\bnonstop\s+(?:bhajan|mantra|kirtan)\b'
    r'|\b(?:jayanti|janmotsav)\s+(?:special|song|bhajan)\b'
    r'|\bjukebox\b'
    # Tamil / South Indian music
    r'|\btamil\s+(?:mass\s+)?songs?\b'
    r'|\bmass\s+songs?\b'
    r'|\bvijay\s+songs?\b'
    r'|\bgana\s+\w+\b'
    # Ambient / healing / frequency music
    r'|\bchakra\b'
    r'|\bsolfeggio\b'
    r'|\b(?:healing|meditation|sleep|relaxing)\s+(?:music|sounds?|frequency|frequencies)\b'
    r'|\bsoundscape\b'
    r'|\b\d+\s*hz\b'
    r'|\bbinaural\b'
    r'|\bwhite\s+noise\b'
    r'|\brain\s+sounds?\b',
    re.IGNORECASE,
)


# ── Public API ───────────────────────────────────────────────────────────────


def is_music_title(title: str) -> bool:
    """Return True if the title matches music/ambient patterns (regex).

    Used by RSS scanner (pre-queue) and transcript extractor (pre-Whisper).
    """
    return bool(MUSIC_TITLE_RE.search(title))


def is_youtube_short(url: str) -> bool:
    """Return True if the URL points to a YouTube Short."""
    return "/shorts/" in url


def should_skip_title(title: str) -> str | None:
    """Check title-based filters. Returns skip reason or None.

    Returns: "music_content" or None (no skip).
    """
    if is_music_title(title):
        return "music_content"
    return None


def check_metadata_skip(
    genre: str,
    duration_seconds: int,
    keywords: set[str] | None = None,
) -> str | None:
    """Check Invidious metadata for skip conditions. Returns skip reason or None.

    Only the music genre check remains. Category/duration and movie keyword
    gates were removed because they were catching legitimate long-form podcasts
    and entertainment content (false positives).

    Returns: "music_content" or None (no skip).
    """
    genre_lower = genre.lower() if genre else ""
    if genre_lower == "music":
        return "music_content"
    return None
