use std::{collections::HashMap, path::PathBuf};

use anyhow::Result;
use async_trait::async_trait;

use crate::{
    pty::{PtyHealth, PtyManager, PtySessionInfo, SessionAccessMode},
    sidecar_protocol::TerminalSnapshotState,
};

#[async_trait]
pub trait TerminalRuntime: Send + Sync {
    fn ensure_backend_available(&self) -> Result<()>;

    async fn create_session(
        &self,
        session_id: String,
        owner_id: String,
        shell: Option<String>,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
        workdir: Option<String>,
    ) -> Result<PtySessionInfo>;

    async fn write(&self, session_id: &str, data: &[u8]) -> Result<()>;
    async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()>;
    async fn keepalive(&self, session_id: &str) -> Result<()>;
    async fn mark_connected(
        &self,
        session_id: &str,
        client_id: &str,
        mode: SessionAccessMode,
    ) -> Result<PtySessionInfo>;
    async fn mark_disconnected(
        &self,
        session_id: &str,
        client_id: Option<&str>,
    ) -> Result<PtySessionInfo>;
    async fn close_session(&self, session_id: &str) -> Result<()>;
    async fn list_sessions(&self) -> Vec<PtySessionInfo>;
    async fn get_session(&self, session_id: &str) -> Option<PtySessionInfo>;
    async fn can_reconnect(&self, session_id: &str) -> bool;
    async fn verify_owner(&self, session_id: &str, owner_id: &str) -> Result<PtySessionInfo>;
    async fn can_write(&self, session_id: &str, client_id: &str) -> bool;
    async fn timeout_warning(&self, session_id: &str) -> Result<Option<i64>>;
    async fn cleanup_expired_sessions(&self) -> Result<Vec<String>>;
    async fn health(&self) -> PtyHealth;
    async fn subscribe(
        &self,
        session_id: &str,
    ) -> Result<(PtySessionInfo, Option<TerminalSnapshotState>, String, PathBuf)>;
    async fn update_snapshot(
        &self,
        session_id: &str,
        snapshot: &str,
        cols: u16,
        rows: u16,
    ) -> Result<()>;
    async fn record_audit_event(
        &self,
        session_id: &str,
        event: &str,
        details: serde_json::Value,
        client_id: Option<&str>,
    ) -> Result<()>;
}

#[derive(Clone)]
pub struct TmuxTerminalRuntime {
    manager: PtyManager,
}

impl TmuxTerminalRuntime {
    pub fn new(manager: PtyManager) -> Self {
        Self { manager }
    }
}

#[async_trait]
impl TerminalRuntime for TmuxTerminalRuntime {
    fn ensure_backend_available(&self) -> Result<()> {
        self.manager.ensure_backend_available()
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
        self.manager
            .create_session(session_id, owner_id, shell, cols, rows, env, workdir)
            .await
    }

    async fn write(&self, session_id: &str, data: &[u8]) -> Result<()> {
        self.manager.write(session_id, data).await
    }

    async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        self.manager.resize(session_id, cols, rows).await
    }

    async fn keepalive(&self, session_id: &str) -> Result<()> {
        self.manager.keepalive(session_id).await
    }

    async fn mark_connected(
        &self,
        session_id: &str,
        client_id: &str,
        mode: SessionAccessMode,
    ) -> Result<PtySessionInfo> {
        self.manager
            .mark_connected(session_id, client_id, mode)
            .await
    }

    async fn mark_disconnected(
        &self,
        session_id: &str,
        client_id: Option<&str>,
    ) -> Result<PtySessionInfo> {
        self.manager.mark_disconnected(session_id, client_id).await
    }

    async fn close_session(&self, session_id: &str) -> Result<()> {
        self.manager.close_session(session_id).await
    }

    async fn list_sessions(&self) -> Vec<PtySessionInfo> {
        self.manager.list_sessions().await
    }

    async fn get_session(&self, session_id: &str) -> Option<PtySessionInfo> {
        self.manager.get_session(session_id).await
    }

    async fn can_reconnect(&self, session_id: &str) -> bool {
        self.manager.can_reconnect(session_id).await
    }

    async fn verify_owner(&self, session_id: &str, owner_id: &str) -> Result<PtySessionInfo> {
        self.manager.verify_owner(session_id, owner_id).await
    }

    async fn can_write(&self, session_id: &str, client_id: &str) -> bool {
        self.manager.can_write(session_id, client_id).await
    }

    async fn timeout_warning(&self, session_id: &str) -> Result<Option<i64>> {
        self.manager.timeout_warning(session_id).await
    }

    async fn cleanup_expired_sessions(&self) -> Result<Vec<String>> {
        self.manager.cleanup_expired_sessions().await
    }

    async fn health(&self) -> PtyHealth {
        self.manager.health().await
    }

    async fn subscribe(
        &self,
        session_id: &str,
    ) -> Result<(PtySessionInfo, Option<TerminalSnapshotState>, String, PathBuf)> {
        self.manager
            .subscribe(session_id)
            .await
            .map(|(info, backlog, log_path)| (info, None, backlog, log_path))
    }

    async fn update_snapshot(
        &self,
        _session_id: &str,
        _snapshot: &str,
        _cols: u16,
        _rows: u16,
    ) -> Result<()> {
        Ok(())
    }

    async fn record_audit_event(
        &self,
        session_id: &str,
        event: &str,
        details: serde_json::Value,
        client_id: Option<&str>,
    ) -> Result<()> {
        self.manager
            .record_audit_event(session_id, event, details, client_id)
            .await
    }
}
