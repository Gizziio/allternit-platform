//! allternit-mux CLI: daemon (`serve`) plus session/pane/agent control.

use allternit_mux::api::ApiServer;
use allternit_mux::client::Client;
use allternit_mux::events::EventBus;
use allternit_mux::session::SessionStore;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde_json::json;
use std::io::Write as IoWrite;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "allternit-mux", about = "Unified agent terminal multiplexer")]
struct Cli {
    /// Override the mux socket path (default: ~/.allternit/mux/mux.sock).
    #[arg(long, global = true)]
    socket: Option<PathBuf>,
    /// Override the mux state dir (default: ~/.allternit/mux).
    #[arg(long, global = true)]
    state_dir: Option<PathBuf>,
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Run the multiplexer daemon.
    Serve,
    /// Manage sessions.
    Session {
        #[command(subcommand)]
        cmd: SessionCmd,
    },
    /// Manage panes.
    Pane {
        #[command(subcommand)]
        cmd: PaneCmd,
    },
    /// Inspect agents.
    Agent {
        #[command(subcommand)]
        cmd: AgentCmd,
    },
    /// Attach this terminal to a pane (detach: ctrl-b q).
    Attach { pane_id: String },
    /// Block until a pane's agent reaches a state.
    Wait {
        pane_id: String,
        #[arg(long)]
        status: String,
        #[arg(long, default_value_t = 3600)]
        timeout_secs: u64,
    },
    /// Block until a file exists (orchestrator sentinel watch).
    WaitFile {
        path: String,
        #[arg(long, default_value_t = 3600)]
        timeout_secs: u64,
    },
    /// Ask the daemon to stop.
    Stop,
}

#[derive(Subcommand)]
enum SessionCmd {
    Create {
        #[arg(long)]
        label: Option<String>,
        #[arg(long)]
        cwd: Option<String>,
    },
    List,
    Close { session_id: String },
}

#[derive(Subcommand)]
enum PaneCmd {
    Split {
        session_id: String,
        #[arg(long, default_value = "right")]
        direction: String,
        #[arg(long)]
        ratio: Option<f32>,
    },
    Create { session_id: String },
    List { session_id: String },
    Run {
        pane_id: String,
        /// Environment variables (KEY=VAL, repeatable).
        #[arg(long = "env", value_name = "KEY=VAL")]
        env: Vec<String>,
        /// Command to run (pass after `--` if it has flags).
        #[arg(trailing_var_arg = true, allow_hyphen_values = true, required = true)]
        command: Vec<String>,
    },
    Read {
        pane_id: String,
        #[arg(long)]
        lines: Option<usize>,
        /// scrollback (raw bytes) or screen (rendered terminal).
        #[arg(long, default_value = "scrollback")]
        source: String,
    },
    Send {
        pane_id: String,
        text: String,
        /// Confirm the text renders on screen before sending Enter.
        #[arg(long)]
        verified: bool,
    },
    Resize {
        pane_id: String,
        #[arg(long, default_value_t = 80)]
        cols: u16,
        #[arg(long, default_value_t = 24)]
        rows: u16,
    },
    Close { pane_id: String },
}

#[derive(Subcommand)]
enum AgentCmd {
    List,
    State { pane_id: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "allternit_mux=info".into()),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();
    let state_dir = cli.state_dir.unwrap_or_else(allternit_mux::state_dir);
    let socket = cli.socket.unwrap_or_else(|| {
        // Env override (ALLTERNIT_MUX_SOCKET) wins via socket_path(); else <state>/mux.sock.
        if std::env::var_os("ALLTERNIT_MUX_SOCKET").is_some() {
            allternit_mux::socket_path()
        } else {
            state_dir.join("mux.sock")
        }
    });

    if matches!(cli.command, Cmd::Serve) {
        return serve(state_dir, socket).await;
    }

    let mut client = Client::connect(&socket)
        .await
        .context("is `allternit-mux serve` running?")?;

    match cli.command {
        Cmd::Serve => unreachable!(),
        Cmd::Stop => {
            print_json(client.request("server.stop", json!({})).await?);
        }
        Cmd::Session { cmd } => match cmd {
            SessionCmd::Create { label, cwd } => {
                let out = client
                    .request(
                        "session.create",
                        json!({ "label": label, "cwd": cwd }),
                    )
                    .await?;
                print_json(out);
            }
            SessionCmd::List => {
                print_json(client.request("session.list", json!({})).await?);
            }
            SessionCmd::Close { session_id } => {
                print_json(
                    client
                        .request("session.close", json!({ "session_id": session_id }))
                        .await?,
                );
            }
        },
        Cmd::Pane { cmd } => match cmd {
            PaneCmd::Split {
                session_id,
                direction,
                ratio,
            } => {
                print_json(
                    client
                        .request(
                            "pane.split",
                            json!({
                                "session_id": session_id,
                                "direction": direction,
                                "ratio": ratio,
                            }),
                        )
                        .await?,
                );
            }
            PaneCmd::Create { session_id } => {
                print_json(
                    client
                        .request("pane.create", json!({ "session_id": session_id }))
                        .await?,
                );
            }
            PaneCmd::List { session_id } => {
                print_json(
                    client
                        .request("pane.list", json!({ "session_id": session_id }))
                        .await?,
                );
            }
            PaneCmd::Run {
                pane_id,
                env,
                command,
            } => {
                // Send argv verbatim — the server never re-splits a joined string.
                let env_map: serde_json::Map<String, serde_json::Value> = env
                    .iter()
                    .filter_map(|kv| {
                        kv.split_once('=')
                            .map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_string())))
                    })
                    .collect();
                print_json(
                    client
                        .request(
                            "pane.run",
                            json!({ "pane_id": pane_id, "command": command, "env": env_map }),
                        )
                        .await?,
                );
            }
            PaneCmd::Read {
                pane_id,
                lines,
                source,
            } => {
                let out = client
                    .request(
                        "pane.read",
                        json!({ "pane_id": pane_id, "lines": lines, "source": source }),
                    )
                    .await?;
                if let Some(text) = out.get("output").and_then(|v| v.as_str()) {
                    print!("{text}");
                }
            }
            PaneCmd::Send {
                pane_id,
                text,
                verified,
            } => {
                if verified {
                    print_json(
                        client
                            .request(
                                "pane.send_verified",
                                json!({ "pane_id": pane_id, "data": text }),
                            )
                            .await?,
                    );
                } else {
                    print_json(
                        client
                            .request(
                                "pane.send_input",
                                json!({ "pane_id": pane_id, "data": format!("{text}\n") }),
                            )
                            .await?,
                    );
                }
            }
            PaneCmd::Resize {
                pane_id,
                cols,
                rows,
            } => {
                print_json(
                    client
                        .request(
                            "pane.resize",
                            json!({ "pane_id": pane_id, "cols": cols, "rows": rows }),
                        )
                        .await?,
                );
            }
            PaneCmd::Close { pane_id } => {
                print_json(
                    client
                        .request("pane.close", json!({ "pane_id": pane_id }))
                        .await?,
                );
            }
        },
        Cmd::Agent { cmd } => match cmd {
            AgentCmd::List => {
                print_json(client.request("agent.list", json!({})).await?);
            }
            AgentCmd::State { pane_id } => {
                print_json(
                    client
                        .request("agent.state", json!({ "pane_id": pane_id }))
                        .await?,
                );
            }
        },
        Cmd::Wait {
            pane_id,
            status,
            timeout_secs,
        } => {
            wait_for(&mut client, &pane_id, &status, timeout_secs).await?;
        }
        Cmd::WaitFile { path, timeout_secs } => {
            let out = client
                .request(
                    "wait.file",
                    json!({ "path": path, "timeout_ms": timeout_secs * 1000 }),
                )
                .await?;
            if out.get("found").and_then(|v| v.as_bool()) == Some(true) {
                println!("{path}");
            } else {
                anyhow::bail!("timeout waiting for file: {path}");
            }
        }
        Cmd::Attach { pane_id } => {
            attach(socket.clone(), pane_id).await?;
        }
    }
    Ok(())
}

async fn serve(state_dir: PathBuf, socket: PathBuf) -> Result<()> {
    let bus = EventBus::new();
    let store = SessionStore::load(state_dir, bus.clone()).await?;
    let server = ApiServer::new(store, bus, socket);
    let shutdown = server.shutdown_handle();

    // Graceful SIGINT/SIGTERM.
    tokio::spawn(async move {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let mut term = signal(SignalKind::terminate()).expect("sigterm");
            let mut int = signal(SignalKind::interrupt()).expect("sigint");
            tokio::select! {
                _ = term.recv() => {},
                _ = int.recv() => {},
            }
            shutdown.notify_waiters();
        }
    });

    server.serve().await
}

async fn wait_for(client: &mut Client, pane_id: &str, status: &str, timeout_secs: u64) -> Result<()> {
    let deadline = std::time::Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        let out = client
            .request("agent.state", json!({ "pane_id": pane_id }))
            .await?;
        let current = out
            .get("agent")
            .and_then(|a| a.get("state"))
            .and_then(|s| s.as_str())
            .unwrap_or("unknown");
        if current == status {
            println!("{status}");
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            anyhow::bail!("timeout waiting for {pane_id} to reach {status} (last: {current})");
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// Attach: replay scrollback, stream live output, forward stdin.
/// Detach with ctrl-b q.
async fn attach(socket: PathBuf, pane_id: String) -> Result<()> {
    let mut events = Client::connect(&socket).await?;

    // Replay existing scrollback.
    let out = events
        .request("pane.read", json!({ "pane_id": pane_id }))
        .await?;
    let mut stdout = std::io::stdout();
    if let Some(text) = out.get("output").and_then(|v| v.as_str()) {
        stdout.write_all(text.as_bytes())?;
        stdout.flush()?;
    }

    events.subscribe(&["pane.output", "pane.exited"]).await?;

    // Raw mode so keystrokes go straight through.
    let _raw = RawModeGuard::new();

    // Input forwarding on a second connection.
    let input_pane = pane_id.clone();
    let input_socket = socket.clone();
    let (stdin_done_tx, mut stdin_done_rx) = tokio::sync::mpsc::channel::<()>(1);
    let input_handle = tokio::spawn(async move {
        let Ok(mut input) = Client::connect(&input_socket).await else {
            let _ = stdin_done_tx.send(()).await;
            return;
        };
        use tokio::io::AsyncReadExt;
        let mut stdin = tokio::io::stdin();
        let mut buf = [0u8; 1024];
        let mut pending_break = false;
        loop {
            let Ok(n) = stdin.read(&mut buf).await else { break };
            if n == 0 {
                break; // stdin EOF
            }
            let mut data = Vec::with_capacity(n);
            for &b in &buf[..n] {
                // Detach sequence: ctrl-b q
                if pending_break {
                    pending_break = false;
                    if b == b'q' {
                        let _ = stdin_done_tx.send(()).await;
                        return;
                    }
                    data.push(0x02);
                }
                if b == 0x02 {
                    pending_break = true;
                    continue;
                }
                data.push(b);
            }
            if !data.is_empty() {
                let s = String::from_utf8_lossy(&data).to_string();
                if input
                    .request(
                        "pane.send_input",
                        json!({ "pane_id": input_pane, "data": s }),
                    )
                    .await
                    .is_err()
                {
                    break;
                }
            }
        }
        let _ = stdin_done_tx.send(()).await;
    });

    // Output streaming.
    let mut done = false;
    while !done {
        tokio::select! {
            _ = stdin_done_rx.recv() => { done = true; }
            ev = events.next_event() => {
                match ev {
                    Ok(ev) => {
                        if ev.pane_id.as_deref() == Some(&pane_id) {
                            match ev.kind.as_str() {
                                "pane.output" => {
                                    if let Some(d) = ev.data.get("data").and_then(|v| v.as_str()) {
                                        let _ = stdout.write_all(d.as_bytes());
                                        let _ = stdout.flush();
                                    }
                                }
                                "pane.exited" => {
                                    let code = ev.data.get("exit_code").cloned().unwrap_or(json!(-1));
                                    let _ = writeln!(stdout, "\r\n[pane exited: {code}]");
                                    done = true;
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(_) => done = true,
                }
            }
        }
    }
    input_handle.abort();
    Ok(())
}

fn print_json(v: serde_json::Value) {
    println!("{}", serde_json::to_string_pretty(&v).unwrap());
}

/// RAII guard for terminal raw mode (Unix).
struct RawModeGuard {
    saved: Option<libc::termios>,
}

impl RawModeGuard {
    fn new() -> Self {
        unsafe {
            let mut tio: libc::termios = std::mem::zeroed();
            if libc::tcgetattr(libc::STDIN_FILENO, &mut tio) != 0 {
                return Self { saved: None };
            }
            let saved = tio;
            let mut raw = tio;
            libc::cfmakeraw(&mut raw);
            if libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &raw) != 0 {
                return Self { saved: None };
            }
            Self { saved: Some(saved) }
        }
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        if let Some(tio) = &self.saved {
            unsafe {
                libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, tio);
            }
        }
    }
}
