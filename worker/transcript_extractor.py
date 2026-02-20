"""
YouTube Transcript Extractor with retry logic and Whisper API fallback
Extracts transcripts/subtitles from YouTube videos in any available language

Strategy:
1. Try YouTube transcripts first (free, fast)
2. If not available, fallback to Whisper API (paid, guaranteed)
"""

import logging
import os
import threading
from pathlib import Path
from typing import Optional, Tuple
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable
)

logger = logging.getLogger(__name__)

# Path to YouTube cookies file (Netscape format).
# Set YOUTUBE_COOKIES_FILE in .env, or place cookies at worker/cookies/youtube.txt.
_COOKIES_FILE = Path(__file__).parent / "cookies" / "youtube.txt"

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

        if self.enable_whisper_fallback:
            try:
                self.whisper_transcriber = WhisperTranscriber()
                logger.info("Whisper fallback initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Whisper fallback: {e}")
                self.enable_whisper_fallback = False

        # Log whether cookies are available
        if _COOKIES_FILE.exists():
            logger.info(f"YouTube cookies loaded: {_COOKIES_FILE}")
        else:
            logger.info("No YouTube cookies found — transcript API may be IP-blocked on cloud IPs")

    def _get_api(self) -> YouTubeTranscriptApi:
        """Return a YouTubeTranscriptApi instance.

        Uses WebshareProxyConfig (rotating residential) if YOUTUBE_PROXY_HTTP
        is set — this retries up to 10 times with a new IP on each block,
        reliably bypassing YouTube's cloud IP restrictions.
        Falls back to cookies-only or plain API if no proxy is configured.
        """
        from youtube_transcript_api.proxies import WebshareProxyConfig, GenericProxyConfig

        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")

        if http_proxy and "p.webshare.io" in http_proxy:
            # Extract credentials from the URL: http://user-rotate:pass@p.webshare.io:port
            import re as _re
            m = _re.match(r"https?://([^:]+)-rotate:([^@]+)@p\.webshare\.io:(\d+)", http_proxy)
            if m:
                username, password, port = m.group(1), m.group(2), int(m.group(3))
                proxy_config = WebshareProxyConfig(
                    proxy_username=username,
                    proxy_password=password,
                    proxy_port=port,
                    retries_when_blocked=10,
                )
                logger.debug(f"Using WebshareProxyConfig (rotating residential, port {port})")
                return YouTubeTranscriptApi(proxy_config=proxy_config)

        if http_proxy:
            # Generic proxy (non-Webshare)
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
        """
        Extract video ID from YouTube URL

        Supports formats:
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        """
        import re
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        logger.error(f"Could not extract video ID from URL: {url}")
        return None

    def get_transcript(
        self,
        youtube_url: str,
        preferred_languages: list[str] = None
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

        try:
            # Try to get transcript in preferred language order
            transcript_data = None
            detected_lang = None
            ip_blocked = False

            for lang in preferred_languages:
                try:
                    transcript_data = self._get_api().fetch(video_id, languages=[lang])
                    detected_lang = lang
                    logger.info(f"Found transcript in preferred language: {lang}")
                    break
                except NoTranscriptFound:
                    continue
                except Exception as e:
                    if "blocking requests" in str(e).lower():
                        ip_blocked = True
                    continue

            # If no preferred language found individually, try all at once —
            # the API will pick the first available. This handles French videos
            # that have FR transcripts but no EN, without falling back to Whisper.
            if transcript_data is None:
                try:
                    transcript_data = self._get_api().fetch(video_id, languages=preferred_languages)
                    detected_lang = 'auto'
                    logger.info("Found transcript via multi-language fallback")
                except Exception as e:
                    if "blocking requests" in str(e).lower():
                        ip_blocked = True
                    logger.error(f"Could not find any transcript: {e}")
                    # Don't return here — fall through to Whisper fallback below

            # Record whether this call was IP-blocked (thread-safe)
            with self._ip_blocked_lock:
                self.last_ip_blocked = ip_blocked

            if transcript_data is None:
                # Step 2b: Try yt-dlp subtitle download before Whisper (free, no quota)
                vtt_text, vtt_lang = self._ytdlp_subtitles(youtube_url, preferred_languages)
                if vtt_text:
                    return vtt_text, vtt_lang, None, 0.0

                # Step 3: Whisper API fallback (paid, uses Groq quota)
                if self.enable_whisper_fallback and self.whisper_transcriber:
                    logger.warning("YouTube transcripts not available, trying Whisper API fallback...")
                    return self._whisper_fallback(youtube_url, preferred_languages)
                else:
                    return None, None, "no_transcript_available", 0.0

            # Combine all text segments
            full_text = " ".join([entry.text for entry in transcript_data])

            logger.info(f"✅ YouTube transcript extracted ({len(full_text)} chars) in language: {detected_lang} [FREE]")

            return full_text, detected_lang, None, 0.0  # YouTube transcripts are free

        except TranscriptsDisabled:
            logger.warning(f"Transcripts are disabled for video: {video_id}")
            with self._ip_blocked_lock:
                self.last_ip_blocked = False
            if self.enable_whisper_fallback and self.whisper_transcriber:
                logger.info("Trying Whisper API fallback...")
                return self._whisper_fallback(youtube_url, preferred_languages)
            return None, None, "transcripts_disabled", 0.0

        except VideoUnavailable:
            logger.error(f"Video unavailable: {video_id}")
            return None, None, "video_unavailable", 0.0

        except Exception as e:
            logger.error(f"Unexpected error extracting transcript: {e}")
            # Try Whisper fallback as last resort
            if self.enable_whisper_fallback and self.whisper_transcriber:
                logger.info("Trying Whisper API fallback after error...")
                return self._whisper_fallback(youtube_url, preferred_languages)
            return None, None, f"error: {str(e)}", 0.0

    def _ytdlp_subtitles(
        self,
        youtube_url: str,
        preferred_languages: list[str],
    ) -> tuple[Optional[str], Optional[str]]:
        """Download subtitles via yt-dlp as a free fallback before Whisper.

        Uses the authenticated cookies session (if available) to download VTT
        subtitle files. Returns (text, language) or (None, None) on failure.
        This is free and bypasses the youtube-transcript-api IP block issue
        since yt-dlp uses a different YouTube endpoint.
        """
        import yt_dlp
        import glob
        import tempfile

        cookies_file = str(_COOKIES_FILE) if _COOKIES_FILE.exists() else None
        deno_path = Path.home() / ".deno" / "bin" / "deno"

        ydl_opts: dict = {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": list(dict.fromkeys(preferred_languages)),
            "subtitlesformat": "vtt",
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
        }
        if cookies_file:
            ydl_opts["cookiefile"] = cookies_file
        if deno_path.exists():
            ydl_opts["js_runtimes"] = {"deno": {"path": str(deno_path)}}

        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")
        if http_proxy:
            ydl_opts["proxy"] = http_proxy

        try:
            with tempfile.TemporaryDirectory(prefix="brieftube_vtt_") as tmp:
                ydl_opts["outtmpl"] = os.path.join(tmp, "%(id)s")
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([youtube_url])

                vtt_files = glob.glob(os.path.join(tmp, "*.vtt"))
                if not vtt_files:
                    return None, None

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
                    return text, detected_lang

        except Exception as e:
            err = str(e)
            if "429" in err or "Too Many Requests" in err:
                logger.warning("yt-dlp subtitle: rate-limited (429) — will try Whisper")
            elif "Sign in" in err or "bot" in err.lower():
                logger.warning("yt-dlp subtitle: auth required — will try Whisper")
            else:
                logger.warning(f"yt-dlp subtitle failed: {err[:120]}")

        return None, None

    @staticmethod
    def _parse_vtt(filepath: str) -> Optional[str]:
        """Parse a WebVTT subtitle file and return deduplicated plain text."""
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
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

    def _whisper_fallback(
        self,
        youtube_url: str,
        preferred_languages: list[str] = None
    ) -> Tuple[Optional[str], Optional[str], Optional[str], float]:
        """
        Fallback to Whisper API when YouTube transcripts are not available

        Returns same tuple as get_transcript
        """
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
        ]
        if error_message in retry_errors:
            return True

        # Groq 429 rate limit — retry after midnight UTC when quota resets
        if "429" in error_message or "rate_limit_exceeded" in error_message:
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
