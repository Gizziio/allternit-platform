-- Fabric control plane foundation tables.
-- Resource classes, resources, placements, provider prices, usage/cost events,
-- and the Allternit Credits ledger.

-- Customer-facing capability classes (SKUs). Examples:
--   kind='compute', class='cpu.s',   vcpu=1, memory_mib=2048
--   kind='gpu',     class='gpu.m',   gpu_vram_mib=49152
CREATE TABLE IF NOT EXISTS fabric_resource_classes (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    class TEXT NOT NULL,
    display_name TEXT,
    vcpu_min INTEGER NOT NULL DEFAULT 0,
    memory_mib_min INTEGER NOT NULL DEFAULT 0,
    gpu_vram_mib_min INTEGER NOT NULL DEFAULT 0,
    reliability_tier TEXT NOT NULL DEFAULT 'standard',
    retail_price_per_hour_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kind, class)
);

-- Desired-state and active Fabric resources.
CREATE TABLE IF NOT EXISTS fabric_resources (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    class TEXT NOT NULL,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_kind TEXT,
    provider_resource_id TEXT,
    region TEXT,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provisioned_at TIMESTAMP,
    terminated_at TIMESTAMP,
    CONSTRAINT fk_fabric_resources_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_resources_org_status
    ON fabric_resources(organization_id, status);

-- Placement history: a resource may have multiple placements if it is
-- migrated or re-created after a provider failure.
CREATE TABLE IF NOT EXISTS fabric_placements (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    provider_kind TEXT NOT NULL,
    provider_resource_id TEXT,
    region TEXT,
    retail_price_per_hour_cents INTEGER NOT NULL DEFAULT 0,
    provider_cost_per_hour_cents INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    termination_reason TEXT,
    CONSTRAINT fk_fabric_placements_resource
        FOREIGN KEY (resource_id) REFERENCES fabric_resources(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_placements_resource
    ON fabric_placements(resource_id);

-- Cached provider offers / prices. Refreshed by a background job.
CREATE TABLE IF NOT EXISTS fabric_provider_prices (
    id TEXT PRIMARY KEY,
    provider_kind TEXT NOT NULL,
    region TEXT NOT NULL,
    instance_type TEXT NOT NULL,
    vcpu INTEGER NOT NULL DEFAULT 0,
    memory_mib INTEGER NOT NULL DEFAULT 0,
    gpu_vram_mib INTEGER NOT NULL DEFAULT 0,
    gpu_model TEXT,
    price_per_hour_cents INTEGER NOT NULL,
    price_per_hour_currency TEXT NOT NULL DEFAULT 'USD',
    reliability_score REAL NOT NULL DEFAULT 0.5,
    interruptible INTEGER NOT NULL DEFAULT 0,
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_fabric_provider_prices_search
    ON fabric_provider_prices(provider_kind, region, instance_type, valid_until);

-- Usage events emitted by providers or the Fabric daemon.
CREATE TABLE IF NOT EXISTS fabric_usage_events (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    placement_id TEXT,
    event_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_usage_resource
        FOREIGN KEY (resource_id) REFERENCES fabric_resources(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_usage_events_resource
    ON fabric_usage_events(resource_id, measured_at);

-- Cost events: what Allternit paid the supplier for a given usage slice.
CREATE TABLE IF NOT EXISTS fabric_cost_events (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    placement_id TEXT,
    provider_kind TEXT NOT NULL,
    cost_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_cost_resource
        FOREIGN KEY (resource_id) REFERENCES fabric_resources(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fabric_cost_events_resource
    ON fabric_cost_events(resource_id, recorded_at);

-- Allternit Credits ledger. Every row is immutable and signed.
-- Amounts are in USD cents. balance_cents_after is the organization balance
-- after applying this row.
CREATE TABLE IF NOT EXISTS fabric_credits_ledger (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    balance_cents_after INTEGER NOT NULL,
    description TEXT,
    reference_type TEXT,
    reference_id TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fabric_credits_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_fabric_credits_type
        CHECK (transaction_type IN ('purchase', 'grant', 'charge', 'refund', 'expiration')),
    CONSTRAINT chk_fabric_credits_nonzero
        CHECK (amount_cents != 0)
);

CREATE INDEX IF NOT EXISTS idx_fabric_credits_ledger_org
    ON fabric_credits_ledger(organization_id, created_at);

-- Holds are used during placement so that concurrent requests do not
-- overspend a balance. They are either converted to charges or released.
CREATE TABLE IF NOT EXISTS fabric_credit_holds (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    hold_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'held',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    CONSTRAINT fk_fabric_credit_holds_org
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_fabric_credit_holds_resource
        FOREIGN KEY (resource_id) REFERENCES fabric_resources(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_fabric_credit_holds_status
        CHECK (status IN ('held', 'charged', 'released'))
);

CREATE INDEX IF NOT EXISTS idx_fabric_credit_holds_org_status
    ON fabric_credit_holds(organization_id, status);
