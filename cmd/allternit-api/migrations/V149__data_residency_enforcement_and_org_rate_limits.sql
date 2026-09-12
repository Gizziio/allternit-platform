-- G13: provider region metadata for data-residency enforcement.
--
-- The gateway's candidate providers (Gizzi provider ids like `anthropic`,
-- `openai`) are matched against this table by id. `region` defaults to
-- 'global', which means "unknown / not pinned to a geography": a provider in
-- 'global' never satisfies a region-pinned data-residency policy (honest
-- failure rather than silent routing around the pin). Set a provider's
-- region to one of the regions from GET /api/v1/admin/data-residency/regions
-- to make it compliant with a pin.
ALTER TABLE providers ADD COLUMN region TEXT NOT NULL DEFAULT 'global';

-- G14: per-organization request-rate cap on the LLM gateway, enforced by an
-- in-memory sliding window in llm_gateway::auth::org_rate_limit_middleware.
-- NULL (the default) means no org-level cap — only the per-key cap applies.
-- Validated values are 1..=1_000_000 (see PUT /api/v1/admin/rate-limits).
ALTER TABLE organizations ADD COLUMN gateway_rate_limit_rpm INTEGER;
