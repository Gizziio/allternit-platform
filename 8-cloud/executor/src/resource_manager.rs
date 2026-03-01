// OWNER: T1-A4

//! ResourceManager Service
//!
//! Tracks and allocates system resources for job execution.

use crate::types::{
    ExecutorError, JobId, ResourceMetrics, ResourceRequest, Result, SystemResources,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::time::Instant;
use tokio::sync::RwLock;

/// Resource allocation
#[derive(Debug, Clone)]
pub struct Allocation {
    pub allocation_id: String,
    pub job_id: JobId,
    pub resources: SystemResources,
    pub created_at: Instant,
}

/// ResourceManager service trait
#[async_trait]
pub trait ResourceManagerService {
    /// Get total system resources
    fn total_resources(&self) -> SystemResources;

    /// Get available resources
    async fn available_resources(&self) -> Result<SystemResources>;

    /// Allocate resources for a job
    async fn allocate(&self, request: ResourceRequest) -> Result<Allocation>;

    /// Release allocated resources
    async fn release(&self, allocation: Allocation) -> Result<()>;

    /// Get resource utilization metrics
    async fn metrics(&self) -> Result<ResourceMetrics>;
}

/// ResourceManager service implementation with in-memory allocation tracking
pub struct ResourceManagerServiceImpl {
    total: SystemResources,
    allocations: RwLock<HashMap<String, Allocation>>,
}

impl ResourceManagerServiceImpl {
    pub fn new() -> Self {
        Self {
            total: SystemResources::default(),
            allocations: RwLock::new(HashMap::new()),
        }
    }

    pub fn with_resources(cpu_cores: f64, memory_bytes: u64, disk_bytes: u64) -> Self {
        Self {
            total: SystemResources {
                cpu_cores,
                memory_bytes,
                disk_bytes,
            },
            allocations: RwLock::new(HashMap::new()),
        }
    }

    /// Calculate currently used resources from active allocations
    async fn used_resources(&self) -> SystemResources {
        let allocations = self.allocations.read().await;
        let mut used = SystemResources::default();

        for allocation in allocations.values() {
            used.cpu_cores += allocation.resources.cpu_cores;
            used.memory_bytes += allocation.resources.memory_bytes;
            used.disk_bytes += allocation.resources.disk_bytes;
        }

        used
    }
}

impl Default for ResourceManagerServiceImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ResourceManagerService for ResourceManagerServiceImpl {
    fn total_resources(&self) -> SystemResources {
        self.total.clone()
    }

    async fn available_resources(&self) -> Result<SystemResources> {
        let used = self.used_resources().await;

        Ok(SystemResources {
            cpu_cores: (self.total.cpu_cores - used.cpu_cores).max(0.0),
            memory_bytes: self.total.memory_bytes.saturating_sub(used.memory_bytes),
            disk_bytes: self.total.disk_bytes.saturating_sub(used.disk_bytes),
        })
    }

    async fn allocate(&self, request: ResourceRequest) -> Result<Allocation> {
        // Check if resources are available
        let available = self.available_resources().await?;

        let requested_cpu = request.cpu_cores.unwrap_or(0.0);
        let requested_memory = request.memory_bytes.unwrap_or(0);
        let requested_disk = request.disk_bytes.unwrap_or(0);

        if requested_cpu > available.cpu_cores {
            return Err(ExecutorError::ResourceError(
                crate::types::ResourceError::InsufficientResources {
                    requested: request.clone(),
                    available: available.clone(),
                },
            ));
        }

        if requested_memory > available.memory_bytes {
            return Err(ExecutorError::ResourceError(
                crate::types::ResourceError::InsufficientResources {
                    requested: request.clone(),
                    available: available.clone(),
                },
            ));
        }

        if requested_disk > available.disk_bytes {
            return Err(ExecutorError::ResourceError(
                crate::types::ResourceError::InsufficientResources {
                    requested: request.clone(),
                    available: available.clone(),
                },
            ));
        }

        let allocation_id = uuid::Uuid::new_v4().to_string();
        let job_id = uuid::Uuid::new_v4();

        let allocation = Allocation {
            allocation_id: allocation_id.clone(),
            job_id,
            resources: SystemResources {
                cpu_cores: requested_cpu,
                memory_bytes: requested_memory,
                disk_bytes: requested_disk,
            },
            created_at: Instant::now(),
        };

        // Store allocation
        let mut allocations = self.allocations.write().await;
        allocations.insert(allocation_id, allocation.clone());

        Ok(allocation)
    }

    async fn release(&self, allocation: Allocation) -> Result<()> {
        let mut allocations = self.allocations.write().await;

        if allocations.remove(&allocation.allocation_id).is_none() {
            return Err(ExecutorError::ResourceError(
                crate::types::ResourceError::AllocationNotFound(allocation.allocation_id),
            ));
        }

        Ok(())
    }

    async fn metrics(&self) -> Result<ResourceMetrics> {
        let used = self.used_resources().await;
        let allocations = self.allocations.read().await;

        Ok(ResourceMetrics {
            cpu_used: used.cpu_cores,
            cpu_total: self.total.cpu_cores,
            memory_used: used.memory_bytes,
            memory_total: self.total.memory_bytes,
            disk_used: used.disk_bytes,
            disk_total: self.total.disk_bytes,
            active_allocations: allocations.len(),
            queued_requests: 0, // Would need a separate queue counter
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_manager_creation() {
        let manager = ResourceManagerServiceImpl::new();
        assert_eq!(manager.total_resources().cpu_cores, 0.0);
    }

    #[test]
    fn test_resource_manager_with_resources() {
        let manager = ResourceManagerServiceImpl::with_resources(
            4.0,
            8 * 1024 * 1024 * 1024,
            100 * 1024 * 1024 * 1024,
        );
        assert_eq!(manager.total_resources().cpu_cores, 4.0);
    }
}
