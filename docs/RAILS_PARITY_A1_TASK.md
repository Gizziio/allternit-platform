# PHASE A1 TASK — rails ticket parity (event core + HTTP surface)

You are the executor. `.steering/spec.md` (Phase A1, R1–R5 + Gherkin acceptance)
is your source of truth for WHAT — read it first, including the builder notes
inside R1/R3/R5. This file is the HOW.

## Workflow rules (mandatory)

1. Update `.steering/checkpoint.md` at every meaningful checkpoint; `[steering]`
   messages are authoritative — fix, answer, update the checkpoint.
2. Done + verified → `docs/RAILS_PARITY_A1_NOTES.md` with YAML frontmatter
   (`status`, `files_changed`, `deviations`, `remaining`), then
   `touch docs/RAILS_PARITY_A1_NOTES.sentinel`.
3. Then commit: `git add rails cmd .steering docs && git commit -m "feat(rails): ticket parity A1 — dependency events, shared ready, HTTP tickets"`.
   A gate reviews; fix and retry if blocked.

## Key implementation guidance (from the spec review — follow it)

- Work in `rails/src/` (ticket side: tickets/mod.rs, dependencies.rs,
  wait_gates.rs, batch.rs) and `cmd/allternit-api/src/rails/mod.rs`.
  DO NOT touch the work/DAG/WIH system (`work/`, `wih/`, `cli/work.rs`'s
  ready_issues, routes_cowork.rs).
- R1: dependency events span two tickets; event filing is single-ticket-keyed —
  graph rebuild must scan the full event log, not `events_for(id)`. Consolidate
  the three private `load_graph`/`save_graph` copies (batch.rs, doctor.rs,
  mcp.rs) into ONE shared function (put it somewhere sensible, e.g.
  dependencies.rs) and convert all callers.
- R2: `TicketStore::get`'s no-snapshot fallback currently no-ops on
  Updated/StatusChanged/NoteAdded (tickets/mod.rs:534-553) — implement real
  replay. Add LabelAdded/LabelRemoved events + label add/remove ops that emit
  them.
- R3: shared ready function in the ticket subsystem (open, not deferred, all
  incoming `blocks` closed, no unsatisfied gates from
  `WaitGateStore::blocking_for`). Wire MCP `tool_ready` to it, and add a NEW
  CLI subcommand for tickets (`rails ticket ready`) — do NOT modify the DAG
  system's `ready` command.
- R4: axum handlers under `/api/rails/tickets` following the existing
  conventions in rails/mod.rs (XxxRequest/XxxResponse serde structs, Json
  error + StatusCode). Includes ready list and blocked list.
- R5: cycle rejection 409 + cycle path; reuse `would_cycle`/`find_cycle` and
  the BatchExecutor validate-before-apply precedent.

## Verification (required — this phase builds Rust)

- `cargo test -p allternit-agent-system-rails` MUST pass. Add unit tests for:
  dependency event round-trip + full-log graph rebuild, event-only get()
  rebuild (labels/status/notes), shared ready function incl. wait-gate
  exclusion, cycle rejection.
- `cargo build -p allternit-api` MUST compile (HTTP layer).
- Record exact commands and outputs in NOTES.

## Constraints

- No new external crates without noting the justification in NOTES.
- Match crate conventions (serde-tagged snake_case events, hash-chained
  envelopes, storage roots under `.allternit/rails/`).
- No refactors outside the listed modules.
