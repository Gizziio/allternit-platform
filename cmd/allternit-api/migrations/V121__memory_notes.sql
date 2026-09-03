-- Editable markdown memory notes (people, websites, episodic notes).

CREATE TABLE IF NOT EXISTS memory_notes (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    note_type   TEXT NOT NULL CHECK (note_type IN ('person', 'website', 'episodic', 'general')),
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    entity_id   TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_notes_user
    ON memory_notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_notes_type
    ON memory_notes(user_id, note_type);
