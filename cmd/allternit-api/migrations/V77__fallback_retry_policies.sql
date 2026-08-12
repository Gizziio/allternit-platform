-- Fallback retry policy for the LLM gateway.
-- Configures automatic request-level retries and Gizzi fallback-chain behavior
-- per organization.

CREATE TABLE IF NOT EXISTS fallback_retry_policies (
    org_id                TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    enabled               INTEGER NOT NULL DEFAULT 1,
    max_retries           INTEGER NOT NULL DEFAULT 2 CHECK (max_retries BETWEEN 0 AND 5),
    -- JSON array of llm_usage_events.status values that should trigger a retry.
    retryable_statuses    TEXT NOT NULL DEFAULT '["refusal","error","rate_limited","timeout"]',
    -- JSON array of error_type substrings; ["*"] matches any error_type.
    retryable_errors      TEXT NOT NULL DEFAULT '["*"]',
    base_delay_ms         INTEGER NOT NULL DEFAULT 500 CHECK (base_delay_ms > 0),
    max_delay_ms          INTEGER NOT NULL DEFAULT 8000 CHECK (max_delay_ms > 0),
    fallback_chain_enabled INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
);
