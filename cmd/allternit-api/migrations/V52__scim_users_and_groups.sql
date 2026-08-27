-- SCIM v2 provisioning tables: organization-scoped users and groups.
-- SCIM resources map to existing admin/rbac_roles and admin/rbac_groups
-- by name match so that IdP-managed assignments can drive Allternit RBAC.

CREATE TABLE IF NOT EXISTS scim_users (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    external_id     TEXT,
    user_name       TEXT NOT NULL,
    given_name      TEXT,
    family_name     TEXT,
    email           TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, external_id),
    UNIQUE(organization_id, user_name)
);
CREATE INDEX IF NOT EXISTS idx_scim_users_org ON scim_users(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scim_users_external ON scim_users(organization_id, external_id);

CREATE TABLE IF NOT EXISTS scim_groups (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    external_id     TEXT,
    display_name    TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, external_id),
    UNIQUE(organization_id, display_name)
);
CREATE INDEX IF NOT EXISTS idx_scim_groups_org ON scim_groups(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scim_groups_external ON scim_groups(organization_id, external_id);

CREATE TABLE IF NOT EXISTS scim_group_members (
    id         TEXT PRIMARY KEY,
    group_id   TEXT NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES scim_users(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scim_group_members_group ON scim_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_scim_group_members_user ON scim_group_members(user_id);

-- Optional mapping from SCIM user roles to existing rbac_roles (matched by name).
CREATE TABLE IF NOT EXISTS scim_user_rbac_role_mappings (
    scim_user_id TEXT NOT NULL REFERENCES scim_users(id) ON DELETE CASCADE,
    rbac_role_id TEXT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (scim_user_id, rbac_role_id)
);

-- Optional mapping from SCIM groups to existing rbac_groups (matched by name).
CREATE TABLE IF NOT EXISTS scim_group_rbac_group_mappings (
    scim_group_id  TEXT NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
    rbac_group_id  TEXT NOT NULL REFERENCES rbac_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (scim_group_id, rbac_group_id)
);
