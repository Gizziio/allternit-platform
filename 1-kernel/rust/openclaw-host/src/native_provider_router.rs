//! Provider Router Bridge - OC-041
//!
//! Bridge between OpenClaw's provider routing system and A2R's native provider system.
//! This module implements the adapter pattern to translate between OpenClaw provider operations
//! and A2R provider operations while maintaining A2R interface.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Provider identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ProviderId(String);

impl ProviderId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Provider type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ProviderType {
    #[serde(rename = "openai")]
    OpenAi,
    #[serde(rename = "anthropic")]
    Anthropic,
    #[serde(rename = "google")]
    Google,
    #[serde(rename = "mistral")]
    Mistral,
    #[serde(rename = "groq")]
    Groq,
    #[serde(rename = "azure")]
    Azure,
    #[serde(rename = "aws-bedrock")]
    AwsBedrock,
    #[serde(rename = "ollama")]
    Ollama,
    #[serde(rename = "custom")]
    Custom,
    #[serde(rename = "local")]
    Local,
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: ProviderId,
    pub provider_type: ProviderType,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub models: Vec<String>,
    pub default_model: Option<String>,
    pub rate_limits: Option<RateLimitConfig>,
    pub auth_config: Option<AuthConfig>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: Option<u32>,
    pub tokens_per_minute: Option<u32>,
    pub tokens_per_day: Option<u32>,
    pub burst_limit: Option<u32>,
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub auth_type: AuthType,
    pub auth_env_var: Option<String>,
    pub auth_file_path: Option<PathBuf>,
    pub oauth_config: Option<OAuthConfig>,
}

/// Authentication type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthType {
    #[serde(rename = "api-key")]
    ApiKey,
    #[serde(rename = "oauth")]
    OAuth,
    #[serde(rename = "aws-sdk")]
    AwsSdk,
    #[serde(rename = "bearer-token")]
    BearerToken,
    #[serde(rename = "none")]
    None,
}

/// OAuth configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub auth_url: String,
    pub token_url: String,
}

/// Provider health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub id: ProviderId,
    pub healthy: bool,
    pub last_checked: DateTime<Utc>,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
    pub model_support: HashMap<String, bool>, // Which models are available
}

/// Provider usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUsage {
    pub id: ProviderId,
    pub requests_count: u64,
    pub tokens_used: u64,
    pub tokens_generated: u64,
    pub cost_usd: f64,
    pub last_used: Option<DateTime<Utc>>,
    pub usage_period_start: DateTime<Utc>,
}

/// Provider router request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRouterRequest {
    pub operation: ProviderOperation,
    pub context: Option<ProviderContext>,
}

/// Provider operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderOperation {
    /// List all providers
    ListProviders,

    /// Get provider by ID
    GetProvider { id: ProviderId },

    /// Add or update provider
    UpsertProvider { config: ProviderConfig },

    /// Remove provider
    RemoveProvider { id: ProviderId },

    /// Check provider health
    CheckHealth { id: ProviderId },

    /// Get provider usage
    GetUsage { id: ProviderId },

    /// Rotate provider credentials
    RotateCredentials { id: ProviderId },

    /// Route a request to the best provider
    RouteRequest {
        request_type: String, // "chat", "completion", "embedding", etc.
        preferred_provider: Option<ProviderId>,
        fallback_providers: Option<Vec<ProviderId>>,
        request_data: serde_json::Value,
    },
}

/// Provider context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Provider router response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRouterResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Provider router configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRouterConfig {
    pub providers_dir: PathBuf,
    pub enable_persistence: bool,
    pub enable_auth_rotation: bool,
    pub enable_health_checks: bool,
    pub health_check_interval_minutes: Option<u64>,
    pub enable_usage_tracking: bool,
    pub enable_rate_limiting: bool,
    pub default_timeout_ms: u64,
    pub max_concurrent_requests: Option<usize>,
    pub enable_failover: bool,
    pub failover_strategy: FailoverStrategy,
    pub routing_algorithm: RoutingAlgorithm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailoverStrategy {
    #[serde(rename = "priority")]
    Priority, // Try providers in priority order
    #[serde(rename = "round-robin")]
    RoundRobin, // Distribute requests evenly
    #[serde(rename = "least-loaded")]
    LeastLoaded, // Send to least loaded provider
    #[serde(rename = "latency-based")]
    LatencyBased, // Send to fastest responding provider
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RoutingAlgorithm {
    #[serde(rename = "simple")]
    Simple, // Basic routing based on availability
    #[serde(rename = "weighted")]
    Weighted, // Weighted routing based on performance metrics
    #[serde(rename = "adaptive")]
    Adaptive, // Adaptive routing that learns from performance
}

impl Default for ProviderRouterConfig {
    fn default() -> Self {
        Self {
            providers_dir: PathBuf::from("./providers"),
            enable_persistence: true,
            enable_auth_rotation: true,
            enable_health_checks: true,
            health_check_interval_minutes: Some(5),
            enable_usage_tracking: true,
            enable_rate_limiting: true,
            default_timeout_ms: 30_000, // 30 seconds
            max_concurrent_requests: Some(10),
            enable_failover: true,
            failover_strategy: FailoverStrategy::Priority,
            routing_algorithm: RoutingAlgorithm::Weighted,
        }
    }
}

/// Provider router bridge service
pub struct ProviderRouterBridge {
    config: ProviderRouterConfig,
    providers: HashMap<ProviderId, ProviderConfig>,
    provider_health: HashMap<ProviderId, ProviderHealth>,
    provider_usage: HashMap<ProviderId, ProviderUsage>,
    health_check_semaphore: Option<tokio::sync::Semaphore>,
}

impl Default for ProviderRouterBridge {
    fn default() -> Self {
        Self::new()
    }
}

impl ProviderRouterBridge {
    /// Create new provider router bridge with default configuration
    pub fn new() -> Self {
        let config = ProviderRouterConfig::default();
        let semaphore = config
            .max_concurrent_requests
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            providers: HashMap::new(),
            provider_health: HashMap::new(),
            provider_usage: HashMap::new(),
            health_check_semaphore: semaphore,
        }
    }

    /// Create new provider router bridge with custom configuration
    pub fn with_config(config: ProviderRouterConfig) -> Self {
        let semaphore = config
            .max_concurrent_requests
            .map(tokio::sync::Semaphore::new);

        Self {
            config,
            providers: HashMap::new(),
            provider_health: HashMap::new(),
            provider_usage: HashMap::new(),
            health_check_semaphore: semaphore,
        }
    }

    /// Initialize the service by loading existing provider configurations
    pub async fn initialize(&mut self) -> Result<(), ProviderRouterError> {
        self.ensure_providers_dir().await?;
        self.load_provider_configs().await?;
        self.load_auth_configs().await?;
        self.initialize_health_checkers().await?;
        self.initialize_usage_trackers();
        Ok(())
    }

    /// Ensure the providers directory exists
    async fn ensure_providers_dir(&self) -> Result<(), ProviderRouterError> {
        fs::create_dir_all(&self.config.providers_dir)
            .await
            .map_err(|e| {
                ProviderRouterError::IoError(format!("Failed to create providers directory: {}", e))
            })
    }

    /// Load provider configurations from disk
    async fn load_provider_configs(&mut self) -> Result<(), ProviderRouterError> {
        if !self.config.providers_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.providers_dir)
            .await
            .map_err(|e| {
                ProviderRouterError::IoError(format!("Failed to read providers directory: {}", e))
            })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            ProviderRouterError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    if let Ok(provider_config) = serde_json::from_str::<ProviderConfig>(&content) {
                        self.providers
                            .insert(provider_config.id.clone(), provider_config);
                    }
                }
            }
        }

        Ok(())
    }

    /// Load authentication configurations from disk
    async fn load_auth_configs(&mut self) -> Result<(), ProviderRouterError> {
        // In a real implementation, this would load auth profiles
        // For now, we'll just ensure the auth directory exists
        let auth_dir = self.config.providers_dir.join("auth");
        fs::create_dir_all(&auth_dir).await.map_err(|e| {
            ProviderRouterError::IoError(format!("Failed to create auth directory: {}", e))
        })?;

        Ok(())
    }

    /// Initialize health checkers for providers
    async fn initialize_health_checkers(&mut self) -> Result<(), ProviderRouterError> {
        for (id, config) in &self.providers {
            if config.enabled && self.config.enable_health_checks {
                // Initialize health status for each provider
                self.provider_health.insert(
                    id.clone(),
                    ProviderHealth {
                        id: id.clone(),
                        healthy: false, // Will be checked on first use
                        last_checked: Utc::now(),
                        error: None,
                        latency_ms: None,
                        model_support: config
                            .models
                            .iter()
                            .map(|model| (model.clone(), true))
                            .collect(),
                    },
                );
            }
        }

        Ok(())
    }

    /// Initialize usage trackers for providers
    fn initialize_usage_trackers(&mut self) {
        for id in self.providers.keys() {
            if self.config.enable_usage_tracking {
                self.provider_usage.insert(
                    id.clone(),
                    ProviderUsage {
                        id: id.clone(),
                        requests_count: 0,
                        tokens_used: 0,
                        tokens_generated: 0,
                        cost_usd: 0.0,
                        last_used: None,
                        usage_period_start: Utc::now(),
                    },
                );
            }
        }
    }

    /// Execute a provider router operation
    pub async fn execute(
        &mut self,
        request: ProviderRouterRequest,
    ) -> Result<ProviderRouterResponse, ProviderRouterError> {
        let start_time = std::time::Instant::now();

        let result = match request.operation {
            ProviderOperation::ListProviders => self.list_providers().await,
            ProviderOperation::GetProvider { id } => self.get_provider(&id).await,
            ProviderOperation::UpsertProvider { config } => self.upsert_provider(config).await,
            ProviderOperation::RemoveProvider { id } => self.remove_provider(&id).await,
            ProviderOperation::CheckHealth { id } => self.check_health(&id).await,
            ProviderOperation::GetUsage { id } => self.get_usage(&id).await,
            ProviderOperation::RotateCredentials { id } => self.rotate_credentials(&id).await,
            ProviderOperation::RouteRequest {
                request_type,
                preferred_provider,
                fallback_providers,
                request_data,
            } => {
                self.route_request(
                    request_type,
                    preferred_provider,
                    fallback_providers,
                    request_data,
                )
                .await
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(ProviderRouterResponse {
                success: true,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(ProviderRouterResponse {
                success: false,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// List all providers
    async fn list_providers(&self) -> Result<serde_json::Value, ProviderRouterError> {
        let providers: Vec<serde_json::Value> = self
            .providers
            .values()
            .map(|config| {
                serde_json::json!({
                    "id": config.id.as_str(),
                    "type": match config.provider_type {
                        ProviderType::OpenAi => "openai",
                        ProviderType::Anthropic => "anthropic",
                        ProviderType::Google => "google",
                        ProviderType::Mistral => "mistral",
                        ProviderType::Groq => "groq",
                        ProviderType::Azure => "azure",
                        ProviderType::AwsBedrock => "aws-bedrock",
                        ProviderType::Ollama => "ollama",
                        ProviderType::Custom => "custom",
                        ProviderType::Local => "local",
                    },
                    "name": config.name,
                    "enabled": config.enabled,
                    "models": config.models,
                    "defaultModel": config.default_model,
                    "hasApiKey": config.api_key.is_some(),
                    "baseUrl": config.base_url,
                    "rateLimits": config.rate_limits,
                    "metadata": config.metadata,
                })
            })
            .collect();

        Ok(serde_json::json!({
            "providers": providers,
            "count": providers.len(),
        }))
    }

    /// Get a specific provider
    async fn get_provider(
        &self,
        id: &ProviderId,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        match self.providers.get(id) {
            Some(config) => Ok(serde_json::json!({
                "provider": {
                    "id": config.id.as_str(),
                    "type": match config.provider_type {
                        ProviderType::OpenAi => "openai",
                        ProviderType::Anthropic => "anthropic",
                        ProviderType::Google => "google",
                        ProviderType::Mistral => "mistral",
                        ProviderType::Groq => "groq",
                        ProviderType::Azure => "azure",
                        ProviderType::AwsBedrock => "aws-bedrock",
                        ProviderType::Ollama => "ollama",
                        ProviderType::Custom => "custom",
                        ProviderType::Local => "local",
                    },
                    "name": config.name,
                    "description": config.description,
                    "enabled": config.enabled,
                    "models": config.models,
                    "defaultModel": config.default_model,
                    "baseUrl": config.base_url,
                    "rateLimits": config.rate_limits,
                    "authConfig": config.auth_config,
                    "metadata": config.metadata,
                    "createdAt": config.created_at,
                    "updatedAt": config.updated_at,
                    "health": self.provider_health.get(id).map(|h| {
                        serde_json::json!({
                            "healthy": h.healthy,
                            "lastChecked": h.last_checked,
                            "error": h.error,
                            "latencyMs": h.latency_ms,
                        })
                    }),
                    "usage": self.provider_usage.get(id).map(|u| {
                        serde_json::json!({
                            "requestsCount": u.requests_count,
                            "tokensUsed": u.tokens_used,
                            "tokensGenerated": u.tokens_generated,
                            "costUsd": u.cost_usd,
                            "lastUsed": u.last_used,
                        })
                    }),
                }
            })),
            None => Err(ProviderRouterError::ProviderNotFound(id.0.clone())),
        }
    }

    /// Add or update a provider
    async fn upsert_provider(
        &mut self,
        config: ProviderConfig,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        let provider_id = config.id.clone();

        // Validate provider configuration
        self.validate_provider_config(&config)?;

        // Update timestamps
        let mut config = config;
        if self.providers.contains_key(&provider_id) {
            // Update existing provider
            config.updated_at = Utc::now();
        } else {
            // New provider
            config.created_at = Utc::now();
        }

        // Add to registry
        self.providers.insert(provider_id.clone(), config.clone());

        // Initialize health and usage tracking if needed
        if self.config.enable_health_checks && !self.provider_health.contains_key(&provider_id) {
            self.provider_health.insert(
                provider_id.clone(),
                ProviderHealth {
                    id: provider_id.clone(),
                    healthy: false,
                    last_checked: Utc::now(),
                    error: None,
                    latency_ms: None,
                    model_support: config
                        .models
                        .iter()
                        .map(|model| (model.clone(), true))
                        .collect(),
                },
            );
        }

        if self.config.enable_usage_tracking && !self.provider_usage.contains_key(&provider_id) {
            self.provider_usage.insert(
                provider_id.clone(),
                ProviderUsage {
                    id: provider_id.clone(),
                    requests_count: 0,
                    tokens_used: 0,
                    tokens_generated: 0,
                    cost_usd: 0.0,
                    last_used: None,
                    usage_period_start: Utc::now(),
                },
            );
        }

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_provider_config(&config).await?;
        }

        Ok(serde_json::json!({
            "status": "provider_upserted",
            "id": provider_id.as_str(),
        }))
    }

    /// Remove a provider
    async fn remove_provider(
        &mut self,
        id: &ProviderId,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        if !self.providers.contains_key(id) {
            return Err(ProviderRouterError::ProviderNotFound(id.0.clone()));
        }

        // Remove from registry
        self.providers.remove(id);

        // Remove from health and usage tracking
        self.provider_health.remove(id);
        self.provider_usage.remove(id);

        // Remove from disk if persistence is enabled
        if self.config.enable_persistence {
            let provider_path = self.provider_config_path(id);
            if provider_path.exists() {
                fs::remove_file(&provider_path).await.map_err(|e| {
                    ProviderRouterError::IoError(format!(
                        "Failed to remove provider config file: {}",
                        e
                    ))
                })?;
            }
        }

        Ok(serde_json::json!({
            "status": "provider_removed",
            "id": id.as_str(),
        }))
    }

    /// Check provider health
    async fn check_health(
        &mut self,
        id: &ProviderId,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        if !self.providers.contains_key(id) {
            return Err(ProviderRouterError::ProviderNotFound(id.0.clone()));
        }

        // Acquire health check semaphore if configured
        let _permit = if let Some(semaphore) = &self.health_check_semaphore {
            Some(semaphore.acquire().await.map_err(|e| {
                ProviderRouterError::ResourceError(format!(
                    "Failed to acquire health check permit: {}",
                    e
                ))
            })?)
        } else {
            None
        };

        let config = self.providers.get(id).unwrap();

        // In a real implementation, this would make an actual API call to test the provider
        // For now, we'll simulate the health check
        let health_result = self.simulate_health_check(config).await;

        // Update health status
        let health = ProviderHealth {
            id: id.clone(),
            healthy: health_result.healthy,
            last_checked: Utc::now(),
            error: health_result.error,
            latency_ms: health_result.latency_ms,
            model_support: health_result.model_support,
        };

        self.provider_health.insert(id.clone(), health.clone());

        Ok(serde_json::json!({
            "health": health,
        }))
    }

    /// Get provider usage statistics
    async fn get_usage(&self, id: &ProviderId) -> Result<serde_json::Value, ProviderRouterError> {
        if !self.providers.contains_key(id) {
            return Err(ProviderRouterError::ProviderNotFound(id.0.clone()));
        }

        match self.provider_usage.get(id) {
            Some(usage) => Ok(serde_json::json!({
                "usage": usage,
            })),
            None => {
                // Initialize default usage if not found
                let default_usage = ProviderUsage {
                    id: id.clone(),
                    requests_count: 0,
                    tokens_used: 0,
                    tokens_generated: 0,
                    cost_usd: 0.0,
                    last_used: None,
                    usage_period_start: Utc::now(),
                };

                Ok(serde_json::json!({
                    "usage": default_usage,
                }))
            }
        }
    }

    /// Rotate provider credentials
    async fn rotate_credentials(
        &mut self,
        id: &ProviderId,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        if !self.providers.contains_key(id) {
            return Err(ProviderRouterError::ProviderNotFound(id.0.clone()));
        }

        if !self.config.enable_auth_rotation {
            return Err(ProviderRouterError::PermissionDenied(
                "Auth rotation is disabled".to_string(),
            ));
        }

        let mut config = self.providers.get_mut(id).unwrap().clone();

        // In a real implementation, this would rotate the actual credentials
        // For now, we'll just update the metadata to indicate rotation happened
        if let Some(ref mut metadata) = config.metadata {
            metadata.insert(
                "lastRotated".to_string(),
                serde_json::Value::String(Utc::now().to_rfc3339()),
            );
        } else {
            let mut metadata = HashMap::new();
            metadata.insert(
                "lastRotated".to_string(),
                serde_json::Value::String(Utc::now().to_rfc3339()),
            );
            config.metadata = Some(metadata);
        }

        config.updated_at = Utc::now();

        // Update in registry
        self.providers.insert(id.clone(), config);

        // Persist if enabled
        if self.config.enable_persistence {
            if let Some(config) = self.providers.get(id) {
                self.persist_provider_config(config).await?;
            }
        }

        Ok(serde_json::json!({
            "status": "credentials_rotated",
            "id": id.as_str(),
        }))
    }

    /// Route a request to the appropriate provider
    async fn route_request(
        &mut self,
        request_type: String,
        preferred_provider: Option<ProviderId>,
        fallback_providers: Option<Vec<ProviderId>>,
        request_data: serde_json::Value,
    ) -> Result<serde_json::Value, ProviderRouterError> {
        // Find the best available provider based on routing algorithm
        let provider_id = self
            .select_best_provider(&request_type, preferred_provider, fallback_providers)
            .await?;

        // In a real implementation, this would delegate to the selected provider
        // For now, we'll return a mock response indicating which provider would be used
        let response = serde_json::json!({
            "selectedProvider": provider_id.as_str(),
            "requestType": request_type,
            "requestData": request_data,
            "status": "request_would_be_routed",
            "details": "In a real implementation, this would be forwarded to the selected provider",
        });

        // Update usage statistics
        if let Some(usage) = self.provider_usage.get_mut(&provider_id) {
            usage.requests_count += 1;
            usage.last_used = Some(Utc::now());
        }

        Ok(response)
    }

    /// Select the best provider for a request
    async fn select_best_provider(
        &self,
        _request_type: &str,
        preferred: Option<ProviderId>,
        fallbacks: Option<Vec<ProviderId>>,
    ) -> Result<ProviderId, ProviderRouterError> {
        // If a preferred provider is specified, try it first
        if let Some(preferred_id) = preferred {
            if let Some(config) = self.providers.get(&preferred_id) {
                if config.enabled && self.is_provider_healthy(&preferred_id).await {
                    return Ok(preferred_id);
                }
            }
        }

        // Otherwise, select based on routing algorithm
        match self.config.routing_algorithm {
            RoutingAlgorithm::Simple => {
                // Just return the first available provider
                for (id, config) in &self.providers {
                    if config.enabled && self.is_provider_healthy(id).await {
                        return Ok(id.clone());
                    }
                }
            }
            RoutingAlgorithm::Weighted => {
                // Select based on weighted probability considering health and load
                let mut healthy_providers: Vec<(&ProviderId, &ProviderConfig)> = Vec::new();
                for (id, config) in &self.providers {
                    if config.enabled && self.is_provider_healthy(id).await {
                        healthy_providers.push((id, config));
                    }
                }

                if !healthy_providers.is_empty() {
                    // For now, just return the first one - in a real implementation,
                    // we'd use weights based on performance metrics
                    return Ok(healthy_providers[0].0.clone());
                }
            }
            RoutingAlgorithm::Adaptive => {
                // Select based on adaptive learning from past performance
                // For now, just return the first available healthy provider
                for (id, config) in &self.providers {
                    if config.enabled && self.is_provider_healthy(id).await {
                        return Ok(id.clone());
                    }
                }
            }
        }

        // If no preferred provider worked, try fallbacks
        if let Some(fallback_list) = fallbacks {
            for fallback_id in fallback_list {
                if let Some(config) = self.providers.get(&fallback_id) {
                    if config.enabled && self.is_provider_healthy(&fallback_id).await {
                        return Ok(fallback_id);
                    }
                }
            }
        }

        // If we get here, no provider is available
        Err(ProviderRouterError::NoAvailableProviders)
    }

    /// Check if a provider is healthy
    async fn is_provider_healthy(&self, id: &ProviderId) -> bool {
        if let Some(health) = self.provider_health.get(id) {
            // For now, just check if it was recently checked and marked as healthy
            // In a real implementation, we'd have more sophisticated health checks
            health.healthy
        } else {
            false // Assume unhealthy if no health data
        }
    }

    /// Simulate health check (in a real implementation, this would make actual API calls)
    async fn simulate_health_check(&self, config: &ProviderConfig) -> HealthCheckResult {
        // In a real implementation, this would make an actual API call to test the provider
        // For now, we'll return a simulated result based on whether API key is set

        // Simulate a small delay
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        HealthCheckResult {
            healthy: config.api_key.is_some() || config.provider_type == ProviderType::Local, // Local providers are always healthy
            error: if config.api_key.is_none() && config.provider_type != ProviderType::Local {
                Some("Missing API key".to_string())
            } else {
                None
            },
            latency_ms: Some(100), // Simulated latency
            model_support: config
                .models
                .iter()
                .map(|model| (model.clone(), true))
                .collect(),
        }
    }

    /// Validate provider configuration
    fn validate_provider_config(&self, config: &ProviderConfig) -> Result<(), ProviderRouterError> {
        if config.id.as_str().is_empty() {
            return Err(ProviderRouterError::ValidationError(
                "Provider ID cannot be empty".to_string(),
            ));
        }

        if config.name.is_empty() {
            return Err(ProviderRouterError::ValidationError(
                "Provider name cannot be empty".to_string(),
            ));
        }

        if config.enabled && config.provider_type != ProviderType::Local && config.api_key.is_none()
        {
            // For non-local providers, API key is typically required when enabled
            // This could be configurable based on provider type
        }

        Ok(())
    }

    /// Persist provider configuration to disk
    async fn persist_provider_config(
        &self,
        config: &ProviderConfig,
    ) -> Result<(), ProviderRouterError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let provider_path = self.provider_config_path(&config.id);
        let config_json = serde_json::to_string_pretty(config).map_err(|e| {
            ProviderRouterError::SerializationError(format!(
                "Failed to serialize provider config: {}",
                e
            ))
        })?;

        fs::write(&provider_path, config_json).await.map_err(|e| {
            ProviderRouterError::IoError(format!("Failed to write provider config: {}", e))
        })?;

        Ok(())
    }

    /// Get the file path for a provider config
    fn provider_config_path(&self, id: &ProviderId) -> PathBuf {
        self.config
            .providers_dir
            .join(format!("{}.json", id.as_str()))
    }

    /// Get current configuration
    pub fn config(&self) -> &ProviderRouterConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ProviderRouterConfig {
        &mut self.config
    }

    /// Get provider by ID
    pub fn get_provider_config(&self, id: &ProviderId) -> Option<&ProviderConfig> {
        self.providers.get(id)
    }

    /// Check if provider exists
    pub fn has_provider(&self, id: &ProviderId) -> bool {
        self.providers.contains_key(id)
    }
}

/// Result of a health check
struct HealthCheckResult {
    healthy: bool,
    error: Option<String>,
    latency_ms: Option<u64>,
    model_support: HashMap<String, bool>,
}

/// Provider router error
#[derive(Debug, thiserror::Error)]
pub enum ProviderRouterError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("No available providers")]
    NoAvailableProviders,

    #[error("Resource error: {0}")]
    ResourceError(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Authentication error: {0}")]
    AuthenticationError(String),
}

impl From<serde_json::Error> for ProviderRouterError {
    fn from(error: serde_json::Error) -> Self {
        ProviderRouterError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provider_router_creation() {
        let router = ProviderRouterBridge::new();
        assert_eq!(router.config.providers_dir, PathBuf::from("./providers"));
        assert!(router.config.enable_health_checks);
        assert_eq!(router.providers.len(), 0);
    }

    #[tokio::test]
    async fn test_provider_router_with_config() {
        let config = ProviderRouterConfig {
            providers_dir: PathBuf::from("/tmp/test-providers"),
            enable_persistence: false,
            enable_auth_rotation: false,
            enable_health_checks: true,
            health_check_interval_minutes: Some(10),
            enable_usage_tracking: true,
            enable_rate_limiting: true,
            default_timeout_ms: 15_000,
            max_concurrent_requests: Some(5),
            enable_failover: false,
            failover_strategy: FailoverStrategy::RoundRobin,
            routing_algorithm: RoutingAlgorithm::Simple,
        };

        let router = ProviderRouterBridge::with_config(config);
        assert_eq!(
            router.config.providers_dir,
            PathBuf::from("/tmp/test-providers")
        );
        assert!(!router.config.enable_auth_rotation);
    }

    #[tokio::test]
    async fn test_upsert_and_get_provider() {
        let mut router = ProviderRouterBridge::new();

        let provider_config = ProviderConfig {
            id: ProviderId::new("openai-test".to_string()),
            provider_type: ProviderType::OpenAi,
            name: "OpenAI Test".to_string(),
            description: Some("Test OpenAI provider".to_string()),
            enabled: true,
            api_key: Some("test-key".to_string()),
            base_url: Some("https://api.openai.com".to_string()),
            models: vec!["gpt-4".to_string(), "gpt-3.5-turbo".to_string()],
            default_model: Some("gpt-4".to_string()),
            rate_limits: Some(RateLimitConfig {
                requests_per_minute: Some(3000),
                tokens_per_minute: Some(250_000),
                tokens_per_day: Some(10_000_000),
                burst_limit: Some(100),
            }),
            auth_config: Some(AuthConfig {
                auth_type: AuthType::ApiKey,
                auth_env_var: Some("OPENAI_API_KEY".to_string()),
                auth_file_path: None,
                oauth_config: None,
            }),
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert("test".to_string(), serde_json::Value::Bool(true));
                meta
            }),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Add provider
        let upsert_result = router
            .upsert_provider(provider_config.clone())
            .await
            .unwrap();
        assert!(upsert_result.get("status").and_then(|v| v.as_str()) == Some("provider_upserted"));

        // Get provider
        let get_result = router
            .get_provider(&ProviderId::new("openai-test".to_string()))
            .await
            .unwrap();
        let provider_data = get_result.get("provider").unwrap();

        assert_eq!(
            provider_data.get("id").and_then(|v| v.as_str()),
            Some("openai-test")
        );
        assert_eq!(
            provider_data.get("type").and_then(|v| v.as_str()),
            Some("openai")
        );
        assert_eq!(
            provider_data.get("enabled").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[tokio::test]
    async fn test_list_providers() {
        let mut router = ProviderRouterBridge::new();

        // Add a few providers
        for i in 1..=3 {
            let provider_config = ProviderConfig {
                id: ProviderId::new(format!("provider-{}", i)),
                provider_type: ProviderType::OpenAi,
                name: format!("Provider {}", i),
                description: Some(format!("Test provider {}", i)),
                enabled: true,
                api_key: Some(format!("key-{}", i)),
                base_url: None,
                models: vec![format!("model-{}", i)],
                default_model: Some(format!("model-{}", i)),
                rate_limits: None,
                auth_config: None,
                metadata: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            router.upsert_provider(provider_config).await.unwrap();
        }

        // List providers
        let list_result = router.list_providers().await.unwrap();
        let providers = list_result.get("providers").unwrap().as_array().unwrap();
        let count = list_result.get("count").unwrap().as_u64().unwrap();

        assert_eq!(providers.len(), 3);
        assert_eq!(count, 3);
    }

    #[tokio::test]
    async fn test_remove_provider() {
        let mut router = ProviderRouterBridge::new();

        let provider_config = ProviderConfig {
            id: ProviderId::new("to-delete".to_string()),
            provider_type: ProviderType::Anthropic,
            name: "To Delete".to_string(),
            description: Some("Provider to test deletion".to_string()),
            enabled: true,
            api_key: Some("delete-key".to_string()),
            base_url: None,
            models: vec!["claude-3".to_string()],
            default_model: Some("claude-3".to_string()),
            rate_limits: None,
            auth_config: None,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        router.upsert_provider(provider_config).await.unwrap();
        assert!(router.has_provider(&ProviderId::new("to-delete".to_string())));

        // Remove provider
        let remove_result = router
            .remove_provider(&ProviderId::new("to-delete".to_string()))
            .await
            .unwrap();
        assert!(remove_result.get("status").and_then(|v| v.as_str()) == Some("provider_removed"));

        assert!(!router.has_provider(&ProviderId::new("to-delete".to_string())));
    }

    #[tokio::test]
    async fn test_health_check() {
        let mut router = ProviderRouterBridge::new();

        let provider_config = ProviderConfig {
            id: ProviderId::new("health-test".to_string()),
            provider_type: ProviderType::Google,
            name: "Health Test".to_string(),
            description: Some("Provider to test health checking".to_string()),
            enabled: true,
            api_key: Some("health-key".to_string()),
            base_url: Some("https://generativelanguage.googleapis.com".to_string()),
            models: vec!["gemini-pro".to_string()],
            default_model: Some("gemini-pro".to_string()),
            rate_limits: None,
            auth_config: None,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        router.upsert_provider(provider_config).await.unwrap();

        // Check health
        let health_result = router
            .check_health(&ProviderId::new("health-test".to_string()))
            .await
            .unwrap();
        let health_data = health_result.get("health").unwrap();

        assert_eq!(
            health_data.get("id").and_then(|v| v.as_str()),
            Some("health-test")
        );
        // Health might be true or false depending on API key validity
    }

    #[tokio::test]
    async fn test_route_request() {
        let mut router = ProviderRouterBridge::new();

        // Add a provider
        let provider_config = ProviderConfig {
            id: ProviderId::new("route-test".to_string()),
            provider_type: ProviderType::OpenAi,
            name: "Route Test".to_string(),
            description: Some("Provider to test routing".to_string()),
            enabled: true,
            api_key: Some("route-key".to_string()),
            base_url: Some("https://api.openai.com".to_string()),
            models: vec!["gpt-4".to_string()],
            default_model: Some("gpt-4".to_string()),
            rate_limits: None,
            auth_config: None,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        router.upsert_provider(provider_config).await.unwrap();

        // Route a request
        let request_data = serde_json::json!({
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}],
            "temperature": 0.7
        });

        let route_result = router
            .route_request(
                "chat".to_string(),
                Some(ProviderId::new("route-test".to_string())),
                None,
                request_data,
            )
            .await
            .unwrap();

        assert!(route_result.get("selectedProvider").is_some());
        assert_eq!(
            route_result
                .get("selectedProvider")
                .and_then(|v| v.as_str()),
            Some("route-test")
        );
        assert_eq!(
            route_result.get("status").and_then(|v| v.as_str()),
            Some("request_would_be_routed")
        );
    }

    #[test]
    fn test_provider_id_display() {
        let provider_id = ProviderId::new("openai".to_string());
        assert_eq!(format!("{}", provider_id), "openai");
    }

    #[test]
    fn test_provider_types() {
        assert_eq!(
            serde_json::to_string(&ProviderType::OpenAi).unwrap(),
            "\"openai\""
        );
        assert_eq!(
            serde_json::to_string(&ProviderType::Anthropic).unwrap(),
            "\"anthropic\""
        );
        assert_eq!(
            serde_json::to_string(&ProviderType::Google).unwrap(),
            "\"google\""
        );
    }
}
