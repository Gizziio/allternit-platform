# Steering checkpoint — merged state

> Merged from two parallel session checkpoints: `session/befe7aa3` (CLI Bot Mode
> parity B1–B5, this worktree) and `session/bots-p03` (BOT_TEAMMATES_SPEC
> Phase 3 cross-machine fabric). Both sections are final — neither session has
> open work in this file.

## session/settings-fix — settings event-storm stack overflow crash fix

### Goal
Fix the renderer-killing `RangeError: Maximum call stack size exceeded` in the
Electron desktop app, rooted in `useSettingsState.ts`: any runtime write of a
settings key that a mounted component reads via `useSettingsValue` looped
writer → `allternit:setting-changed` → reread → writer synchronously.
Worktree: `allternit-session-settingsfix`, branch `session/settings-fix` from
`origin/main`. NO git commit/push (orchestrator instruction).

### Just did (2026-09-07)
- `surfaces/ai.allternit.com/src/hooks/useSettingsState.ts`:
  - `setPersistedValue` updater: `Object.is(resolved, prev)` no-op guard —
    unchanged values skip `setItem` + `dispatchEvent` (the recursion root).
  - `useSettingsValue.reread()`: `lastAppliedRef` guard — skip the writer call
    when the freshly parsed value is `Object.is`-equal to the last applied one
    (defense in depth).
- NEW `src/hooks/useSettingsState.test.tsx` (3 tests): same-value write from
  outside React batching dispatches ZERO events (unfixed code stormed ~2063);
  real changes propagate (≤2 events, correct value + storage); manual
  localStorage write + event is picked up. Test installs a working in-memory
  localStorage because `vitest.setup.ts` globally stubs it to a no-op.

### Verification
- Targeted: 3/3 pass with fix; 2 fail against unfixed source (2063-event
  storm) — regression signal confirmed.
- `npx tsc --noEmit`: clean, zero errors.
- Full `npx vitest run`: 1393 passed / 4 failed / 14 skipped. Failures = the
  known fabric-session-kind (1) + bot-allternit-bus (3, pre-existing
  environmental: immer 11.1.4 from a cross-worktree pnpm resolution needs
  `enableMapSet()`; confirmed failing with my changes stashed). No worse than
  baseline, and none in touched files.

### Next
- Report results to orchestrator; no commit/push per instruction. Orchestrator
  handles merge + ledger attestation.

### Open questions / notes
- All current `useSettingsValue`/`useSettingsState` callers use primitive
  values (booleans/strings/enums), fully covered by the `Object.is` guards.
  Object-valued keys would still re-dispatch per write (fresh `JSON.parse`
  references never satisfy `Object.is`); if object settings are ever added,
  consider a `JSON.stringify` content comparison in the no-op guard.
- The synchronous overflow only manifests outside React's `act` batching
  (React's eager updater evaluation); inside `act` the same write stormed
  ~2000 events without overflowing, which is why the test asserts event
  counts rather than expecting a RangeError.


## session/befe7aa3 — CLI Bot Mode parity (Phases B1–B5 of docs/GIZZI_BOT_MODE_SPEC.md)

### Goal
Implement CLI Bot Mode parity in the gizzi-code CLI, coordinated with — but not
overlapping — the parallel platform-track sessions. CLI track only.

### Just did (2026-09-07) — ALL 5 PHASES CODE-COMPLETE + all 3 known limitations closed
- Spec: `docs/GIZZI_BOT_MODE_SPEC.md` (D1–D7 decisions; benchmarked on Hermes
  Bot Mode docs + platform BOT_TEAMMATES_SPEC; same failure codes, same
  attribution string).
- B1: `src/runtime/bots/bot-store.ts` + `gizzi bot` command group.
- B2: `src/runtime/bots/canonical-chat.ts` + `capability-epoch.ts`; persona
  injection in `src/runtime/session/prompt.ts` (TUI + headless); `/new`→compact
  composer guard; `gizzi bot chat <name> [message]`. app.tsx now honors
  `--session` id (pre-existing bug).
- B3: `src/runtime/bots/bot-routines.ts` — `[bot:<name>]` namespace, cron
  agent-executor `config.bot` delivery into canonical session (never
  Session.createNext), catch-up fires, daemon stays non-blocking.
- B4: `failure-reasons.ts` (13-code port, once/after_compact/never), typed
  retry on routine delivery, `message_agent` tool (canonical chats only, gated
  in resolveTools), durable `inbox.jsonl` per bot, turn-start pickup with exact
  platform attribution, `## Teammates` + `## Messaging protocol` prompt sections.
- B5: `bot-presence.ts` (90s window), `bot-roster.ts` (unread = inbox +
  watermark deltas), `/bots` TUI pane (presence dot, unread badge,
  open/create/delete/refresh).
- F1: cron `runs.reason` real column + pragma-guarded `ALTER TABLE` migration,
  threaded through saveRun/rowToRun; agent-executor sets reason on both failure
  paths.
- F2: chat-unread without Instance — `src/runtime/bots/session-db.ts`, direct
  drizzle COUNT on the session store.
- F3: REPL transcript reload on pane open — `setResumeHandler`/`getResumeHandler`
  registry in bootstrap/state.ts, `openBotCanonicalChat` hands off with
  entrypoint `'bots_pane'`, falls back to switchSession.

### Verification
- `bun run typecheck`: zero errors.
- Final combined sweep: 162 pass / 0 fail across bots + cli + commands tests.
- Real `~/.local/share/gizzi-code/gizzi.db` verified clean of test rows.

### Next
- Merged to main; ledger attestation; worktree cleanup.

### Future (not this session)
- Group deliberation rooms + cross-machine peer fabric (platform phases first).

## session/bots-p03 — BOT_TEAMMATES_SPEC Phase 3: Cross-machine fabric (merged verbatim)

### Goal
Implement Phase 3 (AD-1 direct peer model) in worktree allternit-session-bots-p03:
remote peer registry (url + keyRef, keys in <data_dir>/.allternit/peers.env), dm/run/status/stop
over HTTP inbox with idempotency keys + 900s TTL, fail-fast runtime_offline, run
bookkeeping persisted to peer-runs.json, union roster with ghost retention, and a
minimal surface panel (src/lib/peers/* + small ShellRail integration point).
NO git commit/push (orchestrator instruction overrides AGENTS.md session lifecycle).

### Just did
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

### Next
- Done. Awaiting steering review; orchestrator merges (no commit/push per instruction).

### Open questions
- Reply contract for the receiving agent is a documented protocol footer in the
  delivered envelope (reply via SendMessage to peer 'fabric-replies' with body
  `@run <id> <reply>`); gizzi-code auto-reply wiring is deliberately left to
  integration (same bucket as Hermes desktop-relay adoption).

### Deviations
- surfaces/node_modules symlink skipped: shared checkout has no surfaces/node_modules
  (only per-surface dirs); created root + surfaces/ai.allternit.com symlinks.
- dm is held on the REMOTE (receiving) node, not the caller — matches "hold the
  connection until the remote turn finishes" and removes the need for the caller to
  know its own public URL for dm (run-completion callbacks still use ALLTERNIT_PEER_URL).
- tsc shows 19 pre-existing errors in unrelated files (xterm/univerjs/TerminalWorkspace/
  office views); zero errors in touched files.

### Verification results (final)
- `cargo check -p allternit-api` ✅ clean, zero warnings in remote_peers.rs.
- `cargo test -p allternit-api remote_peers` ✅ 9/9 (idempotency replay+expiry,
  TTL expiry, restart reconciliation, redaction, 401, CRUD+missing_config,
  runtime_offline fail-fast + replay, ghost→reconcile, two-node dm round trip).
- `npx tsc --noEmit` ✅ no new errors (19 pre-existing, none in touched files).
- `npx vitest run` ✅ 1309 passed / 1 failed (fabric-session-kind.test.ts — known
  pre-existing on main) / 14 skipped; my 13 new tests pass.
- `bun run build` ❌ known stale univerjs install (DEFAULT_DOCUMENT_PARAGRAPH_SPACE_BELOW
  missing export) — pre-existing, not fixed per instruction.
