//! Shared test utilities for stress testing
//!
//! Provides helpers for:
//! - System resource monitoring (TAP devices, network namespaces, iptables rules)
//! - Latency measurement and statistics
//! - Resource leak detection
//! - Test driver setup/teardown

use allternit_driver_interface::{
    CommandSpec, DriverError, EnvironmentSpec, ExecutionDriver, ExecutionHandle, ExecutionId,
    NetworkPolicy, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};
use allternit_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::process::Command;
use tokio::time::sleep;
use tracing::{debug, info, warn};

/// Latency statistics for spawn operations
#[derive(Debug, Clone, Default)]
pub struct LatencyStats {
    /// Number of samples
    pub count: usize,
    /// Minimum latency in milliseconds
    pub min_ms: f64,
    /// Maximum latency in milliseconds
    pub max_ms: f64,
    /// Mean latency in milliseconds
    pub mean_ms: f64,
    /// 50th percentile (median) in milliseconds
    pub p50_ms: f64,
    /// 99th percentile in milliseconds
    pub p99_ms: f64,
    /// 99.9th percentile in milliseconds
    pub p99_9_ms: f64,
    /// Standard deviation in milliseconds
    pub std_dev_ms: f64,
    /// All raw measurements in milliseconds
    pub raw_latencies: Vec<f64>,
}

impl LatencyStats {
    /// Create statistics from a list of latency measurements
    pub fn from_latencies(mut latencies: Vec<f64>) -> Self {
        if latencies.is_empty() {
            return Self::default();
        }

        latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let count = latencies.len();
        let min_ms = latencies[0];
        let max_ms = latencies[count - 1];
        let sum: f64 = latencies.iter().sum();
        let mean_ms = sum / count as f64;

        // Calculate percentiles
        let p50_idx = (count as f64 * 0.5) as usize;
        let p99_idx = (count as f64 * 0.99) as usize;
        let p99_9_idx = (count as f64 * 0.999) as usize;

        let p50_ms = latencies[p50_idx.min(count - 1)];
        let p99_ms = latencies[p99_idx.min(count - 1)];
        let p99_9_ms = latencies[p99_9_idx.min(count - 1)];

        // Calculate standard deviation
        let variance: f64 = latencies
            .iter()
            .map(|&x| (x - mean_ms).powi(2))
            .sum::<f64>()
            / count as f64;
        let std_dev_ms = variance.sqrt();

        Self {
            count,
            min_ms,
            max_ms,
            mean_ms,
            p50_ms,
            p99_ms,
            p99_9_ms,
            std_dev_ms,
            raw_latencies: latencies,
        }
    }

    /// Format as human-readable string
    pub fn format_report(&self) -> String {
        format!(
            "Latency Statistics (n={}):
  min:     {:.2} ms
  mean:    {:.2} ms
  p50:     {:.2} ms
  p99:     {:.2} ms
  p99.9:   {:.2} ms
  max:     {:.2} ms
  stddev:  {:.2} ms",
            self.count,
            self.min_ms,
            self.mean_ms,
            self.p50_ms,
            self.p99_ms,
            self.p99_9_ms,
            self.max_ms,
            self.std_dev_ms
        )
    }
}

/// Resource leak report containing system state before and after test
#[derive(Debug, Clone, Default)]
pub struct ResourceLeakReport {
    /// TAP devices count before test
    pub tap_devices_before: usize,
    /// TAP devices count after test
    pub tap_devices_after: usize,
    /// Network namespaces count before test
    pub netns_before: usize,
    /// Network namespaces count after test
    pub netns_after: usize,
    /// iptables rules count before test
    pub iptables_rules_before: usize,
    /// iptables rules count after test
    pub iptables_rules_after: usize,
    /// Chroot directories before test
    pub chroot_dirs_before: usize,
    /// Chroot directories after test
    pub chroot_dirs_after: usize,
    /// VM root directories before test
    pub vm_dirs_before: usize,
    /// VM root directories after test
    pub vm_dirs_after: usize,
    /// IP allocations before test
    pub ip_allocations_before: usize,
    /// IP allocations after test
    pub ip_allocations_after: usize,
}

impl ResourceLeakReport {
    /// Calculate total leaked resources
    pub fn total_leaks(&self) -> usize {
        self.tap_devices_leaked()
            + self.netns_leaked()
            + self.iptables_rules_leaked()
            + self.chroot_dirs_leaked()
            + self.vm_dirs_leaked()
            + self.ip_allocations_leaked()
    }

    /// Check if any resources leaked
    pub fn has_leaks(&self) -> bool {
        self.total_leaks() > 0
    }

    pub fn tap_devices_leaked(&self) -> usize {
        self.tap_devices_after
            .saturating_sub(self.tap_devices_before)
    }

    pub fn netns_leaked(&self) -> usize {
        self.netns_after.saturating_sub(self.netns_before)
    }

    pub fn iptables_rules_leaked(&self) -> usize {
        self.iptables_rules_after
            .saturating_sub(self.iptables_rules_before)
    }

    pub fn chroot_dirs_leaked(&self) -> usize {
        self.chroot_dirs_after
            .saturating_sub(self.chroot_dirs_before)
    }

    pub fn vm_dirs_leaked(&self) -> usize {
        self.vm_dirs_after.saturating_sub(self.vm_dirs_before)
    }

    pub fn ip_allocations_leaked(&self) -> usize {
        self.ip_allocations_after
            .saturating_sub(self.ip_allocations_before)
    }

    /// Format as human-readable report
    pub fn format_report(&self) -> String {
        format!(
            "Resource Leak Report:
  TAP devices:  {} -> {} (leaked: {})
  Network ns:   {} -> {} (leaked: {})
  iptables:     {} -> {} (leaked: {})
  Chroot dirs:  {} -> {} (leaked: {})
  VM dirs:      {} -> {} (leaked: {})
  IP allocations: {} -> {} (leaked: {})
  TOTAL LEAKED: {}",
            self.tap_devices_before,
            self.tap_devices_after,
            self.tap_devices_leaked(),
            self.netns_before,
            self.netns_after,
            self.netns_leaked(),
            self.iptables_rules_before,
            self.iptables_rules_after,
            self.iptables_rules_leaked(),
            self.chroot_dirs_before,
            self.chroot_dirs_after,
            self.chroot_dirs_leaked(),
            self.vm_dirs_before,
            self.vm_dirs_after,
            self.vm_dirs_leaked(),
            self.ip_allocations_before,
            self.ip_allocations_after,
            self.ip_allocations_leaked(),
            self.total_leaks()
        )
    }
}

/// Count TAP devices currently on the system
pub async fn count_tap_devices() -> usize {
    // TAP devices follow the pattern tap-{hex}
    let output = Command::new("ip").args(["tuntap", "show"]).output().await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.lines().filter(|line| line.contains("tap-")).count()
        }
        _ => {
            // Fallback: check /sys/class/net
            let output = Command::new("ls").args(["/sys/class/net"]).output().await;
            match output {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    stdout
                        .lines()
                        .filter(|line| line.starts_with("tap-"))
                        .count()
                }
                _ => 0,
            }
        }
    }
}

/// Count network namespaces
pub async fn count_network_namespaces() -> usize {
    // Try ip netns first
    let output = Command::new("ip").args(["netns", "list"]).output().await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout
                .lines()
                .filter(|line| !line.is_empty() && line.contains("allternit-"))
                .count()
        }
        _ => {
            // Fallback: check /var/run/netns
            let output = Command::new("ls").args(["/var/run/netns"]).output().await;
            match output {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    stdout
                        .lines()
                        .filter(|line| line.starts_with("allternit-"))
                        .count()
                }
                _ => 0,
            }
        }
    }
}

/// Count iptables rules in FORWARD chain
pub async fn count_iptables_rules() -> usize {
    let output = Command::new("iptables")
        .args(["-L", "FORWARD", "-n", "--line-numbers"])
        .output()
        .await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Count lines that contain Allternit- chain references
            stdout.lines().filter(|line| line.contains("Allternit-")).count()
        }
        _ => 0,
    }
}

/// Count Allternit-specific iptables chains
pub async fn count_iptables_chains() -> usize {
    let output = Command::new("iptables").args(["-L", "-n"]).output().await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout
                .lines()
                .filter(|line| line.starts_with("Chain Allternit-"))
                .count()
        }
        _ => 0,
    }
}

/// Count chroot directories
pub async fn count_chroot_dirs(chroot_base: &PathBuf) -> usize {
    if !chroot_base.exists() {
        return 0;
    }

    let output = Command::new("find")
        .args([
            chroot_base.to_str().unwrap(),
            "-maxdepth",
            "1",
            "-type",
            "d",
        ])
        .output()
        .await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Subtract 1 for the base directory itself
            stdout.lines().count().saturating_sub(1)
        }
        _ => 0,
    }
}

/// Count VM root directories
pub async fn count_vm_dirs(vm_root_dir: &PathBuf) -> usize {
    if !vm_root_dir.exists() {
        return 0;
    }

    let output = Command::new("find")
        .args([
            vm_root_dir.to_str().unwrap(),
            "-maxdepth",
            "1",
            "-type",
            "d",
        ])
        .output()
        .await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Subtract 1 for the base directory itself
            stdout.lines().count().saturating_sub(1)
        }
        _ => 0,
    }
}

/// Get current IP allocation count from IPAM state file
pub async fn count_ip_allocations(ipam_path: &PathBuf) -> usize {
    if !ipam_path.exists() {
        return 0;
    }

    match tokio::fs::read_to_string(ipam_path).await {
        Ok(content) => {
            // Parse JSON to count allocations
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => json
                    .get("allocated")
                    .and_then(|a| a.as_object())
                    .map(|obj| obj.len())
                    .unwrap_or(0),
                _ => 0,
            }
        }
        _ => 0,
    }
}

/// Capture current system resource state
pub async fn capture_resource_state(config: &FirecrackerConfig) -> ResourceLeakReport {
    let ipam_path = config.vm_root_dir.join("ipam-state.json");

    ResourceLeakReport {
        tap_devices_before: count_tap_devices().await,
        tap_devices_after: 0,
        netns_before: count_network_namespaces().await,
        netns_after: 0,
        iptables_rules_before: count_iptables_rules().await,
        iptables_rules_after: 0,
        chroot_dirs_before: count_chroot_dirs(&config.chroot_base_dir).await,
        chroot_dirs_after: 0,
        vm_dirs_before: count_vm_dirs(&config.vm_root_dir).await,
        vm_dirs_after: 0,
        ip_allocations_before: count_ip_allocations(&ipam_path).await,
        ip_allocations_after: 0,
    }
}

/// Complete resource state capture (for "after" measurement)
pub async fn complete_resource_report(
    mut report: ResourceLeakReport,
    config: &FirecrackerConfig,
) -> ResourceLeakReport {
    let ipam_path = config.vm_root_dir.join("ipam-state.json");

    report.tap_devices_after = count_tap_devices().await;
    report.netns_after = count_network_namespaces().await;
    report.iptables_rules_after = count_iptables_rules().await;
    report.chroot_dirs_after = count_chroot_dirs(&config.chroot_base_dir).await;
    report.vm_dirs_after = count_vm_dirs(&config.vm_root_dir).await;
    report.ip_allocations_after = count_ip_allocations(&ipam_path).await;

    report
}

/// Measure spawn latency for a batch of VMs
pub async fn measure_spawn_latency(
    driver: &FirecrackerDriver,
    count: usize,
    config: &TestConfig,
) -> Result<LatencyStats, DriverError> {
    let mut latencies = Vec::with_capacity(count);

    for i in 0..count {
        let start = Instant::now();

        let handle = spawn_test_vm(driver, &format!("latency-test-{}", i), config).await?;

        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;
        latencies.push(latency_ms);

        // Clean up immediately to avoid resource exhaustion
        let _ = driver.destroy(&handle).await;
    }

    Ok(LatencyStats::from_latencies(latencies))
}

/// Configuration for test VMs
#[derive(Debug, Clone)]
pub struct TestConfig {
    pub tenant: TenantId,
    pub resources: ResourceSpec,
    pub network_policy: NetworkPolicy,
    pub env_spec: EnvironmentSpec,
    pub timeout_seconds: u32,
}

impl Default for TestConfig {
    fn default() -> Self {
        Self {
            tenant: TenantId::new("test-tenant").expect("valid tenant"),
            resources: ResourceSpec {
                cpu_millis: 100,
                memory_mib: 128,
                disk_mib: Some(512),
                network_egress_kib: None,
                gpu_count: None,
            },
            network_policy: NetworkPolicy {
                egress_allowed: true,
                allowed_hosts: vec!["*".to_string()],
                allowed_ports: vec![],
                dns_allowed: true,
            },
            env_spec: EnvironmentSpec {
                spec_type: allternit_driver_interface::EnvSpecType::Oci,
                image: "alpine:latest".to_string(),
                version: None,
                packages: vec![],
                env_vars: HashMap::new(),
                working_dir: None,
                mounts: vec![],
            },
            timeout_seconds: 60,
        }
    }
}

/// Spawn a single test VM with given configuration
pub async fn spawn_test_vm(
    driver: &FirecrackerDriver,
    name: &str,
    config: &TestConfig,
) -> Result<ExecutionHandle, DriverError> {
    let policy = PolicySpec {
        version: "0.1.0".to_string(),
        allowed_tools: vec!["*".to_string()],
        denied_tools: vec![],
        network_policy: config.network_policy.clone(),
        file_policy: Default::default(),
        timeout_seconds: Some(config.timeout_seconds),
    };

    let spec = SpawnSpec {
        tenant: config.tenant.clone(),
        project: Some(name.to_string()),
        workspace: None,
        run_id: Some(ExecutionId::new()),
        env: config.env_spec.clone(),
        policy,
        resources: config.resources.clone(),
        envelope: None,
        prewarm_pool: None,
    };

    driver.spawn(spec).await
}

/// Create a test driver with temporary directories
pub async fn create_test_driver() -> (FirecrackerDriver, TestDirs, FirecrackerConfig) {
    let test_id = uuid::Uuid::new_v4().to_string();
    let temp_base = std::env::temp_dir().join(format!("allternit-firecracker-stress-{}", test_id));

    let vm_root_dir = temp_base.join("vms");
    let chroot_base_dir = temp_base.join("chroot");
    let cache_dir = temp_base.join("cache");

    // Create directories
    tokio::fs::create_dir_all(&vm_root_dir)
        .await
        .expect("Failed to create VM root dir");
    tokio::fs::create_dir_all(&chroot_base_dir)
        .await
        .expect("Failed to create chroot base dir");
    tokio::fs::create_dir_all(&cache_dir)
        .await
        .expect("Failed to create cache dir");

    let config = FirecrackerConfig {
        firecracker_bin: PathBuf::from("/usr/bin/firecracker"),
        jailer_bin: PathBuf::from("/usr/bin/jailer"),
        chroot_base_dir: chroot_base_dir.clone(),
        uid: 1000,
        gid: 1000,
        max_open_fds: 1024,
        vm_root_dir: vm_root_dir.clone(),
        kernel_image: PathBuf::from("/var/lib/allternit/vmlinux"),
        bridge_iface: "fcbridge0".to_string(),
        vm_subnet: "172.16.0.0/24".to_string(),
        vsock_port_start: 10000,
        max_vms_per_tenant: 100,
        cgroup_base: PathBuf::from("/sys/fs/cgroup"),
        metrics_port: None,
    };

    let driver = FirecrackerDriver::with_config(config.clone());

    let test_dirs = TestDirs {
        temp_base,
        vm_root_dir,
        chroot_base_dir,
        cache_dir,
    };

    (driver, test_dirs, config)
}

/// Test directories for cleanup
#[derive(Debug, Clone)]
pub struct TestDirs {
    pub temp_base: PathBuf,
    pub vm_root_dir: PathBuf,
    pub chroot_base_dir: PathBuf,
    pub cache_dir: PathBuf,
}

impl TestDirs {
    /// Clean up all test directories
    pub async fn cleanup(&self) {
        let _ = tokio::fs::remove_dir_all(&self.temp_base).await;
    }
}

/// Check resource leaks and assert zero leaks
pub fn assert_no_resource_leaks(report: &ResourceLeakReport) {
    let leaks = report.total_leaks();
    if leaks > 0 {
        panic!("Resource leaks detected!\n{}", report.format_report());
    }
}

/// Wait for system to stabilize (useful after cleanup)
pub async fn wait_for_cleanup_stabilization() {
    // Give cleanup tasks time to complete
    sleep(Duration::from_millis(500)).await;
}

/// Get available IP count in subnet
pub fn get_available_ip_count(subnet: &str) -> usize {
    use ipnet::Ipv4Net;
    use std::net::Ipv4Addr;

    let net: Ipv4Net = subnet
        .parse()
        .unwrap_or_else(|_| "172.16.0.0/24".parse().expect("valid default"));

    // Usable hosts = total - network - broadcast - gateway
    let total_hosts = net.hosts().count();
    total_hosts.saturating_sub(1) // Subtract gateway
}

/// Run a command in a VM and return result
pub async fn exec_in_vm(
    driver: &FirecrackerDriver,
    handle: &ExecutionHandle,
    command: Vec<String>,
) -> Result<(), DriverError> {
    let cmd = CommandSpec {
        command,
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    let result = driver.exec(handle, cmd).await?;

    if result.exit_code != 0 {
        return Err(DriverError::InternalError {
            message: format!("Command failed with exit code: {}", result.exit_code),
        });
    }

    Ok(())
}

/// Setup tracing for tests
pub fn init_test_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_test_writer()
        .try_init();
}

/// Generate a test network policy with specific characteristics
pub fn generate_network_policy(index: usize) -> NetworkPolicy {
    let patterns = [
        // Allow all
        NetworkPolicy {
            egress_allowed: true,
            allowed_hosts: vec!["*".to_string()],
            allowed_ports: vec![],
            dns_allowed: true,
        },
        // Deny all
        NetworkPolicy {
            egress_allowed: false,
            allowed_hosts: vec![],
            allowed_ports: vec![],
            dns_allowed: false,
        },
        // Allow specific hosts
        NetworkPolicy {
            egress_allowed: true,
            allowed_hosts: vec!["10.0.0.0/8".to_string(), "172.16.0.0/12".to_string()],
            allowed_ports: vec![80, 443],
            dns_allowed: true,
        },
        // Allow only DNS
        NetworkPolicy {
            egress_allowed: false,
            allowed_hosts: vec![],
            allowed_ports: vec![53],
            dns_allowed: true,
        },
        // Restrictive with ports
        NetworkPolicy {
            egress_allowed: true,
            allowed_hosts: vec!["192.168.0.0/16".to_string()],
            allowed_ports: vec![22, 80, 443, 8080],
            dns_allowed: false,
        },
    ];

    patterns[index % patterns.len()].clone()
}

/// Cleanup all Allternit resources (emergency cleanup for tests)
pub async fn emergency_cleanup(config: &FirecrackerConfig) {
    info!("Performing emergency cleanup");

    // Clean up network namespaces
    let output = Command::new("ip").args(["netns", "list"]).output().await;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(ns_name) = parts.first() {
                if ns_name.starts_with("allternit-") {
                    let _ = Command::new("ip")
                        .args(["netns", "delete", ns_name])
                        .output()
                        .await;
                }
            }
        }
    }

    // Clean up TAP devices
    let output = Command::new("ip").args(["tuntap", "show"]).output().await;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.starts_with("tap-") {
                let parts: Vec<&str> = line.split(':').collect();
                if let Some(tap_name) = parts.first() {
                    let _ = Command::new("ip")
                        .args(["tuntap", "del", tap_name, "mode", "tap"])
                        .output()
                        .await;
                }
            }
        }
    }

    // Clean up iptables chains
    let output = Command::new("iptables").args(["-L", "-n"]).output().await;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.starts_with("Chain Allternit-") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(chain_name) = parts.get(1) {
                    // Flush chain
                    let _ = Command::new("iptables")
                        .args(["-F", chain_name])
                        .output()
                        .await;
                    // Remove from FORWARD
                    let _ = Command::new("iptables")
                        .args(["-D", "FORWARD", "-j", chain_name])
                        .output()
                        .await;
                    // Delete chain
                    let _ = Command::new("iptables")
                        .args(["-X", chain_name])
                        .output()
                        .await;
                }
            }
        }
    }

    // Clean up directories
    let _ = tokio::fs::remove_dir_all(&config.vm_root_dir).await;
    let _ = tokio::fs::remove_dir_all(&config.chroot_base_dir).await;

    sleep(Duration::from_millis(100)).await;
}
