-- Inbound webhook triggers: route external events to bots/agents.
--
-- A trigger maps (source, event_type) to a target agent/bot. When a signed
-- webhook is received at /webhooks/inbound/:id, the platform verifies the
-- signature, records the delivery, and creates a Rails ticket so the target
-- bot can pick up the work.
--
-- Merged 2026-09-14 from V88__webhook_triggers.sql (bot-targeted variant:
-- target_bot_id / secret on triggers, response_status / response_body on
-- deliveries). Union schema — every column from both files. V88-only columns
-- are nullable and unused by current code (webhook_trigger_routes.rs writes
-- the V87 shape); constraint conflicts resolve to V87 because that is the
-- schema the running code inserts/selects. All indexes IF NOT EXISTS so the
-- migration re-applies idempotently on DBs that already recorded V88.

CREATE TABLE IF NOT EXISTS webhook_triggers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    org_id TEXT,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_agent_id TEXT NOT NULL,
    prompt_template TEXT,
    execution_mode TEXT NOT NULL DEFAULT 'REQUIRE_APPROVAL' CHECK (execution_mode IN ('PLAN_ONLY', 'REQUIRE_APPROVAL', 'ACCEPT_EDITS', 'BYPASS_PERMISSIONS')),
    secret_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- V88 lineage columns (bot-targeted variant); unused by current code.
    target_bot_id TEXT,
    secret TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_user_id ON webhook_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_org_id ON webhook_triggers(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_target_agent_id ON webhook_triggers(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_source_event ON webhook_triggers(source, event_type);
-- V88 lineage indexes (hardened to IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_org ON webhook_triggers(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_bot ON webhook_triggers(target_bot_id);

-- Delivery audit trail for inbound webhooks.
-- (V88 header: delivery log for observability and retry debugging.)
CREATE TABLE IF NOT EXISTS webhook_trigger_deliveries (
    id TEXT PRIMARY KEY,
    trigger_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    signature_valid INTEGER NOT NULL DEFAULT 0 CHECK (signature_valid IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'failed')),
    ticket_id TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- V88 lineage columns (delivery log); unused by current code.
    response_status INTEGER,
    response_body TEXT,
    FOREIGN KEY (trigger_id) REFERENCES webhook_triggers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_trigger_deliveries_trigger_id ON webhook_trigger_deliveries(trigger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_trigger_deliveries_status ON webhook_trigger_deliveries(status);
-- V88 lineage index (hardened to IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_webhook_trigger_deliveries_trigger ON webhook_trigger_deliveries(trigger_id, created_at DESC);
