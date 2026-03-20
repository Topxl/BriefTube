"""Supprime les anciens fichiers audio R2 dont toutes les livraisons sont envoyées.

À lancer UNE SEULE FOIS pour libérer l'espace R2 accumulé.
Après ça, le worker gère le nettoyage automatiquement toutes les 6h.

Usage:
    infisical run -- python cleanup_r2_audio.py
    infisical run -- python cleanup_r2_audio.py --dry-run
    infisical run -- python cleanup_r2_audio.py --days 7
"""

import argparse
import logging
import sys
from dotenv import load_dotenv

load_dotenv(override=True)

import db
import storage
from config import R2_PUBLIC_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def extract_key(audio_url: str) -> str:
    if R2_PUBLIC_URL and audio_url.startswith(R2_PUBLIC_URL.rstrip("/")):
        return audio_url[len(R2_PUBLIC_URL.rstrip("/")) + 1:]
    parts = audio_url.rsplit("/", 2)
    return "/".join(parts[-2:]) if len(parts) >= 2 else audio_url


def run(days: int = 7, dry_run: bool = False) -> None:
    if not storage.is_configured():
        logger.error("R2 non configuré — vérifie R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, etc.")
        sys.exit(1)

    label = "[DRY RUN] " if dry_run else ""
    total_deleted = 0
    batch = 0

    logger.info(f"{label}Nettoyage des fichiers R2 > {days} jours (toutes livraisons envoyées)...")

    while True:
        rows = db.get_stale_r2_urls(days=days, limit=100)
        if not rows:
            break

        batch += 1
        logger.info(f"{label}Batch {batch} : {len(rows)} fichiers")

        for row in rows:
            key = extract_key(row["audio_url"])
            logger.debug(f"  {key}")
            if not dry_run:
                storage.delete_audio(key)
                db.clear_audio_url(row["video_id"], row["language"])
            total_deleted += 1

        if len(rows) < 100:
            break  # Dernier batch

    logger.info(f"{label}Terminé — {total_deleted} fichiers supprimés")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nettoie les anciens fichiers audio R2")
    parser.add_argument("--dry-run", action="store_true", help="Affiche sans supprimer")
    parser.add_argument("--days", type=int, default=7, help="Âge minimum en jours (défaut: 7)")
    args = parser.parse_args()
    run(days=args.days, dry_run=args.dry_run)
