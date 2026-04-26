pub mod adapters;
pub mod runtime;
use allternit_context_router::{ContextBundle, ContextRouter};
use allternit_history::{HistoryError, HistoryLedger};
use allternit_memory::MemoryFabric;
use allternit_messaging::{EventEnvelope, MessagingSystem};
use allternit_policy::{PolicyEffect, PolicyEngine, PolicyRequest};
use allternit_runtime_core::SessionManager;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_id: String,
    pub provider_type: ProviderType,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub capabilities: Vec<Capability>,
    pub budget: ProviderBudget,
    pub routing_preferences: RoutingPreferences,
    pub status: ProviderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Google,
    Local,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability {
    pub model: String,
    pub modalities: Vec<Modality>,
    pub context_window: usize,
    pub max_tokens: usize,
    pub response_time_ms: u64,
    pub cost_per_token: f64,
    pub safety_tier: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Modality {
    Text,
    Image,
    Audio,
    Video,
    Multimodal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBudget {
    pub daily_limit: Option<f64>,
    pub monthly_limit: Option<f64>,
    pub rate_limit: Option<u64>,  // requests per minute
    pub token_limit: Option<u64>, // tokens per minute
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingPreferences {
    pub priority: u8,
    pub preferred_models: Vec<String>,
    pub avoided_models: Vec<String>,
    pub latency_tolerance_ms: u64,
    pub cost_tolerance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderStatus {
    Active,
    Maintenance,
    Disabled,
    OverQuota,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRequest {
    pub request_id: String,
    pub session_id: String,
    pub tenant_id: String,
    pub agent_id: String,
    pub persona: Persona,
    pub context_bundle: ContextBundle,
    pub intent: String,
    pub required_capabilities: Vec<Capability>,
    pub budget_constraints: ProviderBudget,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderResponse {
    pub request_id: String,
    pub provider_id: String,
    pub response: serde_json::Value,
    pub latency_ms: u64,
    pub cost: f64,
    pub tokens_used: u64,
    pub safety_rating: u8,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Persona {
    pub persona_id: String,
    pub name: String,
    pub description: String,
    pub base_persona: String, // e.g. "gizzi"
    pub overlays: Vec<PersonaOverlay>,
    pub version: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaOverlay {
    pub overlay_id: String,
    pub name: String,
    pub description: String,
    pub role: String, // e.g. "planner", "builder", "reviewer"
    pub personality_traits: HashMap<String, String>,
    pub behavior_modifiers: Vec<BehaviorModifier>,
    pub response_formatting: ResponseFormatting,
    pub safety_settings: SafetySettings,
    pub version: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorModifier {
    pub modifier_type: ModifierType,
    pub weight: f64,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModifierType {
    Tone(ToneModifier),
    Style(StyleModifier),
    Format(FormatModifier),
    Safety(SafetyModifier),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToneModifier {
    Formal,
    Casual,
    Professional,
    Friendly,
    Authoritative,
    Conversational,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StyleModifier {
    Concise,
    Detailed,
    Analytical,
    Creative,
    Technical,
    Narrative,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FormatModifier {
    BulletPoints,
    NumberedList,
    Paragraph,
    Table,
    JSON,
    Markdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyModifier {
    Conservative,
    Moderate,
    Liberal,
    Custom(f64), // custom safety threshold
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseFormatting {
    pub max_length: Option<u32>,
    pub min_length: Option<u32>,
    pub preferred_language: Option<String>,
    pub citation_style: Option<CitationStyle>,
    pub output_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CitationStyle {
    APA,
    MLA,
    Chicago,
    IEEE,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetySettings {
    pub content_filter_level: u8, // 0-4 scale
    pub topic_restrictions: Vec<String>,
    pub response_guidelines: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] HistoryError),
    #[error("SQLX error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Policy error: {0}")]
    Policy(#[from] allternit_policy::PolicyError),
    #[error("Provider not found: {0}")]
    ProviderNotFound(String),
    #[error("Provider disabled: {0}")]
    ProviderDisabled(String),
    #[error("Insufficient budget: {0}")]
    InsufficientBudget(String),
    #[error("Invalid persona: {0}")]
    InvalidPersona(String),
    #[error("Routing failed: {0}")]
    RoutingFailed(String),
    #[error("Provider call failed: {0}")]
    ProviderCallFailed(String),
}

// Storage trait for provider configurations
#[async_trait::async_trait]
pub trait ProviderStorage: Send + Sync {
    async fn store_provider(&self, config: &ProviderConfig) -> Result<(), ProviderError>;
    async fn get_provider(
        &self,
        provider_id: &str,
    ) -> Result<Option<ProviderConfig>, ProviderError>;
    async fn update_provider(&self, config: &ProviderConfig) -> Result<(), ProviderError>;
    async fn delete_provider(&self, provider_id: &str) -> Result<(), ProviderError>;

    async fn store_persona(&self, persona: &Persona) -> Result<(), ProviderError>;
    async fn get_persona(&self, persona_id: &str) -> Result<Option<Persona>, ProviderError>;
    async fn update_persona(&self, persona: &Persona) -> Result<(), ProviderError>;
    async fn delete_persona(&self, persona_id: &str) -> Result<(), ProviderError>;

    async fn get_provider_stats(&self, provider_id: &str) -> Result<ProviderStats, ProviderError>;
    async fn update_provider_stats(&self, stats: &ProviderStats) -> Result<(), ProviderError>;
}

pub struct SqliteProviderStorage {
    pool: SqlitePool,
}

impl SqliteProviderStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, ProviderError> {
        // Create the providers table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS providers (
                provider_id TEXT PRIMARY KEY,
                provider_type TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                api_key TEXT,
                capabilities TEXT NOT NULL,
                budget TEXT NOT NULL,
                routing_preferences TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        // Create the personas table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS personas (
                persona_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                base_persona TEXT NOT NULL,
                overlays TEXT NOT NULL,
                version TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                is_active BOOLEAN NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        // Create indexes for better query performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status)")
            .execute(&pool)
            .await
            .map_err(ProviderError::Sqlx)?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active)")
            .execute(&pool)
            .await
            .map_err(ProviderError::Sqlx)?;

        Ok(SqliteProviderStorage { pool })
    }
}

#[async_trait::async_trait]
impl ProviderStorage for SqliteProviderStorage {
    async fn store_provider(&self, config: &ProviderConfig) -> Result<(), ProviderError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let capabilities_json =
            serde_json::to_string(&config.capabilities).map_err(ProviderError::Json)?;
        let budget_json = serde_json::to_string(&config.budget).map_err(ProviderError::Json)?;
        let routing_preferences_json =
            serde_json::to_string(&config.routing_preferences).map_err(ProviderError::Json)?;
        let status_str = format!("{:?}", config.status);

        sqlx::query(
            "INSERT OR REPLACE INTO providers (
                provider_id, provider_type, endpoint, api_key, capabilities,
                budget, routing_preferences, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&config.provider_id)
        .bind(format!("{:?}", config.provider_type))
        .bind(&config.endpoint)
        .bind(&config.api_key)
        .bind(&capabilities_json)
        .bind(&budget_json)
        .bind(&routing_preferences_json)
        .bind(&status_str)
        .bind(now as i64)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn get_provider(
        &self,
        provider_id: &str,
    ) -> Result<Option<ProviderConfig>, ProviderError> {
        let row = sqlx::query(
            "SELECT provider_id, provider_type, endpoint, api_key, capabilities, budget, routing_preferences, status, created_at, updated_at
             FROM providers WHERE provider_id = ?"
        )
        .bind(provider_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        if let Some(row) = row {
            let capabilities: Vec<Capability> =
                serde_json::from_str(row.get::<&str, _>("capabilities"))
                    .map_err(ProviderError::Json)?;
            let budget: ProviderBudget =
                serde_json::from_str(row.get::<&str, _>("budget")).map_err(ProviderError::Json)?;
            let routing_preferences: RoutingPreferences =
                serde_json::from_str(row.get::<&str, _>("routing_preferences"))
                    .map_err(ProviderError::Json)?;

            let provider_type_str: String = row.get("provider_type");
            let provider_type = match provider_type_str.as_str() {
                "OpenAI" => ProviderType::OpenAI,
                "Anthropic" => ProviderType::Anthropic,
                "Google" => ProviderType::Google,
                "Local" => ProviderType::Local,
                "Custom" => ProviderType::Custom,
                _ => {
                    return Err(ProviderError::ProviderCallFailed(
                        "Invalid provider type".to_string(),
                    ))
                }
            };

            let status_str: String = row.get("status");
            let status = match status_str.as_str() {
                "Active" => ProviderStatus::Active,
                "Maintenance" => ProviderStatus::Maintenance,
                "Disabled" => ProviderStatus::Disabled,
                "OverQuota" => ProviderStatus::OverQuota,
                _ => {
                    return Err(ProviderError::ProviderCallFailed(
                        "Invalid provider status".to_string(),
                    ))
                }
            };

            let config = ProviderConfig {
                provider_id: row.get("provider_id"),
                provider_type,
                endpoint: row.get("endpoint"),
                api_key: row.get("api_key"),
                capabilities,
                budget,
                routing_preferences,
                status,
            };

            Ok(Some(config))
        } else {
            Ok(None)
        }
    }

    async fn update_provider(&self, config: &ProviderConfig) -> Result<(), ProviderError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let capabilities_json =
            serde_json::to_string(&config.capabilities).map_err(ProviderError::Json)?;
        let budget_json = serde_json::to_string(&config.budget).map_err(ProviderError::Json)?;
        let routing_preferences_json =
            serde_json::to_string(&config.routing_preferences).map_err(ProviderError::Json)?;
        let status_str = format!("{:?}", config.status);

        sqlx::query(
            "UPDATE providers SET
                provider_type = ?, endpoint = ?, api_key = ?, capabilities = ?,
                budget = ?, routing_preferences = ?, status = ?, updated_at = ?
             WHERE provider_id = ?",
        )
        .bind(format!("{:?}", config.provider_type))
        .bind(&config.endpoint)
        .bind(&config.api_key)
        .bind(&capabilities_json)
        .bind(&budget_json)
        .bind(&routing_preferences_json)
        .bind(&status_str)
        .bind(now as i64)
        .bind(&config.provider_id)
        .execute(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn delete_provider(&self, provider_id: &str) -> Result<(), ProviderError> {
        sqlx::query("DELETE FROM providers WHERE provider_id = ?")
            .bind(provider_id)
            .execute(&self.pool)
            .await
            .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn store_persona(&self, persona: &Persona) -> Result<(), ProviderError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let overlays_json =
            serde_json::to_string(&persona.overlays).map_err(ProviderError::Json)?;

        sqlx::query(
            "INSERT OR REPLACE INTO personas (
                persona_id, name, description, base_persona, overlays, version, created_at, updated_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&persona.persona_id)
        .bind(&persona.name)
        .bind(&persona.description)
        .bind(&persona.base_persona)
        .bind(&overlays_json)
        .bind(&persona.version)
        .bind(now as i64)
        .bind(now as i64)
        .bind(persona.is_active)
        .execute(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn get_persona(&self, persona_id: &str) -> Result<Option<Persona>, ProviderError> {
        let row = sqlx::query(
            "SELECT persona_id, name, description, base_persona, overlays, version, created_at, updated_at, is_active
             FROM personas WHERE persona_id = ?"
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        if let Some(row) = row {
            let overlays: Vec<PersonaOverlay> =
                serde_json::from_str(row.get::<&str, _>("overlays"))
                    .map_err(ProviderError::Json)?;

            let persona = Persona {
                persona_id: row.get("persona_id"),
                name: row.get("name"),
                description: row.get("description"),
                base_persona: row.get("base_persona"),
                overlays,
                version: row.get("version"),
                created_at: row.get::<i64, _>("created_at") as u64,
                updated_at: row.get::<i64, _>("updated_at") as u64,
                is_active: row.get("is_active"),
            };

            Ok(Some(persona))
        } else {
            Ok(None)
        }
    }

    async fn update_persona(&self, persona: &Persona) -> Result<(), ProviderError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let overlays_json =
            serde_json::to_string(&persona.overlays).map_err(ProviderError::Json)?;

        sqlx::query(
            "UPDATE personas SET
                name = ?, description = ?, base_persona = ?, overlays = ?, version = ?,
                updated_at = ?, is_active = ?
             WHERE persona_id = ?",
        )
        .bind(&persona.name)
        .bind(&persona.description)
        .bind(&persona.base_persona)
        .bind(&overlays_json)
        .bind(&persona.version)
        .bind(now as i64)
        .bind(persona.is_active)
        .bind(&persona.persona_id)
        .execute(&self.pool)
        .await
        .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn delete_persona(&self, persona_id: &str) -> Result<(), ProviderError> {
        sqlx::query("DELETE FROM personas WHERE persona_id = ?")
            .bind(persona_id)
            .execute(&self.pool)
            .await
            .map_err(ProviderError::Sqlx)?;

        Ok(())
    }

    async fn get_provider_stats(&self, provider_id: &str) -> Result<ProviderStats, ProviderError> {
        // In a real implementation, this would fetch from a stats table
        // For now, return default stats
        Ok(ProviderStats {
            provider_id: provider_id.to_string(),
            total_requests: 0,
            total_cost: 0.0,
            avg_latency_ms: 0.0,
            success_rate: 1.0, // Initially assume 100% success
            last_called: None,
            error_count: 0,
        })
    }

    async fn update_provider_stats(&self, stats: &ProviderStats) -> Result<(), ProviderError> {
        // In a real implementation, this would update a stats table
        // For now, we'll just return Ok
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStats {
    pub provider_id: String,
    pub total_requests: u64,
    pub total_cost: f64,
    pub avg_latency_ms: f64,
    pub success_rate: f64,
    pub last_called: Option<u64>,
    pub error_count: u64,
}

pub struct ProviderRouter {
    providers: Arc<RwLock<HashMap<String, ProviderConfig>>>,
    personas: Arc<RwLock<HashMap<String, Persona>>>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    policy_engine: Arc<PolicyEngine>,
    context_router: Arc<ContextRouter>,
    memory_fabric: Arc<MemoryFabric>,
    session_manager: Arc<SessionManager>,
    storage: Arc<dyn ProviderStorage>,
}

impl ProviderRouter {
    pub async fn new_with_storage(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        policy_engine: Arc<PolicyEngine>,
        context_router: Arc<ContextRouter>,
        memory_fabric: Arc<MemoryFabric>,
        session_manager: Arc<SessionManager>,
        pool: SqlitePool,
    ) -> Result<Self, ProviderError> {
        let storage = Arc::new(SqliteProviderStorage::new(pool).await?);

        // Load existing providers and personas from storage
        let providers_map = HashMap::new();
        let personas_map = HashMap::new();

        // In a real implementation, we would load from storage
        // For now, we'll initialize empty maps

        Ok(ProviderRouter {
            providers: Arc::new(RwLock::new(providers_map)),
            personas: Arc::new(RwLock::new(personas_map)),
            history_ledger,
            messaging_system,
            policy_engine,
            context_router,
            memory_fabric,
            session_manager,
            storage,
        })
    }

    pub async fn register_provider(&self, config: ProviderConfig) -> Result<String, ProviderError> {
        // Validate provider config
        self.validate_provider_config(&config).await?;

        // Store in durable storage
        self.storage.store_provider(&config).await?;

        // Update in-memory cache
        let mut providers = self.providers.write().await;
        providers.insert(config.provider_id.clone(), config.clone());

        // Log the event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "ProviderRegistered".to_string(),
            session_id: "system".to_string(), // System event
            tenant_id: "system".to_string(),
            actor_id: "system".to_string(), // Would be the actual creator in real implementation
            role: "provider_router".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            trace_id: None,
            payload: serde_json::json!({
                "provider_id": config.provider_id,
                "provider_type": format!("{:?}", config.provider_type),
                "capabilities": config.capabilities,
            }),
        };

        // Log to history ledger
        {
            let mut history = self.history_ledger.lock().unwrap();
            let content = serde_json::to_value(&event)?;
            history.append(content)?;
        }

        // Emit event asynchronously
        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(config.provider_id)
    }

    async fn validate_provider_config(&self, config: &ProviderConfig) -> Result<(), ProviderError> {
        // Validate provider ID
        if config.provider_id.is_empty() {
            return Err(ProviderError::ProviderCallFailed(
                "Provider ID cannot be empty".to_string(),
            ));
        }

        // Validate endpoint format based on provider type
        if config.endpoint.is_empty() {
            return Err(ProviderError::ProviderCallFailed(
                "Provider endpoint cannot be empty".to_string(),
            ));
        }

        // Validate capabilities
        if config.capabilities.is_empty() {
            return Err(ProviderError::ProviderCallFailed(
                "Provider must have at least one capability".to_string(),
            ));
        }

        // Validate each capability
        for cap in &config.capabilities {
            if cap.model.is_empty() {
                return Err(ProviderError::ProviderCallFailed(
                    "Capability model cannot be empty".to_string(),
                ));
            }

            if cap.context_window == 0 {
                return Err(ProviderError::ProviderCallFailed(
                    "Capability context window must be greater than 0".to_string(),
                ));
            }

            if cap.max_tokens == 0 {
                return Err(ProviderError::ProviderCallFailed(
                    "Capability max tokens must be greater than 0".to_string(),
                ));
            }
        }

        Ok(())
    }

    pub async fn register_persona(&self, persona: Persona) -> Result<String, ProviderError> {
        // Validate persona
        self.validate_persona(&persona).await?;

        // Store in durable storage
        self.storage.store_persona(&persona).await?;

        // Update in-memory cache
        let mut personas = self.personas.write().await;
        personas.insert(persona.persona_id.clone(), persona.clone());

        // Log the event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "PersonaRegistered".to_string(),
            session_id: "system".to_string(), // System event
            tenant_id: "system".to_string(),
            actor_id: "system".to_string(), // Would be the actual creator in real implementation
            role: "provider_router".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            trace_id: None,
            payload: serde_json::json!({
                "persona_id": persona.persona_id,
                "name": persona.name,
                "version": persona.version,
                "base_persona": persona.base_persona,
                "overlay_count": persona.overlays.len(),
            }),
        };

        // Log to history ledger
        {
            let mut history = self.history_ledger.lock().unwrap();
            let content = serde_json::to_value(&event)?;
            history.append(content)?;
        }

        // Emit event asynchronously
        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(persona.persona_id)
    }

    async fn validate_persona(&self, persona: &Persona) -> Result<(), ProviderError> {
        // Validate persona ID
        if persona.persona_id.is_empty() {
            return Err(ProviderError::InvalidPersona(
                "Persona ID cannot be empty".to_string(),
            ));
        }

        // Validate name
        if persona.name.is_empty() {
            return Err(ProviderError::InvalidPersona(
                "Persona name cannot be empty".to_string(),
            ));
        }

        // Validate base persona
        if persona.base_persona.is_empty() {
            return Err(ProviderError::InvalidPersona(
                "Base persona cannot be empty".to_string(),
            ));
        }

        // Validate version format (simple semver check)
        let version_parts: Vec<&str> = persona.version.split('.').collect();
        if version_parts.len() != 3 {
            return Err(ProviderError::InvalidPersona(
                "Version must be in semver format (x.y.z)".to_string(),
            ));
        }

        Ok(())
    }

    pub async fn route_request(
        &self,
        request: ProviderRequest,
    ) -> Result<ProviderResponse, ProviderError> {
        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Validate access through policy
        let policy_request = PolicyRequest {
            identity_id: request.agent_id.clone(),
            resource: format!("provider_request:{}", request.tenant_id),
            action: "invoke".to_string(),
            context: serde_json::json!({
                "request": &request,
                "required_capabilities": &request.required_capabilities,
                "budget_constraints": &request.budget_constraints,
            }),
            requested_tier: allternit_policy::SafetyTier::T0, // Default to lowest tier for provider access
        };

        let policy_decision = self.policy_engine.evaluate(policy_request).await?;
        if matches!(policy_decision.decision, PolicyEffect::Deny) {
            return Err(ProviderError::RoutingFailed(format!(
                "Policy denied provider access: {}",
                policy_decision.reason
            )));
        }

        // Select appropriate provider based on capabilities, budget, and preferences
        let provider_config = self.select_provider(&request).await?;

        // Inject persona into the request context
        let injected_request = self.inject_persona(&request, &provider_config).await?;

        // Call the provider
        let response = self
            .call_provider(&injected_request, &provider_config)
            .await?;

        // Log the request and response
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "ProviderCallCompleted".to_string(),
            session_id: request.session_id.clone(),
            tenant_id: request.tenant_id.clone(),
            actor_id: request.agent_id.clone(),
            role: "provider_router".to_string(),
            timestamp: start_time,
            trace_id: request.trace_id.clone(),
            payload: serde_json::json!({
                "request_id": request.request_id,
                "provider_id": provider_config.provider_id,
                "latency_ms": response.latency_ms,
                "cost": response.cost,
                "tokens_used": response.tokens_used,
                "safety_rating": response.safety_rating,
            }),
        };

        // Log to history ledger
        {
            let mut history = self.history_ledger.lock().unwrap();
            let content = serde_json::to_value(&event)?;
            history.append(content)?;
        }

        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(response)
    }

    async fn select_provider(
        &self,
        request: &ProviderRequest,
    ) -> Result<ProviderConfig, ProviderError> {
        let providers = self.providers.read().await;
        let mut eligible_providers = Vec::new();

        for (id, config) in providers.iter() {
            if self.is_provider_eligible(config, request).await {
                eligible_providers.push(config.clone());
            }
        }

        if eligible_providers.is_empty() {
            return Err(ProviderError::ProviderNotFound(
                "No eligible providers found for request".to_string(),
            ));
        }

        // Sort by priority and other factors
        eligible_providers.sort_by(|a, b| {
            // Higher priority first
            b.routing_preferences
                .priority
                .cmp(&a.routing_preferences.priority)
        });

        // Return the first (highest priority) eligible provider
        Ok(eligible_providers[0].clone())
    }

    async fn is_provider_eligible(
        &self,
        config: &ProviderConfig,
        request: &ProviderRequest,
    ) -> bool {
        // Check if provider is active
        if !matches!(config.status, ProviderStatus::Active) {
            return false;
        }

        // Check if provider has required capabilities
        for required_cap in &request.required_capabilities {
            let mut has_capability = false;
            for cap in &config.capabilities {
                if cap.model == required_cap.model {
                    // Check if the capability meets requirements
                    if cap.context_window >= required_cap.context_window
                        && cap.max_tokens >= required_cap.max_tokens
                        && cap.safety_tier >= required_cap.safety_tier
                    {
                        has_capability = true;
                        break;
                    }
                }
            }
            if !has_capability {
                return false;
            }
        }

        // Check budget constraints
        if let Some(daily_limit) = config.budget.daily_limit {
            if daily_limit < request.budget_constraints.daily_limit.unwrap_or(0.0) {
                return false;
            }
        }

        // Check routing preferences
        if config
            .routing_preferences
            .avoided_models
            .contains(&request.intent)
        {
            return false;
        }

        true
    }

    async fn inject_persona(
        &self,
        request: &ProviderRequest,
        provider: &ProviderConfig,
    ) -> Result<ProviderRequest, ProviderError> {
        // Get the persona
        let personas = self.personas.read().await;
        let persona = personas.get(&request.persona.persona_id).ok_or_else(|| {
            ProviderError::InvalidPersona(format!(
                "Persona {} not found",
                request.persona.persona_id
            ))
        })?;

        // Create an injected request with persona information
        let injected_request = request.clone();

        // In a real implementation, this would modify the context bundle or request
        // to include persona-specific instructions, formatting, etc.
        // For now, we'll just return the request as-is

        Ok(injected_request)
    }

    async fn call_provider(
        &self,
        request: &ProviderRequest,
        config: &ProviderConfig,
    ) -> Result<ProviderResponse, ProviderError> {
        // In a real implementation, this would make the actual API call to the provider
        // For now, we'll simulate a response

        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();

        // Simulate provider call
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await; // Simulate network delay

        let end_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();
        let latency = end_time.as_millis() as u64 - start_time.as_millis() as u64;

        let response = ProviderResponse {
            request_id: request.request_id.clone(),
            provider_id: config.provider_id.clone(),
            response: serde_json::json!({"result": "Simulated provider response"}),
            latency_ms: latency,
            cost: 0.01,       // Simulated cost
            tokens_used: 100, // Simulated token usage
            safety_rating: 3, // Simulated safety rating
            trace_id: request.trace_id.clone(),
        };

        // Update provider stats
        let stats = self.storage.get_provider_stats(&config.provider_id).await?;
        let updated_stats = ProviderStats {
            total_requests: stats.total_requests + 1,
            total_cost: stats.total_cost + response.cost,
            avg_latency_ms: ((stats.avg_latency_ms * stats.total_requests as f64)
                + response.latency_ms as f64)
                / (stats.total_requests + 1) as f64,
            success_rate: if stats.error_count == 0 {
                1.0
            } else {
                (stats.total_requests as f64) / (stats.total_requests + stats.error_count) as f64
            },
            last_called: Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            ),
            error_count: stats.error_count, // For this simulation, we assume success
            ..stats
        };

        self.storage.update_provider_stats(&updated_stats).await?;

        Ok(response)
    }

    pub async fn get_provider_stats(
        &self,
        provider_id: String,
    ) -> Result<ProviderStats, ProviderError> {
        self.storage.get_provider_stats(&provider_id).await
    }

    pub async fn get_persona(&self, persona_id: String) -> Result<Option<Persona>, ProviderError> {
        // Try to get from cache first
        {
            let personas = self.personas.read().await;
            if let Some(persona) = personas.get(&persona_id) {
                return Ok(Some(persona.clone()));
            }
        }

        // If not in cache, get from storage
        let persona = self.storage.get_persona(&persona_id).await?;
        if let Some(persona) = &persona {
            // Update cache
            let mut personas = self.personas.write().await;
            personas.insert(persona_id.clone(), persona.clone());
        }

        Ok(persona)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::Mutex;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_provider_router_basic_functionality() {
        // Create temporary database
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();

        // Create temporary history ledger
        let temp_path = format!("/tmp/test_providers_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));

        // Create messaging system
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );

        // Create policy engine
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Create context router
        let context_router = Arc::new(allternit_context_router::ContextRouter::new(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
            Arc::new(allternit_runtime_core::SessionManager::new(
                history_ledger.clone(),
                messaging_system.clone(),
            )),
        ));

        // Create memory fabric
        let memory_fabric = Arc::new(
            allternit_memory::MemoryFabric::new_with_storage(
                history_ledger.clone(),
                messaging_system.clone(),
                policy_engine.clone(),
                context_router.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );

        // Create session manager
        let session_manager = Arc::new(allternit_runtime_core::SessionManager::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Create provider router
        let provider_router = Arc::new(
            ProviderRouter::new_with_storage(
                history_ledger,
                messaging_system,
                policy_engine,
                context_router,
                memory_fabric,
                session_manager,
                pool,
            )
            .await
            .unwrap(),
        );

        // Create a test provider
        let provider_config = ProviderConfig {
            provider_id: "test-openai".to_string(),
            provider_type: ProviderType::OpenAI,
            endpoint: "https://api.openai.com/v1/chat/completions".to_string(),
            api_key: Some("sk-test123".to_string()),
            capabilities: vec![Capability {
                model: "gpt-4".to_string(),
                modalities: vec![Modality::Text],
                context_window: 8192,
                max_tokens: 4096,
                response_time_ms: 1000,
                cost_per_token: 0.00003,
                safety_tier: 3,
            }],
            budget: ProviderBudget {
                daily_limit: Some(100.0),
                monthly_limit: Some(1000.0),
                rate_limit: Some(1000),
                token_limit: Some(100000),
            },
            routing_preferences: RoutingPreferences {
                priority: 10,
                preferred_models: vec!["gpt-4".to_string()],
                avoided_models: vec![],
                latency_tolerance_ms: 2000,
                cost_tolerance: 0.1,
            },
            status: ProviderStatus::Active,
        };

        // Register the provider
        let provider_id = provider_router
            .register_provider(provider_config)
            .await
            .unwrap();
        assert_eq!(provider_id, "test-openai");

        // Create a test persona
        let persona = Persona {
            persona_id: "test-planner".to_string(),
            name: "Planner Persona".to_string(),
            description: "A persona for planning tasks".to_string(),
            base_persona: "gizzi".to_string(), // Base persona
            overlays: vec![PersonaOverlay {
                overlay_id: "planner-overlay".to_string(),
                name: "Planner Role".to_string(),
                description: "Planning persona overlay".to_string(),
                role: "planner".to_string(),
                personality_traits: HashMap::new(), // Could include specific traits
                behavior_modifiers: vec![
                    BehaviorModifier {
                        modifier_type: ModifierType::Tone(ToneModifier::Professional),
                        weight: 0.8,
                        parameters: HashMap::new(),
                    },
                    BehaviorModifier {
                        modifier_type: ModifierType::Style(StyleModifier::Analytical),
                        weight: 0.9,
                        parameters: HashMap::new(),
                    },
                ],
                response_formatting: ResponseFormatting {
                    max_length: Some(500),
                    min_length: Some(50),
                    preferred_language: Some("English".to_string()),
                    citation_style: Some(CitationStyle::APA),
                    output_schema: None,
                },
                safety_settings: SafetySettings {
                    content_filter_level: 3,
                    topic_restrictions: vec![],
                    response_guidelines: vec!["Be helpful and harmless".to_string()],
                },
                version: "1.0.0".to_string(),
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                updated_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            }],
            version: "1.0.0".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            is_active: true,
        };

        // Register the persona
        let persona_id = provider_router.register_persona(persona).await.unwrap();
        assert_eq!(persona_id, "test-planner");

        // Verify the provider was registered
        let providers = provider_router.providers.read().await;
        assert_eq!(providers.len(), 1);
        assert!(providers.contains_key("test-openai"));
        drop(providers);

        // Verify the persona was registered
        let personas = provider_router.personas.read().await;
        assert_eq!(personas.len(), 1);
        assert!(personas.contains_key("test-planner"));
        drop(personas);

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }
}
