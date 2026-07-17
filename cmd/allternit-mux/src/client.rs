//! Socket client used by the CLI.

use crate::protocol::{Event, Request, Response};
use anyhow::{Context, Result};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::unix::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::UnixStream;
use uuid::Uuid;

pub struct Client {
    write: OwnedWriteHalf,
    read: BufReader<OwnedReadHalf>,
}

impl Client {
    pub async fn connect(socket_path: &std::path::Path) -> Result<Self> {
        let stream = UnixStream::connect(socket_path)
            .await
            .with_context(|| format!("connect to mux socket {}", socket_path.display()))?;
        let (read, write) = stream.into_split();
        Ok(Self {
            write,
            read: BufReader::new(read),
        })
    }

    /// Send one request, await its response.
    pub async fn request(&mut self, method: &str, params: Value) -> Result<Value> {
        let req = Request {
            id: Uuid::new_v4().to_string(),
            method: method.to_string(),
            params,
        };
        let mut line = serde_json::to_string(&req)?;
        line.push('\n');
        self.write.write_all(line.as_bytes()).await?;
        self.write.flush().await?;

        let mut buf = String::new();
        self.read.read_line(&mut buf).await?;
        let resp: Response =
            serde_json::from_str(buf.trim()).context("invalid response from mux daemon")?;
        if let Some(err) = resp.error {
            anyhow::bail!("{}: {}", err.code, err.message);
        }
        Ok(resp.result.unwrap_or(Value::Null))
    }

    /// Subscribe to events; yields them on `next_event`.
    pub async fn subscribe(&mut self, types: &[&str]) -> Result<()> {
        self.request("events.subscribe", serde_json::json!({ "types": types }))
            .await?;
        Ok(())
    }

    /// Next pushed event (only valid after `subscribe`).
    pub async fn next_event(&mut self) -> Result<Event> {
        let mut buf = String::new();
        self.read.read_line(&mut buf).await?;
        if buf.is_empty() {
            anyhow::bail!("mux daemon closed the event stream");
        }
        let ev: Event = serde_json::from_str(buf.trim()).context("invalid event frame")?;
        Ok(ev)
    }
}
