//! A2R ACP Adapter - Connects agent-shell (Emacs) to a2rchitech
//!
//! Implements the Agent Client Protocol (ACP) over stdio,
//! forwarding requests to a2rchitech kernel-service.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead, Write};
use tracing::{debug, error, info, trace, warn};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging to stderr (so it doesn't interfere with stdio JSON-RPC)
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("a2r_acp=info".parse().unwrap()),
        )
        .with_writer(io::stderr)
        .with_ansi(false)
        .init();

    info!("A2R ACP Adapter starting");
    info!("ACP Protocol Version: 2024-11-05");

    let adapter = AcpAdapter::new();
    adapter.run().await?;

    Ok(())
}

/// ACP JSON-RPC request
#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Option<Value>,
}

/// ACP JSON-RPC response
#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

/// ACP Notification from server to client
#[derive(Debug, Serialize)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

/// ACP Adapter implementing the Agent Client Protocol
struct AcpAdapter {
    request_counter: std::sync::atomic::AtomicU64,
}

impl AcpAdapter {
    fn new() -> Self {
        Self {
            request_counter: std::sync::atomic::AtomicU64::new(0),
        }
    }

    async fn run(&self) -> Result<()> {
        info!("Waiting for ACP requests on stdin...");

        let stdin = io::stdin();
        let reader = stdin.lock();

        for line in reader.lines() {
            let line = line.context("Failed to read line from stdin")?;
            trace!("Received: {}", line);

            match serde_json::from_str::<JsonRpcRequest>(&line) {
                Ok(request) => {
                    if let Err(e) = self.handle_request(request).await {
                        error!("Error handling request: {}", e);
                    }
                }
                Err(e) => {
                    error!("Failed to parse JSON-RPC request: {}", e);
                    self.send_error(None, -32700, "Parse error", None).await?;
                }
            }
        }

        info!("Stdin closed, shutting down");
        Ok(())
    }

    async fn handle_request(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling method: {}", request.method);

        match request.method.as_str() {
            "initialize" => self.handle_initialize(request).await,
            "initialized" => {
                // Client notification, no response needed
                debug!("Received initialized notification");
                Ok(())
            }
            "prompts/list" => self.handle_prompts_list(request).await,
            "prompts/get" => self.handle_prompts_get(request).await,
            "tools/list" => self.handle_tools_list(request).await,
            "tools/call" => self.handle_tools_call(request).await,
            "completion/complete" => self.handle_complete(request).await,
            "logging/setLevel" => self.handle_set_level(request).await,
            "cancel" => self.handle_cancel(request).await,
            _ => {
                warn!("Unknown method: {}", request.method);
                self.send_error(
                    request.id,
                    -32601,
                    &format!("Method not found: {}", request.method),
                    None,
                )
                .await
            }
        }
    }

    async fn handle_initialize(&self, request: JsonRpcRequest) -> Result<()> {
        info!("Handling initialize request");

        // Parse initialize params
        let params = request.params.as_ref().and_then(|p| p.as_object());
        let protocol_version = params
            .and_then(|p| p.get("protocolVersion"))
            .and_then(|v| v.as_str())
            .unwrap_or("2024-11-05");
        let client_info = params.and_then(|p| p.get("clientInfo"));

        info!("Client protocol version: {}", protocol_version);
        if let Some(info) = client_info {
            info!("Client info: {}", info);
        }

        // Send initialize response with server capabilities
        let result = serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "prompts": {
                    "listChanged": true
                },
                "tools": {
                    "listChanged": true
                },
                "logging": {},
                "experimental": {}
            },
            "serverInfo": {
                "name": "a2r-acp",
                "version": env!("CARGO_PKG_VERSION")
            }
        });

        self.send_response(request.id, result).await?;

        // Send initialized notification
        self.send_notification("notifications/initialized", None).await?;

        info!("Initialization complete");
        Ok(())
    }

    async fn handle_prompts_list(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling prompts/list");

        let result = serde_json::json!({
            "prompts": [
                {
                    "name": "default",
                    "description": "Default A2R prompt",
                    "arguments": [
                        {
                            "name": "input",
                            "description": "User input",
                            "required": true
                        }
                    ]
                },
                {
                    "name": "code",
                    "description": "Code-focused A2R prompt",
                    "arguments": [
                        {
                            "name": "input",
                            "description": "Code request",
                            "required": true
                        }
                    ]
                }
            ]
        });

        self.send_response(request.id, result).await
    }

    async fn handle_prompts_get(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling prompts/get");

        let params = request.params.as_ref().and_then(|p| p.as_object());
        let name = params
            .and_then(|p| p.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("default");
        let arguments = params.and_then(|p| p.get("arguments"));
        let input = arguments
            .and_then(|a| a.get("input"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        info!("Getting prompt '{}' with input: {}", name, input);

        // Forward to a2rchitect kernel-service
        // For now, simulate a streaming response
        self.send_streaming_content(request.id.clone(), input).await?;

        let result = serde_json::json!({
            "description": format!("A2R {} response", name),
            "messages": [
                {
                    "role": "assistant",
                    "content": {
                        "type": "text",
                        "text": format!("Processing: {}\n\n(A2R integration pending - this is the ACP adapter)", input)
                    }
                }
            ]
        });

        self.send_response(request.id, result).await
    }

    async fn handle_tools_list(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling tools/list");

        let result = serde_json::json!({
            "tools": [
                {
                    "name": "fs/read_text_file",
                    "description": "Read a text file from the filesystem",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Path to the file"
                            }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "fs/write_text_file",
                    "description": "Write content to a text file",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Path to the file"
                            },
                            "content": {
                                "type": "string",
                                "description": "Content to write"
                            }
                        },
                        "required": ["path", "content"]
                    }
                },
                {
                    "name": "a2r/capsule_execute",
                    "description": "Execute an A2R capsule",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "capsule_id": {
                                "type": "string",
                                "description": "ID of the capsule to execute"
                            }
                        },
                        "required": ["capsule_id"]
                    }
                }
            ]
        });

        self.send_response(request.id, result).await
    }

    async fn handle_tools_call(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling tools/call");

        let params = request.params.as_ref().and_then(|p| p.as_object());
        let name = params
            .and_then(|p| p.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let arguments = params.and_then(|p| p.get("arguments")).cloned().unwrap_or_default();

        info!("Tool call: {} with args: {}", name, arguments);

        // Execute the tool
        let result = match name {
            "fs/read_text_file" => {
                let path = arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                match tokio::fs::read_to_string(path).await {
                    Ok(content) => serde_json::json!({
                        "content": [{"type": "text", "text": content}]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{"type": "text", "text": format!("Error reading file: {}", e)}],
                        "isError": true
                    }),
                }
            }
            "fs/write_text_file" => {
                let path = arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let content = arguments.get("content").and_then(|v| v.as_str()).unwrap_or("");
                match tokio::fs::write(path, content).await {
                    Ok(_) => serde_json::json!({
                        "content": [{"type": "text", "text": "File written successfully"}]
                    }),
                    Err(e) => serde_json::json!({
                        "content": [{"type": "text", "text": format!("Error writing file: {}", e)}],
                        "isError": true
                    }),
                }
            }
            "a2r/capsule_execute" => {
                let capsule_id = arguments.get("capsule_id").and_then(|v| v.as_str()).unwrap_or("");
                serde_json::json!({
                    "content": [{"type": "text", "text": format!("Capsule execution not yet implemented. Requested: {}", capsule_id)}],
                    "isError": true
                })
            }
            _ => serde_json::json!({
                "content": [{"type": "text", "text": format!("Unknown tool: {}", name)}],
                "isError": true
            }),
        };

        self.send_response(request.id, result).await
    }

    async fn handle_complete(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling completion/complete");

        let result = serde_json::json!({
            "completion": {
                "values": [],
                "total": 0,
                "hasMore": false
            }
        });

        self.send_response(request.id, result).await
    }

    async fn handle_set_level(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling logging/setLevel");
        self.send_response(request.id, serde_json::json!(null)).await
    }

    async fn handle_cancel(&self, request: JsonRpcRequest) -> Result<()> {
        debug!("Handling cancel");
        self.send_response(request.id, serde_json::json!(null)).await
    }

    async fn send_streaming_content(&self, request_id: Option<Value>, _input: &str) -> Result<()> {
        // Send progress notifications for streaming content
        // This simulates what a real A2R streaming response would look like

        self.send_notification(
            "notifications/progress",
            Some(serde_json::json!({
                "progressToken": request_id.clone(),
                "progress": 0,
                "total": 100
            })),
        )
        .await?;

        Ok(())
    }

    async fn send_response(&self, id: Option<Value>, result: Value) -> Result<()> {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        };

        let json = serde_json::to_string(&response)?;
        self.write_line(&json).await
    }

    async fn send_error(
        &self,
        id: Option<Value>,
        code: i32,
        message: &str,
        data: Option<Value>,
    ) -> Result<()> {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.to_string(),
                data,
            }),
        };

        let json = serde_json::to_string(&response)?;
        self.write_line(&json).await
    }

    async fn send_notification(&self, method: &str, params: Option<Value>) -> Result<()> {
        let notification = JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        };

        let json = serde_json::to_string(&notification)?;
        self.write_line(&json).await
    }

    async fn write_line(&self, json: &str) -> Result<()> {
        trace!("Sending: {}", json);

        let stdout = io::stdout();
        let mut handle = stdout.lock();
        writeln!(handle, "{}", json)?;
        handle.flush()?;

        Ok(())
    }
}
