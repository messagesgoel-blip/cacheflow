#!/bin/bash
set -euo pipefail

# Default backup directory - can be overridden with BACKUP_DIR env var
BACKUP_DIR="${BACKUP_DIR:-/srv/storage/repo/cacheflow/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

docker exec cacheflow-postgres pg_dump -U cacheflow cacheflow | \
  gzip > "$BACKUP_DIR/cacheflow_db_$TIMESTAMP.sql.gz"

find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +7 -delete
echo "Backup done: $BACKUP_DIR/cacheflow_db_$TIMESTAMP.sql.gz"
