//! PTY (Pseudo Terminal) management
//!
//! Creates interactive shell sessions for web terminal.
//! Uses portable-pty for cross-platform PTY support.

use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tracing::{debug, error, info};

/// PTY manager handles multiple terminal sessions
#[derive(Debug, Clone)]
pub struct PtyManager {
    sessions: Arc<RwLock<HashMap<String, PtySessionHandle>>>,
    default_shell: String,
}

/// Handle to a running PTY session
#[derive(Debug)]
struct PtySessionHandle {
    session_id: String,
    write_tx: mpsc::Sender<Vec<u8>>,
    resize_tx: mpsc::Sender<(u16, u16)>,
    shutdown_tx: mpsc::Sender<()>,
}

/// Output from a PTY session
#[derive(Debug, Clone)]
pub struct PtyOutput {
    pub session_id: String,
    pub data: Vec<u8>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            default_shell: Self::detect_shell(),
        }
    }
    
    /// Create a new PTY session with actual PTY support
    pub async fn create_session(
        &self,
        session_id: String,
        shell: Option<String>,
        cols: u16,
        rows: u16,
        env: HashMap<String, String>,
        working_dir: Option<String>,
        output_tx: mpsc::Sender<PtyOutput>,
    ) -> Result<()> {
        let shell = shell.unwrap_or_else(|| self.default_shell.clone());
        
        info!("Creating PTY session: {} (shell: {}, {}x{}, env_vars: {}, cwd: {:?})", 
            session_id, shell, cols, rows, env.len(), working_dir);
        
        // Channels for communication with the PTY task
        let (write_tx, write_rx) = mpsc::channel::<Vec<u8>>(256);
        let (resize_tx, resize_rx) = mpsc::channel::<(u16, u16)>(16);
        let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>(1);
        
        let session_id_clone = session_id.clone();
        
        // Spawn the PTY in a blocking task since portable-pty uses sync I/O
        tokio::task::spawn_blocking(move || {
            if let Err(e) = run_pty_task(
                session_id_clone,
                shell,
                cols,
                rows,
                env,
                working_dir,
                write_rx,
                resize_rx,
                shutdown_rx,
                output_tx,
            ) {
                error!("PTY task error: {}", e);
            }
        });
        
        // Store session handle
        let handle = PtySessionHandle {
            session_id: session_id.clone(),
            write_tx,
            resize_tx,
            shutdown_tx,
        };
        
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), handle);
        }
        
        info!("PTY session created: {}", session_id);
        Ok(())
    }
    
    /// Write data to a PTY session
    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            session.write(data).await
        } else {
            anyhow::bail!("Session {} not found", session_id)
        }
    }
    
    /// Resize a PTY session
    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        let sessions = self.sessions.read().await;
        
        if let Some(session) = sessions.get(session_id) {
            session.resize(cols, rows).await
        } else {
            anyhow::bail!("Session {} not found", session_id)
        }
    }
    
    /// Close a PTY session
    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        
        if let Some(handle) = sessions.remove(session_id) {
            // Signal shutdown
            let _ = handle.shutdown_tx.send(()).await;
            info!("PTY session closed: {}", session_id);
        }
        
        Ok(())
    }
    
    /// List active sessions
    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }
    
    /// Detect the default shell for this system
    fn detect_shell() -> String {
        // On macOS, use user's preferred shell
        #[cfg(target_os = "macos")]
        {
            if let Ok(shell) = std::env::var("SHELL") {
                if !shell.is_empty() {
                    return shell;
                }
            }
        }
        
        // Try to detect from environment
        if let Ok(shell) = std::env::var("SHELL") {
            if !shell.is_empty() {
                return shell;
            }
        }
        
        // Fallbacks
        if cfg!(target_os = "windows") {
            "powershell.exe".to_string()
        } else {
            "/bin/bash".to_string()
        }
    }
}

impl PtySessionHandle {
    /// Write data to the PTY
    pub async fn write(&self, data: &[u8]) -> Result<()> {
        self.write_tx.send(data.to_vec()).await
            .map_err(|_| anyhow::anyhow!("Failed to send data to PTY - channel closed"))?;
        Ok(())
    }
    
    /// Resize the PTY
    pub async fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.resize_tx.send((cols, rows)).await
            .map_err(|_| anyhow::anyhow!("Failed to send resize to PTY - channel closed"))?;
        Ok(())
    }
}

/// The actual PTY task that runs in a blocking thread
fn run_pty_task(
    session_id: String,
    shell: String,
    cols: u16,
    rows: u16,
    env: HashMap<String, String>,
    working_dir: Option<String>,
    mut write_rx: mpsc::Receiver<Vec<u8>>,
    mut resize_rx: mpsc::Receiver<(u16, u16)>,
    mut shutdown_rx: mpsc::Receiver<()>,
    output_tx: mpsc::Sender<PtyOutput>,
) -> Result<()> {
    use std::thread;
    use std::time::Duration;

    info!("Starting PTY task for session: {}", session_id);

    // Use native PTY system
    let pty_system = native_pty_system();

    // Create PTY with initial size
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).context("Failed to open PTY")?;

    // Build command
    let mut cmd = CommandBuilder::new(&shell);

    // Set environment variables
    for (key, value) in env {
        cmd.env(key, value);
    }

    // Set working directory
    if let Some(cwd) = working_dir {
        cmd.cwd(cwd);
    }

    // Spawn the shell
    let mut child = pair.slave.spawn_command(cmd)
        .context("Failed to spawn shell process")?;

    info!("Shell spawned: {} (PID: {:?})", shell, child.process_id());

    // Get reader/writer from master
    let mut reader = pair.master.try_clone_reader()
        .context("Failed to clone PTY reader")?;
    let mut writer = pair.master.take_writer()
        .context("Failed to take PTY writer")?;
    let master_for_resize = pair.master;
    
    // Flag to signal shutdown
    let shutdown_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let shutdown_flag_writer = shutdown_flag.clone();
    let shutdown_flag_reader = shutdown_flag.clone();
    let shutdown_flag_resize = shutdown_flag.clone();

    let session_id_writer = session_id.clone();
    let session_id_reader = session_id.clone();
    let session_id_resize = session_id.clone();

    // Spawn resize handler thread
    let resize_handle = thread::spawn(move || {
        loop {
            if shutdown_flag_resize.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }

            match resize_rx.try_recv() {
                Ok((new_cols, new_rows)) => {
                    debug!("Resizing PTY {} to {}x{}", session_id_resize, new_cols, new_rows);
                    let new_size = PtySize {
                        rows: new_rows,
                        cols: new_cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    };
                    if let Err(e) = master_for_resize.resize(new_size) {
                        error!("Failed to resize PTY {}: {}", session_id_resize, e);
                    } else {
                        info!("PTY {} resized to {}x{}", session_id_resize, new_cols, new_rows);
                    }
                }
                Err(mpsc::error::TryRecvError::Empty) => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    break;
                }
            }
        }
        debug!("Resize thread exiting for session {}", session_id_resize);
    });
    
    // Spawn writer thread
    let writer_handle = thread::spawn(move || {
        loop {
            if shutdown_flag_writer.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            
            // Check for data to write with timeout
            match write_rx.try_recv() {
                Ok(data) => {
                    debug!("Writing {} bytes to PTY {}", data.len(), session_id_writer);
                    if let Err(e) = writer.write_all(&data) {
                        error!("Failed to write to PTY {}: {}", session_id_writer, e);
                        break;
                    }
                    if let Err(e) = writer.flush() {
                        error!("Failed to flush PTY {}: {}", session_id_writer, e);
                        break;
                    }
                }
                Err(mpsc::error::TryRecvError::Empty) => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(mpsc::error::TryRecvError::Disconnected) => {
                    break;
                }
            }
        }
        debug!("Writer thread exiting for session {}", session_id_writer);
    });
    
    // Spawn reader thread
    let reader_handle = thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            if shutdown_flag_reader.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            
            // Read with a short timeout by using non-blocking approach
            match reader.read(&mut buf) {
                Ok(0) => {
                    debug!("PTY EOF for session {}", session_id_reader);
                    break;
                }
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    debug!("Read {} bytes from PTY {}", n, session_id_reader);
                    if output_tx.blocking_send(PtyOutput {
                        session_id: session_id_reader.clone(),
                        data,
                    }).is_err() {
                        error!("Output channel closed for session {}", session_id_reader);
                        break;
                    }
                }
                Err(e) => {
                    error!("PTY read error for session {}: {}", session_id_reader, e);
                    break;
                }
            }
        }
        debug!("Reader thread exiting for session {}", session_id_reader);
    });
    
    // Main loop: wait for shutdown or child exit
    let result: Result<()> = loop {
        // Check shutdown
        if shutdown_rx.try_recv().is_ok() {
            info!("Shutdown signal received for session {}", session_id);
            break Ok(());
        }
        
        // Check if child process has exited
        match child.try_wait() {
            Ok(Some(status)) => {
                info!("Shell process exited with status: {:?} for session {}", status, session_id);
                break Ok(());
            }
            Ok(None) => {
                // Still running, sleep briefly
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                error!("Error checking child status for session {}: {}", session_id, e);
                break Err(e.into());
            }
        }
    };
    
    // Signal threads to shutdown
    shutdown_flag.store(true, std::sync::atomic::Ordering::Relaxed);
    
    // Wait for threads to finish
    let _ = reader_handle.join();
    let _ = writer_handle.join();
    let _ = resize_handle.join();
    
    // Kill the child process if still running
    if let Ok(None) = child.try_wait() {
        let _ = child.kill();
        let _ = child.wait();
    }
    
    info!("PTY task ended for session: {}", session_id);
    result
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_detect_shell() {
        let shell = PtyManager::detect_shell();
        assert!(!shell.is_empty());
    }
    
    #[tokio::test]
    async fn test_pty_manager_creation() {
        let manager = PtyManager::new();
        let sessions = manager.list_sessions().await;
        assert!(sessions.is_empty());
    }
}
