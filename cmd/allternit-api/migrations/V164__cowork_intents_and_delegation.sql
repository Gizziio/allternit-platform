-- ── Canonical intents + delegation chains (A:// §5 / §8.15) ──────────────────
-- Intent submission is idempotent on intent_id: same intent_id resolves to
-- the same canonical run_id (cowork_intents is the dedup index).
CREATE TABLE IF NOT EXISTS cowork_intents (
    intent_id    TEXT PRIMARY KEY,
    run_id       TEXT NOT NULL,
    envelope     TEXT NOT NULL,
    initiator    TEXT,
    delegator    TEXT,
    causation_chain TEXT NOT NULL DEFAULT '[]',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cowork_intents_run ON cowork_intents(run_id);

-- Append-only delegation causation chains (§8.15). Cycle rejection and
-- depth limits are enforced at write time in fabric transport.
ALTER TABLE cowork_runs ADD COLUMN causation_chain TEXT NOT NULL DEFAULT '[]';
ALTER TABLE cowork_jobs ADD COLUMN causation_chain TEXT NOT NULL DEFAULT '[]';

-- Configurable delegation depth (§8.15): workspace policy may reduce the
-- default of 4; increasing it should require explicit policy.
ALTER TABLE cowork_approval_policy ADD COLUMN max_delegation_depth INTEGER NOT NULL DEFAULT 4;
