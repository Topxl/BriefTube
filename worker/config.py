import os
from pathlib import Path
from dotenv import load_dotenv

# override=True ensures .env file always takes precedence over exported shell variables,
# so the canonical source of truth is always the .env file.
load_dotenv(override=True)

# Base paths
BASE_DIR = Path(__file__).parent
AUDIO_DIR = BASE_DIR / "audio"
COOKIES_DIR = BASE_DIR / "cookies"

AUDIO_DIR.mkdir(exist_ok=True)
COOKIES_DIR.mkdir(exist_ok=True)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Telegram — main public bot (user-facing)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_TELEGRAM_CHAT_ID = os.getenv("ADMIN_TELEGRAM_CHAT_ID", "")

# Telegram — log bot (admin monitoring alerts only)
LOG_BOT_TOKEN = os.getenv("LOG_BOT_TOKEN", "")
LOG_BOT_ADMIN_CHAT_ID = os.getenv("LOG_BOT_ADMIN_CHAT_ID", "")

# Cloudflare R2 (audio storage — zero egress cost)
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "brieftube-audio")
# Public URL of the bucket (R2.dev domain or custom domain, no trailing slash)
# e.g. "https://pub-xxxx.r2.dev" or "https://audio.brief-tube.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")

# TTS (default voice, users can override in their profile)
DEFAULT_TTS_VOICE = os.getenv("TTS_VOICE", "fr-FR-DeniseNeural")

# RSS
RSS_CHECK_INTERVAL = int(os.getenv("RSS_CHECK_INTERVAL", "1800"))  # 30 minutes (WebSub handles real-time)

# Concurrent video processing (how many videos to process simultaneously)
MAX_CONCURRENT_VIDEOS = int(os.getenv("MAX_CONCURRENT_VIDEOS", "12"))

# Worker mode — "full" (scanner + processor + deliverer) or "processor" (processor only)
# Multiple "processor" instances can run in parallel on the same machine or different VPS.
WORKER_MODE = os.getenv("WORKER_MODE", "full")

# Instance ID for multi-processor deployments — used to offset the health check port.
# Instance 0 uses HEALTH_PORT, instance 1 uses HEALTH_PORT+1, etc.
WORKER_INSTANCE = int(os.getenv("WORKER_INSTANCE", "0"))

# Health check HTTP port (default 8080; processor instances use 8081, 8082, …)
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8080"))

# Resource throttling — worker pauses before starting a new video job when the
# system is under pressure. Three independent checks:
#   - CPU usage (1-second sample across all cores) > MAX_CPU_PERCENT
#   - 1-minute load average > CPU count × MAX_LOAD_PER_CPU  (default 0.9 = 90%)
#   - Available RAM < MIN_FREE_RAM_MB
# Set MAX_CPU_PERCENT=100 to disable CPU/load checks.
MAX_CPU_PERCENT    = int(os.getenv("MAX_CPU_PERCENT",    "80"))
MAX_LOAD_PER_CPU   = float(os.getenv("MAX_LOAD_PER_CPU", "0.9"))
MIN_FREE_RAM_MB    = int(os.getenv("MIN_FREE_RAM_MB",    "512"))

# How long (seconds) to wait between resource checks when throttling
CPU_CHECK_INTERVAL = float(os.getenv("CPU_CHECK_INTERVAL", "5.0"))

# Worker HTTP API — secret token protecting the /logs endpoint (admin panel remote access)
# Must match WORKER_API_SECRET in the Next.js env and in Infisical /worker secrets.
WORKER_API_SECRET = os.getenv("WORKER_API_SECRET", "")

# App
APP_URL = os.getenv("APP_URL", "https://brief-tube.com")

# Web Push — shared secret with the Next.js /api/push/send endpoint
PUSH_NOTIFY_SECRET = os.getenv("PUSH_NOTIFY_SECRET", "")

# WebSub (YouTube Push Notifications)
WEBSUB_SECRET = os.getenv("WEBSUB_SECRET", "")

# YouTube cookies (Netscape format) — helps with age-restricted / login-required
# videos, but does NOT bypass cloud IP blocks on the transcript API.
# Export via "Get cookies.txt LOCALLY" browser extension → worker/cookies/youtube.txt
YOUTUBE_COOKIES_FILE = COOKIES_DIR / "youtube.txt"

# HTTP/HTTPS proxy for YouTube transcript API requests.
# Cloud IPs are blocked by YouTube; routing through a residential proxy fixes this.
# Recommended: Webshare.io (~$3/month) or any HTTP proxy.
# Format: "http://user:pass@host:port" or "http://host:port"
YOUTUBE_PROXY_HTTP = os.getenv("YOUTUBE_PROXY_HTTP", "")
