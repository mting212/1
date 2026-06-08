#!/bin/sh
# MeetFlow Database Backup Script
# Usage: ./backup.sh [backup_dir]
# Cron: 0 2 * * * /path/to/backup.sh /var/backups/meetflow

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-meetflow}"
DB_USER="${POSTGRES_USER:-meetflow}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/meetflow_${TIMESTAMP}.sql.gz"

echo "[backup] Starting backup of $DB_NAME to $BACKUP_FILE"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

echo "[backup] Done: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "meetflow_*.sql.gz" -mtime +7 -delete
echo "[backup] Cleaned backups older than 7 days"
