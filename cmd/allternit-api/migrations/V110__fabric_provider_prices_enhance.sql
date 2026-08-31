-- Enhance the provider price cache so offers can be reconstructed into
-- provider-layer `Offer` structs and upserted idempotently.

ALTER TABLE fabric_provider_prices
ADD COLUMN estimated_ready_secs INTEGER NOT NULL DEFAULT 60;

-- Unique key for idempotent upserts: the same provider + region + instance
-- type + GPU model + interruptible flag should update the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_provider_prices_unique
    ON fabric_provider_prices(
        provider_kind,
        region,
        instance_type,
        COALESCE(gpu_model, ''),
        interruptible
    );
