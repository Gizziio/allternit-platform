# Track E spec — rails mail: agent-layer parity (agent_mail features, rails-native)

Status: DRAFT v1. Phases E1-E3 below. Source: rails mail recon (rails/src/mail/,
index/search.rs, bus/mod.rs, cmd/allternit-api/src/rails/mod.rs) + mcp_agent_mail
research. No beads/agent-mail naming — everything is "rails mail".

## Context

Rails mail today: untyped `AllternitEvent` payloads (`body_ref` opaque string),
per-thread JSONL projections, ledger canonical log, an FTS5 index
(`index/search.rs`) that mail never feeds, and NO agent identity registry
(free-form `Actor.id` strings only). Leases (file reservations) already exist —
out of scope. The `/api/rails/mail/*` endpoints exist but are thin; the
`ensure_mail_thread` helper 500s on any topic not starting `dag:`/`wih:` —
including the API's own `"default"` fallback (`mod.rs:548`), which is broken
today and E1 must fix.

## Phase E1 — identities + typed messages

- [ ] E1-R1: WHEN an agent registers, THE SYSTEM SHALL persist an
  `AgentRegistered` ledger event and maintain a queryable agent projection
  (`.allternit/mail/agents/`) with `agent_id`, display name, registered_at,
  metadata; `GET /api/rails/mail/agents` lists registered agents and
  `POST /api/rails/mail/agents/register` registers one (idempotent on
  agent_id). Agent ids remain caller-chosen strings; no uniqueness enforcement
  beyond idempotency.
- [ ] E1-R2: WHEN a message is sent, THE SYSTEM SHALL accept and persist a
  typed envelope — `from_agent`, `to_agents` (empty = broadcast), `subject`,
  `importance` (low|normal|high), `ack_required` (bool), markdown body stored
  as a file under `.allternit/mail/messages/` with the event payload carrying
  `body_path` — while remaining backward-compatible: a send with only
  `body`/`body_ref` (today's shape) MUST still work unchanged.
  EXPLICIT NON-GOAL: `mail_share`/`share_asset`/`MailAssetShared` and its
  ReceiptRecord side effect are NOT touched by E1 — the discovery pipeline's
  `wih:pipeline-*` traffic flows exclusively through that path and must keep
  working byte-for-byte. Nobody "helpfully" unifies the two paths in this
  phase.
  BUILDER NOTES: (a) inbox/outbox projections MUST skip non-MessageSent
  event types — the existing `wih:pipeline-*` threads contain only
  MailAssetShared events with no from/to fields; assuming typed envelopes
  will break on this real data. (b) the broken thread-validation/default
  pattern is inlined at THREE call sites (mail_send mod.rs:548, mail_share
  mod.rs:665, mail_decide mod.rs:742) — E1-R4 REQUIRES consolidating them
  into one shared helper, not fixing one site.
- [ ] E1-R3: WHEN a caller reads mail per-agent, THE SYSTEM SHALL expose
  `GET /api/rails/mail/inbox/:agent_id` (messages where the agent is in
  `to_agents`, or broadcast) and `GET /api/rails/mail/outbox/:agent_id`
  (messages `from_agent` = id), newest-first with a limit param.
- [ ] E1-R4: WHEN any mail endpoint is called with an omitted thread,
  THE SYSTEM SHALL route it to a valid default thread (fixing the current
  always-500 `"default"` topic bug): the thread-id validation SHALL accept
  `wih:`/`dag:`/`mail:` prefixes, and the default SHALL be `mail:general`.

## Phase E2 — search + digests

- [ ] E2-R1: WHEN a message is emitted, THE SYSTEM SHALL index subject + body
  into a mail FTS5 table (new `rails/src/mail/index.rs`, following
  `index/search.rs` conventions: sqlx, ensure_schema, rebuild_from_ledger) and
  expose `GET /api/rails/mail/search?q=...` returning matching messages with
  thread_id, from_agent, subject, ts, and a body excerpt.
- [ ] E2-R2: WHEN events are appended to a thread, THE SYSTEM SHALL also append
  a one-line digest entry to `.allternit/mail/threads/<id>.digest.md`
  (append-only markdown: ts, actor, event type, subject/first-80-chars), built
  so it can be regenerated from the thread JSONL.

## Phase E3 — acks + overdue

- [ ] E3-R1: WHEN a message is sent with `ack_required: true`, THE SYSTEM SHALL
  track per-recipient ack state (projection fold of MessageSent /
  MessageAcknowledged events with per-recipient `ack_ts`), and
  `GET /api/rails/mail/overdue` SHALL return messages whose ack is missing
  after a caller-supplied age threshold.

## Out of scope

- Contact policies / cross-project links (needs EventScope wiring; later).
- Git-committing the mail archive (dolt/git wiring; later).
- Leases (exist), tickets (Track A), graph (Track B).

## Acceptance (Gherkin)

- Scenario: typed send, typed read
  Given agents alpha and beta are registered
  When alpha sends a message to beta with subject, high importance,
  ack_required=true
  Then beta's inbox contains it with the full envelope, beta's overdue list
  (E3) contains it until acked, and alpha's outbox contains it.
- Scenario: backward compatibility
  Given a send request using only {"body": "hello"} with no thread
  When POST /api/rails/mail/send runs
  Then it succeeds and lands in thread `mail:general`.
- Scenario: search finds content
  Given a message with subject "deploy window Friday"
  When GET /api/rails/mail/search?q=deploy is called
  Then the message is returned with an excerpt; and after wiping the mail
  index db, rebuild_from_ledger restores the same result.
- Scenario: digest regeneration
  Given a thread with 5 events
  When the digest file is deleted and regenerated from the thread JSONL
  Then it contains exactly 5 one-line entries in order.

## Constraints

- `cargo test -p allternit-agent-system-rails` passes (new unit tests per
  phase) and `cargo build -p allternit-api` compiles.
- Crate conventions: ledger events + projection folds for state; SQLite only
  as a rebuildable index; `core::io` helpers; `MailXxxRequest` HTTP structs.
