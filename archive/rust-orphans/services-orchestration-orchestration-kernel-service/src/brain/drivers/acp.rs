//! ACP (Agent Client Protocol) Driver
//!
//! Implements JSON-RPC 2.0 over stdio (NDJSON format) for ACP-compliant agents.
//! Based on official ACP schema from @agentclientprotocol/sdk
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
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{broadcast, mpsc, oneshot, RwLock};
use tracing::{error, info, trace, warn};

// ============================================================================
// ACP JSON-RPC 2.0 Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest<T> {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    pub method: String,
    pub params: T,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification<T> {
    pub jsonrpc: String,
    pub method: String,
    pub params: T,
}

// ============================================================================
// ACP Initialize Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<ClientCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<ToolsCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolsCapabilities {
    pub list: bool,
    pub call: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
    #[serde(rename = "agentInfo", skip_serializing_if = "Option::is_none")]
    pub agent_info: Option<AgentInfo>,
    #[serde(rename = "agentCapabilities", skip_serializing_if = "Option::is_none")]
    pub agent_capabilities: Option<AgentCapabilities>,
    #[serde(rename = "authMethods", skip_serializing_if = "Option::is_none")]
    pub auth_methods: Option<Vec<AuthMethod>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub load_session: Option<bool>,
    #[serde(rename = "sessionCapabilities", skip_serializing_if = "Option::is_none")]
    pub session_capabilities: Option<SessionCapabilities>,
    #[serde(rename = "promptCapabilities", skip_serializing_if = "Option::is_none")]
    pub prompt_capabilities: Option<PromptCapabilities>,
    #[serde(rename = "mcpCapabilities", skip_serializing_if = "Option::is_none")]
    pub mcp_capabilities: Option<McpCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fork: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PromptCapabilities {
    pub image: bool,
    pub audio: bool,
    #[serde(rename = "embeddedContext")]
    pub embedded_context: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpCapabilities {
    pub http: bool,
    pub sse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthMethod {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

// ============================================================================
// ACP Session Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSessionParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSessionResult {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

// ============================================================================
// ACP Prompt Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub prompt: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { source: ImageSource },
    #[serde(rename = "resource")]
    Resource { uri: String, mime_type: Option<String> },
    #[serde(rename = "resourceLink")]
    ResourceLink { uri: String },
    /// Catch-all for unknown content block types
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

// ============================================================================
// ACP Session Update Notifications (Official Schema)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionNotification {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub update: SessionUpdate,
}

/// Official ACP SessionUpdate - uses "sessionUpdate" discriminator
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "sessionUpdate")]
pub enum SessionUpdate {
    #[serde(rename = "user_message_chunk")]
    UserMessageChunk { content: ContentChunk },
    #[serde(rename = "agent_message_chunk")]
    AgentMessageChunk { content: ContentChunk },
    #[serde(rename = "agent_thought_chunk")]
    AgentThoughtChunk { content: ContentChunk },
    #[serde(rename = "tool_call")]
    ToolCall { #[serde(flatten)] call: ToolCall },
    #[serde(rename = "tool_call_update")]
    ToolCallUpdate { #[serde(flatten)] update: ToolCallUpdate },
    #[serde(rename = "plan")]
    Plan { #[serde(flatten)] plan: Plan },
    /// Unknown update types - tolerated, logged, ignored
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentChunk {
    pub content: ContentBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<ToolCallContent>>,
    #[serde(rename = "rawInput", skip_serializing_if = "Option::is_none")]
    pub raw_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locations: Option<Vec<ToolCallLocation>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallLocation {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallUpdate {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<ToolCallContent>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<PlanStep>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

// ============================================================================
// Tool Result Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResultParams {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    pub result: Value,
}

// ============================================================================
// ACP Runtime State Machine
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AcpState {
    Spawned,
    Initializing,
    Initialized,
    SessionCreating,
    SessionReady,
    Prompting,
    Closed,
}

type PendingRequest = oneshot::Sender<Result<Value, JsonRpcError>>;

// ============================================================================
// ACP Protocol Driver
// ============================================================================

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
        config.brain_type == BrainType::Cli && config.event_mode == Some(EventMode::Acp)
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

        info!("[AcpProtocolDriver] Creating ACP runtime: {} {:?}", command, args);

        if !command_exists(&command) {
            return Err(anyhow!("ACP command not found: {}", command));
        }

        let mut cmd = Command::new(&command);
        cmd.args(&args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        if let Some(cwd) = &config.cwd {
            cmd.current_dir(cwd);
        }

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
        let (request_tx, request_rx) = mpsc::channel::<(u64, PendingRequest)>(32);

        let runtime = AcpBrainRuntime {
            process: Arc::new(RwLock::new(child)),
            kernel_session_id: session_id.to_string(),
            acp_session_id: Arc::new(RwLock::new(None)),
            pid,
            event_tx: event_tx.clone(),
            request_tx,
            request_id_counter: AtomicU64::new(1),
            state: Arc::new(RwLock::new(AcpState::Spawned)),
            capabilities: Arc::new(RwLock::new(None)),
            config: AcpRuntimeConfig {
                command,
                args,
                cwd: config.cwd.clone().map(PathBuf::from),
                env: config.env.clone(),
            },
        };

        // Spawn the reader task
        let stdout = {
            let mut process = runtime.process.write().await;
            process.stdout.take().ok_or_else(|| anyhow!("Failed to get stdout"))?
        };

        let session_id_clone = session_id.to_string();
        let event_tx_clone = event_tx.clone();
        tokio::spawn(async move {
            read_loop(stdout, event_tx_clone, request_rx, session_id_clone).await;
        });

        Ok(Box::new(runtime))
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
    kernel_session_id: String,
    acp_session_id: Arc<RwLock<Option<String>>>,
    pid: Option<u32>,
    event_tx: broadcast::Sender<BrainEvent>,
    request_tx: mpsc::Sender<(u64, PendingRequest)>,
    request_id_counter: AtomicU64,
    state: Arc<RwLock<AcpState>>,
    capabilities: Arc<RwLock<Option<AgentCapabilities>>>,
    config: AcpRuntimeConfig,
}

#[async_trait]
impl BrainRuntime for AcpBrainRuntime {
    async fn start(&mut self) -> Result<()> {
        info!("[AcpBrainRuntime] Starting ACP runtime");

        let stdin = {
            let mut process = self.process.write().await;
            process.stdin.take().ok_or_else(|| anyhow!("Failed to get stdin"))?
        };

        self.perform_handshake(stdin).await?;
        Ok(())
    }

    async fn send_input(&mut self, input: &str) -> Result<()> {
        let state = *self.state.read().await;
        if state != AcpState::SessionReady && state != AcpState::Prompting {
            return Err(anyhow!("ACP runtime not ready (state: {:?})", state));
        }

        let acp_session_id = self
            .acp_session_id
            .read()
            .await
            .clone()
            .ok_or_else(|| anyhow!("ACP session ID not available"))?;

        let prompt = vec![ContentBlock::Text {
            text: input.to_string(),
        }];

        let params = serde_json::to_value(PromptParams {
            session_id: acp_session_id,
            prompt,
        })?;

        *self.state.write().await = AcpState::Prompting;
        let _response = self.send_request("prompt", params).await?;

        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        info!("[AcpBrainRuntime] Stopping ACP runtime");

        *self.state.write().await = AcpState::Closed;

        let mut process = self.process.write().await;
        if let Some(stdin) = &mut process.stdin {
            let _ = stdin.write_all(b"\n").await;
            let _ = stdin.flush().await;
        }

        let _ = process.kill().await;
        Ok(())
    }

    fn subscribe(&self) -> broadcast::Receiver<BrainEvent> {
        self.event_tx.subscribe()
    }

    async fn health_check(&self) -> Result<bool> {
        let mut process = self.process.write().await;
        match process.try_wait() {
            Ok(None) => Ok(true),
            Ok(Some(_)) => Ok(false),
            Err(e) => Err(anyhow!("Failed to check process status: {}", e)),
        }
    }

    fn pid(&self) -> Option<u32> {
        self.pid
    }

    async fn get_state(&self) -> Result<Option<serde_json::Value>> {
        let acp_session = self.acp_session_id.read().await.clone();
        Ok(Some(serde_json::json!({
            "kernel_session_id": self.kernel_session_id,
            "acp_session_id": acp_session,
            "protocol": "acp",
            "protocol_version": "2.0",
        })))
    }

    /// Send tool result back to ACP agent
    async fn send_tool_result(&self, tool_call_id: &str, result: Value) -> Result<()> {
        let state = *self.state.read().await;
        if state != AcpState::SessionReady && state != AcpState::Prompting {
            return Err(anyhow!("Cannot send tool result in state: {:?}", state));
        }

        let params = serde_json::to_value(ToolResultParams {
            tool_call_id: tool_call_id.to_string(),
            result,
        })?;

        let _response = self.send_request("tool/result", params).await?;
        info!("[AcpBrainRuntime] Sent tool result for {}", tool_call_id);

        Ok(())
    }
}

impl AcpBrainRuntime {
    /// Send a JSON-RPC request and await the response
    async fn send_request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.request_id_counter.fetch_add(1, Ordering::SeqCst);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            method: method.to_string(),
            params,
        };

        let json = serde_json::to_string(&request)?;
        trace!("[AcpBrainRuntime] Sending request: {}", json);

        let (tx, rx) = oneshot::channel();
        self.request_tx.send((id, tx)).await?;

        {
            let mut process = self.process.write().await;
            if let Some(stdin) = &mut process.stdin {
                stdin.write_all(json.as_bytes()).await?;
                stdin.write_all(b"\n").await?;
                stdin.flush().await?;
            } else {
                return Err(anyhow!("ACP process stdin not available"));
            }
        }

        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(Ok(result))) => Ok(result),
            Ok(Ok(Err(e))) => Err(anyhow!("ACP error: {} (code: {})", e.message, e.code)),
            Ok(Err(_)) => Err(anyhow!("Response channel closed")),
            Err(_) => Err(anyhow!("Request timeout")),
        }
    }

    /// Perform strict ACP handshake: initialize -> session/new
    async fn perform_handshake(&self, _stdin: ChildStdin) -> Result<()> {
        info!("[AcpBrainRuntime] Performing ACP handshake");

        *self.state.write().await = AcpState::Initializing;

        // Step 1: Initialize
        let init_params = serde_json::to_value(InitializeParams {
            protocol_version: 1,
            client_info: ClientInfo {
                name: "Allternit".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            capabilities: Some(ClientCapabilities {
                tools: Some(ToolsCapabilities {
                    list: true,
                    call: true,
                }),
            }),
        })?;

        let init_result = self.send_request("initialize", init_params).await?;
        let init_result: InitializeResult = serde_json::from_value(init_result)?;

        info!(
            "[AcpBrainRuntime] Initialized: agent={} {}, protocol={}",
            init_result.agent_info.as_ref().map(|a| &a.name).unwrap_or(&"unknown".to_string()),
            init_result.agent_info.as_ref().map(|a| &a.version).unwrap_or(&"unknown".to_string()),
            init_result.protocol_version
        );

        *self.capabilities.write().await = init_result.agent_capabilities.clone();
        *self.state.write().await = AcpState::Initialized;

        // Check if authentication is required
        if let Some(auth_methods) = init_result.auth_methods {
            if !auth_methods.is_empty() {
                info!("[AcpBrainRuntime] Authentication required: {:?}", auth_methods);
                // For now, we proceed without auth - the session/new will fail if auth is mandatory
            }
        }

        // Step 2: Create session
        *self.state.write().await = AcpState::SessionCreating;

        let session_params = serde_json::to_value(NewSessionParams {
            cwd: self.config.cwd.as_ref().map(|p| p.to_string_lossy().to_string()),
            mcp_servers: vec![], // Required by OpenCode
        })?;

        let session_result = self.send_request("session/new", session_params).await?;
        let session_result: NewSessionResult = serde_json::from_value(session_result)?;

        info!(
            "[AcpBrainRuntime] Session created: {}",
            session_result.session_id
        );

        *self.acp_session_id.write().await = Some(session_result.session_id);
        *self.state.write().await = AcpState::SessionReady;

        Ok(())
    }
}

// ============================================================================
// Reader Loop and Message Handling
// ============================================================================

async fn read_loop(
    stdout: tokio::process::ChildStdout,
    event_tx: broadcast::Sender<BrainEvent>,
    mut request_rx: mpsc::Receiver<(u64, PendingRequest)>,
    _session_id: String,
) {
    let mut pending: HashMap<u64, PendingRequest> = HashMap::new();
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    loop {
        tokio::select! {
            Some((id, sender)) = request_rx.recv() => {
                pending.insert(id, sender);
            }

            result = lines.next_line() => {
                match result {
                    Ok(Some(line)) => {
                        if line.trim().is_empty() {
                            continue;
                        }
                        trace!("[AcpReader] Received: {}", line);

                        if let Err(e) = handle_acp_line(&line, &mut pending, &event_tx).await {
                            warn!("[AcpReader] Failed to handle line: {}", e);
                        }
                    }
                    Ok(None) => {
                        info!("[AcpReader] EOF reached");
                        break;
                    }
                    Err(e) => {
                        error!("[AcpReader] Read error: {}", e);
                        break;
                    }
                }
            }
        }
    }

    for (_, sender) in pending.drain() {
        let _ = sender.send(Err(JsonRpcError {
            code: -32603,
            message: "Connection closed".to_string(),
            data: None,
        }));
    }
}

async fn handle_acp_line(
    line: &str,
    pending: &mut HashMap<u64, PendingRequest>,
    event_tx: &broadcast::Sender<BrainEvent>,
) -> Result<()> {
    let value: Value = serde_json::from_str(line)?;

    // Check if it's a response (has id)
    if let Some(id) = value.get("id").and_then(|v| v.as_u64()) {
        if let Some(sender) = pending.remove(&id) {
            if let Some(error) = value.get("error") {
                let error: JsonRpcError = serde_json::from_value(error.clone())?;
                let _ = sender.send(Err(error));
            } else if let Some(result) = value.get("result") {
                let _ = sender.send(Ok(result.clone()));
            } else {
                let _ = sender.send(Ok(Value::Null));
            }
        }
        return Ok(());
    }

    // It's a notification (no id, has method)
    if let Some(method) = value.get("method").and_then(|m| m.as_str()) {
        match method {
            "session/update" => {
                match serde_json::from_value::<JsonRpcNotification<SessionNotification>>(value.clone()) {
                    Ok(notification) => {
                        if let Err(e) = handle_session_update(notification.params, event_tx).await {
                            warn!("[AcpReader] Failed to handle session update: {}", e);
                        }
                    }
                    Err(e) => {
                        warn!("[AcpReader] Failed to parse session/update: {}. Raw: {}", e, line);
                        // TOLERATE: Don't crash on unknown shapes, just log
                    }
                }
            }
            _ => {
                trace!("[AcpReader] Unhandled notification: {}", method);
            }
        }
    }

    Ok(())
}

async fn handle_session_update(
    params: SessionNotification,
    event_tx: &broadcast::Sender<BrainEvent>,
) -> Result<()> {
    match params.update {
        SessionUpdate::UserMessageChunk { content } => {
            // Echo user message (optional - usually not displayed)
            if let ContentBlock::Text { text } = content.content {
                trace!("[AcpReader] User: {}", text);
            }
        }
        SessionUpdate::AgentMessageChunk { content } => {
            if let ContentBlock::Text { text } = content.content {
                let _ = event_tx.send(BrainEvent::ChatDelta {
                    text,
                    event_id: None,
                });
            }
        }
        SessionUpdate::AgentThoughtChunk { content } => {
            if let ContentBlock::Text { text } = content.content {
                let _ = event_tx.send(BrainEvent::ChatDelta {
                    text: format!("[thinking] {}", text),
                    event_id: None,
                });
            }
        }
        SessionUpdate::ToolCall { call } => {
            let _ = event_tx.send(BrainEvent::ToolCall {
                tool_id: call.kind.clone(),
                call_id: call.tool_call_id.clone(),
                args: call.raw_input.map(|v| v.to_string()).unwrap_or_default(),
                event_id: None,
            });
        }
        SessionUpdate::ToolCallUpdate { update } => {
            // Tool call status update (progress, completion)
            trace!(
                "[AcpReader] Tool call update: {} status={:?}",
                update.tool_call_id,
                update.status
            );
        }
        SessionUpdate::Plan { plan } => {
            trace!("[AcpReader] Plan: {:?}", plan.title);
            // Plans could be emitted as special events if needed
        }
        SessionUpdate::Unknown => {
            // TOLERATE: Unknown update types are logged and ignored
            trace!("[AcpReader] Unknown session update type (tolerated)");
        }
    }

    Ok(())
}

fn command_exists(command: &str) -> bool {
    if command.contains('/') || command.contains('\\') {
        std::path::Path::new(command).exists()
    } else {
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
