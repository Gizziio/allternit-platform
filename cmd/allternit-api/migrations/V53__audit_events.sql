-- Access Transparency audit feed: append-only organization-scoped events
-- with actor, action, resource, and arbitrary metadata.

CREATE TABLE IF NOT EXISTS audit_events (
    id            TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id      TEXT NOT NULL,
    action        TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id   TEXT NOT NULL,
    metadata      TEXT, -- JSON object
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_created ON audit_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_cursor ON audit_events(created_at, id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(organization_id, resource_type, resource_id);
