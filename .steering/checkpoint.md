# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase E2 rails mail (spec: .steering/spec.md, task: docs/RAILS_MAIL_E2_TASK.md):
FTS search over typed mail (E2-R1) and append-only thread digests (E2-R2).
Standing constraints: SQLite is a rebuildable index only; do NOT touch the
mail_share/share_asset path; legacy/untyped events must be skipped gracefully.

## Just did

E2 implemented. New `rails/src/mail/index.rs`: `MailIndex` (sqlx pool,
ensure_schema, clear+rebuild_from_ledger — `index/search.rs` conventions)
with FTS5 table `mail_messages_fts(message_id, thread_id, from_agent,
subject, body, ts)` at `.allternit/mail/mail_index.db`; bm25-ranked
`search_messages` with FTS5 snippet excerpt; user queries escaped to quoted
plain terms. Index-on-emit hook: `MailOptions.mail_index:
Option<Arc<MailIndex>>`, `send_typed_message` indexes after emit (failure
logged, never fatal); `Mail::search_messages` facade. Wired in
`RailsState::new`; other MailOptions sites pass `None`. Digests in
`projection.rs`: every thread event appends one
`<ts> <actor> <type> <subject-or-first-80-chars>` line to
`.allternit/mail/threads/<id>.digest.md`; `regenerate_digest` rebuilds
exactly from thread JSONL (fixed-point, byte-identical). HTTP:
`GET /mail/search?q=&limit=`, 400 on empty q. mail_share path untouched.

Tests: 11/11 rails mail unit tests pass (search by subject + body word,
legacy/MailAssetShared skipped, rebuild-after-wipe identical + idempotent,
digest order/truncation, regenerate exact + byte-identical).

## Next

Done pending commit: full rails suite 78 passed / 0 failed; API rails tests
3 passed / 0 failed (incl. `mail_e2_search_round_trip`);
`cargo build -p allternit-api` compiles. NOTES written; committing E2.

## Open questions

- (none)
