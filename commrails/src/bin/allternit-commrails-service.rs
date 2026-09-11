//! Allternit CommRails - HTTP Service Binary
//!
//! Run: cargo run --bin allternit-commrails-service

use std::path::PathBuf;

/// Read an env var, preferring the new `ALLTERNIT_COMMRAILS_*` name and
/// falling back to the legacy `ALLTERNIT_RAILS_*` name for one release.
fn env_pref(new: &str, old: &str) -> Option<String> {
    std::env::var(new)
        .ok()
        .or_else(|| std::env::var(old).ok())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let host = env_pref("ALLTERNIT_COMMRAILS_HOST", "ALLTERNIT_RAILS_HOST")
        .unwrap_or_else(|| "127.0.0.1".to_string());
    let port = env_pref("ALLTERNIT_COMMRAILS_PORT", "ALLTERNIT_RAILS_PORT")
        .unwrap_or_else(|| "3011".to_string());
    let bind_addr = format!("{}:{}", host, port);

    let root_dir = env_pref("ALLTERNIT_COMMRAILS_ROOT", "ALLTERNIT_RAILS_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap());

    tracing::info!("Starting Allternit CommRails HTTP service");
    tracing::info!("Bind address: {}", bind_addr);
    tracing::info!("Root directory: {}", root_dir.display());

    allternit_commrails::service::run_service(&bind_addr, root_dir).await
}
