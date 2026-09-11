-- Provenance of a beta_deployment_runs row: 'manual' (POST …/runs) or
-- 'scheduler' (deployment_scheduler daemon). NULL for rows created before
-- this column existed.
ALTER TABLE beta_deployment_runs ADD COLUMN triggered_by TEXT;
