#!/usr/bin/env python3
"""
Comprehensive pipeline test across multiple video types and durations.

Tests:
  - Short video   (~5 min, EN → FR)
  - Medium video  (~10-20 min, EN → FR)
  - Long video    (~30+ min, EN → FR)
  - French video  (FR → FR, no translation)
  - Direct Whisper test (bypasses YouTube transcript API)

Usage:
  venv/bin/python test_pipeline_scenarios.py            # all scenarios
  venv/bin/python test_pipeline_scenarios.py --whisper  # Whisper-only test
  venv/bin/python test_pipeline_scenarios.py --id <YOUTUBE_ID>  # single video
"""

import argparse
import asyncio
import logging
import os
import sys
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))  # worker/ directory

# override=True ensures .env file takes precedence over exported shell variables
load_dotenv(override=True)

from transcript_extractor import TranscriptExtractor
from gemini_api import GeminiSummarizer
from text_cleaner import clean_for_tts
from tts_processor import text_to_audio

# All test audio files land here
TEST_OUTPUT_DIR = Path(__file__).parent / "test_outputs"
TEST_OUTPUT_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("test_scenarios")

# ── Test case definitions ────────────────────────────────────────────────────

@dataclass
class TestCase:
    name: str
    url: str
    language: str = "fr"
    force_whisper: bool = False  # bypass YouTube transcript API
    notes: str = ""
    tags: list[str] = field(default_factory=list)


TEST_CASES: list[TestCase] = [
    # ── English → French (YouTube transcript) ───────────────────────────────
    TestCase(
        name="3Blue1Brown — Neural Networks (19 min, EN→FR)",
        url="https://www.youtube.com/watch?v=aircAruvnKk",
        language="fr",
        tags=["english", "science", "medium"],
        notes="Well-known science channel with EN subtitles; tests EN→FR translation",
    ),
    TestCase(
        name="Kurzgesagt — Do Robots Deserve Rights? (7 min, EN→FR)",
        url="https://www.youtube.com/watch?v=DHyUYg8X31c",
        language="fr",
        tags=["english", "animation", "short"],
        notes="Short animated educational video with EN captions",
    ),
    TestCase(
        name="TED — Do schools kill creativity? (19 min, EN→FR)",
        url="https://www.youtube.com/watch?v=iG9CE55wbtY",
        language="fr",
        tags=["english", "talk", "medium"],
        notes="Most watched TED Talk — great for measuring summary quality",
    ),
    # ── French → French (no translation needed) ─────────────────────────────
    TestCase(
        name="France Inter — podcast court (FR→FR)",
        url="https://www.youtube.com/watch?v=J---aiyznGQ",  # Nyan Cat as placeholder
        language="fr",
        tags=["french", "podcast", "short"],
        notes=(
            "Placeholder — replace with any French YouTube video URL. "
            "Tests FR→FR path (no translation needed)."
        ),
    ),
]

# ── Whisper-specific test (no YouTube captions) ──────────────────────────────
# We bypass youtube-transcript-api entirely and call Groq Whisper directly.
# Using aircAruvnKk (3Blue1Brown) — confirmed downloadable by yt-dlp.
# force_whisper=True skips YouTube captions regardless of availability.
WHISPER_TEST_CASE = TestCase(
    name="Whisper fallback — 3Blue1Brown (19 min, force Groq)",
    url="https://www.youtube.com/watch?v=aircAruvnKk",
    language="fr",
    force_whisper=True,
    tags=["whisper", "fallback"],
    notes=(
        "Bypasses youtube-transcript-api and downloads audio → Groq Whisper. "
        "Proves Whisper path works even when YouTube captions exist."
        " Cost ~$0.008 for 19 min."
    ),
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _print_separator(char: str = "─", width: int = 72) -> None:
    print(char * width)


def _print_summary_block(summary: str, max_width: int = 70) -> None:
    """Print summary with word-wrapped indentation for readability."""
    wrapped = textwrap.fill(summary, width=max_width, initial_indent="   ", subsequent_indent="   ")
    print(wrapped)


def _transcript_method(cost: float) -> str:
    return "Groq Whisper (paid)" if cost > 0 else "YouTube captions (free)"


# ── Core test runner ──────────────────────────────────────────────────────────

async def run_test(
    case: TestCase,
    extractor: TranscriptExtractor,
    summarizer: GeminiSummarizer,
    idx: int,
    total: int,
) -> dict:
    """Run a single test case and return a result dict."""
    result = {
        "name": case.name,
        "success": False,
        "transcript_chars": 0,
        "transcript_words": 0,
        "transcript_method": "—",
        "transcript_cost": 0.0,
        "source_lang": "—",
        "summary_chars": 0,
        "summary_words": 0,
        "summary": "",
        "audio_path": None,
        "audio_size_kb": 0,
        "error": "",
    }

    print()
    _print_separator("═")
    print(f"  [{idx}/{total}] {case.name}")
    if case.notes:
        print(f"  Note: {case.notes}")
    print(f"  URL : {case.url}")
    print(f"  Lang: {case.language} | Force Whisper: {case.force_whisper}")
    _print_separator("═")

    # ── Step 1: Transcript ────────────────────────────────────────────────────
    print("\n[1/2] Extracting transcript…")

    if case.force_whisper:
        # Bypass YouTube transcript API — go directly to Whisper
        if not extractor.whisper_transcriber:
            result["error"] = "Whisper not available (check GROQ_API_KEY)"
            print(f"  SKIP: {result['error']}")
            return result
        transcript, source_lang, error, cost = await asyncio.to_thread(
            extractor._whisper_fallback,
            case.url,
            [case.language, "en", "fr"],
        )
    else:
        transcript, source_lang, error, cost = await asyncio.to_thread(
            extractor.get_transcript,
            case.url,
            [case.language, "fr", "en"],
        )

    if not transcript:
        result["error"] = f"Transcript failed: {error}"
        print(f"  FAIL: {result['error']}")
        return result

    word_count = len(transcript.split())
    result.update(
        transcript_chars=len(transcript),
        transcript_words=word_count,
        transcript_method=_transcript_method(cost),
        transcript_cost=cost,
        source_lang=source_lang or "unknown",
    )
    print(f"  OK  : {len(transcript)} chars / {word_count} words")
    print(f"  Lang: {source_lang}  |  Method: {result['transcript_method']}")
    if cost > 0:
        print(f"  Cost: ${cost:.4f}")

    # Show first 200 chars of transcript for sanity check
    print(f"\n  Transcript preview:")
    print(f"  {transcript[:200].replace(chr(10), ' ')}…")

    # ── Step 2: Summarize ─────────────────────────────────────────────────────
    print(f"\n[2/2] Generating Gemini summary ({case.language})…")

    summary, summary_error = await asyncio.to_thread(
        summarizer.summarize,
        transcript=transcript,
        source_language=source_lang,
        target_language=case.language,
        video_url=None,
    )

    if not summary:
        result["error"] = f"Summary failed: {summary_error}"
        print(f"  FAIL: {result['error']}")
        return result

    summary_words = len(summary.split())
    result.update(
        success=True,
        summary_chars=len(summary),
        summary_words=summary_words,
        summary=summary,
    )

    compression = summary_words / word_count * 100 if word_count else 0
    print(f"  OK  : {len(summary)} chars / {summary_words} words ({compression:.0f}% of original)")

    print(f"\n  ── Summary ─────────────────────────────────────────────────────")
    _print_summary_block(summary)
    print(f"  ────────────────────────────────────────────────────────────────")

    # ── Step 3: TTS audio ────────────────────────────────────────────────────
    print(f"\n[3/3] Generating TTS audio ({case.language})…")
    try:
        clean_summary = clean_for_tts(summary)
        # Slug the test name for a readable filename
        slug = "".join(c if c.isalnum() else "_" for c in case.name.lower())[:50].strip("_")
        audio_filename = f"test_{idx:02d}_{slug}"
        audio_path = TEST_OUTPUT_DIR / f"{audio_filename}.mp3"

        # Generate into test_outputs dir by temporarily patching the output
        communicate_path = await text_to_audio(
            clean_summary,
            voice=None,  # uses DEFAULT_TTS_VOICE from config
            output_filename=f"../{TEST_OUTPUT_DIR.name}/{audio_filename}",
        )

        if audio_path.exists():
            size_kb = audio_path.stat().st_size / 1024
            result["audio_path"] = audio_path
            result["audio_size_kb"] = size_kb
            print(f"  OK  : {audio_path.name} ({size_kb:.0f} KB)")
            print(f"  Play: vlc {audio_path}")
        else:
            # Fallback: check AUDIO_DIR
            from config import AUDIO_DIR
            fallback = AUDIO_DIR / f"{audio_filename}.mp3"
            if fallback.exists():
                size_kb = fallback.stat().st_size / 1024
                result["audio_path"] = fallback
                result["audio_size_kb"] = size_kb
                print(f"  OK  : {fallback.name} ({size_kb:.0f} KB)")
                print(f"  Play: vlc {fallback}")
            else:
                print(f"  WARN: audio file not found at expected path {audio_path}")
    except Exception as e:
        print(f"  WARN: TTS failed — {e}")

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(args: argparse.Namespace) -> None:
    print()
    _print_separator("═")
    print("  BRIEFTUBE PIPELINE SCENARIO TESTS")
    _print_separator("═")

    # Initialize components
    extractor = TranscriptExtractor(enable_whisper_fallback=True)
    if extractor.enable_whisper_fallback:
        print("  Whisper fallback: ENABLED (GROQ_API_KEY set)")
    else:
        print("  Whisper fallback: DISABLED (no GROQ_API_KEY)")

    try:
        summarizer = GeminiSummarizer()
        print("  Gemini summarizer: READY")
    except ValueError as e:
        print(f"  FATAL: {e}")
        sys.exit(1)

    # Choose which test cases to run
    if args.whisper:
        cases = [WHISPER_TEST_CASE]
    elif args.id:
        url = f"https://www.youtube.com/watch?v={args.id}"
        cases = [TestCase(name=f"Custom: {args.id}", url=url, language=args.lang)]
    else:
        cases = TEST_CASES[:]
        if args.include_whisper:
            cases.append(WHISPER_TEST_CASE)

    total = len(cases)
    results = []

    for i, case in enumerate(cases, start=1):
        try:
            result = await run_test(case, extractor, summarizer, i, total)
        except Exception as e:
            logger.error(f"Unexpected error for '{case.name}': {e}", exc_info=True)
            result = {"name": case.name, "success": False, "error": str(e)}
        results.append(result)

    # ── Final report ──────────────────────────────────────────────────────────
    print()
    _print_separator("═")
    print("  FINAL REPORT")
    _print_separator("═")

    ok = sum(1 for r in results if r.get("success"))
    fail = total - ok
    total_cost = sum(r.get("transcript_cost", 0) for r in results)

    print(f"  Total: {total} | OK: {ok} | FAIL: {fail} | Transcript cost: ${total_cost:.4f}")
    print()

    for r in results:
        status = "OK  " if r.get("success") else "FAIL"
        name = r["name"]
        if r.get("success"):
            audio_info = f" | Audio {r['audio_size_kb']:.0f} KB → vlc {r['audio_path']}" if r.get("audio_path") else ""
            print(
                f"  [{status}] {name}\n"
                f"         Transcript {r['transcript_words']} words ({r['transcript_method']}) "
                f"| Summary {r['summary_words']} words | Cost ${r['transcript_cost']:.4f}"
                f"{audio_info}"
            )
        else:
            print(f"  [{status}] {name}\n         Error: {r.get('error', 'unknown')}")
        print()

    _print_separator("═")
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BriefTube pipeline scenario tests")
    parser.add_argument("--whisper", action="store_true", help="Run Whisper-only test")
    parser.add_argument("--include-whisper", action="store_true", help="Add Whisper test to full suite")
    parser.add_argument("--id", metavar="VIDEO_ID", help="Test a specific YouTube video ID")
    parser.add_argument("--lang", default="fr", help="Target language (default: fr)")
    args = parser.parse_args()

    asyncio.run(main(args))
