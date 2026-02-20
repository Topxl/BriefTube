#!/usr/bin/env python3
"""
Test complet du pipeline BriefTube avec vraies vidéos YouTube
Pipeline: YouTube URL → Transcript → Gemini 3 Summary (multilingue) → TTS → Audio
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))  # worker/ directory
from transcript_extractor import TranscriptExtractor
from gemini_api import GeminiSummarizer
from text_cleaner import clean_for_tts
import edge_tts

# Configuration
API_KEY = os.environ.get("GEMINI_API_KEY", "")
TTS_VOICE = os.environ.get("TTS_VOICE", "fr-FR-DeniseNeural")
OUTPUT_DIR = Path("test_pipeline_output")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if not API_KEY:
    print("❌ Set GEMINI_API_KEY first:")
    print("  export GEMINI_API_KEY=your_key_here")
    sys.exit(1)

# Créer le dossier de sortie
OUTPUT_DIR.mkdir(exist_ok=True)

# Vraies vidéos YouTube à tester (PODCASTS/CONFÉRENCES)
TEST_VIDEOS = [
    {
        "url": "https://www.youtube.com/watch?v=Ji8JeYIVwQo",
        "name": "ted_talk_body_language",
        "description": "TED Talk - Your body language may shape who you are",
        "target_lang": "fr"
    },
    {
        "url": "https://www.youtube.com/watch?v=ZJsocByDaJQ",
        "name": "python_tutorial",
        "description": "Python Tutorial for Beginners",
        "target_lang": "fr"
    },
    {
        "url": "https://www.youtube.com/watch?v=aircAruvnKk",
        "name": "neural_networks",
        "description": "3Blue1Brown - Neural Networks Explained",
        "target_lang": "fr"
    },
]

print("=" * 70)
print("🧪 TEST COMPLET DU PIPELINE BRIEFTUBE")
print("=" * 70)
print(f"✅ Extraction: youtube-transcript-api")
print(f"✅ Résumé: Gemini 3 Flash Preview (multilingue)")
print(f"✅ TTS: {TTS_VOICE}")
print(f"✅ Dossier: {OUTPUT_DIR}")
print(f"✅ Vidéos: {len(TEST_VIDEOS)}")
print("=" * 70)


async def generate_audio(text: str, output_file: Path, voice: str) -> bool:
    """Génère un fichier audio depuis du texte"""
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_file))
        return True
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return False


async def process_video(video_info: dict, index: int, gemini: GeminiSummarizer) -> dict:
    """Traite une vidéo complète: transcription → résumé → audio"""
    url = video_info["url"]
    name = video_info["name"]
    description = video_info["description"]
    target_lang = video_info["target_lang"]

    print(f"\n{'─' * 70}")
    print(f"📹 VIDEO {index + 1}/{len(TEST_VIDEOS)}: {description}")
    print(f"🔗 URL: {url}")
    print(f"🌍 Langue cible: {target_lang}")
    print(f"{'─' * 70}")

    result = {
        "name": name,
        "url": url,
        "description": description,
        "success": False,
        "transcript": None,
        "transcript_lang": None,
        "summary": None,
        "audio_file": None,
        "transcript_length": 0,
        "summary_length": 0,
        "audio_size": 0,
        "error": None
    }

    # Étape 1: Extraire la transcription
    print("⏳ Étape 1/3: Extraction de la transcription YouTube...")
    transcript, source_lang, error = TranscriptExtractor.get_transcript(
        url,
        preferred_languages=[target_lang, 'en', 'es', 'fr', 'de']
    )

    if not transcript:
        print(f"  ❌ Échec extraction: {error}")
        result["error"] = error

        if TranscriptExtractor.should_retry(error):
            print(f"  ⚠️  Cette vidéo devrait être réessayée plus tard")

        return result

    result["transcript"] = transcript
    result["transcript_lang"] = source_lang
    result["transcript_length"] = len(transcript)

    print(f"  ✅ Transcription extraite: {len(transcript)} caractères")
    print(f"  🌍 Langue détectée: {source_lang}")
    print(f"  📝 Aperçu: {transcript[:150]}...")

    # Étape 2: Résumer avec Gemini 3 (et traduire si nécessaire)
    print(f"\n⏳ Étape 2/3: Génération du résumé avec Gemini 3...")
    if source_lang == target_lang:
        print(f"  ℹ️  Même langue source et cible ({source_lang})")
    else:
        print(f"  🔄 Traduction {source_lang} → {target_lang}")

    summary, error = gemini.summarize(
        transcript=transcript,
        source_language=source_lang,
        target_language=target_lang,
        video_url=url
    )

    if not summary:
        print(f"  ❌ Échec résumé Gemini: {error}")
        result["error"] = error
        return result

    result["summary"] = summary
    result["summary_length"] = len(summary)

    print(f"  ✅ Résumé généré: {len(summary)} caractères")
    print(f"  📝 Aperçu: {summary[:200]}...")

    # Étape 3: Convertir en audio
    print(f"\n⏳ Étape 3/3: Conversion en audio (TTS)...")

    # Nettoyer le texte avant TTS (supprimer Markdown)
    clean_summary = clean_for_tts(summary)
    print(f"  🧹 Nettoyage Markdown: {len(summary)} → {len(clean_summary)} chars")

    audio_file = OUTPUT_DIR / f"{name}.mp3"

    success = await generate_audio(clean_summary, audio_file, TTS_VOICE)

    if success and audio_file.exists():
        file_size = audio_file.stat().st_size
        result["audio_file"] = str(audio_file)
        result["audio_size"] = file_size
        result["success"] = True

        print(f"  ✅ Audio généré: {audio_file}")
        print(f"  📊 Taille: {file_size / 1024:.1f} KB")
    else:
        print(f"  ❌ Échec génération audio")
        result["error"] = "tts_failed"
        return result

    # Sauvegarder aussi les fichiers texte
    # Transcription originale
    transcript_file = OUTPUT_DIR / f"{name}_transcript_{source_lang}.txt"
    with open(transcript_file, "w", encoding="utf-8") as f:
        f.write(f"Vidéo: {description}\n")
        f.write(f"URL: {url}\n")
        f.write(f"Langue: {source_lang}\n")
        f.write(f"{'=' * 70}\n\n")
        f.write(transcript)
    print(f"  💾 Transcription sauvegardée: {transcript_file}")

    # Résumé
    summary_file = OUTPUT_DIR / f"{name}_summary_{target_lang}.txt"
    with open(summary_file, "w", encoding="utf-8") as f:
        f.write(f"Vidéo: {description}\n")
        f.write(f"URL: {url}\n")
        f.write(f"Langue source: {source_lang}\n")
        f.write(f"Langue résumé: {target_lang}\n")
        f.write(f"{'=' * 70}\n\n")
        f.write(summary)
    print(f"  💾 Résumé sauvegardé: {summary_file}")

    return result


async def main():
    """Fonction principale"""
    # Initialize Gemini
    gemini = GeminiSummarizer(api_key=API_KEY)

    results = []

    # Traiter toutes les vidéos
    for i, video in enumerate(TEST_VIDEOS):
        result = await process_video(video, i, gemini)
        results.append(result)

    # Résumé final
    print(f"\n{'=' * 70}")
    print("📊 RÉSULTATS FINAUX")
    print("=" * 70)

    success_count = sum(1 for r in results if r["success"])
    total_transcript_chars = sum(r["transcript_length"] for r in results if r["transcript"])
    total_summary_chars = sum(r["summary_length"] for r in results if r["summary"])
    total_audio_size = sum(r["audio_size"] for r in results)

    print(f"\n✅ Vidéos traitées avec succès: {success_count}/{len(TEST_VIDEOS)}")
    print(f"📝 Total transcriptions: {total_transcript_chars:,} caractères")
    print(f"📝 Total résumés: {total_summary_chars:,} caractères")
    print(f"🔊 Total audio: {total_audio_size / 1024:.1f} KB")

    print(f"\n📂 Tous les fichiers dans: {OUTPUT_DIR.absolute()}/")

    print("\n📋 Détails par vidéo:")
    for r in results:
        if r["success"]:
            print(f"\n  ✅ {r['description']}")
            print(f"     Transcription: {r['transcript_length']:,} chars ({r['transcript_lang']})")
            print(f"     Résumé: {r['summary_length']:,} chars")
            print(f"     Audio: {r['audio_size'] / 1024:.1f} KB")
        else:
            print(f"\n  ❌ {r['description']}")
            print(f"     Erreur: {r['error']}")

    print(f"\n{'=' * 70}")
    print("🎧 COMMANDES POUR ÉCOUTER:")
    print("=" * 70)
    for r in results:
        if r["audio_file"]:
            print(f"  vlc {r['audio_file']}")

    print(f"\n{'=' * 70}")
    print("🌐 COMMANDES POUR VOIR LES VIDÉOS:")
    print("=" * 70)
    for r in results:
        print(f"  {r['url']}  # {r['description']}")

    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
