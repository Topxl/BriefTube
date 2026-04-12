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


# ── Title-based drama/movie detection (phrase match) ─────────────────────────
#
# Nollywood / African drama / long courses: no YouTube transcripts, 1-3h long,
# each Whisper retry downloads 50-65 MB via proxy → bandwidth explosion.

DRAMA_MOVIE_PHRASES: tuple[str, ...] = (
    "interesting movie",
    "funny movie",
    "nollywood",
    "will make you laugh",
    "teach you never to trust",
    "disguised prince",
    "will make you cry",
    "african movie",
    "nigerian movie",
    "nigerian movies",
    "latest 2026 movie",
    "latest 2025 movie",
    "nollywood movie",
    "nollywood film",
    "2026 nigerian",
    "2025 nigerian",
    # Ethiopian / Amharic drama series
    "ስኩል ላይፍ",
    "አፍላ ፍቅር",
    "liyu cinema",
    # Long free courses — no transcript, massive audio download
    "full course 2026",
    "full course 2025",
    "full course [free]",
    "full course for beginners",
    "tutorial for beginners | simplilearn",
    "tutorial for beginners | edureka",
)


# ── YouTube category + duration gates (Invidious metadata) ───────────────────
#
# Language-agnostic: uses YouTube's own metadata from Invidious API.
# Each category has a calibrated threshold — short clips (trailers, highlights,
# sermons) pass, long content (full movies, matches, episodes) is blocked.

CATEGORY_DURATION_GATES: dict[str, int] = {
    "film & animation": 1800,       # 30 min — trailers/reviews OK
    "sports":           3600,       # 60 min — highlights OK
    "entertainment":    3600,       # 60 min — clips OK
    "nonprofits & activism": 2700,  # 45 min — short talks OK
}


# ── YouTube keyword gates (creator-set tags) ─────────────────────────────────
#
# Catches cases where genre is mislabelled or missing. Requires duration > 30min.

MOVIE_KEYWORDS: frozenset[str] = frozenset({
    "full movie", "full film", "full episode", "complete movie",
    "full movie 2025", "full movie 2026",
    "nollywood movie", "nollywood film",
    "latest movie", "latest film",
})

# Minimum duration (seconds) for keyword-based movie detection
MOVIE_KEYWORD_MIN_DURATION: int = 1800  # 30 min


# ── Public API ───────────────────────────────────────────────────────────────


def is_music_title(title: str) -> bool:
    """Return True if the title matches music/ambient patterns (regex).

    Used by RSS scanner (pre-queue) and transcript extractor (pre-Whisper).
    """
    return bool(MUSIC_TITLE_RE.search(title))


def is_drama_movie_title(title: str) -> bool:
    """Return True if the title matches drama/movie/course patterns (phrase).

    Used by RSS scanner (pre-queue) and processor (pre-transcript).
    """
    title_lower = title.lower()
    return any(phrase in title_lower for phrase in DRAMA_MOVIE_PHRASES)


def is_youtube_short(url: str) -> bool:
    """Return True if the URL points to a YouTube Short."""
    return "/shorts/" in url


def should_skip_title(title: str) -> str | None:
    """Check all title-based filters. Returns skip reason or None.

    Combines music regex + drama phrase check into a single call.
    Returns: "music_content", "drama_movie", or None (no skip).
    """
    if is_music_title(title):
        return "music_content"
    if is_drama_movie_title(title):
        return "drama_movie"
    return None


def check_metadata_skip(
    genre: str,
    duration_seconds: int,
    keywords: set[str] | None = None,
) -> str | None:
    """Check Invidious metadata for skip conditions. Returns skip reason or None.

    Checks in order:
    1. Genre == "Music" → skip
    2. Category + duration gate → skip if over threshold
    3. Movie keywords + duration > 30min → skip

    Returns: "music_content", "drama_movie", or None (no skip).
    """
    genre_lower = genre.lower() if genre else ""

    # 1. Music genre (language-agnostic)
    if genre_lower == "music":
        return "music_content"

    # 2. Category + duration gates
    if duration_seconds and genre_lower in CATEGORY_DURATION_GATES:
        threshold = CATEGORY_DURATION_GATES[genre_lower]
        if duration_seconds > threshold:
            return "drama_movie"

    # 3. Movie keywords (creator-set tags)
    if keywords and duration_seconds and duration_seconds > MOVIE_KEYWORD_MIN_DURATION:
        keywords_lower = {kw.lower() for kw in keywords}
        if keywords_lower & MOVIE_KEYWORDS:
            return "drama_movie"

    return None
