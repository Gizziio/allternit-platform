# Steering checkpoint — session/nodedaemon-0912

(Supersedes the console-fe-p6 checkpoint that preceded it on main; that
session's state is recorded in its ledger attestation.)

## Goal
Execute approved spec `allternit-node-daemon` Phase 1: Rust daemon binary (cmd/allternit-node), relay multi-connection registry (feature-flagged, default OFF), launchd/systemd service install, PWA fabric Start-desktop affordance. Land PR + ledger. No deploys.

## Design (decided after code reading)
- Relay: Authenticate gains optional `client` + `capabilities`. Hub becomes Vec of entries per runtime. Flag = env ALLTERNIT_RELAY_MULTI_CONNECTION, read once; attach/select functions take multi as param for testability (no global mutation in tests). Routing: explicit capability sets preferred over legacy full-connections; smallest set wins; recency tiebreak. Flag OFF = replace-first-entry (byte-for-byte current behavior).
- Daemon: package `allternit-node-daemon` (workspace name `allternit-node` is taken by infrastructure/vps-node), bin `allternit-node`. Implements node.* endpoints + the /terminal/* contract (create/input/resize/close/stream SSE) in-process over relay envelopes, portable-pty. client="allternit-node", caps ["node.core","runtime:connect","runtime:execute","runtime:terminal","runtime:files"]. NO capture/8477 (desktop owns phone-remote per Eoj).
- PWA: useRuntimes surfaces relayConnections (flag-on cloud field); Monitor affordance degrades to "Start desktop" (POST /api/v1/node/launch via proxy) when only daemon connected.
- Presence: list_runtime_devices gains relayConnections key ONLY when flag on + non-empty (flag-off response byte-identical).

## Just did
- Relay multi-connection registry implemented + 18/18 runtime_relay tests pass (flag-off parity, capability routing, no-duplication, per-client reconnect replacement).
- full cloud-api suite: 299 passed, 1 failed — `provision_creates_container_and_instance_record` fails with "docker run failed: No such file or directory": PRE-EXISTING env issue (needs docker binary), unrelated to this change.
- Daemon crate complete: config/identity/relay/handlers/terminal/service/launch. 15/15 lib tests (incl. real PTY echo) + 2/2 integration tests (mock relay over a real socket; terminal contract end-to-end).
- PWA: useRuntimes relayConnections + presence-aware status; DashboardPage Start-desktop affordance; Node rail connection-source line.
- Brain spec: ownership decision recorded (desktop owns capture/8477, daemon owns node.core+node.launch), committed b021e8a in the Brain repo.
- Verification: PWA tsc clean for touched files (pre-existing errors only in unrelated office packages); vitest dispatch 14/14; cargo build -p allternit-api green (rustls feature unification).

## Next
- PR, merge, ledger attestation, cleanup per ritual.

## Open questions
- Live E2E (node online from phone with app quit; production relay) is deploy-gated: the flag ships OFF, production routing unchanged until a human enables + deploys.
