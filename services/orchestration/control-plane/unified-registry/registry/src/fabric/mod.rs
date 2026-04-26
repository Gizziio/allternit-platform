//! Data Fabric implementation for the Unified Registry.

use crate::{agents, tools};
use allternit_history::HistoryLedger;
use allternit_messaging::{
    ConflictPolicy, LeaseEnvelope, LeaseScope, MailMessageEnvelope, MessagingSystem,
};
use allternit_policy::PolicyEngine;
use allternit_skills::SkillRegistry;
use allternit_tools_gateway::ToolDefinition;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, Row};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum FabricError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] allternit_history::HistoryError),
    #[error("Messaging error: {0}")]
    Messaging(#[from] allternit_messaging::MessagingError),
    #[error("Policy error: {0}")]
    Policy(#[from] allternit_policy::PolicyError),
    #[error("Skills error: {0}")]
    Skills(#[from] allternit_skills::SkillsError),
    #[error("Registry error: {0}")]
    Registry(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Validation failed: {0}")]
    Validation(String),
}

/// The Data Fabric provides unified access to all registry data across different storage types.
pub struct DataFabric {
    /// Primary SQL database for structured data
    primary_db: Arc<AnyPool>,

    /// KV cache for fast access patterns (Redis)
    kv_cache: Option<Arc<tokio::sync::Mutex<redis::aio::MultiplexedConnection>>>,

    /// Vector database for semantic search
    vector_db: Option<Arc<VectorDatabase>>,

    /// Agent registry component
    agent_registry: Arc<agents::AgentRegistry>,

    /// Tool registry component
    tool_registry: Arc<tools::ToolRegistry>,

    /// Skill registry component
    skill_registry: Arc<SkillRegistry>,

    /// History ledger for audit trails
    history_ledger: Arc<Mutex<HistoryLedger>>,

    /// Messaging system for event propagation
    messaging_system: Arc<MessagingSystem>,

    /// Policy engine for access control
    policy_engine: Arc<PolicyEngine>,
}

/// Simple vector database mock for semantic search
/// In production, this would be replaced with Pinecone, Chroma, or similar
pub struct VectorDatabase {
    embeddings: Arc<Mutex<std::collections::HashMap<String, Vec<f32>>>>,
    metadata: Arc<Mutex<std::collections::HashMap<String, serde_json::Value>>>,
}

impl Default for VectorDatabase {
    fn default() -> Self {
        Self::new()
    }
}

impl VectorDatabase {
    pub fn new() -> Self {
        Self {
            embeddings: Arc::new(Mutex::new(std::collections::HashMap::new())),
            metadata: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn store_embedding(
        &self,
        id: String,
        embedding: Vec<f32>,
        metadata: serde_json::Value,
    ) -> Result<(), FabricError> {
        let mut embeddings_map = self.embeddings.lock().unwrap();
        let mut metadata_map = self.metadata.lock().unwrap();

        embeddings_map.insert(id.clone(), embedding);
        metadata_map.insert(id, metadata);

        Ok(())
    }

    pub async fn search_similar(
        &self,
        query_embedding: &[f32],
        top_k: usize,
    ) -> Result<Vec<(String, f32)>, FabricError> {
        let embeddings_map = self.embeddings.lock().unwrap();
        let mut similarities = Vec::new();

        for (id, embedding) in embeddings_map.iter() {
            let similarity = self.cosine_similarity(query_embedding, embedding);
            similarities.push((id.clone(), similarity));
        }

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top_k results
        Ok(similarities.into_iter().take(top_k).collect())
    }

    pub fn get_metadata(&self, id: &str) -> Option<serde_json::Value> {
        let metadata_map = self.metadata.lock().unwrap();
        metadata_map.get(id).cloned()
    }

    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if magnitude_a == 0.0 || magnitude_b == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_a * magnitude_b)
    }
}

impl DataFabric {
    pub async fn new(
        primary_db: Arc<AnyPool>,
        kv_cache_url: Option<&str>,
        agent_registry: Arc<agents::AgentRegistry>,
        tool_registry: Arc<tools::ToolRegistry>,
        skill_registry: Arc<SkillRegistry>,
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        policy_engine: Arc<PolicyEngine>,
    ) -> Result<Self, FabricError> {
        let kv_cache = if let Some(url) = kv_cache_url {
            let client = redis::Client::open(url).map_err(|e| {
                FabricError::Registry(format!("Failed to create Redis client: {}", e))
            })?;
            let connection = client
                .get_multiplexed_async_connection()
                .await
                .map_err(|e| FabricError::Registry(format!("Failed to connect to Redis: {}", e)))?;
            Some(Arc::new(tokio::sync::Mutex::new(connection)))
        } else {
            None
        };

        let vector_db = Some(Arc::new(VectorDatabase::new()));

        Ok(DataFabric {
            primary_db,
            kv_cache,
            vector_db,
            agent_registry,
            tool_registry,
            skill_registry,
            history_ledger,
            messaging_system,
            policy_engine,
        })
    }

    /// Initialize the required database schemas
    pub async fn initialize_schema(&self) -> Result<(), FabricError> {
        // Initialize agent registry schema
        self.agent_registry
            .initialize_schema()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;

        // Initialize tool registry schema
        self.tool_registry
            .initialize_schema()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;

        // Initialize KV cache if available
        if let Some(ref cache) = self.kv_cache {
            let mut conn = cache.lock().await;
            // Test connection by setting a simple key
            let _: () = conn.set("health_check", "ok").await.map_err(|e| {
                FabricError::Registry(format!("KV cache health check failed: {}", e))
            })?;
        }

        Ok(())
    }

    /// Get a value from the KV cache
    pub async fn get_from_cache(&self, key: &str) -> Result<Option<String>, FabricError> {
        if let Some(ref cache) = self.kv_cache {
            let mut conn = cache.lock().await;
            let result: Option<String> = conn
                .get(key)
                .await
                .map_err(|e| FabricError::Registry(format!("KV cache get failed: {}", e)))?;
            Ok(result)
        } else {
            Ok(None)
        }
    }

    /// Set a value in the KV cache
    pub async fn set_in_cache(&self, key: &str, value: &str) -> Result<(), FabricError> {
        if let Some(ref cache) = self.kv_cache {
            let mut conn = cache.lock().await;
            let _: () = conn
                .set(key, value)
                .await
                .map_err(|e| FabricError::Registry(format!("KV cache set failed: {}", e)))?;
            Ok(())
        } else {
            Ok(())
        }
    }

    /// Store an embedding in the vector database
    pub async fn store_embedding(
        &self,
        id: String,
        embedding: Vec<f32>,
        metadata: serde_json::Value,
    ) -> Result<(), FabricError> {
        if let Some(ref vector_db) = self.vector_db {
            vector_db.store_embedding(id, embedding, metadata).await
        } else {
            Err(FabricError::NotFound(
                "Vector database not available".to_string(),
            ))
        }
    }

    /// Search for similar items in the vector database
    pub async fn search_embeddings(
        &self,
        query_embedding: &[f32],
        top_k: usize,
    ) -> Result<Vec<(String, f32)>, FabricError> {
        if let Some(ref vector_db) = self.vector_db {
            vector_db.search_similar(query_embedding, top_k).await
        } else {
            Ok(Vec::new()) // Return empty if vector DB not available
        }
    }

    /// Generate embedding for text (simple hash-based approach for now)
    pub fn generate_embedding(&self, text: &str) -> Vec<f32> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();

        // Convert hash to a vector of f32 values (size 1536 to match typical embedding dimensions)
        let mut embedding = Vec::with_capacity(1536);
        for i in 0..1536 {
            let val = ((hash ^ (i as u64)) % 1000) as f32 / 1000.0; // Normalize to 0-1
            embedding.push(val);
        }

        embedding
    }

    pub async fn store_with_embedding(
        &self,
        id: &str,
        data: serde_json::Value,
        text_content: &str,
    ) -> Result<(), FabricError> {
        let embedding = self.generate_embedding(text_content);
        self.store_embedding(id.to_string(), embedding, data).await
    }

    pub async fn semantic_search(
        &self,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<FabricSearchResult>, FabricError> {
        let query_embedding = self.generate_embedding(query);
        let results = self.search_embeddings(&query_embedding, top_k).await?;

        let mut output = Vec::new();
        for (id, score) in results {
            let metadata = self
                .vector_db
                .as_ref()
                .and_then(|vector_db| vector_db.get_metadata(&id))
                .unwrap_or(serde_json::Value::Null);

            output.push(FabricSearchResult {
                id,
                score,
                metadata,
            });
        }

        Ok(output)
    }

    pub async fn invalidate_cache_pattern(&self, pattern: &str) -> Result<(), FabricError> {
        if let Some(ref cache) = self.kv_cache {
            let mut conn = cache.lock().await;
            let keys: Vec<String> = conn
                .keys(pattern)
                .await
                .map_err(|e| FabricError::Registry(format!("KV cache scan failed: {}", e)))?;
            for key in keys {
                let _: () = conn
                    .del(key)
                    .await
                    .map_err(|e| FabricError::Registry(format!("KV cache delete failed: {}", e)))?;
            }
        }

        Ok(())
    }

    pub async fn bridge_agent_mail_coordination(
        &self,
        resource_selector: &str,
        message: MailMessageEnvelope,
    ) -> Result<BridgedCoordinationResult, FabricError> {
        self.messaging_system
            .agent_mail
            .send_message(message.clone())
            .await?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let lease = LeaseEnvelope {
            lease_id: Uuid::new_v4().to_string(),
            tenant_id: message.tenant_id.clone(),
            holder_identity: message.from_identity.clone(),
            resource_selector: resource_selector.to_string(),
            purpose: format!("coordination for thread {}", message.thread_id),
            scope: LeaseScope::Task,
            acquired_at: now,
            expires_at: now + 3600,
            trace_id: message.trace_id.clone(),
            renew_token: Some(Uuid::new_v4().to_string()),
            conflict_policy: ConflictPolicy::NotifyOnly,
        };

        let acquired = self
            .messaging_system
            .coordination_leases
            .acquire_lease(lease)
            .await?;

        Ok(BridgedCoordinationResult {
            message_id: message.message_id,
            coordination_id: resource_selector.to_string(),
            lease_id: Some(acquired.lease_id),
            renew_token: acquired.renew_token,
            status: "ok".to_string(),
        })
    }

    pub async fn get_coordinated_messages(
        &self,
        agent_identity: &str,
        resource_selector: Option<&str>,
    ) -> Result<Vec<CoordinatedMessage>, FabricError> {
        let messages = self
            .messaging_system
            .agent_mail
            .get_inbox(agent_identity.to_string())
            .await?;

        let lease = if let Some(selector) = resource_selector {
            self.messaging_system
                .coordination_leases
                .check_lease(selector.to_string())
                .await?
        } else {
            None
        };

        let results = messages
            .into_iter()
            .map(|message| CoordinatedMessage {
                message,
                lease: lease.clone(),
            })
            .collect();

        Ok(results)
    }

    pub async fn release_coordination_bridge(
        &self,
        coordination_id: &str,
        renew_token: String,
    ) -> Result<bool, FabricError> {
        self.messaging_system
            .coordination_leases
            .release_lease(coordination_id.to_string(), renew_token)
            .await
            .map_err(FabricError::Messaging)
    }

    /// Get all capabilities for a specific tenant with caching
    pub async fn get_tenant_capabilities(
        &self,
        tenant_id: &str,
    ) -> Result<TenantCapabilities, FabricError> {
        let cache_key = format!("tenant_capabilities:{}", tenant_id);

        // Try to get from cache first
        if let Some(cached) = self.get_from_cache(&cache_key).await? {
            match serde_json::from_str::<TenantCapabilities>(&cached) {
                Ok(cached_caps) => {
                    tracing::debug!("Retrieved tenant capabilities from cache: {}", tenant_id);
                    return Ok(cached_caps);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to deserialize cached capabilities for {}: {}",
                        tenant_id,
                        e
                    );
                }
            }
        }

        // Get from primary storage
        let agents = self
            .agent_registry
            .list(tenant_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;
        let skills = self
            .skill_registry
            .list_skills()
            .await
            .map_err(FabricError::Skills)?;
        let tools = self
            .tool_registry
            .list()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;

        let capabilities = TenantCapabilities {
            agents,
            skills,
            tools,
        };

        // Cache the result
        if let Ok(json) = serde_json::to_string(&capabilities) {
            let _ = self.set_in_cache(&cache_key, &json).await; // Ignore cache errors
        }

        Ok(capabilities)
    }

    /// Get all enabled capabilities for a specific tenant with caching
    pub async fn get_enabled_tenant_capabilities(
        &self,
        tenant_id: &str,
    ) -> Result<TenantCapabilities, FabricError> {
        let cache_key = format!("enabled_tenant_capabilities:{}", tenant_id);

        // Try to get from cache first
        if let Some(cached) = self.get_from_cache(&cache_key).await? {
            match serde_json::from_str::<TenantCapabilities>(&cached) {
                Ok(cached_caps) => {
                    tracing::debug!(
                        "Retrieved enabled tenant capabilities from cache: {}",
                        tenant_id
                    );
                    return Ok(cached_caps);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to deserialize cached enabled capabilities for {}: {}",
                        tenant_id,
                        e
                    );
                }
            }
        }

        // Get from primary storage
        let agents = self
            .agent_registry
            .list(tenant_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;
        let skills = self
            .skill_registry
            .get_enabled_skills()
            .await
            .map_err(FabricError::Skills)?;
        let tools = self
            .tool_registry
            .list()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?;

        let capabilities = TenantCapabilities {
            agents,
            skills,
            tools,
        };

        // Cache the result
        if let Ok(json) = serde_json::to_string(&capabilities) {
            let _ = self.set_in_cache(&cache_key, &json).await; // Ignore cache errors
        }

        Ok(capabilities)
    }

    /// Get capability summary for a tenant (lightweight version) with caching
    pub async fn get_tenant_capability_summary(
        &self,
        tenant_id: &str,
    ) -> Result<CapabilitySummary, FabricError> {
        let cache_key = format!("tenant_summary:{}", tenant_id);

        // Try to get from cache first
        if let Some(cached) = self.get_from_cache(&cache_key).await? {
            match serde_json::from_str::<CapabilitySummary>(&cached) {
                Ok(summary) => {
                    tracing::debug!("Retrieved tenant summary from cache: {}", tenant_id);
                    return Ok(summary);
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to deserialize cached summary for {}: {}",
                        tenant_id,
                        e
                    );
                }
            }
        }

        let agent_count = self
            .agent_registry
            .list(tenant_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
            .len();
        let skill_count = self
            .skill_registry
            .list_skills()
            .await
            .map_err(FabricError::Skills)?
            .len();
        let tool_count = self
            .tool_registry
            .list()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
            .len();

        let summary = CapabilitySummary {
            tenant_id: tenant_id.to_string(),
            agent_count,
            skill_count,
            tool_count,
            last_updated: chrono::Utc::now().timestamp(),
        };

        // Cache the result
        if let Ok(json) = serde_json::to_string(&summary) {
            let _ = self.set_in_cache(&cache_key, &json).await; // Ignore cache errors
        }

        Ok(summary)
    }

    /// Search capabilities by name or description with semantic search
    pub async fn search_capabilities(
        &self,
        query: &str,
        tenant_id: &str,
    ) -> Result<SearchResults, FabricError> {
        // Generate embedding for the query
        let query_embedding = self.generate_embedding(query);

        // Perform semantic search in vector database
        let mut vector_results = Vec::new();
        if let Ok(results) = self.search_embeddings(&query_embedding, 10).await {
            for (id, similarity) in results {
                // Retrieve the actual capability based on the ID
                if let Some(agent) = self.get_agent(&id).await? {
                    vector_results.push(CapabilityMatch::Agent((agent, similarity)));
                } else if let Ok(Some(skill)) = self.get_skill(id.clone()).await {
                    vector_results.push(CapabilityMatch::Skill((skill, similarity)));
                } else if let Some(tool) = self.get_tool(&id).await? {
                    vector_results.push(CapabilityMatch::Tool((tool, similarity)));
                }
            }
        }

        // Perform traditional text search
        let mut text_results = Vec::new();

        // Search agents
        for agent in self
            .agent_registry
            .list(tenant_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
        {
            if agent.name.to_lowercase().contains(&query.to_lowercase())
                || agent
                    .description
                    .to_lowercase()
                    .contains(&query.to_lowercase())
            {
                text_results.push(CapabilityMatch::Agent((agent, 0.5))); // Default similarity for text matches
            }
        }

        // Search skills
        for skill in self
            .skill_registry
            .list_skills()
            .await
            .map_err(FabricError::Skills)?
        {
            if skill
                .manifest
                .name
                .to_lowercase()
                .contains(&query.to_lowercase())
                || skill
                    .manifest
                    .description
                    .to_lowercase()
                    .contains(&query.to_lowercase())
            {
                text_results.push(CapabilityMatch::Skill((skill, 0.5))); // Default similarity for text matches
            }
        }

        // Search tools
        for tool in self
            .tool_registry
            .list()
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
        {
            if tool.name.to_lowercase().contains(&query.to_lowercase())
                || tool
                    .description
                    .to_lowercase()
                    .contains(&query.to_lowercase())
            {
                text_results.push(CapabilityMatch::Tool((tool, 0.5))); // Default similarity for text matches
            }
        }

        // Combine and deduplicate results
        let mut combined_results = vector_results;
        for text_result in text_results {
            if !combined_results
                .iter()
                .any(|vr: &CapabilityMatch| match vr {
                    CapabilityMatch::Agent((a, _)) => match &text_result {
                        CapabilityMatch::Agent((ta, _)) => a.id == ta.id,
                        _ => false,
                    },
                    CapabilityMatch::Skill((s, _)) => match &text_result {
                        CapabilityMatch::Skill((ts, _)) => s.manifest.id == ts.manifest.id,
                        _ => false,
                    },
                    CapabilityMatch::Tool((t, _)) => match &text_result {
                        CapabilityMatch::Tool((tt, _)) => t.id == tt.id,
                        _ => false,
                    },
                })
            {
                combined_results.push(text_result);
            }
        }

        // Sort by similarity score (highest first)
        combined_results.sort_by(|a, b| {
            let score_a = a.similarity();
            let score_b = b.similarity();
            score_b
                .partial_cmp(&score_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Separate into categories
        let mut agents = Vec::new();
        let mut skills = Vec::new();
        let mut tools = Vec::new();

        for result in combined_results {
            match result {
                CapabilityMatch::Agent((agent, _)) => agents.push(agent),
                CapabilityMatch::Skill((skill, _)) => skills.push(skill),
                CapabilityMatch::Tool((tool, _)) => tools.push(tool),
            }
        }

        Ok(SearchResults {
            agents,
            skills,
            tools,
        })
    }

    /// Validate that a capability exists and is accessible to the tenant
    pub async fn validate_capability_access(
        &self,
        capability_id: &str,
        tenant_id: &str,
    ) -> Result<bool, FabricError> {
        // Check if it's an agent
        if self
            .agent_registry
            .get(capability_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
            .is_some()
        {
            // For agents, check if they belong to the tenant
            if let Some(agent) = self
                .agent_registry
                .get(capability_id)
                .await
                .map_err(|e| FabricError::Registry(e.to_string()))?
            {
                return Ok(agent.tenant_id == tenant_id);
            }
        }

        // Check if it's a skill
        if self
            .skill_registry
            .get_skill(capability_id.to_string(), None)
            .await
            .map_err(FabricError::Skills)?
            .is_some()
        {
            return Ok(true); // Skills are generally available to all tenants
        }

        // Check if it's a tool
        if self
            .tool_registry
            .get(capability_id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))?
            .is_some()
        {
            return Ok(true); // Tools are generally available to all tenants
        }

        Ok(false)
    }

    /// Register an agent with the fabric
    pub async fn register_agent(
        &self,
        agent: agents::AgentDefinition,
    ) -> Result<String, FabricError> {
        self.agent_registry
            .register(agent)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))
    }

    /// Register a skill with the fabric
    pub async fn register_skill(
        &self,
        skill: allternit_skills::Skill,
    ) -> Result<String, FabricError> {
        self.skill_registry
            .register_skill(skill)
            .await
            .map_err(FabricError::Skills)
    }

    /// Register a tool with the fabric
    pub async fn register_tool(&self, tool: ToolDefinition) -> Result<String, FabricError> {
        self.tool_registry
            .register(tool)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))
    }

    /// Get an agent by ID
    pub async fn get_agent(
        &self,
        id: &str,
    ) -> Result<Option<agents::AgentDefinition>, FabricError> {
        self.agent_registry
            .get(id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))
    }

    /// Get a skill by ID
    pub async fn get_skill(
        &self,
        id: String,
    ) -> Result<Option<allternit_skills::Skill>, FabricError> {
        self.skill_registry
            .get_skill(id, None)
            .await
            .map_err(FabricError::Skills)
    }

    /// Get a tool by ID
    pub async fn get_tool(&self, id: &str) -> Result<Option<ToolDefinition>, FabricError> {
        self.tool_registry
            .get(id)
            .await
            .map_err(|e| FabricError::Registry(e.to_string()))
    }
}

/// Represents all capabilities available to a tenant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantCapabilities {
    pub agents: Vec<agents::AgentDefinition>,
    pub skills: Vec<allternit_skills::Skill>,
    pub tools: Vec<ToolDefinition>,
}

/// Summary of capabilities for a tenant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilitySummary {
    pub tenant_id: String,
    pub agent_count: usize,
    pub skill_count: usize,
    pub tool_count: usize,
    pub last_updated: i64,
}

/// Search results for capabilities
#[derive(Debug, Clone)]
pub struct SearchResults {
    pub agents: Vec<agents::AgentDefinition>,
    pub skills: Vec<allternit_skills::Skill>,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricSearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinatedMessage {
    pub message: MailMessageEnvelope,
    pub lease: Option<LeaseEnvelope>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgedCoordinationResult {
    pub message_id: String,
    pub coordination_id: String,
    pub lease_id: Option<String>,
    pub renew_token: Option<String>,
    pub status: String,
}

/// A match from capability search with similarity score
#[derive(Debug, Clone)]
enum CapabilityMatch {
    Agent((agents::AgentDefinition, f32)),
    Skill((allternit_skills::Skill, f32)),
    Tool((allternit_tools_gateway::ToolDefinition, f32)),
}

impl CapabilityMatch {
    fn similarity(&self) -> f32 {
        match self {
            CapabilityMatch::Agent((_, sim)) => *sim,
            CapabilityMatch::Skill((_, sim)) => *sim,
            CapabilityMatch::Tool((_, sim)) => *sim,
        }
    }
}
