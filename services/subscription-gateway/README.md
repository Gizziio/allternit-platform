# Subscription Gateway

Local-only daemon that turns paid consumer AI subscriptions into addressable
capabilities for Allternit bots and surfaces. Bots request capabilities; the
fabric chooses entitlements; adapters execute them.

## State

All state lives under `~/.allternit/subscriptions/` (override with
`SUBS_GATEWAY_STATE_DIR`):

- `state.db` — SQLite (WAL) task/event/account/token store
- `artifacts/<sha256[0:2]>/<sha256>` — content-addressed, quarantined artifacts
- `policy.yaml` — optional flat-key policy file

## Transport

Default transport is a Unix domain socket at
`~/.allternit/subscriptions/gateway.sock` (mode 0600), always token-authed.
TCP `127.0.0.1:7788` is off unless `SUBS_GATEWAY_TCP=1` and still always
requires a scoped bearer token.

## Keychain requirement (D3)

The daemon refuses to start without access to the local macOS Keychain
(service `com.allternit.subscription-gateway`): caller tokens and the at-rest
master key live there, never in files. It must never run on cloud
infrastructure — user sessions are never hosted server-side.
