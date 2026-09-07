-- 010_user_inference_keys.sql
--
-- BYOK (bring-your-own-key) inference keys — PG mirror of
-- migrations/031_user_inference_keys.sql.
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

CREATE TABLE IF NOT EXISTS public.user_inference_keys (
    user_id text NOT NULL,
    provider_id text NOT NULL,
    key_ciphertext bytea NOT NULL,
    key_nonce bytea NOT NULL,
    status text NOT NULL DEFAULT 'active',
    last_validated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider_id)
);

