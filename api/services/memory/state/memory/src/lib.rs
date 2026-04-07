use allternit_context_router::{ContextBundle, ContextRouter};
use allternit_history::{HistoryError, HistoryLedger};
use allternit_messaging::{EventEnvelope, MessagingSystem};
use allternit_policy::{PolicyEffect, PolicyEngine, PolicyRequest};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub mod storage;

pub mod v2 {
    pub mod conflict;
    pub mod context_tree;
    pub mod decay;
    pub mod graph;
    pub mod memory_policy;
    pub mod truth_engine;
    pub mod types;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String, // Integration field
    pub memory_id: String,
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub memory_type: MemoryType,
    pub content: serde_json::Value,
    pub metadata: serde_json::Value, // Integration field
    pub embedding: Option<Vec<f32>>, // Integration field
    pub created_at: u64,
    pub last_accessed: u64,
    pub access_count: u32,
    pub sensitivity_tier: u8,
    pub tags: Vec<String>,
    pub provenance: MemoryProvenance,
    pub retention_policy: MemoryRetentionPolicy,
    pub consolidation_state: ConsolidationState,
    pub status: String,
    pub valid_from: Option<u64>,
    pub valid_to: Option<u64>,
    pub confidence: f64,
    pub authority: String,
    pub supersedes_memory_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemoryType {
    Working,
    Episodic,
    Semantic,
    Procedural,
    Declarative,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryProvenance {
    pub source_session: Option<String>,
    pub source_agent: String,
    pub derivation_chain: Vec<String>,
    pub integrity_hash: String,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRetentionPolicy {
    pub time_to_live: Option<u64>,
    pub max_accesses: Option<u32>,
    pub decay_function: MemoryDecayFunction,
    pub consolidation_trigger: ConsolidationTrigger,
    pub deletion_policy: DeletionPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MemoryDecayFunction {
    Linear { rate: f64 },
    Exponential { half_life: u64 },
    Step { intervals: Vec<(u64, f64)> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsolidationTrigger {
    AccessCount(u32),
    TimeElapsed(u64),
    SizeThreshold(u64),
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeletionPolicy {
    Immediate,
    Delayed(u64),
    Archival,
    Retention(u64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsolidationState {
    Raw,
    Candidate,
    Consolidating,
    Consolidated,
    Decayed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryQuery {
    pub query: String,                     // Integration field
    pub top_k: usize,                      // Integration field
    pub filter: Option<serde_json::Value>, // Integration field
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub memory_types: Vec<MemoryType>,
    pub max_sensitivity_tier: Option<u8>,
    pub required_tags: Vec<String>,
    pub time_range: Option<(u64, u64)>,
    pub content_search: Option<String>,
    pub limit: Option<usize>,
    pub sort_by: Option<SortCriteria>,
    pub status_filter: Option<String>, // For v2: active, superseded, archived
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortCriteria {
    CreatedAt,
    LastAccessed,
    AccessCount,
    SensitivityTier,
    Relevance,
}

#[derive(Debug, thiserror::Error)]
pub enum MemoryError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] HistoryError),
    #[error("Policy error: {0}")]
    Policy(#[from] allternit_policy::PolicyError),
    #[error("Memory not found: {0}")]
    NotFound(String),
    #[error("Access denied: {0}")]
    AccessDenied(String),
    #[error("Invalid memory operation: {0}")]
    InvalidOperation(String),
    #[error("Consolidation failed: {0}")]
    ConsolidationFailed(String),
}

pub struct MemoryFabric {
    storage: Arc<dyn storage::MemoryStorage>,
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    policy_engine: Arc<PolicyEngine>,
    #[allow(dead_code)]
    context_router: Arc<ContextRouter>,
    consolidation_pipeline: Arc<ConsolidationPipeline>,
    #[allow(dead_code)]
    decay_scheduler: Arc<DecayScheduler>,
    memory_policy: Arc<dyn v2::memory_policy::MemoryPolicy>,
}

impl MemoryFabric {
    pub async fn new_with_storage(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        policy_engine: Arc<PolicyEngine>,
        context_router: Arc<ContextRouter>,
        pool: SqlitePool,
        memory_policy: Arc<dyn v2::memory_policy::MemoryPolicy>,
    ) -> Result<Self, MemoryError> {
        let storage = Arc::new(storage::SqliteMemoryStorage::new(pool).await?);
        let consolidation_pipeline = Arc::new(ConsolidationPipeline::new(
            history_ledger.clone(),
            messaging_system.clone(),
            policy_engine.clone(),
        ));
        let decay_scheduler = Arc::new(DecayScheduler::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        Ok(MemoryFabric {
            storage,
            history_ledger,
            messaging_system,
            policy_engine,
            context_router,
            consolidation_pipeline,
            decay_scheduler,
            memory_policy,
        })
    }

    pub async fn store_memory(
        &self,
        mut memory: MemoryEntry,
        requesting_agent_id: String,
    ) -> Result<String, MemoryError> {
        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Validate access through policy
        let policy_request = PolicyRequest {
            identity_id: requesting_agent_id.clone(),
            resource: format!("memory:{}", memory.tenant_id),
            action: "write".to_string(),
            context: serde_json::json!({
                "memory_type": format!("{:?}", memory.memory_type),
                "sensitivity_tier": memory.sensitivity_tier,
                "requesting_agent": requesting_agent_id,
            }),
            requested_tier: match memory.sensitivity_tier {
                0..=1 => allternit_policy::SafetyTier::T0,
                2 => allternit_policy::SafetyTier::T1,
                3 => allternit_policy::SafetyTier::T2,
                4 => allternit_policy::SafetyTier::T3,
                _ => allternit_policy::SafetyTier::T4,
            },
        };

        let policy_decision = self.policy_engine.evaluate(policy_request).await?;
        if matches!(policy_decision.decision, PolicyEffect::Deny) {
            return Err(MemoryError::AccessDenied(format!(
                "Policy denied memory storage: {}",
                policy_decision.reason
            )));
        }

        // Update access statistics
        memory.last_accessed = start_time;
        memory.access_count = 1;

        // Store in durable storage
        self.storage.store_memory(&memory).await?;

        let memory_id = memory.memory_id.clone();

        // Log event
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "MemoryStored".to_string(),
            session_id: memory
                .session_id
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            tenant_id: memory.tenant_id.clone(),
            actor_id: requesting_agent_id.clone(),
            role: "memory_fabric".to_string(),
            timestamp: start_time,
            trace_id: memory
                .tags
                .iter()
                .find(|tag| tag.starts_with("trace:"))
                .map(|tag| tag.strip_prefix("trace:").unwrap_or("").to_string()),
            payload: serde_json::json!({
                "memory_id": memory_id,
                "memory_type": format!("{:?}", memory.memory_type),
                "sensitivity_tier": memory.sensitivity_tier,
                "size_bytes": serde_json::to_string(&memory.content).unwrap_or_default().len(),
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

        Ok(memory_id)
    }

    pub async fn retrieve_memory(
        &self,
        memory_id: String,
        requesting_agent_id: String,
    ) -> Result<MemoryEntry, MemoryError> {
        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Retrieve from durable storage
        let mut memory = self
            .storage
            .retrieve_memory(&memory_id)
            .await?
            .ok_or_else(|| MemoryError::NotFound(memory_id.clone()))?;

        // Validate access through policy
        let policy_request = PolicyRequest {
            identity_id: requesting_agent_id.clone(),
            resource: format!("memory:{}", memory.tenant_id),
            action: "read".to_string(),
            context: serde_json::json!({
                "memory_id": memory_id,
                "memory_type": format!("{:?}", memory.memory_type),
                "sensitivity_tier": memory.sensitivity_tier,
                "requesting_agent": requesting_agent_id,
            }),
            requested_tier: match memory.sensitivity_tier {
                0..=1 => allternit_policy::SafetyTier::T0,
                2 => allternit_policy::SafetyTier::T1,
                3 => allternit_policy::SafetyTier::T2,
                4 => allternit_policy::SafetyTier::T3,
                _ => allternit_policy::SafetyTier::T4,
            },
        };

        let policy_decision = self.policy_engine.evaluate(policy_request).await?;
        if matches!(policy_decision.decision, PolicyEffect::Deny) {
            return Err(MemoryError::AccessDenied(format!(
                "Policy denied memory retrieval: {}",
                policy_decision.reason
            )));
        }

        // Update access statistics
        memory.last_accessed = start_time;
        memory.access_count += 1;

        // Update in storage
        self.storage.update_memory(&memory).await?;

        Ok(memory)
    }

    pub async fn query_memory(
        &self,
        query: MemoryQuery,
        requesting_agent_id: String,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        let _start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Validate query access through policy
        let policy_request = PolicyRequest {
            identity_id: requesting_agent_id.clone(),
            resource: format!("memory_query:{}", query.tenant_id),
            action: "query".to_string(),
            context: serde_json::json!({
                "query": &query,
                "requesting_agent": requesting_agent_id,
            }),
            requested_tier: allternit_policy::SafetyTier::T0,
        };

        let policy_decision = self.policy_engine.evaluate(policy_request).await?;
        if matches!(policy_decision.decision, PolicyEffect::Deny) {
            return Err(MemoryError::AccessDenied(format!(
                "Policy denied memory query: {}",
                policy_decision.reason
            )));
        }

        // Convert query
        let storage_query = storage::MemoryQuery {
            tenant_id: query.tenant_id.clone(),
            session_id: query.session_id.clone(),
            agent_id: query.agent_id.clone(),
            memory_types: query.memory_types.clone(),
            max_sensitivity_tier: query.max_sensitivity_tier,
            required_tags: query.required_tags.clone(),
            time_range: query.time_range,
            content_search: query.content_search.clone(),
            limit: query.limit,
            status_filter: query.status_filter.clone(),
        };

        // Query
        self.storage.query_memory(&storage_query).await
    }

    pub async fn store_rlm_processing_result(
        &self,
        result_data: &serde_json::Value,
        session_id: &str,
        requesting_agent_id: String,
        tags: Vec<String>,
    ) -> Result<String, MemoryError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let memory_entry = MemoryEntry {
            id: Uuid::new_v4().to_string(),
            memory_id: Uuid::new_v4().to_string(),
            tenant_id: "rlm-processing".to_string(),
            session_id: Some(session_id.to_string()),
            agent_id: Some(requesting_agent_id.clone()),
            memory_type: MemoryType::Semantic,
            content: serde_json::json!({
                "result_data": result_data,
                "processed_at": now,
                "session_id": session_id,
                "source_agent": requesting_agent_id,
            }),
            metadata: serde_json::json!({}),
            embedding: None,
            created_at: now,
            last_accessed: 0,
            access_count: 0,
            sensitivity_tier: 0,
            tags: {
                let mut all_tags = tags;
                all_tags.push("rlm".to_string());
                all_tags.push("processing_result".to_string());
                all_tags
            },
            provenance: MemoryProvenance {
                source_session: Some(session_id.to_string()),
                source_agent: requesting_agent_id.clone(),
                derivation_chain: vec![],
                integrity_hash: format!(
                    "{:x}",
                    Sha256::digest(serde_json::to_string(result_data).unwrap().as_bytes())
                ),
                signature: None,
            },
            retention_policy: MemoryRetentionPolicy {
                time_to_live: Some(86400 * 7),
                max_accesses: Some(50),
                decay_function: MemoryDecayFunction::Exponential {
                    half_life: 86400 * 2,
                },
                consolidation_trigger: ConsolidationTrigger::AccessCount(25),
                deletion_policy: DeletionPolicy::Retention(86400 * 14),
            },
            consolidation_state: ConsolidationState::Raw,
            status: "active".to_string(),
            valid_from: Some(now),
            valid_to: None,
            confidence: 0.75,
            authority: "agent".to_string(),
            supersedes_memory_id: None,
        };

        self.store_memory(memory_entry, requesting_agent_id).await
    }

    pub async fn slice_context_for_rlm(
        &self,
        context: &str,
        max_chunk_size: usize,
        session_id: Option<&str>,
        requesting_agent_id: String,
    ) -> Result<Vec<String>, MemoryError> {
        if context.is_empty() {
            return Ok(Vec::new());
        }

        let chunks: Vec<String> = context
            .chars()
            .collect::<Vec<char>>()
            .chunks(max_chunk_size)
            .map(|c| c.iter().collect())
            .collect();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        for (index, chunk) in chunks.iter().enumerate() {
            let memory_entry = MemoryEntry {
                id: Uuid::new_v4().to_string(),
                memory_id: Uuid::new_v4().to_string(),
                tenant_id: "rlm-context".to_string(),
                session_id: session_id.map(|value| value.to_string()),
                agent_id: Some(requesting_agent_id.clone()),
                memory_type: MemoryType::Working,
                content: serde_json::json!({
                    "chunk": chunk,
                    "chunk_index": index,
                    "total_chunks": chunks.len(),
                }),
                metadata: serde_json::json!({}),
                embedding: None,
                created_at: now,
                last_accessed: 0,
                access_count: 0,
                sensitivity_tier: 0,
                tags: vec!["rlm".to_string(), "context_slice".to_string()],
                provenance: MemoryProvenance {
                    source_session: session_id.map(|value| value.to_string()),
                    source_agent: requesting_agent_id.clone(),
                    derivation_chain: vec![],
                    integrity_hash: format!("{:x}", Sha256::digest(chunk.as_bytes())),
                    signature: None,
                },
                retention_policy: MemoryRetentionPolicy {
                    time_to_live: Some(3600),
                    max_accesses: Some(10),
                    decay_function: MemoryDecayFunction::Linear { rate: 0.1 },
                    consolidation_trigger: ConsolidationTrigger::AccessCount(5),
                    deletion_policy: DeletionPolicy::Retention(7200),
                },
                consolidation_state: ConsolidationState::Raw,
                status: "active".to_string(),
                valid_from: Some(now),
                valid_to: None,
                confidence: 0.75,
                authority: "agent".to_string(),
                supersedes_memory_id: None,
            };

            self.store_memory(memory_entry, requesting_agent_id.clone())
                .await?;
        }

        Ok(chunks)
    }

    pub async fn aggregate_rlm_results(
        &self,
        results: &[String],
        session_id: Option<&str>,
        requesting_agent_id: String,
    ) -> Result<String, MemoryError> {
        let aggregated = results.join("\n\n");
        Ok(aggregated)
    }
}

// High-level integration types expected by main.rs

#[derive(Clone)]
pub struct MemoryService {
    backend: MemoryBackend,
}

impl MemoryService {
    pub fn new(backend: MemoryBackend) -> Self {
        Self { backend }
    }

    pub async fn store_memory(&self, entry: MemoryEntry) -> Result<(), MemoryError> {
        match &self.backend {
            MemoryBackend::Redis(store) => store.store_memory(&entry).await,
            MemoryBackend::Qdrant(store) => store.store_memory(&entry).await,
            MemoryBackend::Fabric(fabric) => {
                fabric.store_memory(entry, "system".to_string()).await?;
                Ok(())
            }
        }
    }

    pub async fn retrieve_memories(
        &self,
        query: MemoryQuery,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        match &self.backend {
            MemoryBackend::Redis(store) => store.query_memory(&query).await,
            MemoryBackend::Qdrant(store) => store.query_memory(&query).await,
            MemoryBackend::Fabric(fabric) => fabric.query_memory(query, "system".to_string()).await,
        }
    }

    pub async fn delete_memory(&self, id: &str) -> Result<(), MemoryError> {
        match &self.backend {
            MemoryBackend::Redis(store) => store.delete_memory(id).await,
            MemoryBackend::Qdrant(store) => store.delete_memory(id).await,
            MemoryBackend::Fabric(fabric) => fabric.storage.delete_memory(id).await,
        }
    }
}

#[derive(Clone)]
pub enum MemoryBackend {
    Redis(RedisMemoryStore),
    Qdrant(QdrantMemoryStore),
    Fabric(Arc<MemoryFabric>),
}

#[derive(Clone)]
pub struct RedisMemoryStore {
    client: redis::Client,
    collection: String,
}

impl RedisMemoryStore {
    pub fn new(url: &str, collection: String) -> Result<Self, MemoryError> {
        let client =
            redis::Client::open(url).map_err(|e| MemoryError::Io(std::io::Error::other(e)))?;
        Ok(Self { client, collection })
    }

    pub async fn store_memory(&self, _entry: &MemoryEntry) -> Result<(), MemoryError> {
        // Implementation for Redis storage
        Ok(())
    }

    pub async fn query_memory(
        &self,
        _query: &MemoryQuery,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        // Implementation for Redis query
        Ok(vec![])
    }

    pub async fn delete_memory(&self, _id: &str) -> Result<(), MemoryError> {
        // Implementation for Redis delete
        Ok(())
    }
}

#[derive(Clone)]
pub struct QdrantMemoryStore {
    client: Arc<qdrant_client::Qdrant>,
    collection: String,
}

impl QdrantMemoryStore {
    pub fn new(url: &str, collection: String) -> Result<Self, MemoryError> {
        let client = qdrant_client::Qdrant::from_url(url)
            .build()
            .map_err(|e| MemoryError::Io(std::io::Error::other(e)))?;
        Ok(Self {
            client: Arc::new(client),
            collection,
        })
    }

    pub async fn store_memory(&self, _entry: &MemoryEntry) -> Result<(), MemoryError> {
        // Implementation for Qdrant vector storage
        Ok(())
    }

    pub async fn query_memory(
        &self,
        _query: &MemoryQuery,
    ) -> Result<Vec<MemoryEntry>, MemoryError> {
        // Implementation for Qdrant vector search
        Ok(vec![])
    }

    pub async fn delete_memory(&self, _id: &str) -> Result<(), MemoryError> {
        // Implementation for Qdrant delete
        Ok(())
    }
}

pub struct ConsolidationPipeline {
    #[allow(dead_code)]
    history_ledger: Arc<Mutex<HistoryLedger>>,
    #[allow(dead_code)]
    messaging_system: Arc<MessagingSystem>,
    #[allow(dead_code)]
    policy_engine: Arc<PolicyEngine>,
}

impl ConsolidationPipeline {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        policy_engine: Arc<PolicyEngine>,
    ) -> Self {
        ConsolidationPipeline {
            history_ledger,
            messaging_system,
            policy_engine,
        }
    }

    pub async fn process_consolidation(
        &self,
        _request: MemoryConsolidationRequest,
    ) -> Result<ConsolidationResult, MemoryError> {
        Ok(ConsolidationResult {
            consolidated_memory_id: "mock".to_string(),
            original_memory_ids: vec![],
            consolidation_type: ConsolidationType::Summarization,
            target_tier: MemoryTier::Episodic,
            processing_time_ms: 0,
        })
    }
}

pub struct DecayScheduler {
    #[allow(dead_code)]
    history_ledger: Arc<Mutex<HistoryLedger>>,
    #[allow(dead_code)]
    messaging_system: Arc<MessagingSystem>,
}

impl DecayScheduler {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
    ) -> Self {
        DecayScheduler {
            history_ledger,
            messaging_system,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConsolidationRequest {
    pub memory_ids: Vec<String>,
    pub consolidation_type: ConsolidationType,
    pub target_tier: MemoryTier,
    pub context_bundle: Option<ContextBundle>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConsolidationType {
    Summarization,
    Abstraction,
    Generalization,
    Integration,
    Compression,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemoryTier {
    Working,
    Episodic,
    LongTerm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsolidationResult {
    pub consolidated_memory_id: String,
    pub original_memory_ids: Vec<String>,
    pub consolidation_type: ConsolidationType,
    pub target_tier: MemoryTier,
    pub processing_time_ms: u64,
}
