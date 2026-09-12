-- ── Cowork job lease columns (A:// §8.9–8.13) ────────────────────────────────
-- lease_generation increases whenever execution ownership changes; recovery =
-- replay from last committed checkpoint under a new lease generation. Server
-- clock is authoritative for lease_expires_at.
ALTER TABLE cowork_jobs ADD COLUMN lease_id TEXT;
ALTER TABLE cowork_jobs ADD COLUMN lease_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cowork_jobs ADD COLUMN lease_expires_at DATETIME;
ALTER TABLE cowork_jobs ADD COLUMN claimed_at DATETIME;
-- Eligibility input: mandatory capability strings (JSON array, §8.6–8.7)
ALTER TABLE cowork_jobs ADD COLUMN required_capabilities TEXT NOT NULL DEFAULT '[]';
-- Typed result envelope, committed exactly once (§8.16–8.17)
ALTER TABLE cowork_jobs ADD COLUMN result TEXT;
-- Attribution triple carried on the job row for event writes (§8.18)
ALTER TABLE cowork_jobs ADD COLUMN initiator TEXT;
ALTER TABLE cowork_jobs ADD COLUMN delegator TEXT;

CREATE INDEX IF NOT EXISTS idx_cowork_jobs_lease_expiry ON cowork_jobs(state, lease_expires_at);
