-- ── Connector breadth (A:// P-T4, session/aproduct-0913) ─────────────────────
-- Registers the GitHub and files/local connectors with the broker. Same
-- invariant as V167: only the env var NAME is stored — the secret value
-- never touches the DB, and the SYSTEM performs the external call at invoke
-- time. Writes for both families are approval-gated (risk policy).
INSERT OR IGNORE INTO cowork_connector_secrets (capability, secret_env)
VALUES ('connector.github.read', 'ALLTERNIT_BROKER_GITHUB_TOKEN');
INSERT OR IGNORE INTO cowork_connector_secrets (capability, secret_env)
VALUES ('connector.github.write', 'ALLTERNIT_BROKER_GITHUB_TOKEN');
INSERT OR IGNORE INTO cowork_connector_secrets (capability, secret_env)
VALUES ('connector.files.read', 'ALLTERNIT_BROKER_FILES_ROOT');
INSERT OR IGNORE INTO cowork_connector_secrets (capability, secret_env)
VALUES ('connector.files.write', 'ALLTERNIT_BROKER_FILES_ROOT');
