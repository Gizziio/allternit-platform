-- Swarm A Phase 3: public API idempotency cache and org-level rate-limit override.
--
-- The LLM gateway already stores idempotency state inside llm_usage_events
-- (virtual-key scoped). This table is for the Clerk-protected public API
-- surface, scoped by organization (or user when no org is selected).

-- Idempotency cache for the public API router.
--
-- `response_body` is NULL while a request is in flight. Duplicate requests
-- with the same (organization_id, idempotency_key) receive 409 Conflict until
-- the first request completes or the in-flight row goes stale. Completed
-- responses are replayed until `expires_at`.
CREATE TABLE IF NOT EXISTS idempotency_cache (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    response_status INTEGER,
    response_headers TEXT, -- JSON map of headers to replay (e.g. content-type)
    response_body BLOB,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_cache_scope
    ON idempotency_cache(organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_cache_expires
    ON idempotency_cache(expires_at);

-- Optional per-organization rate-limit override for the public API router.
-- When NULL the default DEFAULT_PUBLIC_API_RATE_LIMIT_RPM constant is used.
ALTER TABLE organizations ADD COLUMN api_rate_limit_rpm INTEGER;
