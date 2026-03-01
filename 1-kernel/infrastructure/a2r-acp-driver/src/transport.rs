//! ACP Transport Abstraction
//!
//! Provides transport layer for ACP communication.
//! Default implementation uses stdio (NDJSON over stdin/stdout).
//!
//! Uses official ACP schema types from agent-client-protocol-schema crate.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{mpsc, oneshot, Mutex as TokioMutex};
use tracing::{debug, trace};

/// Transport layer for ACP communication
/// 
/// Object-safe trait using JSON Value for dyn compatibility.
/// Uses builder-style API since upstream types are #[non_exhaustive].
#[async_trait]
pub trait AcpTransport: Send + Sync {
    /// Send a raw JSON-RPC request and await response
    async fn request_raw(&mut self, method: &str, params: Value) -> Result<Value>;

    /// Send a raw JSON-RPC notification (no response expected)
    async fn notify_raw(&mut self, method: &str, params: Value) -> Result<()>;

    /// Receive notifications (streaming)
    fn notifications(&mut self) -> &mut mpsc::UnboundedReceiver<Value>;

    /// Check if transport is healthy
    fn is_healthy(&self) -> bool;

    /// Close the transport
    async fn close(&mut self) -> Result<()>;
}

/// Extension trait for typed requests (not object-safe, but usable with generics)
#[async_trait]
pub trait AcpTransportExt: AcpTransport {
    /// Send a typed request and receive typed response
    async fn request<T: Serialize + Send, R: DeserializeOwned + Send>(
        &mut self,
        method: &str,
        params: T,
    ) -> Result<R> {
        let params_value = serde_json::to_value(params)?;
        let result_value = self.request_raw(method, params_value).await?;
        let result: R = serde_json::from_value(result_value)?;
        Ok(result)
    }

    /// Send a typed notification
    async fn notify<T: Serialize + Send>(&mut self, method: &str, params: T) -> Result<()> {
        let params_value = serde_json::to_value(params)?;
        self.notify_raw(method, params_value).await
    }
}

// Blanket impl for all AcpTransport types
#[async_trait]
impl<T: AcpTransport + ?Sized> AcpTransportExt for T {}

/// Transcript capture for debugging
#[derive(Debug, Clone)]
pub struct TranscriptEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub direction: Direction,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Direction {
    Out,
    In,
}

/// Stdio transport implementation for ACP
pub struct StdioTransport {
    stdin: ChildStdin,
    notification_rx: mpsc::UnboundedReceiver<Value>,
    request_id: Arc<AtomicU64>,
    pending_responses: Arc<TokioMutex<HashMap<u64, oneshot::Sender<String>>>>,
    transcript: Option<std::sync::Mutex<Vec<TranscriptEntry>>>,
    _child: Child, // Keep child alive
}

impl StdioTransport {
    /// Create a new stdio transport from a command
    pub async fn new(mut command: Command) -> Result<Self> {
        let mut child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn ACP process: {}", e))?;

        let stdin = child.stdin.take().ok_or_else(|| anyhow!("No stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("No stdout"))?;

        let (notification_tx, notification_rx) = mpsc::unbounded_channel();
        let pending_responses = Arc::new(TokioMutex::new(
            HashMap::<u64, oneshot::Sender<String>>::new()
        ));

        // Spawn stdout reader
        let pending_clone = pending_responses.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                trace!("ACP recv: {}", line);
                
                // Try to parse as JSON
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    // Check if it's a response with an ID (has "result" or "error")
                    if value.get("result").is_some() || value.get("error").is_some() {
                        if let Some(id) = value.get("id").and_then(|id| id.as_u64()) {
                            let mut pending = pending_clone.lock().await;
                            if let Some(tx) = pending.remove(&id) {
                                let _ = tx.send(line);
                                continue;
                            }
                        }
                    }
                    
                    // Otherwise treat as notification (has "method" but no "id")
                    if value.get("method").is_some() && value.get("id").is_none() {
                        let _ = notification_tx.send(value);
                    }
                }
            }
        });

        Ok(Self {
            stdin,
            notification_rx,
            request_id: Arc::new(AtomicU64::new(1)),
            pending_responses,
            transcript: Some(std::sync::Mutex::new(Vec::new())),
            _child: child,
        })
    }

    /// Enable/disable transcript capture
    pub fn with_transcript(mut self, enabled: bool) -> Self {
        self.transcript = if enabled { Some(std::sync::Mutex::new(Vec::new())) } else { None };
        self
    }

    /// Get captured transcript
    pub fn transcript(&self) -> Option<Vec<TranscriptEntry>> {
        self.transcript.as_ref().map(|t| t.lock().unwrap().clone())
    }

    fn log_transcript(&self, direction: Direction, message: &str) {
        if let Some(ref transcript) = self.transcript {
            if let Ok(mut entries) = transcript.lock() {
                entries.push(TranscriptEntry {
                    timestamp: chrono::Utc::now(),
                    direction,
                    message: message.to_string(),
                });
            }
        }
    }
}

#[async_trait]
impl AcpTransport for StdioTransport {
    async fn request_raw(&mut self, method: &str, params: Value) -> Result<Value> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let request_json = serde_json::to_string(&request)?;
        debug!("ACP request: {}", request_json);
        self.log_transcript(Direction::Out, &request_json);

        // Send request
        self.stdin.write_all(request_json.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;

        // Wait for response
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending_responses.lock().await;
            pending.insert(id, tx);
        }

        let response_line = rx.await.map_err(|_| anyhow!("Response channel closed"))?;
        self.log_transcript(Direction::In, &response_line);

        let response: Value = serde_json::from_str(&response_line)
            .map_err(|e| anyhow!("Failed to parse response: {} (line: {})", e, response_line))?;

        // Check for JSON-RPC error
        if let Some(error) = response.get("error") {
            let code = error.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
            let message = error.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown error");
            return Err(anyhow!("ACP error {}: {}", code, message));
        }

        // Extract result
        let result = response.get("result")
            .ok_or_else(|| anyhow!("Empty result"))?
            .clone();
            
        Ok(result)
    }

    async fn notify_raw(&mut self, method: &str, params: Value) -> Result<()> {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let json = serde_json::to_string(&notification)?;
        debug!("ACP notify: {}", json);
        self.log_transcript(Direction::Out, &json);

        self.stdin.write_all(json.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;

        Ok(())
    }

    fn notifications(&mut self) -> &mut mpsc::UnboundedReceiver<Value> {
        &mut self.notification_rx
    }

    fn is_healthy(&self) -> bool {
        // TODO: Check if child process is still running
        true
    }

    async fn close(&mut self) -> Result<()> {
        // Close stdin to signal EOF
        // The child will be dropped when self is dropped
        Ok(())
    }
}

/// Boxed transport for dyn compatibility
pub type BoxedTransport = Box<dyn AcpTransport>;
