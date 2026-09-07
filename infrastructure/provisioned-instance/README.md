# Provisioned per-subscription instance init

`init.sh` is the first-boot contract for the P2 per-subscription provisioning
lane — one unprivileged Incus container per paid subscription (decisions
A3/D2/D3 in `docs/architecture/2026-09-03-control-plane-data-plane-decision.md`).
The cloud-api provisioning service
(`cmd/allternit-cloud-api/src/services/provisioning.rs`) embeds this file and
ships it to the container as cloud-init user-data:

```yaml
#cloud-config
write_files:
  - path: /usr/local/sbin/allternit-node-init
    owner: root:root
    permissions: '0755'
    content: |
      <init.sh, embedded at provisioning-service build time>
runcmd:
  - env ALLTERNIT_PROVISIONED_INSTANCE_ID=… ALLTERNIT_PAIRING_CODE=… … /usr/local/sbin/allternit-node-init
```

Parameters travel as environment variables — the DevPod "options as env"
contract the ADR adopts. Incus applies `user.user-data` on first container
start; every re-provision gets a fresh container, so no upgrade-in-place path
is needed for v1.

## What the script does (six steps)

1. **Dependencies** — curl, ca-certificates, openssl, python3 (python3 is part
   of the contract: the pairing dance parses JSON and does base64url).
2. **Install + pin allternit-api** — `$ALLTERNIT_NODE_RELEASE_URL` must be a
   `.tar.gz` whose archive root contains the `allternit-api` binary;
   `$ALLTERNIT_BINARY_SHA256` pins the digest and is verified before install.
   The provisioning service should always pass the pin.
3. **Phone home / pairing** — generates an Ed25519 keypair, calls
   `POST /api/v1/runtime-pairings` with `runtimeType: "provisioned"` and the
   one-time `provisionedBootstrapToken` (the pairing code), then exchanges the
   pairing (signing `allternit-runtime-pairing:<pairingId>:<challenge>`). The
   exchange returns the long-lived device credential and the node id
   (`rt_…`); both land in `/etc/allternit-node/env` (mode 0600). Server-side,
   the exchange binds the new `runtime_devices` row (`kind='provisioned'`) to
   the `provisioned_instances` row and flips it to `running`. This is the only
   registration path — **no inbound ports** (ADR A1, DevPod agent-phones-home).
4. **Mesh join (optional)** — `tailscale up` with the operator-supplied
   Headscale pre-auth key. Best-effort: the outbound WebSocket relay remains
   the primary control path.
5. **Supervisor** — systemd units when systemd is PID 1 (standard Incus Ubuntu
   images): `allternit-node.service` runs a restart loop that also
   **heartbeats `POST /api/v1/runtime-devices/:id/heartbeat` every 60 s**, so
   the fleet scheduler's status enum and the node registry's `last_seen_at`
   stay honest. Without systemd the loop is started detached (no boot
   persistence — fleet images should use systemd).
6. **Daily backup hook** — `allternit-node-backup.timer` (systemd) snapshots
   the SQLite data dir (`/var/lib/allternit-node`, decision D3: per-customer
   instance = per-customer SQLite) and invokes `$ALLTERNIT_BACKUP_COMMAND`
   with the snapshot path as `$1`.

### Backup contract (restic/rclone-agnostic)

Nothing about a specific backup tool is hardcoded:

- `ALLTERNIT_BACKUP_COMMAND` — arbitrary command; receives the snapshot path
  as `$1`. Point it at e.g. a wrapper doing `restic backup "$1"` or
  `rclone copy "$1" remote:…`.
- Upload credentials live in `/etc/allternit-node/backup.env` (mode 0700),
  provisioned by ops out of band. The script never writes credentials.

### Health reporting

Liveness is the existing heartbeat mechanism: the supervisor loop POSTs the
device heartbeat every 60 s, which stamps `runtime_devices.last_seen_at`.
Node resolution (`services/node_resolution.rs`) and the pairing UI already
treat `last_seen_at` within the 120 s staleness window as "online", so the
provisioned node becomes routable the moment init step 3 completes and stays
honest while the container runs.

## Status: contract implemented, fleet pending

- The script is exercised only by review + shellcheck so far. A real end-to-end
  run needs: a fleet host registered in `provisioned_hosts`, the pinned
  `allternit-node` Incus image on that host, and a published
  `allternit-api` release tarball.
- The release URL the service defaults to is a placeholder
  (`ALLTERNIT_NODE_RELEASE_URL`); production must set it (and the sha256 pin)
  before any create() call reaches a live host.
