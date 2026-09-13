-- ── Approval expiry (A:// §8.14/§8.22) ──────────────────────────────────────
-- Approvals carry a server-clock expires_at; the sweeper expires stale
-- requests with attributed approval.expired events. Expired requests cannot
-- be granted late (decide rejects them); execution must re-request.
ALTER TABLE cowork_approval_bindings ADD COLUMN expires_at DATETIME;
