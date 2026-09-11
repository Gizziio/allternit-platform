//! CommRails visibility DTO (BA-1 leftover: ao-engine HTTP).
//!
//! Best-effort: try `ao visibility --root` (P5 JSON). On timeout/missing binary,
//! fall back to the local peer registry. Never fail the GET.

use super::{VisibilityDto, VisibilityNeed, VisibilityPane};
use allternit_commrails::peer::PeerRegistry;
use serde_json::Value;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

const AO_VISIBILITY_TIMEOUT: Duration = Duration::from_millis(800);

fn map_ao_status(raw: &str) -> &'static str {
    match raw.to_ascii_lowercase().as_str() {
        "working" => "working",
        "blocked" => "blocked",
        _ => "idle",
    }
}

fn label_from(obj: &serde_json::Map<String, Value>, fallback: &str) -> String {
    obj.get("title")
        .or_else(|| obj.get("name"))
        .or_else(|| obj.get("agent"))
        .or_else(|| obj.get("label"))
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

/// Map `ao visibility` JSON (camelCase PanelSnapshot) onto the rail DTO.
pub fn visibility_from_ao_json(raw: &Value, peers: &PeerRegistry) -> VisibilityDto {
    let mut panes: Vec<VisibilityPane> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    if let Some(agents) = raw
        .get("engine")
        .and_then(|e| e.get("agents"))
        .and_then(Value::as_array)
    {
        for agent in agents {
            let Some(obj) = agent.as_object() else { continue };
            let id = obj
                .get("paneId")
                .or_else(|| obj.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if id.is_empty() || !seen.insert(id.clone()) {
                continue;
            }
            let status = obj
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("idle");
            panes.push(VisibilityPane {
                id: id.clone(),
                label: label_from(obj, &id),
                state: map_ao_status(status).to_string(),
            });
        }
    }

    let needs_you = raw
        .get("waitingOnYou")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let obj = row.as_object()?;
                    let id = obj
                        .get("paneId")
                        .or_else(|| obj.get("id"))
                        .and_then(Value::as_str)
                        .filter(|s| !s.is_empty())?
                        .to_string();
                    Some(VisibilityNeed {
                        id: id.clone(),
                        label: label_from(obj, &id),
                        reason: "blocked".to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    for peer in peers.list() {
        if seen.contains(&peer.peer_id) || seen.contains(&peer.name) {
            continue;
        }
        seen.insert(peer.peer_id.clone());
        panes.push(VisibilityPane {
            id: peer.peer_id.clone(),
            label: peer.name.clone(),
            state: match peer.status {
                allternit_commrails::peer::PeerStatus::Active => "working".to_string(),
                _ => "idle".to_string(),
            },
        });
    }

    VisibilityDto {
        panes,
        machines: Vec::new(),
        fabric_devices: Vec::new(),
        needs_you,
    }
}

pub fn visibility_from_peers(peers: &PeerRegistry) -> VisibilityDto {
    let panes = peers
        .list()
        .into_iter()
        .map(|peer| VisibilityPane {
            id: peer.peer_id.clone(),
            label: peer.name.clone(),
            state: match peer.status {
                allternit_commrails::peer::PeerStatus::Active => "working".to_string(),
                _ => "idle".to_string(),
            },
        })
        .collect();
    VisibilityDto {
        panes,
        machines: Vec::new(),
        fabric_devices: Vec::new(),
        needs_you: Vec::new(),
    }
}

async fn run_ao_visibility(root: &Path) -> Option<Value> {
    let bin = std::env::var("AO_BIN").unwrap_or_else(|_| "ao".to_string());
    let mut child = Command::new(&bin)
        .args(["visibility", "--root", &root.to_string_lossy()])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;
    match tokio::time::timeout(AO_VISIBILITY_TIMEOUT, child.wait_with_output()).await {
        Ok(Ok(output)) if output.status.success() => serde_json::from_slice(&output.stdout).ok(),
        _ => None,
    }
}

pub async fn load_visibility(root: &Path, peers: &PeerRegistry) -> VisibilityDto {
    if let Some(json) = run_ao_visibility(root).await {
        return visibility_from_ao_json(&json, peers);
    }
    visibility_from_peers(peers)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn maps_engine_blocked_to_needs_you_and_blocked_pane() {
        let dir = std::env::temp_dir().join(format!("ao-vis-empty-{}", std::process::id()));
        let peers = PeerRegistry::new(&dir).expect("peers");
        let dto = visibility_from_ao_json(
            &json!({
                "engine": {
                    "agents": [
                        {
                            "paneId": "pane-1",
                            "title": "codex",
                            "status": "blocked"
                        },
                        {
                            "paneId": "pane-2",
                            "name": "kimi",
                            "status": "working"
                        }
                    ]
                },
                "waitingOnYou": [
                    { "paneId": "pane-1", "title": "codex" }
                ]
            }),
            &peers,
        );
        assert_eq!(dto.panes.len(), 2);
        assert_eq!(dto.panes[0].id, "pane-1");
        assert_eq!(dto.panes[0].state, "blocked");
        assert_eq!(dto.panes[1].state, "working");
        assert_eq!(dto.needs_you.len(), 1);
        assert_eq!(dto.needs_you[0].id, "pane-1");
        assert_eq!(dto.needs_you[0].reason, "blocked");
    }

    #[test]
    fn maps_done_and_unknown_to_idle() {
        let dir = std::env::temp_dir().join(format!("ao-vis-idle-{}", std::process::id()));
        let peers = PeerRegistry::new(&dir).expect("peers");
        let dto = visibility_from_ao_json(
            &json!({
                "engine": {
                    "agents": [
                        { "paneId": "a", "status": "done" },
                        { "paneId": "b", "status": "unknown" }
                    ]
                }
            }),
            &peers,
        );
        assert!(dto.panes.iter().all(|p| p.state == "idle"));
        assert!(dto.needs_you.is_empty());
    }
}
