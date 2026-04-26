//! Allternit Meta-Swarm
//! 
//! Multi-agent orchestration system integrating:
//! - SwarmAgentic: PSO-based automatic architecture discovery
//! - Claude Swarm: Parallel execution with dependency graphs
//! - ClosedLoop: 5-step methodology with knowledge compounding

pub mod config;
pub mod error;
pub mod types;

// Core modules
pub mod controller;
pub mod router;
pub mod knowledge;

// Mode implementations
pub mod modes {
    pub mod swarmagentic;
    pub mod claudeswarm;
    pub mod closedloop;
    pub mod hybrid;
}

// Allternit integrations
pub mod integrations {
    pub mod intent_graph;
    pub mod wih;
    pub mod rails;
    pub mod governance;
}

// Utilities
pub mod utils;

// Re-exports
pub use config::MetaSwarmConfig;
pub use controller::MetaSwarmController;
pub use error::{SwarmError, SwarmResult};
pub use router::{ModeRouter, RoutingDecision};

use types::*;

/// Version of the meta-swarm library
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Initialize the meta-swarm system
pub async fn initialize(config: MetaSwarmConfig) -> SwarmResult<MetaSwarmController> {
    tracing::info!("Initializing Allternit Meta-Swarm v{}", VERSION);
    
    let controller = MetaSwarmController::new(config).await?;
    
    tracing::info!("Allternit Meta-Swarm initialized successfully");
    Ok(controller)
}

/// Initialize with configuration from file
pub async fn initialize_from_file<P: AsRef<std::path::Path>>(
    path: P,
) -> SwarmResult<MetaSwarmController> {
    let config = MetaSwarmConfig::from_file(path).await?;
    initialize(config).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_initialization() {
        let config = MetaSwarmConfig::default();
        let controller = initialize(config).await;
        assert!(controller.is_ok());
    }
}
