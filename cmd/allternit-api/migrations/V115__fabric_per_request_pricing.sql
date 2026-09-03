-- Add per-request and per-token pricing to Fabric resource classes and placements.
-- This lets Cloud credits reconcile usage events whose unit is "request" (e.g.
-- harness.gizzi.session) or "token" (model inference) instead of only time-based
-- units like "seconds" and "hours".

ALTER TABLE fabric_resource_classes
    ADD COLUMN retail_price_per_request_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fabric_resource_classes
    ADD COLUMN retail_price_per_token_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fabric_placements
    ADD COLUMN retail_price_per_request_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fabric_placements
    ADD COLUMN provider_cost_per_request_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fabric_placements
    ADD COLUMN retail_price_per_token_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fabric_placements
    ADD COLUMN provider_cost_per_token_cents INTEGER NOT NULL DEFAULT 0;
