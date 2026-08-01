# Steering spec — rails mail, Phase E2 (search + digests)

<!-- From .pipeline/TRACK-E-rails-mail.md (steered v1). E1 merged in main. -->

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


## Acceptance (Gherkin) — E2

- Scenario: search finds content
  Given a message with subject "deploy window Friday"
  When GET /api/rails/mail/search?q=deploy is called
  Then the message is returned with an excerpt; and after wiping the mail
  index db, rebuild_from_ledger restores the same result.
- Scenario: digest regeneration
- Scenario: digest regeneration
  Given a thread with 5 events
  When the digest file is deleted and regenerated from the thread JSONL
  Then it contains exactly 5 one-line entries in order.


## Constraints

- `cargo test -p allternit-agent-system-rails` passes (new unit tests per
  phase) and `cargo build -p allternit-api` compiles.
- Crate conventions: ledger events + projection folds for state; SQLite only
  as a rebuildable index; `core::io` helpers; `MailXxxRequest` HTTP structs.
