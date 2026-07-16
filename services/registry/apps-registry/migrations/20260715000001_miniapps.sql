-- Miniapps marketplace registry schema (PostgreSQL).
-- Replaces the JSON-file store previously backing the /v1/miniapps API.

CREATE TABLE publishers (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Publisher Ed25519 signing keys. Only public keys are stored; private keys
-- always remain with publishers. Rotation and revocation are recorded here.
CREATE TABLE publisher_keys (
    id BIGSERIAL PRIMARY KEY,
    publisher_id TEXT NOT NULL REFERENCES publishers (id),
    key_fingerprint TEXT NOT NULL,
    public_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    UNIQUE (publisher_id, key_fingerprint)
);

CREATE TABLE miniapps (
    id TEXT PRIMARY KEY,
    publisher_id TEXT NOT NULL REFERENCES publishers (id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'rejected', 'revoked', 'quarantined')),
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One immutable row per (miniapp, version). Once stored, the identity and
-- manifest can never change or be removed, so rollback and audit stay reliable.
-- Only `status` may transition (pending -> verified | rejected) via review.
CREATE TABLE miniapp_versions (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version TEXT NOT NULL,
    manifest JSONB NOT NULL,
    signature TEXT,
    publisher_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (miniapp_id, version)
);

CREATE OR REPLACE FUNCTION miniapp_versions_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'miniapp_versions rows cannot be deleted';
    END IF;
    IF NEW.miniapp_id IS DISTINCT FROM OLD.miniapp_id
        OR NEW.version IS DISTINCT FROM OLD.version
        OR NEW.manifest IS DISTINCT FROM OLD.manifest THEN
        RAISE EXCEPTION 'miniapp_versions identity and manifest are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER miniapp_versions_guard
    BEFORE UPDATE OR DELETE ON miniapp_versions
    FOR EACH ROW EXECUTE FUNCTION miniapp_versions_guard();

-- Every accepted submission, pointing at the immutable version it created.
CREATE TABLE submissions (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version_id BIGINT NOT NULL REFERENCES miniapp_versions (id),
    publisher_id TEXT NOT NULL REFERENCES publishers (id),
    manifest JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only review/audit trail. Actor IDs and timestamps are always set.
CREATE TABLE reviews (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version_id BIGINT REFERENCES miniapp_versions (id),
    actor TEXT NOT NULL,
    action TEXT NOT NULL
        CHECK (action IN ('approve', 'reject', 'request_changes', 'revoke', 'quarantine')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content-addressed references to objects held in S3-compatible storage
-- (icons, screenshots, release archives, SBOMs, scan reports, manifests).
CREATE TABLE release_assets (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version_id BIGINT REFERENCES miniapp_versions (id),
    kind TEXT NOT NULL
        CHECK (kind IN ('icon', 'screenshot', 'archive', 'sbom', 'scan_report', 'manifest')),
    storage_key TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime TEXT NOT NULL,
    quarantined BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (kind, storage_key)
);

-- Output of the quarantined intake pipeline (dependency/secret/malware scans,
-- SBOM generation, install/health/UI tests). Full reports live in storage.
CREATE TABLE scan_reports (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version_id BIGINT REFERENCES miniapp_versions (id),
    scanner TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    storage_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client-reported lifecycle telemetry from desktop installs.
CREATE TABLE install_events (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    version TEXT NOT NULL,
    event TEXT NOT NULL
        CHECK (event IN ('install', 'update', 'rollback', 'uninstall', 'launch')),
    platform TEXT,
    client_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
    id BIGSERIAL PRIMARY KEY,
    miniapp_id TEXT NOT NULL REFERENCES miniapps (id),
    user_id TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (miniapp_id, user_id)
);

CREATE INDEX miniapp_versions_miniapp_idx ON miniapp_versions (miniapp_id, submitted_at DESC);
CREATE INDEX submissions_miniapp_idx ON submissions (miniapp_id, created_at DESC);
CREATE INDEX reviews_miniapp_idx ON reviews (miniapp_id, created_at DESC);
CREATE INDEX release_assets_version_idx ON release_assets (version_id);
CREATE INDEX scan_reports_version_idx ON scan_reports (version_id);
CREATE INDEX install_events_miniapp_idx ON install_events (miniapp_id, created_at DESC);
CREATE INDEX miniapps_search_idx ON miniapps
    USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || id));
