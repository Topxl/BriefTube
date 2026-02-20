#!/usr/bin/env python3
"""
Test complet du pipeline BriefTube avec Gemini 3 API + TTS
- Résumé de plusieurs vidéos YouTube avec Gemini 3
- Conversion en audio avec edge-tts
- Sauvegarde des fichiers audio pour écoute

Usage: GEMINI_API_KEY=your_key python test_full_pipeline.py
"""

import os
import sys
import asyncio
from pathlib import Path
from google import genai
import edge_tts

# Configuration
API_KEY = os.environ.get("GEMINI_API_KEY", "")
TTS_VOICE = os.environ.get("TTS_VOICE", "fr-FR-DeniseNeural")
OUTPUT_DIR = Path("test_audio_output")

if not API_KEY:
    print("❌ Set GEMINI_API_KEY first:")
    print("  export GEMINI_API_KEY=your_key_here")
    sys.exit(1)

# Créer le dossier de sortie
OUTPUT_DIR.mkdir(exist_ok=True)

# URLs de test (différentes chaînes et types de contenu)
TEST_VIDEOS = [
    {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "name": "rickroll",
        "description": "Rickroll classique"
    },
    {
        "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        "name": "me_at_the_zoo",
        "description": "Première vidéo YouTube (2005)"
    },
    {
        "url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
        "name": "gangnam_style",
        "description": "Gangnam Style - PSY"
    }
]

# Initialize Gemini client
client = genai.Client(api_key=API_KEY)

print("=" * 60)
print("🧪 TEST COMPLET DU PIPELINE BRIEFTUBE")
print("=" * 60)
print(f"✅ Modèle Gemini: gemini-3-flash-preview")
print(f"✅ Voix TTS: {TTS_VOICE}")
print(f"✅ Dossier de sortie: {OUTPUT_DIR}")
print(f"✅ Nombre de vidéos: {len(TEST_VIDEOS)}")
print("=" * 60)

async def generate_audio(text: str, output_file: Path) -> bool:
    """Génère un fichier audio depuis du texte avec edge-tts"""
    try:
        communicate = edge_tts.Communicate(text, TTS_VOICE)
        await communicate.save(str(output_file))
        return True
    except Exception as e:
        print(f"  ❌ Erreur TTS: {e}")
        return False

async def process_video(video_info: dict, index: int) -> dict:
    """Traite une vidéo complète: résumé + TTS"""
    url = video_info["url"]
    name = video_info["name"]
    description = video_info["description"]

    print(f"\n{'─' * 60}")
    print(f"📹 VIDEO {index + 1}/{len(TEST_VIDEOS)}: {description}")
    print(f"🔗 URL: {url}")
    print(f"{'─' * 60}")

    result = {
        "name": name,
        "url": url,
        "description": description,
        "success": False,
        "summary": None,
        "audio_file": None,
        "summary_length": 0,
        "audio_size": 0
    }

    # Étape 1: Générer le résumé avec Gemini 3
    print("⏳ Étape 1/2: Génération du résumé avec Gemini 3...")
    try:
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=f"Fais un résumé détaillé en français de cette vidéo YouTube: {url}"
        )
        summary = response.text
        result["summary"] = summary
        result["summary_length"] = len(summary)
        print(f"  ✅ Résumé généré: {len(summary)} caractères")
        print(f"  📝 Aperçu: {summary[:200]}...")
    except Exception as e:
        print(f"  ❌ Erreur Gemini: {e}")
        return result

    # Étape 2: Convertir en audio
    print("⏳ Étape 2/2: Conversion en audio (TTS)...")
    audio_file = OUTPUT_DIR / f"{name}.mp3"
    success = await generate_audio(summary, audio_file)

    if success and audio_file.exists():
        file_size = audio_file.stat().st_size
        result["audio_file"] = str(audio_file)
        result["audio_size"] = file_size
        result["success"] = True
        print(f"  ✅ Audio généré: {audio_file}")
        print(f"  📊 Taille: {file_size / 1024:.1f} KB")
    else:
        print(f"  ❌ Échec de la génération audio")

    return result

async def main():
    """Fonction principale"""
    results = []

    # Traiter toutes les vidéos
    for i, video in enumerate(TEST_VIDEOS):
        result = await process_video(video, i)
        results.append(result)

        # Sauvegarder aussi le résumé en texte
        if result["summary"]:
            txt_file = OUTPUT_DIR / f"{result['name']}_summary.txt"
            with open(txt_file, "w", encoding="utf-8") as f:
                f.write(f"Vidéo: {result['description']}\n")
                f.write(f"URL: {result['url']}\n")
                f.write(f"{'=' * 60}\n\n")
                f.write(result["summary"])
            print(f"  💾 Résumé texte sauvegardé: {txt_file}")

    # Résumé final
    print(f"\n{'=' * 60}")
    print("📊 RÉSULTATS FINAUX")
    print("=" * 60)

    success_count = sum(1 for r in results if r["success"])
    total_chars = sum(r["summary_length"] for r in results)
    total_audio_size = sum(r["audio_size"] for r in results)

    print(f"✅ Vidéos traitées avec succès: {success_count}/{len(TEST_VIDEOS)}")
    print(f"📝 Total de caractères générés: {total_chars:,}")
    print(f"🔊 Total taille audio: {total_audio_size / 1024:.1f} KB")
    print(f"\n📂 Tous les fichiers sont dans: {OUTPUT_DIR.absolute()}/")

    print("\n📋 Fichiers générés:")
    for r in results:
        if r["success"]:
            print(f"  🎵 {r['name']}.mp3 - {r['description']}")
            print(f"  📄 {r['name']}_summary.txt")

    print(f"\n{'=' * 60}")
    print("🎧 ÉCOUTE TES RÉSUMÉS:")
    print("=" * 60)
    for r in results:
        if r["audio_file"]:
            print(f"  mpv {r['audio_file']}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
