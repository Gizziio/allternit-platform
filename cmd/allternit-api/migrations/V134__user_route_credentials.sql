-- Per-user provider route credentials ("BYO subscription keys", Allternit Brain
-- Products/ProviderRouting.md deferred follow-up). When a tenant's provider
-- routing policy resolves a route whose provider matches a user's own
-- credential, the gateway attaches it to the Gizzi session-message payload as
-- `provider_credentials` so requests bill to the customer's own cloud console
-- instead of Allternit credits. api_key is sealed with token_crypto (AES-256-GCM
-- when ALLTERNIT_ENCRYPTION_KEY is configured, `plain:` prefix otherwise —
-- same storage contract as the vault).

CREATE TABLE IF NOT EXISTS user_route_credentials (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL,
    tenant_id          TEXT,
    provider_id        TEXT NOT NULL, -- OpenRouter-style provider slug (anthropic, google, …)
    api_key            TEXT NOT NULL,  -- token_crypto-sealed
    base_url           TEXT,           -- override for direct/OpenAI-compatible endpoints
    label              TEXT,
    status             TEXT NOT NULL DEFAULT 'active',
    last_validated_at  DATETIME,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, provider_id)
);
