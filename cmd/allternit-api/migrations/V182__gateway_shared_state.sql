-- Shared gateway state (P2.9): cross-process failover cooldowns and
-- rate-limit buckets so a second gateway replica enforces the same steering
-- and RPM decisions. SQLite is the chosen backend (per the gap note's
-- Redis/SQLite either/or): the gateway already runs every node off one
-- SQLite database via `DbHandle`, so replicas pointed at the same database
-- file share state with no new infrastructure. Redis remains a future option
-- behind the same store interface.
--
-- Both tables are write-through from the request path with a short-TTL
-- in-memory L1 (see llm_gateway::shared_state); the feature is gated by
-- GATEWAY_SHARED_STATE=sqlite and is inert otherwise.

CREATE TABLE IF NOT EXISTS gateway_cooldowns (
    provider_id       TEXT NOT NULL,
    model_id          TEXT NOT NULL,
    -- Wall-clock epoch milliseconds: cooldowns must be comparable across
    -- processes, which Instant cannot do.
    cooldown_until_ms INTEGER NOT NULL,
    reason            TEXT NOT NULL DEFAULT '',
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_id, model_id)
);

-- Fixed one-minute buckets keyed by scope ("gwkey:<id>", "gworg:<id>").
-- Buckets are pruned when a scope opens a fresh window.
CREATE TABLE IF NOT EXISTS gateway_rate_limit_buckets (
    scope           TEXT NOT NULL,
    window_start_ms INTEGER NOT NULL,
    count           INTEGER NOT NULL DEFAULT 0,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scope, window_start_ms)
);
