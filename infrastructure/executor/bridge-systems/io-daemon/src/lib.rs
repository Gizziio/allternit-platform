//! # Allternit IO Daemon
//!
//! IO bridge daemon for stdio communication.
//!
//! ## Overview
//!
//! This crate provides a daemon service that manages the IO bridge
//! for stdio-based communication. It handles NDJSON-RPC messaging
//! between processes and provides HTTP endpoints for bridge control.
//!
//! ## Architecture
//!
//! - **main.rs**: HTTP API server and IO bridge manager
//! - NDJSON-RPC over stdin/stdout for process communication
//!
//! ## Endpoints
//!
//! - `GET /health` - Health check
//! - `GET /io-ready` - Check IO subsystem status
//! - `POST /start` - Start the daemon
//! - `POST /stop` - Stop the daemon
//! - `POST /set-io-ready` - Mark IO as ready
//! - `POST /io-bridge/send` - Send message through IO bridge
//!
//! ## Example
//!
//! ```rust,no_run
//! use allternit_io_daemon::{DaemonStatus, DaemonHealth};
//!
//! // Check daemon health
//! // GET /health returns DaemonHealth
//! ```

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Daemon status variants.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DaemonStatus {
    /// Starting up
    Starting,
    /// Running but not ready
    Running,
    /// Ready to accept requests
    Ready,
    /// Shutting down
    Stopping,
    /// Stopped
    Stopped,
}

/// Daemon health information.
#[derive(Debug, Clone, Serialize)]
pub struct DaemonHealth {
    /// Current daemon status
    pub status: DaemonStatus,
    
    /// Whether daemon is running
    pub is_running: bool,
    
    /// Whether IO subsystem is ready
    pub is_io_ready: bool,
    
    /// Uptime in seconds
    pub uptime_seconds: u64,
    
    /// Current timestamp
    pub timestamp: u64,
}

/// IO ready status response.
#[derive(Debug, Clone, Serialize)]
pub struct IoReadyResponse {
    /// Whether IO is ready
    pub ready: bool,
    
    /// Status message
    pub message: String,
    
    /// Current timestamp
    pub timestamp: u64,
}

/// IO Bridge request format (JSON-RPC 2.0).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IoBridgeRequest {
    /// JSON-RPC version
    pub jsonrpc: String,
    
    /// Request ID
    pub id: Option<String>,
    
    /// Method to call
    pub method: String,
    
    /// Method parameters
    pub params: Option<serde_json::Value>,
}

impl IoBridgeRequest {
    /// Creates a new JSON-RPC request.
    pub fn new(method: impl Into<String>, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(uuid::Uuid::new_v4().to_string()),
            method: method.into(),
            params,
        }
    }
}

/// IO Bridge response format (JSON-RPC 2.0).
#[derive(Debug, Clone, Serialize)]
pub struct IoBridgeResponse {
    /// JSON-RPC version
    pub jsonrpc: String,
    
    /// Request ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    
    /// Result data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    
    /// Error information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<IoBridgeError>,
}

/// JSON-RPC error object.
#[derive(Debug, Clone, Serialize)]
pub struct IoBridgeError {
    /// Error code
    pub code: i32,
    
    /// Error message
    pub message: String,
}

impl IoBridgeError {
    /// Creates a parse error.
    pub fn parse_error(msg: impl Into<String>) -> Self {
        Self {
            code: -32700,
            message: msg.into(),
        }
    }
    
    /// Creates an invalid request error.
    pub fn invalid_request(msg: impl Into<String>) -> Self {
        Self {
            code: -32600,
            message: msg.into(),
        }
    }
    
    /// Creates a method not found error.
    pub fn method_not_found(method: &str) -> Self {
        Self {
            code: -32601,
            message: format!("Method '{}' not found", method),
        }
    }
}

/// Internal IO bridge message types.
#[derive(Debug, Clone)]
pub enum IOBridgeMessage {
    /// Request message
    Request {
        id: String,
        method: String,
        params: serde_json::Value,
    },
    
    /// Response message
    Response {
        id: String,
        result: Option<serde_json::Value>,
        error: Option<String>,
    },
    
    /// Notification message
    Notification {
        method: String,
        params: serde_json::Value,
    },
}

/// Default port for IO daemon.
pub const DEFAULT_PORT: u16 = 3011;

/// Default host for IO daemon.
pub const DEFAULT_HOST: &str = "127.0.0.1";

/// Gets current Unix timestamp.
pub fn now_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_io_bridge_request() {
        let req = IoBridgeRequest::new("test_method", Some(serde_json::json!({"key": "value"})));
        
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.method, "test_method");
        assert!(req.id.is_some());
    }

    #[test]
    fn test_io_bridge_error() {
        let parse_err = IoBridgeError::parse_error("Invalid JSON");
        assert_eq!(parse_err.code, -32700);
        
        let method_err = IoBridgeError::method_not_found("unknown");
        assert_eq!(method_err.code, -32601);
        assert!(method_err.message.contains("unknown"));
    }

    #[test]
    fn test_now_timestamp() {
        let ts1 = now_timestamp();
        let ts2 = now_timestamp();
        
        // Timestamps should be non-decreasing
        assert!(ts2 >= ts1);
        // Should be a reasonable Unix timestamp (after 2020)
        assert!(ts1 > 1577836800);
    }
}
