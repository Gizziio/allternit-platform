-- Dispatch handoff: short-lived tokens binding a phone's claim to one of the
-- user's paired runtimes. This is the production home of the dev-server-only
-- /dispatch/handoff/* endpoints (surfaces/ai.allternit.com/vite.config.ts) —
-- the desktop mints a token for its QR, the phone claims it and receives the
-- runtime id to pair with (iOS EnvironmentStore.claimHandoffToken).

CREATE TABLE IF NOT EXISTS dispatch_handoff_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    runtime_id TEXT NOT NULL REFERENCES runtime_devices(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    claimed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_handoff_user ON dispatch_handoff_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_handoff_expiry ON dispatch_handoff_tokens(expires_at);
