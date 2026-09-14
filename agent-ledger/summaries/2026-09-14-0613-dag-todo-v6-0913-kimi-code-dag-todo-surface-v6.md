# DAG todo surface v6 — TUI all-row actions, token clear on close, DnD reparent, labels/priority/description

- **Session:** dag-todo-v6-0913 (kimi-code) · wih_9737 / dag_249096
- **PR:** #505, merge `f534ca7e9` (2026-09-14) · 5 commits on `session/dag-todo-v6`

## What was done

Sixth iteration; ships all four recorded v6 candidates.

1. **TUI all-row actions** (`ceb27acef`): new pure `actionsFor(status, assignee, agentId)` — base [edit, delete, reparent] on every node row (server-guarded), +take on READY, +done/fail on own RUNNING. Selection pool widened from actionable-only to all node rows; footer hint shows only the selected row's available keys. DONE/NEW/FAILED rows are now editable/deletable/reparentable from the gizzi-code panel.
2. **Token clear on close** (`6504de741` — same phase, second commit): WIH close (DONE and FAILED) fire-and-forget clears ao pane tokens (wihId/dagId/nodeId) via a shared `spawnPaneMetadata` helper so the v5 needsYou↔WIH join unblocks immediately. Pickup stamp + close clear unified.
3. **Drag-and-drop reparent** (`0d9f53f14`, web): native HTML5 DnD (no new deps) — row→row = reparent under, row→section header = root; self/descendant targets rejected client-side (not-allowed cursor); accent-outline dragover highlight; `dropTargetState` pure helper + 6 tests.
4. **Labels/priority/description** (`fd0b087b5` web + `4e5fc7d1d` api): `DotsThreeOutline` edit popover (labels comma-input trim/dedupe, priority select 0–3, 2-row description; one changed-fields-only PATCH). API `UpdateDagNodeRequest` extended; `dag_node_json` emits the three fields. Priority three-state visitor: absent = unchanged, null = explicit no-op (real clear needs a projection change — deferred), int = set.

## Verification evidence

- `cargo test -p allternit-api --lib rails::`: 23/23 (new `patch_node_labels_description_priority`). commrails untouched in v6.
- gizzi-code: `bun run typecheck` rc=0; `bun test RailsTaskList.test.ts` 26/26; `bun run script/build-production.js` rc=0 (darwin-arm64).
- Web: tsc --noEmit 0; vitest 29/29 (organize.test.ts).
- `node scripts/release-preflight.mjs`: 36/0.
- Live curl smoke (private-target dev server, 18014): labels+description+priority set visible in GET /dags → labels replace (old gone) → `[]` clears → priority 1 survives explicit null no-op → v5 combined rename+reparent-to-root regression 200.

## Incidents

- **Shared-target poisoning (root-caused):** the shared `allternit/target` is used by multiple parallel session worktrees; cargo's unit hash for workspace path deps does not distinguish source trees, so another session's pre-v4 commrails artifact satisfied freshness and `cargo run -p allternit-api` failed with E0599 (missing `DagMutation::ReparentNode`/`DeleteNode`) while `cargo check` and tests passed (different unit hashes — check rmeta had the symbols, run rmeta did not; proven by strings-grepping `liballternit_commrails-*.rmeta`). Mitigation: private `CARGO_TARGET_DIR` for the smoke server. **Repo-level recommendation: per-session target dirs, or never share CARGO_TARGET_DIR across worktrees of this workspace.**
- macOS TCC from v5 remained resolved — direct Desktop access all session, no tmux fallback needed.

## Honest deferrals

- Priority has no true null-clear (projection ignores `priority: null` — commrails-side change, deferred).
- TUI close-path token clearing needs dagId/nodeId threaded from the caller (done for the TUI close path; other close callers don't clear).
- Web DnD: no drop onto the "done" collapsed group (read-only by design).
