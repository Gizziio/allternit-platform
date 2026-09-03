-- Store the canonical AllternitOS NodeCapabilityRecord on each node so Cloud
-- can serve the canonical type directly instead of deriving it from flat
-- vcpu/memory/gpu columns.
ALTER TABLE fabric_node_capacity ADD COLUMN capability_json TEXT;

-- The flat capacity columns (total_vcpu, total_memory_mib, etc.) remain for
-- now as a derived view used by legacy indexes and provider scheduling; new
-- code writes both capability_json and the derived columns.
