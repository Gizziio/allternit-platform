# Steering checkpoint — session/bots-p03 (BOT_TEAMMATES_SPEC Phase 3: Cross-machine fabric)

## Goal
Implement Phase 3 (AD-1 direct peer model) in worktree allternit-session-bots-p03:
remote peer registry (url + keyRef, keys in <data_dir>/.allternit/peers.env), dm/run/status/stop
over HTTP inbox with idempotency keys + 900s TTL, fail-fast runtime_offline, run
bookkeeping persisted to peer-runs.json, union roster with ghost retention, and a
minimal surface panel (src/lib/peers/* + small ShellRail integration point).
NO git commit/push (orchestrator instruction overrides AGENTS.md session lifecycle).

## Just did
- Rust: NEW cmd/allternit-api/src/remote_peers.rs (~2400 lines incl. tests):
  - Registry: POST/GET/DELETE /api/peers/remote; keys only via keyRef → env/peers.env
    (chmod 600); inline `key` accepted at registration and written to peers.env,
    never echoed. Register kicks a roster refresh.
  - Ops: dm (synchronous — REMOTE node holds the fabric connection until the local
    turn finishes; result rides the held connection back) and run (async 202;
    completion via reply_url callback to ALLTERNIT_PEER_URL/result). status proxies
    the mirror run on the remote; stop forwards + marks stopped.
  - Idempotency: (peer,key) → captured response, 900s TTL, replayed at both the
    management and fabric edges.
  - Runs: in-memory map + light persistence to peer-runs.json (terminal retention
    1h, cap 200); restart reconciliation fails orphaned outbound runs with
    runtime_offline; TTL expiry marks Expired.
  - Roster: GET /api/peers/roster = live local rails peers + remote connections +
    fetched rows; refresh on add + 5-min poll; poll failure keeps last-known rows
    with sourceReachable=false (ghosts); reconcile on reconnect.
  - Security: fabric endpoints require the registered sender's key (constant-time,
    401 unauthorized_peer otherwise); management accepts desktop access-token header,
    registered-peer key, or Clerk JWT. redact() scrubs all known key values from
    errors; keys never logged. Module state lives in a OnceLock registry keyed off
    data_dir (AppState untouched); reply watcher spawned from handlers.
  - Failure codes: runtime_offline (connect), delivery_timeout, peer_rejected,
    peer_not_found, missing_config, expired, server_error.
- Wiring: ONE `pub mod remote_peers;` (lib.rs:200) + ONE
  `.nest("/api", allternit_api::remote_peers::remote_peers_router())` at the END of the
  public route chain (main.rs:838-844). No Cargo.toml changes (reqwest/tokio/serde/
  uuid/chrono/hex/sha2/url already present).
- Rust tests (9, all green): idempotency replay+expiry, TTL expiry, restart
  reconciliation, key redaction, unknown-sender 401, registry CRUD + missing_config,
  fail-fast dm to refused port (runtime_offline + idempotent replay of failure),
  ghost retention → reconcile, and a FULL two-node dm round trip over real axum
  servers (envelope → bus delivery → simulated gizzi reply via fabric-replies
  contract → held connection returns the reply).
- Surface: NEW src/lib/peers/{remote-peers-api.ts, use-remote-peers.ts,
  RemotePeersPanel.tsx} + 13 vitest tests. ShellRail.tsx: ONE import line + ONE
  marked <RemotePeersRailSection /> block after TeammatesRailSection.
- Hook exposes reachabilityByPeer + unreachableSources (ghost-row capability for
  TEAMMATES rows — rendering left for integration, per plan).

## Next
- Done. Awaiting steering review; orchestrator merges (no commit/push per instruction).

## Open questions
- Reply contract for the receiving agent is a documented protocol footer in the
  delivered envelope (reply via SendMessage to peer 'fabric-replies' with body
  `@run <id> <reply>`); gizzi-code auto-reply wiring is deliberately left to
  integration (same bucket as Hermes desktop-relay adoption).

## Deviations
- surfaces/node_modules symlink skipped: shared checkout has no surfaces/node_modules
  (only per-surface dirs); created root + surfaces/ai.allternit.com symlinks.
- dm is held on the REMOTE (receiving) node, not the caller — matches "hold the
  connection until the remote turn finishes" and removes the need for the caller to
  know its own public URL for dm (run-completion callbacks still use ALLTERNIT_PEER_URL).
- tsc shows 19 pre-existing errors in unrelated files (xterm/univerjs/TerminalWorkspace/
  office views); zero errors in touched files.

## Verification results (final)
- `cargo check -p allternit-api` ✅ clean, zero warnings in remote_peers.rs.
- `cargo test -p allternit-api remote_peers` ✅ 9/9 (idempotency replay+expiry,
  TTL expiry, restart reconciliation, redaction, 401, CRUD+missing_config,
  runtime_offline fail-fast + replay, ghost→reconcile, two-node dm round trip).
- `npx tsc --noEmit` ✅ no new errors (19 pre-existing, none in touched files).
- `npx vitest run` ✅ 1309 passed / 1 failed (fabric-session-kind.test.ts — known
  pre-existing on main) / 14 skipped; my 13 new tests pass.
- `bun run build` ❌ known stale univerjs install (DEFAULT_DOCUMENT_PARAGRAPH_SPACE_BELOW
  missing export) — pre-existing, not fixed per instruction.
