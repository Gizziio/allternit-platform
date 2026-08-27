-- Analytics extensions for resource-level usage dashboards.
-- Adds event tables for plugin and skill invocations, and a project-session
-- rollup view for chat-project usage analytics.

CREATE TABLE IF NOT EXISTS plugin_usage_events (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    user_id     TEXT,
    plugin_id   TEXT NOT NULL,
    action      TEXT NOT NULL DEFAULT 'invoke',
    metadata    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plugin_usage_tenant ON plugin_usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_plugin_usage_plugin ON plugin_usage_events(tenant_id, plugin_id, created_at);

CREATE TABLE IF NOT EXISTS skill_usage_events (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    user_id     TEXT,
    skill_id    TEXT NOT NULL,
    action      TEXT NOT NULL DEFAULT 'invoke',
    metadata    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_skill_usage_tenant ON skill_usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_usage_skill ON skill_usage_events(tenant_id, skill_id, created_at);
