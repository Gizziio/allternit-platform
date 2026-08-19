-- Agent email via the vendored mailflare service (Cloudflare Worker email system).
-- Extends agent_identity_channels with the mailflare mailbox id and the per-agent
-- mailbox-scoped API key (sealed at rest via token_crypto), and adds tables for
-- inbound webhook payloads and approval-gated outbound sends.

ALTER TABLE agent_identity_channels ADD COLUMN email_mailbox_id TEXT;
ALTER TABLE agent_identity_channels ADD COLUMN email_api_key_sealed TEXT;

CREATE TABLE IF NOT EXISTS agent_email_inbound (
    id                  TEXT PRIMARY KEY,
    agent_id            TEXT,
    provider_message_id TEXT,
    from_address        TEXT,
    to_address          TEXT,
    subject             TEXT,
    snippet             TEXT,
    text_body           TEXT,
    headers_json        TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_email_inbound_agent ON agent_email_inbound(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_email_inbound_provider_message
    ON agent_email_inbound(provider_message_id);

-- Approval-gated outbound email. A row is written when mailflare accepts a send
-- into pending_approval; the Rails Mail review thread (`thread_id`) carries the
-- human decision, and the decide hook flips `status` and calls mailflare
-- approve/reject.
CREATE TABLE IF NOT EXISTS agent_email_outbound (
    id                   TEXT PRIMARY KEY,
    agent_id             TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    thread_id            TEXT NOT NULL UNIQUE,
    idempotency_key      TEXT NOT NULL UNIQUE,
    job_id               TEXT,
    message_id           TEXT,
    provider_message_id  TEXT,
    to_address           TEXT NOT NULL,
    subject              TEXT,
    snippet              TEXT,
    status               TEXT NOT NULL DEFAULT 'pending_approval',
    error                TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_email_outbound_agent ON agent_email_outbound(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_email_outbound_status ON agent_email_outbound(status);
