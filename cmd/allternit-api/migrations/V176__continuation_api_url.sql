-- Always-on continuation target stored per user (E6). Token stays in env.
ALTER TABLE user_cowork_preferences ADD COLUMN continuation_api_url TEXT;
