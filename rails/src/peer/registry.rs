//! Peer registry: discovery from mux sessions and explicit registration.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::core::ids::create_event_id;
use crate::core::io::{ensure_dir, read_json, write_json_atomic};
use crate::core::types::{AllternitEvent, Actor, ActorType};
use crate::ledger::Ledger;
use crate::peer::types::{Peer, PeerAddress, PeerKind};

#[derive(Clone)]
pub struct PeerRegistryOptions {
    pub root_dir: Option<PathBuf>,
    pub mux_root: Option<PathBuf>,
    pub ledger: Arc<Ledger>,
    pub actor_id: Option<String>,
}

pub struct PeerRegistry {
    root_dir: PathBuf,
    mux_root: PathBuf,
    ledger: Arc<Ledger>,
    actor: Actor,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PersistentPeers {
    peers: HashMap<String, Peer>,
}

impl PeerRegistry {
    pub fn new(opts: PeerRegistryOptions) -> Self {
        let root_dir = opts
            .root_dir
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
        let mux_root = opts.mux_root.unwrap_or_else(|| {
            std::env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| root_dir.clone())
                .join(".allternit")
                .join("mux")
        });
        let actor = Actor {
            r#type: ActorType::Gate,
            id: opts.actor_id.unwrap_or_else(|| "peer-registry".to_string()),
        };
        Self {
            root_dir,
            mux_root,
            ledger: opts.ledger,
            actor,
        }
    }

    fn registry_path(&self) -> PathBuf {
        self.root_dir.join(".allternit").join("peer").join("registry.json")
    }

    fn peers_dir(&self) -> PathBuf {
        self.root_dir.join(".allternit").join("peer")
    }

    async fn load_persistent(&self) -> Result<PersistentPeers> {
        let path = self.registry_path();
        Ok(read_json(&path)?.unwrap_or_default())
    }

    async fn save_persistent(&self, peers: &PersistentPeers) -> Result<()> {
        ensure_dir(&self.peers_dir())?;
        write_json_atomic(&self.registry_path(), peers)?;
        Ok(())
    }

    async fn log_event(&self, event_type: &str, payload: serde_json::Value) -> Result<String> {
        let event = AllternitEvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: self.actor.clone(),
            scope: None,
            r#type: event_type.to_string(),
            payload,
            provenance: None,
        };
        self.ledger.append(event).await
    }

    /// Register or update a peer explicitly.
    pub async fn register(&self, peer: Peer) -> Result<()> {
        let mut persistent = self.load_persistent().await?;
        persistent.peers.insert(peer.peer_id.clone(), peer.clone());
        self.save_persistent(&persistent).await?;
        self.log_event(
            "PeerRegistered",
            json!({
                "peer_id": peer.peer_id,
                "session_id": peer.session_id,
                "display_name": peer.display_name,
                "address": peer.address,
                "cwd": peer.cwd,
                "vendor": peer.vendor,
                "kind": peer.kind,
            }),
        )
        .await?;
        Ok(())
    }

    /// Remove a peer.
    pub async fn expire(&self, peer_id: &str) -> Result<()> {
        let mut persistent = self.load_persistent().await?;
        if persistent.peers.remove(peer_id).is_some() {
            self.save_persistent(&persistent).await?;
            self.log_event(
                "PeerExpired",
                json!({ "peer_id": peer_id }),
            )
            .await?;
        }
        Ok(())
    }

    /// Return all known peers, including explicitly registered ones and any
    /// discovered from mux that are not already in the persistent registry.
    pub async fn list(&self) -> Result<Vec<Peer>> {
        let persistent = self.load_persistent().await?;
        let discovered = self.discover_mux_peers().await.unwrap_or_default();
        let mut combined = persistent.peers;
        for peer in discovered {
            combined.entry(peer.peer_id.clone()).or_insert(peer);
        }
        Ok(combined.into_values().collect())
    }

    /// Get a single peer by id.
    pub async fn get(&self, peer_id: &str) -> Result<Option<Peer>> {
        let persistent = self.load_persistent().await?;
        if let Some(peer) = persistent.peers.get(peer_id).cloned() {
            return Ok(Some(peer));
        }
        let discovered = self.discover_mux_peers().await.unwrap_or_default();
        Ok(discovered.into_iter().find(|p| p.peer_id == peer_id))
    }

    /// Discover peers from the mux session directory.
    async fn discover_mux_peers(&self) -> Result<Vec<Peer>> {
        let mut peers = Vec::new();
        if !self.mux_root.exists() {
            return Ok(peers);
        }
        let mut entries = tokio::fs::read_dir(&self.mux_root).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let meta_path = path.join("meta.json");
            if !meta_path.exists() {
                continue;
            }
            match self.parse_mux_meta(&meta_path).await {
                Ok(Some(peer)) => peers.push(peer),
                Ok(None) => {}
                Err(e) => {
                    tracing::debug!("failed to parse mux meta {:?}: {}", meta_path, e);
                }
            }
        }
        Ok(peers)
    }

    async fn parse_mux_meta(&self, meta_path: &Path) -> Result<Option<Peer>> {
        let raw = tokio::fs::read_to_string(meta_path).await?;
        if raw.trim().is_empty() {
            return Ok(None);
        }
        let meta: MuxMeta = serde_json::from_str(&raw)
            .with_context(|| format!("parsing {:?}", meta_path))?;

        let session_id = meta.session_id;
        let peer_id = format!("mux-{}", session_id);
        let display_name = meta.label.unwrap_or_else(|| peer_id.clone());
        let cwd = meta.cwd.unwrap_or_default();

        // Determine vendor/kind heuristically from the label or shell command.
        let (vendor, kind) = infer_vendor_kind(&display_name, meta.panes.first());

        let socket_path = self.peers_dir().join("inbox").join(format!("{}.sock", peer_id));
        let peer = Peer {
            peer_id,
            session_id,
            display_name,
            address: PeerAddress::Uds { socket_path },
            cwd,
            vendor,
            kind,
        };
        Ok(Some(peer))
    }
}

#[derive(Debug, Clone, Deserialize)]
struct MuxMeta {
    session_id: String,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    panes: Vec<MuxPane>,
}

#[derive(Debug, Clone, Deserialize)]
struct MuxPane {
    #[serde(default)]
    command: Option<String>,
}

fn infer_vendor_kind(display_name: &str, pane: Option<&MuxPane>) -> (String, PeerKind) {
    let lower = display_name.to_lowercase();
    if lower.contains("claude") {
        return ("anthropic".to_string(), PeerKind::Claude);
    }
    if lower.contains("codex") || lower.contains("openai") {
        return ("openai".to_string(), PeerKind::Codex);
    }
    if lower.contains("kimi") {
        return ("moonshot".to_string(), PeerKind::Kimi);
    }
    if lower.contains("gizzi") {
        return ("allternit".to_string(), PeerKind::Gizzi);
    }
    if let Some(pane) = pane {
        if let Some(cmd) = &pane.command {
            let cmd_lower = cmd.to_lowercase();
            if cmd_lower.contains("claude") {
                return ("anthropic".to_string(), PeerKind::Claude);
            }
            if cmd_lower.contains("codex") {
                return ("openai".to_string(), PeerKind::Codex);
            }
            if cmd_lower.contains("gizzi") {
                return ("allternit".to_string(), PeerKind::Gizzi);
            }
            if cmd_lower.contains("kimi") {
                return ("moonshot".to_string(), PeerKind::Kimi);
            }
        }
    }
    ("unknown".to_string(), PeerKind::Mux)
}
