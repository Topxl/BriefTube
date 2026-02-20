"""
BriefTube Worker Monitoring System

Tracks worker statistics, formats logs, and exposes system info.
Alert delivery (MonitoringAlert) lives in bot_handler.py.
"""

import html as _html
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
import psutil

logger = logging.getLogger(__name__)

# ── Log formatting helpers (shared with log_bot.py and bot_handler.py) ────────

_MAX_TG_CHARS = 3900  # Telegram limit is 4096; keep some margin

# Matches: "2026-02-19 14:23:45,123 [logger.name] LEVEL message"
_LOG_RE = re.compile(
    r"\d{4}-\d{2}-\d{2} (\d{2}:\d{2}):\d{2},\d+ \[[^\]]+\] (\w+) (.*)"
)
_LEVEL_TAG = {
    "DEBUG": "DBG ",
    "INFO": "INFO",
    "WARNING": "WARN",
    "ERROR": "ERR!",
    "CRITICAL": "CRIT",
}


def format_log_line(line: str) -> str:
    """Format one raw log line as Telegram HTML.

    Input:  "2026-02-19 14:23:45,123 [worker] INFO [abc] Processing: title"
    Output: "14:23 INFO  [abc] Processing: title"
    Errors are <b>bold</b>, warnings <i>italic</i>.
    """
    line = line.rstrip()
    if not line.strip():
        return ""
    m = _LOG_RE.match(line)
    if not m:
        return _html.escape(line)
    time, level, message = m.groups()
    tag = _LEVEL_TAG.get(level, level[:4])
    safe = _html.escape(message)
    text = f"{time} {tag}  {safe}"
    if level in ("ERROR", "CRITICAL"):
        return f"<b>{text}</b>"
    if level == "WARNING":
        return f"<i>{text}</i>"
    return text


def format_log(raw: str) -> str:
    """Format a block of raw log text as HTML, truncated to Telegram limit."""
    lines = [format_log_line(line) for line in raw.splitlines()]
    lines = [line for line in lines if line]
    # Drop oldest lines until the text fits
    while lines and sum(len(line) + 1 for line in lines) > _MAX_TG_CHARS:
        lines.pop(0)
    return "\n".join(lines) or "(log empty)"


def _md_to_html(text: str) -> str:  # exported for bot_handler
    """Convert **bold** Markdown to HTML <b> tags and escape HTML special chars.

    Splits on '**', alternates plain/bold segments, HTML-escapes each part.
    Handles titles like "**Video processed**\\n\\nfoo" correctly.
    """
    parts = text.split("**")
    result = []
    for i, part in enumerate(parts):
        escaped = _html.escape(part)
        if i % 2 == 1:  # odd index = bold content
            result.append(f"<b>{escaped}</b>")
        else:
            result.append(escaped)
    return "".join(result)


# ── Statistics Storage ────────────────────────────────────────────

class WorkerStats:
    """Singleton class to track worker statistics."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self.start_time = datetime.now()

        # Counters
        self.videos_processed = 0
        self.videos_failed = 0
        self.rss_scans = 0
        self.new_videos_found = 0
        self.deliveries_sent = 0
        self.deliveries_failed = 0

        # Error tracking
        self.errors_by_type = {}
        self.last_errors = []  # List of (timestamp, error_message)
        self.max_errors_stored = 20

        # Performance
        self.last_video_time = None
        self.avg_processing_time = 0
        self.processing_times = []

        # Groq / Whisper usage (resets at midnight UTC each day)
        self.groq_seconds_today: float = 0.0
        self.groq_cost_today: float = 0.0
        self._groq_day = datetime.now(timezone.utc).date()
        # Alert thresholds already sent today (avoid spam)
        self.groq_alert_80_sent = False
        self.ip_block_alert_sent = False

    def record_video_processed(self, processing_time: float):
        """Record a successfully processed video."""
        self.videos_processed += 1
        self.last_video_time = datetime.now()
        self.processing_times.append(processing_time)
        if len(self.processing_times) > 100:
            self.processing_times.pop(0)
        self.avg_processing_time = sum(self.processing_times) / len(self.processing_times)

    def record_video_failed(self, error_type: str, error_message: str):
        """Record a failed video processing."""
        self.videos_failed += 1
        self.errors_by_type[error_type] = self.errors_by_type.get(error_type, 0) + 1
        self.last_errors.append((datetime.now(), error_message))
        if len(self.last_errors) > self.max_errors_stored:
            self.last_errors.pop(0)

    def record_rss_scan(self, new_videos: int):
        """Record an RSS scan."""
        self.rss_scans += 1
        self.new_videos_found += new_videos

    def record_delivery_sent(self):
        """Record a successful delivery."""
        self.deliveries_sent += 1

    def record_delivery_failed(self):
        """Record a failed delivery."""
        self.deliveries_failed += 1

    def record_groq_usage(self, audio_seconds: float, cost_usd: float) -> None:
        """Track Groq Whisper usage, auto-resetting daily at midnight UTC."""
        today = datetime.now(timezone.utc).date()
        if today != self._groq_day:
            self.groq_seconds_today = 0.0
            self.groq_cost_today = 0.0
            self._groq_day = today
            self.groq_alert_80_sent = False
            self.ip_block_alert_sent = False
        self.groq_seconds_today += audio_seconds
        self.groq_cost_today += cost_usd

    @property
    def groq_quota_pct(self) -> float:
        """Percentage of daily Groq free-tier quota used (limit: 28800s/day)."""
        return min(self.groq_seconds_today / 28800 * 100, 100.0)

    def get_uptime(self) -> str:
        """Get formatted uptime."""
        delta = datetime.now() - self.start_time
        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m {seconds}s"

    def get_summary(self) -> dict:
        """Get all statistics as a dictionary."""
        return {
            "uptime": self.get_uptime(),
            "start_time": self.start_time.isoformat(),
            "videos_processed": self.videos_processed,
            "videos_failed": self.videos_failed,
            "rss_scans": self.rss_scans,
            "new_videos_found": self.new_videos_found,
            "deliveries_sent": self.deliveries_sent,
            "deliveries_failed": self.deliveries_failed,
            "avg_processing_time": round(self.avg_processing_time, 2),
            "last_video_time": self.last_video_time.isoformat() if self.last_video_time else None,
            "errors_by_type": self.errors_by_type,
            "recent_errors": [
                {"time": t.isoformat(), "message": msg}
                for t, msg in self.last_errors[-5:]
            ],
            "groq_seconds_today": round(self.groq_seconds_today, 1),
            "groq_cost_today": round(self.groq_cost_today, 4),
            "groq_quota_pct": round(self.groq_quota_pct, 1),
        }


# Global instance
stats = WorkerStats()


# ── System Information ────────────────────────────────────────────

def get_system_info() -> dict:
    """Get system resource usage."""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "cpu_percent": round(cpu_percent, 1),
            "memory_percent": round(memory.percent, 1),
            "memory_used_mb": round(memory.used / 1024 / 1024, 1),
            "disk_percent": round(disk.percent, 1),
            "disk_free_gb": round(disk.free / 1024 / 1024 / 1024, 1),
        }
    except Exception as e:
        logger.error(f"Failed to get system info: {e}")
        return {}


def get_log_tail(lines: int = 50) -> str:
    """Get last N lines from worker.log."""
    log_file = Path(__file__).parent / "worker.log"

    try:
        with open(log_file, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            tail_lines = all_lines[-lines:]
            return "".join(tail_lines)
    except Exception as e:
        return f"Error reading logs: {e}"


