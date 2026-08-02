# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

Phase B3 (spec: .steering/spec.md R1–R4, task: docs/B3_TASK.md): rails tickets
as the pipeline's native queue. check-spec creates a ticket on READY
(description field, labels pipeline+spec:<slug>, ticket_id merged into
verdicts.json); build-queue consumes GET /tickets/ready filtered client-side,
ordered by graph/triage score (50-cap fallback: created_at then ticket_id),
legacy files last, degrade to legacy when the endpoint is down; on built/failed
close/PATCH the ticket + record-outcome.sh; blocks: frontmatter → dependency
edges; tests stubbed; then B3_NOTES + sentinel + prescribed commit.

## Just did

All R1–R4 implemented and every .pipeline test is green:
- check-spec.sh: verdict_set now MERGE semantics (+ verdict_merge helper);
  READY path does announce → mv → verdict_set(READY) → ticket_create (hard
  error on failure, spec stays queued + READY, builds legacy — gates ticket
  creation only per R1's parenthetical) → ticket_id merged; R4 edges posted
  blocker → new ticket (edge from blocks to, confirmed in
  rails/src/dependencies.rs), 409/missing-blocker logged to errors.log,
  non-fatal.
- build-queue.sh: --all uses compute_queue_order (ready + triage via python3,
  label filter client-side, scored > 50-cap fallback by created_at/ticket_id
  > legacy; blocked = has ticket_id but not ready → skipped, NOT legacy);
  endpoint down → logged degrade to legacy glob order; triage down → ordering
  degrade only. R3 after watch verdict: built → close (reason = NOTES path),
  failed → GET+PATCH description note, then record-outcome merged|failed
  (advisory). record-outcome.sh now accepts `failed`.
- generate-spec.cjs: brief frontmatter `blocks` (dashed or inline) passed
  through to spec frontmatter.
- Tests: check-spec-test.sh +12 checks, build-queue-test.sh +12 checks,
  generate-spec-test.cjs +4 checks, taste-test.sh curl stub gained the ticket
  branch. Full suite green: check-spec, build-queue (66), contract, wiki,
  taste, generate-spec, scout.
- .pipeline/README.md B3 paragraphs added.

## Next

Write docs/B3_NOTES.md (YAML frontmatter like BRAIN_D1_NOTES) +
docs/B3_NOTES.sentinel, then the prescribed commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline): rails
tickets as the native queue (B3)"`. Fix and retry if the gate blocks.

## Open questions

- (none)
