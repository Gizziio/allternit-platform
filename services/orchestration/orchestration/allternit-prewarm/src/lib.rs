//! # A2R Prewarm Service (N16)
//!
//! Pool management and cold start optimization.
//!
//! ## Features
//!
//! - Pre-warmed environment pools
//! - Auto-scaling based on demand
//! - Idle timeout management
//!
//! ## Shell UI Integration
//!
//! Control Center → Runtime Environment → Prewarm Pools:
//! - Enable/disable prewarm
//! - Configure pool sizes
//! - View pool status

use a2r_driver_interface::{EnvironmentSpec, ExecutionHandle, ResourceSpec};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// Prewarm pool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub name: String,
    pub pool_size: u32,
    pub env_spec: EnvironmentSpec,
    pub resources: ResourceSpec,
    pub max_idle_seconds: u32,
}

impl PoolConfig {
    pub fn new(name: impl Into<String>, pool_size: u32) -> Self {
        Self {
            name: name.into(),
            pool_size,
            env_spec: EnvironmentSpec {
                spec_type: a2r_driver_interface::EnvSpecType::Oci,
                image: "ubuntu:22.04".to_string(),
                version: None,
                packages: vec![],
                env_vars: HashMap::new(),
                working_dir: None,
                mounts: vec![],
            },
            resources: ResourceSpec::standard(),
            max_idle_seconds: 300,
        }
    }
}

/// Pool instance state
#[derive(Debug, Clone)]
pub struct PoolInstance {
    pub instance_id: String,
    pub created_at: Instant,
    pub last_used: Instant,
    pub handle: Option<ExecutionHandle>,
}

impl PoolInstance {
    pub fn new(instance_id: impl Into<String>) -> Self {
        let now = Instant::now();
        Self {
            instance_id: instance_id.into(),
            created_at: now,
            last_used: now,
            handle: None,
        }
    }

    /// Check if instance has exceeded idle timeout
    pub fn is_idle_expired(&self, timeout: Duration) -> bool {
        self.last_used.elapsed() > timeout
    }
}

/// Prewarm pool state
pub struct PrewarmPool {
    config: PoolConfig,
    available: Vec<PoolInstance>,
    in_use: Vec<PoolInstance>,
}

impl PrewarmPool {
    pub fn new(config: PoolConfig) -> Self {
        info!(
            pool_name = %config.name,
            pool_size = config.pool_size,
            "Creating prewarm pool"
        );

        Self {
            config,
            available: Vec::new(),
            in_use: Vec::new(),
        }
    }

    /// Acquire an instance from the pool
    pub fn acquire(&mut self) -> Option<PoolInstance> {
        if let Some(mut instance) = self.available.pop() {
            instance.last_used = Instant::now();
            self.in_use.push(instance.clone());
            debug!(instance_id = %instance.instance_id, "Acquired pool instance");
            Some(instance)
        } else {
            warn!(pool_name = %self.config.name, "Pool exhausted, no available instances");
            None
        }
    }

    /// Release an instance back to the pool
    pub fn release(&mut self, mut instance: PoolInstance) -> Result<(), PrewarmError> {
        let instance_id = instance.instance_id.clone();

        // Remove from in_use
        self.in_use.retain(|i| i.instance_id != instance_id);

        // Update last used time
        instance.last_used = Instant::now();

        // Add back to available if under pool size
        if self.available.len() < self.config.pool_size as usize {
            self.available.push(instance);
            debug!(instance_id = %instance_id, "Released pool instance");
            Ok(())
        } else {
            Err(PrewarmError::PoolFull(self.config.name.clone()))
        }
    }

    /// Get current available count
    pub fn available_count(&self) -> usize {
        self.available.len()
    }

    /// Get current in-use count
    pub fn in_use_count(&self) -> usize {
        self.in_use.len()
    }

    /// Get total pool size
    pub fn pool_size(&self) -> u32 {
        self.config.pool_size
    }

    /// Get pool name
    pub fn name(&self) -> &str {
        &self.config.name
    }

    /// Clean up expired idle instances
    pub fn cleanup_idle(&mut self) -> usize {
        let timeout = Duration::from_secs(self.config.max_idle_seconds as u64);
        let before_count = self.available.len();

        self.available.retain(|i| !i.is_idle_expired(timeout));

        let removed = before_count - self.available.len();
        if removed > 0 {
            debug!(pool_name = %self.config.name, removed = removed, "Cleaned up idle instances");
        }

        removed
    }

    /// Warm up the pool by creating instances
    pub async fn warmup<F, Fut>(&mut self, create_fn: F) -> Result<usize, PrewarmError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<ExecutionHandle, PrewarmError>>,
    {
        let needed = self.config.pool_size as usize - self.available.len();

        for i in 0..needed {
            let instance_id = format!(
                "{}_{}_{}",
                self.config.name,
                chrono::Utc::now().timestamp(),
                i
            );
            let mut instance = PoolInstance::new(instance_id);

            // Create the instance
            match create_fn().await {
                Ok(handle) => {
                    instance.handle = Some(handle);
                    self.available.push(instance);
                }
                Err(e) => {
                    warn!(error = %e, "Failed to create pool instance");
                }
            }
        }

        Ok(self.available.len())
    }
}

/// Pool manager for all pools
pub struct PoolManager {
    pools: Mutex<HashMap<String, PrewarmPool>>,
}

impl PoolManager {
    pub fn new() -> Self {
        Self {
            pools: Mutex::new(HashMap::new()),
        }
    }

    /// Create a new pool
    pub async fn create_pool(&self, config: PoolConfig) -> Result<(), PrewarmError> {
        let mut pools = self.pools.lock().await;

        if pools.contains_key(&config.name) {
            return Err(PrewarmError::PoolExists(config.name.clone()));
        }

        let pool_name = config.name.clone();
        let pool = PrewarmPool::new(config);
        pools.insert(pool_name.clone(), pool);

        info!(pool_name = %pool_name, "Pool created");
        Ok(())
    }

    /// Get a pool by name
    pub async fn get_pool(&self, name: &str) -> Option<PrewarmPool> {
        let pools = self.pools.lock().await;
        pools.get(name).cloned()
    }

    /// Acquire from a specific pool
    pub async fn acquire(&self, pool_name: &str) -> Option<PoolInstance> {
        let mut pools = self.pools.lock().await;
        pools.get_mut(pool_name).and_then(|p| p.acquire())
    }

    /// Release back to a specific pool
    pub async fn release(
        &self,
        pool_name: &str,
        instance: PoolInstance,
    ) -> Result<(), PrewarmError> {
        let mut pools = self.pools.lock().await;
        pools
            .get_mut(pool_name)
            .ok_or_else(|| PrewarmError::PoolNotFound(pool_name.to_string()))
            .and_then(|p| p.release(instance))
    }

    /// List all pool names
    pub async fn list_pools(&self) -> Vec<String> {
        let pools = self.pools.lock().await;
        pools.keys().cloned().collect()
    }

    /// Get status of all pools
    pub async fn get_all_status(&self) -> Vec<PoolStatus> {
        let pools = self.pools.lock().await;
        pools
            .values()
            .map(|p| PoolStatus {
                name: p.name().to_string(),
                available: p.available_count(),
                in_use: p.in_use_count(),
                pool_size: p.pool_size(),
            })
            .collect()
    }

    /// Cleanup idle instances across all pools
    pub async fn cleanup_all(&self) -> usize {
        let mut pools = self.pools.lock().await;
        let mut total_removed = 0;

        for pool in pools.values_mut() {
            total_removed += pool.cleanup_idle();
        }

        total_removed
    }
}

impl Default for PoolManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for PrewarmPool {
    fn clone(&self) -> Self {
        // Note: This is a shallow clone for status purposes
        // The actual instances would need proper deep cloning in production
        Self {
            config: self.config.clone(),
            available: self.available.clone(),
            in_use: self.in_use.clone(),
        }
    }
}

/// Pool status for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStatus {
    pub name: String,
    pub available: usize,
    pub in_use: usize,
    pub pool_size: u32,
}

/// Prewarm error
#[derive(Debug, thiserror::Error)]
pub enum PrewarmError {
    #[error("Pool already exists: {0}")]
    PoolExists(String),

    #[error("Pool not found: {0}")]
    PoolNotFound(String),

    #[error("Pool is full: {0}")]
    PoolFull(String),

    #[error("Instance creation failed: {0}")]
    InstanceCreationFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_config() {
        let config = PoolConfig::new("test-pool", 5);
        assert_eq!(config.name, "test-pool");
        assert_eq!(config.pool_size, 5);
    }

    #[test]
    fn test_pool_acquire_release() {
        let config = PoolConfig::new("test", 2);
        let mut pool = PrewarmPool::new(config);

        // Manually add instances
        pool.available.push(PoolInstance::new("instance_1"));
        pool.available.push(PoolInstance::new("instance_2"));

        assert_eq!(pool.available_count(), 2);

        // Acquire one
        let instance = pool.acquire();
        assert!(instance.is_some());
        assert_eq!(pool.available_count(), 1);
        assert_eq!(pool.in_use_count(), 1);

        // Release it
        pool.release(instance.unwrap()).unwrap();
        assert_eq!(pool.available_count(), 2);
        assert_eq!(pool.in_use_count(), 0);
    }

    #[test]
    fn test_instance_idle_expiry() {
        let instance = PoolInstance::new("test");

        // Should not be expired immediately
        assert!(!instance.is_idle_expired(Duration::from_secs(1)));
    }
}
