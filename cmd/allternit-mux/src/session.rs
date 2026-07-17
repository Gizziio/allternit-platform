//! Session store: sessions → panes, metadata, and persistence.
//!
//! Layout on disk (`<state_dir>/<session-id>/`):
//!   meta.json               — session + pane metadata (atomic write)
//!   <pane-id>.scrollback    — append-only output log (restore replays tail)

use crate::detect::Detector;
use crate::events::EventBus;
use crate::manifest::ManifestSet;
use crate::protocol::Event;
use crate::pty::{PtyHandle, PtyManager};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, VecDeque};
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

const SCROLLBACK_CAP: usize = 1 << 20; // 1 MiB per pane
/// Lines of rendered history the vt100 parser retains (for screen tails).
const SCREEN_SCROLLBACK: usize = 2000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitMeta {
    pub direction: String,
    #[serde(default)]
    pub ratio: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneMeta {
    pub pane_id: String,
    #[serde(default)]
    pub label: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub cwd: Option<String>,
    /// Launch command, recorded for manual re-run after daemon restart.
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub split: Option<SplitMeta>,
    #[serde(default)]
    pub process_running: bool,
    #[serde(default)]
    pub exit_code: Option<i32>,
    /// PID of the pane's child process (None after a daemon restart).
    #[serde(default)]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub session_id: String,
    pub label: String,
    #[serde(default)]
    pub cwd: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub panes: Vec<PaneMeta>,
    #[serde(default)]
    pub next_pane_seq: u32,
}

pub struct PaneState {
    pub meta: PaneMeta,
    pub scrollback: VecDeque<u8>,
    /// Rendered terminal screen (vt100) — used for screen reads, verified
    /// send, and blocked-state detection.
    pub screen: vt100::Parser,
    pub detector: Detector,
    pub handle: Option<PtyHandle>,
    scrollback_file: Option<std::fs::File>,
}

pub type SharedPane = Arc<Mutex<PaneState>>;

pub struct SessionState {
    pub meta: SessionMeta,
    pub panes: HashMap<String, SharedPane>,
}

#[derive(Clone)]
pub struct SessionStore {
    state_dir: PathBuf,
    sessions: Arc<Mutex<HashMap<String, Arc<Mutex<SessionState>>>>>,
    bus: EventBus,
    pty_manager: Arc<PtyManager>,
    manifests: Arc<ManifestSet>,
}

impl SessionStore {
    /// Create a store and restore any persisted sessions from disk.
    pub async fn load(state_dir: PathBuf, bus: EventBus) -> Result<Self> {
        std::fs::create_dir_all(&state_dir)
            .with_context(|| format!("create state dir {}", state_dir.display()))?;
        let manifests = ManifestSet::load(&state_dir);
        let store = Self {
            state_dir,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            bus,
            pty_manager: Arc::new(PtyManager::new()),
            manifests: Arc::new(manifests),
        };
        store.restore().await?;
        Ok(store)
    }

    pub fn state_dir(&self) -> &Path {
        &self.state_dir
    }

    fn session_dir(&self, session_id: &str) -> PathBuf {
        self.state_dir.join(session_id)
    }

    // ------------------------------------------------------------ restore

    async fn restore(&self) -> Result<()> {
        let mut restored = 0usize;
        let entries = match std::fs::read_dir(&self.state_dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let meta_path = path.join("meta.json");
            let Ok(raw) = std::fs::read_to_string(&meta_path) else {
                continue;
            };
            let Ok(mut meta) = serde_json::from_str::<SessionMeta>(&raw) else {
                warn!("skipping unreadable {}", meta_path.display());
                continue;
            };
            let mut panes = HashMap::new();
            for pane_meta in &mut meta.panes {
                // Processes never survive a daemon restart.
                pane_meta.process_running = false;
                let sb_path = path.join(format!("{}.scrollback", pane_meta.pane_id));
                let mut scrollback = VecDeque::new();
                if let Ok(bytes) = std::fs::read(&sb_path) {
                    let start = bytes.len().saturating_sub(SCROLLBACK_CAP);
                    scrollback.extend(&bytes[start..]);
                }
                let file = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&sb_path)
                    .ok();
                let command = pane_meta.command.clone().unwrap_or_default();
                let manifest = self.manifests.match_command(&command).cloned();
                let mut screen = vt100::Parser::new(pane_meta.rows, pane_meta.cols, SCREEN_SCROLLBACK);
                // Prime the screen with the raw scrollback so screen reads
                // work immediately after a restore.
                let raw: Vec<u8> = scrollback.iter().copied().collect();
                screen.process(&raw);
                panes.insert(
                    pane_meta.pane_id.clone(),
                    Arc::new(Mutex::new(PaneState {
                        detector: Detector::new(manifest),
                        meta: pane_meta.clone(),
                        scrollback,
                        screen,
                        handle: None,
                        scrollback_file: file,
                    })),
                );
            }
            let session_id = meta.session_id.clone();
            self.sessions.lock().await.insert(
                session_id.clone(),
                Arc::new(Mutex::new(SessionState { meta, panes })),
            );
            restored += 1;
        }
        if restored > 0 {
            info!("restored {restored} session(s) from {}", self.state_dir.display());
        }
        Ok(())
    }

    fn persist_session(&self, session: &SessionState) -> Result<()> {
        let dir = self.session_dir(&session.meta.session_id);
        std::fs::create_dir_all(&dir)?;
        let tmp = dir.join("meta.json.tmp");
        let body = serde_json::to_string_pretty(&session.meta)?;
        std::fs::write(&tmp, body)?;
        std::fs::rename(&tmp, dir.join("meta.json"))?;
        Ok(())
    }

    /// Persist metadata for one session (best effort).
    async fn persist(&self, session_id: &str) {
        let sessions = self.sessions.lock().await;
        if let Some(s) = sessions.get(session_id) {
            let session = s.lock().await;
            if let Err(e) = self.persist_session(&session) {
                error!("persist {session_id}: {e:#}");
            }
        }
    }

    // ------------------------------------------------------------ sessions

    pub async fn create_session(&self, label: Option<String>, cwd: Option<String>) -> Result<SessionMeta> {
        let session_id = self.next_session_id().await;
        let label = label.unwrap_or_else(|| session_id.clone());
        let meta = SessionMeta {
            session_id: session_id.clone(),
            label,
            cwd,
            created_at: chrono::Utc::now(),
            panes: Vec::new(),
            next_pane_seq: 1,
        };
        let session = SessionState {
            meta: meta.clone(),
            panes: HashMap::new(),
        };
        std::fs::create_dir_all(self.session_dir(&session_id))?;
        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), Arc::new(Mutex::new(session)));
        self.bus.emit(Event::new(
            "session.created",
            json!({ "session_id": session_id, "label": meta.label }),
        ));
        self.persist(&session_id).await;
        Ok(meta)
    }

    async fn next_session_id(&self) -> String {
        let sessions = self.sessions.lock().await;
        let mut n = sessions.len() as u32 + 1;
        while sessions.contains_key(&n.to_string()) {
            n += 1;
        }
        n.to_string()
    }

    pub async fn list_sessions(&self) -> Vec<SessionMeta> {
        let sessions = self.sessions.lock().await;
        let mut out = Vec::new();
        for s in sessions.values() {
            out.push(s.lock().await.meta.clone());
        }
        out.sort_by(|a, b| a.session_id.cmp(&b.session_id));
        out
    }

    pub async fn get_session(&self, session_id: &str) -> Result<SessionMeta> {
        let sessions = self.sessions.lock().await;
        let s = sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("session not found: {session_id}"))?;
        let meta = s.lock().await.meta.clone();
        Ok(meta)
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        let session = {
            let mut sessions = self.sessions.lock().await;
            sessions
                .remove(session_id)
                .ok_or_else(|| anyhow::anyhow!("session not found: {session_id}"))?
        };
        {
            let session = session.lock().await;
            for pane in session.panes.values() {
                if let Some(h) = &pane.lock().await.handle {
                    h.kill();
                }
            }
        }
        let dir = self.session_dir(session_id);
        if dir.exists() {
            let _ = std::fs::remove_dir_all(&dir);
        }
        self.bus.emit(Event::new(
            "session.closed",
            json!({ "session_id": session_id }),
        ));
        Ok(())
    }

    // ------------------------------------------------------------ panes

    async fn with_session<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&Arc<Mutex<SessionState>>) -> R,
    ) -> Result<R> {
        let sessions = self.sessions.lock().await;
        let s = sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("session not found: {session_id}"))?;
        Ok(f(s))
    }

    pub async fn get_pane(&self, pane_id: &str) -> Result<(String, SharedPane)> {
        let session_id = pane_session_id(pane_id)?;
        let sessions = self.sessions.lock().await;
        let s = sessions
            .get(&session_id)
            .ok_or_else(|| anyhow::anyhow!("session not found: {session_id}"))?;
        let session = s.lock().await;
        let pane = session
            .panes
            .get(pane_id)
            .ok_or_else(|| anyhow::anyhow!("pane not found: {pane_id}"))?;
        Ok((session_id, pane.clone()))
    }

    /// Create a pane (optionally from a split). Runs a shell unless `command`
    /// is given, in which case the pane runs that argv directly.
    pub async fn create_pane(
        &self,
        session_id: &str,
        split: Option<SplitMeta>,
        cols: u16,
        rows: u16,
        command: Option<Vec<String>>,
        env: HashMap<String, String>,
    ) -> Result<PaneMeta> {
        let session = self
            .with_session(session_id, |s| s.clone())
            .await?;
        let (pane_id, cwd) = {
            let mut s = session.lock().await;
            let pane_id = format!("{}-{}", session_id, s.meta.next_pane_seq);
            s.meta.next_pane_seq += 1;
            (pane_id, s.meta.cwd.clone())
        };
        self.spawn_pane_process(session, pane_id, command, cols, rows, split, cwd, env)
            .await
    }

    /// Spawn (or respawn) the process inside a pane.
    async fn spawn_pane_process(
        &self,
        session: Arc<Mutex<SessionState>>,
        pane_id: String,
        argv: Option<Vec<String>>,
        cols: u16,
        rows: u16,
        split: Option<SplitMeta>,
        cwd: Option<String>,
        env: HashMap<String, String>,
    ) -> Result<PaneMeta> {
        let session_id = session.lock().await.meta.session_id.clone();
        let spawned = match &argv {
            Some(parts) => {
                anyhow::ensure!(!parts.is_empty(), "empty command");
                self.pty_manager.spawn_command(
                    &parts[0],
                    &parts[1..],
                    cols,
                    rows,
                    cwd.clone(),
                    env,
                )?
            }
            None => self
                .pty_manager
                .spawn_shell(cols, rows, cwd.clone(), env)?,
        };
        let command = argv.as_ref().map(|parts| parts.join(" "));
        let manifest = self.manifests.match_command(&spawned.command_line).cloned();

        let pane = PaneState {
            meta: PaneMeta {
                pane_id: pane_id.clone(),
                label: None,
                cols,
                rows,
                cwd,
                command: command.clone(),
                split,
                process_running: true,
                exit_code: None,
                pid: spawned.pid,
            },
            scrollback: VecDeque::new(),
            screen: vt100::Parser::new(rows, cols, SCREEN_SCROLLBACK),
            detector: Detector::new(manifest),
            handle: Some(spawned.handle),
            scrollback_file: std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.session_dir(&session_id).join(format!("{pane_id}.scrollback")))
                .ok(),
        };
        let pane = Arc::new(Mutex::new(pane));

        {
            let mut s = session.lock().await;
            s.panes.insert(pane_id.clone(), pane.clone());
            // Refresh metadata list.
            let mut metas = Vec::new();
            for p in s.panes.values() {
                metas.push(p.lock().await.meta.clone());
            }
            metas.sort_by(|a, b| a.pane_id.cmp(&b.pane_id));
            s.meta.panes = metas;
        }

        // Output forwarder: scrollback + screen + detector + events + disk.
        {
            let pane = pane.clone();
            let bus = self.bus.clone();
            let sid = session_id.clone();
            let pid_ = pane_id.clone();
            let mut output_rx = spawned.output_rx;
            tokio::spawn(async move {
                while let Some(chunk) = output_rx.recv().await {
                    let mut p = pane.lock().await;
                    p.scrollback.extend(chunk.iter().copied());
                    while p.scrollback.len() > SCROLLBACK_CAP {
                        p.scrollback.pop_front();
                    }
                    p.screen.process(&chunk);
                    if let Some(f) = &mut p.scrollback_file {
                        let _ = f.write_all(&chunk);
                        let _ = f.flush();
                    }
                    p.detector.on_output(&chunk);
                    bus.emit(
                        Event::new(
                            "pane.output",
                            json!({ "data": String::from_utf8_lossy(&chunk) }),
                        )
                        .for_pane(&sid, &pid_),
                    );
                }
            });
        }

        // Exit watcher.
        {
            let pane = pane.clone();
            let bus = self.bus.clone();
            let store = self.clone();
            let sid = session_id.clone();
            let pid_ = pane_id.clone();
            tokio::spawn(async move {
                let code = spawned.exit_rx.await.unwrap_or(-1);
                {
                    let mut p = pane.lock().await;
                    p.meta.process_running = false;
                    p.meta.exit_code = Some(code);
                }
                store.sync_pane_meta(&sid, &pid_).await;
                store.persist(&sid).await;
                bus.emit(
                    Event::new("pane.exited", json!({ "exit_code": code })).for_pane(&sid, &pid_),
                );
            });
        }

        self.bus.emit(
            Event::new(
                "pane.created",
                json!({ "session_id": session_id, "command": command }),
            )
            .for_pane(&session_id, &pane_id),
        );
        self.persist(&session_id).await;

        let p = pane.lock().await;
        Ok(p.meta.clone())
    }

    /// Re-sync the session's pane metadata list from live pane state.
    async fn sync_pane_meta(&self, session_id: &str, pane_id: &str) {
        let sessions = self.sessions.lock().await;
        if let Some(s) = sessions.get(session_id) {
            let mut session = s.lock().await;
            if let Some(pane) = session.panes.get(pane_id) {
                let meta = pane.lock().await.meta.clone();
                if let Some(slot) = session.meta.panes.iter_mut().find(|m| m.pane_id == pane_id) {
                    *slot = meta;
                }
            }
        }
    }

    /// Run a command inside an existing pane (replaces the pane process).
    pub async fn run_in_pane(
        &self,
        pane_id: &str,
        argv: Vec<String>,
        env: HashMap<String, String>,
    ) -> Result<PaneMeta> {
        let (session_id, pane) = self.get_pane(pane_id).await?;
        let (cols, rows, cwd, split) = {
            let p = pane.lock().await;
            anyhow::ensure!(
                !p.meta.process_running,
                "pane {pane_id} is busy (process still running)"
            );
            if let Some(h) = &p.handle {
                h.kill();
            }
            (
                p.meta.cols,
                p.meta.rows,
                p.meta.cwd.clone(),
                p.meta.split.clone(),
            )
        };
        let session = self.with_session(&session_id, |s| s.clone()).await?;
        // Remove the stale pane record, respawn under the same id.
        {
            let mut s = session.lock().await;
            s.panes.remove(pane_id);
        }
        self.spawn_pane_process(session, pane_id.to_string(), Some(argv), cols, rows, split, cwd, env)
            .await
    }

    pub async fn send_input(&self, pane_id: &str, data: &[u8]) -> Result<()> {
        let (_sid, pane) = self.get_pane(pane_id).await?;
        let p = pane.lock().await;
        let handle = p
            .handle
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("pane {pane_id} has no live process"))?;
        handle.write(data).await
    }

    pub async fn resize_pane(&self, pane_id: &str, cols: u16, rows: u16) -> Result<()> {
        let (sid, pane) = self.get_pane(pane_id).await?;
        {
            let mut p = pane.lock().await;
            p.meta.cols = cols;
            p.meta.rows = rows;
            p.screen.set_size(rows, cols);
            if let Some(h) = &p.handle {
                h.resize(cols, rows).await?;
            }
        }
        self.sync_pane_meta(&sid, pane_id).await;
        self.persist(&sid).await;
        Ok(())
    }

    pub async fn close_pane(&self, pane_id: &str) -> Result<()> {
        let (sid, pane) = self.get_pane(pane_id).await?;
        {
            let p = pane.lock().await;
            if let Some(h) = &p.handle {
                h.kill();
            }
        }
        let session = self.with_session(&sid, |s| s.clone()).await?;
        {
            let mut s = session.lock().await;
            s.panes.remove(pane_id);
            s.meta.panes.retain(|m| m.pane_id != pane_id);
        }
        let sb = self.session_dir(&sid).join(format!("{pane_id}.scrollback"));
        let _ = std::fs::remove_file(sb);
        self.persist(&sid).await;
        self.bus
            .emit(Event::new("pane.closed", json!({})).for_pane(&sid, pane_id));
        Ok(())
    }

    /// Bottom slice of the rendered screen, used for detection + verified send.
    pub(crate) fn screen_bottom(p: &PaneState, n_lines: usize) -> String {
        let contents = p.screen.screen().contents();
        tail_lines(&contents, n_lines)
    }

    /// Rendered screen text for a pane.
    pub async fn read_screen(&self, pane_id: &str, lines: Option<usize>) -> Result<String> {
        let (_sid, pane) = self.get_pane(pane_id).await?;
        let p = pane.lock().await;
        let contents = p.screen.screen().contents();
        Ok(match lines {
            Some(n) => tail_lines(&contents, n),
            None => contents,
        })
    }

    /// Read scrollback text for a pane (tail, lossy UTF-8).
    pub async fn read_pane(&self, pane_id: &str, lines: Option<usize>) -> Result<String> {
        let (_sid, pane) = self.get_pane(pane_id).await?;
        let mut p = pane.lock().await;
        let text = String::from_utf8_lossy(p.scrollback.make_contiguous()).to_string();
        Ok(match lines {
            Some(n) => tail_lines(&text, n),
            None => text,
        })
    }

    /// Verified send: write text (no Enter), confirm it renders on screen,
    /// only then send Enter. On timeout send C-u and fail. Mirrors the
    /// ADR-0044 orchestrator's paste → read-back → Enter safety property.
    pub async fn send_verified(&self, pane_id: &str, text: &str, timeout: Duration) -> Result<()> {
        let (_sid, pane) = self.get_pane(pane_id).await?;
        {
            let p = pane.lock().await;
            anyhow::ensure!(
                p.meta.process_running,
                "pane {pane_id} has no live process"
            );
        }
        let marker = alnum(text);
        let marker = if marker.len() > 40 {
            marker[marker.len() - 40..].to_string()
        } else {
            marker
        };
        anyhow::ensure!(!marker.is_empty(), "prompt has no alphanumeric content");
        self.send_input(pane_id, text.as_bytes()).await?;
        let deadline = std::time::Instant::now() + timeout;
        loop {
            {
                let p = pane.lock().await;
                let contents = alnum(&p.screen.screen().contents());
                if contents.contains(&marker) {
                    break;
                }
            }
            if std::time::Instant::now() >= deadline {
                // Clear the line, never Enter a half-landed prompt.
                self.send_input(pane_id, &[0x15]).await?; // C-u
                anyhow::bail!("verified send timed out waiting for text to render (cleared with C-u)");
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        self.send_input(pane_id, b"\n").await?;
        Ok(())
    }

    /// Agent state for a pane.
    pub async fn agent_state(&self, pane_id: &str) -> Result<serde_json::Value> {
        let (_sid, pane) = self.get_pane(pane_id).await?;
        let p = pane.lock().await;
        let exited = !p.meta.process_running;
        let bottom = Self::screen_bottom(&p, 5);
        let state = p.detector.state(exited, &bottom);
        Ok(json!({
            "pane_id": pane_id,
            "agent": p.detector.agent,
            "state": state.to_string(),
            "reason": p.detector.reason(exited, &bottom),
            "exit_code": p.meta.exit_code,
        }))
    }

    /// All panes with a detected agent.
    pub async fn list_agents(&self) -> Vec<serde_json::Value> {
        let sessions = self.sessions.lock().await;
        let mut out = Vec::new();
        for s in sessions.values() {
            let session = s.lock().await;
            for (pid_, pane) in &session.panes {
                let p = pane.lock().await;
                if p.detector.agent.is_some() {
                    let exited = !p.meta.process_running;
                    let bottom = Self::screen_bottom(&p, 5);
                    out.push(json!({
                        "pane_id": pid_,
                        "session_id": session.meta.session_id,
                        "agent": p.detector.agent,
                        "state": p.detector.state(exited, &bottom).to_string(),
                    }));
                }
            }
        }
        out
    }

    /// Snapshot of every pane (for `pane.list`).
    pub async fn list_panes(&self, session_id: &str) -> Result<Vec<serde_json::Value>> {
        let session = self.with_session(session_id, |s| s.clone()).await?;
        let s = session.lock().await;
        let mut out = Vec::new();
        for (pid_, pane) in &s.panes {
            let p = pane.lock().await;
            let exited = !p.meta.process_running;
            let bottom = Self::screen_bottom(&p, 5);
            out.push(json!({
                "pane_id": pid_,
                "cols": p.meta.cols,
                "rows": p.meta.rows,
                "cwd": p.meta.cwd,
                "command": p.meta.command,
                "process_running": p.meta.process_running,
                "exit_code": p.meta.exit_code,
                "agent": p.detector.agent,
                "agent_state": p.detector.state(exited, &bottom).to_string(),
            }));
        }
        out.sort_by(|a, b| {
            a["pane_id"]
                .as_str()
                .unwrap_or("")
                .cmp(b["pane_id"].as_str().unwrap_or(""))
        });
        Ok(out)
    }

    /// Wait for a file to appear on disk (orchestrator sentinel watch).
    /// Returns true when the file exists, false on timeout.
    pub async fn wait_file(&self, path: &str, timeout: Duration) -> bool {
        let deadline = std::time::Instant::now() + timeout;
        loop {
            if std::path::Path::new(path).exists() {
                return true;
            }
            if std::time::Instant::now() >= deadline {
                return false;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// Flush per-pane scrollback files (called on graceful shutdown).
    pub async fn shutdown(&self) {
        info!("mux store shutdown: {} session(s)", self.sessions.lock().await.len());
    }
}

/// Pane ids look like `<session>-<n>`.
fn pane_session_id(pane_id: &str) -> Result<String> {
    let (sid, _) = pane_id
        .rsplit_once('-')
        .ok_or_else(|| anyhow::anyhow!("invalid pane id: {pane_id}"))?;
    Ok(sid.to_string())
}

/// Split a command line respecting simple quoting.
pub fn tokenize_command(cmdline: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut chars = cmdline.chars().peekable();
    let mut quote: Option<char> = None;
    while let Some(c) = chars.next() {
        match (quote, c) {
            (Some(q), c) if c == q => quote = None,
            (Some(_), c) => cur.push(c),
            (None, '\'' | '"') => quote = Some(c),
            (None, '\\') => {
                if let Some(&next) = chars.peek() {
                    cur.push(next);
                    chars.next();
                }
            }
            (None, c) if c.is_whitespace() => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            (None, c) => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn tail_lines(text: &str, n: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

/// Strip everything but ASCII alphanumerics — ao-style wrap-proof matching.
fn alnum(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_simple() {
        assert_eq!(tokenize_command("echo hello world"), vec!["echo", "hello", "world"]);
    }

    #[test]
    fn tokenizes_quotes() {
        assert_eq!(
            tokenize_command("bash -c 'echo hi there'"),
            vec!["bash", "-c", "echo hi there"]
        );
    }

    #[test]
    fn pane_id_parse() {
        assert_eq!(pane_session_id("3-12").unwrap(), "3");
        assert!(pane_session_id("nohyphen").is_err());
    }

    #[test]
    fn tail_lines_works() {
        let t = "a\nb\nc\nd";
        assert_eq!(tail_lines(t, 2), "c\nd");
    }
}
