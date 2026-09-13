-- ── Event idempotency (A:// §5) ───────────────────────────────────────────────
-- At-least-once delivery MUST NOT become at-least-once side effects: event
-- POST endpoints accept a client-supplied idempotency key; duplicate delivery
-- returns the canonical existing event instead of double-writing.
ALTER TABLE cowork_run_events ADD COLUMN client_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cowork_run_events_client_id
    ON cowork_run_events(run_id, client_event_id);
