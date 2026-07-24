-- Execution records for POST /agents/:id/runs (run_agent in agent_routes.rs).
-- One row per run: inserted with status 'running' when the run starts, updated
-- with the terminal status ('completed' | 'failed'), output/error, duration and
-- completion timestamp when the gizzi round-trip resolves. Read back by
-- GET /agents/:id/runs (newest first, capped at 50).
CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id);
