//! Status command - Show A2R status and connectivity

use colored::Colorize;
use console::style;

use crate::config::{is_ci_environment, is_ssh_session, Config};
use crate::driver_selection::{detect_mode, ExecutionMode, detect_platform, Platform};
use crate::error::Result;

/// Show A2R status
pub async fn show_status(config: Config) -> Result<()> {
    println!("{}", "A2R Status".bold().underline());
    println!();
    
    // Platform info
    let platform = detect_platform();
    println!("{:<20} {}", "Platform:", format_platform(&platform));
    
    // Execution mode
    let mode = detect_mode();
    println!("{:<20} {}", "Mode:", format_mode(&mode));
    
    // Configuration
    println!("{:<20} {}", "API Endpoint:", config.api_endpoint);
    println!("{:<20} {}", 
        "Auth:", 
        if config.auth_token.is_some() { 
            "✓ Authenticated".green() 
        } else { 
            "✗ Not authenticated".yellow() 
        }
    );
    
    // Environment detection
    if is_ssh_session() {
        println!("{:<20} {}", "Environment:", "SSH Session".cyan());
    } else if is_ci_environment() {
        println!("{:<20} {}", "Environment:", "CI/CD".cyan());
    } else {
        println!("{:<20} {}", "Environment:", "Local".cyan());
    }
    
    // Desktop app status (macOS only)
    #[cfg(target_os = "macos")]
    {
        let desktop_running = config.macos.desktop_vm_socket.exists();
        println!("{:<20} {}", 
            "Desktop App:",
            if desktop_running {
                "✓ Running (shared VM available)".green()
            } else {
                "✗ Not running".yellow()
            }
        );
    }
    
    println!();
    println!("{}", "Default Settings".dimmed());
    println!("{:<20} {}s", "Timeout:", config.session_defaults.timeout_secs);
    println!("{:<20} {} MB", "Memory:", config.session_defaults.memory_mb);
    println!("{:<20} {}", "CPU:", config.session_defaults.cpu_cores);
    
    Ok(())
}

fn format_platform(platform: &Platform) -> String {
    match platform {
        Platform::MacOS => "macOS".to_string(),
        Platform::Linux => "Linux".to_string(),
        Platform::Unknown(os) => format!("Unknown ({})", os),
    }
}

fn format_mode(mode: &ExecutionMode) -> String {
    match mode {
        ExecutionMode::Desktop => "Desktop App".to_string(),
        ExecutionMode::Cli => "CLI".to_string(),
        ExecutionMode::Ssh => "SSH".to_string(),
        ExecutionMode::Ci => "CI/CD".to_string(),
    }
}
