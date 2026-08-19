FROM python:3.11-slim

WORKDIR /app

# System deps:
#   ffmpeg/ffprobe — audio re-encoding (telegram_deliverer, whisper_transcriber)
#                    and duration probing (main.py). The worker shells out to
#                    both binaries; without them TTS delivery fails at runtime.
#   curl           — container healthcheck against /health
#   ca-certificates — TLS to Supabase, Telegram, Gemini, R2
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Create runtime directories (audio output, YouTube cookies, transcript cache)
RUN mkdir -p audio cookies cache transcripts

# Health check HTTP server (config.py HEALTH_PORT, default 8080)
EXPOSE 8080

CMD ["python", "main.py"]
