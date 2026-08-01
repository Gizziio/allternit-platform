# Steering spec — rails mail, Phase E1 (identities + typed envelopes)

<!-- From .pipeline/TRACK-E-rails-mail.md (steered v1). Source of truth for this feature. -->

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

## Constraints

- `cargo test -p allternit-agent-system-rails` passes (new unit tests per
  phase) and `cargo build -p allternit-api` compiles.
- Crate conventions: ledger events + projection folds for state; SQLite only
  as a rebuildable index; `core::io` helpers; `MailXxxRequest` HTTP structs.
