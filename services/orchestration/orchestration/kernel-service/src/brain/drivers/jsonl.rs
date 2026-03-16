//! JSONL (JSON Lines) Driver
//!
//! Implements unidirectional NDJSON event streaming for CLI agents that don't
//! support full ACP JSON-RPC protocol. This is a compatibility/fallback driver.
//!
//! Event Mode: EventMode::Jsonl
//! Transport: Piped stdin/stdout (no PTY)
//! Framing: NDJSON (newline-delimited JSON events)
//!
//! Registry examples:
//! - Claude Code JSONL: claude --output-format stream-json
//! - Kimi JSONL: kimi --yolo
//! - Gemini JSONL: npx @google/gemini-cli

use crate::brain::traits::{BrainDriver, BrainRuntime};
use crate::brain::types::{BrainConfig, BrainEvent, BrainType, EventMode};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, trace, warn};

/// JSONL Event - generic wrapper for line-delimited JSON events
/// Different tools emit different event shapes, so we parse heuristically
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonlEvent {
    /// Claude Code stream-json format
    ClaudeCode {
        #[serde(rename = "type")]
        event_type: String,
        #[serde(default)]
        content: Option<String>,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Generic delta event (Kimi, etc)
    Delta {
        delta: String,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Generic message event
    Message {
        role: Option<String>,
        content: Option<String>,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Tool call event
    ToolCall {
        #[serde(rename = "tool_call")]
        tool_call: Option<Value>,
        #[serde(rename = "tool_calls")]
        tool_calls: Option<Vec<Value>>,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Tool result event
    ToolResult {
        #[serde(rename = "tool_result")]
        tool_result: Option<Value>,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Completion event
    Complete {
        done: bool,
        #[serde(flatten)]
        extra: HashMap<String, Value>,
    },
    /// Raw fallback - any JSON object
    Raw(Value),
}

/// JSONL Protocol Driver
/// 
/// This driver spawns CLI tools in piped mode (not PTY) and parses
/// NDJSON output. It does NOT use JSON-RPC - just line-delimited events.
pub struct JsonlProtocolDriver;

impl JsonlProtocolDriver {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl BrainDriver for JsonlProtocolDriver {
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Cli)
    }

    fn supports_with_config(&self, config: &BrainConfig) -> bool {
        // Only support CLI brains with JSONL event mode
        config.brain_type == BrainType::Cli
            && config.event_mode == Some(EventMode::Jsonl)
    }

    async fn create_runtime(
        &self,
        config: &BrainConfig,
        session_id: &str,
    ) -> Result<Box<dyn BrainRuntime>> {
        let command = config
            .command
            .clone()
            .ok_or_else(|| anyhow!("No command specified for JSONL brain"))?;
        
        let args = config.args.clone().unwrap_or_default();

        info!(
            "[JsonlProtocolDriver] Creating JSONL runtime: {} {:?}",
            command, args
        );

        // Verify command exists
        if !command_exists(&command) {
            return Err(anyhow!("JSONL command not found: {}", command));
        }

        // Spawn process with PIPED stdio (NOT PTY - this is protocol mode)
        let mut cmd = Command::new(&command);
        cmd.args(&args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        // Set working directory
        if let Some(cwd) = &config.cwd {
            cmd.current_dir(cwd);
        }

        // Set environment
        if let Some(env) = &config.env {
            for (k, v) in env {
                cmd.env(k, v);
            }
        }

        let child = cmd.spawn()?;
        let pid = child.id();

        info!(
            "[JsonlProtocolDriver] JSONL process spawned: pid={:?}, session_id={}",
            pid, session_id
        );

        let (event_tx, _) = broadcast::channel::<BrainEvent>(256);

        Ok(Box::new(JsonlBrainRuntime {
            process: Arc::new(RwLock::new(child)),
            session_id: session_id.to_string(),
            pid,
            event_tx: event_tx.clone(),
            request_id: AtomicU64::new(1),
            initialized: Arc::new(RwLock::new(false)),
            config: JsonlRuntimeConfig {
                command,
                args,
                cwd: config.cwd.clone().map(PathBuf::from),
                env: config.env.clone(),
            },
        }))
    }
}

#[derive(Debug, Clone)]
struct JsonlRuntimeConfig {
    command: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    env: Option<HashMap<String, String>>,
}

pub struct JsonlBrainRuntime {
    process: Arc<RwLock<Child>>,
    session_id: String,
    pid: Option<u32>,
    event_tx: broadcast::Sender<BrainEvent>,
    request_id: AtomicU64,
    initialized: Arc<RwLock<bool>>,
    config: JsonlRuntimeConfig,
}

#[async_trait]
impl BrainRuntime for JsonlBrainRuntime {
    async fn start(&mut self) -> Result<()> {
        info!("[JsonlBrainRuntime] Starting JSONL runtime");

        // Take ownership of stdin/stdout
        let stdin = {
            let mut process = self.process.write().await;
            process.stdin.take().ok_or_else(|| anyhow!("Failed to get stdin"))?
        };

        let stdout = {
            let mut process = self.process.write().await;
            process.stdout.take().ok_or_else(|| anyhow!("Failed to get stdout"))?
        };

        // Spawn reader task for NDJSON parsing
        let tx = self.event_tx.clone();
        let session_id = self.session_id.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                trace!("[JsonlBrainRuntime] Received line: {}", line);

                // Try to parse as JSON event
                if let Err(e) = Self::handle_jsonl_line(&line, &tx, &session_id).await {
                    // Not JSON - treat as plain text terminal output
                    let _ = tx.send(BrainEvent::TerminalDelta {
                        data: line.clone(),
                        stream: "stdout".to_string(),
                        event_id: None,
                    });
                }
            }

            info!("[JsonlBrainRuntime] JSONL stdout reader ended");
        });

        // Mark as initialized (JSONL has no handshake)
        let mut initialized = self.initialized.write().await;
        *initialized = true;

        info!("[JsonlBrainRuntime] JSONL runtime started (no handshake required)");
        Ok(())
    }

    async fn send_input(&mut self, input: &str) -> Result<()> {
        // Check if initialized
        let initialized = *self.initialized.read().await;
        if !initialized {
            return Err(anyhow!("JSONL runtime not initialized"));
        }

        // Send input to process stdin
        // Format depends on the tool - some expect JSON, some plain text
        let mut process = self.process.write().await;
        if let Some(stdin) = &mut process.stdin {
            // Try to send as JSON if it looks like structured input
            if let Ok(json_input) = serde_json::from_str::<Value>(input) {
                let json_str = serde_json::to_string(&json_input)?;
                stdin.write_all(json_str.as_bytes()).await?;
            } else {
                // Plain text input
                stdin.write_all(input.as_bytes()).await?;
            }
            stdin.write_all(b"\n").await?;
            stdin.flush().await?;
            
            info!("[JsonlBrainRuntime] Sent input");
            Ok(())
        } else {
            Err(anyhow!("JSONL process stdin not available"))
        }
    }

    async fn stop(&mut self) -> Result<()> {
        info!("[JsonlBrainRuntime] Stopping JSONL runtime");
        
        let mut process = self.process.write().await;
        
        // Try graceful shutdown first
        if let Some(stdin) = &mut process.stdin {
            let _ = stdin.write_all(b"\n").await;
            let _ = stdin.flush().await;
        }

        // Kill the process
        let _ = process.kill().await;
        
        Ok(())
    }

    fn subscribe(&self) -> broadcast::Receiver<BrainEvent> {
        self.event_tx.subscribe()
    }

    async fn health_check(&self) -> Result<bool> {
        // Check if process is still running
        let mut process = self.process.write().await;
        match process.try_wait() {
            Ok(None) => Ok(true),  // Still running
            Ok(Some(_)) => Ok(false),  // Exited
            Err(e) => Err(anyhow!("Failed to check process status: {}", e)),
        }
    }

    fn pid(&self) -> Option<u32> {
        self.pid
    }

    async fn get_state(&self) -> Result<Option<serde_json::Value>> {
        Ok(Some(serde_json::json!({
            "session_id": self.session_id,
            "protocol": "jsonl",
        })))
    }
}

impl JsonlBrainRuntime {
    async fn handle_jsonl_line(
        line: &str,
        tx: &broadcast::Sender<BrainEvent>,
        _session_id: &str,
    ) -> Result<()> {
        // Try to parse as JSON
        let value: Value = serde_json::from_str(line)?;
        
        trace!("[JsonlBrainRuntime] Parsed JSON: {:?}", value);

        // Try to parse as structured event
        match serde_json::from_value::<JsonlEvent>(value.clone()) {
            Ok(event) => {
                Self::dispatch_jsonl_event(event, tx).await?;
            }
            Err(_) => {
                // Unknown JSON structure - emit as raw terminal output
                let _ = tx.send(BrainEvent::TerminalDelta {
                    data: line.to_string(),
                    stream: "stdout".to_string(),
                    event_id: None,
                });
            }
        }

        Ok(())
    }

    async fn dispatch_jsonl_event(
        event: JsonlEvent,
        tx: &broadcast::Sender<BrainEvent>,
    ) -> Result<()> {
        match event {
            // Claude Code stream-json format
            JsonlEvent::ClaudeCode { event_type, content, .. } => {
                match event_type.as_str() {
                    "text" | "content" => {
                        if let Some(text) = content {
                            let _ = tx.send(BrainEvent::ChatDelta {
                                text,
                                event_id: None,
                            });
                        }
                    }
                    "tool_use" => {
                        let _ = tx.send(BrainEvent::ToolCall {
                            tool_id: "unknown".to_string(),
                            call_id: format!("call_{}", uuid::Uuid::new_v4()),
                            args: content.unwrap_or_default(),
                            event_id: None,
                        });
                    }
                    "stop" | "complete" => {
                        let _ = tx.send(BrainEvent::ChatMessageCompleted {
                            text: String::new(),
                            event_id: None,
                        });
                    }
                    _ => {
                        trace!("[JsonlBrainRuntime] Unknown Claude event type: {}", event_type);
                    }
                }
            }
            // Generic delta
            JsonlEvent::Delta { delta, .. } => {
                let _ = tx.send(BrainEvent::ChatDelta {
                    text: delta,
                    event_id: None,
                });
            }
            // Generic message
            JsonlEvent::Message { content, .. } => {
                if let Some(text) = content {
                    let _ = tx.send(BrainEvent::ChatDelta {
                        text,
                        event_id: None,
                    });
                }
            }
            // Tool calls
            JsonlEvent::ToolCall { tool_call, tool_calls, .. } => {
                let calls = tool_calls.or_else(|| tool_call.map(|c| vec![c]));
                if let Some(calls) = calls {
                    for call in calls {
                        let _ = tx.send(BrainEvent::ToolCall {
                            tool_id: call.get("name")
                                .or_else(|| call.get("function").and_then(|f| f.get("name")))
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            call_id: call.get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            args: call.get("arguments")
                                .or_else(|| call.get("function").and_then(|f| f.get("arguments")))
                                .map(|v| v.to_string())
                                .unwrap_or_default(),
                            event_id: None,
                        });
                    }
                }
            }
            // Tool results
            JsonlEvent::ToolResult { tool_result, .. } => {
                if let Some(result) = tool_result {
                    let _ = tx.send(BrainEvent::ToolResult {
                        tool_id: result.get("tool_call_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        call_id: result.get("tool_call_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        result: result.get("output")
                            .or_else(|| result.get("content"))
                            .map(|v| v.to_string())
                            .unwrap_or_default(),
                        event_id: None,
                    });
                }
            }
            // Completion
            JsonlEvent::Complete { done, .. } => {
                if done {
                    let _ = tx.send(BrainEvent::ChatMessageCompleted {
                        text: String::new(),
                        event_id: None,
                    });
                }
            }
            // Raw fallback
            JsonlEvent::Raw(value) => {
                trace!("[JsonlBrainRuntime] Raw JSON event: {:?}", value);
                // Try to extract text content heuristically
                if let Some(text) = value.get("content").and_then(|v| v.as_str()) {
                    let _ = tx.send(BrainEvent::ChatDelta {
                        text: text.to_string(),
                        event_id: None,
                    });
                } else if let Some(text) = value.get("text").and_then(|v| v.as_str()) {
                    let _ = tx.send(BrainEvent::ChatDelta {
                        text: text.to_string(),
                        event_id: None,
                    });
                } else if let Some(delta) = value.get("delta").and_then(|v| v.as_str()) {
                    let _ = tx.send(BrainEvent::ChatDelta {
                        text: delta.to_string(),
                        event_id: None,
                    });
                }
            }
        }

        Ok(())
    }
}

fn command_exists(command: &str) -> bool {
    // Simple check: try to resolve command in PATH
    if command.contains('/') || command.contains('\\') {
        std::path::Path::new(command).exists()
    } else {
        // Check PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let candidate = dir.join(command);
                if candidate.exists() {
                    return true;
                }
            }
        }
        false
    }
}
