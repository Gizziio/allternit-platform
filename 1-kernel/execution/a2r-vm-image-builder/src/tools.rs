//! Toolchain management utilities

use std::path::Path;
use tracing::{info, warn};

/// Check if a command is available
pub fn check_command(cmd: &str) -> bool {
    match std::process::Command::new("which")
        .arg(cmd)
        .output()
    {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Get command version
pub fn get_version(cmd: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(cmd)
        .args(args)
        .output()
        .ok()?;
    
    if output.status.success() {
        String::from_utf8(output.stdout)
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    }
}

/// Verify all required tools are available
pub fn verify_build_tools() -> Result<(), Vec<String>> {
    let required = vec![
        ("debootstrap", "Debian bootstrap tool"),
        ("sudo", "Superuser do"),
        ("truncate", "Create sparse files"),
        ("mkfs.ext4", "EXT4 filesystem creation"),
    ];

    let mut missing = Vec::new();

    for (cmd, desc) in required {
        if !check_command(cmd) {
            missing.push(format!("{} ({})", cmd, desc));
        }
    }

    if missing.is_empty() {
        Ok(())
    } else {
        Err(missing)
    }
}

/// Print build prerequisites
pub fn print_prerequisites() {
    info!("Build Prerequisites:");
    info!("  - Linux system (or Linux VM on macOS)");
    info!("  - debootstrap: sudo apt-get install debootstrap");
    info!("  - sudo access");
    info!("  - Rust toolchain: https://rustup.rs");
    info!("  - 10+ GB free disk space");
    info!("");
    info!("Note: Local building is only supported on Linux.");
    info!("      On macOS, use 'download' mode instead.");
}

/// Check available disk space
pub fn check_disk_space(path: &Path, required_mb: u64) -> bool {
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        let output = Command::new("df")
            .args(&["-m", "-P", path.to_str().unwrap_or(".")])
            .output();

        if let Ok(output) = output {
            if let Ok(text) = String::from_utf8(output.stdout) {
                // Parse df output: Filesystem 1M-blocks Used Available Use% Mounted
                for line in text.lines().skip(1) {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        if let Ok(available) = parts[3].parse::<u64>() {
                            return available >= required_mb;
                        }
                    }
                }
            }
        }
    }

    // Default to true if we can't check
    true
}

/// Get system architecture
pub fn get_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        arch => arch,
    }
}

/// Verify downloaded file integrity
pub async fn verify_file(path: &Path, expected_size: Option<u64>) -> bool {
    match tokio::fs::metadata(path).await {
        Ok(metadata) => {
            if let Some(expected) = expected_size {
                let actual = metadata.len();
                if actual != expected {
                    warn!(
                        "File size mismatch for {}: expected {}, got {}",
                        path.display(),
                        expected,
                        actual
                    );
                    return false;
                }
            }
            true
        }
        Err(e) => {
            warn!("Failed to read file metadata for {}: {}", path.display(), e);
            false
        }
    }
}
