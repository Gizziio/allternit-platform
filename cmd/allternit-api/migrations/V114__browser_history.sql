-- Browser history as memory: ingest visits from the extension and agent runtime.

CREATE TABLE IF NOT EXISTS browser_history_items (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    agent_id        TEXT,
    session_id      TEXT,
    url             TEXT NOT NULL,
    title           TEXT,
    domain          TEXT NOT NULL,
    visit_time      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transition_type TEXT,
    source          TEXT, -- 'browser-extension', 'computer-use-agent', 'import'
    metadata        TEXT  -- JSON
);

CREATE INDEX IF NOT EXISTS idx_browser_history_user_time
    ON browser_history_items(user_id, visit_time DESC);

CREATE INDEX IF NOT EXISTS idx_browser_history_user_domain_time
    ON browser_history_items(user_id, domain, visit_time DESC);

CREATE INDEX IF NOT EXISTS idx_browser_history_url
    ON browser_history_items(url);

-- Backfill browser-history observations from memory_observations (if any exist).
INSERT OR IGNORE INTO browser_history_items (id, user_id, agent_id, session_id, url, title, domain, visit_time, transition_type, source, metadata)
SELECT
    id,
    user_id,
    agent_id,
    session_id,
    json_extract(content, '$.url'),
    json_extract(content, '$.title'),
    COALESCE(json_extract(content, '$.domain'), ''),
    timestamp,
    json_extract(content, '$.transitionType'),
    source,
    content
FROM memory_observations
WHERE kind = 'browser_history';
