# Plan — allternit-node-daemon Phase 1 (session/nodedaemon-0912)

1. [ ] Read: cmd/allternit-cloud-api/src/routes/runtime_relay.rs, cmd/agent-daemon/src/index.ts, PR #424 watchdog diff, surfaces/ai.allternit.com fabric panel node rail, runtime_pairing.rs authenticate_runtime_token.
2. [ ] Relay: multi-connection capability-scoped registry in runtime_relay.rs, feature flag default OFF, capability routing, tests.
3. [ ] Daemon: cmd/allternit-node (Rust): WSS connect/auth, envelopes, heartbeat watchdog + backoff, node.core handlers (health, exec, fs, processes, metrics, node.launch), service install/uninstall/status/logs (launchd+systemd).
4. [ ] PWA: capability-aware node status + Start-desktop action in fabric panel.
5. [ ] Verify: cargo test -p allternit-cloud-api; cargo build + daemon unit tests; local integration test vs mock relay; PWA typecheck/build.
6. [ ] Spec doc update in Brain (screen-capture ownership note).
7. [ ] PR, merge (explicit number), ledger attestation on main, cleanup.
