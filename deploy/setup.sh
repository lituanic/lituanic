#!/usr/bin/env bash
# Lituanic VPS setup script — run once on a fresh Ubuntu/Debian VPS.
# Usage: curl -sSL <raw-url> | bash
#
# What it does:
#   1. Creates a lituanic system user
#   2. Installs Bun + 1Password CLI + rclone
#   3. Clones the repo
#   4. Installs the systemd unit + backup cron
#   5. Prompts for OP_SERVICE_ACCOUNT_TOKEN
#
# After running: configure rclone (rclone config) and start the service.

set -euo pipefail

REPO="${LITUANIC_REPO:-https://github.com/lituanic/lituanic.git}"
INSTALL_DIR="/home/lituanic/lituanic"

echo "=== Lituanic VPS Setup ==="
echo ""

# --- 1. System user ---
if ! id -u lituanic &>/dev/null; then
  echo "[1/6] Creating lituanic user..."
  sudo useradd -r -m -s /bin/bash lituanic
else
  echo "[1/6] User lituanic already exists"
fi

# --- 2. Install Bun ---
if ! command -v bun &>/dev/null; then
  echo "[2/6] Installing Bun..."
  sudo -u lituanic bash -c 'curl -fsSL https://bun.sh/install | bash'
else
  echo "[2/6] Bun already installed"
fi

# --- 3. Install 1Password CLI ---
if ! command -v op &>/dev/null; then
  echo "[3/6] Installing 1Password CLI..."
  curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
    sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | \
    sudo tee /etc/apt/sources.list.d/1password.list
  sudo apt-get update -qq && sudo apt-get install -y -qq 1password-cli
else
  echo "[3/6] 1Password CLI already installed"
fi

# --- 4. Install rclone ---
if ! command -v rclone &>/dev/null; then
  echo "[4/6] Installing rclone..."
  curl -fsSL https://rclone.org/install.sh | sudo bash
else
  echo "[4/6] rclone already installed"
fi

# --- 5. Clone repo + install deps ---
echo "[5/6] Setting up project..."
if [ ! -d "$INSTALL_DIR" ]; then
  sudo -u lituanic git clone "$REPO" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
sudo -u lituanic /home/lituanic/.bun/bin/bun install --frozen-lockfile

# Copy .env.op template if not present
if [ ! -f /home/lituanic/.env.op ]; then
  sudo -u lituanic cp "$INSTALL_DIR/deploy/.env.op.template" /home/lituanic/.env.op
  echo "  → Created /home/lituanic/.env.op (edit op:// URIs to match your vault)"
fi

# --- 6. Install systemd + cron ---
echo "[6/6] Installing systemd service + backup cron..."
sudo cp "$INSTALL_DIR/deploy/lituanic.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lituanic

# Backup cron
sudo cp "$INSTALL_DIR/deploy/backup.cron" /etc/cron.d/lituanic-backup 2>/dev/null || true

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo ""
echo "  1. Set the 1Password service account token:"
echo "     sudo mkdir -p /etc/systemd/system/lituanic.service.d"
echo "     echo '[Service]' | sudo tee /etc/systemd/system/lituanic.service.d/override.conf"
echo "     echo 'Environment=OP_SERVICE_ACCOUNT_TOKEN=ops_YOUR_TOKEN' | sudo tee -a /etc/systemd/system/lituanic.service.d/override.conf"
echo "     sudo chmod 600 /etc/systemd/system/lituanic.service.d/override.conf"
echo "     sudo systemctl daemon-reload"
echo ""
echo "  2. Edit 1Password URIs:"
echo "     nano /home/lituanic/.env.op"
echo ""
echo "  3. Configure rclone for Google Drive backups:"
echo "     sudo -u lituanic rclone config"
echo ""
echo "  4. Start the agent:"
echo "     sudo systemctl start lituanic"
echo "     journalctl -u lituanic -f"
echo ""
