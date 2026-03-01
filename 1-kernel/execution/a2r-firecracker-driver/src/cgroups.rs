//! # CGroups v2 Integration for Resource Enforcement
//!
//! This module provides resource management and enforcement for Firecracker MicroVMs
//! using Linux cgroups v2. It enables fine-grained control over CPU, memory, I/O,
//! and process limits for each VM.
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    CgroupManager                            │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Path: /sys/fs/cgroup/a2r/vms/{vm_id}                       │
//! │                                                               │
//! │  Controllers:                                                │
//! │  ├─ cpu.max        (quota/period for CPU limiting)          │
//! │  ├─ memory.max     (hard memory limit)                      │
//! │  ├─ io.max         (per-device I/O throttling)              │
//! │  └─ pids.max       (process count limit)                    │
//! │                                                               │
//! │  Stats:                                                      │
//! │  ├─ cpu.stat       (CPU usage in microseconds)              │
//! │  ├─ memory.current (current memory usage)                   │
//! │  ├─ memory.peak    (peak memory usage)                      │
//! │  └─ io.stat        (I/O statistics)                         │
//! └─────────────────────────────────────────────────────────────┘
//! ```

use a2r_driver_interface::{DriverError, ExecutionId, ResourceSpec};
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

/// Statistics for a cgroup
#[derive(Debug, Clone, Default)]
pub struct CgroupStats {
    /// CPU usage in microseconds
    pub cpu_usage_us: u64,
    /// Current memory usage in bytes
    pub memory_usage_bytes: u64,
    /// Peak memory usage in bytes
    pub memory_peak_bytes: u64,
    /// Total bytes read from disk
    pub io_read_bytes: u64,
    /// Total bytes written to disk
    pub io_write_bytes: u64,
}

/// Manager for cgroups v2 resource control
#[derive(Debug, Clone)]
pub struct CgroupManager {
    /// Base path to cgroups filesystem (typically /sys/fs/cgroup)
    base_path: PathBuf,
    /// VM execution ID
    vm_id: ExecutionId,
    /// Full path to the cgroup directory
    cgroup_path: PathBuf,
}

impl CgroupManager {
    /// Create a new cgroup manager for the given VM
    ///
    /// # Arguments
    /// * `base_path` - Base path to cgroups filesystem (e.g., /sys/fs/cgroup)
    /// * `vm_id` - Execution ID for the VM
    pub fn new(base_path: PathBuf, vm_id: ExecutionId) -> Self {
        let cgroup_path = base_path.join("a2r").join("vms").join(vm_id.to_string());
        Self {
            base_path,
            vm_id,
            cgroup_path,
        }
    }

    /// Get the full path to the cgroup directory
    pub fn cgroup_path(&self) -> &Path {
        &self.cgroup_path
    }

    /// Create a new cgroup with resource limits
    ///
    /// This creates the cgroup directory structure and configures resource limits
    /// for CPU, memory, I/O, and process count.
    ///
    /// # Arguments
    /// * `resources` - Resource specification for the VM
    pub async fn create_cgroup(&self, resources: &ResourceSpec) -> Result<(), DriverError> {
        info!(
            vm_id = %self.vm_id,
            cgroup_path = %self.cgroup_path.display(),
            "Creating cgroup"
        );

        // Create cgroup directory
        fs::create_dir_all(&self.cgroup_path)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create cgroup directory: {}", e),
            })?;

        // Enable required controllers in the parent cgroup
        self.enable_controllers().await?;

        // Configure CPU limit
        self.configure_cpu(resources).await?;

        // Configure memory limit
        self.configure_memory(resources).await?;

        // Configure I/O limits
        self.configure_io(resources).await?;

        // Configure PID limit
        self.configure_pids(resources).await?;

        info!(vm_id = %self.vm_id, "Cgroup created successfully");
        Ok(())
    }

    /// Enable CPU, memory, IO, and PID controllers in parent cgroup
    async fn enable_controllers(&self) -> Result<(), DriverError> {
        // Get the parent cgroup path (a2r/vms)
        let parent_path = self
            .cgroup_path
            .parent()
            .ok_or_else(|| DriverError::InternalError {
                message: "Failed to get parent cgroup path".to_string(),
            })?;

        // Enable controllers in parent cgroup
        let subtree_control = parent_path.join("cgroup.subtree_control");
        let controllers = ["cpu", "memory", "io", "pids"];

        for controller in &controllers {
            let enable_cmd = format!("+{}", controller);
            debug!(
                parent = %parent_path.display(),
                controller = %controller,
                "Enabling cgroup controller"
            );

            // Try to enable the controller - it's ok if it's already enabled
            if let Err(e) = fs::write(&subtree_control, &enable_cmd).await {
                warn!(
                    controller = %controller,
                    error = %e,
                    "Failed to enable cgroup controller (may already be enabled)"
                );
            }
        }

        Ok(())
    }

    /// Configure CPU limits
    ///
    /// Uses cpu.max for quota-based limiting in the format "quota period"
    /// where quota is in microseconds and period is typically 1 second (1000000 us).
    async fn configure_cpu(&self, resources: &ResourceSpec) -> Result<(), DriverError> {
        let cpu_max_path = self.cgroup_path.join("cpu.max");

        // Convert cpu_millis to cgroup v2 quota format
        // cpu_millis = vCPUs * 1000, so 2000 cpu_millis = 2 vCPUs
        // cgroup v2 uses quota in microseconds per period
        // "500000 1000000" = 50% of 1 CPU
        // "2000000 1000000" = 200% of 1 CPU = 2 CPUs
        let quota_us = resources.cpu_millis * 1000; // Convert to microseconds
        let period_us = 1_000_000; // 1 second in microseconds

        let cpu_max_value = format!("{} {}", quota_us, period_us);

        debug!(
            cpu_millis = resources.cpu_millis,
            quota_us = quota_us,
            period_us = period_us,
            "Setting CPU limit"
        );

        fs::write(&cpu_max_path, cpu_max_value)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to set CPU limit: {}", e),
            })?;

        Ok(())
    }

    /// Configure memory limits
    ///
    /// Uses memory.max for hard memory limiting.
    async fn configure_memory(&self, resources: &ResourceSpec) -> Result<(), DriverError> {
        let memory_max_path = self.cgroup_path.join("memory.max");

        // Convert memory from MiB to bytes
        let mem_bytes = resources.memory_mib as u64 * 1024 * 1024;

        debug!(
            memory_mib = resources.memory_mib,
            mem_bytes = mem_bytes,
            "Setting memory limit"
        );

        fs::write(&memory_max_path, mem_bytes.to_string())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to set memory limit: {}", e),
            })?;

        // Also set memory.high to allow some slack before hitting the hard limit
        // This helps prevent OOM kills during temporary spikes
        let memory_high_path = self.cgroup_path.join("memory.high");
        let high_bytes = mem_bytes.saturating_mul(110) / 100; // 10% headroom

        if let Err(e) = fs::write(&memory_high_path, high_bytes.to_string()).await {
            warn!(error = %e, "Failed to set memory.high (non-critical)");
        }

        Ok(())
    }

    /// Configure I/O limits
    ///
    /// Uses io.max for per-device throttling. Configures read/write bandwidth limits.
    async fn configure_io(&self, resources: &ResourceSpec) -> Result<(), DriverError> {
        let io_max_path = self.cgroup_path.join("io.max");

        // If network egress is specified, we can also limit IO bandwidth
        // For now, we set a reasonable default based on the VM's expected usage
        // Format: "major:minor rbps=.. wbps=.. riops=.. wiops=.."
        // Using 0 for unlimited IOPS, only limiting bandwidth if specified

        if let Some(network_egress_kib) = resources.network_egress_kib {
            // Apply a reasonable disk bandwidth limit relative to network
            // Typically disk I/O should be higher than network to not bottleneck
            let disk_limit_kib = network_egress_kib * 10; // 10x network bandwidth
            let rbps = disk_limit_kib * 1024; // bytes per second read
            let wbps = disk_limit_kib * 1024; // bytes per second write

            // Use "*" to apply to all block devices
            // Format: "rbps=N wbps=N" for all devices
            let io_limit = format!("rbps={} wbps={}", rbps, wbps);

            debug!(rbps = rbps, wbps = wbps, "Setting I/O limits");

            // Write in format: "* rbps=N wbps=N"
            let io_config = format!("* {}", io_limit);

            if let Err(e) = fs::write(&io_max_path, io_config).await {
                warn!(
                    error = %e,
                    "Failed to set I/O limits (controller may not be available)"
                );
            }
        }

        Ok(())
    }

    /// Configure process limits
    ///
    /// Uses pids.max to limit the number of processes in the cgroup.
    async fn configure_pids(&self, _resources: &ResourceSpec) -> Result<(), DriverError> {
        let pids_max_path = self.cgroup_path.join("pids.max");

        // Set a reasonable limit on processes per VM
        // Firecracker + guest OS + user workload
        // 1024 should be sufficient for most workloads
        let max_pids = 1024;

        debug!(max_pids = max_pids, "Setting PID limit");

        if let Err(e) = fs::write(&pids_max_path, max_pids.to_string()).await {
            warn!(
                error = %e,
                "Failed to set PID limit (controller may not be available)"
            );
        }

        Ok(())
    }

    /// Assign a process to this cgroup
    ///
    /// # Arguments
    /// * `pid` - Process ID to add to the cgroup
    pub async fn assign_pid(&self, pid: u32) -> Result<(), DriverError> {
        let procs_path = self.cgroup_path.join("cgroup.procs");

        info!(
            vm_id = %self.vm_id,
            pid = pid,
            "Assigning process to cgroup"
        );

        fs::write(&procs_path, pid.to_string())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to assign PID {} to cgroup: {}", pid, e),
            })?;

        Ok(())
    }

    /// Destroy the cgroup and release all resources
    pub async fn destroy_cgroup(&self) -> Result<(), DriverError> {
        info!(
            vm_id = %self.vm_id,
            cgroup_path = %self.cgroup_path.display(),
            "Destroying cgroup"
        );

        // Kill all processes in the cgroup first
        let procs_path = self.cgroup_path.join("cgroup.procs");
        if procs_path.exists() {
            match fs::read_to_string(&procs_path).await {
                Ok(content) => {
                    for line in content.lines() {
                        if let Ok(pid) = line.parse::<u32>() {
                            debug!(pid = pid, "Sending SIGKILL to remaining process");
                            let _ = nix::sys::signal::kill(
                                nix::unistd::Pid::from_raw(pid as i32),
                                nix::sys::signal::SIGKILL,
                            );
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Failed to read cgroup.procs");
                }
            }
        }

        // Remove the cgroup directory
        if self.cgroup_path.exists() {
            fs::remove_dir(&self.cgroup_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to remove cgroup directory: {}", e),
                })?;
        }

        info!(vm_id = %self.vm_id, "Cgroup destroyed successfully");
        Ok(())
    }

    /// Get current statistics for the cgroup
    pub async fn get_stats(&self) -> Result<CgroupStats, DriverError> {
        let mut stats = CgroupStats::default();

        // Read CPU stats
        if let Ok(cpu_stat) = self.read_cpu_stat().await {
            stats.cpu_usage_us = cpu_stat.usage_us;
        }

        // Read memory stats
        if let Ok(mem_stats) = self.read_memory_stat().await {
            stats.memory_usage_bytes = mem_stats.current_bytes;
            stats.memory_peak_bytes = mem_stats.peak_bytes;
        }

        // Read I/O stats
        if let Ok(io_stats) = self.read_io_stat().await {
            stats.io_read_bytes = io_stats.read_bytes;
            stats.io_write_bytes = io_stats.write_bytes;
        }

        Ok(stats)
    }

    /// Read CPU statistics from cpu.stat
    async fn read_cpu_stat(&self) -> Result<CpuStat, DriverError> {
        let cpu_stat_path = self.cgroup_path.join("cpu.stat");
        let content =
            fs::read_to_string(&cpu_stat_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to read cpu.stat: {}", e),
                })?;

        let mut usage_us = 0u64;

        for line in content.lines() {
            if let Some(value) = line.strip_prefix("usage_usec ") {
                usage_us = value.parse().unwrap_or(0);
            }
        }

        Ok(CpuStat { usage_us })
    }

    /// Read memory statistics
    async fn read_memory_stat(&self) -> Result<MemoryStat, DriverError> {
        let mut current_bytes = 0u64;
        let mut peak_bytes = 0u64;

        // Read current memory usage
        let current_path = self.cgroup_path.join("memory.current");
        if let Ok(content) = fs::read_to_string(&current_path).await {
            current_bytes = content.trim().parse().unwrap_or(0);
        }

        // Read peak memory usage (may not exist on all systems)
        let peak_path = self.cgroup_path.join("memory.peak");
        if let Ok(content) = fs::read_to_string(&peak_path).await {
            peak_bytes = content.trim().parse().unwrap_or(0);
        }

        Ok(MemoryStat {
            current_bytes,
            peak_bytes,
        })
    }

    /// Read I/O statistics from io.stat
    async fn read_io_stat(&self) -> Result<IoStat, DriverError> {
        let io_stat_path = self.cgroup_path.join("io.stat");
        let mut read_bytes = 0u64;
        let mut write_bytes = 0u64;

        if let Ok(content) = fs::read_to_string(&io_stat_path).await {
            for line in content.lines() {
                // Format: "major:minor rbytes=... wbytes=... rios=... wios=..."
                for part in line.split_whitespace().skip(1) {
                    if let Some(value) = part.strip_prefix("rbytes=") {
                        read_bytes += value.parse::<u64>().unwrap_or(0);
                    } else if let Some(value) = part.strip_prefix("wbytes=") {
                        write_bytes += value.parse::<u64>().unwrap_or(0);
                    }
                }
            }
        }

        Ok(IoStat {
            read_bytes,
            write_bytes,
        })
    }
}

/// Internal struct for CPU statistics
#[derive(Debug, Default)]
struct CpuStat {
    usage_us: u64,
}

/// Internal struct for memory statistics
#[derive(Debug, Default)]
struct MemoryStat {
    current_bytes: u64,
    peak_bytes: u64,
}

/// Internal struct for I/O statistics
#[derive(Debug, Default)]
struct IoStat {
    read_bytes: u64,
    write_bytes: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cgroup_manager_creation() {
        let base_path = PathBuf::from("/sys/fs/cgroup");
        let vm_id = ExecutionId::default();
        let manager = CgroupManager::new(base_path.clone(), vm_id);

        assert_eq!(manager.base_path, base_path);
        assert!(manager.cgroup_path.to_string_lossy().contains("a2r/vms"));
    }

    #[test]
    fn test_cgroup_path_construction() {
        let base_path = PathBuf::from("/sys/fs/cgroup");
        let vm_id = ExecutionId::default();
        let manager = CgroupManager::new(base_path, vm_id);

        let path_str = manager.cgroup_path.to_string_lossy();
        assert!(path_str.contains("a2r"));
        assert!(path_str.contains("vms"));
    }
}
