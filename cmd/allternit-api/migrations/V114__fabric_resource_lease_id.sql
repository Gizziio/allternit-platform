-- Link Cloud customer-facing resources to the canonical AllternitOS lease that
-- provisioned them. This lets get/terminate and future reconcilers reference
-- the OS lease authority without re-deriving it from the placement.
ALTER TABLE fabric_resources ADD COLUMN os_lease_id TEXT;
