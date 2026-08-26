//! Orchestrator backend: spawn, send, watch, and kill executors via mux.
//!
//! This module talks to `allternit-mux` over its UDS NDJSON API. There is no
//! fallback to direct tmux; if mux is unreachable the operation fails closed.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::time::{sleep, timeout};

use crate::core::ids::create_event_id;
use crate::core::io::{ensure_dir, read_json, write_json_atomic};
use crate::core::types::{Actor, ActorType, AllternitEvent};
use crate::ledger::Ledger;
use crate::peer::{Peer, PeerAddress, PeerKind, PeerRegistry};

use super::review;
use super::session::{ExecutorSession, ExecutorState};
use super::spec::ExecutorSpec;

/// Persistent registry of executor sessions keyed by slug.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PersistentSessions {
    sessions: HashMap<String, ExecutorSession>,
}

#[derive(Clone)]
pub struct OrchestratorOptions {
    pub root_dir: PathBuf,
    pub ledger: Arc<Ledger>,
    pub peer_registry: Arc<PeerRegistry>,
    pub actor_id: Option<String>,
    pub mux_socket: Option<PathBuf>,
}

/// Native Rails orchestrator backed by `allternit-mux`.
pub struct Orchestrator {
    root_dir: PathBuf,
    ledger: Arc<Ledger>,
    peer_registry: Arc<PeerRegistry>,
    actor: Actor,
    mux_socket: PathBuf,
    sessions_dir: PathBuf,
}

impl Orchestrator {
    pub fn new(opts: OrchestratorOptions) -> Self {
        let mux_socket = opts.mux_socket.unwrap_or_else(allternit_mux::socket_path);
        let sessions_dir = opts.root_dir.join(".allternit").join("orchestrator");
        let actor = Actor {
            r#type: ActorType::Gate,
            id: opts.actor_id.unwrap_or_else(|| "orchestrator".to_string()),
        };
        Self {
            root_dir: opts.root_dir,
            ledger: opts.ledger,
            peer_registry: opts.peer_registry,
            actor,
            mux_socket,
            sessions_dir,
        }
    }

    fn sessions_path(&self) -> PathBuf {
        self.sessions_dir.join("sessions.json")
    }

    async fn load_sessions(&self) -> Result<PersistentSessions> {
        Ok(read_json(&self.sessions_path())?.unwrap_or_default())
    }

    async fn save_sessions(&self, sessions: &PersistentSessions) -> Result<()> {
        ensure_dir(&self.sessions_dir)?;
        write_json_atomic(&self.sessions_path(), sessions)?;
        Ok(())
    }

    async fn log_event(&self, event_type: &str, payload: Value) -> Result<String> {
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

    async fn mux_client(&self) -> Result<allternit_mux::client::Client> {
        if !self.mux_socket.exists() {
            bail!(
                "mux socket not found at {} (is allternit-mux running?)",
                self.mux_socket.display()
            );
        }
        allternit_mux::client::Client::connect(&self.mux_socket)
            .await
            .with_context(|| format!("connect to mux at {}", self.mux_socket.display()))
    }

    /// Spawn a new executor session on mux, register it as a Rails peer, and
    /// create a WIH link.
    pub async fn spawn(&self, spec: ExecutorSpec) -> Result<ExecutorSession> {
        let mut client = self.mux_client().await?;

        // Ensure the executor workdir exists so mux can launch there.
        tokio::fs::create_dir_all(&spec.workdir)
            .await
            .with_context(|| format!("create workdir {}", spec.workdir.display()))?;

        let workdir_str = spec.workdir.to_string_lossy().to_string();
        let session_resp = client
            .request(
                "session.create",
                json!({
                    "label": spec.slug,
                    "cwd": workdir_str,
                }),
            )
            .await
            .context("create mux session")?;
        let session_id = session_resp["session"]["session_id"]
            .as_str()
            .context("missing session_id in mux response")?
            .to_string();

        if spec.command.is_empty() {
            bail!("executor command is empty");
        }

        let mut env = HashMap::new();
        env.insert("ALLTERNIT_EXECUTOR_SLUG".to_string(), spec.slug.clone());
        env.insert("ALLTERNIT_EXECUTOR_MODE".to_string(), spec.mode.clone());
        if let Some(task_file) = &spec.task_file {
            env.insert(
                "ALLTERNIT_EXECUTOR_TASK_FILE".to_string(),
                task_file.to_string_lossy().to_string(),
            );
        }
        env.insert(
            "ALLTERNIT_EXECUTOR_NOTES_SENTINEL".to_string(),
            spec.resolved_notes_sentinel().to_string_lossy().to_string(),
        );

        let pane_resp = client
            .request(
                "pane.create",
                json!({
                    "session_id": session_id,
                    "command": spec.command,
                    "cwd": workdir_str,
                    "cols": 80,
                    "rows": 24,
                    "env": env,
                }),
            )
            .await
            .context("create mux pane")?;
        let pane_id = pane_resp["pane"]["pane_id"]
            .as_str()
            .context("missing pane_id in mux response")?
            .to_string();

        let peer_id = format!("executor:{}", spec.slug);
        let wih_id = format!("wih:executor-{}", spec.slug);
        let spawned_at = Utc::now().to_rfc3339();

        // Register the executor as a Rails peer so it can receive Mail / Bus
        // messages while it runs.
        self.peer_registry
            .register(Peer {
                peer_id: peer_id.clone(),
                session_id: session_id.clone(),
                display_name: spec.slug.clone(),
                address: PeerAddress::Mail {
                    agent_id: peer_id.clone(),
                },
                cwd: workdir_str.clone(),
                vendor: spec.vendor.clone(),
                kind: PeerKind::Executor,
            })
            .await
            .context("register executor peer")?;

        // Create a lightweight WIH link so the executor shows up in work views.
        self.create_wih_link(&wih_id, &spec.slug, &peer_id, &spawned_at)
            .await?;

        let session = ExecutorSession {
            spec,
            state: ExecutorState::Running,
            mux_session_id: session_id,
            mux_pane_id: pane_id,
            peer_id,
            wih_id,
            spawned_at,
            last_state_at: Some(Utc::now().to_rfc3339()),
        };

        self.log_event(
            "ExecutorSpawned",
            json!({
                "slug": session.spec.slug,
                "peer_id": session.peer_id,
                "wih_id": session.wih_id,
                "mux_session_id": session.mux_session_id,
                "mux_pane_id": session.mux_pane_id,
                "workdir": workdir_str,
                "vendor": session.spec.vendor,
                "mode": session.spec.mode,
            }),
        )
        .await?;

        let mut persistent = self.load_sessions().await?;
        persistent.sessions.insert(session.spec.slug.clone(), session.clone());
        self.save_sessions(&persistent).await?;

        Ok(session)
    }

    async fn create_wih_link(
        &self,
        wih_id: &str,
        slug: &str,
        agent_id: &str,
        created_at: &str,
    ) -> Result<()> {
        self.log_event(
            "WIHCreated",
            json!({
                "wih_id": wih_id,
                "dag_id": slug,
                "node_id": slug,
                "execution_mode": "executor",
                "context_pack_path": null,
                "policy": { "requires_lease_for_write": false }
            }),
        )
        .await?;
        self.log_event(
            "WIHPickedUp",
            json!({
                "wih_id": wih_id,
                "agent_id": agent_id,
                "role": "executor",
                "picked_up_at": created_at,
            }),
        )
        .await?;
        Ok(())
    }

    /// Send a prompt / input to the executor pane.
    pub async fn send(&self, slug: &str, data: &str) -> Result<()> {
        let session = self.get_session(slug).await?;
        let mut client = self.mux_client().await?;
        client
            .request(
                "pane.send_verified",
                json!({
                    "pane_id": session.mux_pane_id,
                    "data": data,
                    "timeout_ms": 10_000,
                }),
            )
            .await
            .context("send input to mux pane")?;

        self.log_event(
            "ExecutorPrompted",
            json!({
                "slug": slug,
                "peer_id": session.peer_id,
                "wih_id": session.wih_id,
                "payload_preview": preview(data, 200),
            }),
        )
        .await?;
        Ok(())
    }

    /// Return the current executor session, refreshing state from mux.
    pub async fn status(&self, slug: &str) -> Result<ExecutorSession> {
        let mut session = self.get_session(slug).await?;
        let mut client = self.mux_client().await?;
        let pane = self.fetch_pane_info(&mut client, &session.mux_pane_id).await?;
        session.state = self.infer_state(&session, &pane).await;
        session.last_state_at = Some(Utc::now().to_rfc3339());
        self.update_session(&session).await?;
        Ok(session)
    }

    /// Read the most recent scrollback from the executor pane.
    pub async fn tail(&self, slug: &str, lines: Option<usize>) -> Result<String> {
        let session = self.get_session(slug).await?;
        let mut client = self.mux_client().await?;
        let params = if let Some(lines) = lines {
            json!({ "pane_id": session.mux_pane_id, "lines": lines, "source": "scrollback" })
        } else {
            json!({ "pane_id": session.mux_pane_id, "source": "scrollback" })
        };
        let resp = client
            .request("pane.read", params)
            .await
            .context("read mux pane output")?;
        Ok(resp["output"]
            .as_str()
            .context("missing output in mux pane.read response")?
            .to_string())
    }

    /// Poll the executor until it is done/dead/killed or the timeout elapses.
    /// Returns `(session, timed_out)`.
    pub async fn watch(
        &self,
        slug: &str,
        timeout_duration: Duration,
    ) -> Result<(ExecutorSession, bool)> {
        let session = self.get_session(slug).await?;
        if matches!(session.state, ExecutorState::Done | ExecutorState::Dead | ExecutorState::Killed) {
            return Ok((session, false));
        }

        let result = timeout(timeout_duration, async {
            loop {
                let mut client = self.mux_client().await?;
                let pane = self.fetch_pane_info(&mut client, &session.mux_pane_id).await?;
                let mut current = self.get_session(slug).await?;
                let new_state = self.infer_state(&current, &pane).await;
                if new_state != current.state {
                    current.state = new_state.clone();
                    current.last_state_at = Some(Utc::now().to_rfc3339());
                    self.emit_terminal_event(&current, &new_state).await?;
                    self.update_session(&current).await?;
                }
                if matches!(
                    new_state,
                    ExecutorState::Done | ExecutorState::Dead | ExecutorState::Killed
                ) {
                    return anyhow::Result::<ExecutorSession>::Ok(current);
                }
                sleep(Duration::from_secs(1)).await;
            }
        })
        .await;

        match result {
            Ok(Ok(session)) => Ok((session, false)),
            Ok(Err(e)) => Err(e),
            Err(_) => {
                let current = self.status(slug).await?;
                Ok((current, true))
            }
        }
    }

    /// Close the executor pane and mark the session killed.
    pub async fn kill(&self, slug: &str) -> Result<ExecutorSession> {
        let session = self.get_session(slug).await?;
        let mut client = self.mux_client().await?;
        client
            .request("pane.close", json!({ "pane_id": session.mux_pane_id }))
            .await
            .context("close mux pane")?;

        let mut current = session;
        current.state = ExecutorState::Killed;
        current.last_state_at = Some(Utc::now().to_rfc3339());
        self.log_event(
            "ExecutorKilled",
            json!({
                "slug": slug,
                "peer_id": current.peer_id,
                "wih_id": current.wih_id,
                "mux_pane_id": current.mux_pane_id,
            }),
        )
        .await?;
        self.update_session(&current).await?;
        Ok(current)
    }

    /// Request a review for the executor's output.
    pub async fn review_request(&self, slug: &str, notes_ref: Option<&str>) -> Result<()> {
        let session = self.get_session(slug).await?;
        review::log_review_pending(&self.ledger, &self.actor, slug, notes_ref).await?;
        self.log_event(
            "ExecutorReviewRequested",
            json!({
                "slug": slug,
                "peer_id": session.peer_id,
                "wih_id": session.wih_id,
            }),
        )
        .await?;
        Ok(())
    }

    /// Accept or reject an executor's output.
    pub async fn review_decide(
        &self,
        slug: &str,
        accepted: bool,
        notes_ref: Option<&str>,
    ) -> Result<()> {
        if accepted {
            review::log_review_accepted(&self.ledger, &self.actor, slug, notes_ref).await?;
        } else {
            review::log_review_rejected(&self.ledger, &self.actor, slug, notes_ref).await?;
        }
        Ok(())
    }

    /// Health-check the orchestrator environment.
    pub async fn doctor(&self) -> Result<DoctorReport> {
        let mut report = DoctorReport::default();

        report.mux_socket_path = self.mux_socket.display().to_string();
        if self.mux_socket.exists() {
            report.mux_socket_present = true;
            match self.mux_client().await {
                Ok(mut client) => match client.request("ping", json!({})).await {
                    Ok(_) => report.mux_ping_ok = true,
                    Err(e) => report.mux_error = Some(e.to_string()),
                },
                Err(e) => report.mux_error = Some(e.to_string()),
            }
        } else {
            report.mux_error = Some(format!("mux socket not found at {}", self.mux_socket.display()));
        }

        let ledger_dir = self.root_dir.join(".allternit").join("ledger");
        report.ledger_dir_present = ledger_dir.exists();

        let peer_registry_path = self.root_dir.join(".allternit").join("peer").join("registry.json");
        report.peer_registry_present = peer_registry_path.exists();

        let sessions = self.load_sessions().await.unwrap_or_default();
        report.tracked_sessions = sessions.sessions.len();

        Ok(report)
    }

    async fn get_session(&self, slug: &str) -> Result<ExecutorSession> {
        let persistent = self.load_sessions().await?;
        persistent
            .sessions
            .get(slug)
            .cloned()
            .with_context(|| format!("executor session '{}' not found", slug))
    }

    async fn update_session(&self, session: &ExecutorSession) -> Result<()> {
        let mut persistent = self.load_sessions().await?;
        persistent
            .sessions
            .insert(session.spec.slug.clone(), session.clone());
        self.save_sessions(&persistent).await?;
        Ok(())
    }

    async fn fetch_pane_info(
        &self,
        client: &mut allternit_mux::client::Client,
        pane_id: &str,
    ) -> Result<MuxPaneInfo> {
        let resp = client
            .request("pane.get", json!({ "pane_id": pane_id }))
            .await
            .context("get mux pane info")?;
        Ok(MuxPaneInfo {
            process_running: resp["pane"]["process_running"].as_bool().unwrap_or(false),
            exit_code: resp["pane"]["exit_code"].as_i64().map(|c| c as i32),
        })
    }

    async fn infer_state(&self, session: &ExecutorSession, pane: &MuxPaneInfo) -> ExecutorState {
        let sentinel = session.spec.resolved_notes_sentinel();
        if sentinel.exists() {
            return ExecutorState::Done;
        }
        if pane.process_running {
            return ExecutorState::Running;
        }
        if pane.exit_code.is_some() {
            return ExecutorState::Dead;
        }
        // Pane still starting up; stay in spawning/running.
        ExecutorState::Running
    }

    async fn emit_terminal_event(
        &self,
        session: &ExecutorSession,
        state: &ExecutorState,
    ) -> Result<()> {
        let event_type = match state {
            ExecutorState::Done => "ExecutorDone",
            ExecutorState::Dead => "ExecutorDead",
            ExecutorState::Killed => "ExecutorKilled",
            _ => return Ok(()),
        };
        self.log_event(
            event_type,
            json!({
                "slug": session.spec.slug,
                "peer_id": session.peer_id,
                "wih_id": session.wih_id,
                "mux_pane_id": session.mux_pane_id,
                "state": state,
            }),
        )
        .await?;
        Ok(())
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DoctorReport {
    pub mux_socket_present: bool,
    pub mux_ping_ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mux_error: Option<String>,
    pub mux_socket_path: String,
    pub ledger_dir_present: bool,
    pub peer_registry_present: bool,
    pub tracked_sessions: usize,
}

#[derive(Debug, Clone)]
struct MuxPaneInfo {
    process_running: bool,
    exit_code: Option<i32>,
}

fn preview(s: &str, limit: usize) -> String {
    if s.len() <= limit {
        s.to_string()
    } else {
        format!("{}…", &s[..limit])
    }
}
