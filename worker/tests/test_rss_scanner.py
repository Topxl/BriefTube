"""Unit tests for rss_scanner.py — pure functions, no network calls."""

import pytest
from rss_scanner import is_likely_music, extract_video_id, is_youtube_short


# ── is_likely_music — should skip ────────────────────────────────────────────

class TestIsLikelyMusicShouldSkip:
    """Titles that MUST be detected as music/ambient → RSS scanner skips them."""

    def test_lofi(self):
        assert is_likely_music("lofi hip hop radio — beats to relax/study to")

    def test_hours_of_music(self):
        assert is_likely_music("3 Hours of Jazz Music for Work")

    def test_24_7_music(self):
        assert is_likely_music("24/7 Music Radio — Lofi & Chill")

    def test_background_music(self):
        assert is_likely_music("No Copyright Background Music — Chill Mix")

    def test_case_insensitive(self):
        assert is_likely_music("LOFI BEATS TO STUDY")


# ── is_likely_music — should NOT skip ────────────────────────────────────────

class TestIsLikelyMusicShouldPass:
    """Titles that must NOT be filtered — real speech content."""

    def test_tech_tutorial(self):
        assert not is_likely_music("How to build a REST API with Python")

    def test_lecture_with_music_in_topic(self):
        # A lecture about music should not be filtered
        assert not is_likely_music("History of Music in the 20th Century — Lecture")

    def test_long_podcast(self):
        # Lex Fridman style long podcast
        assert not is_likely_music("Sam Altman: OpenAI, GPT-5, and the future of AI | Lex Fridman")

    def test_empty_title(self):
        assert not is_likely_music("")


# ── is_youtube_short ──────────────────────────────────────────────────────────

class TestIsYoutubeShort:
    def test_shorts_url(self):
        assert is_youtube_short("https://www.youtube.com/shorts/dQw4w9WgXcQ")

    def test_normal_url_not_short(self):
        assert not is_youtube_short("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtu_be_not_short(self):
        assert not is_youtube_short("https://youtu.be/dQw4w9WgXcQ")
