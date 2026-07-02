-- Create mirror_sessions table for session mirroring
-- Tracks active mirror sessions for remote control feature
-- Security: Includes access_token for authentication

CREATE TABLE IF NOT EXISTS mirror_sessions (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'ended', 'paired')),
    client_count INTEGER NOT NULL DEFAULT 0,
    last_activity_at DATETIME,
    access_token TEXT NOT NULL UNIQUE,  -- Security: Token for authentication
    pairing_code TEXT UNIQUE,  -- Short code for manual entry
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_user_id ON mirror_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_run_id ON mirror_sessions(run_id);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_status ON mirror_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_expires_at ON mirror_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_token ON mirror_sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_pairing_code ON mirror_sessions(pairing_code);

-- Create index for cleanup queries (find expired sessions)
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_cleanup ON mirror_sessions(status, expires_at);

-- Create index for active sessions by user
CREATE INDEX IF NOT EXISTS idx_mirror_sessions_active_by_user ON mirror_sessions(user_id, status) WHERE status = 'active';
