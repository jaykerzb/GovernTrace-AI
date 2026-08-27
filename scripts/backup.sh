#!/usr/bin/env bash
# Backs up everything a fresh checkout can't reproduce: the SQLite database
# and every uploaded supporting document. Produces a single timestamped
# tarball under backups/ — safe to run while the service is up, since
# SQLite in its default journal mode tolerates being read mid-write and
# this is a point-in-time file copy, not a live connection. Also used as
# the ExecStart of the optional governtrace-ai-backup.timer (see
# deploy/governtrace-ai-backup.{service,timer}) for unattended nightly runs.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_PATH="server/prisma/dev.db"
UPLOADS_DIR="server/uploads"
BACKUP_DIR="${1:-backups}"
# How many archives to keep — oldest beyond this are deleted after a
# successful backup, since timestamped filenames sort chronologically.
# Override with GOVERNTRACE_BACKUP_KEEP for a different retention window.
KEEP="${GOVERNTRACE_BACKUP_KEEP:-14}"
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

# shellcheck disable=SC2012
STALE_COUNT="$(ls -1 "$BACKUP_DIR"/governtrace-backup-*.tar.gz 2>/dev/null | wc -l)"
if [ "$STALE_COUNT" -gt "$KEEP" ]; then
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/governtrace-backup-*.tar.gz | tail -n "+$((KEEP + 1))" | while IFS= read -r stale; do
    rm -f "$stale"
    echo "Removed old backup $stale (keeping the newest $KEEP)."
  done
fi
