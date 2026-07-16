-- Hosted-runtime lifecycle, entitlement, and metered-usage support.
--
-- Migration 013 introduced the Fly Machine record, but the API also writes a
-- `name` field that was accidentally omitted from that table. Keep the repair
-- in a forward migration because 013 is already deployed.

ALTER TABLE hosted_runtime_instances
    ADD COLUMN name TEXT NOT NULL DEFAULT 'Allternit Hosted';
ALTER TABLE hosted_runtime_instances
    ADD COLUMN idle_timeout_minutes INTEGER NOT NULL DEFAULT 15;
ALTER TABLE hosted_runtime_instances
    ADD COLUMN last_activity_at TIMESTAMP;
ALTER TABLE hosted_runtime_instances
    ADD COLUMN active_since TIMESTAMP;
ALTER TABLE hosted_runtime_instances
    ADD COLUMN stop_reason TEXT;

-- Paid tiers cap both instance count and requested machine size. The boolean
-- entitlement remains the kill switch; these fields control its blast radius.
ALTER TABLE plan_tiers
    ADD COLUMN max_hosted_runtimes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plan_tiers
    ADD COLUMN max_hosted_runtime_memory_mb INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_runtime_quotas
    ADD COLUMN max_hosted_runtimes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_runtime_quotas
    ADD COLUMN max_hosted_runtime_memory_mb INTEGER NOT NULL DEFAULT 0;

UPDATE plan_tiers
SET max_hosted_runtimes = CASE id WHEN 'pro' THEN 1 WHEN 'team' THEN 5 ELSE 0 END,
    max_hosted_runtime_memory_mb = CASE id WHEN 'pro' THEN 1024 WHEN 'team' THEN 2048 ELSE 0 END;

UPDATE user_runtime_quotas
SET max_hosted_runtimes = COALESCE(
        (SELECT max_hosted_runtimes FROM plan_tiers WHERE id = user_runtime_quotas.plan_tier_id),
        0
    ),
    max_hosted_runtime_memory_mb = COALESCE(
        (SELECT max_hosted_runtime_memory_mb FROM plan_tiers WHERE id = user_runtime_quotas.plan_tier_id),
        0
    );

-- One row represents one billable running interval. Open sessions include
-- their live elapsed time in entitlement/spend checks; closed sessions retain
-- the exact rate used at start so later price changes do not rewrite history.
CREATE TABLE hosted_runtime_usage_sessions (
    id TEXT PRIMARY KEY,
    hosted_instance_id TEXT NOT NULL REFERENCES hosted_runtime_instances(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    cost_per_hour REAL NOT NULL DEFAULT 0,
    estimated_cost_usd REAL,
    stop_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_hosted_usage_one_open_session
    ON hosted_runtime_usage_sessions(hosted_instance_id)
    WHERE ended_at IS NULL;
CREATE INDEX idx_hosted_usage_user_started
    ON hosted_runtime_usage_sessions(user_id, started_at);
CREATE INDEX idx_hosted_usage_instance_started
    ON hosted_runtime_usage_sessions(hosted_instance_id, started_at);

CREATE TRIGGER update_hosted_runtime_usage_timestamp
AFTER UPDATE ON hosted_runtime_usage_sessions
BEGIN
    UPDATE hosted_runtime_usage_sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
