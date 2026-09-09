-- Phase 3 real-time plane: audit trail for computer access plus the
-- opt-in in-VM HTTP proxy configuration on the cloud-desktop side table.

CREATE TABLE IF NOT EXISTS computer_access_logs (
  id          TEXT PRIMARY KEY,
  computer_id TEXT,
  user_id     TEXT,
  kind        TEXT,
  detail      TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_computer_access_logs_computer
    ON computer_access_logs(computer_id);

ALTER TABLE computer_cloud_desktop ADD COLUMN proxy_port INTEGER;
ALTER TABLE computer_cloud_desktop ADD COLUMN proxy_paths TEXT;
