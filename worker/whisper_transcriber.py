"""
Whisper API transcriber for YouTube videos
Uses Groq Whisper Large V3 Turbo to transcribe audio from YouTube videos
Fallback solution when YouTube transcripts are not available

Groq advantages:
- 9x cheaper than OpenAI ($0.00067/min vs $0.006/min)
- 228-383x faster than real-time
- Same Whisper Large V3 model quality
"""

import math
import os
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Tuple
import yt_dlp
from groq import Groq

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
        try:
            # 64kbps is more than sufficient for Whisper speech recognition and
            # keeps file size well under Groq's 25 MB limit (~54 min max at 64kbps).
            # 192kbps would exceed the limit for any video longer than ~15 min.
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '64',
                }],
                'outtmpl': str(output_path.with_suffix('')),  # yt-dlp adds .mp3
                'quiet': True,
                'no_warnings': True,
                'noprogress': True,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([youtube_url])

            # Check if file was created
            mp3_path = output_path.with_suffix('.mp3')
            if mp3_path.exists():
                return True

            logger.error(f"Audio file not created: {mp3_path}")
            return False

        except Exception as e:
            logger.error(f"Error downloading audio: {e}")
            return False

    # Groq hard limit: 25 MB per request. Use 20 MB chunks to leave margin.
    _MAX_CHUNK_BYTES = 20 * 1024 * 1024

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
            chunk_path = temp_dir / f"chunk_{i:03d}.mp3"
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(start),
                    "-t", str(chunk_duration),
                    "-i", str(audio_file),
                    "-q:a", "0",
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
            if not self._download_audio(youtube_url, audio_path):
                return None, None, "audio_download_failed", 0.0

            audio_file = audio_path.with_suffix(".mp3")
            file_size_mb = audio_file.stat().st_size / (1024 * 1024)
            logger.info(f"Audio downloaded: {file_size_mb:.2f} MB")

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
                import shutil
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception:
                    pass


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("❌ Set GROQ_API_KEY environment variable")
        exit(1)

    # Test with a YouTube video
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    transcriber = WhisperTranscriber(api_key=api_key)
    transcript, lang, error, cost = transcriber.transcribe(test_url)

    if transcript:
        print(f"✅ Transcript: {len(transcript)} chars")
        print(f"Language: {lang}")
        print(f"Cost: ${cost:.4f}")
        print(f"Preview: {transcript[:200]}...")
    else:
        print(f"❌ Failed: {error}")
