-- User profiles for agents acting on behalf of humans, plus enrollment tokens.
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    consent_given_at DATETIME,
    enrollment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'enrolled', 'revoked')),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_org_agent
    ON user_profiles(org_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_status
    ON user_profiles(org_id, enrollment_status);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_profile
    ON enrollment_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_hash
    ON enrollment_tokens(token_hash);
