-- Compliance API scaffold: customer export/deletion requests scoped to an org.

CREATE TABLE IF NOT EXISTS compliance_requests (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('export', 'delete')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    requested_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_org ON compliance_requests(organization_id, created_at);
