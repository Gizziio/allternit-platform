-- Persist the selected provider offer id and instance type on each placement
-- so the canonical AllternitOS mapping can produce real values instead of
-- `off_unknown` / `unknown` placeholders.
ALTER TABLE fabric_placements ADD COLUMN offer_id TEXT;
ALTER TABLE fabric_placements ADD COLUMN instance_type TEXT;

CREATE INDEX IF NOT EXISTS idx_fabric_placements_offer_id
    ON fabric_placements(offer_id);
