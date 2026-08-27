---
status: done
files_changed:
  - docs/pipeline/bin/check-spec.sh
  - docs/pipeline/bin/build-queue.sh
  - docs/pipeline/bin/record-outcome.sh
  - docs/pipeline/bin/generate-spec.cjs
  - docs/pipeline/bin/check-spec-test.sh
  - docs/pipeline/bin/build-queue-test.sh
  - docs/pipeline/bin/generate-spec-test.cjs
  - docs/pipeline/bin/taste-test.sh
  - docs/pipeline/README.md
  - .steering/checkpoint.md
  - docs/B3_NOTES.md
tests_green: true
deviations:
  - "R1 ordering ambiguity resolved per B3_TASK's explicit build order (\"after the existing announce + mv to queue/, create the ticket\") and R1's concluding parenthetical (\"this gates ticket creation only, never the file queue\"): the order is announce → mv → verdict_set(READY) → ticket POST. On ticket-creation failure the run hard-errors (errors.log + exit 1) but the spec STAYS in queue/ with its READY verdict and builds via the legacy path; it is not moved back to specs/. Automatic ticket-creation retry is not wired (the READY verdict is terminal for check-spec); the hard error is surfaced for a human."
  - "R4 edge direction: frontmatter `blocks: [A]` on spec B means B waits for A (per the acceptance scenario \"B is absent from the ready list until A's ticket closes\"), so edges are posted blocker → new ticket (rails semantics: from blocks to, confirmed in rails/src/dependencies.rs). The blocker ticket is resolved via GET /tickets?label=spec:<slug>; if the blocker has no ticket yet (not READY), the edge is skipped and logged to errors.log — edges are not retroactively created later."
  - "R3 failed path: TicketUpdateRequest has no note/status-note field, so the failure note is appended to the ticket's description via GET + PATCH (the only free-text field the update endpoint accepts), per \"status note via PATCH if available\"."
  - "record-outcome.sh gained a fourth outcome `failed` (B3_TASK prescribes `record-outcome.sh <slug> merged|failed`); it lands in the existing failed trust-tier branch. R3 wiring fires only on the watch verdict, not on ao-spawn/ao-send infrastructure failures (no build outcome exists then)."
  - "R2 explicit-slug mode keeps user-specified order; the ticketed path (ready + triage) governs --all only. List mode (no args) stays filesystem-only and read-only."
remaining:
  - "Ticket-creation retry after a hard-error run is manual (see deviations): a READY spec in queue/ without ticket_id builds legacy forever unless a human recreates the ticket or re-queues the spec."
  - "Deferred dependency edges (blocker had no ticket at creation time) are logged but never re-attempted; a sweeper could re-scan queue files' blocks frontmatter against the ticket store."
---
# B3 — rails tickets as the pipeline's native queue: completion notes

## What was built (spec .steering/spec.md R1–R4, task docs/B3_TASK.md)

### R1 — READY becomes a ticket (check-spec.sh)

- New helpers: `spec_frontmatter_field` (minimal YAML-subset reader: dashed
  and inline `[a, b]` list forms), `split_resp` (tolerates capture stubs that
  omit curl's `-w` status line), `ticket_create`, `ticket_find_by_label`,
  `ticket_add_dependency`.
- READY path order: announce (hard error, existing) → `mv` to queue/ →
  `verdict_set READY` → `POST /api/rails/tickets` with title = spec's first
  `# ` heading, kind `feature`, labels `["pipeline","spec:<slug>"]`, and the
  queue path + brief `provenance_refs` in `description` (TicketCreateRequest's
  only free-text field — no note field exists). The returned `ticket.id` is
  merged into `verdicts.json`.
- `verdict_set` is now MERGE semantics (the per-slug dict is updated, never
  replaced) plus a generic `verdict_merge` helper — a later `verdict_set` for
  the same slug can never wipe `ticket_id`.
- Ticket-creation failure = hard error: `errors.log` + exit 1. Per R1's
  parenthetical it gates ticket creation only, never the file queue: the spec
  stays in `queue/` with its READY verdict and builds via the legacy path.

### R2 — build-queue consumes tickets (--all)

- `compute_queue_order` (python3, no jq): fetches `GET
  /api/rails/tickets/ready` and `GET /api/rails/graph/triage`, filters
  client-side for the `pipeline` label (no server-side label filter on
  ready), maps `spec:<slug>` labels to queue files, and classifies each queue
  file:
  - `T` ticketed, in build order: triage-scored items first (triage's own
    deterministic order), then ready tickets missing from the 50-capped
    triage response by `created_at` then `ticket_id`;
  - `B` has a `ticket_id` in verdicts.json but is not in the ready list
    (blocked by open dependencies, or closed) — skipped, never built legacy;
  - `L` legacy ticket-less file — always builds after all ticketed items.
- Tickets endpoint unreachable/unparseable → logged (`errors.log` + stderr)
  degrade to legacy file mode (glob order) — documented fallback; legacy
  files are never gated on rails. Triage failure degrades ordering only (all
  ticketed items unscored), never the mode.
- Explicit-slug mode keeps user-specified order; list mode stays read-only.

### R3 — build completion updates the ticket + records the outcome

- After the watch verdict is recorded (built or failed), before the announce:
  - built → `POST /api/rails/tickets/:id/close` with `reason` = the worktree
    NOTES path;
  - failed → ticket stays open; the failure note (`[build-queue] failed:
    <slug> (watch exit N) at <ts>`) is appended to the ticket's description
    via GET + PATCH;
  - then `record-outcome.sh <slug> merged|failed` (C4 wiring, one call;
    invoked via the `RECORD_OUTCOME` override point so tests can stub it).
- Both are logged-and-continue (advisory); the rails mail announcement
  remains the hard error. `record-outcome.sh` now accepts `failed`
  (failed trust tier, like reverted/rejected).

### R4 — blocks frontmatter → dependency edges

- `generate-spec.cjs` passes a brief's frontmatter `blocks` list (dashed or
  inline) through to the generated spec's frontmatter (emitted as a dashed
  list before the closing `---`).
- At ticket creation, check-spec reads the queued spec's `blocks` list; for
  each blocker slug it resolves the blocker's ticket via
  `GET /api/rails/tickets?label=spec:<slug>` and posts
  `POST /api/rails/tickets/<blocker-id>/dependencies` `{to: <new-id>,
  kind: "blocks"}` (edge blocker → new ticket: the blocker blocks the new
  ticket). A 409 cycle rejection is logged and the spec flagged in
  `errors.log`; a blocker without a ticket is logged likewise. Both are
  non-fatal. The ready-list exclusion itself is rails-side
  (`tickets::ready`), already live since A1.

## Tests (stubbed curl capture, no live rails)

- `check-spec-test.sh` (+12 checks): READY → ticket POST with description
  (asserting NO note field on the ticket payload), kind/labels/title;
  ticket_id merged into verdicts.json; dependency POST blocker → new ticket
  with kind blocks; 409 cycle logged + flagged, run continues; missing
  blocker logged, run continues; ticket-creation failure = exit non-zero +
  errors.log + spec stays in queue/ + READY verdict kept + no ticket_id;
  verdict_set merge semantics (ticket_id survives a later NEEDS-WORK set).
- `build-queue-test.sh` (+12 checks): scored > 50-cap fallback (created_at) >
  legacy ordering; blocked ticket skipped (not built legacy); close-on-built
  with reason = NOTES path + `record-outcome merged`; failed → no close,
  PATCH with appended note on the fetched description + `record-outcome
  failed`; triage-down → created_at ordering; endpoint-down → logged legacy
  degrade in glob order.
- `generate-spec-test.cjs` (+4 checks): dashed and inline `blocks`
  pass-through into spec frontmatter.
- `taste-test.sh`: curl stub gained the ticket-creation branch (check-spec
  now creates tickets on READY).

Full suite green: check-spec-test, build-queue-test (66 checks),
contract-test, wiki-test, taste-test, generate-spec-test, scout-test.

## Constraints honored

- No rails-crate changes — HTTP consumer only (`cmd/allternit-api` untouched).
- bash + python3 only, no jq.
- All stub-based tests; no live rails required.
