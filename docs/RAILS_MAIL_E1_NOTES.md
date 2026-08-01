---
status: done
files_changed:
  - rails/src/mail/mod.rs
  - rails/src/mail/mail.rs
  - rails/src/mail/agents.rs
  - rails/src/mail/types.rs
  - rails/src/lib.rs
  - cmd/allternit-api/src/rails/mod.rs
  - .steering/checkpoint.md
  - docs/RAILS_MAIL_E1_NOTES.md
deviations: []
remaining: []
---

# RAILS MAIL E1 — implementation notes

## What was built

- **E1-R1 (identities):** `rails/src/mail/agents.rs` — `AgentRegistry` emits
  `AgentRegistered` ledger events and maintains a projection under
  `.allternit/mail/agents/<agent_id>.json` (agent_id, display_name,
  registered_at, metadata). `register_agent` is idempotent on `agent_id`
  (returns the existing record, no duplicate event). Reads fold the ledger
  (source of truth) and backfill missing projection files. Agent ids are
  caller-chosen; ids that could escape the projection directory are rejected.
  HTTP: `POST /api/rails/mail/agents/register` (`{agent, created}`),
  `GET /api/rails/mail/agents`.
- **E1-R2 (typed envelopes):** `rails/src/mail/types.rs` — `TypedMessage`
  (from_agent, to_agents empty = broadcast, subject, importance
  low|normal|high, ack_required, body). `Mail::send_typed_message` writes the
  markdown body to `.allternit/mail/messages/<event_id>.md` and the
  `MessageSent` payload carries `body_path` plus the full envelope. The
  legacy `send_message(body_ref)` path is unchanged; `POST /mail/send`
  branches on the presence of `from_agent` (typed) vs not (legacy).
  NON-GOAL respected: `mail_share`/`share_asset`/`MailAssetShared` and its
  ReceiptRecord side effect are untouched.
- **E1-R3 (inbox/outbox):** `Mail::inbox` / `Mail::outbox` fold the ledger
  through `MailMessage::from_event`, which returns `None` for any
  non-`MessageSent` event — so `MailAssetShared`-only `wih:pipeline-*`
  threads are skipped, not mis-parsed. Legacy sends map `from_agent` to the
  emitting actor and `to_agents` to `[]` (broadcast). Newest-first with a
  limit param. HTTP: `GET /api/rails/mail/inbox/:agent_id?limit=N`,
  `GET /api/rails/mail/outbox/:agent_id?limit=N`.
- **E1-R4 (thread default fix):** one shared validation/default helper per
  layer — `resolve_thread_id` in the rails crate (accepts `dag:`/`wih:`/
  `mail:` prefixes; omitted thread ⇒ `mail:general`) and
  `resolve_mail_thread` in `cmd/allternit-api/src/rails/mod.rs`, now called
  by all three sites (mail_send, mail_share, mail_decide). The old
  `"default"` topic (always-500) is gone.

## Verification

- `cargo test -p allternit-agent-system-rails` — **72 passed, 0 failed**
  (new unit tests: thread-id resolution incl. `mail:general` default;
  typed+legacy send coexistence with inbox skipping `MailAssetShared`;
  typed send rejects invalid thread; registry idempotency + projection;
  unsafe agent-id rejection).
- `cargo test -p allternit-api rails::tests` — **2 passed, 0 failed**,
  including the new oneshot handler test
  `rails::tests::mail_e1_endpoints_round_trip` (office_cli_routes.rs oneshot
  precedent): legacy `{"body":"hello"}` send lands in `mail:general`, invalid
  thread → 400, idempotent register, typed send persists body file + full
  envelope in beta's inbox and alpha's outbox, share to `wih:pipeline-probe`
  works and does not leak into inboxes.
- `cargo build -p allternit-api` — **compiles** (4 pre-existing warnings,
  no errors).
- Share-path probe against the running dev API:
  `POST http://localhost:8013/api/rails/mail/share`
  `{"thread":"wih:pipeline-probe","asset_ref":"outputs/e1-probe.txt"}` →
  `{"share_id":"evt_1785554138474_000000","shared":true,"thread_id":"wih:pipeline-probe"}`.

## Notes

- Behavior change vs. before: an explicit invalid thread now returns 400
  (was 500); an omitted thread routes to `mail:general` (was a 500 on the
  `"default"` topic). This is the R4 fix itself.
