# Cloud Scheduler Setup Guide

## What this is

The **Allternit Cloud Scheduler** (`allternit-scheduler`) is the server-side component that runs scheduled tasks and cron jobs when you are not using the local (desktop) scheduler. It is the equivalent of Anthropic's cloud task/cron infrastructure for Claude Code: a long-running service that persists schedules in the platform database and triggers them at the right wall-clock time.

Because this is a server-side process, it must be installed as an **always-on binary** — exactly like the scheduler binary we already built. This document outlines how to do that with explicit user consent and clear permissions.

## Important: this is opt-in, not a fallback

Cloud scheduling is **not** a fallback for the local scheduler. When you create a schedule you choose its execution domain:

| Domain | Runs where | Requires |
|--------|-----------|----------|
| `local` | Inside the Allternit Desktop / Gizzi Code process on your machine | Desktop app running |
| `cloud` | On the Allternit Cloud Scheduler service | Scheduler service installed and running |
| `hybrid` | Cloud triggers, local executes (advanced) | Both desktop and cloud scheduler running |

If you do not install the cloud scheduler, cloud-domain schedules simply will not run. The system will not silently fall back to local execution.

## What the scheduler needs

To run continuously, the scheduler needs:

1. **A machine that stays on** (VPS, server, always-on desktop, container).
2. **Network access** to:
   - The platform database (SQLite file or PostgreSQL).
   - The control-plane API (`cmd/allternit-cloud-api` or `cmd/allternit-api`), when using `--execution-mode api`.
   - The target machines/endpoints, when using `--execution-mode local`.
3. **Permission to run as a background service**:
   - Linux: `systemd` service.
   - macOS: `launchd` user agent or daemon.
   - Windows: Windows Service (future).
4. **Database credentials** and, in API mode, an operator API key.

## Build the scheduler

From the repository root:

```bash
cargo build --release -p allternit-scheduler
```

The binary is produced at:

```
target/release/allternit-scheduler
```

## Install as an always-on service

We provide platform-specific service definitions in `infrastructure/scheduler/services/`.

### Linux (systemd)

1. Copy the binary to a permanent location:

```bash
sudo cp target/release/allternit-scheduler /usr/local/bin/allternit-scheduler
sudo chmod +x /usr/local/bin/allternit-scheduler
```

2. Create a config directory and place your environment file:

```bash
sudo mkdir -p /etc/allternit-scheduler
sudo tee /etc/allternit-scheduler/env <<'EOF'
ALLTERNIT_SCHEDULER_DATABASE_URL=sqlite:///var/lib/allternit/allternit-cloud.db
ALLTERNIT_SCHEDULER_API_URL=http://127.0.0.1:3001
ALLTERNIT_SCHEDULER_API_KEY=your-operator-api-key
ALLTERNIT_SCHEDULER_POLL_INTERVAL_SECS=60
ALLTERNIT_SCHEDULER_EXECUTION_MODE=api
EOF
```

3. Install the systemd service:

```bash
sudo cp infrastructure/scheduler/services/allternit-scheduler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now allternit-scheduler
```

4. Verify it is running:

```bash
sudo systemctl status allternit-scheduler
sudo journalctl -u allternit-scheduler -f
```

### macOS (launchd)

1. Copy the binary:

```bash
sudo cp target/release/allternit-scheduler /usr/local/bin/allternit-scheduler
```

2. Install the launchd plist as a user agent (runs while you are logged in):

```bash
mkdir -p ~/Library/LaunchAgents
cp infrastructure/scheduler/services/com.allternit.scheduler.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.allternit.scheduler.plist
launchctl start com.allternit.scheduler
```

For a system-wide daemon that runs even when no user is logged in, place the plist in `/Library/LaunchDaemons/` and configure a dedicated user.

### Docker / container platforms

A minimal `Dockerfile` example:

```dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY allternit-scheduler /usr/local/bin/allternit-scheduler
ENV ALLTERNIT_SCHEDULER_DATABASE_URL=sqlite:///data/allternit-cloud.db
ENV ALLTERNIT_SCHEDULER_API_URL=http://api:3001
ENV ALLTERNIT_SCHEDULER_EXECUTION_MODE=api
CMD ["allternit-scheduler"]
```

Run with:

```bash
docker run -d \
  --name allternit-scheduler \
  -e ALLTERNIT_SCHEDULER_API_KEY=$ALLTERNIT_OPERATOR_API_KEY \
  -v allternit-data:/data \
  allternit-scheduler:latest
```

## How setup asks for permission

The Allternit Platform installer and onboarding wizard expose cloud scheduler installation as an **explicit, opt-in step**:

1. During setup, the user sees:
   - "Do you want to enable cloud scheduling?"
   - Explanation: "This installs a small background service that runs scheduled tasks even when your desktop app is closed."
   - Resource note: "Requires an always-on machine or server."
2. If the user chooses **Yes**:
   - The installer copies the binary.
   - Creates the service file.
   - Prompts for the database URL and API key.
   - Starts the service.
3. If the user chooses **No**:
   - Cloud scheduling is skipped.
   - The UI still allows creating schedules, but defaults new schedules to `local` domain.
   - A clear banner explains: "Cloud scheduling is not configured."

This mirrors how Claude Code's cloud tasks work: the user must explicitly opt in to cloud-backed execution, and the agent cannot silently schedule work in the cloud without consent.

## CLI reference

```bash
allternit-scheduler [OPTIONS]

Options:
  -d, --database-url <DATABASE_URL>            Database URL [default: sqlite://allternit-cloud.db]
      --api-url <API_URL>                      Control plane API URL [default: http://localhost:3001]
      --api-key <API_KEY>                      API key for authentication
      --poll-interval-secs <SECS>              Polling interval [default: 60]
      --misfire-policy <POLICY>                ignore | fire_once | fire_all [default: fire_once]
      --execution-mode <MODE>                  api | local [default: api]
      --once                                   Run once and exit (for testing)
  -h, --help                                   Print help
```

## Security notes

- Store the operator API key in a secret manager or OS keychain, not in plain text.
- Run the scheduler with the least privilege necessary.
- In `local` execution mode, the scheduler spawns commands directly; restrict which users can create or modify schedules.
- Use PostgreSQL rather than SQLite for multi-replica or high-availability deployments.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Schedules never fire | Scheduler not running | Check service status with `systemctl` or `launchctl` |
| API mode returns 401 | Missing/invalid API key | Set `ALLTERNIT_SCHEDULER_API_KEY` |
| Database locked (SQLite) | Multiple scheduler instances | Use PostgreSQL or run only one instance |
| Misfires after downtime | Clock skew or long outage | Check misfire policy and logs |

## Next steps

- Add the scheduler install step to `scripts/install.sh`.
- Add a cloud-scheduler card to the Allternit Platform onboarding UI.
- Add health-check endpoint to the scheduler and expose it in the platform status page.
