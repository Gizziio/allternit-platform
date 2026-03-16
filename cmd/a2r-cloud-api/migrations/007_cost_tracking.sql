-- Cost tracking tables for A2R Cloud API
-- Tracks costs per run, user budgets, and cost rates

-- Cost rates table: Hourly pricing for different instance types
CREATE TABLE IF NOT EXISTS cost_rates (
    provider TEXT NOT NULL,
    region TEXT NOT NULL,
    instance_type TEXT NOT NULL,
    cost_per_hour REAL NOT NULL DEFAULT 0.0,
    storage_cost_per_gb_month REAL NOT NULL DEFAULT 0.0,
    transfer_cost_per_gb REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, region, instance_type)
);

-- Run costs table: Tracks actual costs for each run
CREATE TABLE IF NOT EXISTS run_costs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    instance_cost REAL NOT NULL DEFAULT 0,
    storage_cost REAL NOT NULL DEFAULT 0,
    transfer_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    provider TEXT,
    region TEXT,
    instance_type TEXT,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    storage_gb REAL DEFAULT 0,
    transfer_gb REAL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User cost budgets table: Monthly budget tracking per user
CREATE TABLE IF NOT EXISTS user_cost_budgets (
    user_id TEXT PRIMARY KEY,
    monthly_budget REAL NOT NULL DEFAULT 0,
    current_month_cost REAL NOT NULL DEFAULT 0,
    alert_threshold REAL NOT NULL DEFAULT 80.0,
    last_alert_at TIMESTAMP,
    alert_enabled INTEGER NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cost alerts history table: Tracks sent alerts
CREATE TABLE IF NOT EXISTS cost_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user_cost_budgets(user_id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'over_budget', 'projected_over')),
    threshold_percent REAL,
    current_cost REAL NOT NULL,
    budget_amount REAL NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_run_costs_run_id ON run_costs(run_id);
CREATE INDEX IF NOT EXISTS idx_run_costs_provider ON run_costs(provider);
CREATE INDEX IF NOT EXISTS idx_run_costs_region ON run_costs(region);
CREATE INDEX IF NOT EXISTS idx_run_costs_started_at ON run_costs(started_at);
CREATE INDEX IF NOT EXISTS idx_run_costs_ended_at ON run_costs(ended_at);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_user_id ON cost_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_sent_at ON cost_alerts(sent_at DESC);

-- Trigger for updating updated_at timestamp on cost_rates
CREATE TRIGGER IF NOT EXISTS update_cost_rates_timestamp 
AFTER UPDATE ON cost_rates
BEGIN
    UPDATE cost_rates SET updated_at = CURRENT_TIMESTAMP 
    WHERE provider = NEW.provider AND region = NEW.region AND instance_type = NEW.instance_type;
END;

-- Trigger for updating updated_at timestamp on run_costs
CREATE TRIGGER IF NOT EXISTS update_run_costs_timestamp 
AFTER UPDATE ON run_costs
BEGIN
    UPDATE run_costs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for updating updated_at timestamp on user_cost_budgets
CREATE TRIGGER IF NOT EXISTS update_user_cost_budgets_timestamp 
AFTER UPDATE ON user_cost_budgets
BEGIN
    UPDATE user_cost_budgets SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Insert default cost rates for common instance types (Hetzner)
INSERT OR IGNORE INTO cost_rates (provider, region, instance_type, cost_per_hour, storage_cost_per_gb_month, transfer_cost_per_gb) VALUES
    ('hetzner', 'fsn1', 'cx11', 0.006, 0.044, 0.0),
    ('hetzner', 'fsn1', 'cx21', 0.012, 0.044, 0.0),
    ('hetzner', 'fsn1', 'cx31', 0.024, 0.044, 0.0),
    ('hetzner', 'fsn1', 'cx41', 0.048, 0.044, 0.0),
    ('hetzner', 'fsn1', 'cx51', 0.096, 0.044, 0.0),
    ('hetzner', 'nbg1', 'cx11', 0.006, 0.044, 0.0),
    ('hetzner', 'nbg1', 'cx21', 0.012, 0.044, 0.0),
    ('hetzner', 'nbg1', 'cx31', 0.024, 0.044, 0.0),
    ('hetzner', 'hel1', 'cx11', 0.006, 0.044, 0.0),
    ('hetzner', 'hel1', 'cx21', 0.012, 0.044, 0.0);

-- Insert default cost rates for AWS
INSERT OR IGNORE INTO cost_rates (provider, region, instance_type, cost_per_hour, storage_cost_per_gb_month, transfer_cost_per_gb) VALUES
    ('aws', 'us-east-1', 't3.micro', 0.0104, 0.10, 0.09),
    ('aws', 'us-east-1', 't3.small', 0.0208, 0.10, 0.09),
    ('aws', 'us-east-1', 't3.medium', 0.0416, 0.10, 0.09),
    ('aws', 'us-east-1', 't3.large', 0.0832, 0.10, 0.09),
    ('aws', 'us-west-2', 't3.micro', 0.0104, 0.10, 0.09),
    ('aws', 'us-west-2', 't3.small', 0.0208, 0.10, 0.09),
    ('aws', 'eu-west-1', 't3.micro', 0.0116, 0.11, 0.09),
    ('aws', 'eu-west-1', 't3.small', 0.0232, 0.10, 0.09);
