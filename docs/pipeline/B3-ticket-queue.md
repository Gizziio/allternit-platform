# Steering spec — B3: tickets as the pipeline's native queue

<!-- From docs/pipeline/TRACK-B-rails-graph.md Phase B3. DESIGN DECISION (2026-08-02):
     rails tickets ARE the queue's native store (not a frontmatter field, not a
     manual tag). A1 ticket HTTP endpoints and B2 triage already exist in main. -->

## Context

The pipeline queue today is `docs/pipeline/queue/*.md` files — flat, unordered,
dependency-blind. Rails has tickets (A1: typed deps, ready computation, HTTP)
and graph triage (B2: ranked ready work with unblock counts). B3 makes READY
specs become rails tickets, so the queue gains dependency awareness and
triage ordering. Spec files stay as artifact storage; tickets point at them.

## Requirements

- [ ] R1: WHEN check-spec verdicts a spec READY, THE SYSTEM SHALL create a
  rails ticket via `POST /api/rails/tickets` with: title = spec title,
  kind = feature, labels = ["pipeline", "spec:<slug>"], and the spec's queue
  path + brief provenance in `description` (the ONLY free-text field the
  endpoint accepts — TicketCreateRequest has title/description/kind/
  priority/labels; there is no note field and no note-adding endpoint).
  Ticket creation failure = hard error (rails has no fallback; the spec
  stays in specs/ for retry, same precedent as the existing announce
  hard-error — the mv to queue/ today is INDEPENDENT of ticket creation,
  so this gates ticket creation only, never the file queue).
- [ ] R2: WHEN build-queue runs, THE SYSTEM SHALL consume the queue from
  `GET /api/rails/tickets/ready` (NO server-side label filter exists —
  filter pipeline labels CLIENT-SIDE), ordered by
  `GET /api/rails/graph/triage` score (unblocks first, deterministic
  tiebreak), resolving each ticket's `spec:<slug>` label to its queue file.
  KNOWN CAP: the triage response is capped at 50 items while the ready list
  is uncapped — ready tickets absent from the triage response SHALL sort
  after all scored items, ordered by created_at then ticket_id.
  Filesystem queue files without tickets SHALL still build (legacy), after
  ticketed items.
- [ ] R3: WHEN a build completes (built or failed), THE SYSTEM SHALL set the
  ticket's status (closed for built, plus a note; stays open + note for
  failed) via the A1 status endpoint, and record the outcome via
  record-outcome.sh (C4 wiring, one call).
- [ ] R4: WHEN a queued spec declares `blocks: [<slug>, ...]` in its
  frontmatter (generator passes it through from briefs), THE SYSTEM SHALL
  create the dependency edges via `POST /api/rails/tickets/:id/dependencies`
  ({to, kind:"blocks"}; the endpoint rejects cycles with 409), and the ready
  list SHALL exclude blocked items until their blockers close.

## Out of scope

- Migrating historical verdicts to tickets; ticket-side changes (A1/B2 are
  done); auto-merge.

## Acceptance (Gherkin)

- Scenario: READY becomes a ticket
  Given a spec verdicted READY
  When check-spec completes
  Then a ticket exists with label spec:<slug> and verdicts.json records its
  ticket_id; and GET /api/rails/tickets/ready includes it.
- Scenario: triage ordering
  Given ticket-backed specs X (blocks nothing, unblocks 2) and Y (plain)
  When build-queue --all runs
  Then X builds before Y.
- Scenario: dependency gate
  Given spec B with frontmatter blocks: [spec A]
  When both are queued and A is not built
  Then B is absent from the ready list until A's ticket closes.
- Scenario: legacy compat
  Given a queue file with no ticket
  When build-queue runs
  Then it builds after all ticketed items, exactly as before.

## Constraints

- Pipeline scripts fail hard on rails errors (R1) but build-queue falls back
  to legacy file mode if the tickets endpoint is unreachable (documented
  degradation, logged — tickets are an enhancement to build-queue, not a
  hard dependency for legacy files).
- Tests use the existing PATH-shim/stub patterns (no live rails needed).
