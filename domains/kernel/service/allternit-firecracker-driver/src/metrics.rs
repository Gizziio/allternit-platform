//! # Metrics Module
//!
//! Prometheus-compatible metrics instrumentation for the Firecracker driver.
//! Tracks VM lifecycle, resource usage, and operational health.

use metrics::{counter, gauge, histogram};
use std::sync::Arc;

/// Driver metrics helper struct
pub struct DriverMetrics;

impl DriverMetrics {
    /// VM spawn was attempted
    pub fn spawn_attempted(_tenant: &str) {
        counter!("allternit.vm.spawn.attempted").increment(1);
    }

    /// VM spawn completed successfully
    pub fn spawn_succeeded(_tenant: &str) {
        counter!("allternit.vm.spawn.succeeded").increment(1);
    }

    /// VM spawn failed
    pub fn _spawn_failed(_tenant: &str, _reason: &str) {
        counter!("allternit.vm.spawn.failed").increment(1);
    }

    /// VM destroy completed
    pub fn destroy_completed() {
        counter!("allternit.vm.destroy.completed").increment(1);
    }

    /// Set total active VMs count
    pub fn active_vms_set(count: usize) {
        gauge!("allternit.vm.active").set(count as f64);
    }

    /// Set active VMs count per tenant
    pub fn tenant_active_vms_set(_tenant: &str, count: usize) {
        gauge!("allternit.vm.active_per_tenant").set(count as f64);
    }

    /// Record VM spawn duration in milliseconds
    pub fn spawn_duration_ms(duration: u128) {
        histogram!("allternit.vm.spawn.duration_ms").record(duration as f64);
    }

    /// Record VM destroy duration in milliseconds
    pub fn destroy_duration_ms(duration: u128) {
        histogram!("allternit.vm.destroy.duration_ms").record(duration as f64);
    }

    /// Record rootfs creation duration in milliseconds
    pub fn _rootfs_create_duration_ms(duration: u128) {
        histogram!("allternit.vm.rootfs_create.duration_ms").record(duration as f64);
    }

    /// Set total memory used by all VMs in MiB
    pub fn memory_used_mib_set(mib: u64) {
        gauge!("allternit.resources.memory.used_mib").set(mib as f64);
    }

    /// Set available IP addresses in pool
    pub fn _ip_pool_available(count: usize) {
        gauge!("allternit.resources.ip.available").set(count as f64);
    }

    /// Record exec command duration in milliseconds
    pub fn exec_duration_ms(duration: u128) {
        histogram!("allternit.vm.exec.duration_ms").record(duration as f64);
    }

    /// VM exec command completed
    pub fn exec_completed(_exit_code: i32) {
        counter!("allternit.vm.exec.completed").increment(1);
    }

    /// VM pause completed
    pub fn _pause_completed() {
        counter!("allternit.vm.pause.completed").increment(1);
    }

    /// VM resume completed
    pub fn _resume_completed() {
        counter!("allternit.vm.resume.completed").increment(1);
    }

    /// Record health check
    pub fn _health_check(healthy: bool) {
        gauge!("allternit.driver.healthy").set(if healthy { 1.0 } else { 0.0 });
    }

    /// Record API call latency
    pub fn _api_call_duration_ms(_endpoint: &str, duration: u128) {
        histogram!("allternit.driver.api.duration_ms").record(duration as f64);
    }

    /// API call failed
    pub fn _api_call_failed(_endpoint: &str, _error: &str) {
        counter!("allternit.driver.api.failed").increment(1);
    }
}

/// Install Prometheus recorder and return render function wrapped in Arc
///
/// The returned Arc can be cloned and shared between the metrics server
/// and the driver's metrics_endpoint method.
pub fn install_prometheus_recorder(
) -> Result<Arc<dyn Fn() -> String + Send + Sync>, Box<dyn std::error::Error>> {
    let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
    let recorder = builder.build_recorder();
    let handle = recorder.handle();
    metrics::set_global_recorder(recorder)?;

    // Initialize metric descriptions
    init_metrics();

    Ok(Arc::new(move || handle.render()))
}

/// Initialize metric descriptions
fn init_metrics() {
    // Metrics are registered on first use
}

/// Helper to track timing
pub struct Timer {
    start: std::time::Instant,
}

impl Timer {
    pub fn new() -> Self {
        Self {
            start: std::time::Instant::now(),
        }
    }

    pub fn elapsed_ms(&self) -> u128 {
        self.start.elapsed().as_millis()
    }
}

impl Default for Timer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timer() {
        let timer = Timer::new();
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert!(timer.elapsed_ms() >= 10);
    }
}
