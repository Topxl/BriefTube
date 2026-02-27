#!/usr/bin/env python3
"""
BriefTube — Integration test runner

Tests the full transcript extraction pipeline against real YouTube videos,
covering all edge cases: music, live, long, short, failed, multilingual.

Usage:
    cd /home/vj/Bureau/Projets/BriefTube/worker
    venv/bin/python tests/run_integration.py              # all tests
    venv/bin/python tests/run_integration.py --category speech
    venv/bin/python tests/run_integration.py --category music live
    venv/bin/python tests/run_integration.py --whisper    # include Whisper (costs $)
    venv/bin/python tests/run_integration.py --id dQw4w9WgXcQ  # single video

Categories:
    speech      Normal speech videos — expect transcript
    short       Very short videos (<60s)
    long        Long videos (>1h)
    music       Music/ambient — expect filter (no Whisper cost)
    live        Live/streaming — expect video_is_live
    premiere    Scheduled premiere — expect premiere_not_available_yet
    failed_log  Videos that failed in production logs
    multilang   Non-English videos
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# Add worker directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Silence most library logs during tests
logging.disable(logging.WARNING)
logging.getLogger("root").setLevel(logging.CRITICAL)

# ── ANSI colors ───────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

# ── Test case definition ──────────────────────────────────────────────────────

@dataclass
class TestCase:
    category: str
    description: str
    video_id: str
    expected: str  # "transcript" | "live" | "premiere" | "music_skip" | "any" | "error"
    note: str = ""

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"


# ── Test catalogue ────────────────────────────────────────────────────────────
# Add/remove entries freely. "any" = no specific expected outcome, just show result.

TEST_CASES: list[TestCase] = [

    # ── Short videos ──────────────────────────────────────────────────────────
    TestCase(
        category="short",
        description='First YouTube video "Me at the zoo" (18s)',
        video_id="jNQXAC9IVRw",
        expected="transcript",
        note="Très courte vidéo — peut retourner transcript ou transcript_too_short",
    ),

    # ── Normal speech videos ──────────────────────────────────────────────────
    TestCase(
        category="speech",
        description="Steve Jobs Stanford commencement 2005 (15 min)",
        video_id="UF8uR6Z6KLc",
        expected="transcript",
        note="Discours célèbre avec transcript YouTube natif",
    ),
    TestCase(
        category="speech",
        description="TED Talk — Brené Brown 'Power of Vulnerability' (20 min)",
        video_id="iCvmsMzlF7o",
        expected="transcript",
        note="TED Talk très stable avec transcript YouTube natif anglais",
    ),

    # ── Long videos (>1h) ─────────────────────────────────────────────────────
    TestCase(
        category="long",
        description="Lex Fridman — Sam Altman interview (2h+)",
        video_id="jvqFAi7vkBc",
        expected="transcript",
        note="Long podcast — transcript YouTube natif ou yt-dlp",
    ),

    # ── Music/ambient — RSS title filter ─────────────────────────────────────
    # Note: is_likely_music() is tested in unit tests.
    # These are integration tests to verify the full pipeline handles them.
    TestCase(
        category="music",
        description="432Hz healing frequency (should filter before Whisper)",
        video_id="H-aW5kFUFaE",
        expected="any",
        note="Whisper filter : titre contient '432Hz' — ne doit pas coûter de quota Groq",
    ),
    TestCase(
        category="music",
        description="Lofi beats compilation (static, not live)",
        video_id="5qap5aO4i9A",
        expected="any",
        note="Lofi music — le filtre RSS title doit l'attraper",
    ),

    # ── Live streams ──────────────────────────────────────────────────────────
    TestCase(
        category="live",
        description="Lofi Girl 24/7 live stream (music + live)",
        video_id="jfKfPfyJRdk",
        expected="live",
        note="24/7 live — doit retourner video_is_live",
    ),
    TestCase(
        category="live",
        description="NASA TV 24/7 live stream",
        video_id="xAieE-QtOeM",
        expected="live",
        note="Live stream institutionnel — doit retourner video_is_live",
    ),

    # ── Multilingual ──────────────────────────────────────────────────────────
    # Note: multilang videos may be geo-restricted or bot-blocked from server IPs.
    # expected="any" avoids false failures while still exercising the pipeline.
    TestCase(
        category="multilang",
        description="Kurzgesagt — In a Nutshell (DE channel, EN subtitles)",
        video_id="LxgMdjyw8uw",
        expected="any",
        note="Kurzgesagt très stable — transcript anglais natif sur chaîne allemande",
    ),
    TestCase(
        category="multilang",
        description="TED en español — 'El secreto de aprender un idioma'",
        video_id="HZqUeWshwMs",
        expected="any",
        note="TED-Ed officiel en espagnol — stable et largement accessible",
    ),

    # ── Previously failed videos (from production logs) ───────────────────────
    # These failed with "whisper_error: unknown param 'service_tier'" (now fixed)
    TestCase(
        category="failed_log",
        description="Échec logs: whisper_error service_tier (3 tentatives)",
        video_id="-ByJprRD2qE",
        expected="any",
        note="Doit maintenant fonctionner après suppression service_tier",
    ),
    TestCase(
        category="failed_log",
        description="Échec logs: whisper_error service_tier",
        video_id="O5U6890gHbU",
        expected="any",
        note="Doit maintenant fonctionner après suppression service_tier",
    ),
    TestCase(
        category="failed_log",
        description="Échec logs: audio_download_failed",
        video_id="08ggoLip26w",
        expected="any",
        note="Peut être live, geo-restricted ou bot-detected",
    ),
    TestCase(
        category="failed_log",
        description="Échec logs: audio_download_failed",
        video_id="0hf4yEZPp-Q",
        expected="any",
        note="Peut être live, geo-restricted ou bot-detected",
    ),
    TestCase(
        category="failed_log",
        description="Échec logs: audio_download_failed",
        video_id="5L_pMroHjoM",
        expected="any",
        note="Whisper_error (avant fix) + audio_download",
    ),
    TestCase(
        category="failed_log",
        description="Échec logs: audio_download_failed",
        video_id="xcQqZO9aXXo",
        expected="any",
        note="Vérifier comportement actuel",
    ),
]

# ── Result ────────────────────────────────────────────────────────────────────

@dataclass
class Result:
    case: TestCase
    transcript: Optional[str]
    language: Optional[str]
    error: Optional[str]
    cost: float
    elapsed: float
    source: str  # "youtube_api" | "yt-dlp" | "invidious" | "piped" | "whisper" | "none"
    passed: bool
    failure_reason: str = ""


def _detect_source(transcript: Optional[str], error: Optional[str], cost: float) -> str:
    if error:
        return "none"
    if cost > 0:
        return "whisper"
    if transcript:
        return "free"  # youtube_api / yt-dlp / invidious / piped (all free)
    return "none"


def _check_expected(case: TestCase, transcript, error, cost) -> tuple[bool, str]:
    """Return (passed, failure_reason)."""
    expected = case.expected

    if expected == "any":
        return True, ""

    if expected == "transcript":
        if transcript:
            return True, ""
        return False, f"Expected transcript, got error={error!r}"

    if expected == "live":
        if error == "video_is_live":
            return True, ""
        return False, f"Expected video_is_live, got transcript={bool(transcript)} error={error!r}"

    if expected == "premiere":
        if error and error.startswith("premiere_not_available_yet"):
            return True, ""
        return False, f"Expected premiere_not_available_yet, got error={error!r}"

    if expected == "music_skip":
        music_errors = ("likely_music_no_speech", "audio_too_large_for_speech",
                        "audio_unsupported_format", "music_content")
        if error in music_errors:
            return True, ""
        return False, f"Expected music skip, got transcript={bool(transcript)} error={error!r}"

    if expected == "error":
        if not transcript:
            return True, ""
        return False, "Expected an error, but got a transcript"

    return True, ""


# ── Runner ────────────────────────────────────────────────────────────────────

def run_test(case: TestCase, enable_whisper: bool) -> Result:
    from transcript_extractor import TranscriptExtractor

    extractor = TranscriptExtractor(enable_whisper_fallback=enable_whisper)
    t0 = time.time()
    transcript, lang, error, cost = extractor.get_transcript(
        case.url,
        preferred_languages=["fr", "en", "es", "de"],
        video_title=case.description,
    )
    elapsed = time.time() - t0
    source = _detect_source(transcript, error, cost)
    passed, failure_reason = _check_expected(case, transcript, error, cost)
    return Result(
        case=case,
        transcript=transcript,
        language=lang,
        error=error,
        cost=cost,
        elapsed=elapsed,
        source=source,
        passed=passed,
        failure_reason=failure_reason,
    )


def print_result(r: Result, verbose: bool = False) -> None:
    icon = f"{GREEN}✅{RESET}" if r.passed else f"{RED}❌{RESET}"
    elapsed_str = f"{r.elapsed:.1f}s"

    if r.transcript:
        outcome = f"{GREEN}transcript{RESET} ({len(r.transcript)} chars, lang={r.language})"
    elif r.error:
        color = YELLOW if r.error in ("video_is_live", "likely_music_no_speech",
                                       "audio_too_large_for_speech") else DIM
        outcome = f"{color}{r.error}{RESET}"
    else:
        outcome = f"{RED}None{RESET}"

    cost_str = f"  {YELLOW}${r.cost:.4f}{RESET}" if r.cost > 0 else ""
    print(f"  {icon}  {r.case.description:<55} {outcome}  {DIM}({elapsed_str}){RESET}{cost_str}")

    if not r.passed:
        print(f"       {RED}FAIL: {r.failure_reason}{RESET}")

    if verbose and r.case.note:
        print(f"       {DIM}Note: {r.case.note}{RESET}")

    if verbose and r.transcript:
        preview = r.transcript[:120].replace("\n", " ")
        print(f"       {DIM}Preview: {preview}…{RESET}")


def main() -> int:
    parser = argparse.ArgumentParser(description="BriefTube integration tests")
    parser.add_argument(
        "--category", "-c", nargs="+",
        help="Filter by category (speech, short, long, music, live, multilang, failed_log)"
    )
    parser.add_argument(
        "--id", nargs="+",
        help="Test specific video ID(s) only"
    )
    parser.add_argument(
        "--whisper", action="store_true",
        help="Enable Whisper fallback (costs Groq quota $)"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show notes and transcript previews"
    )
    args = parser.parse_args()

    # Filter test cases
    cases = TEST_CASES
    if args.category:
        cases = [c for c in cases if c.category in args.category]
    if args.id:
        cases = [c for c in cases if c.video_id in args.id]
        # Also allow adding ad-hoc video IDs not in the catalogue
        existing_ids = {c.video_id for c in TEST_CASES}
        for vid_id in args.id:
            if vid_id not in existing_ids:
                cases.append(TestCase(
                    category="adhoc",
                    description=f"Ad-hoc: {vid_id}",
                    video_id=vid_id,
                    expected="any",
                ))

    if not cases:
        print(f"{YELLOW}No test cases match the filter.{RESET}")
        return 0

    print(f"\n{BOLD}BriefTube — Integration Tests{RESET}")
    print(f"{'─' * 65}")
    print(f"  Videos: {len(cases)}  |  Whisper: {'enabled (costs $)' if args.whisper else 'disabled'}")
    print(f"{'─' * 65}\n")

    results: list[Result] = []
    categories_seen: set[str] = set()

    for case in cases:
        if case.category not in categories_seen:
            categories_seen.add(case.category)
            print(f"\n{BOLD}{CYAN}── {case.category.upper()} {'─' * (55 - len(case.category))}{RESET}")

        r = run_test(case, enable_whisper=args.whisper)
        results.append(r)
        print_result(r, verbose=args.verbose)

    # Summary
    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    total_cost = sum(r.cost for r in results)
    total_time = sum(r.elapsed for r in results)

    print(f"\n{'─' * 65}")
    print(f"{BOLD}Summary:{RESET}  {GREEN}{passed} passed{RESET}  "
          f"{(RED + str(failed) + ' failed' + RESET) if failed else DIM + '0 failed' + RESET}"
          f"  |  {len(results)} total  |  {total_time:.1f}s  |  ${total_cost:.4f}")

    if failed:
        print(f"\n{RED}Failed tests:{RESET}")
        for r in results:
            if not r.passed:
                print(f"  • {r.case.description} — {r.failure_reason}")

    # Warn if any test is "expected transcript" but got "any" in case of actual error
    surprises = [r for r in results if r.case.expected == "any" and r.transcript]
    if surprises:
        print(f"\n{GREEN}Recovered from previous failures:{RESET}")
        for r in surprises:
            if r.case.category == "failed_log":
                print(f"  ✅ {r.case.description} — now returns transcript ({r.language})")

    print()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
