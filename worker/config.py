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

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_TELEGRAM_CHAT_ID = os.getenv("ADMIN_TELEGRAM_CHAT_ID", "")

# TTS (default voice, users can override in their profile)
DEFAULT_TTS_VOICE = os.getenv("TTS_VOICE", "fr-FR-DeniseNeural")

# RSS
RSS_CHECK_INTERVAL = int(os.getenv("RSS_CHECK_INTERVAL", "300"))  # 5 minutes

# Concurrent video processing (how many videos to process simultaneously)
MAX_CONCURRENT_VIDEOS = int(os.getenv("MAX_CONCURRENT_VIDEOS", "3"))

# App
APP_URL = os.getenv("APP_URL", "https://brief-tube.com")

# Gemini
COOKIES_FILE = COOKIES_DIR / "gemini_session.json"
BROWSER_PROFILE_DIR = COOKIES_DIR / "browser_profile"

# YouTube cookies (Netscape format) to bypass IP-based transcript API blocks.
# Export from your browser with the "Get cookies.txt LOCALLY" extension while
# logged into YouTube, then save to worker/cookies/youtube.txt.
YOUTUBE_COOKIES_FILE = COOKIES_DIR / "youtube.txt"
