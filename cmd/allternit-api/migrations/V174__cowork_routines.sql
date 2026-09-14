-- ── Cowork routines (consumer-packaged Cowork P4.2) ─────────────────────────
-- Scheduled/background work tied to a principal, executing on Fabric
-- Transport: the routines tick submits a canonical intent per fire, so every
-- routine run is a normal attributed transport run (claim/lease/approve).
CREATE TABLE IF NOT EXISTS cowork_routines (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    workspace    TEXT NOT NULL DEFAULT 'default',
    principal    TEXT,                 -- optional target principal override
    name         TEXT NOT NULL,
    message      TEXT NOT NULL,        -- what the routine asks for (agentic task)
    schedule     TEXT NOT NULL,        -- '*/N' minutes | '@hourly' | '@daily'
    enabled      INTEGER NOT NULL DEFAULT 1,
    last_run_at  DATETIME,
    next_run_at  DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_routines_due ON cowork_routines(enabled, next_run_at);
