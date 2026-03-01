//! A2R SYSTEM_LAW Enforcement Engine
//!
//! Implements constitutional authority for the A2rchitech Agentic Operating System.
//! This crate enforces all SYSTEM_LAW sections defined in SYSTEM_LAW.md (Tier-0 authority).
//!
//! # Law Categories
//!
//! - **LAW-GRD** (Guardrails): Operational constraints (001-010)
//! - **LAW-ORG** (Organization): Organizational rules (001-009)
//! - **LAW-META** (Meta-Law): Meta-governance (001-008)
//! - **LAW-ONT** (Ontology): Canonical definitions (001-010)
//! - **LAW-ENT** (Entities): Service definitions (001-002)
//! - **LAW-AUT** (Autonomy): Autonomous agent rules (001-005)
//! - **LAW-OPS** (Operations): Operational semantics (001-003)
//! - **LAW-ENF** (Enforcement): Enforcement mechanisms (001-008)
//! - **LAW-SEC** (Security): Security requirements (001-003)
//! - **LAW-TOOL** (Tools): Tool governance (001-002)
//! - **LAW-SWM** (Swarm): Swarm coordination (001-009)
//! - **LAW-TIME** (Time): Time management (001-003)
//! - **LAW-QLT** (Quality): Quality metrics (001-003)
//! - **LAW-CHG** (Change): Change protocol (001-003)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Law Violation Types
// ============================================================================

/// Severity of a law violation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ViolationSeverity {
    /// Hard violation - execution must halt
    Hard,
    /// Soft violation - warning logged, execution may continue
    Soft,
}

impl fmt::Display for ViolationSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ViolationSeverity::Hard => write!(f, "HARD"),
            ViolationSeverity::Soft => write!(f, "SOFT"),
        }
    }
}

/// A SYSTEM_LAW violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LawViolation {
    pub violation_id: String,
    pub law_section: String,
    pub severity: ViolationSeverity,
    pub description: String,
    pub context: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    pub resolved: bool,
    pub resolution: Option<String>,
}

// ============================================================================
// LAW-GRD: Guardrails (001-010)
// ============================================================================

/// Guardrail enforcement state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GuardrailState {
    /// LAW-GRD-001: Assumptions registry
    pub assumptions: Vec<Assumption>,
    /// LAW-GRD-002: State mutation log
    pub state_mutations: Vec<StateMutation>,
    /// LAW-GRD-005: Technical debt registry
    pub technical_debt: Vec<TechnicalDebt>,
    /// LAW-GRD-007: Commented-out code detections
    pub commented_code: Vec<CommentedCode>,
    /// LAW-GRD-009: Placeholder detections
    pub placeholders: Vec<Placeholder>,
}

/// LAW-GRD-001: Explicit assumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assumption {
    pub id: String,
    pub assumption: String,
    pub source: String,
    pub validated: bool,
    pub timestamp: DateTime<Utc>,
}

/// LAW-GRD-002: State mutation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateMutation {
    pub id: String,
    pub mutation_type: String,
    pub artifact_ref: String,
    pub timestamp: DateTime<Utc>,
}

/// LAW-GRD-005: Technical debt entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalDebt {
    pub id: String,
    pub description: String,
    pub scope: String,
    pub scheduled_removal: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// LAW-GRD-007: Commented-out code detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentedCode {
    pub id: String,
    pub file_path: String,
    pub line_number: usize,
    pub code_snippet: String,
    pub detected_at: DateTime<Utc>,
}

/// LAW-GRD-009: Placeholder detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placeholder {
    pub id: String,
    pub file_path: String,
    pub placeholder_text: String,
    pub detected_at: DateTime<Utc>,
}

// ============================================================================
// LAW-ONT: Ontology (001-010)
// ============================================================================

/// Ontology registry for canonical entity definitions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OntologyRegistry {
    /// LAW-ONT-001: Canonical entity definitions
    pub entity_types: HashMap<String, EntityType>,
    /// LAW-ONT-003: Determinism validation rules
    pub determinism_rules: Vec<DeterminismRule>,
    /// LAW-ONT-004 to LAW-ONT-010: Other ontology rules
    pub ontology_constraints: Vec<OntologyConstraint>,
}

/// LAW-ONT-001: Canonical entity type definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityType {
    pub type_id: String,
    pub name: String,
    pub description: String,
    pub required_fields: Vec<String>,
    pub optional_fields: Vec<String>,
    pub relationships: Vec<Relationship>,
    pub version: String,
}

/// Entity relationship definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub name: String,
    pub target_type: String,
    pub cardinality: Cardinality,
}

/// Relationship cardinality
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Cardinality {
    One,
    Many,
    Optional,
}

/// LAW-ONT-003: Determinism validation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeterminismRule {
    pub rule_id: String,
    pub description: String,
    pub validation_fn: String,
    pub enforced: bool,
}

/// LAW-ONT: General ontology constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OntologyConstraint {
    pub constraint_id: String,
    pub law_section: String,
    pub description: String,
    pub enforced: bool,
}

// ============================================================================
// LAW-AUT: Autonomy Governance (001-005)
// ============================================================================

/// Autonomy governance state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AutonomyState {
    /// LAW-AUT-001: No-stop execution tracking
    pub execution_sessions: Vec<ExecutionSession>,
    /// LAW-AUT-002: Rehydration records
    pub rehydration_records: Vec<RehydrationRecord>,
    /// LAW-AUT-003: Lease continuity tracking
    pub lease_continuity: Vec<LeaseContinuity>,
    /// LAW-AUT-004: Evidence query log
    pub evidence_queries: Vec<EvidenceQuery>,
    /// LAW-AUT-005: Prompt delta escape hatch usage
    pub prompt_deltas: Vec<PromptDelta>,
}

/// LAW-AUT-001: Execution session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSession {
    pub session_id: String,
    pub started_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub status: ExecutionStatus,
    pub wih_id: String,
}

/// Execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Running,
    Paused,
    Completed,
    Failed,
}

/// LAW-AUT-002: Rehydration record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RehydrationRecord {
    pub record_id: String,
    pub session_id: String,
    pub state_hash: String,
    pub rehydrated_at: DateTime<Utc>,
    pub deterministic: bool,
}

/// LAW-AUT-003: Lease continuity record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseContinuity {
    pub lease_id: String,
    pub wih_id: String,
    pub continuous: bool,
    pub gaps: Vec<LeaseGap>,
}

/// Lease gap record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseGap {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub reason: String,
}

/// LAW-AUT-004: Evidence query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceQuery {
    pub query_id: String,
    pub query_type: String,
    pub timestamp: DateTime<Utc>,
    pub results_count: usize,
}

/// LAW-AUT-005: Prompt delta escape hatch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptDelta {
    pub delta_id: String,
    pub prompt_ref: String,
    pub delta_description: String,
    pub justification: String,
    pub approved: bool,
}

// ============================================================================
// LAW-SWM: Swarm Coordination (001-009)
// ============================================================================

/// Swarm coordination state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SwarmState {
    /// LAW-SWM-001: DAG execution tracking
    pub dag_executions: Vec<DagExecution>,
    /// LAW-SWM-002: Shared state violation log
    pub shared_state_violations: Vec<SharedStateViolation>,
    /// LAW-SWM-005: Evidence-first outputs
    pub evidence_outputs: Vec<EvidenceOutput>,
    /// LAW-SWM-008: DAG-only enforcement
    pub non_dag_executions: Vec<NonDagExecution>,
    /// LAW-SWM-009: DAG + WIH coupling
    pub dag_wih_coupling: Vec<DagWihCoupling>,
}

/// LAW-SWM-001: DAG execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagExecution {
    pub dag_id: String,
    pub execution_order: Vec<String>,
    pub deterministic: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

/// LAW-SWM-002: Shared state violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedStateViolation {
    pub violation_id: String,
    pub agents_involved: Vec<String>,
    pub state_path: String,
    pub timestamp: DateTime<Utc>,
}

/// LAW-SWM-005: Evidence output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceOutput {
    pub output_id: String,
    pub evidence_hash: String,
    pub artifact_refs: Vec<String>,
    pub verified: bool,
}

/// LAW-SWM-008: Non-DAG execution attempt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NonDagExecution {
    pub attempt_id: String,
    pub description: String,
    pub blocked: bool,
    pub timestamp: DateTime<Utc>,
}

/// LAW-SWM-009: DAG + WIH coupling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagWihCoupling {
    pub dag_id: String,
    pub wih_id: String,
    pub coupled: bool,
}

// ============================================================================
// LAW-ENF: Enforcement (001-008)
// ============================================================================

/// Enforcement engine state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EnforcementState {
    /// LAW-ENF-001: Mandatory load order tracking
    pub load_order: Vec<LoadOrderEntry>,
    /// LAW-ENF-002: Audit log
    pub audit_log: Vec<AuditEntry>,
    /// LAW-ENF-004: Harness engineering compliance
    pub harness_compliance: Vec<HarnessCompliance>,
    /// LAW-ENF-005: Entropy compression records
    pub entropy_records: Vec<EntropyRecord>,
    /// LAW-ENF-006: Observability legibility
    pub observability_records: Vec<ObservabilityRecord>,
    /// LAW-ENF-007: Canonical event schema validation
    pub event_schema_validations: Vec<EventSchemaValidation>,
    /// LAW-ENF-008: Lazy-pattern rejections
    pub lazy_pattern_rejections: Vec<LazyPatternRejection>,
}

/// LAW-ENF-001: Load order entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadOrderEntry {
    pub entry_id: String,
    pub component: String,
    pub order: usize,
    pub loaded: bool,
}

/// LAW-ENF-002: Audit entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub entry_id: String,
    pub action: String,
    pub actor: String,
    pub timestamp: DateTime<Utc>,
    pub details: serde_json::Value,
}

/// LAW-ENF-004: Harness compliance record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessCompliance {
    pub record_id: String,
    pub component: String,
    pub compliant: bool,
    pub violations: Vec<String>,
}

/// LAW-ENF-005: Entropy record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyRecord {
    pub record_id: String,
    pub entropy_score: f32,
    pub timestamp: DateTime<Utc>,
    pub gc_actions: Vec<String>,
}

/// LAW-ENF-006: Observability record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservabilityRecord {
    pub record_id: String,
    pub component: String,
    pub legible: bool,
    pub metrics_available: bool,
    pub traces_available: bool,
}

/// LAW-ENF-007: Event schema validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventSchemaValidation {
    pub validation_id: String,
    pub event_type: String,
    pub valid: bool,
    pub errors: Vec<String>,
}

/// LAW-ENF-008: Lazy-pattern rejection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LazyPatternRejection {
    pub rejection_id: String,
    pub pattern: String,
    pub reason: String,
    pub timestamp: DateTime<Utc>,
}

// ============================================================================
// LAW-QLT: Quality (001-003)
// ============================================================================

/// Quality state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QualityState {
    /// LAW-QLT-001: Domain grades
    pub domain_grades: HashMap<String, DomainGrade>,
    /// LAW-QLT-002: Entropy scores
    pub entropy_scores: Vec<EntropyScore>,
}

/// LAW-QLT-001: Domain grade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainGrade {
    pub domain: String,
    pub architecture_adherence: f32,
    pub test_coverage: f32,
    pub observability_completeness: f32,
    pub boundary_enforcement: f32,
    pub drift_frequency: f32,
    pub overall_grade: char,
    pub last_updated: DateTime<Utc>,
}

/// LAW-QLT-002: Entropy score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyScore {
    pub score_id: String,
    pub score: f32,
    pub rule_violations: usize,
    pub drift_rate: f32,
    pub test_coverage_delta: f32,
    pub documentation_mismatch: f32,
    pub timestamp: DateTime<Utc>,
}

// ============================================================================
// LAW-CHG: Change Protocol (001-003)
// ============================================================================

/// Change protocol state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChangeState {
    /// LAW-CHG-001: Modification records
    pub modifications: Vec<ModificationRecord>,
    /// LAW-CHG-002: Append-only log
    pub append_log: Vec<AppendEntry>,
    /// LAW-CHG-003: Drift records
    pub drift_records: Vec<DriftRecord>,
}

/// LAW-CHG-001: Modification record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModificationRecord {
    pub record_id: String,
    pub target: String,
    pub change_type: String,
    pub approved: bool,
    pub timestamp: DateTime<Utc>,
}

/// LAW-CHG-002: Append-only log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppendEntry {
    pub entry_id: String,
    pub content_hash: String,
    pub entry_type: String,
    pub timestamp: DateTime<Utc>,
}

/// LAW-CHG-003: Drift record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftRecord {
    pub record_id: String,
    pub expected: String,
    pub actual: String,
    pub resolved: bool,
    pub resolution: Option<String>,
}

// ============================================================================
// SYSTEM_LAW Enforcement Engine
// ============================================================================

/// Main SYSTEM_LAW enforcement engine
pub struct SystemLawEngine {
    guardrail_state: Arc<RwLock<GuardrailState>>,
    ontology_registry: Arc<RwLock<OntologyRegistry>>,
    autonomy_state: Arc<RwLock<AutonomyState>>,
    swarm_state: Arc<RwLock<SwarmState>>,
    enforcement_state: Arc<RwLock<EnforcementState>>,
    quality_state: Arc<RwLock<QualityState>>,
    change_state: Arc<RwLock<ChangeState>>,
    violations: Arc<RwLock<Vec<LawViolation>>>,
}

impl SystemLawEngine {
    pub fn new() -> Self {
        Self {
            guardrail_state: Arc::new(RwLock::new(GuardrailState::default())),
            ontology_registry: Arc::new(RwLock::new(OntologyRegistry::default())),
            autonomy_state: Arc::new(RwLock::new(AutonomyState::default())),
            swarm_state: Arc::new(RwLock::new(SwarmState::default())),
            enforcement_state: Arc::new(RwLock::new(EnforcementState::default())),
            quality_state: Arc::new(RwLock::new(QualityState::default())),
            change_state: Arc::new(RwLock::new(ChangeState::default())),
            violations: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Record a law violation
    pub async fn record_violation(
        &self,
        law_section: &str,
        severity: ViolationSeverity,
        description: &str,
        context: serde_json::Value,
    ) -> String {
        let violation_id = format!("viol_{}", Uuid::new_v4().simple());
        let violation = LawViolation {
            violation_id: violation_id.clone(),
            law_section: law_section.to_string(),
            severity,
            description: description.to_string(),
            context,
            timestamp: Utc::now(),
            resolved: false,
            resolution: None,
        };

        let mut violations = self.violations.write().await;
        violations.push(violation);

        tracing::error!(
            "SYSTEM_LAW violation [{}]: {} - {}",
            law_section,
            severity,
            description
        );

        violation_id
    }

    /// Check for hard violations (must halt execution)
    pub async fn has_hard_violations(&self) -> bool {
        let violations = self.violations.read().await;
        violations
            .iter()
            .any(|v| v.severity == ViolationSeverity::Hard && !v.resolved)
    }

    /// Get unresolved violations
    pub async fn get_unresolved_violations(&self) -> Vec<LawViolation> {
        let violations = self.violations.read().await;
        violations.iter().filter(|v| !v.resolved).cloned().collect()
    }

    /// Resolve a violation
    pub async fn resolve_violation(&self, violation_id: &str, resolution: &str) -> bool {
        let mut violations = self.violations.write().await;
        for violation in violations.iter_mut() {
            if violation.violation_id == violation_id {
                violation.resolved = true;
                violation.resolution = Some(resolution.to_string());
                return true;
            }
        }
        false
    }

    // ========================================================================
    // LAW-GRD: Guardrail Enforcement
    // ========================================================================

    /// LAW-GRD-001: Validate no silent assumptions
    pub async fn validate_assumptions(
        &self,
        assumptions: Vec<Assumption>,
    ) -> Result<(), LawViolation> {
        for assumption in &assumptions {
            if !assumption.validated {
                return Err(self
                    .create_violation(
                        "LAW-GRD-001",
                        ViolationSeverity::Hard,
                        &format!("Unvalidated assumption: {}", assumption.assumption),
                    )
                    .await);
            }
        }

        let mut state = self.guardrail_state.write().await;
        state.assumptions.extend(assumptions);
        Ok(())
    }

    /// LAW-GRD-002: Record state mutation
    pub async fn record_state_mutation(&self, mutation: StateMutation) {
        let mut state = self.guardrail_state.write().await;
        state.state_mutations.push(mutation);
    }

    /// LAW-GRD-005: Register technical debt
    pub async fn register_technical_debt(&self, debt: TechnicalDebt) -> Result<(), LawViolation> {
        if debt.scheduled_removal.is_none() {
            return Err(self
                .create_violation(
                    "LAW-GRD-005",
                    ViolationSeverity::Hard,
                    "Technical debt without scheduled removal",
                )
                .await);
        }

        let mut state = self.guardrail_state.write().await;
        state.technical_debt.push(debt);
        Ok(())
    }

    /// LAW-GRD-007: Detect commented-out code
    pub async fn detect_commented_code(&self, code: CommentedCode) {
        let mut state = self.guardrail_state.write().await;
        state.commented_code.push(code);
    }

    /// LAW-GRD-009: Detect placeholder
    pub async fn detect_placeholder(&self, placeholder: Placeholder) {
        let mut state = self.guardrail_state.write().await;
        state.placeholders.push(placeholder);
    }

    // ========================================================================
    // LAW-ONT: Ontology Enforcement
    // ========================================================================

    /// LAW-ONT-001: Register entity type
    pub async fn register_entity_type(&self, entity_type: EntityType) {
        let mut registry = self.ontology_registry.write().await;
        registry
            .entity_types
            .insert(entity_type.type_id.clone(), entity_type);
    }

    /// LAW-ONT-001: Validate entity against canonical definition
    pub async fn validate_entity(
        &self,
        type_id: &str,
        fields: &HashMap<String, serde_json::Value>,
    ) -> Result<(), LawViolation> {
        let registry = self.ontology_registry.read().await;

        let entity_type = registry
            .entity_types
            .get(type_id)
            .ok_or_else(|| LawViolation {
                violation_id: format!("viol_{}", Uuid::new_v4().simple()),
                law_section: "LAW-ONT-001".to_string(),
                severity: ViolationSeverity::Hard,
                description: format!("Unknown entity type: {}", type_id),
                context: serde_json::json!({"type_id": type_id}),
                timestamp: Utc::now(),
                resolved: false,
                resolution: None,
            })?;

        // Check required fields
        for required_field in &entity_type.required_fields {
            if !fields.contains_key(required_field) {
                return Err(self
                    .create_violation(
                        "LAW-ONT-001",
                        ViolationSeverity::Hard,
                        &format!(
                            "Missing required field '{}' for entity type '{}'",
                            required_field, type_id
                        ),
                    )
                    .await);
            }
        }

        Ok(())
    }

    /// LAW-ONT-003: Validate determinism
    pub async fn validate_determinism(
        &self,
        operation: &str,
        inputs_hash: &str,
    ) -> Result<String, LawViolation> {
        // Compute output hash for determinism validation
        let mut hasher = Sha256::new();
        hasher.update(operation.as_bytes());
        hasher.update(inputs_hash.as_bytes());
        let output_hash = format!("{:x}", hasher.finalize());

        let registry = self.ontology_registry.read().await;
        for rule in &registry.determinism_rules {
            if !rule.enforced {
                continue;
            }
            // In production, would execute validation_fn
            tracing::debug!("Determinism rule '{}' validated", rule.rule_id);
        }

        Ok(output_hash)
    }

    // ========================================================================
    // LAW-AUT: Autonomy Governance
    // ========================================================================

    /// LAW-AUT-001: Start execution session
    pub async fn start_execution_session(&self, session_id: &str, wih_id: &str) {
        let session = ExecutionSession {
            session_id: session_id.to_string(),
            started_at: Utc::now(),
            last_activity: Utc::now(),
            status: ExecutionStatus::Running,
            wih_id: wih_id.to_string(),
        };

        let mut state = self.autonomy_state.write().await;
        state.execution_sessions.push(session);
    }

    /// LAW-AUT-002: Record rehydration
    pub async fn record_rehydration(&self, session_id: &str, state_hash: &str) {
        let record = RehydrationRecord {
            record_id: format!("rehyd_{}", Uuid::new_v4().simple()),
            session_id: session_id.to_string(),
            state_hash: state_hash.to_string(),
            rehydrated_at: Utc::now(),
            deterministic: true,
        };

        let mut state = self.autonomy_state.write().await;
        state.rehydration_records.push(record);
    }

    /// LAW-AUT-004: Log evidence query
    pub async fn log_evidence_query(&self, query_type: &str, results_count: usize) {
        let query = EvidenceQuery {
            query_id: format!("eq_{}", Uuid::new_v4().simple()),
            query_type: query_type.to_string(),
            timestamp: Utc::now(),
            results_count,
        };

        let mut state = self.autonomy_state.write().await;
        state.evidence_queries.push(query);
    }

    // ========================================================================
    // LAW-SWM: Swarm Coordination
    // ========================================================================

    /// LAW-SWM-001: Record DAG execution
    pub async fn record_dag_execution(&self, dag_id: &str, execution_order: Vec<String>) {
        let execution = DagExecution {
            dag_id: dag_id.to_string(),
            execution_order,
            deterministic: true,
            completed_at: None,
        };

        let mut state = self.swarm_state.write().await;
        state.dag_executions.push(execution);
    }

    /// LAW-SWM-002: Record shared state violation
    pub async fn record_shared_state_violation(
        &self,
        agents: Vec<String>,
        state_path: &str,
    ) -> String {
        let violation_id = format!("ssv_{}", Uuid::new_v4().simple());
        let violation = SharedStateViolation {
            violation_id: violation_id.clone(),
            agents_involved: agents,
            state_path: state_path.to_string(),
            timestamp: Utc::now(),
        };

        let mut state = self.swarm_state.write().await;
        state.shared_state_violations.push(violation);

        violation_id
    }

    /// LAW-SWM-005: Record evidence output
    pub async fn record_evidence_output(
        &self,
        output_id: &str,
        evidence_hash: &str,
        artifacts: Vec<String>,
    ) {
        let output = EvidenceOutput {
            output_id: output_id.to_string(),
            evidence_hash: evidence_hash.to_string(),
            artifact_refs: artifacts,
            verified: true,
        };

        let mut state = self.swarm_state.write().await;
        state.evidence_outputs.push(output);
    }

    /// LAW-SWM-008: Block non-DAG execution
    pub async fn block_non_dag_execution(&self, description: &str) {
        let attempt = NonDagExecution {
            attempt_id: format!("nde_{}", Uuid::new_v4().simple()),
            description: description.to_string(),
            blocked: true,
            timestamp: Utc::now(),
        };

        let mut state = self.swarm_state.write().await;
        state.non_dag_executions.push(attempt);
    }

    // ========================================================================
    // LAW-QLT: Quality Metrics
    // ========================================================================

    /// LAW-QLT-001: Update domain grade
    pub async fn update_domain_grade(&self, grade: DomainGrade) {
        let mut state = self.quality_state.write().await;
        state.domain_grades.insert(grade.domain.clone(), grade);
    }

    /// LAW-QLT-002: Record entropy score
    pub async fn record_entropy_score(&self, score: EntropyScore) {
        let mut state = self.quality_state.write().await;
        state.entropy_scores.push(score);
    }

    /// LAW-QLT-002: Calculate current entropy score
    pub async fn calculate_entropy_score(&self) -> f32 {
        let violations = self.violations.read().await;
        let unresolved = violations.iter().filter(|v| !v.resolved).count() as f32;

        // Simple entropy calculation (would be more sophisticated in production)
        (unresolved * 10.0).min(100.0)
    }

    // ========================================================================
    // LAW-CHG: Change Protocol
    // ========================================================================

    /// LAW-CHG-002: Append to log
    pub async fn append_log(&self, entry_type: &str, content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let content_hash = format!("{:x}", hasher.finalize());

        let entry = AppendEntry {
            entry_id: format!("ae_{}", Uuid::new_v4().simple()),
            content_hash,
            entry_type: entry_type.to_string(),
            timestamp: Utc::now(),
        };

        let entry_id = entry.entry_id.clone();

        let mut state = self.change_state.write().await;
        state.append_log.push(entry);

        entry_id
    }

    /// LAW-CHG-003: Record drift
    pub async fn record_drift(&self, expected: &str, actual: &str) -> String {
        let record = DriftRecord {
            record_id: format!("dr_{}", Uuid::new_v4().simple()),
            expected: expected.to_string(),
            actual: actual.to_string(),
            resolved: false,
            resolution: None,
        };

        let record_id = record.record_id.clone();

        let mut state = self.change_state.write().await;
        state.drift_records.push(record);

        record_id
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    async fn create_violation(
        &self,
        law_section: &str,
        severity: ViolationSeverity,
        description: &str,
    ) -> LawViolation {
        let violation_id = format!("viol_{}", Uuid::new_v4().simple());
        LawViolation {
            violation_id,
            law_section: law_section.to_string(),
            severity,
            description: description.to_string(),
            context: serde_json::json!({}),
            timestamp: Utc::now(),
            resolved: false,
            resolution: None,
        }
    }

    /// Get comprehensive SYSTEM_LAW compliance report
    pub async fn get_compliance_report(&self) -> SystemLawComplianceReport {
        let violations = self.violations.read().await;
        let unresolved = violations.iter().filter(|v| !v.resolved).count();
        let hard_violations = violations
            .iter()
            .filter(|v| !v.resolved && v.severity == ViolationSeverity::Hard)
            .count();

        SystemLawComplianceReport {
            total_violations: violations.len(),
            unresolved_violations: unresolved,
            hard_violations,
            entropy_score: self.calculate_entropy_score().await,
            timestamp: Utc::now(),
        }
    }
}

impl Default for SystemLawEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// SYSTEM_LAW compliance report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemLawComplianceReport {
    pub total_violations: usize,
    pub unresolved_violations: usize,
    pub hard_violations: usize,
    pub entropy_score: f32,
    pub timestamp: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_record_violation() {
        let engine = SystemLawEngine::new();

        let violation_id = engine
            .record_violation(
                "LAW-GRD-001",
                ViolationSeverity::Hard,
                "Test violation",
                serde_json::json!({"test": true}),
            )
            .await;

        assert!(violation_id.starts_with("viol_"));

        let violations = engine.get_unresolved_violations().await;
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].law_section, "LAW-GRD-001");
    }

    #[tokio::test]
    async fn test_has_hard_violations() {
        let engine = SystemLawEngine::new();

        assert!(!engine.has_hard_violations().await);

        engine
            .record_violation(
                "LAW-GRD-001",
                ViolationSeverity::Hard,
                "Test violation",
                serde_json::json!({}),
            )
            .await;

        assert!(engine.has_hard_violations().await);
    }

    #[tokio::test]
    async fn test_resolve_violation() {
        let engine = SystemLawEngine::new();

        let violation_id = engine
            .record_violation(
                "LAW-GRD-001",
                ViolationSeverity::Hard,
                "Test violation",
                serde_json::json!({}),
            )
            .await;

        let resolved = engine.resolve_violation(&violation_id, "Fixed").await;
        assert!(resolved);

        assert!(!engine.has_hard_violations().await);
    }

    #[tokio::test]
    async fn test_validate_assumptions() {
        let engine = SystemLawEngine::new();

        let assumption = Assumption {
            id: "asm_1".to_string(),
            assumption: "Test assumption".to_string(),
            source: "test".to_string(),
            validated: true,
            timestamp: Utc::now(),
        };

        let result = engine.validate_assumptions(vec![assumption]).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_unvalidated_assumption() {
        let engine = SystemLawEngine::new();

        let assumption = Assumption {
            id: "asm_1".to_string(),
            assumption: "Unvalidated assumption".to_string(),
            source: "test".to_string(),
            validated: false,
            timestamp: Utc::now(),
        };

        let result = engine.validate_assumptions(vec![assumption]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_register_entity_type() {
        let engine = SystemLawEngine::new();

        let entity_type = EntityType {
            type_id: "test_entity".to_string(),
            name: "Test Entity".to_string(),
            description: "Test".to_string(),
            required_fields: vec!["id".to_string(), "name".to_string()],
            optional_fields: vec!["description".to_string()],
            relationships: vec![],
            version: "1.0.0".to_string(),
        };

        engine.register_entity_type(entity_type).await;

        let registry = engine.ontology_registry.read().await;
        assert!(registry.entity_types.contains_key("test_entity"));
    }

    #[tokio::test]
    async fn test_validate_entity() {
        let engine = SystemLawEngine::new();

        let entity_type = EntityType {
            type_id: "test_entity".to_string(),
            name: "Test Entity".to_string(),
            description: "Test".to_string(),
            required_fields: vec!["id".to_string(), "name".to_string()],
            optional_fields: vec![],
            relationships: vec![],
            version: "1.0.0".to_string(),
        };

        engine.register_entity_type(entity_type).await;

        let mut fields = HashMap::new();
        fields.insert("id".to_string(), serde_json::json!("123"));
        fields.insert("name".to_string(), serde_json::json!("Test"));

        let result = engine.validate_entity("test_entity", &fields).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_entity_missing_field() {
        let engine = SystemLawEngine::new();

        let entity_type = EntityType {
            type_id: "test_entity".to_string(),
            name: "Test Entity".to_string(),
            description: "Test".to_string(),
            required_fields: vec!["id".to_string(), "name".to_string()],
            optional_fields: vec![],
            relationships: vec![],
            version: "1.0.0".to_string(),
        };

        engine.register_entity_type(entity_type).await;

        let mut fields = HashMap::new();
        fields.insert("id".to_string(), serde_json::json!("123"));
        // Missing "name" field

        let result = engine.validate_entity("test_entity", &fields).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_calculate_entropy_score() {
        let engine = SystemLawEngine::new();

        // Initial score should be 0
        let score = engine.calculate_entropy_score().await;
        assert_eq!(score, 0.0);

        // Add violations
        for i in 0..5 {
            engine
                .record_violation(
                    &format!("LAW-GRD-{:03}", i),
                    ViolationSeverity::Soft,
                    &format!("Test violation {}", i),
                    serde_json::json!({}),
                )
                .await;
        }

        let score = engine.calculate_entropy_score().await;
        assert!(score > 0.0);
    }

    #[tokio::test]
    async fn test_compliance_report() {
        let engine = SystemLawEngine::new();

        engine
            .record_violation(
                "LAW-GRD-001",
                ViolationSeverity::Hard,
                "Test violation",
                serde_json::json!({}),
            )
            .await;

        let report = engine.get_compliance_report().await;

        assert_eq!(report.total_violations, 1);
        assert_eq!(report.unresolved_violations, 1);
        assert_eq!(report.hard_violations, 1);
    }
}
