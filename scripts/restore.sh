#!/usr/bin/env bash
# Restores a backup produced by scripts/backup.sh: stops the service (if
# running as one), overwrites the current database and uploads with the
# archive's contents, and restarts. Destructive to whatever's currently in
# place, so it asks for confirmation first.
set -euo pipefail

SERVICE_NAME="governtrace-ai"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ]; then
  echo "Usage: scripts/restore.sh <path-to-backup.tar.gz>" >&2
  exit 1
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "No such file: $ARCHIVE" >&2
  exit 1
fi

echo "This will overwrite:"
echo "  - server/prisma/dev.db (the current database)"
echo "  - server/uploads/ (all current supporting documents)"
echo "with the contents of $ARCHIVE"
echo
echo "!! Whatever's currently there will be lost. There is no undo. !!"
echo

read -r -p "Type RESTORE (all caps) to continue, anything else to cancel: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Cancelled — nothing was changed."
  exit 0
fi

SERVICE_RUNNING=false
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  SERVICE_RUNNING=true
  echo
  echo "> sudo systemctl stop $SERVICE_NAME"
  sudo systemctl stop "$SERVICE_NAME"
fi

echo
echo "> rm -rf server/prisma/dev.db server/uploads"
rm -rf server/prisma/dev.db server/uploads

echo "> tar -xzf $ARCHIVE"
tar -xzf "$ARCHIVE"

if [ "$SERVICE_RUNNING" = true ]; then
  echo
  echo "> sudo systemctl start $SERVICE_NAME"
  sudo systemctl start "$SERVICE_NAME"
fi

echo
echo "Restore complete."
