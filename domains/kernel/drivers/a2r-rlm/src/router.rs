use sha2::Digest;
use std::sync::Arc;

use a2rchitech_context_router::{
    ContextBundle, ContextEntry, ContextEntryType, ContextRouter, DecayFunction, RetentionPolicy,
};
use a2rchitech_memory::MemoryFabric;
use a2rchitech_policy::PolicyEngine;
use a2rchitech_providers::{Capability, Modality, ProviderRouter as ExistingProviderRouter};
use a2rchitech_registry::UnifiedRegistry;

use crate::modes::base::ModeSelectionConfig;
use crate::modes::session::{EntryType, ExecutionEntry, RLMSession, SessionManager, SessionState};
use crate::{RLMConfig, RLMError};

pub struct RLMRouter {
    config: RLMConfig,
    policy_engine: Arc<PolicyEngine>,
    memory_fabric: Arc<MemoryFabric>,
    unified_registry: Arc<UnifiedRegistry>,
    context_router: Arc<ContextRouter>,
    provider_router: Arc<ExistingProviderRouter>,
    session_manager: Arc<SessionManager>,
    mode_selection_config: ModeSelectionConfig,
}

impl RLMRouter {
    pub async fn new(
        config: RLMConfig,
        policy_engine: Arc<PolicyEngine>,
        memory_fabric: Arc<MemoryFabric>,
        unified_registry: Arc<UnifiedRegistry>,
        context_router: Arc<ContextRouter>,
        provider_router: Arc<ExistingProviderRouter>,
        sqlite_pool: Arc<sqlx::SqlitePool>,
    ) -> Result<Self, RLMError> {
        let session_manager = Arc::new(
            SessionManager::new((*sqlite_pool).clone())
                .await
                .map_err(RLMError::Session)?,
        );

        Ok(Self {
            config,
            policy_engine,
            memory_fabric,
            unified_registry,
            context_router,
            provider_router,
            session_manager,
            mode_selection_config: ModeSelectionConfig::default(),
        })
    }

    /// Route a task through RLM context management with session tracking
    pub async fn route_with_context_management(
        &self,
        task: &str,
        context: &str,
        model_id: &str,
        max_recursion_depth: u32,
        context_slice_size: usize,
    ) -> Result<String, RLMError> {
        let effective_recursion_depth = if max_recursion_depth == 0 {
            self.config.max_recursion_depth
        } else {
            max_recursion_depth
        };
        let effective_slice_size = if context_slice_size == 0 {
            8192
        } else {
            context_slice_size
        };

        // Create a new session for this task
        let session_id = self.create_session_for_task(task, context).await?;

        let context_bundle = self.create_context_bundle(task, context).await?;

        let strategy = self
            .select_strategy(context, task, effective_recursion_depth)
            .await?;

        let result = match strategy {
            Strategy::Direct => {
                self.execute_direct(task, context_bundle, model_id, context.len())
                    .await
            }
            Strategy::RLM => {
                self.execute_rlm_delegation_with_context_bundle(
                    task,
                    context_bundle,
                    model_id,
                    effective_recursion_depth,
                    effective_slice_size,
                )
                .await
            }
        };

        // Record the result in the session
        self.record_session_result(&session_id, &result, task)
            .await?;

        result
    }

    /// Create a new session for a task
    async fn create_session_for_task(&self, task: &str, context: &str) -> Result<String, RLMError> {
        let state = SessionState {
            context: context.to_string(),
            recursion_depth: 0,
            execution_log: vec![],
            variables: std::collections::HashMap::new(),
            answer: None,
        };

        let session_id = self
            .session_manager
            .commit(
                task,
                state,
                vec![],   // No parent hashes for new session
                "direct", // Default mode
                "rlm-router",
            )
            .await
            .map_err(RLMError::Session)?;

        Ok(session_id)
    }

    /// Record the result in the session
    async fn record_session_result(
        &self,
        session_id: &str,
        result: &Result<String, RLMError>,
        task: &str,
    ) -> Result<(), RLMError> {
        let entry_type = match result {
            Ok(_) => EntryType::Result,
            Err(_) => EntryType::Error,
        };

        let content = match result {
            Ok(output) => format!("Task: {}\nResult: {}", task, output),
            Err(error) => format!("Task: {}\nError: {}", task, error),
        };

        let entry = ExecutionEntry {
            entry_type,
            content,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            parent_hash: None,
            hash: uuid::Uuid::new_v4().to_string(),
        };

        self.session_manager
            .add_entry(session_id, entry)
            .await
            .map_err(RLMError::Session)?;

        Ok(())
    }

    pub async fn route_direct(
        &self,
        task: &str,
        context: &str,
        model_id: &str,
    ) -> Result<String, RLMError> {
        let context_bundle = self.create_context_bundle(task, context).await?;
        self.execute_direct(task, context_bundle, model_id, context.len())
            .await
    }

    /// Create a context bundle for routing
    async fn create_context_bundle(
        &self,
        task: &str,
        context: &str,
    ) -> Result<ContextBundle, RLMError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let bundle = ContextBundle {
            bundle_id: uuid::Uuid::new_v4().to_string(),
            tenant_id: "default-tenant".to_string(),
            session_id: Some("rlm-session".to_string()),
            created_at: now,
            expires_at: None,
            access_count: 0,
            last_accessed: now,
            size_bytes: context.len(),
            context_entries: vec![a2rchitech_context_router::ContextEntry {
                entry_id: uuid::Uuid::new_v4().to_string(),
                entry_type: a2rchitech_context_router::ContextEntryType::Task,
                content: serde_json::json!({
                    "task": task,
                    "context": context,
                    "context_length": context.len(),
                    "task_type": "rlm"
                }),
                source_ref: "rlm-router".to_string(),
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                sensitivity_tier: 0,
                tags: vec!["rlm".to_string(), "task".to_string(), "input".to_string()],
                retention_policy: a2rchitech_context_router::RetentionPolicy {
                    time_to_live: Some(3600),
                    max_accesses: Some(10),
                    decay_function: a2rchitech_context_router::DecayFunction::Linear { rate: 0.1 },
                },
            }],
            provenance: a2rchitech_context_router::ContextProvenance {
                origin_session: None,
                origin_agent: "rlm-router".to_string(),
                derivation_chain: vec![],
                integrity_hash: format!("{:x}", sha2::Sha256::digest(context.as_bytes())),
                signature: None,
            },
            access_control: a2rchitech_context_router::ContextAccessControl {
                allowed_agents: std::collections::HashSet::new(),
                allowed_skills: std::collections::HashSet::new(),
                allowed_phases: std::collections::HashSet::from_iter([
                    "OBSERVE".to_string(),
                    "THINK".to_string(),
                    "PLAN".to_string(),
                    "ACT".to_string(),
                ]),
                time_window: None,
                access_policy: a2rchitech_context_router::ContextAccessPolicy::SensitivityTier {
                    max_tier: 4,
                },
            },
        };

        Ok(bundle)
    }

    async fn execute_direct(
        &self,
        task: &str,
        context_bundle: ContextBundle,
        model_id: &str,
        context_window: usize,
    ) -> Result<String, RLMError> {
        use a2rchitech_providers::ProviderRequest as ExistingProviderRequest;

        let request = ExistingProviderRequest {
            request_id: uuid::Uuid::new_v4().to_string(),
            session_id: context_bundle
                .session_id
                .clone()
                .unwrap_or_else(|| "default-session".to_string()),
            tenant_id: context_bundle.tenant_id.clone(),
            agent_id: "rlm-agent".to_string(),
            persona: a2rchitech_providers::Persona {
                persona_id: "default".to_string(),
                name: "Default RLM Persona".to_string(),
                description: "Default persona for RLM operations".to_string(),
                base_persona: "gizzi".to_string(),
                overlays: vec![],
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
            },
            context_bundle,
            intent: task.to_string(),
            required_capabilities: self.build_required_capabilities(model_id, context_window),
            budget_constraints: a2rchitech_providers::ProviderBudget {
                daily_limit: None,
                monthly_limit: None,
                rate_limit: None,
                token_limit: None,
            },
            trace_id: None,
        };

        let response = self
            .provider_router
            .route_request(request)
            .await
            .map_err(|e| RLMError::Validation(format!("Provider routing failed: {}", e)))?;

        let response_text = response
            .response
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| response.response.to_string());
        Ok(response_text)
    }

    /// Select the appropriate execution strategy based on context characteristics
    async fn select_strategy(
        &self,
        context: &str,
        task: &str,
        max_recursion_depth: u32,
    ) -> Result<Strategy, RLMError> {
        let context_size = context.len();
        let is_complex = self.is_complex_task(task);

        // Use the mode selection configuration for more sophisticated decision making
        if context_size < self.mode_selection_config.context_threshold && !is_complex {
            Ok(Strategy::Direct)
        } else {
            Ok(Strategy::RLM)
        }
    }

    /// Execute using RLM context slicing and delegation with context bundle
    async fn execute_rlm_delegation_with_context_bundle(
        &self,
        task: &str,
        mut context_bundle: ContextBundle,
        model_id: &str,
        max_recursion_depth: u32,
        context_slice_size: usize,
    ) -> Result<String, RLMError> {
        use a2rchitech_providers::ProviderRequest as ExistingProviderRequest;

        let mut current_depth = 0;
        let mut final_answer = None;

        while current_depth < max_recursion_depth && final_answer.is_none() {
            let context_slices = self
                .slice_context_bundle(&context_bundle, context_slice_size)
                .await?;

            let mut partial_results = Vec::new();
            for (slice_index, slice_bundle) in context_slices.iter().enumerate() {
                let slice_context = self.extract_context_text(slice_bundle);
                let request = ExistingProviderRequest {
                    request_id: format!("rlm-slice-{}-{}", current_depth, slice_index),
                    session_id: slice_bundle
                        .session_id
                        .clone()
                        .unwrap_or_else(|| format!("rlm-slice-{}-{}", current_depth, slice_index)),
                    tenant_id: slice_bundle.tenant_id.clone(),
                    agent_id: "rlm-agent".to_string(),
                    persona: a2rchitech_providers::Persona {
                        persona_id: "default".to_string(),
                        name: "Default RLM Persona".to_string(),
                        description: "Default persona for RLM operations".to_string(),
                        base_persona: "gizzi".to_string(),
                        overlays: vec![],
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
                    },
                    context_bundle: slice_bundle.clone(),
                    intent: format!("{} (context slice)", task),
                    required_capabilities: self
                        .build_required_capabilities(model_id, slice_context.len()),
                    budget_constraints: a2rchitech_providers::ProviderBudget {
                        daily_limit: None,
                        monthly_limit: None,
                        rate_limit: None,
                        token_limit: None,
                    },
                    trace_id: None,
                };

                let response = self
                    .provider_router
                    .route_request(request)
                    .await
                    .map_err(|e| RLMError::Validation(format!("Slice processing failed: {}", e)))?;

                let response_text = response
                    .response
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| response.response.to_string());
                partial_results.push(response_text);
            }

            let aggregated = self
                .aggregate_results(&partial_results, context_bundle.session_id.as_deref())
                .await?;

            if self.is_complete_answer(&aggregated) {
                final_answer = Some(aggregated);
            } else {
                let new_entry = a2rchitech_context_router::ContextEntry {
                    entry_id: uuid::Uuid::new_v4().to_string(),
                    entry_type: a2rchitech_context_router::ContextEntryType::Analysis,
                    content: serde_json::json!({
                        "aggregated_result": &aggregated,
                        "iteration": current_depth,
                        "partial_results_count": partial_results.len()
                    }),
                    source_ref: format!("rlm-aggregation-{}", current_depth),
                    created_at: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                    sensitivity_tier: 0,
                    tags: vec![
                        "rlm".to_string(),
                        "aggregation".to_string(),
                        "iteration".to_string(),
                    ],
                    retention_policy: a2rchitech_context_router::RetentionPolicy {
                        time_to_live: Some(3600),
                        max_accesses: Some(10),
                        decay_function: a2rchitech_context_router::DecayFunction::Linear {
                            rate: 0.1,
                        },
                    },
                };

                context_bundle.context_entries.push(new_entry);
            }

            current_depth += 1;
        }

        final_answer.ok_or_else(|| {
            RLMError::Validation("Max recursion depth reached without complete answer".to_string())
        })
    }

    /// Slice a context bundle into multiple smaller bundles for delegated processing.
    async fn slice_context_bundle(
        &self,
        context_bundle: &ContextBundle,
        context_slice_size: usize,
    ) -> Result<Vec<ContextBundle>, RLMError> {
        let context_text = self.extract_context_text(context_bundle);
        let slices = self
            .slice_context(
                &context_text,
                context_bundle.session_id.as_deref(),
                context_slice_size,
            )
            .await?;
        if slices.is_empty() {
            return Ok(vec![context_bundle.clone()]);
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let total_slices = slices.len();
        let max_tier = context_bundle
            .context_entries
            .iter()
            .map(|entry| entry.sensitivity_tier)
            .max()
            .unwrap_or(0);
        let base_session_id = context_bundle
            .session_id
            .clone()
            .unwrap_or_else(|| "rlm-session".to_string());

        let mut bundles = Vec::with_capacity(total_slices);
        for (index, slice) in slices.into_iter().enumerate() {
            let mut provenance = context_bundle.provenance.clone();
            provenance
                .derivation_chain
                .push(format!("slice:{}:{}", context_bundle.bundle_id, index));
            provenance.integrity_hash = format!("{:x}", sha2::Sha256::digest(slice.as_bytes()));

            let entry = ContextEntry {
                entry_id: uuid::Uuid::new_v4().to_string(),
                entry_type: ContextEntryType::Task,
                content: serde_json::json!({
                    "context_slice": slice,
                    "slice_index": index,
                    "total_slices": total_slices,
                    "source_bundle_id": context_bundle.bundle_id.clone(),
                }),
                source_ref: format!("rlm-slice:{}:{}", context_bundle.bundle_id, index),
                created_at: now,
                sensitivity_tier: max_tier,
                tags: vec![
                    "rlm".to_string(),
                    "context_slice".to_string(),
                    format!("slice:{}", index),
                ],
                retention_policy: RetentionPolicy {
                    time_to_live: Some(3600),
                    max_accesses: Some(10),
                    decay_function: DecayFunction::Linear { rate: 0.1 },
                },
            };

            bundles.push(ContextBundle {
                bundle_id: uuid::Uuid::new_v4().to_string(),
                tenant_id: context_bundle.tenant_id.clone(),
                session_id: Some(format!("{}-slice-{}", base_session_id, index)),
                created_at: now,
                expires_at: context_bundle.expires_at,
                access_count: 0,
                last_accessed: now,
                size_bytes: slice.len(),
                context_entries: vec![entry],
                provenance,
                access_control: context_bundle.access_control.clone(),
            });
        }

        Ok(bundles)
    }

    async fn slice_context(
        &self,
        context: &str,
        session_id: Option<&str>,
        context_slice_size: usize,
    ) -> Result<Vec<String>, RLMError> {
        self.memory_fabric
            .slice_context_for_rlm(
                context,
                context_slice_size,
                session_id,
                "rlm-router".to_string(),
            )
            .await
            .map_err(RLMError::Memory)
    }

    async fn aggregate_results(
        &self,
        results: &[String],
        session_id: Option<&str>,
    ) -> Result<String, RLMError> {
        self.memory_fabric
            .aggregate_rlm_results(results, session_id, "rlm-router".to_string())
            .await
            .map_err(RLMError::Memory)
    }

    fn is_complete_answer(&self, result: &str) -> bool {
        result.to_lowercase().contains("answer:")
            || result.len() > 100 && !result.contains("[INCOMPLETE]")
    }

    /// Determine if a task is complex
    fn is_complex_task(&self, task: &str) -> bool {
        let complexity_indicators = [
            "analyze",
            "summarize",
            "compare",
            "review",
            "examine",
            "across",
            "entire",
            "all",
            "comprehensive",
            "detailed",
        ];

        let task_lower = task.to_lowercase();
        complexity_indicators
            .iter()
            .any(|indicator| task_lower.contains(indicator))
    }

    /// Execute a task using provider routing with RLM context management
    fn extract_context_text(&self, context_bundle: &ContextBundle) -> String {
        let mut parts = Vec::new();
        for entry in &context_bundle.context_entries {
            if let Some(task) = entry.content.get("task").and_then(|value| value.as_str()) {
                parts.push(format!("Task: {}", task));
            }
            if let Some(context) = entry
                .content
                .get("context")
                .and_then(|value| value.as_str())
            {
                parts.push(context.to_string());
                continue;
            }
            if let Some(text) = entry.content.as_str() {
                parts.push(text.to_string());
                continue;
            }
            parts.push(entry.content.to_string());
        }

        parts.join("\n\n")
    }

    fn build_required_capabilities(
        &self,
        model_id: &str,
        context_window: usize,
    ) -> Vec<Capability> {
        vec![Capability {
            model: model_id.to_string(),
            modalities: vec![Modality::Text],
            context_window,
            max_tokens: 0,
            response_time_ms: 0,
            cost_per_token: 0.0,
            safety_tier: 0,
        }]
    }

    /// Create a new branch from the current session state
    pub async fn branch_session(
        &self,
        branch_name: &str,
        parent_session_id: Option<&str>,
    ) -> Result<String, RLMError> {
        let session_id = self
            .session_manager
            .branch(branch_name, parent_session_id)
            .await
            .map_err(RLMError::Session)?;
        Ok(session_id)
    }

    /// Checkout to a specific session
    pub async fn checkout_session(&self, session_id: &str) -> Result<RLMSession, RLMError> {
        let session = self
            .session_manager
            .checkout(session_id)
            .await
            .map_err(RLMError::Session)?;
        Ok(session)
    }

    /// Get session history
    pub async fn get_session_history(
        &self,
        limit: Option<usize>,
        branch: Option<&str>,
    ) -> Result<Vec<RLMSession>, RLMError> {
        let sessions = self
            .session_manager
            .log(limit, branch)
            .await
            .map_err(RLMError::Session)?;
        Ok(sessions)
    }

    /// Tag a session
    pub async fn tag_session(
        &self,
        session_id: &str,
        tag_name: &str,
        tag_message: Option<&str>,
    ) -> Result<(), RLMError> {
        self.session_manager
            .tag_session(session_id, tag_name, tag_message)
            .await
            .map_err(RLMError::Session)?;
        Ok(())
    }

    /// Get differences between two sessions
    pub async fn diff_sessions(
        &self,
        session1_id: &str,
        session2_id: &str,
    ) -> Result<crate::modes::session::SessionDiff, RLMError> {
        let diff = self
            .session_manager
            .diff_sessions(session1_id, session2_id)
            .await
            .map_err(RLMError::Session)?;
        Ok(diff)
    }

    /// Reset to a specific commit
    pub async fn reset_to_commit(&self, session_id: &str) -> Result<RLMSession, RLMError> {
        let session = self
            .session_manager
            .reset_to_commit(session_id)
            .await
            .map_err(RLMError::Session)?;
        Ok(session)
    }

    /// Merge a branch into the current branch
    pub async fn merge_branch(
        &self,
        source_branch: &str,
        commit_msg: &str,
    ) -> Result<String, RLMError> {
        let session_id = self
            .session_manager
            .merge_branch(source_branch, commit_msg)
            .await
            .map_err(RLMError::Session)?;
        Ok(session_id)
    }

    /// Get the current branch
    pub async fn current_branch(&self) -> Result<String, RLMError> {
        let branch = self
            .session_manager
            .current_branch()
            .await
            .map_err(RLMError::Session)?;
        Ok(branch)
    }

    /// List all branches
    pub async fn list_branches(&self) -> Result<Vec<String>, RLMError> {
        let branches = self
            .session_manager
            .list_branches()
            .await
            .map_err(RLMError::Session)?;
        Ok(branches)
    }

    /// List all tags
    pub async fn list_tags(&self) -> Result<Vec<crate::modes::session::TagInfo>, RLMError> {
        let tags = self
            .session_manager
            .list_tags()
            .await
            .map_err(RLMError::Session)?;
        Ok(tags)
    }
}

/// Strategy for execution
enum Strategy {
    Direct,
    RLM,
}
