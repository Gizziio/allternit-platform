-- Per-user agent preferences: how agents should respond (response style plus
-- free-form custom instructions). The response-style setting is synced into
-- each agent's workspace as a platform-managed STYLE.md (see
-- agent_preferences_routes.rs); the chat clients also read it to compose the
-- system prompt at send time.
CREATE TABLE IF NOT EXISTS user_agent_preferences (
    user_id TEXT PRIMARY KEY,
    response_style TEXT NOT NULL DEFAULT 'balanced',
    custom_instructions TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
