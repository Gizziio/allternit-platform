# Session attestation — session/nodedaemon-0912 (kimi-code)

**Date:** 2026-09-13 (01:18 local) · **Agent family:** kimi-code · **PR:** #465 · **Merge SHA:** `a2552f725c65885f8a8ac77d76e09121bbdd9f97`
**Spec:** `Allternit Brain/Research/specs/allternit-node-daemon.md` — Phase 1 (approved by Eoj; ownership decision recorded in-spec, Brain commit `b021e8a`)

## What was done

Phase 1 of the allternit-node-daemon spec: an always-on node daemon that holds the runtime relay with the reduced `node.core` capability set so a paired machine stays reachable (terminal, files, exec, metrics, launching the desktop app) with Allternit Desktop fully quit. Three components, three commits:

1. **Relay multi-connection registry** (`cmd/allternit-cloud-api/src/routes/runtime_relay.rs`, `runtime_pairing.rs`) — hub moved from one-connection-per-runtime to one connection per advertised `client`; `authenticate` gains optional `client`/`capabilities` (absent = legacy full surface). Requests and socket tunnels route to exactly one connection granting `required_capability` (explicit scope > legacy; smallest set wins; recency tiebreak). Feature flag `ALLTERNIT_RELAY_MULTI_CONNECTION`, default OFF; flag-off behavior is byte-for-byte the old single-connection path and the runtime-devices list response only gains `relayConnections` when the flag is on.
2. **Daemon crate** (`cmd/allternit-node/`, package `allternit-node-daemon`, binary `allternit-node` — the workspace name `allternit-node` was already taken by `infrastructure/vps-node`) — outbound-only relay client identical in protocol to the desktop app (WSS `/api/v1/runtime-relay/connect/:id`, device-token authenticate adopting `runtime-identity.json`, 75s heartbeat watchdog, 1s→30s backoff); `node.core` endpoints served in-process (health, exec, root-scoped fs, processes, metrics, `node.launch`); full `/terminal/*` contract over in-process `portable-pty` panes with scrollback replay; socket tunnels refused (1008); `install|uninstall|status|logs` for launchd (RunAtLoad+KeepAlive LaunchDaemon) and systemd (Restart=always). Uninstall leaves the desktop app untouched; identity kept unless `--purge`.
3. **PWA fabric rail** (`useRuntimes.ts`, `FabricSessionPanel.tsx`, `fabric-session/pages/DashboardPage.tsx`) — capability-aware node status with connection source, presence-aware online status, and the Monitor affordance degrading to "Start desktop" (POST `/api/v1/node/launch` via the device proxy) when only the daemon is connected. Inert while the relay flag is off.

Ownership decision honored throughout: screen capture / phone-remote (port 8477) stays with the desktop app; the daemon advertises no `runtime:remote_control`/`providers:*` capability and 404s capture/ACI/provider paths.

## How it works (short)

The cloud relay keeps a per-runtime list of live connections instead of a single slot. Each relayed request already computes a `required_capability` from its path; with the flag on, that capability selects the connection — daemon for `runtime:terminal`/`execute`/`files`/`connect`, desktop for `runtime:remote_control`/`providers:*`. The daemon speaks the same envelope protocol as the desktop app but answers `node.*` and `/terminal/*` in-process instead of forwarding to a loopback gateway, so nothing inbound is opened on the node.

## Verification evidence

- `cargo test -p allternit-node-daemon` — 17/17 (fs scope confinement, plist/systemd unit shape, exec timeout, real-PTY echo, relay URL/base64, 404-safety; integration: daemon against a mock cloud relay over a real socket asserting the exact envelope sequence — authenticate with client + capability scope, health/exec response envelopes, socket refusal; terminal contract end-to-end).
- `cargo test -p allternit-cloud-api` — 299 passed / 1 failed; the failure (`provision_creates_container_and_instance_record`) is **pre-existing and environmental** (shells out to `docker`, unavailable here — "No such file or directory"); unrelated to this change. New relay tests: flag-off replace parity, flag-on coexistence + same-client reconnect replacement, capability routing, deterministic single-target (no duplicate delivery).
- `cargo build -p allternit-api` green — the `tokio-tungstenite` rustls feature addition for daemon `wss://` unifies safely across the sidecar dependency graph.
- PWA: `tsc --project tsconfig.typecheck.json` clean for touched files (remaining errors pre-exist in unrelated office packages); `vitest run src/components/dispatch src/lib/cloud-control-plane-paths.test.ts` 14/14.
- Post-rebase re-run: daemon 17/17, relay 18/18.

## Incidents / notes

- Rebase onto fast-moving main hit a `.steering/checkpoint.md` conflict with a prior session's checkpoint; resolved by superseding (that session's state lives in its ledger attestation).
- `pnpm install` in the fresh worktree printed the standard "ignored build scripts" notice; no builds were needed from it.

## Honest deferrals

- **Live E2E not verified** (spec acceptance: node online from phone with app quit; real terminal session over the daemon; Start-desktop on a live device): requires the production relay deploy + flag enable. Per the standing gate, **no deploy was run** (no wrangler); the flag ships default OFF so production routing is unchanged until a human enables it. Everything verifiable locally was verified.
- macOS LaunchDaemon caveat: `node.launch` shells `open -na "Allternit Desktop"`; from a root system daemon without an active GUI session the app may not display until login (capture needs the GUI session regardless — non-goal per spec).
- Windows service install is Phase 2+ per spec (not attempted).
- The full-workspace `cargo build` was not run; the touched/affected crates (cloud-api, node-daemon, allternit-api) all build and test green.
