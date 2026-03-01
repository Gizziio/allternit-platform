use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::fmt;
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info};
use uuid::Uuid;

pub struct TerminalSession {
    pub id: String,
    pub tx: mpsc::UnboundedSender<Vec<u8>>,
    pub master: Arc<std::sync::Mutex<Box<dyn MasterPty + Send>>>,
    pub pid: Option<u32>,
}

impl fmt::Debug for TerminalSession {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TerminalSession")
            .field("id", &self.id)
            .finish()
    }
}

#[derive(Debug)]
pub struct TerminalManager {
    sessions: Arc<RwLock<HashMap<String, Arc<TerminalSession>>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self) -> anyhow::Result<String> {
        let shell = if cfg!(target_os = "windows") {
            "powershell.exe"
        } else {
            "zsh"
        };
        self.create_custom_session(shell, &[], None, None).await
    }

    pub async fn create_custom_session(
        &self,
        command: &str,
        args: &[String],
        cwd: Option<std::path::PathBuf>,
        env: Option<HashMap<String, String>>,
    ) -> anyhow::Result<String> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(command);
        cmd.args(args);

        if let Some(env_vars) = env {
            for (k, v) in env_vars {
                cmd.env(k, v);
            }
        }

        if let Some(dir) = cwd {
            cmd.cwd(dir);
        } else {
            let project_root = std::env::current_dir()?;
            let workspace_dir = project_root.join("workspace");
            if workspace_dir.exists() {
                cmd.cwd(workspace_dir);
            } else {
                cmd.cwd(project_root);
            }
        }

        let child = pair.slave.spawn_command(cmd)?;
        let pid = child.process_id();

        let id = Uuid::new_v4().to_string();
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

        let mut master_writer = pair.master.take_writer()?;
        let session_id = id.clone();

        // Task to handle writing to PTY
        tokio::spawn(async move {
            while let Some(data) = rx.recv().await {
                if let Err(e) = master_writer.write_all(&data) {
                    error!("Failed to write to PTY {}: {}", session_id, e);
                    break;
                }
                let _ = master_writer.flush();
            }
        });

        let session = Arc::new(TerminalSession {
            id: id.clone(),
            tx,
            master: Arc::new(std::sync::Mutex::new(pair.master)),
            pid,
        });

        self.sessions.write().await.insert(id.clone(), session);

        Ok(id)
    }

    pub async fn get_session(&self, id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions.read().await.get(id).cloned()
    }

    pub async fn remove_session(&self, id: &str) {
        self.sessions.write().await.remove(id);
    }
}
