---
status: done
files_changed:
  - rails/src/mail/types.rs
  - rails/src/mail/mail.rs
  - rails/src/mail/mod.rs
  - rails/src/lib.rs
  - rails/src/service.rs
  - rails/src/bin/allternit-rails.rs
  - cmd/allternit-api/src/rails/mod.rs
  - .steering/checkpoint.md
  - docs/RAILS_MAIL_E3_NOTES.md
deviations: []
remaining: []
---

# RAILS MAIL E3 — implementation notes

## What was built

- **E3-R1 (ack tracking + overdue):**
  - `rails/src/mail/types.rs` — `AckState::fold` projects `MessageSent` /
    `MessageAcknowledged` events into per-message, per-recipient ack state
    `{message_id, thread_id, from_agent, to_agents, subject, importance,
    sent_ts, pending, acked}`. Only typed sends with `ack_required: true`
    and a non-empty recipient list are tracked; broadcast messages (empty
    `to_agents`) are excluded (ack_required is meaningless there). A
    recipient moves pending → acked when a `MessageAcknowledged` event
    names them (payload `agent_id`, falling back to the ack event's actor).
  - `rails/src/mail/mail.rs` — `acknowledge_message` gains
    `ack_by: Option<&str>` (emitted as payload `agent_id`): an ack from
    agent X clears only X's pending entry; when all recipients have acked,
    the message leaves overdue. Callers updated: `MailAckRequest.agent_id`
    (service.rs `mail_ack`) and `mail ack --agent` (CLI), both optional and
    backward compatible.
  - `Mail::overdue(agent, older_than_secs)` — with `agent`: pending
    ack-required messages where that agent is a recipient; without: all
    pending ack-required messages with their pending recipient lists.
    `older_than_secs` filters by message age (default 0 = all pending).
    Rows carry the envelope fields + `pending` + `age_seconds`, oldest
    first. `ack_required: false` messages never appear.
  - HTTP: `GET /api/rails/mail/overdue?agent=<id>&older_than=<secs>`.

## Constraints honored

- `mail_share`/`share_asset` untouched (standing non-goal).
- E1/E2 envelope and FTS index behavior unchanged; the only send-path delta
  is the `agent_id` field on `MessageAcknowledged` payloads (ack events are
  not `MessageSent`, so inbox/outbox/search projections are unaffected).

## Verification

- `cargo test -p allternit-agent-system-rails` — **82 passed, 0 failed**
  (4 new E3 tests: one recipient overdue until their ack + wrong-agent ack
  does not clear; two recipients stay overdue after the first ack and clear
  after the second, including an actor-fallback ack with no `agent_id`;
  ack_required=false and broadcast never overdue; `older_than` age math on
  a crafted two-hour-old message).
- `cargo test -p allternit-api rails::tests` — **4 passed, 0 failed**,
  including new oneshot handler test `mail_e3_overdue_round_trip`
  (ack-required send in beta's overdue with envelope + pending +
  age_seconds; unfiltered view; older_than filter; absent after beta's
  ack).
- `cargo build -p allternit-api` — **compiles** (4 pre-existing warnings,
  no errors).
