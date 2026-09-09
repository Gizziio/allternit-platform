ALTER TABLE computers ADD COLUMN idle_timeout_secs INTEGER;
ALTER TABLE computers ADD COLUMN last_activity_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_computers_idle ON computers(status, idle_timeout_secs);
