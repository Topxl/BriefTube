"""Shared YouTube utilities — constants and helpers used across worker modules.

Centralises patterns and helpers that were previously duplicated between
transcript_extractor.py, whisper_transcriber.py and rss_scanner.py.
"""

import logging
import re

logger = logging.getLogger(__name__)


# ── Premiere / scheduled-live detection ───────────────────────────────────────

_PREMIERE_RE = re.compile(
    r"live event will begin"
    r"|premiere will begin"
    r"|this event will begin"
    r"|scheduled to begin"
    r"|upcoming premiere"
    r"|premieres? in \d+",  # "Premieres in 5 hours" / "Premiere in 2 days"
    re.IGNORECASE,
)


def hours_until_premiere(err: str) -> int:
    """Parse premiere delay from a yt-dlp error message. Returns default of 2h.

    Handles both:
    - "will begin in X days/hours/minutes" (scheduled live)
    - "Premieres in X days/hours/minutes"  (premiere video)
    """
    m = re.search(r"(?:begin|premieres?) in (\d+) days?", err, re.IGNORECASE)
    if m:
        return max(1, int(m.group(1)) * 24)
    m = re.search(r"(?:begin|premieres?) in (\d+) hours?", err, re.IGNORECASE)
    if m:
        return max(1, int(m.group(1)))
    m = re.search(r"(?:begin|premieres?) in (\d+) minutes?", err, re.IGNORECASE)
    if m:
        return max(1, (int(m.group(1)) + 59) // 60)
    return 2  # safe default


# ── yt-dlp player clients ─────────────────────────────────────────────────────

# Full chain: used for subtitle extraction (light requests, worth trying all clients).
# ios is fastest; android, tv_embedded and mweb are fallbacks for datacenter IPs.
PLAYER_CLIENTS_FULL: list[list[str]] = [["ios"], ["android"], ["tv_embedded"], ["mweb"]]

# Short chain: used for audio download in Whisper (heavy requests, fail fast).
# Two clients is enough — android rarely succeeds when ios fails on the same IP.
PLAYER_CLIENTS_SHORT: list[list[str]] = [["ios"], ["tv_embedded"]]


# ── Bot-detection keywords ────────────────────────────────────────────────────

BOT_DETECTION_KEYWORDS: tuple[str, ...] = (
    "sign in",
    "not a bot",
    "confirm you",
    "please sign",
)


# ── Free YouTube proxy instances ──────────────────────────────────────────────

# Public Invidious instances — open-source YouTube frontend.
# /api/v1/captions/{id} → VTT subtitles
# /api/v1/videos/{id}   → adaptiveFormats (audio stream URLs)
# Shuffled per call for load balancing; fails gracefully if all are down.
INVIDIOUS_INSTANCES: list[str] = [
    "https://invidious.privacydev.net",
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://iv.datura.network",
    "https://invidious.lunar.icu",
]

# Public Piped instances — alternative YouTube frontend.
# /streams/{id} → { audioStreams: [...], subtitles: [...] }
# Shuffled per call for load balancing; fails gracefully if all are down.
PIPED_INSTANCES: list[str] = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.syncpundit.io",
    "https://piped-api.garudalinux.org",
    "https://api.piped.projectsegfau.lt",
]


# ── Video ID extraction ───────────────────────────────────────────────────────

def extract_video_id(url: str) -> str | None:
    """Extract a YouTube video ID from any supported URL format.

    Handles:
    - https://www.youtube.com/watch?v=VIDEO_ID  (with or without extra params)
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    """
    # Standard watch URL — [?&]v= handles both first and subsequent query params
    m = re.search(r"[?&]v=([\w-]+)", url)
    if m:
        return m.group(1)
    # Short URL
    m = re.search(r"youtu\.be/([\w-]+)", url)
    if m:
        return m.group(1)
    # Embed URL
    m = re.search(r"youtube\.com/embed/([\w-]+)", url)
    if m:
        return m.group(1)
    logger.debug(f"Could not extract video ID from URL: {url}")
    return None
