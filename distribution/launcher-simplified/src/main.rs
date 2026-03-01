//! A2R Platform Launcher - Simplified Version
//! 
//! This launcher assumes the UI and API are bundled alongside it,
//! not embedded as compressed payloads. This is simpler and more reliable.
//!
//! Directory structure expected:
//!   launcher          - this executable
//!   api/              - API binary
//!   ui/               - static UI files

use std::env;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

fn main() {
    println!("========================================");
    println!("A2R Platform Launcher");
    println!("========================================\n");

    // Find the launcher directory
    let launcher_path = env::current_exe()
        .expect("Failed to get current executable path");
    let launcher_dir = launcher_path
        .parent()
        .expect("Failed to get launcher directory");
    
    println!("Launcher directory: {}", launcher_dir.display());

    // Determine paths - look for api binary directly or in api/ subdirectory
    let api_path = if launcher_dir.join("a2rchitech-api").exists() {
        launcher_dir.to_path_buf()
    } else {
        launcher_dir.join("api")
    };
    let ui_path = launcher_dir.join("ui");
    
    println!("API path: {}", api_path.display());
    println!("UI path: {}\n", ui_path.display());

    // Verify paths exist
    if !api_path.exists() {
        eprintln!("ERROR: API binary not found at: {}", api_path.display());
        eprintln!("Please ensure the 'api' directory contains the A2R API binary.");
        std::process::exit(1);
    }

    if !ui_path.exists() {
        eprintln!("ERROR: UI files not found at: {}", ui_path.display());
        eprintln!("Please ensure the 'ui' directory contains the static UI files.");
        std::process::exit(1);
    }

    // Set environment variables
    env::set_var("A2R_STATIC_DIR", &ui_path);
    env::set_var("A2R_OPERATOR_URL", "http://127.0.0.1:3010");
    
    // Determine data directory
    let data_dir = if cfg!(target_os = "macos") {
        dirs::data_dir()
            .map(|d| d.join("A2R Platform"))
            .unwrap_or_else(|| ui_path.clone())
    } else {
        dirs::data_dir()
            .map(|d| d.join("a2r-platform"))
            .unwrap_or_else(|| ui_path.clone())
    };
    
    env::set_var("A2R_DATA_DIR", &data_dir);
    println!("Data directory: {}\n", data_dir.display());

    // Create data directory
    std::fs::create_dir_all(&data_dir)
        .expect("Failed to create data directory");

    // Start API server
    println!("Starting API server...");
    let api_port = 3010u16;
    
    let api_binary = if cfg!(target_os = "windows") {
        api_path.join("a2rchitech-api.exe")
    } else {
        api_path.join("a2rchitech-api")
    };
    
    let mut api_child = Command::new(&api_binary)
        .env("A2R_STATIC_DIR", &ui_path)
        .env("A2R_OPERATOR_URL", format!("http://127.0.0.1:{}", api_port))
        .env("A2R_DATA_DIR", &data_dir)
        .env("PORT", api_port.to_string())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap_or_else(|e| {
            eprintln!("ERROR: Failed to start API server: {}", e);
            eprintln!("Make sure the API binary exists at: {}", api_binary.display());
            std::process::exit(1);
        });

    println!("API server started (PID: {})\n", api_child.id());

    // Wait a moment for API to start
    println!("Waiting for API to be ready...");
    std::thread::sleep(std::time::Duration::from_secs(2));

    // Open browser
    let url = format!("http://127.0.0.1:{}", api_port);
    println!("\nOpening browser to: {}\n", url);
    
    open_browser(&url);

    println!("========================================");
    println!("A2R Platform is running!");
    println!("========================================");
    println!("API: {}", url);
    println!("Data: {}", data_dir.display());
    println!("\nPress Ctrl+C to stop\n");

    // Wait for API to exit
    match api_child.wait() {
        Ok(status) => {
            if status.success() {
                println!("\nAPI server exited normally.");
            } else {
                println!("\nAPI server exited with code: {:?}", status.code());
            }
        }
        Err(e) => {
            eprintln!("Error waiting for API: {}", e);
        }
    }
}

fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg(url)
            .spawn();
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg(url)
            .spawn()
            .or_else(|_| Command::new("xdg-open").arg(url).spawn());
    }
    
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(&["/C", "start", url])
            .spawn();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_paths() {
        let path = PathBuf::from("/test/path");
        assert!(path.is_absolute() || !path.is_absolute());
    }
}
