# Headscale ops runbook

App: `allternit-headscale` on Fly.io (region `lax`). Server URL:
`https://allternit-headscale.fly.dev`. Pinned image: `headscale/headscale:0.29.2`
(config schema verified against the v0.29.2 `config-example.yaml`).

All admin commands run inside the machine over the headscale unix socket:

```sh
fly ssh console -a allternit-headscale -C "headscale <command>"
```

## First deploy

```sh
cd infrastructure/mesh/headscale

fly apps create allternit-headscale
fly volumes create headscale_data --region lax --size 1 -a allternit-headscale
fly deploy -a allternit-headscale

# smoke test
curl -s https://allternit-headscale.fly.dev/health   # expect OK
fly logs -a allternit-headscale
```

Note: exactly one machine per volume — `min_machines_running = 1` and the
SQLite DB mean this app is single-machine by design. Do not scale past 1.

## Customer onboarding (per-customer isolation)

One headscale **user** per customer; devices join that user's namespace with
a preauth key.

```sh
# 1. create the user (use the platform customer ID as the name)
fly ssh console -a allternit-headscale -C "headscale users create cust_abc123"

# 2. mint a preauth key for device enrollment
#    --user accepts the user name or numeric ID
#    reusable: multiple devices (desktop + iOS) can enroll with one key
#    ephemeral: node auto-deletes when it goes offline (good for CI/VPS throwaway)
#    --expiration: how long the KEY stays valid for enrollment (not the node)
fly ssh console -a allternit-headscale -C \
  "headscale preauthkeys create --user cust_abc123 --reusable --expiration 720h"

# one-shot ephemeral key variant:
fly ssh console -a allternit-headscale -C \
  "headscale preauthkeys create --user cust_abc123 --ephemeral --expiration 1h"

# list keys for a user
fly ssh console -a allternit-headscale -C "headscale preauthkeys list --user cust_abc123"

# revoke a key before expiry
fly ssh console -a allternit-headscale -C "headscale preauthkeys expire --user cust_abc123 --key <key>"
```

Recommended defaults for the platform integration later: `--reusable` keys
with a short `--expiration` (hours/days), minted just-in-time when a customer
pairs a new device. Keys are enrollment credentials — store them like secrets
and expire them aggressively.

## Node administration

```sh
# list all nodes (all users)
fly ssh console -a allternit-headscale -C "headscale nodes list"

# filter to one customer
fly ssh console -a allternit-headscale -C "headscale nodes list --user cust_abc123"

# delete a node (forces re-enrollment with a fresh key)
fly ssh console -a allternit-headscale -C "headscale nodes delete --identifier <node-id>"

# manually expire a node's session
fly ssh console -a allternit-headscale -C "headscale nodes expire --identifier <node-id>"
```

## How gizzi-code connects (desktop / VPS)

Classic tailscaled:

```sh
tailscale up --login-server https://allternit-headscale.fly.dev --auth-key <preauth-key>
```

Embedded tsnet (Go) — same control URL, key passed directly:

```go
srv := &tsnet.Server{
    Hostname:   "gizzi-" + deviceID,
    ControlURL: "https://allternit-headscale.fly.dev",
    AuthKey:    preauthKey, // minted by allternit-cloud-api via the CLI/API above
    Dir:        stateDir,   // persists node key across restarts
}
```

## How the iOS app connects (embedded tsnet)

Same shape: tsnet in the app binary with `ControlURL` set to
`https://allternit-headscale.fly.dev` and an `AuthKey` fetched from the
platform (allternit-cloud-api) at pair time. Persist tsnet state in the app's
container so the node keeps its 100.64.x.x identity across launches. iOS
nodes should use non-ephemeral keys (the node should survive app restarts);
desktop CI/VPS nodes can use ephemeral keys.

## Backups

All state lives on the `headscale_data` volume at `/var/lib/headscale`:
`db.sqlite` (+ WAL), `noise_private.key`. Losing the volume = every node must
re-enroll, so back it up.

- Fly keeps automatic daily volume snapshots (retention ~5 days):
  `fly volumes snapshots list vol_xxx -a allternit-headscale`.
- For a manual consistent dump, stop writes first (machine has no sqlite3 CLI;
  the image is minimal). Simplest safe path:

  ```sh
  fly machine stop <machine-id> -a allternit-headscale
  fly sftp -a allternit-headscale get /var/lib/headscale/db.sqlite ./backup/db-$(date +%F).sqlite
  fly sftp -a allternit-headscale get /var/lib/headscale/noise_private.key ./backup/
  fly machine start <machine-id> -a allternit-headscale
  ```

  Brief downtime during the copy; nodes keep working peer-to-peer meanwhile
  (headscale is coordination-only) but no new enrollments happen.

## Upgrades

1. Bump the tag in `Dockerfile` and verify `config.yaml` against that
   release's `config-example.yaml` (headscale changes config keys between
   minor versions — e.g. the 0.25 → 0.26 policy/DNS reshuffle).
2. Take a manual backup (above) — headscale runs DB migrations automatically
   on boot and they are one-way.
3. `fly deploy -a allternit-headscale`, then `fly logs` and
   `curl https://allternit-headscale.fly.dev/health`.

## Known follow-ups / not yet done

- **ACLs / tagging:** per-customer isolation today is only namespace-level
  (users). `policy.path` is empty, so there is no ACL policy restricting
  node-to-node traffic. Before GA, write a HuJSON policy with `tag:customer-*`
  tags and `--tags` on preauth keys, and switch `policy.path` to a file baked
  into the image.
- **Custom domain:** `allternit-headscale.fly.dev` works but leaks the
  provider; consider `mesh.allternit.com` (`fly certs add`). If you change
  `server_url`, existing nodes keep working only until reauth — do it before
  customers enroll.
- **gRPC remote admin:** loopback-only for now; the platform integration will
  either shell out via `fly ssh` (as documented) or we expose gRPC with TLS
  client certs later.
