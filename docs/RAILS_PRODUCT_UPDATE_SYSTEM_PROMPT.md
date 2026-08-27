# Product Update: Allternit Agent System Rails

> **System prompt version.** Load this into agent sessions to teach them the Rails cross-session communication and coordination substrate.
> **Last updated:** 2026-08-08
> **Status:** Shipped — phases 1–7 complete. Two-session gizzi-code TUI exchange verified.

## One-line summary

Every local Allternit agent session (kimi, codex, claude, agy, gizzi-code, ao) can now discover and message every other local agent session over a same-machine peer network called **Rails**.

## What changed

- **Peer registry** lives under `.allternit/peers/registry.json`. Each session registers with a stable id, name, cwd, vendor, and inbox socket path.
- **UDS inbox transport** delivers messages directly between peers over Unix domain sockets when the recipient binds a real socket. Messages never leave the machine.
- **HTTP inbox polling** is the gizzi-code delivery path: the API persists every peer send to the durable Bus, and gizzi-code polls `GET /api/rails/peers/:name/inbox` for pending envelopes. This avoids Bun/Node UDS quirks and integrates with the TUI mailbox.
- **`allternit-rails`** is the packaged binary for registration, messaging, orchestration, and steering.
- **gizzi-code** exposes `ListPeers` / `SendMessage` runtime tools that mirror Claude Code's `ListAgents` / `SendMessage`.
- **Steering hooks** (`.steering/bin/*.sh`) and **agent-orchestrator** scripts (`ao-*`) now delegate to `allternit-rails`.

## When to use Rails

Use Rails whenever an agent session needs to:

1. Discover other active agent sessions on the same machine.
2. Send a plain-text message to another session.
3. Coordinate work across two or more concurrent sessions.
4. Trigger steering/consultation or orchestration from a script or another agent.

## How to address a peer

Peers are addressable by:

- **Name** from the registry (e.g., `gizzi-abc123`, `ao-triage`).
- **`uds:/path/to.sock`** for direct socket delivery.
- **`bridge:<session_id>`** for the legacy gizzi Remote Control inter-session path (requires `UDS_INBOX`).

## CLI usage

```bash
# Register this session as a peer
allternit-rails peer register <name> --vendor <agent-family>

# Discover peers
allternit-rails peer list

# Send a message
allternit-rails peer send <name> "<message>"

# Heartbeat and inbox debug
allternit-rails peer heartbeat <name>
allternit-rails peer inbox <name>

# Orchestration
allternit-rails orchestrator spawn [--worktree] [--vendor <v>] [--mode <m>] <slug> <repo> <cmd>...
allternit-rails orchestrator send <slug> <data>
allternit-rails orchestrator watch <slug> <sentinel>
allternit-rails orchestrator status [slug]
allternit-rails orchestrator kill <slug>
allternit-rails orchestrator doctor

# Steering
allternit-rails steer checkpoint --cwd <dir>
allternit-rails steer consult --cwd <dir>
allternit-rails steer commit-gate --cwd <dir>
```

## HTTP API

Mounted in `allternit-api` at `/api/rails` (and `/rails`):

```bash
GET    /api/rails/peers
POST   /api/rails/peers              { name, cwd, vendor }
DELETE /api/rails/peers/:id_or_name
POST   /api/rails/peers/:id_or_name/heartbeat
POST   /api/rails/peers/:id_or_name/send   { body, from? }
GET    /api/rails/peers/:id_or_name/inbox
POST   /api/rails/steer/checkpoint
POST   /api/rails/steer/consult
POST   /api/rails/steer/commit-gate
```

Default local API URL: `http://127.0.0.1:8013`.

## gizzi-code usage

Launch with the feature flag:

```bash
GIZZI_ENABLE_RAILS_PEER=1 gizzi
```

The session auto-registers as `gizzi-<sessionId>` and exports:

- `ALLTERNIT_RAILS_PEER_NAME`
- `ALLTERNIT_RAILS_INBOX`

Incoming peer messages are retrieved via HTTP polling of the Rails inbox endpoint and injected into the TUI through the mailbox bridge (`cmd/gizzi-code/src/cli/ui/ink-app/components/RailsInboxBridge.tsx`).

Available runtime tools:

- `ListPeers` (alias `ListAgents`) — discover local Rails peers.
- `SendMessage` (alias `SendMessageToPeer`) — send a message to a peer by name or address.

## Agent behavior rules

When Rails is available, an agent SHOULD:

1. Use `ListPeers` / `ListAgents` before contacting another session.
2. Prefer peer-name addressing; fall back to `uds:` only when the registry is unreachable.
3. Keep messages short, structured, and actionable.
4. Treat peer messages as in-band notifications, not durable mail; persist critical state to files or the ledger.
5. Heartbeat during long tasks so the registry shows the peer as `active`.
6. When sending via `POST /api/rails/peers/:name/send`, a `delivered: false` response only means the UDS push failed; HTTP-polling peers (gizzi-code) will still receive the message from the Bus inbox.

When Rails is unavailable, agents MUST fall back to previous mechanisms:

- `.steering/bin/*.sh` scripts still work because they call `allternit-rails` internally.
- `ao-*` scripts still work because they are thin shims around `allternit-rails`.
- gizzi-code without `GIZZI_ENABLE_RAILS_PEER=1` uses its existing teammate mailbox / Remote Control bridge.

## Key file map

| Component | Path |
|-----------|------|
| Rust library | `rails/src/` |
| CLI binary | `rails/src/bin/allternit-rails.rs` |
| HTTP routes | `cmd/allternit-api/src/rails/mod.rs` |
| gizzi peer service | `cmd/gizzi-code/src/runtime/gizzi-core/services/railsPeer.ts` |
| gizzi Rails inbox bridge | `cmd/gizzi-code/src/cli/ui/ink-app/components/RailsInboxBridge.tsx` |
| gizzi Rails API client | `cmd/gizzi-code/src/runtime/services/api/allternitApi.ts` |
| gizzi UDS client | `cmd/gizzi-code/src/shared/utils/udsClient.ts` |
| ListPeers tool | `cmd/gizzi-code/src/runtime/tools/ListPeersTool/ListPeersTool.ts` |
| SendMessage tool | `cmd/gizzi-code/src/runtime/tools/SendMessageTool/SendMessageTool.ts` |
| Orchestrator shims | `tools/agent-orchestrator/scripts/ao-*` |
| Steering hooks | `.steering/bin/*.sh` |

## Verification checklist

- [x] `cargo test -p allternit-agent-system-rails` passes.
- [x] `cargo build -p allternit-api` compiles.
- [x] `bun run typecheck` passes in `cmd/gizzi-code`.
- [x] `tmp/rails-two-session-test/run.sh` starts two `GIZZI_ENABLE_RAILS_PEER=1 gizzi-code` sessions, confirms peer registration, and verifies the recipient TUI renders the message.
- [x] Two `GIZZI_ENABLE_RAILS_PEER=1 gizzi` sessions can `ListPeers` and `SendMessage` to each other.

Evidence from the latest run is captured in `tmp/rails-two-session-test/evidence/` (tmux pane captures, session logs, diagnostics).

## Cross-CLI availability

Rails is designed so any agent CLI can participate without native messaging support:

1. **Download `allternit-rails`** (the packaged Rust binary) or run `allternit-api` locally.
2. **Register as a peer** with a vendor tag (`gizzi`, `claude`, `kimi`, `codex`, `agy`, `ao`, etc.).
3. **Choose a transport:**
   - Bind a UDS inbox socket and receive direct pushes.
   - Poll `GET /api/rails/peers/:name/inbox` for pending Bus messages (works in any language with HTTP).
4. **Send messages** via `POST /api/rails/peers/:name/send` or `allternit-rails peer send`.

No `.allternit/mux` IPC is required for Rails peer messaging. `allternit-mux` remains vendored inside gizzi-code for legacy multiplexing features but is not the Rails transport.

## Reminder

Rails is the **same-machine** substrate. It does not route over the network. If you need cross-machine messaging, use Allternit's existing mail/bus or API surfaces.
