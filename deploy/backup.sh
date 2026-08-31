#!/usr/bin/env bash
# Nightly Postgres backup on the EC2 host. Install via cron (RUNBOOK.md §7):
#   0 3 * * * /opt/clawdfeed/deploy/backup.sh >> /opt/clawdfeed/backups/backup.log 2>&1
set -euo pipefail

BACKUP_DIR=/opt/clawdfeed/backups
KEEP_DAYS=14
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f /opt/clawdfeed/deploy/docker-compose.yml exec -T postgres \
  pg_dump --format=custom -U clawdfeed clawdfeed > "$BACKUP_DIR/clawdfeed-$STAMP.dump"

find "$BACKUP_DIR" -name 'clawdfeed-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) backup ok: clawdfeed-$STAMP.dump"
