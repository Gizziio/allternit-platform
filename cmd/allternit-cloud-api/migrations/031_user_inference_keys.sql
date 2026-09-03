-- BYOK (bring-your-own-key) inference keys.
--
-- Users attach their own provider API keys; their chat completions then route
-- through their key (they pay upstream; we meter tokens but deduct nothing —
-- see routes::model_router's BYOK branch). Keys are encrypted at rest with
-- the platform AES-256-GCM credential cipher (ALLTERNIT_CREDENTIALS_KEY, same
-- key-management story as provider tokens): key_ciphertext is the sealed
-- bytes and key_nonce the 12-byte GCM nonce, split out of the cipher's
-- v1:<base64(nonce||ciphertext||tag)> blob by services::inference_keys.
--
-- Plaintext keys are never logged and never returned by the API (masked
-- fingerprints only).

CREATE TABLE IF NOT EXISTS user_inference_keys (
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    key_ciphertext BLOB NOT NULL,
    key_nonce BLOB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_validated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider_id)
);

CREATE TRIGGER IF NOT EXISTS update_user_inference_keys_timestamp
AFTER UPDATE ON user_inference_keys
BEGIN
    UPDATE user_inference_keys SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id AND provider_id = NEW.provider_id;
END;
