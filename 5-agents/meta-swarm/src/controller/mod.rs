use crate::config::MetaSwarmConfig;
use crate::error::{SwarmError, SwarmResult};
use crate::knowledge::{KnowledgeStore, PatternStore, SolutionArchive};
use crate::modes::{claudeswarm::ClaudeSwarmMode, closedloop::ClosedLoopMode, swarmagentic::AutoArchitectMode};
use crate::router::{ModeRouter, RoutingDecision};
use crate::types::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

pub mod progress;
pub mod session;

pub use progress::{ProgressTracker, ProgressUpdate};
pub use session::{Session, SessionManager};

/// Main controller for the meta-swarm system
pub struct MetaSwarmController {
    config: MetaSwarmConfig,
    router: ModeRouter,
    knowledge_store: Arc<dyn KnowledgeStore>,
    sessions: Arc<RwLock<SessionManager>>,
    progress_tx: mpsc::Sender<ProgressUpdate>,
    
    // Mode implementations
    swarmagentic_mode: AutoArchitectMode,
    claudeswarm_mode: ClaudeSwarmMode,
    closedloop_mode: ClosedLoopMode,
}

impl MetaSwarmController {
    /// Create a new controller
    pub async fn new(config: MetaSwarmConfig) -> SwarmResult<Self> {
        let (progress_tx, _progress_rx) = mpsc::channel(1000);
        
        let router = ModeRouter::new(&config.routing);
        let knowledge_store = Arc::new(crate::knowledge::InMemoryKnowledgeStore::new());
        let sessions = Arc::new(RwLock::new(SessionManager::new()));

        // Initialize modes
        let swarmagentic_mode = AutoArchitectMode::new(
            config.mode_config(SwarmMode::SwarmAgentic),
            knowledge_store.clone(),
        )?;

        let claudeswarm_mode = ClaudeSwarmMode::new(
            config.mode_config(SwarmMode::ClaudeSwarm),
            knowledge_store.clone(),
        )?;

        let closedloop_mode = ClosedLoopMode::new(
            config.mode_config(SwarmMode::ClosedLoop),
            knowledge_store.clone(),
        )?;

        Ok(Self {
            config,
            router,
            knowledge_store,
            sessions,
            progress_tx,
            swarmagentic_mode,
            claudeswarm_mode,
            closedloop_mode,
        })
    }

    /// Submit a task for processing
    pub async fn submit_task(&self, task: Task) -> SwarmResult<TaskHandle> {
        info!("Submitting task: {}", task.id());

        // Create session
        let mut session_manager = self.sessions.write().await;
        let session = session_manager.create_session(task.id());
        let session_id = session.id();
        drop(session_manager);

        // Analyze and route
        let routing_decision = self.router.route(&task, &*self.knowledge_store).await?;
        info!(
            "Task {} routed to {:?} with confidence {:.2}",
            task.id(),
            routing_decision.mode,
            routing_decision.confidence
        );

        // Create handle
        let handle = TaskHandle {
            task_id: task.id(),
            session_id,
            mode: routing_decision.mode,
        };

        // Execute based on mode
        let controller_ref = Arc::new(self.clone_for_execution());
        let task_id = task.id();
        let mode = routing_decision.mode;

        tokio::spawn(async move {
            if let Err(e) = controller_ref.execute_task(task, mode).await {
                error!("Task {} execution failed: {}", task_id, e);
            }
        });

        Ok(handle)
    }

    /// Execute a task using the specified mode
    async fn execute_task(&self, task: Task, mode: SwarmMode) -> SwarmResult<ExecutionResult> {
        info!("Executing task {} with mode {:?}", task.id(), mode);

        let result = match mode {
            SwarmMode::SwarmAgentic => {
                self.swarmagentic_mode.execute(task).await
            }
            SwarmMode::ClaudeSwarm => {
                self.claudeswarm_mode.execute(task).await
            }
            SwarmMode::ClosedLoop => {
                self.closedloop_mode.execute(task).await
            }
            SwarmMode::Hybrid => {
                self.execute_hybrid(task).await
            }
        };

        // Store result in knowledge base if successful
        if let Ok(ref exec_result) = result {
            if exec_result.is_success() {
                if let Err(e) = self.store_execution_knowledge(&task, exec_result).await {
                    warn!("Failed to store execution knowledge: {}", e);
                }
            }
        }

        result
    }

    /// Execute in hybrid mode (sequence of modes)
    async fn execute_hybrid(&self, task: Task) -> SwarmResult<ExecutionResult> {
        info!("Executing task {} in hybrid mode", task.id());

        // Phase 1: Discovery with SwarmAgentic
        let discovery_result = self.swarmagentic_mode.discover_architecture(task.clone()).await?;
        
        // Export discovered architecture to knowledge base
        self.knowledge_store.store_pattern(discovery_result.pattern).await?;

        // Phase 2: Execution with Claude Swarm
        let task_with_architecture = Task {
            context: TaskContext {
                custom_context: {
                    let mut ctx = task.context.custom_context.clone();
                    ctx.insert("discovered_architecture".to_string(), 
                        serde_json::to_value(&discovery_result.architecture).unwrap());
                    ctx
                },
                ..task.context.clone()
            },
            ..task.clone()
        };

        let execution_result = self.claudeswarm_mode.execute(task_with_architecture).await?;

        // Phase 3: Review and Compound with ClosedLoop
        if execution_result.is_success() {
            let final_result = self.closedloop_mode.review_and_compound(
                task,
                execution_result,
            ).await?;
            Ok(final_result)
        } else {
            Ok(execution_result)
        }
    }

    /// Store knowledge from execution
    async fn store_execution_knowledge(
        &self,
        task: &Task,
        result: &ExecutionResult,
    ) -> SwarmResult<()> {
        // Store solution
        let solution = Solution {
            metadata: Metadata::new(),
            problem_summary: task.description.clone(),
            problem_hash: format!("{:x}", md5::compute(&task.description)),
            approach: format!("{:?}", result),
            agent_team: None,
            mode_used: SwarmMode::Hybrid,
            outcome: SolutionOutcome {
                success: result.is_success(),
                duration_secs: result.duration_secs,
                cost: result.cost,
                quality_score: 0.8, // Would be calculated from quality gate
            },
            artifacts: Vec::new(),
        };

        self.knowledge_store.store_solution(solution).await?;
        Ok(())
    }

    /// Get task status
    pub async fn get_task_status(&self, task_id: EntityId) -> Option<Status> {
        let sessions = self.sessions.read().await;
        sessions.get_task_status(task_id)
    }

    /// Get progress updates receiver
    pub fn progress_receiver(&self) -> mpsc::Receiver<ProgressUpdate> {
        let (tx, rx) = mpsc::channel(1000);
        // Note: In production, we'd properly wire this up
        rx
    }

    /// Shutdown the controller
    pub async fn shutdown(&self) -> SwarmResult<()> {
        info!("Shutting down MetaSwarmController");
        
        // Shutdown modes
        self.swarmagentic_mode.shutdown().await?;
        self.claudeswarm_mode.shutdown().await?;
        self.closedloop_mode.shutdown().await?;

        info!("MetaSwarmController shutdown complete");
        Ok(())
    }

    fn clone_for_execution(&self) -> Self {
        // Create a new controller instance for async execution
        // In production, this would properly share state
        Self {
            config: self.config.clone(),
            router: self.router.clone(),
            knowledge_store: self.knowledge_store.clone(),
            sessions: self.sessions.clone(),
            progress_tx: self.progress_tx.clone(),
            swarmagentic_mode: self.swarmagentic_mode.clone(),
            claudeswarm_mode: self.claudeswarm_mode.clone(),
            closedloop_mode: self.closedloop_mode.clone(),
        }
    }
}

/// Handle to a submitted task
#[derive(Debug, Clone)]
pub struct TaskHandle {
    pub task_id: EntityId,
    pub session_id: EntityId,
    pub mode: SwarmMode,
}

/// Trait for swarm mode implementations
#[async_trait]
pub trait SwarmModeImplementation: Send + Sync {
    /// Execute a task using this mode
    async fn execute(&self, task: Task) -> SwarmResult<ExecutionResult>;
    
    /// Get the mode type
    fn mode(&self) -> SwarmMode;
    
    /// Shutdown the mode
    async fn shutdown(&self) -> SwarmResult<()>;
}

// Placeholder for md5 - would be actual implementation
mod md5 {
    pub fn compute(data: &str) -> [u8; 16] {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        let hash = hasher.finish();
        
        let mut result = [0u8; 16];
        result[..8].copy_from_slice(&hash.to_le_bytes());
        result[8..].copy_from_slice(&hash.to_le_bytes());
        result
    }
}
