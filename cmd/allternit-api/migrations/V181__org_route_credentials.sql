-- Org-scoped BYOK credential pool (P1.7). Extends V134's per-user route
-- credentials: an organization can hold a POOL of provider keys, so multiple
-- keys per (org, provider) rotate under load and a revoked/failing key is
-- skipped rather than hard-failing the route. Resolution order on the proxy
-- hot path is user → org pool → platform key (platform = no credential
-- attached, the pre-existing behavior). Same storage contract as V134:
-- api_key is sealed with token_crypto (AES-256-GCM when
-- ALLTERNIT_ENCRYPTION_KEY is configured, `plain:` prefix otherwise).

CREATE TABLE IF NOT EXISTS org_route_credentials (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL,
    provider_id        TEXT NOT NULL,  -- OpenRouter-style provider slug
    api_key            TEXT NOT NULL,  -- token_crypto-sealed
    base_url           TEXT,           -- override for direct/OpenAI-compatible endpoints
    label              TEXT,
    -- active | unvalidated | failed (failure streak) | revoked (sweep/validation)
    status             TEXT NOT NULL DEFAULT 'active',
    fail_count         INTEGER NOT NULL DEFAULT 0,
    last_used_at       DATETIME,       -- rotation cursor (least-recently-used wins)
    last_failed_at     DATETIME,
    last_validated_at  DATETIME,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_route_credentials_pool
    ON org_route_credentials(organization_id, provider_id, status);

-- Failure tracking on the user-scoped table too, so a failing user key can
-- be marked and skipped the same way pool entries are.
ALTER TABLE user_route_credentials ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_route_credentials ADD COLUMN last_failed_at DATETIME;
