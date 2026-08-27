-- Enterprise admin workspaces: organization-scoped resource containers with
-- their own owner/admin/member roster, distinct from the pre-existing
-- user-owned `workspaces` table (agent/session workspaces, no organization
-- scoping). Managed exclusively under /api/v1/admin/workspaces by org
-- owners/admins.

CREATE TABLE IF NOT EXISTS admin_workspaces (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_workspaces_org ON admin_workspaces(organization_id, created_at);

CREATE TABLE IF NOT EXISTS admin_workspace_members (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES admin_workspaces(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_workspace_members_workspace ON admin_workspace_members(workspace_id);
