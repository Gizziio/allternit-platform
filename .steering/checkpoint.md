# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase E1 rails mail (spec: .steering/spec.md, task: docs/RAILS_MAIL_E1_TASK.md):
agent identities (R1), typed envelopes (R2), per-agent inbox/outbox (R3), and
thread-id consolidation with `mail:general` default (R4). Binding NON-GOAL:
`mail_share`/`share_asset`/`MailAssetShared` + its ReceiptRecord side effect
stay byte-for-byte identical; inbox/outbox projections MUST skip
non-`MessageSent` events.

## Just did

Implemented all of E1. Rails crate: `rails/src/mail/mail.rs` gained the
shared thread helpers (`resolve_thread_id` / `canonical_thread_id` /
`ensure_thread_id` accepting `dag:`/`wih:`/`mail:`, default `mail:general`),
typed send (body file under `.allternit/mail/messages/`, event carries
`body_path`), and inbox/outbox folds that skip non-`MessageSent` events.
New `rails/src/mail/agents.rs` (AgentRegistered events, idempotent register,
projection under `.allternit/mail/agents/`) and `rails/src/mail/types.rs`
(MailImportance, TypedMessage, MailMessage::from_event). API layer:
`resolve_mail_thread` helper now used by mail_send/mail_share/mail_decide
(R4 consolidation); typed-vs-legacy branch in mail_send; new endpoints
`GET /mail/agents`, `POST /mail/agents/register`, `GET /mail/inbox/:id`,
`GET /mail/outbox/:id`. mail_share/share_asset/MailAssetShared + its
ReceiptRecord side effect untouched.

Verified: `cargo test -p allternit-agent-system-rails` 72 passed 0 failed
(5 new mail unit tests); API oneshot handler test
`rails::tests::mail_e1_endpoints_round_trip` passes (2/2 rails tests);
live share probe: `POST localhost:8013/api/rails/mail/share` to
`wih:pipeline-probe` → `{"shared":true,"thread_id":"wih:pipeline-probe"}`.

## Next

Wait for `cargo build -p allternit-api` to finish, then write
`docs/RAILS_MAIL_E1_NOTES.md` + sentinel and commit
(`git add rails cmd .steering docs`).

## Open questions

- (none)
