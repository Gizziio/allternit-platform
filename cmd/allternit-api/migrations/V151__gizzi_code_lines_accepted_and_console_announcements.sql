-- Phase 10 (G16 + G17):
-- 1. gizzi-code usage telemetry: count of accepted edit/apply lines per event.
--    Nullable-default keeps pre-V151 clients ingesting without the field.
-- 2. Console announcements: published, auditable banners for the web/desktop
--    console. audience is 'all' (platform-wide) or an organization id.

ALTER TABLE gizzi_code_usage_events
    ADD COLUMN lines_accepted INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS console_announcements (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    body               TEXT NOT NULL,
    audience           TEXT NOT NULL DEFAULT 'all',
    min_client_version TEXT,
    dismissible        INTEGER NOT NULL DEFAULT 1,
    published_at       DATETIME NOT NULL,
    expires_at         DATETIME,
    created_by         TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_console_announcements_audience_published
    ON console_announcements(audience, published_at);
