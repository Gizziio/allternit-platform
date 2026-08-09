-- Context-window management for managed beta sessions.
ALTER TABLE beta_sessions ADD COLUMN context_window INTEGER;
ALTER TABLE beta_sessions ADD COLUMN truncation_strategy TEXT NOT NULL DEFAULT 'none'
    CHECK (truncation_strategy IN ('drop_oldest_user', 'summarize', 'none'));

CREATE INDEX IF NOT EXISTS idx_beta_sessions_context_warning
    ON beta_sessions(user_id, context_window, tokens_used);
