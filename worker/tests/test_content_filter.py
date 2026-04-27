"""Unit tests for content_filter.py — centralized content filtering rules."""

from content_filter import (
    is_music_title,
    is_youtube_short,
    should_skip_title,
    check_metadata_skip,
)


# ── is_music_title ───────────────────────────────────────────────────────────

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


# ── is_youtube_short ─────────────────────────────────────────────────────────

class TestIsYoutubeShort:
    def test_shorts_url(self):
        assert is_youtube_short("https://www.youtube.com/shorts/dQw4w9WgXcQ")

    def test_normal_url(self):
        assert not is_youtube_short("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtu_be(self):
        assert not is_youtube_short("https://youtu.be/dQw4w9WgXcQ")


# ── should_skip_title ────────────────────────────────────────────────────────

class TestShouldSkipTitle:
    """Title check returning skip reason."""

    def test_music_returns_music_content(self):
        assert should_skip_title("lofi beats to study") == "music_content"

    def test_drama_no_longer_filtered(self):
        # Drama/movie title filter was removed — these now pass through.
        assert should_skip_title("Latest Nollywood Movie") is None

    def test_normal_returns_none(self):
        assert should_skip_title("How to Build a SaaS") is None

    def test_empty_returns_none(self):
        assert should_skip_title("") is None


# ── check_metadata_skip ──────────────────────────────────────────────────────

class TestCheckMetadataSkip:
    """Invidious metadata-based filtering — only Music genre is filtered."""

    def test_music_genre(self):
        assert check_metadata_skip("Music", 240) == "music_content"

    def test_music_genre_case_insensitive(self):
        assert check_metadata_skip("music", 0) == "music_content"

    def test_film_long_no_longer_blocked(self):
        # Category/duration gates were removed — long films now pass through.
        assert check_metadata_skip("Film & Animation", 7200) is None

    def test_sports_long_no_longer_blocked(self):
        assert check_metadata_skip("Sports", 7200) is None

    def test_entertainment_long_no_longer_blocked(self):
        assert check_metadata_skip("Entertainment", 5400) is None

    def test_nonprofits_long_no_longer_blocked(self):
        assert check_metadata_skip("Nonprofits & Activism", 3600) is None

    def test_science_passes(self):
        assert check_metadata_skip("Science & Technology", 36000) is None

    def test_movie_keywords_no_longer_filter(self):
        assert check_metadata_skip("People & Blogs", 7200, {"full movie", "2026"}) is None

    def test_empty_genre(self):
        assert check_metadata_skip("", 3600) is None

    def test_zero_duration(self):
        assert check_metadata_skip("Film & Animation", 0) is None
