use std::{collections::HashMap, path::PathBuf};

use anyhow::{anyhow, bail, Context, Result};

use crate::{
    pty::{PtyHealth, PtySessionInfo, SessionAccessMode},
    sidecar_protocol::{
        SidecarBoolResponse, SidecarCreateSessionRequest, SidecarHealthResponse,
        SidecarMarkConnectedRequest, SidecarMarkDisconnectedRequest, SidecarOptionalI64Response,
        SidecarRecordAuditEventRequest, SidecarResizeRequest, SidecarSubscribeResponse,
        SidecarUpdateSnapshotRequest, SidecarWriteRequest, TerminalSnapshotState,
    },
};

#[derive(Clone)]
pub struct TerminalSidecarClient {
    http: reqwest::Client,
    base_url: String,
}

impl TerminalSidecarClient {
    pub fn from_env() -> Result<Self> {
        let base_url = std::env::var("ALLTERNIT_TERMINAL_SIDECAR_URL")
            .ok()
            .or_else(|| {
                std::env::var("ALLTERNIT_TERMINAL_URL")
                    .ok()
                    .map(|value| format!("{}/terminal-sidecar", normalize_base_url(&value)))
            })
            .unwrap_or_else(|| "http://127.0.0.1:4096/terminal-sidecar".to_string());
        Self::new(base_url)
    }

    pub fn new(base_url: impl Into<String>) -> Result<Self> {
        let base_url = normalize_base_url(&base_url.into());
        if base_url.is_empty() {
            bail!("terminal sidecar base URL is empty");
        }
        Ok(Self {
            http: reqwest::Client::new(),
            base_url,
        })
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn ensure_configured(&self) -> Result<()> {
        if self.base_url.is_empty() {
            bail!("terminal sidecar base URL is empty");
        }
        Ok(())
    }

    pub async fn create_session(
        &self,
        session_id: String,
        owner_id: String,
        shell: Option<String>,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
        workdir: Option<String>,
    ) -> Result<PtySessionInfo> {
        self.post_json(
            "/sessions",
            &SidecarCreateSessionRequest {
                session_id,
                owner_id,
                shell,
                cols,
                rows,
                env,
                workdir,
            },
        )
        .await
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<()> {
        self.post_no_content(
            "/sessions/input",
            &SidecarWriteRequest {
                session_id: session_id.to_string(),
                data: data.to_vec(),
            },
        )
        .await
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        self.post_no_content(
            "/sessions/resize",
            &SidecarResizeRequest {
                session_id: session_id.to_string(),
                cols,
                rows,
            },
        )
        .await
    }

    pub async fn keepalive(&self, session_id: &str) -> Result<()> {
        self.post_no_content(
            "/sessions/keepalive",
            &serde_json::json!({ "session_id": session_id }),
        )
        .await
    }

    pub async fn mark_connected(
        &self,
        session_id: &str,
        client_id: &str,
        mode: SessionAccessMode,
    ) -> Result<PtySessionInfo> {
        self.post_json(
            "/sessions/connect",
            &SidecarMarkConnectedRequest {
                session_id: session_id.to_string(),
                client_id: client_id.to_string(),
                mode: mode.into(),
            },
        )
        .await
    }

    pub async fn mark_disconnected(
        &self,
        session_id: &str,
        client_id: Option<&str>,
    ) -> Result<PtySessionInfo> {
        self.post_json(
            "/sessions/disconnect",
            &SidecarMarkDisconnectedRequest {
                session_id: session_id.to_string(),
                client_id: client_id.map(ToOwned::to_owned),
            },
        )
        .await
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        self.delete_no_content(&format!("/sessions/{session_id}"))
            .await
    }

    pub async fn list_sessions(&self) -> Result<Vec<PtySessionInfo>> {
        self.get_json("/sessions").await
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<PtySessionInfo>> {
        let url = self.endpoint(&format!("/sessions/{session_id}"));
        let response = self
            .http
            .get(url)
            .send()
            .await
            .context("send sidecar get-session request")?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        Ok(Some(extract_json(response).await?))
    }

    pub async fn can_reconnect(&self, session_id: &str) -> Result<bool> {
        let response: SidecarBoolResponse = self
            .get_json(&format!("/sessions/{session_id}/can-reconnect"))
            .await?;
        Ok(response.value)
    }

    pub async fn verify_owner(&self, session_id: &str, owner_id: &str) -> Result<PtySessionInfo> {
        self.post_json(
            "/sessions/verify-owner",
            &serde_json::json!({ "session_id": session_id, "owner_id": owner_id }),
        )
        .await
    }

    pub async fn can_write(&self, session_id: &str, client_id: &str) -> Result<bool> {
        let response: SidecarBoolResponse = self
            .post_json(
                "/sessions/can-write",
                &serde_json::json!({ "session_id": session_id, "client_id": client_id }),
            )
            .await?;
        Ok(response.value)
    }

    pub async fn timeout_warning(&self, session_id: &str) -> Result<Option<i64>> {
        let response: SidecarOptionalI64Response = self
            .get_json(&format!("/sessions/{session_id}/timeout-warning"))
            .await?;
        Ok(response.value)
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<Vec<String>> {
        self.post_json("/sessions/cleanup-expired", &serde_json::json!({}))
            .await
    }

    pub async fn health(&self) -> Result<PtyHealth> {
        let response: SidecarHealthResponse = self.get_json("/health").await?;
        Ok(response.health)
    }

    pub async fn subscribe_with_snapshot(
        &self,
        session_id: &str,
    ) -> Result<(PtySessionInfo, Option<TerminalSnapshotState>, String, PathBuf)> {
        let response: SidecarSubscribeResponse = self
            .get_json(&format!("/sessions/{session_id}/subscribe"))
            .await?;
        Ok((
            response.info,
            response.snapshot,
            response.backlog,
            PathBuf::from(response.log_path),
        ))
    }

    pub async fn update_snapshot(
        &self,
        session_id: &str,
        snapshot: &str,
        cols: u16,
        rows: u16,
    ) -> Result<()> {
        self.post_no_content(
            "/sessions/snapshot",
            &SidecarUpdateSnapshotRequest {
                session_id: session_id.to_string(),
                snapshot: snapshot.to_string(),
                cols,
                rows,
            },
        )
        .await
    }

    pub async fn record_audit_event(
        &self,
        session_id: &str,
        event: &str,
        details: serde_json::Value,
        client_id: Option<&str>,
    ) -> Result<()> {
        self.post_no_content(
            "/sessions/audit",
            &SidecarRecordAuditEventRequest {
                session_id: session_id.to_string(),
                event: event.to_string(),
                details,
                client_id: client_id.map(ToOwned::to_owned),
            },
        )
        .await
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let response = self
            .http
            .get(self.endpoint(path))
            .send()
            .await
            .with_context(|| format!("send sidecar GET {path}"))?;
        extract_json(response).await
    }

    async fn post_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &impl serde::Serialize,
    ) -> Result<T> {
        let response = self
            .http
            .post(self.endpoint(path))
            .json(body)
            .send()
            .await
            .with_context(|| format!("send sidecar POST {path}"))?;
        extract_json(response).await
    }

    async fn post_no_content(&self, path: &str, body: &impl serde::Serialize) -> Result<()> {
        let response = self
            .http
            .post(self.endpoint(path))
            .json(body)
            .send()
            .await
            .with_context(|| format!("send sidecar POST {path}"))?;
        extract_empty(response).await
    }

    async fn delete_no_content(&self, path: &str) -> Result<()> {
        let response = self
            .http
            .delete(self.endpoint(path))
            .send()
            .await
            .with_context(|| format!("send sidecar DELETE {path}"))?;
        extract_empty(response).await
    }

    fn endpoint(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

fn normalize_base_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

async fn extract_json<T: serde::de::DeserializeOwned>(response: reqwest::Response) -> Result<T> {
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        bail!("sidecar request failed with {status}: {body}");
    }
    response
        .json::<T>()
        .await
        .map_err(|error| anyhow!("decode sidecar response: {error}"))
}

async fn extract_empty(response: reqwest::Response) -> Result<()> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let body = response.text().await.unwrap_or_default();
    bail!("sidecar request failed with {status}: {body}");
}
