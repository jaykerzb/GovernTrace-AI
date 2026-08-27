#!/usr/bin/env bash
# Checks GitHub for new commits on master, asks before doing anything, and
# if confirmed: pulls, rebuilds, applies any new migrations, and restarts
# the systemd service (see deploy/governtrace-ai.service). Assumes the app
# is running as that service — edit SERVICE_NAME below if you named it
# differently.
set -euo pipefail

SERVICE_NAME="governtrace-ai"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking for updates..."
git fetch origin master --quiet

LOCAL_REV="$(git rev-parse HEAD)"
REMOTE_REV="$(git rev-parse origin/master)"

if [ "$LOCAL_REV" = "$REMOTE_REV" ]; then
  echo "Already up to date."
  exit 0
fi

# A dirty working tree here means something changed the checkout outside
# this script's control (e.g. someone edited a file directly on the VM) —
# safer to stop and let a human sort it out than risk `git pull` mangling
# local changes on what's supposed to be a clean deploy target.
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes — refusing to update automatically." >&2
  echo "Resolve or discard them (git status), then re-run this script." >&2
  exit 1
fi

echo
echo "New commits available:"
git log --oneline "$LOCAL_REV..$REMOTE_REV"
echo

read -r -p "Update now? This will restart the app for a few seconds. [y/N] " REPLY
case "$REPLY" in
  [yY]|[yY][eE][sS]) ;;
  *)
    echo "Skipped."
    exit 0
    ;;
esac

echo
echo "> sudo systemctl stop $SERVICE_NAME"
sudo systemctl stop "$SERVICE_NAME"

echo
echo "> git pull origin master"
git pull origin master

echo
echo "> npm install"
npm install

echo
echo "> npm run build -w client"
npm run build -w client

echo
echo "> npm run build -w server"
npm run build -w server

# The compiled server looks for the built client at server/client (see
# server/src/index.ts) — mirrors what the Dockerfile does at build time,
# needed here too since there's no separate build stage on a bare VM.
rm -rf server/client
cp -r client/dist server/client

echo
echo "> npx prisma generate --schema server/prisma/schema.prisma"
npx prisma generate --schema server/prisma/schema.prisma

echo
echo "> npx prisma migrate deploy --schema server/prisma/schema.prisma"
npx prisma migrate deploy --schema server/prisma/schema.prisma

echo
echo "> sudo systemctl start $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo
echo "Updated to $(git rev-parse --short HEAD) and restarted."
