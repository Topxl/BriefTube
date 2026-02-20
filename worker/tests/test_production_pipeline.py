#!/usr/bin/env python3
"""
Test du pipeline de production complet
Simule le traitement d'une vidéo comme dans main.py
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))  # worker/ directory
from transcript_extractor import TranscriptExtractor
from gemini_api import GeminiSummarizer
from text_cleaner import clean_for_tts
from tts_processor import text_to_audio

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s %(message)s'
)
logger = logging.getLogger("test")

# Vidéo de test (vraie vidéo YouTube avec transcription)
TEST_VIDEO = {
    "video_id": "test_001",
    "youtube_url": "https://www.youtube.com/watch?v=aircAruvnKk",  # 3Blue1Brown
    "video_title": "3Blue1Brown - Neural Networks",
    "user_language": "fr",
    "tts_voice": "fr-FR-DeniseNeural"
}

async def test_production_pipeline():
    """Test complet du pipeline de production"""

    print("=" * 70)
    print("🧪 TEST DU PIPELINE DE PRODUCTION")
    print("=" * 70)

    video_id = TEST_VIDEO["video_id"]
    youtube_url = TEST_VIDEO["youtube_url"]
    video_title = TEST_VIDEO["video_title"]
    user_language = TEST_VIDEO["user_language"]
    tts_voice = TEST_VIDEO["tts_voice"]

    try:
        # Initialize components (comme dans main.py)
        transcript_extractor = TranscriptExtractor(enable_whisper_fallback=True)
        logger.info("✅ Transcript extractor initialized (YouTube + Groq fallback)")

        gemini_summarizer = GeminiSummarizer()
        logger.info("✅ Gemini 3 API summarizer initialized")

        print("\n" + "─" * 70)
        print(f"📹 Processing: {video_title}")
        print(f"🔗 URL: {youtube_url}")
        print(f"🌍 User language: {user_language}")
        print("─" * 70)

        # Step 1: Extract transcript
        print("\n⏳ Step 1/4: Extracting transcript...")
        transcript, source_lang, error, transcript_cost = await asyncio.to_thread(
            transcript_extractor.get_transcript,
            youtube_url,
            preferred_languages=[user_language, 'fr', 'en']
        )

        if not transcript:
            print(f"❌ Transcript extraction failed: {error}")
            if TranscriptExtractor.should_retry(error):
                print("⚠️  Should retry later")
            return False

        print(f"✅ Transcript: {len(transcript)} chars")
        print(f"   Language: {source_lang}")
        print(f"   Cost: ${transcript_cost:.4f}")
        print(f"   Method: {'YouTube (FREE)' if transcript_cost == 0 else 'Groq Whisper (PAID)'}")

        # Step 2: Summarize with Gemini 3
        print("\n⏳ Step 2/4: Generating summary with Gemini 3...")
        summary, summary_error = await asyncio.to_thread(
            gemini_summarizer.summarize,
            transcript=transcript,
            source_language=source_lang,
            target_language=user_language,
            video_url=youtube_url
        )

        if not summary:
            print(f"❌ Summary generation failed: {summary_error}")
            return False

        print(f"✅ Summary: {len(summary)} chars")
        if source_lang != user_language:
            print(f"   Translated: {source_lang} → {user_language}")

        # Step 3: Clean for TTS
        print("\n⏳ Step 3/4: Cleaning text for TTS...")
        clean_summary = clean_for_tts(summary)
        removed_chars = len(summary) - len(clean_summary)
        print(f"✅ Cleaned: {len(summary)} → {len(clean_summary)} chars")
        print(f"   Removed: {removed_chars} chars of Markdown formatting")

        # Step 4: Generate audio
        print("\n⏳ Step 4/4: Generating audio with TTS...")
        audio_path = await text_to_audio(
            clean_summary,
            voice=tts_voice,
            output_filename=f"production_test_{video_id}"
        )

        if not audio_path or not audio_path.exists():
            print("❌ Audio generation failed")
            return False

        file_size = audio_path.stat().st_size / 1024
        print(f"✅ Audio generated: {audio_path}")
        print(f"   Size: {file_size:.1f} KB")

        # Summary
        print("\n" + "=" * 70)
        print("📊 PIPELINE TEST RESULTS")
        print("=" * 70)
        print(f"✅ Transcript extraction: SUCCESS ({source_lang}, ${transcript_cost:.4f})")
        print(f"✅ Gemini 3 summary: SUCCESS ({len(summary)} chars)")
        print(f"✅ Text cleaning: SUCCESS (-{removed_chars} chars)")
        print(f"✅ TTS audio: SUCCESS ({file_size:.1f} KB)")
        print("=" * 70)
        print("\n🎧 Listen to the result:")
        print(f"   vlc {audio_path}")
        print("=" * 70)

        return True

    except Exception as e:
        logger.error(f"Pipeline test failed: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = asyncio.run(test_production_pipeline())
    exit(0 if success else 1)
