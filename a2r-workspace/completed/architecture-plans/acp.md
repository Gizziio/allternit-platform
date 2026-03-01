1️⃣ Full AcpProtocolDriver Implementation

  File: brain/drivers/acp.rs

  //! ACP (Agent Client Protocol) Driver
  //!
  //! Implements JSON-RPC 2.0 over stdio (NDJSON format) for CLI agents.
  //! This is the primary "brain runtime" driver for protocol-capable CLIs.
  //!
  //! ACP Registry Commands:
  //! - OpenCode: opencode acp
  //! - Gemini: npx @google/gemini-cli --experimental-acp
  //! - Kimi: kimi acp
  //! - Qwen: npx @qwen-code/qwen-code --acp
  //! - Claude Code: npx @zed-industries/claude-code-acp
  //! - Codex: codex-acp

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
  use tracing::{error, info, warn};

  /// ACP JSON-RPC 2.0 Request
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct JsonRpcRequest<T> {
      pub jsonrpc: String,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub id: Option<u64>,
      pub method: String,
      pub params: T,
  }

  /// ACP JSON-RPC 2.0 Response
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct JsonRpcResponse<T> {
      pub jsonrpc: String,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub id: Option<u64>,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub result: Option<T>,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub error: Option<JsonRpcError>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct JsonRpcError {
      pub code: i32,
      pub message: String,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub data: Option<Value>,
  }

  /// ACP Notification (no id)
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct JsonRpcNotification<T> {
      pub jsonrpc: String,
      pub method: String,
      pub params: T,
  }

  /// ACP Initialize Params
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct InitializeParams {
      pub protocol_version: i32,
      pub client_info: ClientInfo,
      pub capabilities: ClientCapabilities,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ClientInfo {
      pub name: String,
      pub version: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize, Default)]
  pub struct ClientCapabilities {
      #[serde(skip_serializing_if = "Option::is_none")]
      pub file_system: Option<FileSystemCapabilities>,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub terminal: Option<TerminalCapabilities>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct FileSystemCapabilities {
      pub read_text_file: bool,
      pub write_text_file: bool,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct TerminalCapabilities {
      pub create: bool,
  }

  /// ACP Initialize Result
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct InitializeResult {
      pub protocol_version: i32,
      pub agent_info: AgentInfo,
      pub capabilities: AgentCapabilities,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct AgentInfo {
      pub name: String,
      pub version: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct AgentCapabilities {
      pub sessions: SessionCapabilities,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SessionCapabilities {
      pub new: bool,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub load: Option<bool>,
  }

  /// ACP Session/New Params
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SessionNewParams {
      #[serde(skip_serializing_if = "Option::is_none")]
      pub cwd: Option<String>,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub mcp_servers: Option<Vec<Value>>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SessionNewResult {
      pub session_id: String,
  }

  /// ACP Session/Prompt Params
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SessionPromptParams {
      pub session_id: String,
      pub content: Vec<ContentBlock>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(tag = "type")]
  pub enum ContentBlock {
      #[serde(rename = "text")]
      Text { text: String },
      #[serde(rename = "image")]
      Image { source: ImageSource },
      #[serde(rename = "resource")]
      Resource { uri: String },
      /// Catch-all for unknown content block types (dialect tolerance)
      #[serde(other)]
      Unknown,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ImageSource {
      #[serde(rename = "type")]
      pub source_type: String,
      #[serde(rename = "mediaType")]
      pub media_type: String,
      pub data: String,
  }

  /// ACP Session/Update Notification
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SessionUpdateParams {
      pub session_id: String,
      pub update: UpdateEvent,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(tag = "kind")]
  pub enum UpdateEvent {
      #[serde(rename = "agent_thought_chunk")]
      AgentThoughtChunk { content: ThoughtContent },
      #[serde(rename = "agent_message_chunk")]
      AgentMessageChunk { content: MessageContent },
      #[serde(rename = "message_stop")]
      MessageStop,
      #[serde(rename = "tool_call")]
      ToolCall { content: ToolCallContent },
      #[serde(rename = "tool_result")]
      ToolResult { content: ToolResultContent },
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ThoughtContent {
      pub thought: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct MessageContent {
      pub role: String,
      pub content: Vec<ContentBlock>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ToolCallContent {
      #[serde(rename = "toolCallId")]
      pub tool_call_id: String,
      pub title: String,
      pub kind: String,
      pub status: String,
      #[serde(skip_serializing_if = "Option::is_none")]
      pub locations: Option<Vec<ToolLocation>>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ToolLocation {
      pub path: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct ToolResultContent {
      #[serde(rename = "toolCallId")]
      pub tool_call_id: String,
      pub output: String,
  }

  /// ACP Protocol Driver
  pub struct AcpProtocolDriver;

  impl AcpProtocolDriver {
      pub fn new() -> Self {
          Self
      }
  }

  #[async_trait]
  impl BrainDriver for AcpProtocolDriver {
      fn supports(&self, brain_type: &BrainType) -> bool {
          matches!(brain_type, BrainType::Cli)
      }

      fn supports_with_config(&self, config: &BrainConfig) -> bool {
          // Only support CLI brains with ACP event mode
          config.brain_type == BrainType::Cli
              && config.event_mode == Some(EventMode::Acp)
      }

      async fn create_runtime(
          &self,
          config: &BrainConfig,
          session_id: &str,
      ) -> Result<Box<dyn BrainRuntime>> {
          let command = config
              .command
              .clone()
              .ok_or_else(|| anyhow!("No command specified for ACP brain"))?;

          let args = config.args.clone().unwrap_or_default();

          info!(
              "[AcpProtocolDriver] Creating ACP runtime: {} {:?}",
              command, args
          );

          // Verify command exists
          if !command_exists(&command) {
              return Err(anyhow!("ACP command not found: {}", command));
          }

          // Spawn process with PIPED stdio (NOT PTY!)
          // This is the key difference from TerminalAppDriver
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
              "[AcpProtocolDriver] ACP process spawned: pid={:?}, session_id={}",
              pid, session_id
          );

          let (event_tx, _) = broadcast::channel::<BrainEvent>(256);

          Ok(Box::new(AcpBrainRuntime {
              process: Arc::new(RwLock::new(child)),
              session_id: session_id.to_string(),
              pid,
              event_tx: event_tx.clone(),
              request_id: AtomicU64::new(1),
              initialized: Arc::new(RwLock::new(false)),
              config: AcpRuntimeConfig {
                  command,
                  args,
                  cwd: config.cwd.clone().map(PathBuf::from),
                  env: config.env.clone(),
              },
          }))
      }
  }

  #[derive(Debug, Clone)]
  struct AcpRuntimeConfig {
      command: String,
      args: Vec<String>,
      cwd: Option<PathBuf>,
      env: Option<HashMap<String, String>>,
  }

  pub struct AcpBrainRuntime {
      process: Arc<RwLock<Child>>,
      session_id: String,
      pid: Option<u32>,
      event_tx: broadcast::Sender<BrainEvent>,
      request_id: AtomicU64,
      initialized: Arc<RwLock<bool>>,
      config: AcpRuntimeConfig,
  }

  #[async_trait]
  impl BrainRuntime for AcpBrainRuntime {
      async fn start(&mut self) -> Result<()> {
          info!("[AcpBrainRuntime] Starting ACP runtime");

          // Take ownership of stdin/stdout
          let stdin = {
              let mut process = self.process.write().await;
              process.stdin.take().ok_or_else(|| anyhow!("Failed to get stdin"))?
          };

          let stdout = {
              let mut process = self.process.write().await;
              process.stdout.take().ok_or_else(|| anyhow!("Failed to get stdout")
  )?
          };

          // Spawn reader task
          let tx = self.event_tx.clone();
          let session_id = self.session_id.clone();
          tokio::spawn(async move {
              let reader = BufReader::new(stdout);
              let mut lines = reader.lines();

              while let Ok(Some(line)) = lines.next_line().await {
                  if line.trim().is_empty() {
                      continue;
                  }

                  trace!("[AcpBrainRuntime] Received line: {}", line);

                  // Try to parse as JSON-RPC message
                  if let Err(e) = Self::handle_acp_line(&line, &tx, &session_id).
  await {
                      warn!("[AcpBrainRuntime] Failed to handle ACP line: {}", e)
  ;
                  }
              }

              info!("[AcpBrainRuntime] ACP stdout reader ended");
          });

          // Perform ACP handshake
          self.perform_handshake(stdin).await?;

          // Create ACP session
          self.create_acp_session().await?;

          Ok(())
      }

      async fn send_input(&mut self, input: &str) -> Result<()> {
          // Check if initialized
          let initialized = *self.initialized.read().await;
          if !initialized {
              return Err(anyhow!("ACP runtime not initialized"));
          }

          // Build session/prompt request
          let request_id = self.request_id.fetch_add(1, Ordering::SeqCst);
          let content = vec![ContentBlock::Text {
              text: input.to_string(),
          }];

          let request = JsonRpcRequest {
              jsonrpc: "2.0".to_string(),
              id: Some(request_id),
              method: "session/prompt".to_string(),
              params: SessionPromptParams {
                  session_id: self.session_id.clone(),
                  content,
              },
          };

          let json = serde_json::to_string(&request)?;

          // Send to process stdin
          let mut process = self.process.write().await;
          if let Some(stdin) = &mut process.stdin {
              stdin.write_all(json.as_bytes()).await?;
              stdin.write_all(b"\n").await?;
              stdin.flush().await?;

              info!("[AcpBrainRuntime] Sent prompt: request_id={}", request_id);
              Ok(())
          } else {
              Err(anyhow!("ACP process stdin not available"))
          }
      }

      async fn stop(&mut self) -> Result<()> {
          info!("[AcpBrainRuntime] Stopping ACP runtime");

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
          // ACP sessions can persist state internally
          Ok(Some(serde_json::json!({
              "session_id": self.session_id,
              "acp_version": "2.0",
          })))
      }
  }

  impl AcpBrainRuntime {
      async fn perform_handshake(&self, mut stdin: ChildStdin) -> Result<()> {
          info!("[AcpBrainRuntime] Performing ACP handshake");

          let request_id = self.request_id.fetch_add(1, Ordering::SeqCst);
          let init_request = JsonRpcRequest {
              jsonrpc: "2.0".to_string(),
              id: Some(request_id),
              method: "initialize".to_string(),
              params: InitializeParams {
                  protocol_version: 1,
                  client_info: ClientInfo {
                      name: "A2R Kernel".to_string(),
                      version: "0.1.0".to_string(),
                  },
                  capabilities: ClientCapabilities {
                      file_system: Some(FileSystemCapabilities {
                          read_text_file: true,
                          write_text_file: true,
                      }),
                      terminal: Some(TerminalCapabilities { create: true }),
                  },
              },
          };

          let json = serde_json::to_string(&init_request)?;
          stdin.write_all(json.as_bytes()).await?;
          stdin.write_all(b"\n").await?;
          stdin.flush().await?;

          info!("[AcpBrainRuntime] Sent initialize request: id={}", request_id);

          // Note: We don't wait for the response here - the reader task will han
  dle it
          // Mark as initialized for now (in production, wait for response)
          let mut initialized = self.initialized.write().await;
          *initialized = true;

          Ok(())
      }

      async fn create_acp_session(&self) -> Result<()> {
          info!("[AcpBrainRuntime] Creating ACP session");

          let request_id = self.request_id.fetch_add(1, Ordering::SeqCst);
          let new_request = JsonRpcRequest {
              jsonrpc: "2.0".to_string(),
              id: Some(request_id),
              method: "session/new".to_string(),
              params: SessionNewParams {
                  cwd: self.config.cwd.as_ref().map(|p| p.to_string_lossy().to_st
  ring()),
                  mcp_servers: None,
              },
          };

          let json = serde_json::to_string(&new_request)?;

          let mut process = self.process.write().await;
          if let Some(stdin) = &mut process.stdin {
              stdin.write_all(json.as_bytes()).await?;
              stdin.write_all(b"\n").await?;
              stdin.flush().await?;
          }

          info!("[AcpBrainRuntime] Sent session/new request: id={}", request_id);
          Ok(())
      }

      async fn handle_acp_line(
          line: &str,
          tx: &broadcast::Sender<BrainEvent>,
          session_id: &str,
      ) -> Result<()> {
          // Try to parse as JSON-RPC response or notification
          let value: Value = serde_json::from_str(line)?;

          // Check if it's a response (has id and either result or error)
          if value.get("id").is_some() {
              if value.get("result").is_some() {
                  // Handle response
                  trace!("[AcpBrainRuntime] Received response: {:?}", value);
                  return Ok(());
              } else if value.get("error").is_some() {
                  let error: JsonRpcError = serde_json::from_value(
                      value.get("error").unwrap().clone()
                  )?;
                  warn!("[AcpBrainRuntime] ACP error: {:?}", error);
                  return Ok(());
              }
          }

          // Check if it's a notification (no id, has method)
          if let Some(method) = value.get("method").and_then(|m| m.as_str()) {
              match method {
                  "session/update" => {
                      let notification: JsonRpcNotification<SessionUpdateParams>
  =
                          serde_json::from_value(value)?;
                      Self::handle_session_update(notification.params, tx, sessio
  n_id).await?;
                  }
                  _ => {
                      trace!("[AcpBrainRuntime] Unhandled notification: {}", meth
  od);
                  }
              }
          }

          Ok(())
      }

      async fn handle_session_update(
          params: SessionUpdateParams,
          tx: &broadcast::Sender<BrainEvent>,
          _session_id: &str,
      ) -> Result<()> {
          match params.update {
              UpdateEvent::AgentThoughtChunk { content } => {
                  let _ = tx.send(BrainEvent::ChatDelta {
                      text: format!("[thinking] {}\n", content.thought),
                      event_id: None,
                  });
              }
              UpdateEvent::AgentMessageChunk { content } => {
                  // Extract text content
                  for block in content.content {
                      if let ContentBlock::Text { text } = block {
                          let _ = tx.send(BrainEvent::ChatDelta {
                              text,
                              event_id: None,
                          });
                      }
                  }
              }
              UpdateEvent::MessageStop => {
                  let _ = tx.send(BrainEvent::ChatMessageCompleted {
                      text: String::new(),
                      event_id: None,
                  });
              }
              UpdateEvent::ToolCall { content } => {
                  let call_id = content.tool_call_id.clone();
                  let _ = tx.send(BrainEvent::ToolCall {
                      tool_id: content.title.clone(),
                      call_id,
                      args: serde_json::to_string(&content)?,
                      event_id: None,
                  });
              }
              UpdateEvent::ToolResult { content } => {
                  let call_id = content.tool_call_id.clone();
                  let _ = tx.send(BrainEvent::ToolResult {
                      tool_id: content.tool_call_id.clone(),
                      call_id,
                      result: content.output,
                      event_id: None,
                  });
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

  use tracing::trace;

  ───────────────────────────────────────────────────────────────────────────────
  2️⃣ Full JsonlProtocolDriver Implementation

  File: brain/drivers/jsonl.rs

  //! JSONL (JSON Lines) Driver
  //!
  //! Implements unidirectional NDJSON event streaming for CLI agents that don't
  //! support full ACP JSON-RPC protocol. This is a compatibility/fallback driver
  .
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
              "[JsonlProtocolDriver] JSONL process spawned: pid={:?}, session_id=
  {}",
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
      process: Arc<RwLock<Child>>;
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
              process.stdout.take().ok_or_else(|| anyhow!("Failed to get stdout")
  )?
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
                  if let Err(e) = Self::handle_jsonl_line(&line, &tx, &session_id
  ).await {
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

          info!("[JsonlBrainRuntime] JSONL runtime started (no handshake required
  )");
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
                          trace!("[JsonlBrainRuntime] Unknown Claude event type:
  {}", event_type);
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
                                  .or_else(|| call.get("function").and_then(|f| f
  .get("name")))
                                  .and_then(|v| v.as_str())
                                  .unwrap_or("unknown")
                                  .to_string(),
                              call_id: call.get("id")
                                  .and_then(|v| v.as_str())
                                  .unwrap_or("unknown")
                                  .to_string(),
                              args: call.get("arguments")
                                  .or_else(|| call.get("function").and_then(|f| f
  .get("arguments")))
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
                  if let Some(text) = value.get("content").and_then(|v| v.as_str(
  )) {
                      let _ = tx.send(BrainEvent::ChatDelta {
                          text: text.to_string(),
                          event_id: None,
                      });
                  } else if let Some(text) = value.get("text").and_then(|v| v.as_
  str()) {
                      let _ = tx.send(BrainEvent::ChatDelta {
                          text: text.to_string(),
                          event_id: None,
                      });
                  } else if let Some(delta) = value.get("delta").and_then(|v| v.a
  s_str()) {
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

  ───────────────────────────────────────────────────────────────────────────────
  3️⃣ BrainDriver Trait

  File: brain/traits.rs

  use crate::brain::types::{BrainConfig, BrainEvent};
  use anyhow::Result;
  use async_trait::async_trait;
  use tokio::sync::broadcast;

  #[async_trait]
  pub trait BrainRuntime: Send + Sync {
      /// Initialize the runtime
      async fn start(&mut self) -> Result<()>;

      /// Send input to the brain (text, tool results, etc.)
      async fn send_input(&mut self, input: &str) -> Result<()>;

      /// Stop the runtime
      async fn stop(&mut self) -> Result<()>;

      /// Get the event receiver channel
      fn subscribe(&self) -> broadcast::Receiver<BrainEvent>;

      /// Check if the runtime is healthy/alive
      async fn health_check(&self) -> Result<bool>;

      /// Get the process ID if applicable
      fn pid(&self) -> Option<u32> {
          None
      }

      /// Get current conversation state for persistence
      async fn get_state(&self) -> Result<Option<serde_json::Value>> {
          Ok(None)
      }
  }

  /// Factory trait for creating runtimes
  #[async_trait]
  pub trait BrainDriver: Send + Sync {
      async fn create_runtime(
          &self,
          config: &BrainConfig,
          session_id: &str,
      ) -> Result<Box<dyn BrainRuntime>>;

      /// Check if driver supports this brain type (legacy, kept for compatibilit
  y)
      fn supports(&self, brain_type: &crate::brain::types::BrainType) -> bool;

      /// Check if driver supports this specific brain configuration
      /// Default implementation falls back to brain_type check
      /// Override this to implement event_mode-based selection
      fn supports_with_config(&self, config: &BrainConfig) -> bool {
          self.supports(&config.brain_type)
      }
  }

  ───────────────────────────────────────────────────────────────────────────────
  4️⃣ Driver Registration Block

  File: main.rs

  // Register drivers in priority order:
  // 1. ACP Protocol (PRIMARY for true ACP agents)
  // 2. JSONL Protocol (for --output-format stream-json CLIs)
  // 3. API driver
  // 4. Local driver
  // 5. Terminal App (PTY-based, for human interaction only)
  manager.register_driver(Box::new(AcpProtocolDriver::new()));
  manager.register_driver(Box::new(JsonlProtocolDriver::new()));
  manager.register_driver(Box::new(brain::drivers::api::ApiBrainDriver::new()));
  manager.register_driver(Box::new(brain::drivers::local::LocalBrainDriver::new()
  ));
  manager.register_driver(Box::new(TerminalAppDriver::new(terminal_manager.clone(
  ))));

  ───────────────────────────────────────────────────────────────────────────────
  5️⃣ Brain Profile Registry Entries

  ACP Profile: opencode-acp

  model_router
      .register_profile(brain::router::BrainProfile {
          config: brain::types::BrainConfig {
              id: "opencode-acp".to_string(),
              name: "OpenCode (ACP Native)".to_string(),
              brain_type: brain::types::BrainType::Cli,
              model: Some("gpt-4o".to_string()),
              endpoint: None,
              api_key_env: None,
              command: Some("opencode".to_string()),
              args: Some(vec!["acp".to_string()]),
              prompt_arg: None,
              env: None,
              cwd: None,
              requirements: vec![brain::types::BrainRequirement::Binary {
                  name: "opencode".to_string(),
              }],
              sandbox: None,
              event_mode: Some(brain::types::EventMode::Acp),
          },
          capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".
  to_string()],
          cost_tier: 1,
          privacy_level: brain::router::PrivacyLevel::CloudOk,
      })
      .await;

  ACP Profile: gemini-acp

  model_router
      .register_profile(brain::router::BrainProfile {
          config: brain::types::BrainConfig {
              id: "gemini-acp".to_string(),
              name: "Gemini CLI (ACP Native)".to_string(),
              brain_type: brain::types::BrainType::Cli,
              model: Some("gemini-2.5-pro".to_string()),
              endpoint: None,
              api_key_env: Some("GEMINI_API_KEY".to_string()),
              command: Some("npx".to_string()),
              args: Some(vec![
                  "@google/gemini-cli".to_string(),
                  "--experimental-acp".to_string(),
              ]),
              prompt_arg: None,
              env: None,
              cwd: None,
              requirements: vec![brain::types::BrainRequirement::Dependency {
                  name: "@google/gemini-cli".to_string(),
                  package_manager: "npm".to_string(),
              }],
              sandbox: None,
              event_mode: Some(brain::types::EventMode::Acp),
          },
          capabilities: vec!["code".to_string(), "terminal".to_string(), "tools".
  to_string()],
          cost_tier: 1,
          privacy_level: brain::router::PrivacyLevel::CloudOk,
      })
      .await;

  JSONL Profile: gemini-cli

  model_router
      .register_profile(brain::router::BrainProfile {
          config: brain::types::BrainConfig {
              id: "gemini-cli".to_string(),
              name: "Google Gemini CLI".to_string(),
              brain_type: brain::types::BrainType::Cli,
              model: Some("gemini-2.0-flash".to_string()),
              endpoint: None,
              api_key_env: None,
              command: Some("gemini".to_string()),
              args: Some(vec!["--output-format".to_string(), "stream-json".to_str
  ing(), "--yolo".to_string()]),
              prompt_arg: Some("-p".to_string()),
              env: None,
              cwd: None,
              requirements: vec![brain::types::BrainRequirement::Binary {
                  name: "gemini".to_string(),
              }],
              sandbox: None,
              event_mode: Some(brain::types::EventMode::Jsonl),
          },
          capabilities: vec!["code".to_string(), "terminal".to_string()],
          cost_tier: 1,
          privacy_level: brain::router::PrivacyLevel::CloudOk,
      })
      .await;

  Terminal Profile

  Note: No explicit Terminal profiles are currently defined in main.rs. The Termi
  nalAppDriver serves as a fallback for CLI brains without an explicit event_mode
  or when event_mode: Some(EventMode::Terminal) is set.

  ───────────────────────────────────────────────────────────────────────────────
  6️⃣ Source Gating Implementation

  File: brain/manager.rs

  pub async fn create_session(
      &self,
      mut config: BrainConfig,
      workspace_dir: Option<String>,
      profile_id: Option<String>,
      plan_id: Option<String>,
      prompt: Option<String>,
      source: Option<String>, // "chat" | "terminal" | "api"
  ) -> Result<BrainSession> {
      let session_id = Uuid::new_v4().to_string();
      let source = source.unwrap_or_else(|| "terminal".to_string());
      let event_mode_str = config.event_mode.as_ref()
          .map(|m| format!("{:?}", m).to_lowercase())
          .unwrap_or_else(|| "unknown".to_string());

      // EMIT SESSION STARTED FIRST (before any validation or driver operations)
      // This allows UI to assert invariants immediately, even if session fails
      if let Some(ref tx) = self.integration_events {
          tracing::info!("[BrainManager] Emitting SessionStarted: session_id={},
  event_mode={}, source={}",
              session_id, event_mode_str, source);
          let _ = tx.send(BrainEvent::SessionStarted {
              session_id: session_id.clone(),
              event_mode: event_mode_str.clone(),
              brain_profile_id: profile_id.clone().unwrap_or_else(|| config.id.cl
  one()),
              event_id: None,
          });
      }

      // SOURCE GATING: Chat sessions CANNOT use terminal mode
      // Terminal mode is PTY-based and emits ANSI sequences unsuitable for chat
  UI
      if source == "chat" && config.event_mode == Some(EventMode::Terminal) {
          return Err(anyhow!(
              "Invalid configuration: Chat sessions cannot use Terminal event mod
  e (was: {}). \
               Terminal mode is PTY-based and emits ANSI sequences that break cha
  t UI. \
               Use EventMode::Acp or EventMode::Jsonl for chat sessions.",
              event_mode_str
          ));
      }
      // ... rest of function
  }

  ───────────────────────────────────────────────────────────────────────────────
  7️⃣ Event Enum Definition

  File: brain/types.rs

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(tag = "type", content = "payload")]
  pub enum BrainEvent {
      // Session Lifecycle
      #[serde(rename = "session.created")]
      SessionCreated {
          session_id: String,
          event_id: Option<String>,
      },
      /// Session started - emitted when runtime begins processing
      /// Contains metadata about the session source and mode
      #[serde(rename = "session.started")]
      SessionStarted {
          session_id: String,
          event_mode: String,
          brain_profile_id: String,
          event_id: Option<String>,
      },
      #[serde(rename = "session.status")]
      SessionStatus {
          status: SessionStatus,
          event_id: Option<String>,
      },

      // Chat Stream
      #[serde(rename = "chat.delta")]
      ChatDelta {
          text: String,
          event_id: Option<String>,
      },
      #[serde(rename = "chat.message.completed")]
      ChatMessageCompleted {
          text: String,
          event_id: Option<String>,
      },

      // Terminal Stream
      #[serde(rename = "terminal.delta")]
      TerminalDelta {
          data: String,
          stream: String,
          event_id: Option<String>,
      }, // stream: "stdout" | "stderr"

      // Tool Stream
      #[serde(rename = "tool.call")]
      ToolCall {
          tool_id: String,
          call_id: String,
          args: String,
          event_id: Option<String>,
      },
      #[serde(rename = "tool.result")]
      ToolResult {
          tool_id: String,
          call_id: String,
          result: String,
          event_id: Option<String>,
      },

      // Artifacts
      #[serde(rename = "artifact.created")]
      ArtifactCreated {
          id: String,
          kind: String,
          content: String,
          event_id: Option<String>,
      },

      // Errors
      #[serde(rename = "error")]
      Error {
          message: String,
          code: Option<String>,
          event_id: Option<String>,
      },

      // Integration Lifecycle Events (for UI checklist feedback)
      #[serde(rename = "integration.profile.registered")]
      IntegrationProfileRegistered {
          profile_id: String,
          event_id: Option<String>,
      },

      #[serde(rename = "integration.pty.initializing")]
      IntegrationPtyInitializing {
          command: String,
          event_id: Option<String>,
      },

      #[serde(rename = "integration.pty.ready")]
      IntegrationPtyReady { pid: u32, event_id: Option<String> },

      #[serde(rename = "integration.dispatcher.connected")]
      IntegrationDispatcherConnected { event_id: Option<String> },

      #[serde(rename = "integration.tools.verified")]
      IntegrationToolsVerified {
          count: usize,
          event_id: Option<String>,
      },

      #[serde(rename = "integration.context.synced")]
      IntegrationContextSynced { event_id: Option<String> },

      #[serde(rename = "integration.complete")]
      IntegrationComplete { event_id: Option<String> },
  }

