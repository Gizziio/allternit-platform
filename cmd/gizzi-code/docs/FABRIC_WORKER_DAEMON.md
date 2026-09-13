# Gizzi Fabric-Transport Worker — Daemon Install (P-T3)

The gizzi fabric-transport worker is the A:// worker that claims queued jobs
from `allternit-api`'s Fabric Transport and executes their steps. This is the
end-to-end install flow for running it as an always-on daemon
(`GIZZI_WORKER_SPEC.md` §5; claim protocol unchanged — this is packaging
only).

## 0. Prerequisites

- `bun` installed and on the daemon user's `PATH` (macOS: `brew install oven-sh/bun/bun`).
- A running `allternit-api` the worker can reach (`ALLTERNIT_API_URL`,
  default `http://127.0.0.1:8013`).
- The gizzi-code checkout at a stable path (the daemon's `WorkingDirectory`).
- Optional, VM mode only: Lima installed (`brew install lima`) and the
  `allternit` instance template available (`src/runtime/vm/allternit.yaml`).

## 1. Provision the worker identity (once)

The worker authenticates as its workspace principal with a bearer token.
Provision it once (the token is shown exactly once):

```bash
API=http://127.0.0.1:8013
PRINCIPAL="a%3A%2F%2Fworkspace%2F<workspace>%2Fprincipal%2Fgizzi"   # URL-encoded principal id

curl -s -X POST "$API/api/v1/fabric/transport/principals/$PRINCIPAL/provision-token" \
  -H "Authorization: Bearer <your user session>"
# → { "principal_id": "...", "token": "atok_..." }
```

Write the token to a mode-0600 file (the daemon reads it via
`ALLTERNIT_GIZZI_TOKEN_FILE`; `ALLTERNIT_GIZZI_TOKEN` also works for
one-off runs):

```bash
sudo mkdir -p /etc/allternit/gizzi-worker
sudo install -m 0600 /dev/null /etc/allternit/gizzi-worker/token
sudoedit /etc/allternit/gizzi-worker/token        # paste atok_...
```

## 2. Declare capabilities (VM mode only)

The default gizzi principal carries `compute.local`. If this daemon runs
with `GIZZI_COMPUTE_MODE=vm`, declare the VM capability so placement (§8.8)
routes `compute: vm` jobs here:

```bash
curl -s -X PUT "$API/api/v1/fabric/transport/principals/$PRINCIPAL/capabilities" \
  -H "Authorization: Bearer <your user session>" \
  -H "Content-Type: application/json" \
  -d '{"capabilities":["shell.exec","git.read","git.write","files.project.read",
       "files.project.write","artifact.create","artifact.modify","memory.read",
       "memory.write","compute.local","compute.vm"]}'
```

## 3. Smoke-test in the foreground

```bash
cd <gizzi-code checkout>
ALLTERNIT_API_URL=$API ALLTERNIT_GIZZI_TOKEN_FILE=/etc/allternit/gizzi-worker/token \
  bun src/runtime/fabric-transport/worker-daemon-entry.ts
# one JSON event per line; Ctrl-C exercises the graceful stop
```

## 4. Install as a service

### macOS — launchd

```bash
cp packaging/launchd/com.allternit.gizzi-worker.plist ~/Library/LaunchAgents/
# edit WorkingDirectory (+ token/log paths if non-default)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.allternit.gizzi-worker.plist
launchctl kickstart -k gui/$(id -u)/com.allternit.gizzi-worker
```

Logs: `/usr/local/var/log/gizzi-worker.log` (structured JSON lines).
Stop/uninstall: `launchctl bootout gui/$(id -u)/com.allternit.gizzi-worker`
and remove the plist.

### Linux — systemd

```bash
sudo cp packaging/systemd/gizzi-worker.service /etc/systemd/system/
sudo mkdir -p /var/log/gizzi-worker /etc/allternit/gizzi-worker
# edit WorkingDirectory (+ paths) for this checkout
sudo systemctl daemon-reload
sudo systemctl enable --now gizzi-worker
```

Logs: `journalctl -u gizzi-worker -f` (also mirrored to
`/var/log/gizzi-worker/worker.log`). Stop: `sudo systemctl stop gizzi-worker`.

## 5. Operational notes

- **Backoff:** claim/transport errors back off exponentially
  (1s → 2s → … → 30s cap, jittered) and reset on the next successful claim.
- **Graceful stop:** `SIGTERM`/`SIGINT` stops claiming; an in-flight job is
  finished first (claim long-poll returns within its ≤25s window). A lease
  abandoned this way is released by the standard lease-expiry path — the
  sweeper requeues the job within ~`ALLTERNIT_GIZZI_LEASE_SECS` (default
  60s). The worker never completes another principal's work.
- **Lease tuning:** `ALLTERNIT_GIZZI_LEASE_SECS` (default 60) sizes the
  heartbeat interval (lease/3) and the worst-case requeue delay after a
  crash or stop.
- **Restart policy:** both units restart the worker automatically
  (`KeepAlive` / `Restart=always`). Restarts do not affect the claim
  protocol: claiming is idempotent and lease ownership is decided by the
  control plane's CAS.
