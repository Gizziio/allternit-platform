//! # A2R Firecracker Driver (N4 Implementation)
//!
//! Production-ready MicroVM-based execution driver using AWS Firecracker.
//! Provides hardware-level isolation for multi-tenant workloads with Jailer security.
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    FirecrackerDriver                        │
//! ├─────────────────────────────────────────────────────────────┤
//! │  VM Lifecycle          Network Layer        Guest Comm      │
//! │  ├─ create_vm()        ├─ setup_tap()      ├─ vsock_init   │
//! │  ├─ start_vm()         ├─ configure_nat   ├─ exec_command  │
//! │  ├─ pause_vm()         ├─ assign_ips      ├─ stream_logs   │
//! │  ├─ resume_vm()        ├─ setup_netns     └─ get_artifacts │
//! │  └─ destroy_vm()       └─ teardown_net                      │
//! │         ├─ stage_resources (chroot)                         │
//! │         └─ jailer spawn (namespaces, priv drop)             │
//! └─────────────────────────────────────────────────────────────┘
//! ```

use a2r_driver_interface::*;
use async_trait::async_trait;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::fmt;
use std::net::Ipv4Addr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::fs;
use tokio::net::UnixStream;
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, RwLock};
use tokio::time::sleep;
use tracing::{debug, error, info, info_span, warn, Instrument};

mod cgroups;
mod cleanup;
mod guest_health;
mod ipam;
mod metrics;
mod metrics_server;
mod netpolicy;
mod rootfs;
#[cfg(feature = "seccomp")]
mod seccomp;

pub use cgroups::{CgroupManager, CgroupStats};
pub use cleanup::{
    spawn_with_cleanup, spawn_with_cleanup_async, CleanupCoordinator, ResourceGuard, ResourceHandle,
};
pub use guest_health::{AgentHealth, AgentVersion, GuestAgentMonitor};
use ipam::IpamState;
use metrics::{DriverMetrics, Timer};
pub use metrics_server::{setup_metrics_server, MetricsServer};
use netpolicy::NetworkPolicyEnforcer;
use rootfs::RootfsBuilder;
#[cfg(feature = "seccomp")]
pub use seccomp::{apply_seccomp_filter, SeccompAction, SeccompProfile, SyscallCategory};

/// Firecracker configuration
#[derive(Debug, Clone)]
pub struct FirecrackerConfig {
    /// Path to firecracker binary
    pub firecracker_bin: PathBuf,
    /// Path to jailer binary (required for production security)
    pub jailer_bin: PathBuf,
    /// Base directory for chroot jails
    pub chroot_base_dir: PathBuf,
    /// UID to run Firecracker as (after privilege drop)
    pub uid: u32,
    /// GID to run Firecracker as (after privilege drop)
    pub gid: u32,
    /// Maximum open file descriptors
    pub max_open_fds: u32,
    /// Root directory for VM resources
    pub vm_root_dir: PathBuf,
    /// Kernel image path
    pub kernel_image: PathBuf,
    /// Network bridge interface
    pub bridge_iface: String,
    /// IP range for VMs (CIDR notation)
    pub vm_subnet: String,
    /// VSOCK port range start
    pub vsock_port_start: u32,
    /// Maximum VMs per tenant
    pub max_vms_per_tenant: u32,
    /// Base path for cgroups v2 (default: /sys/fs/cgroup)
    pub cgroup_base: PathBuf,
    /// Prometheus metrics server port (if None, metrics server is disabled)
    pub metrics_port: Option<u16>,
}

/// Firecracker configuration (CLI compatibility)
/// 
/// This is an alias struct that matches the CLI's expected field names
#[derive(Debug, Clone)]
pub struct FirecrackerConfigCompat {
    /// Path to firecracker binary
    pub firecracker_binary: String,
    /// Path to jailer binary (optional)
    pub jailer_binary: Option<String>,
    /// Runtime directory for VMs
    pub runtime_dir: String,
    /// Rootfs directory
    pub rootfs_dir: String,
    /// Kernel directory
    pub kernel_dir: String,
}

impl FirecrackerConfigCompat {
    /// Convert to internal FirecrackerConfig
    pub fn to_config(&self) -> FirecrackerConfig {
        FirecrackerConfig {
            firecracker_bin: self.firecracker_binary.clone().into(),
            jailer_bin: self.jailer_binary.clone().map(|s| s.into()).unwrap_or_else(|| "/usr/bin/jailer".into()),
            chroot_base_dir: std::path::PathBuf::from(&self.runtime_dir).join("jailer"),
            uid: 1000,
            gid: 1000,
            max_open_fds: 1024,
            vm_root_dir: self.runtime_dir.clone().into(),
            kernel_image: std::path::PathBuf::from(&self.kernel_dir).join("vmlinux"),
            bridge_iface: "fcbridge0".to_string(),
            vm_subnet: "172.16.0.0/24".to_string(),
            vsock_port_start: 10000,
            max_vms_per_tenant: 10,
            cgroup_base: std::path::PathBuf::from("/sys/fs/cgroup"),
            metrics_port: None,
        }
    }
}

impl Default for FirecrackerConfig {
    fn default() -> Self {
        Self {
            firecracker_bin: PathBuf::from("/usr/bin/firecracker"),
            jailer_bin: PathBuf::from("/usr/bin/jailer"),
            chroot_base_dir: PathBuf::from("/srv/jailer"),
            uid: 1000,
            gid: 1000,
            max_open_fds: 1024,
            vm_root_dir: PathBuf::from("/var/lib/a2r/firecracker-vms"),
            kernel_image: PathBuf::from("/var/lib/a2r/vmlinux"),
            bridge_iface: "fcbridge0".to_string(),
            vm_subnet: "172.16.0.0/24".to_string(),
            vsock_port_start: 10000,
            max_vms_per_tenant: 10,
            cgroup_base: PathBuf::from("/sys/fs/cgroup"),
            metrics_port: None,
        }
    }
}

/// Complete MicroVM state
pub struct MicroVM {
    /// Execution ID
    id: ExecutionId,
    /// Tenant ID
    tenant: TenantId,
    /// Firecracker process handle
    process: Option<Child>,
    /// API socket path
    api_socket: PathBuf,
    /// VSOCK port for guest communication
    vsock_port: u32,
    /// TAP device name
    tap_device: String,
    /// VM IP address
    vm_ip: Ipv4Addr,
    /// MAC address
    mac_addr: String,
    /// Status
    status: VmStatus,
    /// VM configuration
    vm_config: VmConfig,
    /// HTTP client for API calls
    _client: Client,
    /// Resource tracking
    resources: ResourceTracker,
    /// Policy spec for this execution
    policy: PolicySpec,
    /// Inputs hash (if provided in envelope)
    inputs_hash: Option<String>,
    /// Network namespace name
    netns_name: Option<String>,
    /// Chroot directory path
    chroot_dir: Option<PathBuf>,
    /// Determinism envelope for reproducible execution
    envelope: Option<a2r_driver_interface::DeterminismEnvelope>,
    /// Cgroup manager for resource enforcement
    cgroup_manager: Option<CgroupManager>,
    /// Health monitor for guest agent
    health_monitor: Option<GuestAgentMonitor>,
    /// Background monitor task handle
    monitor_task: Option<tokio::task::JoinHandle<()>>,
}

/// VM status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VmStatus {
    Creating,
    Configuring,
    Running,
    Paused,
    Stopped,
    Destroyed,
    Failed,
}

/// VM-specific configuration
#[derive(Debug, Clone)]
pub struct VmConfig {
    /// Number of vCPUs
    vcpu_count: u32,
    /// Memory in MiB
    memory_mib: u32,
    /// Disk size in MiB
    disk_mib: u32,
    /// Network policy
    network_policy: NetworkPolicy,
    /// Environment spec
    env_spec: EnvironmentSpec,
    /// Network egress limit in KiB
    network_egress_kib: Option<u64>,
}

/// Resource tracker for billing/quotas
pub struct ResourceTracker {
    start_time: std::time::Instant,
    cpu_ms: AtomicU32,
    memory_peak_mib: AtomicU32,
    network_egress_kib: AtomicU64,
}

/// Firecracker-based execution driver
pub struct FirecrackerDriver {
    /// Active VMs keyed by execution ID
    vms: RwLock<HashMap<ExecutionId, Arc<Mutex<MicroVM>>>>,
    /// Driver configuration
    _config: DriverConfig,
    /// Firecracker-specific config
    fc_config: FirecrackerConfig,
    /// VSOCK port allocator
    next_vsock_port: AtomicU32,
    /// IP allocator (persistent)
    ipam: Arc<Mutex<IpamState>>,
    /// Rootfs builder
    rootfs_builder: RootfsBuilder,
    /// Metrics render function (if metrics server is enabled)
    metrics_render: Option<Arc<dyn Fn() -> String + Send + Sync>>,
}

impl Default for FirecrackerDriver {
    fn default() -> Self {
        Self::new()
    }
}

impl FirecrackerDriver {
    pub fn new() -> Self {
        Self::with_config(FirecrackerConfig::default())
    }

    /// Create a new driver with metrics enabled on the specified port
    pub fn with_metrics(port: u16) -> Self {
        let mut config = FirecrackerConfig::default();
        config.metrics_port = Some(port);
        Self::with_config(config)
    }

    /// Get Prometheus-formatted metrics
    ///
    /// Returns the current metrics in Prometheus format if the metrics server
    /// is enabled. If metrics are disabled, returns an informational message.
    pub fn metrics_endpoint(&self) -> String {
        if let Some(ref render) = self.metrics_render {
            render()
        } else if self.fc_config.metrics_port.is_some() {
            "# Metrics server enabled but recorder not initialized\n".to_string()
        } else {
            "# Prometheus metrics disabled - set metrics_port in FirecrackerConfig to enable\n"
                .to_string()
        }
    }

    pub fn with_config(fc_config: FirecrackerConfig) -> Self {
        let cache_dir = fc_config.vm_root_dir.join("cache");
        let rootfs_builder = RootfsBuilder::new(cache_dir);

        // Initialize IPAM with persistence path
        let ipam_path = fc_config.vm_root_dir.join("ipam-state.json");
        let ipam = Arc::new(Mutex::new(IpamState::load_or_create_sync(
            &fc_config.vm_subnet,
            ipam_path,
        )));

        // Start metrics server if port is configured
        let metrics_render: Option<Arc<dyn Fn() -> String + Send + Sync>> = if let Some(port) =
            fc_config.metrics_port
        {
            match metrics::install_prometheus_recorder() {
                Ok(render_fn) => {
                    // Clone for the server (wrap in closure)
                    let server_render = render_fn.clone();
                    let server = metrics_server::MetricsServer::new(port, move || server_render());
                    server.start();
                    Some(render_fn)
                }
                Err(e) => {
                    tracing::error!(error = %e, "Failed to install Prometheus recorder");
                    None
                }
            }
        } else {
            None
        };

        Self {
            vms: RwLock::new(HashMap::new()),
            _config: DriverConfig {
                driver_type: DriverType::MicroVM,
                default_resources: ResourceSpec::standard(),
                env_vars: HashMap::new(),
                default_mounts: vec![],
                network_policy: NetworkPolicy::default(),
                default_timeout_seconds: 300,
                enable_prewarm: true,
            },
            fc_config,
            next_vsock_port: AtomicU32::new(10000),
            ipam,
            rootfs_builder,
            metrics_render,
        }
    }

    /// Allocate a new VSOCK port
    fn allocate_vsock_port(&self) -> u32 {
        self.next_vsock_port.fetch_add(1, Ordering::SeqCst)
    }

    /// Allocate an IP address using IPAM
    async fn allocate_ip(&self, vm_id: ExecutionId) -> Result<Ipv4Addr, DriverError> {
        self.ipam.lock().await.allocate(vm_id).await
    }

    /// Generate a unique MAC address based on VM ID
    fn generate_mac(&self, id: &ExecutionId) -> String {
        // Use UUID bytes to generate unique MAC
        let bytes = id.0.as_bytes();
        // Locally administered MAC (02:FC prefix for Firecracker)
        format!(
            "02:FC:{:02X}:{:02X}:{:02X}:{:02X}",
            bytes[0], bytes[1], bytes[2], bytes[3]
        )
    }

    /// Get gateway IP from IPAM
    fn get_gateway_ip(&self) -> Result<String, DriverError> {
        // Use a synchronous lock since we're not in async context here
        // and IpamState::gateway() is a sync method
        let ipam = self.ipam.try_lock();
        match ipam {
            Ok(guard) => Ok(guard.gateway().to_string()),
            Err(_) => {
                // Fallback to computing from subnet config if IPAM is locked
                let cidr = &self.fc_config.vm_subnet;
                let parts: Vec<&str> = cidr.split('/').collect();
                if parts.len() != 2 {
                    return Err(DriverError::InvalidInput {
                        field: "vm_subnet".to_string(),
                        reason: format!("Invalid CIDR format: {}", cidr),
                    });
                }
                let base_ip: Ipv4Addr =
                    parts[0].parse().map_err(|_| DriverError::InvalidInput {
                        field: "vm_subnet".to_string(),
                        reason: "Invalid IP address in CIDR".to_string(),
                    })?;
                let octets = base_ip.octets();
                Ok(Ipv4Addr::new(octets[0], octets[1], octets[2], 1).to_string())
            }
        }
    }

    /// Create VM rootfs from environment spec
    ///
    /// In deterministic mode, uses the envelope seed to compute a base timestamp
    /// for filesystem normalization, ensuring reproducible rootfs hashes.
    async fn create_rootfs(&self, vm: &MicroVM, image_ref: &str) -> Result<PathBuf, DriverError> {
        // Get base time from envelope for deterministic timestamp normalization
        let base_time = vm.envelope.as_ref().map(|e| {
            // Use Unix epoch + seed as deterministic timestamp
            std::time::UNIX_EPOCH + std::time::Duration::from_secs(e.seed.unwrap_or(0))
        });

        self.rootfs_builder
            .create_rootfs(vm, image_ref, &self.fc_config.vm_root_dir, base_time)
            .await
    }

    /// Setup network namespace for VM isolation
    #[tracing::instrument(
        skip(self),
        fields(
            vm_id = %vm_id,
            stage = "setup_netns"
        )
    )]
    async fn setup_netns(&self, vm_id: &ExecutionId) -> Result<String, DriverError> {
        let ns_name = format!("a2r-{}", vm_id);

        info!(
            event = "netns.create.start",
            vm_id = %vm_id,
            ns_name = %ns_name,
            "Creating network namespace"
        );

        // Create network namespace
        let output = Command::new("ip")
            .args(["netns", "add", &ns_name])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create network namespace: {}", e),
            })?;

        if !output.status.success() {
            tracing::error!(
                error = %String::from_utf8_lossy(&output.stderr),
                error_type = "netns_create_failed",
                stage = "setup_netns",
                vm_id = %vm_id,
                "Failed to create network namespace"
            );
            return Err(DriverError::InternalError {
                message: format!(
                    "ip netns add failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Bring up loopback interface in namespace
        let output = Command::new("ip")
            .args(["netns", "exec", &ns_name, "ip", "link", "set", "lo", "up"])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to bring up loopback in netns: {}", e),
            })?;

        if !output.status.success() {
            // Clean up the namespace on failure
            let _ = Command::new("ip")
                .args(["netns", "delete", &ns_name])
                .output()
                .await;

            tracing::error!(
                error = %String::from_utf8_lossy(&output.stderr),
                error_type = "netns_loopback_failed",
                stage = "setup_netns",
                vm_id = %vm_id,
                "Failed to configure loopback in netns"
            );

            return Err(DriverError::InternalError {
                message: format!(
                    "Failed to configure loopback in netns: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        info!(
            event = "netns.create.complete",
            vm_id = %vm_id,
            ns_name = %ns_name,
            "Network namespace created successfully"
        );

        Ok(ns_name)
    }

    /// Teardown network namespace
    #[tracing::instrument(
        skip(self),
        fields(
            ns_name = %ns_name,
            stage = "teardown_netns"
        )
    )]
    async fn teardown_netns(&self, ns_name: &str) -> Result<(), DriverError> {
        info!(
            event = "netns.delete.start",
            ns_name = %ns_name,
            "Deleting network namespace"
        );

        let output = Command::new("ip")
            .args(["netns", "delete", ns_name])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to delete network namespace: {}", e),
            })?;

        if !output.status.success() {
            warn!(
                event = "netns.delete.warning",
                error = %String::from_utf8_lossy(&output.stderr),
                ns_name = %ns_name,
                "Failed to delete network namespace"
            );
        } else {
            info!(
                event = "netns.delete.complete",
                ns_name = %ns_name,
                "Network namespace deleted successfully"
            );
        }

        Ok(())
    }

    /// Stage resources into chroot directory for jailer
    #[tracing::instrument(
        skip(self, vm, rootfs_path),
        fields(
            vm_id = %vm.id,
            stage = "stage_resources"
        )
    )]
    async fn stage_resources(
        &self,
        vm: &MicroVM,
        rootfs_path: &Path,
    ) -> Result<PathBuf, DriverError> {
        let vm_id = vm.id.to_string();

        // Create chroot directory structure: {chroot_base}/{vm_id}/root/
        let chroot_dir = self.fc_config.chroot_base_dir.join(&vm_id).join("root");
        let kernel_dir = chroot_dir.join("kernel");
        let rootfs_dir = chroot_dir.join("rootfs");
        let dev_dir = chroot_dir.join("dev");

        info!(
            event = "resources.stage.start",
            vm_id = %vm.id,
            chroot_dir = %chroot_dir.display(),
            "Staging resources in chroot"
        );

        // Create directories
        fs::create_dir_all(&kernel_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create kernel directory: {}", e),
            })?;

        fs::create_dir_all(&rootfs_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs directory: {}", e),
            })?;

        fs::create_dir_all(&dev_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create dev directory: {}", e),
            })?;

        // Copy kernel image into chroot
        let kernel_filename =
            self.fc_config
                .kernel_image
                .file_name()
                .ok_or_else(|| DriverError::InternalError {
                    message: "Invalid kernel image path".to_string(),
                })?;
        let kernel_dest = kernel_dir.join(kernel_filename);

        fs::copy(&self.fc_config.kernel_image, &kernel_dest)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to copy kernel image: {}", e),
            })?;

        // Bind mount rootfs (read-only for security)
        // First, create the mount point
        let rootfs_filename =
            rootfs_path
                .file_name()
                .ok_or_else(|| DriverError::InternalError {
                    message: "Invalid rootfs path".to_string(),
                })?;
        let rootfs_mount_point = rootfs_dir.join(rootfs_filename);

        // Create an empty file to use as mount point
        fs::write(&rootfs_mount_point, b"")
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs mount point: {}", e),
            })?;

        // Perform bind mount (read-only)
        let output = Command::new("mount")
            .args([
                "--bind",
                rootfs_path.to_str().unwrap(),
                rootfs_mount_point.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to bind mount rootfs: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "Bind mount failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Remount as read-only
        let output = Command::new("mount")
            .args([
                "-o",
                "remount,ro,bind",
                rootfs_mount_point.to_str().unwrap(),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to remount rootfs as read-only: {}", e),
            })?;

        if !output.status.success() {
            // Try to unmount on failure
            let _ = Command::new("umount")
                .arg(rootfs_mount_point.to_str().unwrap())
                .output()
                .await;

            return Err(DriverError::InternalError {
                message: format!(
                    "Remount as read-only failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Create minimal device nodes needed by Firecracker
        // Note: In production, these should be created with proper permissions
        // or use devtmpfs. For now, we rely on the jailer's device setup.

        info!(
            event = "resources.stage.complete",
            vm_id = %vm.id,
            chroot_dir = %chroot_dir.display(),
            "Resources staged successfully"
        );

        // Return the path relative to chroot for Firecracker config
        // The kernel path inside the chroot
        Ok(PathBuf::from("kernel").join(kernel_filename))
    }

    /// Cleanup staged resources from chroot
    #[tracing::instrument(
        skip(self, chroot_dir),
        fields(
            chroot_dir = %chroot_dir.display(),
            stage = "cleanup_staged_resources"
        )
    )]
    async fn cleanup_staged_resources(&self, chroot_dir: &Path) -> Result<(), DriverError> {
        info!(
            event = "resources.cleanup.start",
            chroot_dir = %chroot_dir.display(),
            "Cleaning up staged resources"
        );

        // Unmount any bind mounts
        let rootfs_dir = chroot_dir.join("rootfs");
        if rootfs_dir.exists() {
            // Find and unmount all bind mounts
            let output = Command::new("find")
                .args([rootfs_dir.to_str().unwrap(), "-type", "f"])
                .output()
                .await;

            if let Ok(output) = output {
                let files = String::from_utf8_lossy(&output.stdout);
                for file in files.lines() {
                    let _ = Command::new("umount").arg(file).output().await;
                }
            }
        }

        // Remove chroot directory
        if chroot_dir.exists() {
            let _ = fs::remove_dir_all(chroot_dir).await;
        }

        info!(
            event = "resources.cleanup.complete",
            chroot_dir = %chroot_dir.display(),
            "Staged resources cleaned up"
        );
        Ok(())
    }

    /// Setup TAP device for VM networking
    #[tracing::instrument(
        skip(self, vm),
        fields(
            vm_id = %vm.id,
            tap_device = %vm.tap_device,
            netns_name = %netns_name,
            stage = "setup_tap_device"
        )
    )]
    async fn setup_tap_device(&self, vm: &MicroVM, netns_name: &str) -> Result<(), DriverError> {
        let tap_name = format!("tap-{:08x}", vm.id.0.as_u128() as u32);

        info!(
            event = "tap.setup.start",
            vm_id = %vm.id,
            tap = %tap_name,
            ns_name = %netns_name,
            "Setting up TAP device in netns"
        );

        // Create TAP device inside the network namespace
        let output = Command::new("ip")
            .args([
                "netns", "exec", netns_name, "ip", "tuntap", "add", &tap_name, "mode", "tap",
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create TAP device: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "ip tuntap failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Bring up TAP device in namespace
        let output = Command::new("ip")
            .args([
                "netns", "exec", netns_name, "ip", "link", "set", &tap_name, "up",
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to bring up TAP device: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "ip link set up failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Configure IP on TAP device in namespace
        let output = Command::new("ip")
            .args([
                "netns",
                "exec",
                netns_name,
                "ip",
                "addr",
                "add",
                &format!("{}/24", vm.vm_ip),
                "dev",
                &tap_name,
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to configure TAP IP: {}", e),
            })?;

        if !output.status.success() {
            warn!(
                "Failed to configure TAP IP: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        // Set up NAT/forwarding from namespace to host bridge
        // Enable IP forwarding in namespace
        let output = Command::new("ip")
            .args([
                "netns",
                "exec",
                netns_name,
                "sysctl",
                "-w",
                "net.ipv4.ip_forward=1",
            ])
            .output()
            .await;

        if let Err(e) = output {
            warn!("Failed to enable IP forwarding in netns: {}", e);
        }

        // Apply network policy enforcement
        let enforcer = if let Some(kib) = vm.vm_config.network_egress_kib {
            NetworkPolicyEnforcer::with_rate_limit(
                tap_name.clone(),
                vm.vm_config.network_policy.clone(),
                kib * 8, // Convert KiB to kbps
            )
        } else {
            NetworkPolicyEnforcer::new(tap_name.clone(), vm.vm_config.network_policy.clone())
        };

        if let Err(e) = enforcer.apply().await {
            warn!(error = %e, "Failed to apply network policy, continuing without enforcement");
            // Don't fail VM spawn due to policy enforcement issues
        }

        Ok(())
    }

    /// Teardown TAP device
    #[tracing::instrument(
        skip(self, policy),
        fields(
            tap_name = %tap_name,
            netns_name = %netns_name,
            stage = "teardown_tap_device"
        )
    )]
    async fn teardown_tap_device(
        &self,
        tap_name: &str,
        netns_name: &str,
        policy: &NetworkPolicy,
    ) -> Result<(), DriverError> {
        // Remove network policy enforcement
        let enforcer = NetworkPolicyEnforcer::new(tap_name.to_string(), policy.clone());
        if let Err(e) = enforcer.remove().await {
            warn!(error = %e, tap = %tap_name, "Failed to remove network policy rules");
            // Continue with cleanup even if policy removal fails
        }

        // TAP device is automatically removed when network namespace is deleted
        info!(
            event = "tap.teardown.complete",
            ns_name = %netns_name,
            tap = %tap_name,
            "TAP device will be cleaned up with netns"
        );
        Ok(())
    }

    /// Start Firecracker process via Jailer
    #[tracing::instrument(
        skip(self, vm),
        fields(
            vm_id = %vm.id,
            netns_name = %ns_name,
            stage = "start_firecracker"
        )
    )]
    /// Start Firecracker process via Jailer
    ///
    /// Returns the PID of the jailer process for cgroup assignment
    async fn start_firecracker_process(
        &self,
        vm: &mut MicroVM,
        ns_name: &str,
    ) -> Result<u32, DriverError> {
        let vm_id_str = vm.id.to_string();

        // API socket will be created by jailer inside the chroot
        // The jailer places it at: {chroot_base}/{vm_id}/root/run/firecracker.socket
        let api_socket_relative = PathBuf::from("run/firecracker.socket");
        let api_socket_chroot = self
            .fc_config
            .chroot_base_dir
            .join(&vm_id_str)
            .join("root")
            .join(&api_socket_relative);

        // Remove existing socket if present (from previous runs)
        let _ = fs::remove_file(&api_socket_chroot).await;

        info!(
            event = "firecracker.start.start",
            vm_id = %vm.id,
            jailer = %self.fc_config.jailer_bin.display(),
            exec_file = %self.fc_config.firecracker_bin.display(),
            "Starting Firecracker via Jailer"
        );

        // Build jailer command
        let mut cmd = Command::new(&self.fc_config.jailer_bin);
        cmd.arg("--id")
            .arg(&vm_id_str)
            .arg("--exec-file")
            .arg(&self.fc_config.firecracker_bin)
            .arg("--uid")
            .arg(self.fc_config.uid.to_string())
            .arg("--gid")
            .arg(self.fc_config.gid.to_string())
            .arg("--chroot-base-dir")
            .arg(&self.fc_config.chroot_base_dir)
            .arg("--netns")
            .arg(format!("/var/run/netns/{}", ns_name))
            .arg("--daemonize");

        // Add resource limits
        cmd.arg("--resource-limit")
            .arg(format!("nofile={}", self.fc_config.max_open_fds));

        // Set up stdout/stderr redirection
        let log_file = self
            .fc_config
            .vm_root_dir
            .join(&vm_id_str)
            .join("firecracker.log");
        let log_file_std =
            std::fs::File::create(&log_file).map_err(|e| DriverError::InternalError {
                message: format!("Failed to create log file: {}", e),
            })?;

        cmd.stdout(Stdio::from(log_file_std.try_clone().map_err(|e| {
            DriverError::InternalError {
                message: format!("Failed to clone log file handle: {}", e),
            }
        })?))
        .stderr(Stdio::from(log_file_std));

        // Spawn the jailer process
        let mut child = cmd.spawn().map_err(|e| DriverError::SpawnFailed {
            reason: format!("Failed to start jailer: {}", e),
        })?;

        // Get the PID before storing the child
        let jailer_pid = child.id().ok_or_else(|| DriverError::SpawnFailed {
            reason: "Failed to get jailer PID".to_string(),
        })?;

        vm.process = Some(child);

        // Wait for API socket to be ready (jailer creates it after daemonizing)
        let mut attempts = 0;
        while attempts < 100 {
            if api_socket_chroot.exists() {
                break;
            }
            sleep(Duration::from_millis(100)).await;
            attempts += 1;
        }

        if !api_socket_chroot.exists() {
            return Err(DriverError::SpawnFailed {
                reason: "Jailer API socket did not appear".to_string(),
            });
        }

        // Update VM's API socket to point to the chroot location
        vm.api_socket = api_socket_chroot;

        info!(
            event = "firecracker.start.complete",
            vm_id = %vm.id,
            pid = jailer_pid,
            socket = %vm.api_socket.display(),
            "Firecracker started via Jailer"
        );

        Ok(jailer_pid)
    }

    /// Configure VM via Firecracker API
    ///
    /// ## Determinism Features (Phase 2)
    ///
    /// When a determinism envelope is provided:
    /// - Sets kernel boot parameters for reproducible execution
    /// - Injects random seed via `random.seed` kernel parameter
    /// - Uses TSC clocksource for consistent timekeeping
    ///
    /// **Note on Time Freezing**: Full RTC time freezing requires guest agent
    /// support (not yet implemented). The kernel boot args use TSC as clocksource
    /// which provides more consistent time than the default, but wall clock will
    /// still reflect host time at boot.
    #[tracing::instrument(
        skip(self, vm, rootfs_path),
        fields(
            vm_id = %vm.id,
            rootfs = %rootfs_path.display(),
            stage = "configure_vm"
        )
    )]
    async fn configure_vm(&self, vm: &MicroVM, rootfs_path: &Path) -> Result<(), DriverError> {
        let _api_url = "http://localhost/".to_string();

        // Configure machine
        let machine_config = json!({
            "vcpu_count": vm.vm_config.vcpu_count,
            "mem_size_mib": vm.vm_config.memory_mib,
            "ht_enabled": false,
            "track_dirty_pages": false,
        });

        self.api_put(vm, "machine-config", &machine_config).await?;

        // Configure boot source (kernel) - path is relative to chroot
        let gateway_ip = self.get_gateway_ip()?;

        // Kernel path inside chroot (relative to chroot root)
        let kernel_in_chroot = PathBuf::from("/kernel")
            .join(self.fc_config.kernel_image.file_name().unwrap_or_default())
            .to_string_lossy()
            .to_string();

        // Build boot args with determinism support
        let boot_args = if let Some(envelope) = &vm.envelope {
            // Deterministic mode: Use TSC clocksource and inject random seed
            let mut args = format!(
                "console=ttyS0 reboot=k panic=1 pci=off \
                 ip={}::{}:255.255.255.0::eth0:off \
                 clocksource=tsc tsc=reliable \
                 init_on_alloc=1 init_on_free=1",
                vm.vm_ip, gateway_ip
            );

            // Inject random seed if provided
            if let Some(seed) = envelope.seed {
                args.push_str(&format!(" random.trust_cpu=off random.seed={:016x}", seed));
                debug!(seed = %format!("{:016x}", seed), "Injected deterministic random seed");
            }

            // Note: Full time freezing would require guest agent to:
            // 1. Set RTC to a fixed value after boot
            // 2. Intercept gettimeofday() calls via vDSO modification
            // This is documented for future implementation.
            if envelope.time_frozen {
                debug!("Time freeze requested - using TSC clocksource (full freeze requires guest agent)");
            }

            args
        } else {
            // Normal mode: Standard boot args with wall clock
            format!(
                "console=ttyS0 reboot=k panic=1 pci=off ip={}::{}:255.255.255.0::eth0:off",
                vm.vm_ip, gateway_ip
            )
        };

        let boot_source = json!({
            "kernel_image_path": kernel_in_chroot,
            "boot_args": boot_args,
        });

        self.api_put(vm, "boot-source", &boot_source).await?;

        // Configure root drive - path is relative to chroot
        let rootfs_in_chroot = PathBuf::from("/rootfs")
            .join(rootfs_path.file_name().unwrap_or_default())
            .to_string_lossy()
            .to_string();

        let root_drive = json!({
            "drive_id": "rootfs",
            "path_on_host": rootfs_in_chroot,
            "is_root_device": true,
            "is_read_only": true,  // Read-only for security
        });

        self.api_put(vm, "drives/rootfs", &root_drive).await?;

        // Configure network interface
        let network_interface = json!({
            "iface_id": "eth0",
            "guest_mac": vm.mac_addr,
            "host_dev_name": vm.tap_device,
        });

        self.api_put(vm, "network-interfaces/eth0", &network_interface)
            .await?;

        // Configure VSOCK for guest communication
        // VSOCK socket path inside chroot
        let vsock_in_chroot = format!("/run/vsock-{}.sock", vm.id);

        let vsock_config = json!({
            "guest_cid": 3,
            "uds_path": vsock_in_chroot,
        });

        self.api_put(vm, "vsock", &vsock_config).await?;

        info!(
            event = "vm.config.complete",
            vm_id = %vm.id,
            vcpus = vm.vm_config.vcpu_count,
            memory_mib = vm.vm_config.memory_mib,
            "VM configured successfully"
        );

        Ok(())
    }

    /// Make API PUT request to Firecracker
    async fn api_put(
        &self,
        vm: &MicroVM,
        path: &str,
        body: &serde_json::Value,
    ) -> Result<(), DriverError> {
        // Use Unix socket directly
        let socket_path = vm.api_socket.clone();

        // Build HTTP request manually over Unix socket
        let request_body = body.to_string();
        let request = format!(
            "PUT /{} HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            path,
            request_body.len(),
            request_body
        );

        let mut stream =
            UnixStream::connect(&socket_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to connect to Firecracker API: {}", e),
                })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, request.as_bytes())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write to Firecracker API: {}", e),
            })?;

        // Read response
        let mut response = vec![0u8; 4096];
        let n = tokio::io::AsyncReadExt::read(&mut stream, &mut response)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read from Firecracker API: {}", e),
            })?;

        let response_str = String::from_utf8_lossy(&response[..n]);

        if !response_str.contains("HTTP/1.1 204") && !response_str.contains("HTTP/1.1 200") {
            return Err(DriverError::InternalError {
                message: format!("Firecracker API error: {}", response_str),
            });
        }

        Ok(())
    }

    /// Start the VM
    #[tracing::instrument(
        skip(self, vm),
        fields(
            vm_id = %vm.id,
            stage = "start_vm"
        )
    )]
    async fn start_vm(&self, vm: &MicroVM) -> Result<(), DriverError> {
        info!(
            event = "vm.start.start",
            vm_id = %vm.id,
            "Starting VM instance"
        );

        self.api_put(vm, "actions", &json!({"action_type": "InstanceStart"}))
            .await?;

        info!(
            event = "vm.start.complete",
            vm_id = %vm.id,
            tap_device = %vm.tap_device,
            vm_ip = %vm.vm_ip,
            "VM started successfully"
        );

        // Wait for VM to be ready (guest agent)
        sleep(Duration::from_secs(2)).await;

        Ok(())
    }

    /// Execute command in VM via VSOCK guest agent
    #[tracing::instrument(
        skip(self, vm, cmd),
        fields(
            vm_id = %vm.id,
            command = ?cmd.command,
            stage = "exec_in_vm"
        )
    )]
    async fn exec_in_vm(&self, vm: &MicroVM, cmd: &CommandSpec) -> Result<ExecResult, DriverError> {
        // Connect to VSOCK socket (path relative to host, outside chroot)
        // The jailer's vsock is accessible from the host
        let vsock_path = format!("/tmp/vsock-{}.sock", vm.id);

        // Build guest agent request
        let request = GuestAgentRequest::Execute {
            command: cmd.command.clone(),
            env_vars: cmd.env_vars.clone(),
            working_dir: cmd.working_dir.clone(),
            stdin_data: cmd.stdin_data.clone(),
        };

        // Connect and send request
        let mut stream =
            UnixStream::connect(&vsock_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to connect to guest agent: {}", e),
                })?;

        let request_json =
            serde_json::to_vec(&request).map_err(|e| DriverError::InternalError {
                message: format!("Failed to serialize request: {}", e),
            })?;

        // Send length-prefixed message
        let len = request_json.len() as u32;
        let len_bytes = len.to_be_bytes();

        tokio::io::AsyncWriteExt::write_all(&mut stream, &len_bytes)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write length: {}", e),
            })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, &request_json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write request: {}", e),
            })?;

        // Read response
        let mut len_buf = [0u8; 4];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut len_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read response length: {}", e),
            })?;

        let response_len = u32::from_be_bytes(len_buf) as usize;
        let mut response_buf = vec![0u8; response_len];

        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut response_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read response: {}", e),
            })?;

        let response: GuestAgentResponse =
            serde_json::from_slice(&response_buf).map_err(|e| DriverError::InternalError {
                message: format!("Failed to parse response: {}", e),
            })?;

        match response {
            GuestAgentResponse::ExecuteResult {
                exit_code,
                stdout,
                stderr,
                duration_ms,
            } => {
                Ok(ExecResult {
                    exit_code,
                    stdout,
                    stderr,
                    duration_ms,
                    resource_usage: ResourceConsumption::default(), // TODO: Get from guest
                })
            }
            GuestAgentResponse::Error { message } => Err(DriverError::InternalError { message }),
            _ => Err(DriverError::InternalError {
                message: "Unexpected response type".to_string(),
            }),
        }
    }

    /// Pause VM
    #[tracing::instrument(skip(self, vm), fields(vm_id = %vm.id))]
    async fn pause_vm(&self, vm: &MicroVM) -> Result<(), DriverError> {
        info!(event = "vm.pause.start", vm_id = %vm.id, "Pausing VM");
        self.api_put(vm, "actions", &json!({"action_type": "PauseVm"}))
            .await?;
        info!(event = "vm.pause.complete", vm_id = %vm.id, "VM paused");
        Ok(())
    }

    /// Resume VM
    #[tracing::instrument(skip(self, vm), fields(vm_id = %vm.id))]
    async fn resume_vm(&self, vm: &MicroVM) -> Result<(), DriverError> {
        info!(event = "vm.resume.start", vm_id = %vm.id, "Resuming VM");
        self.api_put(vm, "actions", &json!({"action_type": "ResumeVm"}))
            .await?;
        info!(event = "vm.resume.complete", vm_id = %vm.id, "VM resumed");
        Ok(())
    }

    /// Stop VM gracefully
    #[tracing::instrument(skip(self, vm), fields(vm_id = %vm.id))]
    async fn stop_vm(&self, vm: &MicroVM) -> Result<(), DriverError> {
        info!(event = "vm.stop.start", vm_id = %vm.id, "Stopping VM gracefully");
        self.api_put(vm, "actions", &json!({"action_type": "SendCtrlAltDel"}))
            .await?;

        // Wait for VM to stop
        sleep(Duration::from_secs(5)).await;

        Ok(())
    }
}

/// Guest agent request types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum GuestAgentRequest {
    #[serde(rename = "execute")]
    Execute {
        command: Vec<String>,
        env_vars: HashMap<String, String>,
        working_dir: Option<String>,
        stdin_data: Option<Vec<u8>>,
    },
    #[serde(rename = "get_logs")]
    GetLogs {
        since: Option<chrono::DateTime<chrono::Utc>>,
    },
    #[serde(rename = "get_artifacts")]
    GetArtifacts { paths: Vec<String> },
    #[serde(rename = "get_metrics")]
    GetMetrics,
    /// Ping for health check
    #[serde(rename = "ping")]
    Ping { version: String },
}

/// Guest agent response types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum GuestAgentResponse {
    #[serde(rename = "execute_result")]
    ExecuteResult {
        exit_code: i32,
        stdout: Option<Vec<u8>>,
        stderr: Option<Vec<u8>>,
        duration_ms: u64,
    },
    #[serde(rename = "logs")]
    Logs { entries: Vec<LogEntry> },
    #[serde(rename = "artifacts")]
    Artifacts { artifacts: Vec<Artifact> },
    #[serde(rename = "metrics")]
    Metrics {
        cpu_usage_percent: f64,
        memory_used_mib: u64,
        disk_used_mib: u64,
    },
    #[serde(rename = "error")]
    Error { message: String },
    /// Pong response to ping
    #[serde(rename = "pong")]
    Pong { version: String, uptime_secs: u64 },
}

impl ResourceTracker {
    fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            cpu_ms: AtomicU32::new(0),
            memory_peak_mib: AtomicU32::new(0),
            network_egress_kib: AtomicU64::new(0),
        }
    }

    fn to_consumption(&self) -> ResourceConsumption {
        ResourceConsumption {
            cpu_millis_used: self.cpu_ms.load(Ordering::Relaxed) as u64,
            memory_mib_peak: self.memory_peak_mib.load(Ordering::Relaxed),
            disk_mib_used: 0,
            network_egress_kib: self.network_egress_kib.load(Ordering::Relaxed),
        }
    }
}

impl fmt::Debug for FirecrackerDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FirecrackerDriver")
            .field("driver_type", &"MicroVM")
            .field("isolation", &"Maximum (with Jailer)")
            .field("firecracker_bin", &self.fc_config.firecracker_bin)
            .field("jailer_bin", &self.fc_config.jailer_bin)
            .field("chroot_base_dir", &self.fc_config.chroot_base_dir)
            .field("uid", &self.fc_config.uid)
            .field("gid", &self.fc_config.gid)
            .field("vm_root_dir", &self.fc_config.vm_root_dir)
            .finish()
    }
}

#[async_trait]
impl ExecutionDriver for FirecrackerDriver {
    fn capabilities(&self) -> DriverCapabilities {
        DriverCapabilities {
            driver_type: DriverType::MicroVM,
            isolation: IsolationLevel::Maximum,
            max_resources: ResourceSpec {
                cpu_millis: 16000,
                memory_mib: 65536,
                disk_mib: Some(500000),
                network_egress_kib: Some(104857600),
                gpu_count: None,
            },
            supported_env_specs: vec![EnvSpecType::Oci, EnvSpecType::Nix],
            features: DriverFeatures {
                snapshot: true,
                live_restore: false,
                gpu: false,
                prewarm: true,
            },
        }
    }

    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
        let spawn_timer = Timer::new();
        let tenant = spec.tenant.clone();

        info!(tenant = %tenant, "Spawning Firecracker MicroVM via Jailer");

        // Track spawn attempt
        DriverMetrics::spawn_attempted(&tenant.to_string());

        let run_id = spec.run_id.unwrap_or_default();

        let vsock_port = self.allocate_vsock_port();
        let vm_ip = self.allocate_ip(run_id).await.map_err(|e| {
            tracing::error!(
                error = %e,
                error_type = "ip_allocation_failed",
                stage = "spawn",
                vm_id = %run_id,
                "Failed to allocate IP address"
            );
            e
        })?;
        let mac_addr = self.generate_mac(&run_id);
        let tap_device = format!("tap-{:08x}", run_id.0.as_u128() as u32);

        // Create VM directory
        let vm_dir = self.fc_config.vm_root_dir.join(run_id.to_string());
        fs::create_dir_all(&vm_dir)
            .await
            .map_err(|e| DriverError::SpawnFailed {
                reason: format!("Failed to create VM directory: {}", e),
            })?;

        let api_socket = vm_dir.join("firecracker.sock");

        // Extract determinism envelope if provided
        let inputs_hash = spec.envelope.as_ref().map(|e| e.inputs_hash.clone());
        let envelope = spec.envelope.clone();

        if envelope.is_some() {
            info!("Deterministic execution mode enabled");
        }

        // Setup network namespace first (needed by jailer) - in its own span
        let netns_name = self
            .setup_netns(&run_id)
            .instrument(info_span!("setup_netns", vm_id = %run_id))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "netns_setup_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    "Failed to setup network namespace"
                );
                e
            })?;

        // Create cgroup manager for resource enforcement
        let cgroup_manager = CgroupManager::new(self.fc_config.cgroup_base.clone(), run_id);

        // Create cgroup with resource limits
        if let Err(e) = cgroup_manager.create_cgroup(&spec.resources).await {
            warn!(error = %e, "Failed to create cgroup, continuing without cgroup enforcement");
        }

        let mut vm = MicroVM {
            id: run_id,
            tenant: spec.tenant.clone(),
            process: None,
            api_socket,
            vsock_port,
            tap_device,
            vm_ip,
            mac_addr,
            status: VmStatus::Creating,
            vm_config: VmConfig {
                vcpu_count: spec.resources.cpu_millis / 1000,
                memory_mib: spec.resources.memory_mib,
                disk_mib: spec.resources.disk_mib.unwrap_or(10240),
                network_policy: spec.policy.network_policy.clone(),
                env_spec: spec.env.clone(),
                network_egress_kib: spec.resources.network_egress_kib,
            },
            _client: Client::new(),
            resources: ResourceTracker::new(),
            policy: spec.policy.clone(),
            inputs_hash,
            netns_name: Some(netns_name.clone()),
            chroot_dir: None,
            envelope,
            cgroup_manager: Some(cgroup_manager),
            health_monitor: None,
            monitor_task: None,
        };

        // Setup TAP device inside network namespace - in its own span
        self.setup_tap_device(&vm, &netns_name)
            .instrument(info_span!("setup_tap", vm_id = %run_id, tap_device = %vm.tap_device))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "tap_setup_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    tap_device = %vm.tap_device,
                    "Failed to setup TAP device"
                );
                e
            })?;

        // Create rootfs from environment image - in its own span
        let image_ref = spec.env.image.clone();
        // let rootfs_timer = Timer::new();  // Temporarily disabled
        let rootfs_path = self
            .create_rootfs(&vm, &image_ref)
            .instrument(info_span!("create_rootfs", vm_id = %run_id, image = %image_ref))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "rootfs_creation_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    image = %image_ref,
                    "Failed to create rootfs"
                );
                e
            })?;

        // Record rootfs creation duration
        // DriverMetrics::rootfs_create_duration_ms(rootfs_timer.elapsed_ms());  // Temporarily disabled

        // Stage resources into chroot for jailer - in its own span
        let _kernel_in_chroot = self
            .stage_resources(&vm, &rootfs_path)
            .instrument(info_span!("stage_resources", vm_id = %run_id))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "resource_staging_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    "Failed to stage resources"
                );
                e
            })?;

        // Store chroot path for cleanup
        let chroot_dir = self
            .fc_config
            .chroot_base_dir
            .join(run_id.to_string())
            .join("root");
        vm.chroot_dir = Some(chroot_dir);

        // Start Firecracker via Jailer
        let jailer_pid = self.start_firecracker_process(&mut vm, &netns_name).await?;

        // Assign Firecracker process to cgroup for resource enforcement
        if let Some(ref cgroup_manager) = vm.cgroup_manager {
            if let Err(e) = cgroup_manager.assign_pid(jailer_pid).await {
                warn!(error = %e, pid = jailer_pid, "Failed to assign PID to cgroup");
            }
        }

        // Configure VM - in its own span
        vm.status = VmStatus::Configuring;
        self.configure_vm(&vm, &rootfs_path)
            .instrument(info_span!("configure_vm", vm_id = %run_id))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "vm_config_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    "Failed to configure VM"
                );
                e
            })?;

        // Start VM - in its own span
        self.start_vm(&vm)
            .instrument(info_span!("start_vm", vm_id = %run_id))
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    error_type = "vm_start_failed",
                    stage = "spawn",
                    vm_id = %run_id,
                    "Failed to start VM"
                );
                e
            })?;
        vm.status = VmStatus::Running;

        // Initialize health monitoring
        let vsock_path = PathBuf::from(format!("/tmp/vsock-{}.sock", vm.id));
        let monitor = GuestAgentMonitor::new(vm.id, vsock_path);

        // Wait for guest agent to be ready (30 second timeout)
        let startup_timeout = std::time::Duration::from_secs(30);
        if let Err(e) = monitor.wait_for_ready(startup_timeout).await {
            error!(run_id = %run_id, error = %e, "Guest agent failed to become ready");

            // Cleanup: stop the VM before returning error
            let _ = self.stop_vm(&vm).await;
            if let Some(mut process) = vm.process.take() {
                let _ = process.kill().await;
            }
            if let Some(ref ns_name) = vm.netns_name {
                let _ = self
                    .teardown_tap_device(&vm.tap_device, ns_name, &vm.vm_config.network_policy)
                    .await;
                let _ = self.teardown_netns(ns_name).await;
            }
            if let Some(ref chroot) = vm.chroot_dir {
                let _ = self.cleanup_staged_resources(chroot).await;
                if let Some(parent) = chroot.parent() {
                    let _ = fs::remove_dir_all(parent).await;
                }
            }
            let _ = fs::remove_dir_all(&vm_dir).await;
            let _ = self.ipam.lock().await.release(run_id).await;

            return Err(DriverError::SpawnFailed {
                reason: format!("Guest agent health check failed: {}", e),
            });
        }

        // Perform version negotiation
        match monitor.negotiate_version().await {
            Ok(version) => {
                info!(
                    run_id = %run_id,
                    agent_version = %version.version,
                    "Guest agent version negotiated successfully"
                );
            }
            Err(e) => {
                error!(run_id = %run_id, error = %e, "Version negotiation failed");

                // Cleanup: stop the VM before returning error
                let _ = self.stop_vm(&vm).await;
                if let Some(mut process) = vm.process.take() {
                    let _ = process.kill().await;
                }
                if let Some(ref ns_name) = vm.netns_name {
                    let _ = self
                        .teardown_tap_device(&vm.tap_device, ns_name, &vm.vm_config.network_policy)
                        .await;
                    let _ = self.teardown_netns(ns_name).await;
                }
                if let Some(ref chroot) = vm.chroot_dir {
                    let _ = self.cleanup_staged_resources(chroot).await;
                    if let Some(parent) = chroot.parent() {
                        let _ = fs::remove_dir_all(parent).await;
                    }
                }
                let _ = fs::remove_dir_all(&vm_dir).await;
                let _ = self.ipam.lock().await.release(run_id).await;

                return Err(e);
            }
        }

        // Start background health monitoring
        // Clone monitor for spawning (spawn_monitor takes ownership)
        let monitor_task = monitor.clone().spawn_monitor();
        vm.health_monitor = Some(monitor);
        vm.monitor_task = Some(monitor_task);

        // Capture tap_device before moving vm
        let tap_device = vm.tap_device.clone();

        // Store VM
        let vm_arc = Arc::new(Mutex::new(vm));
        let mut vms = self.vms.write().await;
        vms.insert(run_id, vm_arc.clone());

        // Update metrics on success
        let active_count = vms.len();
        let tenant_count = vms
            .values()
            .filter(|v| {
                let v = v.blocking_lock();
                v.tenant == tenant
            })
            .count();
        drop(vms);

        DriverMetrics::spawn_succeeded(&tenant.to_string());
        DriverMetrics::active_vms_set(active_count);
        DriverMetrics::tenant_active_vms_set(&tenant.to_string(), tenant_count);

        // Calculate memory usage
        let memory_mib = spec.resources.memory_mib as u64;
        let total_memory: u64 = self
            .vms
            .read()
            .await
            .values()
            .map(|v| {
                let locked = v.blocking_lock();
                locked.vm_config.memory_mib as u64
            })
            .sum();
        DriverMetrics::memory_used_mib_set(total_memory + memory_mib);

        info!(
            event = "vm.spawn.complete",
            run_id = %run_id,
            tenant = %spec.tenant,
            vm_ip = %vm_ip,
            vsock_port = vsock_port,
            tap_device = %tap_device,
            "MicroVM spawned successfully via Jailer"
        );

        let result = Ok(ExecutionHandle {
            id: run_id,
            tenant: spec.tenant,
            driver_info: HashMap::from([
                ("substrate".to_string(), "firecracker".to_string()),
                ("isolation".to_string(), "jailer".to_string()),
                ("vsock_port".to_string(), vsock_port.to_string()),
                ("vm_ip".to_string(), vm_ip.to_string()),
            ]),
            env_spec: spec.env,
        });

        // Record spawn duration
        DriverMetrics::spawn_duration_ms(spawn_timer.elapsed_ms());

        result
    }

    async fn exec(
        &self,
        handle: &ExecutionHandle,
        cmd: CommandSpec,
    ) -> Result<ExecResult, DriverError> {
        let exec_timer = Timer::new();
        debug!(run_id = %handle.id, command = ?cmd.command, "Executing in MicroVM");

        let vms = self.vms.read().await;
        let vm_arc = vms.get(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let vm = vm_arc.lock().await;

        if vm.status != VmStatus::Running {
            return Err(DriverError::InternalError {
                message: format!("VM is not running: {:?}", vm.status),
            });
        }

        let result = self.exec_in_vm(&vm, &cmd).await;

        // Record exec metrics
        DriverMetrics::exec_duration_ms(exec_timer.elapsed_ms());
        if let Ok(ref res) = result {
            DriverMetrics::exec_completed(res.exit_code);
        }

        result
    }

    async fn stream_logs(&self, handle: &ExecutionHandle) -> Result<Vec<LogEntry>, DriverError> {
        let vms = self.vms.read().await;
        let vm_arc = vms.get(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let vm = vm_arc.lock().await;

        if vm.status != VmStatus::Running {
            return Err(DriverError::InternalError {
                message: format!("VM is not running: {:?}", vm.status),
            });
        }

        // Request logs from guest agent via VSOCK
        Self::get_logs_from_guest(&vm, None).await
    }

    async fn get_artifacts(&self, handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError> {
        let vms = self.vms.read().await;
        let vm_arc = vms.get(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let vm = vm_arc.lock().await;

        if vm.status != VmStatus::Running {
            return Err(DriverError::InternalError {
                message: format!("VM is not running: {:?}", vm.status),
            });
        }

        // Get artifact paths from policy or use defaults
        let artifact_paths = vec![
            "/tmp/artifacts".to_string(),
            "/output".to_string(),
            "/workspace/output".to_string(),
        ];

        Self::get_artifacts_from_guest(&vm, artifact_paths).await
    }

    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        let destroy_timer = Timer::new();
        info!(run_id = %handle.id, "Destroying MicroVM");

        let mut vms = self.vms.write().await;
        let vm_arc = vms.remove(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let mut vm = vm_arc.lock().await;

        // Get cleanup info before stopping
        let netns_name = vm.netns_name.clone();
        let chroot_dir = vm.chroot_dir.clone();
        let tap_device = vm.tap_device.clone();
        let network_policy = vm.vm_config.network_policy.clone();
        let cgroup_manager = vm.cgroup_manager.take();

        // Stop health monitor first
        if let Some(monitor) = vm.health_monitor.take() {
            info!(run_id = %handle.id, "Stopping health monitor");
            monitor.stop();
        }

        // Abort background monitor task
        if let Some(task) = vm.monitor_task.take() {
            task.abort();
            // Wait briefly for task to complete
            let _ = tokio::time::timeout(Duration::from_millis(500), task).await;
        }

        // Stop VM gracefully
        if let Err(e) = self.stop_vm(&vm).await {
            warn!(
                event = "vm.stop.warning",
                error = %e,
                vm_id = %handle.id,
                "Failed to stop VM gracefully, continuing with force kill"
            );
        }

        // Kill Firecracker process (jailer daemonized child)
        if let Some(mut process) = vm.process.take() {
            let _ = process.kill().await;
        }

        // Additional cleanup: kill any remaining firecracker processes for this VM
        let vm_id_str = handle.id.to_string();
        let _ = Command::new("pkill")
            .args(["-f", &format!("firecracker.*{}", vm_id_str)])
            .output()
            .await;

        // Wait a moment for process to fully terminate
        sleep(Duration::from_millis(500)).await;

        // Teardown TAP device (TAP is in netns, will be cleaned up with netns)
        if let Some(ref ns_name) = netns_name {
            if let Err(e) = self
                .teardown_tap_device(&tap_device, ns_name, &network_policy)
                .instrument(info_span!("teardown_tap", vm_id = %handle.id, tap = %tap_device))
                .await
            {
                warn!(
                    event = "tap.teardown.warning",
                    error = %e,
                    vm_id = %handle.id,
                    tap = %tap_device,
                    "Failed to teardown TAP device"
                );
            }

            // Remove network namespace
            if let Err(e) = self
                .teardown_netns(ns_name)
                .instrument(info_span!("teardown_netns", vm_id = %handle.id, ns_name = %ns_name))
                .await
            {
                warn!(
                    event = "netns.teardown.warning",
                    error = %e,
                    vm_id = %handle.id,
                    ns_name = %ns_name,
                    "Failed to teardown network namespace"
                );
            }
        }

        // Cleanup staged resources (unmount and remove chroot)
        if let Some(ref chroot) = chroot_dir {
            if let Err(e) = self
                .cleanup_staged_resources(chroot)
                .instrument(
                    info_span!("cleanup_resources", vm_id = %handle.id, chroot = %chroot.display()),
                )
                .await
            {
                warn!(
                    event = "resources.cleanup.warning",
                    error = %e,
                    vm_id = %handle.id,
                    chroot = %chroot.display(),
                    "Failed to cleanup staged resources"
                );
            }

            // Also remove the parent directory {chroot_base}/{vm_id}
            let parent_dir = chroot.parent();
            if let Some(parent) = parent_dir {
                let _ = fs::remove_dir_all(parent).await;
            }
        }

        // Cleanup VM directory
        let vm_dir = self.fc_config.vm_root_dir.join(handle.id.to_string());
        let _ = fs::remove_dir_all(&vm_dir).await;

        // Release IP allocation
        if let Err(e) = self.ipam.lock().await.release(handle.id).await {
            warn!(error = %e, "Failed to release IP allocation");
        }

        // Destroy cgroup for resource cleanup
        if let Some(manager) = cgroup_manager {
            if let Err(e) = manager.destroy_cgroup().await {
                warn!(error = %e, "Failed to destroy cgroup");
            }
        }

        vm.status = VmStatus::Destroyed;

        // Update metrics on successful destroy
        let active_count = self.vms.read().await.len();
        let tenant_count = self
            .vms
            .read()
            .await
            .values()
            .filter(|v| {
                let locked = v.blocking_lock();
                locked.tenant == handle.tenant
            })
            .count();

        DriverMetrics::destroy_completed();
        DriverMetrics::destroy_duration_ms(destroy_timer.elapsed_ms());
        DriverMetrics::active_vms_set(active_count);
        DriverMetrics::tenant_active_vms_set(&handle.tenant.to_string(), tenant_count);

        // Update memory usage metric
        let total_memory: u64 = self
            .vms
            .read()
            .await
            .values()
            .map(|v| {
                let locked = v.blocking_lock();
                locked.vm_config.memory_mib as u64
            })
            .sum();
        DriverMetrics::memory_used_mib_set(total_memory);

        info!(
            event = "vm.destroy.complete",
            run_id = %handle.id,
            tenant = %handle.tenant,
            "MicroVM destroyed"
        );
        Ok(())
    }

    async fn get_consumption(
        &self,
        handle: &ExecutionHandle,
    ) -> Result<ResourceConsumption, DriverError> {
        let vms = self.vms.read().await;
        let vm_arc = vms.get(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let vm = vm_arc.lock().await;

        // Try to get real metrics from guest agent
        match self.query_guest_metrics(&vm).await {
            Ok(metrics) => Ok(metrics),
            Err(_) => {
                // Fallback to tracked resources if guest agent unavailable
                Ok(vm.resources.to_consumption())
            }
        }
    }

    async fn get_receipt(&self, handle: &ExecutionHandle) -> Result<Option<Receipt>, DriverError> {
        let vms = self.vms.read().await;
        let vm_arc = vms.get(&handle.id).ok_or(DriverError::NotFound {
            id: handle.id.to_string(),
        })?;

        let vm = vm_arc.lock().await;

        // Calculate environment spec hash
        let env_spec_json = serde_json::to_vec(&handle.env_spec).unwrap_or_default();
        let env_spec_hash = blake3::hash(&env_spec_json).to_hex().to_string();

        // Calculate policy hash from stored policy
        let policy_json = serde_json::to_vec(&vm.policy).unwrap_or_default();
        let policy_hash = blake3::hash(&policy_json).to_hex().to_string();

        // Use stored inputs hash or calculate placeholder
        let inputs_hash = vm.inputs_hash.clone().unwrap_or_else(|| {
            // If no inputs hash provided, calculate from empty input
            blake3::hash(b"").to_hex().to_string()
        });

        // Get actual consumption from guest
        let consumption = self
            .query_guest_metrics(&vm)
            .await
            .unwrap_or_else(|_| vm.resources.to_consumption());

        // Get artifacts from guest agent
        let artifacts = self.get_artifacts(handle).await.unwrap_or_default();

        // Calculate outputs hash from artifacts
        let outputs_hash = if artifacts.is_empty() {
            None
        } else {
            let mut hasher = blake3::Hasher::new();
            for artifact in &artifacts {
                hasher.update(artifact.hash.as_bytes());
            }
            Some(hasher.finalize().to_hex().to_string())
        };

        Ok(Some(Receipt {
            run_id: handle.id,
            tenant: handle.tenant.clone(),
            started_at: chrono::Utc::now()
                - chrono::Duration::milliseconds(
                    vm.resources.start_time.elapsed().as_millis() as i64
                ),
            completed_at: chrono::Utc::now(),
            exit_code: 0,
            env_spec_hash,
            policy_hash,
            inputs_hash,
            outputs_hash,
            resource_consumption: consumption,
            artifacts,
        }))
    }

    async fn health_check(&self) -> Result<DriverHealth, DriverError> {
        let vms = self.vms.read().await;
        let active_count = vms.len() as u32;

        // Check required binaries exist
        let firecracker_ok = self.fc_config.firecracker_bin.exists();
        let jailer_ok = self.fc_config.jailer_bin.exists();
        let kernel_ok = self.fc_config.kernel_image.exists();

        let healthy = firecracker_ok && jailer_ok && kernel_ok;

        // Record health check metric
        // DriverMetrics::health_check(healthy);  // Temporarily disabled

        let message = if !firecracker_ok {
            "Firecracker binary not found".to_string()
        } else if !jailer_ok {
            "Jailer binary not found (required for production security)".to_string()
        } else if !kernel_ok {
            "Kernel image not found".to_string()
        } else {
            format!(
                "Firecracker driver with Jailer operational ({} active VMs)",
                active_count
            )
        };

        Ok(DriverHealth {
            healthy,
            message: Some(message),
            active_executions: active_count,
            available_capacity: self.capabilities().max_resources,
        })
    }
}

// Additional methods for FirecrackerDriver (not part of ExecutionDriver trait)
impl FirecrackerDriver {
    /// Query metrics from guest agent
    async fn query_guest_metrics(&self, vm: &MicroVM) -> Result<ResourceConsumption, DriverError> {
        let vsock_path = format!("/tmp/vsock-{}.sock", vm.id);

        let request = GuestAgentRequest::GetMetrics;

        let mut stream =
            UnixStream::connect(&vsock_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to connect to guest agent for metrics: {}", e),
                })?;

        let request_json =
            serde_json::to_vec(&request).map_err(|e| DriverError::InternalError {
                message: format!("Failed to serialize metrics request: {}", e),
            })?;

        // Send request
        let len = request_json.len() as u32;
        tokio::io::AsyncWriteExt::write_all(&mut stream, &len.to_be_bytes())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write metrics request: {}", e),
            })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, &request_json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write metrics request: {}", e),
            })?;

        // Read response
        let mut len_buf = [0u8; 4];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut len_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read metrics response length: {}", e),
            })?;

        let response_len = u32::from_be_bytes(len_buf) as usize;
        let mut response_buf = vec![0u8; response_len];

        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut response_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read metrics response: {}", e),
            })?;

        let response: GuestAgentResponse =
            serde_json::from_slice(&response_buf).map_err(|e| DriverError::InternalError {
                message: format!("Failed to parse metrics response: {}", e),
            })?;

        match response {
            GuestAgentResponse::Metrics {
                cpu_usage_percent,
                memory_used_mib,
                disk_used_mib,
            } => Ok(ResourceConsumption {
                cpu_millis_used: (cpu_usage_percent * 10.0) as u64,
                memory_mib_peak: memory_used_mib as u32,
                disk_mib_used: disk_used_mib as u32,
                network_egress_kib: 0,
            }),
            GuestAgentResponse::Error { message } => Err(DriverError::InternalError { message }),
            _ => Err(DriverError::InternalError {
                message: "Unexpected metrics response type".to_string(),
            }),
        }
    }

    /// Get logs from guest agent
    async fn get_logs_from_guest(
        vm: &MicroVM,
        since: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<Vec<LogEntry>, DriverError> {
        let vsock_path = format!("/tmp/vsock-{}.sock", vm.id);
        let request = GuestAgentRequest::GetLogs { since };

        let mut stream =
            UnixStream::connect(&vsock_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to connect to guest agent for logs: {}", e),
                })?;

        let request_json =
            serde_json::to_vec(&request).map_err(|e| DriverError::InternalError {
                message: format!("Failed to serialize logs request: {}", e),
            })?;

        // Send length-prefixed request
        let len = request_json.len() as u32;
        tokio::io::AsyncWriteExt::write_all(&mut stream, &len.to_be_bytes())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write logs request: {}", e),
            })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, &request_json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write logs request: {}", e),
            })?;

        // Read response
        let mut len_buf = [0u8; 4];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut len_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read logs response length: {}", e),
            })?;

        let response_len = u32::from_be_bytes(len_buf) as usize;
        let mut response_buf = vec![0u8; response_len];

        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut response_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read logs response: {}", e),
            })?;

        let response: GuestAgentResponse =
            serde_json::from_slice(&response_buf).map_err(|e| DriverError::InternalError {
                message: format!("Failed to parse logs response: {}", e),
            })?;

        match response {
            GuestAgentResponse::Logs { entries } => Ok(entries),
            GuestAgentResponse::Error { message } => Err(DriverError::InternalError { message }),
            _ => Err(DriverError::InternalError {
                message: "Unexpected logs response type".to_string(),
            }),
        }
    }

    /// Get artifacts from guest agent
    async fn get_artifacts_from_guest(
        vm: &MicroVM,
        paths: Vec<String>,
    ) -> Result<Vec<Artifact>, DriverError> {
        let vsock_path = format!("/tmp/vsock-{}.sock", vm.id);
        let request = GuestAgentRequest::GetArtifacts { paths };

        let mut stream =
            UnixStream::connect(&vsock_path)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to connect to guest agent for artifacts: {}", e),
                })?;

        let request_json =
            serde_json::to_vec(&request).map_err(|e| DriverError::InternalError {
                message: format!("Failed to serialize artifacts request: {}", e),
            })?;

        // Send length-prefixed request
        let len = request_json.len() as u32;
        tokio::io::AsyncWriteExt::write_all(&mut stream, &len.to_be_bytes())
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write artifacts request: {}", e),
            })?;

        tokio::io::AsyncWriteExt::write_all(&mut stream, &request_json)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to write artifacts request: {}", e),
            })?;

        // Read response
        let mut len_buf = [0u8; 4];
        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut len_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read artifacts response length: {}", e),
            })?;

        let response_len = u32::from_be_bytes(len_buf) as usize;
        let mut response_buf = vec![0u8; response_len];

        tokio::io::AsyncReadExt::read_exact(&mut stream, &mut response_buf)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to read artifacts response: {}", e),
            })?;

        let response: GuestAgentResponse =
            serde_json::from_slice(&response_buf).map_err(|e| DriverError::InternalError {
                message: format!("Failed to parse artifacts response: {}", e),
            })?;

        match response {
            GuestAgentResponse::Artifacts { artifacts } => Ok(artifacts),
            GuestAgentResponse::Error { message } => Err(DriverError::InternalError { message }),
            _ => Err(DriverError::InternalError {
                message: "Unexpected artifacts response type".to_string(),
            }),
        }
    }
}
