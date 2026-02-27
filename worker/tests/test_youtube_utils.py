"""Unit tests for youtube_utils.py — pure functions, no network calls."""

import pytest
import re

from youtube_utils import (
    _PREMIERE_RE,
    hours_until_premiere,
    PLAYER_CLIENTS_FULL,
    PLAYER_CLIENTS_SHORT,
    BOT_DETECTION_KEYWORDS,
    INVIDIOUS_INSTANCES,
    PIPED_INSTANCES,
    extract_video_id,
)


# ── extract_video_id ──────────────────────────────────────────────────────────

class TestExtractVideoId:
    def test_standard_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url_with_extra_params(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest&index=1") == "dQw4w9WgXcQ"

    def test_watch_url_v_not_first_param(self):
        assert extract_video_id("https://www.youtube.com/watch?list=PLtest&v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url_with_params(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ?si=abcdef") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url_with_params(self):
        assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1") == "dQw4w9WgXcQ"

    def test_video_id_with_dash(self):
        # Video IDs can contain dashes
        assert extract_video_id("https://www.youtube.com/watch?v=-ByJprRD2qE") == "-ByJprRD2qE"

    def test_video_id_with_underscore(self):
        assert extract_video_id("https://www.youtube.com/watch?v=_OBlgSz8sSM") == "_OBlgSz8sSM"

    def test_rss_feed_url(self):
        # RSS URLs are plain watch URLs in the feed
        assert extract_video_id("https://www.youtube.com/watch?v=UF8uR6Z6KLc") == "UF8uR6Z6KLc"

    def test_invalid_url_returns_none(self):
        assert extract_video_id("https://www.example.com/video") is None

    def test_empty_string_returns_none(self):
        assert extract_video_id("") is None

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


# ── _PREMIERE_RE ──────────────────────────────────────────────────────────────

class TestPremiereRe:
    def test_live_event_will_begin(self):
        assert _PREMIERE_RE.search("This live event will begin in 2 hours")

    def test_premiere_will_begin(self):
        assert _PREMIERE_RE.search("This premiere will begin in 30 minutes")

    def test_premieres_in_hours(self):
        assert _PREMIERE_RE.search("Premieres in 5 hours")

    def test_premiere_in_days(self):
        assert _PREMIERE_RE.search("Premiere in 2 days")

    def test_scheduled_to_begin(self):
        assert _PREMIERE_RE.search("Scheduled to begin at 18:00 UTC")

    def test_upcoming_premiere(self):
        assert _PREMIERE_RE.search("This is an upcoming premiere")

    def test_no_match_on_normal_error(self):
        assert not _PREMIERE_RE.search("Video unavailable")

    def test_no_match_on_live_currently(self):
        # Currently live ≠ scheduled premiere
        assert not _PREMIERE_RE.search("This is a live stream currently broadcasting")

    def test_case_insensitive(self):
        assert _PREMIERE_RE.search("PREMIERE WILL BEGIN IN 1 HOUR")


# ── Player clients ────────────────────────────────────────────────────────────

class TestPlayerClients:
    def test_full_has_4_clients(self):
        assert len(PLAYER_CLIENTS_FULL) == 4

    def test_short_has_2_clients(self):
        assert len(PLAYER_CLIENTS_SHORT) == 2

    def test_full_starts_with_ios(self):
        assert PLAYER_CLIENTS_FULL[0] == ["ios"]

    def test_short_starts_with_ios(self):
        assert PLAYER_CLIENTS_SHORT[0] == ["ios"]

    def test_short_contains_tv_embedded(self):
        assert ["tv_embedded"] in PLAYER_CLIENTS_SHORT

    def test_short_no_android(self):
        # android ≈ ios on datacenter IPs — intentionally excluded from short chain
        assert ["android"] not in PLAYER_CLIENTS_SHORT

    def test_full_contains_all_clients(self):
        clients_flat = [c[0] for c in PLAYER_CLIENTS_FULL]
        assert "ios" in clients_flat
        assert "android" in clients_flat
        assert "tv_embedded" in clients_flat
        assert "mweb" in clients_flat


# ── Bot detection keywords ────────────────────────────────────────────────────

class TestBotDetectionKeywords:
    def test_has_sign_in(self):
        assert "sign in" in BOT_DETECTION_KEYWORDS

    def test_has_not_a_bot(self):
        assert "not a bot" in BOT_DETECTION_KEYWORDS

    def test_detects_bot_error(self):
        err = "Please sign in to confirm you're not a bot."
        assert any(kw in err.lower() for kw in BOT_DETECTION_KEYWORDS)

    def test_no_false_positive(self):
        err = "Video unavailable in your country."
        assert not any(kw in err.lower() for kw in BOT_DETECTION_KEYWORDS)


# ── Instance lists ────────────────────────────────────────────────────────────

class TestInstanceLists:
    def test_invidious_has_enough_instances(self):
        assert len(INVIDIOUS_INSTANCES) >= 3

    def test_piped_has_enough_instances(self):
        assert len(PIPED_INSTANCES) >= 3

    def test_invidious_all_https(self):
        for url in INVIDIOUS_INSTANCES:
            assert url.startswith("https://"), f"Not HTTPS: {url}"

    def test_piped_all_https(self):
        for url in PIPED_INSTANCES:
            assert url.startswith("https://"), f"Not HTTPS: {url}"

    def test_no_duplicate_invidious(self):
        assert len(INVIDIOUS_INSTANCES) == len(set(INVIDIOUS_INSTANCES))

    def test_no_duplicate_piped(self):
        assert len(PIPED_INSTANCES) == len(set(PIPED_INSTANCES))

    def test_invidious_and_piped_are_different(self):
        # They should use different infrastructure
        overlap = set(INVIDIOUS_INSTANCES) & set(PIPED_INSTANCES)
        assert len(overlap) == 0
