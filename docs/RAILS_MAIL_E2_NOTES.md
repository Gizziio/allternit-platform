---
status: done
files_changed:
  - rails/src/mail/index.rs
  - rails/src/mail/mail.rs
  - rails/src/mail/projection.rs
  - rails/src/mail/mod.rs
  - rails/src/lib.rs
  - rails/src/service.rs
  - rails/src/bin/allternit-rails.rs
  - cmd/allternit-api/src/rails/mod.rs
  - .steering/checkpoint.md
  - docs/RAILS_MAIL_E2_NOTES.md
deviations: []
remaining: []
---

# RAILS MAIL E2 — implementation notes

## What was built

- **E2-R1 (FTS search):** new `rails/src/mail/index.rs` — `MailIndex`
  following `rails/src/index/search.rs` conventions (sqlx pool,
  `ensure_schema`, `clear` + `rebuild_from_ledger`). FTS5 table
  `mail_messages_fts(message_id, thread_id, from_agent, subject, body, ts)`
  at `.allternit/mail/mail_index.db`. Index-on-emit: `MailOptions` gains
  `mail_index: Option<Arc<MailIndex>>`; `Mail::send_typed_message` indexes
  after emit (indexing failure is logged, never fatal — the index is
  rebuildable). `index_event` indexes only typed `MessageSent` envelopes
  (`from_agent` + `body_path` present); legacy `body_ref` sends and
  non-`MessageSent` traffic (`MailAssetShared` on `wih:pipeline-*` threads)
  are skipped gracefully. `rebuild_from_ledger` clears then rescans —
  idempotent, used for recovery after the db is wiped.
  `search_messages(query, limit)` returns bm25-ranked hits with
  thread_id, from_agent, subject, ts, and an FTS5 `snippet` body excerpt;
  user input is escaped into quoted plain terms so FTS operators can't
  break the MATCH. HTTP: `GET /api/rails/mail/search?q=...&limit=...`
  (400 on empty/missing `q`).
- **E2-R2 (thread digests):** `rails/src/mail/projection.rs` —
  `append_thread_event` now also appends one line to
  `.allternit/mail/threads/<id>.digest.md` per thread event, format
  `<ts> <actor> <event_type> <subject-or-first-80-chars>` (subject falls
  back to body_ref/note/asset_ref/decision/topic, whitespace-flattened,
  80 chars max). `regenerate_digest(root_dir, thread_id)` rebuilds the file
  exactly from the thread JSONL: N events → N lines in event order,
  byte-identical on every regeneration.

## Constraints honored

- SQLite is a rebuildable index only — message bodies live in
  `.allternit/mail/messages/`, canonical state in the ledger; the index db
  can be wiped and restored via `rebuild_from_ledger` (tested).
- `mail_share`/`share_asset` path untouched (Track E standing non-goal);
  its events do get digest lines (digests cover every thread event) but are
  excluded from the FTS index.

## Verification

- `cargo test -p allternit-agent-system-rails` — **78 passed, 0 failed**
  (6 new E2 tests: search by subject/body word + FTS-operator escaping;
  legacy/non-message events skipped; rebuild after db wipe restores
  identical results and is idempotent; digest append order; digest
  fallback/truncation; regenerate exact + byte-identical).
- `cargo test -p allternit-api rails::tests` — **3 passed, 0 failed**,
  including new oneshot handler test `mail_e2_search_round_trip`
  (q=deploy finds the typed message with excerpt; legacy send not indexed;
  body-word search; empty/missing q → 400).
- `cargo build -p allternit-api` — **compiles** (4 pre-existing warnings,
  no errors).
