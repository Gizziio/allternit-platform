# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase E3 rails mail (spec: .steering/spec.md, task: docs/RAILS_MAIL_E3_TASK.md):
per-recipient ack tracking + overdue view (E3-R1). Standing constraints: do
NOT touch mail_share/share_asset; keep E1/E2 envelope + index behavior
unchanged except as needed for ack state.

## Just did

E3 implemented. `rails/src/mail/types.rs`: `AckState::fold` (MessageSent with
ack_required + non-empty to_agents → pending recipients;
MessageAcknowledged moves the agent named by payload `agent_id`, falling
back to the event's actor, from pending → acked; broadcast excluded) +
`OverdueMessage`. `rails/src/mail/mail.rs`: `acknowledge_message` gains
`ack_by: Option<&str>` (per-recipient semantics); new `Mail::overdue(agent,
older_than_secs)` → envelope + pending + age_seconds, oldest first.
Callers updated: service.rs `MailAckRequest.agent_id`, CLI `mail ack
--agent`. HTTP: `GET /mail/overdue?agent=&older_than=` (default 0 = all
pending). mail_share untouched; E1/E2 envelope + index behavior unchanged.

Unit tests: 15/15 rails mail tests pass (one recipient overdue until their
ack; wrong-agent ack doesn't clear; two recipients clear after second ack,
incl. actor-fallback ack; ack_required=false + broadcast never overdue;
older_than age math).

## Next

Done pending commit: rails suite 82 passed / 0 failed; API rails tests
4 passed / 0 failed (incl. `mail_e3_overdue_round_trip`); NOTES written.
Waiting on `cargo build -p allternit-api`, then sentinel + commit E3.

## Open questions

- (none)
