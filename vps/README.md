# BriefTube — Infrastructure VPS

## Serveur

| Paramètre   | Valeur                        |
|-------------|-------------------------------|
| Hébergeur   | Hetzner Cloud                 |
| Type        | CCX23 (4 vCPU AMD dédiés, 16 GB RAM) |
| OS          | Ubuntu 24.04                  |
| Région      | Nuremberg, Allemagne (eu-central) |
| IP          | 138.199.220.195               |
| Prix        | ~$26.49/mois                  |

---

## Setup initial (à faire une seule fois)

### 1. Prérequis — clé SSH locale

```bash
# Vérifier si une clé existe
ls ~/.ssh/*.pub

# Si aucune clé, en générer une
ssh-keygen -t ed25519 -C "mon-laptop"
cat ~/.ssh/id_ed25519.pub
```

Colle la clé publique dans Hetzner → **Security → SSH Keys → Add SSH Key**.

### 2. Créer le VPS sur Hetzner

- Type : **CCX23** (Dedicated CPU, AMD)
- Location : **Nuremberg** ou **Falkenstein**
- Image : **Ubuntu 24.04**
- SSH key : ta clé publique locale
- Firewalls/Volumes : non

### 3. Lancer le script de setup

```bash
# Copier le script sur le VPS
scp vps/setup.sh root@VPS_IP:/tmp/setup.sh

# Lancer en mode interactif (le -t est obligatoire pour les prompts)
ssh -t root@VPS_IP "bash /tmp/setup.sh"
```

Le script va faire une pause 3 fois pour te demander :

1. **Deploy key GitHub** → copie la clé affichée → ajoute-la sur
   `https://github.com/Topxl/BriefTube/settings/keys/new` (Read-only) → Entrée
2. **Client ID Infisical** → `https://app.infisical.com → Access Control → Machine Identities`
3. **Client Secret Infisical** → visible une seule fois à la création

### 4. Ajouter les secrets GitHub Actions

```bash
# Depuis ta machine locale (gh CLI doit être authentifié)
DEPLOY_KEY=$(ssh root@VPS_IP "cat /home/brieftube/.ssh/deploy_key")
echo "${DEPLOY_KEY}" | gh secret set VPS_SSH_KEY --repo Topxl/BriefTube
echo "VPS_IP" | gh secret set VPS_HOST --repo Topxl/BriefTube
```

Ou manuellement sur `https://github.com/Topxl/BriefTube/settings/secrets/actions` :
- `VPS_HOST` = l'IP du VPS
- `VPS_SSH_KEY` = contenu de `/home/brieftube/.ssh/deploy_key` (clé privée entière)

### 5. Uploader les cookies YouTube (optionnel)

```bash
scp worker/cookies/youtube.txt root@VPS_IP:/home/brieftube/app/worker/cookies/
ssh root@VPS_IP "chown brieftube:brieftube /home/brieftube/app/worker/cookies/youtube.txt"
```

---

## Architecture du worker

Le worker a deux modes :

| Mode        | Variable                    | Rôle                                                    |
|-------------|-----------------------------|---------------------------------------------------------|
| `full`      | `WORKER_MODE=full` (défaut) | RSS scanner + Bot Telegram + traitement vidéo           |
| `processor` | `WORKER_MODE=processor`     | Traitement vidéo uniquement (pas de bot, pas de RSS)    |

**Règle : un seul worker `full` à la fois** (conflit Telegram sinon).
Les workers `processor` peuvent tourner en parallèle sur n'importe quelle machine.

---

## Déploiement automatique (GitHub Actions)

Le workflow `.github/workflows/deploy-worker.yml` se déclenche automatiquement sur chaque push `main` qui touche `worker/` ou `vps/`.

Il exécute sur le VPS :
1. `git pull origin main`
2. `pip install -r worker/requirements.txt`
3. `systemctl daemon-reload`
4. `systemctl restart brieftube-worker`

Pour déclencher manuellement :
```bash
gh workflow run deploy-worker.yml --repo Topxl/BriefTube
```

---

## Commandes utiles sur le VPS

```bash
# Se connecter
ssh root@138.199.220.195

# Logs en direct
tail -f /home/brieftube/app/worker/worker.log

# Logs systemd
journalctl -u brieftube-worker -f

# Status
systemctl status brieftube-worker

# Restart
systemctl restart brieftube-worker
```

---

## Lancer un worker processor en local

Utile pour augmenter la capacité de traitement sans toucher au bot ni au RSS.

### Via systemd (recommandé)

Le service `brieftube-worker` est installé localement avec l'override suivant :

```ini
# /etc/systemd/system/brieftube-worker.service.d/override.conf
[Service]
Environment="MAX_CONCURRENT_VIDEOS=3"
Environment="WORKER_MODE=processor"
Environment="WORKER_INSTANCE=1"
```

```bash
# Démarrer
sudo systemctl start brieftube-worker

# Arrêter
sudo systemctl stop brieftube-worker

# Activer le démarrage automatique au boot
sudo systemctl enable brieftube-worker

# Désactiver le démarrage automatique
sudo systemctl disable brieftube-worker
```

### Manuellement (ponctuel)

```bash
cd worker
WORKER_MODE=processor WORKER_INSTANCE=1 \
  infisical run --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 \
  --env=prod --path=/worker \
  -- ./venv/bin/python main.py
```

---

## Infisical CLI

Le dépôt officiel (obligatoire — l'ancien cloudsmith est obsolète) :

```bash
curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | sudo bash
sudo apt-get update && sudo apt-get install infisical
```

Le wrapper `vps/run-worker.sh` gère l'authentification Universal Auth :
il obtient un token via `infisical login --method=universal-auth`, puis
lance le worker via `infisical run --token=...`.

---

## Fichiers de configuration

| Fichier                                | Rôle                                         |
|----------------------------------------|----------------------------------------------|
| `vps/setup.sh`                         | Script de setup initial du VPS               |
| `vps/run-worker.sh`                    | Wrapper Infisical Universal Auth             |
| `vps/brieftube-worker.service`         | Service systemd du worker principal          |
| `vps/brieftube-processor@.service`     | Service systemd pour instances processor     |
| `.github/workflows/deploy-worker.yml`  | CI/CD GitHub Actions                         |
