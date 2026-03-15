//! Driver selection logic based on platform and context
//!
//! | Context            | Platform | Default Driver    | --vm Flag Driver  |
//! |--------------------|----------|-------------------|-------------------|
//! | Desktop App        | macOS    | Apple VF          | N/A               |
//! | CLI local          | macOS    | Shared Apple VF   | Ephemeral Apple VF|
//! | Desktop App        | Linux    | Firecracker       | N/A               |
//! | CLI local          | Linux    | Process           | Firecracker       |
//! | SSH/VPS            | Linux    | Firecracker       | N/A               |
//! | CI/CD              | Linux    | Firecracker       | N/A               |

use tracing::{info, warn};

use crate::config::{Config, DriverPreference};
use crate::error::{CliError, Result};
use crate::sessions::{SessionManager, macos::MacSessionMode, linux::LinuxSessionMode};

/// Execution context
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub platform: Platform,
    pub mode: ExecutionMode,
    pub use_vm: bool,
}

#[derive(Debug, Clone)]
pub enum Platform {
    MacOS,
    Linux,
    Unknown(String),
}

#[derive(Debug, Clone)]
pub enum ExecutionMode {
    /// Desktop application (GUI)
    Desktop,
    /// Local CLI execution
    Cli,
    /// SSH remote session
    Ssh,
    /// CI/CD pipeline
    Ci,
}

impl ExecutionContext {
    /// Detect current execution context
    pub fn detect(use_vm_flag: bool) -> Self {
        let platform = detect_platform();
        let mode = detect_mode();
        
        Self {
            platform,
            mode,
            use_vm: use_vm_flag,
        }
    }
}

/// Detect current platform
pub fn detect_platform() -> Platform {
    #[cfg(target_os = "macos")]
    return Platform::MacOS;
    
    #[cfg(target_os = "linux")]
    return Platform::Linux;
    
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    return Platform::Unknown(std::env::consts::OS.to_string());
}

/// Detect execution mode
pub fn detect_mode() -> ExecutionMode {
    use crate::config::{is_ssh_session, is_ci_environment};
    
    if is_ci_environment() {
        ExecutionMode::Ci
    } else if is_ssh_session() {
        ExecutionMode::Ssh
    } else if is_desktop_app() {
        ExecutionMode::Desktop
    } else {
        ExecutionMode::Cli
    }
}

/// Check if running inside desktop app
fn is_desktop_app() -> bool {
    // Desktop app sets A2R_DESKTOP=1
    std::env::var("A2R_DESKTOP").is_ok()
}

/// Select and create appropriate session manager
pub async fn select_session_manager(
    context: ExecutionContext,
    _config: &Config,
) -> Result<SessionManager> {
    match (&context.platform, &context.mode, context.use_vm) {
        // macOS Desktop App - always Apple VF
        #[cfg(target_os = "macos")]
        (Platform::MacOS, ExecutionMode::Desktop, _) => {
            info!("Using Apple VF driver for desktop app");
            
            // Desktop app uses a persistent VM
            warn!("Desktop app mode - session manager uses Apple VF driver internally");
            
            // Fall back to creating a shared session
            SessionManager::new(false).await
        }
        
        // macOS Desktop on non-macOS platform (shouldn't happen)
        #[cfg(not(target_os = "macos"))]
        (Platform::MacOS, ExecutionMode::Desktop, _) => {
            Err(CliError::Vm(
                "Apple Virtualization.framework is only available on macOS".to_string()
            ))
        }
        
        // macOS CLI - shared VM (default) or ephemeral (--vm)
        (Platform::MacOS, ExecutionMode::Cli, false) => {
            info!("Using shared macOS VM");
            SessionManager::new(false).await
        }
        (Platform::MacOS, ExecutionMode::Cli, true) => {
            info!("Using ephemeral macOS VM");
            SessionManager::new(true).await
        }
        
        // Linux Desktop App - Firecracker
        (Platform::Linux, ExecutionMode::Desktop, _) => {
            info!("Using Firecracker driver for desktop app");
            
            // Desktop app manages VMs internally
            warn!("Desktop app mode - session manager uses Firecracker driver internally");
            
            // Fall back to creating a VM session
            SessionManager::new(true).await
        }
        
        // Linux CLI - process driver (default) or Firecracker (--vm)
        (Platform::Linux, ExecutionMode::Cli, false) => {
            info!("Using process driver for local CLI");
            SessionManager::new(false).await
        }
        (Platform::Linux, ExecutionMode::Cli, true) => {
            info!("Using Firecracker driver (--vm flag)");
            SessionManager::new(true).await
        }
        
        // SSH/VPS - always Firecracker (isolation required)
        (Platform::Linux, ExecutionMode::Ssh, _) => {
            info!("Using Firecracker driver for SSH session");
            SessionManager::new(true).await
        }
        
        // CI/CD - always Firecracker
        (Platform::Linux, ExecutionMode::Ci, _) => {
            info!("Using Firecracker driver for CI/CD");
            SessionManager::new(true).await
        }
        
        // Unknown platform
        (Platform::Unknown(os), _, _) => {
            Err(CliError::PlatformNotSupported(os.clone()))
        }
        
        // macOS SSH and CI - not yet supported
        (Platform::MacOS, ExecutionMode::Ssh, _) => {
            Err(CliError::PlatformNotSupported(
                "SSH sessions on macOS not yet supported".to_string()
            ))
        }
        (Platform::MacOS, ExecutionMode::Ci, _) => {
            Err(CliError::PlatformNotSupported(
                "CI mode on macOS not yet supported".to_string()
            ))
        }
    }
}

/// Get driver description for status display
pub fn get_driver_description(context: &ExecutionContext) -> &'static str {
    match (&context.platform, &context.mode, context.use_vm) {
        (Platform::MacOS, ExecutionMode::Desktop, _) => "Apple Virtualization.framework",
        (Platform::MacOS, ExecutionMode::Cli, false) => "Apple VF (shared)",
        (Platform::MacOS, ExecutionMode::Cli, true) => "Apple VF (ephemeral)",
        (Platform::Linux, ExecutionMode::Desktop, _) => "Firecracker MicroVM",
        (Platform::Linux, ExecutionMode::Cli, false) => "Process (namespace+seccomp)",
        (Platform::Linux, ExecutionMode::Cli, true) => "Firecracker MicroVM",
        (Platform::Linux, ExecutionMode::Ssh, _) => "Firecracker MicroVM (isolated)",
        (Platform::Linux, ExecutionMode::Ci, _) => "Firecracker MicroVM",
        _ => "Unknown",
    }
}
