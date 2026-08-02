"""Regression tests: get_pending_deliveries must not read summaries in bulk.

Summaries average ~2.4 kB and this runs every 15s. Deliveries that can never be
dispatched stay 'pending' forever at the head of ORDER BY created_at, so loading
summaries before the dispatchability filters re-read the same dead rows around
the clock — measured at ~7 GB/month against a 5 GB Free-tier quota.
"""

import sys
from unittest.mock import MagicMock

# psycopg2 is only installed on the Pi; these tests never touch a real
# connection (they monkeypatch _q), so a stub is enough to import db_pg.
for _mod in ("psycopg2", "psycopg2.extras", "psycopg2.pool"):
    sys.modules.setdefault(_mod, MagicMock())

import db_pg  # noqa: E402


def _fake_q(calls):
    """Return a _q stub that records every SQL statement it is handed."""

    def _q(sql, params=None):
        calls.append(" ".join(sql.split()))
        if "FROM deliveries WHERE status='pending'" in " ".join(sql.split()):
            return [
                {"id": "d1", "user_id": "u1", "video_id": "v1",
                 "language": "fr", "platform": "telegram", "audio_required": True},
            ]
        if "video_title, channel_id, audio_url" in sql:
            return [{"video_id": "v1", "language": "fr", "video_title": "T",
                     "channel_id": "c1", "audio_url": "http://a/x.mp3"}]
        if "tts_voice" in sql:
            return [{"id": "u1", "tts_voice": None}]
        if "platform_connections" in sql:
            return CONNECTIONS
        if "language, summary" in sql:
            return [{"video_id": "v1", "language": "fr", "summary": "LE RESUME"}]
        return []

    return _q


CONNECTIONS: list = []


def _summary_queries(calls):
    return [c for c in calls if "summary" in c]


def test_no_summary_read_when_delivery_is_undispatchable(monkeypatch):
    """The leak scenario: delivery pending, but the user has no connection.

    It is filtered out and stays 'pending' forever — so it must cost zero
    summary reads, not one on every poll.
    """
    global CONNECTIONS
    CONNECTIONS = []  # user disconnected the platform
    calls: list[str] = []
    monkeypatch.setattr(db_pg, "_q", _fake_q(calls))

    assert db_pg.get_pending_deliveries(20) == []
    assert _summary_queries(calls) == [], (
        "an undispatchable delivery must not trigger a summary read"
    )


def test_summary_is_read_when_delivery_is_dispatchable(monkeypatch):
    """The normal path still returns the summary — TTS fallback depends on it."""
    global CONNECTIONS
    CONNECTIONS = [{"user_id": "u1", "platform": "telegram",
                    "external_id": "123", "credentials": {}}]
    calls: list[str] = []
    monkeypatch.setattr(db_pg, "_q", _fake_q(calls))

    out = db_pg.get_pending_deliveries(20)
    assert len(out) == 1
    assert out[0]["summary"] == "LE RESUME"
    assert len(_summary_queries(calls)) == 1


def test_empty_queue_costs_a_single_query(monkeypatch):
    """Idle queue — the common case — must stay at one cheap query."""
    calls: list[str] = []
    monkeypatch.setattr(db_pg, "_q", lambda sql, params=None: calls.append(sql) or [])

    assert db_pg.get_pending_deliveries(20) == []
    assert len(calls) == 1


def test_candidate_window_never_loads_summaries(monkeypatch):
    """The 5x-limit candidate scan must select metadata only, never summary."""
    global CONNECTIONS
    CONNECTIONS = []
    calls: list[str] = []
    monkeypatch.setattr(db_pg, "_q", _fake_q(calls))
    db_pg.get_pending_deliveries(20)

    window = [c for c in calls if "video_title" in c]
    assert window, "expected the metadata scan to run"
    for c in window:
        assert "summary" not in c, f"candidate window still pulls summary: {c}"
