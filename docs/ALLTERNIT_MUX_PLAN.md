# ALLTERNIT-MUX — Unified Agent Terminal Multiplexer

> **STATUS:** In implementation
> **CREATED:** 2026-07-16
> **GOAL:** Close the terminal-layer gaps vs. Herdr identified in the 2026-07-16 gap analysis.

## Problem

Allternit has five fragmented terminal stacks (gizzi bun-pty, allternit-api tmux routes,
workspace-service simulated panes, vps-node portable-pty, archived portable-pty manager)
with no shared pane abstraction, no Unix-socket control API, no persistent PTY sessions,
and no agent state observability. The ADR-0044 orchestrator delegates well but owns no
terminal layer — it drives external tmux.

## What we are building

`cmd/allternit-mux/` — a new Rust crate: a long-running multiplexer daemon plus CLI.

### Scope (v1)

1. **Daemon-owned real PTYs** via `portable-pty` (same crate as `infrastructure/vps-node`).
   Clients attach/detach freely; the PTY lives in the daemon.
2. **Unix socket API** — newline-delimited JSON (NDJSON) request/response + event
   subscriptions, modeled on Herdr's protocol shape:
   - `ping`, `server.stop`, `server.status`
   - `session.create|list|get|close`
   - `pane.split|list|get|send_input|read|resize|close|run`
   - `agent.list|get|state`
   - `events.subscribe`
3. **Persistence** — session/pane metadata + scrollback ring buffer snapshots written to
   `~/.allternit/mux/<session>/`. On daemon restart: layout restored, scrollback replayed,
   processes NOT auto-restarted (v1 records the launch command so restore is one call).
4. **Agent detection** — process-name matching against the known CLI agent table
   (kimi, claude, codex, agy, gizzi) + output-activity heuristics →
   `idle | working | blocked | done`. Additive observability only; ADR-0044 sentinel-file
   contract remains the authoritative completion signal for orchestrated runs.
5. **CLI** (`allternit-mux`) — `serve`, `session`, `pane`, `agent`, `attach`, `wait`
   subcommands that speak the socket protocol.

### Explicitly out of scope (v1)

- TUI frontend (the socket API is the product; a TUI can come later)
- Tiling layout rendering (panes are flat per session in v1; split metadata is recorded)
- SSH remote attach (the socket is local; remote comes via the existing cloud relay later)
- Lifecycle-hook integrations (Herdr-style `integration install`)
- Any change to the ADR-0044 orchestrator, gizzi-code, or existing terminal routes

## Architecture

```
allternit-mux (CLI) ──NDJSON/UDS──▶ allternit-mux serve (daemon)
                                      │
                                      ├─ ApiServer     UnixListener, NDJSON codec, dispatch
                                      ├─ SessionStore  sessions → panes, metadata, persist/restore
                                      ├─ PtyManager    portable-pty sessions, scrollback rings
                                      ├─ Detector      process-name + output heuristics → AgentState
                                      └─ EventBus      broadcast<OrchestrationEvent> → subscribers
```

State dir: `~/.allternit/mux/`
- `mux.sock` — control socket (override: `ALLTERNIT_MUX_SOCKET`)
- `<session-id>/meta.json` — session + pane metadata, launch commands, layout
- `<session-id>/<pane-id>.scrollback` — ring buffer snapshot for replay

## Protocol sketch

```json
{"id":"req_1","method":"ping","params":{}}
{"id":"req_1","result":{"type":"pong"}}

{"id":"req_2","method":"session.create","params":{"label":"api","cwd":"/repo"}}
{"id":"req_3","method":"pane.run","params":{"pane_id":"<s>-1","command":"kimi --yolo"}}
{"id":"req_4","method":"pane.read","params":{"pane_id":"<s>-1","lines":50}}
{"id":"req_5","method":"events.subscribe","params":{"types":["pane.output","agent.state_changed"]}}
```

Errors: `{"id":…,"error":{"code":"not_found","message":"pane not found"}}`.

## Agent state model (v1)

| State | Signal |
|---|---|
| `working` | Output bytes observed within the last ~2 s |
| `idle` | Known agent process alive, no recent output |
| `blocked` | Bottom-of-buffer matches a permission/approval/question prompt pattern |
| `done` | Pane process exited (exit code recorded) |
| `unknown` | No known agent detected in the pane |

Detection = foreground process name match → known agent; then output heuristics.
This is deliberately best-effort observability, never an input to orchestration gates.

## File layout

```
cmd/allternit-mux/
├── Cargo.toml
├── src/
│   ├── main.rs          # CLI entry (clap): serve | session | pane | agent | attach | wait
│   ├── protocol.rs      # Request/Response/Event types (serde)
│   ├── api.rs           # Unix socket server, NDJSON codec, method dispatch
│   ├── session.rs       # SessionStore: sessions, panes, metadata, persistence
│   ├── pty.rs           # PtyManager: portable-pty spawn/write/resize/scrollback
│   ├── detect.rs        # agent process detection + state heuristics
│   ├── events.rs        # broadcast event bus
│   └── client.rs        # socket client used by the CLI
└── tests/
    └── integration.rs   # end-to-end: daemon on temp socket, full lifecycle
```

## Verification (goal completion contract)

1. `cargo build -p allternit-mux` succeeds.
2. Daemon starts on a temp socket; `ping` → `pong`.
3. CLI: create session → split pane → `pane.run` a process.
4. Two clients attach to one pane; both stream output; one detaches cleanly.
5. Restart daemon against the same state dir → layout restored, scrollback readable.
6. `agent.state` reports `idle`/`working` for a detected agent-shaped process.
7. `cargo test -p allternit-mux` passes.

## Rollout / relationship to existing stacks

- v1 is standalone: nothing else in the monorepo depends on it.
- Later (separate ADR): point the ADR-0044 orchestrator at a `mux` ExecutorBackend,
  replace `terminal_routes.rs` tmux backend, and surface mux panes in the web UI.
