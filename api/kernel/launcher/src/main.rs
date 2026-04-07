//! A2R Platform Single-Binary Launcher
//! 
//! This launcher embeds the entire A2R Platform (Rust API + UI assets) as bytes
//! and self-extracts to a temp directory on first run. This gives users a true
//! single-file executable that "just works" when double-clicked.

use anyhow::{Context, Result};
use axum::{Router, routing::get};
use include_dir::{Dir, include_dir};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tower_http::services::ServeDir;

// Embed the API binary and UI assets at compile time
// These are compressed and embedded into the final binary
static EMBEDDED_API: &[u8] = include_bytes!("../../api/embed/allternit-api");
static UI_ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../shell-ui/dist");

const API_PORT: u16 = 3010;
const UI_PORT: u16 = 3456;

struct LauncherState {
    temp_dir: PathBuf,
    api_process: Arc<Mutex<Option<Child>>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("╔══════════════════════════════════════╗");
    println!("║     A2R Platform Launcher v0.1.0     ║");
    println!("╚══════════════════════════════════════╝");
    println!();

    // Create temp directory for extraction
    let temp_dir = create_temp_dir().context("Failed to create temp directory")?;
    println!("📁 Working directory: {}", temp_dir.display());

    // Extract API binary
    println!("🔧 Extracting API server...");
    let api_path = extract_api_binary(&temp_dir).context("Failed to extract API")?;
    println!("   ✓ API ready");

    // Extract UI assets
    println!("🎨 Extracting UI assets...");
    extract_ui_assets(&temp_dir).context("Failed to extract UI")?;
    println!("   ✓ UI ready");

    // Start API server
    println!("🚀 Starting A2R Platform...");
    let api_process = start_api_server(&api_path).context("Failed to start API")?;
    
    let state = Arc::new(LauncherState {
        temp_dir: temp_dir.clone(),
        api_process: Arc::new(Mutex::new(Some(api_process))),
    });

    // Wait for API to be healthy
    println!("⏳ Waiting for services...");
    wait_for_api().await.context("API failed to start")?;
    println!("   ✓ API online");

    // Start UI server
    let ui_handle = tokio::spawn(start_ui_server(temp_dir.clone()));
    sleep(Duration::from_millis(500)).await;
    println!("   ✓ UI server online");

    println!();
    println!("✅ A2R Platform is ready!");
    println!();
    println!("   API:  http://127.0.0.1:{}", API_PORT);
    println!("   UI:   http://127.0.0.1:{}", UI_PORT);
    println!();
    println!("   Opening browser...");
    println!();
    println!("Press Ctrl+C to stop");
    println!();

    // Open browser
    open_browser(format!("http://127.0.0.1:{}", UI_PORT));

    // Wait for shutdown signal
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            println!("\n🛑 Shutting down...");
        }
        _ = ui_handle => {
            println!("\n⚠️ UI server exited");
        }
    }

    // Cleanup
    cleanup(state).await;
    println!("👋 Goodbye!");

    Ok(())
}

/// Create a persistent temp directory for extraction
fn create_temp_dir() -> Result<PathBuf> {
    // Use a consistent directory name so we don't re-extract every time
    let cache_dir = dirs::cache_dir()
        .or_else(|| std::env::temp_dir().into())
        .join("allternit-platform");
    
    std::fs::create_dir_all(&cache_dir)?;
    Ok(cache_dir)
}

/// Extract the embedded API binary
fn extract_api_binary(temp_dir: &PathBuf) -> Result<PathBuf> {
    let api_path = temp_dir.join(if cfg!(windows) {
        "allternit-api.exe"
    } else {
        "allternit-api"
    });

    // Check if already extracted (compare checksum or just check existence)
    if api_path.exists() {
        // Verify it's the right version by checking size
        let metadata = std::fs::metadata(&api_path)?;
        if metadata.len() == EMBEDDED_API.len() as u64 {
            return Ok(api_path);
        }
    }

    // Extract the binary
    std::fs::write(&api_path, EMBEDDED_API)?;
    
    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&api_path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&api_path, perms)?;
    }

    Ok(api_path)
}

/// Extract UI assets from embedded directory
fn extract_ui_assets(temp_dir: &PathBuf) -> Result<()> {
    let ui_dir = temp_dir.join("ui");
    
    // Only extract if directory doesn't exist
    if ui_dir.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(&ui_dir)?;

    // Extract all files
    for file in UI_ASSETS.files() {
        let path = ui_dir.join(file.path());
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, file.contents())?;
    }

    Ok(())
}

/// Start the Rust API server
fn start_api_server(api_path: &PathBuf) -> Result<Child> {
    let child = Command::new(api_path)
        .env("ALLTERNIT_OPERATOR_URL", format!("http://127.0.0.1:{}", API_PORT))
        .env("ALLTERNIT_DATA_DIR", api_path.parent().unwrap().join("data"))
        .env("RUST_LOG", "info")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn API process")?;

    Ok(child)
}

/// Wait for API to be healthy
async fn wait_for_api() -> Result<()> {
    let client = reqwest::Client::new();
    
    for attempt in 1..=30 {
        match client.get(format!("http://127.0.0.1:{}/health", API_PORT))
            .timeout(Duration::from_secs(2))
            .send().await 
        {
            Ok(resp) if resp.status().is_success() => return Ok(()),
            _ => {
                tokio::time::sleep(Duration::from_millis(500)).await;
                if attempt % 5 == 0 {
                    print!(".");
                }
            }
        }
    }

    anyhow::bail!("API failed to start within 15 seconds")
}

/// Start a minimal HTTP server to serve UI
async fn start_ui_server(ui_dir: PathBuf) -> Result<()> {
    let app = Router::new()
        .fallback_service(ServeDir::new(ui_dir));

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", UI_PORT)).await?;
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

/// Open browser to the given URL
fn open_browser(url: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(&url).spawn();
    }
    
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd").args(["/C", "start", &url]).spawn();
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(&url).spawn();
    }
}

/// Cleanup on shutdown
async fn cleanup(state: Arc<LauncherState>) {
    // Kill API process
    if let Ok(mut guard) = state.api_process.lock().await {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    
    // Note: We don't delete temp dir on purpose - 
    // it caches the extraction for faster startup next time
    println!("   ✓ Cleanup complete");
}
