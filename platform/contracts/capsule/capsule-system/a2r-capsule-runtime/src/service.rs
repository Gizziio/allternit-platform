use std::sync::Arc;
use tokio::sync::RwLock;

use crate::lifecycle::CapsuleRuntime;
use crate::marketplace_routes::MarketplaceAppState;
use crate::registry::FrameworkRegistry;

#[derive(Clone)]
pub struct CapsuleService {
    runtime: Arc<RwLock<CapsuleRuntime>>,
    registry: Arc<RwLock<FrameworkRegistry>>,
    marketplace: Arc<RwLock<MarketplaceAppState>>,
}

impl CapsuleService {
    pub fn new(runtime: CapsuleRuntime, registry: FrameworkRegistry, marketplace: MarketplaceAppState) -> Self {
        Self {
            runtime: Arc::new(RwLock::new(runtime)),
            registry: Arc::new(RwLock::new(registry)),
            marketplace: Arc::new(RwLock::new(marketplace)),
        }
    }

    pub fn runtime(&self) -> &Arc<RwLock<CapsuleRuntime>> {
        &self.runtime
    }

    pub fn registry(&self) -> &Arc<RwLock<FrameworkRegistry>> {
        &self.registry
    }

    pub fn marketplace(&self) -> &Arc<RwLock<MarketplaceAppState>> {
        &self.marketplace
    }
}
