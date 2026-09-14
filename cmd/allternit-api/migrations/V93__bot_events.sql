-- Server-owned event ledger for bots (`src/bot_event_routes.rs`).
-- One row per canonical bot event. `seq` is a per-bot monotonic sequence
-- (assigned as COALESCE(MAX(seq),0)+1 inside the insert transaction), used as
-- the pagination cursor by GET /api/v1/bots/:id/events. `idempotency_key`
-- dedupes client retries; SQLite allows multiple NULLs in a UNIQUE column, so
-- events without a key are unaffected.
CREATE TABLE IF NOT EXISTS bot_events (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    session_id TEXT,
    goal_id TEXT,
    wih_id TEXT,
    task_id TEXT,
    run_id TEXT,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    idempotency_key TEXT,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bot_id, seq),
    UNIQUE(bot_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_events_bot_type
    ON bot_events(bot_id, event_type);
