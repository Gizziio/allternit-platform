//! Shell command - Start an interactive shell session
//!
//! This module provides an interactive shell with full PTY support for:
//! - Terminal features (colors, cursor movement, line editing)
//! - Command history
//! - Signal handling (Ctrl+C, Ctrl+D)
//! - Terminal resize events

use colored::Colorize;
use console::Term;
use nix::fcntl::{fcntl, FcntlArg, OFlag};
use nix::pty::{openpty, OpenptyResult};
use nix::sys::signal::{kill, Signal};
use nix::sys::termios::{tcgetattr, tcsetattr, SetArg, Termios};
use nix::sys::wait::waitpid;
use nix::unistd::{close, dup2, fork, setsid, ForkResult, Pid};
use std::io::{Read, Write};
use std::os::fd::{AsFd, AsRawFd, BorrowedFd, FromRawFd, IntoRawFd, OwnedFd, RawFd};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::select;
use tokio::signal::unix::{signal, SignalKind};
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::error::{CliError, Result};

/// Shell command configuration
pub struct ShellCommand {
    pub shell: String,
    pub use_vm: bool,
}

impl ShellCommand {
    /// Execute the shell command
    pub async fn execute(self, _config: Config) -> Result<()> {
        info!("Starting {} shell", self.shell);

        // Check if we have a TTY
        let has_tty = atty::is(atty::Stream::Stdout);

        if has_tty {
            // Use PTY mode for full terminal support
            self.run_with_pty().await
        } else {
            // Fall back to basic streaming mode
            self.run_basic_mode().await
        }
    }

    /// Run shell with PTY support for full terminal features
    async fn run_with_pty(&self) -> Result<()> {
        // Get the shell path
        let shell_path = self.resolve_shell_path()?;
        debug!("Using shell: {}", shell_path);

        // Get terminal size
        let term = Term::stdout();
        let (rows, cols) = term.size();
        debug!("Terminal size: {}x{}", rows, cols);

        // Open PTY
        let winsize = nix::pty::Winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };

        let pty = match openpty(&winsize, None) {
            Ok(p) => p,
            Err(e) => {
                warn!("Failed to open PTY: {}, falling back to basic mode", e);
                return self.run_basic_mode().await;
            }
        };

        let OpenptyResult { master, slave } = pty;
        let master_fd = master.as_raw_fd();
        let slave_fd: RawFd = slave.as_raw_fd();
        // Keep slave_fd in a variable that won't be dropped until after fork
        let _slave_guard = slave;

        // Save original terminal settings
        let stdin_fd = nix::libc::STDIN_FILENO;
        let original_termios = tcgetattr(unsafe { BorrowedFd::borrow_raw(stdin_fd) }).ok();

        // Set raw mode on stdin for proper PTY forwarding
        if let Err(e) = set_raw_mode() {
            warn!("Failed to set raw mode: {}, falling back to basic mode", e);
            return self.run_basic_mode().await;
        }

        // Fork the shell process
        let pid = match unsafe { fork() } {
            Ok(ForkResult::Parent { child }) => {
                debug!("Forked shell process: PID {}", child);
                child
            }
            Ok(ForkResult::Child) => {
                // Child process: set up PTY slave and exec shell
                unsafe { self.setup_shell_process(slave_fd, &shell_path) };
            }
            Err(e) => {
                restore_terminal(&original_termios);
                return Err(CliError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Fork failed: {}", e),
                )));
            }
        };

        // Close slave fd in parent - we need to drop the OwnedFd
        // slave is kept alive by _slave_guard

        // Set non-blocking mode on master fd
        if let Err(e) = set_nonblocking(master_fd) {
            let _ = kill(pid, Signal::SIGTERM);
            restore_terminal(&original_termios);
            return Err(e);
        }

        // Show welcome message
        eprintln!(
            "{}",
            format!("A2R Interactive Shell ({})", self.shell).cyan().bold()
        );
        eprintln!("{}", "Type 'exit' or press Ctrl+D to exit".dimmed());
        eprintln!();

        // Run the PTY forwarder
        let result = self
            .forward_pty(master_fd, pid, &original_termios)
            .await;

        // Cleanup
        restore_terminal(&original_termios);
        // master is automatically closed when dropped

        // Wait for child to exit
        let _ = waitpid(Some(pid), None);

        match result {
            Ok(()) => {
                info!("Shell session ended");
                Ok(())
            }
            Err(e) => {
                error!("Shell session error: {}", e);
                Err(e)
            }
        }
    }

    /// Run shell in basic streaming mode (no PTY)
    async fn run_basic_mode(&self) -> Result<()> {
        let shell_path = self.resolve_shell_path()?;
        debug!("Using shell (basic mode): {}", shell_path);

        // Build the command
        let mut cmd = Command::new(&shell_path);
        cmd.arg("-i") // Interactive mode
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .env("A2R_SHELL", "1");

        // Spawn the process
        let mut child = cmd.spawn().map_err(|e| CliError::ExecutionFailed {
            message: format!("Failed to start shell: {}", e),
            exit_code: 1,
        })?;

        let child_id = child.id().expect("Child process should have ID") as i32;
        info!("Started shell process: PID {}", child_id);

        // Take stdio handles
        let mut child_stdin = child
            .stdin
            .take()
            .ok_or_else(|| CliError::Internal("Failed to get stdin".to_string()))?;
        let mut child_stdout = child
            .stdout
            .take()
            .ok_or_else(|| CliError::Internal("Failed to get stdout".to_string()))?;
        let mut child_stderr = child
            .stderr
            .take()
            .ok_or_else(|| CliError::Internal("Failed to get stderr".to_string()))?;

        // Create channels for coordination
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<Vec<u8>>(100);
        let (exit_tx, mut exit_rx) = mpsc::channel::<()>(1);

        // Spawn stdin reader task
        let stdin_task = tokio::spawn(async move {
            let stdin = tokio::io::stdin();
            let mut stdin = stdin;
            let mut buf = [0u8; 1024];
            loop {
                match stdin.read(&mut buf).await {
                    Ok(0) => {
                        // EOF
                        let _ = exit_tx.send(()).await;
                        break;
                    }
                    Ok(n) => {
                        if stdin_tx.send(buf[..n].to_vec()).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn stdout forwarder
        let stdout_task = tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            loop {
                match child_stdout.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let _ = tokio::io::stdout().write_all(&buf[..n]).await;
                        let _ = tokio::io::stdout().flush().await;
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn stderr forwarder
        let stderr_task = tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            loop {
                match child_stderr.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let _ = tokio::io::stderr().write_all(&buf[..n]).await;
                        let _ = tokio::io::stderr().flush().await;
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn stdin forwarder
        let stdin_forward_task = tokio::spawn(async move {
            while let Some(data) = stdin_rx.recv().await {
                if child_stdin.write_all(&data).await.is_err() {
                    break;
                }
                if child_stdin.flush().await.is_err() {
                    break;
                }
            }
        });

        // Wait for child to exit or signal
        let status = tokio::select! {
            status = child.wait() => status,
            _ = tokio::signal::ctrl_c() => {
                let _ = kill(Pid::from_raw(child_id), Signal::SIGTERM);
                child.wait().await
            }
            _ = exit_rx.recv() => {
                child.wait().await
            }
        };

        // Cleanup tasks
        drop(stdin_task);
        drop(stdout_task);
        drop(stderr_task);
        drop(stdin_forward_task);

        match status {
            Ok(status) => {
                if status.success() {
                    Ok(())
                } else {
                    Err(CliError::ExecutionFailed {
                        message: "Shell exited with error".to_string(),
                        exit_code: status.code().unwrap_or(1),
                    })
                }
            }
            Err(e) => Err(CliError::Io(e)),
        }
    }

    /// Forward data between PTY and user terminal
    async fn forward_pty(
        &self,
        master_fd: RawFd,
        child_pid: Pid,
        original_termios: &Option<Termios>,
    ) -> Result<()> {
        // Create async read/write halves using a different approach
        // Since tokio::fs::File doesn't have into_split, we use the blocking std::fs::File
        // in a spawn_blocking context
        let master_file = Arc::new(std::sync::Mutex::new(unsafe {
            std::fs::File::from_raw_fd(master_fd)
        }));

        // Get stdin/stdout
        let stdin = tokio::io::stdin();
        let stdout = tokio::io::stdout();

        let mut stdin = stdin;
        let mut stdout = stdout;

        // Channel for terminal resize events
        let (resize_tx, mut resize_rx) = mpsc::channel::<(u16, u16)>(10);

        // Spawn resize handler
        let resize_task = tokio::spawn(async move {
            let term = Term::stdout();
            loop {
                sleep(Duration::from_millis(100)).await;
                let new_size = term.size();
                if resize_tx.send(new_size).await.is_err() {
                    break;
                }
            }
        });

        // Spawn signal handler for SIGWINCH (window change)
        let mut sigwinch = signal(SignalKind::window_change())
            .map_err(|e| CliError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        // Channel for PTY output
        let (pty_tx, mut pty_rx) = mpsc::channel::<Vec<u8>>(100);
        let master_file_clone = Arc::clone(&master_file);

        // Spawn PTY reader task
        let pty_reader_task = tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                let n = {
                    let mut file = master_file_clone.lock().unwrap();
                    match file.read(&mut buf) {
                        Ok(n) => n,
                        Err(e) => {
                            if e.kind() != std::io::ErrorKind::WouldBlock {
                                break;
                            }
                            continue;
                        }
                    }
                };
                if n == 0 {
                    break;
                }
                if pty_tx.blocking_send(buf[..n].to_vec()).is_err() {
                    break;
                }
            }
        });

        // Buffer for reading
        let mut buf = [0u8; 4096];
        let mut last_size = (0u16, 0u16);

        loop {
            select! {
                // Read from stdin and write to PTY master
                result = stdin.read(&mut buf) => {
                    match result {
                        Ok(0) => {
                            // EOF - send EOF to PTY
                            debug!("Stdin EOF received");
                            break;
                        }
                        Ok(n) => {
                            // Check for Ctrl+D (ASCII 4)
                            if buf[..n].contains(&4) {
                                debug!("Ctrl+D received");
                                break;
                            }

                            // Write to PTY
                            let data = buf[..n].to_vec();
                            let master_file_write = Arc::clone(&master_file);
                            let _ = tokio::task::spawn_blocking(move || {
                                let mut file = master_file_write.lock().unwrap();
                                let _ = file.write_all(&data);
                                let _ = file.flush();
                            }).await;
                        }
                        Err(e) => {
                            error!("Stdin read error: {}", e);
                            break;
                        }
                    }
                }

                // Read from PTY master and write to stdout
                Some(data) = pty_rx.recv() => {
                    if stdout.write_all(&data).await.is_err() {
                        break;
                    }
                    if stdout.flush().await.is_err() {
                        break;
                    }
                }

                // Handle Ctrl+C
                _ = tokio::signal::ctrl_c() => {
                    debug!("Ctrl+C received, forwarding to shell");
                    // Send SIGINT to the shell process group
                    let _ = kill(child_pid, Signal::SIGINT);
                    continue;
                }

                // Handle window resize
                _ = sigwinch.recv() => {
                    let term = Term::stdout();
                    let (rows, cols) = term.size();
                    if let Err(e) = set_pty_size(master_fd, rows, cols) {
                        warn!("Failed to set PTY size: {}", e);
                    }
                }

                // Periodic resize check
                Some(size) = resize_rx.recv() => {
                    if size != last_size {
                        last_size = size;
                        if let Err(e) = set_pty_size(master_fd, size.0, size.1) {
                            warn!("Failed to set PTY size: {}", e);
                        }
                    }
                }

                // Check if child process has exited
                _ = sleep(Duration::from_millis(50)) => {
                    match waitpid(Some(child_pid), Some(nix::sys::wait::WaitPidFlag::WNOHANG)) {
                        Ok(nix::sys::wait::WaitStatus::Exited(_, _)) => {
                            debug!("Child process exited");
                            break;
                        }
                        Ok(nix::sys::wait::WaitStatus::Signaled(_, _, _)) => {
                            debug!("Child process terminated by signal");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }

        drop(resize_task);
        drop(pty_reader_task);

        // Send SIGHUP to child to gracefully terminate
        let _ = kill(child_pid, Signal::SIGHUP);

        Ok(())
    }

    /// Setup the shell process in the child after fork (MUST be called in child only)
    unsafe fn setup_shell_process(&self, slave_fd: RawFd, shell_path: &str) -> ! {
        // Create new session
        if let Err(e) = setsid() {
            eprintln!("Failed to create session: {}", e);
            std::process::exit(1);
        }

        // Duplicate slave fd to stdin, stdout, stderr
        if dup2(slave_fd, nix::libc::STDIN_FILENO).is_err()
            || dup2(slave_fd, nix::libc::STDOUT_FILENO).is_err()
            || dup2(slave_fd, nix::libc::STDERR_FILENO).is_err()
        {
            eprintln!("Failed to duplicate PTY slave");
            std::process::exit(1);
        }

        // Close the original slave fd if it's not one of the std fds
        if slave_fd > nix::libc::STDERR_FILENO {
            let _ = close(slave_fd);
        }

        // Set up environment
        std::env::set_var("A2R_SHELL", "1");
        std::env::set_var(
            "TERM",
            std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".to_string()),
        );

        // Execute shell
        let shell = std::ffi::CString::new(shell_path).expect("Invalid shell path");
        let arg0 = std::ffi::CString::new("-".to_string() + &self.shell)
            .expect("Invalid shell name");

        match nix::unistd::execvp(&shell, &[arg0]) {
            Ok(_) => std::process::exit(0),
            Err(e) => {
                eprintln!("Failed to exec shell: {}", e);
                std::process::exit(1);
            }
        }
    }

    /// Resolve shell path from shell name
    fn resolve_shell_path(&self) -> Result<String> {
        // If it's already a path, use it
        if self.shell.contains('/') {
            return Ok(self.shell.clone());
        }

        // Try to find in PATH
        let shells = vec![&self.shell[..], "bash", "zsh", "sh"];

        for shell in shells {
            if let Ok(output) = std::process::Command::new("which").arg(shell).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Ok(path);
                    }
                }
            }
        }

        // Fallback to common paths
        let common_paths = [
            "/bin/bash",
            "/usr/bin/bash",
            "/bin/zsh",
            "/usr/bin/zsh",
            "/bin/sh",
            "/usr/bin/sh",
        ];

        for path in &common_paths {
            if std::path::Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }

        Err(CliError::ExecutionFailed {
            message: format!("Shell '{}' not found", self.shell),
            exit_code: 1,
        })
    }
}

// Import Arc and Mutex for the PTY forwarding
use std::sync::Arc;
use std::sync::Mutex;

/// Set raw mode on stdin for PTY forwarding
fn set_raw_mode() -> Result<()> {
    let fd = nix::libc::STDIN_FILENO;
    let mut termios = tcgetattr(unsafe { BorrowedFd::borrow_raw(fd) }).map_err(|e| {
        CliError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("tcgetattr failed: {}", e),
        ))
    })?;

    // Set raw mode
    nix::sys::termios::cfmakeraw(&mut termios);

    tcsetattr(unsafe { BorrowedFd::borrow_raw(fd) }, SetArg::TCSANOW, &termios).map_err(|e| {
        CliError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("tcsetattr failed: {}", e),
        ))
    })?;

    Ok(())
}

/// Restore terminal settings
fn restore_terminal(original: &Option<Termios>) {
    let fd = nix::libc::STDIN_FILENO;
    if let Some(termios) = original {
        let _ = tcsetattr(unsafe { BorrowedFd::borrow_raw(fd) }, SetArg::TCSANOW, termios);
    }
}

/// Set non-blocking mode on a file descriptor
fn set_nonblocking(fd: RawFd) -> Result<()> {
    let flags = fcntl(fd, FcntlArg::F_GETFL).map_err(|e| {
        CliError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("fcntl F_GETFL failed: {}", e),
        ))
    })?;

    let flags = OFlag::from_bits_truncate(flags) | OFlag::O_NONBLOCK;

    fcntl(fd, FcntlArg::F_SETFL(flags)).map_err(|e| {
        CliError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("fcntl F_SETFL failed: {}", e),
        ))
    })?;

    Ok(())
}

/// Set PTY window size using TIOCSWINSZ ioctl
fn set_pty_size(fd: RawFd, rows: u16, cols: u16) -> Result<()> {
    let winsize = nix::pty::Winsize {
        ws_row: rows,
        ws_col: cols,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };

    let result = unsafe { nix::libc::ioctl(fd, nix::libc::TIOCSWINSZ, &winsize) };

    if result < 0 {
        Err(CliError::Io(std::io::Error::last_os_error()))
    } else {
        Ok(())
    }
}

// atty crate replacement for checking if we have a TTY
mod atty {
    pub enum Stream {
        Stdout,
        Stderr,
        Stdin,
    }

    pub fn is(stream: Stream) -> bool {
        let fd = match stream {
            Stream::Stdout => nix::libc::STDOUT_FILENO,
            Stream::Stderr => nix::libc::STDERR_FILENO,
            Stream::Stdin => nix::libc::STDIN_FILENO,
        };
        unsafe { nix::libc::isatty(fd) != 0 }
    }
}
