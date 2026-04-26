//! tmux-backed terminal session management for the API server.

use anyhow::{anyhow, bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
};
use tokio::{process::Command, sync::RwLock};

const RECONNECTION_WINDOW_SECONDS: i64 = 300;
const BACKLOG_BYTES: usize = 256 * 1024;
const SESSION_PREFIX: &str = "allternit-pty-";
const IDLE_TIMEOUT_SECONDS: i64 = 30 * 60;
const WARNING_WINDOW_SECONDS: i64 = 5 * 60;

#[derive(Debug, Clone, Copy)]
pub struct PtyConfig {
    pub reconnection_window_seconds: i64,
    pub idle_timeout_seconds: i64,
    pub warning_window_seconds: i64,
}

impl Default for PtyConfig {
    fn default() -> Self {
        Self {
            reconnection_window_seconds: RECONNECTION_WINDOW_SECONDS,
            idle_timeout_seconds: IDLE_TIMEOUT_SECONDS,
            warning_window_seconds: WARNING_WINDOW_SECONDS,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionAccessMode {
    ReadOnly,
    ReadWrite,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PtySessionStatus {
    Running,
    Exited,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionConnectionState {
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySessionInfo {
    pub session_id: String,
    pub tmux_session: String,
    pub owner_id: String,
    pub writer_client_id: Option<String>,
    pub connected_clients: usize,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub workdir: Option<String>,
    pub status: PtySessionStatus,
    pub connection_state: SessionConnectionState,
    pub exit_code: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub disconnected_at: Option<DateTime<Utc>>,
    pub log_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct PtyManager {
    sessions: Arc<RwLock<HashMap<String, PtySessionInfo>>>,
    state_dir: PathBuf,
    default_shell: String,
    tmux_bin: PathBuf,
    config: PtyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyHealth {
    pub tmux_available: bool,
    pub tmux_path: String,
    pub backend_error: Option<String>,
    pub session_count: usize,
    pub running_sessions: usize,
    pub stale_sessions: usize,
    pub state_dir: String,
    pub audit_log_path: String,
}

impl PtyManager {
    pub fn new(state_dir: PathBuf) -> Self {
        Self::new_with_config_and_tmux_bin(state_dir, PtyConfig::default(), None)
    }

    pub fn new_with_config(state_dir: PathBuf, config: PtyConfig) -> Self {
        Self::new_with_config_and_tmux_bin(state_dir, config, None)
    }

    pub fn new_with_config_and_tmux_bin(
        state_dir: PathBuf,
        config: PtyConfig,
        tmux_bin_override: Option<PathBuf>,
    ) -> Self {
        let tmux_bin = tmux_bin_override.unwrap_or_else(|| {
            PathBuf::from(
                std::env::var("TMUX_BIN")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "/opt/homebrew/bin/tmux".to_string()),
            )
        });
        fs::create_dir_all(&state_dir).ok();

        let manager = Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            state_dir,
            default_shell: detect_shell(),
            tmux_bin,
            config,
        };
        manager.load_persisted_sessions();
        manager
    }

    pub fn ensure_backend_available(&self) -> Result<()> {
        ensure_tmux_available(&self.tmux_bin)
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
        if cols == 0 || rows == 0 {
            bail!("cols and rows must be greater than zero");
        }

        if let Some(existing) = self.get_session(&session_id).await {
            if self.can_reconnect(&session_id).await {
                return Ok(existing);
            }
            bail!("terminal session '{}' already exists", session_id);
        }

        ensure_tmux_available(&self.tmux_bin)?;

        let shell = shell.unwrap_or_else(|| self.default_shell.clone());
        let tmux_session = format!("{}{}", SESSION_PREFIX, session_id);
        let log_path = self.state_dir.join(format!("{}.log", session_id));
        let cwd = resolve_workdir(workdir.clone());
        let startup_cmd = build_startup_command(&shell, &env);
        let now = Utc::now();

        fs::write(&log_path, [])
            .with_context(|| format!("create log file {}", log_path.display()))?;

        let output = Command::new(&self.tmux_bin)
            .arg("new-session")
            .arg("-d")
            .arg("-s")
            .arg(&tmux_session)
            .arg("-x")
            .arg(cols.to_string())
            .arg("-y")
            .arg(rows.to_string())
            .arg("-c")
            .arg(&cwd)
            .arg(&startup_cmd)
            .output()
            .await
            .context("spawn tmux session")?;
        if !output.status.success() {
            bail!(
                "failed to create tmux session: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        let pipe_cmd = format!(
            "cat >> {}",
            quote_for_shell(log_path.to_string_lossy().as_ref())
        );
        let output = Command::new(&self.tmux_bin)
            .arg("pipe-pane")
            .arg("-o")
            .arg("-t")
            .arg(&tmux_session)
            .arg(&pipe_cmd)
            .output()
            .await
            .context("attach tmux pipe-pane")?;
        if !output.status.success() {
            let _ = self.kill_tmux_session(&tmux_session).await;
            bail!(
                "failed to attach tmux pipe-pane: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        let info = PtySessionInfo {
            session_id: session_id.clone(),
            tmux_session,
            owner_id,
            writer_client_id: None,
            connected_clients: 0,
            shell,
            cols,
            rows,
            workdir: Some(cwd.clone()),
            status: PtySessionStatus::Running,
            connection_state: SessionConnectionState::Disconnected,
            exit_code: None,
            created_at: now,
            updated_at: now,
            last_activity: now,
            disconnected_at: Some(now),
            log_path,
        };

        self.persist_session(&info)?;
        self.sessions.write().await.insert(session_id, info.clone());
        let _ = self.audit("session_created", &info, None, None, None);
        Ok(info)
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<()> {
        let info = self.require_running_session(session_id).await?.clone();
        self.update_activity(session_id).await?;
        let _ = self.audit(
            "input",
            &info,
            None,
            Some(serde_json::json!({ "bytes": data.len() })),
            None,
        );

        for chunk in split_terminal_input(data) {
            let output = if chunk == "\n" {
                Command::new(&self.tmux_bin)
                    .arg("send-keys")
                    .arg("-t")
                    .arg(&info.tmux_session)
                    .arg("Enter")
                    .output()
                    .await
                    .context("send tmux enter")?
            } else {
                Command::new(&self.tmux_bin)
                    .arg("send-keys")
                    .arg("-l")
                    .arg("-t")
                    .arg(&info.tmux_session)
                    .arg(&chunk)
                    .output()
                    .await
                    .context("send tmux keys")?
            };
            if !output.status.success() {
                bail!(
                    "failed to send tmux keys: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
            }
        }

        Ok(())
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        if cols == 0 || rows == 0 {
            bail!("cols and rows must be greater than zero");
        }

        let mut info = self.require_running_session(session_id).await?.clone();
        let output = Command::new(&self.tmux_bin)
            .arg("resize-window")
            .arg("-t")
            .arg(&info.tmux_session)
            .arg("-x")
            .arg(cols.to_string())
            .arg("-y")
            .arg(rows.to_string())
            .output()
            .await
            .context("resize tmux window")?;
        if !output.status.success() {
            bail!(
                "failed to resize tmux window: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        info.cols = cols;
        info.rows = rows;
        info.updated_at = Utc::now();
        info.last_activity = info.updated_at;
        let _ = self.audit(
            "resize",
            &info,
            None,
            Some(serde_json::json!({ "cols": cols, "rows": rows })),
            None,
        );
        self.store_session(info).await
    }

    pub async fn keepalive(&self, session_id: &str) -> Result<()> {
        self.update_activity(session_id).await
    }

    pub async fn mark_connected(
        &self,
        session_id: &str,
        client_id: &str,
        mode: SessionAccessMode,
    ) -> Result<PtySessionInfo> {
        let mut info = self.require_running_session(session_id).await?.clone();
        info.connection_state = SessionConnectionState::Connected;
        info.disconnected_at = None;
        info.connected_clients = info.connected_clients.saturating_add(1);
        if mode == SessionAccessMode::ReadWrite
            && (info.writer_client_id.is_none()
                || info.writer_client_id.as_deref() == Some(client_id))
        {
            info.writer_client_id = Some(client_id.to_string());
        }
        info.updated_at = Utc::now();
        info.last_activity = info.updated_at;
        let _ = self.audit(
            "session_connected",
            &info,
            Some(client_id),
            Some(serde_json::json!({ "mode": match mode { SessionAccessMode::ReadOnly => "read", SessionAccessMode::ReadWrite => "write" } })),
            None,
        );
        self.store_session(info.clone()).await?;
        Ok(info)
    }

    pub async fn mark_disconnected(
        &self,
        session_id: &str,
        client_id: Option<&str>,
    ) -> Result<PtySessionInfo> {
        let mut info = self.require_existing_session(session_id).await?.clone();
        info.connected_clients = info.connected_clients.saturating_sub(1);
        if client_id.is_some_and(|client_id| info.writer_client_id.as_deref() == Some(client_id)) {
            info.writer_client_id = None;
        }
        if info.connected_clients == 0 {
            info.connection_state = SessionConnectionState::Disconnected;
            info.disconnected_at = Some(Utc::now());
        }
        info.updated_at = Utc::now();
        let _ = self.audit("session_disconnected", &info, client_id, None, None);
        self.store_session(info.clone()).await?;
        Ok(info)
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        let info = self.require_existing_session(session_id).await?.clone();
        self.kill_tmux_session(&info.tmux_session).await?;
        self.sessions.write().await.remove(session_id);
        let _ = fs::remove_file(self.metadata_path(session_id));
        let _ = self.audit("session_closed", &info, None, None, None);
        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<PtySessionInfo> {
        self.refresh_stale_sessions().await;
        self.sessions.read().await.values().cloned().collect()
    }

    pub async fn get_session(&self, session_id: &str) -> Option<PtySessionInfo> {
        self.refresh_session(session_id).await;
        self.sessions.read().await.get(session_id).cloned()
    }

    pub async fn can_reconnect(&self, session_id: &str) -> bool {
        let Some(info) = self.get_session(session_id).await else {
            return false;
        };
        info.status == PtySessionStatus::Running
            && info.connection_state == SessionConnectionState::Disconnected
            && info.disconnected_at.is_some_and(|ts| {
                (Utc::now() - ts).num_seconds() <= self.config.reconnection_window_seconds
            })
    }

    pub async fn verify_owner(&self, session_id: &str, owner_id: &str) -> Result<PtySessionInfo> {
        let info = self.require_existing_session(session_id).await?;
        if info.owner_id != owner_id {
            bail!(
                "terminal session '{}' belongs to a different owner",
                session_id
            );
        }
        Ok(info)
    }

    pub async fn can_write(&self, session_id: &str, client_id: &str) -> bool {
        let Ok(info) = self.require_existing_session(session_id).await else {
            return false;
        };
        info.writer_client_id.is_none() || info.writer_client_id.as_deref() == Some(client_id)
    }

    pub async fn timeout_warning(&self, session_id: &str) -> Result<Option<i64>> {
        let info = self.require_existing_session(session_id).await?;
        if info.status != PtySessionStatus::Running {
            return Ok(None);
        }
        let idle = (Utc::now() - info.last_activity).num_seconds();
        let remaining = self.config.idle_timeout_seconds - idle;
        if remaining > 0 && remaining <= self.config.warning_window_seconds {
            Ok(Some(remaining))
        } else {
            Ok(None)
        }
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<Vec<String>> {
        self.refresh_stale_sessions().await;
        let sessions = self
            .sessions
            .read()
            .await
            .values()
            .cloned()
            .collect::<Vec<_>>();
        let mut expired = Vec::new();
        for info in sessions {
            if info.status == PtySessionStatus::Running
                && info.connection_state == SessionConnectionState::Disconnected
                && (Utc::now() - info.last_activity).num_seconds()
                    > self.config.idle_timeout_seconds
            {
                expired.push(info.session_id.clone());
            }
        }
        for session_id in &expired {
            if let Ok(info) = self.require_existing_session(session_id).await {
                let _ = self.audit("session_cleaned_up", &info, None, None, None);
            }
            let _ = self.close_session(session_id).await;
        }
        Ok(expired)
    }

    pub async fn health(&self) -> PtyHealth {
        self.refresh_stale_sessions().await;
        let sessions = self
            .sessions
            .read()
            .await
            .values()
            .cloned()
            .collect::<Vec<_>>();
        let running_sessions = sessions
            .iter()
            .filter(|session| session.status == PtySessionStatus::Running)
            .count();
        let stale_sessions = sessions
            .iter()
            .filter(|session| {
                session.status == PtySessionStatus::Running
                    && session.connection_state == SessionConnectionState::Disconnected
                    && (Utc::now() - session.last_activity).num_seconds()
                        > self.config.idle_timeout_seconds
            })
            .count();
        PtyHealth {
            tmux_available: self.tmux_bin.exists(),
            tmux_path: self.tmux_bin.to_string_lossy().into_owned(),
            backend_error: self
                .ensure_backend_available()
                .err()
                .map(|error| error.to_string()),
            session_count: sessions.len(),
            running_sessions,
            stale_sessions,
            state_dir: self.state_dir.to_string_lossy().into_owned(),
            audit_log_path: self.audit_log_path().to_string_lossy().into_owned(),
        }
    }

    pub async fn subscribe(&self, session_id: &str) -> Result<(PtySessionInfo, String, PathBuf)> {
        let info = self.require_running_session(session_id).await?.clone();
        let backlog = read_log_tail(&info.log_path, BACKLOG_BYTES)?;
        Ok((info.clone(), backlog, info.log_path.clone()))
    }

    pub async fn record_audit_event(
        &self,
        session_id: &str,
        event: &str,
        details: serde_json::Value,
        client_id: Option<&str>,
    ) -> Result<()> {
        let info = self.require_existing_session(session_id).await?;
        self.audit(event, &info, client_id, Some(details), None)
    }

    async fn require_running_session(&self, session_id: &str) -> Result<PtySessionInfo> {
        self.refresh_session(session_id).await;
        let sessions = self.sessions.read().await;
        let info = sessions
            .get(session_id)
            .ok_or_else(|| anyhow!("terminal session '{}' not found", session_id))?;
        if info.status != PtySessionStatus::Running {
            bail!("terminal session '{}' is not running", session_id);
        }
        Ok(info.clone())
    }

    async fn require_existing_session(&self, session_id: &str) -> Result<PtySessionInfo> {
        self.refresh_session(session_id).await;
        self.sessions
            .read()
            .await
            .get(session_id)
            .cloned()
            .ok_or_else(|| anyhow!("terminal session '{}' not found", session_id))
    }

    async fn update_activity(&self, session_id: &str) -> Result<()> {
        let mut info = self.require_running_session(session_id).await?;
        info.updated_at = Utc::now();
        info.last_activity = info.updated_at;
        self.store_session(info).await
    }

    async fn store_session(&self, info: PtySessionInfo) -> Result<()> {
        self.persist_session(&info)?;
        self.sessions
            .write()
            .await
            .insert(info.session_id.clone(), info);
        Ok(())
    }

    async fn refresh_stale_sessions(&self) {
        let ids = self
            .sessions
            .read()
            .await
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        for id in ids {
            self.refresh_session(&id).await;
        }
    }

    async fn refresh_session(&self, session_id: &str) {
        let maybe_info = self.sessions.read().await.get(session_id).cloned();
        let Some(mut info) = maybe_info else {
            return;
        };
        if info.status != PtySessionStatus::Running {
            return;
        }

        if tmux_has_session(&self.tmux_bin, &info.tmux_session) {
            return;
        }

        info.status = PtySessionStatus::Exited;
        info.connection_state = SessionConnectionState::Disconnected;
        info.disconnected_at = Some(Utc::now());
        info.updated_at = Utc::now();
        let _ = self.store_session(info).await;
    }

    async fn kill_tmux_session(&self, tmux_session: &str) -> Result<()> {
        if !tmux_has_session(&self.tmux_bin, tmux_session) {
            return Ok(());
        }
        let output = Command::new(&self.tmux_bin)
            .arg("kill-session")
            .arg("-t")
            .arg(tmux_session)
            .output()
            .await
            .context("kill tmux session")?;
        if !output.status.success() {
            bail!(
                "failed to kill tmux session: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(())
    }

    fn metadata_path(&self, session_id: &str) -> PathBuf {
        self.state_dir.join(format!("{}.json", session_id))
    }

    fn audit_log_path(&self) -> PathBuf {
        self.state_dir.join("audit.log")
    }

    fn persist_session(&self, info: &PtySessionInfo) -> Result<()> {
        let payload = serde_json::to_vec_pretty(info).context("serialize terminal session")?;
        fs::write(self.metadata_path(&info.session_id), payload).context("write terminal metadata")
    }

    fn load_persisted_sessions(&self) {
        let Ok(entries) = fs::read_dir(&self.state_dir) else {
            return;
        };

        let mut sessions = HashMap::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }
            let Ok(bytes) = fs::read(&path) else {
                continue;
            };
            let Ok(mut info) = serde_json::from_slice::<PtySessionInfo>(&bytes) else {
                continue;
            };
            if tmux_has_session(&self.tmux_bin, &info.tmux_session) {
                info.status = PtySessionStatus::Running;
                sessions.insert(info.session_id.clone(), info);
            } else {
                let _ = fs::remove_file(path);
            }
        }

        if let Ok(mut guard) = self.sessions.try_write() {
            *guard = sessions;
        }
    }

    fn audit(
        &self,
        event: &str,
        info: &PtySessionInfo,
        client_id: Option<&str>,
        details: Option<serde_json::Value>,
        override_owner: Option<&str>,
    ) -> Result<()> {
        let line = serde_json::json!({
            "ts": Utc::now().to_rfc3339(),
            "event": event,
            "session_id": info.session_id,
            "owner_id": override_owner.unwrap_or(&info.owner_id),
            "client_id": client_id,
            "tmux_session": info.tmux_session,
            "details": details,
        });
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.audit_log_path())
            .context("open audit log")?;
        writeln!(file, "{}", line).context("write audit log")
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new_with_config(
            dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("/tmp"))
                .join("allternit")
                .join("terminal-sessions"),
            PtyConfig::default(),
        )
    }
}

fn detect_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "/bin/bash".to_string())
}

fn ensure_tmux_available(tmux_bin: &Path) -> Result<()> {
    if tmux_bin.exists() {
        Ok(())
    } else {
        bail!("tmux not found at {}", tmux_bin.display())
    }
}

fn tmux_has_session(tmux_bin: &Path, tmux_session: &str) -> bool {
    std::process::Command::new(tmux_bin)
        .arg("has-session")
        .arg("-t")
        .arg(tmux_session)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn build_startup_command(shell: &str, env: &HashMap<String, String>) -> String {
    let mut exports = vec![
        format!("export TERM={}", quote_for_shell("xterm-256color")),
        format!("export COLORTERM={}", quote_for_shell("truecolor")),
    ];
    for (key, value) in env {
        exports.push(format!("export {}={}", key, quote_for_shell(value)));
    }
    let login_flag = if should_use_login_flag(shell) {
        " -l"
    } else {
        ""
    };
    format!(
        "{}; exec {}{}",
        exports.join("; "),
        quote_for_shell(shell),
        login_flag
    )
}

fn should_use_login_flag(shell: &str) -> bool {
    PathBuf::from(shell)
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| matches!(name, "bash" | "zsh" | "sh" | "fish"))
}

fn resolve_workdir(workdir: Option<String>) -> String {
    workdir
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("/tmp"))
                .to_string_lossy()
                .into_owned()
        })
}

fn quote_for_shell(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn read_log_tail(path: &Path, max_bytes: usize) -> Result<String> {
    let data = fs::read(path).with_context(|| format!("read terminal log {}", path.display()))?;
    if data.len() <= max_bytes {
        return Ok(String::from_utf8_lossy(&data).into_owned());
    }
    Ok(String::from_utf8_lossy(&data[data.len() - max_bytes..]).into_owned())
}

fn split_terminal_input(data: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(data);
    let mut parts = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        if ch == '\n' {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
            parts.push("\n".to_string());
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration as ChronoDuration;

    #[test]
    fn detects_default_shell() {
        assert!(!detect_shell().is_empty());
    }

    #[test]
    fn quotes_shell_values() {
        assert_eq!(quote_for_shell("a'b"), "'a'\"'\"'b'");
    }

    #[test]
    fn splits_terminal_input_into_key_segments() {
        assert_eq!(
            split_terminal_input(b"echo hi\npwd\n"),
            vec![
                "echo hi".to_string(),
                "\n".to_string(),
                "pwd".to_string(),
                "\n".to_string()
            ]
        );
    }

    #[tokio::test]
    async fn timeout_warning_uses_configured_idle_window() {
        let state_dir =
            std::env::temp_dir().join(format!("allternit-pty-timeout-test-{}", uuid::Uuid::new_v4()));
        let manager = PtyManager::new_with_config(
            state_dir.clone(),
            PtyConfig {
                reconnection_window_seconds: 300,
                idle_timeout_seconds: 10,
                warning_window_seconds: 5,
            },
        );

        let _session = manager
            .create_session(
                "session-1".to_string(),
                "owner-a".to_string(),
                None,
                80,
                24,
                HashMap::new(),
                Some("/tmp".to_string()),
            )
            .await
            .expect("create tmux-backed session");

        let now = Utc::now();
        {
            let mut sessions = manager.sessions.write().await;
            let info = sessions.get_mut("session-1").expect("session should exist");
            info.last_activity = now - ChronoDuration::seconds(7);
            info.updated_at = info.last_activity;
            info.disconnected_at = Some(info.last_activity);
            info.connection_state = SessionConnectionState::Disconnected;
        }

        let warning = manager
            .timeout_warning("session-1")
            .await
            .expect("timeout warning");
        assert_eq!(warning, Some(3));

        manager
            .close_session("session-1")
            .await
            .expect("close tmux-backed session");
        let _ = std::fs::remove_dir_all(state_dir);
    }
}
