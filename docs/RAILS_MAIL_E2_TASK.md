# PHASE E2 TASK — rails mail: FTS search + thread digests

You are the executor continuing in this session. E1 (identities, typed
envelopes, inbox/outbox) is reviewed, approved, and merged — your previous
work. `.steering/spec.md` (Phase E2: R1–R2 + acceptance) is the source of
truth. Same workflow rules: checkpoint updates, [steering] is authoritative,
NOTES + sentinel, then commit
`git add rails cmd .steering docs && git commit -m "feat(rails): mail FTS search + thread digests (E2)"`.

## Build

1. **`rails/src/mail/index.rs`** (new): mail FTS index following
   `rails/src/index/search.rs` conventions exactly (sqlx pool,
   `ensure_schema`, `rebuild_from_ledger`, db at
   `.allternit/mail/mail_index.db`):
   - FTS5 virtual table over typed mail messages: subject + body text +
     message_id/thread_id/from_agent/ts columns.
   - Index on emit: hook the typed-message send path from E1 so every new
     `MessageSent` with a typed envelope is indexed (skip untyped/legacy
     events gracefully — the wih:pipeline-* traffic must not break indexing).
   - `rebuild_from_ledger`: full rescan, idempotent, used for recovery.
   - `search_messages(query, limit)`: bm25-ranked results with
     thread_id, from_agent, subject, ts, and a short body excerpt (FTS
     snippet or first ~120 chars).
2. **HTTP**: `GET /api/rails/mail/search?q=...&limit=...` in
   `cmd/allternit-api/src/rails/mod.rs` (existing conventions). 400 on empty
   q. Handler test using the oneshot precedent from B2/E1.
3. **Digests** (extend `rails/src/mail/projection.rs`): on every thread event
   append one line to `.allternit/mail/threads/<id>.digest.md` — append-only,
   format: `<ts> <actor> <event_type> <subject-or-first-80-chars>`. Plus
   `regenerate_digest(thread_id)` that rebuilds the file exactly from the
   thread JSONL (so delete+regenerate is a fixed-point).
4. **Tests**: index-then-search finds by subject and by body word; legacy
   untyped events skipped without error; rebuild_from_ledger after wiping
   the db returns the same result; digest append order matches event order;
   regenerate produces exactly N lines for N events and is byte-identical on
   second regeneration.

## Constraints

- `cargo test -p allternit-agent-system-rails` passes;
  `cargo build -p allternit-api` compiles. Record in NOTES.
- SQLite is a rebuildable index only — canonical state stays in the ledger/
  projections. No message content stored ONLY in the index.
- Do not touch the mail_share/share_asset path (Track E standing non-goal).
