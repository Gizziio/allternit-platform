CREATE TABLE IF NOT EXISTS desktop_audit_logs (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    action TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_desktop_audit_bot_id ON desktop_audit_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_desktop_audit_user_id ON desktop_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_desktop_audit_created_at ON desktop_audit_logs(created_at);
