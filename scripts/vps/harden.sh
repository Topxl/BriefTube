#!/usr/bin/env bash
# BriefTube VPS hardening script — round 3 audit fixes.
#
# What this does:
#   1. Scopes /etc/sudoers.d/brieftube to the exact commands we need (was: NOPASSWD ALL)
#   2. Removes user `brieftube` from group `docker` (docker group == root)
#   3. Hardens /etc/ssh/sshd_config.d/99-hardening.conf (adds PermitRootLogin no,
#      PasswordAuthentication no, PubkeyAuthentication yes, AllowUsers brieftube)
#   4. Adds systemd hardening drop-ins for brieftube-{web,worker,log-bot}
#      (NoNewPrivileges, PrivateTmp, ProtectSystem, ProtectHome, etc.)
#   5. Forces Next.js to bind 127.0.0.1 (was 0.0.0.0 — neutralised by UFW but
#      defense-in-depth)
#
# Idempotent — safe to re-run. Creates timestamped backups in ~/vps-harden-backups/
# before every modification.
#
# Usage (from local machine):
#   scp scripts/vps/harden.sh brieftube-vps:/tmp/harden.sh
#   ssh brieftube-vps "sudo bash /tmp/harden.sh"
#
# Or one-liner:
#   ssh brieftube-vps "sudo bash -s" < scripts/vps/harden.sh
#
# Reversal: every backed-up file is stored under ~/vps-harden-backups/<timestamp>/
# with its original path preserved. To revert, copy the backup back and restart
# the affected service.

set -euo pipefail

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
  echo "❌ Must be run as root (use: sudo bash $0)" >&2
  exit 1
fi

TARGET_USER="brieftube"
if ! id "$TARGET_USER" >/dev/null 2>&1; then
  echo "❌ User '$TARGET_USER' does not exist — wrong host?" >&2
  exit 1
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/home/${TARGET_USER}/vps-harden-backups/${TS}"
mkdir -p "$BACKUP_DIR"
chown -R "${TARGET_USER}:${TARGET_USER}" "/home/${TARGET_USER}/vps-harden-backups"

log()  { echo -e "\e[1;36m[+] $*\e[0m"; }
warn() { echo -e "\e[1;33m[!] $*\e[0m"; }
ok()   { echo -e "\e[1;32m[✓] $*\e[0m"; }
skip() { echo -e "\e[1;90m[-] $*\e[0m"; }

backup() {
  local src=$1
  if [[ -e "$src" ]]; then
    local rel="${src#/}"
    local dst="${BACKUP_DIR}/${rel}"
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

log "Backups go to: $BACKUP_DIR"

# ---------------------------------------------------------------------------
# 1. Sudoers — scope brieftube to the specific commands it needs
# ---------------------------------------------------------------------------

log "Step 1/5 — Scoping sudoers for $TARGET_USER"

SUDO_FILE="/etc/sudoers.d/brieftube"
if grep -q "NOPASSWD: ALL" "$SUDO_FILE" 2>/dev/null; then
  backup "$SUDO_FILE"
  cat > "${SUDO_FILE}.new" <<'EOF'
# Scoped sudo rights for the brieftube service user.
# NOPASSWD is limited to the exact commands the app needs to operate;
# anything else requires the root password (which brieftube does not have).

# Service control (web, worker, log-bot)
brieftube ALL=(root) NOPASSWD: /bin/systemctl start brieftube-web
brieftube ALL=(root) NOPASSWD: /bin/systemctl stop brieftube-web
brieftube ALL=(root) NOPASSWD: /bin/systemctl restart brieftube-web
brieftube ALL=(root) NOPASSWD: /bin/systemctl status brieftube-web
brieftube ALL=(root) NOPASSWD: /bin/systemctl start brieftube-worker
brieftube ALL=(root) NOPASSWD: /bin/systemctl stop brieftube-worker
brieftube ALL=(root) NOPASSWD: /bin/systemctl restart brieftube-worker
brieftube ALL=(root) NOPASSWD: /bin/systemctl status brieftube-worker
brieftube ALL=(root) NOPASSWD: /bin/systemctl start brieftube-log-bot
brieftube ALL=(root) NOPASSWD: /bin/systemctl stop brieftube-log-bot
brieftube ALL=(root) NOPASSWD: /bin/systemctl restart brieftube-log-bot
brieftube ALL=(root) NOPASSWD: /bin/systemctl status brieftube-log-bot

# Journal access for admin dashboards (read-only, scoped to our units)
brieftube ALL=(root) NOPASSWD: /bin/journalctl -u brieftube-web --no-pager *
brieftube ALL=(root) NOPASSWD: /bin/journalctl -u brieftube-worker --no-pager *
brieftube ALL=(root) NOPASSWD: /bin/journalctl -u brieftube-log-bot --no-pager *

# Caddy reload (reverse proxy config)
brieftube ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy
EOF
  chmod 0440 "${SUDO_FILE}.new"
  chown root:root "${SUDO_FILE}.new"
  # visudo -cf validates before swapping
  if visudo -cf "${SUDO_FILE}.new" >/dev/null; then
    mv "${SUDO_FILE}.new" "$SUDO_FILE"
    ok "Sudoers scoped — removed NOPASSWD: ALL"
  else
    rm -f "${SUDO_FILE}.new"
    echo "❌ New sudoers file failed validation, aborted" >&2
    exit 1
  fi
else
  skip "Sudoers already scoped (no NOPASSWD: ALL found)"
fi

# ---------------------------------------------------------------------------
# 2. Remove brieftube from docker group
# ---------------------------------------------------------------------------

log "Step 2/5 — Removing $TARGET_USER from docker group"

if id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx docker; then
  gpasswd -d "$TARGET_USER" docker
  ok "$TARGET_USER removed from docker group (was equivalent to root)"
  warn "  If worker restarts/runs need docker, add a scoped NOPASSWD entry in /etc/sudoers.d/brieftube for the specific docker subcommand (e.g. 'docker restart bgutil-provider')"
else
  skip "$TARGET_USER not in docker group"
fi

# ---------------------------------------------------------------------------
# 3. SSH hardening
# ---------------------------------------------------------------------------

log "Step 3/5 — Hardening SSH"

SSH_DROPIN="/etc/ssh/sshd_config.d/99-hardening.conf"
backup "$SSH_DROPIN"

# Ensure the critical directives are present. We append what's missing rather
# than rewriting the whole file, so previous manual tuning is preserved.
ensure_ssh_setting() {
  local key=$1
  local value=$2
  if grep -qE "^\s*${key}\s+" "$SSH_DROPIN" 2>/dev/null; then
    # Already set — make sure it matches our value
    current=$(grep -E "^\s*${key}\s+" "$SSH_DROPIN" | head -1 | awk '{print $2}')
    if [[ "$current" != "$value" ]]; then
      sed -i -E "s|^\s*${key}\s+.*|${key} ${value}|" "$SSH_DROPIN"
      echo "  updated: $key $current → $value"
    fi
  else
    echo "${key} ${value}" >> "$SSH_DROPIN"
    echo "  added: $key $value"
  fi
}

touch "$SSH_DROPIN"
ensure_ssh_setting "PermitRootLogin" "no"
ensure_ssh_setting "PasswordAuthentication" "no"
ensure_ssh_setting "PubkeyAuthentication" "yes"
ensure_ssh_setting "PermitEmptyPasswords" "no"
ensure_ssh_setting "KbdInteractiveAuthentication" "no"
ensure_ssh_setting "ChallengeResponseAuthentication" "no"
ensure_ssh_setting "AllowUsers" "$TARGET_USER"
# PermitUserEnvironment=yes is intentional (used by Infisical machine identity env file)
# so we don't touch it.

if sshd -t 2>/dev/null; then
  systemctl reload ssh
  ok "SSH hardening applied, sshd reloaded"
else
  warn "sshd -t failed — reverting SSH drop-in from backup"
  if [[ -f "${BACKUP_DIR}${SSH_DROPIN}" ]]; then
    cp "${BACKUP_DIR}${SSH_DROPIN}" "$SSH_DROPIN"
    systemctl reload ssh
  fi
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Systemd service hardening
# ---------------------------------------------------------------------------

log "Step 4/5 — Adding systemd hardening drop-ins"

write_systemd_hardening() {
  local unit=$1
  local extra=${2:-""}
  local dropin_dir="/etc/systemd/system/${unit}.service.d"
  local dropin="${dropin_dir}/10-hardening.conf"
  mkdir -p "$dropin_dir"
  backup "$dropin"
  cat > "$dropin" <<EOF
# Added by scripts/vps/harden.sh on ${TS}. Safe to edit.
[Service]
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=read-only
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictRealtime=yes
RestrictNamespaces=yes
MemoryDenyWriteExecute=no
SystemCallArchitectures=native
${extra}
EOF
  echo "  drop-in: $dropin"
}

# brieftube-web: needs write access to /home/brieftube/web (standalone build)
# and /tmp (PrivateTmp handles this). ProtectHome=read-only means the
# service can read its own dir but not write to other users.
write_systemd_hardening "brieftube-web" "ReadWritePaths=/home/${TARGET_USER}/web"

# brieftube-worker: needs write to worker dir (logs, transcripts)
write_systemd_hardening "brieftube-worker" "ReadWritePaths=/home/${TARGET_USER}/app /home/${TARGET_USER}/transcripts"

# brieftube-log-bot: needs write to worker dir for log_bot.lock (single-instance
# guard) and log_bot.log (stdout/stderr forwarding).
if systemctl list-unit-files | grep -q "^brieftube-log-bot.service"; then
  write_systemd_hardening "brieftube-log-bot" "ReadWritePaths=/home/${TARGET_USER}/app"
fi

# ---------------------------------------------------------------------------
# 5. Bind Next.js to 127.0.0.1
# ---------------------------------------------------------------------------

log "Step 5/5 — Binding Next.js to 127.0.0.1 (was 0.0.0.0)"

WEB_UNIT="/etc/systemd/system/brieftube-web.service"
if [[ -f "$WEB_UNIT" ]]; then
  if grep -q "HOSTNAME=0.0.0.0" "$WEB_UNIT"; then
    backup "$WEB_UNIT"
    sed -i 's|^Environment=HOSTNAME=0.0.0.0|Environment=HOSTNAME=127.0.0.1|' "$WEB_UNIT"
    ok "Next.js now binds 127.0.0.1 (Caddy reverse-proxies — UFW was the only thing preventing direct public access)"
  else
    skip "Next.js already bound to non-0.0.0.0 or no HOSTNAME env set"
  fi
fi

# Worker HTTP health server (main.py line 1799: web.TCPSite(runner, "0.0.0.0", port)).
# This is baked into the Python code so it has to be fixed in a code PR, not
# here. Leaving a reminder.
warn "Worker HTTP health server (port 8080) is still bound to 0.0.0.0 in main.py — UFW default-deny makes it unreachable publicly, but this should be fixed in code at some point"

# ---------------------------------------------------------------------------
# Finalise
# ---------------------------------------------------------------------------

log "Reloading systemd + restarting services"
systemctl daemon-reload
systemctl restart brieftube-web
systemctl restart brieftube-worker
if systemctl list-unit-files | grep -q "^brieftube-log-bot.service"; then
  systemctl restart brieftube-log-bot
fi

sleep 3

log "Post-flight check"
failed=0
for svc in brieftube-web brieftube-worker brieftube-log-bot; do
  if systemctl list-unit-files | grep -q "^${svc}.service"; then
    if systemctl is-active --quiet "$svc"; then
      ok "$svc is active"
    else
      warn "$svc is NOT active — check 'journalctl -u $svc -n 50'"
      failed=$((failed + 1))
    fi
  fi
done

if [[ $failed -eq 0 ]]; then
  echo
  ok "VPS hardening complete. Backups: $BACKUP_DIR"
  echo
  echo "Next steps:"
  echo "  • Run a health check from your laptop:  ./scripts/health-check.sh --remote"
  echo "  • Verify SSH still works in a NEW terminal (keep this one open as a safety net)"
  echo "  • Review backups in $BACKUP_DIR if you want to revert"
else
  echo
  warn "$failed service(s) failed to restart. Inspect logs and revert from $BACKUP_DIR if needed."
  exit 1
fi
