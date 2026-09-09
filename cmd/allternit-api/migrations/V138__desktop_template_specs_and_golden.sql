-- Phase 4 "templates as code": the declarative ComputerTemplate spec doc is the
-- source of truth on write; the existing columns stay as the resolved/effective
-- view. A template can be built once into a golden snapshot that provisioning
-- clones from (fast boot).

ALTER TABLE desktop_templates ADD COLUMN spec_yaml TEXT;
ALTER TABLE desktop_templates ADD COLUMN ref TEXT;
ALTER TABLE desktop_templates ADD COLUMN golden_snapshot_id TEXT;
-- NULL = never built; otherwise pending|building|ready|failed.
ALTER TABLE desktop_templates ADD COLUMN build_status TEXT
    CHECK (build_status IN ('pending', 'building', 'ready', 'failed'));
ALTER TABLE desktop_templates ADD COLUMN build_error TEXT;
ALTER TABLE desktop_templates ADD COLUMN built_at TEXT;

-- refs are curated-only (system/...), seeded here, never user-writable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_templates_ref
    ON desktop_templates(ref) WHERE ref IS NOT NULL;

UPDATE desktop_templates SET ref = 'system/preset-linux-ubuntu' WHERE id = 'preset-linux-ubuntu';
UPDATE desktop_templates SET ref = 'system/preset-windows'      WHERE id = 'preset-windows';
UPDATE desktop_templates SET ref = 'system/preset-macos'        WHERE id = 'preset-macos';
