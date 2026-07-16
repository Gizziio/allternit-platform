-- Quarantined package intake pipeline. Every submitted version gets a job;
-- isolated workers (never the registry host) claim jobs with SKIP LOCKED,
-- run the scan stages in disposable environments, and report results back.
CREATE TABLE intake_jobs (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version_id BIGINT NOT NULL REFERENCES miniapp_versions (id) UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'claimed', 'awaiting_review', 'failed', 'cancelled')),
    claimed_by TEXT,
    claimed_at TIMESTAMPTZ,
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queue poll index: workers claim the oldest queued job.
CREATE INDEX intake_jobs_queue_idx ON intake_jobs (id) WHERE status = 'queued';

-- Scan reports carry the pipeline stage they belong to (schema validation,
-- secret scan, malware scan, ..., install/health/UI tests).
ALTER TABLE scan_reports ADD COLUMN stage TEXT;
CREATE INDEX scan_reports_version_stage_idx ON scan_reports (version_id, stage);
