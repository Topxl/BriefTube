"""Unit tests for content_filter.py — centralized content filtering rules."""

import pytest
from content_filter import (
    is_music_title,
    is_drama_movie_title,
    is_youtube_short,
    should_skip_title,
    check_metadata_skip,
    CATEGORY_DURATION_GATES,
    MOVIE_KEYWORDS,
)


# ── is_music_title ────────────────────────────────���──────────────────────────

class TestIsMusicTitle:
    """Titles that MUST be detected as music/ambient."""

    def test_lofi(self):
        assert is_music_title("lofi hip hop radio — beats to relax/study to")

    def test_hours_of_music(self):
        assert is_music_title("3 Hours of Jazz Music for Work")

    def test_24_7_music(self):
        assert is_music_title("24/7 Music Radio — Lofi & Chill")

    def test_background_music(self):
        assert is_music_title("No Copyright Background Music — Chill Mix")

    def test_case_insensitive(self):
        assert is_music_title("LOFI BEATS TO STUDY")

    def test_official_audio(self):
        assert is_music_title("Kendrick Lamar - luther (Official Audio)")

    def test_official_audio_uppercase(self):
        assert is_music_title("Drake - God's Plan (OFFICIAL AUDIO)")

    def test_youtube_music_topic_channel(self):
        assert is_music_title("Kendrick Lamar - Topic")

    def test_worship(self):
        assert is_music_title("Best Worship Songs 2026 — Nonstop Praise")

    def test_bhajan(self):
        assert is_music_title("Nonstop Hanuman Bhajan 2026")

    def test_hz_frequency(self):
        assert is_music_title("432Hz Healing Frequency — Deep Sleep Music")

    def test_binaural_beats(self):
        assert is_music_title("Binaural Beats for Focus — Alpha Waves")

    def test_white_noise(self):
        assert is_music_title("White Noise for Sleeping — 10 Hours")

    def test_rain_sounds(self):
        assert is_music_title("Rain Sounds for Sleeping")

    def test_soundscape(self):
        assert is_music_title("Ancient soundscape for deep relaxation")

    def test_solfeggio(self):
        assert is_music_title("Solfeggio Frequencies — 528Hz Healing")

    def test_chakra(self):
        assert is_music_title("Heart Chakra Meditation Music")

    def test_hillsong(self):
        assert is_music_title("Hillsong United — Live Worship")

    def test_tamil_mass_songs(self):
        assert is_music_title("Vijay Songs Collection 2026")

    def test_jukebox(self):
        assert is_music_title("Hanuman Jayanti Jukebox — Top Bhajans")


class TestIsMusicTitleShouldPass:
    """Titles that must NOT be filtered — real speech content."""

    def test_tech_tutorial(self):
        assert not is_music_title("How to build a REST API with Python")

    def test_lecture_about_music(self):
        assert not is_music_title("History of Music in the 20th Century — Lecture")

    def test_long_podcast(self):
        assert not is_music_title("Sam Altman: OpenAI, GPT-5 | Lex Fridman")

    def test_empty_title(self):
        assert not is_music_title("")

    def test_music_industry_analysis(self):
        assert not is_music_title("Why the Music Industry Is Broken — Analysis")

    def test_podcast_with_musician(self):
        assert not is_music_title("Interview with a Jazz Musician")


# ── is_drama_movie_title ────────────────────────────���────────────────────────

class TestIsDramaMovieTitle:
    """Titles that match drama/movie/course patterns."""

    def test_nollywood(self):
        assert is_drama_movie_title("Latest Nollywood Movie 2026")

    def test_nigerian_movie(self):
        assert is_drama_movie_title("Best Nigerian Movie — Will Make You Cry")

    def test_funny_movie(self):
        assert is_drama_movie_title("Funny Movie That Will Make You Laugh")

    def test_ethiopian_drama(self):
        assert is_drama_movie_title("ስኩል ላይፍ — Episode 45")

    def test_full_course(self):
        assert is_drama_movie_title("Python Full Course 2026 for Beginners")

    def test_simplilearn(self):
        assert is_drama_movie_title("Data Science Tutorial For Beginners | Simplilearn")

    def test_african_movie(self):
        assert is_drama_movie_title("Best African Movie 2026")


class TestIsDramaMovieTitleShouldPass:
    """Titles that must NOT be filtered."""

    def test_movie_review(self):
        assert not is_drama_movie_title("Movie Review: Oppenheimer")

    def test_tech_video(self):
        assert not is_drama_movie_title("How to Deploy a Node.js App")

    def test_empty(self):
        assert not is_drama_movie_title("")

    def test_short_tutorial(self):
        assert not is_drama_movie_title("React Tutorial — Build a Todo App")


# ── is_youtube_short ──────────────────────────────────────────��──────────────

class TestIsYoutubeShort:
    def test_shorts_url(self):
        assert is_youtube_short("https://www.youtube.com/shorts/dQw4w9WgXcQ")

    def test_normal_url(self):
        assert not is_youtube_short("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtu_be(self):
        assert not is_youtube_short("https://youtu.be/dQw4w9WgXcQ")


# ── should_skip_title ────────────────────────────────────────────────────────

class TestShouldSkipTitle:
    """Combined title check returning skip reason."""

    def test_music_returns_music_content(self):
        assert should_skip_title("lofi beats to study") == "music_content"

    def test_drama_returns_drama_movie(self):
        assert should_skip_title("Latest Nollywood Movie") == "drama_movie"

    def test_normal_returns_none(self):
        assert should_skip_title("How to Build a SaaS") is None

    def test_empty_returns_none(self):
        assert should_skip_title("") is None

    def test_music_takes_precedence_over_drama(self):
        # If both match (unlikely but possible), music wins
        result = should_skip_title("Nonstop Worship Songs Nollywood")
        assert result == "music_content"


# ── check_metadata_skip ──────────────────────────────────────────────────────

class TestCheckMetadataSkip:
    """Invidious metadata-based filtering."""

    def test_music_genre(self):
        assert check_metadata_skip("Music", 240) == "music_content"

    def test_music_genre_case_insensitive(self):
        assert check_metadata_skip("music", 0) == "music_content"

    def test_film_short_passes(self):
        # 20 min film trailer — under 30 min threshold
        assert check_metadata_skip("Film & Animation", 1200) is None

    def test_film_long_blocked(self):
        # 2h movie — over 30 min threshold
        assert check_metadata_skip("Film & Animation", 7200) == "drama_movie"

    def test_sports_short_passes(self):
        assert check_metadata_skip("Sports", 1800) is None

    def test_sports_long_blocked(self):
        assert check_metadata_skip("Sports", 7200) == "drama_movie"

    def test_entertainment_long_blocked(self):
        assert check_metadata_skip("Entertainment", 5400) == "drama_movie"

    def test_nonprofits_long_blocked(self):
        assert check_metadata_skip("Nonprofits & Activism", 3600) == "drama_movie"

    def test_science_no_gate(self):
        # Science has no duration gate — any length passes
        assert check_metadata_skip("Science & Technology", 36000) is None

    def test_movie_keywords_long(self):
        assert check_metadata_skip("People & Blogs", 7200, {"full movie", "2026"}) == "drama_movie"

    def test_movie_keywords_short_passes(self):
        # Under 30 min, movie keywords don't trigger
        assert check_metadata_skip("People & Blogs", 600, {"full movie"}) is None

    def test_no_keywords_no_skip(self):
        assert check_metadata_skip("People & Blogs", 7200, {"cooking", "recipe"}) is None

    def test_empty_genre(self):
        assert check_metadata_skip("", 3600) is None

    def test_zero_duration(self):
        assert check_metadata_skip("Film & Animation", 0) is None
