//! Configuration for Allternit VM Executor
//!
//! Configuration is loaded from:
//! 1. /etc/allternit/vm-executor.toml (system-wide)
//! 2. ~/.config/allternit/vm-executor.toml (user-specific, overrides system)
//! 3. Environment variables (Allternit_* prefix, overrides files)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Executor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorConfig {
    /// VSOCK port to listen on (for communication with host)
    #[serde(default = "default_vsock_port")]
    pub vsock_port: u32,

    /// TCP port for development/testing (when VSOCK not available)
    pub tcp_port: Option<u16>,

    /// Sandbox configuration
    #[serde(default)]
    pub sandbox: SandboxConfig,

    /// Logging level
    #[serde(default = "default_log_level")]
    pub log_level: String,

    /// Maximum concurrent sessions
    #[serde(default = "default_max_sessions")]
    pub max_sessions: usize,

    /// Session timeout in seconds (0 = no timeout)
    #[serde(default)]
    pub session_timeout_secs: u64,

    /// Workspace mount point (where host workspace is mounted in VM)
    #[serde(default = "default_workspace_path")]
    pub workspace_path: PathBuf,

    /// Toolchain paths
    #[serde(default)]
    pub toolchains: ToolchainConfig,
}

impl Default for ExecutorConfig {
    fn default() -> Self {
        Self {
            vsock_port: default_vsock_port(),
            tcp_port: None,
            sandbox: SandboxConfig::default(),
            log_level: default_log_level(),
            max_sessions: default_max_sessions(),
            session_timeout_secs: 0,
            workspace_path: default_workspace_path(),
            toolchains: ToolchainConfig::default(),
        }
    }
}

impl ExecutorConfig {
    /// Load configuration from files and environment
    pub fn load() -> anyhow::Result<Self> {
        let mut config = Self::default();

        // Try to load system config
        if let Ok(system_config) = std::fs::read_to_string("/etc/allternit/vm-executor.toml") {
            let parsed: ExecutorConfig = toml::from_str(&system_config)?;
            config = merge_config(config, parsed);
        }

        // Try to load user config
        if let Some(home) = dirs::home_dir() {
            let user_config_path = home.join(".config/allternit/vm-executor.toml");
            if let Ok(user_config) = std::fs::read_to_string(&user_config_path) {
                let parsed: ExecutorConfig = toml::from_str(&user_config)?;
                config = merge_config(config, parsed);
            }
        }

        // Override with environment variables
        config = config_from_env(config)?;

        Ok(config)
    }
}

/// Sandbox configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// Use bubblewrap for sandboxing
    #[serde(default = "default_true")]
    pub use_bubblewrap: bool,

    /// Path to bubblewrap binary
    #[serde(default = "default_bwrap_path")]
    pub bwrap_path: PathBuf,

    /// Default mounts for sandbox
    #[serde(default)]
    pub default_mounts: Vec<MountConfig>,

    /// Network access (none, host, or isolated)
    #[serde(default = "default_network")]
    pub network: NetworkMode,

    /// Maximum memory per session (in MB)
    #[serde(default = "default_max_memory")]
    pub max_memory_mb: u64,

    /// Maximum CPU time per session (in seconds, 0 = unlimited)
    #[serde(default)]
    pub max_cpu_time_secs: u64,

    /// Read-only root
    #[serde(default = "default_true")]
    pub read_only_root: bool,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            use_bubblewrap: true,
            bwrap_path: default_bwrap_path(),
            default_mounts: vec![
                MountConfig {
                    source: "/workspace".into(),
                    destination: "/workspace".into(),
                    read_only: false,
                },
                MountConfig {
                    source: "/tmp".into(),
                    destination: "/tmp".into(),
                    read_only: false,
                },
            ],
            network: NetworkMode::Host,
            max_memory_mb: default_max_memory(),
            max_cpu_time_secs: 0,
            read_only_root: true,
        }
    }
}

/// Mount configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountConfig {
    pub source: PathBuf,
    pub destination: PathBuf,
    #[serde(default)]
    pub read_only: bool,
}

/// Network mode for sandbox
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkMode {
    /// No network access
    None,
    /// Host network (unrestricted)
    Host,
    /// Isolated network namespace
    Isolated,
}

impl Default for NetworkMode {
    fn default() -> Self {
        NetworkMode::Host
    }
}

/// Toolchain configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolchainConfig {
    /// Node.js path
    pub node_path: Option<PathBuf>,
    /// NPM path
    pub npm_path: Option<PathBuf>,
    /// Python path
    pub python_path: Option<PathBuf>,
    /// Python pip path
    pub pip_path: Option<PathBuf>,
    /// Docker path
    pub docker_path: Option<PathBuf>,
    /// Rust cargo path
    pub cargo_path: Option<PathBuf>,
    /// Git path
    pub git_path: Option<PathBuf>,
}

impl Default for ToolchainConfig {
    fn default() -> Self {
        Self {
            node_path: Some("/usr/bin/node".into()),
            npm_path: Some("/usr/bin/npm".into()),
            python_path: Some("/usr/bin/python3".into()),
            pip_path: Some("/usr/bin/pip3".into()),
            docker_path: Some("/usr/bin/docker".into()),
            cargo_path: Some("/usr/bin/cargo".into()),
            git_path: Some("/usr/bin/git".into()),
        }
    }
}

// Default value functions
fn default_vsock_port() -> u32 {
    8080
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_max_sessions() -> usize {
    50
}

fn default_workspace_path() -> PathBuf {
    "/workspace".into()
}

fn default_true() -> bool {
    true
}

fn default_bwrap_path() -> PathBuf {
    "/usr/bin/bwrap".into()
}

fn default_network() -> NetworkMode {
    NetworkMode::Host
}

fn default_max_memory() -> u64 {
    2048 // 2GB
}

/// Merge two configurations (newer overrides older)
fn merge_config(base: ExecutorConfig, override_: ExecutorConfig) -> ExecutorConfig {
    ExecutorConfig {
        vsock_port: override_.vsock_port,
        tcp_port: override_.tcp_port.or(base.tcp_port),
        sandbox: override_.sandbox,
        log_level: if override_.log_level != default_log_level() {
            override_.log_level
        } else {
            base.log_level
        },
        max_sessions: override_.max_sessions,
        session_timeout_secs: override_.session_timeout_secs,
        workspace_path: override_.workspace_path,
        toolchains: override_.toolchains,
    }
}

/// Apply environment variable overrides
fn config_from_env(mut config: ExecutorConfig) -> anyhow::Result<ExecutorConfig> {
    if let Ok(port) = std::env::var("Allternit_VSOCK_PORT") {
        config.vsock_port = port.parse()?;
    }

    if let Ok(port) = std::env::var("Allternit_TCP_PORT") {
        config.tcp_port = Some(port.parse()?);
    }

    if let Ok(level) = std::env::var("Allternit_LOG_LEVEL") {
        config.log_level = level;
    }

    if let Ok(sessions) = std::env::var("Allternit_MAX_SESSIONS") {
        config.max_sessions = sessions.parse()?;
    }

    if let Ok(timeout) = std::env::var("Allternit_SESSION_TIMEOUT") {
        config.session_timeout_secs = timeout.parse()?;
    }

    if let Ok(workspace) = std::env::var("Allternit_WORKSPACE_PATH") {
        config.workspace_path = workspace.into();
    }

    Ok(config)
}
