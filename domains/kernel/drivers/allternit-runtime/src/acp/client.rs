//! ACP client for agent communication
//!
//! Based on agent-shell/src/acp/client.rs - modified to support split response stream.

use crate::acp::{
    AcpAgentConfig, CancelParams, ClientCapabilities, ClientInfo, InitializeParams,
    PromptsCapability, ProtocolVersion, Request, ToolsCapability,
};
use crate::supervision::RuntimeError;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;
use tracing::{debug, error, info, trace, warn};

/// ACP client managing connection to agent process
///
/// This spawns a subprocess, does ACP handshake, and streams JSON-RPC messages.
pub struct AcpClient {
    /// Child process handle
    child: Child,

    /// stdin for sending requests
    stdin: ChildStdin,

    /// Response receiver
    response_rx: mpsc::UnboundedReceiver<serde_json::Value>,

    /// Shutdown signal sender
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,

    /// Request counter for JSON-RPC
    request_id: u64,
}

/// Response stream that can be read independently from the client
pub struct AcpResponseStream {
    pub rx: mpsc::UnboundedReceiver<serde_json::Value>,
}

impl AcpClient {
    /// Spawn a new ACP client connected to an agent
    pub async fn spawn(config: &AcpAgentConfig) -> Result<Self, RuntimeError> {
        info!("Spawning ACP client for agent: {}", config.name);

        // Build command
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        // Set environment
        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        // Set working directory if specified
        if let Some(ref cwd) = config.cwd {
            cmd.current_dir(cwd);
        }

        // Spawn process
        let mut child = cmd.spawn().map_err(|e| {
            RuntimeError::ProviderUnhealthy(format!("Failed to spawn agent: {}", e))
        })?;

        let stdin = child.stdin.take().expect("stdin not available");
        let stdout = child.stdout.take().expect("stdout not available");
        let stderr = child.stderr.take().expect("stderr not available");

        // Start reader task
        let (response_tx, response_rx) = mpsc::unbounded_channel();
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

        tokio::spawn(Self::reader_task(stdout, response_tx, shutdown_rx));
        tokio::spawn(Self::stderr_task(stderr));

        let mut client = Self {
            child,
            stdin,
            response_rx,
            shutdown_tx: Some(shutdown_tx),
            request_id: 0,
        };

        // Initialize - do ACP handshake with correct protocol version
        client.initialize(&config.id).await?;

        info!(
            "ACP client initialized successfully for agent: {}",
            config.name
        );
        Ok(client)
    }

    /// Split the client into a command sender and response stream
    ///
    /// This allows reading responses in one task while sending commands from another.
    pub fn split(mut self) -> (AcpCommandSender, AcpResponseStream) {
        let response_stream = AcpResponseStream {
            rx: self.response_rx,
        };

        let sender = AcpCommandSender {
            stdin: self.stdin,
            shutdown_tx: self.shutdown_tx.take(),
            request_id: self.request_id,
            _child: self.child, // Keep child alive
        };

        (sender, response_stream)
    }

    /// Initialize connection
    async fn initialize(&mut self, agent_id: &str) -> Result<(), RuntimeError> {
        let request = Request::Initialize {
            params: InitializeParams {
                protocol_version: ProtocolVersion::for_agent(agent_id),
                capabilities: ClientCapabilities {
                    experimental: None,
                    prompts: Some(PromptsCapability {
                        list_changed: false,
                    }),
                    tools: Some(ToolsCapability {
                        list_changed: false,
                    }),
                    logging: None,
                },
                client_info: ClientInfo {
                    name: "allternit-runtime".to_string(),
                    version: env!("CARGO_PKG_VERSION").to_string(),
                },
            },
        };

        self.send_request(request).await?;

        // Wait for initialized notification OR initialize response
        // Some agents send "notifications/initialized", others just respond to initialize
        tokio::time::timeout(std::time::Duration::from_secs(30), async {
            while let Some(msg) = self.response_rx.recv().await {
                trace!("Received during init: {:?}", msg);

                // Check for initialized notification
                if msg.get("method").and_then(|m| m.as_str()) == Some("notifications/initialized") {
                    info!(
                        "ACP initialization completed (via notification) for agent: {}",
                        agent_id
                    );
                    return Ok(());
                }

                // Check for initialize RESPONSE (id:1 with result containing protocolVersion)
                // This is how opencode and many ACP agents signal initialization complete
                if msg.get("id").and_then(|i| i.as_u64()) == Some(1) {
                    if let Some(result) = msg.get("result") {
                        if result.get("protocolVersion").is_some() {
                            info!(
                                "ACP initialization completed (via response) for agent: {}",
                                agent_id
                            );
                            return Ok(());
                        }
                    }
                }

                // Handle permission/confirmation requests during init
                // These must be responded to or the agent will hang
                if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
                    match method {
                        // Tool permission request - auto-approve for now
                        "tools/call" | "request/tool_call" => {
                            info!("Auto-approving tool call request during init");
                            // Send approval response
                            let call_id = msg.get("id").and_then(|i| i.as_u64()).unwrap_or(0);
                            let approval = serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": call_id,
                                "result": { "approved": true }
                            });
                            let _ = self.send_json(approval).await;
                        }
                        // Confirmation request - auto-confirm
                        "request/confirmation" | "confirm/action" => {
                            info!("Auto-confirming action request during init");
                            let call_id = msg.get("id").and_then(|i| i.as_u64()).unwrap_or(0);
                            let confirm = serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": call_id,
                                "result": { "confirmed": true }
                            });
                            let _ = self.send_json(confirm).await;
                        }
                        // Auth prompt - log it
                        "request/auth" | "auth/prompt" => {
                            warn!("Auth request during init - may need user interaction");
                            let auth_msg = msg
                                .get("params")
                                .and_then(|p| p.get("message"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Authentication required");
                            warn!("Auth prompt: {}", auth_msg);
                        }
                        // Unknown method - log and continue
                        _ => {
                            trace!("Unknown method during init: {}", method);
                        }
                    }
                }

                // Check for error responses
                if msg.get("error").is_some() {
                    let error_msg = msg
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    warn!("ACP error during init: {}", error_msg);
                }
            }
            Err(RuntimeError::ProviderUnhealthy(
                "Connection closed during init".to_string(),
            ))
        })
        .await
        .map_err(|_| RuntimeError::ProviderUnhealthy("ACP initialization timeout".to_string()))?
    }

    /// Send raw JSON message (for permission/confirmation responses)
    async fn send_json(&mut self, msg: serde_json::Value) -> Result<(), RuntimeError> {
        let json = serde_json::to_string(&msg)
            .map_err(|e| RuntimeError::ProviderError(format!("JSON serialize error: {}", e)))?;

        self.stdin
            .write_all(json.as_bytes())
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Flush error: {}", e)))?;

        Ok(())
    }

    /// Send a request
    async fn send_request(&mut self, request: Request) -> Result<u64, RuntimeError> {
        self.request_id += 1;
        let id = self.request_id;

        let message = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": match &request {
                Request::Initialize { .. } => "initialize",
                Request::PromptsList => "prompts/list",
                Request::PromptsGet { .. } => "prompts/get",
                Request::ToolsList => "tools/list",
                Request::ToolsCall { .. } => "tools/call",
                Request::Complete { .. } => "complete",
                Request::LoggingSetLevel { .. } => "logging/setLevel",
                Request::Cancel { .. } => "cancel",
            },
            "params": match request {
                Request::Initialize { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
                Request::PromptsList => serde_json::json!({}),
                Request::PromptsGet { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
                Request::ToolsList => serde_json::json!({}),
                Request::ToolsCall { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
                Request::Complete { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
                Request::LoggingSetLevel { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
                Request::Cancel { params } => serde_json::to_value(params)
                    .map_err(|e| RuntimeError::ProviderError(format!("Serialize error: {}", e)))?,
            }
        });

        let json = serde_json::to_string(&message)
            .map_err(|e| RuntimeError::ProviderError(format!("JSON serialize error: {}", e)))?;
        trace!("Sending: {}", json);

        self.stdin
            .write_all(json.as_bytes())
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Flush error: {}", e)))?;

        Ok(id)
    }

    /// Send a prompt to the agent
    pub async fn send_prompt(&mut self, prompt: &str) -> Result<(), RuntimeError> {
        debug!("Sending prompt: {}", prompt);

        let request = Request::PromptsGet {
            params: crate::acp::PromptsGetParams {
                name: "default".to_string(),
                arguments: Some({
                    let mut args = serde_json::Map::new();
                    args.insert("input".to_string(), prompt.into());
                    args
                }),
            },
        };

        self.send_request(request).await?;
        Ok(())
    }

    /// Cancel current operation
    pub async fn cancel(&mut self) -> Result<(), RuntimeError> {
        debug!("Sending cancel request");

        let request = Request::Cancel {
            params: CancelParams { request_id: None },
        };

        self.send_request(request).await?;
        Ok(())
    }

    /// Shutdown the client
    pub async fn shutdown(mut self) -> Result<(), RuntimeError> {
        info!("Shutting down ACP client");

        // Signal reader to stop
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }

        // Kill process
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;

        Ok(())
    }

    /// Reader task for stdout
    async fn reader_task(
        stdout: ChildStdout,
        tx: mpsc::UnboundedSender<serde_json::Value>,
        mut shutdown: tokio::sync::oneshot::Receiver<()>,
    ) {
        let mut reader = BufReader::new(stdout).lines();

        loop {
            tokio::select! {
                line = reader.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            trace!("Received line: {}", line);

                            match serde_json::from_str::<serde_json::Value>(&line) {
                                Ok(msg) => {
                                    if tx.send(msg).is_err() {
                                        break;
                                    }
                                }
                                Err(e) => {
                                    warn!("Failed to parse message: {} - line: {}", e, line);
                                }
                            }
                        }
                        Ok(None) => break,
                        Err(e) => {
                            error!("Error reading stdout: {}", e);
                            break;
                        }
                    }
                }
                _ = &mut shutdown => {
                    info!("Reader received shutdown signal");
                    break;
                }
            }
        }
    }

    /// Reader task for stderr
    async fn stderr_task(stderr: tokio::process::ChildStderr) {
        let mut reader = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = reader.next_line().await {
            trace!("Agent stderr: {}", line);
        }
    }
}

/// Command sender after splitting the client
///
/// This allows sending commands to the ACP agent while the response stream
/// is being read elsewhere.
pub struct AcpCommandSender {
    stdin: ChildStdin,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
    request_id: u64,
    _child: Child, // Keep child alive
}

impl AcpCommandSender {
    /// Send a prompt to the agent
    pub async fn send_prompt(&mut self, prompt: &str) -> Result<(), RuntimeError> {
        debug!("Sending prompt: {}", prompt);

        self.request_id += 1;
        let id = self.request_id;

        let message = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "prompts/get",
            "params": {
                "name": "default",
                "arguments": {
                    "input": prompt
                }
            }
        });

        let json = serde_json::to_string(&message)
            .map_err(|e| RuntimeError::ProviderError(format!("JSON serialize error: {}", e)))?;
        trace!("Sending: {}", json);

        self.stdin
            .write_all(json.as_bytes())
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .write_all(b"\n")
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Write error: {}", e)))?;
        self.stdin
            .flush()
            .await
            .map_err(|e| RuntimeError::ProviderError(format!("Flush error: {}", e)))?;

        Ok(())
    }

    /// Shutdown the client
    pub async fn shutdown(mut self) -> Result<(), RuntimeError> {
        info!("Shutting down ACP command sender");

        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }

        let _ = self._child.kill().await;
        let _ = self._child.wait().await;

        Ok(())
    }
}

impl AcpResponseStream {
    /// Receive the next response from the agent
    pub async fn recv(&mut self) -> Option<serde_json::Value> {
        self.rx.recv().await
    }
}
