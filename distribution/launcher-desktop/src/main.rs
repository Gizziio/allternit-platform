//! A2R Platform Desktop Launcher
//! 
//! This launcher starts both the API server and Electron shell,
//! creating a seamless desktop application experience.

use std::env;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

fn main() {
    println!("========================================");
    println!("A2R Platform Desktop");
    println!("========================================\n");

    // Find the launcher directory
    let launcher_path = env::current_exe()
        .expect("Failed to get current executable path");
    let launcher_dir = launcher_path
        .parent()
        .expect("Failed to get launcher directory");
    
    println!("App directory: {}", launcher_dir.display());

    // Determine paths
    let api_binary = launcher_dir.join("a2rchitech-api");
    let ui_path = launcher_dir.join("ui");
    let electron_dir = launcher_dir.join("electron");
    
    // Check for Electron executable
    let electron_exe = find_electron(&electron_dir);
    
    println!("API: {}", api_binary.display());
    println!("UI: {}", ui_path.display());
    if let Some(ref exe) = electron_exe {
        println!("Electron: {}", exe.display());
    }
    println!();

    // Verify paths exist
    if !api_binary.exists() {
        eprintln!("ERROR: API binary not found at: {}", api_binary.display());
        std::process::exit(1);
    }

    if electron_exe.is_none() {
        eprintln!("WARNING: Electron not found, will use browser mode");
    }

    // Set environment variables
    env::set_var("A2R_STATIC_DIR", &ui_path);
    env::set_var("A2R_OPERATOR_URL", "http://127.0.0.1:3010");
    
    // Determine data directory
    let data_dir = if cfg!(target_os = "macos") {
        dirs::data_dir()
            .map(|d| d.join("A2R Platform Desktop"))
            .unwrap_or_else(|| launcher_dir.join("data"))
    } else {
        dirs::data_dir()
            .map(|d| d.join("a2r-platform-desktop"))
            .unwrap_or_else(|| launcher_dir.join("data"))
    };
    
    env::set_var("A2R_DATA_DIR", &data_dir);
    println!("Data directory: {}\n", data_dir.display());

    // Create data directory
    std::fs::create_dir_all(&data_dir)
        .expect("Failed to create data directory");

    // Start API server
    println!("Starting API server...");
    let api_port = 3010u16;
    
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
            std::process::exit(1);
        });

    println!("API server started (PID: {})\n", api_child.id());

    // Wait for API to be ready
    println!("Waiting for API to be ready...");
    let api_url = format!("http://127.0.0.1:{}", api_port);
    let max_retries = 30;
    let mut ready = false;
    
    for i in 1..=max_retries {
        if is_api_ready(&api_url) {
            ready = true;
            println!("API is ready!\n");
            break;
        }
        if i == max_retries {
            eprintln!("ERROR: API failed to start within {} seconds", max_retries);
            let _ = api_child.kill();
            std::process::exit(1);
        }
        std::thread::sleep(std::time::Duration::from_secs(1));
        print!(".");
        std::io::Write::flush(&mut std::io::stdout()).unwrap();
    }
    println!();

    // Start Electron if available, otherwise open browser
    let electron_pid: Option<u32> = if let Some(electron_exe) = electron_exe {
        println!("Starting Electron shell...");
        
        match Command::new(&electron_exe)
            .arg(".")
            .env("A2R_OPERATOR_URL", &api_url)
            .env("A2R_STATIC_DIR", &ui_path)
            .current_dir(&electron_dir)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn() 
        {
            Ok(child) => {
                println!("Electron started (PID: {})\n", child.id());
                Some(child.id())
            }
            Err(e) => {
                eprintln!("Warning: Failed to start Electron: {}", e);
                println!("Falling back to browser mode...");
                open_browser(&api_url);
                None
            }
        }
    } else {
        println!("Opening browser...");
        open_browser(&api_url);
        None
    };

    println!("\n========================================");
    println!("A2R Platform Desktop is running!");
    println!("========================================");
    println!("API: {}", api_url);
    println!("Data: {}", data_dir.display());
    if electron_pid.is_some() {
        println!("Mode: Desktop (Electron)");
    } else {
        println!("Mode: Web Browser");
    }
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
    
    // Kill Electron if still running
    if let Some(pid) = electron_pid {
        println!("Stopping Electron (PID: {})...", pid);
        #[cfg(unix)]
        {
            let _ = Command::new("kill").arg("-9").arg(pid.to_string()).status();
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill").args(&["/F", "/PID", &pid.to_string()]).status();
        }
    }
}

fn find_electron(electron_dir: &PathBuf) -> Option<PathBuf> {
    // Try various Electron locations
    let candidates = if cfg!(target_os = "macos") {
        vec![
            electron_dir.join("node_modules/.bin/electron"),
            electron_dir.join("../node_modules/.bin/electron"),
            PathBuf::from("/Applications/Electron.app/Contents/MacOS/Electron"),
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            electron_dir.join("node_modules/.bin/electron.cmd"),
            electron_dir.join("../node_modules/.bin/electron.cmd"),
        ]
    } else {
        vec![
            electron_dir.join("node_modules/.bin/electron"),
            electron_dir.join("../node_modules/.bin/electron"),
            PathBuf::from("/usr/bin/electron"),
            PathBuf::from("/usr/local/bin/electron"),
        ]
    };

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // Try to find in PATH
    if let Ok(output) = Command::new("which").arg("electron").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

fn is_api_ready(url: &str) -> bool {
    // Simple check - try to connect to health endpoint
    if let Ok(output) = Command::new("curl")
        .args(&["-s", "-o", "/dev/null", "-w", "%{http_code}", &format!("{}/health", url)])
        .output() 
    {
        let code = String::from_utf8_lossy(&output.stdout);
        return code.trim() == "200";
    }
    false
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
            .spawn();
    }
    
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(&["/C", "start", url])
            .spawn();
    }
}
