-- Trigger history table for schedule audit/observability
CREATE TABLE IF NOT EXISTS trigger_history (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    run_id TEXT,
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    metadata TEXT,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trigger_history_schedule_id ON trigger_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_trigger_history_triggered_at ON trigger_history(triggered_at);
