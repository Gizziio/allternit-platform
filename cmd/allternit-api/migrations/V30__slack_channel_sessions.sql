-- Maps a Slack channel+thread to the Gizzi agent session serving it, so the
-- inbound Slack Events webhook (slack_webhook_routes.rs) can route a
-- follow-up message in the same thread back to the same session instead of
-- starting a new one every time.
CREATE TABLE IF NOT EXISTS slack_channel_sessions (
    slack_channel_id TEXT NOT NULL,
    slack_thread_ts TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (slack_channel_id, slack_thread_ts)
);
