//! Legacy Platform Orchestrator (wrapper)
//!
//! This wrapper forwards to the new orchestrator in
//! `4-services/orchestration/platform-orchestration-service`.

use std::path::PathBuf;
use std::process::Command;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

fn main() {
    let root = workspace_root();

    println!("🚀 Starting A2rchitech Platform Orchestrator (legacy wrapper)");
    println!("===========================================");
    println!("→ Delegating to 4-services/orchestration/platform-orchestration-service");

    let status = Command::new("cargo")
        .args(["run", "-p", "a2rchitech-platform"])
        .current_dir(root)
        .status()
        .expect("failed to spawn orchestrator");

    if !status.success() {
        eprintln!("❌ Orchestrator exited with status: {status}");
        std::process::exit(1);
    }
}
