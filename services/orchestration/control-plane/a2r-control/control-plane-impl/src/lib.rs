use a2rchitech_context_router::ContextRouter;
use a2rchitech_control_plane::{
    AuditLevel, ComplianceRequirement, ControlFeature, ControlPlane, ControlPlaneConfig,
    NetworkIsolation, SecurityProfile,
};
use a2rchitech_embodiment::EmbodimentControlPlane;
use a2rchitech_evals::EvaluationEngine;
use a2rchitech_history::HistoryLedger;
use a2rchitech_hooks::HookBus;
use a2rchitech_memory::v2::memory_policy::DefaultMemoryPolicy;
use a2rchitech_memory::MemoryFabric;
use a2rchitech_messaging::{MessagingSystem, TaskQueue};
use a2rchitech_packaging::PackageManager;
use a2rchitech_policy::PolicyEngine;
use a2rchitech_providers::ProviderRouter;
use a2rchitech_registry::{agents::AgentRegistry, tools::ToolRegistry, UnifiedRegistry};
use a2rchitech_rlm::{RLMConfig, RLMRouter};
use a2rchitech_runtime_core::RuntimeCore;
use a2rchitech_skills::SkillRegistry;
use a2rchitech_tools_gateway::ToolGateway;
use a2rchitech_workflows::WorkflowEngine;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, SqlitePool};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlPlaneServiceConfig {
    pub ledger_path: PathBuf,
    pub database_url: String,
    pub control_plane_id: Option<String>,
    pub control_plane_name: String,
    pub control_plane_description: String,
}

impl ControlPlaneServiceConfig {
    pub fn new(ledger_path: PathBuf, database_url: String) -> Self {
        ControlPlaneServiceConfig {
            ledger_path,
            database_url,
            control_plane_id: None,
            control_plane_name: "A2rchitech Control Plane".to_string(),
            control_plane_description: "Local control plane service".to_string(),
        }
    }

    pub fn with_sqlite_paths(ledger_path: PathBuf, database_path: PathBuf) -> Self {
        Self::new(ledger_path, sqlite_url(database_path))
    }
}

pub struct ControlPlaneService {
    pub history_ledger: Arc<Mutex<HistoryLedger>>,
    pub messaging_system: Arc<MessagingSystem>,
    pub policy_engine: Arc<PolicyEngine>,
    pub tool_gateway: Arc<ToolGateway>,
    pub skill_registry: Arc<SkillRegistry>,
    pub unified_registry: Arc<UnifiedRegistry>,
    pub hook_bus: Arc<HookBus>,
    pub task_queue: Arc<TaskQueue>,
    pub workflow_engine: Arc<WorkflowEngine>,
    pub runtime_core: Arc<RuntimeCore>,
    pub context_router: Arc<ContextRouter>,
    pub memory_fabric: Arc<MemoryFabric>,
    pub provider_router: Arc<ProviderRouter>,
    pub rlm_router: Arc<RLMRouter>,
    pub package_manager: Arc<PackageManager>,
    pub embodiment_control_plane: Arc<EmbodimentControlPlane>,
    pub evaluation_engine: Arc<EvaluationEngine>,
    pub control_plane: Arc<ControlPlane>,
    pub database_url: String,
}

impl ControlPlaneService {
    pub async fn new(config: ControlPlaneServiceConfig) -> Result<Self> {
        let history_ledger = Arc::new(Mutex::new(HistoryLedger::new(&config.ledger_path)?));
        let pool = SqlitePool::connect(&config.database_url).await?;
        let sqlite_pool = Arc::new(pool.clone());

        // Install default drivers for AnyPool
        sqlx::any::install_default_drivers();

        let any_pool = AnyPool::connect(&config.database_url).await?;
        let any_pool_arc = Arc::new(any_pool.clone());

        let messaging_system = Arc::new(
            MessagingSystem::new_with_storage(history_ledger.clone(), pool.clone()).await?,
        );
        let policy_engine = Arc::new(PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let tool_gateway = Arc::new(ToolGateway::new(
            policy_engine.clone(),
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let skill_registry = Arc::new(
            SkillRegistry::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                tool_gateway.clone(),
                pool.clone(),
            )
            .await?,
        );

        // Initialize Unified Registry components
        let agent_registry = Arc::new(AgentRegistry::new(any_pool.clone()));
        agent_registry.initialize_schema().await?;

        let tool_registry = Arc::new(ToolRegistry::new(any_pool.clone()));
        tool_registry.initialize_schema().await?;

        let registry_fabric = Arc::new(
            a2rchitech_registry::fabric::DataFabric::new(
                any_pool_arc.clone(),
                None,
                agent_registry.clone(),
                tool_registry.clone(),
                skill_registry.clone(),
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
            )
            .await?,
        );

        let unified_registry = Arc::new(UnifiedRegistry::new(
            skill_registry.clone(),
            agent_registry,
            tool_registry,
            registry_fabric,
        ));

        // Initialize HookBus
        let hook_bus = Arc::new(HookBus::new(Some(messaging_system.event_bus.clone())));

        let task_queue = Arc::new(TaskQueue::new(history_ledger.clone(), pool.clone()).await?);
        let workflow_engine = Arc::new(WorkflowEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            tool_gateway.clone(),
            skill_registry.clone(),
            task_queue.clone(),
            pool.clone(),
        ));
        workflow_engine.initialize_schema().await?;
        let runtime_core = Arc::new(RuntimeCore::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let context_router = Arc::new(ContextRouter::new(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            runtime_core.session_manager.clone(),
        ));
        let memory_policy = Arc::new(DefaultMemoryPolicy {});
        let memory_fabric = Arc::new(
            MemoryFabric::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                pool.clone(),
                memory_policy,
            )
            .await?,
        );
        let provider_router = Arc::new(
            ProviderRouter::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                memory_fabric.clone(),
                runtime_core.session_manager.clone(),
                pool.clone(),
            )
            .await?,
        );
        let rlm_router = Arc::new(
            RLMRouter::new(
                RLMConfig::default(),
                policy_engine.clone(),
                memory_fabric.clone(),
                unified_registry.clone(),
                context_router.clone(),
                provider_router.clone(),
                sqlite_pool.clone(),
            )
            .await?,
        );
        let package_manager = Arc::new(
            PackageManager::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                memory_fabric.clone(),
                provider_router.clone(),
                runtime_core.session_manager.clone(),
                pool.clone(),
            )
            .await?,
        );
        let embodiment_control_plane = Arc::new(
            EmbodimentControlPlane::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                memory_fabric.clone(),
                provider_router.clone(),
                skill_registry.clone(),
                workflow_engine.clone(),
                runtime_core.session_manager.clone(),
                (*sqlite_pool).clone(),
            )
            .await?,
        );
        let evaluation_engine = Arc::new(
            EvaluationEngine::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                memory_fabric.clone(),
                provider_router.clone(),
                skill_registry.clone(),
                workflow_engine.clone(),
                runtime_core.session_manager.clone(),
                (*sqlite_pool).clone(),
            )
            .await?,
        );

        let control_plane_config = build_control_plane_config(&config);
        let control_plane = Arc::new(ControlPlane::new(
            control_plane_config,
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            context_router.clone(),
            memory_fabric.clone(),
            provider_router.clone(),
            skill_registry.clone(),
            workflow_engine.clone(),
            embodiment_control_plane.clone(),
            package_manager.clone(),
            evaluation_engine.clone(),
            runtime_core.session_manager.clone(),
        ));

        Ok(ControlPlaneService {
            history_ledger,
            messaging_system,
            policy_engine,
            tool_gateway,
            skill_registry,
            unified_registry,
            hook_bus,
            task_queue,
            workflow_engine,
            runtime_core,
            context_router,
            memory_fabric,
            provider_router,
            rlm_router,
            package_manager,
            embodiment_control_plane,
            evaluation_engine,
            control_plane,
            database_url: config.database_url,
        })
    }
}

fn sqlite_url(path: impl AsRef<Path>) -> String {
    format!("sqlite://{}", path.as_ref().display())
}

fn build_control_plane_config(config: &ControlPlaneServiceConfig) -> ControlPlaneConfig {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let control_plane_id = config
        .control_plane_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    ControlPlaneConfig {
        control_plane_id,
        name: config.control_plane_name.clone(),
        description: config.control_plane_description.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        enabled_features: vec![
            ControlFeature::AgentInspection,
            ControlFeature::AgentControl,
            ControlFeature::MemoryInspection,
            ControlFeature::SkillInspection,
            ControlFeature::WorkflowInspection,
            ControlFeature::EmbodimentControl,
            ControlFeature::PolicyEnforcement,
            ControlFeature::AuditLogging,
            ControlFeature::ReplayCapability,
        ],
        security_profile: SecurityProfile {
            sensitivity_tier: 0,
            compliance_requirements: vec![ComplianceRequirement::Custom("UNSPECIFIED".to_string())],
            audit_level: AuditLevel::Standard,
            encryption_required: false,
            network_isolation: NetworkIsolation::None,
        },
        audit_level: AuditLevel::Standard,
        created_at: now,
        updated_at: now,
    }
}
