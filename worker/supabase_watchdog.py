#!/usr/bin/env python3
"""Supabase auto-restart watchdog for BriefTube (Free "Nano" compute).

The Free-tier Nano Postgres periodically goes Unhealthy under load: the edge
(Kong/PostgREST) stays up but Postgres itself stops answering, so every query
times out. Supabase does NOT auto-recover this state — a manual "Restart
project" is required. This watchdog:

  1. Probes the database directly (psycopg2 SELECT 1).
  2. If it is unreachable for FAILS_BEFORE_RESTART consecutive runs, restarts
     the project via the Management API (POST /v1/projects/{ref}/restart).
  3. Waits for the DB to come back, then restarts the worker so it leaves its
     30-min "Supabase unreachable" backoff and resumes immediately.

A cooldown prevents restart loops, and a small state file tracks consecutive
failures so a single transient blip does not trigger a restart.

Run every ~5 min from cron via vps/run-watchdog.sh (Infisical injects secrets).

Required env:
  SUPABASE_DB_URL        pooler connection string (Infisical /worker)
  SUPABASE_ACCESS_TOKEN  Supabase Management API personal access token (sbp_...)
Optional env:
  SUPABASE_PROJECT_REF   project ref (default: the BriefTube project)
  WATCHDOG_FAILS_BEFORE_RESTART, WATCHDOG_COOLDOWN_MIN
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

_STATE_FILE = "/home/pi/.supabase-watchdog-state.json"
_PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "zetpgbrzehchzxodwbps")
_DB_URL = os.environ.get("SUPABASE_DB_URL", "")
_PAT = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
_FAILS_BEFORE_RESTART = int(os.environ.get("WATCHDOG_FAILS_BEFORE_RESTART", "2"))
_COOLDOWN_S = int(os.environ.get("WATCHDOG_COOLDOWN_MIN", "20")) * 60
_PROBE_ATTEMPTS = 3
_PROBE_TIMEOUT = 12


def _log(msg: str) -> None:
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [watchdog] {msg}", flush=True)


def _db_reachable() -> bool:
    """Return True if Postgres answers SELECT 1 within a few short attempts."""
    import psycopg2

    for i in range(_PROBE_ATTEMPTS):
        try:
            conn = psycopg2.connect(_DB_URL, connect_timeout=_PROBE_TIMEOUT)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            conn.close()
            return True
        except Exception as e:  # noqa: BLE001 — any failure means "not reachable now"
            _log(f"probe {i + 1}/{_PROBE_ATTEMPTS} failed: {type(e).__name__}: {str(e)[:120]}")
            if i < _PROBE_ATTEMPTS - 1:
                time.sleep(8)
    return False


def _load_state() -> dict:
    try:
        with open(_STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"consecutive_fails": 0, "last_restart": 0}


def _save_state(state: dict) -> None:
    try:
        with open(_STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:  # noqa: BLE001
        _log(f"could not save state (non-fatal): {e}")


def _trigger_restart() -> int:
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{_PROJECT_REF}/restart",
        method="POST",
        headers={"Authorization": f"Bearer {_PAT}", "Content-Type": "application/json"},
        data=b"{}",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status


def _bounce_worker() -> None:
    subprocess.run(["sudo", "systemctl", "restart", "brieftube-worker"], check=False)


def main() -> None:
    if not _DB_URL or not _PAT:
        _log("missing SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN — aborting")
        sys.exit(1)

    state = _load_state()

    if _db_reachable():
        if state.get("consecutive_fails", 0):
            _log("DB reachable again — clearing fail counter")
        state["consecutive_fails"] = 0
        _save_state(state)
        return

    # DB is down this run.
    state["consecutive_fails"] = state.get("consecutive_fails", 0) + 1
    _save_state(state)
    _log(f"DB unreachable (consecutive_fails={state['consecutive_fails']})")

    if state["consecutive_fails"] < _FAILS_BEFORE_RESTART:
        _log("waiting for one more confirmation before restarting")
        return

    now = time.time()
    if now - state.get("last_restart", 0) < _COOLDOWN_S:
        _log("within restart cooldown — not restarting again yet")
        return

    _log("triggering Supabase project restart via Management API...")
    try:
        status = _trigger_restart()
        _log(f"restart API returned HTTP {status}")
    except Exception as e:  # noqa: BLE001
        _log(f"restart API call failed: {e}")
        return

    state["last_restart"] = now
    state["consecutive_fails"] = 0
    _save_state(state)

    # Wait for the DB to come back, then bounce the worker so it leaves its
    # 30-min backoff and resumes immediately.
    for _ in range(15):  # up to ~5 min
        time.sleep(20)
        if _db_reachable():
            _log("DB back after restart — bouncing worker")
            _bounce_worker()
            return
    _log("DB still down ~5 min after restart — will re-check on next run")


if __name__ == "__main__":
    main()
