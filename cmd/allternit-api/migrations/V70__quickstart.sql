-- Managed agent quickstart progress per organization.
-- Steps are predefined by the platform; the UI reads progress and marks steps
-- complete as the user finishes each one.

CREATE TABLE IF NOT EXISTS organization_quickstart (
    organization_id     TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    completed_steps     TEXT NOT NULL DEFAULT '[]', -- JSON array of step ids
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organization_quickstart_org ON organization_quickstart(organization_id);
