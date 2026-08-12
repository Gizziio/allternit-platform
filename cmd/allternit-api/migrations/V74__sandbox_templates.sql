-- Cloud sandbox templates and instance ledger.
--
-- Admins define reusable sandbox environments (templates). Instances record
-- each launch: a boot command is executed inside the platform sandbox, and the
-- result is stored for observability. Long-running VM handles are managed by
-- the driver layer; this ledger tracks ownership and boot output.

CREATE TABLE IF NOT EXISTS sandbox_templates (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    runtime         TEXT NOT NULL,
    image           TEXT NOT NULL DEFAULT 'ubuntu-22.04-minimal',
    source          TEXT,
    resources       TEXT NOT NULL DEFAULT '{}',
    network_enabled INTEGER NOT NULL DEFAULT 0,
    env             TEXT NOT NULL DEFAULT '{}',
    timeout_secs    INTEGER NOT NULL DEFAULT 300,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_templates_org
    ON sandbox_templates(org_id, name);

CREATE TABLE IF NOT EXISTS sandbox_instances (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id     TEXT REFERENCES sandbox_templates(id) ON DELETE SET NULL,
    name            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    session_id      TEXT,
    exit_code       INTEGER,
    stdout          TEXT,
    stderr          TEXT,
    started_at      DATETIME,
    stopped_at      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sandbox_instances_org
    ON sandbox_instances(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_template
    ON sandbox_instances(template_id);
