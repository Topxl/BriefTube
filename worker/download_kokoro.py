#!/usr/bin/env python3
"""Download Kokoro ONNX model files to worker/kokoro_models/.

Uses the int8 quantized model (~80 MB) — optimal for CPU inference.
Falls back gracefully if download fails (worker uses Edge TTS instead).

Model files:
    - kokoro-v1.0.int8.onnx  (~80 MB — quantized TTS model, fast on CPU)
    - voices-v1.0.bin        (  8 MB — voice embeddings)
"""

import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "kokoro_models"
MODELS_DIR.mkdir(exist_ok=True)

BASE_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

FILES = [
    ("kokoro-v1.0.int8.onnx", f"{BASE_URL}/kokoro-v1.0.int8.onnx", 80_000_000),
    ("voices-v1.0.bin",       f"{BASE_URL}/voices-v1.0.bin",        8_000_000),
]


def download(filename: str, url: str, expected_size: int) -> None:
    dest = MODELS_DIR / filename
    if dest.exists() and dest.stat().st_size > expected_size * 0.9:
        print(f"  {filename} already present — skipping")
        return

    print(f"  Downloading {filename} (~{expected_size // 1_000_000} MB)...")

    def progress(count, block_size, total_size):
        if total_size > 0:
            pct = min(100, count * block_size * 100 // total_size)
            print(f"\r  {pct}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print(f"\r  {filename} done ({dest.stat().st_size // 1_000_000} MB)    ")


if __name__ == "__main__":
    print(f"Downloading Kokoro models to {MODELS_DIR}\n")
    try:
        for name, url, size in FILES:
            download(name, url, size)
        print("\nKokoro models ready. Worker will use Kokoro TTS on next start.")
    except Exception as e:
        print(f"\nWarning: Kokoro download failed ({e})")
        print("Worker will use Edge TTS fallback — no action required.")
        sys.exit(0)  # Don't fail the deploy
