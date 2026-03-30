#!/usr/bin/env bash
# ============================================================================
# BriefTube VPS Security Hardening
# Run as root: ssh brieftube-vps "sudo bash -s" < deploy/vps-harden.sh
# ============================================================================
set -euo pipefail

echo "🔒 BriefTube VPS Security Hardening"
echo "===================================="
echo ""

# ── 1. Firewall (UFW) ──────────────────────────────────────────
echo "🔥 Configuring firewall (UFW)..."
apt-get install -y ufw > /dev/null 2>&1

# Reset to defaults
ufw --force reset > /dev/null 2>&1

# Default: deny all incoming, allow all outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (current port)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS (for Caddy when web is self-hosted)
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Worker health check — bind to localhost only (blocked by UFW anyway)
# Port 8080 and 4416 are NOT opened = blocked by default

ufw --force enable
echo "✅ UFW enabled — only SSH (22), HTTP (80), HTTPS (443) open"
ufw status verbose

# ── 2. SSH Hardening ────────────────────────────────────────────
echo ""
echo "🔑 Hardening SSH..."

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_DROP="/etc/ssh/sshd_config.d/99-hardening.conf"

cat > "$SSHD_DROP" << 'SSHEOF'
# BriefTube SSH hardening
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
SSHEOF

# Validate config before restarting
if sshd -t 2>/dev/null; then
  systemctl restart sshd
  echo "✅ SSH hardened: no password auth, no root login, max 3 attempts"
else
  rm -f "$SSHD_DROP"
  echo "⚠️  SSH config validation failed — reverted. Check manually."
fi

# ── 3. Fail2ban ─────────────────────────────────────────────────
echo ""
echo "🚫 Configuring Fail2ban..."
apt-get install -y fail2ban > /dev/null 2>&1

cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
bantime = 3600
F2BEOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "✅ Fail2ban active — 3 failed SSH attempts = 1h ban"

# ── 4. Automatic security updates ──────────────────────────────
echo ""
echo "📦 Enabling automatic security updates..."
apt-get install -y unattended-upgrades > /dev/null 2>&1

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UUEOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UUEOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOEOF

systemctl enable unattended-upgrades
echo "✅ Automatic security updates enabled (no auto-reboot)"

# ── 5. Caddy security headers ──────────────────────────────────
echo ""
echo "🛡️  Adding security headers to Caddy..."

# Only update if Caddy is installed and Caddyfile exists
if [ -f /etc/caddy/Caddyfile ]; then
  cat > /etc/caddy/Caddyfile << 'CADDYEOF'
# BriefTube — Caddy reverse proxy with security headers
(security_headers) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }
}

www.brief-tube.com {
    import security_headers
    reverse_proxy localhost:3000
}

brief-tube.com {
    redir https://www.brief-tube.com{uri} permanent
}
CADDYEOF
  echo "✅ Caddy security headers configured (HSTS, X-Frame-Options, etc.)"
else
  echo "⏭️  Caddy not installed yet — skipping (will be configured in vps-setup.sh)"
fi

# ── 6. Bind worker health to localhost only ─────────────────────
echo ""
echo "🔒 Worker health endpoint..."
echo "   Port 8080 is now blocked by UFW (no public access)"
echo "   Port 4416 is now blocked by UFW (no public access)"

# ── 7. Kernel hardening (sysctl) ───────────────────────────────
echo ""
echo "🔧 Kernel hardening..."

cat > /etc/sysctl.d/99-security.conf << 'SYSEOF'
# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Don't send ICMP redirects
net.ipv4.conf.all.send_redirects = 0

# Enable SYN flood protection
net.ipv4.tcp_syncookies = 1

# Ignore broadcast pings
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Disable IP source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
SYSEOF

sysctl --system > /dev/null 2>&1
echo "✅ Kernel hardened (SYN flood protection, no redirects, no source routing)"

# ── 8. Summary ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo "🔒 Security hardening complete!"
echo ""
echo "✅ Firewall: only 22, 80, 443 open"
echo "✅ SSH: key-only, no root, max 3 attempts"
echo "✅ Fail2ban: 3 failed SSH = 1h ban"
echo "✅ Auto updates: security patches daily"
echo "✅ Kernel: SYN flood protection, no redirects"
echo "✅ Worker ports: blocked from public"
echo ""
echo "⚠️  IMPORTANT: Make sure your SSH key works"
echo "   before disconnecting! Test in a new terminal:"
echo "   ssh brieftube-vps"
echo "============================================"
