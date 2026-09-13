-- ── Cowork run ownership (per-user scoping) ──────────────────────────────────
-- Cross-tenant IDOR fix: every cowork run/job/event/handoff is owned by the
-- authenticated user who created it. Routes scope all reads and mutations to
-- `user_id = ?` and return 404 for rows owned by another user.
-- Existing (pre-migration) rows keep NULL user_id: they are not visible to
-- any user through these routes until the owning client re-creates them.
ALTER TABLE cowork_runs ADD COLUMN user_id TEXT;
ALTER TABLE cowork_jobs ADD COLUMN user_id TEXT;
ALTER TABLE cowork_run_events ADD COLUMN user_id TEXT;
ALTER TABLE cowork_handoffs ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cowork_runs_user ON cowork_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_jobs_user ON cowork_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_run_events_user ON cowork_run_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_handoffs_user ON cowork_handoffs(user_id);
