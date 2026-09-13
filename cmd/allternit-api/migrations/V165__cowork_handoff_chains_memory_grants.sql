-- ── Handoff chains + completion (A:// §8.15; task A-T1) ─────────────────────
-- Handoffs carry the delegation causation chain like intents/jobs, and can be
-- acknowledged: cowork_handoffs.job_id links the handoff job row so the ack
-- path can terminate it (the audit finding: status stayed 'pending' forever).
ALTER TABLE cowork_handoffs ADD COLUMN job_id TEXT;
ALTER TABLE cowork_handoffs ADD COLUMN causation_chain TEXT NOT NULL DEFAULT '[]';

-- ── Per-principal memory grants (task A-T2) ────────────────────────────────
-- Entries carry an owning principal and an explicit grant list. Read/search/
-- write enforce owner+grants server-side; cross-principal access is
-- default-deny unless granted.
ALTER TABLE cowork_memory_entries ADD COLUMN owner_principal TEXT;
ALTER TABLE cowork_memory_entries ADD COLUMN grants TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_cowork_memory_owner ON cowork_memory_entries(owner_principal);
