# Cloud Scheduler Setup Guide

## What this is

The **Allternit Cloud Scheduler** is the always-on component that runs `cloud` and `hybrid` domain routines and loops even when the Allternit Desktop app is closed. It is the equivalent of Anthropic's cloud task/cron infrastructure for Claude Code: a long-running process that owns the schedule clock and triggers agent/shell/http/cowork/function jobs at the right wall-clock time.

The daemon is **`gizzi-code serve`** — the headless Gizzi Code server. It already contains the full cron runtime (`/cron/*` routes) and all job executors, so cloud schedules run the same code path as local schedules. The Allternit API forwards cloud-domain routines/loops to it via the configured `cron_daemon_url` (default `http://127.0.0.1:4096/cron`).

## Important: this is opt-in, not a fallback

Cloud scheduling is **not** a fallback for the local scheduler. When you create a schedule you choose its execution domain:

| Domain | Runs where | Requires |
|--------|-----------|----------|
| `local` | Inside the Allternit Desktop / Gizzi Code process on your machine | Desktop app or `gizzi-code serve` running |
| `cloud` | On the always-on Gizzi Code daemon | `gizzi-code serve` installed as a background service |
| `hybrid` | Cloud triggers, local executes (advanced) | Both daemon and desktop running |

If you do not install the daemon, cloud-domain schedules simply will not run. The system will not silently fall back to local execution.

## How domain routing works

When a routine or loop is created or updated, the platform uses the `execution_domain` field to decide where the schedule is registered:

| Domain | API behavior | Where it runs |
|--------|--------------|---------------|
| `local` | No daemon job is created. The schedule is exposed via `GET /api/v1/automation/local-schedules` for the desktop / Gizzi Code local scheduler to poll and execute. | Allternit Desktop or Gizzi Code process on the user's machine |
| `cloud` | A job is created in the Gizzi Code daemon via `POST /cron/jobs`. The daemon triggers the job directly. | `gizzi-code serve` daemon |
| `hybrid` | Currently routed the same as `cloud`. The daemon triggers execution; future versions may dispatch back to the local agent. | `gizzi-code serve` daemon |

Manual runs through the API (`POST /automation/routines/:id/run` and `POST /automation/loops/:id/run`) return HTTP 501 for local-domain schedules, because local execution must be driven by the local scheduler, not the cloud API.

Changing a schedule's domain after creation is supported: the platform creates or deletes the daemon job as needed and clears or sets `gizzi_job_id` accordingly.

## What the daemon needs

To run continuously, the daemon needs:

1. **A machine that stays on** (VPS, server, always-on desktop, container).
2. **Network access** to:
   - The Allternit API (`cmd/allternit-api`) on `http://127.0.0.1:8013` by default.
   - The target endpoints/machines for http/shell/cowork jobs.
3. **Permission to run as a background service**:
   - Linux: `systemd` service.
   - macOS: `launchd` user agent or daemon.
   - Windows: Windows Service (future).
4. **A `GIZZI_SERVER_PASSWORD`** to secure the server (the install wizard generates one).

## Build the daemon binary

From the repository root:

```bash
cd cmd/gizzi-code
bun run build
```

The binary is produced at:

```
cmd/gizzi-code/dist/gizzi-code
```

For a packaged desktop app, the binary is also placed at:

```
surfaces/allternit-desktop/resources/bin/gizzi-code
```

## Install as an always-on service (recommended: wizard)

The easiest way is the interactive setup wizard:

```bash
./cmd/gizzi-code/scripts/install-daemon.sh
```

The wizard will:

1. Ask for explicit permission to enable cloud scheduling.
2. Find the bundled or built `gizzi-code` binary.
3. Prompt for the Allternit API URL (default `http://127.0.0.1:8013`).
4. Set a `GIZZI_SERVER_PASSWORD`.
5. Install the correct service file for your OS.
6. Start the service and verify it responds on `http://127.0.0.1:4096/health`.

### Unattended / automated installs

If you are automating setup (e.g. server provisioning), set the required values as environment variables and run:

```bash
export GIZZI_DAEMON_UNATTENDED=true
export GIZZI_BINARY=/usr/local/bin/gizzi-code
export GIZZI_SERVER_PASSWORD=$(openssl rand -base64 32)
export ALLTERNIT_API_URL=http://127.0.0.1:8013
./cmd/gizzi-code/scripts/install-daemon.sh
```

### Manual install (macOS launchd)

1. Build the binary (or use the bundled one).
2. Copy the plist template and fill in the binary path and password:

```bash
mkdir -p ~/Library/Logs/Allternit
mkdir -p ~/Library/LaunchAgents
sed \
  -e "s|{{GIZZI_BINARY}}|/path/to/gizzi-code|g" \
  -e "s|{{GIZZI_PASSWORD}}|your-password|g" \
  -e "s|{{LOG_DIR}}|${HOME}/Library/Logs/Allternit|g" \
  cmd/gizzi-code/scripts/com.allternit.gizzi.plist \
  > ~/Library/LaunchAgents/com.allternit.gizzi.plist

launchctl load ~/Library/LaunchAgents/com.allternit.gizzi.plist
launchctl start com.allternit.gizzi
```

### Manual install (Linux systemd)

1. Build or copy the binary:

```bash
sudo cp cmd/gizzi-code/dist/gizzi-code /usr/local/bin/gizzi-code
sudo chmod +x /usr/local/bin/gizzi-code
```

2. Install the service file:

```bash
sudo mkdir -p /var/log/allternit-gizzi
sudo sed \
  -e "s|{{GIZZI_BINARY}}|/usr/local/bin/gizzi-code|g" \
  -e "s|{{GIZZI_PASSWORD}}|your-password|g" \
  cmd/gizzi-code/scripts/allternit-gizzi.service \
  > /etc/systemd/system/allternit-gizzi.service

sudo systemctl daemon-reload
sudo systemctl enable --now allternit-gizzi
```

3. Verify:

```bash
sudo systemctl status allternit-gizzi
sudo journalctl -u allternit-gizzi -f
curl http://127.0.0.1:4096/health
```

### Docker / container platforms

A minimal `Dockerfile` example:

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY cmd/gizzi-code/dist/gizzi-code /usr/local/bin/gizzi-code
ENV GIZZI_SERVER_PASSWORD=${GIZZI_SERVER_PASSWORD}
ENV ALLTERNIT_API_URL=http://api:8013
EXPOSE 4096
CMD ["gizzi-code", "serve", "--hostname", "0.0.0.0", "--port", "4096", "--print-logs"]
```

Run with:

```bash
docker run -d \
  --name allternit-gizzi \
  -e GIZZI_SERVER_PASSWORD=$GIZZI_SERVER_PASSWORD \
  -p 127.0.0.1:4096:4096 \
  allternit-gizzi:latest
```

## How setup asks for permission

The Allternit Platform installer and onboarding wizard expose daemon installation as an **explicit, opt-in step**:

1. During setup, the user sees:
   - "Do you want to enable cloud scheduling?"
   - Explanation: "This installs a small background service that runs scheduled tasks even when your desktop app is closed."
   - Resource note: "Requires an always-on machine or server."
2. If the user chooses **Yes**:
   - The installer finds or builds the `gizzi-code` binary.
   - Creates the service file.
   - Prompts for the API URL and sets a server password.
   - Starts the service.
3. If the user chooses **No**:
   - Cloud scheduling is skipped.
   - The UI still allows creating schedules, but defaults new schedules to `local` domain.
   - A clear banner explains: "Cloud scheduling is not configured."

This mirrors how Claude Code's cloud tasks work: the user must explicitly opt in to cloud-backed execution, and the agent cannot silently schedule work in the cloud without consent.

## CLI reference

```bash
gizzi-code serve [OPTIONS]

Options:
  --hostname <HOST>   Hostname to bind [default: 127.0.0.1]
  --port <PORT>       Port to bind [default: 4096]
  --print-logs        Print logs to stderr
  --log-level <LEVEL> DEBUG | INFO | WARN | ERROR
```

Cron management while the daemon is running:

```bash
gizzi-code cron status
gizzi-code cron list
gizzi-code cron add --name "Daily report" --type agent --schedule "0 9 * * *" --prompt "Summarize yesterday's commits"
gizzi-code cron run <id>
gizzi-code cron pause <id>
gizzi-code cron resume <id>
gizzi-code cron remove <id>
```

## Security notes

- Store `GIZZI_SERVER_PASSWORD` in the OS keychain or secret manager, not in plain text.
- Run the daemon with the least privilege necessary.
- The daemon binds to loopback by default. Only change `--hostname` to `0.0.0.0` if you have network-level auth.
- Cloud agent jobs run with the daemon's environment; restrict which users can create or modify cloud schedules.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cloud schedules never fire | Daemon not running | Check service status with `systemctl` or `launchctl` |
| API returns 502/connection refused for cloud run | `cron_daemon_url` misconfigured | Verify `ALLTERNIT_API_URL` and the daemon port |
| Daemon fails to start | Port 4096 in use | Stop the other process or use `--port` |
| Cron jobs not listed | Cron service failed to init | Check `gizzi-daemon.error.log` |

## Next steps

- Add the daemon install step to `scripts/install.sh`.
- Add a cloud-scheduler card to the Allternit Platform onboarding UI.
- Add a Windows service installer and PowerShell wizard.
