"""Regression tests: delivery audio must follow the delivery's language.

A user whose profile voice is French can receive a summary in another language
(the bot's Options menu lets them pick one per video). Reading that summary with
the profile voice produces unusable audio, and writing it to a file name without
the language lets two languages of the same video overwrite each other.
"""

import sys
from unittest.mock import MagicMock

# psycopg2 is only installed on the Pi and openai only when OpenRouter is used;
# these tests call a pure function, so stubs are enough to import main.
for _mod in ("psycopg2", "psycopg2.extras", "psycopg2.pool", "openai"):
    sys.modules.setdefault(_mod, MagicMock())
import main  # noqa: E402


def test_voice_follows_delivery_language_not_profile():
    voice, stem = main._delivery_audio_params(
        {"video_id": "vid1", "language": "th", "tts_voice": "fr-FR-DeniseNeural"}
    )
    assert voice == "th-TH-PremwadeeNeural"
    assert stem == "video_vid1_th"


def test_profile_voice_kept_when_language_matches():
    voice, _ = main._delivery_audio_params(
        {"video_id": "vid1", "language": "fr", "tts_voice": "fr-FR-HenriNeural"}
    )
    assert voice == "fr-FR-HenriNeural"


def test_default_voice_when_profile_has_none():
    voice, _ = main._delivery_audio_params(
        {"video_id": "vid1", "language": "ja", "tts_voice": None}
    )
    assert voice == "ja-JP-NanamiNeural"


def test_stem_separates_languages_of_the_same_video():
    _, fr_stem = main._delivery_audio_params({"video_id": "vid1", "language": "fr"})
    _, th_stem = main._delivery_audio_params({"video_id": "vid1", "language": "th"})
    assert fr_stem != th_stem


def test_missing_language_falls_back_to_french():
    voice, stem = main._delivery_audio_params({"video_id": "vid1"})
    assert voice == "fr-FR-DeniseNeural"
    assert stem == "video_vid1_fr"
