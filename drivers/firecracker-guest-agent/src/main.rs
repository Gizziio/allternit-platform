//! # Allternit Guest Agent
//!
//! Runs inside Firecracker MicroVMs to provide:
//! - Command execution
//! - Log streaming
//! - Artifact retrieval
//! - Resource metrics
//! - Virtual display (Xvnc) lifecycle, tunneled over a second vsock port
//!
//! Communicates with the host via VSOCK (AF_VSOCK, not a Unix socket path --
//! see `main()` for why the original UnixListener-at-a-device-path approach
//! here was wrong and has been replaced with the `vsock` crate's real
//! AF_VSOCK bind).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use vsock::{VsockListener, VsockStream, VMADDR_CID_ANY};

/// Agent version - matches the protocol version expected by the driver
const AGENT_VERSION: &str = "1.0.0";

/// Well-known vsock port this agent listens on for RPC. Matches the port
/// the host driver's `exec_in_vm`/`GuestAgentMonitor` connect to (see
/// `drivers/firecracker/src/lib.rs`'s `vsock_port_start = 10000`).
const AGENT_VSOCK_PORT: u32 = 10000;

/// Xvnc's local TCP port inside the guest (loopback-only; nothing needs
/// guest networking since the vsock forwarding thread bridges this to the
/// host, not a virtio-net device).
const XVNC_LOCAL_PORT: u16 = 5900;

/// Vsock port the display tunnel binds to. Fixed rather than dynamically
/// allocated -- there is exactly one display session per VM, so there is
/// nothing to disambiguate.
const DISPLAY_VNC_VSOCK_PORT: u32 = 10001;

/// Track agent start time for uptime calculation
static START_TIME: OnceLock<Instant> = OnceLock::new();

/// Live display session (Xvnc + WM child processes, forwarding thread vsock
/// port). None when no display is running. Guarded by a mutex since requests
/// are handled on a per-connection thread (see `main()`).
struct DisplaySession {
    xvnc: Child,
    window_manager: Option<Child>,
    vnc_vsock_port: u32,
    forward_thread: std::thread::JoinHandle<()>,
}

static DISPLAY: Mutex<Option<DisplaySession>> = Mutex::new(None);

/// Request types from host
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum HostRequest {
    #[serde(rename = "execute")]
    Execute {
        command: Vec<String>,
        env_vars: HashMap<String, String>,
        working_dir: Option<String>,
        stdin_data: Option<Vec<u8>>,
    },
    #[serde(rename = "get_logs")]
    GetLogs { since: Option<String> },
    #[serde(rename = "get_artifacts")]
    GetArtifacts { paths: Vec<String> },
    #[serde(rename = "get_metrics")]
    GetMetrics,
    /// Ping for health check
    #[serde(rename = "ping")]
    Ping { version: String },
    /// Start a virtual display (Xvnc) and tunnel it over a new vsock port.
    #[serde(rename = "start_display")]
    StartDisplay { width: u32, height: u32 },
    /// Stop the virtual display and its vsock tunnel.
    #[serde(rename = "stop_display")]
    StopDisplay,
}

/// Response types to host
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum GuestResponse {
    #[serde(rename = "execute_result")]
    ExecuteResult {
        exit_code: i32,
        stdout: Option<Vec<u8>>,
        stderr: Option<Vec<u8>>,
        duration_ms: u64,
    },
    #[serde(rename = "logs")]
    Logs { entries: Vec<LogEntry> },
    #[serde(rename = "artifacts")]
    Artifacts { artifacts: Vec<ArtifactInfo> },
    #[serde(rename = "metrics")]
    Metrics {
        cpu_usage_percent: f64,
        memory_used_mib: u64,
        disk_used_mib: u64,
    },
    #[serde(rename = "error")]
    Error { message: String },
    /// Pong response to ping
    #[serde(rename = "pong")]
    Pong { version: String, uptime_secs: u64 },
    /// Display started -- the host should tunnel a VNC client to this vsock port.
    #[serde(rename = "display_started")]
    DisplayStarted { vnc_vsock_port: u32 },
    /// Display stopped.
    #[serde(rename = "display_stopped")]
    DisplayStopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LogEntry {
    timestamp: String,
    stream: String,
    data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ArtifactInfo {
    path: String,
    size: u64,
    hash: String,
}

fn main() {
    // Record start time for uptime calculation
    let _ = START_TIME.set(Instant::now());

    eprintln!("Allternit Guest Agent v{} starting...", AGENT_VERSION);

    // Real AF_VSOCK bind, not a UnixListener at a device path (the previous
    // approach here -- `UnixListener::bind("/dev/vsock:52")` -- doesn't
    // correspond to how Linux AF_VSOCK actually works; a guest binds
    // (VMADDR_CID_ANY, port) via the vsock socket family directly).
    let listener = match VsockListener::bind_with_cid_port(VMADDR_CID_ANY, AGENT_VSOCK_PORT) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind vsock port {}: {}", AGENT_VSOCK_PORT, e);
            std::process::exit(1);
        }
    };

    eprintln!("Listening on vsock port {}", AGENT_VSOCK_PORT);
    eprintln!("Guest agent ready");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                // One thread per connection: a StartDisplay session must not
                // block subsequent Execute/StopDisplay requests on other
                // connections, and each request here is one connection
                // (matches how the host driver's exec_in_vm already dials a
                // fresh connection per call).
                std::thread::spawn(move || {
                    if let Err(e) = handle_connection(&mut stream) {
                        eprintln!("Connection error: {}", e);
                    }
                });
            }
            Err(e) => {
                eprintln!("Connection failed: {}", e);
            }
        }
    }
}

fn handle_connection(stream: &mut VsockStream) -> Result<(), Box<dyn std::error::Error>> {
    // Read message length (4 bytes, big-endian)
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf)?;
    let msg_len = u32::from_be_bytes(len_buf) as usize;

    // Read message
    let mut msg_buf = vec![0u8; msg_len];
    stream.read_exact(&mut msg_buf)?;

    // Parse request
    let request: HostRequest = match serde_json::from_slice(&msg_buf) {
        Ok(r) => r,
        Err(e) => {
            let response = GuestResponse::Error {
                message: format!("Failed to parse request: {}", e),
            };
            send_response(stream, &response)?;
            return Ok(());
        }
    };

    // Handle request
    let response = match request {
        HostRequest::Execute { command, env_vars, working_dir, stdin_data } => {
            handle_execute(command, env_vars, working_dir, stdin_data)
        }
        HostRequest::GetLogs { since } => {
            handle_get_logs(since)
        }
        HostRequest::GetArtifacts { paths } => {
            handle_get_artifacts(paths)
        }
        HostRequest::GetMetrics => {
            handle_get_metrics()
        }
        HostRequest::Ping { version } => {
            handle_ping(version)
        }
        HostRequest::StartDisplay { width, height } => {
            handle_start_display(width, height)
        }
        HostRequest::StopDisplay => {
            handle_stop_display()
        }
    };

    send_response(stream, &response)?;
    Ok(())
}

fn send_response(stream: &mut VsockStream, response: &GuestResponse) -> Result<(), Box<dyn std::error::Error>> {
    let response_json = serde_json::to_vec(response)?;
    let len = response_json.len() as u32;
    
    stream.write_all(&len.to_be_bytes())?;
    stream.write_all(&response_json)?;
    stream.flush()?;
    
    Ok(())
}

fn handle_execute(
    command: Vec<String>,
    env_vars: HashMap<String, String>,
    working_dir: Option<String>,
    stdin_data: Option<Vec<u8>>,
) -> GuestResponse {
    let start = Instant::now();

    if command.is_empty() {
        return GuestResponse::Error {
            message: "Empty command".to_string(),
        };
    }

    let mut cmd = Command::new(&command[0]);
    cmd.args(&command[1..]);

    // Set environment variables
    for (key, value) in env_vars {
        cmd.env(key, value);
    }

    // Set working directory
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Set up pipes
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return GuestResponse::Error {
                message: format!("Failed to spawn process: {}", e),
            };
        }
    };

    // Write stdin if provided
    if let Some(data) = stdin_data {
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(&data);
        }
    }

    // Wait for completion
    let output = match child.wait_with_output() {
        Ok(o) => o,
        Err(e) => {
            return GuestResponse::Error {
                message: format!("Failed to get output: {}", e),
            };
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;

    GuestResponse::ExecuteResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: if output.stdout.is_empty() { None } else { Some(output.stdout) },
        stderr: if output.stderr.is_empty() { None } else { Some(output.stderr) },
        duration_ms,
    }
}

fn handle_get_logs(_since: Option<String>) -> GuestResponse {
    // TODO: Implement log collection from /var/log or journald
    GuestResponse::Logs {
        entries: vec![],
    }
}

fn handle_get_artifacts(paths: Vec<String>) -> GuestResponse {
    let mut artifacts = vec![];

    for path in paths {
        match std::fs::metadata(&path) {
            Ok(metadata) => {
                if metadata.is_file() {
                    // Calculate hash
                    let hash = match std::fs::read(&path) {
                        Ok(data) => {
                            blake3::hash(&data).to_hex().to_string()
                        }
                        Err(_) => "error".to_string(),
                    };

                    artifacts.push(ArtifactInfo {
                        path,
                        size: metadata.len(),
                        hash,
                    });
                }
            }
            Err(_) => continue,
        }
    }

    GuestResponse::Artifacts { artifacts }
}

fn handle_get_metrics() -> GuestResponse {
    // Read memory info from /proc
    let memory_used_mib = read_memory_usage();
    
    // Read disk usage
    let disk_used_mib = read_disk_usage();

    // CPU usage is harder in a VM - we'd need to track over time
    let cpu_usage_percent = 0.0;

    GuestResponse::Metrics {
        cpu_usage_percent,
        memory_used_mib,
        disk_used_mib,
    }
}

fn read_memory_usage() -> u64 {
    // Parse /proc/meminfo
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if line.starts_with("Active:") {
                // Format: "Active:      123456 kB"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    if let Ok(kb) = parts[1].parse::<u64>() {
                        return kb / 1024; // Convert to MiB
                    }
                }
            }
        }
    }
    0
}

fn read_disk_usage() -> u64 {
    // Use df command to get disk usage
    if let Ok(output) = Command::new("df").args(&["-B1", "/"]).output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                if let Ok(used) = parts[2].parse::<u64>() {
                    return used / (1024 * 1024); // Convert to MiB
                }
            }
        }
    }
    0
}

fn handle_ping(driver_version: String) -> GuestResponse {
    // Calculate uptime since agent start
    let uptime_secs = START_TIME
        .get()
        .map(|start| start.elapsed().as_secs())
        .unwrap_or(0);
    
    // Log the ping for debugging (only in debug builds to avoid noise)
    #[cfg(debug_assertions)]
    eprintln!(
        "Received ping from driver version {}, responding with version {} (uptime: {}s)",
        driver_version, AGENT_VERSION, uptime_secs
    );
    
    GuestResponse::Pong {
        version: AGENT_VERSION.to_string(),
        uptime_secs,
    }
}

/// Start Xvnc (both the X server and the VNC server in one process) plus a
/// best-effort window manager, then bridge a dedicated vsock port to Xvnc's
/// local RFB port. Idempotent -- a second StartDisplay while one is already
/// running just returns the existing session's port.
fn handle_start_display(width: u32, height: u32) -> GuestResponse {
    let mut display = DISPLAY.lock().unwrap();
    if let Some(session) = display.as_ref() {
        return GuestResponse::DisplayStarted {
            vnc_vsock_port: session.vnc_vsock_port,
        };
    }

    let geometry = format!("{}x{}x24", width.max(640), height.max(480));
    let mut xvnc = match Command::new("Xvnc")
        .args([
            ":0",
            "-SecurityTypes",
            "None",
            "-rfbport",
            &XVNC_LOCAL_PORT.to_string(),
            "-localhost",
            "-geometry",
            &geometry,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            return GuestResponse::Error {
                message: format!("Failed to start Xvnc: {e}"),
            };
        }
    };

    // Wait for Xvnc's RFB port to come up. Fail closed rather than report a
    // display session nobody can actually reach.
    let mut ready = false;
    for _ in 0..50 {
        if TcpStream::connect(("127.0.0.1", XVNC_LOCAL_PORT)).is_ok() {
            ready = true;
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    if !ready {
        let _ = xvnc.kill();
        return GuestResponse::Error {
            message: "Xvnc did not become ready within 5s".to_string(),
        };
    }

    // Best-effort window manager: a bare Xvnc with no WM still accepts input
    // and shows whatever the driven application draws, so a missing WM
    // binary is not fatal to the display session.
    let window_manager = Command::new("fluxbox")
        .env("DISPLAY", ":0")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok();

    let vsock_listener =
        match VsockListener::bind_with_cid_port(VMADDR_CID_ANY, DISPLAY_VNC_VSOCK_PORT) {
            Ok(l) => l,
            Err(e) => {
                let _ = xvnc.kill();
                return GuestResponse::Error {
                    message: format!(
                        "Failed to bind display vsock port {DISPLAY_VNC_VSOCK_PORT}: {e}"
                    ),
                };
            }
        };

    let forward_thread = std::thread::spawn(move || {
        // Exactly one VNC client is expected per environment (the host-side
        // backend never opens more than one), so accepting serially is fine.
        for stream in vsock_listener.incoming() {
            match stream {
                Ok(vsock_stream) => forward_vnc_connection(vsock_stream),
                Err(e) => eprintln!("Display vsock accept failed: {e}"),
            }
        }
    });

    *display = Some(DisplaySession {
        xvnc,
        window_manager,
        vnc_vsock_port: DISPLAY_VNC_VSOCK_PORT,
        forward_thread,
    });

    GuestResponse::DisplayStarted {
        vnc_vsock_port: DISPLAY_VNC_VSOCK_PORT,
    }
}

/// Bidirectionally pipe raw bytes between a vsock connection (the tunnel to
/// the host's VNC client) and a local TCP connection to Xvnc -- no RFB
/// framing is parsed or altered here, so any standard RFB client library
/// works unmodified against the vsock side.
fn forward_vnc_connection(vsock_stream: VsockStream) {
    let tcp_stream = match TcpStream::connect(("127.0.0.1", XVNC_LOCAL_PORT)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to connect to local Xvnc for forwarding: {e}");
            return;
        }
    };

    let (mut vsock_read, mut vsock_write) = match vsock_stream.try_clone() {
        Ok(clone) => (clone, vsock_stream),
        Err(e) => {
            eprintln!("Failed to clone vsock stream: {e}");
            return;
        }
    };
    let (mut tcp_read, mut tcp_write) = match tcp_stream.try_clone() {
        Ok(clone) => (clone, tcp_stream),
        Err(e) => {
            eprintln!("Failed to clone tcp stream: {e}");
            return;
        }
    };

    let to_guest = std::thread::spawn(move || {
        let _ = std::io::copy(&mut vsock_read, &mut tcp_write);
    });
    let _ = std::io::copy(&mut tcp_read, &mut vsock_write);
    let _ = to_guest.join();
}

/// Stop the display session and kill Xvnc/the window manager. The
/// forwarding thread is not joined -- it's blocked in `incoming()`/
/// `io::copy` with no cancellation channel in this first cut, and it exits
/// on its own once killing Xvnc closes the TCP side it's copying to/from.
/// Not joining means StopDisplay returns promptly instead of blocking on a
/// possibly-hung client connection.
fn handle_stop_display() -> GuestResponse {
    let mut display = DISPLAY.lock().unwrap();
    if let Some(mut session) = display.take() {
        let _ = session.xvnc.kill();
        if let Some(mut wm) = session.window_manager.take() {
            let _ = wm.kill();
        }
        drop(session.forward_thread);
    }
    GuestResponse::DisplayStopped
}
