"""
Gemini API integration for video summarization with multilingual support
Uses google-genai (modern package) with Gemini 3
"""

import logging
import os
from typing import Optional, Tuple
from google import genai
from google.genai.types import GenerateContentConfig

logger = logging.getLogger(__name__)


class GeminiSummarizer:
    """
    Summarizes video transcripts using Gemini 3 API
    Supports automatic translation to user's preferred language
    """

    # Available models (ordered by preference)
    # Verify latest model names at: https://aistudio.google.com
    MODELS = [
        "gemini-3-flash-preview",  # Confirmed working
        "gemini-3-pro-preview",    # Higher quality (slower)
        "gemini-2.5-flash",        # Fallback
        "gemini-2.0-flash",        # Stable fallback
    ]

    # Language names for prompts
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

    def _get_language_name(self, lang_code: str) -> str:
        """Get full language name from code"""
        return self.LANGUAGE_NAMES.get(lang_code.lower(), lang_code)

    def summarize(
        self,
        transcript: str,
        source_language: Optional[str] = None,
        target_language: str = 'fr',
        model: Optional[str] = None
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

        Returns:
            Tuple of (summary_text, error_message)
        """
        if not transcript or len(transcript.strip()) < 50:
            return None, "transcript_too_short"

        # Build the prompt
        target_lang_name = self._get_language_name(target_language)

        # Determine target summary length based on transcript length.
        # Never ask for MORE words than the original — that forces hallucination.
        transcript_words = len(transcript.split())

        if transcript_words < 150:
            # Very short video — keep 60-80% of original, never exceed it
            min_words = max(30, int(transcript_words * 0.6))
            max_words = int(transcript_words * 0.9)
            length_guidance = f"environ {min_words}-{max_words} mots"
        elif transcript_words < 500:
            min_words = int(transcript_words * 0.4)
            max_words = int(transcript_words * 0.7)
            length_guidance = f"environ {min_words}-{max_words} mots"
        else:
            min_words = int(transcript_words * 0.25)
            max_words = int(transcript_words * 0.5)
            length_guidance = f"environ {min_words}-{max_words} mots"

        # Build prompt — no video URL: providing it lets Gemini use its training
        # knowledge about the video instead of strictly following the transcript.
        if source_language and source_language != target_language:
            source_lang_name = self._get_language_name(source_language)
            intro = (
                f"Tu es un assistant qui résume des vidéos YouTube.\n"
                f"La transcription ci-dessous provient d'une vidéo en {source_lang_name}.\n"
                f"Tu dois produire un résumé en {target_lang_name}.\n\n"
            )
        else:
            intro = (
                f"Tu es un assistant qui résume des vidéos YouTube.\n"
                f"Produis un résumé en {target_lang_name} de la transcription ci-dessous.\n\n"
            )

        prompt_parts = [
            intro,
            "RÈGLE ABSOLUE : base-toi UNIQUEMENT sur la transcription fournie. "
            "N'utilise aucune connaissance externe sur cette vidéo ou ce sujet. "
            "Si la transcription est ambiguë ou incomplète, résume ce qui est présent sans inventer.\n\n"
            "Instructions :\n"
            f"1. Résumé de {length_guidance} — ne dépasse pas cette limite\n"
            "2. Capture les points clés et idées principales de la transcription\n"
            "3. Évite les répétitions et le remplissage\n"
            "4. Ton naturel et direct, adapté à une écoute audio\n"
            f"5. Langue : {target_lang_name} obligatoire\n\n"
            f"Transcription :\n{transcript}\n\n"
            f"Résumé en {target_lang_name} ({length_guidance}) :"
        ]

        prompt = "".join(prompt_parts)

        # Try models in order
        models_to_try = [model] if model else self.MODELS

        for model_name in models_to_try:
            try:
                logger.info(f"Attempting summarization with model: {model_name}")

                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=GenerateContentConfig(
                        temperature=0.7,
                        max_output_tokens=4096,
                    )
                )

                summary = response.text.strip()

                if len(summary) < 100:
                    logger.warning(f"Summary too short ({len(summary)} chars), trying next model")
                    continue

                logger.info(
                    f"✅ Successfully generated summary with {model_name}: "
                    f"{len(summary)} chars"
                )

                return summary, None

            except Exception as e:
                logger.error(f"Failed with model {model_name}: {e}")
                # Try next model
                continue

        # All models failed
        return None, "all_models_failed"
