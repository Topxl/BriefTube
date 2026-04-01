"""
Gemini API integration for video summarization with multilingual support
Uses google-genai (modern package) with Gemini 3
"""

import logging
import os
from typing import Optional, Tuple
from google import genai
from google.genai.types import GenerateContentConfig, ThinkingConfig

logger = logging.getLogger(__name__)


# Language names for prompts — shared with OpenRouter
LANGUAGE_NAMES = {
    'fr': 'français',
    'en': 'English',
    'es': 'español',
    'de': 'Deutsch',
    'it': 'italiano',
    'pt': 'português',
    'nl': 'Nederlands',
    'pl': 'polski',
    'ru': 'русский',
    'ja': '日本語',
    'ko': '한국어',
    'zh': '中文',
    'ar': 'العربية',
    'hi': 'हिन्दी',
    'tr': 'Türkçe',
}


def _style_instruction(style_pref: str) -> str:
    """Return prompt instruction line for the requested summary style."""
    if style_pref == 'key_points':
        return (
            "4. Structure as a clear list of key points with the main takeaways. "
            "Use short, punchy sentences suitable for audio listening.\n"
        )
    if style_pref == 'actionable':
        return (
            "4. Focus on actionable insights: what can the listener do with this information? "
            "Highlight practical advice, tips, and concrete steps. Direct and useful tone.\n"
        )
    # Default: narrative
    return "4. Natural and direct tone, suitable for audio listening.\n"


def build_summary_prompt(
    transcript: str,
    source_language: Optional[str] = None,
    target_language: str = 'fr',
    length_pref: str = 'standard',
    style_pref: str = 'narrative',
    custom_instructions: str = '',
) -> str:
    """Build the prompt for summarization.

    Shared between Gemini and OpenRouter for consistency.

    Args:
        transcript: Full video transcript text
        source_language: Language code of the transcript (e.g., 'en', 'fr')
        target_language: Desired language for the summary (default: 'fr')
        length_pref: User preference for summary length ('brief', 'standard', 'detailed')
        style_pref: User preference for summary style ('key_points', 'narrative', 'actionable')

    Returns:
        The complete prompt string
    """
    target_lang_name = LANGUAGE_NAMES.get(target_language.lower(), target_language)

    # Determine target summary length based on transcript length and user preference.
    # Never ask for MORE words than the original — that forces hallucination.
    # Hard cap at AUDIO_MAX_WORDS: beyond this, Gemini would be truncated by
    # max_output_tokens (4096 ≈ 3000 words) producing a cut mid-sentence.
    LENGTH_CAPS = {
        'brief': 300,       # ~1-2 min at normal speech rate
        'standard': 800,    # ~4-5 min
        'detailed': 1200,   # ~6-8 min
    }
    AUDIO_MAX_WORDS = LENGTH_CAPS.get(length_pref, 800)
    transcript_words = len(transcript.split())

    if transcript_words < 150:
        # Very short video — keep 60-80% of original, never exceed it
        min_words = max(30, int(transcript_words * 0.6))
        max_words = int(transcript_words * 0.9)
    elif transcript_words < 500:
        min_words = int(transcript_words * 0.4)
        max_words = int(transcript_words * 0.7)
    else:
        min_words = int(transcript_words * 0.25)
        max_words = int(transcript_words * 0.5)

    # Apply audio cap — prevent requesting more words than Gemini can output
    min_words = min(min_words, AUDIO_MAX_WORDS)
    max_words = min(max_words, AUDIO_MAX_WORDS)
    length_guidance = f"about {min_words}-{max_words} words"

    # Long-content flag: transcript > ~30 min (4500 words) → instruct Gemini
    # to be selective rather than exhaustive
    is_long_content = transcript_words > 4500

    # Build prompt — no video URL: providing it lets Gemini use its training
    # knowledge about the video instead of strictly following the transcript.
    if source_language and source_language != target_language:
        source_lang_name = LANGUAGE_NAMES.get(source_language.lower(), source_language)
        intro = (
            f"You are an assistant that summarizes YouTube videos.\n"
            f"The transcript below comes from a video in {source_lang_name}.\n"
            f"You must produce the summary in {target_lang_name}.\n\n"
        )
    else:
        intro = (
            f"You are an assistant that summarizes YouTube videos.\n"
            f"Produce a summary in {target_lang_name} of the transcript below.\n\n"
        )

    selectivity_instruction = (
        "2. This transcript is long: be highly selective. "
        "Retain only the key insights, important decisions, and main conclusions. "
        "Discard digressions, minor anecdotes, ads, and repetitions.\n"
        if is_long_content
        else "2. Capture the key points and main ideas from the transcript.\n"
    )

    prompt_parts = [
        intro,
        "ABSOLUTE RULE: base yourself ONLY on the provided transcript. "
        "Do not use any external knowledge about this video or topic. "
        "If the transcript is ambiguous or incomplete, summarize what is present without inventing.\n\n"
        "Instructions:\n"
        f"1. Summary of {length_guidance} — NEVER exceed this limit\n"
        + selectivity_instruction +
        "3. Avoid repetitions and filler.\n"
        + _style_instruction(style_pref) +
        f"5. Output language: {target_lang_name} — mandatory\n"
    ]

    # Inject user custom instructions if provided (max 500 chars, treated as hints)
    cleaned = custom_instructions.strip()[:500] if custom_instructions else ""
    if cleaned:
        prompt_parts.append(
            f"6. Additional user preferences (apply as best you can without "
            f"contradicting the rules above): {cleaned}\n"
        )

    prompt_parts.append(
        f"\nTranscript:\n{transcript}\n\n"
        f"Summary in {target_lang_name} ({length_guidance}):"
    )

    return "".join(prompt_parts)


class GeminiSummarizer:
    """
    Summarizes video transcripts using Gemini 3 API
    Supports automatic translation to user's preferred language
    """

    # Available models (ordered by preference)
    # gemini-2.5-flash: 1M context, $0.15/M input — best cost/quality for summaries
    # gemini-3 preview models removed: free-tier only (20 req/day), not pay-as-you-go
    MODELS = [
        "gemini-2.5-flash",        # Primary — 1M context, cheap, fast
        "gemini-2.0-flash",        # Stable fallback
    ]

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini API client

        Args:
            api_key: Google AI API key (if None, reads from GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY must be provided or set in environment")

        self.client = genai.Client(api_key=self.api_key)
        logger.info("Gemini API client initialized")

    def summarize(
        self,
        transcript: str,
        source_language: Optional[str] = None,
        target_language: str = 'fr',
        model: Optional[str] = None,
        length_pref: str = 'standard',
        style_pref: str = 'narrative',
        custom_instructions: str = '',
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Summarize a video transcript and translate to target language.

        The video URL is intentionally NOT passed to Gemini: providing it lets
        the model use its training knowledge about the video instead of strictly
        following the transcript, which causes hallucinations.

        Args:
            transcript: Full video transcript text
            source_language: Language code of the transcript (e.g., 'en', 'fr')
            target_language: Desired language for the summary (default: 'fr')
            model: Optional specific model to use (default: tries models in order)
            length_pref: User preference for summary length ('brief', 'standard', 'detailed')
            style_pref: User preference for summary style ('key_points', 'narrative', 'actionable')
            custom_instructions: Free-text user instructions (max 500 chars)

        Returns:
            Tuple of (summary_text, error_message)
        """
        if not transcript or len(transcript.strip()) < 50:
            return None, "transcript_too_short"

        prompt = build_summary_prompt(transcript, source_language, target_language, length_pref, style_pref, custom_instructions)

        # Try models in order
        models_to_try = [model] if model else self.MODELS

        all_rate_limited = True  # Tracks whether every failure was a 429/quota error

        for model_name in models_to_try:
            try:
                logger.info(f"Attempting summarization with model: {model_name}")

                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=GenerateContentConfig(
                        temperature=0.7,
                        # Thinking tokens count against max_output_tokens in
                        # Gemini 2.5 Flash, so they eat into the response budget
                        # and truncate summaries mid-sentence.
                        # Summarization needs no complex reasoning → disable it.
                        thinking_config=ThinkingConfig(thinking_budget=0),
                        max_output_tokens=8192,
                    )
                )

                summary = response.text.strip()

                # Warn if Gemini stopped due to token limit — output is truncated
                try:
                    finish_reason = response.candidates[0].finish_reason
                    if finish_reason and finish_reason.name == "MAX_TOKENS":
                        logger.warning(
                            f"Gemini hit MAX_TOKENS on {model_name} — summary may be "
                            f"truncated ({len(summary)} chars). Increase max_output_tokens "
                            f"or reduce transcript length."
                        )
                except Exception:
                    pass

                if len(summary) < 100:
                    logger.warning(f"Summary too short ({len(summary)} chars), trying next model")
                    continue

                logger.info(
                    f"✅ Successfully generated summary with {model_name}: "
                    f"{len(summary)} chars"
                )

                return summary, None

            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = (
                    "429" in err_str
                    or "resource_exhausted" in err_str
                    or "quota" in err_str
                    or "rate" in err_str
                )
                if not is_rate_limit:
                    all_rate_limited = False
                logger.error(f"Failed with model {model_name}: {e}")
                continue

        # All models failed — distinguish transient rate limits from hard failures
        if all_rate_limited:
            return None, "rate_limited"
        return None, "all_models_failed"
