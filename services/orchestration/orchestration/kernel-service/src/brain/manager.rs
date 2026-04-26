use crate::brain::store::BrainStore;
use crate::brain::traits::{BrainDriver, BrainRuntime};
use crate::brain::types::{BrainConfig, BrainEvent, BrainSession, BrainType, EventMode, SessionStatus};
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use std::fmt;

pub struct BrainManager {
    drivers: Vec<Box<dyn BrainDriver>>,
    sessions: Arc<RwLock<HashMap<String, Arc<RwLock<Box<dyn BrainRuntime>>>>>>,
    session_metadata: Arc<RwLock<HashMap<String, BrainSession>>>,
    store: Option<Arc<BrainStore>>,
    integration_events: Option<broadcast::Sender<BrainEvent>>,
}

impl fmt::Debug for BrainManager {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("BrainManager")
            .field(
                "session_count",
                &futures::executor::block_on(async { self.sessions.read().await.len() }),
            )
            .finish()
    }
}

impl BrainManager {
    pub fn new() -> Self {
        Self {
            drivers: Vec::new(),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            session_metadata: Arc::new(RwLock::new(HashMap::new())),
            store: None,
            integration_events: None,
        }
    }

    pub fn with_integration_events(mut self, tx: broadcast::Sender<BrainEvent>) -> Self {
        self.integration_events = Some(tx);
        self
    }

    pub fn with_store(mut self, store: Arc<BrainStore>) -> Self {
        self.store = Some(store);
        self
    }

    pub fn register_driver(&mut self, driver: Box<dyn BrainDriver>) {
        self.drivers.push(driver);
    }

    pub async fn create_session(
        &self,
        mut config: BrainConfig,
        workspace_dir: Option<String>,
        profile_id: Option<String>,
        plan_id: Option<String>,
        prompt: Option<String>,
        source: Option<String>, // "chat" | "terminal" | "api"
    ) -> Result<BrainSession> {
        let session_id = Uuid::new_v4().to_string();
        let source = source.unwrap_or_else(|| "terminal".to_string());
        let event_mode_str = config.event_mode.as_ref()
            .map(|m| format!("{:?}", m).to_lowercase())
            .unwrap_or_else(|| "unknown".to_string());

        // EMIT SESSION STARTED FIRST (before any validation or driver operations)
        // This allows UI to assert invariants immediately, even if session fails
        if let Some(ref tx) = self.integration_events {
            tracing::info!("[BrainManager] Emitting SessionStarted: session_id={}, event_mode={}, source={}", 
                session_id, event_mode_str, source);
            let _ = tx.send(BrainEvent::SessionStarted {
                session_id: session_id.clone(),
                source: source.clone(),
                event_mode: event_mode_str.clone(),
                brain_profile_id: profile_id.clone().unwrap_or_else(|| config.id.clone()),
                event_id: None,
            });
        }

        // SOURCE GATING: Chat sessions CANNOT use terminal mode
        // Terminal mode is PTY-based and emits ANSI sequences unsuitable for chat UI
        if source == "chat" && config.event_mode == Some(EventMode::Terminal) {
            return Err(anyhow!(
                "Invalid configuration: Chat sessions cannot use Terminal event mode (was: {}). \
                 Terminal mode is PTY-based and emits ANSI sequences that break chat UI. \
                 Use EventMode::Acp or EventMode::Jsonl for chat sessions.",
                event_mode_str
            ));
        }

        // STRICT MODE: Terminal source should only use Terminal mode
        // This prevents accidentally launching protocol sessions in PTY view
        if source == "terminal" && config.event_mode != Some(EventMode::Terminal) && config.event_mode.is_some() {
            return Err(anyhow!(
                "Invalid configuration: Terminal source requires Terminal event mode (was: {}). \
                 Protocol sessions (ACP/JSONL) should use source:'chat' or source:'api'.",
                event_mode_str
            ));
        }

        // If a prompt is provided and prompt_arg is configured, append to args
        if let Some(prompt_text) = prompt {
            if let Some(ref prompt_arg) = config.prompt_arg {
                // Flag style: --flag "prompt"
                let mut args = config.args.take().unwrap_or_default();
                args.push(prompt_arg.clone());
                args.push(prompt_text);
                config.args = Some(args);
            } else {
                // Positional argument style (just append the prompt)
                let mut args = config.args.take().unwrap_or_default();
                args.push(prompt_text);
                config.args = Some(args);
            }
        }

        // Emit PTY initializing event
        if let Some(ref tx) = self.integration_events {
            let command = config.command.clone().unwrap_or_default();
            tracing::info!(
                "[BrainManager] Emitting IntegrationPtyInitializing for command: {}",
                command
            );
            let _ = tx.send(BrainEvent::IntegrationPtyInitializing {
                command,
                event_id: None,
            });
        }

        // Resolve workspace directory
        let resolved_workspace = if let Some(wd) = workspace_dir {
            wd
        } else {
            // Default to a folder in projects dir
            let projects_dir = std::env::var("PROJECTS_DIR").unwrap_or_else(|_| ".".to_string());
            let path = format!("{}/allternit-sessions/{}", projects_dir, session_id);
            std::fs::create_dir_all(&path)?;
            path
        };

        // Inject workspace_dir into config if not already set (drivers use config.cwd)
        if config.cwd.is_none() {
            config.cwd = Some(resolved_workspace.clone());
        }

        // Find suitable driver based on BOTH brain_type AND event_mode
        let driver = self
            .drivers
            .iter()
            .find(|d| d.supports_with_config(&config))
            .ok_or_else(|| anyhow!(
                "No driver found for brain type: {:?} with event mode: {:?}. \
                 Ensure event_mode is set correctly (acp/jsonl for chat, terminal for TUI only)",
                config.brain_type,
                config.event_mode
            ))?;

        let runtime = driver.create_runtime(&config, &session_id).await?;

        let session = BrainSession {
            id: session_id.clone(),
            brain_id: config.id.clone(),
            created_at: chrono::Utc::now().timestamp(),
            status: SessionStatus::Created,
            workspace_dir: resolved_workspace.clone(),
            profile_id,
            plan_id,
            conversation_state: None,
            pid: None,
        };

        self.sessions
            .write()
            .await
            .insert(session_id.clone(), Arc::new(RwLock::new(runtime)));

        // Start and update session
        let mut final_session = session;
        if let Some(runtime_lock) = self.sessions.read().await.get(&session_id) {
            let mut runtime = runtime_lock.write().await;
            runtime.start().await?;
            final_session.status = SessionStatus::Running;
            final_session.pid = runtime.pid();
        }

        // Emit PTY ready event
        if let Some(ref tx) = self.integration_events {
            if let Some(pid) = final_session.pid {
                tracing::info!(
                    "[BrainManager] Emitting IntegrationPtyReady for pid: {}",
                    pid
                );
                let _ = tx.send(BrainEvent::IntegrationPtyReady {
                    pid,
                    event_id: None,
                });
            }
        }

        // Emit dispatcher connected event
        if let Some(ref tx) = self.integration_events {
            let _ = tx.send(BrainEvent::IntegrationDispatcherConnected { event_id: None });
        }

        // Emit tools verified event (simulated - count based on brain type)
        if let Some(ref tx) = self.integration_events {
            let tool_count = match config.brain_type {
                BrainType::Cli => 15, // CLI has terminal, file, git, etc.
                BrainType::Api => 5,  // API has chat, vision, etc.
                BrainType::Local => 8,
            };
            let _ = tx.send(BrainEvent::IntegrationToolsVerified {
                count: tool_count,
                event_id: None,
            });
        }

        // Emit context synced event
        if let Some(ref tx) = self.integration_events {
            let _ = tx.send(BrainEvent::IntegrationContextSynced { event_id: None });
        }

        if let Some(store) = &self.store {
            store.upsert_session(&final_session).await?;
        }

        self.session_metadata
            .write()
            .await
            .insert(session_id.clone(), final_session.clone());

        // Emit integration complete event
        if let Some(ref tx) = self.integration_events {
            tracing::info!("[BrainManager] Emitting IntegrationComplete");
            let _ = tx.send(BrainEvent::IntegrationComplete { event_id: None });
        }

        Ok(final_session)
    }

    pub async fn attach_session(&self, session_id: &str) -> Result<BrainSession> {
        // 1. Check if already in memory
        if let Some(session) = self.get_session(session_id).await {
            return Ok(session);
        }

        // 2. Try to load from store
        if let Some(store) = &self.store {
            if let Some(mut session) = store.get_session(session_id).await? {
                // For CLI sessions: resume only if process still alive
                if let Some(pid) = session.pid {
                    if !self.is_process_alive(pid) {
                        session.status = SessionStatus::Exited;
                        store.upsert_session(&session).await?;
                        return Ok(session);
                    }
                }

                // TODO: Re-hydrate runtime if needed.
                // For now, if it's not in memory but in DB, we mark what we found.
                // Attaching to a dead process session just gives the metadata.

                self.session_metadata
                    .write()
                    .await
                    .insert(session_id.to_string(), session.clone());
                return Ok(session);
            }
        }

        Err(anyhow!("Session {} not found", session_id))
    }

    fn is_process_alive(&self, pid: u32) -> bool {
        // Simple check using kill -0
        let output = std::process::Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .output();

        match output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        }
    }

    pub async fn get_runtime(
        &self,
        session_id: &str,
    ) -> Option<Arc<RwLock<Box<dyn BrainRuntime>>>> {
        self.sessions.read().await.get(session_id).cloned()
    }

    pub async fn get_session(&self, session_id: &str) -> Option<BrainSession> {
        self.session_metadata.read().await.get(session_id).cloned()
    }

    pub async fn list_sessions(&self) -> Vec<BrainSession> {
        self.session_metadata
            .read()
            .await
            .values()
            .cloned()
            .collect()
    }

    pub async fn terminate_session(&self, session_id: &str) -> Result<()> {
        if let Some(runtime) = self.sessions.write().await.remove(session_id) {
            let mut runtime = runtime.write().await;
            runtime.stop().await?;

            if let Some(mut session) = self.session_metadata.write().await.get_mut(session_id) {
                session.status = SessionStatus::Terminated;
                if let Some(store) = &self.store {
                    store.upsert_session(&session).await?;
                }
            }
            Ok(())
        } else {
            Err(anyhow!("Session not found"))
        }
    }

    pub async fn sync_sessions(&self) -> Result<()> {
        let session_ids: Vec<String> = {
            let metadata = self.session_metadata.read().await;
            metadata.keys().cloned().collect()
        };

        for id in session_ids {
            if let Some(runtime_lock) = self.get_runtime(&id).await {
                let runtime = runtime_lock.read().await;
                let state = runtime.get_state().await?;

                let mut metadata = self.session_metadata.write().await;
                if let Some(session) = metadata.get_mut(&id) {
                    session.conversation_state = state;

                    // Update status if it's CLI and dead
                    if let Some(pid) = session.pid {
                        if !self.is_process_alive(pid) {
                            session.status = SessionStatus::Exited;
                        }
                    }

                    if let Some(store) = &self.store {
                        store.upsert_session(session).await?;
                    }
                }
            }
        }
        Ok(())
    }
}
