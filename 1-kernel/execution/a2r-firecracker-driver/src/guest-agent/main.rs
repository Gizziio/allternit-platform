//! # A2R Guest Agent
//!
//! Runs inside Firecracker MicroVMs to provide:
//! - Command execution
//! - Log streaming
//! - Artifact retrieval
//! - Resource metrics
//!
//! Communicates with the host via VSOCK.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::os::unix::net::UnixListener;
use std::process::{Command, Stdio};
use std::time::Instant;

/// Agent version - matches the protocol version expected by the driver
const AGENT_VERSION: &str = "1.0.0";

/// Track agent start time for uptime calculation
static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

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
    
    eprintln!("A2R Guest Agent v{} starting...", AGENT_VERSION);

    // VSOCK socket path (provided by Firecracker)
    let vsock_path = std::env::var("A2R_VSOCK_PATH")
        .unwrap_or_else(|_| "/dev/vsock".to_string());

    // CID 3 is the host
    let listen_addr = format!("{}:52", vsock_path);

    eprintln!("Listening on: {}", listen_addr);

    // Remove old socket if exists
    let _ = std::fs::remove_file(&listen_addr);

    let listener = match UnixListener::bind(&listen_addr) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to {}: {}", listen_addr, e);
            std::process::exit(1);
        }
    };

    eprintln!("Guest agent ready");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                if let Err(e) = handle_connection(&mut stream) {
                    eprintln!("Connection error: {}", e);
                }
            }
            Err(e) => {
                eprintln!("Connection failed: {}", e);
            }
        }
    }
}

fn handle_connection(stream: &mut std::os::unix::net::UnixStream) -> Result<(), Box<dyn std::error::Error>> {
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
    };

    send_response(stream, &response)?;
    Ok(())
}

fn send_response(stream: &mut std::os::unix::net::UnixStream, response: &GuestResponse) -> Result<(), Box<dyn std::error::Error>> {
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
