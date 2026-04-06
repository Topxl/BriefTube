"""Shared YouTube utilities — constants and helpers used across worker modules.

Centralises patterns and helpers that were previously duplicated between
transcript_extractor.py, whisper_transcriber.py and rss_scanner.py.
"""

import logging
import os
import random
import re
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)


# ── Static ISP proxy pool (rotation across owned static IPs) ──────────────────
#
# YOUTUBE_PROXY_HTTP_LIST contains a newline- or comma-separated list of
# full proxy URLs (http://user:pass@host:port). Each call picks one at random,
# distributing load across the owned Static ISP IPs. This is the primary
# proxy pool — used for transcript fetching and Whisper audio downloads.
#
# If the list is empty or unset, falls back to the single YOUTUBE_PROXY_HTTP
# URL for backwards compatibility.
#
# YOUTUBE_PROXY_HTTP_GEO_TEMPLATE (separate env var) is used ONLY for
# geo-restricted videos — it points to the Rotating Residential backbone
# with a {country} placeholder for country-targeted bypass.


def _parse_proxy_list(raw: str) -> list[str]:
    """Split YOUTUBE_PROXY_HTTP_LIST into individual URLs.

    Accepts newline, comma or semicolon separators. Empty entries stripped.
    """
    if not raw:
        return []
    for sep in ("\n", ";", ","):
        if sep in raw:
            return [u.strip() for u in raw.split(sep) if u.strip()]
    return [raw.strip()] if raw.strip() else []


def get_random_static_proxy_url() -> str:
    """Return a randomly chosen proxy URL from the static ISP pool.

    Reads YOUTUBE_PROXY_HTTP_LIST (newline/comma-separated). Picks one at
    random so that load is distributed across owned IPs and YouTube bot
    detection is less likely to flag a single IP.

    Falls back to YOUTUBE_PROXY_HTTP (single URL) if the list is not set.
    Returns "" if no proxy is configured at all.
    """
    pool = _parse_proxy_list(os.environ.get("YOUTUBE_PROXY_HTTP_LIST", ""))
    if pool:
        return random.choice(pool)
    return os.environ.get("YOUTUBE_PROXY_HTTP", "")


def get_static_proxy_pool() -> list[str]:
    """Return the full pool of static proxy URLs (for stats/logging)."""
    pool = _parse_proxy_list(os.environ.get("YOUTUBE_PROXY_HTTP_LIST", ""))
    if pool:
        return pool
    single = os.environ.get("YOUTUBE_PROXY_HTTP", "")
    return [single] if single else []


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
    """Return True if the error indicates a geo-restriction (video blocked in this region)."""
    err_lower = err.lower()
    return any(kw in err_lower for kw in GEO_RESTRICTION_KEYWORDS)


# ── Geo-bypass proxy rotation ─────────────────────────────────────────────────
#
# Default fallback order when the video language is unknown or unmapped.
# The language-specific country (from _LANGUAGE_TO_COUNTRY) is always prepended
# at runtime, so this list is only the "everything else" safety net.
_GEO_BYPASS_COUNTRIES: list[str] = [
    "US", "GB", "CA", "AU", "FR", "DE", "JP", "KR", "NL", "SE",
    "CH", "IT", "ES", "PT", "BR", "MX", "PL", "RU", "TH", "IN",
    "SG", "TW", "HK", "ID", "VN", "TR", "IL", "AE", "ZA", "UA",
]


def country_from_proxy_url(url: str) -> str:
    """Extract country code from a Webshare-style proxy URL for logging.

    e.g. 'http://user-US-rotate:pass@host' → 'US'
    """
    m = re.search(r"-([A-Z]{2})-rotate", url)
    return m.group(1) if m else "??"


# ── Language → country mapping for geo-restriction bypass ─────────────────────
#
# When a video is geo-restricted, the country that natively produces content in
# that language is the most likely to have unrestricted access.  Targeting that
# country first avoids cycling through irrelevant countries and wastes no proxy
# bandwidth.

_LANGUAGE_TO_COUNTRY: dict[str, str] = {
    # European
    "en": "US",
    "fr": "FR",
    "de": "DE",
    "es": "ES",
    "it": "IT",
    "pt": "BR",
    "nl": "NL",
    "pl": "PL",
    "ru": "RU",
    "sv": "SE",
    "da": "DK",
    "fi": "FI",
    "nb": "NO",
    "no": "NO",
    "cs": "CZ",
    "sk": "SK",
    "hu": "HU",
    "ro": "RO",
    "uk": "UA",
    "bg": "BG",
    "hr": "HR",
    "sr": "RS",
    "sl": "SI",
    "el": "GR",
    "lt": "LT",
    "lv": "LV",
    "et": "EE",
    "ca": "ES",
    # Asian
    "ja": "JP",
    "ko": "KR",
    "zh": "TW",
    "zh-tw": "TW",
    "zh-hk": "HK",
    "zh-cn": "HK",  # mainland CN → HK (more reliable proxy)
    "th": "TH",
    "vi": "VN",
    "id": "ID",
    "ms": "MY",
    "tl": "PH",
    "hi": "IN",
    "bn": "BD",
    "ur": "PK",
    "ta": "IN",
    "te": "IN",
    "ml": "IN",
    "kn": "IN",
    "si": "LK",
    "km": "KH",
    "my": "MM",
    "lo": "LA",
    "mn": "MN",
    "ka": "GE",
    "hy": "AM",
    "az": "AZ",
    "kk": "KZ",
    "uz": "UZ",
    # Middle East / Africa
    "ar": "AE",
    "he": "IL",
    "fa": "AE",  # Persian content — Iran proxy unreliable, AE better
    "tr": "TR",
    "sw": "KE",
    "am": "ET",
    "yo": "NG",
    "ha": "NG",
    "ig": "NG",
    "zu": "ZA",
    # Americas
    "pt-br": "BR",
    "es-mx": "MX",
    "es-ar": "MX",
}


def get_geo_proxy_urls_for_language(language: str | None = None) -> list[str]:
    """Return geo-proxy URLs ordered by relevance to the video's source language.

    When a video is geo-restricted, we try the country that natively produces
    content in that language first — it's the most likely to have unrestricted
    access.  If the primary country fails or is unknown, we fall through to the
    full country list.

    Args:
        language: BCP-47 language code of the video (e.g. "fr", "fr-FR", "ja").
                  Pass None to use the default country order.

    Requires YOUTUBE_PROXY_HTTP_GEO_TEMPLATE in Infisical with a {country}
    placeholder, e.g.:
      http://USERNAME-{country}-rotate:PASSWORD@p.webshare.io:80

    Falls back to YOUTUBE_PROXY_HTTP if the template is not set.
    """
    template = os.environ.get("YOUTUBE_PROXY_HTTP_GEO_TEMPLATE", "")
    if not template:
        single = os.environ.get("YOUTUBE_PROXY_HTTP", "")
        return [single] if single else []

    countries = list(_GEO_BYPASS_COUNTRIES)

    if language:
        # Try full tag first (e.g. "zh-TW"), then base code (e.g. "zh")
        lang_lower = language.lower()
        primary = _LANGUAGE_TO_COUNTRY.get(lang_lower) or _LANGUAGE_TO_COUNTRY.get(lang_lower.split("-")[0])
        if primary:
            # Always add the language-specific country to the front, even if it's
            # not in the default fallback list (e.g. TH, KH, MM, …).
            if primary in countries:
                countries.remove(primary)
            countries.insert(0, primary)

    return [template.format(country=c) for c in countries]


def run_geo_bypass(
    attempt_fn: Callable[[str, str], Any],
    language: str | None,
    logger_instance: logging.Logger,
    context: str,
) -> Any:
    """Try geo-proxy URLs in language-priority order until one succeeds.

    Calls attempt_fn(proxy_url, country_label) for each country proxy.
    - Returns None to signal "try next country".
    - Returns anything else to signal "done" (success or terminal error).

    Returns None if no proxy is configured or all countries fail.
    """
    proxy_urls = get_geo_proxy_urls_for_language(language)
    if not proxy_urls:
        return None
    for proxy_url in proxy_urls:
        country = country_from_proxy_url(proxy_url)
        logger_instance.info(f"{context}: geo-restricted — trying {country} proxy...")
        result = attempt_fn(proxy_url, country)
        if result is not None:
            return result
    logger_instance.warning(f"{context}: geo-bypass failed for all countries")
    return None


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
