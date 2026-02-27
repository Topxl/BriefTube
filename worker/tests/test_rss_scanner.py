"""Unit tests for rss_scanner.py — pure functions, no network calls."""

import pytest
from rss_scanner import is_likely_music, extract_video_id, is_youtube_short


# ── is_likely_music — should skip ────────────────────────────────────────────

class TestIsLikelyMusicShouldSkip:
    """Titles that MUST be detected as music/ambient → RSS scanner skips them."""

    def test_lofi(self):
        assert is_likely_music("lofi hip hop radio — beats to relax/study to")

    def test_chill_beats(self):
        assert is_likely_music("Chill Beats for Studying")

    def test_study_music(self):
        assert is_likely_music("Best Study Music 2024 — 2 Hours Focus")

    def test_sleep_music(self):
        assert is_likely_music("Sleep Music for Deep Sleep")

    def test_relaxing_music(self):
        assert is_likely_music("Relaxing Music for Stress Relief")

    def test_focus_music(self):
        assert is_likely_music("Focus Music — No Copyright Background Music")

    def test_hours_of_music(self):
        assert is_likely_music("3 Hours of Jazz Music for Work")

    def test_hours_of_lofi(self):
        assert is_likely_music("2h of lofi beats")

    def test_beats_to_study(self):
        assert is_likely_music("Beats to Study and Relax To")

    def test_background_music(self):
        assert is_likely_music("No Copyright Background Music — Chill Mix")

    def test_instrumental_music(self):
        assert is_likely_music("Instrumental Music Mix — 1 Hour")

    def test_24_7_music(self):
        assert is_likely_music("24/7 Music Radio — Lofi & Chill")

    def test_music_mix(self):
        assert is_likely_music("Music Mix 2024 — Best Hits")

    def test_ambient_mix(self):
        assert is_likely_music("Ambient Mix for Deep Work")

    def test_case_insensitive(self):
        assert is_likely_music("LOFI BEATS TO STUDY")


# ── is_likely_music — should NOT skip ────────────────────────────────────────

class TestIsLikelyMusicShouldPass:
    """Titles that must NOT be filtered — real speech content."""

    def test_tech_tutorial(self):
        assert not is_likely_music("How to build a REST API with Python")

    def test_podcast_episode(self):
        assert not is_likely_music("Podcast Episode 142: AI and the future of work")

    def test_news_video(self):
        assert not is_likely_music("Breaking News: EU announces new AI regulations")

    def test_interview(self):
        assert not is_likely_music("Elon Musk Interview — Full conversation with Joe Rogan")

    def test_lecture_with_music_in_topic(self):
        # A lecture about music should not be filtered
        assert not is_likely_music("History of Music in the 20th Century — Lecture")

    def test_long_podcast(self):
        # Lex Fridman style long podcast
        assert not is_likely_music("Sam Altman: OpenAI, GPT-5, and the future of AI | Lex Fridman")

    def test_youtube_channel_with_music_word(self):
        # "Music channel" in the title doesn't mean it IS music
        assert not is_likely_music("Top 10 Music Channels on YouTube in 2024")

    def test_gaming_video(self):
        assert not is_likely_music("I played Minecraft for 100 days — here's what happened")

    def test_cooking_video(self):
        assert not is_likely_music("Gordon Ramsay Makes the Perfect Burger")

    def test_finance_video(self):
        assert not is_likely_music("How to invest $1000 in 2024 — Full guide")

    def test_empty_title(self):
        assert not is_likely_music("")


# ── extract_video_id ──────────────────────────────────────────────────────────

class TestRssScannerExtractVideoId:
    """Verifies rss_scanner.extract_video_id delegates correctly to youtube_utils."""

    def test_standard_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_rss_url_with_multiple_params(self):
        # RSS feed URLs sometimes include extra params
        assert extract_video_id("https://www.youtube.com/watch?v=UF8uR6Z6KLc&feature=rss") == "UF8uR6Z6KLc"

    def test_video_id_with_dash(self):
        assert extract_video_id("https://www.youtube.com/watch?v=-ByJprRD2qE") == "-ByJprRD2qE"

    def test_invalid_returns_none(self):
        assert extract_video_id("https://example.com") is None


# ── is_youtube_short ──────────────────────────────────────────────────────────

class TestIsYoutubeShort:
    def test_shorts_url(self):
        assert is_youtube_short("https://www.youtube.com/shorts/dQw4w9WgXcQ")

    def test_normal_url_not_short(self):
        assert not is_youtube_short("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtu_be_not_short(self):
        assert not is_youtube_short("https://youtu.be/dQw4w9WgXcQ")
