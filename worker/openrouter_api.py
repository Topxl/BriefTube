"""OpenRouter fallback summarizer — OpenAI-compatible API with cheap/large-context models.

Used as fallback when Gemini is rate-limited or unavailable.
OpenRouter provides access to many LLMs through a single OpenAI-compatible endpoint.
See: https://openrouter.ai/models
"""

import logging
import os
from typing import Optional, Tuple
from openai import OpenAI

from gemini_api import build_summary_prompt, get_max_tokens_for_length

logger = logging.getLogger(__name__)


class OpenRouterSummarizer:
    """Fallback summarizer via OpenRouter (OpenAI-compatible).

    Tries models in order, cheap and large-context first.
    Returns same (summary, error) tuple as GeminiSummarizer.
    """

    # Models ordered by cost/quality for summarization — verified March 2026
    # Source: openrouter.ai/rankings + /api/v1/models pricing
    MODELS = [
        "google/gemini-2.5-flash-lite",  # $0.10/1M in, 1M ctx — cheapest large-context
        "google/gemini-2.0-flash-001",   # $0.10/1M in, 1M ctx — proven reliable
        "openai/gpt-oss-120b",           # $0.039/1M in, 131k ctx — ultra cheap
        "deepseek/deepseek-v3.2",        # $0.26/1M in, 163k ctx — excellent multilingual
    ]

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not set")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://brief-tube.com",
                "X-Title": "BriefTube",
            },
        )
        logger.info("OpenRouter summarizer initialized")

    def summarize(
        self,
        transcript: str,
        source_language: Optional[str] = None,
        target_language: str = "fr",
        model: Optional[str] = None,
        length_pref: str = "standard",
        style_pref: str = "narrative",
        custom_instructions: str = "",
    ) -> Tuple[Optional[str], Optional[str]]:
        """Summarize transcript via OpenRouter. Same interface as GeminiSummarizer."""
        if not transcript or len(transcript.strip()) < 50:
            return None, "transcript_too_short"

        prompt = build_summary_prompt(transcript, source_language, target_language, length_pref, style_pref, custom_instructions)
        max_tokens = get_max_tokens_for_length(length_pref)
        models_to_try = [model] if model else self.MODELS
        all_rate_limited = True

        for model_name in models_to_try:
            try:
                logger.info(
                    f"[OpenRouter] Attempting with model: {model_name} "
                    f"(length_pref={length_pref}, max_tokens={max_tokens})"
                )
                response = self.client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.7,
                )
                summary = response.choices[0].message.content.strip()

                if len(summary) < 100:
                    logger.warning(f"[OpenRouter] Summary too short ({len(summary)} chars), trying next model")
                    continue

                logger.info(f"✅ [OpenRouter] Summary with {model_name}: {len(summary)} chars")
                return summary, None

            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = "429" in err_str or "rate" in err_str or "quota" in err_str
                if not is_rate_limit:
                    all_rate_limited = False
                logger.error(f"[OpenRouter] Failed with {model_name}: {e}")
                continue

        if all_rate_limited:
            return None, "rate_limited"
        return None, "all_models_failed"
