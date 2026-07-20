"""Unit tests for bot_handler.py — pure functions, no network or Telegram calls."""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

import db
from bot_handler import (
    _calc_success_rate,
    _is_pro,
    _get_plan_label,
)


# ── _calc_success_rate ────────────────────────────────────────────────────────

class TestCalcSuccessRate:
    def test_all_success(self):
        assert _calc_success_rate({"videos_processed": 100, "videos_failed": 0}) == 100

    def test_all_failed(self):
        assert _calc_success_rate({"videos_processed": 0, "videos_failed": 100}) == 0

    def test_half_half(self):
        assert _calc_success_rate({"videos_processed": 50, "videos_failed": 50}) == 50

    def test_no_videos(self):
        # Zero total → 100% (no failures)
        assert _calc_success_rate({"videos_processed": 0, "videos_failed": 0}) == 100

    def test_rounding(self):
        assert _calc_success_rate({"videos_processed": 1, "videos_failed": 3}) == 25


# ── _is_pro ───────────────────────────────────────────────────────────────────

class TestIsPro:
    def test_active_subscription(self):
        assert _is_pro({"subscription_status": "active", "trial_ends_at": None})

    def test_free_no_trial(self):
        assert not _is_pro({"subscription_status": "free", "trial_ends_at": None})

    def test_cancelled(self):
        assert not _is_pro({"subscription_status": "cancelled", "trial_ends_at": None})

    def test_trial_still_active(self):
        future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        assert _is_pro({"subscription_status": "free", "trial_ends_at": future})

    def test_trial_expired(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        assert not _is_pro({"subscription_status": "free", "trial_ends_at": past})

    def test_trial_ends_today_still_valid(self):
        soon = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        assert _is_pro({"subscription_status": "free", "trial_ends_at": soon})

    def test_trial_invalid_date_falls_back_to_free(self):
        assert not _is_pro({"subscription_status": "free", "trial_ends_at": "not-a-date"})

    def test_empty_profile(self):
        assert not _is_pro({})


# ── _get_plan_label ───────────────────────────────────────────────────────────

class TestGetPlanLabel:
    def test_active_is_pro(self):
        assert _get_plan_label({"subscription_status": "active", "trial_ends_at": None}) == "Pro"

    def test_free_no_trial(self):
        assert _get_plan_label({"subscription_status": "free", "trial_ends_at": None}) == "Free"

    def test_trial_active_shows_days(self):
        future = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        label = _get_plan_label({"subscription_status": "free", "trial_ends_at": future})
        assert "Trial" in label
        assert "left" in label

    def test_trial_expired_shows_free(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        label = _get_plan_label({"subscription_status": "free", "trial_ends_at": past})
        assert label == "Free"


# ── db.upsert_delivery ────────────────────────────────────────────────────────

def _make_sb_mock(existing_id: str | None = None, execute_returns_none: bool = False):
    """Build a chainable Supabase mock for deliveries queries."""
    sb = MagicMock()
    chain = MagicMock()
    sb.table.return_value = chain
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.update.return_value = chain
    chain.insert.return_value = chain

    if execute_returns_none:
        chain.execute.return_value = None
    elif existing_id:
        result = MagicMock()
        result.data = {"id": existing_id}
        chain.execute.return_value = result
    else:
        result = MagicMock()
        result.data = None
        chain.execute.return_value = result

    return sb, chain


class TestUpsertDelivery:
    def test_insert_when_no_existing(self):
        """No existing delivery → INSERT is called."""
        sb, chain = _make_sb_mock(existing_id=None)
        with patch.object(db, "get_client", return_value=sb):
            db.upsert_delivery("user-1", "video-1", "fr")
        chain.insert.assert_called_once()

    def test_update_when_existing(self):
        """Existing delivery → UPDATE is called, not INSERT."""
        sb, chain = _make_sb_mock(existing_id="delivery-uuid-123")
        with patch.object(db, "get_client", return_value=sb):
            db.upsert_delivery("user-1", "video-1", "fr")
        chain.update.assert_called_once()
        chain.insert.assert_not_called()

    def test_no_crash_when_execute_returns_none(self):
        """Regression: execute() returning None must not raise AttributeError."""
        sb, chain = _make_sb_mock(execute_returns_none=True)
        # Must not raise
        with patch.object(db, "get_client", return_value=sb):
            db.upsert_delivery("user-1", "video-1", "fr")
        chain.insert.assert_called_once()

    def test_update_resets_status_to_pending(self):
        """UPDATE payload must set status=pending and sent_at=None."""
        sb, chain = _make_sb_mock(existing_id="delivery-uuid-123")
        with patch.object(db, "get_client", return_value=sb):
            db.upsert_delivery("user-1", "video-1", "en")
        update_call = chain.update.call_args[0][0]
        assert update_call["status"] == "pending"
        assert update_call["sent_at"] is None
        assert update_call["language"] == "en"

    def test_insert_includes_all_fields(self):
        """INSERT payload must include user_id, video_id, status, language."""
        sb, chain = _make_sb_mock(existing_id=None)
        with patch.object(db, "get_client", return_value=sb):
            db.upsert_delivery("user-abc", "vid-xyz", "th")
        insert_call = chain.insert.call_args[0][0]
        assert insert_call["user_id"] == "user-abc"
        assert insert_call["video_id"] == "vid-xyz"
        assert insert_call["status"] == "pending"
        assert insert_call["language"] == "th"
        assert insert_call["source"] == "on_demand"
