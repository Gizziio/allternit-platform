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

static CAPACITY_MONITOR: once_cell::sync::OnceCell<Arc<CapacityMonitor>> =
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
}

impl CapacityMonitor {
    pub fn new(threshold: f64) -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
            threshold,
        }
    }

    pub async fn status(&self) -> CapacityStatus {
        let snaps = self.snapshots.read().await;
        let mut snapshots: Vec<_> = snaps.values().cloned().collect();
        drop(snaps);
        snapshots.sort_by(|a, b| a.provider.cmp(&b.provider).then(a.host.cmp(&b.host)));

        let mut used_cpu = 0u64;
        let mut total_cpu = 0u64;
        for s in &snapshots {
            let host_used = s.total_cpu_millis.saturating_sub(s.available_cpu_millis) as u64;
            used_cpu += host_used;
            total_cpu += s.total_cpu_millis as u64;
        }

        let (scale_up_recommended, scale_up_reason) = if total_cpu == 0 {
            (false, None)
        } else {
            let ratio = used_cpu as f64 / total_cpu as f64;
            if ratio >= self.threshold {
                (
                    true,
                    Some(format!(
                        "cluster CPU utilization {:.0}% exceeds {}% threshold",
                        ratio * 100.0,
                        self.threshold * 100.0
                    )),
                )
            } else {
                (false, None)
            }
        };

        CapacityStatus {
            snapshots,
            scale_up_recommended,
            scale_up_reason,
        }
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
pub fn init_capacity_monitor(threshold: f64) -> Arc<CapacityMonitor> {
    CAPACITY_MONITOR
        .get_or_init(|| Arc::new(CapacityMonitor::new(threshold)))
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

    let health = match driver.health_check().await {
        Ok(h) => h,
        Err(e) => {
            warn!(error = %e, "capacity monitor health check failed");
            return;
        }
    };

    let caps = driver.capabilities();
    let active = health.active_executions;
    let total_cpu = caps.max_resources.cpu_millis;
    let total_mem = caps.max_resources.memory_mib;

    // Estimate available capacity as total minus an equal share per active VM.
    // This is a coarse approximation until the drivers report host-level stats.
    let used_cpu = active.saturating_mul(2000);
    let used_mem = active.saturating_mul(4096);
    let available_cpu = total_cpu.saturating_sub(used_cpu);
    let available_mem = total_mem.saturating_sub(used_mem);

    let snapshot = CapacitySnapshot {
        provider: format!("{:?}", caps.driver_type).to_lowercase(),
        host: health.message.unwrap_or_else(|| "default".to_string()),
        healthy: health.healthy,
        active_executions: active,
        total_cpu_millis: total_cpu,
        total_memory_mib: total_mem,
        available_cpu_millis: available_cpu,
        available_memory_mib: available_mem,
        scaled_at: chrono::Utc::now().to_rfc3339(),
    };

    let key = format!("{}:{}", snapshot.provider, snapshot.host);
    {
        let mut snaps = monitor.snapshots.write().await;
        snaps.insert(key, snapshot.clone());
    }

    let status = monitor.status().await;
    if status.scale_up_recommended {
        warn!(reason = ?status.scale_up_reason, "autoscale: scale-up recommended");
    } else {
        info!(
            active,
            total_cpu,
            available_cpu,
            "capacity monitor sample recorded"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn scale_up_triggered_when_threshold_exceeded() {
        let monitor = CapacityMonitor::new(0.5);
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
        let monitor = CapacityMonitor::new(0.9);
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
}
