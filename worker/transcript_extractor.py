"""
YouTube Transcript Extractor with retry logic and Whisper API fallback
Extracts transcripts/subtitles from YouTube videos in any available language

Strategy:
1. Try YouTube transcripts first (free, fast)
2. If not available, fallback to Whisper API (paid, guaranteed)
"""

import json
import logging
import os
import random
import re
import threading
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Tuple
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable
)

from youtube_utils import (
    _PREMIERE_RE,
    hours_until_premiere as _hours_until_premiere,
    PLAYER_CLIENTS_SHORT as _PLAYER_CLIENTS,
    BOT_DETECTION_KEYWORDS as _BOT_KW,
    INVIDIOUS_INSTANCES as _INVIDIOUS_INSTANCES,
    PIPED_INSTANCES as _PIPED_INSTANCES,
    extract_video_id as _extract_video_id,
    is_direct_blocked,
    mark_direct_blocked,
)

logger = logging.getLogger(__name__)

# Patterns that strongly suggest a video contains only music / ambient sounds
# with no meaningful speech to transcribe.  Checked against the video title
# before attempting the (expensive) Whisper fallback.
_MUSIC_TITLE_RE = re.compile(
    r'\b\d+\s*hz\b'           # 432Hz, 528 Hz, 888hz …
    r'|binaural\s+beats?'
    r'|solfeggio'
    r'|white\s+noise'
    r'|rain\s+sounds?'
    r'|ambient\s+music'
    r'|sleep\s+music'
    r'|relaxing\s+music'
    r'|study\s+music'
    r'|focus\s+music'
    r'|healing\s+(music|sounds?|frequency|frequencies)'
    r'|meditation\s+(music|sounds?|frequency|frequencies)'
    r'|\(official\s+audio\)'           # "Kendrick Lamar - luther (Official Audio)"
    r'|\s-\s+Topic$',                  # YouTube Music auto-channels: "Artist - Topic"
    re.IGNORECASE,
)


# Path to YouTube cookies file (Netscape format).
# Set YOUTUBE_COOKIES_FILE in .env, or place cookies at worker/cookies/youtube.txt.
_COOKIES_FILE = Path(__file__).parent / "cookies" / "youtube.txt"

# Critical cookies needed for authenticated YouTube access
_CRITICAL_COOKIES = {"__Secure-3PSID", "__Secure-3PAPISID"}
_IMPORTANT_COOKIES = {"SAPISID", "APISID", "SID", "HSID", "SSID"}

def validate_cookies() -> dict:
    """Parse the cookie file and return a health status dict.

    Returns:
        {
            "ok": bool,
            "exists": bool,
            "total": int,
            "present": set[str],
            "missing_critical": list[str],
            "missing_important": list[str],
            "expired": list[str],
            "age_days": int | None,   # days since file was last modified
            "summary": str,           # one-line human-readable status
        }
    """
    import time

    if not _COOKIES_FILE.exists():
        return {
            "ok": False, "exists": False, "total": 0,
            "present": set(), "missing_critical": sorted(_CRITICAL_COOKIES),
            "missing_important": sorted(_IMPORTANT_COOKIES),
            "expired": [], "age_days": None,
            "summary": "Cookie file not found",
        }

    now = int(time.time())
    age_days = int((now - _COOKIES_FILE.stat().st_mtime) / 86400)
    present: set[str] = set()
    expired: list[str] = []

    try:
        with open(_COOKIES_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) < 7:
                    continue
                name = parts[5]
                present.add(name)
                try:
                    expiry = int(parts[4])
                    if 0 < expiry < now:
                        expired.append(name)
                except ValueError:
                    pass
    except Exception as e:
        return {
            "ok": False, "exists": True, "total": 0,
            "present": set(), "missing_critical": sorted(_CRITICAL_COOKIES),
            "missing_important": sorted(_IMPORTANT_COOKIES),
            "expired": [], "age_days": age_days,
            "summary": f"Could not parse cookie file: {e}",
        }

    missing_critical = sorted(_CRITICAL_COOKIES - present)
    missing_important = sorted(_IMPORTANT_COOKIES - present)
    ok = len(missing_critical) == 0 and len(expired) == 0

    if not ok:
        parts_msg = []
        if missing_critical:
            parts_msg.append(f"missing: {', '.join(missing_critical)}")
        if expired:
            parts_msg.append(f"expired: {', '.join(expired)}")
        summary = f"Cookies invalid — {'; '.join(parts_msg)}"
    elif age_days > 14:
        summary = f"Cookies OK but {age_days}d old — consider refreshing"
    else:
        summary = f"Cookies OK ({len(present)} cookies, {age_days}d old)"

    return {
        "ok": ok, "exists": True, "total": len(present),
        "present": present, "missing_critical": missing_critical,
        "missing_important": missing_important, "expired": expired,
        "age_days": age_days, "summary": summary,
    }

# Import Whisper transcriber (optional, only if API key is set)
WHISPER_AVAILABLE = False
try:
    if os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY"):
        from whisper_transcriber import WhisperTranscriber
        WHISPER_AVAILABLE = True
        logger.info("Groq Whisper API fallback enabled")
    else:
        logger.info("Whisper API fallback disabled (no GROQ_API_KEY)")
except ImportError:
    logger.warning("Whisper transcriber not available (missing dependencies)")


class TranscriptExtractor:
    """Extracts transcripts from YouTube videos with retry support and Whisper fallback"""

    def __init__(self, enable_whisper_fallback: bool = True):
        """
        Initialize transcript extractor

        Args:
            enable_whisper_fallback: If True, use Whisper API as fallback when
                                    YouTube transcripts are not available
        """
        self.enable_whisper_fallback = enable_whisper_fallback and WHISPER_AVAILABLE
        self.whisper_transcriber = None

        # Thread-safe flag: True if the last YouTube transcript call was IP-blocked.
        # Read this after get_transcript() returns to detect IP bans.
        self._ip_blocked_lock = threading.Lock()
        self.last_ip_blocked = False
        # Which extraction method was used last (youtube_api, invidious, piped, yt-dlp, whisper).
        self.last_transcript_source: str = ""
        # YouTube metadata fetched from Invidious at the start of get_transcript().
        # Contains: genre, keywords, duration_seconds, view_count, like_count,
        # published_at, description. Empty dict if Invidious was unreachable.
        self.last_video_metadata: dict = {}

        if self.enable_whisper_fallback:
            try:
                self.whisper_transcriber = WhisperTranscriber()
                logger.info("Whisper fallback initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Whisper fallback: {e}")
                self.enable_whisper_fallback = False

        # Validate cookies at startup
        cookie_health = validate_cookies()
        if cookie_health["ok"]:
            logger.info(f"YouTube cookies: {cookie_health['summary']}")
        elif cookie_health["exists"]:
            logger.warning(f"YouTube cookies degraded: {cookie_health['summary']}")
        else:
            logger.warning("No YouTube cookies found — transcript API may be IP-blocked on cloud IPs")
        self._cookie_health = cookie_health

    def _get_api(self, use_proxy: bool = False) -> YouTubeTranscriptApi:
        """Return a YouTubeTranscriptApi instance.

        Direct-first strategy: by default (use_proxy=False) tries without proxy
        using cookies. Only switches to rotating residential proxy when caller
        explicitly sets use_proxy=True after detecting an IP block.
        This dramatically reduces Webshare bandwidth consumption.
        """
        from youtube_transcript_api.proxies import WebshareProxyConfig, GenericProxyConfig

        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")

        if use_proxy and http_proxy:
            if "p.webshare.io" in http_proxy:
                import re as _re
                m = _re.match(r"https?://([^:]+)-rotate:([^@]+)@p\.webshare\.io:(\d+)", http_proxy)
                if m:
                    username, password, port = m.group(1), m.group(2), int(m.group(3))
                    proxy_config = WebshareProxyConfig(
                        proxy_username=username,
                        proxy_password=password,
                        proxy_port=port,
                        retries_when_blocked=5,
                    )
                    logger.debug(f"Using WebshareProxyConfig (rotating residential, port {port})")
                    return YouTubeTranscriptApi(proxy_config=proxy_config)
            else:
                proxy_config = GenericProxyConfig(http_url=http_proxy)
                return YouTubeTranscriptApi(proxy_config=proxy_config)

        # No proxy — use cookies-only session if available
        import requests
        from http.cookiejar import MozillaCookieJar
        session = requests.Session()
        if _COOKIES_FILE.exists():
            try:
                jar = MozillaCookieJar()
                jar.load(str(_COOKIES_FILE), ignore_discard=True, ignore_expires=True)
                session.cookies = jar  # type: ignore[assignment]
                return YouTubeTranscriptApi(http_client=session)
            except Exception as e:
                logger.warning(f"Failed to load YouTube cookies: {e}")

        return YouTubeTranscriptApi()

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """Extract video ID from a YouTube URL (delegates to youtube_utils)."""
        return _extract_video_id(url)

    @staticmethod
    def _is_music_video(title: str) -> bool:
        """Return True if the title strongly suggests a music/ambient video."""
        return bool(_MUSIC_TITLE_RE.search(title))

    @staticmethod
    def _fetch_invidious_metadata(video_id: str) -> dict:
        """Fetch rich video metadata from Invidious API.

        Invidious /api/v1/videos/{id} returns YouTube's own metadata:
        - genre: YouTube category ("Music", "Science & Technology", ...) — language-agnostic
        - keywords: YouTube tags set by the creator
        - lengthSeconds: exact duration
        - viewCount / likeCount: popularity signals
        - description: video description
        - published: Unix timestamp of publication

        Returns a dict with the above keys (absent keys are omitted).
        Returns {} on failure (all instances down or timeout).
        """
        instances = list(_INVIDIOUS_INSTANCES)
        random.shuffle(instances)
        for instance in instances:
            try:
                api_url = f"{instance}/api/v1/videos/{urllib.parse.quote(video_id, safe='')}"
                req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = json.loads(resp.read().decode())
                result: dict = {}
                if title := data.get("title"):
                    result["title"] = title
                if genre := data.get("genre"):
                    result["genre"] = genre
                if keywords := data.get("keywords"):
                    result["keywords"] = keywords[:30]  # cap at 30 tags
                if length := data.get("lengthSeconds"):
                    result["duration_seconds"] = int(length)
                if views := data.get("viewCount"):
                    result["view_count"] = int(views)
                if likes := data.get("likeCount"):
                    result["like_count"] = int(likes)
                if pub := data.get("published"):
                    result["published_at"] = int(pub)
                if desc := data.get("description"):
                    result["description"] = desc[:1000]  # cap to avoid bloat
                return result
            except Exception:
                continue
        return {}

    def get_transcript(
        self,
        youtube_url: str,
        preferred_languages: list[str] = None,
        video_title: str = "",
    ) -> Tuple[Optional[str], Optional[str], Optional[str], float]:
        """
        Get transcript for a YouTube video

        Args:
            youtube_url: YouTube video URL
            preferred_languages: List of preferred language codes (e.g., ['fr', 'en'])
                                If None, will try to get any available transcript

        Returns:
            Tuple of (transcript_text, detected_language, error_message, cost_usd)
            - transcript_text: Full transcript as string (None if failed)
            - detected_language: Language code of retrieved transcript (None if failed)
            - error_message: Error description (None if successful)
            - cost_usd: Cost in USD (0.0 for YouTube transcripts, >0 for Whisper)
        """
        if preferred_languages is None:
            preferred_languages = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']

        # Extract video ID
        video_id = TranscriptExtractor.extract_video_id(youtube_url)
        if not video_id:
            return None, None, "Invalid YouTube URL", 0.0

        # Fetch rich metadata from Invidious (genre, keywords, duration, views, …).
        # Used for: language-agnostic music detection + storing enriched metadata in DB.
        self.last_video_metadata = TranscriptExtractor._fetch_invidious_metadata(video_id)
        if self.last_video_metadata:
            genre = self.last_video_metadata.get("genre", "")
            dur = self.last_video_metadata.get("duration_seconds")
            logger.info(
                f"[{video_id}] Invidious metadata: genre={genre!r}"
                + (f" duration={dur}s" if dur else "")
            )
            if genre.lower() == "music":
                logger.info(f"[{video_id}] YouTube category is Music — skipping")
                return None, None, "music_content", 0.0

        try:
            # Try to get transcript in preferred language order
            transcript_data = None
            detected_lang = None
            ip_blocked = False

            _IP_BLOCK_SIGNALS = ("blocking requests", "429", "too many requests", "proxy")

            def _fetch_with_api(api: YouTubeTranscriptApi) -> tuple:
                """Try fetching transcript with given api. Returns (data, lang, blocked)."""
                nonlocal ip_blocked
                for lang in preferred_languages:
                    try:
                        data = api.fetch(video_id, languages=[lang])
                        return data, lang, False
                    except NoTranscriptFound:
                        continue
                    except Exception as e:
                        if any(s in str(e).lower() for s in _IP_BLOCK_SIGNALS):
                            return None, None, True
                        continue
                # Multi-language fallback
                try:
                    data = api.fetch(video_id, languages=preferred_languages)
                    return data, 'auto', False
                except Exception as e:
                    blocked = any(s in str(e).lower() for s in _IP_BLOCK_SIGNALS)
                    if not blocked:
                        logger.error(f"Could not find any transcript: {e}")
                    return None, None, blocked

            # Step 1: try direct (no proxy) — free, no bandwidth cost.
            # Skip if we already know the VPS IP is blocked (avoids a guaranteed failure).
            if is_direct_blocked():
                ip_blocked = True
                transcript_data = None
                detected_lang = None
            else:
                api = self._get_api(use_proxy=False)
                transcript_data, detected_lang, ip_blocked = _fetch_with_api(api)
                if ip_blocked:
                    mark_direct_blocked()

            # Step 2 removed: do NOT use Webshare here.
            # If the VPS IP is blocked, Invidious/Piped (steps 2b/2c below) serve
            # the same transcript for free. Webshare is reserved for yt-dlp as
            # absolute last resort only.

            if detected_lang == 'auto' and transcript_data is not None:
                logger.info("Found transcript via multi-language fallback")
            elif detected_lang and transcript_data is not None:
                logger.info(f"Found transcript in preferred language: {detected_lang}")

            # Record whether this call was IP-blocked (thread-safe)
            with self._ip_blocked_lock:
                self.last_ip_blocked = ip_blocked

            if transcript_data is None:
                # Step 2b: Try Invidious (free YouTube proxy — bypasses datacenter IP blocks)
                # Tried first: faster than yt-dlp and works regardless of VPS IP
                inv_text, inv_lang, _ = self._invidious_subtitles(video_id, preferred_languages)
                if inv_text:
                    self.last_transcript_source = "invidious"
                    return inv_text, inv_lang, None, 0.0

                # Step 2c: Try Piped (second free proxy, different infrastructure)
                piped_text, piped_lang, _ = self._piped_subtitles(video_id, preferred_languages)
                if piped_text:
                    self.last_transcript_source = "piped"
                    return piped_text, piped_lang, None, 0.0

                # Step 2d: Try yt-dlp (detects live/premiere, player_client fallbacks)
                # Tried after proxies: slower on bot-detected IPs but catches edge cases
                vtt_text, vtt_lang, vtt_error = self._ytdlp_subtitles(youtube_url, preferred_languages)
                if vtt_text:
                    self.last_transcript_source = "yt-dlp"
                    return vtt_text, vtt_lang, None, 0.0
                if vtt_error and vtt_error.startswith("premiere_not_available_yet"):
                    # Scheduled/premiere video — skip Whisper, snooze until it starts
                    return None, None, vtt_error, 0.0
                if vtt_error == "video_is_live":
                    # Live stream in progress — no captions yet, skip Whisper entirely
                    return None, None, "video_is_live", 0.0

                # Step 3: Whisper API fallback (paid, uses Groq quota)
                if self.enable_whisper_fallback and self.whisper_transcriber:
                    logger.warning("YouTube transcripts not available, trying Whisper API fallback...")
                    self.last_transcript_source = "whisper"
                    return self._whisper_fallback(youtube_url, preferred_languages, video_title)
                else:
                    return None, None, "no_transcript_available", 0.0

            # Combine all text segments
            full_text = " ".join([entry.text for entry in transcript_data])

            logger.info(f"✅ YouTube transcript extracted ({len(full_text)} chars) in language: {detected_lang} [FREE]")

            self.last_transcript_source = "youtube_api"
            return full_text, detected_lang, None, 0.0  # YouTube transcripts are free

        except TranscriptsDisabled:
            logger.warning(f"Transcripts are disabled for video: {video_id}")
            with self._ip_blocked_lock:
                self.last_ip_blocked = False
            if self.enable_whisper_fallback and self.whisper_transcriber:
                logger.info("Trying Whisper API fallback...")
                self.last_transcript_source = "whisper"
                return self._whisper_fallback(youtube_url, preferred_languages, video_title)
            return None, None, "transcripts_disabled", 0.0

        except VideoUnavailable:
            logger.warning(f"Video unavailable (may be live): {video_id}")
            # youtube_transcript_api raises VideoUnavailable for live streams too.
            # Try yt-dlp first here: it can detect live/premiere status reliably.
            vtt_text, vtt_lang, vtt_error = self._ytdlp_subtitles(youtube_url, preferred_languages)
            if vtt_text:
                self.last_transcript_source = "yt-dlp"
                return vtt_text, vtt_lang, None, 0.0
            if vtt_error == "video_is_live":
                return None, None, "video_is_live", 0.0
            if vtt_error and vtt_error.startswith("premiere_not_available_yet"):
                return None, None, vtt_error, 0.0
            if self.enable_whisper_fallback and self.whisper_transcriber:
                return self._whisper_fallback(youtube_url, preferred_languages, video_title)
            return None, None, "video_unavailable", 0.0

        except Exception as e:
            logger.error(f"Unexpected error extracting transcript: {e}")
            # Try Whisper fallback as last resort
            if self.enable_whisper_fallback and self.whisper_transcriber:
                logger.info("Trying Whisper API fallback after error...")
                return self._whisper_fallback(youtube_url, preferred_languages, video_title)
            return None, None, f"error: {str(e)}", 0.0

    def _ytdlp_subtitles(
        self,
        youtube_url: str,
        preferred_languages: list[str],
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Download subtitles via yt-dlp as a free fallback before Whisper.

        Uses the authenticated cookies session (if available) to download VTT
        subtitle files. Returns (text, language, error_code) or (None, None, None) on failure.
        Returns (None, None, "premiere_not_available_yet:N") for scheduled/premiere videos.
        This is free and bypasses the youtube-transcript-api IP block issue
        since yt-dlp uses a different YouTube endpoint.
        """
        import yt_dlp
        import glob
        import tempfile

        cookies_file = str(_COOKIES_FILE) if _COOKIES_FILE.exists() else None
        deno_path = Path.home() / ".deno" / "bin" / "deno"

        # Skip direct yt-dlp attempts if we already know the VPS IP is blocked.
        # All player clients would fail with bot detection — waste of 2-3s each.
        _skip_direct = is_direct_blocked()
        if _skip_direct:
            logger.debug("yt-dlp subtitle: IP known blocked — skipping direct clients")

        for player_client in (_PLAYER_CLIENTS if not _skip_direct else []):
            client_name = player_client[0]
            ydl_opts: dict = {
                "skip_download": True,
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": list(dict.fromkeys(preferred_languages)),
                "subtitlesformat": "vtt",
                "quiet": True,
                "no_warnings": True,
                "noprogress": True,
                "nocheckcertificate": True,
                "extractor_args": {"youtube": {"player_client": player_client}},
            }
            if cookies_file:
                ydl_opts["cookiefile"] = cookies_file
            if deno_path.exists():
                ydl_opts["js_runtimes"] = {"deno": {"path": str(deno_path)}}

            try:
                with tempfile.TemporaryDirectory(prefix="brieftube_vtt_") as tmp:
                    ydl_opts["outtmpl"] = os.path.join(tmp, "%(id)s")
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        # extract_info(download=True) respects skip_download=True:
                        # skips the media download, still writes subtitle files,
                        # and returns the info dict so we can check is_live.
                        info = ydl.extract_info(youtube_url, download=True)

                        if info:
                            live_status = info.get("live_status")
                            # Scheduled/upcoming live — not started yet
                            if live_status == "is_upcoming":
                                scheduled = info.get("scheduled_start_time")
                                if scheduled:
                                    import time as _time
                                    hours = max(1, int((scheduled - _time.time()) / 3600) + 1)
                                else:
                                    hours = 24
                                logger.info(f"yt-dlp: upcoming live — snooze {hours}h")
                                return None, None, f"premiere_not_available_yet:{hours}"
                            # Live stream currently broadcasting — no captions yet
                            if live_status == "is_live" or info.get("is_live"):
                                logger.info("yt-dlp: video is currently live — snooze 2h")
                                return None, None, "video_is_live"

                    vtt_files = glob.glob(os.path.join(tmp, "*.vtt"))
                    if not vtt_files:
                        # No subtitles available — another client won't change that
                        return None, None, None

                    # Pick file matching preferred language
                    selected = vtt_files[0]
                    detected_lang = "auto"
                    for lang in preferred_languages:
                        matches = [f for f in vtt_files if f".{lang}." in f]
                        if matches:
                            selected = matches[0]
                            detected_lang = lang
                            break

                    text = self._parse_vtt(selected)
                    if text:
                        logger.info(
                            f"✅ yt-dlp subtitle extracted ({len(text)} chars) "
                            f"lang: {detected_lang} [FREE]"
                        )
                        return text, detected_lang, None
                    return None, None, None  # VTT file present but unparseable

            except Exception as e:
                err = str(e)
                if _PREMIERE_RE.search(err):
                    hours = _hours_until_premiere(err)
                    logger.info(
                        f"yt-dlp subtitle: premiere/scheduled video — retry in {hours}h"
                    )
                    return None, None, f"premiere_not_available_yet:{hours}"
                elif any(kw in err.lower() for kw in (
                    "is a live stream", "currently broadcasting",
                    "is a live event", "live event",
                    "this is a live stream", "cannot download live",
                    "no video formats found",  # live stream currently broadcasting
                )):
                    logger.info("yt-dlp subtitle: live stream detected — snooze 2h")
                    return None, None, "video_is_live"
                elif any(kw in err.lower() for kw in (
                    "your country", "this country", "not available in your",
                    "national security", "government", "unavailable in this country",
                )):
                    logger.warning("yt-dlp subtitle: video geo-restricted — will try Invidious")
                    break  # geo-restriction is consistent across all clients
                elif "429" in err or "Too Many Requests" in err:
                    logger.warning("yt-dlp subtitle: rate-limited (429) — will try Invidious")
                    break  # rate limit applies to all clients, no point retrying
                elif any(kw in err.lower() for kw in _BOT_KW):
                    logger.warning(
                        f"yt-dlp subtitle: bot detection with {client_name} — trying next client"
                    )
                    continue
                else:
                    logger.warning(f"yt-dlp subtitle failed: {err[:120]}")
                    return None, None, None  # unknown error, stop trying

        # All direct clients bot-detected — retry once via residential proxy.
        # tv_embedded is the only client that works reliably through datacenter
        # proxies; ios/mweb return "Requested format is not available" via proxy.
        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")
        if not http_proxy:
            return None, None, None

        logger.info("yt-dlp subtitle: all clients bot-detected — retrying with proxy")
        proxy_opts: dict = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": list(dict.fromkeys(preferred_languages)),
            "subtitlesformat": "vtt",
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "nocheckcertificate": True,
            "extractor_args": {"youtube": {"player_client": ["tv_embedded"]}},
            "proxy": http_proxy,
        }
        if cookies_file:
            proxy_opts["cookiefile"] = cookies_file

        try:
            with tempfile.TemporaryDirectory(prefix="brieftube_vtt_proxy_") as tmp:
                proxy_opts["outtmpl"] = os.path.join(tmp, "%(id)s")
                with yt_dlp.YoutubeDL(proxy_opts) as ydl:
                    info = ydl.extract_info(youtube_url, download=True)
                    if info:
                        live_status = info.get("live_status")
                        if live_status == "is_upcoming":
                            scheduled = info.get("scheduled_start_time")
                            if scheduled:
                                import time as _time
                                hours = max(1, int((scheduled - _time.time()) / 3600) + 1)
                            else:
                                hours = 24
                            return None, None, f"premiere_not_available_yet:{hours}"
                        if live_status == "is_live" or info.get("is_live"):
                            return None, None, "video_is_live"

                vtt_files = glob.glob(os.path.join(tmp, "*.vtt"))
                if vtt_files:
                    selected = vtt_files[0]
                    detected_lang = "auto"
                    for lang in preferred_languages:
                        matches = [f for f in vtt_files if f".{lang}." in f]
                        if matches:
                            selected = matches[0]
                            detected_lang = lang
                            break
                    text = self._parse_vtt(selected)
                    if text:
                        logger.info(
                            f"✅ yt-dlp subtitle via proxy ({len(text)} chars) "
                            f"lang: {detected_lang} [FREE]"
                        )
                        return text, detected_lang, None
        except Exception as e:
            err = str(e)
            if _PREMIERE_RE.search(err):
                return None, None, f"premiere_not_available_yet:{_hours_until_premiere(err)}"
            if any(kw in err.lower() for kw in ("is a live stream", "live event", "no video formats found")):
                return None, None, "video_is_live"
            logger.warning(f"yt-dlp subtitle (proxy) failed: {err[:120]}")

        return None, None, None

    @staticmethod
    def _parse_vtt_text(content: str) -> Optional[str]:
        """Parse WebVTT content string and return deduplicated plain text."""
        try:
            texts: list[str] = []
            in_cue = False
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("WEBVTT") or line.startswith("NOTE"):
                    in_cue = False
                    continue
                if "-->" in line:
                    in_cue = True
                    continue
                if in_cue:
                    clean = re.sub(r"<[^>]+>", "", line).strip()
                    if clean and (not texts or clean != texts[-1]):
                        texts.append(clean)
            return " ".join(texts) if texts else None
        except Exception:
            return None

    @staticmethod
    def _parse_vtt(filepath: str) -> Optional[str]:
        """Parse a WebVTT subtitle file and return deduplicated plain text."""
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return TranscriptExtractor._parse_vtt_text(content)
        except Exception:
            return None

    def _invidious_subtitles(
        self,
        video_id: str,
        preferred_languages: list[str],
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Fetch captions via public Invidious API — works from any datacenter IP.

        Invidious is an open-source YouTube proxy whose public instances are not
        subject to the bot-detection that blocks direct YouTube API calls from VPS IPs.
        Multiple instances are tried in random order for load balancing.

        Returns (text, language, error_code) or (None, None, None) on failure.
        """

        instances = list(_INVIDIOUS_INSTANCES)
        random.shuffle(instances)

        for instance in instances:
            try:
                # Step 1: get the list of available captions for this video
                api_url = (
                    f"{instance}/api/v1/captions/"
                    f"{urllib.parse.quote(video_id, safe='')}"
                )
                req = urllib.request.Request(
                    api_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())

                captions = data.get("captions", [])
                if not captions:
                    # No captions for this video — consistent across all instances
                    return None, None, None

                # Step 2: pick the best language match
                selected_cap = None
                detected_lang = "auto"
                for lang in preferred_languages:
                    for cap in captions:
                        lang_code = cap.get("languageCode", "")
                        if lang_code == lang or lang_code.startswith(f"{lang}-"):
                            selected_cap = cap
                            detected_lang = lang
                            break
                    if selected_cap:
                        break
                if not selected_cap:
                    selected_cap = captions[0]
                    detected_lang = selected_cap.get("languageCode", "auto")

                # Step 3: fetch the VTT content
                label = urllib.parse.quote(selected_cap.get("label", ""), safe="")
                vtt_url = (
                    f"{instance}/api/v1/captions/"
                    f"{urllib.parse.quote(video_id, safe='')}?label={label}"
                )
                req2 = urllib.request.Request(
                    vtt_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req2, timeout=15) as resp2:
                    vtt_content = resp2.read().decode("utf-8", errors="replace")

                text = self._parse_vtt_text(vtt_content)
                if text:
                    logger.info(
                        f"✅ Invidious subtitle fetched ({len(text)} chars) "
                        f"lang: {detected_lang} via {instance} [FREE]"
                    )
                    return text, detected_lang, None

            except Exception as e:
                logger.debug(f"Invidious {instance} failed: {str(e)[:80]}")
                continue

        return None, None, None

    def _piped_subtitles(
        self,
        video_id: str,
        preferred_languages: list[str],
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Fetch captions via public Piped API — alternative free proxy to Invidious.

        Piped /streams/{id} returns audioStreams and subtitles in one call.
        Multiple instances are tried in random order for load balancing.

        Returns (text, language, error_code) or (None, None, None) on failure.
        """
        instances = list(_PIPED_INSTANCES)
        random.shuffle(instances)

        for instance in instances:
            try:
                api_url = f"{instance}/streams/{urllib.parse.quote(video_id, safe='')}"
                req = urllib.request.Request(
                    api_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())

                subtitles = data.get("subtitles", [])
                if not subtitles:
                    # No subtitles for this video — consistent across instances
                    return None, None, None

                # Pick the best language match
                selected = None
                detected_lang = "auto"
                for lang in preferred_languages:
                    for sub in subtitles:
                        code = sub.get("code", "") or sub.get("language", "")
                        if code == lang or code.startswith(f"{lang}-"):
                            selected = sub
                            detected_lang = lang
                            break
                    if selected:
                        break
                if not selected:
                    selected = subtitles[0]
                    detected_lang = (
                        selected.get("code") or selected.get("language") or "auto"
                    )

                vtt_url = selected.get("url", "")
                if not vtt_url:
                    continue

                req2 = urllib.request.Request(
                    vtt_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req2, timeout=15) as resp2:
                    vtt_content = resp2.read().decode("utf-8", errors="replace")

                text = self._parse_vtt_text(vtt_content)
                if text:
                    logger.info(
                        f"✅ Piped subtitle fetched ({len(text)} chars) "
                        f"lang: {detected_lang} via {instance} [FREE]"
                    )
                    return text, detected_lang, None

            except Exception as e:
                logger.debug(f"Piped {instance} failed: {str(e)[:80]}")
                continue

        return None, None, None

    def _whisper_fallback(
        self,
        youtube_url: str,
        preferred_languages: list[str] = None,
        video_title: str = "",
    ) -> Tuple[Optional[str], Optional[str], Optional[str], float]:
        """
        Fallback to Whisper API when YouTube transcripts are not available

        Returns same tuple as get_transcript
        """
        # Skip Whisper for music/ambient videos — no speech to transcribe
        if video_title and TranscriptExtractor._is_music_video(video_title):
            logger.info(f"Skipping Whisper — music/ambient video detected: {video_title[:80]}")
            return None, None, "likely_music_no_speech", 0.0

        try:
            # Use first preferred language, or None for auto-detect
            target_lang = preferred_languages[0] if preferred_languages else None

            transcript, lang, error, cost = self.whisper_transcriber.transcribe(
                youtube_url,
                language=target_lang
            )

            if transcript:
                logger.info(f"💰 Whisper API fallback successful: ${cost:.4f}")
                return transcript, lang, None, cost
            else:
                return None, None, error, cost

        except Exception as e:
            logger.error(f"Whisper fallback failed: {e}")
            return None, None, f"whisper_fallback_failed: {str(e)}", 0.0

    @staticmethod
    def should_retry(error_message: Optional[str]) -> bool:
        """
        Determine if we should retry based on error message

        Retry cases:
        - no_transcript_available: Video might be too recent, transcript being generated
        - rate_limited: Temporary issue

        Don't retry:
        - transcripts_disabled: Video has transcripts permanently disabled
        - video_unavailable: Video deleted/private
        - Invalid URL: Won't change
        """
        if error_message is None:
            return False

        retry_errors = [
            "no_transcript_available",  # Might be generated later
            "rate_limited",             # Temporary
            "video_unavailable",        # Premiere / scheduled — retry when live
            "youtube_auth_required",    # YouTube bot-detection — transient, retry later
        ]
        if error_message in retry_errors:
            return True

        # Groq 429 rate limit — retry after midnight UTC when quota resets
        if "429" in error_message or "rate_limit_exceeded" in error_message:
            return True

        # Groq Flex 498 capacity_exceeded — transient, retry (backoff handled in _transcribe_chunk)
        if "498" in error_message or "capacity_exceeded" in error_message:
            return True

        return False


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test with a known video
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    extractor = TranscriptExtractor(enable_whisper_fallback=True)
    transcript, lang, error, cost = extractor.get_transcript(
        test_url,
        preferred_languages=['fr', 'en']
    )

    if transcript:
        print(f"✅ Transcript extracted ({len(transcript)} chars)")
        print(f"Language: {lang}")
        print(f"Cost: ${cost:.4f}")
        print(f"Preview: {transcript[:200]}...")
    else:
        print(f"❌ Failed: {error}")
        print(f"Should retry? {TranscriptExtractor.should_retry(error)}")
