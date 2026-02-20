#!/usr/bin/env python3
"""
Test: Can the NEW Gemini API (google-genai) summarize a YouTube video?
This uses the modern google.genai package with Gemini 3 support.
Usage: GEMINI_API_KEY=your_key python test_gemini_api_new.py
"""

import os
import sys
from google import genai
from google.genai import types

API_KEY = os.environ.get("GEMINI_API_KEY", "")

if not API_KEY:
    print("❌ Set GEMINI_API_KEY first:")
    print("  export GEMINI_API_KEY=your_key_here")
    print("  python test_gemini_api_new.py")
    sys.exit(1)

# Initialize client
client = genai.Client(api_key=API_KEY)

# Short, well-known video for testing
TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

print(f"\n🔍 Listing available Gemini models...")
try:
    models = client.models.list()
    gemini_models = [m.name for m in models if 'gemini' in m.name.lower()]
    print(f"✅ Found {len(gemini_models)} Gemini models:")
    for m in gemini_models[:15]:  # Show first 15
        print(f"  - {m}")
except Exception as e:
    print(f"⚠️  Could not list models: {e}")

print(f"\n{'=' * 50}")
print(f"Testing Gemini API with: {TEST_URL}")
print("=" * 50)

# Test with Gemini 3 Flash (latest)
print("\n--- Test 1: URL in text prompt (gemini-3-flash-preview) ---")
try:
    response = client.models.generate_content(
        model='gemini-3-flash-preview',
        contents=f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
    )
    text = response.text
    print(f"✅ Response length: {len(text)} chars")
    print(f"Preview: {text[:300]}...")
    print(f"\nFull response:\n{text}")
except Exception as e:
    print(f"❌ Failed with gemini-3-flash-preview: {e}")
    print("\n--- Trying Gemini 3 Pro ---")
    try:
        response = client.models.generate_content(
            model='gemini-3-pro-preview',
            contents=f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
        )
        text = response.text
        print(f"✅ Response length: {len(text)} chars")
        print(f"Preview: {text[:300]}...")
        print(f"\nFull response:\n{text}")
    except Exception as e2:
        print(f"❌ Gemini 3 Pro also failed: {e2}")
        print("\n--- Last resort: gemini-2.5-flash ---")
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
            )
            text = response.text
            print(f"✅ Response length: {len(text)} chars")
            print(f"Preview: {text[:300]}...")
            print(f"\nFull response:\n{text}")
        except Exception as e3:
            print(f"❌ All models failed: {e3}")

print("\n" + "=" * 50)
print("Done.")
