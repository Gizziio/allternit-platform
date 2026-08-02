# PHASE E3 TASK — rails mail: acks + overdue

You are the executor continuing in this session. E1 and E2 (identities,
envelopes, search, digests) are reviewed, approved, merged — your previous
work. `.steering/spec.md` (Phase E3: R1 + acceptance) is the source of truth.
Same workflow rules: checkpoints, [steering] authoritative, NOTES + sentinel,
then commit
`git add rails cmd .steering docs && git commit -m "feat(rails): mail ack tracking + overdue view (E3)"`.

## Build

1. **Ack state projection** (extend the mail projection layer from E1/E2):
   fold `MessageSent` (with `ack_required: true` and `to_agents`) and
   `MessageAcknowledged` events into per-message, per-recipient ack state:
   `{message_id, thread_id, from_agent, subject, sent_ts, ack_required,
   pending: [agent_ids], acked: {agent_id: ack_ts}}`.
   A recipient is pending until a `MessageAcknowledged` event names them (or
   their agent_id matches the ack's actor) for that message.
2. **HTTP** `GET /api/rails/mail/overdue?agent=<id>&older_than=<secs>`:
   - With `agent`: pending ack-required messages where that agent is a
     recipient, older than the threshold (default 0 = all pending).
   - Without `agent`: all pending ack-required messages with their pending
     recipient lists.
   - Response: message envelope fields + `pending` + `age_seconds`, oldest
     first. Messages with `ack_required: false` never appear.
3. **Ack path**: the existing `acknowledge_message` (mail.rs:68) gains
   per-recipient semantics: an ack from agent X clears only X's pending
   entry; when all recipients have acked, the message leaves overdue.
   Broadcast messages (empty to_agents): ack_required is meaningless —
   exclude from overdue entirely.
4. **Tests**: send with ack_required to one recipient → overdue until ack;
   two recipients → stays overdue after first ack, clears after second;
   ack_required=false never overdue; older_than filter math correct;
   broadcast + ack_required excluded. HTTP handler test via the oneshot
   precedent.

## Constraints

- `cargo test -p allternit-agent-system-rails` passes;
  `cargo build -p allternit-api` compiles. Record in NOTES.
- Do not touch mail_share/share_asset (standing non-goal).
- Keep the E1/E2 envelope and index behavior unchanged except as needed for
  ack state.
