//! Cloud Fabric — commercial supply layer over AllternitOS.
//!
//! This crate is **not** the canonical AllternitOS Fabric control plane. It
//! owns Cloud-specific commercial concerns: SKU catalog, credits ledger,
//! provider price cache, cost/margin scoring, and the Cloud Supply Optimizer
//! that selects external supplier capacity. Canonical node/resource/lease/
//! placement semantics belong to AllternitOS.
//!
//! New modules:
//! - `os_mapping` maps Cloud storage shapes to AllternitOS canonical views.
//! - `hardening` captures spend caps, provider health, rate limits, and orphan
//!   cleanup boundaries.
//! - `product_lanes` reports the status of Managed Inference, Managed Harness,
//!   and Cloud Computer Use.

pub mod cost;
pub mod credits;
pub mod hardening;
pub mod inference_executor;
pub mod model_catalog;
pub mod model_gateway;
pub mod node_registry;
pub mod os_client;
pub mod os_mapping;
pub mod price_cache;
pub mod product_lanes;
pub mod resources;
pub mod scheduler;
pub mod sku;
pub mod usage;

pub use cost::{CostEngine, CostEngineConfig, ScoredOffer};
pub use credits::{
    CreditHold, CreditLedgerEntry, CreditsError, CreditsLedger, HoldStatus, TransactionType,
};
pub use node_registry::{
    FabricNodeRegistry, FabricNodeRecord, FabricNodeStatus, NodeCapacity,
};
pub use price_cache::{PriceCache, PriceCacheError, refresh_cache};
pub use resources::{
    FabricPlacementSummary, FabricResource, FabricUsageEvent, ResourceManager,
};
pub use scheduler::{ScheduledResource, Scheduler, SchedulerError};
pub use sku::{ResourceClass, ResourceClassCatalog};
pub use usage::{UsageError, UsageEvent, UsageIngestor};

use std::sync::Arc;

/// Build the full Fabric provider registry for this process.
///
/// Live providers (Runpod, Vast.ai) are registered when their credentials are
/// present in the environment. The Private Fabric node provider is always
/// registered; its pool is refreshed separately from the DB registry.
pub fn build_provider_registry(
    fabric_node_provider: allternit_computer_cloud::providers::fabric_node::FabricNodeProvider,
) -> allternit_computer_cloud::fabric::FabricProviderRegistry {
    let mut registry = allternit_computer_cloud::providers::registry_from_env();
    registry.register(Arc::new(fabric_node_provider));
    registry
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_computer_cloud::providers::fabric_node::{FabricNodePool, FabricNodeProvider};
    use std::sync::Arc;

    #[test]
    fn build_provider_registry_includes_fabric_node_provider() {
        let pool = Arc::new(FabricNodePool::new());
        let provider = FabricNodeProvider::new(pool, "__system");
        let registry = build_provider_registry(provider);

        let kinds: Vec<_> = registry
            .providers()
            .iter()
            .map(|p| p.kind())
            .collect();
        assert!(
            kinds.contains(&"fabric_node".to_string()),
            "expected fabric_node in registry kinds: {kinds:?}"
        );
    }
}
