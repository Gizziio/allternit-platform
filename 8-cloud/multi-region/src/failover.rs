// OWNER: T1-A2

//! Automatic Failover System
//!
//! Detect failures and automatically failover to healthy regions.

use crate::types::*;
use crate::health::HealthMonitor;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Duration;

/// Failover manager
pub struct FailoverManager {
    regions: RwLock<Vec<Region>>,
    current_primary: RwLock<RegionId>,
    failover_history: RwLock<Vec<FailoverEvent>>,
    health_monitor: Arc<HealthMonitor>,
    auto_failover_enabled: bool,
    failure_threshold: u32,
}

impl FailoverManager {
    /// Create new failover manager
    pub fn new(regions: Vec<Region>, health_monitor: Arc<HealthMonitor>) -> Self {
        let primary = regions.first()
            .map(|r| r.id.clone())
            .unwrap_or_else(|| "unknown".to_string());
        
        Self {
            regions: RwLock::new(regions),
            current_primary: RwLock::new(primary),
            failover_history: RwLock::new(Vec::new()),
            health_monitor,
            auto_failover_enabled: true,
            failure_threshold: 3,
        }
    }

    /// Enable/disable automatic failover
    pub fn set_auto_failover(&mut self, enabled: bool) {
        self.auto_failover_enabled = enabled;
    }

    /// Set failure threshold
    pub fn set_failure_threshold(&mut self, threshold: u32) {
        self.failure_threshold = threshold;
    }

    /// Get current primary region
    pub async fn get_primary(&self) -> RegionId {
        self.current_primary.read().await.clone()
    }

    /// Get all regions
    pub async fn get_regions(&self) -> Vec<Region> {
        self.regions.read().await.clone()
    }

    /// Initiate failover to a specific region
    pub async fn initiate_failover(&self, target_region: &str) -> Result<FailoverEvent> {
        let mut event = FailoverEvent::new(
            &self.current_primary.read().await,
            target_region,
            "Manual failover initiated"
        );
        
        event.state = FailoverState::Initiating;
        
        // Validate target region exists
        let regions = self.regions.read().await;
        let target = regions.iter().find(|r| r.id == target_region);
        
        if target.is_none() {
            event.state = FailoverState::Failed;
            event.details = Some(format!("Target region {} not found", target_region));
            return Err(MultiRegionError::FailoverFailed(
                format!("Target region {} not found", target_region)
            ));
        }
        
        // Check if target is healthy
        let target_status = self.health_monitor.get_status(target_region).await;
        if matches!(target_status, Some(HealthStatus::Unhealthy)) {
            event.state = FailoverState::Failed;
            event.details = Some(format!("Target region {} is unhealthy", target_region));
            return Err(MultiRegionError::FailoverFailed(
                format!("Target region {} is unhealthy", target_region)
            ));
        }
        
        // Perform failover
        event.state = FailoverState::InProgress;
        
        // Update routing (simulated - in real impl would update DNS/load balancer)
        self.update_routing(target_region).await?;
        
        // Update primary
        {
            let mut current = self.current_primary.write().await;
            *current = target_region.to_string();
        }
        
        // Update region statuses
        {
            let mut regions = self.regions.write().await;
            for region in regions.iter_mut() {
                if region.id == target_region {
                    region.status = RegionStatus::Active;
                } else if region.id == event.source_region {
                    region.status = RegionStatus::Unavailable;
                }
            }
        }
        
        // Complete failover
        event.state = FailoverState::Completed;
        event.details = Some(format!("Successfully failed over to {}", target_region));
        
        // Record event
        {
            let mut history = self.failover_history.write().await;
            history.push(event.clone());
        }
        
        Ok(event)
    }

    /// Automatic failover based on health checks
    pub async fn check_and_failover(&self) -> Option<FailoverEvent> {
        if !self.auto_failover_enabled {
            return None;
        }
        
        let primary_id = self.current_primary.read().await.clone();
        
        // Check primary health
        let primary_status = self.health_monitor.get_status(&primary_id).await;
        
        match primary_status {
            Some(HealthStatus::Unhealthy) | Some(HealthStatus::Degraded) => {
                // Find healthy secondary
                let target = self.find_healthy_secondary(&primary_id).await;
                
                if let Some(target_region) = target {
                    tracing::warn!(
                        "Primary {} unhealthy, failing over to {}",
                        primary_id,
                        target_region.id
                    );
                    
                    match self.initiate_failover(&target_region.id).await {
                        Ok(event) => Some(event),
                        Err(e) => {
                            tracing::error!("Failover failed: {}", e);
                            None
                        }
                    }
                } else {
                    tracing::error!("No healthy secondary available for failover");
                    None
                }
            }
            _ => None,
        }
    }

    /// Find healthy secondary region
    async fn find_healthy_secondary(&self, exclude: &str) -> Option<Region> {
        let regions = self.regions.read().await;
        
        for region in regions.iter() {
            if region.id == exclude {
                continue;
            }
            
            let status = self.health_monitor.get_status(&region.id).await;
            if matches!(status, Some(HealthStatus::Healthy)) {
                return Some(region.clone());
            }
        }
        
        None
    }

    /// Update routing to new primary (simulated)
    async fn update_routing(&self, _target_region: &str) -> Result<()> {
        // In real implementation:
        // 1. Update DNS records
        // 2. Update load balancer configuration
        // 3. Notify clients of new endpoint
        // 4. Wait for propagation
        
        tokio::time::sleep(Duration::from_millis(100)).await;
        Ok(())
    }

    /// Get failover history
    pub async fn get_history(&self) -> Vec<FailoverEvent> {
        self.failover_history.read().await.clone()
    }

    /// Get failover status
    pub async fn get_status(&self) -> FailoverState {
        let history = self.failover_history.read().await;
        history.last()
            .map(|e| e.state)
            .unwrap_or(FailoverState::Idle)
    }

    /// Rollback failover (return to previous primary if healthy)
    pub async fn rollback(&self) -> Result<FailoverEvent> {
        let history = self.failover_history.read().await;
        let last_event = history.last().cloned();
        
        if last_event.is_none() {
            return Err(MultiRegionError::FailoverFailed(
                "No failover event to rollback".to_string()
            ));
        }
        
        let last = last_event.unwrap();
        let previous_primary = &last.source_region;
        
        // Check if previous primary is now healthy
        let status = self.health_monitor.get_status(previous_primary).await;
        if !matches!(status, Some(HealthStatus::Healthy)) {
            return Err(MultiRegionError::FailoverFailed(
                format!("Previous primary {} is still unhealthy", previous_primary)
            ));
        }
        
        drop(history);
        
        let mut event = FailoverEvent::new(
            &self.current_primary.read().await,
            previous_primary,
            "Rollback to previous primary"
        );
        
        event.state = FailoverState::RollingBack;
        
        // Perform rollback
        self.update_routing(previous_primary).await?;
        
        {
            let mut current = self.current_primary.write().await;
            *current = previous_primary.clone();
        }
        
        event.state = FailoverState::Completed;
        event.details = Some(format!("Rolled back to {}", previous_primary));
        
        {
            let mut history = self.failover_history.write().await;
            history.push(event.clone());
        }
        
        Ok(event)
    }
}

/// Failover configuration builder
pub struct FailoverConfig {
    regions: Vec<Region>,
    health_monitor: Option<Arc<HealthMonitor>>,
    auto_failover: bool,
    failure_threshold: u32,
}

impl FailoverConfig {
    pub fn new(regions: Vec<Region>) -> Self {
        Self {
            regions,
            health_monitor: None,
            auto_failover: true,
            failure_threshold: 3,
        }
    }

    pub fn with_health_monitor(mut self, monitor: Arc<HealthMonitor>) -> Self {
        self.health_monitor = Some(monitor);
        self
    }

    pub fn with_auto_failover(mut self, enabled: bool) -> Self {
        self.auto_failover = enabled;
        self
    }

    pub fn with_failure_threshold(mut self, threshold: u32) -> Self {
        self.failure_threshold = threshold;
        self
    }

    pub fn build(self) -> FailoverManager {
        let mut manager = FailoverManager::new(
            self.regions,
            self.health_monitor.unwrap_or_else(|| Arc::new(HealthMonitor::new(5000)))
        );
        manager.set_auto_failover(self.auto_failover);
        manager.set_failure_threshold(self.failure_threshold);
        manager
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_failover_manager_creation() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        let monitor = Arc::new(HealthMonitor::new(5000));
        
        let manager = FailoverManager::new(regions, monitor);
        
        let primary = manager.get_primary().await;
        assert_eq!(primary, "us-east-1");
    }

    #[tokio::test]
    async fn test_failover_to_secondary() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        let monitor = Arc::new(HealthMonitor::new(5000));
        
        // Register regions with monitor
        for region in &regions {
            monitor.register_region(region.clone()).await;
        }
        
        let manager = FailoverManager::new(regions, monitor);
        
        let event = manager.initiate_failover("us-west-2").await;
        
        assert!(event.is_ok());
        let event = event.unwrap();
        assert_eq!(event.target_region, "us-west-2");
        assert_eq!(event.state, FailoverState::Completed);
    }

    #[tokio::test]
    async fn test_failover_invalid_target() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
        ];
        let monitor = Arc::new(HealthMonitor::new(5000));
        
        let manager = FailoverManager::new(regions, monitor);
        
        let event = manager.initiate_failover("invalid-region").await;
        
        assert!(event.is_err());
    }

    #[tokio::test]
    async fn test_config_builder() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        let monitor = Arc::new(HealthMonitor::new(5000));
        
        let manager = FailoverConfig::new(regions)
            .with_health_monitor(monitor)
            .with_auto_failover(true)
            .with_failure_threshold(5)
            .build();
        
        assert_eq!(manager.get_primary().await, "us-east-1");
    }
}
