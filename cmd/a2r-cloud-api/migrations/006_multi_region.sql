-- Multi-Region Scheduling for A2R Cloud API
-- Adds region awareness to runs and schedules

-- ============================================================================
-- Regions table: Cloud provider regions/locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                -- Human-readable name (e.g., "US East", "Frankfurt")
    provider TEXT NOT NULL,            -- Provider: hetzner, aws, gcp, azure, local
    endpoint TEXT,                     -- API endpoint for this region (if applicable)
    capacity INTEGER NOT NULL DEFAULT 100,  -- Max concurrent runs
    active BOOLEAN NOT NULL DEFAULT TRUE,   -- Whether region accepts new runs
    cost_factor REAL DEFAULT 1.0,      -- Relative cost multiplier (1.0 = baseline)
    location_lat REAL,                 -- Latitude for proximity calculations
    location_lon REAL,                 -- Longitude for proximity calculations
    metadata JSON,                     -- Provider-specific metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default regions
INSERT OR IGNORE INTO regions (id, name, provider, capacity, active, cost_factor) VALUES
    ('us-east-1', 'US East (N. Virginia)', 'aws', 100, TRUE, 1.0),
    ('us-west-2', 'US West (Oregon)', 'aws', 100, TRUE, 1.0),
    ('eu-central-1', 'EU (Frankfurt)', 'aws', 100, TRUE, 1.1),
    ('eu-west-1', 'EU (Ireland)', 'aws', 100, TRUE, 1.1),
    ('ap-southeast-1', 'Asia Pacific (Singapore)', 'aws', 100, TRUE, 1.2),
    ('fsn1', 'Falkenstein', 'hetzner', 50, TRUE, 0.8),
    ('nbg1', 'Nuremberg', 'hetzner', 50, TRUE, 0.8),
    ('hel1', 'Helsinki', 'hetzner', 50, TRUE, 0.8),
    ('local', 'Local Development', 'local', 10, TRUE, 0.0);

-- ============================================================================
-- Add region column to runs table
-- ============================================================================
ALTER TABLE runs ADD COLUMN region_id TEXT REFERENCES regions(id);

-- ============================================================================
-- Add region column to schedules table
-- ============================================================================
ALTER TABLE schedules ADD COLUMN region_id TEXT REFERENCES regions(id);

-- ============================================================================
-- Region capacity tracking table (for efficient scheduling)
-- ============================================================================
CREATE TABLE IF NOT EXISTS region_capacity (
    region_id TEXT PRIMARY KEY REFERENCES regions(id) ON DELETE CASCADE,
    current_runs INTEGER NOT NULL DEFAULT 0,
    queued_runs INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize capacity tracking for existing regions
INSERT OR IGNORE INTO region_capacity (region_id, current_runs, queued_runs)
SELECT id, 0, 0 FROM regions;

-- ============================================================================
-- Indexes for region queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_runs_region ON runs(region_id);
CREATE INDEX IF NOT EXISTS idx_schedules_region ON schedules(region_id);
CREATE INDEX IF NOT EXISTS idx_regions_active ON regions(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_regions_provider ON regions(provider);

-- ============================================================================
-- Trigger to update region capacity when run status changes
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS update_region_capacity_on_run_insert
AFTER INSERT ON runs
WHEN NEW.region_id IS NOT NULL
BEGIN
    UPDATE region_capacity 
    SET queued_runs = queued_runs + 1,
        last_updated = CURRENT_TIMESTAMP
    WHERE region_id = NEW.region_id;
END;

CREATE TRIGGER IF NOT EXISTS update_region_capacity_on_run_status
AFTER UPDATE OF status ON runs
WHEN OLD.region_id IS NOT NULL AND NEW.region_id IS NOT NULL
BEGIN
    -- Moving from queued to running
    UPDATE region_capacity 
    SET queued_runs = CASE 
            WHEN OLD.status = 'queued' AND NEW.status = 'running' THEN queued_runs - 1
            WHEN OLD.status = 'pending' AND NEW.status = 'queued' THEN queued_runs + 1
            ELSE queued_runs 
        END,
        current_runs = CASE 
            WHEN OLD.status = 'queued' AND NEW.status = 'running' THEN current_runs + 1
            WHEN OLD.status = 'running' AND NEW.status IN ('completed', 'failed', 'cancelled') THEN current_runs - 1
            ELSE current_runs 
        END,
        last_updated = CURRENT_TIMESTAMP
    WHERE region_id = NEW.region_id;
END;

-- ============================================================================
-- Trigger to update regions.updated_at
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS update_regions_timestamp 
AFTER UPDATE ON regions
BEGIN
    UPDATE regions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
