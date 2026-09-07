-- 003_api_keys.sql
--
-- Scoped platform API keys for programmatic access to the Allternit Cloud API.
-- Tokens are stored as SHA-256 hashes; only the full token is returned once at creation time.

CREATE TABLE IF NOT EXISTS public.api_keys (
    id text NOT NULL PRIMARY KEY,
    user_id text NOT NULL,
    organization_id text,
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    prefix text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{}'::text[],
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_token_hash ON public.api_keys(token_hash);
