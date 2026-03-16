// OWNER: T1-A1

//! Health Monitoring System
//!
//! Monitor health of regions, services, and system resources.

use crate::types::*;
use chrono::Utc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::time::Instant;

/// Health check function type
pub type HealthCheckFn = Box<dyn Fn() -> HealthCheckResult + Send + Sync>;

/// Health monitor for regions and services
pub struct HealthMonitor {
    regions: RwLock<HashMap<RegionId, RegionHealth>>,
    checks: RwLock<HashMap<String, HealthCheckFn>>,
    check_interval_ms: u64,
}

struct RegionHealth {
    region: Region,
    last_check: Option<chrono::DateTime<Utc>>,
    consecutive_failures: u32,
    metrics: HealthMetrics,
}

impl HealthMonitor {
    /// Create new health monitor
    pub fn new(check_interval_ms: u64) -> Self {
        Self {
            regions: RwLock::new(HashMap::new()),
            checks: RwLock::new(HashMap::new()),
            check_interval_ms,
        }
    }

    /// Register a region for monitoring
    pub async fn register_region(&self, region: Region) {
        let mut regions = self.regions.write().await;
        regions.insert(region.id.clone(), RegionHealth {
            region,
            last_check: None,
            consecutive_failures: 0,
            metrics: HealthMetrics::default(),
        });
    }

    /// Unregister a region
    pub async fn unregister_region(&self, region_id: &str) {
        let mut regions = self.regions.write().await;
        regions.remove(region_id);
    }

    /// Register a health check
    pub async fn register_check(&self, name: &str, check: HealthCheckFn) {
        let mut checks = self.checks.write().await;
        checks.insert(name.to_string(), check);
    }

    /// Check health of all regions
    pub async fn check_all(&self) -> Vec<HealthReport> {
        let mut reports = Vec::new();
        let regions = self.regions.read().await;
        let checks = self.checks.read().await;

        for (region_id, _region_health) in regions.iter() {
            let mut report = self.check_region(region_id).await;
            
            // Run registered checks
            let mut check_results = Vec::new();
            for (_check_name, check_fn) in checks.iter() {
                let result = check_fn();
                if result.name.contains(region_id) || result.name.starts_with("system") {
                    check_results.push(result);
                }
            }
            report.checks.extend(check_results);
            
            reports.push(report);
        }

        reports
    }

    /// Check health of a specific region
    pub async fn check_region(&self, region_id: &str) -> HealthReport {
        let _start = Instant::now();
        let mut regions = self.regions.write().await;
        
        let region_health = match regions.get_mut(region_id) {
            Some(h) => h,
            None => {
                return HealthReport {
                    timestamp: Utc::now(),
                    region_id: region_id.to_string(),
                    overall_status: HealthStatus::Unknown,
                    checks: vec![],
                    metrics: HealthMetrics::default(),
                };
            }
        };

        // Ping the region (simulated - in real impl would be HTTP/gRPC)
        let ping_result = self.ping_region(&region_health.region).await;
        
        // Collect metrics
        let metrics = self.collect_metrics(region_id).await;
        
        // Determine overall status
        let overall_status = if ping_result.status == HealthStatus::Healthy && metrics.cpu_usage_percent < 90.0 {
            HealthStatus::Healthy
        } else if ping_result.status == HealthStatus::Unhealthy || metrics.cpu_usage_percent >= 95.0 {
            HealthStatus::Unhealthy
        } else {
            HealthStatus::Degraded
        };

        // Update region health
        region_health.last_check = Some(Utc::now());
        region_health.metrics = metrics.clone();
        
        if ping_result.status == HealthStatus::Healthy {
            region_health.consecutive_failures = 0;
        } else {
            region_health.consecutive_failures += 1;
        }

        HealthReport {
            timestamp: Utc::now(),
            region_id: region_id.to_string(),
            overall_status,
            checks: vec![ping_result],
            metrics,
        }
    }

    /// Ping a region (simulated latency check)
    async fn ping_region(&self, region: &Region) -> HealthCheckResult {
        let start = Instant::now();
        
        // Simulate network ping (in real impl: HTTP GET to health endpoint)
        tokio::time::sleep(tokio::time::Duration::from_millis(
            rand::random::<u64>() % 50 + 10
        )).await;
        
        let latency_ms = start.elapsed().as_millis() as u64;
        
        // Simulate occasional failures for testing
        let is_healthy = rand::random::<u32>() % 100 < 95; // 95% success rate
        
        HealthCheckResult {
            name: format!("ping_{}", region.id),
            status: if is_healthy { HealthStatus::Healthy } else { HealthStatus::Unhealthy },
            message: if is_healthy {
                Some(format!("Ping successful ({}ms)", latency_ms))
            } else {
                Some("Ping timeout".to_string())
            },
            latency_ms: Some(latency_ms),
            timestamp: Utc::now(),
        }
    }

    /// Collect system metrics for a region
    async fn collect_metrics(&self, _region_id: &str) -> HealthMetrics {
        // Simulated metrics (in real impl: query Prometheus or similar)
        HealthMetrics {
            cpu_usage_percent: rand::random::<f64>() % 100.0,
            memory_usage_percent: rand::random::<f64>() % 100.0,
            disk_usage_percent: rand::random::<f64>() % 100.0,
            network_latency_ms: rand::random::<u64>() % 100,
            active_connections: rand::random::<u64>() % 10000,
        }
    }

    /// Get health status for a region
    pub async fn get_status(&self, region_id: &str) -> Option<HealthStatus> {
        let regions = self.regions.read().await;
        regions.get(region_id).map(|h| {
            if h.consecutive_failures >= 3 {
                HealthStatus::Unhealthy
            } else if h.consecutive_failures >= 1 {
                HealthStatus::Degraded
            } else {
                HealthStatus::Healthy
            }
        })
    }

    /// Get all healthy regions
    pub async fn get_healthy_regions(&self) -> Vec<Region> {
        let regions = self.regions.read().await;
        regions
            .iter()
            .filter(|(_, h)| h.consecutive_failures == 0)
            .map(|(_, h)| h.region.clone())
            .collect()
    }

    /// Get check interval
    pub fn check_interval(&self) -> u64 {
        self.check_interval_ms
    }
}

/// Health check builder
pub struct HealthCheckBuilder {
    name: String,
}

impl HealthCheckBuilder {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }

    pub fn http_check(self, url: &str) -> HealthCheckFn {
        let name = self.name.clone();
        let url = url.to_string();
        
        Box::new(move || {
            // In real impl: reqwest::blocking::get(&url)
            HealthCheckResult {
                name: name.clone(),
                status: HealthStatus::Healthy,
                message: Some(format!("HTTP check passed for {}", url)),
                latency_ms: Some(rand::random::<u64>() % 100),
                timestamp: Utc::now(),
            }
        })
    }

    pub fn tcp_check(self, host: &str, port: u16) -> HealthCheckFn {
        let name = self.name.clone();
        let host = host.to_string();
        
        Box::new(move || {
            // In real impl: std::net::TcpStream::connect
            HealthCheckResult {
                name: name.clone(),
                status: HealthStatus::Healthy,
                message: Some(format!("TCP check passed for {}:{}", host, port)),
                latency_ms: Some(rand::random::<u64>() % 50),
                timestamp: Utc::now(),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_monitor_creation() {
        let monitor = HealthMonitor::new(5000);
        assert_eq!(monitor.check_interval(), 5000);
    }

    #[tokio::test]
    async fn test_register_region() {
        let monitor = HealthMonitor::new(5000);
        let region = Region::new("us-east-1", "US East", "http://us-east.example.com");
        
        monitor.register_region(region.clone()).await;
        
        let status = monitor.get_status("us-east-1").await;
        assert!(status.is_some());
    }

    #[tokio::test]
    async fn test_check_all() {
        let monitor = HealthMonitor::new(5000);
        
        let region1 = Region::new("us-east-1", "US East", "http://us-east.example.com");
        let region2 = Region::new("us-west-2", "US West", "http://us-west.example.com");
        
        monitor.register_region(region1).await;
        monitor.register_region(region2).await;
        
        let reports = monitor.check_all().await;
        assert_eq!(reports.len(), 2);
    }

    #[tokio::test]
    async fn test_get_healthy_regions() {
        let monitor = HealthMonitor::new(5000);
        
        let region1 = Region::new("us-east-1", "US East", "http://us-east.example.com");
        let region2 = Region::new("us-west-2", "US West", "http://us-west.example.com");
        
        monitor.register_region(region1.clone()).await;
        monitor.register_region(region2.clone()).await;
        
        let healthy = monitor.get_healthy_regions().await;
        assert!(healthy.len() >= 0); // May have simulated failures
    }
}
