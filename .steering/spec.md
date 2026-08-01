# Steering spec — rails mail, Phase E3 (acks + overdue)

<!-- From .pipeline/TRACK-E-rails-mail.md (steered v1). E1+E2 merged in main. -->

## Acceptance (Gherkin) — E3

- Scenario: ack lifecycle
  Given registered agents alpha and beta
  When alpha sends beta a message with ack_required=true
  Then beta's overdue list contains it until an ack event, after which it is absent;
  and messages with ack_required=false never appear in overdue.

## Phase E3 — acks + overdue

- [ ] E3-R1: WHEN a message is sent with `ack_required: true`, THE SYSTEM SHALL
  track per-recipient ack state (projection fold of MessageSent /
  MessageAcknowledged events with per-recipient `ack_ts`), and
  `GET /api/rails/mail/overdue` SHALL return messages whose ack is missing
  after a caller-supplied age threshold.


## Constraints

- `cargo test -p allternit-agent-system-rails` passes (new unit tests per
  phase) and `cargo build -p allternit-api` compiles.
- Crate conventions: ledger events + projection folds for state; SQLite only
  as a rebuildable index; `core::io` helpers; `MailXxxRequest` HTTP structs.
