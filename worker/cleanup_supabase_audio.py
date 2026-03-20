"""Supprime tous les fichiers du bucket audio Supabase Storage.

À lancer UNE SEULE FOIS sur le VPS pour libérer les 2.17 GB.
Les audio_url en DB ont déjà été mis à NULL via SQL avant d'exécuter ce script.

Usage:
    infisical run -- python cleanup_supabase_audio.py
    infisical run -- python cleanup_supabase_audio.py --dry-run
"""

import argparse
import logging
import time
from dotenv import load_dotenv

load_dotenv(override=True)

import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BUCKET = "audio"
FOLDER = "audio"       # sous-dossier dans le bucket : audio/videoId.mp3
BATCH_SIZE = 100       # Supabase Storage delete accepte jusqu'à 100 fichiers par appel


def run(dry_run: bool = False) -> None:
    sb = db.get_client()

    total_deleted = 0
    total_bytes = 0
    page = 0

    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Listage des fichiers dans {BUCKET}/{FOLDER}/...")

    while True:
        # Toujours lister depuis offset=0 : après chaque suppression les fichiers
        # restants remontent, un offset croissant en sauterait la moitié.
        files = sb.storage.from_(BUCKET).list(
            path=FOLDER,
            options={"limit": BATCH_SIZE, "offset": 0},
        )

        if not files:
            break

        # Les noms renvoyés sont relatifs au dossier — on reconstruit le chemin complet
        full_paths = [f"{FOLDER}/{f['name']}" for f in files]
        sizes = sum(f.get("metadata", {}).get("size", 0) for f in files if f.get("metadata"))

        page += 1
        logger.info(f"Batch {page} : {len(full_paths)} fichiers ({sizes / 1_048_576:.1f} MB)")

        if not dry_run:
            result = sb.storage.from_(BUCKET).remove(full_paths)
            if isinstance(result, list):
                total_deleted += len(full_paths)
                total_bytes += sizes
            else:
                logger.warning(f"Réponse inattendue : {result}")
        else:
            total_deleted += len(full_paths)
            total_bytes += sizes

        if len(files) < BATCH_SIZE:
            break  # Dernière page (ou vide)

        time.sleep(0.3)  # Éviter le rate limiting

    label = "[DRY RUN] " if dry_run else ""
    logger.info(
        f"{label}Terminé — {total_deleted} fichiers supprimés, "
        f"{total_bytes / 1_073_741_824:.2f} GB libérés"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vide le bucket audio Supabase Storage")
    parser.add_argument("--dry-run", action="store_true", help="Affiche ce qui serait supprimé sans agir")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
