# Rails — Unified Agent Communication & Coordination Plan

## Why this name?

The codebase already has **Agent System Rails** (`crates/agent-system/rails`, the `allternit-rails` CLI, and `/api/rails` endpoints).  Rather than invent a new brand, this work turns those existing Rails pieces into the single communication and coordination substrate for every CLI agent (kimi, codex, claude, agy, gizzi-code) that Allternit touches.  The implementation is modular: a Rust crate provides the shared logic, `allternit-rails` is the packaged binary, and thin shell shims keep legacy entry points (`ao-*`, `.steering/bin/*.sh`) working.

## What we are building

A local, same-machine peer network inspired by [Claude Code cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging), but owned by Allternit:

1. **Peer registry** — every agent session registers itself under `.allternit/peers/` with a stable id, display name, working directory, vendor, and inbox socket path.
2. **UDS inbox transport** — peers that bind a real Unix domain socket can receive direct UDS pushes; no messages leave the machine.
3. **HTTP inbox polling** — gizzi-code polls `GET /api/rails/peers/:name/inbox` for envelopes persisted to the durable Bus. This is the default gizzi-code delivery path and avoids Bun/Node UDS quirks.
4. **`ListAgents` / `SendMessage`** — gizzi-code (and any other agent) can discover local peers and send plain-text messages to them through the Rails API or directly over UDS.
4. **Native orchestrator** — `allternit-rails orchestrator spawn|send|watch|status|kill|doctor` replaces the ad-hoc tmux scripts while keeping the same semantics.
5. **Steering hooks** — `allternit-rails steer checkpoint|consult|commit-gate` replaces the `.steering/bin/*.sh` hooks, using Rails messages/consults instead of bespoke tmux rituals.
6. **Backward-compatible shims** — `tools/agent-orchestrator/scripts/ao-*` become one-line callers into `allternit-rails orchestrator` / `steer`.
7. **Documentation** — `tools/agent-orchestrator/SKILL.md`, repo `AGENTS.md`, and this plan are updated to teach the Rails-native workflow.

## Reference surfaces

- Rust crate: `allternit-agent-system-rails`
  - library: `rails/src/lib.rs`
  - CLI binary: `rails/src/bin/allternit-rails.rs`
  - service: `rails/src/service.rs`
- API integration: `cmd/allternit-api/src/rails/mod.rs` (mounted at `/api/rails`)
- Existing mail/bus: `rails/src/mail/`, `rails/src/bus/mod.rs`
- Legacy orchestrator scripts: `tools/agent-orchestrator/scripts/ao-*`
- Legacy steering hooks: `.steering/bin/*.sh`
- Gizzi-code Rails client: `cmd/gizzi-code/src/cli/rails-mail-client.ts`
- Gizzi-code runtime bridge: `cmd/gizzi-code/src/runtime/server/rails-bridge.ts`

## Phase 1 — Peer registry + UDS inbox transport ✅ COMPLETE

### 1.1 Data model

```rust
pub struct Peer {
    pub peer_id: String,          // "peer_<random>"
    pub name: String,             // human addressable name (slug or /rename value)
    pub cwd: PathBuf,
    pub vendor: String,           // "gizzi" | "claude" | "kimi" | "codex" | "agy" | "ao"
    pub inbox_socket: PathBuf,    // .allternit/peers/inbox/<peer_id>.sock
    pub registered_at: String,    // RFC3339
    pub last_heartbeat_at: String,
    pub status: PeerStatus,       // active | idle | dead
}
```

Registry persisted at `.allternit/peers/registry.json` under `ALLTERNIT_DATA_DIR`.

Implemented in:
- `crates/agent-system/rails/src/peer/mod.rs` — `PeerRegistry`
- `crates/agent-system/rails/src/peer/socket.rs` — UDS send/receive
- `cmd/allternit-api/src/rails/mod.rs` — `/api/rails/peers` routes
- `cmd/allternit-api/src/rails_client_impl.rs` — in-process Rails client used by the API

### 1.2 Library module `rails/src/peer/mod.rs`

- `PeerRegistry::new(root_dir)` — loads/creates registry.
- `register(name, cwd, vendor) -> Peer`
- `unregister(peer_id) -> bool`
- `list() -> Vec<Peer>`
- `heartbeat(peer_id) -> Result<()>`
- `resolve(name_or_id) -> Option<Peer>` — exact id first, then exact name, then fuzzy.

### 1.3 UDS inbox `rails/src/peer/socket.rs`

- `PeerSocket::bind(path)` — `tokio::net::UnixListener` that accepts newline-delimited JSON `PeerEnvelope`.
- `PeerSocket::send(socket_path, envelope) -> Result<DeliveryReceipt>` — best-effort UDS client with a short timeout.
- Envelope schema:

```rust
pub struct PeerEnvelope {
    pub message_id: String,
    pub reply_to: Option<String>, // sender inbox socket path
    pub from: String,
    pub to: String,
    pub body: String,
    pub sent_at: String,
}
```

Received messages are appended to the ledger as `PeerMessageReceived` events and also enqueued in the Bus with transport `uds` and recipient `peer:<name>`.

### 1.4 CLI additions (`allternit-rails peer`)

- `peer register <name> --vendor <v> [--cwd <dir>]` — prints peer id + inbox socket.
- `peer unregister <id-or-name>`
- `peer list [--json]`
- `peer heartbeat <id-or-name>`
- `peer inbox <id-or-name>` — foreground socket listener (for debugging).
- `peer send <to> <body>` — UDS send to a peer.

### 1.5 Service state

`ServiceState` and `RailsState` get an `Arc<PeerRegistry>` and an optional `PeerSocket` listener started when `run_service` boots.

## Phase 2 — Bus UDS delivery + `ListAgents` / `SendMessage` API ✅ COMPLETE

### 2.1 Bus delivery loop

A background task in `allternit-rails-service` (and optionally in `allternit-api`) polls `bus.poll_pending_for(..., Some("uds"), ...)` and uses `PeerSocket::send` to deliver to the recipient's socket.  Failure marks the message failed.

### 2.2 Rust service HTTP routes

Implemented in `cmd/allternit-api/src/rails/mod.rs` (mounted at `/api/rails` and `/rails`):

- `GET /peers` → `{ peers: [...] }`
- `POST /peers` → register (body `{ name, cwd, vendor }`)
- `DELETE /peers/:id_or_name` → unregister
- `POST /peers/:id_or_name/heartbeat` → heartbeat
- `POST /peers/:id_or_name/send` → `{ body, from? }` → deliver via UDS/Bus
- `GET /peers/:id_or_name/inbox` → poll pending messages

### 2.3 `cmd/allternit-api` integration ✅

`cmd/allternit-api/src/rails/mod.rs` exposes the peer routes so any local agent can hit `http://127.0.0.1:8013/api/rails/peers`.

### 2.4 Gizzi-code runtime tools ✅

Two runtime tools are implemented in `cmd/gizzi-code/src/runtime/tools/`:

- `ListPeers` (alias `ListAgents`) — `GET /api/rails/peers`, returns name/vendor/cwd/status.
- `SendMessage` (alias `SendMessageToPeer`) — `POST /api/rails/peers/:name/send` with `{ body }`.

Address formats accepted by `SendMessage.to`:
- Plain peer name discovered via `ListPeers` → tries Rails peer, then falls back to teammate mailbox.
- `uds:/path/to.sock` — direct UDS send.
- `bridge:<session_id>` — existing Remote Control inter-session path (requires `UDS_INBOX`).

These mirror Claude's `ListAgents` and `SendMessage` tool names so prompts transfer naturally.

### 2.5 Gizzi-code peer auto-registration ✅

On startup, gizzi-code registers itself as a Rails peer and polls the HTTP inbox for messages:

- `cmd/gizzi-code/src/runtime/gizzi-core/services/railsPeer.ts`
  - `registerRailsPeer(sessionId)` — registers `gizzi-<sessionId>` with the Rails API.
  - `startRailsInboxListener()` — polls `GET /api/rails/peers/:name/inbox` and dispatches incoming envelopes.
- `cmd/gizzi-code/src/cli/ui/ink-app/components/RailsInboxBridge.tsx`
  - Mounts inside the React tree, calls `startRailsInboxListener`, and posts envelopes to the TUI mailbox so `useMailboxBridge` in `REPL.tsx` submits them as new turns.
- Wired into:
  - `cmd/gizzi-code/src/runtime/gizzi-core/setup.ts`
  - `cmd/gizzi-code/src/cli/ui/ink-app/setup.ts`
  - `cmd/gizzi-code/src/cli/ui/ink-app/app.tsx`

Because the `UDS_INBOX` bundle feature is false in local dev, enable the Rails peer path with:

```bash
GIZZI_ENABLE_RAILS_PEER=1 gizzi
```

This sets `ALLTERNIT_RAILS_PEER_NAME` and `ALLTERNIT_RAILS_INBOX` in the environment so other local agents can address the session.

## Phase 3 — Native orchestrator CLI ✅ COMPLETE

Module `rails/src/orchestrator/mod.rs` plus `allternit-rails orchestrator` subcommands.

### 3.1 Commands

- `orchestrator spawn [--worktree] [--vendor <v>] [--mode <m>] <slug> <repo> <cmd>...`
  - Creates tmux session `ao-<slug>` (same as old `ao-spawn`).
  - Calls `PeerRegistry::register` with name `ao-<slug>`.
  - Injects env vars into the pane:
    - `ALLTERNIT_RAILS_PEER_NAME=ao-<slug>`
    - `ALLTERNIT_RAILS_INBOX=<socket>`
    - `ALLTERNIT_RAILS_ROOT=<repo>`
  - Prints `session workdir logfile peer_id inbox_socket`.
- `orchestrator send <slug> <data>`
  - Sends `<data>` to the peer's UDS inbox; falls back to verified tmux paste if the socket is absent.
- `orchestrator watch <slug> <sentinel> [--timeout-seconds <n>]`
  - Blocks until sentinel exists (exit 0), peer dead (exit 3), or timeout (exit 4).
- `orchestrator status [slug] [--lines <n>]`
  - No slug: lists all `ao-*` peers + tmux sessions.
  - With slug: peer info + last pane lines.
- `orchestrator kill <slug> [--rm-worktree]`
  - Kills tmux session, unregisters peer, optionally removes worktree.
- `orchestrator doctor`
  - Verifies tmux/script/git/executors and tries a loopback UDS round-trip.

### 3.2 Notes sentinel

`--notes-sentinel <path>` and `--task-file <path>` allow the old headless one-shot pattern to chain cleanly.

## Phase 4 — Steering commands ✅ COMPLETE

New module `rails/src/steer/mod.rs` plus `allternit-rails steer` subcommands.

- `steer checkpoint [--cwd <dir>]` — hashes `.steering/checkpoint.md`, writes a `SteeringCheckpoint` ledger event, returns true only if the checkpoint changed.
- `steer consult [--cwd <dir>] [--prompt-file <path>]` — builds context from `.steering/prompt.md`, `spec.md`, `checkpoint.md`, git status/diff, then consults the configured steering backend (`STEER_CONSULT_CMD`, `ao-consult`, or `kimi -p`). Returns first-line verdict (`APPROVE`/`STEER`) and full body.
- `steer commit-gate [--cwd <dir>]` — same as consult but specialized for a pending git commit/push; returns exit 0 on APPROVE, exit 2 on STEER.

HTTP surface:
- `POST /v1/steer/checkpoint` (also `/api/rails/steer/checkpoint`)
- `POST /v1/steer/consult`
- `POST /v1/steer/commit-gate`

Implemented in:
- `rails/src/steer/mod.rs`
- `rails/src/service.rs`
- `rails/src/bin/allternit-rails.rs`
- `cmd/allternit-api/src/rails/mod.rs`

The steering hooks (`.steering/bin/steer-stop.sh`, `.steering/bin/steer-pre-commit-gate.sh`) now delegate the actual consult to `allternit-rails steer consult` via the updated `steer_consult` helper in `.steering/bin/steer-common.sh`. They retain their existing CLI-agnostic payload parsing, checkpoint hashing, logging, and block-formatting behavior.

## Phase 5 — `ao-*` shims ✅ COMPLETE

Each script in `tools/agent-orchestrator/scripts/` now delegates to `allternit-rails`:

| Script | Implementation |
|---|---|
| `ao-spawn` | `allternit-rails orchestrator spawn "$@"` |
| `ao-send` | `allternit-rails orchestrator send "$@"` |
| `ao-watch` | `allternit-rails orchestrator watch "$@"` |
| `ao-status` | `allternit-rails orchestrator status "$@"` |
| `ao-kill` | `allternit-rails orchestrator kill "$@"` |
| `ao-doctor` | `allternit-rails orchestrator doctor` |
| `ao-consult` | `allternit-rails steer consult --cwd <repo> --prompt-file <tmp>` |

`ao-consult` was rewritten from a tmux-based persistent `ao-steer` session to a blocking call into the Rails steering coordinator. The old inline tmux logic is preserved only in git history.

## Phase 6 — Gizzi-code SDK wiring ✅ COMPLETE

- `cmd/gizzi-code/src/runtime/services/api/allternitApi.ts` exposes `listApiPeers()`, `registerApiPeer()`, `sendApiPeerMessage()`, and `pollApiPeerInbox()`.
- `cmd/gizzi-code/src/runtime/tools/ListPeersTool/ListPeersTool.ts` and `SendMessageTool/SendMessageTool.ts` are registered in `cmd/gizzi-code/src/runtime/tools-registry-gizzi.ts`.
- `cmd/gizzi-code/src/runtime/gizzi-core/services/railsPeer.ts` auto-registers a peer named from the session id and polls the HTTP inbox.
- `cmd/gizzi-code/src/cli/ui/ink-app/components/RailsInboxBridge.tsx` bridges polled envelopes into the TUI mailbox.
- `cmd/gizzi-code/src/shared/utils/udsClient.ts` provides a real Node UDS client (`sendToUdsSocket`) for direct peer-to-peer delivery when the recipient binds a socket.
- `rails-bridge.ts` continues to forward orchestration lifecycle events into Rails mail threads; peer-aware events are emitted by the registry heartbeat lifecycle.

## Phase 7 — Documentation & tests ✅ COMPLETE

- Updated `docs/RAILS_UNIFIED_COMMUNICATION_PLAN.md` (this file) with implementation status.
- Updated repo `AGENTS.md`:
  - Added a "Rails cross-session messaging" section.
  - Explained how agents can use `ListAgents` / `SendMessage`.
- Rust peer tests exist in `crates/agent-system/rails/tests/invariants.rs` and pass:
  - `cargo test -p allternit-agent-system-rails` ✅
- `cargo build -p allternit-api` ✅ compiles with only pre-existing warnings.
- `bun run typecheck` in `cmd/gizzi-code` ✅ passes.
- End-to-end smoke test:
  - `cmd/gizzi-code/test/rails-peer-e2e.ts` registers two peers, lists them, and sends a message from one to the other via the Rails API, confirming Bus/UDS delivery.
  - `tmp/rails-two-session-test/run.sh` starts two `GIZZI_ENABLE_RAILS_PEER=1 gizzi-code` sessions in tmux, confirms registration, sends a message, and verifies the recipient TUI renders it. Evidence is saved to `tmp/rails-two-session-test/evidence/`.
  - Manual: open two gizzi-code sessions with `GIZZI_ENABLE_RAILS_PEER=1`, run `ListPeers`/`SendMessage`, confirm delivery.

## Acceptance criteria

- ✅ `cargo test -p allternit-agent-system-rails` passes.
- ✅ `cargo build -p allternit-api` compiles.
- ✅ Peer registry wired into `service.rs`, `allternit-rails` CLI, and `/api/rails` endpoints.
- ✅ Mail/bus UDS transport wired into `service.rs` (background delivery loop) and `/api/rails` endpoints.
- ✅ Steering checkpoint wired into `service.rs`, `allternit-rails` CLI, and `/api/rails` endpoints.
- ✅ Rails peer HTTP API (`POST /api/rails/peers`, `GET /api/rails/peers`, `POST /api/rails/peers/:name/send`) works.
- ✅ `allternit-rails peer register/list/send/heartbeat/unregister/inbox` work from the shell.
- ✅ `allternit-rails orchestrator doctor` passes on this machine.
- ✅ `allternit-rails steer checkpoint/consult/commit-gate` work from the shell.
- ✅ gizzi-code runtime `ListPeers` / `SendMessage` tools implemented and registered.
- ✅ gizzi-code auto-registers as a Rails peer on startup when `GIZZI_ENABLE_RAILS_PEER=1`.
- ✅ End-to-end test confirms peer registration, listing, and message delivery over HTTP inbox polling.
- ✅ Full two-gizzi-session TUI exchange verified with `tmp/rails-two-session-test/run.sh`.
- ✅ Documentation updated (`docs/RAILS_UNIFIED_COMMUNICATION_PLAN.md`, `docs/RAILS_PRODUCT_UPDATE_SYSTEM_PROMPT.md`, repo `AGENTS.md`, and `cmd/gizzi-code/AGENTS.md`).

Remaining for later phases:
- (none — two-gizzi-session TUI exchange verified via `tmp/rails-two-session-test/run.sh`)

## Packaging

The executable is `allternit-rails` (built with `cargo build -p allternit-agent-system-rails`).  The SDK is the existing `/api/rails` HTTP surface plus the gizzi-code TypeScript peers client.  Orchestrator and steering remain pluggable: any agent that can speak HTTP to `/api/rails` or bind a UDS socket can participate.
