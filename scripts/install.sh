#!/usr/bin/env bash
# Interactive installation wizard for Linux. Does everything scripts/setup.js
# does non-interactively (install deps, create server/.env, apply the schema,
# seed the 5 demo accounts) but also asks whether to populate the registry
# with sample AI use case data instead of leaving it empty, and whether to
# install the app as a persistent systemd service (production build +
# service file + a scoped sudo rule for self-restart) instead of just
# leaving it to be started manually with `npm run dev`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_PATH="$ROOT_DIR/server/.env"
ENV_EXAMPLE_PATH="$ROOT_DIR/server/.env.example"
SERVICE_NAME="governtrace-ai"

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

# Builds the production bundle and installs+starts governtrace-ai as a
# systemd service running as whichever user invoked this script — plus a
# scoped passwordless sudo rule letting the app restart that one service
# by itself, so Admin > System's update/network-settings buttons work
# without any extra manual setup afterward. Bundled into this same step
# (rather than left as separate manual instructions) because installing
# the service itself already requires sudo — no added exposure from also
# writing the sudoers rule here.
install_as_service() {
  local service_user
  service_user="$(id -un)"
  if [ "$service_user" = "root" ]; then
    echo "Warning: running as root — the service would run as root too, which" >&2
    echo "is more privileged than necessary. Consider re-running this wizard as a" >&2
    echo "regular user (sudo will still prompt when needed) if you'd rather not." >&2
  fi

  # Must run before the server build, not after: `tsc` type-checks server
  # code against whatever Prisma Client is already generated, which only
  # reflects the schema as of the last `prisma generate` — normally fine
  # since `npm run prisma:migrate` earlier in this wizard already ran it,
  # but re-running just this function on its own (e.g. after a schema
  # change) would otherwise build against a stale client.
  #
  # Run with cwd=server (not --schema from the repo root) — Prisma only
  # reliably auto-loads server/.env (for DATABASE_URL) when it's actually
  # running from that directory; pointing at the schema via --schema from
  # the root looks equivalent but silently fails to pick up the env file.
  echo
  echo "> (cd server && npx prisma generate)"
  (cd "$ROOT_DIR/server" && npx prisma generate)

  echo
  echo "> npm run build -w client"
  npm run build -w client

  echo
  echo "> npm run build -w server"
  npm run build -w server

  # Mirrors what scripts/update.sh does — the compiled server
  # (server/src/index.ts) looks for the built client at server/client.
  rm -rf "$ROOT_DIR/server/client"
  cp -r "$ROOT_DIR/client/dist" "$ROOT_DIR/server/client"

  local systemctl_path
  systemctl_path="$(command -v systemctl)"

  echo
  echo "Installing systemd service (will prompt for your password)..."
  sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<SERVICE
[Unit]
Description=GovernTrace AI
After=network.target

[Service]
Type=simple
User=$service_user
WorkingDirectory=$ROOT_DIR/server
ExecStart=$(command -v node) dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
  sudo systemctl daemon-reload

  # Written to a temp file and validated with visudo -c before being moved
  # into place, so a typo here can't corrupt sudo entirely.
  local tmp_sudoers
  tmp_sudoers="$(mktemp)"
  echo "$service_user ALL=(root) NOPASSWD: $systemctl_path restart $SERVICE_NAME" > "$tmp_sudoers"
  if sudo visudo -c -f "$tmp_sudoers" >/dev/null 2>&1; then
    sudo install -o root -g root -m 0440 "$tmp_sudoers" "/etc/sudoers.d/$SERVICE_NAME"
    echo "Configured passwordless sudo for restarting the service."
  else
    echo "Could not validate the sudoers rule — skipping it. Admin > System's" >&2
    echo "auto-restart won't work until you add it manually; see deploy/README.md." >&2
  fi
  rm -f "$tmp_sudoers"

  sudo systemctl enable --now "$SERVICE_NAME"
  echo
  echo "Service installed and started. Check status with:"
  echo "  sudo systemctl status $SERVICE_NAME"
}

# Installs a systemd timer that runs scripts/backup.sh once a day (see
# deploy/governtrace-ai-backup.{service,timer}), keeping the last 14
# archives by default. Only offered alongside the main service since it
# needs the same $service_user/$ROOT_DIR already resolved there, and a
# scheduled backup of a setup that isn't running persistently anyway isn't
# very useful.
install_backup_timer() {
  local service_user="$1"

  echo
  echo "Installing daily backup timer (will prompt for your password)..."
  sudo tee "/etc/systemd/system/$SERVICE_NAME-backup.service" > /dev/null <<BACKUPSERVICE
[Unit]
Description=GovernTrace AI backup

[Service]
Type=oneshot
User=$service_user
WorkingDirectory=$ROOT_DIR
ExecStart=$(command -v bash) $ROOT_DIR/scripts/backup.sh
BACKUPSERVICE

  sudo tee "/etc/systemd/system/$SERVICE_NAME-backup.timer" > /dev/null <<'BACKUPTIMER'
[Unit]
Description=Daily GovernTrace AI backup

[Timer]
OnCalendar=daily
RandomizedDelaySec=1800
Persistent=true

[Install]
WantedBy=timers.target
BACKUPTIMER

  sudo systemctl daemon-reload
  sudo systemctl enable --now "$SERVICE_NAME-backup.timer"
  echo "Backup timer installed — runs daily, keeping the last 14 backups under $ROOT_DIR/backups."
  echo "Check its schedule with: systemctl list-timers $SERVICE_NAME-backup.timer"
}

echo
read -r -p "Set this up as a persistent background service (auto-starts on boot, and lets Admin > System check for and install updates)? Requires sudo. [y/N] " REPLY
case "$REPLY" in
  [yY]|[yY][eE][sS])
    install_as_service
    RAN_AS_SERVICE=1

    echo
    read -r -p "Also install a daily automatic backup of the database and uploaded documents? Requires sudo. [y/N] " REPLY
    case "$REPLY" in
      [yY]|[yY][eE][sS]) install_backup_timer "$(id -un)" ;;
      *) ;;
    esac
    ;;
  *)
    RAN_AS_SERVICE=0
    ;;
esac

if [ "$RAN_AS_SERVICE" = "1" ]; then
  PORT_VALUE="$(grep -oP '^PORT="?\K[0-9]+' "$ENV_PATH" 2>/dev/null || echo 4000)"
  cat <<EOF

Setup complete. GovernTrace AI is running at http://localhost:$PORT_VALUE

Demo accounts (password: governance123):
  Admin               admin@example.com
  Compliance Officer  compliance@example.com
  System Owner        owner@example.com
  Approver            approver@example.com
  Viewer              viewer@example.com
EOF
else
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
fi
