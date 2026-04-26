use crate::modes::base::{ExecutionMode, ModeExecutor};
pub use crate::RLMConfig; // Re-export for modes::rlm
use crate::{RLMOrchestrator, RLMTask};
use allternit_history::HistoryLedger;
use allternit_memory::MemoryFabric;
use allternit_messaging::MessagingSystem;
use allternit_policy::PolicyEngine;
use allternit_registry::UnifiedRegistry;
use allternit_skills::SkillRegistry;
use allternit_tools_gateway::ToolGateway;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::{Arc, Mutex};

use allternit_providers::ProviderRouter;

/// RLM mode executor implementing recursive language model execution
pub struct RLMModeExecutor {
    orchestrator: Arc<RLMOrchestrator>,
    config: RLMConfig,
}

impl std::fmt::Debug for RLMModeExecutor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RLMModeExecutor").finish()
    }
}

impl RLMModeExecutor {
    pub async fn new(
        config: RLMConfig,
        policy_engine: Arc<PolicyEngine>,
        memory_fabric: Arc<MemoryFabric>,
        unified_registry: Arc<UnifiedRegistry>,
        skill_registry: Arc<SkillRegistry>,
        tool_gateway: Arc<ToolGateway>,
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        provider_router: Arc<ProviderRouter>,
        sqlite_pool: Arc<SqlitePool>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let orchestrator = Arc::new(
            RLMOrchestrator::new(
                config.clone(),
                policy_engine,
                memory_fabric,
                unified_registry,
                skill_registry,
                tool_gateway,
                history_ledger,
                messaging_system,
                provider_router,
                sqlite_pool,
            )
            .await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?,
        );

        Ok(Self {
            orchestrator,
            config,
        })
    }
}

#[async_trait]
impl ModeExecutor for RLMModeExecutor {
    async fn execute(
        &self,
        context: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let rlm_task = RLMTask::new(
            task.to_string(),
            context.to_string(),
            "default-tenant".to_string(),
            "default-session".to_string(),
        );

        let result = self
            .orchestrator
            .execute_rlm_task(rlm_task)
            .await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

        Ok(result.answer)
    }

    fn is_deterministic(&self) -> bool {
        false
    }

    fn mode(&self) -> ExecutionMode {
        ExecutionMode::RLM
    }
}

/// Configuration for RLM execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLMExecutorConfig {
    /// Root model ID for context management
    pub root_model_id: String,
    /// Sub-model ID for tool execution
    pub sub_model_id: String,
    /// Maximum parallel sub-LLM calls
    pub max_parallel_calls: usize,
    /// Maximum recursion depth
    pub max_recursion_depth: u32,
    /// Enable Python Gateway execution
    pub enable_python_sandbox: bool,
}
