//! Minimal NDJSON client for the allternit-mux Unix socket API.
//!
//! Workspace panes are backed by real mux PTYs (phase 4 of the terminal
//! consolidation plan) instead of the old simulated output buffer.

use serde_json::{json, Value};
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::unix::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::UnixStream;
use uuid::Uuid;

fn socket_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_MUX_SOCKET") {
        return PathBuf::from(p);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".allternit").join("mux").join("mux.sock")
}

pub struct MuxClient {
    write: OwnedWriteHalf,
    read: BufReader<OwnedReadHalf>,
}

impl MuxClient {
    pub async fn connect() -> Result<Self, String> {
        let path = socket_path();
        let stream = UnixStream::connect(&path)
            .await
            .map_err(|e| format!("allternit-mux not reachable at {}: {e}", path.display()))?;
        let (read, write) = stream.into_split();
        Ok(Self {
            write,
            read: BufReader::new(read),
        })
    }

    pub async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = Uuid::new_v4().to_string();
        let frame = json!({ "id": id, "method": method, "params": params });
        let mut line = serde_json::to_string(&frame).map_err(|e| e.to_string())?;
        line.push('\n');
        self.write
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("mux write: {e}"))?;
        self.write.flush().await.map_err(|e| format!("mux flush: {e}"))?;

        loop {
            let mut buf = String::new();
            let n = self
                .read
                .read_line(&mut buf)
                .await
                .map_err(|e| format!("mux read: {e}"))?;
            if n == 0 {
                return Err("mux closed the connection".into());
            }
            let resp: Value = serde_json::from_str(buf.trim()).map_err(|e| e.to_string())?;
            if resp.get("id").and_then(|v| v.as_str()) != Some(&id) {
                continue;
            }
            if let Some(err) = resp.get("error") {
                let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("unknown");
                return Err(msg.to_string());
            }
            return Ok(resp.get("result").cloned().unwrap_or(Value::Null));
        }
    }
}

/// One-shot mux call on a fresh connection.
pub async fn mux_call(method: &str, params: Value) -> Result<Value, String> {
    let mut client = MuxClient::connect().await?;
    client.request(method, params).await
}
