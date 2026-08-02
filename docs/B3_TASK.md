# B3 TASK — tickets as the pipeline's native queue

You are the executor. `.steering/spec.md` (R1–R4 + acceptance) is the source
of truth — read it fully, including the inline builder notes (description-
not-note, triage 50-cap fallback ordering, verdicts.json MERGE semantics,
client-side label filtering, named dependency endpoint). They are binding.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/B3_NOTES.md` with YAML frontmatter, then
   `touch docs/B3_NOTES.sentinel`.
3. Then commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline): rails tickets as the native queue (B3)"`.
   A gate reviews; fix and retry if blocked.

## Build map (per spec)

1. **check-spec.sh (R1)**: on READY, after the existing announce + mv to
   queue/, create the ticket via `POST localhost:8013/api/rails/tickets`
   (title from spec's first heading, kind feature, labels
   ["pipeline","spec:<slug>"], description = queue path + brief provenance).
   Hard error on failure (spec stays put). Record ticket_id in verdicts.json
   with MERGE semantics — change `verdict_set` to merge per-slug dicts (or
   add a ticket-id setter); a later verdict_set for the same slug must never
   wipe ticket_id.
2. **build-queue.sh (R2)**: new ticketed path before legacy:
   fetch `GET /api/rails/tickets/ready`, filter client-side for the
   "pipeline" label, map spec:<slug> labels to queue files; order by
   `GET /api/rails/graph/triage` score; tickets missing from the (capped-50)
   triage response sort after scored items by created_at then ticket_id.
   If the tickets endpoint is unreachable: log + degrade to legacy file mode
   (documented). Legacy files always build after ticketed items.
3. **R3**: on built → `POST /api/rails/tickets/:id/close` (reason = NOTES
   path); on failed → leave open + status note via PATCH if available.
   Then call record-outcome.sh <slug> merged|failed (C4 wiring).
4. **R4**: generator passes `blocks: [...]` frontmatter through from briefs
   (add to the frontmatter pass-through if absent); on ticket creation, read
   the spec's blocks list and POST the edges via
   `/api/rails/tickets/:id/dependencies` ({to, kind:"blocks"}) — 409 cycle
   rejection logged, spec flagged in errors.log.
5. **Tests** (existing shim patterns; no live rails): stub curl capture like
   wiki-test/check-spec-test. Verify: READY → ticket POST with description
   (not a note field) + ticket_id merged into verdicts.json (and preserved
   across a later verdict_set); ordering scored > unscapped-fallback >
   legacy; triage-missing tickets ordered by created_at; blocks frontmatter
   produces dependency POSTs; close-on-built + record-outcome called;
   endpoint-down degrade to legacy. PASS/FAIL, non-zero on FAIL.
   Keep build-queue-test.sh and check-spec-test.sh green.

## Constraints

- No rails-crate changes (A1/B2 are done — HTTP consumer only).
- Pipeline conventions: bash + python3, no jq.
