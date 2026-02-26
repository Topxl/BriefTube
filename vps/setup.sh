#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BriefTube VPS — Script de setup initial
# À exécuter UNE SEULE FOIS en tant que root sur un Hetzner Debian/Ubuntu vierge
#
# Usage :
#   scp vps/setup.sh root@VPS_IP:/tmp/setup.sh
#   ssh -t root@VPS_IP "bash /tmp/setup.sh"
# ─────────────────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Ce script doit être exécuté en root"

# ─── Config ──────────────────────────────────────────────────────────────────
DEPLOY_USER="brieftube"
APP_DIR="/home/${DEPLOY_USER}/app"
REPO_URL="git@github.com:Topxl/BriefTube.git"
INFISICAL_PROJECT_ID="089a5c93-5c51-4a24-8bf0-9d8bceb3a114"

# ─── 1. Dépendances système ───────────────────────────────────────────────────
info "Installation des dépendances système..."
apt update -q && apt upgrade -y -q
apt install -y -q python3 python3-pip python3-venv git ffmpeg curl unzip

# ─── 2. Infisical CLI ─────────────────────────────────────────────────────────
info "Installation de Infisical CLI..."
curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | bash
apt-get update -q && apt install -y infisical

# ─── 3. Utilisateur deploy ───────────────────────────────────────────────────
info "Création de l'utilisateur ${DEPLOY_USER}..."
if id "${DEPLOY_USER}" &>/dev/null; then
    warning "L'utilisateur ${DEPLOY_USER} existe déjà — skip"
else
    useradd -m -s /bin/bash "${DEPLOY_USER}"
fi

mkdir -p "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"

# ─── 4. Clé SSH pour git pull (deploy key) ───────────────────────────────────
info "Génération de la clé SSH deploy..."
if [ ! -f "/home/${DEPLOY_USER}/.ssh/deploy_key" ]; then
    sudo -u "${DEPLOY_USER}" ssh-keygen -t ed25519 -f "/home/${DEPLOY_USER}/.ssh/deploy_key" -N "" -C "brieftube-vps-deploy"
fi

# Autoriser GitHub Actions à se connecter en SSH avec cette clé
cat "/home/${DEPLOY_USER}/.ssh/deploy_key.pub" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"

# Ajouter github.com aux known hosts pour éviter le prompt interactif
sudo -u "${DEPLOY_USER}" ssh-keyscan -H github.com >> "/home/${DEPLOY_USER}/.ssh/known_hosts" 2>/dev/null
chmod 600 "/home/${DEPLOY_USER}/.ssh/known_hosts"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/known_hosts"

# Configurer SSH pour utiliser la deploy key avec github.com
cat > "/home/${DEPLOY_USER}/.ssh/config" << EOF
Host github.com
  IdentityFile /home/${DEPLOY_USER}/.ssh/deploy_key
  StrictHostKeyChecking no
EOF
chmod 600 "/home/${DEPLOY_USER}/.ssh/config"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/config"

# ─── 5. Cloner le repo ───────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ÉTAPE MANUELLE REQUISE — Deploy Key GitHub${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Ajoute cette clé publique à GitHub :"
echo "→ https://github.com/Topxl/BriefTube/settings/keys/new"
echo "  Titre    : VPS Hetzner"
echo "  Accès    : Read-only"
echo "  Clé      :"
echo ""
cat "/home/${DEPLOY_USER}/.ssh/deploy_key.pub"
echo ""
read -p "Appuie sur Entrée une fois la clé ajoutée sur GitHub..." < /dev/tty

info "Clonage du repo..."
sudo -u "${DEPLOY_USER}" git clone "${REPO_URL}" "${APP_DIR}"

# ─── 6. Environnement Python ──────────────────────────────────────────────────
info "Création du venv Python et installation des dépendances..."
sudo -u "${DEPLOY_USER}" python3 -m venv "${APP_DIR}/worker/venv"
sudo -u "${DEPLOY_USER}" "${APP_DIR}/worker/venv/bin/pip" install -r "${APP_DIR}/worker/requirements.txt" -q

# ─── 7. Répertoires nécessaires ──────────────────────────────────────────────
info "Création des répertoires de travail..."
sudo -u "${DEPLOY_USER}" mkdir -p "${APP_DIR}/worker/audio"
sudo -u "${DEPLOY_USER}" mkdir -p "${APP_DIR}/worker/cookies"

# ─── 8. Credentials Infisical ─────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ÉTAPE MANUELLE — Credentials Infisical${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Récupère tes credentials sur https://app.infisical.com → Machine Identities"
echo ""
read -p "INFISICAL_UNIVERSAL_AUTH_CLIENT_ID : " INFISICAL_CLIENT_ID < /dev/tty
read -p "INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET : " INFISICAL_CLIENT_SECRET < /dev/tty

# ─── 9. Services systemd ─────────────────────────────────────────────────────
info "Installation des services systemd..."
cp "${APP_DIR}/vps/brieftube-worker.service" /etc/systemd/system/brieftube-worker.service
cp "${APP_DIR}/vps/brieftube-processor@.service" /etc/systemd/system/brieftube-processor@.service
cp "${APP_DIR}/vps/brieftube-log-bot.service" /etc/systemd/system/brieftube-log-bot.service
chmod +x "${APP_DIR}/vps/run-worker.sh"
chmod +x "${APP_DIR}/vps/run-log-bot.sh"

# Injecter les credentials Infisical dans brieftube-worker
cat > /etc/systemd/system/brieftube-worker.service << EOF
$(sed '/REMPLACER_ICI/d' "${APP_DIR}/vps/brieftube-worker.service")
EOF
sed -i "/^Environment=PYTHONUNBUFFERED/a Environment=INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=${INFISICAL_CLIENT_ID}\nEnvironment=INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=${INFISICAL_CLIENT_SECRET}" /etc/systemd/system/brieftube-worker.service

# Injecter les credentials Infisical dans brieftube-processor@
cat > /etc/systemd/system/brieftube-processor@.service << EOF
$(sed '/REMPLACER_ICI/d' "${APP_DIR}/vps/brieftube-processor@.service")
EOF
sed -i "/^Environment=PYTHONUNBUFFERED/a Environment=INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=${INFISICAL_CLIENT_ID}\nEnvironment=INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=${INFISICAL_CLIENT_SECRET}" /etc/systemd/system/brieftube-processor@.service

# Injecter les credentials Infisical dans brieftube-log-bot
cat > /etc/systemd/system/brieftube-log-bot.service << EOF
$(sed '/REMPLACER_ICI/d' "${APP_DIR}/vps/brieftube-log-bot.service")
EOF
sed -i "/^Environment=PYTHONUNBUFFERED/a Environment=INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=${INFISICAL_CLIENT_ID}\nEnvironment=INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=${INFISICAL_CLIENT_SECRET}" /etc/systemd/system/brieftube-log-bot.service

# Override MAX_CONCURRENT_VIDEOS
mkdir -p /etc/systemd/system/brieftube-worker.service.d
cat > /etc/systemd/system/brieftube-worker.service.d/override.conf << EOF
[Service]
Environment="MAX_CONCURRENT_VIDEOS=12"
Environment="MAX_CPU_PERCENT=80"
Environment="MIN_FREE_RAM_MB=512"
EOF

systemctl daemon-reload
systemctl enable brieftube-worker
systemctl enable brieftube-log-bot

# ─── 10. Permissions sudo pour le deploy ─────────────────────────────────────
info "Configuration des permissions sudo..."
cat > /etc/sudoers.d/brieftube << EOF
brieftube ALL=(ALL) NOPASSWD: \
  /bin/systemctl daemon-reload, \
  /bin/systemctl restart brieftube-worker, \
  /bin/systemctl restart brieftube-log-bot, \
  /bin/systemctl status brieftube-worker --no-pager, \
  /bin/systemctl status brieftube-log-bot --no-pager
EOF
chmod 440 /etc/sudoers.d/brieftube

# ─── 11. Cookies YouTube ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ÉTAPE MANUELLE — Cookies YouTube${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Upload le fichier cookies depuis ta machine locale :"
echo ""
echo "  scp worker/cookies/youtube.txt ${DEPLOY_USER}@VPS_IP:${APP_DIR}/worker/cookies/"
echo ""
read -p "Appuie sur Entrée une fois le fichier uploadé (ou S pour skipper)..." SKIP_COOKIES < /dev/tty
if [[ "${SKIP_COOKIES}" != "S" && "${SKIP_COOKIES}" != "s" ]]; then
    [ -f "${APP_DIR}/worker/cookies/youtube.txt" ] && info "Cookies trouvés ✓" || warning "Fichier cookies absent — le worker tournera sans (certaines vidéos pourraient échouer)"
fi

# ─── 12. Démarrage ────────────────────────────────────────────────────────────
info "Démarrage des services..."
systemctl start brieftube-worker
systemctl start brieftube-log-bot
sleep 3
systemctl status brieftube-worker --no-pager
systemctl status brieftube-log-bot --no-pager

# ─── Récapitulatif final ──────────────────────────────────────────────────────
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup terminé !${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Dernières étapes à faire sur GitHub :"
echo ""
echo "1. Ajouter les secrets GitHub Actions :"
echo "   → https://github.com/Topxl/BriefTube/settings/secrets/actions"
echo ""
echo "   VPS_HOST = ${VPS_IP}"
echo "   VPS_SSH_KEY = (clé privée ci-dessous, copie TOUT y compris les lignes BEGIN/END)"
echo ""
cat "/home/${DEPLOY_USER}/.ssh/deploy_key"
echo ""
echo "2. Tester le déploiement : modifie un fichier worker/ et pousse sur main"
echo ""
echo "Commandes utiles :"
echo "  Worker — logs     : tail -f ${APP_DIR}/worker/worker.log"
echo "  Worker — status   : systemctl status brieftube-worker"
echo "  Worker — restart  : systemctl restart brieftube-worker"
echo "  Worker — systemd  : journalctl -u brieftube-worker -f"
echo ""
echo "  Log bot — logs    : tail -f ${APP_DIR}/worker/log_bot.log"
echo "  Log bot — status  : systemctl status brieftube-log-bot"
echo "  Log bot — restart : systemctl restart brieftube-log-bot"
echo "  Log bot — systemd : journalctl -u brieftube-log-bot -f"
