-- BYO-VPS deploy wizard: durable, user-scoped wizard sessions and per-user
-- provider tokens.
--
-- wizard_sessions.state is the serialized WizardState JSON. It carries
-- provider API tokens and SSH private keys, so the writer (cloud-api)
-- encrypts it with ALLTERNIT_CREDENTIALS_KEY (AES-256-GCM, `v1:` prefixed)
-- before insert.
--
-- provider_tokens.encrypted_token is likewise AES-256-GCM ciphertext.
-- Tokens are write-only over the API: reads return only "configured: true".

CREATE TABLE IF NOT EXISTS wizard_sessions (
    deployment_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wizard_sessions_user ON wizard_sessions(user_id);

CREATE TRIGGER IF NOT EXISTS update_wizard_sessions_timestamp
AFTER UPDATE ON wizard_sessions
BEGIN
    UPDATE wizard_sessions SET updated_at = CURRENT_TIMESTAMP WHERE deployment_id = NEW.deployment_id;
END;

CREATE TABLE IF NOT EXISTS provider_tokens (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_token TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider)
);

CREATE TRIGGER IF NOT EXISTS update_provider_tokens_timestamp
AFTER UPDATE ON provider_tokens
BEGIN
    UPDATE provider_tokens SET updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id AND provider = NEW.provider;
END;
