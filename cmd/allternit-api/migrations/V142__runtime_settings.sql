-- Per-user runtime settings for the /api/v1/runtime/settings surface
-- (driver envelope, resource limits, replay, prewarm, versioning).
-- Each row is one top-level settings section; `value` holds the section as
-- JSON. Sections not present for a user fall back to server defaults.
CREATE TABLE IF NOT EXISTS runtime_settings (
    user_id    TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key)
);
