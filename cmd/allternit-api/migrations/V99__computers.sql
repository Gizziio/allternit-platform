-- Unified computer domain: one table for local, BYO-VPS, managed, BYOC,
-- and cloud-desktop compute resources, plus kind-specific side tables.

CREATE TABLE IF NOT EXISTS computers (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL CHECK (kind IN ('local', 'byo_vps', 'managed', 'byoc', 'cloud_desktop')),
    provider        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'running', 'stopped', 'error', 'deleted')),
    owner_type      TEXT NOT NULL CHECK (owner_type IN ('user', 'org', 'bot')),
    owner_id        TEXT NOT NULL,
    bot_id          TEXT REFERENCES agents(id) ON DELETE SET NULL,
    session_id      TEXT,
    name            TEXT NOT NULL,
    os              TEXT,
    cpu_cores       INTEGER,
    memory_mb       INTEGER,
    disk_mb         INTEGER,
    region          TEXT,
    host            TEXT,
    native_id       TEXT,
    credential_id   TEXT,
    template_id     TEXT,
    billing_source  TEXT NOT NULL DEFAULT 'credits' CHECK (billing_source IN ('free', 'credits', 'provider_direct', 'platform_fee')),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_computers_owner
    ON computers(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_computers_bot
    ON computers(bot_id);
CREATE INDEX IF NOT EXISTS idx_computers_session
    ON computers(session_id);
CREATE INDEX IF NOT EXISTS idx_computers_status
    ON computers(status);
CREATE INDEX IF NOT EXISTS idx_computers_kind_provider
    ON computers(kind, provider);

CREATE TRIGGER IF NOT EXISTS computers_updated_at
AFTER UPDATE ON computers
BEGIN
    UPDATE computers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Side table: cloud-desktop specific state (control, ws url, etc.)
CREATE TABLE IF NOT EXISTS computer_cloud_desktop (
    computer_id     TEXT PRIMARY KEY REFERENCES computers(id) ON DELETE CASCADE,
    sandbox_id      TEXT NOT NULL,
    control_state   TEXT NOT NULL DEFAULT 'bot_controls' CHECK (control_state IN ('bot_controls', 'human_controls', 'human_observing')),
    ws_url          TEXT,
    protocol        TEXT,
    taken_over_by_user_id TEXT,
    taken_over_at   DATETIME
);

CREATE INDEX IF NOT EXISTS idx_computer_cloud_desktop_sandbox
    ON computer_cloud_desktop(sandbox_id);

-- Side table: managed runtime (Fly machine, etc.)
CREATE TABLE IF NOT EXISTS computer_managed (
    computer_id     TEXT PRIMARY KEY REFERENCES computers(id) ON DELETE CASCADE,
    machine_id      TEXT NOT NULL,
    plan_id         TEXT,
    idle_timeout_minutes INTEGER
);

-- Side table: BYO-VPS / SSH connection
CREATE TABLE IF NOT EXISTS computer_byo_vps (
    computer_id     TEXT PRIMARY KEY REFERENCES computers(id) ON DELETE CASCADE,
    ssh_connection_id TEXT,
    provider_token_id TEXT
);

-- Side table: BYOC cloud account instance
CREATE TABLE IF NOT EXISTS computer_byoc (
    computer_id     TEXT PRIMARY KEY REFERENCES computers(id) ON DELETE CASCADE,
    cloud_credential_id TEXT NOT NULL,
    cloud_instance_id   TEXT
);

-- Backfill existing bot desktop sandboxes into computers.
INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, bot_id, name, os, host, native_id, billing_source)
SELECT
    lower(hex(randomblob(16))),
    'cloud_desktop',
    s.provider,
    s.status,
    'bot',
    s.bot_id,
    s.bot_id,
    coalesce(a.name, 'Bot desktop') || ' sandbox',
    s.os,
    s.host,
    s.sandbox_id,
    'credits'
FROM bot_desktop_sandboxes s
JOIN agents a ON a.id = s.bot_id
WHERE NOT EXISTS (SELECT 1 FROM computers WHERE bot_id = s.bot_id AND kind = 'cloud_desktop');

-- Link cloud-desktop side table for backfilled rows.
INSERT INTO computer_cloud_desktop (computer_id, sandbox_id, control_state)
SELECT c.id, c.native_id, 'bot_controls'
FROM computers c
LEFT JOIN computer_cloud_desktop d ON d.computer_id = c.id
WHERE c.kind = 'cloud_desktop' AND d.computer_id IS NULL;
