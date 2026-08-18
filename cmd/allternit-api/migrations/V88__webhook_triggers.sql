-- Inbound webhook triggers: external systems POST to a public URL and the
-- platform creates a Rails ticket assigned to a target bot.
CREATE TABLE IF NOT EXISTS webhook_triggers (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_bot_id TEXT NOT NULL,
    secret TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_org
    ON webhook_triggers(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_bot
    ON webhook_triggers(target_bot_id);

-- Delivery log for observability and retry debugging.
CREATE TABLE IF NOT EXISTS webhook_trigger_deliveries (
    id TEXT PRIMARY KEY,
    trigger_id TEXT NOT NULL,
    event TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    response_status INTEGER,
    response_body TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trigger_id) REFERENCES webhook_triggers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_trigger_deliveries_trigger
    ON webhook_trigger_deliveries(trigger_id, created_at DESC);
