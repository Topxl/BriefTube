#!/usr/bin/env python3
"""Download Kokoro ONNX model files to worker/kokoro_models/.

Run once on the VPS before starting the worker:
    python download_kokoro.py

Model files (~320 MB total):
    - kokoro-v1_0.onnx  (310 MB — the TTS model)
    - voices.bin        (  8 MB — voice embeddings)
"""

import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "kokoro_models"
MODELS_DIR.mkdir(exist_ok=True)

FILES = [
    (
        "kokoro-v1_0.onnx",
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1_0.onnx",
        310_000_000,
    ),
    (
        "voices.bin",
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices.bin",
        8_000_000,
    ),
]


def download(filename: str, url: str, expected_size: int) -> None:
    dest = MODELS_DIR / filename
    if dest.exists() and dest.stat().st_size > expected_size * 0.9:
        print(f"  {filename} already present — skipping")
        return

    print(f"  Downloading {filename} (~{expected_size // 1_000_000} MB)...")

    def progress(count, block_size, total_size):
        pct = min(100, count * block_size * 100 // total_size)
        print(f"\r  {pct}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print(f"\r  {filename} downloaded ({dest.stat().st_size // 1_000_000} MB)")


if __name__ == "__main__":
    print(f"Downloading Kokoro models to {MODELS_DIR}\n")
    for name, url, size in FILES:
        download(name, url, size)
    print("\nDone. Restart the worker to activate Kokoro TTS.")
