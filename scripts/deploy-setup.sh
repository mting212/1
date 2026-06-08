#!/bin/bash
# MeetFlow — First-time server setup script
# Run this ONCE on a fresh Ubuntu 24.04 server as root
# Usage: ssh root@<server-ip> 'bash -s' < deploy-setup.sh

set -euo pipefail

echo "=== MeetFlow Server Setup ==="

# ── 1. System updates ─────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ── 3. Configure firewall (UFW) ───────────────────────────
echo "[3/7] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw --force enable

# ── 4. Create app directory ───────────────────────────────
echo "[4/7] Creating app directory..."
mkdir -p /opt/meetflow
cd /opt/meetflow

# ── 5. Clone repository (or pull if exists) ───────────────
echo "[5/7] Cloning repository..."
if [ -d .git ]; then
  git pull origin main
else
  git clone https://github.com/YOUR_ORG/meetflow.git .
fi

# ── 6. Create .env file if missing ────────────────────────
echo "[6/7] Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">>> EDIT /opt/meetflow/.env with real values before starting! <<<"
  echo ">>> Especially: POSTGRES_PASSWORD, AUTH_SECRET, OAuth keys <<<"
fi

# ── 7. Set up daily database backups ──────────────────────
echo "[7/7] Setting up backup cron job..."
BACKUP_SCRIPT="/opt/meetflow/scripts/backup.sh"
BACKUP_DIR="/var/backups/meetflow"
mkdir -p "$BACKUP_DIR"

# Add cron job (runs daily at 2:00 AM)
(crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" || true; \
 echo "0 2 * * * $BACKUP_SCRIPT $BACKUP_DIR >> /var/log/meetflow-backup.log 2>&1") | crontab -

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps (manual):"
echo "1. Edit /opt/meetflow/.env with production secrets"
echo "2. Run: docker compose -f /opt/meetflow/compose.prod.yml up -d"
echo "3. Run certbot to obtain SSL certificates (see docs/launch-checklist.md)"
echo "4. Verify: curl http://localhost:3000/api/trpc/health"
