//! Allternit Runtime Adapter
//!
//! This module integrates allternit-runtime into kernel-service.
//! It adapts kernel-service's BrainRuntime trait to use allternit-runtime's production brain.

use crate::brain::traits::BrainRuntime as KernelBrainRuntime;
use crate::brain::types::{BrainConfig, BrainEvent, BrainType, EventMode, SessionStatus};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use tracing::{debug, error, info, warn};

// Import allternit-runtime traits and types (re-exported from supervision module)
use allternit_runtime::supervision::{BrainRuntime as AllternitBrainRuntime, BrainRuntimeImpl, BrainRuntimeConfig, SessionSupervisor};

/// Adapter that wraps allternit-runtime to implement kernel-service's BrainRuntime trait
pub struct AllternitRuntimeAdapter {
    /// The underlying allternit-runtime implementation
    runtime: Arc<BrainRuntimeImpl>,
    
    /// Session handle for this adapter instance
    session_handle: Arc<RwLock<Option<allternit_runtime::session::SessionHandle>>>,
    
    /// Event sender for BrainEvent (kernel-service format)
    event_tx: broadcast::Sender<BrainEvent>,
    
    /// Configuration
    config: BrainConfig,
    
    /// Session ID
    session_id: String,
    
    /// Process ID (simulated for compatibility)
    pid: Option<u32>,
}

impl AllternitRuntimeAdapter {
    /// Create a new runtime adapter
    pub fn new(
        config: BrainConfig,
        session_id: String,
        event_tx: broadcast::Sender<BrainEvent>,
    ) -> Self {
        // Create the actual allternit-runtime with default config
        let runtime_config = BrainRuntimeConfig::default();
        let runtime = Arc::new(BrainRuntimeImpl::new(runtime_config));
        
        Self {
            runtime,
            session_handle: Arc::new(RwLock::new(None)),
            event_tx,
            config,
            session_id: session_id.clone(),
            pid: Some(1000 + session_id.len() as u32), // Simulated PID
        }
    }
    
    /// Convert kernel-service BrainConfig to allternit-runtime SessionConfig
    fn to_session_config(&self) -> allternit_runtime::session::SessionConfig {
        allternit_runtime::session::SessionConfig {
            session_id: self.session_id.clone(),
            tenant_id: self.config.tenant_id.clone().unwrap_or_else(|| "default".to_string()),
            provider_id: self.config.id.clone(),
            model_id: self.config.model.clone(),
            max_tool_calls: 50,
            tool_timeout_secs: 30,
            command: self.config.command.clone(),
            args: self.config.args.clone(),
        }
    }
    
    /// Convert kernel-service input to allternit-runtime Prompt
    fn to_prompt(&self, input: &str) -> allternit_runtime::Prompt {
        allternit_runtime::Prompt::new(input)
            .with_stream(true)
    }
    
    /// Spawn event translator task
    fn spawn_event_translator(
        &self,
        mut rx: mpsc::Receiver<allternit_runtime::events::NormalizedEvent>,
    ) {
        let event_tx = self.event_tx.clone();
        let session_id = self.session_id.clone();
        
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let Some(brain_event) = Self::translate_event(&session_id, event) {
                    if let Err(e) = event_tx.send(brain_event) {
                        warn!("Failed to forward event: {}", e);
                        break;
                    }
                }
            }
            debug!("Event translator stopped for session {}", session_id);
        });
    }
    
    /// Translate allternit-runtime NormalizedEvent to kernel-service BrainEvent
    fn translate_event(session_id: &str, event: allternit_runtime::events::NormalizedEvent) -> Option<BrainEvent> {
        use allternit_runtime::events::NormalizedEvent;
        
        match event {
            NormalizedEvent::ContentDelta { delta, .. } => {
                Some(BrainEvent::ChatDelta {
                    text: delta,
                    event_id: None,
                })
            }
            NormalizedEvent::ToolCallStart { call_id, name, args, .. } => {
                Some(BrainEvent::ToolCall {
                    tool_id: name,
                    call_id,
                    args: args.to_string(),
                    event_id: None,
                })
            }
            NormalizedEvent::ToolCallCompleted { call_id, result, .. } => {
                Some(BrainEvent::ToolResult {
                    tool_id: String::new(),
                    call_id,
                    result: result.to_string(),
                    event_id: None,
                })
            }
            NormalizedEvent::InvocationCompleted { .. } => {
                Some(BrainEvent::ChatMessageCompleted {
                    text: String::new(),
                    event_id: None,
                })
            }
            NormalizedEvent::SessionError { error, .. } => {
                Some(BrainEvent::Error {
                    message: error,
                    code: None,
                    event_id: None,
                })
            }
            _ => None,
        }
    }
}

#[async_trait]
impl KernelBrainRuntime for AllternitRuntimeAdapter {
    async fn start(&mut self) -> Result<()> {
        info!("Starting Allternit runtime for session {}", self.session_id);
        
        // Create session config
        let session_config = self.to_session_config();
        let tenant_id = self.config.tenant_id.clone().unwrap_or_else(|| "default".to_string());
        
        // Create the session using allternit-runtime
        let handle = self.runtime.session_create(&tenant_id, session_config).await.map_err(|e| {
            anyhow!("Failed to create allternit-runtime session: {:?}", e)
        })?;
        
        // Store the handle
        *self.session_handle.write().await = Some(handle);
        
        // Start event streaming
        if let Some(ref handle) = *self.session_handle.read().await {
            match self.runtime.session_events(&tenant_id, &handle.session_id).await {
                Ok(event_rx) => {
                    self.spawn_event_translator(event_rx);
                }
                Err(e) => {
                    warn!("Failed to start event stream: {:?}", e);
                }
            }
        }
        
        // Emit started event
        let event_mode_str = self.config.event_mode.as_ref()
            .map(|m| format!("{:?}", m).to_lowercase())
            .unwrap_or_else(|| "unknown".to_string());
            
        let _ = self.event_tx.send(BrainEvent::SessionStarted {
            session_id: self.session_id.clone(),
            source: "agent-shell".to_string(),
            event_mode: event_mode_str,
            brain_profile_id: self.config.id.clone(),
            event_id: None,
        });
        
        // Emit session created event
        let _ = self.event_tx.send(BrainEvent::SessionCreated {
            session_id: self.session_id.clone(),
            event_id: None,
        });
        
        info!("Allternit runtime started for session {}", self.session_id);
        Ok(())
    }
    
    async fn send_input(&mut self, input: &str) -> Result<()> {
        let handle = self.session_handle.read().await.clone();
        let tenant_id = self.config.tenant_id.clone().unwrap_or_else(|| "default".to_string());
        
        match handle {
            Some(ref session_handle) => {
                debug!("Sending input to session {}: {}", self.session_id, input);
                
                // Create prompt
                let _prompt = self.to_prompt(input);
                
                // Invoke the session
                match self.runtime.session_invoke(&tenant_id, &session_handle.session_id, input).await {
                    Ok(_invocation) => {
                        // Invocation started, events will come through the event stream
                        Ok(())
                    }
                    Err(e) => {
                        error!("Failed to send input: {:?}", e);
                        Err(anyhow!("Failed to send input: {:?}", e))
                    }
                }
            }
            None => {
                Err(anyhow!("Session not initialized - call start() first"))
            }
        }
    }
    
    async fn stop(&mut self) -> Result<()> {
        info!("Stopping Allternit runtime for session {}", self.session_id);
        let tenant_id = self.config.tenant_id.clone().unwrap_or_else(|| "default".to_string());
        
        if let Some(ref handle) = *self.session_handle.read().await {
            if let Err(e) = self.runtime.session_close(&tenant_id, &handle.session_id).await {
                warn!("Error closing session: {:?}", e);
            }
        }
        
        *self.session_handle.write().await = None;
        
        let _ = self.event_tx.send(BrainEvent::SessionStatus {
            status: SessionStatus::Terminated,
            event_id: None,
        });
        
        Ok(())
    }
    
    fn subscribe(&self) -> broadcast::Receiver<BrainEvent> {
        self.event_tx.subscribe()
    }
    
    async fn health_check(&self) -> Result<bool> {
        let has_handle = self.session_handle.read().await.is_some();
        Ok(has_handle)
    }
    
    fn pid(&self) -> Option<u32> {
        self.pid
    }
    
    async fn get_state(&self) -> Result<Option<serde_json::Value>> {
        let handle = self.session_handle.read().await;
        
        let status = if handle.is_some() {
            "running"
        } else {
            "stopped"
        };
        
        Ok(Some(serde_json::json!({
            "status": status,
            "session_id": self.session_id,
            "has_session": handle.is_some(),
        })))
    }
    
    async fn send_tool_result(&self, tool_call_id: &str, result: serde_json::Value) -> Result<()> {
        info!(
            "Sending tool result for session {}, tool_call_id: {}",
            self.session_id, tool_call_id
        );
        
        let handle = self.session_handle.read().await.clone();
        
        match handle {
            Some(session_handle) => {
                // Create tool result
                let tool_result = allternit_runtime::ToolResult {
                    call_id: tool_call_id.to_string(),
                    content: result.to_string(),
                    is_error: false,
                };
                
                // Send to runtime
                // Note: The allternit-runtime BrainRuntime trait in lib.rs has send_tool_result
                // But the supervision::manager BrainRuntime doesn't expose it directly
                // We emit an event instead
                let _ = self.event_tx.send(BrainEvent::ToolResult {
                    tool_id: String::new(),
                    call_id: tool_call_id.to_string(),
                    result: result.to_string(),
                    event_id: None,
                });
                
                Ok(())
            }
            None => {
                Err(anyhow!("Session not initialized"))
            }
        }
    }
}

/// Factory for creating Allternit runtime adapters
pub struct AllternitRuntimeDriver;

impl AllternitRuntimeDriver {
    pub fn new() -> Self {
        Self
    }
}

impl Default for AllternitRuntimeDriver {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::brain::traits::BrainDriver for AllternitRuntimeDriver {
    async fn create_runtime(
        &self,
        config: &BrainConfig,
        session_id: &str,
    ) -> Result<Box<dyn KernelBrainRuntime>> {
        let (event_tx, _event_rx) = broadcast::channel(1000);
        
        let adapter = AllternitRuntimeAdapter::new(
            config.clone(),
            session_id.to_string(),
            event_tx,
        );
        
        Ok(Box::new(adapter))
    }
    
    fn supports(&self, brain_type: &BrainType) -> bool {
        matches!(brain_type, BrainType::Api | BrainType::Cli)
    }
    
    fn supports_with_config(&self, config: &BrainConfig) -> bool {
        matches!(
            config.event_mode,
            Some(EventMode::Acp) | Some(EventMode::Api) | None
        )
    }
}
