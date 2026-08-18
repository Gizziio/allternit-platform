-- Combined V47 migration: session memory + autonomous bot primitives.

-- ── Session memory ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id, memory_key)
);

CREATE INDEX IF NOT EXISTS session_memory_user_session_idx
    ON session_memory(user_id, session_id);
CREATE INDEX IF NOT EXISTS session_memory_key_idx
    ON session_memory(memory_key);

-- ── Agent secrets ────────────────────────────────────────────────────────────
-- Secrets are encrypted at rest via token_crypto.rs (AES-256-GCM when a key is set).
CREATE TABLE IF NOT EXISTS agent_secrets (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    key         TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    required    INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, key)
);
CREATE INDEX IF NOT EXISTS idx_agent_secrets_agent ON agent_secrets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_secrets_user ON agent_secrets(user_id);

-- ── Photon inbox ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_photon_inbox (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    from_id     TEXT NOT NULL,
    to_id       TEXT NOT NULL,
    content     TEXT NOT NULL,
    surface     TEXT,
    read_at     DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_photon_inbox_agent ON agent_photon_inbox(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_photon_inbox_created ON agent_photon_inbox(created_at);

-- ── Agent identity channels ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_identity_channels (
    id            TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL UNIQUE,
    user_id       TEXT NOT NULL,
    email_address TEXT,
    email_provider TEXT,
    email_send_enabled INTEGER NOT NULL DEFAULT 0,
    email_receive_enabled INTEGER NOT NULL DEFAULT 0,
    phone_number  TEXT,
    phone_provider TEXT,
    phone_voice_enabled INTEGER NOT NULL DEFAULT 0,
    phone_sms_enabled INTEGER NOT NULL DEFAULT 0,
    wallet_address TEXT,
    wallet_provider TEXT,
    wallet_chain_id TEXT,
    wallet_key_vault_ref TEXT,
    wallet_allowed_methods TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_identity_channels_user ON agent_identity_channels(user_id);
