//! CLI configuration management

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::{CliError, Result};
use crate::logging::LogFormat;

/// A2R CLI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// API endpoint for cloud operations
    #[serde(default = "default_api_endpoint")]
    pub api_endpoint: String,
    
    /// Authentication token
    pub auth_token: Option<String>,
    
    /// Default VM driver preference
    #[serde(default)]
    pub driver_preference: DriverPreference,
    
    /// macOS-specific settings
    #[cfg(target_os = "macos")]
    #[serde(default)]
    pub macos: MacOSConfig,
    
    /// Linux-specific settings
    #[cfg(target_os = "linux")]
    #[serde(default)]
    pub linux: LinuxConfig,
    
    /// Session defaults
    #[serde(default)]
    pub session_defaults: SessionDefaults,
    
    /// Production configuration
    #[serde(default)]
    pub production: ProductionConfig,
}

fn default_api_endpoint() -> String {
    "https://api.a2r.cloud".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum DriverPreference {
    /// Use fastest available driver
    #[default]
    Auto,
    /// Always use VM-based isolation
    Vm,
    /// Use process-based isolation (development only)
    Process,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormatConfig {
    #[serde(rename = "pretty")]
    Pretty,
    #[serde(rename = "json")]
    Json,
}

impl Default for LogFormatConfig {
    fn default() -> Self {
        LogFormatConfig::Pretty
    }
}

impl From<LogFormatConfig> for LogFormat {
    fn from(config: LogFormatConfig) -> Self {
        match config {
            LogFormatConfig::Pretty => LogFormat::Pretty,
            LogFormatConfig::Json => LogFormat::Json,
        }
    }
}

mod log_format_serde {
    use super::{LogFormat, LogFormatConfig};
    use serde::{self, Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S>(format: &LogFormat, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let config: LogFormatConfig = match format {
            LogFormat::Pretty => LogFormatConfig::Pretty,
            LogFormat::Json => LogFormatConfig::Json,
        };
        config.serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<LogFormat, D::Error>
    where
        D: Deserializer<'de>,
    {
        let config = LogFormatConfig::deserialize(deserializer)?;
        Ok(config.into())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MacOSConfig {
    /// Path to desktop app's VM socket
    pub desktop_vm_socket: PathBuf,
    /// Path to CLI's own VM socket (for ephemeral VMs)
    pub cli_vm_socket: PathBuf,
    /// Default to shared VM (false = always boot ephemeral)
    pub prefer_shared_vm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LinuxConfig {
    /// Firecracker binary path
    pub firecracker_binary: PathBuf,
    /// Jailer binary path (optional)
    pub jailer_binary: Option<PathBuf>,
    /// VM runtime directory
    pub vm_runtime_dir: PathBuf,
    /// Rootfs directory
    pub rootfs_dir: PathBuf,
    /// Kernel directory
    pub kernel_dir: PathBuf,
    /// Default to Firecracker (true) or Process driver (false)
    pub prefer_firecracker: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SessionDefaults {
    /// Default timeout in seconds
    pub timeout_secs: u64,
    /// Default memory limit in MB
    pub memory_mb: u64,
    /// Default CPU cores
    pub cpu_cores: f64,
    /// Enable network by default
    pub network_enabled: bool,
}

/// Production configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProductionConfig {
    /// Log level (trace, debug, info, warn, error)
    pub log_level: String,
    
    /// Log output format
    #[serde(with = "log_format_serde")]
    pub log_format: LogFormat,
    
    /// Session timeout in seconds (0 = no timeout)
    pub session_timeout_secs: u64,
    
    /// Maximum number of active sessions per user
    pub max_sessions_per_user: usize,
    
    /// Enable metrics collection
    pub enable_metrics: bool,
    
    /// Enable automatic cleanup of old sessions
    pub enable_session_cleanup: bool,
    
    /// Days to keep old session records
    pub session_retention_days: i64,
    
    /// Daemon configuration
    pub daemon: DaemonConfig,
}

/// Daemon configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct DaemonConfig {
    /// Enable daemon mode (auto-start daemon on CLI invocation)
    pub enabled: bool,
    
    /// Daemon socket path
    pub socket_path: PathBuf,
    
    /// Daemon binary path
    pub daemon_binary: PathBuf,
    
    /// Auto-start daemon if not running
    pub auto_start: bool,
    
    /// Timeout for daemon operations in seconds
    pub timeout_secs: u64,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            socket_path: PathBuf::from("/var/run/a2r/daemon.sock"),
            daemon_binary: PathBuf::from("/usr/local/bin/a2rd"),
            auto_start: true,
            timeout_secs: 30,
        }
    }
}

impl Default for ProductionConfig {
    fn default() -> Self {
        Self {
            log_level: "info".to_string(),
            log_format: LogFormat::default(),
            session_timeout_secs: 3600, // 1 hour
            max_sessions_per_user: 10,
            enable_metrics: false,
            enable_session_cleanup: true,
            session_retention_days: 30,
            daemon: DaemonConfig::default(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_endpoint: "https://api.a2r.cloud".to_string(),
            auth_token: None,
            driver_preference: DriverPreference::Auto,
            
            #[cfg(target_os = "macos")]
            macos: MacOSConfig::default(),
            
            #[cfg(target_os = "linux")]
            linux: LinuxConfig::default(),
            
            session_defaults: SessionDefaults::default(),
            production: ProductionConfig::default(),
        }
    }
}

#[cfg(target_os = "macos")]
impl Default for MacOSConfig {
    fn default() -> Self {
        Self {
            desktop_vm_socket: PathBuf::from("/var/run/a2r/desktop-vm.sock"),
            cli_vm_socket: PathBuf::from("/var/run/a2r/cli-vm.sock"),
            prefer_shared_vm: true,
        }
    }
}

#[cfg(target_os = "linux")]
impl Default for LinuxConfig {
    fn default() -> Self {
        Self {
            firecracker_binary: PathBuf::from("/usr/local/bin/firecracker"),
            jailer_binary: Some(PathBuf::from("/usr/local/bin/jailer")),
            vm_runtime_dir: PathBuf::from("/var/lib/a2r/vms"),
            rootfs_dir: PathBuf::from("/var/lib/a2r/rootfs"),
            kernel_dir: PathBuf::from("/var/lib/a2r/kernels"),
            prefer_firecracker: false,
        }
    }
}

#[cfg(not(target_os = "linux"))]
impl Default for LinuxConfig {
    fn default() -> Self {
        Self {
            firecracker_binary: PathBuf::from("/usr/local/bin/firecracker"),
            jailer_binary: Some(PathBuf::from("/usr/local/bin/jailer")),
            vm_runtime_dir: PathBuf::from("/var/lib/a2r/vms"),
            rootfs_dir: PathBuf::from("/var/lib/a2r/rootfs"),
            kernel_dir: PathBuf::from("/var/lib/a2r/kernels"),
            prefer_firecracker: false,
        }
    }
}

impl Default for SessionDefaults {
    fn default() -> Self {
        Self {
            timeout_secs: 300,
            memory_mb: 512,
            cpu_cores: 1.0,
            network_enabled: false,
        }
    }
}

/// Load configuration from file or create default
pub async fn load_config() -> Result<Config> {
    let config_path = get_config_path()?;
    
    if config_path.exists() {
        let content = tokio::fs::read_to_string(&config_path).await?;
        let config: Config = toml::from_str(&content)
            .map_err(|e| CliError::Config(format!("Failed to parse config: {}", e)))?;
        Ok(config)
    } else {
        let config = Config::default();
        save_config(&config).await?;
        Ok(config)
    }
}

/// Save configuration to file
pub async fn save_config(config: &Config) -> Result<()> {
    let config_path = get_config_path()?;
    
    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    
    let content = toml::to_string_pretty(config)
        .map_err(|e| CliError::Config(format!("Failed to serialize config: {}", e)))?;
    
    tokio::fs::write(&config_path, content).await?;
    Ok(())
}

/// Get the configuration file path
fn get_config_path() -> Result<PathBuf> {
    let home = dirs::home_dir()
        .ok_or_else(|| CliError::Config("Could not find home directory".to_string()))?;
    
    Ok(home.join(".config").join("a2r").join("config.toml"))
}

/// Get the data directory path
pub fn get_data_dir() -> Result<PathBuf> {
    dirs::data_dir()
        .map(|d| d.join("a2r"))
        .ok_or_else(|| CliError::Config("Could not find data directory".to_string()))
}

/// Get the sessions database path
pub fn get_sessions_db_path() -> Result<PathBuf> {
    Ok(get_data_dir()?.join("sessions.db"))
}

/// Get the logs directory path
pub fn get_logs_dir() -> Result<PathBuf> {
    Ok(get_data_dir()?.join("logs"))
}

/// Detect if running in SSH session
pub fn is_ssh_session() -> bool {
    std::env::var("SSH_CLIENT").is_ok() || 
    std::env::var("SSH_TTY").is_ok()
}

/// Detect if running in CI environment
pub fn is_ci_environment() -> bool {
    std::env::var("CI").is_ok() ||
    std::env::var("GITHUB_ACTIONS").is_ok() ||
    std::env::var("GITLAB_CI").is_ok()
}
