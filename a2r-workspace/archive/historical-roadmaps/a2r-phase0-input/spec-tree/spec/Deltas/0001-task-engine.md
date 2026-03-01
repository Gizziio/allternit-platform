# /spec/Deltas/0001-task-engine.md — Tasks Engine Parity (Claude Tasks inside A2R)

Date: 2026-01-27
Status: PROPOSED

## Intent

Implement Claude Code Tasks–parity **task DAG + persistence + resumable environments** inside A2rchitech, while keeping **WIH/Beads on every DAG node** as the deterministic contract envelope.

## Non‑Negotiables

- Canonical task graph and state are A2R-native (not vendor).
- `blockedBy` dependency enforcement is scheduler truth (agents cannot bypass).
- Every node includes full WIH/Beads front matter (redundant, deterministic).
- `/install` creates immutable execution presets (env + scopes + mounts).
- `/resume` deterministically rehydrates node: WIH + env + cursor + last receipts.
- All writes are routed under `/.a2r/` and enforced by PreToolUse gating.

## Data model (minimum)

- Workspace
- TaskGraph
- TaskNode
- Run
- Environment/Preset
- Proposal (learning candidate)

## State machine (minimum)

- PLANNED → READY → RUNNING → (NEEDS_INPUT|FAILED|COMPLETE)
- BLOCKED when deps unsatisfied.

## Acceptance tests (executable truth)

### AT-0001 Dependency gate
- Given a task with `blockedBy=[X]` and X not COMPLETE, scheduler must not dispatch.

### AT-0002 Output routing
- Any write attempt outside `/.a2r/` or outside declared node paths must be denied.

### AT-0003 Resume determinism
- After a partial run, `/resume <task_id>` must load prior run receipts and continue from recorded cursor without requiring implicit memory.

### AT-0004 Preset immutability
- `/install <preset>` produces a pinned preset hash; tasks referencing it must use that exact preset hash.

### AT-0005 Audit receipts
- Every run produces: stdout/stderr logs, tool-call timeline, artifact manifest, provenance hashes.

