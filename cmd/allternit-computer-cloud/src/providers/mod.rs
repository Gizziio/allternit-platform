//! Provider adapters for the Fabric control plane.

pub mod bare_vm;
pub mod fabric_node;
pub mod fake;
pub mod fireworks;
pub mod incus;
pub mod openai;
pub mod runpod;
pub mod together;
pub mod vast;

use crate::fabric::FabricProviderRegistry;
use std::sync::Arc;

/// Build a registry from environment variables, registering live providers when
/// credentials are present.
///
/// Providers included:
/// - Runpod (`RUNPOD_API_TOKEN`)
/// - Vast.ai (`VAST_API_KEY`)
///
/// Missing or empty credentials are ignored so the control plane can start
/// without every provider configured.
pub fn registry_from_env() -> FabricProviderRegistry {
    let mut registry = FabricProviderRegistry::empty();

    match runpod::RunpodClient::from_env() {
        Ok(client) => {
            tracing::info!("Runpod provider registered from environment");
            registry.register(Arc::new(client));
        }
        Err(crate::fabric::ProviderError::MissingCredentials(_)) => {
            tracing::debug!("Runpod not configured; skipping provider registration");
        }
        Err(e) => {
            tracing::warn!("Runpod provider registration failed: {e}");
        }
    }

    match vast::VastClient::from_env() {
        Ok(client) => {
            tracing::info!("Vast.ai provider registered from environment");
            registry.register(Arc::new(client));
        }
        Err(crate::fabric::ProviderError::MissingCredentials(_)) => {
            tracing::debug!("Vast.ai not configured; skipping provider registration");
        }
        Err(e) => {
            tracing::warn!("Vast.ai provider registration failed: {e}");
        }
    }

    registry
}
