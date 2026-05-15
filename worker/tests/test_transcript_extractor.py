"""Unit tests for transcript_extractor.py — pure functions, no network calls."""

import pytest
from transcript_extractor import TranscriptExtractor


# ── _is_music_video (Whisper pre-filter) ─────────────────────────────────────

class TestIsMusicVideo:
    """Titles that should block the (expensive) Whisper fallback."""

    def test_hz_frequency(self):
        assert TranscriptExtractor._is_music_video("432Hz Healing Frequency — Deep Sleep Music")

    def test_binaural_beats(self):
        assert TranscriptExtractor._is_music_video("Binaural Beats for Focus — Alpha Waves")

    def test_white_noise(self):
        assert TranscriptExtractor._is_music_video("White Noise for Sleeping — 10 Hours")

    def test_rain_sounds(self):
        assert TranscriptExtractor._is_music_video("Rain Sounds for Sleeping")

    def test_case_insensitive(self):
        assert TranscriptExtractor._is_music_video("BINAURAL BEATS FOCUS")


class TestIsMusicVideoShouldPass:
    """Titles that should NOT block Whisper — real speech content."""

    def test_normal_speech(self):
        assert not TranscriptExtractor._is_music_video("Python Tutorial for Beginners")

    def test_empty_title(self):
        assert not TranscriptExtractor._is_music_video("")

    def test_lecture_about_music(self):
        # A lecture that mentions music in context shouldn't be filtered
        assert not TranscriptExtractor._is_music_video("History of Classical Music — Yale Lecture")


# ── _parse_vtt_text (static) ──────────────────────────────────────────────────

class TestParseVttText:
    def test_basic_vtt(self):
        vtt = """\
WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.000
This is a test
"""
        result = TranscriptExtractor._parse_vtt_text(vtt)
        assert result == "Hello world This is a test"

    def test_deduplicates_consecutive_lines(self):
        """Auto-generated subtitles often repeat lines (rolling captions)."""
        vtt = """\
WEBVTT

00:00:01.000 --> 00:00:02.000
Hello

00:00:02.000 --> 00:00:03.000
Hello

00:00:03.000 --> 00:00:04.000
World
"""
        result = TranscriptExtractor._parse_vtt_text(vtt)
        assert result == "Hello World"

    def test_strips_html_tags(self):
        vtt = """\
WEBVTT

00:00:01.000 --> 00:00:03.000
<c.colorE5E5E5>Hello <b>world</b></c>
"""
        result = TranscriptExtractor._parse_vtt_text(vtt)
        assert "Hello world" in result

    def test_empty_vtt_returns_none(self):
        vtt = "WEBVTT\n\n"
        result = TranscriptExtractor._parse_vtt_text(vtt)
        assert result is None

    def test_malformed_vtt_returns_none(self):
        result = TranscriptExtractor._parse_vtt_text("")
        assert result is None

    def test_real_world_auto_caption_style(self):
        """Simulates the rolling-caption style YouTube auto-generates."""
        vtt = """\
WEBVTT

00:00:00.000 --> 00:00:01.500
good morning everyone

00:00:01.000 --> 00:00:02.500
morning everyone and

00:00:02.000 --> 00:00:04.000
everyone and welcome
"""
        result = TranscriptExtractor._parse_vtt_text(vtt)
        assert result is not None
        assert len(result) > 0


# ── should_retry ──────────────────────────────────────────────────────────────

class TestShouldRetry:
    def test_no_transcript_available_retries(self):
        assert TranscriptExtractor.should_retry("no_transcript_available")

    def test_rate_limited_retries(self):
        assert TranscriptExtractor.should_retry("rate_limited")

    def test_video_unavailable_no_retry(self):
        # Private/deleted video — permanent failure, no retry
        assert not TranscriptExtractor.should_retry("video_unavailable")

    def test_youtube_auth_required_retries(self):
        assert TranscriptExtractor.should_retry("youtube_auth_required")

    def test_groq_429_retries(self):
        assert TranscriptExtractor.should_retry("whisper_error: 429 rate_limit_exceeded")

    def test_capacity_exceeded_retries(self):
        assert TranscriptExtractor.should_retry("498 capacity_exceeded")

    def test_transcripts_disabled_no_retry(self):
        assert not TranscriptExtractor.should_retry("transcripts_disabled")

    def test_music_no_retry(self):
        assert not TranscriptExtractor.should_retry("likely_music_no_speech")

    def test_geo_restricted_no_retry(self):
        assert not TranscriptExtractor.should_retry("audio_geo_restricted")

    def test_none_no_retry(self):
        assert not TranscriptExtractor.should_retry(None)

    def test_unknown_error_no_retry(self):
        assert not TranscriptExtractor.should_retry("some_unknown_error_code")
