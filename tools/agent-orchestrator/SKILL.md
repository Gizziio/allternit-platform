---
name: agent-orchestrator
description: Orchestrate external CLI agents (kimi, codex, agy, claude, gizzi-code) through the Allternit Rails communication and coordination system. Use when the user asks to delegate, offload, or farm out implementation work to another CLI agent / terminal session, or to run work outside this session to save tokens.
---

# CLI Agent Orchestrator (v3 — Rails-native)

You are the **orchestrator**: you own scoping, task specs, monitoring, review, and bug-fixing. The **executor** is an external CLI agent in its own tmux session. You never do the bulk implementation yourself — but you always verify it.

The underlying engine is `allternit-rails` from the `allternit-agent-system-rails` crate. The bundled `ao-*` scripts in this directory are thin shims over `allternit-rails orchestrator` (and `allternit-rails steer` for consults). The binary must be on PATH:

```bash
cargo build -p allternit-agent-system-rails
# symlink or copy target/debug/allternit-rails onto PATH, e.g. ~/.local/bin
```

Every spawned session is registered as a Rails peer under `.allternit/peers/`, with a per-session UDS inbox. That lets other local agents discover it (`allternit-rails peer list`, `/list-agents` in gizzi-code) and send plain-text messages to it (`allternit-rails peer send`, `/send-message`).

## Phase 0 — Detect agents

```bash
ao-doctor   # probes tmux/script/git + every executor CLI
```

Exit codes: 0 = usable; 1 = no usable executors; 2 = transport broken. Trust its per-vendor verdicts over any static table.

## Phase 1 — Scope and plan (you, in this session)

Same as v2: do the analysis yourself, then write inside the executor's workdir:

- `docs/<TOPIC>_MAP.md` — the full gap analysis.
- `docs/<TOPIC>_PHASE_<N>_TASK.md` — one phase only, with constraints, file paths, and a deliverable sentinel/notes file.

## Phase 2 — Spawn

```bash
~/.claude/skills/agent-orchestrator/scripts/ao-spawn [--worktree] <slug> <repo-dir> "<agent-launch-cmd>"
# prints: ao-<slug> <workdir> <logfile> <peer_id> <inbox_socket>
```

Use `--worktree` whenever the repo allows it. The binary refuses when the git root is `$HOME`.

Headless one-shot pattern — chain the sentinel:

```bash
ao-spawn <slug> <repo> "claude -p '$(cat docs/X_TASK.md)' --dangerously-skip-permissions; touch docs/X_NOTES.sentinel"
```

Each spawned session exports:

- `ALLTERNIT_RAILS_PEER_NAME=ao-<slug>`
- `ALLTERNIT_RAILS_INBOX=<socket-path>`
- `ALLTERNIT_RAILS_ROOT=<workdir>`

so the executor can participate in Rails cross-session messaging.

## Phase 3 — Send prompts

```bash
ao-send <slug> "Read docs/<TASK_FILE> and execute it exactly."
```

`ao-send` now delegates to `allternit-rails orchestrator send`. It prefers UDS delivery if the peer inbox is listening, otherwise falls back to tmux key injection.

## Phase 4 — Monitor and steer

```bash
ao-watch <slug> <NOTES_FILE> [timeout=3600] [interval=20]
```

Exits 0 on DONE, 3 on PANE-DEAD, 4 on TIMEOUT. To steer or answer questions, `ao-send` into the same session.

To see progress: `ao-status <slug> 40`. To list all sessions: `ao-status`.

## Phase 5 — Review the work

Same as v2: verify the true footprint, scope, claims, and cheap syntax gate. Fix small bugs yourself; send bad implementations back via `ao-send`.

## Phase 6 — Iterate and clean up

When all phases pass: merge/apply the worktree branch, then `ao-kill <slug> [--rm-worktree]`.

## Cross-session messaging

Local peers are discoverable with:

```bash
allternit-rails peer list
allternit-rails peer send <name> "<message>"
```

From gizzi-code, the runtime exposes `allternit_list_agents` and `allternit_send_message` tools. Messages travel over the peer's UDS inbox and never leave the machine.

## Platform integration

Executor lifecycle events are still mirrored into Rails mail thread `wih:executor-<slug>` via `runtime/server/rails-bridge.ts`, and artifacts can be shared with `POST /api/rails/mail/share`.

## Pitfalls learned the hard way

- kimi `-p` refuses `--yolo`/`--auto` — TUI + `ao-send` is the only autonomous kimi path.
- C-c kills a kimi TUI outright; `ao-send` clears with C-u on mismatch.
- Busy-indicator polling gives false idles on kimi — sentinel files only.
- Use worktrees to attribute changes when multiple agents share a repo.
- Scope each phase so its review fits in a few file reads.
