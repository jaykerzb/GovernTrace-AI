#!/usr/bin/env bash
# Backs up everything a fresh checkout can't reproduce: the SQLite database
# and every uploaded supporting document. Produces a single timestamped
# tarball under backups/ — safe to run while the service is up, since
# SQLite in its default journal mode tolerates being read mid-write and
# this is a point-in-time file copy, not a live connection.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_PATH="server/prisma/dev.db"
UPLOADS_DIR="server/uploads"
BACKUP_DIR="${1:-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="governtrace-backup-$TIMESTAMP.tar.gz"

if [ ! -f "$DB_PATH" ]; then
  echo "No database found at $DB_PATH — nothing to back up." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "> tar -czf $BACKUP_DIR/$ARCHIVE_NAME"
# Includes server/uploads only if it exists — a fresh install with no
# documents uploaded yet won't have created the directory.
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" "$DB_PATH" "$UPLOADS_DIR"
else
  tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" "$DB_PATH"
fi

SIZE="$(du -h "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)"
echo
echo "Backup written to $BACKUP_DIR/$ARCHIVE_NAME ($SIZE)."
echo "Restore it with: scripts/restore.sh $BACKUP_DIR/$ARCHIVE_NAME"
