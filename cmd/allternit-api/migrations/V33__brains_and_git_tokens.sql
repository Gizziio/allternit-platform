-- Hosted brain remotes (Track D, Phase D2): per-user bare git repos served
-- over smart-HTTP by brain_routes.rs, plus the long-lived `allternit_git_`
-- personal-access tokens that authenticate those git endpoints. Tokens are
-- stored as sha256 hex digests only — the plaintext is returned once at mint
-- and never persisted.
CREATE TABLE IF NOT EXISTS brains (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_brains_user ON brains(user_id);

CREATE TABLE IF NOT EXISTS git_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_git_tokens_user ON git_tokens(user_id);
