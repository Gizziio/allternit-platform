-- Real customer registry, backing `tenant_id` (previously just a single
-- per-deployment white-label marker, not a multi-tenant customer registry).
-- Needed for BYOC cloud credentials and usage-based billing, both of which
-- need a real org identity to attach to, not an arbitrary caller-asserted
-- string. See research/FIRECRACKER-GUEST-AGENT-VNC-SPEC.md context and the
-- BYOC plan for why this exists.

-- ── Organizations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT REFERENCES tenants(id),
    name          TEXT NOT NULL,
    billing_email TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations(tenant_id);

-- ── Organization members ────────────────────────────────────────────────────
-- Role-gated (unlike workspace_members): cloud-credential management and
-- billing actions need owner/admin checks, not just membership.
CREATE TABLE IF NOT EXISTS organization_members (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
    joined_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- ── Users org link ──────────────────────────────────────────────────────────
-- Fast-path default org pointer, same pattern V9 used for tenant_id.
ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id);
