//! Allternit VM Executor
//! 
//! This binary runs INSIDE the Linux VM (Firecracker on Linux host, Apple VF on macOS host).
//! It receives commands from the host via either:
//!   - Serial port (/dev/hvc1) on Apple Virtualization.framework (preferred)
//!   - VSOCK on Firecracker / Linux hosts
//!
//! It executes commands in isolated bubblewrap sessions and returns results.
//!
//! # Naming Distinction
//! - Allternit: The AI agent system that runs on the host
//! - allternit-vm-executor: This binary (runs inside VM as a daemon)
//! - allternit-guest-agent-protocol: The protocol shared between host and VM
//!
//! # Architecture
//! ```
//! Host (macOS/Linux)
//!   └── Allternit / Allternit CLI
//!         └── Serial port (/dev/hvc1) or VSOCK connection
//!               └── VM (Linux)
//!                     └── allternit-vm-executor (this binary)
//!                           └── bubblewrap sessions
//! ```

use allternit_guest_agent_protocol::{
    CommandRequest, CommandResponse, ProtocolError, ProtocolMessage, SessionId,
};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use tokio::sync::RwLock;

use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod config;
mod sandbox;
mod session;

use config::ExecutorConfig;
use crate::config::SandboxConfig;
use sandbox::Sandbox;
use session::Session;

/// Default VSOCK port for communication with host
const DEFAULT_VSOCK_PORT: u32 = 8080;

/// Default CID for the host (VMADDR_CID_HOST = 2)
const VMADDR_CID_HOST: u32 = 2;

/// VMADDR_CID_ANY for binding listener inside VM
const VMADDR_CID_ANY: u32 = 0xFFFFFFFF;

/// Serial device path for Apple Virtualization.framework communication
const SERIAL_DEVICE_PATH: &str = "/dev/hvc1";

/// Number of retries when opening the serial device
const SERIAL_OPEN_RETRIES: u32 = 30;

/// Delay between serial open retries (ms)
const SERIAL_RETRY_DELAY_MS: u64 = 1000;

/// Executor state shared across all connections
struct ExecutorState {
    /// Active sessions by session ID
    sessions: Arc<RwLock<HashMap<SessionId, Arc<Session>>>>,
    /// Configuration
    config: ExecutorConfig,
    /// Sandbox for isolated execution
    sandbox: Arc<Sandbox>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("allternit_vm_executor=info".parse()?),
        )
        .init();

    // Also write to /dev/kmsg for early boot debugging
    let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
        .and_then(|mut f| std::io::Write::write_all(&mut f, b"[EXECUTOR] Guest agent starting\n"));
    
    info!("╔══════════════════════════════════════════════════════════╗");
    info!("║     Allternit VM Executor v{}                              ║", env!("CARGO_PKG_VERSION"));
    info!("║     Running inside VM - executing commands from host     ║");
    info!("╚══════════════════════════════════════════════════════════╝");

    // Load configuration
    let config = ExecutorConfig::load().context("Failed to load executor configuration")?;
    info!("Configuration loaded: {:?}", config);

    // Initialize sandbox environment
    let sandbox = Arc::new(
        Sandbox::new(SandboxConfig::from(&config))
            .await
            .context("Failed to initialize sandbox environment")?,
    );
    info!("Sandbox environment initialized");

    // Create executor state
    let state = Arc::new(ExecutorState {
        sessions: Arc::new(RwLock::new(HashMap::new())),
        config,
        sandbox,
    });

    // On Linux inside VM: prefer serial port for Apple VF, fallback to VSOCK
    #[cfg(target_os = "linux")]
    {
        // Try serial port first (Apple Virtualization.framework)
        if std::path::Path::new(SERIAL_DEVICE_PATH).exists() {
            info!("Serial device {} detected, attempting serial communication", SERIAL_DEVICE_PATH);
            let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
                .and_then(|mut f| std::io::Write::write_all(&mut f, format!("[EXECUTOR] Serial device {} detected\n", SERIAL_DEVICE_PATH).as_bytes()));
            match start_serial_server(state.clone()).await {
                Ok(()) => {
                    info!("Serial server exited normally");
                    return Ok(());
                }
                Err(e) => {
                    warn!("Serial server failed: {}, falling back to VSOCK", e);
                    let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
                        .and_then(|mut f| std::io::Write::write_all(&mut f, format!("[EXECUTOR] Serial server failed: {}\n", e).as_bytes()));
                }
            }
        } else {
            let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
                .and_then(|mut f| std::io::Write::write_all(&mut f, format!("[EXECUTOR] Serial device {} NOT found, using VSOCK\n", SERIAL_DEVICE_PATH).as_bytes()));
        }
        
        // Fallback to VSOCK (Firecracker / other hypervisors)
        start_vsock_server(state).await?;
    }

    #[cfg(not(target_os = "linux"))]
    {
        // For testing on non-Linux platforms, use TCP
        start_tcp_server(state).await?;
    }

    Ok(())
}

/// Start serial server (Linux only, inside VM, for Apple Virtualization.framework)
#[cfg(target_os = "linux")]
async fn start_serial_server(state: Arc<ExecutorState>) -> Result<()> {
    use std::fs::OpenOptions;
    use std::os::unix::fs::OpenOptionsExt;
    use std::os::unix::io::AsRawFd;
    use std::io::{Read, Write};
    use tokio::time::{sleep, Duration};

    info!("Waiting for serial device {} to become available...", SERIAL_DEVICE_PATH);
    
    let mut file = None;
    for attempt in 1..=SERIAL_OPEN_RETRIES {
        match OpenOptions::new()
            .read(true)
            .write(true)
            .custom_flags(libc::O_NOCTTY | libc::O_NONBLOCK)
            .open(SERIAL_DEVICE_PATH)
        {
            Ok(f) => {
                info!("Opened serial device {} on attempt {}", SERIAL_DEVICE_PATH, attempt);
                file = Some(f);
                break;
            }
            Err(e) => {
                debug!("Attempt {}: failed to open {}: {}", attempt, SERIAL_DEVICE_PATH, e);
                if attempt < SERIAL_OPEN_RETRIES {
                    sleep(Duration::from_millis(SERIAL_RETRY_DELAY_MS)).await;
                }
            }
        }
    }
    
    let mut file = file.ok_or_else(|| {
        anyhow::anyhow!("Failed to open serial device {} after {} retries", SERIAL_DEVICE_PATH, SERIAL_OPEN_RETRIES)
    })?;
    
    // Set raw mode to disable any terminal processing
    set_serial_raw_mode(&file)?;
    
    // Clear O_NONBLOCK now that we have the device
    let fd = file.as_raw_fd();
    let flags = unsafe { libc::fcntl(fd, libc::F_GETFL, 0) };
    if flags >= 0 {
        let _ = unsafe { libc::fcntl(fd, libc::F_SETFL, flags & !libc::O_NONBLOCK) };
    }
    
    info!("Serial server listening on {}", SERIAL_DEVICE_PATH);
    let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
        .and_then(|mut f| std::io::Write::write_all(&mut f, format!("[EXECUTOR] Serial server listening on {}\n", SERIAL_DEVICE_PATH).as_bytes()));

    loop {
        if let Err(e) = handle_serial_connection_sync(&mut file, state.clone()) {
            error!("Serial connection handler error: {}", e);
            let _ = std::fs::OpenOptions::new().write(true).open("/dev/kmsg")
                .and_then(|mut f| std::io::Write::write_all(&mut f, format!("[EXECUTOR] Serial handler error: {}\n", e).as_bytes()));
            sleep(Duration::from_millis(100)).await;
        }
    }
}

/// Set serial port to raw mode (disable canonical input, echo, etc.)
#[cfg(target_os = "linux")]
fn set_serial_raw_mode(file: &std::fs::File) -> Result<()> {
    use std::os::unix::io::AsRawFd;
    
    let fd = file.as_raw_fd();
    let mut termios: libc::termios = unsafe { std::mem::zeroed() };
    
    if unsafe { libc::tcgetattr(fd, &mut termios) } == 0 {
        // Save current settings and set raw mode
        let mut raw = termios;
        unsafe { libc::cfmakeraw(&mut raw) };
        raw.c_cc[libc::VMIN] = 1;
        raw.c_cc[libc::VTIME] = 0;
        
        if unsafe { libc::tcsetattr(fd, libc::TCSANOW, &raw) } != 0 {
            warn!("Failed to set serial raw mode, continuing anyway");
        } else {
            info!("Serial port set to raw mode");
        }
    } else {
        warn!("tcgetattr failed on serial device, continuing without raw mode");
    }
    
    Ok(())
}

/// Handle serial connection synchronously (Linux only)
#[cfg(target_os = "linux")]
fn handle_serial_connection_sync(
    file: &mut std::fs::File,
    state: Arc<ExecutorState>,
) -> Result<()> {
    use std::io::{Read, Write};
    
    loop {
        // Read message length (4 bytes, big-endian)
        let mut len_bytes = [0u8; 4];
        match file.read_exact(&mut len_bytes) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                info!("Serial connection closed by peer");
                break;
            }
            Err(e) => return Err(e.into()),
        }
        let msg_len = u32::from_be_bytes(len_bytes) as usize;

        // Sanity check on message length
        if msg_len > 16 * 1024 * 1024 {
            return Err(anyhow::anyhow!("Message too large: {} bytes", msg_len));
        }

        // Read message body
        let mut msg_bytes = vec![0u8; msg_len];
        file.read_exact(&mut msg_bytes)?;

        // Parse message
        let raw_json = String::from_utf8_lossy(&msg_bytes);
        eprintln!("[SERIAL] Raw message ({} bytes): {}", msg_len, raw_json);
        
        let message: ProtocolMessage = match serde_json::from_slice(&msg_bytes) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to parse message: {}", e);
                eprintln!("[SERIAL] Parse error: {}", e);
                let error_response = ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: format!("JSON parse error: {}", e),
                };
                send_message_sync_file(file, &error_response)?;
                continue;
            }
        };

        eprintln!("[SERIAL] Parsed message: {:?}", message);

        // Handle message
        let response = match message {
            ProtocolMessage::CommandRequest(request) => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_command(request, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::CreateSession { tenant_id, spec } => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_create_session(tenant_id, spec, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::DestroySession { session_id } => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_destroy_session(session_id, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::Heartbeat => ProtocolMessage::Heartbeat,
            _ => {
                ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: "Unexpected message type".to_string(),
                }
            }
        };

        // Send response
        eprintln!("[SERIAL] Sending response: {:?}", response);
        send_message_sync_file(file, &response)?;
    }

    Ok(())
}

/// Send a protocol message synchronously over a File
#[cfg(target_os = "linux")]
fn send_message_sync_file(
    file: &mut std::fs::File,
    message: &ProtocolMessage,
) -> Result<()> {
    use std::io::Write;
    
    let msg_bytes = serde_json::to_vec(message)?;
    let len_bytes = (msg_bytes.len() as u32).to_be_bytes();

    file.write_all(&len_bytes)?;
    file.write_all(&msg_bytes)?;
    file.flush()?;

    Ok(())
}

/// Start VSOCK server (Linux only, inside VM, for Firecracker)
#[cfg(target_os = "linux")]
async fn start_vsock_server(state: Arc<ExecutorState>) -> Result<()> {
    use vsock::{VsockAddr, VsockListener};

    let port = state.config.vsock_port;
    // Bind to VMADDR_CID_HOST (2) — Apple's Virtualization.framework may
    // require this CID for host-initiated VSOCK connections.
    let addr = VsockAddr::new(VMADDR_CID_HOST, port);

    info!("Starting VSOCK server on port {}", port);

    let listener = VsockListener::bind(&addr)
        .with_context(|| format!("Failed to bind VSOCK listener on port {}", port))?;

    info!("VSOCK server listening on port {}", port);

    loop {
        match listener.accept() {
            Ok((mut stream, peer_addr)) => {
                info!("New VSOCK connection from {:?}", peer_addr);
                let state = Arc::clone(&state);
                
                // Handle connection in blocking task since vsock is sync
                tokio::task::spawn_blocking(move || {
                    if let Err(e) = handle_vsock_connection_sync(&mut stream, state) {
                        error!("Connection handler error: {}", e);
                    }
                });
            }
            Err(e) => {
                error!("Failed to accept VSOCK connection: {}", e);
            }
        }
    }
}

/// Handle VSOCK connection synchronously (Linux only)
#[cfg(target_os = "linux")]
fn handle_vsock_connection_sync(
    stream: &mut vsock::VsockStream,
    state: Arc<ExecutorState>,
) -> Result<()> {
    use std::io::{Read, Write};
    
    loop {
        // Read message length (4 bytes, big-endian)
        let mut len_bytes = [0u8; 4];
        match stream.read_exact(&mut len_bytes) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                info!("Connection closed by peer");
                break;
            }
            Err(e) => return Err(e.into()),
        }
        let msg_len = u32::from_be_bytes(len_bytes) as usize;

        // Read message body
        let mut msg_bytes = vec![0u8; msg_len];
        stream.read_exact(&mut msg_bytes)?;

        // Parse message
        let message: ProtocolMessage = match serde_json::from_slice(&msg_bytes) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to parse message: {}", e);
                let error_response = ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: format!("JSON parse error: {}", e),
                };
                send_message_sync(stream, &error_response)?;
                continue;
            }
        };

        debug!("Received message: {:?}", message);

        // Handle message (convert async to sync using block_on)
        let response = match message {
            ProtocolMessage::CommandRequest(request) => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_command(request, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::CreateSession { tenant_id, spec } => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_create_session(tenant_id, spec, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::DestroySession { session_id } => {
                match tokio::runtime::Handle::try_current() {
                    Ok(handle) => {
                        handle.block_on(handle_destroy_session(session_id, state.clone()))
                    }
                    Err(_) => {
                        ProtocolMessage::Error {
                            error: ProtocolError::InternalError,
                            message: "No tokio runtime available".to_string(),
                        }
                    }
                }
            }
            ProtocolMessage::Heartbeat => ProtocolMessage::Heartbeat,
            _ => {
                ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: "Unexpected message type".to_string(),
                }
            }
        };

        // Send response
        send_message_sync(stream, &response)?;
    }

    Ok(())
}

/// Send a protocol message synchronously over VSOCK
#[cfg(target_os = "linux")]
fn send_message_sync(
    stream: &mut vsock::VsockStream,
    message: &ProtocolMessage,
) -> Result<()> {
    use std::io::Write;
    
    let msg_bytes = serde_json::to_vec(message)?;
    let len_bytes = (msg_bytes.len() as u32).to_be_bytes();

    stream.write_all(&len_bytes)?;
    stream.write_all(&msg_bytes)?;
    stream.flush()?;

    Ok(())
}

/// Start TCP server (for testing/development)
async fn start_tcp_server(state: Arc<ExecutorState>) -> Result<()> {
    let port = state.config.tcp_port.unwrap_or(8080);
    let addr = format!("0.0.0.0:{}", port);

    warn!("Starting TCP server on {} (VSOCK not available on this platform)", addr);

    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("Failed to bind TCP listener on {}", addr))?;

    info!("TCP server listening on {}", addr);

    loop {
        match listener.accept().await {
            Ok((stream, peer_addr)) => {
                info!("New TCP connection from {}", peer_addr);
                let state = Arc::clone(&state);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, state).await {
                        error!("Connection handler error: {}", e);
                    }
                });
            }
            Err(e) => {
                error!("Failed to accept TCP connection: {}", e);
            }
        }
    }
}

/// Handle a single connection from the host
async fn handle_connection<S>(stream: S, state: Arc<ExecutorState>) -> Result<()>
where
    S: AsyncReadExt + AsyncWriteExt + Unpin + Send + 'static,
{
    let (mut read_half, mut write_half) = tokio::io::split(stream);

    // Read loop
    loop {
        // Read message length (4 bytes, big-endian)
        let mut len_bytes = [0u8; 4];
        if let Err(e) = read_half.read_exact(&mut len_bytes).await {
            if e.kind() == std::io::ErrorKind::UnexpectedEof {
                info!("Connection closed by peer");
                break;
            }
            return Err(e.into());
        }
        let msg_len = u32::from_be_bytes(len_bytes) as usize;

        // Read message body
        let mut msg_bytes = vec![0u8; msg_len];
        read_half.read_exact(&mut msg_bytes).await?;

        // Parse message
        let message: ProtocolMessage = match serde_json::from_slice(&msg_bytes) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to parse message: {}", e);
                let error_response = ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: format!("JSON parse error: {}", e),
                };
                send_message(&mut write_half, &error_response).await?;
                continue;
            }
        };

        debug!("Received message: {:?}", message);

        // Handle message
        let response = match message {
            ProtocolMessage::CommandRequest(request) => {
                handle_command(request, Arc::clone(&state)).await
            }
            ProtocolMessage::CreateSession { tenant_id, spec } => {
                handle_create_session(tenant_id, spec, Arc::clone(&state)).await
            }
            ProtocolMessage::DestroySession { session_id } => {
                handle_destroy_session(session_id, Arc::clone(&state)).await
            }
            ProtocolMessage::Heartbeat => ProtocolMessage::Heartbeat,
            _ => {
                ProtocolMessage::Error {
                    error: ProtocolError::InvalidMessage,
                    message: "Unexpected message type".to_string(),
                }
            }
        };

        // Send response
        send_message(&mut write_half, &response).await?;
    }

    Ok(())
}

/// Send a protocol message
async fn send_message<W>(writer: &mut W, message: &ProtocolMessage) -> Result<()>
where
    W: AsyncWriteExt + Unpin,
{
    let msg_bytes = serde_json::to_vec(message)?;
    let len_bytes = (msg_bytes.len() as u32).to_be_bytes();

    writer.write_all(&len_bytes).await?;
    writer.write_all(&msg_bytes).await?;
    writer.flush().await?;

    Ok(())
}

/// Handle a command execution request
async fn handle_command(
    request: CommandRequest,
    state: Arc<ExecutorState>,
) -> ProtocolMessage {
    info!(
        "Executing command: {:?} for session {:?}",
        request.command, request.session_id
    );

    // Get or create session
    let session = match get_or_create_session(&request.session_id, Arc::clone(&state)).await {
        Ok(s) => s,
        Err(e) => {
            return ProtocolMessage::CommandResponse(CommandResponse {
                request_id: request.request_id,
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to create session: {}", e),
                exit_code: -1,
                execution_time_ms: 0,
            });
        }
    };

    // Execute command in session's sandbox
    let start = std::time::Instant::now();
    
    match session.execute(&request.command, &request.args).await {
        Ok(result) => {
            let execution_time = start.elapsed().as_millis() as u64;
            
            ProtocolMessage::CommandResponse(CommandResponse {
                request_id: request.request_id,
                success: result.exit_code == 0,
                stdout: result.stdout,
                stderr: result.stderr,
                exit_code: result.exit_code,
                execution_time_ms: execution_time,
            })
        }
        Err(e) => {
            let execution_time = start.elapsed().as_millis() as u64;
            
            ProtocolMessage::CommandResponse(CommandResponse {
                request_id: request.request_id,
                success: false,
                stdout: String::new(),
                stderr: format!("Execution error: {}", e),
                exit_code: -1,
                execution_time_ms: execution_time,
            })
        }
    }
}

/// Handle session creation
async fn handle_create_session(
    tenant_id: String,
    spec: allternit_guest_agent_protocol::SpawnSpec,
    state: Arc<ExecutorState>,
) -> ProtocolMessage {
    info!("Creating session for tenant: {}", tenant_id);

    let session_id = SessionId(Uuid::new_v4());
    
    match Session::new(session_id.clone(), tenant_id.clone(), spec, Arc::clone(&state.sandbox)).await {
        Ok(session) => {
            let session = Arc::new(session);
            let mut sessions = state.sessions.write().await;
            sessions.insert(session_id.clone(), Arc::clone(&session));
            
            info!("Session {} created for tenant {}", session_id.0, tenant_id);
            
            ProtocolMessage::SessionCreated {
                session_id,
                tenant_id,
            }
        }
        Err(e) => {
            error!("Failed to create session: {}", e);
            ProtocolMessage::Error {
                error: ProtocolError::InternalError,
                message: format!("Failed to create session: {}", e),
            }
        }
    }
}

/// Handle session destruction
async fn handle_destroy_session(
    session_id: SessionId,
    state: Arc<ExecutorState>,
) -> ProtocolMessage {
    info!("Destroying session: {}", session_id.0);

    let mut sessions = state.sessions.write().await;
    
    match sessions.remove(&session_id) {
        Some(session) => {
            if let Err(e) = session.cleanup().await {
                warn!("Error during session cleanup: {}", e);
            }
            
            ProtocolMessage::SessionDestroyed { session_id }
        }
        None => {
            warn!("Session {} not found for destruction", session_id.0);
            ProtocolMessage::SessionDestroyed { session_id }
        }
    }
}

/// Get existing session or create new one
async fn get_or_create_session(
    session_id: &Option<SessionId>,
    state: Arc<ExecutorState>,
) -> Result<Arc<Session>> {
    if let Some(id) = session_id {
        let sessions = state.sessions.read().await;
        if let Some(session) = sessions.get(id) {
            return Ok(Arc::clone(session));
        }
    }

    // Create new session
    let new_id = SessionId(Uuid::new_v4());
    let tenant_id = format!("auto-{}", new_id.0);
    let spec = allternit_guest_agent_protocol::SpawnSpec::default();

    let session = Session::new(new_id.clone(), tenant_id, spec, Arc::clone(&state.sandbox)).await?;
    let session = Arc::new(session);
    
    let mut sessions = state.sessions.write().await;
    sessions.insert(new_id, Arc::clone(&session));

    Ok(session)
}
