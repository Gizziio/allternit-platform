//! Allternit Budget Metering System
//!
//! Implements SYSTEM_LAW.md LAW-SWM-004 (Budget-Aware Scheduling)
//!
//! Features:
//! - CPU-seconds metering
//! - Memory-seconds metering
//! - Network egress tracking
//! - Quota enforcement
//! - Admission control

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Budget quota for a tenant/run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetQuota {
    pub quota_id: String,
    pub tenant_id: String,
    pub run_id: Option<String>,

    // Resource limits
    pub cpu_seconds_limit: u64,
    pub memory_mb_seconds_limit: u64,
    pub network_bytes_limit: u64,
    pub max_concurrent_workers: u32,

    // Time bounds
    pub valid_from: DateTime<Utc>,
    pub valid_until: Option<DateTime<Utc>>,

    // Priority
    pub priority: i32,
}

/// Current resource usage
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceUsage {
    pub cpu_seconds_used: u64,
    pub memory_mb_seconds_used: u64,
    pub network_bytes_used: u64,
    pub current_workers: u32,
    pub peak_workers: u32,
}

/// Budget usage summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetUsage {
    pub quota: BudgetQuota,
    pub usage: ResourceUsage,
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub network_percent: f32,
    pub worker_percent: f32,
    pub is_over_budget: bool,
    pub estimated_remaining_seconds: u64,
}

/// Admission decision
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdmissionDecision {
    Allow,
    Deny { reason: String },
    AllowWithWarning { warning: String },
}

/// Budget check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetCheckResult {
    pub admission: AdmissionDecision,
    pub current_usage: ResourceUsage,
    pub quota_remaining: ResourceUsage,
    pub warnings: Vec<String>,
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub network_percent: f32,
    pub worker_percent: f32,
    pub is_over_budget: bool,
    pub estimated_remaining_seconds: u64,
}

/// Resource measurement event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceMeasurement {
    pub measurement_id: String,
    pub run_id: String,
    pub worker_id: String,
    pub timestamp: DateTime<Utc>,

    // CPU
    pub cpu_seconds_delta: u64,

    // Memory
    pub memory_mb_current: u64,
    pub memory_mb_peak: u64,

    // Network
    pub network_bytes_sent: u64,
    pub network_bytes_received: u64,
}

/// Budget error types
#[derive(Debug, thiserror::Error)]
pub enum BudgetError {
    #[error("Quota not found: {0}")]
    QuotaNotFound(String),

    #[error("Budget exceeded: {0}")]
    BudgetExceeded(String),

    #[error("Admission denied: {0}")]
    AdmissionDenied(String),

    #[error("Invalid measurement: {0}")]
    InvalidMeasurement(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Budget Metering Engine
pub struct BudgetMeteringEngine {
    quotas: Arc<RwLock<HashMap<String, BudgetQuota>>>,
    usage: Arc<RwLock<HashMap<String, ResourceUsage>>>,
    measurements: Arc<RwLock<Vec<ResourceMeasurement>>>,
}

impl BudgetMeteringEngine {
    pub fn new() -> Self {
        Self {
            quotas: Arc::new(RwLock::new(HashMap::new())),
            usage: Arc::new(RwLock::new(HashMap::new())),
            measurements: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a budget quota
    pub async fn register_quota(&self, quota: BudgetQuota) -> Result<(), BudgetError> {
        let mut quotas = self.quotas.write().await;

        let key = self.get_quota_key(&quota.tenant_id, quota.run_id.as_deref());
        quotas.insert(key, quota);

        Ok(())
    }

    /// Record resource usage measurement
    pub async fn record_measurement(
        &self,
        measurement: ResourceMeasurement,
    ) -> Result<(), BudgetError> {
        // Validate measurement
        if measurement.cpu_seconds_delta == 0
            && measurement.memory_mb_current == 0
            && measurement.network_bytes_sent == 0
            && measurement.network_bytes_received == 0
        {
            return Err(BudgetError::InvalidMeasurement(
                "Measurement must have at least one non-zero value".to_string(),
            ));
        }

        // Update usage for this run
        let mut usage_map = self.usage.write().await;
        let usage = usage_map
            .entry(measurement.run_id.clone())
            .or_insert_with(ResourceUsage::default);

        usage.cpu_seconds_used += measurement.cpu_seconds_delta;
        usage.memory_mb_seconds_used += measurement.memory_mb_current;
        usage.network_bytes_used +=
            measurement.network_bytes_sent + measurement.network_bytes_received;

        if measurement.worker_id.ends_with("_spawn") {
            usage.current_workers += 1;
            usage.peak_workers = usage.peak_workers.max(usage.current_workers);
        } else if measurement.worker_id.ends_with("_terminate") {
            usage.current_workers = usage.current_workers.saturating_sub(1);
        }

        drop(usage_map);

        // Store measurement
        let mut measurements = self.measurements.write().await;
        measurements.push(measurement);

        Ok(())
    }

    /// Check budget and determine admission
    pub async fn check_budget(
        &self,
        tenant_id: &str,
        run_id: Option<&str>,
    ) -> Result<BudgetCheckResult, BudgetError> {
        let quotas = self.quotas.read().await;
        let usage_map = self.usage.read().await;

        let quota_key = self.get_quota_key(tenant_id, run_id);
        let quota = quotas
            .get(&quota_key)
            .ok_or_else(|| BudgetError::QuotaNotFound(quota_key.clone()))?
            .clone(); // Clone the quota to avoid borrow issues

        let usage = usage_map
            .get(&run_id.unwrap_or("global").to_string())
            .cloned()
            .unwrap_or_default();

        drop(quotas);
        drop(usage_map);

        // Calculate percentages
        let cpu_percent = if quota.cpu_seconds_limit > 0 {
            (usage.cpu_seconds_used as f32 / quota.cpu_seconds_limit as f32) * 100.0
        } else {
            0.0
        };

        let memory_percent = if quota.memory_mb_seconds_limit > 0 {
            (usage.memory_mb_seconds_used as f32 / quota.memory_mb_seconds_limit as f32) * 100.0
        } else {
            0.0
        };

        let network_percent = if quota.network_bytes_limit > 0 {
            (usage.network_bytes_used as f32 / quota.network_bytes_limit as f32) * 100.0
        } else {
            0.0
        };

        let worker_percent = if quota.max_concurrent_workers > 0 {
            (usage.current_workers as f32 / quota.max_concurrent_workers as f32) * 100.0
        } else {
            0.0
        };

        let is_over_budget = cpu_percent >= 100.0
            || memory_percent >= 100.0
            || network_percent >= 100.0
            || worker_percent >= 100.0;

        // Determine admission decision
        let (admission, warnings) = if is_over_budget {
            let reason = self.get_over_budget_reason(
                cpu_percent,
                memory_percent,
                network_percent,
                worker_percent,
            );
            (AdmissionDecision::Deny { reason }, vec![])
        } else if cpu_percent >= 80.0 || memory_percent >= 80.0 || network_percent >= 80.0 {
            let warning = format!(
                "Budget warning: CPU {:.1}%, Memory {:.1}%, Network {:.1}%",
                cpu_percent, memory_percent, network_percent
            );
            (
                AdmissionDecision::AllowWithWarning {
                    warning: warning.clone(),
                },
                vec![warning],
            )
        } else {
            (AdmissionDecision::Allow, vec![])
        };

        // Calculate estimated remaining seconds
        let estimated_remaining_seconds = if cpu_percent > 0.0 && cpu_percent < 100.0 {
            ((quota.cpu_seconds_limit - usage.cpu_seconds_used) as f32
                / (cpu_percent / 100.0 / 3600.0)) as u64
        } else {
            0
        };

        Ok(BudgetCheckResult {
            admission,
            current_usage: usage.clone(),
            quota_remaining: ResourceUsage {
                cpu_seconds_used: quota
                    .cpu_seconds_limit
                    .saturating_sub(usage.cpu_seconds_used),
                memory_mb_seconds_used: quota
                    .memory_mb_seconds_limit
                    .saturating_sub(usage.memory_mb_seconds_used),
                network_bytes_used: quota
                    .network_bytes_limit
                    .saturating_sub(usage.network_bytes_used),
                current_workers: quota
                    .max_concurrent_workers
                    .saturating_sub(usage.current_workers),
                peak_workers: 0,
            },
            warnings,
            cpu_percent,
            memory_percent,
            network_percent,
            worker_percent,
            is_over_budget,
            estimated_remaining_seconds,
        })
    }

    /// Get budget usage summary
    pub async fn get_usage(
        &self,
        tenant_id: &str,
        run_id: Option<&str>,
    ) -> Result<BudgetUsage, BudgetError> {
        let quotas = self.quotas.read().await;
        let usage_map = self.usage.read().await;

        let quota_key = self.get_quota_key(tenant_id, run_id);
        let quota = quotas
            .get(&quota_key)
            .ok_or_else(|| BudgetError::QuotaNotFound(quota_key.clone()))?
            .clone();

        let usage = usage_map
            .get(&run_id.unwrap_or("global").to_string())
            .cloned()
            .unwrap_or_default();

        drop(quotas);
        drop(usage_map);

        let cpu_percent = if quota.cpu_seconds_limit > 0 {
            (usage.cpu_seconds_used as f32 / quota.cpu_seconds_limit as f32) * 100.0
        } else {
            0.0
        };

        let memory_percent = if quota.memory_mb_seconds_limit > 0 {
            (usage.memory_mb_seconds_used as f32 / quota.memory_mb_seconds_limit as f32) * 100.0
        } else {
            0.0
        };

        let network_percent = if quota.network_bytes_limit > 0 {
            (usage.network_bytes_used as f32 / quota.network_bytes_limit as f32) * 100.0
        } else {
            0.0
        };

        let worker_percent = if quota.max_concurrent_workers > 0 {
            (usage.current_workers as f32 / quota.max_concurrent_workers as f32) * 100.0
        } else {
            0.0
        };

        let is_over_budget = cpu_percent >= 100.0
            || memory_percent >= 100.0
            || network_percent >= 100.0
            || worker_percent >= 100.0;

        let estimated_remaining_seconds = if cpu_percent > 0.0 && cpu_percent < 100.0 {
            ((quota.cpu_seconds_limit - usage.cpu_seconds_used) as f32
                / (cpu_percent / 100.0 / 3600.0)) as u64
        } else {
            0
        };

        Ok(BudgetUsage {
            quota,
            usage,
            cpu_percent,
            memory_percent,
            network_percent,
            worker_percent,
            is_over_budget,
            estimated_remaining_seconds,
        })
    }

    /// Reset usage for a run
    pub async fn reset_usage(&self, run_id: &str) -> Result<(), BudgetError> {
        let mut usage_map = self.usage.write().await;
        usage_map.remove(run_id);
        Ok(())
    }

    /// Get all measurements for a run
    pub async fn get_measurements(&self, run_id: &str) -> Vec<ResourceMeasurement> {
        let measurements = self.measurements.read().await;
        measurements
            .iter()
            .filter(|m| m.run_id == run_id)
            .cloned()
            .collect()
    }

    /// Helper: Get quota key
    fn get_quota_key(&self, tenant_id: &str, run_id: Option<&str>) -> String {
        if let Some(run_id) = run_id {
            format!("{}_{}", tenant_id, run_id)
        } else {
            format!("{}_global", tenant_id)
        }
    }

    /// Helper: Get over-budget reason
    fn get_over_budget_reason(
        &self,
        cpu_percent: f32,
        memory_percent: f32,
        network_percent: f32,
        worker_percent: f32,
    ) -> String {
        let mut reasons = Vec::new();

        if cpu_percent >= 100.0 {
            reasons.push(format!("CPU budget exceeded ({:.1}%)", cpu_percent));
        }
        if memory_percent >= 100.0 {
            reasons.push(format!("Memory budget exceeded ({:.1}%)", memory_percent));
        }
        if network_percent >= 100.0 {
            reasons.push(format!("Network budget exceeded ({:.1}%)", network_percent));
        }
        if worker_percent >= 100.0 {
            reasons.push(format!("Worker limit exceeded ({:.1}%)", worker_percent));
        }

        reasons.join(", ")
    }
}

impl Default for BudgetMeteringEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn create_test_quota(tenant_id: &str, run_id: Option<&str>) -> BudgetQuota {
        BudgetQuota {
            quota_id: format!("quota_{}", tenant_id),
            tenant_id: tenant_id.to_string(),
            run_id: run_id.map(String::from),
            cpu_seconds_limit: 3600,                // 1 hour
            memory_mb_seconds_limit: 1024 * 3600,   // 1GB for 1 hour
            network_bytes_limit: 1024 * 1024 * 100, // 100MB
            max_concurrent_workers: 10,
            valid_from: Utc::now(),
            valid_until: Some(Utc::now() + Duration::hours(24)),
            priority: 5,
        }
    }

    #[tokio::test]
    async fn test_register_quota() {
        let engine = BudgetMeteringEngine::new();
        let quota = create_test_quota("tenant_1", Some("run_1"));

        engine.register_quota(quota.clone()).await.unwrap();

        let usage = engine.get_usage("tenant_1", Some("run_1")).await.unwrap();
        assert_eq!(usage.quota.cpu_seconds_limit, 3600);
    }

    #[tokio::test]
    async fn test_record_measurement() {
        let engine = BudgetMeteringEngine::new();

        let measurement = ResourceMeasurement {
            measurement_id: "meas_1".to_string(),
            run_id: "run_1".to_string(),
            worker_id: "worker_1".to_string(),
            timestamp: Utc::now(),
            cpu_seconds_delta: 10,
            memory_mb_current: 256,
            memory_mb_peak: 512,
            network_bytes_sent: 1024,
            network_bytes_received: 2048,
        };

        engine.record_measurement(measurement).await.unwrap();

        let usage_map = engine.usage.read().await;
        let usage = usage_map.get("run_1").unwrap();
        assert_eq!(usage.cpu_seconds_used, 10);
        assert_eq!(usage.memory_mb_seconds_used, 256);
        assert_eq!(usage.network_bytes_used, 3072);
    }

    #[tokio::test]
    async fn test_check_budget_allow() {
        let engine = BudgetMeteringEngine::new();
        engine
            .register_quota(create_test_quota("tenant_1", Some("run_1")))
            .await
            .unwrap();

        let result = engine
            .check_budget("tenant_1", Some("run_1"))
            .await
            .unwrap();

        assert_eq!(result.admission, AdmissionDecision::Allow);
        assert!(!result.is_over_budget);
        assert_eq!(result.cpu_percent, 0.0);
    }

    #[tokio::test]
    async fn test_check_budget_deny() {
        let engine = BudgetMeteringEngine::new();

        // Create quota with very low limits
        let mut quota = create_test_quota("tenant_1", Some("run_1"));
        quota.cpu_seconds_limit = 10;
        engine.register_quota(quota).await.unwrap();

        // Record measurement that exceeds budget
        let measurement = ResourceMeasurement {
            measurement_id: "meas_1".to_string(),
            run_id: "run_1".to_string(),
            worker_id: "worker_1".to_string(),
            timestamp: Utc::now(),
            cpu_seconds_delta: 15, // Exceeds 10 second limit
            memory_mb_current: 0,
            memory_mb_peak: 0,
            network_bytes_sent: 0,
            network_bytes_received: 0,
        };
        engine.record_measurement(measurement).await.unwrap();

        let result = engine
            .check_budget("tenant_1", Some("run_1"))
            .await
            .unwrap();

        assert!(matches!(result.admission, AdmissionDecision::Deny { .. }));
        assert!(result.is_over_budget);
        assert!(result.cpu_percent >= 100.0);
    }

    #[tokio::test]
    async fn test_check_budget_warning() {
        let engine = BudgetMeteringEngine::new();

        // Create quota with moderate limits
        let mut quota = create_test_quota("tenant_1", Some("run_1"));
        quota.cpu_seconds_limit = 100;
        engine.register_quota(quota).await.unwrap();

        // Record measurement at 85% of budget
        let measurement = ResourceMeasurement {
            measurement_id: "meas_1".to_string(),
            run_id: "run_1".to_string(),
            worker_id: "worker_1".to_string(),
            timestamp: Utc::now(),
            cpu_seconds_delta: 85, // 85% of 100
            memory_mb_current: 0,
            memory_mb_peak: 0,
            network_bytes_sent: 0,
            network_bytes_received: 0,
        };
        engine.record_measurement(measurement).await.unwrap();

        let result = engine
            .check_budget("tenant_1", Some("run_1"))
            .await
            .unwrap();

        assert!(matches!(
            result.admission,
            AdmissionDecision::AllowWithWarning { .. }
        ));
        assert!(!result.is_over_budget);
        assert!(result.cpu_percent >= 80.0);
        assert!(!result.warnings.is_empty());
    }

    #[tokio::test]
    async fn test_reset_usage() {
        let engine = BudgetMeteringEngine::new();
        engine
            .register_quota(create_test_quota("tenant_1", Some("run_1")))
            .await
            .unwrap();

        // Record some usage
        let measurement = ResourceMeasurement {
            measurement_id: "meas_1".to_string(),
            run_id: "run_1".to_string(),
            worker_id: "worker_1".to_string(),
            timestamp: Utc::now(),
            cpu_seconds_delta: 100,
            memory_mb_current: 512,
            memory_mb_peak: 1024,
            network_bytes_sent: 0,
            network_bytes_received: 0,
        };
        engine.record_measurement(measurement).await.unwrap();

        // Reset usage
        engine.reset_usage("run_1").await.unwrap();

        let usage = engine.get_usage("tenant_1", Some("run_1")).await.unwrap();
        assert_eq!(usage.usage.cpu_seconds_used, 0);
    }
}
