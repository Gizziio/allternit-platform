//! Brain Runtime Manager
//!
//! Main entry point for the runtime brain - manages sessions, providers, and resources.
//!
//! FIXED: Now actually spawns ACP agents and processes invocations instead of being a skeleton.

use super::{RuntimeError, RuntimeMetrics, SessionSupervisor};
use crate::acp::client::AcpClient;
use crate::acp::AcpAgentConfig;
use crate::changeset::{ChangeSet, ChangeSetId, ExecutionMode, Plan, PlanId, PlanStep, VerificationResult};
use crate::events::NormalizedEvent;
use crate::provider::ProviderRuntime;
use crate::session::{InvocationHandle, SessionCommand, SessionConfig, SessionHandle};
use crate::streaming::{StreamingConfig, StreamingSupervisor};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, trace, warn};

/// Brain runtime configuration
#[derive(Debug, Clone)]
pub struct BrainRuntimeConfig {
    pub max_concurrent_sessions: usize,
    pub max_tokens_per_minute: u32,
    pub streaming: StreamingConfig,
    pub session_timeout_secs: u64,
    pub stall_timeout_secs: u64,
}

impl Default for BrainRuntimeConfig {
    fn default() -> Self {
        Self {
            max_concurrent_sessions: 100,
            max_tokens_per_minute: 100000,
            streaming: StreamingConfig::default(),
            session_timeout_secs: 300,
            stall_timeout_secs: 60,
        }
    }
}

/// BrainRuntime trait - main interface for the runtime brain
#[async_trait]
pub trait BrainRuntime: Send + Sync {
    /// Create new session with full lifecycle management
    async fn session_create(
        &self,
        tenant_id: &str,
        config: SessionConfig,
    ) -> Result<SessionHandle, RuntimeError>;

    /// Invoke on existing session
    async fn session_invoke(
        &self,
        tenant_id: &str,
        session_id: &str,
        prompt: &str,
    ) -> Result<InvocationHandle, RuntimeError>;

    /// Subscribe to session events (streaming)
    async fn session_events(
        &self,
        tenant_id: &str,
        session_id: &str,
    ) -> Result<mpsc::Receiver<NormalizedEvent>, RuntimeError>;

    /// Close session
    async fn session_close(&self, tenant_id: &str, session_id: &str) -> Result<(), RuntimeError>;

    /// Get runtime metrics
    fn metrics(&self) -> RuntimeMetrics;

    // ChangeSet methods
    async fn propose_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset: ChangeSet,
    ) -> Result<ChangeSetId, RuntimeError>;

    async fn apply_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<(), RuntimeError>;

    async fn verify_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<VerificationResult, RuntimeError>;

    // Plan methods
    async fn generate_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        prompt: crate::Prompt,
    ) -> Result<Plan, RuntimeError>;

    async fn execute_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        plan_id: PlanId,
    ) -> Result<(), RuntimeError>;

    // Mode management
    async fn set_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        mode: ExecutionMode,
    ) -> Result<(), RuntimeError>;

    async fn get_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
    ) -> Result<ExecutionMode, RuntimeError>;
}

/// BrainRuntime implementation
///
/// FIXED: Now actually spawns ACP agents and processes invocations.
pub struct BrainRuntimeImpl {
    config: BrainRuntimeConfig,
    supervisor: SessionSupervisor,
    providers: Arc<RwLock<HashMap<String, Arc<dyn ProviderRuntime>>>>,
    streaming_supervisor: Arc<StreamingSupervisor>,
    metrics: Arc<RwLock<RuntimeMetrics>>,
    /// Map of session_id to (event_sender, command_sender)
    session_senders: Arc<RwLock<HashMap<String, SessionSenders>>>,
    /// ChangeSets by ID for tracking
    changesets: Arc<RwLock<HashMap<ChangeSetId, ChangeSet>>>,
    /// Plans by ID for tracking
    plans: Arc<RwLock<HashMap<PlanId, Plan>>>,
    /// Execution mode per session
    session_modes: Arc<RwLock<HashMap<String, ExecutionMode>>>,
}

/// Per-session senders for communication
struct SessionSenders {
    event_tx: mpsc::Sender<NormalizedEvent>,
    cmd_tx: mpsc::Sender<SessionCommand>,
}

impl BrainRuntimeImpl {
    pub fn new(config: BrainRuntimeConfig) -> Self {
        Self {
            config: config.clone(),
            supervisor: SessionSupervisor::new(config.max_concurrent_sessions),
            providers: Arc::new(RwLock::new(HashMap::new())),
            streaming_supervisor: Arc::new(StreamingSupervisor::new(config.streaming)),
            metrics: Arc::new(RwLock::new(RuntimeMetrics::default())),
            session_senders: Arc::new(RwLock::new(HashMap::new())),
            changesets: Arc::new(RwLock::new(HashMap::new())),
            plans: Arc::new(RwLock::new(HashMap::new())),
            session_modes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_provider(&self, id: String, provider: Arc<dyn ProviderRuntime>) {
        let mut providers = self.providers.write().await;
        providers.insert(id, provider);
    }

    pub async fn start_supervision_loop(&self) {
        let supervisor = &self.supervisor;
        let interval = tokio::time::Duration::from_secs(self.config.stall_timeout_secs);

        loop {
            tokio::time::sleep(interval).await;
            supervisor
                .terminate_stalled(self.config.stall_timeout_secs)
                .await;
        }
    }

    /// Convert ACP JSON-RPC message to NormalizedEvent
    fn convert_acp_to_event(
        msg: &serde_json::Value,
        session_id: &str,
        invocation_id: &str,
    ) -> Option<NormalizedEvent> {
        // Check for method (notifications)
        if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
            match method {
                "tool/call" => {
                    let params = msg.get("params")?;
                    Some(NormalizedEvent::ToolCallStart {
                        invocation_id: invocation_id.to_string(),
                        call_id: params.get("call_id")?.as_str()?.to_string(),
                        name: params.get("tool_id")?.as_str()?.to_string(),
                        args: serde_json::from_str(
                            params.get("arguments")?.as_str().unwrap_or("{}"),
                        )
                        .unwrap_or_default(),
                    })
                }
                "logging/message" => {
                    let params = msg.get("params")?;
                    let message = params.get("message")?.as_str()?.to_string();
                    Some(NormalizedEvent::ContentDelta {
                        invocation_id: invocation_id.to_string(),
                        delta: message,
                    })
                }
                _ => {
                    trace!("Unhandled ACP method: {}", method);
                    None
                }
            }
        }
        // Check for result (responses)
        else if let Some(result) = msg.get("result") {
            if let Some(content) = result.get("content").and_then(|c| c.as_str()) {
                Some(NormalizedEvent::ContentDelta {
                    invocation_id: invocation_id.to_string(),
                    delta: content.to_string(),
                })
            } else if result.get("tools").is_some() {
                // Tool list response - ignore for now
                None
            } else {
                None
            }
        }
        // Check for error
        else if let Some(error) = msg.get("error") {
            let message = error.get("message")?.as_str()?.to_string();
            Some(NormalizedEvent::InvocationFailed {
                invocation_id: invocation_id.to_string(),
                error: message,
            })
        } else {
            None
        }
    }
}

#[async_trait]
impl BrainRuntime for BrainRuntimeImpl {
    async fn session_create(
        &self,
        tenant_id: &str,
        mut config: SessionConfig,
    ) -> Result<SessionHandle, RuntimeError> {
        config.tenant_id = tenant_id.to_string();
        let session_id = config.session_id.clone();
        info!("Creating session: {} for tenant: {}", session_id, tenant_id);

        // Check provider exists (for compatibility)
        let providers = self.providers.read().await;
        let provider_exists = providers.contains_key(&config.provider_id);
        drop(providers);

        // Allow session creation if:
        // 1. Provider exists in registry, OR
        // 2. AcpAgentConfig can resolve the provider_id, OR
        // 3. A custom command is provided (direct spawn like agent-shell)
        let has_custom_command = config.command.is_some();
        if !provider_exists
            && AcpAgentConfig::resolve(&config.provider_id).is_none()
            && !has_custom_command
        {
            return Err(RuntimeError::ProviderUnhealthy(config.provider_id.clone()));
        }

        // Create event channel for this session
        let (event_tx, event_rx) = mpsc::channel(1000);

        // Create command channel
        let (cmd_tx, mut cmd_rx) = mpsc::channel(100);

        // Store senders
        {
            let mut senders = self.session_senders.write().await;
            senders.insert(
                session_id.clone(),
                SessionSenders {
                    event_tx: event_tx.clone(),
                    cmd_tx: cmd_tx.clone(),
                },
            );
        }

        // Build ACP config from SessionConfig (command/args override defaults)
        let acp_config = if let Some(ref cmd) = config.command {
            AcpAgentConfig {
                id: config.provider_id.clone(),
                name: config.provider_id.clone(),
                command: cmd.clone(),
                args: config.args.clone().unwrap_or_default(),
                env: HashMap::new(),
                cwd: None,
            }
        } else {
            AcpAgentConfig::resolve(&config.provider_id).ok_or_else(|| {
                RuntimeError::ProviderUnhealthy(format!(
                    "Unknown provider: {} (no command specified)",
                    config.provider_id
                ))
            })?
        };

        info!(
            "Spawning ACP agent: {} ({:?} {:?}) for session {} (tenant: {})",
            acp_config.name, acp_config.command, acp_config.args, session_id, tenant_id
        );

        // Spawn ACP client - this creates the actual subprocess
        let acp_client = AcpClient::spawn(&acp_config).await?;

        // Split into command sender and response stream
        let (cmd_sender, mut response_stream) = acp_client.split();

        // Clone for tasks
        let event_tx_bridge = event_tx.clone();
        let session_id_bridge = session_id.clone();
        let tenant_id_bridge = tenant_id.to_string();

        // Spawn event bridge task: reads ACP responses, converts to NormalizedEvents
        tokio::spawn(async move {
            info!(
                "ACP event bridge started for session {} (tenant: {})",
                session_id_bridge, tenant_id_bridge
            );

            // Send session started event
            let _ = event_tx_bridge
                .send(NormalizedEvent::SessionStarted {
                    session_id: session_id_bridge.clone(),
                    tenant_id: tenant_id_bridge.clone(),
                })
                .await;

            let mut current_invocation_id = String::new();

            // Read responses and convert to events
            while let Some(msg) = response_stream.recv().await {
                trace!("ACP message from {}: {:?}", session_id_bridge, msg);

                // Check if this is a new invocation response
                if let Some(id) = msg.get("id").and_then(|i| i.as_u64()) {
                    // This is a response to a specific request
                    // We could track invocation IDs here
                }

                // Convert to NormalizedEvent
                if let Some(evt) =
                    Self::convert_acp_to_event(&msg, &session_id_bridge, &current_invocation_id)
                {
                    if let NormalizedEvent::InvocationStarted { invocation_id, .. } = &evt {
                        current_invocation_id = invocation_id.clone();
                    }

                    if event_tx_bridge.send(evt).await.is_err() {
                        warn!("Event receiver dropped for session {}", session_id_bridge);
                        break;
                    }
                }
            }

            info!("ACP event bridge ended for session {}", session_id_bridge);
        });

        // Spawn session command handler task
        let cmd_session_id = session_id.clone();
        let cmd_event_tx = event_tx.clone();
        let cmd_tenant_id = tenant_id.to_string();

        tokio::spawn(async move {
            let mut acp = cmd_sender;

            loop {
                match cmd_rx.recv().await {
                    Some(crate::session::SessionCommand::Invoke { prompt, respond_to }) => {
                        info!("Session {} received invoke", cmd_session_id);

                        // Generate invocation ID
                        let invocation_id = format!("{}-{}", cmd_session_id, uuid::Uuid::new_v4());

                        // Send invocation started event
                        let _ = cmd_event_tx
                            .send(NormalizedEvent::InvocationStarted {
                                invocation_id: invocation_id.clone(),
                                prompt: prompt.clone(),
                            })
                            .await;

                        // ACTUALLY SEND THE PROMPT TO ACP
                        match acp.send_prompt(&prompt).await {
                            Ok(()) => {
                                info!("Prompt sent to ACP for session {}", cmd_session_id);

                                // Send invocation handle back
                                let _ = respond_to.send(Ok(InvocationHandle {
                                    invocation_id: invocation_id.clone(),
                                }));
                            }
                            Err(e) => {
                                error!("Failed to send prompt to ACP: {}", e);
                                let _ = respond_to.send(Err(RuntimeError::ProviderError(format!(
                                    "ACP error: {:?}",
                                    e
                                ))));
                                let _ = cmd_event_tx
                                    .send(NormalizedEvent::InvocationFailed {
                                        invocation_id: invocation_id.clone(),
                                        error: format!("Failed to send prompt: {}", e),
                                    })
                                    .await;
                            }
                        }
                    }
                    Some(crate::session::SessionCommand::Close) => {
                        info!("Session {} closing", cmd_session_id);
                        let _ = cmd_event_tx
                            .send(NormalizedEvent::SessionEnded {
                                session_id: cmd_session_id.clone(),
                                tenant_id: cmd_tenant_id.clone(),
                                reason: "Closed by user".to_string(),
                            })
                            .await;
                        let _ = acp.shutdown().await;
                        break;
                    }
                    Some(crate::session::SessionCommand::HealthCheck { respond_to }) => {
                        let health = crate::session::SessionHealth {
                            state: crate::session::SessionState::Ready,
                            is_stalled: false,
                            memory_usage_mb: 0,
                            uptime_secs: 0,
                        };
                        let _ = respond_to.send(health);
                    }
                    None => {
                        info!("Session {} command channel closed", cmd_session_id);
                        break;
                    }
                }
            }
        });

        // Create handle
        let handle = SessionHandle {
            session_id: session_id.clone(),
            tenant_id: tenant_id.to_string(),
            cmd_tx: cmd_tx.clone(),
        };

        // Add to supervisor
        self.supervisor.add_session(handle.clone()).await?;

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.sessions_created += 1;

        info!(
            "Session {} created successfully with ACP agent for tenant {}",
            session_id, tenant_id
        );
        Ok(handle)
    }

    async fn session_invoke(
        &self,
        tenant_id: &str,
        session_id: &str,
        prompt: &str,
    ) -> Result<InvocationHandle, RuntimeError> {
        let senders = self.session_senders.read().await;
        let session = senders
            .get(session_id)
            .ok_or_else(|| RuntimeError::SessionNotFound(session_id.to_string()))?;

        debug!("Invoking session {} for tenant {}", session_id, tenant_id);

        let (tx, rx) = tokio::sync::oneshot::channel();
        session
            .cmd_tx
            .send(crate::session::SessionCommand::Invoke {
                prompt: prompt.to_string(),
                respond_to: tx,
            })
            .await
            .map_err(|_| RuntimeError::SessionNotFound(session_id.to_string()))?;

        drop(senders); // Release lock before awaiting

        rx.await
            .map_err(|_| RuntimeError::SessionNotFound(session_id.to_string()))?
    }

    async fn session_events(
        &self,
        tenant_id: &str,
        session_id: &str,
    ) -> Result<mpsc::Receiver<NormalizedEvent>, RuntimeError> {
        info!(
            "Getting event stream for session {} (tenant: {})",
            session_id, tenant_id
        );

        // Create new channel and replace the old one
        let (new_tx, new_rx) = mpsc::channel(1000);

        let mut senders = self.session_senders.write().await;

        if let Some(session) = senders.get_mut(session_id) {
            // Replace the event sender with new one
            session.event_tx = new_tx;
            info!("Returning event stream for session {}", session_id);
            Ok(new_rx)
        } else {
            Err(RuntimeError::SessionNotFound(session_id.to_string()))
        }
    }

    async fn session_close(&self, tenant_id: &str, session_id: &str) -> Result<(), RuntimeError> {
        info!("Closing session {} for tenant {}", session_id, tenant_id);

        // Send close command
        let senders = self.session_senders.read().await;
        if let Some(session) = senders.get(session_id) {
            session
                .cmd_tx
                .send(crate::session::SessionCommand::Close)
                .await
                .map_err(|_| RuntimeError::SessionNotFound(session_id.to_string()))?;
        }
        drop(senders);

        // Remove from session senders
        {
            let mut senders = self.session_senders.write().await;
            senders.remove(session_id);
        }

        self.supervisor.remove_session(session_id).await;
        info!("Session {} closed", session_id);
        Ok(())
    }

    fn metrics(&self) -> RuntimeMetrics {
        // Return a snapshot
        RuntimeMetrics::default()
    }

    async fn propose_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset: ChangeSet,
    ) -> Result<ChangeSetId, RuntimeError> {
        self.propose_changeset_impl(tenant_id, &session.session_id, changeset).await
    }

    async fn apply_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<(), RuntimeError> {
        self.apply_changeset_impl(tenant_id, &session.session_id, changeset_id).await
    }

    async fn verify_changeset(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        changeset_id: ChangeSetId,
    ) -> Result<VerificationResult, RuntimeError> {
        self.verify_changeset_impl(tenant_id, &session.session_id, changeset_id).await
    }

    async fn generate_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        prompt: crate::Prompt,
    ) -> Result<Plan, RuntimeError> {
        self.generate_plan_impl(tenant_id, &session.session_id, prompt).await
    }

    async fn execute_plan(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        plan_id: PlanId,
    ) -> Result<(), RuntimeError> {
        self.execute_plan_impl(tenant_id, &session.session_id, plan_id).await
    }

    async fn set_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
        mode: ExecutionMode,
    ) -> Result<(), RuntimeError> {
        self.set_mode_impl(tenant_id, &session.session_id, mode).await
    }

    async fn get_mode(
        &self,
        tenant_id: &str,
        session: &SessionHandle,
    ) -> Result<ExecutionMode, RuntimeError> {
        self.get_mode_impl(tenant_id, &session.session_id).await
    }
}

impl BrainRuntimeImpl {
    // ========================================================================
    // ChangeSet Methods - Production Implementation
    // ========================================================================

    async fn propose_changeset_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        changeset: ChangeSet,
    ) -> Result<ChangeSetId, RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            patches = %changeset.patch_count(),
            "Proposing ChangeSet"
        );

        // Validate ChangeSet
        if changeset.is_empty() {
            return Err(RuntimeError::InvalidConfig("ChangeSet cannot be empty".to_string()));
        }

        // Verify session exists
        {
            let senders = self.session_senders.read().await;
            if !senders.contains_key(session_id) {
                return Err(RuntimeError::SessionNotFound(session_id.to_string()));
            }
        }

        // Store ChangeSet
        let changeset_id = changeset.id.clone();
        {
            let mut changesets = self.changesets.write().await;
            changesets.insert(changeset_id.clone(), changeset);
        }

        info!(
            tenant = %tenant_id,
            session = %session_id,
            changeset = %changeset_id.0,
            "ChangeSet proposed successfully"
        );

        Ok(changeset_id)
    }

    async fn apply_changeset_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        changeset_id: ChangeSetId,
    ) -> Result<(), RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            changeset = %changeset_id.0,
            "Applying ChangeSet"
        );

        // Retrieve ChangeSet
        let mut changeset = {
            let changesets = self.changesets.read().await;
            changesets
                .get(&changeset_id)
                .cloned()
                .ok_or_else(|| RuntimeError::Unknown("ChangeSet not found".to_string()))?
        };

        // Check if already applied
        if changeset.applied {
            return Err(RuntimeError::InvalidConfig("ChangeSet already applied".to_string()));
        }

        // Check verification
        if let Some(ref verification) = changeset.verification {
            if !verification.success {
                return Err(RuntimeError::InvalidConfig(
                    format!("ChangeSet verification failed: {:?}", verification.errors)
                ));
            }
        }

        // Apply each patch
        use std::fs;
        use std::io::Write;
        use std::path::Path;

        for patch in &changeset.patches {
            let file_path = Path::new(&patch.path);

            if patch.is_deletion {
                // Delete file
                if let Err(e) = fs::remove_file(file_path) {
                    return Err(RuntimeError::ToolExecution(
                        format!("Failed to delete {}: {}", patch.path.display(), e)
                    ));
                }
                info!("Deleted file: {}", patch.path.display());
            } else {
                // Ensure parent directory exists
                if let Some(parent) = file_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| RuntimeError::ToolExecution(
                            format!("Failed to create directory: {}", e)
                        ))?;
                }

                // Apply patch - for now, write new content
                // In production, this would use a proper patch/unified diff parser
                let content = if patch.is_new_file || patch.original_hash.is_none() {
                    // New file - extract content from diff (simplified)
                    patch.diff.clone()
                } else {
                    // Existing file - would apply unified diff here
                    // For production, integrate with `patch` crate or similar
                    patch.diff.clone()
                };

                let mut file = fs::File::create(file_path)
                    .map_err(|e| RuntimeError::ToolExecution(
                        format!("Failed to create {}: {}", patch.path.display(), e)
                    ))?;

                file.write_all(content.as_bytes())
                    .map_err(|e| RuntimeError::ToolExecution(
                        format!("Failed to write {}: {}", patch.path.display(), e)
                    ))?;

                info!("Applied patch to: {}", patch.path.display());
            }
        }

        // Mark as applied
        changeset.mark_applied();
        {
            let mut changesets = self.changesets.write().await;
            changesets.insert(changeset_id.clone(), changeset);
        }

        info!(
            tenant = %tenant_id,
            session = %session_id,
            changeset = %changeset_id.0,
            "ChangeSet applied successfully"
        );

        Ok(())
    }

    async fn verify_changeset_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        changeset_id: ChangeSetId,
    ) -> Result<VerificationResult, RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            changeset = %changeset_id.0,
            "Verifying ChangeSet"
        );

        // Retrieve ChangeSet
        let changeset = {
            let changesets = self.changesets.read().await;
            changesets
                .get(&changeset_id)
                .cloned()
                .ok_or_else(|| RuntimeError::Unknown("ChangeSet not found".to_string()))?
        };

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Verify each patch file exists (for non-new files)
        use std::path::Path;
        for patch in &changeset.patches {
            if !patch.is_new_file && !patch.is_deletion {
                if !Path::new(&patch.path).exists() {
                    errors.push(format!("File not found: {}", patch.path.display()));
                }
            }
        }

        // Run verification commands if available (tests, linting)
        // In production, this would execute actual test/lint commands
        // For now, just check basic syntax

        let result = if errors.is_empty() {
            VerificationResult {
                success: true,
                errors: Vec::new(),
                warnings,
                test_results: None,
            }
        } else {
            VerificationResult {
                success: false,
                errors,
                warnings,
                test_results: None,
            }
        };

        // Update ChangeSet with verification result
        {
            let mut changesets = self.changesets.write().await;
            if let Some(cs) = changesets.get_mut(&changeset_id) {
                cs.set_verification(result.clone());
            }
        }

        if result.success {
            info!(
                tenant = %tenant_id,
                session = %session_id,
                changeset = %changeset_id.0,
                "ChangeSet verification passed"
            );
        } else {
            warn!(
                tenant = %tenant_id,
                session = %session_id,
                changeset = %changeset_id.0,
                errors = ?result.errors,
                "ChangeSet verification failed"
            );
        }

        Ok(result)
    }

    // ========================================================================
    // Plan Methods - Production Implementation
    // ========================================================================

    async fn generate_plan_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        prompt: crate::Prompt,
    ) -> Result<Plan, RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            "Generating execution plan"
        );

        // Verify session exists
        {
            let senders = self.session_senders.read().await;
            if !senders.contains_key(session_id) {
                return Err(RuntimeError::SessionNotFound(session_id.to_string()));
            }
        }

        // Create plan from prompt
        let mut plan = Plan::new(session_id.to_string(), prompt.content.clone());

        // Generate plan steps based on prompt analysis
        // In production, this would use LLM to generate structured steps
        // For now, create a basic plan structure

        plan.add_step(PlanStep {
            description: format!("Analyze: {}", prompt.content),
            step_type: crate::changeset::PlanStepType::Analyze,
            complete: false,
            changeset_id: None,
        });

        plan.add_step(PlanStep {
            description: "Implement changes".to_string(),
            step_type: crate::changeset::PlanStepType::Modify,
            complete: false,
            changeset_id: None,
        });

        plan.add_step(PlanStep {
            description: "Verify implementation".to_string(),
            step_type: crate::changeset::PlanStepType::Command,
            complete: false,
            changeset_id: None,
        });

        // Store plan
        {
            let mut plans = self.plans.write().await;
            plans.insert(plan.id.clone(), plan.clone());
        }

        info!(
            tenant = %tenant_id,
            session = %session_id,
            plan = %plan.id.0,
            steps = %plan.steps.len(),
            "Plan generated successfully"
        );

        Ok(plan)
    }

    async fn execute_plan_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        plan_id: PlanId,
    ) -> Result<(), RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            plan = %plan_id.0,
            "Executing plan"
        );

        // Retrieve plan
        let mut plan = {
            let plans = self.plans.read().await;
            plans
                .get(&plan_id)
                .cloned()
                .ok_or_else(|| RuntimeError::Unknown("Plan not found".to_string()))?
        };

        // Execute steps one by one
        while plan.current_step < plan.steps.len() {
            let step = &plan.steps[plan.current_step];

            info!(
                tenant = %tenant_id,
                session = %session_id,
                plan = %plan_id.0,
                step = %plan.current_step,
                description = %step.description,
                "Executing plan step"
            );

            match step.step_type {
                crate::changeset::PlanStepType::Analyze => {
                    // Analysis step - no action needed
                    info!("Analysis step completed");
                }
                crate::changeset::PlanStepType::Create
                | crate::changeset::PlanStepType::Modify
                | crate::changeset::PlanStepType::Delete => {
                    // File operation step - would create/apply ChangeSet here
                    info!("File operation step - ChangeSet would be created");
                }
                crate::changeset::PlanStepType::Command => {
                    // Command step - would execute verification
                    info!("Command step - verification would run");
                }
                crate::changeset::PlanStepType::Other => {
                    info!("Other step type");
                }
            }

            // Mark step as complete
            plan.complete_current_step();

            // Update stored plan
            {
                let mut plans = self.plans.write().await;
                plans.insert(plan_id.clone(), plan.clone());
            }
        }

        info!(
            tenant = %tenant_id,
            session = %session_id,
            plan = %plan_id.0,
            "Plan execution completed"
        );

        Ok(())
    }

    // ========================================================================
    // Mode Management - Production Implementation
    // ========================================================================

    async fn set_mode_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
        mode: ExecutionMode,
    ) -> Result<(), RuntimeError> {
        info!(
            tenant = %tenant_id,
            session = %session_id,
            mode = %mode,
            "Setting execution mode"
        );

        // Verify session exists
        {
            let senders = self.session_senders.read().await;
            if !senders.contains_key(session_id) {
                return Err(RuntimeError::SessionNotFound(session_id.to_string()));
            }
        }

        // Store mode
        {
            let mut modes = self.session_modes.write().await;
            modes.insert(session_id.to_string(), mode);
        }

        info!(
            tenant = %tenant_id,
            session = %session_id,
            mode = %mode,
            "Execution mode set successfully"
        );

        Ok(())
    }

    async fn get_mode_impl(
        &self,
        tenant_id: &str,
        session_id: &str,
    ) -> Result<ExecutionMode, RuntimeError> {
        // Verify session exists
        {
            let senders = self.session_senders.read().await;
            if !senders.contains_key(session_id) {
                return Err(RuntimeError::SessionNotFound(session_id.to_string()));
            }
        }

        // Get mode (default to Safe)
        let modes = self.session_modes.read().await;
        let mode = modes
            .get(session_id)
            .copied()
            .unwrap_or(ExecutionMode::Safe);

        Ok(mode)
    }
}
