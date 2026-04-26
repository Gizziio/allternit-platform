use allternit_history::{HistoryError, HistoryLedger};
use allternit_messaging::{EventEnvelope, MessagingSystem};
use allternit_policy::{PolicyEffect, PolicyEngine, PolicyRequest};
use allternit_runtime_core::SessionManager;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSelector {
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub skill_id: Option<String>,
    pub phase: Option<String>,          // OBSERVE, THINK, PLAN, etc.
    pub time_range: Option<(u64, u64)>, // start_time, end_time
    pub tags: Vec<String>,
    pub sensitivity_tier: Option<u8>, // 0-4 corresponding to T0-T4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextBundle {
    pub bundle_id: String,
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub context_entries: Vec<ContextEntry>,
    pub provenance: ContextProvenance,
    pub access_control: ContextAccessControl,
    pub size_bytes: usize,
    pub last_accessed: u64,
    pub access_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub entry_id: String,
    pub entry_type: ContextEntryType,
    pub content: serde_json::Value,
    pub source_ref: String, // Reference to where this came from (ledger entry, artifact, etc.)
    pub created_at: u64,
    pub sensitivity_tier: u8, // 0-4 corresponding to T0-T4
    pub tags: Vec<String>,
    pub retention_policy: RetentionPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContextEntryType {
    Observation,
    Analysis,
    Plan,
    Artifact,
    SkillOutput,
    ToolOutput,
    Memory,
    Conversation,
    Task,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub time_to_live: Option<u64>, // seconds
    pub max_accesses: Option<u32>,
    pub decay_function: DecayFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DecayFunction {
    Linear { rate: f64 },                // Linear decay over time
    Exponential { half_life: u64 },      // Exponential decay
    Step { intervals: Vec<(u64, f64)> }, // Step decay at specific intervals
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextProvenance {
    pub origin_session: Option<String>,
    pub origin_agent: String,
    pub derivation_chain: Vec<String>, // Chain of transformations
    pub integrity_hash: String,        // Hash of content for integrity verification
    pub signature: Option<String>,     // Optional cryptographic signature
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextAccessControl {
    pub allowed_agents: HashSet<String>,
    pub allowed_skills: HashSet<String>,
    pub allowed_phases: HashSet<String>,
    pub time_window: Option<(u64, u64)>, // When this context is accessible
    pub access_policy: ContextAccessPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextAccessPolicy {
    ExplicitAllowList,
    RoleBased { required_roles: Vec<String> },
    SensitivityTier { max_tier: u8 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRouteRequest {
    pub selector: ContextSelector,
    pub requesting_agent_id: String,
    pub requesting_session_id: String,
    pub requesting_skill_id: Option<String>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRouteResponse {
    pub bundle: ContextBundle,
    pub route_metrics: ContextRouteMetrics,
    pub policy_decision: PolicyEffect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRouteMetrics {
    pub entries_fetched: usize,
    pub total_size_bytes: usize,
    pub sensitivity_distribution: HashMap<u8, usize>, // Count per sensitivity tier
    pub access_cost_estimate: f64,                    // Estimated computational cost
    pub privacy_risk_score: f64,                      // Privacy risk assessment
}

#[derive(Debug, thiserror::Error)]
pub enum ContextRouterError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("History error: {0}")]
    History(#[from] HistoryError),
    #[error("Policy error: {0}")]
    Policy(#[from] allternit_policy::PolicyError),
    #[error("Invalid context selector: {0}")]
    InvalidSelector(String),
    #[error("Context bundle not found: {0}")]
    BundleNotFound(String),
    #[error("Access denied: {0}")]
    AccessDenied(String),
    #[error("Privacy violation: {0}")]
    PrivacyViolation(String),
}

pub struct ContextRouter {
    context_stores: Arc<RwLock<HashMap<String, ContextStore>>>, // tenant_id -> store
    history_ledger: Arc<Mutex<HistoryLedger>>,
    messaging_system: Arc<MessagingSystem>,
    policy_engine: Arc<PolicyEngine>,
    session_manager: Arc<SessionManager>,
    cache: Arc<Mutex<lru::LruCache<String, ContextBundle>>>,
    cache_ttl: Duration,
    max_bundle_size_bytes: usize,
    max_cache_size: usize,
}

impl ContextRouter {
    pub fn new(
        history_ledger: Arc<Mutex<HistoryLedger>>,
        messaging_system: Arc<MessagingSystem>,
        policy_engine: Arc<PolicyEngine>,
        session_manager: Arc<SessionManager>,
    ) -> Self {
        ContextRouter {
            context_stores: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
            messaging_system,
            policy_engine,
            session_manager,
            cache: Arc::new(Mutex::new(lru::LruCache::new(1000.try_into().unwrap()))),
            cache_ttl: Duration::from_secs(300), // 5 minutes default TTL
            max_bundle_size_bytes: 10 * 1024 * 1024, // 10MB default max bundle size
            max_cache_size: 1000,                // 1000 bundles max
        }
    }

    pub fn with_cache_config(
        mut self,
        ttl: Duration,
        max_size: usize,
        max_bundle_size: usize,
    ) -> Self {
        self.cache_ttl = ttl;
        self.max_cache_size = max_size;
        self.max_bundle_size_bytes = max_bundle_size;
        self
    }

    pub async fn route_context(
        &self,
        request: ContextRouteRequest,
    ) -> Result<ContextRouteResponse, ContextRouterError> {
        let start_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Validate the request against policy
        let policy_req = PolicyRequest {
            identity_id: request.requesting_agent_id.clone(),
            resource: format!("context_route:{}", request.selector.tenant_id),
            action: "read".to_string(),
            context: serde_json::json!({
                "selector": &request.selector,
                "requesting_agent": &request.requesting_agent_id,
                "requesting_session": &request.requesting_session_id,
            }),
            requested_tier: allternit_policy::SafetyTier::T0, // Default to lowest tier for context access
        };

        let policy_decision = self.policy_engine.evaluate(policy_req).await?;

        if matches!(policy_decision.decision, PolicyEffect::Deny) {
            return Err(ContextRouterError::AccessDenied(format!(
                "Policy denied context access: {}",
                policy_decision.reason
            )));
        }

        // Fetch context based on selector
        let context_bundle = self.fetch_context_for_selector(&request.selector).await?;

        // Apply privacy and sensitivity filters based on agent permissions
        let filtered_bundle = self
            .apply_privacy_filters(
                context_bundle,
                &request.requesting_agent_id,
                &request.requesting_skill_id,
            )
            .await?;

        // Calculate metrics
        let metrics = self.calculate_route_metrics(&filtered_bundle).await;

        // Log the context routing event
        let route_event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "ContextRoute".to_string(),
            session_id: request.requesting_session_id.clone(),
            tenant_id: request.selector.tenant_id.clone(),
            actor_id: request.requesting_agent_id.clone(),
            role: "context_router".to_string(),
            timestamp: start_time,
            trace_id: request.trace_id.clone(),
            payload: serde_json::json!({
                "selector": request.selector,
                "bundle_id": filtered_bundle.bundle_id,
                "metrics": metrics,
                "policy_decision": policy_decision
            }),
        };

        // Log to history ledger
        {
            let mut history = self.history_ledger.lock().unwrap();
            let content = serde_json::to_value(&route_event)?;
            history.append(content)?;
        }

        // Emit event asynchronously
        tokio::spawn({
            let event_bus = self.messaging_system.event_bus.clone();
            let event_to_send = route_event.clone();
            async move {
                let _ = event_bus.publish(event_to_send).await;
            }
        });

        Ok(ContextRouteResponse {
            bundle: filtered_bundle,
            route_metrics: metrics,
            policy_decision: policy_decision.decision,
        })
    }

    async fn fetch_context_for_selector(
        &self,
        selector: &ContextSelector,
    ) -> Result<ContextBundle, ContextRouterError> {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Check cache first with TTL validation
        {
            let mut cache = self.cache.lock().unwrap();
            let cache_key = format!("{:?}", selector);
            if let Some(cached_bundle) = cache.get(&cache_key) {
                // Check if bundle has expired
                if let Some(expires_at) = cached_bundle.expires_at {
                    if current_time < expires_at {
                        // Update access stats
                        let mut mutable_bundle = cached_bundle.clone();
                        mutable_bundle.last_accessed = current_time;
                        mutable_bundle.access_count += 1;

                        // Update the cached version with new access stats
                        cache.put(cache_key, mutable_bundle.clone());
                        return Ok(mutable_bundle);
                    } else {
                        // Bundle expired, remove from cache
                        cache.pop(&cache_key);
                    }
                } else {
                    // No expiration set, but check TTL from creation time
                    if current_time - cached_bundle.created_at < self.cache_ttl.as_secs() {
                        // Update access stats
                        let mut mutable_bundle = cached_bundle.clone();
                        mutable_bundle.last_accessed = current_time;
                        mutable_bundle.access_count += 1;

                        // Update the cached version with new access stats
                        cache.put(cache_key, mutable_bundle.clone());
                        return Ok(mutable_bundle);
                    } else {
                        // TTL expired, remove from cache
                        cache.pop(&cache_key);
                    }
                }
            }
        }

        // Get or create context store for tenant
        {
            let mut stores = self.context_stores.write().await;
            if !stores.contains_key(&selector.tenant_id) {
                stores.insert(selector.tenant_id.clone(), ContextStore::new());
            }
        } // Release the write lock

        let stores = self.context_stores.read().await;
        let store = stores.get(&selector.tenant_id).unwrap();

        // Fetch entries based on selector criteria
        let mut entries = Vec::new();

        // This is a simplified implementation - in a real system, this would query
        // the history ledger, artifacts, and other context sources based on the selector
        let all_entries = store.get_all_entries().await;

        for entry in all_entries {
            if self.entry_matches_selector(&entry, selector).await {
                entries.push(entry);
            }
        }

        // Calculate bundle size
        let size_bytes = self.calculate_bundle_size(&entries);

        // Check if bundle exceeds size limits
        if size_bytes > self.max_bundle_size_bytes {
            return Err(ContextRouterError::PrivacyViolation(format!(
                "Context bundle size {} exceeds maximum allowed size {}",
                size_bytes, self.max_bundle_size_bytes
            )));
        }

        // Create bundle
        let bundle = ContextBundle {
            bundle_id: Uuid::new_v4().to_string(),
            tenant_id: selector.tenant_id.clone(),
            session_id: selector.session_id.clone(),
            created_at: current_time,
            expires_at: Some(current_time + self.cache_ttl.as_secs()), // Set expiration based on TTL
            context_entries: entries.clone(), // Clone the entries to avoid move
            provenance: ContextProvenance {
                origin_session: selector.session_id.clone(),
                origin_agent: "system".to_string(), // Would be determined by context
                derivation_chain: vec![],           // Would be populated by actual derivation
                integrity_hash: self.calculate_bundle_hash(&entries),
                signature: None, // Would be added by signing mechanism
            },
            access_control: ContextAccessControl {
                allowed_agents: HashSet::new(), // Would be populated based on selector
                allowed_skills: HashSet::new(),
                allowed_phases: HashSet::new(),
                time_window: None,
                access_policy: ContextAccessPolicy::SensitivityTier { max_tier: 4 }, // Default to allow all tiers
            },
            size_bytes,
            last_accessed: current_time,
            access_count: 1, // First access
        };

        // Cache the bundle
        {
            let mut cache = self.cache.lock().unwrap();
            let cache_key = format!("{:?}", selector);
            cache.put(cache_key, bundle.clone());
        }

        Ok(bundle)
    }

    async fn entry_matches_selector(
        &self,
        entry: &ContextEntry,
        selector: &ContextSelector,
    ) -> bool {
        // Match tenant
        if !entry
            .tags
            .iter()
            .any(|tag| tag.starts_with(&format!("tenant:{}", selector.tenant_id)))
        {
            return false;
        }

        // Match session if specified
        if let Some(ref session_id) = selector.session_id {
            if !entry
                .tags
                .iter()
                .any(|tag| tag.starts_with(&format!("session:{}", session_id)))
            {
                return false;
            }
        }

        // Match agent if specified
        if let Some(ref agent_id) = selector.agent_id {
            if !entry
                .tags
                .iter()
                .any(|tag| tag.starts_with(&format!("agent:{}", agent_id)))
            {
                return false;
            }
        }

        // Match skill if specified
        if let Some(ref skill_id) = selector.skill_id {
            if !entry
                .tags
                .iter()
                .any(|tag| tag.starts_with(&format!("skill:{}", skill_id)))
            {
                return false;
            }
        }

        // Match phase if specified
        if let Some(ref phase) = selector.phase {
            if !entry
                .tags
                .iter()
                .any(|tag| tag.starts_with(&format!("phase:{}", phase)))
            {
                return false;
            }
        }

        // Match time range if specified
        if let Some((start, end)) = selector.time_range {
            if entry.created_at < start || entry.created_at > end {
                return false;
            }
        }

        // Match tags
        for required_tag in &selector.tags {
            if !entry.tags.iter().any(|entry_tag| entry_tag == required_tag) {
                return false;
            }
        }

        // Match sensitivity tier
        if let Some(max_tier) = selector.sensitivity_tier {
            if entry.sensitivity_tier > max_tier {
                return false;
            }
        }

        true
    }

    async fn apply_privacy_filters(
        &self,
        mut bundle: ContextBundle,
        requesting_agent_id: &str,
        requesting_skill_id: &Option<String>,
    ) -> Result<ContextBundle, ContextRouterError> {
        // Apply privacy filters based on agent permissions
        let agent_permissions = self.get_agent_permissions(requesting_agent_id).await?;

        // Filter entries based on sensitivity tier and agent permissions
        bundle.context_entries.retain(|entry| {
            // Check if agent has permission for this sensitivity tier
            let max_allowed_tier = agent_permissions.max_sensitivity_tier.unwrap_or(0);
            if entry.sensitivity_tier > max_allowed_tier {
                return false;
            }

            // Check if agent is explicitly allowed for this entry
            if let Some(ref skill_id) = requesting_skill_id {
                // Check if this entry is tagged for this specific skill
                if entry
                    .tags
                    .iter()
                    .any(|tag| tag.starts_with("skill:") && !tag.contains(skill_id))
                {
                    // If the entry is tagged for a specific skill but it's not the requesting skill, skip
                    // unless the agent has special permission
                    if !agent_permissions.has_special_access {
                        return false;
                    }
                }
            }

            true
        });

        Ok(bundle)
    }

    async fn get_agent_permissions(
        &self,
        agent_id: &str,
    ) -> Result<AgentPermissions, ContextRouterError> {
        // In a real implementation, this would query the policy engine for agent permissions
        // For now, returning a default set of permissions
        Ok(AgentPermissions {
            max_sensitivity_tier: Some(4), // Allow access to all tiers by default
            allowed_tags: HashSet::new(),
            has_special_access: true, // Allow access to skill-specific entries
        })
    }

    async fn calculate_route_metrics(&self, bundle: &ContextBundle) -> ContextRouteMetrics {
        let mut sensitivity_counts = HashMap::new();
        let mut total_size = 0;

        for entry in &bundle.context_entries {
            // Count by sensitivity tier
            *sensitivity_counts
                .entry(entry.sensitivity_tier)
                .or_insert(0) += 1;

            // Estimate size
            if let Ok(json_str) = serde_json::to_string(&entry.content) {
                total_size += json_str.len();
            }
        }

        ContextRouteMetrics {
            entries_fetched: bundle.context_entries.len(),
            total_size_bytes: total_size,
            sensitivity_distribution: sensitivity_counts,
            access_cost_estimate: bundle.context_entries.len() as f64 * 0.1, // Simplified cost estimate
            privacy_risk_score: 0.0, // Would be calculated based on sensitivity and access patterns
        }
    }

    fn calculate_bundle_size(&self, entries: &[ContextEntry]) -> usize {
        // Calculate approximate size of the bundle in bytes
        let mut total_size = 0;

        for entry in entries {
            total_size += std::mem::size_of_val(&entry.entry_id);
            total_size += std::mem::size_of_val(&entry.entry_type);

            // Estimate JSON content size
            if let Ok(json_str) = serde_json::to_string(&entry.content) {
                total_size += json_str.len();
            }

            total_size += std::mem::size_of_val(&entry.source_ref);
            total_size += std::mem::size_of_val(&entry.created_at);
            total_size += std::mem::size_of_val(&entry.sensitivity_tier);

            // Add size of tags vector
            for tag in &entry.tags {
                total_size += tag.len();
            }
        }

        total_size
    }

    fn calculate_bundle_hash(&self, entries: &[ContextEntry]) -> String {
        // Create a deterministic representation for hashing
        // Sort entries by entry_id to ensure consistent ordering
        let mut sorted_entries = entries.to_vec();
        sorted_entries.sort_by(|a, b| a.entry_id.cmp(&b.entry_id));

        let mut hasher = Sha256::new();
        for entry in sorted_entries {
            // Create a deterministic string representation of each entry
            let entry_str = format!(
                "{}{:?}{}{:?}{}",
                entry.entry_id,
                entry.entry_type,
                entry.content,
                entry.sensitivity_tier,
                entry.created_at
            );
            hasher.update(entry_str.as_bytes());
        }
        hex::encode(hasher.finalize())
    }

    pub async fn register_context_entry(
        &self,
        tenant_id: String,
        mut entry: ContextEntry,
    ) -> Result<String, ContextRouterError> {
        // Get or create context store for tenant
        {
            let mut stores = self.context_stores.write().await;
            if !stores.contains_key(&tenant_id) {
                stores.insert(tenant_id.clone(), ContextStore::new());
            }
        } // Release the write lock

        // Add tenant tag if not present
        if !entry.tags.iter().any(|tag| tag.starts_with("tenant:")) {
            entry.tags.push(format!("tenant:{}", tenant_id));
        }

        // Get the store and add the entry
        let stores = self.context_stores.read().await;
        let store = stores.get(&tenant_id).unwrap();
        let entry_id = store.add_entry(entry.clone()).await;

        // Log the context entry creation
        let event = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "ContextEntryCreated".to_string(),
            session_id: entry
                .tags
                .iter()
                .find(|tag| tag.starts_with("session:"))
                .map(|tag| tag.strip_prefix("session:").unwrap_or("").to_string())
                .unwrap_or_default(),
            tenant_id,
            actor_id: entry
                .tags
                .iter()
                .find(|tag| tag.starts_with("agent:"))
                .map(|tag| tag.strip_prefix("agent:").unwrap_or("").to_string())
                .unwrap_or_else(|| "system".to_string()),
            role: "context_router".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            trace_id: entry
                .tags
                .iter()
                .find(|tag| tag.starts_with("trace:"))
                .map(|tag| tag.strip_prefix("trace:").unwrap_or("").to_string()),
            payload: serde_json::json!({
                "entry_id": entry_id,
                "entry_type": entry.entry_type,
                "sensitivity_tier": entry.sensitivity_tier,
                "tags": entry.tags
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

        Ok(entry_id)
    }
}

pub struct ContextStore {
    entries: Arc<RwLock<HashMap<String, ContextEntry>>>,
    index_by_tag: Arc<RwLock<HashMap<String, Vec<String>>>>, // tag -> entry_ids
    index_by_tenant: Arc<RwLock<HashMap<String, Vec<String>>>>, // tenant_id -> entry_ids
}

impl Default for ContextStore {
    fn default() -> Self {
        Self::new()
    }
}

impl ContextStore {
    pub fn new() -> Self {
        ContextStore {
            entries: Arc::new(RwLock::new(HashMap::new())),
            index_by_tag: Arc::new(RwLock::new(HashMap::new())),
            index_by_tenant: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_entry(&self, entry: ContextEntry) -> String {
        let entry_id = entry.entry_id.clone();

        // Add to main entries map
        let mut entries = self.entries.write().await;
        entries.insert(entry_id.clone(), entry.clone());
        drop(entries);

        // Update indices
        for tag in &entry.tags {
            let mut index_by_tag = self.index_by_tag.write().await;
            index_by_tag
                .entry(tag.clone())
                .or_insert_with(Vec::new)
                .push(entry_id.clone());
        }

        // Add to tenant index
        if let Some(tenant_tag) = entry.tags.iter().find(|tag| tag.starts_with("tenant:")) {
            let tenant_id = tenant_tag.strip_prefix("tenant:").unwrap_or("");
            let mut index_by_tenant = self.index_by_tenant.write().await;
            index_by_tenant
                .entry(tenant_id.to_string())
                .or_insert_with(Vec::new)
                .push(entry_id.clone());
        }

        entry_id
    }

    pub async fn get_all_entries(&self) -> Vec<ContextEntry> {
        let entries = self.entries.read().await;
        entries.values().cloned().collect()
    }

    pub async fn get_entries_by_tag(&self, tag: String) -> Vec<ContextEntry> {
        let index_by_tag = self.index_by_tag.read().await;
        let entry_ids = index_by_tag.get(&tag).cloned().unwrap_or_default();
        drop(index_by_tag);

        let entries = self.entries.read().await;
        entry_ids
            .iter()
            .filter_map(|id| entries.get(id).cloned())
            .collect()
    }

    pub async fn get_entries_by_tenant(&self, tenant_id: String) -> Vec<ContextEntry> {
        let index_by_tenant = self.index_by_tenant.read().await;
        let entry_ids = index_by_tenant.get(&tenant_id).cloned().unwrap_or_default();
        drop(index_by_tenant);

        let entries = self.entries.read().await;
        entry_ids
            .iter()
            .filter_map(|id| entries.get(id).cloned())
            .collect()
    }
}

#[derive(Debug)]
struct AgentPermissions {
    max_sensitivity_tier: Option<u8>,
    allowed_tags: HashSet<String>,
    has_special_access: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_context_router_basic_functionality() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_context_router_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let session_manager = Arc::new(allternit_runtime_core::SessionManager::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register a test identity with the policy engine
        let test_identity = allternit_policy::Identity {
            id: "test_agent".to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "Test Agent".to_string(),
            tenant_id: "test_tenant".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string(), "perm_t0_write".to_string()],
        };
        policy_engine
            .register_identity(test_identity)
            .await
            .unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        let context_router = Arc::new(ContextRouter::new(
            history_ledger.clone(),
            messaging_system,
            policy_engine,
            session_manager,
        ));

        // Register a context entry
        let entry = ContextEntry {
            entry_id: Uuid::new_v4().to_string(),
            entry_type: ContextEntryType::Observation,
            content: serde_json::json!({"observation": "test observation"}),
            source_ref: "ledger_entry_1".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            sensitivity_tier: 0,
            tags: vec![
                "tenant:test_tenant".to_string(),
                "session:test_session".to_string(),
            ],
            retention_policy: RetentionPolicy {
                time_to_live: Some(3600), // 1 hour
                max_accesses: Some(10),
                decay_function: DecayFunction::Linear { rate: 0.1 },
            },
        };

        let entry_id = context_router
            .register_context_entry("test_tenant".to_string(), entry)
            .await
            .unwrap();
        assert!(!entry_id.is_empty());

        // Route context using selector
        let selector = ContextSelector {
            tenant_id: "test_tenant".to_string(),
            session_id: Some("test_session".to_string()),
            agent_id: None,
            skill_id: None,
            phase: None,
            time_range: None,
            tags: vec![],
            sensitivity_tier: Some(1),
        };

        let request = ContextRouteRequest {
            selector,
            requesting_agent_id: "test_agent".to_string(),
            requesting_session_id: "test_session".to_string(),
            requesting_skill_id: None,
            trace_id: Some("test_trace".to_string()),
        };

        let response = context_router.route_context(request).await.unwrap();
        assert_eq!(response.bundle.context_entries.len(), 1);
        assert_eq!(response.bundle.tenant_id, "test_tenant");

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_context_selection_logic() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_selection_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let session_manager = Arc::new(allternit_runtime_core::SessionManager::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        // Register a test identity with the policy engine
        let test_identity = allternit_policy::Identity {
            id: "test_agent".to_string(),
            identity_type: allternit_policy::IdentityType::AgentIdentity,
            name: "Test Agent".to_string(),
            tenant_id: "test_tenant".to_string(),
            created_at: 0,
            active: true,
            roles: vec!["user".to_string()],
            permissions: vec!["perm_t0_read".to_string(), "perm_t0_write".to_string()],
        };
        policy_engine
            .register_identity(test_identity)
            .await
            .unwrap();
        policy_engine.create_default_permissions().await.unwrap();
        policy_engine.create_default_rules().await.unwrap();

        let context_router = Arc::new(ContextRouter::new(
            history_ledger.clone(),
            messaging_system,
            policy_engine,
            session_manager,
        ));

        // Register multiple entries with different tags
        let entry1 = ContextEntry {
            entry_id: Uuid::new_v4().to_string(),
            entry_type: ContextEntryType::Analysis,
            content: serde_json::json!({"analysis": "test analysis"}),
            source_ref: "ledger_entry_1".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            sensitivity_tier: 1,
            tags: vec![
                "tenant:test_tenant".to_string(),
                "session:test_session".to_string(),
                "phase:think".to_string(),
                "domain:science".to_string(),
            ],
            retention_policy: RetentionPolicy {
                time_to_live: Some(3600),
                max_accesses: Some(10),
                decay_function: DecayFunction::Linear { rate: 0.1 },
            },
        };

        let entry2 = ContextEntry {
            entry_id: Uuid::new_v4().to_string(),
            entry_type: ContextEntryType::Plan,
            content: serde_json::json!({"plan": "test plan"}),
            source_ref: "ledger_entry_2".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            sensitivity_tier: 2,
            tags: vec![
                "tenant:test_tenant".to_string(),
                "session:test_session".to_string(),
                "phase:plan".to_string(),
                "domain:science".to_string(),
            ],
            retention_policy: RetentionPolicy {
                time_to_live: Some(7200),
                max_accesses: Some(5),
                decay_function: DecayFunction::Exponential { half_life: 3600 },
            },
        };

        context_router
            .register_context_entry("test_tenant".to_string(), entry1)
            .await
            .unwrap();
        context_router
            .register_context_entry("test_tenant".to_string(), entry2)
            .await
            .unwrap();

        // Test selector that should match only the analysis entry
        let selector = ContextSelector {
            tenant_id: "test_tenant".to_string(),
            session_id: Some("test_session".to_string()),
            agent_id: None,
            skill_id: None,
            phase: Some("think".to_string()),
            time_range: None,
            tags: vec!["domain:science".to_string()],
            sensitivity_tier: Some(2), // Should allow both entries
        };

        let request = ContextRouteRequest {
            selector,
            requesting_agent_id: "test_agent".to_string(),
            requesting_session_id: "test_session".to_string(),
            requesting_skill_id: None,
            trace_id: Some("test_trace".to_string()),
        };

        let response = context_router.route_context(request).await.unwrap();
        // Should only get the analysis entry (phase:think)
        assert_eq!(response.bundle.context_entries.len(), 1);
        assert_eq!(
            response.bundle.context_entries[0].entry_type,
            ContextEntryType::Analysis
        );

        // Clean up
        std::fs::remove_file(&temp_path).unwrap();
    }

    #[tokio::test]
    async fn test_context_bundle_hash_is_deterministic() {
        let temp_db = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_db.path().to_string_lossy());
        let pool = SqlitePool::connect(&db_url).await.unwrap();
        let temp_path = format!("/tmp/test_context_hash_{}.jsonl", Uuid::new_v4());
        let history_ledger = Arc::new(Mutex::new(
            allternit_history::HistoryLedger::new(&temp_path).unwrap(),
        ));
        let messaging_system = Arc::new(
            allternit_messaging::MessagingSystem::new_with_storage(
                history_ledger.clone(),
                pool.clone(),
            )
            .await
            .unwrap(),
        );
        let policy_engine = Arc::new(allternit_policy::PolicyEngine::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));
        let session_manager = Arc::new(allternit_runtime_core::SessionManager::new(
            history_ledger.clone(),
            messaging_system.clone(),
        ));

        let context_router = ContextRouter::new(
            history_ledger.clone(),
            messaging_system,
            policy_engine,
            session_manager,
        );

        let entry_a = ContextEntry {
            entry_id: "entry-a".to_string(),
            entry_type: ContextEntryType::Observation,
            content: serde_json::json!({"value": "alpha"}),
            source_ref: "ledger_entry_a".to_string(),
            created_at: 1,
            sensitivity_tier: 1,
            tags: vec!["tenant:test_tenant".to_string()],
            retention_policy: RetentionPolicy {
                time_to_live: Some(3600),
                max_accesses: Some(10),
                decay_function: DecayFunction::Linear { rate: 0.1 },
            },
        };

        let entry_b = ContextEntry {
            entry_id: "entry-b".to_string(),
            entry_type: ContextEntryType::Observation,
            content: serde_json::json!({"value": "beta"}),
            source_ref: "ledger_entry_b".to_string(),
            created_at: 1,
            sensitivity_tier: 1,
            tags: vec!["tenant:test_tenant".to_string()],
            retention_policy: RetentionPolicy {
                time_to_live: Some(3600),
                max_accesses: Some(10),
                decay_function: DecayFunction::Linear { rate: 0.1 },
            },
        };

        let hash_a = context_router.calculate_bundle_hash(&vec![entry_a.clone(), entry_b.clone()]);
        let hash_b = context_router.calculate_bundle_hash(&vec![entry_b.clone(), entry_a.clone()]);
        assert_eq!(hash_a, hash_b);

        let mut changed_entry = entry_a.clone();
        changed_entry.content = serde_json::json!({"value": "alpha-updated"});
        let hash_changed =
            context_router.calculate_bundle_hash(&vec![changed_entry, entry_b.clone()]);
        assert_ne!(hash_a, hash_changed);

        std::fs::remove_file(&temp_path).unwrap();
    }
}
