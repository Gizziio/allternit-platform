// OWNER: T1-A1

//! Multi-Region Infrastructure
//!
//! Cross-region replication, health monitoring, failover, and load balancing.

pub mod types;
pub mod replication;
pub mod health;
pub mod failover;
pub mod load_balancer;

pub use types::*;
pub use replication::CrossRegionReplicator;
pub use health::HealthMonitor;
pub use failover::FailoverManager;
pub use load_balancer::LoadBalancer;
