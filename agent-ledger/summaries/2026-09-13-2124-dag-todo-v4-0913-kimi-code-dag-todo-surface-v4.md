# DAG todo surface v4 — node edit/delete, needsYou↔WIH join, migrations build trigger

- **Session:** dag-todo-v4-0913 (kimi-code) · wih_3053 / dag_370948
- **PR:** #496, merge `4a4b4b407` (2026-09-13) · 8 commits on `session/dag-todo-v4`

## What was done

Fourth iteration of the DAG-as-todo surface (v1 #476, v2 #481, v3 #485).

1. **build(allternit-api)**: `build.rs` with `rerun-if-changed=migrations`. refinery's `embed_migrations!("migrations")` reads SQL at compile time but nothing recompiled the crate on migration-only changes (v3 needed a manual `touch db.rs`). Verified live: touching a migration file marks the crate Dirty and recompiles it.
2. **commrails `DeleteNode`**: new `DagMutation::DeleteNode` variant, `DagNodeRemoved` ledger event (payload: dag_id, node_id, title, parent_node_id), projection support — node dropped from the graph and touching edges removed (prevents a ghost blocker suppressing readiness). Documented in `EVENT_TAXONOMY.md`, `GATE_RULES.md` (new Gate 6 — node removal), `cli/COMMANDS.md`.
3. **API routes**: `PATCH /dags/:dag_id/nodes/:node_id` (rename via the existing `UpdateNode` patch path) and `DELETE /dags/:dag_id/nodes/:node_id` with guards: 400 unknown node / empty title, 409 non-DONE children, 409 active WIH.
4. **ao-engine**: `WaitingEntry.tokens` carries pane metadata tokens (populated from `AgentInfo.tokens` in `WaitingList::observe`) through the visibility snapshot — the precise correlation channel for future pane→WIH joins. Crate name is `herdr`; its build needs `ZIG=/opt/homebrew/opt/zig@0.15/bin/zig` (vendored libghostty-vt pins zig 0.15).
5. **API visibility join**: `VisibilityNeed` gains `node: {dag_id, node_id, title}`. Correlation: tokens (`wihId`/`dagId`/`nodeId`) win; fallback is exactly-one ACTIVE WIH matched by agent name (`WaitingEntry.agent` == `WihState.agent_id`); 0 or >1 candidates → omitted (fail-closed). One `project_dag` per distinct dag_id, cached. Fail-soft on ledger errors.
6. **Web**: `RailsTaskList` pencil/trash on non-done rows (inline edit mirrors `AddTaskRow`; `window.confirm` delete; 409 surfaced as inline red text; `pending` aggregates the new mutations). Bot deck now renders the needsYou entries list (previously only the badge count) with a muted `blocked on “title”` sub-line; the Cowork rail got the same sub-line via `metadata.dagNodeTitle`.

## Verification evidence

- `cargo test -p allternit-commrails`: 90 unit + 6 invariants + 2 node_deletion + 1 doctest — all green.
- `cargo test -p allternit-api --lib rails::`: 21/21 green, incl. 5 new visibility join tests and the delete-guard regression test.
- `cargo check -p allternit-api`: green.
- Web: `tsc --noEmit` exit 0; vitest 18/18 on touched modules.
- `node scripts/release-preflight.mjs`: 36/0.
- Live curl smoke (dev server, scratch `ALLTERNIT_DATA_DIR`, port 18014): plan → PATCH rename 200; empty-title / unknown-node 400; children-guard 409; leaf delete 204; pickup → delete 409; close → delete 204; visibility payload shape confirmed.

## Incidents

- **Live smoke caught a real bug pre-merge**: the active-WIH delete guard keyed on `DagNode.current_wih_id`, which the commrails projection **never populates** (always `None`, confirmed by grep). DELETE returned 204 on a node with an ACTIVE WIH, orphaning it. Fixed in `2fed39493` by scanning `active_wihs(&events)` for (dag_id, node_id) matches; regression test `delete_node_with_active_wih_conflicts` added. The unpopulated `current_wih_id` field is a known gap — v5 candidate.

## Honest deferrals

- TUI (gizzi-code Ink) edit/delete keys — deferred, web is the cowork surface.
- Precise pane→WIH stamping at pickup time (via the existing `pane.report_metadata` RPC) — needs a launcher-plumbing decision; the token pipeline and agent-name join ship now.
- `DagNode.current_wih_id` projection population — deferred (see Incidents).
- A stale dev server from a previous session was found listening on 18013 (returned 501 for the new routes); the smoke ran on 18014 instead. It was left alone (another session's process).
