//! PTY management over `portable-pty`.
//!
//! Each pane owns one PTY with a child process. Output is forwarded over a
//! tokio channel to the session store (scrollback ring + event bus). Input,
//! resize, and kill are sent over channels into the blocking PTY task.

use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use tracing::{debug, error, info};

/// Chunk of PTY output bytes.
pub type OutputChunk = Vec<u8>;

/// Handle a running PTY: input, resize, kill.
#[derive(Debug)]
pub struct PtyHandle {
    write_tx: mpsc::Sender<Vec<u8>>,
    resize_tx: mpsc::Sender<(u16, u16)>,
    kill_flag: Arc<AtomicBool>,
}

impl PtyHandle {
    pub async fn write(&self, data: &[u8]) -> Result<()> {
        self.write_tx
            .send(data.to_vec())
            .await
            .map_err(|_| anyhow::anyhow!("pty write channel closed"))?;
        Ok(())
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.resize_tx
            .send((cols, rows))
            .await
            .map_err(|_| anyhow::anyhow!("pty resize channel closed"))?;
        Ok(())
    }

    pub fn kill(&self) {
        self.kill_flag.store(true, Ordering::Relaxed);
    }
}

/// Everything returned when a PTY is spawned.
pub struct SpawnedPty {
    pub handle: PtyHandle,
    /// Stream of output bytes from the PTY.
    pub output_rx: mpsc::Receiver<OutputChunk>,
    /// Resolves with the exit code when the child exits.
    pub exit_rx: oneshot::Receiver<i32>,
    /// PID of the spawned child, if available.
    pub pid: Option<u32>,
    /// Command line the child was spawned with (for process-name detection).
    pub command_line: String,
}

pub struct PtyManager {
    default_shell: String,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            default_shell: detect_shell(),
        }
    }

    /// Spawn a shell in a new PTY.
    pub fn spawn_shell(
        &self,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        env: HashMap<String, String>,
    ) -> Result<SpawnedPty> {
        self.spawn_command(&self.default_shell.clone(), &[], cols, rows, cwd, env)
    }

    /// Spawn a command (already tokenized) in a new PTY.
    pub fn spawn_command(
        &self,
        program: &str,
        args: &[String],
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        env: HashMap<String, String>,
    ) -> Result<SpawnedPty> {
        let command_line = if args.is_empty() {
            program.to_string()
        } else {
            format!("{} {}", program, args.join(" "))
        };

        let (write_tx, write_rx) = mpsc::channel::<Vec<u8>>(256);
        let (resize_tx, resize_rx) = mpsc::channel::<(u16, u16)>(16);
        let (output_tx, output_rx) = mpsc::channel::<OutputChunk>(256);
        let (exit_tx, exit_rx) = oneshot::channel::<i32>();
        let kill_flag = Arc::new(AtomicBool::new(false));
        let kill_flag_task = kill_flag.clone();

        let program = program.to_string();
        let args: Vec<String> = args.to_vec();
        // std channel: recv_timeout is legal from the async caller (short wait).
        let (pid_tx, pid_rx) = std::sync::mpsc::channel::<Option<u32>>();

        // portable-pty uses sync I/O — run the whole thing on a blocking thread.
        thread::spawn(move || {
            if let Err(e) = run_pty_task(
                program,
                args,
                cols,
                rows,
                cwd,
                env,
                write_rx,
                resize_rx,
                output_tx,
                exit_tx,
                pid_tx,
                kill_flag_task,
            ) {
                error!("pty task error: {e:#}");
            }
        });

        let pid = pid_rx
            .recv_timeout(Duration::from_secs(5))
            .ok()
            .flatten();
        info!("spawned pty for `{command_line}` (pid: {pid:?})");

        Ok(SpawnedPty {
            handle: PtyHandle {
                write_tx,
                resize_tx,
                kill_flag,
            },
            output_rx,
            exit_rx,
            pid,
            command_line,
        })
    }
}

#[allow(clippy::too_many_arguments)]
fn run_pty_task(
    program: String,
    args: Vec<String>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    env: HashMap<String, String>,
    mut write_rx: mpsc::Receiver<Vec<u8>>,
    mut resize_rx: mpsc::Receiver<(u16, u16)>,
    output_tx: mpsc::Sender<OutputChunk>,
    exit_tx: oneshot::Sender<i32>,
    pid_tx: std::sync::mpsc::Sender<Option<u32>>,
    kill_flag: Arc<AtomicBool>,
) -> Result<()> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .context("openpty failed")?;

    let mut cmd = CommandBuilder::new(&program);
    cmd.args(args.iter().map(|s| s.as_str()));
    // The daemon usually runs headless, so the inherited TERM is unset or
    // "dumb"; prompts like starship refuse to render under that. Callers can
    // still override via their own env.
    cmd.env("TERM", "xterm-256color");
    for (k, v) in env {
        cmd.env(k, v);
    }
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .with_context(|| format!("failed to spawn `{program}`"))?;

    let _ = pid_tx.send(child.process_id());

    let mut reader = pair
        .master
        .try_clone_reader()
        .context("failed to clone pty reader")?;
    let mut writer = pair.master.take_writer().context("no pty writer")?;
    let master = pair.master;

    // Reader thread: blocking reads -> tokio channel.
    let reader_kill = kill_flag.clone();
    let reader_handle = thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            if reader_kill.load(Ordering::Relaxed) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF: child closed the pty
                Ok(n) => {
                    if output_tx.blocking_send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    debug!("pty reader: {e}");
                    break;
                }
            }
        }
    });

    // Writer thread.
    let writer_kill = kill_flag.clone();
    let writer_handle = thread::spawn(move || loop {
        if writer_kill.load(Ordering::Relaxed) {
            break;
        }
        match write_rx.try_recv() {
            Ok(data) => {
                if writer.write_all(&data).is_err() {
                    break;
                }
                let _ = writer.flush();
            }
            Err(mpsc::error::TryRecvError::Empty) => thread::sleep(Duration::from_millis(5)),
            Err(mpsc::error::TryRecvError::Disconnected) => break,
        }
    });

    // Resize thread.
    let resize_kill = kill_flag.clone();
    let resize_handle = thread::spawn(move || loop {
        if resize_kill.load(Ordering::Relaxed) {
            break;
        }
        match resize_rx.try_recv() {
            Ok((c, r)) => {
                let _ = master.resize(PtySize {
                    rows: r,
                    cols: c,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
            Err(mpsc::error::TryRecvError::Empty) => thread::sleep(Duration::from_millis(10)),
            Err(mpsc::error::TryRecvError::Disconnected) => break,
        }
    });

    // Reaper: wait for exit or kill request.
    let exit_code = loop {
        if kill_flag.load(Ordering::Relaxed) {
            let _ = child.kill();
        }
        match child.try_wait() {
            Ok(Some(status)) => break status.exit_code() as i32,
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(_) => break -1,
        }
    };

    kill_flag.store(true, Ordering::Relaxed);
    let _ = exit_tx.send(exit_code);
    let _ = reader_handle.join();
    let _ = writer_handle.join();
    let _ = resize_handle.join();
    Ok(())
}

fn detect_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() {
            return shell;
        }
    }
    "/bin/bash".to_string()
}
