#!/usr/bin/env bash
# Interactive installation wizard for Linux. Does everything scripts/setup.js
# does non-interactively (install deps, create server/.env, apply the schema,
# seed the 5 demo accounts) but also asks whether to populate the registry
# with sample AI use case data instead of leaving it empty.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_PATH="$ROOT_DIR/server/.env"
ENV_EXAMPLE_PATH="$ROOT_DIR/server/.env.example"

cd "$ROOT_DIR"

echo "GovernTrace AI — installation wizard"
echo "======================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but wasn't found on PATH." >&2
  echo "Install Node.js 22+ from https://nodejs.org and re-run this script." >&2
  exit 1
fi

NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js 22+ is required (found $(node -v))." >&2
  exit 1
fi

if [ -f "$ENV_PATH" ]; then
  echo "server/.env already exists — leaving it as-is."
else
  # Generated with Node rather than a shell tool like openssl so this works
  # the same regardless of what's installed on the box — Node itself is
  # already a hard requirement to run the app at all.
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sed "s/JWT_SECRET=\".*\"/JWT_SECRET=\"$SECRET\"/" "$ENV_EXAMPLE_PATH" > "$ENV_PATH"
  echo "Created server/.env with a freshly generated JWT secret."
fi

echo
echo "> npm install"
npm install

echo
echo "> npm run prisma:migrate"
npm run prisma:migrate

echo
echo "> npm run prisma:seed"
npm run prisma:seed

echo
read -r -p "Populate the registry with ~15 sample AI use cases (different statuses, risk levels, full assessments)? [y/N] " REPLY
case "$REPLY" in
  [yY]|[yY][eE][sS])
    echo
    echo "> npm run prisma:seed:demo -w server"
    npm run prisma:seed:demo -w server
    ;;
  *)
    echo "Skipping demo data — the registry will start empty."
    ;;
esac

cat <<'EOF'

Setup complete.

Run "npm run dev" to start the server (http://localhost:4000) and client
(http://localhost:5173, reachable from other devices on your LAN too).

Demo accounts (password: governance123):
  Admin               admin@example.com
  Compliance Officer  compliance@example.com
  System Owner        owner@example.com
  Approver            approver@example.com
  Viewer              viewer@example.com
EOF
