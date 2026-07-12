-- Backend marker for connector_connections (Allternit connector standard).
-- 'rust_native' rows hold their own (token_crypto.rs-sealed) tokens in this
-- table — the curated github/notion/slack path. 'open_connector' rows are
-- index-only pointers: status/account live here, but the real credential
-- lives in the vendored open-connector sidecar's own encrypted SQLite store
-- (services/open-connector, see PROVENANCE.md) and tokens stay NULL here.

ALTER TABLE connector_connections ADD COLUMN backend TEXT NOT NULL DEFAULT 'rust_native';
