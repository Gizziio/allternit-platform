//! WebSocket client for A2R Node
//!
//! Manages connection to control plane:
//! - Handles authentication
//! - Sends heartbeats
//! - Routes incoming messages
//! - Auto-reconnection
//! - File operations support

use anyhow::{Context, Result};
use a2r_protocol::{Message, MessagePayload, NodeCapabilities, NodeStatus, ResourceUsage, FileOperation, FileEntry, FileData, FileInfo, RunEvent, RunEventType};
use futures::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, RwLock};
use tokio::time::interval;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message as WsMessage, MaybeTlsStream, WebSocketStream};
use tracing::{debug, error, info, trace, warn};
use url::Url;

use crate::NodeState;

/// PTY session tracker
struct PtySessionTracker {
    /// Session ID to output channel sender
    output_channels: RwLock<HashMap<String, mpsc::Sender<String>>>,
    /// Session ID to PTY manager reference
    pty_manager: Option<Arc<crate::pty::PtyManager>>,
    /// Session ID to container PTY manager reference
    container_pty_manager: Option<Arc<crate::container_pty::ContainerPtyManager>>,
}

impl PtySessionTracker {
    fn new() -> Self {
        Self {
            output_channels: RwLock::new(HashMap::new()),
            pty_manager: None,
            container_pty_manager: None,
        }
    }

    fn with_pty_managers(
        pty_manager: Arc<crate::pty::PtyManager>,
        container_pty_manager: Arc<crate::container_pty::ContainerPtyManager>,
    ) -> Self {
        Self {
            output_channels: RwLock::new(HashMap::new()),
            pty_manager: Some(pty_manager),
            container_pty_manager: Some(container_pty_manager),
        }
    }

    async fn register_channel(&self, session_id: String, tx: mpsc::Sender<String>) {
        let mut channels = self.output_channels.write().await;
        channels.insert(session_id, tx);
    }

    async fn send_output(&self, session_id: &str, data: String) -> Result<()> {
        let channels = self.output_channels.read().await;
        if let Some(tx) = channels.get(session_id) {
            tx.send(data).await.map_err(|e| anyhow::anyhow!("Channel closed: {}", e))?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("No channel for session {}", session_id))
        }
    }

    async fn remove_channel(&self, session_id: &str) {
        let mut channels = self.output_channels.write().await;
        channels.remove(session_id);
    }
}

/// WebSocket client configuration
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    pub url: String,
    pub node_id: String,
    pub auth_token: String,
    pub heartbeat_interval: Duration,
}

/// WebSocket client for control plane communication
pub struct WebSocketClient {
    config: WebSocketConfig,
    state: Arc<NodeState>,
    stream: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    last_pong: Instant,
    /// PTY session tracker for terminal sessions
    pty_tracker: Arc<PtySessionTracker>,
}

impl WebSocketClient {
    pub fn new(config: WebSocketConfig, state: Arc<NodeState>) -> Self {
        // Get PTY managers from state
        let pty_manager = {
            let guard = state.pty_manager.blocking_read();
            guard.clone().unwrap_or_else(|| Arc::new(crate::pty::PtyManager::new()))
        };
        
        let container_pty_manager = {
            let guard = state.container_pty_manager.blocking_read();
            guard.clone().unwrap_or_else(|| Arc::new(crate::container_pty::ContainerPtyManager::new()))
        };

        let pty_tracker = Arc::new(PtySessionTracker::with_pty_managers(
            pty_manager,
            container_pty_manager,
        ));

        Self {
            config,
            state,
            stream: None,
            last_pong: Instant::now(),
            pty_tracker,
        }
    }

    /// Connect to control plane
    pub async fn connect(&mut self) -> Result<()> {
        // Construct full WebSocket URL with node ID path
        let base_url = Url::parse(&self.config.url)
            .context("Invalid control plane URL")?;
        
        let ws_path = format!("/ws/nodes/{}", self.config.node_id);
        let url = base_url.join(&ws_path)
            .context("Failed to construct WebSocket URL")?;

        info!("🔌 Connecting to {}...", url);

        // Connect with timeout
        let (ws_stream, _) = tokio::time::timeout(
            Duration::from_secs(10),
            connect_async(url)
        ).await
            .context("Connection timeout")?
            .context("Failed to connect")?;

        self.stream = Some(ws_stream);
        info!("✅ WebSocket connected");

        // Send registration message
        self.register().await?;

        Ok(())
    }

    /// Send registration message
    async fn register(&mut self) -> Result<()> {
        let capabilities = self.detect_capabilities().await?;

        let msg = Message::new(MessagePayload::NodeRegister {
            node_id: self.config.node_id.clone(),
            auth_token: self.config.auth_token.clone(),
            hostname: gethostname::gethostname().to_string_lossy().to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            capabilities,
            labels: self.state.config.blocking_read().labels.clone(),
        });

        self.send_message(&msg).await?;
        info!("📋 Registration sent");

        Ok(())
    }

    /// Main run loop (blocks until disconnect)
    pub async fn run(&mut self) -> Result<()> {
        let stream = self.stream.take()
            .context("Not connected")?;

        let (mut write, mut read) = stream.split();

        // Channel for outgoing messages
        let (tx, mut rx) = mpsc::channel::<Message>(100);

        // Spawn heartbeat task
        let heartbeat_tx = tx.clone();
        let heartbeat_interval = self.config.heartbeat_interval;
        let node_id = self.config.node_id.clone();
        let state = self.state.clone();

        let heartbeat_handle = tokio::spawn(async move {
            let mut interval = interval(heartbeat_interval);

            loop {
                interval.tick().await;

                // Send heartbeat
                let running_jobs_count = state.running_jobs.read().await.len() as u32;

                let heartbeat = Message::new(MessagePayload::Heartbeat {
                    node_id: node_id.clone(),
                    status: NodeStatus::Online,
                    resource_usage: get_resource_usage(),
                    running_jobs: running_jobs_count,
                });

                if heartbeat_tx.send(heartbeat).await.is_err() {
                    break; // Channel closed
                }
            }
        });

        // Main message loop
        loop {
            tokio::select! {
                // Incoming WebSocket messages
                msg = read.next() => {
                    match msg {
                        Some(Ok(WsMessage::Text(text))) => {
                            trace!("📨 Received: {}", text);
                            
                            match serde_json::from_str::<Message>(&text) {
                                Ok(message) => {
                                    if let Err(e) = self.handle_message(message, &tx).await {
                                        error!("❌ Error handling message: {}", e);
                                    }
                                }
                                Err(e) => {
                                    error!("❌ Failed to parse message: {}", e);
                                }
                            }
                        }
                        
                        Some(Ok(WsMessage::Binary(bin))) => {
                            trace!("📨 Received binary: {} bytes", bin.len());
                            // Handle binary data (e.g., file transfers)
                        }
                        
                        Some(Ok(WsMessage::Ping(_data))) => {
                            trace!("🏓 Ping received");
                            self.last_pong = Instant::now();
                            // Pong is automatically sent by tungstenite
                        }
                        
                        Some(Ok(WsMessage::Pong(_))) => {
                            trace!("🏓 Pong received");
                            self.last_pong = Instant::now();
                        }
                        
                        Some(Ok(WsMessage::Frame(_))) => {
                            // Raw frame - ignore, handled by tungstenite
                        }
                        
                        Some(Ok(WsMessage::Close(frame))) => {
                            info!("🔌 Connection closed: {:?}", frame);
                            break;
                        }
                        
                        Some(Err(e)) => {
                            error!("❌ WebSocket error: {}", e);
                            break;
                        }
                        
                        None => {
                            warn!("⚠️ WebSocket stream ended");
                            break;
                        }
                    }
                }
                
                // Outgoing messages from other tasks
                Some(msg) = rx.recv() => {
                    let json = serde_json::to_string(&msg)?;
                    trace!("📤 Sending: {}", json);
                    
                    if let Err(e) = write.send(WsMessage::Text(json)).await {
                        error!("❌ Failed to send message: {}", e);
                        break;
                    }
                }
                
                // Connection health check
                _ = tokio::time::sleep(Duration::from_secs(60)) => {
                    if self.last_pong.elapsed() > Duration::from_secs(120) {
                        warn!("⚠️ No pong received for 120s, assuming dead connection");
                        break;
                    }
                }
            }
        }

        // Clean up
        heartbeat_handle.abort();
        
        // Close WebSocket gracefully
        let _ = write.close().await;
        
        info!("🔌 WebSocket connection closed");
        Ok(())
    }

    /// Handle incoming message from control plane
    async fn handle_message(
        &mut self,
        msg: Message,
        tx: &mpsc::Sender<Message>,
    ) -> Result<()> {
        match msg.payload {
            MessagePayload::NodeRegistered { node_id, config: remote_config } => {
                info!("✅ Registered with control plane as {}", node_id);
                
                // Apply remote config from control plane
                let mut current_config = self.state.config.write().await;
                
                // Update heartbeat interval if non-zero
                if remote_config.heartbeat_interval_secs > 0 {
                    current_config.heartbeat_interval_secs = remote_config.heartbeat_interval_secs;
                    info!("  → Heartbeat interval: {}s", remote_config.heartbeat_interval_secs);
                }
                
                // Update max concurrent jobs (convert u32 to usize)
                if remote_config.max_concurrent_jobs > 0 {
                    current_config.max_concurrent_jobs = remote_config.max_concurrent_jobs as usize;
                    info!("  → Max concurrent jobs: {}", remote_config.max_concurrent_jobs);
                }
                
                // Update max file upload size if non-zero
                if remote_config.max_file_upload_size > 0 {
                    current_config.max_file_upload_size = remote_config.max_file_upload_size;
                    info!("  → Max file upload size: {} bytes", remote_config.max_file_upload_size);
                }
                
                // Update allowed file paths if provided
                if !remote_config.allowed_file_paths.is_empty() {
                    current_config.allowed_file_paths = remote_config.allowed_file_paths.clone();
                    info!("  → Allowed file paths: {} entries", remote_config.allowed_file_paths.len());
                }
                
                // Update blocked file patterns if provided
                if !remote_config.blocked_file_patterns.is_empty() {
                    current_config.blocked_file_patterns = remote_config.blocked_file_patterns.clone();
                    info!("  → Blocked file patterns: {} entries", remote_config.blocked_file_patterns.len());
                }
                
                // Note: job_timeout_secs, resource_limits, allowed_images, network_policy
                // are stored in the protocol's NodeConfig but not in the node's local config.
                // These would need to be added to NodeConfig if runtime enforcement is required.
                // For now, they are applied at the control plane scheduling level.
                
                info!("✅ Remote config applied successfully");
            }
            
            MessagePayload::Ping { timestamp } => {
                debug!("🏓 Ping received at {}", timestamp);
                // Pong is automatic, but we could send explicit pong here
            }
            
            MessagePayload::AssignJob { job } => {
                info!("📝 Job assigned: {} ({})", job.id, job.name);
                // Spawn job executor
                let executor_opt = {
                    let guard = self.state.executor.read().await;
                    guard.clone()
                };
                
                if let Some(exec) = executor_opt.as_ref() {
                    let job = job.clone();
                    let tx_clone = tx.clone();
                    let node_id = self.config.node_id.clone();
                    let exec_clone = exec.clone();
                    let state_clone = self.state.clone();

                    tokio::spawn(async move {
                        info!("🚀 Starting job execution: {}", job.id);

                        // Add to running jobs
                        state_clone.running_jobs.write().await.push(job.id.clone());

                        let start_time = std::time::Instant::now();

                        // Send job started message
                        let started_msg = Message::new(MessagePayload::JobStarted {
                            job_id: job.id.clone(),
                            node_id: node_id.clone(),
                        });
                        let _ = tx_clone.send(started_msg).await;

                        // Execute job
                        match exec_clone.execute(&job).await {
                            Ok(result) => {
                                let duration_secs = start_time.elapsed().as_secs();
                                info!("✅ Job completed: {} (success={}, duration={}s)", job.id, result.success, duration_secs);

                                // Remove from running jobs
                                let mut running = state_clone.running_jobs.write().await;
                                running.retain(|id| id != &job.id);

                                // Send job completed message with actual duration
                                let completed_msg = Message::new(MessagePayload::JobCompleted {
                                    job_id: job.id.clone(),
                                    result,
                                    duration_secs,
                                });
                                let _ = tx_clone.send(completed_msg).await;
                            }
                            Err(e) => {
                                let duration_secs = start_time.elapsed().as_secs();
                                error!("❌ Job failed: {} - {} ({}s)", job.id, e, duration_secs);

                                // Remove from running jobs
                                let mut running = state_clone.running_jobs.write().await;
                                running.retain(|id| id != &job.id);

                                // Send error as job completion
                                let failed_msg = Message::new(MessagePayload::JobCompleted {
                                    job_id: job.id.clone(),
                                    result: a2r_protocol::JobResult {
                                        success: false,
                                        exit_code: -1,
                                        stdout: String::new(),
                                        stderr: e.to_string(),
                                        artifacts: vec![],
                                    },
                                    duration_secs,
                                });
                                let _ = tx_clone.send(failed_msg).await;
                            }
                        }
                    });
                } else {
                    warn!("Job executor not available");
                }
            }

            MessagePayload::CancelJob { job_id } => {
                info!("⏹️ Cancel job: {}", job_id);
                // Cancel running job
                let executor = {
                    let guard = self.state.executor.read().await;
                    guard.clone()
                };
                
                if let Some(exec) = executor.as_ref() {
                    if let Err(e) = exec.cancel(&job_id).await {
                        error!("Failed to cancel job {}: {}", job_id, e);
                    }
                }
            }
            
            MessagePayload::CreateTerminal { session_id, shell, cols, rows, env, working_dir, sandbox } => {
                info!("💻 Create terminal session: {} ({}x{}, env: {}, cwd: {:?}, sandbox: {})",
                    session_id, cols, rows, env.len(), working_dir, sandbox.is_some());

                // Spawn PTY via the node's PTY manager (native or containerized)
                if let Err(e) = self.spawn_terminal(session_id, shell, cols, rows, env, working_dir, sandbox, tx.clone()).await {
                    error!("Failed to spawn terminal: {}", e);
                }
            }

            MessagePayload::TerminalInput { session_id, data } => {
                trace!("⌨️  Terminal input for {}: {} bytes", session_id, data.len());
                // Forward to PTY
                if let Err(e) = self.write_to_terminal(&session_id, &data).await {
                    error!("Failed to write to terminal {}: {}", session_id, e);
                }
            }
            
            MessagePayload::TerminalOutput { session_id, data } => {
                // This shouldn't come from control plane, but handle just in case
                trace!("Terminal output for {}: {} bytes", session_id, data.len());
            }
            
            MessagePayload::FileOperation { operation } => {
                debug!("📁 File operation: {:?}", operation);
                // Handle file operation and send response
                let result = self.handle_file_operation(operation, tx).await;
                if let Err(e) = result {
                    error!("File operation failed: {}", e);
                }
            }
            
            MessagePayload::UpdateConfig { config } => {
                info!("⚙️  Config update received");
                
                // Apply new config to state
                let mut current_config = self.state.config.read().await.clone();
                
                // Update heartbeat interval if changed
                if config.heartbeat_interval_secs > 0 {
                    current_config.heartbeat_interval_secs = config.heartbeat_interval_secs;
                }
                
                // Update max concurrent jobs if changed (convert u32 to usize)
                if config.max_concurrent_jobs > 0 {
                    current_config.max_concurrent_jobs = config.max_concurrent_jobs as usize;
                }
                
                // Update allowed file paths if provided
                if !config.allowed_file_paths.is_empty() {
                    current_config.allowed_file_paths = config.allowed_file_paths.clone();
                }
                
                // Update blocked file patterns if provided
                if !config.blocked_file_patterns.is_empty() {
                    current_config.blocked_file_patterns = config.blocked_file_patterns.clone();
                }
                
                // Save updated config
                *self.state.config.write().await = current_config;
                
                info!("✅ Config updated successfully");
            }

            MessagePayload::Restart => {
                info!("🔄 Restart requested");
                
                // Graceful restart: cleanup and exit with restart code
                // The systemd/launchd service will automatically restart us
                
                // Close all running jobs gracefully
                let executor_opt = {
                    let guard = self.state.executor.read().await;
                    guard.clone()
                };
                
                if let Some(executor) = executor_opt.as_ref() {
                    let running = executor.running_jobs().await;
                    for job_id in running {
                        info!("⏹️ Cancelling job {} for restart", job_id);
                        let _ = executor.cancel(&job_id).await;
                    }
                }
                
                // Exit with code 0 (service manager will restart)
                std::process::exit(0);
            }

            MessagePayload::Shutdown => {
                info!("🛑 Shutdown requested");
                
                // Graceful shutdown: cleanup and exit
                
                // Close all running jobs gracefully
                let executor_opt = {
                    let guard = self.state.executor.read().await;
                    guard.clone()
                };
                
                if let Some(executor) = executor_opt.as_ref() {
                    let running = executor.running_jobs().await;
                    for job_id in running {
                        info!("⏹️ Cancelling job {} for shutdown", job_id);
                        let _ = executor.cancel(&job_id).await;
                    }
                }
                
                // Close all PTY sessions
                if let Some(pty_manager) = self.state.pty_manager.read().await.as_ref() {
                    for session_id in pty_manager.list_sessions().await {
                        let _ = pty_manager.close_session(&session_id).await;
                    }
                }
                
                // Exit cleanly
                std::process::exit(0);
            }
            
            // Run lifecycle messages
            MessagePayload::StartRun { run_id, config } => {
                info!("🏃 Start run requested: {}", run_id);
                let run_id_for_error = run_id.clone();
                // Delegate to run manager if available
                if let Some(run_manager) = self.state.run_manager.read().await.as_ref() {
                    if let Err(e) = run_manager.start_run(run_id, config).await {
                        error!("Failed to start run: {}", e);
                        
                        // Send error event
                        let error_msg = Message::new(MessagePayload::RunEvent {
                            run_id: run_id_for_error,
                            event: RunEvent {
                                event_type: RunEventType::Failed,
                                timestamp: chrono::Utc::now(),
                                data: serde_json::json!({
                                    "error": e.to_string(),
                                }),
                            },
                        });
                        let _ = tx.send(error_msg).await;
                    }
                } else {
                    warn!("Run manager not available");
                }
            }
            
            MessagePayload::StopRun { run_id } => {
                info!("⏹️ Stop run requested: {}", run_id);
                if let Some(run_manager) = self.state.run_manager.read().await.as_ref() {
                    if let Err(e) = run_manager.stop_run(&run_id).await {
                        error!("Failed to stop run: {}", e);
                    }
                }
            }
            
            MessagePayload::AttachRun { run_id, client_id } => {
                info!("👁️ Attach to run requested: {} (client: {})", run_id, client_id);
                if let Some(run_manager) = self.state.run_manager.read().await.as_ref() {
                    if let Err(e) = run_manager.attach_client(&run_id, &client_id).await {
                        error!("Failed to attach to run: {}", e);
                    }
                }
            }
            
            MessagePayload::DetachRun { run_id, client_id } => {
                info!("👁️ Detach from run requested: {} (client: {})", run_id, client_id);
                if let Some(run_manager) = self.state.run_manager.read().await.as_ref() {
                    if let Err(e) = run_manager.detach_client(&run_id, &client_id).await {
                        error!("Failed to detach from run: {}", e);
                    }
                }
            }
            
            MessagePayload::GetRunStatus { run_id } => {
                debug!("📊 Get run status requested: {}", run_id);
                if let Some(run_manager) = self.state.run_manager.read().await.as_ref() {
                    if let Some(status) = run_manager.get_run_status(&run_id).await {
                        let status_msg = Message::new(MessagePayload::RunStatus {
                            run_id: run_id.clone(),
                            status: status.status,
                            exit_code: status.exit_code,
                            node_id: self.config.node_id.clone(),
                        });
                        let _ = tx.send(status_msg).await;
                    }
                }
            }
            
            MessagePayload::RunInput { run_id, input } => {
                trace!("⌨️  Run input for {}: {} bytes", run_id, input.len());
                // Forward input to running run (if stdin is supported)
                // This would require additional stdin forwarding implementation
            }
            
            _ => {
                warn!("⚠️ Unexpected message type: {:?}", msg.payload);
            }
        }
        
        Ok(())
    }

    /// Handle file operations
    async fn handle_file_operation(
        &self,
        operation: FileOperation,
        tx: &mpsc::Sender<Message>,
    ) -> Result<()> {
        let operation_id = uuid::Uuid::new_v4().to_string();
        
        // Extract path before consuming operation
        let result_path = match &operation {
            FileOperation::Upload { path, .. } => path.clone(),
            FileOperation::Download { path } => path.clone(),
            FileOperation::List { path } => path.clone(),
            FileOperation::Delete { path } => path.clone(),
            FileOperation::Mkdir { path } => path.clone(),
            FileOperation::Stat { path } => path.clone(),
            FileOperation::Move { to, .. } => to.clone(),
            FileOperation::Copy { to, .. } => to.clone(),
        };
        
        let is_list_operation = matches!(operation, FileOperation::List { .. });
        
        let result = match operation {
            FileOperation::Upload { path, data } => {
                self.handle_file_upload(&path, &data).await
            }
            FileOperation::Download { path } => {
                self.handle_file_download(&path).await
            }
            FileOperation::List { path } => {
                self.handle_file_list(&path).await
            }
            FileOperation::Delete { path } => {
                self.handle_file_delete(&path).await
            }
            FileOperation::Mkdir { path } => {
                self.handle_file_mkdir(&path).await
            }
            FileOperation::Stat { path } => {
                self.handle_file_stat(&path).await
            }
            FileOperation::Move { from, to } => {
                self.handle_file_move(&from, &to).await
            }
            FileOperation::Copy { from, to } => {
                self.handle_file_copy(&from, &to).await
            }
        };

        let response = match result {
            Ok((success, error, data, entries)) => {
                Message::new(MessagePayload::FileOperationResult {
                    operation_id,
                    success,
                    error,
                    data: Some(FileData {
                        path: result_path,
                        is_dir: is_list_operation || entries.is_some(),
                        size: data.as_ref().map(|d| d.len() as u64).unwrap_or(0),
                        modified: chrono::Utc::now(),
                        content: data,
                        children: entries.map(|e| e.into_iter().map(|entry| FileInfo {
                            name: entry.name,
                            path: entry.path,
                            is_dir: entry.is_dir,
                            size: entry.size,
                            modified: entry.modified,
                            permissions: entry.permissions,
                        }).collect()),
                        permissions: None,
                    }),
                })
            }
            Err(e) => {
                Message::new(MessagePayload::FileOperationResult {
                    operation_id,
                    success: false,
                    error: Some(e.to_string()),
                    data: None,
                })
            }
        };

        tx.send(response).await
            .map_err(|_| anyhow::anyhow!("Failed to send file operation response"))?;
        
        Ok(())
    }

    /// Handle file upload
    async fn handle_file_upload(
        &self,
        path: &str,
        data: &[u8],
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Check file size
        let max_size = self.state.config.blocking_read().max_file_upload_size;
        if data.len() as u64 > max_size {
            return Ok((false, Some(format!("File too large: {} bytes (max: {} bytes)", data.len(), max_size)), None, None));
        }

        // Ensure parent directory exists
        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent).await?;
        }

        // Write file
        let mut file = fs::File::create(path).await?;
        file.write_all(data).await?;
        file.flush().await?;
        
        info!("📤 File uploaded: {} ({} bytes)", path, data.len());
        
        Ok((true, None, None, None))
    }

    /// Handle file download
    async fn handle_file_download(
        &self,
        path: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Check if file exists
        let metadata = match fs::metadata(path).await {
            Ok(m) => m,
            Err(_) => return Ok((false, Some("File not found".to_string()), None, None)),
        };

        if metadata.is_dir() {
            return Ok((false, Some("Path is a directory".to_string()), None, None));
        }

        // Read file
        let data = fs::read(path).await?;
        
        info!("📥 File downloaded: {} ({} bytes)", path, data.len());
        
        Ok((true, None, Some(data), None))
    }

    /// Handle file list
    async fn handle_file_list(
        &self,
        path: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Check if path exists and is directory
        let metadata = match fs::metadata(path).await {
            Ok(m) => m,
            Err(_) => return Ok((false, Some("Path not found".to_string()), None, None)),
        };

        if !metadata.is_dir() {
            return Ok((false, Some("Path is not a directory".to_string()), None, None));
        }

        // Read directory entries
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(path).await?;
        
        while let Some(entry) = dir.next_entry().await? {
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path().to_string_lossy().to_string();
            let metadata = entry.metadata().await?;
            
            // Get MIME type for files
            let mime_type = if metadata.is_file() {
                Some(mime_guess::from_path(&path).first_or_octet_stream().to_string())
            } else {
                None
            };
            
            // Get Unix permissions (if available)
            #[cfg(unix)]
            let permissions = metadata.permissions().mode();
            #[cfg(not(unix))]
            let permissions = 0o644;
            
            entries.push(FileEntry {
                name,
                path,
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                modified: metadata.modified()?.into(),
                permissions: Some(permissions),
                mime_type,
            });
        }

        // Sort: directories first, then alphabetically
        entries.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        
        info!("📂 Directory listed: {} ({} entries)", path, entries.len());
        
        Ok((true, None, None, Some(entries)))
    }

    /// Handle file delete
    async fn handle_file_delete(
        &self,
        path: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Prevent deletion of sensitive paths
        if self.is_sensitive_path(path) {
            return Ok((false, Some("Cannot delete sensitive system paths".to_string()), None, None));
        }

        // Check if path exists
        let metadata = match fs::metadata(path).await {
            Ok(m) => m,
            Err(_) => return Ok((false, Some("Path not found".to_string()), None, None)),
        };

        // Delete file or directory
        if metadata.is_dir() {
            fs::remove_dir_all(path).await?;
        } else {
            fs::remove_file(path).await?;
        }
        
        info!("🗑️  File deleted: {}", path);
        
        Ok((true, None, None, None))
    }

    /// Handle mkdir
    async fn handle_file_mkdir(
        &self,
        path: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Create directory (including parents)
        match fs::create_dir_all(path).await {
            Ok(_) => {
                info!("📁 Directory created: {}", path);
                Ok((true, None, None, None))
            }
            Err(e) => Ok((false, Some(format!("Failed to create directory: {}", e)), None, None)),
        }
    }

    /// Handle file stat
    async fn handle_file_stat(
        &self,
        path: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate path
        if !self.is_valid_path(path) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Get metadata
        let metadata = match fs::metadata(path).await {
            Ok(m) => m,
            Err(_) => return Ok((false, Some("Path not found".to_string()), None, None)),
        };

        #[cfg(unix)]
        let permissions = metadata.permissions().mode();
        #[cfg(not(unix))]
        let permissions = 0o644;

        let entry = FileEntry {
            name: Path::new(path).file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string()),
            path: path.to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified: metadata.modified()?.into(),
            permissions: Some(permissions),
            mime_type: if metadata.is_file() {
                Some(mime_guess::from_path(path).first_or_octet_stream().to_string())
            } else {
                None
            },
        };
        
        Ok((true, None, None, Some(vec![entry])))
    }

    /// Handle file move
    async fn handle_file_move(
        &self,
        from: &str,
        to: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate paths
        if !self.is_valid_path(from) || !self.is_valid_path(to) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Prevent moving sensitive paths
        if self.is_sensitive_path(from) {
            return Ok((false, Some("Cannot move sensitive system paths".to_string()), None, None));
        }

        // Move file
        match fs::rename(from, to).await {
            Ok(_) => {
                info!("📦 File moved: {} -> {}", from, to);
                Ok((true, None, None, None))
            }
            Err(e) => Ok((false, Some(format!("Failed to move file: {}", e)), None, None)),
        }
    }

    /// Handle file copy
    async fn handle_file_copy(
        &self,
        from: &str,
        to: &str,
    ) -> Result<(bool, Option<String>, Option<Vec<u8>>, Option<Vec<FileEntry>>)> {
        // Validate paths
        if !self.is_valid_path(from) || !self.is_valid_path(to) {
            return Ok((false, Some("Invalid path".to_string()), None, None));
        }

        // Copy file
        match fs::copy(from, to).await {
            Ok(_) => {
                info!("📄 File copied: {} -> {}", from, to);
                Ok((true, None, None, None))
            }
            Err(e) => Ok((false, Some(format!("Failed to copy file: {}", e)), None, None)),
        }
    }

    /// Validate a file path for security
    fn is_valid_path(&self, path: &str) -> bool {
        // Check for path traversal attempts
        if path.contains("..") {
            return false;
        }
        
        // Check for null bytes
        if path.contains('\0') {
            return false;
        }
        
        // Must be absolute path
        if !path.starts_with('/') {
            return false;
        }
        
        // Path length limit
        if path.len() > 4096 {
            return false;
        }

        // Check against allowed paths (if configured)
        let config = self.state.config.blocking_read();
        if !config.allowed_file_paths.is_empty() {
            let allowed = config.allowed_file_paths.iter()
                .any(|allowed| path.starts_with(allowed));
            if !allowed {
                return false;
            }
        }

        true
    }

    /// Check if path is sensitive and should not be modified
    fn is_sensitive_path(&self, path: &str) -> bool {
        let sensitive_paths = [
            "/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64",
            "/proc", "/root", "/sbin", "/sys", "/usr", "/var",
        ];
        
        for sensitive in &sensitive_paths {
            if path == *sensitive {
                return true;
            }
        }
        
        false
    }

    /// Spawn a new terminal session via PTY (native or containerized)
    async fn spawn_terminal(
        &self,
        session_id: String,
        shell: String,
        cols: u16,
        rows: u16,
        env: std::collections::HashMap<String, String>,
        working_dir: Option<String>,
        sandbox: Option<a2r_protocol::SandboxConfig>,
        ws_tx: mpsc::Sender<Message>,
    ) -> Result<()> {

        // Check if sandbox mode is requested and Docker is available
        let use_container = if let Some(ref sandbox_config) = sandbox {
            let docker_available = *self.state.docker_available.read().await;
            if !docker_available {
                warn!("Sandbox mode requested but Docker is not available, falling back to native PTY");
            }
            docker_available
        } else {
            false
        };

        if use_container {
            // Use containerized PTY
            self.spawn_container_terminal(session_id, shell, cols, rows, env, working_dir, sandbox.unwrap(), ws_tx).await
        } else {
            // Use native PTY
            self.spawn_native_terminal(session_id, shell, cols, rows, env, working_dir, ws_tx).await
        }
    }

    /// Spawn a native terminal session
    async fn spawn_native_terminal(
        &self,
        session_id: String,
        shell: String,
        cols: u16,
        rows: u16,
        env: std::collections::HashMap<String, String>,
        working_dir: Option<String>,
        ws_tx: mpsc::Sender<Message>,
    ) -> Result<()> {
        use crate::pty::PtyOutput;

        // Get PTY manager from state
        let pty_manager = {
            let guard = self.state.pty_manager.read().await;
            guard.clone()
        };

        let pty_manager = pty_manager.context("PTY manager not available")?;

        // Create channel for PTY output
        let (output_tx, mut output_rx) = mpsc::channel::<PtyOutput>(256);

        // Create PTY session
        pty_manager.create_session(
            session_id.clone(),
            Some(shell),
            cols,
            rows,
            env,
            working_dir,
            output_tx,
        ).await?;

        // Spawn task to forward PTY output to control plane via WebSocket
        let session_id_clone = session_id.clone();
        let ws_tx_clone = ws_tx.clone();
        tokio::spawn(async move {
            while let Some(output) = output_rx.recv().await {
                // Convert bytes to string
                let data = String::from_utf8_lossy(&output.data).to_string();
                trace!("PTY output for {}: {} bytes", output.session_id, data.len());

                // Send terminal output back to control plane via WebSocket
                let msg = Message::new(MessagePayload::TerminalOutput {
                    session_id: session_id_clone.clone(),
                    data,
                });

                let _ = ws_tx_clone.send(msg).await;
            }
        });

        info!("✅ Native terminal session spawned: {}", session_id);
        Ok(())
    }

    /// Spawn a containerized terminal session
    async fn spawn_container_terminal(
        &self,
        session_id: String,
        shell: String,
        cols: u16,
        rows: u16,
        env: std::collections::HashMap<String, String>,
        working_dir: Option<String>,
        sandbox_config: a2r_protocol::SandboxConfig,
        ws_tx: mpsc::Sender<Message>,
    ) -> Result<()> {
        use crate::container_pty::ContainerPtyOutput;

        // Get container PTY manager from state
        let container_pty_manager = {
            let guard = self.state.container_pty_manager.read().await;
            guard.clone()
        };

        let container_pty_manager = container_pty_manager.context("Container PTY manager not available")?;

        // Create channel for PTY output
        let (output_tx, mut output_rx) = mpsc::channel::<ContainerPtyOutput>(256);

        // Create container PTY session
        container_pty_manager.create_session(
            session_id.clone(),
            Some(shell),
            cols,
            rows,
            env,
            working_dir,
            sandbox_config,
            output_tx,
        ).await?;

        // Spawn task to forward container PTY output to control plane via WebSocket
        let session_id_clone = session_id.clone();
        let ws_tx_clone = ws_tx.clone();
        tokio::spawn(async move {
            while let Some(output) = output_rx.recv().await {
                // Convert bytes to string
                let data = String::from_utf8_lossy(&output.data).to_string();
                trace!("Container PTY output for {}: {} bytes", output.session_id, data.len());

                // Send terminal output to control plane via WebSocket
                let msg = Message::new(MessagePayload::TerminalOutput {
                    session_id: session_id_clone.clone(),
                    data,
                });

                let _ = ws_tx_clone.send(msg).await;
            }
        });

        info!("✅ Container terminal session spawned: {}", session_id);
        Ok(())
    }

    /// Write data to a terminal session
    async fn write_to_terminal(&self, session_id: &str, data: &str) -> Result<()> {
        // Try native PTY first
        {
            let pty_manager = self.state.pty_manager.read().await;
            if let Some(manager) = pty_manager.as_ref() {
                if manager.list_sessions().await.contains(&session_id.to_string()) {
                    return manager.write(session_id, data.as_bytes()).await
                        .map_err(|e| anyhow::anyhow!("Failed to write to PTY: {}", e));
                }
            }
        }

        // Try container PTY
        {
            let container_pty_manager = self.state.container_pty_manager.read().await;
            if let Some(manager) = container_pty_manager.as_ref() {
                if manager.list_sessions().await.contains(&session_id.to_string()) {
                    return manager.write(session_id, data.as_bytes()).await
                        .map_err(|e| anyhow::anyhow!("Failed to write to container PTY: {}", e));
                }
            }
        }

        Err(anyhow::anyhow!("Terminal session {} not found", session_id))
    }

    /// Send a message to control plane
    async fn send_message(&mut self, msg: &Message) -> Result<()> {
        let stream = self.stream.as_mut()
            .context("Not connected")?;
        
        let json = serde_json::to_string(msg)?;
        stream.send(WsMessage::Text(json)).await?;
        
        Ok(())
    }

    /// Detect node capabilities
    async fn detect_capabilities(&self) -> Result<NodeCapabilities> {
        use sysinfo::System;
        
        let mut sys = System::new_all();
        sys.refresh_all();
        
        // Check Docker
        let docker = tokio::fs::metadata("/var/run/docker.sock").await.is_ok();

        // Check GPU (simplified)
        let gpu = tokio::fs::metadata("/dev/nvidia0").await.is_ok();

        // Detect total disk space
        let total_disk_gb = sysinfo::Disks::new_with_refreshed_list().iter()
            .map(|disk| disk.total_space() / 1024 / 1024 / 1024)
            .sum::<u64>();

        Ok(NodeCapabilities {
            docker,
            gpu,
            total_cpu: sys.cpus().len() as u32,
            total_memory_gb: sys.total_memory() / 1024 / 1024,
            total_disk_gb,
            container_runtimes: if docker { vec!["docker".to_string()] } else { vec![] },
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            file_operations: true,
            max_file_upload_size: 100 * 1024 * 1024, // 100MB
            zmodem_support: false,
        })
    }
}

/// Get current resource usage
fn get_resource_usage() -> ResourceUsage {
    use sysinfo::System;

    let mut sys = System::new_all();
    sys.refresh_all();

    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();

    // Calculate average CPU across all cores
    let cpu_percent = sys.cpus().iter()
        .map(|cpu| cpu.cpu_usage() as f64)
        .fold(0.0, |acc, x| acc + x)
        / sys.cpus().len() as f64;

    // Get disk usage
    let disk_percent = sysinfo::Disks::new_with_refreshed_list().iter()
        .map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();
            if total > 0 {
                ((total - available) as f64 / total as f64) * 100.0
            } else {
                0.0
            }
        })
        .fold(0.0, |acc, x| acc + x)
        / sysinfo::Disks::new_with_refreshed_list().len() as f64;

    // Network stats would require tracking over time
    // For now, return 0 (would need to track bytes sent/received between calls)
    let network_rx_mbps = 0.0;
    let network_tx_mbps = 0.0;

    ResourceUsage {
        cpu_percent,
        memory_percent: if memory_total > 0 {
            (memory_used as f64 / memory_total as f64) * 100.0
        } else {
            0.0
        },
        disk_percent,
        network_rx_mbps,
        network_tx_mbps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_websocket_config() {
        let config = WebSocketConfig {
            url: "wss://test.a2r.io".to_string(),
            node_id: "test-node".to_string(),
            auth_token: "test-token".to_string(),
            heartbeat_interval: Duration::from_secs(30),
        };
        
        assert_eq!(config.node_id, "test-node");
    }
}
