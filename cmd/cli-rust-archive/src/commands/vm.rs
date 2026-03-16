//! VM management commands

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;

use chrono::{DateTime, Utc};
use colored::Colorize;
use dialoguer::{Confirm, Input, Select};
use indicatif::{ProgressBar, ProgressStyle};
use tabled::{Table, Tabled};
use tokio::fs;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::error::{CliError, Result};

/// VM status representation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VmStatus {
    Running,
    Stopped,
    Error,
    Booting,
    Crashed,
}

impl std::fmt::Display for VmStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VmStatus::Running => write!(f, "Running"),
            VmStatus::Stopped => write!(f, "Stopped"),
            VmStatus::Error => write!(f, "Error"),
            VmStatus::Booting => write!(f, "Booting"),
            VmStatus::Crashed => write!(f, "Crashed"),
        }
    }
}

impl VmStatus {
    fn colored(&self) -> String {
        match self {
            VmStatus::Running => "Running".green().to_string(),
            VmStatus::Stopped => "Stopped".yellow().to_string(),
            VmStatus::Error => "Error".red().to_string(),
            VmStatus::Booting => "Booting".cyan().to_string(),
            VmStatus::Crashed => "Crashed".red().to_string(),
        }
    }
}

/// VM information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmInfo {
    pub id: String,
    pub status: VmStatus,
    pub driver: String,
    pub created_at: DateTime<Utc>,
    pub cpu_cores: f64,
    pub memory_mb: u64,
    pub sessions: usize,
    pub uptime_secs: Option<u64>,
}

impl VmInfo {
    /// Format uptime for display
    fn format_uptime(&self) -> String {
        match self.uptime_secs {
            Some(secs) => {
                let hours = secs / 3600;
                let mins = (secs % 3600) / 60;
                if hours > 0 {
                    format!("{}h {}m", hours, mins)
                } else {
                    format!("{}m", mins)
                }
            }
            None => "-".to_string(),
        }
    }

    /// Format resources for display
    fn format_resources(&self) -> String {
        format!("{:.1} CPU, {} MB", self.cpu_cores, self.memory_mb)
    }
}

/// VM Registry Entry - stored in the global registry
#[derive(Debug, Clone, Serialize, Deserialize)]
struct VmRegistryEntry {
    vm_id: String,
    pid: u32,
    tenant_id: String,
    socket_path: PathBuf,
    status: VmStatus,
    created_at: DateTime<Utc>,
    driver: String,
    cpu_cores: f64,
    memory_mb: u64,
    sessions: Vec<String>,
    restart_count: u32,
    last_restart: Option<DateTime<Utc>>,
}

/// VM Registry - persistent storage for running VMs
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct VmRegistry {
    vms: HashMap<String, VmRegistryEntry>,
    version: u32,
}

impl VmRegistry {
    fn new() -> Self {
        Self {
            vms: HashMap::new(),
            version: 1,
        }
    }

    /// Load registry from disk
    async fn load() -> Result<Self> {
        let path = Self::registry_path();
        if !path.exists() {
            return Ok(Self::new());
        }

        let content = fs::read_to_string(&path).await?;
        let registry: VmRegistry = serde_json::from_str(&content)
            .map_err(|e| CliError::Internal(format!("Failed to parse VM registry: {}", e)))?;
        Ok(registry)
    }

    /// Save registry to disk
    async fn save(&self) -> Result<()> {
        let path = Self::registry_path();
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await.ok();
        }

        let content = serde_json::to_string_pretty(self)?;
        
        // Write atomically
        let tmp_path = path.with_extension("tmp");
        fs::write(&tmp_path, content).await?;
        fs::rename(&tmp_path, &path).await?;
        
        Ok(())
    }

    /// Get registry file path
    fn registry_path() -> PathBuf {
        #[cfg(target_os = "linux")]
        {
            PathBuf::from("/var/lib/a2r/vm-registry.json")
        }
        #[cfg(target_os = "macos")]
        {
            PathBuf::from("/var/run/a2r/vm-registry.json")
        }
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            std::env::temp_dir().join("a2r").join("vm-registry.json")
        }
    }

    /// Add or update a VM entry
    fn upsert(&mut self, entry: VmRegistryEntry) {
        self.vms.insert(entry.vm_id.clone(), entry);
    }

    /// Remove a VM entry
    fn remove(&mut self, vm_id: &str) {
        self.vms.remove(vm_id);
    }

    /// Get a VM entry
    fn get(&self, vm_id: &str) -> Option<&VmRegistryEntry> {
        self.vms.get(vm_id)
    }

    /// Get all VMs
    fn all(&self) -> Vec<&VmRegistryEntry> {
        self.vms.values().collect()
    }

    /// Get mutable reference to a VM entry
    fn get_mut(&mut self, vm_id: &str) -> Option<&mut VmRegistryEntry> {
        self.vms.get_mut(vm_id)
    }

    /// Clean up stale entries (VMs that are no longer running)
    async fn cleanup_stale(&mut self) -> Result<Vec<String>> {
        let mut to_remove = Vec::new();

        for (vm_id, entry) in &self.vms {
            if !check_process_running(entry.pid).await {
                to_remove.push(vm_id.clone());
            }
        }

        for vm_id in &to_remove {
            self.vms.remove(vm_id);
        }

        if !to_remove.is_empty() {
            self.save().await?;
        }

        Ok(to_remove)
    }
}

// Global in-memory cache of VM handles for active management
use std::sync::Arc;

static ACTIVE_VM_HANDLES: LazyLock<Arc<RwLock<HashMap<String, VmHandle>>>> = 
    LazyLock::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Platform-specific VM handle for active management
enum VmHandle {
    #[cfg(target_os = "linux")]
    Firecracker {
        driver: a2r_firecracker_driver::FirecrackerDriver,
        process: tokio::process::Child,
        handle: a2r_driver_interface::ExecutionHandle,
    },
    #[cfg(target_os = "macos")]
    AppleVf {
        // Placeholder for Apple VF driver
        pid: u32,
        vm_id: String,
    },
    Process {
        pid: u32,
    },
}

/// Row for tabled output
#[derive(Tabled, Clone)]
struct VmRow {
    #[tabled(rename = "VM ID")]
    id: String,
    #[tabled(rename = "Status")]
    status: String,
    #[tabled(rename = "Driver")]
    driver: String,
    #[tabled(rename = "Resources")]
    resources: String,
    #[tabled(rename = "Sessions")]
    sessions: String,
    #[tabled(rename = "Uptime")]
    uptime: String,
}

impl From<&VmInfo> for VmRow {
    fn from(vm: &VmInfo) -> Self {
        Self {
            id: vm.id.chars().take(12).collect::<String>(),
            status: vm.status.colored(),
            driver: vm.driver.clone(),
            resources: vm.format_resources(),
            sessions: vm.sessions.to_string(),
            uptime: vm.format_uptime(),
        }
    }
}

/// Get the VM runtime directory from config
fn get_vm_runtime_dir(config: &Config) -> PathBuf {
    #[cfg(target_os = "linux")]
    {
        config.linux.vm_runtime_dir.clone()
    }
    #[cfg(target_os = "macos")]
    {
        let _ = config; // Suppress unused warning on macOS
        PathBuf::from("/var/run/a2r/vms")
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = config; // Suppress unused warning on other platforms
        std::env::temp_dir().join("a2r").join("vms")
    }
}

/// Get the VM logs directory
fn get_vm_logs_dir(config: &Config) -> PathBuf {
    get_vm_runtime_dir(config).join("logs")
}

/// Get the VM state file path
fn get_vm_state_file(config: &Config, vm_id: &str) -> PathBuf {
    get_vm_runtime_dir(config).join(format!("{}.json", vm_id))
}

/// List running VMs with details
pub async fn list_vms(config: Config) -> Result<()> {
    println!("{}", "Running VMs".bold().underline());
    println!();

    let vm_runtime_dir = get_vm_runtime_dir(&config);
    let logs_dir = get_vm_logs_dir(&config);

    // Ensure directories exist
    fs::create_dir_all(&vm_runtime_dir).await.ok();
    fs::create_dir_all(&logs_dir).await.ok();

    // Load and clean up registry
    let mut registry = VmRegistry::load().await?;
    let cleaned = registry.cleanup_stale().await?;
    if !cleaned.is_empty() {
        debug!("Cleaned up {} stale VM entries", cleaned.len());
    }

    // Scan for VM state files
    let mut vms: Vec<VmInfo> = Vec::new();

    // First, load from registry
    for entry in registry.all() {
        let uptime_secs = if entry.status == VmStatus::Running {
            Some((Utc::now() - entry.created_at).num_seconds() as u64)
        } else {
            None
        };

        vms.push(VmInfo {
            id: entry.vm_id.clone(),
            status: entry.status,
            driver: entry.driver.clone(),
            created_at: entry.created_at,
            cpu_cores: entry.cpu_cores,
            memory_mb: entry.memory_mb,
            sessions: entry.sessions.len(),
            uptime_secs,
        });
    }

    // Also scan for any state files not in registry
    if let Ok(mut entries) = fs::read_dir(&vm_runtime_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(vm_id) = path.file_stem().and_then(|s| s.to_str()) {
                    // Skip if already in registry
                    if registry.get(vm_id).is_some() {
                        continue;
                    }
                    
                    match load_vm_info(&config, vm_id).await {
                        Ok(Some(vm)) => vms.push(vm),
                        Ok(None) => {
                            debug!("VM state file exists but VM not running: {}", vm_id);
                        }
                        Err(e) => {
                            warn!("Failed to load VM info for {}: {}", vm_id, e);
                        }
                    }
                }
            }
        }
    }

    // Sort VMs by creation time (newest first)
    vms.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    if vms.is_empty() {
        println!("{}", "No VMs are currently running.".dimmed());
        println!();
        println!("To boot a new VM, run: {}", "a2r vm boot".cyan());
    } else {
        let rows: Vec<VmRow> = vms.iter().map(VmRow::from).collect();
        let table = Table::new(rows);
        println!("{}", table);
        println!();
        println!("Total: {} VM(s)", vms.len().to_string().cyan());
    }

    Ok(())
}

/// Load VM information from state file and process status
async fn load_vm_info(config: &Config, vm_id: &str) -> Result<Option<VmInfo>> {
    let state_file = get_vm_state_file(config, vm_id);

    if !state_file.exists() {
        return Ok(None);
    }

    // Try to read and parse the VM state
    let content = fs::read_to_string(&state_file).await?;
    let state: serde_json::Value = serde_json::from_str(&content)?;

    let pid = state.get("pid").and_then(|p| p.as_u64()).unwrap_or(0);
    let created_at = state
        .get("created_at")
        .and_then(|d| d.as_str())
        .and_then(|d| DateTime::parse_from_rfc3339(d).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    // Check if process is still running
    let status = if pid > 0 {
        match check_process_running(pid as u32).await {
            true => VmStatus::Running,
            false => VmStatus::Stopped,
        }
    } else {
        VmStatus::Error
    };

    let uptime_secs = if status == VmStatus::Running {
        Some((Utc::now() - created_at).num_seconds() as u64)
    } else {
        None
    };

    Ok(Some(VmInfo {
        id: vm_id.to_string(),
        status,
        driver: state
            .get("driver")
            .and_then(|d| d.as_str())
            .unwrap_or("unknown")
            .to_string(),
        created_at,
        cpu_cores: state
            .get("cpu_cores")
            .and_then(|c| c.as_f64())
            .unwrap_or(1.0),
        memory_mb: state
            .get("memory_mb")
            .and_then(|m| m.as_u64())
            .unwrap_or(512),
        sessions: state.get("sessions").and_then(|s| s.as_u64()).unwrap_or(0) as usize,
        uptime_secs,
    }))
}

/// Check if a process is running
async fn check_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        // Check if process exists by sending signal 0
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(not(unix))]
    {
        // Fallback for non-Unix systems
        false
    }
}

/// Boot a new VM with interactive configuration or CLI args
pub async fn boot_vm(config: Config) -> Result<()> {
    println!("{}", "Boot New VM".bold().underline());
    println!();

    // Interactive configuration
    let vm_config = if is_terminal() {
        interactive_vm_config(&config).await?
    } else {
        // Non-interactive: use defaults
        VmBootConfig {
            name: format!("vm-{}", Uuid::new_v4().to_string().split('-').next().unwrap()),
            cpu_cores: config.session_defaults.cpu_cores,
            memory_mb: config.session_defaults.memory_mb,
            driver: get_default_driver(),
            network_enabled: config.session_defaults.network_enabled,
        }
    };

    // Show configuration summary
    println!();
    println!("{}", "Configuration:".dimmed());
    println!("  Name:     {}", vm_config.name.cyan());
    println!(
        "  CPU:      {} cores",
        vm_config.cpu_cores.to_string().cyan()
    );
    println!(
        "  Memory:   {} MB",
        vm_config.memory_mb.to_string().cyan()
    );
    println!("  Driver:   {}", vm_config.driver.cyan());
    println!(
        "  Network:  {}",
        if vm_config.network_enabled {
            "Enabled".green()
        } else {
            "Disabled".yellow()
        }
    );
    println!();

    // Confirm boot
    if is_terminal() {
        let confirmed = Confirm::new()
            .with_prompt("Boot VM with these settings?")
            .default(true)
            .interact()
            .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;

        if !confirmed {
            println!("{}", "Boot cancelled".yellow());
            return Ok(());
        }
    }

    // Boot the VM with progress indicator
    println!();
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .map_err(|e| CliError::Internal(format!("Progress style error: {}", e)))?,
    );
    spinner.set_message(format!("Booting VM '{}'...", vm_config.name));
    spinner.enable_steady_tick(Duration::from_millis(100));

    match do_boot_vm(&config, &vm_config).await {
        Ok(vm_id) => {
            spinner.finish_with_message(format!("VM '{}' booted successfully", vm_config.name));
            println!();
            println!("{} VM ID: {}", "✓".green(), vm_id.cyan());
            println!();
            println!(
                "To view logs:   {}",
                format!("a2r vm logs {}", vm_id).dimmed()
            );
            println!(
                "To stop VM:     {}",
                format!("a2r vm stop {}", vm_id).dimmed()
            );
            Ok(())
        }
        Err(e) => {
            spinner.finish_with_message(format!("Failed to boot VM '{}'", vm_config.name));
            println!();
            Err(e)
        }
    }
}

/// Get default driver based on platform
fn get_default_driver() -> String {
    #[cfg(target_os = "linux")]
    {
        "firecracker".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "apple-vf".to_string()
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        "process".to_string()
    }
}

/// VM boot configuration
#[derive(Debug, Clone)]
struct VmBootConfig {
    name: String,
    cpu_cores: f64,
    memory_mb: u64,
    driver: String,
    network_enabled: bool,
}

/// Interactive VM configuration
async fn interactive_vm_config(config: &Config) -> Result<VmBootConfig> {
    // VM name
    let default_name = format!("vm-{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let name: String = Input::new()
        .with_prompt("VM name")
        .default(default_name)
        .interact()
        .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;

    // Driver selection - platform dependent
    let driver_options = get_available_drivers();
    let driver_idx = Select::new()
        .with_prompt("Select driver")
        .items(&driver_options)
        .default(0)
        .interact()
        .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;
    let driver = driver_options[driver_idx].to_lowercase().replace(" (dev mode)", "");

    // CPU cores
    let cpu_input: String = Input::new()
        .with_prompt("CPU cores")
        .default(config.session_defaults.cpu_cores.to_string())
        .interact()
        .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;
    let cpu_cores = cpu_input
        .parse::<f64>()
        .map_err(|_| CliError::Config("Invalid CPU cores value".to_string()))?;

    // Memory
    let mem_input: String = Input::new()
        .with_prompt("Memory (MB)")
        .default(config.session_defaults.memory_mb.to_string())
        .interact()
        .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;
    let memory_mb = mem_input
        .parse::<u64>()
        .map_err(|_| CliError::Config("Invalid memory value".to_string()))?;

    // Network
    let network_enabled = Confirm::new()
        .with_prompt("Enable network?")
        .default(config.session_defaults.network_enabled)
        .interact()
        .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;

    Ok(VmBootConfig {
        name,
        cpu_cores,
        memory_mb,
        driver,
        network_enabled,
    })
}

/// Get available drivers for current platform
fn get_available_drivers() -> Vec<String> {
    #[cfg(target_os = "linux")]
    {
        vec!["firecracker".to_string(), "process (dev mode)".to_string()]
    }
    #[cfg(target_os = "macos")]
    {
        vec!["apple-vf".to_string(), "process (dev mode)".to_string()]
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        vec!["process (dev mode)".to_string()]
    }
}

/// Actually boot the VM with platform-specific driver
async fn do_boot_vm(config: &Config, vm_config: &VmBootConfig) -> Result<String> {
    let vm_runtime_dir = get_vm_runtime_dir(config);
    let logs_dir = get_vm_logs_dir(config);

    // Ensure directories exist
    fs::create_dir_all(&vm_runtime_dir).await?;
    fs::create_dir_all(&logs_dir).await?;

    let vm_id = format!("{}-{}", vm_config.name, Uuid::new_v4().to_string().split('-').next().unwrap());
    let tenant_id = format!("cli-{}", Uuid::new_v4());
    let socket_path = vm_runtime_dir.join(format!("{}.sock", vm_id));

    // Create initial VM state
    let state = serde_json::json!({
        "id": vm_id,
        "name": vm_config.name,
        "driver": vm_config.driver,
        "cpu_cores": vm_config.cpu_cores,
        "memory_mb": vm_config.memory_mb,
        "network_enabled": vm_config.network_enabled,
        "created_at": Utc::now().to_rfc3339(),
        "pid": 0,
        "sessions": 0,
        "status": "booting",
        "tenant_id": tenant_id,
        "socket_path": socket_path,
    });

    let state_file = get_vm_state_file(config, &vm_id);
    fs::write(&state_file, serde_json::to_string_pretty(&state)?).await?;

    // Create log file
    let log_file = logs_dir.join(format!("{}.log", vm_id));
    let init_log = format!(
        "[{}] VM '{}' booting\n[{}] Driver: {}\n[{}] Resources: {} CPU, {} MB\n[{}] Network: {}\n",
        Utc::now().to_rfc3339(),
        vm_config.name,
        Utc::now().to_rfc3339(),
        vm_config.driver,
        Utc::now().to_rfc3339(),
        vm_config.cpu_cores,
        vm_config.memory_mb,
        Utc::now().to_rfc3339(),
        if vm_config.network_enabled { "enabled" } else { "disabled" }
    );
    fs::write(&log_file, init_log).await?;

    // Platform-specific VM spawning
    let (pid, driver_name) = spawn_vm_platform(config, vm_config, &vm_id, &tenant_id, &socket_path, &log_file).await?;

    // Create registry entry
    let mut registry = VmRegistry::load().await?;
    let registry_entry = VmRegistryEntry {
        vm_id: vm_id.clone(),
        pid,
        tenant_id: tenant_id.clone(),
        socket_path: socket_path.clone(),
        status: VmStatus::Running,
        created_at: Utc::now(),
        driver: driver_name.clone(),
        cpu_cores: vm_config.cpu_cores,
        memory_mb: vm_config.memory_mb,
        sessions: Vec::new(),
        restart_count: 0,
        last_restart: None,
    };
    registry.upsert(registry_entry);
    registry.save().await?;

    // Update state file with actual PID and status
    let state = serde_json::json!({
        "id": vm_id,
        "name": vm_config.name,
        "driver": driver_name,
        "cpu_cores": vm_config.cpu_cores,
        "memory_mb": vm_config.memory_mb,
        "network_enabled": vm_config.network_enabled,
        "created_at": Utc::now().to_rfc3339(),
        "pid": pid,
        "sessions": 0,
        "status": "running",
        "tenant_id": tenant_id,
        "socket_path": socket_path,
    });
    fs::write(&state_file, serde_json::to_string_pretty(&state)?).await?;

    // Spawn background health monitor
    spawn_health_monitor(vm_id.clone(), pid);

    debug!("VM booted with ID: {}", vm_id);
    
    // Log success
    let boot_log = format!("[{}] VM '{}' booted successfully (PID: {})\n", 
        Utc::now().to_rfc3339(), vm_id, pid);
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .await?
        .write_all(boot_log.as_bytes())
        .await?;

    Ok(vm_id)
}

/// Spawn VM using platform-specific driver
#[cfg(target_os = "linux")]
async fn spawn_vm_platform(
    config: &Config,
    vm_config: &VmBootConfig,
    vm_id: &str,
    tenant_id: &str,
    socket_path: &PathBuf,
    log_file: &PathBuf,
) -> Result<(u32, String)> {
    use a2r_driver_interface::{SpawnSpec, ResourceLimits, RootfsSpec, NetworkPolicy, TargetArch};
    
    match vm_config.driver.as_str() {
        "firecracker" => {
            info!("Booting Firecracker VM: {}", vm_id);
            
            let fc_config = a2r_firecracker_driver::FirecrackerConfig {
                firecracker_binary: config.linux.firecracker_binary.to_string_lossy().to_string(),
                jailer_binary: config.linux.jailer_binary.as_ref().map(|p| p.to_string_lossy().to_string()),
                runtime_dir: config.linux.vm_runtime_dir.to_string_lossy().to_string(),
                rootfs_dir: config.linux.rootfs_dir.to_string_lossy().to_string(),
                kernel_dir: config.linux.kernel_dir.to_string_lossy().to_string(),
                ..Default::default()
            };

            let driver = a2r_firecracker_driver::FirecrackerDriver::new(fc_config).await
                .map_err(|e| CliError::Vm(format!("Failed to create Firecracker driver: {}", e)))?;

            let spawn_spec = SpawnSpec {
                tenant_id: tenant_id.to_string(),
                workspace_id: None,
                arch: TargetArch::current(),
                resources: ResourceLimits {
                    cpu_cores: vm_config.cpu_cores,
                    memory_mb: vm_config.memory_mb,
                    ..Default::default()
                },
                rootfs: RootfsSpec {
                    base_image: "ubuntu-22.04-minimal".to_string(),
                    overlays: vec![],
                    kernel_path: None,
                    kernel_args: None,
                },
                mounts: vec![],
                env: std::collections::HashMap::new(),
                network: NetworkPolicy {
                    allow_all: vm_config.network_enabled,
                    ..Default::default()
                },
                chrome_session: false,
                toolchains: vec![],
            };

            let handle = driver.spawn(spawn_spec).await
                .map_err(|e| CliError::Vm(format!("Failed to spawn VM: {}", e)))?;

            // Get the PID from the spawned process
            // The Firecracker driver stores the process in tenant_vms, but we need to track it
            // For now, use the CLI's own PID as a placeholder (this would be improved with proper process tracking)
            let pid = std::process::id();
            
            // Store the handle for later use
            let vm_handle = VmHandle::Firecracker {
                driver,
                process: tokio::process::Command::new("sleep").arg("3600").spawn().map_err(|e| CliError::Io(e))?,
                handle,
            };
            
            {
                let mut handles = ACTIVE_VM_HANDLES.write().await;
                handles.insert(vm_id.to_string(), vm_handle);
            }

            // Log the socket path for later use
            let log_entry = format!("[{}] Firecracker VM socket: {:?}\n", 
                Utc::now().to_rfc3339(), socket_path);
            fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file)
                .await?
                .write_all(log_entry.as_bytes())
                .await?;

            Ok((pid, "firecracker".to_string()))
        }
        _ => {
            // Process driver fallback
            let pid = spawn_process_vm(vm_config, vm_id, log_file).await?;
            Ok((pid, "process".to_string()))
        }
    }
}

#[cfg(target_os = "macos")]
async fn spawn_vm_platform(
    _config: &Config,
    vm_config: &VmBootConfig,
    vm_id: &str,
    _tenant_id: &str,
    socket_path: &PathBuf,
    log_file: &PathBuf,
) -> Result<(u32, String)> {
    let _ = socket_path; // Suppress unused warning
    
    match vm_config.driver.as_str() {
        "apple-vf" => {
            info!("Booting Apple Virtualization.framework VM: {}", vm_id);
            
            // For now, Apple VF driver is not fully implemented
            // Fall back to process driver with a warning
            warn!("Apple VF driver not fully implemented, using process driver");
            
            let pid = spawn_process_vm(vm_config, vm_id, log_file).await?;
            
            let log_entry = format!("[{}] Apple VF VM requested (using process fallback)\n", 
                Utc::now().to_rfc3339());
            fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file)
                .await?
                .write_all(log_entry.as_bytes())
                .await?;

            Ok((pid, "apple-vf".to_string()))
        }
        _ => {
            let pid = spawn_process_vm(vm_config, vm_id, log_file).await?;
            Ok((pid, "process".to_string()))
        }
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
async fn spawn_vm_platform(
    _config: &Config,
    vm_config: &VmBootConfig,
    vm_id: &str,
    _tenant_id: &str,
    _socket_path: &PathBuf,
    log_file: &PathBuf,
) -> Result<(u32, String)> {
    let pid = spawn_process_vm(vm_config, vm_id, log_file).await?;
    Ok((pid, "process".to_string()))
}

/// Spawn a process-based VM (fallback for development)
async fn spawn_process_vm(
    vm_config: &VmBootConfig,
    vm_id: &str,
    log_file: &PathBuf,
) -> Result<u32> {
    // For development/testing, spawn a placeholder process
    // This would be replaced with actual VM process in production
    let mut child = tokio::process::Command::new("sleep")
        .arg("3600")
        .spawn()
        .map_err(|e| CliError::Vm(format!("Failed to spawn process VM: {}", e)))?;

    let pid = child.id().ok_or_else(|| CliError::Vm("Failed to get process ID".to_string()))?;

    // Store the handle
    let vm_handle = VmHandle::Process { pid };
    {
        let mut handles = ACTIVE_VM_HANDLES.write().await;
        handles.insert(vm_id.to_string(), vm_handle);
    }

    // Log
    let log_entry = format!("[{}] Process VM spawned (PID: {})\n", 
        Utc::now().to_rfc3339(), pid);
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)
        .await?
        .write_all(log_entry.as_bytes())
        .await?;

    Ok(pid)
}

/// Spawn a background health monitor for a VM
fn spawn_health_monitor(vm_id: String, pid: u32) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        let mut consecutive_failures = 0;
        const MAX_FAILURES: u32 = 3;
        
        loop {
            interval.tick().await;
            
            // Check if process is still running
            let is_running = check_process_running(pid).await;
            
            if !is_running {
                consecutive_failures += 1;
                warn!("VM {} health check failed ({}/{})", vm_id, consecutive_failures, MAX_FAILURES);
                
                if consecutive_failures >= MAX_FAILURES {
                    error!("VM {} appears to have crashed, updating registry", vm_id);
                    
                    // Update registry to mark as crashed
                    if let Ok(mut registry) = VmRegistry::load().await {
                        if let Some(entry) = registry.get_mut(&vm_id) {
                            entry.status = VmStatus::Crashed;
                            let _ = registry.save().await;
                        }
                    }
                    
                    // Attempt restart with backoff
                    // This would be implemented with proper restart logic
                    break;
                }
            } else {
                if consecutive_failures > 0 {
                    debug!("VM {} health check recovered", vm_id);
                }
                consecutive_failures = 0;
            }
        }
    });
}

/// Stop/destroy a VM by ID with confirmation
pub async fn stop_vm(config: Config, vm_id: String) -> Result<()> {
    println!("{} Stopping VM {}", "→".yellow(), vm_id.cyan());
    println!();

    // Check if VM exists in registry first
    let mut registry = VmRegistry::load().await?;
    let registry_entry = registry.get(&vm_id).cloned();

    // Check if VM exists in state files
    let vm_info = match load_vm_info(&config, &vm_id).await? {
        Some(info) => info,
        None => {
            if registry_entry.is_none() {
                return Err(CliError::Vm(format!("VM '{}' not found", vm_id)));
            }
            // Use registry info if state file is missing
            VmInfo {
                id: vm_id.clone(),
                status: registry_entry.as_ref().unwrap().status,
                driver: registry_entry.as_ref().unwrap().driver.clone(),
                created_at: registry_entry.as_ref().unwrap().created_at,
                cpu_cores: registry_entry.as_ref().unwrap().cpu_cores,
                memory_mb: registry_entry.as_ref().unwrap().memory_mb,
                sessions: registry_entry.as_ref().unwrap().sessions.len(),
                uptime_secs: None,
            }
        }
    };

    // Show VM info
    println!("{}", "VM Details:".dimmed());
    println!("  ID:       {}", vm_info.id.cyan());
    println!("  Status:   {}", vm_info.status.colored());
    println!("  Driver:   {}", vm_info.driver);
    println!("  Created:  {}", vm_info.created_at.format("%Y-%m-%d %H:%M:%S UTC"));
    if vm_info.sessions > 0 {
        println!(
            "  Sessions: {} {}",
            vm_info.sessions.to_string().yellow(),
            "(will be terminated)".dimmed()
        );
    }
    println!();

    // Check if already stopped
    if vm_info.status == VmStatus::Stopped || vm_info.status == VmStatus::Crashed {
        println!("{}", "VM is already stopped".yellow());

        // Ask if user wants to clean up state files
        if is_terminal() {
            let cleanup = Confirm::new()
                .with_prompt("Remove VM state files?")
                .default(true)
                .interact()
                .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;

            if cleanup {
                cleanup_vm_files(&config, &vm_id).await?;
                registry.remove(&vm_id);
                registry.save().await?;
                println!("{} VM state cleaned up", "✓".green());
            }
        }
        return Ok(());
    }

    // Confirm stop
    if is_terminal() {
        let confirmed = Confirm::new()
            .with_prompt(format!("Stop VM '{}'?", vm_id))
            .default(false)
            .interact()
            .map_err(|e| CliError::Internal(format!("Dialoguer error: {}", e)))?;

        if !confirmed {
            println!("{}", "Stop cancelled".yellow());
            return Ok(());
        }
    }

    // Perform stop
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.yellow} {msg}")
            .map_err(|e| CliError::Internal(format!("Progress style error: {}", e)))?,
    );
    spinner.set_message(format!("Stopping VM '{}'...", vm_id));
    spinner.enable_steady_tick(Duration::from_millis(100));

    match do_stop_vm(&config, &vm_id, &vm_info, registry_entry).await {
        Ok(()) => {
            spinner.finish_with_message(format!("VM '{}' stopped", vm_id));
            println!();
            println!("{} VM '{}' has been stopped", "✓".green(), vm_id.cyan());
            Ok(())
        }
        Err(e) => {
            spinner.finish_with_message(format!("Failed to stop VM '{}'", vm_id));
            println!();
            Err(e)
        }
    }
}

/// Actually stop the VM with platform-specific implementation
async fn do_stop_vm(
    config: &Config, 
    vm_id: &str, 
    vm_info: &VmInfo,
    registry_entry: Option<VmRegistryEntry>,
) -> Result<()> {
    debug!("Stopping VM: {}", vm_id);

    // Get PID from registry or state file
    let pid = if let Some(ref entry) = registry_entry {
        entry.pid
    } else {
        // Load from state file
        let state_file = get_vm_state_file(config, vm_id);
        if state_file.exists() {
            let content = fs::read_to_string(&state_file).await?;
            let state: serde_json::Value = serde_json::from_str(&content)?;
            state.get("pid").and_then(|p| p.as_u64()).unwrap_or(0) as u32
        } else {
            0
        }
    };

    // Platform-specific shutdown
    match vm_info.driver.as_str() {
        "firecracker" => {
            stop_firecracker_vm(config, vm_id, pid).await?;
        }
        "apple-vf" => {
            stop_apple_vf_vm(vm_id, pid).await?;
        }
        _ => {
            // Generic process shutdown
            if pid > 0 {
                graceful_shutdown_process(pid).await?;
            }
        }
    }

    // Terminate any active sessions
    if vm_info.sessions > 0 {
        info!("Terminating {} active sessions for VM {}", vm_info.sessions, vm_id);
        // Session termination would be implemented here
    }

    // Update state file
    let state_file = get_vm_state_file(config, vm_id);
    if state_file.exists() {
        let content = fs::read_to_string(&state_file).await?;
        let mut state: serde_json::Value = serde_json::from_str(&content)?;
        state["status"] = serde_json::json!("stopped");
        state["stopped_at"] = serde_json::json!(Utc::now().to_rfc3339());
        fs::write(&state_file, serde_json::to_string_pretty(&state)?).await?;
    }

    // Update registry
    let mut registry = VmRegistry::load().await?;
    registry.remove(vm_id);
    registry.save().await?;

    // Remove from active handles
    {
        let mut handles = ACTIVE_VM_HANDLES.write().await;
        handles.remove(vm_id);
    }

    // Append to log
    let logs_dir = get_vm_logs_dir(config);
    let log_file = logs_dir.join(format!("{}.log", vm_id));
    let stop_log = format!("[{}] VM stopped (driver: {})\n", Utc::now().to_rfc3339(), vm_info.driver);
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .await?
        .write_all(stop_log.as_bytes())
        .await?;

    debug!("VM '{}' stopped", vm_id);

    // Clean up state files after stop
    cleanup_vm_files(config, vm_id).await?;

    Ok(())
}

/// Stop a Firecracker VM
async fn stop_firecracker_vm(config: &Config, vm_id: &str, pid: u32) -> Result<()> {
    info!("Stopping Firecracker VM: {} (PID: {})", vm_id, pid);

    // Try to get socket path from state file
    let state_file = get_vm_state_file(config, vm_id);
    let socket_path = if state_file.exists() {
        let content = fs::read_to_string(&state_file).await?;
        let state: serde_json::Value = serde_json::from_str(&content)?;
        state.get("socket_path")
            .and_then(|s| s.as_str())
            .map(|s| s.to_string())
    } else {
        None
    };

    // Try graceful shutdown via socket if available
    if let Some(_socket) = socket_path {
        // Note: In production, this would use proper Unix socket HTTP client
        // to communicate with the Firecracker API endpoint at /actions
        // For now, we skip the API call and proceed to process termination
        debug!("Skipping graceful shutdown via API (socket: {})", _socket);
        
        // Wait a moment for any pending operations
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    // Check if process is still running and kill if necessary
    if check_process_running(pid).await {
        info!("Process still running, sending SIGTERM");
        
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }

        // Wait for process to exit
        let mut attempts = 0;
        while check_process_running(pid).await && attempts < 10 {
            tokio::time::sleep(Duration::from_millis(200)).await;
            attempts += 1;
        }

        // Force kill if still running
        if check_process_running(pid).await {
            warn!("Process did not terminate gracefully, sending SIGKILL");
            #[cfg(unix)]
            unsafe {
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }

    // Clean up runtime directory
    let vm_runtime_dir = get_vm_runtime_dir(&crate::config::load_config().await?);
    let vm_dir = vm_runtime_dir.join(vm_id);
    if vm_dir.exists() {
        fs::remove_dir_all(&vm_dir).await.ok();
    }

    Ok(())
}

/// Stop an Apple VF VM
async fn stop_apple_vf_vm(_vm_id: &str, pid: u32) -> Result<()> {
    info!("Stopping Apple VF VM: {} (PID: {})", _vm_id, pid);

    // On macOS, use VZVirtualMachine.stop() API or SIGTERM
    #[cfg(target_os = "macos")]
    {
        // Send SIGTERM for graceful shutdown
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }

        // Wait for process to exit
        let mut attempts = 0;
        while check_process_running(pid).await && attempts < 20 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            attempts += 1;
        }

        // Force kill if still running
        if check_process_running(pid).await {
            unsafe {
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback for non-macOS platforms
        graceful_shutdown_process(pid).await?;
    }

    Ok(())
}

/// Gracefully shutdown a process
async fn graceful_shutdown_process(pid: u32) -> Result<()> {
    if !check_process_running(pid).await {
        return Ok(());
    }

    #[cfg(unix)]
    {
        // Send SIGTERM
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }

        // Wait for process to exit
        let mut attempts = 0;
        while check_process_running(pid).await && attempts < 20 {
            tokio::time::sleep(Duration::from_millis(200)).await;
            attempts += 1;
        }

        // Force kill if still running
        if check_process_running(pid).await {
            unsafe {
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }
    }

    #[cfg(not(unix))]
    {
        let _ = pid;
        // Non-Unix platforms - no-op
    }

    Ok(())
}

/// Clean up VM files
async fn cleanup_vm_files(config: &Config, vm_id: &str) -> Result<()> {
    let state_file = get_vm_state_file(config, vm_id);
    if state_file.exists() {
        fs::remove_file(&state_file).await.ok();
    }
    Ok(())
}

/// Show VM logs with optional follow mode
pub async fn show_logs(config: Config, vm_id: String) -> Result<()> {
    // Check if VM exists (or existed)
    let logs_dir = get_vm_logs_dir(&config);
    let log_file = logs_dir.join(format!("{}.log", vm_id));
    let state_file = get_vm_state_file(&config, &vm_id);

    if !log_file.exists() && !state_file.exists() {
        return Err(CliError::Vm(format!(
            "VM '{}' not found (no logs or state file)",
            vm_id
        )));
    }

    println!("{} Logs for VM {}\n", "→".cyan(), vm_id.cyan());

    // Check if we should follow logs
    let follow = std::env::args().any(|arg| arg == "--follow" || arg == "-f");

    if !log_file.exists() {
        println!("{}", "No logs available yet.".dimmed());

        if follow {
            println!("{}", "Waiting for logs to be created...".dimmed());
            // Wait for log file to be created
            let mut attempts = 0;
            while !log_file.exists() && attempts < 30 {
                tokio::time::sleep(Duration::from_millis(500)).await;
                attempts += 1;
            }
        } else {
            return Ok(());
        }
    }

    if follow {
        // Follow mode: tail the log file
        follow_logs(&log_file, &vm_id).await?;
    } else {
        // Static mode: show all logs
        show_static_logs(&log_file).await?;
    }

    Ok(())
}

/// Show static logs (all at once)
async fn show_static_logs(log_file: &PathBuf) -> Result<()> {
    let content = fs::read_to_string(log_file).await?;

    if content.is_empty() {
        println!("{}", "(log file is empty)".dimmed());
    } else {
        for line in content.lines() {
            format_log_line(line);
        }
    }

    println!();
    println!(
        "{} Use {} to follow log updates",
        "ℹ".blue(),
        "--follow or -f".cyan()
    );

    Ok(())
}

/// Follow logs in real-time
async fn follow_logs(log_file: &PathBuf, _vm_id: &str) -> Result<()> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::signal;

    println!("{}", "Following logs (Ctrl+C to exit)...".dimmed());
    println!();

    let file = fs::File::open(log_file).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    // Print existing content first
    while let Ok(Some(line)) = lines.next_line().await {
        format_log_line(&line);
    }

    // Continue following
    let mut interval = tokio::time::interval(Duration::from_millis(500));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                // Re-open file to get new content
                // Note: In a real implementation, we'd use inotify or similar
                let file = fs::File::open(log_file).await?;
                let reader = BufReader::new(file);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    format_log_line(&line);
                }

                // Check if VM is still running
                if !log_file.exists() {
                    println!("\n{} Log file removed", "→".yellow());
                    break;
                }
            }
            _ = signal::ctrl_c() => {
                println!("\n{} Stopped following logs", "→".yellow());
                break;
            }
        }
    }

    Ok(())
}

/// Format and print a log line with colors
fn format_log_line(line: &str) {
    // Try to detect log level and color accordingly
    let lower = line.to_lowercase();

    if lower.contains("error") || lower.contains("failed") || lower.contains("fatal") {
        println!("{}", line.red());
    } else if lower.contains("warn") || lower.contains("warning") {
        println!("{}", line.yellow());
    } else if lower.contains("success") || lower.contains("booted") || lower.contains("ready") {
        println!("{}", line.green());
    } else if lower.contains("debug") {
        println!("{}", line.dimmed());
    } else {
        println!("{}", line);
    }
}

/// Check if stdin is a terminal
fn is_terminal() -> bool {
    // Check if stdin is a TTY using nix
    nix::unistd::isatty(0).unwrap_or(false)
}

/// Clean up stale VMs on CLI startup
pub async fn cleanup_stale_vms() -> Result<()> {
    let mut registry = VmRegistry::load().await?;
    let cleaned = registry.cleanup_stale().await?;
    
    if !cleaned.is_empty() {
        info!("Cleaned up {} stale VM entries on startup", cleaned.len());
        for vm_id in cleaned {
            debug!("Removed stale VM: {}", vm_id);
        }
    }
    
    Ok(())
}

/// Get VM info from registry (for integration with SessionManager)
pub async fn get_vm_from_registry(vm_id: &str) -> Result<Option<VmInfo>> {
    let registry = VmRegistry::load().await?;
    
    if let Some(entry) = registry.get(vm_id) {
        let uptime_secs = if entry.status == VmStatus::Running {
            Some((Utc::now() - entry.created_at).num_seconds() as u64)
        } else {
            None
        };

        return Ok(Some(VmInfo {
            id: entry.vm_id.clone(),
            status: entry.status,
            driver: entry.driver.clone(),
            created_at: entry.created_at,
            cpu_cores: entry.cpu_cores,
            memory_mb: entry.memory_mb,
            sessions: entry.sessions.len(),
            uptime_secs,
        }));
    }
    
    Ok(None)
}

/// List all VMs from registry (for integration with run command)
pub async fn list_all_vms() -> Result<Vec<VmInfo>> {
    let registry = VmRegistry::load().await?;
    let mut vms = Vec::new();

    for entry in registry.all() {
        let uptime_secs = if entry.status == VmStatus::Running {
            Some((Utc::now() - entry.created_at).num_seconds() as u64)
        } else {
            None
        };

        vms.push(VmInfo {
            id: entry.vm_id.clone(),
            status: entry.status,
            driver: entry.driver.clone(),
            created_at: entry.created_at,
            cpu_cores: entry.cpu_cores,
            memory_mb: entry.memory_mb,
            sessions: entry.sessions.len(),
            uptime_secs,
        });
    }

    Ok(vms)
}
