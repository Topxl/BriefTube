"""Shared YouTube utilities — constants and helpers used across worker modules.

Centralises patterns and helpers that were previously duplicated between
transcript_extractor.py, whisper_transcriber.py and rss_scanner.py.
"""

import logging
import re
import time

logger = logging.getLogger(__name__)


# ── Shared "direct connection blocked" state ───────────────────────────────────
#
# When YouTube blocks the VPS IP (bot detection / rate limit), every direct
# yt-dlp or youtube-transcript-api call fails immediately.  Retrying direct
# on the next video is pointless and wastes time (each failed attempt ~1-2s).
#
# Both transcript_extractor.py and whisper_transcriber.py call
# mark_direct_blocked() when they detect a block, and check is_direct_blocked()
# before attempting direct connections — skipping straight to proxy instead.
#
# Thread-safe: Python float reads/writes are atomic under the GIL.
_direct_blocked_until: float = 0.0


def is_direct_blocked() -> bool:
    """Return True if direct YouTube connections are currently known to be blocked."""
    return time.monotonic() < _direct_blocked_until


def mark_direct_blocked(duration_seconds: float = 43200.0) -> None:
    """Mark direct YouTube connections as blocked for *duration_seconds*.

    Default: 12 hours — Hetzner VPS IPs are permanently bot-detected by YouTube.
    Retrying direct every hour just wastes ~18s per first-video-after-reset.
    One probe every 12h is enough to detect if the block lifts.
    """
    global _direct_blocked_until
    _direct_blocked_until = time.monotonic() + duration_seconds
    logger.info(
        f"Direct YouTube blocked — skipping direct attempts for {duration_seconds:.0f}s"
    )


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
# ios + mweb recommended 2026; android + tv_embedded as additional fallbacks.
PLAYER_CLIENTS_FULL: list[list[str]] = [["ios"], ["mweb"], ["android"], ["tv_embedded"]]

# Short chain: used for audio download in Whisper (heavy requests, fail fast).
# ios + mweb is the recommended 2026 pair (android_vr deprecated, tv_embedded secondary).
PLAYER_CLIENTS_SHORT: list[list[str]] = [["ios"], ["mweb"]]


# ── Bot-detection keywords ────────────────────────────────────────────────────

BOT_DETECTION_KEYWORDS: tuple[str, ...] = (
    "sign in",
    "not a bot",
    "confirm you",
    "please sign",
)


# ── Geo-restriction detection ─────────────────────────────────────────────────

GEO_RESTRICTION_KEYWORDS: tuple[str, ...] = (
    "your country",
    "this country",
    "not available in your",
    "national security",
    "government",
    "unavailable in this country",
)


def is_geo_restricted(err: str) -> bool:
    """Return True if the error indicates a geo-restriction (video blocked in this region).

    When this is detected, the caller should attempt a geo-bypass proxy (US IPs)
    rather than abandoning — many geo-restrictions are bypassed by using a US
    residential IP (configured via YOUTUBE_PROXY_HTTP_GEO env var).
    """
    err_lower = err.lower()
    return any(kw in err_lower for kw in GEO_RESTRICTION_KEYWORDS)


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
