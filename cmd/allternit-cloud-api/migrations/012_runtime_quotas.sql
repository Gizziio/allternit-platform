-- Free-tier guardrails and usage tracking for runtime pairing and relay.

-- Plan tiers define default quota values. Tiers are referenced by user records
-- and can be overridden per user or per organization.
CREATE TABLE IF NOT EXISTS plan_tiers (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    max_active_devices INTEGER NOT NULL DEFAULT 1,
    max_pairings_per_day INTEGER NOT NULL DEFAULT 5,
    max_relay_sockets INTEGER NOT NULL DEFAULT 5,
    max_relay_mb_per_day INTEGER NOT NULL DEFAULT 100,
    max_hosted_runtime_hours_monthly INTEGER NOT NULL DEFAULT 0,
    can_create_hosted_runtime INTEGER NOT NULL DEFAULT 0,
    hard_spend_cap_usd REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default tiers. Admins can adjust these rows in place; new users pick up the
-- latest defaults via `user_runtime_quotas` unless explicitly overridden.
INSERT OR IGNORE INTO plan_tiers (id, display_name, max_active_devices, max_pairings_per_day, max_relay_sockets, max_relay_mb_per_day, max_hosted_runtime_hours_monthly, can_create_hosted_runtime, hard_spend_cap_usd) VALUES
    ('free', 'Free', 1, 5, 5, 100, 0, 0, 5.0),
    ('pro', 'Pro', 5, 50, 20, 5000, 100, 1, 100.0),
    ('team', 'Team', 25, 200, 100, 50000, 500, 1, 500.0);

-- Effective quotas per user. Created lazily on first pairing or by admin.
CREATE TABLE IF NOT EXISTS user_runtime_quotas (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_tier_id TEXT NOT NULL REFERENCES plan_tiers(id),
    max_active_devices INTEGER NOT NULL,
    max_pairings_per_day INTEGER NOT NULL,
    max_relay_sockets INTEGER NOT NULL,
    max_relay_mb_per_day INTEGER NOT NULL,
    max_hosted_runtime_hours_monthly INTEGER NOT NULL,
    can_create_hosted_runtime INTEGER NOT NULL,
    -- Kept in sync with user_cost_budgets.hard_spend_cap_usd.
    hard_spend_cap_usd REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-user daily pairing count. Resets implicitly when a new date row appears.
CREATE TABLE IF NOT EXISTS user_pairing_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    pairings_created INTEGER NOT NULL DEFAULT 0,
    pairings_approved INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, usage_date)
);

-- Per-user daily relay usage.
CREATE TABLE IF NOT EXISTS user_relay_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    sockets_opened INTEGER NOT NULL DEFAULT 0,
    peak_concurrent_sockets INTEGER NOT NULL DEFAULT 0,
    egress_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, usage_date)
);

-- Triggers for updated_at timestamps.
CREATE TRIGGER IF NOT EXISTS update_plan_tiers_timestamp
AFTER UPDATE ON plan_tiers
BEGIN
    UPDATE plan_tiers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_runtime_quotas_timestamp
AFTER UPDATE ON user_runtime_quotas
BEGIN
    UPDATE user_runtime_quotas SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_pairing_usage_timestamp
AFTER UPDATE ON user_pairing_usage
BEGIN
    UPDATE user_pairing_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_relay_usage_timestamp
AFTER UPDATE ON user_relay_usage
BEGIN
    UPDATE user_relay_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Per-socket record for concurrent-cap enforcement.
CREATE TABLE IF NOT EXISTS runtime_relay_sockets (
    id TEXT PRIMARY KEY,
    runtime_id TEXT NOT NULL REFERENCES runtime_devices(id) ON DELETE CASCADE,
    socket_path TEXT NOT NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    egress_bytes INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runtime_relay_sockets_runtime ON runtime_relay_sockets(runtime_id);
CREATE INDEX IF NOT EXISTS idx_runtime_relay_sockets_open ON runtime_relay_sockets(runtime_id, closed_at);

-- Triggers for runtime_relay_sockets.
CREATE TRIGGER IF NOT EXISTS update_runtime_relay_sockets_timestamp
AFTER UPDATE ON runtime_relay_sockets
BEGIN
    UPDATE runtime_relay_sockets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;



-- Indexes for quota enforcement hot paths.
CREATE INDEX IF NOT EXISTS idx_user_pairing_usage_user_date ON user_pairing_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_user_relay_usage_user_date ON user_relay_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_user_runtime_quotas_tier ON user_runtime_quotas(plan_tier_id);
