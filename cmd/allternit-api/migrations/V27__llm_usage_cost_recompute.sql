-- B4 pricing hardening: the gateway recomputes cost server-side from the
-- models.dev cache (per Gizzi's Session.getUsage formula, including the
-- >200k context tier) and stores it next to the Gizzi-reported cost.
--
-- `recomputed_cost_microdollars` is NULL when the recompute was skipped
-- (model absent from the local models.dev cache). Billing logic must read
-- cost as COALESCE(recomputed_cost_microdollars, cost_microdollars) — the
-- recomputed value is the single source of truth when present, mirroring
-- V22's "never trust a client-supplied cost; pricing lives in exactly one
-- place" rule.
--
-- `cost_mismatch` is 1 when the two costs disagree by more than 1% (also
-- logged as a warning at record time).
--
-- The `status` column additionally accepts 'client_disconnected' (streaming
-- client went away mid-stream; the row carries the partial usage seen up to
-- that point).

ALTER TABLE llm_usage_events ADD COLUMN recomputed_cost_microdollars INTEGER;
ALTER TABLE llm_usage_events ADD COLUMN cost_mismatch INTEGER NOT NULL DEFAULT 0;
