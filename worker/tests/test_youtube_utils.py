"""Unit tests for youtube_utils.py — pure functions, no network calls."""

import pytest

from youtube_utils import (
    hours_until_premiere,
    BOT_DETECTION_KEYWORDS,
    extract_video_id,
)


# ── extract_video_id ──────────────────────────────────────────────────────────

class TestExtractVideoId:
    def test_standard_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url_with_extra_params(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest&index=1") == "dQw4w9WgXcQ"

    def test_short_url_with_params(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ?si=abcdef") == "dQw4w9WgXcQ"

    def test_video_id_with_dash(self):
        # Video IDs can contain dashes
        assert extract_video_id("https://www.youtube.com/watch?v=-ByJprRD2qE") == "-ByJprRD2qE"

    def test_invalid_url_returns_none(self):
        assert extract_video_id("https://www.example.com/video") is None

    def test_shorts_url_no_v_param(self):
        # /shorts/ URLs don't have a ?v= param — should return None
        result = extract_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ")
        assert result is None  # Shorts filtered at RSS scanner level


# ── hours_until_premiere ──────────────────────────────────────────────────────

class TestHoursUntilPremiere:
    def test_days(self):
        assert hours_until_premiere("will begin in 2 days") == 48

    def test_days_premiere_form(self):
        assert hours_until_premiere("Premieres in 3 days") == 72

    def test_hours(self):
        assert hours_until_premiere("will begin in 5 hours") == 5

    def test_hours_premiere_form(self):
        assert hours_until_premiere("Premieres in 12 hours") == 12

    def test_minutes(self):
        # 45 minutes → rounds up to 1 hour
        assert hours_until_premiere("will begin in 45 minutes") == 1

    def test_minutes_rounds_up(self):
        # 61 minutes → rounds up to 2 hours
        assert hours_until_premiere("will begin in 61 minutes") == 2

    def test_minimum_1_hour(self):
        # Even "1 day" = 24h (minimum enforced to 1)
        assert hours_until_premiere("will begin in 0 hours") == 1

    def test_default_when_no_match(self):
        assert hours_until_premiere("some random error message") == 2

    def test_premiere_capitalized(self):
        assert hours_until_premiere("Premiere in 6 hours") == 6

    def test_case_insensitive(self):
        assert hours_until_premiere("WILL BEGIN IN 4 HOURS") == 4


# ── Bot detection keywords ────────────────────────────────────────────────────

class TestBotDetectionKeywords:
    def test_detects_bot_error(self):
        err = "Please sign in to confirm you're not a bot."
        assert any(kw in err.lower() for kw in BOT_DETECTION_KEYWORDS)

    def test_no_false_positive(self):
        err = "Video unavailable in your country."
        assert not any(kw in err.lower() for kw in BOT_DETECTION_KEYWORDS)


