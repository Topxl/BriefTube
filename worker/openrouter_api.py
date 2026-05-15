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

    # USD per 1M tokens (input, output). Output prices approximated where not
    # explicitly listed — refresh from openrouter.ai/<model> page when needed.
    PRICING = {
        "google/gemini-2.5-flash-lite": {"input": 0.10, "output": 0.40},
        "google/gemini-2.0-flash-001":  {"input": 0.10, "output": 0.40},
        "openai/gpt-oss-120b":          {"input": 0.039, "output": 0.20},
        "deepseek/deepseek-v3.2":       {"input": 0.26, "output": 1.10},
    }

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
        length_pref: str = "auto",
        style_pref: str = "narrative",
        custom_instructions: str = "",
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[float]]:
        """Summarize transcript via OpenRouter. Same interface as GeminiSummarizer.

        Returns:
            (summary_text, error_message, model_used, cost_usd)
            model_used is prefixed with "openrouter:" so it's distinguishable from
            direct Gemini calls in the processed_videos.model_used column.
        """
        if not transcript or len(transcript.strip()) < 200:
            return None, "transcript_too_short", None, None

        prompt = build_summary_prompt(transcript, source_language, target_language, length_pref, style_pref, custom_instructions)
        transcript_words = len(transcript.split())
        max_tokens = get_max_tokens_for_length(length_pref, transcript_words)
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

                cost_usd: Optional[float] = None
                try:
                    usage = response.usage
                    in_tokens = getattr(usage, "prompt_tokens", 0) or 0
                    out_tokens = getattr(usage, "completion_tokens", 0) or 0
                    pricing = self.PRICING.get(model_name)
                    if pricing:
                        cost_usd = round(
                            (in_tokens / 1_000_000) * pricing["input"]
                            + (out_tokens / 1_000_000) * pricing["output"],
                            6,
                        )
                except Exception:
                    pass

                logger.info(
                    f"✅ [OpenRouter] Summary with {model_name}: {len(summary)} chars, "
                    f"cost=${cost_usd if cost_usd is not None else '?'}"
                )
                return summary, None, f"openrouter:{model_name}", cost_usd

            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = "429" in err_str or "rate" in err_str or "quota" in err_str
                if not is_rate_limit:
                    all_rate_limited = False
                logger.error(f"[OpenRouter] Failed with {model_name}: {e}")
                continue

        if all_rate_limited:
            return None, "rate_limited", None, None
        return None, "all_models_failed", None, None
