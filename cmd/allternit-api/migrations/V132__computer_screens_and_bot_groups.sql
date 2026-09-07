-- Grok Bot parity: one cloud computer per user, many bot screens.
-- Also persist bot group rooms so membership is not localStorage-only.

CREATE TABLE IF NOT EXISTS computer_screens (
    id              TEXT PRIMARY KEY,
    computer_id     TEXT NOT NULL,
    bot_id          TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    display_index   INTEGER NOT NULL,
    vnc_port        INTEGER,
    status          TEXT NOT NULL DEFAULT 'running',
    control_state   TEXT NOT NULL DEFAULT 'bot_controls'
                        CHECK (control_state IN ('bot_controls', 'human_controls', 'human_observing')),
    owner_token     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (computer_id, bot_id),
    UNIQUE (computer_id, display_index)
);

CREATE INDEX IF NOT EXISTS idx_computer_screens_bot
    ON computer_screens(bot_id);
CREATE INDEX IF NOT EXISTS idx_computer_screens_computer
    ON computer_screens(computer_id);

CREATE TABLE IF NOT EXISTS bot_groups (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    image           TEXT,
    members_json    TEXT NOT NULL DEFAULT '[]',
    log_json        TEXT NOT NULL DEFAULT '[]',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_groups_user
    ON bot_groups(user_id);
