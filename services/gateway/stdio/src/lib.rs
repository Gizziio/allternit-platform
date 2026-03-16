//! # A2R Stdio Gateway
//!
//! Stdio-based NDJSON-RPC gateway for A2R.
//!
//! ## Overview
//!
//! This crate provides an IO bridge implementation using NDJSON-RPC
//! (Newline Delimited JSON-RPC) over stdin/stdout. It enables
//! communication between the A2R system and external processes
//! through a simple, language-agnostic protocol.
//!
//! ## Protocol
//!
//! The gateway uses JSON-RPC 2.0 messages encoded as newline-delimited
//! JSON (NDJSON). Each line is a complete JSON-RPC request or response.
//!
//! ## Features
//!
//! - Bidirectional communication over stdin/stdout
//! - Async message handling
//! - Configurable message size limits
//! - Automatic error responses for malformed messages
//!
//! ## Example
//!
//! ```rust,no_run
//! use stdio_gateway::{IoBridge, IoBridgeConfig, DefaultRpcHandler};
//! use std::sync::Arc;
//! use tokio::sync::Mutex;
//!
//! async fn example() {
//!     let config = IoBridgeConfig::default();
//!     let handler = Arc::new(Mutex::new(DefaultRpcHandler {}));
//!     let bridge = IoBridge::new(config, handler);
//!     
//!     // Run the bridge (reads from stdin, writes to stdout)
//!     // bridge.run().await;
//! }
//! ```

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::io::{self, Write};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::sync::Mutex;
use tracing::{debug, error, info};

/// JSON-RPC 2.0 request structure.
///
/// `RpcRequest` represents an incoming JSON-RPC method call.
///
/// # Examples
///
/// ```
/// use stdio_gateway::RpcRequest;
///
/// let request = RpcRequest {
///     jsonrpc: "2.0".to_string(),
///     id: Some(serde_json::json!(1)),
///     method: "echo".to_string(),
///     params: Some(serde_json::json!("hello")),
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcRequest {
    /// JSON-RPC version (must be "2.0")
    pub jsonrpc: String,
    
    /// Request identifier (null for notifications)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<serde_json::Value>,
    
    /// Method name to call
    pub method: String,
    
    /// Method parameters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

impl RpcRequest {
    /// Creates a new RPC request.
    ///
    /// # Arguments
    ///
    /// * `method` - Method name
    /// * `params` - Optional parameters
    pub fn new(method: impl Into<String>, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(serde_json::json!(uuid::Uuid::new_v4().to_string())),
            method: method.into(),
            params,
        }
    }
    
    /// Creates a notification request (no response expected).
    pub fn notification(method: impl Into<String>, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: None,
            method: method.into(),
            params,
        }
    }
    
    /// Returns true if this is a notification (no response needed).
    pub fn is_notification(&self) -> bool {
        self.id.is_none()
    }
}

/// JSON-RPC 2.0 response structure.
///
/// `RpcResponse` represents the result of a JSON-RPC method call.
///
/// # Examples
///
/// ```
/// use stdio_gateway::RpcResponse;
///
/// let response = RpcResponse {
///     jsonrpc: "2.0".to_string(),
///     id: Some(serde_json::json!(1)),
///     result: Some(serde_json::json!("pong")),
///     error: None,
/// };
/// ```
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcResponse {
    /// JSON-RPC version
    pub jsonrpc: String,
    
    /// Request identifier (matches the request)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<serde_json::Value>,
    
    /// Result data (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    
    /// Error information (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

impl RpcResponse {
    /// Creates a success response.
    pub fn success(id: Option<serde_json::Value>, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }
    
    /// Creates an error response.
    pub fn error(id: Option<serde_json::Value>, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }
    
    /// Creates a parse error response.
    pub fn parse_error(message: impl Into<String>) -> Self {
        Self::error(None, -32700, message)
    }
    
    /// Creates an invalid request error response.
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::error(None, -32600, message)
    }
    
    /// Creates a method not found error response.
    pub fn method_not_found(id: Option<serde_json::Value>, method: &str) -> Self {
        Self::error(id, -32601, format!("Method '{}' not found", method))
    }
    
    /// Returns true if this is an error response.
    pub fn is_error(&self) -> bool {
        self.error.is_some()
    }
}

/// JSON-RPC error structure.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RpcError {
    /// Error code
    pub code: i32,
    
    /// Error message
    pub message: String,
    
    /// Additional error data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl RpcError {
    /// Creates a new RPC error.
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }
    
    /// Adds data to the error.
    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = Some(data);
        self
    }
}

/// IO Bridge configuration.
///
/// `IoBridgeConfig` contains settings for the IO bridge operation.
///
/// # Examples
///
/// ```
/// use stdio_gateway::IoBridgeConfig;
///
/// let config = IoBridgeConfig {
///     buffer_size: 8192,
///     max_message_size: 1024 * 1024,
/// };
/// ```
#[derive(Debug, Clone)]
pub struct IoBridgeConfig {
    /// Read buffer size in bytes
    pub buffer_size: usize,
    
    /// Maximum allowed message size in bytes
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

impl IoBridgeConfig {
    /// Creates a new config with custom buffer size.
    pub fn with_buffer_size(mut self, size: usize) -> Self {
        self.buffer_size = size;
        self
    }
    
    /// Creates a new config with custom max message size.
    pub fn with_max_message_size(mut self, size: usize) -> Self {
        self.max_message_size = size;
        self
    }
}

/// IO Bridge implementation.
///
/// `IoBridge` handles the NDJSON-RPC communication over stdin/stdout.
pub struct IoBridge {
    config: IoBridgeConfig,
    handler: Arc<Mutex<dyn RpcHandler + Send>>,
}

impl IoBridge {
    /// Creates a new IO bridge.
    ///
    /// # Arguments
    ///
    /// * `config` - Bridge configuration
    /// * `handler` - RPC request handler
    pub fn new(config: IoBridgeConfig, handler: Arc<Mutex<dyn RpcHandler + Send>>) -> Self {
        Self { config, handler }
    }

    /// Runs the IO bridge event loop.
    ///
    /// This method reads NDJSON-RPC requests from stdin and writes
    /// responses to stdout. It runs until EOF is reached on stdin.
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

                    // Check message size
                    if input.len() > self.config.max_message_size {
                        error!(
                            "Message exceeds maximum size ({} > {})",
                            input.len(),
                            self.config.max_message_size
                        );

                        let error_response = RpcResponse::invalid_request(format!(
                            "Request too large: {} bytes (max: {})",
                            input.len(),
                            self.config.max_message_size
                        ));

                        self.send_response(&error_response).await?;
                        continue;
                    }

                    debug!("Received input: {}", input);

                    // Parse and handle the request
                    match serde_json::from_str::<RpcRequest>(&input) {
                        Ok(request) => {
                            let handler = Arc::clone(&self.handler);
                            let response = {
                                let mut handler_lock = handler.lock().await;
                                handler_lock.handle_request(request).await
                            };

                            if let Some(response) = response {
                                self.send_response(&response).await?;
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse RPC request: {}", e);
                            let error_response = RpcResponse::parse_error(e.to_string());
                            self.send_response(&error_response).await?;
                        }
                    }
                }
                Ok(None) => {
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
    
    /// Sends a response to stdout.
    async fn send_response(&self, response: &RpcResponse) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Ok(json_response) = serde_json::to_string(response) {
            println!("{}", json_response);
            if let Err(e) = std::io::stdout().flush() {
                error!("Failed to flush stdout: {}", e);
            }
        }
        Ok(())
    }
}

/// Trait for handling RPC requests.
///
/// Implement this trait to define custom RPC handlers.
#[async_trait::async_trait]
pub trait RpcHandler: Send + Sync {
    /// Handles an RPC request.
    ///
    /// # Arguments
    ///
    /// * `request` - The incoming RPC request
    ///
    /// # Returns
    ///
    /// An optional response. Returns `None` for notifications.
    async fn handle_request(&mut self, request: RpcRequest) -> Option<RpcResponse>;
}

/// Default RPC handler implementation.
///
/// `DefaultRpcHandler` provides basic methods for testing:
/// - `ping`: Returns "pong"
/// - `echo`: Returns the params
/// - `health`: Returns health status
pub struct DefaultRpcHandler;

#[async_trait::async_trait]
impl RpcHandler for DefaultRpcHandler {
    async fn handle_request(&mut self, request: RpcRequest) -> Option<RpcResponse> {
        info!("Handling RPC request: {} with id {:?}", request.method, request.id);

        match request.method.as_str() {
            "ping" => {
                Some(RpcResponse::success(request.id, serde_json::json!("pong")))
            }
            "echo" => {
                Some(RpcResponse::success(request.id, request.params.unwrap_or(serde_json::Value::Null)))
            }
            "health" => {
                Some(RpcResponse::success(
                    request.id,
                    serde_json::json!({
                        "status": "healthy",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }),
                ))
            }
            _ => {
                Some(RpcResponse::method_not_found(request.id, &request.method))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test RPC request creation
    #[tokio::test]
    async fn test_rpc_request() {
        let request = RpcRequest::new("test_method", Some(serde_json::json!({"key": "value"})));
        
        assert_eq!(request.jsonrpc, "2.0");
        assert_eq!(request.method, "test_method");
        assert!(!request.is_notification());
        
        let notification = RpcRequest::notification("notify", None);
        assert!(notification.is_notification());
    }

    /// Test RPC response creation
    #[tokio::test]
    async fn test_rpc_response() {
        let success = RpcResponse::success(Some(serde_json::json!(1)), serde_json::json!("result"));
        assert!(!success.is_error());
        
        let error = RpcResponse::error(Some(serde_json::json!(2)), -32600, "Invalid");
        assert!(error.is_error());
        
        let parse_err = RpcResponse::parse_error("Bad JSON");
        assert!(parse_err.is_error());
    }

    /// Test default handler
    #[tokio::test]
    async fn test_default_handler() {
        let mut handler = DefaultRpcHandler {};
        
        let ping_request = RpcRequest::new("ping", None);
        let response = handler.handle_request(ping_request).await.unwrap();
        assert_eq!(response.result, Some(serde_json::json!("pong")));
        
        let echo_request = RpcRequest::new("echo", Some(serde_json::json!("hello")));
        let response = handler.handle_request(echo_request).await.unwrap();
        assert_eq!(response.result, Some(serde_json::json!("hello")));
        
        let unknown_request = RpcRequest::new("unknown", None);
        let response = handler.handle_request(unknown_request).await.unwrap();
        assert!(response.is_error());
    }

    /// Test IO bridge config
    #[test]
    fn test_io_bridge_config() {
        let default = IoBridgeConfig::default();
        assert_eq!(default.buffer_size, 8192);
        assert_eq!(default.max_message_size, 1024 * 1024);
        
        let custom = IoBridgeConfig::default()
            .with_buffer_size(16384)
            .with_max_message_size(2 * 1024 * 1024);
        
        assert_eq!(custom.buffer_size, 16384);
        assert_eq!(custom.max_message_size, 2 * 1024 * 1024);
    }
}
