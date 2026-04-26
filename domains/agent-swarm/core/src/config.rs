use crate::error::{SwarmError, SwarmResult};
use crate::types::{ModeConfig, SwarmMode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use validator::Validate;

/// Main configuration for the meta-swarm system
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct MetaSwarmConfig {
    /// System name
    pub name: String,

    /// System version
    pub version: String,

    /// Default mode when routing is uncertain
    pub default_mode: SwarmMode,

    /// Mode-specific configurations
    pub modes: HashMap<SwarmMode, ModeConfig>,

    /// Routing configuration
    pub routing: RoutingConfig,

    /// Knowledge base configuration
    pub knowledge: KnowledgeConfig,

    /// Budget configuration
    pub budget: BudgetConfig,

    /// Execution configuration
    pub execution: ExecutionConfig,

    /// Allternit integration configuration
    pub allternit: AllternitIntegrationConfig,
}

impl MetaSwarmConfig {
    /// Load configuration from a file
    pub async fn from_file<P: AsRef<Path>>(path: P) -> SwarmResult<Self> {
        let content = tokio::fs::read_to_string(path.as_ref()).await?;
        
        let config: Self = match path.as_ref().extension().and_then(|e| e.to_str()) {
            Some("yaml") | Some("yml") => serde_yaml::from_str(&content)
                .map_err(|e| SwarmError::Config(format!("YAML parse error: {}", e)))?,
            Some("json") => serde_json::from_str(&content)
                .map_err(|e| SwarmError::Config(format!("JSON parse error: {}", e)))?,
            _ => return Err(SwarmError::Config("Unsupported config format".to_string())),
        };

        config.validate()?;
        Ok(config)
    }

    /// Save configuration to a file
    pub async fn to_file<P: AsRef<Path>>(&self, path: P) -> SwarmResult<()> {
        let content = if path.as_ref().extension().and_then(|e| e.to_str()) == Some("json") {
            serde_json::to_string_pretty(self)
                .map_err(|e| SwarmError::Serialization(e.to_string()))?
        } else {
            serde_yaml::to_string(self)
                .map_err(|e| SwarmError::Serialization(e.to_string()))?
        };

        tokio::fs::write(path, content).await?;
        Ok(())
    }

    /// Get configuration for a specific mode
    pub fn mode_config(&self, mode: SwarmMode) -> ModeConfig {
        self.modes.get(&mode).cloned().unwrap_or_else(|| ModeConfig::new(mode))
    }

    /// Check if a mode is enabled
    pub fn is_mode_enabled(&self, mode: SwarmMode) -> bool {
        self.modes.get(&mode).map(|c| c.enabled).unwrap_or(true)
    }

    /// Create default configuration
    pub fn default() -> Self {
        let mut modes = HashMap::new();
        modes.insert(SwarmMode::SwarmAgentic, ModeConfig::new(SwarmMode::SwarmAgentic));
        modes.insert(SwarmMode::ClaudeSwarm, ModeConfig::new(SwarmMode::ClaudeSwarm));
        modes.insert(SwarmMode::ClosedLoop, ModeConfig::new(SwarmMode::ClosedLoop));
        modes.insert(SwarmMode::Hybrid, ModeConfig::new(SwarmMode::Hybrid));

        Self {
            name: "Allternit Meta-Swarm".to_string(),
            version: "1.0.0".to_string(),
            default_mode: SwarmMode::ClaudeSwarm,
            modes,
            routing: RoutingConfig::default(),
            knowledge: KnowledgeConfig::default(),
            budget: BudgetConfig::default(),
            execution: ExecutionConfig::default(),
            allternit: AllternitIntegrationConfig::default(),
        }
    }
}

/// Routing configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct RoutingConfig {
    /// Minimum confidence for automatic routing
    #[validate(range(min = 0.0, max = 1.0))]
    pub min_confidence: f64,

    /// Whether to allow mode switching during execution
    pub allow_mode_switch: bool,

    /// Threshold for routing to SwarmAgentic (novelty score)
    #[validate(range(min = 0.0, max = 1.0))]
    pub swarm_agentic_novelty_threshold: f64,

    /// Threshold for routing to ClosedLoop (requires review)
    pub closedloop_review_required: bool,

    /// Maximum similarity score to consider a task "known"
    #[validate(range(min = 0.0, max = 1.0))]
    pub known_pattern_threshold: f64,

    /// Embedding model for similarity search
    pub embedding_model: String,

    /// Knowledge base query limit
    pub knowledge_query_limit: usize,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        Self {
            min_confidence: 0.7,
            allow_mode_switch: true,
            swarm_agentic_novelty_threshold: 0.7,
            closedloop_review_required: true,
            known_pattern_threshold: 0.85,
            embedding_model: "text-embedding-3-small".to_string(),
            knowledge_query_limit: 10,
        }
    }
}

/// Knowledge base configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct KnowledgeConfig {
    /// Storage backend type
    pub storage_backend: StorageBackend,

    /// Intent Graph endpoint
    pub intent_graph_url: String,

    /// Local storage path
    pub local_storage_path: PathBuf,

    /// Cache size
    pub cache_size: usize,

    /// Enable cross-mode learning
    pub enable_cross_mode_learning: bool,

    /// Pattern expiration days
    pub pattern_expiration_days: u32,
}

impl Default for KnowledgeConfig {
    fn default() -> Self {
        Self {
            storage_backend: StorageBackend::IntentGraph,
            intent_graph_url: "http://localhost:3000/api/intent-graph".to_string(),
            local_storage_path: PathBuf::from("./allternit-workspace/knowledge"),
            cache_size: 1000,
            enable_cross_mode_learning: true,
            pattern_expiration_days: 365,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageBackend {
    IntentGraph,
    Local,
    Hybrid,
}

/// Budget configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct BudgetConfig {
    /// Default budget per task (USD)
    pub default_task_budget: f64,

    /// Maximum budget per task (USD)
    pub max_task_budget: f64,

    /// Alert threshold (percentage of budget)
    #[validate(range(min = 0.0, max = 1.0))]
    pub alert_threshold: f64,

    /// Hard limit enforcement
    pub enforce_hard_limit: bool,

    /// Track costs per agent
    pub track_per_agent: bool,
}

impl Default for BudgetConfig {
    fn default() -> Self {
        Self {
            default_task_budget: 5.0,
            max_task_budget: 50.0,
            alert_threshold: 0.8,
            enforce_hard_limit: true,
            track_per_agent: true,
        }
    }
}

/// Execution configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct ExecutionConfig {
    /// Default timeout per task (seconds)
    pub default_timeout_secs: u64,

    /// Maximum timeout (seconds)
    pub max_timeout_secs: u64,

    /// Default retry attempts
    pub default_retry_attempts: u32,

    /// Enable file conflict detection
    pub enable_file_conflict_detection: bool,

    /// Enable deadlock detection
    pub enable_deadlock_detection: bool,

    /// Agent pool size
    pub agent_pool_size: usize,

    /// Execution backend
    pub execution_backend: ExecutionBackend,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            default_timeout_secs: 3600,
            max_timeout_secs: 14400,
            default_retry_attempts: 2,
            enable_file_conflict_detection: true,
            enable_deadlock_detection: true,
            agent_pool_size: 10,
            execution_backend: ExecutionBackend::Rails,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionBackend {
    Rails,
    Direct,
    Mock,
}

/// Allternit integration configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct AllternitIntegrationConfig {
    /// Intent Graph endpoint
    pub intent_graph_endpoint: String,

    /// WIH endpoint
    pub wih_endpoint: String,

    /// Rails endpoint
    pub rails_endpoint: String,

    /// Governance endpoint
    pub governance_endpoint: String,

    /// API key for Allternit services
    pub api_key: Option<String>,

    /// Namespace for storing data
    pub namespace: String,

    /// Enable WIH integration
    pub enable_wih: bool,

    /// Enable governance checks
    pub enable_governance: bool,
}

impl Default for AllternitIntegrationConfig {
    fn default() -> Self {
        Self {
            intent_graph_endpoint: "http://localhost:3000/api".to_string(),
            wih_endpoint: "http://localhost:3000/api/wih".to_string(),
            rails_endpoint: "http://localhost:3000/api/rails".to_string(),
            governance_endpoint: "http://localhost:3000/api/governance".to_string(),
            api_key: None,
            namespace: "meta-swarm".to_string(),
            enable_wih: true,
            enable_governance: true,
        }
    }
}

/// Configuration watcher for hot reload
pub struct ConfigWatcher {
    config_path: PathBuf,
    current_config: MetaSwarmConfig,
}

impl ConfigWatcher {
    pub async fn new<P: AsRef<Path>>(path: P) -> SwarmResult<Self> {
        let config = MetaSwarmConfig::from_file(&path).await?;
        Ok(Self {
            config_path: path.as_ref().to_path_buf(),
            current_config: config,
        })
    }

    pub fn config(&self) -> &MetaSwarmConfig {
        &self.current_config
    }

    /// Reload configuration from disk
    pub async fn reload(&mut self) -> SwarmResult<()> {
        self.current_config = MetaSwarmConfig::from_file(&self.config_path).await?;
        Ok(())
    }
}
