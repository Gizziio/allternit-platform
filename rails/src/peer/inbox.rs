//! Per-session UDS inbox server for peer-to-peer messages.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use serde_json::json;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::{UnixListener, UnixStream};

use crate::core::ids::create_event_id;
use crate::core::io::ensure_dir;
use crate::core::types::{AllternitEvent, Actor, ActorType};
use crate::ledger::Ledger;
use crate::peer::types::PeerMessage;

#[derive(Clone)]
pub struct PeerInboxOptions {
    pub socket_path: PathBuf,
    pub ledger: Arc<Ledger>,
    pub actor_id: Option<String>,
}

pub struct PeerInboxServer {
    socket_path: PathBuf,
    ledger: Arc<Ledger>,
    actor: Actor,
}

impl PeerInboxServer {
    pub fn new(opts: PeerInboxOptions) -> Self {
        let actor = Actor {
            r#type: ActorType::Agent,
            id: opts.actor_id.unwrap_or_else(|| "peer-inbox".to_string()),
        };
        Self {
            socket_path: opts.socket_path,
            ledger: opts.ledger,
            actor,
        }
    }

    /// Bind the UDS socket, removing any stale socket at the path first.
    pub async fn bind(&self) -> Result<UnixListener> {
        if let Some(parent) = self.socket_path.parent() {
            ensure_dir(parent)?;
        }
        if self.socket_path.exists() {
            let _ = tokio::fs::remove_file(&self.socket_path).await;
        }
        UnixListener::bind(&self.socket_path)
            .with_context(|| format!("binding peer inbox at {:?}", self.socket_path))
    }

    /// Run the inbox server in a loop.  This future does not return unless
    /// accepting a connection fails fatally.
    pub async fn serve(&self, listener: UnixListener) -> Result<()> {
        loop {
            let (stream, _addr) = listener.accept().await?;
            let ledger = self.ledger.clone();
            let actor = self.actor.clone();
            tokio::spawn(async move {
                if let Err(e) = handle_connection(stream, ledger, actor).await {
                    tracing::debug!("peer inbox connection error: {}", e);
                }
            });
        }
    }

    /// Convenience: bind + serve.
    pub async fn run(&self) -> Result<()> {
        let listener = self.bind().await?;
        self.serve(listener).await
    }

    pub fn socket_path(&self) -> &PathBuf {
        &self.socket_path
    }
}

async fn handle_connection(
    stream: UnixStream,
    ledger: Arc<Ledger>,
    actor: Actor,
) -> Result<()> {
    let peer_addr = stream.peer_addr().ok().and_then(|a| a.as_pathname().map(|p| p.to_path_buf()));
    let (read_half, _write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);
    let mut line = String::new();

    loop {
        line.clear();
        let n = reader.read_line(&mut line).await?;
        if n == 0 {
            break;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let msg: PeerMessage = match serde_json::from_str(trimmed) {
            Ok(m) => m,
            Err(e) => {
                tracing::debug!("peer inbox dropped invalid line: {}", e);
                continue;
            }
        };

        let event = AllternitEvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: actor.clone(),
            scope: None,
            r#type: "PeerMessageReceived".to_string(),
            payload: json!({
                "from_peer": msg.from_peer,
                "to_peer": msg.to_peer,
                "correlation_id": msg.correlation_id,
                "kind": msg.kind,
                "payload": msg.payload,
                "peer_addr": peer_addr.as_ref().map(|p| p.display().to_string()),
            }),
            provenance: None,
        };
        ledger.append(event).await?;
    }
    Ok(())
}
