# Deploying on a plain Linux VM

No Docker, no Coolify — just the app running directly as a systemd service, kept up to date either from the CLI (`scripts/update.sh`) or from the app itself (**Admin → System**).

**The easy way:** `scripts/install.sh` does everything below automatically if you answer yes to its "set this up as a persistent background service" prompt — production build, systemd unit, and the sudoers rule in one step (it'll prompt for your password once, same as any of these commands would). The manual steps below are for reference, or for setting it up separately from the rest of the install wizard.

## 1. Install the systemd service

```bash
sudo cp deploy/governtrace-ai.service /etc/systemd/system/
```

Edit `WorkingDirectory` and `User` in that file first to match where you cloned the repo and which (non-root) user should run it. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now governtrace-ai
```

## 2. Allow the app to restart itself

Both **Admin → System**'s "Install Update" button and its network-settings save restart the service afterward, via `systemctl restart governtrace-ai`. The app runs as an unprivileged user, so it needs a narrowly-scoped passwordless sudo rule for exactly that one command — nothing broader.

Create `/etc/sudoers.d/governtrace-ai` (using `visudo -f` so a syntax error can't lock you out of sudo entirely):

```bash
sudo visudo -f /etc/sudoers.d/governtrace-ai
```

Add this line, replacing `governtrace` with whatever `User=` you set in the service file. Use `command -v systemctl` to get the exact path on your distro (sudoers rules match on the literal resolved path, and it isn't always `/usr/bin/systemctl`):

```
governtrace ALL=(root) NOPASSWD: /usr/bin/systemctl restart governtrace-ai
```

Without this rule, updates and network-setting changes still save/build correctly — only the automatic restart step silently fails, and the admin panel will show "didn't come back within a minute" until you restart the service yourself.

## 3. PATH inside the service

systemd services get a minimal `PATH` by default, which can be missing wherever `node`/`npm`/`git` actually live (especially if Node was installed via `nvm`). If the service fails to start, or updates fail with a "command not found" error, add an explicit `Environment=PATH=...` line to the `[Service]` section of the unit file pointing at the right directories, then `sudo systemctl daemon-reload`.
