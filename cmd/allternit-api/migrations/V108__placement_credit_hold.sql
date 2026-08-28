-- Link fabric placements to the credit hold that reserved their estimated cost.
-- The hold is created before provisioning and is either charged on success or
-- released on failure.
ALTER TABLE fabric_placements ADD COLUMN hold_id TEXT REFERENCES fabric_credit_holds(id);

CREATE INDEX IF NOT EXISTS idx_fabric_placements_hold
    ON fabric_placements(hold_id);
