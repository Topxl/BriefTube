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

        Priority:
        1. Proxy (YOUTUBE_PROXY_HTTP env var) — bypasses cloud IP blocks
        2. Cookies (worker/cookies/youtube.txt) — helps with auth-gated videos
        3. Plain unauthenticated API

        Note: cookies alone do NOT bypass YouTube cloud IP blocks; a proxy is
        required for that. Configure YOUTUBE_PROXY_HTTP in worker/.env.
        """
        import requests
        from http.cookiejar import MozillaCookieJar

        session = requests.Session()

        # Load cookies if available
        if _COOKIES_FILE.exists():
            try:
                jar = MozillaCookieJar()
                jar.load(str(_COOKIES_FILE), ignore_discard=True, ignore_expires=True)
                session.cookies = jar  # type: ignore[assignment]
            except Exception as e:
                logger.warning(f"Failed to load YouTube cookies: {e}")

        # Apply proxy if configured
        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")
        https_proxy = os.environ.get("YOUTUBE_PROXY_HTTPS", http_proxy)
        if http_proxy:
            session.proxies = {"http": http_proxy, "https": https_proxy}
            return YouTubeTranscriptApi(http_client=session)

        # Use cookies-only session if cookies exist, else plain API
        if _COOKIES_FILE.exists():
            return YouTubeTranscriptApi(http_client=session)

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
                # YouTube transcripts not available (disabled, IP-blocked, or not found) - try Whisper fallback
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
        ]

        return error_message in retry_errors


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
