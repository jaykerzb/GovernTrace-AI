#!/usr/bin/env bash
# Removes GovernTrace AI entirely: the systemd service (if installed), its
# sudoers rule, and the whole repository directory — including the
# database and any uploaded documents. Irreversible; requires typing a
# confirmation phrase, not just y/N, given how destructive this is.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="governtrace-ai"

echo "GovernTrace AI — uninstaller"
echo "============================="
echo
echo "This will permanently:"
echo "  - Stop and remove the '$SERVICE_NAME' systemd service (if installed)"
echo "  - Remove its sudoers rule (if installed)"
echo "  - Delete this entire directory: $ROOT_DIR"
echo
echo "!! ALL DATA WILL BE LOST !!"
echo "This includes the database (every AI use case, risk assessment, work"
echo "paper, committee review, and audit log entry) and every uploaded"
echo "supporting document. There is no undo — back up server/prisma/dev.db"
echo "and server/uploads/ first if you want to keep any of it."
echo

read -r -p "Type UNINSTALL (all caps) to continue, anything else to cancel: " CONFIRM
if [ "$CONFIRM" != "UNINSTALL" ]; then
  echo "Cancelled — nothing was changed."
  exit 0
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q "^$SERVICE_NAME\.service"; then
  echo
  echo "> sudo systemctl disable --now $SERVICE_NAME"
  sudo systemctl disable --now "$SERVICE_NAME" || true

  echo "> removing /etc/systemd/system/$SERVICE_NAME.service"
  sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"

  echo "> sudo systemctl daemon-reload"
  sudo systemctl daemon-reload
else
  echo
  echo "No '$SERVICE_NAME' systemd service found — skipping."
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q "^$SERVICE_NAME-backup\.timer"; then
  echo
  echo "> sudo systemctl disable --now $SERVICE_NAME-backup.timer"
  sudo systemctl disable --now "$SERVICE_NAME-backup.timer" || true

  echo "> removing /etc/systemd/system/$SERVICE_NAME-backup.{service,timer}"
  sudo rm -f "/etc/systemd/system/$SERVICE_NAME-backup.service" "/etc/systemd/system/$SERVICE_NAME-backup.timer"

  echo "> sudo systemctl daemon-reload"
  sudo systemctl daemon-reload
else
  echo
  echo "No '$SERVICE_NAME-backup' timer found — skipping."
fi

if [ -f "/etc/sudoers.d/$SERVICE_NAME" ]; then
  echo "> removing /etc/sudoers.d/$SERVICE_NAME"
  sudo rm -f "/etc/sudoers.d/$SERVICE_NAME"
else
  echo "No sudoers rule found — skipping."
fi

echo
echo "> deleting $ROOT_DIR"
# cd out first — deleting your own current working directory out from
# under a running shell is unreliable across systems.
cd "$(dirname "$ROOT_DIR")"
rm -rf "$ROOT_DIR"

echo
echo "GovernTrace AI has been completely removed."
