//! Capacity monitoring and lightweight autoscaling signals for desktop hosts.
//!
//! A background task periodically samples the configured execution driver(s) and
//! stores snapshots. The autoscaler only emits signals (logs + a status flag)
//! because the actual act of spinning up a new bare-metal Incus/Tart host is
//! outside the API's scope.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{info, warn};

use crate::AppState;

pub(crate) static CAPACITY_MONITOR: once_cell::sync::OnceCell<Arc<CapacityMonitor>> =
    once_cell::sync::OnceCell::new();

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/desktop-capacity", get(get_capacity))
}

#[derive(Debug, Clone, Serialize)]
pub struct CapacitySnapshot {
    pub provider: String,
    pub host: String,
    pub healthy: bool,
    pub active_executions: u32,
    pub total_cpu_millis: u32,
    pub total_memory_mib: u32,
    pub available_cpu_millis: u32,
    pub available_memory_mib: u32,
    pub scaled_at: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct CapacityStatus {
    pub snapshots: Vec<CapacitySnapshot>,
    pub scale_up_recommended: bool,
    pub scale_up_reason: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CapacityMonitor {
    snapshots: Arc<RwLock<HashMap<String, CapacitySnapshot>>>,
    threshold: f64,
    memory_threshold: f64,
}

impl CapacityMonitor {
    pub fn new(threshold: f64, memory_threshold: f64) -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            threshold,
            memory_threshold,
        }
    }

    pub async fn status(&self) -> CapacityStatus {
        let snaps = self.snapshots.read().await;
        let mut snapshots: Vec<_> = snaps.values().cloned().collect();
        drop(snaps);
        snapshots.sort_by(|a, b| a.provider.cmp(&b.provider).then(a.host.cmp(&b.host)));

        let mut used_cpu = 0u64;
        let mut total_cpu = 0u64;
        let mut used_mem = 0u64;
        let mut total_mem = 0u64;
        for s in &snapshots {
            let host_used_cpu = s.total_cpu_millis.saturating_sub(s.available_cpu_millis) as u64;
            used_cpu += host_used_cpu;
            total_cpu += s.total_cpu_millis as u64;

            let host_used_mem = s.total_memory_mib.saturating_sub(s.available_memory_mib) as u64;
            used_mem += host_used_mem;
            total_mem += s.total_memory_mib as u64;
        }

        let cpu_ratio = if total_cpu == 0 { 0.0 } else { used_cpu as f64 / total_cpu as f64 };
        let mem_ratio = if total_mem == 0 { 0.0 } else { used_mem as f64 / total_mem as f64 };

        let (scale_up_recommended, scale_up_reason) = if cpu_ratio >= self.threshold {
            (
                true,
                Some(format!(
                    "cluster CPU utilization {:.0}% exceeds {:.0}% threshold",
                    cpu_ratio * 100.0,
                    self.threshold * 100.0
                )),
            )
        } else if mem_ratio >= self.memory_threshold {
            (
                true,
                Some(format!(
                    "cluster memory utilization {:.0}% exceeds {:.0}% threshold",
                    mem_ratio * 100.0,
                    self.memory_threshold * 100.0
                )),
            )
        } else {
            (false, None)
        };

        CapacityStatus {
            snapshots,
            scale_up_recommended,
            scale_up_reason,
        }
    }

    /// Number of additional 2-CPU desktops the cluster can accept according to
    /// the last capacity sample. Negative values mean the cluster is overcommitted.
    pub async fn available_slots(&self) -> i64 {
        let snaps = self.snapshots.read().await;
        if snaps.is_empty() {
            // No samples yet; be permissive so provisioning is not blocked.
            return 1;
        }
        snaps
            .values()
            .map(|s| (s.available_cpu_millis as i64 / 2000).max(0))
            .sum()
    }

    pub async fn is_at_capacity(&self) -> bool {
        self.available_slots().await <= 0
    }

    /// True when the substrate that would host `os` has no available slots.
    /// Falls back to the global fleet view when the OS is unknown or when no
    /// matching substrate has been sampled yet.
    pub async fn is_os_at_capacity(&self, os: Option<&str>, provider: Option<&str>) -> bool {
        if let Some(os) = os {
            let snaps = self.snapshots.read().await;
            let matching: Vec<_> = snaps
                .values()
                .filter(|s| {
                    provider_supports_os(&s.provider, os)
                        && provider.map_or(true, |p| s.provider == p)
                })
                .cloned()
                .collect();
            drop(snaps);
            if !matching.is_empty() {
                let slots: i64 = matching
                    .iter()
                    .map(|s| (s.available_cpu_millis as i64 / 2000).max(0))
                    .sum();
                return slots <= 0;
            }
        }
        self.is_at_capacity().await
    }
}

async fn get_capacity(_state: State<Arc<AppState>>) -> impl IntoResponse {
    if let Some(monitor) = CAPACITY_MONITOR.get() {
        let status = monitor.status().await;
        (StatusCode::OK, Json(serde_json::json!(status))).into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "capacity monitor not enabled"})),
        )
            .into_response()
    }
}

/// Initialize the global monitor if it has not been set yet.
pub fn init_capacity_monitor(threshold: f64, memory_threshold: f64) -> Arc<CapacityMonitor> {
    CAPACITY_MONITOR
        .get_or_init(|| Arc::new(CapacityMonitor::new(threshold, memory_threshold)))
        .clone()
}

/// Spawn a background task that samples driver health/capacity forever.
pub fn spawn_capacity_monitor(state: Arc<AppState>, period: Duration) {
    let monitor = match CAPACITY_MONITOR.get() {
        Some(m) => m.clone(),
        None => return,
    };

    tokio::spawn(async move {
        let mut ticker = interval(period);
        loop {
            ticker.tick().await;
            sample_capacity(&state, &monitor).await;
        }
    });
}

async fn sample_capacity(state: &Arc<AppState>, monitor: &CapacityMonitor) {
    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => return,
    };

    // Heterogeneous drivers (e.g. SubstrateRouter) expose per-substrate health.
    // Fall back to a single aggregate snapshot for homogeneous drivers.
    let substrates = match driver.substrate_capacities().await {
        Ok(s) if !s.is_empty() => s,
        Ok(_) | Err(_) => {
            let health = match driver.health_check().await {
                Ok(h) => h,
                Err(e) => {
                    warn!(error = %e, "capacity monitor health check failed");
                    return;
                }
            };
            let caps = driver.capabilities();
            vec![(
                format!("{:?}", caps.driver_type).to_lowercase(),
                health,
                caps,
            )]
        }
    };

    {
        let mut snaps = monitor.snapshots.write().await;
        snaps.clear();
        for (provider, health, caps) in substrates {
            let snapshot = CapacitySnapshot {
                provider,
                host: health.message.clone().unwrap_or_else(|| "default".to_string()),
                healthy: health.healthy,
                active_executions: health.active_executions,
                total_cpu_millis: caps.max_resources.cpu_millis,
                total_memory_mib: caps.max_resources.memory_mib,
                available_cpu_millis: health.available_capacity.cpu_millis,
                available_memory_mib: health.available_capacity.memory_mib,
                scaled_at: chrono::Utc::now().to_rfc3339(),
            };
            let key = format!("{}:{}", snapshot.provider, snapshot.host);
            snaps.insert(key, snapshot);
        }
    }

    let status = monitor.status().await;
    if status.scale_up_recommended {
        warn!(reason = ?status.scale_up_reason, "autoscale: scale-up recommended");
    } else {
        let slots = monitor.available_slots().await;
        info!(slots, "capacity monitor sample recorded");
    }
}

fn provider_supports_os(provider: &str, os: &str) -> bool {
    match (provider, os) {
        ("tart", "macos") | ("tart", "linux") => true,
        ("incus", "linux") | ("incus", "windows") => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn scale_up_triggered_when_threshold_exceeded() {
        let monitor = CapacityMonitor::new(0.5, 0.9);
        {
            let mut snaps = monitor.snapshots.write().await;
            snaps.insert(
                "incus:host1".to_string(),
                CapacitySnapshot {
                    provider: "incus".to_string(),
                    host: "host1".to_string(),
                    healthy: true,
                    active_executions: 4,
                    total_cpu_millis: 8000,
                    total_memory_mib: 32768,
                    available_cpu_millis: 0,
                    available_memory_mib: 0,
                    scaled_at: chrono::Utc::now().to_rfc3339(),
                },
            );
        }
        let status = monitor.status().await;
        assert!(status.scale_up_recommended);
        assert!(status.scale_up_reason.is_some());
    }

    #[tokio::test]
    async fn scale_up_not_triggered_when_idle() {
        let monitor = CapacityMonitor::new(0.9, 0.9);
        {
            let mut snaps = monitor.snapshots.write().await;
            snaps.insert(
                "incus:host1".to_string(),
                CapacitySnapshot {
                    provider: "incus".to_string(),
                    host: "host1".to_string(),
                    healthy: true,
                    active_executions: 1,
                    total_cpu_millis: 8000,
                    total_memory_mib: 32768,
                    available_cpu_millis: 6000,
                    available_memory_mib: 28000,
                    scaled_at: chrono::Utc::now().to_rfc3339(),
                },
            );
        }
        let status = monitor.status().await;
        assert!(!status.scale_up_recommended);
    }

    #[tokio::test]
    async fn scale_up_triggered_when_memory_threshold_exceeded() {
        let monitor = CapacityMonitor::new(0.9, 0.5);
        {
            let mut snaps = monitor.snapshots.write().await;
            snaps.insert(
                "incus:host1".to_string(),
                CapacitySnapshot {
                    provider: "incus".to_string(),
                    host: "host1".to_string(),
                    healthy: true,
                    active_executions: 1,
                    total_cpu_millis: 8000,
                    total_memory_mib: 32768,
                    available_cpu_millis: 6000,
                    available_memory_mib: 1024,
                    scaled_at: chrono::Utc::now().to_rfc3339(),
                },
            );
        }
        let status = monitor.status().await;
        assert!(status.scale_up_recommended);
        assert!(
            status
                .scale_up_reason
                .as_deref()
                .unwrap()
                .contains("memory")
        );
    }

    #[tokio::test]
    async fn is_os_at_capacity_filters_by_provider() {
        let monitor = CapacityMonitor::new(0.9, 0.9);
        {
            let mut snaps = monitor.snapshots.write().await;
            snaps.insert(
                "incus:host1".to_string(),
                CapacitySnapshot {
                    provider: "incus".to_string(),
                    host: "host1".to_string(),
                    healthy: true,
                    active_executions: 4,
                    total_cpu_millis: 8000,
                    total_memory_mib: 32768,
                    available_cpu_millis: 0,
                    available_memory_mib: 0,
                    scaled_at: chrono::Utc::now().to_rfc3339(),
                },
            );
            snaps.insert(
                "tart:host2".to_string(),
                CapacitySnapshot {
                    provider: "tart".to_string(),
                    host: "host2".to_string(),
                    healthy: true,
                    active_executions: 0,
                    total_cpu_millis: 8000,
                    total_memory_mib: 32768,
                    available_cpu_millis: 8000,
                    available_memory_mib: 32768,
                    scaled_at: chrono::Utc::now().to_rfc3339(),
                },
            );
        }
        // Incus linux is at capacity.
        assert!(monitor.is_os_at_capacity(Some("linux"), Some("incus")).await);
        // Tart linux still has room.
        assert!(!monitor.is_os_at_capacity(Some("linux"), Some("tart")).await);
        // Overall linux capacity has room because Tart is available.
        assert!(!monitor.is_os_at_capacity(Some("linux"), None).await);
    }
}
