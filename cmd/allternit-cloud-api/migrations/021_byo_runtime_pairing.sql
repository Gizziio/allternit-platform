-- BYO-VPS runtime pairing: one-time bootstrap tokens that let a wizard-
-- bootstrapped box self-approve a runtime-device pairing at bootstrap time.
--
-- The cloud-api wizard mount mints a token before the SSH run and injects it
-- into the 0600 env file on the box; the bootstrap script then POSTs
-- /api/v1/runtime-pairings with it (runtime_type 'vps' + byo_bootstrap_token)
-- and receives an already-approved pairing — the BYO analogue of the hosted
-- flow's hosted_runtime_instances.bootstrap_token_hash.
--
-- The token is consumed at pairing-CREATE time (not exchange): an unconsumed
-- token would otherwise allow minting unlimited approved pairings.
-- runtime_pairings.byo_bootstrap_token_id links the pairing back to the token
-- so the exchange path can skip the second quota record (it was already
-- recorded at create, same as hosted).

CREATE TABLE IF NOT EXISTS byo_bootstrap_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_byo_bootstrap_tokens_user ON byo_bootstrap_tokens(user_id);

ALTER TABLE runtime_pairings ADD COLUMN byo_bootstrap_token_id TEXT
    REFERENCES byo_bootstrap_tokens(id);
