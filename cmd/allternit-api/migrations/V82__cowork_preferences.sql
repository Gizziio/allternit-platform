-- Per-user Cowork preferences: folders Cowork agents may read/write, plus
-- free-form instructions applied to every Cowork session. Mirrors
-- user_agent_preferences (V31) — trusted_folders is stored as a JSON array
-- of absolute paths (see cowork_preferences_routes.rs for validation).
CREATE TABLE IF NOT EXISTS user_cowork_preferences (
    user_id TEXT PRIMARY KEY,
    trusted_folders TEXT NOT NULL DEFAULT '[]',
    global_instructions TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
