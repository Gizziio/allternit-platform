-- Tags and taggings for the Allternit Tagging Subsystem.
-- Tags are per-user labels that can be attached to agents, tools, scripts,
-- artifacts, sessions, plugins, MCPs, and skills.

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    label       TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT 'blue',
    icon        TEXT,
    scope       TEXT NOT NULL DEFAULT 'global',
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tags_user_scope ON tags(user_id, scope);
CREATE INDEX IF NOT EXISTS idx_tags_user_label ON tags(user_id, label);

CREATE TABLE IF NOT EXISTS taggings (
    id           TEXT PRIMARY KEY,
    tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    target_id    TEXT NOT NULL,
    target_type  TEXT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_taggings_target ON taggings(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_taggings_tag ON taggings(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taggings_unique
    ON taggings(tag_id, target_id, target_type);
