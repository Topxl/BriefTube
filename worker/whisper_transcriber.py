"""
Whisper API transcriber for YouTube videos
Uses Groq Whisper Large V3 Turbo to transcribe audio from YouTube videos
Fallback solution when YouTube transcripts are not available

Groq advantages:
- 9x cheaper than OpenAI ($0.00067/min vs $0.006/min)
- 228-383x faster than real-time
- Same Whisper Large V3 model quality
"""

import json
import math
import os
import random
import re
import logging
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Tuple
import yt_dlp
from groq import Groq

from youtube_utils import (
    _PREMIERE_RE,
    hours_until_premiere as _hours_until_premiere,
    PLAYER_CLIENTS_SHORT as _PLAYER_CLIENTS,
    BOT_DETECTION_KEYWORDS as _BOT_KW,
    INVIDIOUS_INSTANCES as _INVIDIOUS_INSTANCES,
    PIPED_INSTANCES as _PIPED_INSTANCES,
    is_direct_blocked,
    mark_direct_blocked,
)

logger = logging.getLogger(__name__)


class WhisperTranscriber:
    """Transcribes YouTube videos using Groq Whisper Large V3 Turbo"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Whisper transcriber with Groq

        Args:
            api_key: Groq API key (if None, reads from GROQ_API_KEY env var)
        """
        self.api_key = api_key or os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY must be provided or set in environment")

        self.client = Groq(api_key=self.api_key)
        logger.info("Groq Whisper transcriber initialized")

    def _download_audio(self, youtube_url: str, output_path: Path) -> bool:
        """
        Download audio from YouTube video

        Args:
            youtube_url: YouTube video URL
            output_path: Path to save audio file

        Returns:
            True if successful, False otherwise
        """
        _cookies_file = Path(__file__).parent / "cookies" / "youtube.txt"

        # Skip direct yt-dlp attempts if the VPS IP is known to be blocked.
        # Pre-checks + downloads would all fail with bot detection — waste of time.
        # Go straight to Invidious → Piped → proxy (paid) instead.
        _skip_direct = is_direct_blocked()
        if _skip_direct:
            logger.debug("Audio download: IP known blocked — skipping direct clients")

        for player_client in (_PLAYER_CLIENTS if not _skip_direct else []):
            client_name = player_client[0]
            try:
                # Pre-check: detect live/upcoming streams before attempting download.
                # Avoids downloading an infinite HLS stream for 10+ minutes.
                try:
                    pre_opts: dict = {
                        "quiet": True,
                        "no_warnings": True,
                        "nocheckcertificate": True,
                        "skip_download": True,
                        "extractor_args": {"youtube": {"player_client": player_client}},
                    }
                    if _cookies_file.exists():
                        pre_opts["cookiefile"] = str(_cookies_file)
                    with yt_dlp.YoutubeDL(pre_opts) as ydl_info:
                        pre_info = ydl_info.extract_info(youtube_url, download=False)
                    if pre_info:
                        live_status = pre_info.get("live_status")
                        if live_status in ("is_live", "is_upcoming") or pre_info.get("is_live"):
                            logger.info(f"Audio pre-check: live stream detected (live_status={live_status}) — skip download")
                            return "live"
                        categories = pre_info.get("categories") or []
                        if "Music" in categories:
                            logger.info("Audio pre-check: YouTube category=Music — skip Whisper")
                            return "music"
                except Exception as pre_e:
                    pre_err = str(pre_e)
                    if _PREMIERE_RE.search(pre_err):
                        hours = _hours_until_premiere(pre_err)
                        return f"premiere:{hours}"
                    if any(kw in pre_err.lower() for kw in (
                        "is a live stream", "live event",
                    )):
                        return "live"
                    if any(kw in pre_err.lower() for kw in (
                        "no video formats found", "requested format is not available",
                    )):
                        logger.info(
                            f"Audio pre-check: format unavailable with {client_name} — trying next client"
                        )
                        continue
                    if "your country" in pre_err.lower():
                        logger.warning("Audio pre-check: video geo-restricted — skipping permanently")
                        return "geo_restricted"
                    if any(kw in pre_err.lower() for kw in _BOT_KW):
                        logger.info(
                            f"Audio pre-check: bot detection with {client_name} — trying next client"
                        )
                        mark_direct_blocked()
                        continue
                    # Other pre-check errors: proceed to actual download

                # 64kbps is more than sufficient for Whisper speech recognition and
                # keeps file size well under Groq's 25 MB limit (~54 min max at 64kbps).
                # 192kbps would exceed the limit for any video longer than ~15 min.
                # max_filesize: abort if raw audio exceeds 150 MB (≈ ~5h at 64kbps)
                # before postprocessing — prevents infinite HLS live downloads.
                ydl_opts: dict = {
                    'format': 'bestaudio[abr<=64]/bestaudio[abr<=96]/bestaudio/best',
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'opus',  # libopus: 2-3x faster than libmp3lame
                    }],
                    'outtmpl': str(output_path.with_suffix('')),  # yt-dlp adds .opus
                    'quiet': True,
                    'no_warnings': True,
                    'noprogress': True,
                    'nocheckcertificate': True,
                    'max_filesize': 150 * 1024 * 1024,  # 150 MB hard cap
                    'extractor_args': {'youtube': {'player_client': player_client}},
                }
                if _cookies_file.exists():
                    ydl_opts['cookiefile'] = str(_cookies_file)

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([youtube_url])

                # Check if file was created
                opus_path = output_path.with_suffix('.opus')
                if opus_path.exists():
                    return True

                logger.error(f"Audio file not created: {opus_path}")
                return False

            except Exception as e:
                err = str(e)
                if _PREMIERE_RE.search(err):
                    hours = _hours_until_premiere(err)
                    logger.info(f"Audio download: premiere/scheduled — retry in {hours}h")
                    return f"premiere:{hours}"
                if any(kw in err.lower() for kw in (
                    "is a live stream", "currently broadcasting",
                    "is a live event", "live event",
                    "live event has ended",    # ended live replay not yet available
                )):
                    logger.info("Audio download: live/ended stream detected — no audio to download")
                    return "live"
                if any(kw in err.lower() for kw in (
                    "requested format is not available",  # YouTube IP block, try next client
                    "no video formats found",             # YouTube IP block, try next client
                )):
                    logger.info(
                        f"Audio download: format unavailable with {client_name} — trying next client"
                    )
                    continue
                if "error opening output files" in err.lower() or "invalid argument" in err.lower():
                    logger.warning("Audio download: ffmpeg output error (live stream or unsupported format) — skipping permanently")
                    return "unsupported"
                if "your country" in err.lower():
                    logger.warning("Audio download: video geo-restricted — skipping permanently")
                    return "geo_restricted"
                if any(kw in err.lower() for kw in _BOT_KW):
                    logger.info(
                        f"Audio download: bot detection with {client_name} — trying next client"
                    )
                    mark_direct_blocked()
                    continue
                logger.error(f"Error downloading audio: {e}")
                return False

        # All player clients exhausted — try free proxies before paid proxy
        video_id = urllib.parse.parse_qs(urllib.parse.urlparse(youtube_url).query).get("v", [""])[0]
        if not video_id and "youtu.be/" in youtube_url:
            video_id = youtube_url.split("youtu.be/")[-1].split("?")[0]
        if video_id:
            # Try Invidious first (free YouTube proxy)
            inv_result = self._download_audio_via_invidious(video_id, output_path)
            if inv_result is True:
                return True
            if inv_result == "live":
                return "live"

            # Try Piped as second free proxy
            piped_result = self._download_audio_via_piped(video_id, output_path)
            if piped_result is True:
                return True
            if piped_result == "live":
                return "live"

        # Last resort: paid proxy (bandwidth cost)
        http_proxy = os.environ.get("YOUTUBE_PROXY_HTTP", "")
        if http_proxy:
            logger.info(
                "Audio download: all clients blocked, retrying with proxy (bandwidth cost)..."
            )
            proxy_opts: dict = {
                'format': 'bestaudio[abr<=64]/bestaudio[abr<=96]/bestaudio/best',
                'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'opus'}],
                'outtmpl': str(output_path.with_suffix('')),
                'quiet': True,
                'no_warnings': True,
                'noprogress': True,
                'nocheckcertificate': True,
                'max_filesize': 150 * 1024 * 1024,
                'extractor_args': {'youtube': {'player_client': ['ios']}},
                'proxy': http_proxy,
            }
            if _cookies_file.exists():
                proxy_opts['cookiefile'] = str(_cookies_file)
            try:
                with yt_dlp.YoutubeDL(proxy_opts) as ydl:
                    ydl.download([youtube_url])
                opus_path = output_path.with_suffix('.opus')
                if opus_path.exists():
                    logger.info("Audio download: proxy successful")
                    return True
            except Exception as e:
                err = str(e)
                if "live event has ended" in err.lower():
                    logger.info(f"Audio download (proxy): live/ended stream — {err[:80]}")
                    return "live"
                # "no video formats found" and "requested format is not available" via proxy
                # = proxy/YouTube IP restriction, NOT necessarily a live stream.
                # Fall through to auth_required so it retries instead of snoozing 2h.
                logger.warning(f"Audio download (proxy) failed: {err[:120]}")

        logger.warning(
            "Audio download: bot detection on all clients + proxy — will retry later"
        )
        return "auth_required"

    def _download_audio_via_invidious(self, video_id: str, output_path: Path):
        """Download audio via Invidious public API — free, no proxy bandwidth cost.

        Calls /api/v1/videos/{id} on a public Invidious instance to resolve the
        audio stream URL, then downloads it directly with ffmpeg. Returns True on
        success, "live" for live streams, or False if all instances fail.
        """
        instances = list(_INVIDIOUS_INSTANCES)
        random.shuffle(instances)

        for instance in instances:
            try:
                api_url = (
                    f"{instance}/api/v1/videos/"
                    f"{urllib.parse.quote(video_id, safe='')}"
                    f"?fields=adaptiveFormats,liveNow"
                )
                req = urllib.request.Request(
                    api_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode())

                if data.get("liveNow"):
                    return "live"

                adaptive = data.get("adaptiveFormats", [])
                audio_fmts = [
                    f for f in adaptive
                    if f.get("type", "").startswith("audio/") and f.get("url")
                ]
                if not audio_fmts:
                    logger.debug(f"Invidious {instance}: no audio formats for {video_id}")
                    continue

                # Prefer lowest bitrate (smallest download, sufficient for Whisper)
                audio_fmts.sort(key=lambda f: f.get("bitrate", 999_999))
                stream_url = audio_fmts[0]["url"]

                # Download + re-encode to opus 64k with ffmpeg
                opus_path = output_path.with_suffix(".opus")
                result = subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-i", stream_url,
                        "-vn",
                        "-c:a", "libopus",
                        "-b:a", "64k",
                        str(opus_path),
                    ],
                    capture_output=True,
                    timeout=600,
                )
                if result.returncode == 0 and opus_path.exists() and opus_path.stat().st_size > 0:
                    size_mb = opus_path.stat().st_size / 1024 / 1024
                    logger.info(
                        f"✅ Audio via Invidious ({instance}): {size_mb:.1f} MB [FREE]"
                    )
                    return True
                logger.debug(
                    f"Invidious {instance} ffmpeg failed: "
                    f"{result.stderr[-200:].decode(errors='replace')}"
                )

            except Exception as e:
                logger.debug(f"Invidious audio {instance} failed: {str(e)[:80]}")
                continue

        logger.debug("All Invidious instances failed for audio download")
        return False

    def _download_audio_via_piped(self, video_id: str, output_path: Path):
        """Download audio via Piped public API — free, no proxy bandwidth cost.

        Calls /streams/{id} on a public Piped instance to resolve the audio
        stream URL, then downloads it directly with ffmpeg. Returns True on
        success, "live" for live streams, or False if all instances fail.
        """
        instances = list(_PIPED_INSTANCES)
        random.shuffle(instances)

        for instance in instances:
            try:
                api_url = f"{instance}/streams/{urllib.parse.quote(video_id, safe='')}"
                req = urllib.request.Request(
                    api_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode())

                if data.get("livestreamed") or data.get("livestream"):
                    return "live"

                audio_streams = data.get("audioStreams", [])
                if not audio_streams:
                    logger.debug(f"Piped {instance}: no audio streams for {video_id}")
                    continue

                # Prefer lowest bitrate (smallest download, sufficient for Whisper)
                audio_streams.sort(key=lambda f: f.get("bitrate", 999_999))
                stream_url = audio_streams[0].get("url", "")
                if not stream_url:
                    continue

                # Download + re-encode to opus 64k with ffmpeg
                opus_path = output_path.with_suffix(".opus")
                result = subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-i", stream_url,
                        "-vn",
                        "-c:a", "libopus",
                        "-b:a", "64k",
                        str(opus_path),
                    ],
                    capture_output=True,
                    timeout=600,
                )
                if result.returncode == 0 and opus_path.exists() and opus_path.stat().st_size > 0:
                    size_mb = opus_path.stat().st_size / 1024 / 1024
                    logger.info(
                        f"✅ Audio via Piped ({instance}): {size_mb:.1f} MB [FREE]"
                    )
                    return True
                logger.debug(
                    f"Piped {instance} ffmpeg failed: "
                    f"{result.stderr[-200:].decode(errors='replace')}"
                )

            except Exception as e:
                logger.debug(f"Piped audio {instance} failed: {str(e)[:80]}")
                continue

        logger.debug("All Piped instances failed for audio download")
        return False

    # Groq hard limit: 25 MB per request. Use 15 MB chunks to leave margin
    # for HTTP multipart overhead and audio encoding variance.
    _MAX_CHUNK_BYTES = 15 * 1024 * 1024

    def _split_audio_chunks(self, audio_file: Path, temp_dir: Path) -> list[Path]:
        """Split audio into ≤20 MB chunks so each fits within Groq's 25 MB limit.

        Uses ffprobe to get the total duration, then splits with ffmpeg into
        equal-duration segments. Returns [audio_file] unchanged if already small enough.
        """
        file_size = audio_file.stat().st_size
        if file_size <= self._MAX_CHUNK_BYTES:
            return [audio_file]

        # Get total duration
        probe = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(audio_file),
            ],
            capture_output=True,
            text=True,
        )
        total_duration = float(probe.stdout.strip())

        num_chunks = math.ceil(file_size / self._MAX_CHUNK_BYTES)
        chunk_duration = total_duration / num_chunks

        logger.info(
            f"Audio too large ({file_size / 1024 / 1024:.1f} MB) — "
            f"splitting into {num_chunks} chunks of ~{chunk_duration / 60:.1f} min"
        )

        chunks: list[Path] = []
        for i in range(num_chunks):
            start = i * chunk_duration
            chunk_path = temp_dir / f"chunk_{i:03d}.opus"
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(start),
                    "-t", str(chunk_duration),
                    "-i", str(audio_file),
                    "-c", "copy",  # stream copy — no re-encoding
                    str(chunk_path),
                ],
                capture_output=True,
                check=True,
            )
            chunks.append(chunk_path)

        return chunks

    def _transcribe_chunk(
        self, chunk_path: Path, language: Optional[str]
    ) -> Tuple[str, str, float]:
        """Send one audio chunk to Groq Whisper. Returns (text, lang, cost_usd)."""
        chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        with open(chunk_path, "rb") as f:
            response = self.client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=f,
                language=language,
                response_format="verbose_json",
            )
        detected_lang = getattr(response, "language", None) or language or "unknown"
        duration_min = getattr(response, "duration", chunk_size_mb * 3 * 60) / 60
        cost = duration_min * 0.00067  # Groq pricing: $0.04/h = $0.00067/min
        return response.text, detected_lang, cost

    def transcribe(
        self,
        youtube_url: str,
        language: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str], Optional[str], float]:
        """
        Transcribe a YouTube video using Whisper API.

        Large videos (>20 MB audio) are automatically split into chunks and
        their transcripts joined before returning.

        Returns:
            (transcript_text, detected_language, error_message, cost_usd)
        """
        temp_dir = None
        audio_file = None

        try:
            temp_dir = tempfile.mkdtemp(prefix="brieftube_whisper_")
            audio_path = Path(temp_dir) / "audio"

            # Step 1: Download audio
            logger.info(f"Downloading audio from YouTube: {youtube_url}")
            dl_result = self._download_audio(youtube_url, audio_path)
            if isinstance(dl_result, str) and dl_result.startswith("premiere:"):
                try:
                    hours = int(dl_result.split(":")[1])
                except (ValueError, IndexError):
                    hours = 2  # default fallback
                return None, None, f"premiere_not_available_yet:{hours}", 0.0
            if dl_result == "live":
                return None, None, "video_is_live", 0.0
            if dl_result == "music":
                return None, None, "music_content", 0.0
            if dl_result == "unsupported":
                return None, None, "audio_unsupported_format", 0.0
            if dl_result == "geo_restricted":
                return None, None, "audio_geo_restricted", 0.0
            if dl_result == "auth_required":
                return None, None, "youtube_auth_required", 0.0
            if not dl_result:
                return None, None, "audio_download_failed", 0.0

            audio_file = audio_path.with_suffix(".opus")
            file_size_mb = audio_file.stat().st_size / (1024 * 1024)
            logger.info(f"Audio downloaded: {file_size_mb:.2f} MB")

            # Reject files that are too large — likely music/ambient (8h+)
            # Opus at ~48kbps: 80 MB ≈ ~3.7h, beyond that it's almost certainly not speech
            _MAX_AUDIO_MB = 80
            if file_size_mb > _MAX_AUDIO_MB:
                logger.warning(
                    f"Audio too large ({file_size_mb:.1f} MB > {_MAX_AUDIO_MB} MB) — "
                    "likely music/ambient content, skipping Whisper"
                )
                return None, None, "audio_too_large_for_speech", 0.0

            # Step 2: Split into chunks if needed
            chunks = self._split_audio_chunks(audio_file, Path(temp_dir))

            # Step 3: Transcribe each chunk
            logger.info(
                f"Transcribing {len(chunks)} chunk(s) with Groq Whisper "
                f"(language: {language or 'auto-detect'})..."
            )
            parts: list[str] = []
            total_cost = 0.0
            detected_lang = language

            for i, chunk in enumerate(chunks):
                if len(chunks) > 1:
                    logger.info(f"Chunk {i + 1}/{len(chunks)}: {chunk.name}")
                text, lang, cost = self._transcribe_chunk(chunk, language)
                parts.append(text)
                total_cost += cost
                if i == 0:
                    detected_lang = lang

            transcript = "\n".join(parts)
            logger.info(
                f"✅ Transcription complete: {len(transcript)} chars, "
                f"language: {detected_lang}, chunks: {len(chunks)}, "
                f"cost: ~${total_cost:.4f}"
            )
            return transcript, detected_lang, None, total_cost

        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None, None, f"whisper_error: {str(e)}", 0.0

        finally:
            # Cleanup temp files (audio + all chunks)
            if temp_dir:
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception:
                    pass
