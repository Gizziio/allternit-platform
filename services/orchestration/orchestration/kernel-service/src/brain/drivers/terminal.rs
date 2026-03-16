//! Terminal App Driver
//! 
//! PTY-based driver for interactive CLI applications.
//! This is for HUMAN INTERACTION only, not for chat brains.
//! 
//! Use cases:
//! - Interactive TUI sessions (claude-code, codex TUI mode)
//! - Terminal access to running CLI apps
//! - Manual debugging and inspection
//! 
//! NOT FOR: Automated chat, API-like interactions, programmatic tool use

use crate::brain::traits::{BrainDriver, BrainRuntime};
use crate::brain::types::{BrainConfig, BrainEvent, BrainType, EventMode};
use crate::terminal_manager::TerminalManager;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc};
use tracing::{error, info, warn};

/// Terminal App Driver - PTY-based interactive CLI
/// 
/// WARNING: This driver is for HUMAN INTERACTION ONLY.
/// Do NOT use for chat brains - output is unstructured (ANSI codes, banners, etc.)
pub struct TerminalAppDriver {
    terminal_manager: Arc<TerminalManager>,
}

impl TerminalAppDriver {
    pub fn new(terminal_manager: Arc<TerminalManager>) -> Self {
        Self { terminal_manager }
    }
}

#[async_trait]
impl BrainDriver for TerminalAppDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Cli)
    }

    /// Terminal driver only supports Terminal event mode
    /// Chat/API requests should use AcpProtocolDriver instead
    fn supports_with_config(&self, config: &BrainConfig) -> bool {
        // Only support CLI brains explicitly marked as Terminal
        // or without event_mode (backward compatibility)
        config.brain_type == BrainType::Cli
            && matches!(
                config.event_mode,
                Some(EventMode::Terminal) | None
            )
    }

    async fn create_runtime(
        &self,
        config: &BrainConfig,
        _session_id: &str,
    ) -> Result<Box<dyn BrainRuntime>> {
        let command = config
            .command
            .clone()
            .ok_or_else(|| anyhow!("No command specified for CLI brain"))?;
        let args = config.args.clone().unwrap_or_default();

        // Verify command exists before proceeding
        let command_path = resolve_command_path(&command)?;

        tracing::info!(
            "Verified CLI brain command: {} -> {}",
            command,
            command_path.display()
        );

        // Apply sandboxing if enabled
        let mut env = config.env.clone().unwrap_or_default();
        let mut cwd = config.cwd.clone().map(PathBuf::from);

        if let Some(sandbox) = &config.sandbox {
            if sandbox.workspace_only {
                // In a real implementation we might use a more robust sandbox
                // For now, we ensure cwd is set and scrub sensitive env vars
                env.retain(|k, _| {
                    !k.contains("KEY") && !k.contains("SECRET") && !k.contains("TOKEN")
                });
            }

            if !sandbox.network_enabled {
                // This would need OS-level support (unshare -n)
                // For now we just mark it or could use a wrapper
            }
        }

        let (tx, _) = broadcast::channel(10); // Small buffer - old terminal events dropped

        Ok(Box::new(TerminalAppRuntime {
            terminal_manager: self.terminal_manager.clone(),
            session_id: None,
            pid: None,
            config: CliRuntimeConfig {
                command,
                args,
                env: Some(env),
                cwd,
            },
            event_tx: tx,
            input_tx: None,
        }))
    }
}

struct CliRuntimeConfig {
    command: String,
    args: Vec<String>,
    env: Option<std::collections::HashMap<String, String>>,
    cwd: Option<PathBuf>,
}

pub struct TerminalAppRuntime {
    terminal_manager: Arc<TerminalManager>,
    session_id: Option<String>,
    pid: Option<u32>,
    config: CliRuntimeConfig,
    event_tx: broadcast::Sender<BrainEvent>,
    input_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
}

#[async_trait]
impl BrainRuntime for TerminalAppRuntime {
    async fn start(&mut self) -> Result<()> {
        info!("[TerminalAppRuntime] Starting CLI brain: {} {:?}", self.config.command, self.config.args);
        info!("[TerminalAppRuntime] Working directory: {:?}", self.config.cwd);

        // Verify the command exists before starting
        match resolve_command_path(&self.config.command) {
            Ok(path) => info!("[TerminalAppRuntime] Command found at: {}", path.display()),
            Err(e) => {
                tracing::error!(
                    "[TerminalAppRuntime] Command not found: {} - Error: {}",
                    self.config.command,
                    e
                );
                return Err(anyhow!("Command not found in PATH: {}", self.config.command));
            }
        }

        let session_id = self
            .terminal_manager
            .create_custom_session(
                &self.config.command,
                &self.config.args,
                self.config.cwd.clone(),
                self.config.env.clone(),
            )
            .await?;

        info!("[TerminalAppRuntime] PTY session created: {}", session_id);
        self.session_id = Some(session_id.clone());

        let session = self
            .terminal_manager
            .get_session(&session_id)
            .await
            .ok_or_else(|| anyhow!("Failed to get created session"))?;

        self.pid = session.pid;
        self.input_tx = Some(session.tx.clone());
        
        info!("[TerminalAppRuntime] Session started with PID: {:?}", self.pid);

        // Spawn reading task
        let master = session.master.clone();
        let tx = self.event_tx.clone();

        tokio::task::spawn_blocking(move || {
            let master_lock = master.lock().unwrap();
            let mut reader = master_lock.try_clone_reader().unwrap();
            let mut buf = [0u8; 1024];
            let mut line_buffer = String::new();
            let mut pending_plain_text = String::new();

            tracing::info!("[TerminalAppRuntime] Started reading from PTY for session");

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        tracing::info!("[TerminalAppRuntime] EOF reached");
                        break;
                    }, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]);
                        tracing::debug!("[TerminalAppRuntime] Read {} bytes: {:?}", n, &data[..data.len().min(100)]);

                        // Always emit raw terminal delta
                        let terminal_event = BrainEvent::TerminalDelta {
                            data: data.to_string(),
                            stream: "stdout".to_string(),
                            event_id: None,
                        };
                        if tx.send(terminal_event).is_err() {
                            tracing::error!("[TerminalAppRuntime] Failed to send terminal event");
                            break;
                        }

                        // Parse for structured JSON and plain text
                        for c in data.chars() {
                            if c == '\n' {
                                if !line_buffer.is_empty() {
                                    // Check if it's valid JSON
                                    if let Ok(json) =
                                        serde_json::from_str::<serde_json::Value>(&line_buffer)
                                    {
                                        // Flush any pending plain text as chat delta first
                                        if !pending_plain_text.is_empty() {
                                            let _ = tx.send(BrainEvent::ChatDelta {
                                                text: pending_plain_text.clone(),
                                                event_id: None,
                                            });
                                            pending_plain_text.clear();
                                        }

                                        // Detect Claude Code stream-json events
                                        if let Some(msg_type) =
                                            json.get("type").and_then(|v| v.as_str())
                                        {
                                            match msg_type {
                                                "text" => {
                                                    if let Some(content) =
                                                        json.get("content").and_then(|v| v.as_str())
                                                    {
                                                        let _ = tx.send(BrainEvent::ChatDelta {
                                                            text: content.to_string(),
                                                            event_id: None,
                                                        });
                                                    }
                                                }
                                                "message_stop" => {
                                                    let _ =
                                                        tx.send(BrainEvent::ChatMessageCompleted {
                                                            text: "".to_string(),
                                                            event_id: None,
                                                        });
                                                }
                                                "tool_use" => {
                                                    if let (Some(id), Some(name)) = (
                                                        json.get("id").and_then(|v| v.as_str()),
                                                        json.get("name").and_then(|v| v.as_str()),
                                                    ) {
                                                        let input = json
                                                            .get("input")
                                                            .map(|v| v.to_string())
                                                            .unwrap_or_else(|| "{}".to_string());
                                                        let _ = tx.send(BrainEvent::ToolCall {
                                                            tool_id: name.to_string(),
                                                            call_id: id.to_string(),
                                                            args: input,
                                                            event_id: None,
                                                        });
                                                    }
                                                }
                                                _ => {}
                                            }
                                        }
                                    } else {
                                        // Not valid JSON - treat as plain text
                                        // Only emit if it's meaningful content (not prompt markers, etc.)
                                        let trimmed = line_buffer.trim();
                                        if !trimmed.is_empty()
                                            && !trimmed.ends_with('>')
                                            && !trimmed.contains("\x1b[")
                                        {
                                            // Accumulate plain text, but don't emit yet - wait for more context
                                            pending_plain_text.push_str(trimmed);
                                            pending_plain_text.push(' ');
                                        }
                                    }
                                    line_buffer.clear();
                                }
                            } else {
                                line_buffer.push(c);
                            }
                        }

                        // Emit accumulated plain text periodically if we have enough content
                        if pending_plain_text.len() > 100 {
                            let _ = tx.send(BrainEvent::ChatDelta {
                                text: pending_plain_text.clone(),
                                event_id: None,
                            });
                            pending_plain_text.clear();
                        }
                    }
                    Err(e) => {
                        error!("Error reading from PTY: {}", e);
                        break;
                    }
                }
            }

            // Flush any remaining plain text
            if !pending_plain_text.is_empty() {
                let _ = tx.send(BrainEvent::ChatDelta {
                    text: pending_plain_text.clone(),
                    event_id: None,
                });
            }
        });

        Ok(())
    }

    async fn send_input(&mut self, input: &str) -> Result<()> {
        tracing::info!("[TerminalAppRuntime] Sending input: {:?}", input);
        if let Some(tx) = &self.input_tx {
            tx.send(input.as_bytes().to_vec())
                .map_err(|_| anyhow!("Failed to send input to CLI"))?;
            tracing::info!("[TerminalAppRuntime] Input sent successfully");
            Ok(())
        } else {
            tracing::error!("[TerminalAppRuntime] Cannot send input - runtime not started");
            Err(anyhow!("Runtime not started"))
        }
    }

    async fn stop(&mut self) -> Result<()> {
        if let Some(id) = &self.session_id {
            self.terminal_manager.remove_session(id).await;
        }
        Ok(())
    }

    fn subscribe(&self) -> broadcast::Receiver<BrainEvent> {
        self.event_tx.subscribe()
    }

    async fn health_check(&self) -> Result<bool> {
        Ok(self.session_id.is_some())
    }

    fn pid(&self) -> Option<u32> {
        self.pid
    }
}

fn resolve_command_path(command: &str) -> Result<PathBuf> {
    if command.contains('/') || command.contains('\\') {
        let path = PathBuf::from(command);
        if is_executable(&path) {
            return Ok(path);
        }
        return Err(anyhow!("Command not found at path: {}", command));
    }

    let path_var = std::env::var_os("PATH").ok_or_else(|| anyhow!("PATH is not set"))?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(command);
        if is_executable(&candidate) {
            return Ok(candidate);
        }

        #[cfg(windows)]
        {
            if let Some(exts) = std::env::var_os("PATHEXT") {
                for ext in std::env::split_paths(&exts) {
                    let ext = ext.to_string_lossy().to_string();
                    let candidate = dir.join(format!("{}{}", command, ext));
                    if is_executable(&candidate) {
                        return Ok(candidate);
                    }
                }
            }
        }
    }

    Err(anyhow!("Command not found in PATH: {}", command))
}

fn is_executable(path: &Path) -> bool {
    if let Ok(metadata) = std::fs::metadata(path) {
        if !metadata.is_file() {
            return false;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            return metadata.permissions().mode() & 0o111 != 0;
        }

        #[cfg(not(unix))]
        {
            return true;
        }
    }
    false
}
