#!/usr/bin/env bash
# ============================================================================
# BriefTube VPS Setup — Self-hosted Next.js
# Run as root on the VPS: curl -sL <url> | bash
# Or: ssh brieftube-vps "bash -s" < deploy/vps-setup.sh
# ============================================================================
set -euo pipefail

echo "=== BriefTube VPS Setup ==="
echo "Installing: Node.js 22, pnpm, Caddy, systemd service"
echo ""

# ── Node.js 22 LTS via NodeSource ───────────────────────────────
if ! command -v node &>/dev/null; then
  echo "📦 Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  echo "✅ Node.js $(node --version)"
else
  echo "✅ Node.js already installed: $(node --version)"
fi

# ── pnpm ────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "📦 Installing pnpm..."
  npm install -g pnpm
  echo "✅ pnpm $(pnpm --version)"
else
  echo "✅ pnpm already installed: $(pnpm --version)"
fi

# ── Caddy (reverse proxy + auto HTTPS) ─────────────────────────
if ! command -v caddy &>/dev/null; then
  echo "📦 Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
  echo "✅ Caddy installed"
else
  echo "✅ Caddy already installed"
fi

# ── Create web app directory ────────────────────────────────────
WEB_DIR="/home/brieftube/web"
mkdir -p "$WEB_DIR"
chown brieftube:brieftube "$WEB_DIR"

# ── Caddyfile ───────────────────────────────────────────────────
DOMAIN="brief-tube.com"
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
# BriefTube — Caddy reverse proxy
# Activate by pointing DNS A record to this server's IP

www.brief-tube.com {
    reverse_proxy localhost:3000
}

brief-tube.com {
    redir https://www.brief-tube.com{uri} permanent
}
CADDYEOF

echo "✅ Caddyfile written to /etc/caddy/Caddyfile"

# ── Systemd service for Next.js ─────────────────────────────────
cat > /etc/systemd/system/brieftube-web.service << 'SVCEOF'
[Unit]
Description=BriefTube Next.js Web App
After=network.target

[Service]
Type=simple
User=brieftube
Group=brieftube
WorkingDirectory=/home/brieftube/web
ExecStart=/usr/bin/node /home/brieftube/web/.next/standalone/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0

# Load secrets from Infisical (same pattern as worker)
# Uncomment when ready:
# ExecStart=/usr/local/bin/infisical run --token=<TOKEN> --projectId=089a5c93-5c51-4a24-8bf0-9d8bceb3a114 --env=prod --path=/web -- /usr/bin/node /home/brieftube/web/.next/standalone/server.js

# Resource limits
LimitNOFILE=65535
MemoryMax=2G

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
echo "✅ brieftube-web.service created"

# ── Deploy script ───────────────────────────────────────────────
cat > /home/brieftube/deploy-web.sh << 'DEPLOYEOF'
#!/usr/bin/env bash
# Deploy BriefTube Next.js from GitHub
set -euo pipefail

WEB_DIR="/home/brieftube/web"
REPO_DIR="/home/brieftube/app"

echo "🚀 Deploying BriefTube web..."

cd "$REPO_DIR"
git pull origin main

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔨 Building Next.js..."
pnpm build

echo "📋 Copying standalone build..."
rm -rf "$WEB_DIR/.next" "$WEB_DIR/public"
cp -r .next/standalone/* "$WEB_DIR/"
cp -r .next/standalone/.next "$WEB_DIR/.next"
cp -r .next/static "$WEB_DIR/.next/static"
cp -r public "$WEB_DIR/public"

echo "♻️  Restarting service..."
sudo systemctl restart brieftube-web

echo "✅ Deploy complete! Checking health..."
sleep 3
if curl -sf http://localhost:3000 > /dev/null; then
  echo "✅ Web app is running on port 3000"
else
  echo "❌ Web app failed to start — check: journalctl -u brieftube-web -n 50"
fi
DEPLOYEOF

chmod +x /home/brieftube/deploy-web.sh
chown brieftube:brieftube /home/brieftube/deploy-web.sh

echo ""
echo "============================================"
echo "✅ VPS setup complete!"
echo ""
echo "Next steps when ready to switch:"
echo "1. Add 'output: standalone' to next.config.ts"
echo "2. Configure Infisical secrets for /web path"
echo "3. Run: ssh brieftube-vps '/home/brieftube/deploy-web.sh'"
echo "4. Test: curl http://VPS_IP:3000"
echo "5. Point DNS: brief-tube.com A → $(curl -s ifconfig.me)"
echo "6. Start Caddy: systemctl enable --now caddy"
echo "7. Remove Vercel deployment"
echo "============================================"
