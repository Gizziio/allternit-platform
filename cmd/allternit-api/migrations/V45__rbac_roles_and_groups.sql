-- Organization-scoped RBAC roles and groups. Roles carry a permission list;
-- groups bundle roles together and can be assigned to users. Distinct from
-- `organization_members.role` (the coarse owner/admin/member tier used for
-- admin gating throughout this crate) — these are fine-grained, customer
-- defined roles layered on top.

CREATE TABLE IF NOT EXISTS rbac_roles (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    permissions     TEXT NOT NULL DEFAULT '[]',
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_rbac_roles_org ON rbac_roles(organization_id, created_at);

CREATE TABLE IF NOT EXISTS rbac_groups (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_rbac_groups_org ON rbac_groups(organization_id, created_at);

CREATE TABLE IF NOT EXISTS rbac_group_roles (
    group_id TEXT NOT NULL REFERENCES rbac_groups(id) ON DELETE CASCADE,
    role_id  TEXT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, role_id)
);

CREATE TABLE IF NOT EXISTS rbac_group_members (
    id         TEXT PRIMARY KEY,
    group_id   TEXT NOT NULL REFERENCES rbac_groups(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rbac_group_members_group ON rbac_group_members(group_id);
