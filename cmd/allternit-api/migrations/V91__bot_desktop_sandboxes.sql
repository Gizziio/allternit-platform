-- Persistent desktop sandbox mapping for bots.
-- Each bot may own one long-lived virtual computer that survives across
-- chat sessions and human take-over / hand-back cycles.
CREATE TABLE IF NOT EXISTS bot_desktop_sandboxes (
    bot_id TEXT PRIMARY KEY,
    sandbox_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    host TEXT,
    status TEXT NOT NULL DEFAULT 'creating',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_desktop_sandboxes_sandbox_id
    ON bot_desktop_sandboxes(sandbox_id);

CREATE INDEX IF NOT EXISTS idx_bot_desktop_sandboxes_status
    ON bot_desktop_sandboxes(status);

-- Keep the updated_at timestamp current on writes.
CREATE TRIGGER IF NOT EXISTS bot_desktop_sandboxes_updated_at
AFTER UPDATE ON bot_desktop_sandboxes
BEGIN
    UPDATE bot_desktop_sandboxes
    SET updated_at = CURRENT_TIMESTAMP
    WHERE bot_id = NEW.bot_id;
END;
