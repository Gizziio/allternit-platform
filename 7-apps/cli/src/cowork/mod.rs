//! Cowork CLI commands - Terminal-based run management
//!
//! Provides commands for:
//! - `a2r cowork start <entrypoint>` - Start a new cowork run
//! - `a2r cowork attach <run_id>` - Attach to an existing run
//! - `a2r cowork detach` - Detach from current run (keep running)
//! - `a2r cowork list` - List active cowork runs
//! - `a2r cowork logs <run_id>` - View logs from a run
//! - `a2r cowork status` - Show current attachment status

use clap::{Args, Subcommand};
use colored::Colorize;
use std::io::{self, Write};
use std::process;

pub mod attach;
pub mod detach;
pub mod list;
pub mod logs;
pub mod start;
pub mod status;

/// Cowork subcommand arguments
#[derive(Args, Debug)]
pub struct CoworkArgs {
    #[command(subcommand)]
    pub command: CoworkCommand,
}

/// Available cowork commands
#[derive(Subcommand, Debug)]
pub enum CoworkCommand {
    /// Start a new cowork run (persistent, remote execution)
    Start(start::StartArgs),

    /// Attach to an existing cowork run
    Attach(attach::AttachArgs),

    /// Detach from the current run (keeps running remotely)
    Detach(detach::DetachArgs),

    /// List active cowork runs
    List(list::ListArgs),

    /// View logs from a cowork run
    Logs(logs::LogsArgs),

    /// Show current attachment status
    Status(status::StatusArgs),
}

/// Execute a cowork command
pub async fn execute(args: CoworkArgs) -> anyhow::Result<()> {
    match args.command {
        CoworkCommand::Start(start_args) => start::execute(start_args).await,
        CoworkCommand::Attach(attach_args) => attach::execute(attach_args).await,
        CoworkCommand::Detach(detach_args) => detach::execute(detach_args).await,
        CoworkCommand::List(list_args) => list::execute(list_args).await,
        CoworkCommand::Logs(logs_args) => logs::execute(logs_args).await,
        CoworkCommand::Status(status_args) => status::execute(status_args).await,
    }
}

/// Print a formatted header
pub fn print_header(title: &str) {
    println!("\n{}", "─".repeat(60).dimmed());
    println!("  {}", title.bold());
    println!("{}\n", "─".repeat(60).dimmed());
}

/// Print a success message
pub fn print_success(message: &str) {
    println!("  {} {}", "✓".green().bold(), message);
}

/// Print an error message
pub fn print_error(message: &str) {
    eprintln!("  {} {}", "✗".red().bold(), message);
}

/// Print an info message
pub fn print_info(label: &str, value: &str) {
    println!("  {:20} {}", label.dimmed(), value);
}

/// Confirm an action with the user
pub fn confirm(prompt: &str) -> bool {
    print!("{} {} ", "?".yellow().bold(), prompt);
    io::stdout().flush().unwrap();

    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();

    matches!(input.trim().to_lowercase().as_str(), "y" | "yes")
}

/// Get the API base URL from environment or default
pub fn get_api_url() -> String {
    std::env::var("A2R_API_URL").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string())
}

/// Get the session ID for this CLI instance
pub fn get_session_id() -> String {
    // In a real implementation, this would be persisted to a config file
    // For now, generate a new one each time
    format!("cli-{}", uuid::Uuid::new_v4())
}

/// Read the current attachment from a state file
pub fn get_current_attachment() -> anyhow::Result<Option<AttachmentState>> {
    let state_path = dirs::cache_dir()
        .map(|d| d.join("a2r").join("cowork-state.json"))
        .ok_or_else(|| anyhow::anyhow!("Could not determine cache directory"))?;

    if !state_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&state_path)?;
    let state: AttachmentState = serde_json::from_str(&content)?;

    Ok(Some(state))
}

/// Save the current attachment to a state file
pub fn save_attachment_state(state: &AttachmentState) -> anyhow::Result<()> {
    let cache_dir = dirs::cache_dir()
        .map(|d| d.join("a2r"))
        .ok_or_else(|| anyhow::anyhow!("Could not determine cache directory"))?;

    std::fs::create_dir_all(&cache_dir)?;

    let state_path = cache_dir.join("cowork-state.json");
    let content = serde_json::to_string_pretty(state)?;
    std::fs::write(&state_path, content)?;

    Ok(())
}

/// Clear the attachment state (on detach)
pub fn clear_attachment_state() -> anyhow::Result<()> {
    let state_path = dirs::cache_dir()
        .map(|d| d.join("a2r").join("cowork-state.json"));

    if let Some(path) = state_path {
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
    }

    Ok(())
}

/// Attachment state stored locally
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AttachmentState {
    pub run_id: String,
    pub attachment_id: String,
    pub reconnect_token: String,
    pub last_cursor: String,
}
