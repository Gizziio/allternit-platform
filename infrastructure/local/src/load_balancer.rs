// OWNER: T1-A2

//! Latency-Based Load Balancer
//!
//! Route requests to regions based on latency and health.

use crate::types::*;
use crate::health::HealthMonitor;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::time::Instant;

/// Latency-based load balancer
pub struct LoadBalancer {
    regions: RwLock<Vec<Region>>,
    latencies: RwLock<HashMap<RegionId, LatencyInfo>>,
    strategy: LoadBalancingStrategy,
    health_monitor: Option<Arc<HealthMonitor>>,
    metrics: RwLock<LoadBalancerMetrics>,
    round_robin_index: RwLock<usize>,
}

struct LatencyInfo {
    latency_ms: u64,
    last_measured: chrono::DateTime<Utc>,
    sample_count: u32,
}

impl LoadBalancer {
    /// Create new load balancer
    pub fn new(regions: Vec<Region>, strategy: LoadBalancingStrategy) -> Self {
        let latencies = regions.iter()
            .map(|r| (r.id.clone(), LatencyInfo {
                latency_ms: 0,
                last_measured: Utc::now(),
                sample_count: 0,
            }))
            .collect();
        
        Self {
            regions: RwLock::new(regions),
            latencies: RwLock::new(latencies),
            strategy,
            health_monitor: None,
            metrics: RwLock::new(LoadBalancerMetrics::default()),
            round_robin_index: RwLock::new(0),
        }
    }

    /// Set health monitor for health-aware routing
    pub fn with_health_monitor(mut self, monitor: Arc<HealthMonitor>) -> Self {
        self.health_monitor = Some(monitor);
        self
    }

    /// Add a region
    pub async fn add_region(&self, region: Region) {
        let mut regions = self.regions.write().await;
        regions.push(region.clone());
        
        let mut latencies = self.latencies.write().await;
        latencies.insert(region.id, LatencyInfo {
            latency_ms: 0,
            last_measured: Utc::now(),
            sample_count: 0,
        });
    }

    /// Remove a region
    pub async fn remove_region(&self, region_id: &str) {
        let mut regions = self.regions.write().await;
        regions.retain(|r| r.id != region_id);
        
        let mut latencies = self.latencies.write().await;
        latencies.remove(region_id);
    }

    /// Route request to best region
    pub async fn route(&self, client_id: &str) -> Option<Region> {
        let regions = self.regions.read().await;
        
        if regions.is_empty() {
            return None;
        }

        // Filter healthy regions if health monitor is available
        let healthy_regions = if let Some(ref monitor) = self.health_monitor {
            let mut healthy = Vec::new();
            for region in regions.iter() {
                let status = monitor.get_status(&region.id).await;
                if matches!(status, Some(HealthStatus::Healthy) | Some(HealthStatus::Degraded)) {
                    healthy.push(region.clone());
                }
            }
            if healthy.is_empty() {
                regions.clone() // Fall back to all regions if none healthy
            } else {
                healthy
            }
        } else {
            regions.clone()
        };

        match self.strategy {
            LoadBalancingStrategy::LatencyBased => self.route_by_latency(&healthy_regions).await,
            LoadBalancingStrategy::RoundRobin => self.route_round_robin(&healthy_regions).await,
            LoadBalancingStrategy::Weighted => self.route_by_weight(&healthy_regions).await,
            LoadBalancingStrategy::LeastConnections => self.route_by_connections(&healthy_regions).await,
            LoadBalancingStrategy::GeoBased => self.route_by_geo(client_id, &healthy_regions).await,
        }
    }

    /// Route by lowest latency
    async fn route_by_latency(&self, regions: &[Region]) -> Option<Region> {
        let latencies = self.latencies.read().await;
        
        regions.iter()
            .filter_map(|r| {
                latencies.get(&r.id).map(|info| (r, info.latency_ms))
            })
            .min_by_key(|(_, latency)| *latency)
            .map(|(region, _)| region.clone())
    }

    /// Route round-robin
    async fn route_round_robin(&self, regions: &[Region]) -> Option<Region> {
        let mut index = self.round_robin_index.write().await;
        let region = regions.get(*index % regions.len()).cloned();
        *index = (*index + 1) % regions.len();
        region
    }

    /// Route by weight (priority)
    async fn route_by_weight(&self, regions: &[Region]) -> Option<Region> {
        regions.iter()
            .max_by_key(|r| r.priority)
            .cloned()
    }

    /// Route by least connections
    async fn route_by_connections(&self, regions: &[Region]) -> Option<Region> {
        // In real impl, would track actual connections per region
        // For now, use random selection
        regions.first().cloned()
    }

    /// Route by geographic proximity
    async fn route_by_geo(&self, _client_id: &str, regions: &[Region]) -> Option<Region> {
        // In real impl, would use client IP to determine closest region
        // For now, use latency-based routing as proxy
        self.route_by_latency(regions).await
    }

    /// Record latency for a region
    pub async fn record_latency(&self, region_id: &str, latency_ms: u64) {
        let mut latencies = self.latencies.write().await;
        
        if let Some(info) = latencies.get_mut(region_id) {
            // Exponential moving average
            let alpha = 0.3;
            info.latency_ms = (info.latency_ms as f64 * (1.0 - alpha) + latency_ms as f64 * alpha) as u64;
            info.last_measured = Utc::now();
            info.sample_count += 1;
        } else {
            latencies.insert(region_id.to_string(), LatencyInfo {
                latency_ms,
                last_measured: Utc::now(),
                sample_count: 1,
            });
        }
    }

    /// Measure and record latency for all regions
    pub async fn measure_latencies(&self) {
        let regions = self.regions.read().await;
        
        for region in regions.iter() {
            let start = Instant::now();
            
            // Simulate ping (in real impl: HTTP GET to region endpoint)
            tokio::time::sleep(tokio::time::Duration::from_millis(
                rand::random::<u64>() % 50 + 10
            )).await;
            
            let latency_ms = start.elapsed().as_millis() as u64;
            self.record_latency(&region.id, latency_ms).await;
        }
    }

    /// Get current latencies
    pub async fn get_latencies(&self) -> HashMap<RegionId, u64> {
        let latencies = self.latencies.read().await;
        latencies.iter()
            .map(|(id, info)| (id.clone(), info.latency_ms))
            .collect()
    }

    /// Record a request for metrics
    async fn record_request(&self, region_id: &str) {
        let mut metrics = self.metrics.write().await;
        metrics.requests_total += 1;
        *metrics.requests_per_region.entry(region_id.to_string()).or_insert(0) += 1;
    }

    /// Get load balancer metrics
    pub async fn get_metrics(&self) -> LoadBalancerMetrics {
        self.metrics.read().await.clone()
    }

    /// Get strategy
    pub fn strategy(&self) -> LoadBalancingStrategy {
        self.strategy
    }

    /// Update strategy
    pub async fn set_strategy(&mut self, strategy: LoadBalancingStrategy) {
        self.strategy = strategy;
    }
}

/// Load balancer configuration builder
pub struct LoadBalancerConfig {
    regions: Vec<Region>,
    strategy: LoadBalancingStrategy,
    health_monitor: Option<Arc<HealthMonitor>>,
}

impl LoadBalancerConfig {
    pub fn new(regions: Vec<Region>) -> Self {
        Self {
            regions,
            strategy: LoadBalancingStrategy::default(),
            health_monitor: None,
        }
    }

    pub fn with_strategy(mut self, strategy: LoadBalancingStrategy) -> Self {
        self.strategy = strategy;
        self
    }

    pub fn with_health_monitor(mut self, monitor: Arc<HealthMonitor>) -> Self {
        self.health_monitor = Some(monitor);
        self
    }

    pub fn build(self) -> LoadBalancer {
        let mut lb = LoadBalancer::new(self.regions, self.strategy);
        if let Some(monitor) = self.health_monitor {
            lb = lb.with_health_monitor(monitor);
        }
        lb
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_load_balancer_creation() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        
        let lb = LoadBalancer::new(regions, LoadBalancingStrategy::LatencyBased);
        
        assert_eq!(lb.strategy(), LoadBalancingStrategy::LatencyBased);
    }

    #[tokio::test]
    async fn test_route_latency_based() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        
        let lb = LoadBalancer::new(regions, LoadBalancingStrategy::LatencyBased);
        
        // Record different latencies
        lb.record_latency("us-east-1", 100).await;
        lb.record_latency("us-west-2", 50).await;
        
        let region = lb.route("client-1").await;
        
        assert!(region.is_some());
        assert_eq!(region.unwrap().id, "us-west-2"); // Lower latency
    }

    #[tokio::test]
    async fn test_route_round_robin() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
            Region::new("us-west-2", "US West", "http://us-west.example.com"),
        ];
        
        let lb = LoadBalancer::new(regions.clone(), LoadBalancingStrategy::RoundRobin);
        
        let r1 = lb.route("client-1").await;
        let r2 = lb.route("client-2").await;
        let r3 = lb.route("client-3").await;
        
        assert_eq!(r1.unwrap().id, regions[0].id);
        assert_eq!(r2.unwrap().id, regions[1].id);
        assert_eq!(r3.unwrap().id, regions[0].id); // Wraps around
    }

    #[tokio::test]
    async fn test_route_weighted() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com")
                .with_priority(10),
            Region::new("us-west-2", "US West", "http://us-west.example.com")
                .with_priority(50),
        ];
        
        let lb = LoadBalancer::new(regions.clone(), LoadBalancingStrategy::Weighted);
        
        let region = lb.route("client-1").await;
        
        assert!(region.is_some());
        assert_eq!(region.unwrap().id, "us-west-2"); // Higher priority
    }

    #[tokio::test]
    async fn test_config_builder() {
        let regions = vec![
            Region::new("us-east-1", "US East", "http://us-east.example.com"),
        ];
        let monitor = Arc::new(HealthMonitor::new(5000));
        
        let lb = LoadBalancerConfig::new(regions)
            .with_strategy(LoadBalancingStrategy::RoundRobin)
            .with_health_monitor(monitor)
            .build();
        
        assert_eq!(lb.strategy(), LoadBalancingStrategy::RoundRobin);
    }
}
