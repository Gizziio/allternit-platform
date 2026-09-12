-- Tags (cost attribution, task G8).
--
-- 1. resource_tags: console-managed labels attached to any taggable resource
--    (agent, session, gateway_key, deployment). resource_type/resource_id are
--    loose references (no FK — the targets live in several tables) so tag CRUD
--    never couples to those tables' lifecycles.
-- 2. llm_usage_events.tags: JSON object {key: value} captured per request so
--    spend can be aggregated by tag (json_each) in /gateway/usage and filtered
--    in /gateway/logs. NULL when the request carried no tags.
-- 3. llm_usage_events.batch_id: set when the request was executed as part of a
--    batch (llm_batches.id), making native batch spend visible in usage/logs.
-- 4. llm_virtual_keys.tags: default tags inherited by every request made with
--    the key; explicit request tags win over inherited ones.

CREATE TABLE IF NOT EXISTS resource_tags (
    id           TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id  TEXT NOT NULL,
    key          TEXT NOT NULL,
    value        TEXT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_type, resource_id, key)
);
CREATE INDEX IF NOT EXISTS idx_resource_tags_resource
    ON resource_tags(resource_type, resource_id);

ALTER TABLE llm_usage_events ADD COLUMN tags TEXT;
ALTER TABLE llm_usage_events ADD COLUMN batch_id TEXT;
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_batch ON llm_usage_events(batch_id);

ALTER TABLE llm_virtual_keys ADD COLUMN tags TEXT;
