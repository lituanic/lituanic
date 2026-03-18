#!/usr/bin/env bash
# Lituanic data backup — runs via cron, syncs data/ to Google Drive.
# Install: sudo cp deploy/backup.cron /etc/cron.d/lituanic-backup
#
# Prerequisites:
#   - rclone configured with a "gdrive" remote (rclone config)
#   - BACKUP_REMOTE env var (default: gdrive:lituanic-backups)

set -euo pipefail

LITUANIC_DIR="${LITUANIC_DIR:-/home/lituanic/lituanic}"
BACKUP_REMOTE="${BACKUP_REMOTE:-gdrive:lituanic-backups}"
MARKER_FILE="${LITUANIC_DIR}/data/.last-backup"

# Sync all of data/ to remote
rclone sync "${LITUANIC_DIR}/data" "${BACKUP_REMOTE}/data" \
  --log-level NOTICE \
  2>&1 | logger -t lituanic-backup

# Write marker file for doctor health check
date -u +"%Y-%m-%dT%H:%M:%SZ" > "${MARKER_FILE}"

logger -t lituanic-backup "Backup complete → ${BACKUP_REMOTE}"
