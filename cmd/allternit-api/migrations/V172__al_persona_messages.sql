-- A:// P-T5: Al persona runtime — conversational transcript over canonical
-- orchestration. Al acts under a://principal/al (zero capabilities): it
-- plans and delegates; workers execute. One row per transcript message;
-- intent_id/run_id link a turn to the canonical delegation it created.

CREATE TABLE IF NOT EXISTS cowork_al_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,                -- 'user' | 'assistant'
    content TEXT NOT NULL,
    intent_id TEXT,                    -- canonical intent this turn created (nullable)
    run_id TEXT,                       -- canonical run the narration observes (nullable)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cowork_al_messages_session
    ON cowork_al_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cowork_al_messages_user
    ON cowork_al_messages(user_id, created_at);
