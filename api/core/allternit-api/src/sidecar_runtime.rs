use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use async_trait::async_trait;

use crate::{
    pty::{PtyHealth, PtySessionInfo, SessionAccessMode},
    sidecar_protocol::TerminalSnapshotState,
    terminal_runtime::TerminalRuntime,
    terminal_sidecar_client::TerminalSidecarClient,
};

#[derive(Clone)]
pub struct SidecarTerminalRuntime {
    client: Arc<TerminalSidecarClient>,
}

impl SidecarTerminalRuntime {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            client: Arc::new(TerminalSidecarClient::from_env()?),
        })
    }
}

#[async_trait]
impl TerminalRuntime for SidecarTerminalRuntime {
    fn ensure_backend_available(&self) -> Result<()> {
        self.client.ensure_configured()
    }

    async fn create_session(
        &self,
        session_id: String,
        owner_id: String,
        shell: Option<String>,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
        workdir: Option<String>,
    ) -> Result<PtySessionInfo> {
        self.client
            .create_session(session_id, owner_id, shell, cols, rows, env, workdir)
            .await
    }

    async fn write(&self, session_id: &str, data: &[u8]) -> Result<()> {
        self.client.write(session_id, data).await
    }

    async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        self.client.resize(session_id, cols, rows).await
    }

    async fn keepalive(&self, session_id: &str) -> Result<()> {
        self.client.keepalive(session_id).await
    }

    async fn mark_connected(
        &self,
        session_id: &str,
        client_id: &str,
        mode: SessionAccessMode,
    ) -> Result<PtySessionInfo> {
        self.client
            .mark_connected(session_id, client_id, mode)
            .await
    }

    async fn mark_disconnected(
        &self,
        session_id: &str,
        client_id: Option<&str>,
    ) -> Result<PtySessionInfo> {
        self.client.mark_disconnected(session_id, client_id).await
    }

    async fn close_session(&self, session_id: &str) -> Result<()> {
        self.client.close_session(session_id).await
    }

    async fn list_sessions(&self) -> Vec<PtySessionInfo> {
        self.client.list_sessions().await.unwrap_or_default()
    }

    async fn get_session(&self, session_id: &str) -> Option<PtySessionInfo> {
        self.client.get_session(session_id).await.ok().flatten()
    }

    async fn can_reconnect(&self, session_id: &str) -> bool {
        self.client.can_reconnect(session_id).await.unwrap_or(false)
    }

    async fn verify_owner(&self, session_id: &str, owner_id: &str) -> Result<PtySessionInfo> {
        self.client.verify_owner(session_id, owner_id).await
    }

    async fn can_write(&self, session_id: &str, client_id: &str) -> bool {
        self.client
            .can_write(session_id, client_id)
            .await
            .unwrap_or(false)
    }

    async fn timeout_warning(&self, session_id: &str) -> Result<Option<i64>> {
        self.client.timeout_warning(session_id).await
    }

    async fn cleanup_expired_sessions(&self) -> Result<Vec<String>> {
        self.client.cleanup_expired_sessions().await
    }

    async fn health(&self) -> PtyHealth {
        self.client
            .health()
            .await
            .unwrap_or_else(|error| PtyHealth {
                tmux_available: false,
                tmux_path: format!("sidecar:{}", self.client.base_url()),
                backend_error: Some(error.to_string()),
                session_count: 0,
                running_sessions: 0,
                stale_sessions: 0,
                state_dir: String::new(),
                audit_log_path: String::new(),
            })
    }

    async fn subscribe(
        &self,
        session_id: &str,
    ) -> Result<(
        PtySessionInfo,
        Option<TerminalSnapshotState>,
        String,
        std::path::PathBuf,
    )> {
        self.client.subscribe_with_snapshot(session_id).await
    }

    async fn update_snapshot(
        &self,
        session_id: &str,
        snapshot: &str,
        cols: u16,
        rows: u16,
    ) -> Result<()> {
        self.client
            .update_snapshot(session_id, snapshot, cols, rows)
            .await
    }

    async fn record_audit_event(
        &self,
        session_id: &str,
        event: &str,
        details: serde_json::Value,
        client_id: Option<&str>,
    ) -> Result<()> {
        self.client
            .record_audit_event(session_id, event, details, client_id)
            .await
    }
}
