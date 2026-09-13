-- ── Cowork event attribution (A:// §8.18) ────────────────────────────────────
-- Every dispatch-related material event preserves initiator/delegator/executor.
ALTER TABLE cowork_run_events ADD COLUMN initiator TEXT;
ALTER TABLE cowork_run_events ADD COLUMN delegator TEXT;
ALTER TABLE cowork_run_events ADD COLUMN executor TEXT;

-- The delegating principal for a run (e.g. a://principal/al between the user
-- and the worker executor). NULL when the run was not delegated.
ALTER TABLE cowork_runs ADD COLUMN delegator TEXT;
