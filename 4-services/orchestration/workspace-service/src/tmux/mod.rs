//! Tmux integration module
//!
//! Provides low-level tmux command execution and high-level session management.

mod client;
mod commands;

pub use client::TmuxClient;
pub use commands::*;

use crate::types::{ErrorResponse, Pane, Session, SessionConfig, SessionStatus};
use chrono::Utc;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, error, trace, warn};

/// Result type for tmux operations
pub type TmuxResult<T> = Result<T, ErrorResponse>;

/// Check if tmux is installed and available
pub async fn check_tmux() -> bool {
    Command::new("tmux")
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Execute a tmux command and return stdout
async fn tmux_exec(args: &[String]) -> TmuxResult<String> {
    trace!("Executing tmux command: tmux {:?}", args);

    let output = Command::new("tmux")
        .args(args)
        .output()
        .await
        .map_err(|e| {
            error!("Failed to execute tmux: {}", e);
            ErrorResponse::new("TMUX_EXEC_FAILED", "Failed to execute tmux command")
                .with_details(e.to_string())
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("tmux command failed: {}", stderr);
        return Err(
            ErrorResponse::new("TMUX_COMMAND_FAILED", "tmux command returned error")
                .with_details(stderr.to_string()),
        );
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Execute a tmux command, ignoring output
async fn tmux_run(args: &[String]) -> TmuxResult<()> {
    tmux_exec(args).await?;
    Ok(())
}

/// Check if a tmux session exists
pub async fn session_exists(name: &str) -> bool {
    let result = Command::new("tmux")
        .args(["has-session".to_string(), "-t".to_string(), name.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await;

    matches!(result, Ok(status) if status.success())
}

/// Create a new tmux session
pub async fn create_session(config: &SessionConfig) -> TmuxResult<Session> {
    debug!("Creating tmux session: {}", config.name);

    let mut args = vec![
        "new-session".to_string(),
        "-d".to_string(),
        "-s".to_string(),
        config.name.clone(),
    ];

    // Set working directory
    if let Some(dir) = &config.working_dir {
        args.push("-c".to_string());
        args.push(dir.clone());
    }

    // Add environment variables
    for (key, value) in &config.env {
        args.push("-e".to_string());
        args.push(format!("{}={}", key, value));
    }

    tmux_run(&args).await?;

    // Get session info
    get_session(&config.name).await
}

/// Get session information
pub async fn get_session(name: &str) -> TmuxResult<Session> {
    let format = "#{session_name}\t#{session_windows}\t#{session_panes}\t#{session_attached}\t#{session_created}".to_string();

    let output = tmux_exec(&["list-sessions".to_string(), "-F".to_string(), format]).await?;

    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 5 && parts[0] == name {
            return Ok(Session {
                id: parts[0].to_string(),
                name: parts[0].to_string(),
                status: if parts[3] == "1" {
                    SessionStatus::Attached
                } else {
                    SessionStatus::Detached
                },
                windows: parts[1].parse().unwrap_or(0),
                panes: parts[2].parse().unwrap_or(0),
                attached: parts[3] == "1",
                working_dir: None,
                metadata: Default::default(),
                created_at: Utc::now(),
                last_activity: Utc::now(),
            });
        }
    }

    Err(ErrorResponse::new("SESSION_NOT_FOUND", format!("Session '{}' not found", name)))
}

/// List all tmux sessions
pub async fn list_sessions() -> TmuxResult<Vec<Session>> {
    let format = "#{session_name}\t#{session_windows}\t#{session_panes}\t#{session_attached}".to_string();

    let output = match tmux_exec(&["list-sessions".to_string(), "-F".to_string(), format]).await {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()), // No sessions
    };

    let mut sessions = Vec::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 4 {
            sessions.push(Session {
                id: parts[0].to_string(),
                name: parts[0].to_string(),
                status: if parts[3] == "1" {
                    SessionStatus::Attached
                } else {
                    SessionStatus::Detached
                },
                windows: parts[1].parse().unwrap_or(0),
                panes: parts[2].parse().unwrap_or(0),
                attached: parts[3] == "1",
                working_dir: None,
                metadata: Default::default(),
                created_at: Utc::now(),
                last_activity: Utc::now(),
            });
        }
    }

    Ok(sessions)
}

/// Kill a tmux session
pub async fn kill_session(name: &str) -> TmuxResult<()> {
    debug!("Killing tmux session: {}", name);
    tmux_run(&["kill-session".to_string(), "-t".to_string(), name.to_string()]).await
}

/// Create a new pane in a session
pub async fn create_pane(
    session: &str,
    command: Option<&str>,
) -> TmuxResult<Pane> {
    debug!("Creating pane in session: {}", session);

    let mut args = vec![
        "split-window".to_string(),
        "-t".to_string(),
        session.to_string(),
    ];

    if let Some(cmd) = command {
        args.push(cmd.to_string());
    }

    tmux_run(&args).await?;

    // Get the new pane ID
    let output = tmux_exec(&[
        "list-panes".to_string(),
        "-t".to_string(),
        session.to_string(),
        "-F".to_string(),
        "#{pane_id}".to_string(),
    ])
    .await?;
    let pane_id = output.lines().last().unwrap_or("%0").to_string();

    Ok(Pane {
        id: pane_id,
        session_id: session.to_string(),
        window_index: 0,
        pane_index: 0,
        title: "New Pane".to_string(),
        current_command: command.map(|s| s.to_string()),
        metadata: Default::default(),
        created_at: Utc::now(),
    })
}

/// List panes in a session
pub async fn list_panes(session: &str) -> TmuxResult<Vec<Pane>> {
    let format = "#{pane_id}\t#{pane_index}\t#{window_index}\t#{pane_title}\t#{pane_current_command}".to_string();

    let output = tmux_exec(&[
        "list-panes".to_string(),
        "-t".to_string(),
        session.to_string(),
        "-F".to_string(),
        format,
    ]).await?;

    let mut panes = Vec::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 5 {
            panes.push(Pane {
                id: parts[0].to_string(),
                session_id: session.to_string(),
                window_index: parts[2].parse().unwrap_or(0),
                pane_index: parts[1].parse().unwrap_or(0),
                title: parts[3].to_string(),
                current_command: if parts[4].is_empty() {
                    None
                } else {
                    Some(parts[4].to_string())
                },
                metadata: Default::default(),
                created_at: Utc::now(),
            });
        }
    }

    Ok(panes)
}

/// Capture pane output
pub async fn capture_pane(pane_id: &str, lines: Option<usize>) -> TmuxResult<String> {
    let mut args = vec![
        "capture-pane".to_string(),
        "-p".to_string(),
        "-t".to_string(),
        pane_id.to_string(),
    ];

    if let Some(n) = lines {
        args.push("-S".to_string());
        args.push(format!("-{}", n));
    }

    tmux_exec(&args).await
}

/// Send keys to a pane
pub async fn send_keys(pane_id: &str, keys: &str) -> TmuxResult<()> {
    tmux_run(&[
        "send-keys".to_string(),
        "-t".to_string(),
        pane_id.to_string(),
        keys.to_string(),
    ])
    .await
}

/// Kill a pane
pub async fn kill_pane(pane_id: &str) -> TmuxResult<()> {
    debug!("Killing pane: {}", pane_id);
    tmux_run(&["kill-pane".to_string(), "-t".to_string(), pane_id.to_string()]).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_tmux() {
        // This test just checks if tmux is available
        let available = check_tmux().await;
        println!("tmux available: {}", available);
    }
}
