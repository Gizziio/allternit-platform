use tokio::net::UnixStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{info, error};

use crate::{InferenceRequest, InferenceResponse};

pub struct IPCClient {
    socket_path: String,
}

impl IPCClient {
    pub fn new(socket_path: &str) -> Self {
        IPCClient {
            socket_path: socket_path.to_string(),
        }
    }

    pub async fn infer(&self, request: &InferenceRequest) -> Result<InferenceResponse, Box<dyn std::error::Error>> {
        info!("Sending inference request via IPC to: {}", self.socket_path);
        
        // Connect to the Unix Domain Socket
        let mut stream = UnixStream::connect(&self.socket_path).await?;
        
        // Prepare the request payload
        let payload = serde_json::json!({
            "endpoint": match &request.model[..] {
                m if m.starts_with("liquid") => "/liquid/process",
                m if m.starts_with("image") || m.starts_with("gen-image") => "/image/generate",
                _ => "/liquid/process" // default to liquid
            },
            "data": {
                "prompt": &request.prompt,
                "max_tokens": request.max_tokens.unwrap_or(256),
                "temperature": request.temperature.unwrap_or(0.7)
            }
        });
        
        let request_str = serde_json::to_string(&payload)?;
        
        // Send the request
        stream.write_all(request_str.as_bytes()).await?;
        
        // Read the response
        let mut response_buffer = [0; 4096];
        let n = stream.read(&mut response_buffer).await?;
        let response_str = String::from_utf8_lossy(&response_buffer[..n]);
        
        // Parse the response
        let response: InferenceResponse = serde_json::from_str(&response_str)?;
        
        info!("Received inference response via IPC");
        Ok(response)
    }
}