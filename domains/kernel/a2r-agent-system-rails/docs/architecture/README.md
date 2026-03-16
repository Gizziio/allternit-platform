# A2R Agent System Rails Architecture

This document records the **features** and **architecture** of the `a2r-agent-system-rails` subsystem so you can reason about it before running tests. The full system is now split into layer-specific READMEs under `docs/architecture/layers/` so you can jump straight to the work, gate, runner, ledger, bus, or vault descriptions.

## Layered navigation
| Layer | Path | Synopsis |
| --- | --- | --- |
| Work | `docs/architecture/layers/work/README.md` | DAG/task semantics, WIH selectors, and plan commands mapped to `a2r rails plan`, `dag`, `wih`, and the canonical `dag_id` work identity. |
| Gate | `docs/architecture/layers/gate/README.md` | Policy bundle injection, `GateTurnCloseout`, lease enforcement, and mutation provenance. |
| Runner | `docs/architecture/layers/runner/README.md` | Rails loop autopipeline, Ralph loop iteration events, runner cursor state, and vault handoff. |
| Ledger | `docs/architecture/layers/ledger/README.md` | Append-only ledger store, prompt timelines, cursor tracking, and provenance requirements. |
| Bus | `docs/architecture/layers/bus/README.md` | Bus queue layout, tmux/socket transports, busy-state guards, and transport inspection tooling. |
| Vault | `docs/architecture/layers/vault/README.md` | Vault compaction, receipt bundles, archived snapshots, and learning/memory extraction. |

## 1. Overview

- **Unified system** for work execution under policy gates covering DAG/WIH/runs/leases/ledger/vault.
- All CLI surface lives in `src/bin/a2r-rails.rs`; new commands are namespaced under `a2r rails`, not `bd`.
- Work state is driven by events appended to `.a2r/ledger/events`; derived views (WIH snapshots, mail, etc.) rebuild from those logs.
- Gate enforcement is handled by `src/gate/gate.rs` and the `policy` helper (see `src/policy.rs`).

## 2. Stores & truth

| Store | Path | Notes |
| --- | --- | --- |
| Ledger events | `.a2r/ledger/events/YYYY-MM-DD.jsonl` | Append-only truth for WIH, DAG, bus, runner events. |
| Leases | `.a2r/leases/leases.db` | SQLite used for atomic lock acquisition/release. |
| Receipts + blobs | `.a2r/receipts`, `.a2r/blobs` | Immutable evidence; events reference blob hashes. |
| Index | `.a2r/index/index.db` | Derived SQLite FTS for fast search, rebuildable from ledger. |
| Transports | `.a2r/transports/tmux`, `.a2r/transports/socket` | Track `TransportState` per pane/socket+iteration (busy flags, owner, outputs). |

The CLI `a2r rails init` (see `init_system` in `src/bin/a2r-rails.rs`) pre-creates these directories so tooling can safely write state.

## 3. CLI surface

`a2r rails` splits into task-facing layers so you can see which controls run where.

### Layer A – Work orchestration
`a2r rails plan` / `dag` / `wih` / `work` – create DAG tasks/subtasks, inspect nodes, pick up or hand off WIH envelopes, and mark work complete. Key commands:
  * `a2r rails plan create <text>` – translates text to DAG/work nodes, emits `PromptCreated` + `DagNodeCreated`, and records the canonical prompt/dag link.
  * `a2r rails wih pickup <wih_id>` – claims a WIH, records policy/signature, and writes `WIHPickedUp`/`WIHOpenSigned`.
  * `a2r rails wih close <wih_id>` – triggers close request, `WIHClosedSigned`, and starts the Gate/Vault pipeline (this is the anchor for O‑01).
  * `a2r rails work status` – shows DAG/WIH views and the derived loops (see `.a2r/work/dags/<dag_id>/wih`).

### Layer B – Policy, Gate, and loops
`a2r rails gate` / `policy` / `lease` – enforce context, inject AGENTS.md bundles, and guard edits.
  * `a2r rails gate pre-tool` – ensures required leases+policy before tool calls; rejects if `AgentsPolicyInjected` marker missing.
  * `a2r rails gate mutate` – stamps every DAG mutation with `MutationProvenance` containing prompt/agent IDs.
  * `a2r rails gate turn-closeout` – (invoked automatically) re-checks receipts, releases leases, logs `GateTurnCloseout` with `last_heartbeat`, and updates WIH views.
  * `a2r rails lease request/grant/release` – CRUD for leases stored at `.a2r/leases/leases.db`.
  * `a2r rails policy inject` (internal) – writes the `AgentsPolicyInjected` ledger event after reading `AGENTS.md`, `.a2r/agents`, `.a2r/spec`, and enforcing bundle hash.

### Layer C – Ledger, bus, transports
`a2r rails ledger` / `bus` / `transport` – the infrastructure layer with truth, transport, and coordination.
  * `a2r rails ledger tail` – dumps `.a2r/ledger/events/*.jsonl`, replaying in order (idempotent via `RunnerState.processed` + `cursor`).
  * `a2r rails bus send/poll/deliver` – durable SQLite queue under `.a2r/bus/queue.db`. Sends emit `BusMessageSent`/`BusMessageDelivered/Failed`.
  * `a2r rails bus tmux-send/socket-send` – send commands to tmux panes/sockets; `tmux/socket runners` watch their queues, execute commands, and mark transports free.
  * `a2r rails transport tmux-inspect/socket-inspect` – reads `.a2r/transports/{tmux,socket}` state files (busy flag, owner, iteration) so you can see what contexts are live.
  * `a2r rails runner start/once` – the Rails loop that tails the ledger, triggers `VaultArchiveStarted/Completed`, emits `RailsLoopIteration*`, injects policy, and runs `GateTurnCloseout`.

Each layer owns the directories described in Section 2 (ledger events, leases, transports, vault snapshots). Because the CLI never uses phrases like “kernel” or “control plane,” the namespaces stay specific to Gate, Bus, etc.

## 4. Runner & Ralph loop autopipeline

- `start_runner` (in `src/bin/a2r-rails.rs`) tails the ledger, stores progress in `.a2r/meta/rails_runner_state.json`, and replays events idempotently (`RunnerState` holds `processed` event IDs plus `LoopProgress` per WIH).
- `handle_wih_closed` reacts to `WIHClosedSigned`, emits `VaultArchiveStarted/Completed`, releases leases (`Leases::release_for_wih`), rebuilds the index (`Index::rebuild_from_ledger`), and logs gate events.
- `process_loop_iterations` drives the Ralph loop:
  - WIHs carry `LoopPolicy` (see `LoopPolicy` struct used when `LoopPolicy` data is serialized in `WIHCreated` events).
  - The runner emits `RailsLoopIterationStarted`, `RailsLoopIterationCompleted`, `RailsLoopIterationSpawnRequested`, `RailsLoopIterationEscalated`.
  - `LoopProgress` tracks current iteration, spawn requests, escalation state.
  - `ensure_loop_policy_injected` uses `policy::ensure_injected` (`src/policy.rs`) to enforce AGENTS.md injection every iteration via ledger `AgentsPolicyInjected` events.
  - `Gate::turn_closeout` is invoked when iterations complete to validate lease/receipt coverage.

Spawn requests (fresh contexts / subagents) are recorded via `RailsLoopIterationSpawnRequested`; external orchestrators (tmux/sockets) can pick them up by polling the bus or running the transport listeners.

## 5. Gate & policy enforcement

- `src/gate/gate.rs` houses the enforcement rules.
- Every mutation/tool invocation calls `policy::ensure_injected` with the relevant `EventScope` so AGENTS.md + `.a2r/agents/**`/`.a2r/spec/**` bundles are hashed and logged.
- Gate rejects actions when no `AgentsPolicyInjected` event exists for the scope, ensuring policy injection on every context boundary (WIH pickup, iteration start, tool usage).
- Gate also emits `GateTurnCloseout` after each iteration to renew leases, verify receipts, update WIH heartbeat, and log metadata.

## 6. Bus + transports

- The bus (`src/bus.rs`) backs durable coordination. `BusMessage` entries are persisted and the runner logs `BusMessageProcessed`.
- Specialized transport runners:
  - **tmux transport** (`run_tmux_transport`) reads `.a2r/bus` pending messages addressed to `tmux:<pane>`. Before dispatching, the CLI writes `TransportState` with `busy = true`; the transport clears it when the response returns.
  - **Socket transport** (`run_socket_transport`) talks to helper sockets under `.a2r/transports/socket/<socket>/<iteration>`. The transport now expects JSON messages w/ `status/stdout/stderr` fields and records them into the transport state file.
- Both transports store iteration-specific state under `.a2r/transports`, so retries/inspections remain deterministic.
- The CLI now rejects `tmux-send` or `socket-send` requests when `TransportState.busy` is set, preventing overwrites before tmux/socket is touched.
- Busy/owner metadata ensures coordination: if another agent is mid-iteration, the command fails early with a message like `tmux pane X (iteration Y) is busy since ...`.
- The new `transport` command (`a2r rails transport tmux-inspect / socket-inspect`) reads these state files and reports live contexts (iteration ID, busy flag, owner, last message ID, preview of `last_output`).

## 7. Testing and verification

Manual verification steps (to run after documentation is reviewed):

1. `cargo fmt` inside `a2r-agent-system-rails`.
2. `a2r rails runner once` to ensure the runner drains the ledger and emits the expected loop/vault events.
3. `a2r rails bus tmux-runner ...` plus `tmux-send` to validate busy gating and `transport tmux-inspect`.
4. `a2r rails bus socket-runner ...` plus `socket-send` to validate structured JSON responses and `transport socket-inspect`.

Automated suites live in `tests/` and `a2r-agent-system-rails/tests`; run them once the architecture docs are vetted. Detailed test plans will follow after this documentation step.

## References

- CLI implementation: `src/bin/a2r-rails.rs`
- Policy enforcement: `src/policy.rs`
- Gate enforcement + loop state/closeout: `src/gate/gate.rs`
- Transport state persistence: `.a2r/transports/tmux` and `.a2r/transports/socket`
- Bus semantics: `src/bus.rs`
