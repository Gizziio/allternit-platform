CREATE TABLE IF NOT EXISTS desktop_templates (
    id              TEXT PRIMARY KEY,
    org_id          TEXT,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    os              TEXT NOT NULL DEFAULT 'linux',
    image           TEXT NOT NULL,
    cpu_millis      INTEGER NOT NULL DEFAULT 2000,
    memory_mib      INTEGER NOT NULL DEFAULT 4096,
    disk_mib        INTEGER NOT NULL DEFAULT 20480,
    network_enabled INTEGER NOT NULL DEFAULT 1,
    env_json        TEXT NOT NULL DEFAULT '{}',
    packages_json   TEXT NOT NULL DEFAULT '[]',
    tags_json       TEXT NOT NULL DEFAULT '[]',
    public          INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_desktop_templates_org ON desktop_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_desktop_templates_user ON desktop_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_desktop_templates_public ON desktop_templates(public);

-- Seed built-in presets. These are public and owned by no user so every tenant can see them.
INSERT OR IGNORE INTO desktop_templates (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public)
VALUES
  ('preset-linux-ubuntu', NULL, 'system', 'Ubuntu 24.04 Desktop', 'XFCE + Chrome + Tailscale', 'linux', 'allternit-desktop', 2000, 4096, 20480, 1, '{}', '[]', '["linux","ubuntu","desktop"]', 1),
  ('preset-windows', NULL, 'system', 'Windows 11 Desktop', 'Windows desktop with Chrome and agent', 'windows', 'allternit-desktop-windows', 4000, 8192, 40960, 1, '{}', '[]', '["windows","desktop"]', 1),
  ('preset-macos', NULL, 'system', 'macOS Desktop', 'macOS desktop with agent runtime', 'macos', 'tart-ubuntu-test', 4000, 8192, 40960, 1, '{}', '[]', '["macos","desktop"]', 1);
