#!/usr/bin/env python3
"""
Test: Can the Gemini API summarize a YouTube video directly from its URL?
Usage: GEMINI_API_KEY=your_key python test_gemini_api.py
"""

import os
import sys
import google.generativeai as genai

API_KEY = os.environ.get("GEMINI_API_KEY", "")

if not API_KEY:
    print("❌ Set GEMINI_API_KEY first:")
    print("  export GEMINI_API_KEY=your_key_here")
    print("  python test_gemini_api.py")
    sys.exit(1)

genai.configure(api_key=API_KEY)

# List available models
print("\n🔍 Checking available Gemini models...")
try:
    models = genai.list_models()
    gemini_models = [m.name for m in models if 'gemini' in m.name.lower()]
    print(f"✅ Found {len(gemini_models)} Gemini models:")
    for m in gemini_models[:10]:  # Show first 10
        print(f"  - {m}")
except Exception as e:
    print(f"⚠️  Could not list models: {e}")

# Short, well-known video for testing
TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

print(f"\n{'=' * 50}")
print(f"Testing Gemini API with: {TEST_URL}")
print("=" * 50)

# Test 1: Direct URL in prompt with latest model (Gemini 3 - Feb 2026)
print("\n--- Test 1: URL in text prompt (gemini-3-flash-preview) ---")
try:
    # Using Gemini 3 Flash (latest generation, fast and powerful)
    model = genai.GenerativeModel("gemini-3-flash-preview")
    response = model.generate_content(
        f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
    )
    text = response.text
    print(f"✅ Response length: {len(text)} chars")
    print(f"Preview: {text[:300]}...")
    print(f"\nFull response:\n{text}")
except Exception as e:
    print(f"❌ Failed with gemini-3-flash-preview: {e}")
    print("\n--- Trying Gemini 3 Pro (slower but more powerful) ---")
    try:
        model = genai.GenerativeModel("gemini-3-pro-preview")
        response = model.generate_content(
            f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
        )
        text = response.text
        print(f"✅ Response length: {len(text)} chars")
        print(f"Preview: {text[:300]}...")
        print(f"\nFull response:\n{text}")
    except Exception as e2:
        print(f"❌ Gemini 3 Pro also failed: {e2}")
        print("\n--- Last resort: gemini-2.0-flash (deprecated March 31, 2026) ---")
        try:
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(
                f"Fais un résumé détaillé de cette vidéo YouTube: {TEST_URL}"
            )
            text = response.text
            print(f"✅ Response length: {len(text)} chars")
            print(f"Preview: {text[:300]}...")
            print(f"\nFull response:\n{text}")
        except Exception as e3:
            print(f"❌ All models failed: {e3}")

print("\n" + "=" * 50)
print("Done.")
