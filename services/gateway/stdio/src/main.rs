// services/gateways/gateway-stdio/src/main.rs
//
// IO Bridge (stdio NDJSON-RPC) implementation
// This service handles communication via stdin/stdout using NDJSON-RPC format

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::io::{self, Write};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::sync::Mutex;
use tracing::{debug, error, info};

/// RPC Request structure following JSON-RPC 2.0 specification
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

/// RPC Response structure following JSON-RPC 2.0 specification
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

/// RPC Error structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// IO Bridge configuration
#[derive(Debug, Clone)]
pub struct IoBridgeConfig {
    pub buffer_size: usize,
    pub max_message_size: usize,
}

impl Default for IoBridgeConfig {
    fn default() -> Self {
        IoBridgeConfig {
            buffer_size: 8192,
            max_message_size: 1024 * 1024, // 1MB
        }
    }
}

/// IO Bridge implementation
pub struct IoBridge {
    config: IoBridgeConfig,
    handler: Arc<Mutex<dyn RpcHandler + Send>>,
}

impl IoBridge {
    pub fn new(config: IoBridgeConfig, handler: Arc<Mutex<dyn RpcHandler + Send>>) -> Self {
        Self { config, handler }
    }

    /// Start the IO Bridge event loop
    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting IO Bridge (stdio NDJSON-RPC)");

        let stdin = tokio::io::stdin();
        let mut reader = AsyncBufReader::new(stdin).lines();

        loop {
            match reader.next_line().await {
                Ok(Some(input)) => {
                    if input.trim().is_empty() {
                        continue;
                    }

                    // Check message size against max_message_size configuration
                    if input.len() > self.config.max_message_size {
                        error!("Message exceeds maximum size ({} > {})", input.len(), self.config.max_message_size);

                        // Send error response
                        let error_response = RpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id: None,
                            result: None,
                            error: Some(RpcError {
                                code: -32600, // Invalid Request
                                message: format!("Request too large: {} bytes (max: {})", input.len(), self.config.max_message_size),
                                data: None,
                            }),
                        };

                        if let Ok(json_error) = serde_json::to_string(&error_response) {
                            println!("{}", json_error);
                            if let Err(e) = std::io::stdout().flush() {
                                error!("Failed to flush stdout: {}", e);
                            }
                        }
                        continue;
                    }

                    debug!("Received input: {}", input);

                    // Parse the NDJSON line as an RPC request
                    match serde_json::from_str::<RpcRequest>(&input) {
                        Ok(request) => {
                            // Handle the request asynchronously
                            let handler = Arc::clone(&self.handler);
                            let response = {
                                let mut handler_lock = handler.lock().await;
                                handler_lock.handle_request(request).await
                            };

                            // Send the response back via stdout
                            if let Some(response) = response {
                                if let Ok(json_response) = serde_json::to_string(&response) {
                                    println!("{}", json_response);
                                    // Flush stdout to ensure the response is sent immediately
                                    if let Err(e) = std::io::stdout().flush() {
                                        error!("Failed to flush stdout: {}", e);
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse RPC request: {}", e);

                            // Send error response
                            let error_response = RpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id: None,
                                result: None,
                                error: Some(RpcError {
                                    code: -32700, // Parse error
                                    message: format!("Parse error: {}", e),
                                    data: None,
                                }),
                            };

                            if let Ok(json_error) = serde_json::to_string(&error_response) {
                                println!("{}", json_error);
                                if let Err(e) = std::io::stdout().flush() {
                                    error!("Failed to flush stdout: {}", e);
                                }
                            }
                        }
                    }
                }
                Ok(None) => {
                    // EOF reached, exit the loop
                    info!("EOF reached, exiting IO Bridge");
                    break;
                }
                Err(e) => {
                    error!("Error reading from stdin: {}", e);
                    break;
                }
            }
        }

        info!("IO Bridge shutting down");
        Ok(())
    }
}

/// Trait for handling RPC requests
#[async_trait::async_trait]
pub trait RpcHandler: Send + Sync {
    async fn handle_request(&mut self, request: RpcRequest) -> Option<RpcResponse>;
}

/// Default implementation of RpcHandler that responds to basic methods
pub struct DefaultRpcHandler {}

#[async_trait::async_trait]
impl RpcHandler for DefaultRpcHandler {
    async fn handle_request(&mut self, request: RpcRequest) -> Option<RpcResponse> {
        info!("Handling RPC request: {} with id {:?}", request.method, request.id);

        match request.method.as_str() {
            "ping" => {
                Some(RpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: Some(serde_json::json!("pong")),
                    error: None,
                })
            }
            "echo" => {
                Some(RpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: request.params,
                    error: None,
                })
            }
            "health" => {
                Some(RpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: Some(serde_json::json!({
                        "status": "healthy",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    })),
                    error: None,
                })
            }
            _ => {
                Some(RpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: None,
                    error: Some(RpcError {
                        code: -32601, // Method not found
                        message: format!("Method '{}' not found", request.method),
                        data: None,
                    }),
                })
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("IO Bridge (stdio NDJSON-RPC) starting...");

    // Create default configuration
    let config = IoBridgeConfig::default();

    // Create default handler
    let handler = Arc::new(Mutex::new(DefaultRpcHandler {}));

    // Create and run the IO Bridge
    let io_bridge = IoBridge::new(config, handler);
    io_bridge.run().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn test_io_bridge_ping() {
        let config = IoBridgeConfig::default();
        let handler = Arc::new(Mutex::new(DefaultRpcHandler {}));
        let io_bridge = IoBridge::new(config, handler);

        // Create a mock request
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(1)),
            method: "ping".to_string(),
            params: None,
        };

        // Create a handler to process the request
        let mut handler = DefaultRpcHandler {};
        let response = handler.handle_request(request).await;

        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.jsonrpc, "2.0");
        assert!(response.result.is_some());
        assert_eq!(response.result.unwrap(), serde_json::json!("pong"));
    }

    #[tokio::test]
    async fn test_io_bridge_echo() {
        let handler = Arc::new(Mutex::new(DefaultRpcHandler {}));
        let mut handler_ref = handler.lock().await;

        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(2)),
            method: "echo".to_string(),
            params: Some(serde_json::json!("hello world")),
        };

        let response = handler_ref.handle_request(request).await;

        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.jsonrpc, "2.0");
        assert!(response.result.is_some());
        assert_eq!(response.result.unwrap(), serde_json::json!("hello world"));
    }

    #[tokio::test]
    async fn test_io_bridge_unknown_method() {
        let handler = Arc::new(Mutex::new(DefaultRpcHandler {}));
        let mut handler_ref = handler.lock().await;

        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(3)),
            method: "unknown_method".to_string(),
            params: None,
        };

        let response = handler_ref.handle_request(request).await;

        assert!(response.is_some());
        let response = response.unwrap();
        assert_eq!(response.jsonrpc, "2.0");
        assert!(response.error.is_some());
        assert_eq!(response.error.unwrap().code, -32601); // Method not found
    }
}