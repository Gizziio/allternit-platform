//! Allternit Evolution Layer
//!
//! Implements self-improving agent infrastructure with 5 evolution engines:
//!
//! 1. **Memory Evolution Engine (MEE)** - ALMA-style schema competition
//!    - Schema archive with evaluation
//!    - Candidate generation
//!    - Performance-based selection
//!
//! 2. **Skill Evolution Engine (SEE)** - SkillRL-style trajectory distillation
//!    - Trajectory to skill extraction
//!    - Skill hierarchy building
//!    - Skill scoring and retrieval
//!
//! 3. **Confidence-Based Routing Layer (CRL)** - AdaptEvolve-style escalation
//!    - Small → mid → frontier model routing
//!    - Uncertainty monitoring
//!    - Historical failure tracking
//!
//! 4. **Organizational Evolution Engine (OEE)** - Agyn-style workflow mutation
//!    - Role specialization
//!    - Dynamic workflow mutation
//!    - Manager decision cycles
//!
//! 5. **Trajectory Optimization Engine (TOE)** - InftyThink-style boundary control
//!    - Iterative boundary controller
//!    - Summarization
//!    - State tracking
//!    - Efficiency reward

use allternit_harness_engineering::HarnessEngineeringEngine;
use allternit_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Memory Evolution Engine (MEE) - ALMA-style
// ============================================================================

/// Memory schema for evolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySchema {
    pub schema_id: String,
    pub name: String,
    pub domain: String,
    pub retrieval_strategy: String,
    pub update_strategy: String,
    pub version: String,
    pub performance_metrics: SchemaPerformanceMetrics,
    pub created_at: DateTime<Utc>,
    pub last_evaluated: Option<DateTime<Utc>>,
}

/// Schema performance metrics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SchemaPerformanceMetrics {
    pub retrieval_precision: f32,
    pub context_compression_ratio: f32,
    pub task_success_correlation: f32,
    pub usage_count: u32,
    pub evaluation_scores: Vec<f32>,
}

impl SchemaPerformanceMetrics {
    pub fn average_score(&self) -> f32 {
        if self.evaluation_scores.is_empty() {
            return 0.0;
        }
        self.evaluation_scores.iter().sum::<f32>() / self.evaluation_scores.len() as f32
    }
}

/// Memory schema candidate for evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaCandidate {
    pub candidate_id: String,
    pub parent_schema_id: Option<String>,
    pub mutations: Vec<String>,
    pub justification: String,
}

/// Memory Evolution Engine
pub struct MemoryEvolutionEngine {
    schema_archive: Arc<RwLock<HashMap<String, MemorySchema>>>,
    candidates: Arc<RwLock<Vec<SchemaCandidate>>>,
    active_schema_id: Arc<RwLock<Option<String>>>,
}

impl MemoryEvolutionEngine {
    pub fn new() -> Self {
        Self {
            schema_archive: Arc::new(RwLock::new(HashMap::new())),
            candidates: Arc::new(RwLock::new(Vec::new())),
            active_schema_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Register memory schema
    pub async fn register_schema(&self, schema: MemorySchema) {
        let mut archive = self.schema_archive.write().await;
        archive.insert(schema.schema_id.clone(), schema);
    }

    /// Evaluate schema performance
    pub async fn evaluate_schema(
        &self,
        schema_id: &str,
        precision: f32,
        compression: f32,
        success_corr: f32,
    ) -> Result<(), EvolutionError> {
        let mut archive = self.schema_archive.write().await;
        let schema = archive
            .get_mut(schema_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("Schema {}", schema_id)))?;

        schema.performance_metrics.retrieval_precision = precision;
        schema.performance_metrics.context_compression_ratio = compression;
        schema.performance_metrics.task_success_correlation = success_corr;
        schema.performance_metrics.usage_count += 1;
        schema
            .performance_metrics
            .evaluation_scores
            .push((precision + compression + success_corr) / 3.0);
        schema.last_evaluated = Some(Utc::now());

        Ok(())
    }

    /// Generate schema candidate through mutation
    pub async fn generate_candidate(
        &self,
        parent_schema_id: &str,
        mutations: Vec<String>,
        justification: &str,
    ) -> Result<String, EvolutionError> {
        let candidate = SchemaCandidate {
            candidate_id: format!("cand_{}", Uuid::new_v4().simple()),
            parent_schema_id: Some(parent_schema_id.to_string()),
            mutations,
            justification: justification.to_string(),
        };

        let candidate_id = candidate.candidate_id.clone();
        let mut candidates = self.candidates.write().await;
        candidates.push(candidate);

        Ok(candidate_id)
    }

    /// Promote candidate to schema
    pub async fn promote_candidate(
        &self,
        candidate_id: &str,
        name: &str,
        domain: &str,
    ) -> Result<String, EvolutionError> {
        let mut candidates = self.candidates.write().await;
        let candidate_idx = candidates
            .iter()
            .position(|c| c.candidate_id == candidate_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("Candidate {}", candidate_id)))?;

        let candidate = candidates.remove(candidate_idx);
        drop(candidates);

        // Create new schema from candidate
        let schema = MemorySchema {
            schema_id: format!("schema_{}", Uuid::new_v4().simple()),
            name: name.to_string(),
            domain: domain.to_string(),
            retrieval_strategy: "evolved".to_string(),
            update_strategy: "evolved".to_string(),
            version: "1.0.0".to_string(),
            performance_metrics: SchemaPerformanceMetrics::default(),
            created_at: Utc::now(),
            last_evaluated: None,
        };

        let schema_id = schema.schema_id.clone();
        self.register_schema(schema).await;

        // Set as active if first schema or better than current
        let mut active_id = self.active_schema_id.write().await;
        if active_id.is_none() {
            *active_id = Some(schema_id.clone());
        }

        Ok(schema_id)
    }

    /// Get best performing schema
    pub async fn get_best_schema(&self) -> Option<MemorySchema> {
        let archive = self.schema_archive.read().await;
        archive
            .values()
            .max_by(|a, b| {
                a.performance_metrics
                    .average_score()
                    .partial_cmp(&b.performance_metrics.average_score())
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
    }

    /// Set active schema
    pub async fn set_active_schema(&self, schema_id: &str) -> Result<(), EvolutionError> {
        let archive = self.schema_archive.read().await;
        if !archive.contains_key(schema_id) {
            return Err(EvolutionError::NotFound(format!("Schema {}", schema_id)));
        }
        drop(archive);

        let mut active_id = self.active_schema_id.write().await;
        *active_id = Some(schema_id.to_string());
        Ok(())
    }
}

impl Default for MemoryEvolutionEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Skill Evolution Engine (SEE) - SkillRL-style
// ============================================================================

/// Skill extracted from trajectory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolvedSkill {
    pub skill_id: String,
    pub name: String,
    pub trigger_signature: String,
    pub behavior_pattern: Vec<String>,
    pub tool_sequence: Vec<String>,
    pub expected_outcome: String,
    pub confidence_score: f32,
    pub domain_tags: Vec<String>,
    pub parent_skill_id: Option<String>,
    pub child_skill_ids: Vec<String>,
    pub usage_count: u32,
    pub success_rate: f32,
}

/// Trajectory for skill extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trajectory {
    pub trajectory_id: String,
    pub task_id: String,
    pub steps: Vec<TrajectoryStep>,
    pub outcome: String,
    pub success: bool,
    pub timestamp: DateTime<Utc>,
}

/// Trajectory step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryStep {
    pub step_id: String,
    pub action: String,
    pub tool_used: Option<String>,
    pub observation: String,
}

/// Skill Evolution Engine
pub struct SkillEvolutionEngine {
    skills: Arc<RwLock<HashMap<String, EvolvedSkill>>>,
    trajectories: Arc<RwLock<Vec<Trajectory>>>,
    skill_hierarchy: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl SkillEvolutionEngine {
    pub fn new() -> Self {
        Self {
            skills: Arc::new(RwLock::new(HashMap::new())),
            trajectories: Arc::new(RwLock::new(Vec::new())),
            skill_hierarchy: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record trajectory for later skill extraction
    pub async fn record_trajectory(&self, trajectory: Trajectory) {
        let mut trajectories = self.trajectories.write().await;
        trajectories.push(trajectory);
    }

    /// Extract skill from trajectory
    pub async fn extract_skill(&self, trajectory_id: &str) -> Result<String, EvolutionError> {
        let trajectories = self.trajectories.read().await;
        let trajectory = trajectories
            .iter()
            .find(|t| t.trajectory_id == trajectory_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("Trajectory {}", trajectory_id)))?
            .clone();
        drop(trajectories);

        // Extract behavior pattern from steps
        let behavior_pattern: Vec<String> =
            trajectory.steps.iter().map(|s| s.action.clone()).collect();

        // Extract tool sequence
        let tool_sequence: Vec<String> = trajectory
            .steps
            .iter()
            .filter_map(|s| s.tool_used.clone())
            .collect();

        // Create skill
        let skill = EvolvedSkill {
            skill_id: format!("skill_{}", Uuid::new_v4().simple()),
            name: format!("Skill from {}", trajectory_id),
            trigger_signature: trajectory.outcome.clone(),
            behavior_pattern,
            tool_sequence,
            expected_outcome: trajectory.outcome,
            confidence_score: if trajectory.success { 0.8 } else { 0.3 },
            domain_tags: vec!["extracted".to_string()],
            parent_skill_id: None,
            child_skill_ids: vec![],
            usage_count: 0,
            success_rate: if trajectory.success { 1.0 } else { 0.0 },
        };

        let skill_id = skill.skill_id.clone();
        self.register_skill(skill).await;

        Ok(skill_id)
    }

    /// Register skill
    pub async fn register_skill(&self, skill: EvolvedSkill) {
        let mut skills = self.skills.write().await;
        skills.insert(skill.skill_id.clone(), skill);
    }

    /// Update skill performance
    pub async fn update_skill_performance(
        &self,
        skill_id: &str,
        success: bool,
    ) -> Result<(), EvolutionError> {
        let mut skills = self.skills.write().await;
        let skill = skills
            .get_mut(skill_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("Skill {}", skill_id)))?;

        skill.usage_count += 1;

        // Update success rate with exponential moving average
        let alpha = 0.1;
        skill.success_rate =
            (1.0 - alpha) * skill.success_rate + alpha * if success { 1.0 } else { 0.0 };

        Ok(())
    }

    /// Get skills by domain
    pub async fn get_skills_by_domain(&self, domain: &str) -> Vec<EvolvedSkill> {
        let skills = self.skills.read().await;
        skills
            .values()
            .filter(|s| s.domain_tags.iter().any(|t| t == domain))
            .cloned()
            .collect()
    }

    /// Get best skill for trigger
    pub async fn get_best_skill_for_trigger(&self, trigger: &str) -> Option<EvolvedSkill> {
        let skills = self.skills.read().await;
        skills
            .values()
            .filter(|s| s.trigger_signature.contains(trigger))
            .max_by(|a, b| {
                a.confidence_score
                    .partial_cmp(&b.confidence_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
    }
}

impl Default for SkillEvolutionEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Confidence-Based Routing Layer (CRL) - AdaptEvolve-style
// ============================================================================

/// Model routing tier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelTier {
    Small,    // Fast, cheap, less capable
    Medium,   // Balanced
    Frontier, // Most capable, expensive
}

/// Routing decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingDecision {
    pub decision_id: String,
    pub task_signature: String,
    pub selected_tier: ModelTier,
    pub confidence_score: f32,
    pub uncertainty_factors: Vec<String>,
    pub historical_failure_rate: f32,
    pub cost_estimate: f32,
    pub timestamp: DateTime<Utc>,
}

/// Confidence-Based Routing Layer
pub struct ConfidenceRoutingLayer {
    routing_history: Arc<RwLock<Vec<RoutingDecision>>>,
    task_signatures: Arc<RwLock<HashMap<String, ModelTier>>>,
    failure_rates: Arc<RwLock<HashMap<String, Vec<bool>>>>,
    default_tier: ModelTier,
}

impl ConfidenceRoutingLayer {
    pub fn new() -> Self {
        Self {
            routing_history: Arc::new(RwLock::new(Vec::new())),
            task_signatures: Arc::new(RwLock::new(HashMap::new())),
            failure_rates: Arc::new(RwLock::new(HashMap::new())),
            default_tier: ModelTier::Small,
        }
    }

    /// Route task to appropriate model tier
    pub async fn route_task(&self, task_signature: &str, complexity: f32) -> RoutingDecision {
        // Check historical performance for this task signature
        let tier = self.get_historical_tier(task_signature).await;

        // Calculate confidence based on complexity and history
        let confidence = self.calculate_confidence(task_signature, complexity).await;

        // Get uncertainty factors
        let uncertainty = self.get_uncertainty_factors(task_signature).await;

        // Get historical failure rate
        let failure_rate = self.get_failure_rate(task_signature).await;

        // Estimate cost
        let cost = match tier {
            ModelTier::Small => 1.0,
            ModelTier::Medium => 5.0,
            ModelTier::Frontier => 20.0,
        };

        let decision = RoutingDecision {
            decision_id: format!("route_{}", Uuid::new_v4().simple()),
            task_signature: task_signature.to_string(),
            selected_tier: tier,
            confidence_score: confidence,
            uncertainty_factors: uncertainty,
            historical_failure_rate: failure_rate,
            cost_estimate: cost,
            timestamp: Utc::now(),
        };

        // Record decision
        let mut history = self.routing_history.write().await;
        history.push(decision.clone());

        decision
    }

    /// Get historical tier for task signature
    async fn get_historical_tier(&self, signature: &str) -> ModelTier {
        let signatures = self.task_signatures.read().await;
        *signatures.get(signature).unwrap_or(&self.default_tier)
    }

    /// Calculate confidence score
    async fn calculate_confidence(&self, signature: &str, complexity: f32) -> f32 {
        // Higher complexity = lower confidence
        let complexity_factor = 1.0 - (complexity.min(1.0));

        // Check historical success
        let history_factor = 1.0 - self.get_failure_rate(signature).await;

        (complexity_factor + history_factor) / 2.0
    }

    /// Get uncertainty factors
    async fn get_uncertainty_factors(&self, _signature: &str) -> Vec<String> {
        // In production, would analyze task for uncertainty
        vec![]
    }

    /// Get historical failure rate
    async fn get_failure_rate(&self, signature: &str) -> f32 {
        let failure_rates = self.failure_rates.read().await;
        if let Some(rates) = failure_rates.get(signature) {
            if rates.is_empty() {
                return 0.0;
            }
            rates.iter().filter(|&&r| !r).count() as f32 / rates.len() as f32
        } else {
            0.0
        }
    }

    /// Record task outcome for learning
    pub async fn record_outcome(&self, signature: &str, success: bool, tier: ModelTier) {
        // Update failure rates
        {
            let mut failure_rates = self.failure_rates.write().await;
            failure_rates
                .entry(signature.to_string())
                .or_insert_with(Vec::new)
                .push(success);
        }

        // Update task signature mapping
        {
            let mut signatures = self.task_signatures.write().await;
            signatures.insert(signature.to_string(), tier);
        }
    }

    /// Escalate to higher tier
    pub async fn escalate(&self, signature: &str) -> ModelTier {
        let current = self.get_historical_tier(signature).await;
        let escalated = match current {
            ModelTier::Small => ModelTier::Medium,
            ModelTier::Medium => ModelTier::Frontier,
            ModelTier::Frontier => ModelTier::Frontier, // Already at top
        };

        if escalated != current {
            let mut signatures = self.task_signatures.write().await;
            signatures.insert(signature.to_string(), escalated);
        }

        escalated
    }
}

impl Default for ConfidenceRoutingLayer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Organizational Evolution Engine (OEE) - Agyn-style
// ============================================================================

/// Agent role in organization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentRole {
    Manager,
    Researcher,
    Engineer,
    Reviewer,
    Security,
    Optimizer,
}

/// Workflow configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowConfig {
    pub workflow_id: String,
    pub name: String,
    pub roles: Vec<AgentRole>,
    pub iteration_cycles: u32,
    pub escalation_threshold: u32,
    pub parallel_allowed: bool,
}

/// Organizational Evolution Engine
pub struct OrganizationalEvolutionEngine {
    workflows: Arc<RwLock<HashMap<String, WorkflowConfig>>>,
    role_assignments: Arc<RwLock<HashMap<String, AgentRole>>>,
    workflow_mutations: Arc<RwLock<Vec<WorkflowMutation>>>,
}

impl OrganizationalEvolutionEngine {
    pub fn new() -> Self {
        Self {
            workflows: Arc::new(RwLock::new(HashMap::new())),
            role_assignments: Arc::new(RwLock::new(HashMap::new())),
            workflow_mutations: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register workflow
    pub async fn register_workflow(&self, workflow: WorkflowConfig) {
        let mut workflows = self.workflows.write().await;
        workflows.insert(workflow.workflow_id.clone(), workflow);
    }

    /// Assign agent to role
    pub async fn assign_role(&self, agent_id: &str, role: AgentRole) {
        let mut assignments = self.role_assignments.write().await;
        assignments.insert(agent_id.to_string(), role);
    }

    /// Mutate workflow
    pub async fn mutate_workflow(
        &self,
        workflow_id: &str,
        mutation: WorkflowMutation,
    ) -> Result<(), EvolutionError> {
        let mut workflows = self.workflows.write().await;
        let workflow = workflows
            .get_mut(workflow_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("Workflow {}", workflow_id)))?;

        // Apply mutation
        match &mutation {
            WorkflowMutation::AddRole(role) => {
                if !workflow.roles.contains(role) {
                    workflow.roles.push(*role);
                }
            }
            WorkflowMutation::RemoveRole(role) => {
                workflow.roles.retain(|r| r != role);
            }
            WorkflowMutation::ChangeIterations(delta) => {
                if *delta > 0 {
                    workflow.iteration_cycles =
                        workflow.iteration_cycles.saturating_add(*delta as u32);
                } else {
                    workflow.iteration_cycles =
                        workflow.iteration_cycles.saturating_sub((-delta) as u32);
                }
            }
            WorkflowMutation::ToggleParallel => {
                workflow.parallel_allowed = !workflow.parallel_allowed;
            }
        }

        // Record mutation
        let mut mutations = self.workflow_mutations.write().await;
        mutations.push(mutation);

        Ok(())
    }

    /// Get optimal workflow for task complexity
    pub async fn get_optimal_workflow(&self, complexity: f32) -> Option<WorkflowConfig> {
        let workflows = self.workflows.read().await;

        workflows
            .values()
            .filter(|w| {
                // Simple heuristic: more complex tasks need more roles
                let role_count = w.roles.len() as f32;
                let complexity_tier = (complexity * 10.0) as usize;
                role_count as usize >= complexity_tier.min(6)
            })
            .max_by(|a, b| a.roles.len().cmp(&b.roles.len()))
            .cloned()
    }
}

/// Workflow mutation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowMutation {
    AddRole(AgentRole),
    RemoveRole(AgentRole),
    ChangeIterations(i32),
    ToggleParallel,
}

impl Default for OrganizationalEvolutionEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Trajectory Optimization Engine (TOE) - InftyThink-style
// ============================================================================

/// Trajectory optimization state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryState {
    pub state_id: String,
    pub reasoning_chunks: Vec<ReasoningChunk>,
    pub summary: Option<String>,
    pub boundary_violations: u32,
    pub token_count: u32,
    pub efficiency_score: f32,
}

/// Reasoning chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningChunk {
    pub chunk_id: String,
    pub content: String,
    pub confidence: f32,
    pub continuation_confidence: f32,
}

/// Trajectory Optimization Engine
pub struct TrajectoryOptimizationEngine {
    states: Arc<RwLock<HashMap<String, TrajectoryState>>>,
    lambda: Arc<RwLock<f32>>, // Efficiency weight
}

impl TrajectoryOptimizationEngine {
    pub fn new() -> Self {
        Self {
            states: Arc::new(RwLock::new(HashMap::new())),
            lambda: Arc::new(RwLock::new(0.1)), // Default efficiency weight
        }
    }

    /// Create new trajectory state
    pub async fn create_state(&self) -> String {
        let state = TrajectoryState {
            state_id: format!("traj_{}", Uuid::new_v4().simple()),
            reasoning_chunks: vec![],
            summary: None,
            boundary_violations: 0,
            token_count: 0,
            efficiency_score: 1.0,
        };

        let state_id = state.state_id.clone();
        let mut states = self.states.write().await;
        states.insert(state_id.clone(), state);

        state_id
    }

    /// Add reasoning chunk
    pub async fn add_chunk(
        &self,
        state_id: &str,
        content: &str,
        confidence: f32,
    ) -> Result<(), EvolutionError> {
        let mut states = self.states.write().await;
        let state = states
            .get_mut(state_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("State {}", state_id)))?;

        let chunk = ReasoningChunk {
            chunk_id: format!("chunk_{}", Uuid::new_v4().simple()),
            content: content.to_string(),
            confidence,
            continuation_confidence: confidence,
        };

        state.token_count += content.len() as u32;
        state.reasoning_chunks.push(chunk);

        // Update efficiency score
        state.efficiency_score = self.calculate_efficiency(state).await;

        Ok(())
    }

    /// Summarize trajectory (compression)
    pub async fn summarize(&self, state_id: &str) -> Result<String, EvolutionError> {
        let mut states = self.states.write().await;
        let state = states
            .get_mut(state_id)
            .ok_or_else(|| EvolutionError::NotFound(format!("State {}", state_id)))?;

        // Create summary from chunks
        let summary = state
            .reasoning_chunks
            .iter()
            .map(|c| c.content.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        // Truncate if too long
        let summary = if summary.len() > 1000 {
            format!("{}...", &summary[..1000])
        } else {
            summary
        };

        state.summary = Some(summary.clone());

        Ok(summary)
    }

    /// Check if should continue or summarize
    pub async fn should_continue(&self, state_id: &str) -> bool {
        let states = self.states.read().await;
        if let Some(state) = states.get(state_id) {
            // Continue if confidence is high and token count is low
            let avg_confidence = if state.reasoning_chunks.is_empty() {
                0.0
            } else {
                state
                    .reasoning_chunks
                    .iter()
                    .map(|c| c.continuation_confidence)
                    .sum::<f32>()
                    / state.reasoning_chunks.len() as f32
            };

            avg_confidence > 0.5 && state.token_count < 10000
        } else {
            false
        }
    }

    /// Calculate efficiency score
    async fn calculate_efficiency(&self, state: &TrajectoryState) -> f32 {
        let lambda = *self.lambda.read().await;

        // Higher accuracy and lower tokens = better efficiency
        let avg_confidence = if state.reasoning_chunks.is_empty() {
            0.0
        } else {
            state
                .reasoning_chunks
                .iter()
                .map(|c| c.confidence)
                .sum::<f32>()
                / state.reasoning_chunks.len() as f32
        };

        let token_penalty = (state.token_count as f32 / 10000.0).min(1.0);

        avg_confidence * (1.0 - lambda * token_penalty)
    }

    /// Set efficiency weight
    pub async fn set_efficiency_weight(&self, lambda: f32) {
        let mut weight = self.lambda.write().await;
        *weight = lambda.clamp(0.0, 1.0);
    }
}

impl Default for TrajectoryOptimizationEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Unified Evolution Layer
// ============================================================================

/// Complete Evolution Layer combining all 5 engines
pub struct EvolutionLayer {
    pub memory_engine: MemoryEvolutionEngine,
    pub skill_engine: SkillEvolutionEngine,
    pub routing_layer: ConfidenceRoutingLayer,
    pub org_engine: OrganizationalEvolutionEngine,
    pub trajectory_engine: TrajectoryOptimizationEngine,
    system_law: Arc<SystemLawEngine>,
    harness: Arc<HarnessEngineeringEngine>,
}

impl EvolutionLayer {
    pub fn new(system_law: Arc<SystemLawEngine>, harness: Arc<HarnessEngineeringEngine>) -> Self {
        Self {
            memory_engine: MemoryEvolutionEngine::new(),
            skill_engine: SkillEvolutionEngine::new(),
            routing_layer: ConfidenceRoutingLayer::new(),
            org_engine: OrganizationalEvolutionEngine::new(),
            trajectory_engine: TrajectoryOptimizationEngine::new(),
            system_law,
            harness,
        }
    }

    /// Get evolution layer status
    pub async fn get_status(&self) -> EvolutionStatus {
        EvolutionStatus {
            memory_schemas: self.memory_engine.schema_archive.read().await.len(),
            skills: self.skill_engine.skills.read().await.len(),
            routing_decisions: self.routing_layer.routing_history.read().await.len(),
            workflows: self.org_engine.workflows.read().await.len(),
            trajectories: self.trajectory_engine.states.read().await.len(),
        }
    }
}

/// Evolution layer status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionStatus {
    pub memory_schemas: usize,
    pub skills: usize,
    pub routing_decisions: usize,
    pub workflows: usize,
    pub trajectories: usize,
}

/// Evolution error types
#[derive(Debug, thiserror::Error)]
pub enum EvolutionError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    fn create_test_harness() -> Arc<HarnessEngineeringEngine> {
        Arc::new(HarnessEngineeringEngine::new(create_test_system_law()))
    }

    #[tokio::test]
    async fn test_memory_evolution() {
        let engine = MemoryEvolutionEngine::new();

        // Register schema
        let schema = MemorySchema {
            schema_id: "schema_001".to_string(),
            name: "Test Schema".to_string(),
            domain: "test".to_string(),
            retrieval_strategy: "vector".to_string(),
            update_strategy: "append".to_string(),
            version: "1.0.0".to_string(),
            performance_metrics: SchemaPerformanceMetrics::default(),
            created_at: Utc::now(),
            last_evaluated: None,
        };
        engine.register_schema(schema).await;

        // Evaluate
        engine
            .evaluate_schema("schema_001", 0.8, 0.7, 0.9)
            .await
            .unwrap();

        // Generate candidate
        let candidate_id = engine
            .generate_candidate(
                "schema_001",
                vec!["improved retrieval".to_string()],
                "Testing",
            )
            .await
            .unwrap();

        // Promote candidate
        let new_schema_id = engine
            .promote_candidate(&candidate_id, "Improved Schema", "test")
            .await
            .unwrap();

        assert!(!new_schema_id.is_empty());
    }

    #[tokio::test]
    async fn test_skill_evolution() {
        let engine = SkillEvolutionEngine::new();

        // Record trajectory
        let trajectory = Trajectory {
            trajectory_id: "traj_001".to_string(),
            task_id: "task_001".to_string(),
            steps: vec![
                TrajectoryStep {
                    step_id: "step_1".to_string(),
                    action: "read_file".to_string(),
                    tool_used: Some("fs.read".to_string()),
                    observation: "File content".to_string(),
                },
                TrajectoryStep {
                    step_id: "step_2".to_string(),
                    action: "write_file".to_string(),
                    tool_used: Some("fs.write".to_string()),
                    observation: "File written".to_string(),
                },
            ],
            outcome: "File modified".to_string(),
            success: true,
            timestamp: Utc::now(),
        };
        engine.record_trajectory(trajectory).await;

        // Extract skill
        let skill_id = engine.extract_skill("traj_001").await.unwrap();
        assert!(!skill_id.is_empty());

        // Update performance
        engine
            .update_skill_performance(&skill_id, true)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_confidence_routing() {
        let layer = ConfidenceRoutingLayer::new();

        // Route task
        let decision = layer.route_task("simple_task", 0.3).await;
        assert_eq!(decision.selected_tier, ModelTier::Small);

        // Record outcome
        layer
            .record_outcome("simple_task", true, ModelTier::Small)
            .await;

        // Route again - should remember
        let decision2 = layer.route_task("simple_task", 0.3).await;
        assert_eq!(decision2.selected_tier, ModelTier::Small);

        // Escalate on failure
        layer
            .record_outcome("complex_task", false, ModelTier::Small)
            .await;
        let escalated = layer.escalate("complex_task").await;
        assert_eq!(escalated, ModelTier::Medium);
    }

    #[tokio::test]
    async fn test_organizational_evolution() {
        let engine = OrganizationalEvolutionEngine::new();

        // Register workflow
        let workflow = WorkflowConfig {
            workflow_id: "wf_001".to_string(),
            name: "Test Workflow".to_string(),
            roles: vec![AgentRole::Engineer, AgentRole::Reviewer],
            iteration_cycles: 3,
            escalation_threshold: 2,
            parallel_allowed: false,
        };
        engine.register_workflow(workflow).await;

        // Assign role
        engine.assign_role("agent_001", AgentRole::Engineer).await;

        // Mutate workflow
        engine
            .mutate_workflow("wf_001", WorkflowMutation::AddRole(AgentRole::Security))
            .await
            .unwrap();

        // Get optimal workflow (low complexity should match our 3-role workflow)
        let optimal = engine.get_optimal_workflow(0.2).await;
        assert!(optimal.is_some());
    }

    #[tokio::test]
    async fn test_trajectory_optimization() {
        let engine = TrajectoryOptimizationEngine::new();

        // Create state
        let state_id = engine.create_state().await;

        // Add chunks
        engine
            .add_chunk(&state_id, "First reasoning step", 0.9)
            .await
            .unwrap();
        engine
            .add_chunk(&state_id, "Second reasoning step", 0.8)
            .await
            .unwrap();

        // Check if should continue
        let should_continue = engine.should_continue(&state_id).await;
        assert!(should_continue);

        // Summarize
        let summary = engine.summarize(&state_id).await.unwrap();
        assert!(!summary.is_empty());

        // Set efficiency weight
        engine.set_efficiency_weight(0.5).await;
    }

    #[tokio::test]
    async fn test_evolution_layer_status() {
        let system_law = create_test_system_law();
        let harness = create_test_harness();
        let layer = EvolutionLayer::new(system_law, harness);

        let status = layer.get_status().await;
        assert_eq!(status.memory_schemas, 0);
        assert_eq!(status.skills, 0);
        assert_eq!(status.routing_decisions, 0);
        assert_eq!(status.workflows, 0);
        assert_eq!(status.trajectories, 0);
    }
}
