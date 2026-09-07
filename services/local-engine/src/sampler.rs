//! Background system telemetry sampler.
//!
//! sysinfo computes CPU usage as a delta between two refreshes, so a
//! per-request `System::new_all()` (as `/status` used to do) can only ever
//! report static totals. This sampler owns one `System` and refreshes CPU
//! and memory on an interval, keeping the latest sample available for cheap,
//! lock-protected reads from request handlers.

use std::sync::{Arc, Mutex};
use std::time::Duration;
use sysinfo::System;
use tokio::task::JoinHandle;

/// How often the background task refreshes CPU and memory.
const REFRESH_INTERVAL: Duration = Duration::from_secs(2);

/// How long to wait before the first refresh. sysinfo's first
/// `global_cpu_usage()` read after construction is meaningless (it is a
/// delta against the constructor's own refresh), so we take a first sample
/// quickly instead of making `/status` report 0.0 for a full interval.
const FIRST_SAMPLE_DELAY: Duration = Duration::from_millis(500);

/// Latest point-in-time machine telemetry sample.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemSample {
    /// Global CPU usage across all cores, as a percentage (0.0–100.0+, can
    /// exceed 100 on multi-core machines depending on sysinfo's convention
    /// for the "global" value).
    pub global_cpu_usage: f32,
    /// Used system memory in bytes.
    pub memory_used_bytes: u64,
    /// Total system memory in bytes.
    pub memory_total_bytes: u64,
}

/// Shared handle to the background sampler. Clone freely.
#[derive(Clone)]
pub struct SystemSampler {
    sample: Arc<Mutex<SystemSample>>,
    task: Arc<JoinHandle<()>>,
}

impl SystemSampler {
    /// Spawn the background refresh task and return a handle.
    pub fn start() -> Self {
        let mut sys = System::new_all();
        let sample = Arc::new(Mutex::new(current_sample(&mut sys)));

        let shared = sample.clone();
        let task = tokio::spawn(async move {
            // Seed the delta baseline immediately so the first interval
            // sample is meaningful.
            tokio::time::sleep(FIRST_SAMPLE_DELAY).await;
            loop {
                write_sample(&shared, &mut sys);
                tokio::time::sleep(REFRESH_INTERVAL).await;
            }
        });

        Self {
            sample,
            task: Arc::new(task),
        }
    }

    /// Read the most recent sample.
    pub fn latest(&self) -> SystemSample {
        let guard = self
            .sample
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard
    }
}

impl Drop for SystemSampler {
    fn drop(&mut self) {
        if let Some(task) = Arc::get_mut(&mut self.task) {
            task.abort();
        }
    }
}

fn current_sample(sys: &mut System) -> SystemSample {
    // sysinfo 0.30 reports memory in bytes.
    SystemSample {
        global_cpu_usage: sys.global_cpu_info().cpu_usage(),
        memory_used_bytes: sys.used_memory(),
        memory_total_bytes: sys.total_memory(),
    }
}

fn write_sample(shared: &Arc<Mutex<SystemSample>>, sys: &mut System) {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let latest = current_sample(sys);
    let mut guard = shared
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *guard = latest;
}
