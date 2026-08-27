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

# Must run before either build step, not after: `tsc` (in `npm run build -w
# server`) type-checks server code against whatever Prisma Client is
# already sitting in node_modules, which only reflects the schema as of
# the last `prisma generate` — not the schema.prisma just pulled above. A
# migration that adds/changes a model (like this one) makes the build fail
# with "property does not exist on type PrismaClient" otherwise, even
# though the code and schema are perfectly in sync.
echo
echo "> npx prisma generate --schema server/prisma/schema.prisma"
npx prisma generate --schema server/prisma/schema.prisma

echo
echo "> npx prisma migrate deploy --schema server/prisma/schema.prisma"
npx prisma migrate deploy --schema server/prisma/schema.prisma

echo
echo "> npm run build -w client"
npm run build -w client

echo
echo "> npm run build -w server"
npm run build -w server

# The compiled server looks for the built client at server/client (see
# server/src/index.ts) — there's no separate build stage on a bare VM, so
# it has to be copied into place explicitly here.
rm -rf server/client
cp -r client/dist server/client

echo
echo "> sudo systemctl start $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

echo
echo "Updated to $(git rev-parse --short HEAD) and restarted."
