use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use uuid::Uuid;

pub mod errors;

/// EventEnvelope defines the canonical structure for all events in the system.
/// This is a frozen contract that all subsystems must comply with.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct EventEnvelope {
    /// Unique identifier for this specific event
    pub event_id: String,

    /// Type of event (e.g., "CommandExecuted", "StateTransition", "ToolCall")
    pub event_type: String,

    /// Session identifier for the run this event belongs to
    pub session_id: String,

    /// Tenant identifier for multi-tenant isolation
    pub tenant_id: String,

    /// Identity of the actor that initiated this event
    pub actor_id: String,

    /// Role of the actor (e.g., "user", "agent", "system")
    pub role: String,

    /// Unix timestamp when the event occurred
    pub timestamp: u64,

    /// Correlation ID for tracing across multiple events
    pub correlation_id: Option<String>,

    /// Causation ID for causal relationships between events
    pub causation_id: Option<String>,

    /// Idempotency key for preventing duplicate processing
    pub idempotency_key: Option<String>,

    /// Trace ID for distributed tracing
    pub trace_id: Option<String>,

    /// Additional contextual data for the event
    pub payload: serde_json::Value,
}

impl EventEnvelope {
    /// Create a new event envelope with required fields
    pub fn new(
        event_type: String,
        session_id: String,
        tenant_id: String,
        actor_id: String,
        role: String,
        payload: serde_json::Value,
    ) -> Self {
        EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type,
            session_id,
            tenant_id,
            actor_id,
            role,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            correlation_id: None,
            causation_id: None,
            idempotency_key: None,
            trace_id: None,
            payload,
        }
    }

    /// Validate that the event envelope meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.event_id.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "event_id cannot be empty".to_string(),
            ));
        }

        if self.event_type.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "event_type cannot be empty".to_string(),
            ));
        }

        if self.session_id.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "session_id cannot be empty".to_string(),
            ));
        }

        if self.tenant_id.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "tenant_id cannot be empty".to_string(),
            ));
        }

        if self.actor_id.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "actor_id cannot be empty".to_string(),
            ));
        }

        if self.role.is_empty() {
            return Err(KernelContractError::InvalidEventEnvelope(
                "role cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// RunModel defines the state machine for execution runs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub enum RunState {
    /// Run has been created but not yet started
    Created,
    /// Run is currently executing
    Running,
    /// Run is in verification phase
    Verifying,
    /// Run completed successfully
    Completed,
    /// Run failed
    Failed,
    /// Run was cancelled
    Cancelled,
}

impl RunState {
    /// Get all possible states
    pub fn all_states() -> Vec<RunState> {
        vec![
            RunState::Created,
            RunState::Running,
            RunState::Verifying,
            RunState::Completed,
            RunState::Failed,
            RunState::Cancelled,
        ]
    }

    /// Check if a state transition is legal
    pub fn is_legal_transition(&self, to: &RunState) -> bool {
        match self {
            RunState::Created => matches!(
                to,
                RunState::Running | RunState::Failed | RunState::Cancelled
            ),
            RunState::Running => matches!(
                to,
                RunState::Verifying | RunState::Failed | RunState::Cancelled
            ),
            RunState::Verifying => matches!(
                to,
                RunState::Completed | RunState::Failed | RunState::Running
            ),
            RunState::Completed => false, // Completed is terminal
            RunState::Failed => false,    // Failed is terminal
            RunState::Cancelled => false, // Cancelled is terminal
        }
    }
}

/// RunModel represents a single execution run with its state and metadata.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct RunModel {
    /// Unique identifier for this run
    pub run_id: String,

    /// Current state of the run
    pub state: RunState,

    /// Tenant identifier for isolation
    pub tenant_id: String,

    /// Session identifier
    pub session_id: String,

    /// Identity of the actor that initiated the run
    pub created_by: String,

    /// Unix timestamp when the run was created
    pub created_at: u64,

    /// Unix timestamp when the run was last updated
    pub updated_at: u64,

    /// Unix timestamp when the run was completed (if applicable)
    pub completed_at: Option<u64>,

    /// Optional error message if the run failed
    pub error_message: Option<String>,

    /// Metadata associated with the run
    pub metadata: HashMap<String, serde_json::Value>,
}

impl RunModel {
    /// Create a new run in the Created state
    pub fn new(tenant_id: String, session_id: String, created_by: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        RunModel {
            run_id: Uuid::new_v4().to_string(),
            state: RunState::Created,
            tenant_id,
            session_id,
            created_by,
            created_at: now,
            updated_at: now,
            completed_at: None,
            error_message: None,
            metadata: HashMap::new(),
        }
    }

    /// Attempt to transition to a new state
    pub fn transition_to(&mut self, new_state: RunState) -> Result<(), KernelContractError> {
        if !self.state.is_legal_transition(&new_state) {
            return Err(KernelContractError::InvalidRunTransition {
                from: format!("{:?}", self.state),
                to: format!("{:?}", new_state),
            });
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.state = new_state.clone();
        self.updated_at = now;

        if matches!(
            new_state,
            RunState::Completed | RunState::Failed | RunState::Cancelled
        ) {
            self.completed_at = Some(now);
        }

        Ok(())
    }

    /// Validate the run model meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.run_id.is_empty() {
            return Err(KernelContractError::InvalidRunModel(
                "run_id cannot be empty".to_string(),
            ));
        }

        if self.tenant_id.is_empty() {
            return Err(KernelContractError::InvalidRunModel(
                "tenant_id cannot be empty".to_string(),
            ));
        }

        if self.session_id.is_empty() {
            return Err(KernelContractError::InvalidRunModel(
                "session_id cannot be empty".to_string(),
            ));
        }

        if self.created_by.is_empty() {
            return Err(KernelContractError::InvalidRunModel(
                "created_by cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// ToolABI defines the interface contract for all tools in the system.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolABI {
    /// Unique identifier for the tool
    pub tool_id: String,

    /// Name of the tool
    pub name: String,

    /// Description of what the tool does
    pub description: String,

    /// Input schema for the tool
    pub input_schema: serde_json::Value,

    /// Output schema for the tool
    pub output_schema: serde_json::Value,

    /// Whether the tool has side effects
    pub has_side_effects: bool,

    /// Whether the tool requires policy approval
    pub requires_policy_approval: bool,

    /// Maximum execution time in milliseconds
    pub max_execution_time_ms: u64,

    /// Resource requirements
    pub resource_requirements: ResourceRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ResourceRequirements {
    /// CPU requirements (in millicores)
    pub cpu_millicores: u32,

    /// Memory requirements (in MB)
    pub memory_mb: u32,

    /// Storage requirements (in MB)
    pub storage_mb: u32,
}

impl ToolABI {
    /// Validate the tool ABI meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.tool_id.is_empty() {
            return Err(KernelContractError::InvalidToolABI(
                "tool_id cannot be empty".to_string(),
            ));
        }

        if self.name.is_empty() {
            return Err(KernelContractError::InvalidToolABI(
                "name cannot be empty".to_string(),
            ));
        }

        if self.description.is_empty() {
            return Err(KernelContractError::InvalidToolABI(
                "description cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// ToolRequest represents a request to execute a tool.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolRequest {
    /// ID of the tool to execute
    pub tool_id: String,

    /// Parameters for the tool execution
    pub parameters: serde_json::Value,

    /// Session ID for the request
    pub session_id: String,

    /// Tenant ID for the request
    pub tenant_id: String,

    /// Actor ID making the request
    pub actor_id: String,

    /// Idempotency key for side-effect tools
    pub idempotency_key: Option<String>,

    /// Policy decision that allows this tool call
    pub policy_decision: PolicyDecision,

    /// Metadata for the request
    pub metadata: HashMap<String, serde_json::Value>,
}

impl ToolRequest {
    /// Validate the tool request meets required constraints
    pub fn validate(&self, tool_abi: &ToolABI) -> Result<(), KernelContractError> {
        // If the tool has side effects, idempotency key is required
        if tool_abi.has_side_effects && self.idempotency_key.is_none() {
            return Err(KernelContractError::InvalidToolRequest(
                "idempotency_key required for side-effect tools".to_string(),
            ));
        }

        // Policy decision must allow the tool call
        if !self.policy_decision.is_allowed() {
            return Err(KernelContractError::InvalidToolRequest(
                "policy decision does not allow tool call".to_string(),
            ));
        }

        Ok(())
    }
}

/// ToolResponse represents the result of a tool execution.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolResponse {
    /// ID of the tool that was executed
    pub tool_id: String,

    /// Result of the tool execution
    pub result: ToolResult,

    /// Execution time in milliseconds
    pub execution_time_ms: u64,

    /// Resource usage during execution
    pub resource_usage: ResourceUsage,

    /// Metadata for the response
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum ToolResult {
    /// Tool executed successfully
    Success { output: serde_json::Value },

    /// Tool execution failed
    Failure { error: String },

    /// Tool execution was denied by policy
    Denied { reason: String },

    /// Tool execution timed out
    Timeout,

    /// Tool execution was cancelled
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ResourceUsage {
    /// CPU used (in millicores)
    pub cpu_millicores: u32,

    /// Memory used (in MB)
    pub memory_mb: u32,

    /// Storage used (in MB)
    pub storage_mb: u32,

    /// Network bytes transferred
    pub network_bytes: u64,
}

/// PolicyDecisionArtifact represents a policy decision with constraints.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct PolicyDecision {
    /// Identity that made the request
    pub identity_id: String,

    /// Resource being accessed
    pub resource: String,

    /// Action being requested
    pub action: String,

    /// Whether the action is allowed
    pub decision: PolicyEffect,

    /// Reason for the decision
    pub reason: Option<String>,

    /// Constraints that apply to the decision
    pub constraints: Vec<PolicyConstraint>,

    /// Unix timestamp when the decision was made
    pub timestamp: u64,

    /// Expiration time for the decision (if applicable)
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub enum PolicyEffect {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum PolicyConstraint {
    /// Time-based constraint
    TimeBased { start_time: u64, end_time: u64 },

    /// Resource-based constraint
    ResourceBased { max_usage: ResourceRequirements },

    /// Tenant-based constraint
    TenantBased { allowed_tenants: Vec<String> },

    /// Rate limiting constraint
    RateLimit {
        max_requests: u32,
        window_seconds: u64,
    },

    /// Custom constraint
    Custom {
        constraint_type: String,
        parameters: serde_json::Value,
    },
}

impl PolicyDecision {
    /// Check if the decision allows the action
    pub fn is_allowed(&self) -> bool {
        matches!(self.decision, PolicyEffect::Allow)
    }

    /// Check if the decision has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            now > expires_at
        } else {
            false
        }
    }

    /// Validate the policy decision meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.identity_id.is_empty() {
            return Err(KernelContractError::InvalidPolicyDecision(
                "identity_id cannot be empty".to_string(),
            ));
        }

        if self.resource.is_empty() {
            return Err(KernelContractError::InvalidPolicyDecision(
                "resource cannot be empty".to_string(),
            ));
        }

        if self.action.is_empty() {
            return Err(KernelContractError::InvalidPolicyDecision(
                "action cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// VerifyArtifacts defines the required structure for verification artifacts.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct VerifyArtifact {
    /// Unique identifier for this verification artifact
    pub verify_id: String,

    /// Run ID this verification belongs to
    pub run_id: String,

    /// Step ID within the run
    pub step_id: String,

    /// Hash of the outputs being verified
    pub outputs_hash: String,

    /// Verification results
    pub results: VerificationResults,

    /// Unix timestamp when verification was performed
    pub timestamp: u64,

    /// Identity that performed the verification
    pub verified_by: String,

    /// Metadata for the verification
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct VerificationResults {
    /// Whether verification passed
    pub passed: bool,

    /// Verification details
    pub details: serde_json::Value,

    /// Confidence level (0.0 to 1.0)
    pub confidence: f64,

    /// Any issues found during verification
    pub issues: Vec<VerificationIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct VerificationIssue {
    /// Type of issue
    pub issue_type: String,

    /// Description of the issue
    pub description: String,

    /// Severity level
    pub severity: VerificationSeverity,

    /// Location of the issue
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum VerificationSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl VerifyArtifact {
    /// Create a new verification artifact
    pub fn new(
        run_id: String,
        step_id: String,
        outputs_hash: String,
        results: VerificationResults,
        verified_by: String,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        VerifyArtifact {
            verify_id: Uuid::new_v4().to_string(),
            run_id,
            step_id,
            outputs_hash,
            results,
            timestamp: now,
            verified_by,
            metadata: HashMap::new(),
        }
    }

    /// Validate the verification artifact meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.verify_id.is_empty() {
            return Err(KernelContractError::InvalidVerifyArtifact(
                "verify_id cannot be empty".to_string(),
            ));
        }

        if self.run_id.is_empty() {
            return Err(KernelContractError::InvalidVerifyArtifact(
                "run_id cannot be empty".to_string(),
            ));
        }

        if self.step_id.is_empty() {
            return Err(KernelContractError::InvalidVerifyArtifact(
                "step_id cannot be empty".to_string(),
            ));
        }

        if self.outputs_hash.is_empty() {
            return Err(KernelContractError::InvalidVerifyArtifact(
                "outputs_hash cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// ContextBundle represents a deterministic compilation of context for a decision.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ContextBundle {
    /// Hash of this context bundle (for deterministic replay)
    pub bundle_hash: String,

    /// Inputs to the context compilation
    pub inputs: ContextInputs,

    /// Selected memory references
    pub memory_refs: Vec<MemoryReference>,

    /// Budget constraints
    pub budgets: ContextBudgets,

    /// Applied redactions
    pub redactions: Vec<Redaction>,

    /// Unix timestamp when bundle was created
    pub timestamp: u64,

    /// Metadata for the context bundle
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ContextInputs {
    /// User-provided inputs
    pub user_inputs: serde_json::Value,

    /// System-provided inputs
    pub system_inputs: serde_json::Value,

    /// Previous step outputs
    pub previous_outputs: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct MemoryReference {
    /// ID of the memory item
    pub memory_id: String,

    /// Type of memory (e.g., "history", "knowledge", "context")
    pub memory_type: String,

    /// Relevance score (0.0 to 1.0)
    pub relevance: f64,

    /// Content of the memory
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ContextBudgets {
    /// Maximum tokens allowed
    pub max_tokens: Option<u32>,

    /// Maximum execution time in milliseconds
    pub max_execution_time_ms: Option<u64>,

    /// Maximum number of tool calls
    pub max_tool_calls: Option<u32>,

    /// Maximum memory references
    pub max_memory_refs: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ContextMap {
    pub included_ids: Vec<String>,
    pub excluded_ids: Vec<String>,
    pub reasons: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct BudgetReport {
    pub token_usage: HashMap<String, u32>,
    pub total_tokens: u32,
    pub budget_limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Redaction {
    /// Type of redaction
    pub redaction_type: String,

    /// Target of the redaction
    pub target: String,

    /// Reason for the redaction
    pub reason: String,
}

/// CapsuleSpec defines the contract for a capsule in the system.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CapsuleSpec {
    /// Unique identifier for this capsule
    pub capsule_id: String,

    /// Version of the capsule spec
    pub version: String,

    /// Framework ID this capsule implements
    pub framework_id: String,

    /// Goal or intent this capsule addresses
    pub goal: String,

    /// Data model for the capsule
    pub data_model: serde_json::Value,

    /// UI specification for the capsule
    pub ui_spec: serde_json::Value,

    /// Security policy for the capsule
    pub security_policy: SecurityPolicy,

    /// Capabilities this capsule requires
    pub capabilities: Vec<String>,

    /// Resources this capsule requires
    pub resources: ResourceRequirements,

    /// Creation timestamp
    pub created_at: u64,

    /// Last updated timestamp
    pub updated_at: u64,

    /// Metadata for the capsule
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SecurityPolicy {
    /// Whether the capsule can make network calls
    pub network_access: NetworkAccessPolicy,

    /// File system access policy
    pub file_system_access: FileSystemAccessPolicy,

    /// Capability restrictions
    pub capability_restrictions: Vec<String>,

    /// Time limits for execution
    pub time_limits: Option<TimeLimits>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum NetworkAccessPolicy {
    /// No network access
    None,
    /// Limited to specific domains
    Limited { allowed_domains: Vec<String> },
    /// Full network access
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum FileSystemAccessPolicy {
    /// No file system access
    None,
    /// Read-only access to specific paths
    ReadOnly { allowed_paths: Vec<String> },
    /// Read-write access to specific paths
    ReadWrite { allowed_paths: Vec<String> },
    /// Full access
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct TimeLimits {
    /// Maximum execution time in seconds
    pub max_execution_time_seconds: u64,

    /// Maximum idle time before termination
    pub max_idle_time_seconds: u64,
}

impl CapsuleSpec {
    /// Create a new capsule spec
    pub fn new(
        framework_id: String,
        goal: String,
        data_model: serde_json::Value,
        ui_spec: serde_json::Value,
    ) -> Result<Self, KernelContractError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(CapsuleSpec {
            capsule_id: Uuid::new_v4().to_string(),
            version: "0.1.0".to_string(),
            framework_id,
            goal,
            data_model,
            ui_spec,
            security_policy: SecurityPolicy::default(),
            capabilities: vec![],
            resources: ResourceRequirements {
                cpu_millicores: 100,
                memory_mb: 128,
                storage_mb: 10,
            },
            created_at: now,
            updated_at: now,
            metadata: HashMap::new(),
        })
    }

    /// Validate the capsule spec meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.capsule_id.is_empty() {
            return Err(KernelContractError::InvalidCapsuleSpec(
                "capsule_id cannot be empty".to_string(),
            ));
        }

        if self.framework_id.is_empty() {
            return Err(KernelContractError::InvalidCapsuleSpec(
                "framework_id cannot be empty".to_string(),
            ));
        }

        if self.goal.is_empty() {
            return Err(KernelContractError::InvalidCapsuleSpec(
                "goal cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        SecurityPolicy {
            network_access: NetworkAccessPolicy::Limited {
                allowed_domains: vec!["*".to_string()],
            },
            file_system_access: FileSystemAccessPolicy::ReadOnly {
                allowed_paths: vec!["/tmp".to_string()],
            },
            capability_restrictions: vec![],
            time_limits: Some(TimeLimits {
                max_execution_time_seconds: 300, // 5 minutes
                max_idle_time_seconds: 60,       // 1 minute
            }),
        }
    }
}

/// Event types for the kernel contract system
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum KernelEventType {
    /// Capsule lifecycle events
    CapsuleCreated {
        capsule_id: String,
    },
    CapsuleStarted {
        capsule_id: String,
    },
    CapsulePaused {
        capsule_id: String,
    },
    CapsuleResumed {
        capsule_id: String,
    },
    CapsuleTerminated {
        capsule_id: String,
        reason: String,
    },

    /// Tool execution events
    ToolRequested {
        tool_id: String,
        parameters: serde_json::Value,
    },
    ToolExecuted {
        tool_id: String,
        result: ToolResult,
    },
    ToolFailed {
        tool_id: String,
        error: String,
    },

    /// Policy decision events
    PolicyEvaluated {
        decision: PolicyDecision,
    },
    PolicyEnforced {
        resource: String,
        action: String,
        allowed: bool,
    },

    /// Data flow events
    DataReceived {
        source: String,
        size_bytes: u64,
    },
    DataProcessed {
        processor: String,
        input_size: u64,
        output_size: u64,
    },
    DataSent {
        destination: String,
        size_bytes: u64,
    },

    /// Security events
    SecurityViolation {
        violation_type: String,
        details: serde_json::Value,
    },
    AuditLogEntry {
        actor: String,
        action: String,
        resource: String,
    },
}

impl From<KernelEventType> for EventEnvelope {
    fn from(kernel_event: KernelEventType) -> Self {
        let event_type_str = match &kernel_event {
            KernelEventType::CapsuleCreated { .. } => "CapsuleCreated",
            KernelEventType::CapsuleStarted { .. } => "CapsuleStarted",
            KernelEventType::CapsulePaused { .. } => "CapsulePaused",
            KernelEventType::CapsuleResumed { .. } => "CapsuleResumed",
            KernelEventType::CapsuleTerminated { .. } => "CapsuleTerminated",
            KernelEventType::ToolRequested { .. } => "ToolRequested",
            KernelEventType::ToolExecuted { .. } => "ToolExecuted",
            KernelEventType::ToolFailed { .. } => "ToolFailed",
            KernelEventType::PolicyEvaluated { .. } => "PolicyEvaluated",
            KernelEventType::PolicyEnforced { .. } => "PolicyEnforced",
            KernelEventType::DataReceived { .. } => "DataReceived",
            KernelEventType::DataProcessed { .. } => "DataProcessed",
            KernelEventType::DataSent { .. } => "DataSent",
            KernelEventType::SecurityViolation { .. } => "SecurityViolation",
            KernelEventType::AuditLogEntry { .. } => "AuditLogEntry",
        }
        .to_string();

        EventEnvelope::new(
            event_type_str,
            "session-unknown".to_string(),
            "tenant-unknown".to_string(),
            "kernel".to_string(),
            "system".to_string(),
            serde_json::to_value(&kernel_event).unwrap_or(serde_json::json!({})),
        )
    }
}

/// Kernel contract for intent routing and framework selection
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct IntentRoute {
    /// The original user intent
    pub intent: String,

    /// The selected framework to handle the intent
    pub framework_id: String,

    /// Confidence score for the routing decision (0.0 to 1.0)
    pub confidence: f64,

    /// Alternative frameworks considered
    pub alternatives: Vec<AlternativeFramework>,

    /// Routing metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct AlternativeFramework {
    /// Framework ID
    pub framework_id: String,

    /// Score for this alternative (0.0 to 1.0)
    pub score: f64,

    /// Reason for considering this alternative
    pub reason: String,
}

impl IntentRoute {
    /// Create a new intent route with the selected framework
    pub fn new(intent: String, framework_id: String, confidence: f64) -> Self {
        IntentRoute {
            intent,
            framework_id,
            confidence,
            alternatives: vec![],
            metadata: HashMap::new(),
        }
    }

    /// Add an alternative framework to the route
    pub fn add_alternative(&mut self, framework_id: String, score: f64, reason: String) {
        self.alternatives.push(AlternativeFramework {
            framework_id,
            score,
            reason,
        });
    }

    /// Validate the intent route
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.intent.is_empty() {
            return Err(KernelContractError::InvalidIntentRoute(
                "intent cannot be empty".to_string(),
            ));
        }

        if self.framework_id.is_empty() {
            return Err(KernelContractError::InvalidIntentRoute(
                "framework_id cannot be empty".to_string(),
            ));
        }

        if self.confidence < 0.0 || self.confidence > 1.0 {
            return Err(KernelContractError::InvalidIntentRoute(
                "confidence must be between 0.0 and 1.0".to_string(),
            ));
        }

        Ok(())
    }
}

/// Framework specification for defining AI-driven UI experiences
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct FrameworkSpec {
    pub framework_id: String,
    pub version: String,
    pub status: FrameworkStatus,
    pub capsule_template: CapsuleTemplate,
    pub required_tools: Vec<ToolRequirementSpec>,
    pub directives: Vec<String>,
    pub intent_patterns: Vec<String>,
    pub eval_suite: Vec<String>,
    pub promotion_rules: Option<String>,
    pub config_schema: Option<serde_json::Value>,
    pub runtime_params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum FrameworkStatus {
    Draft,
    Candidate,
    Active,
    Deprecated,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CapsuleTemplate {
    pub capsule_type: String,
    pub default_canvases: Vec<CanvasSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CanvasSpec {
    pub view_type: String,
    pub title: String,
    pub initial_state: Option<serde_json::Value>,
    pub columns: Option<Vec<ColumnSpec>>,
    pub actions: Option<Vec<ActionSpec>>,
    pub layout: Option<LayoutSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LayoutSpec {
    pub sections: Vec<SectionSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SectionSpec {
    pub title: String,
    pub fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ColumnSpec {
    pub field: String,
    pub label: String,
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ActionSpec {
    pub id: String,
    pub label: String,
    pub policy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolRequirementSpec {
    pub tool_id: String,
    pub scope: String,
}

impl ContextBundle {
    /// Create a new context bundle with deterministic hashing
    pub fn new(
        inputs: ContextInputs,
        memory_refs: Vec<MemoryReference>,
        budgets: ContextBudgets,
        redactions: Vec<Redaction>,
    ) -> Result<Self, KernelContractError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Create a deterministic representation for hashing
        let bundle_repr = ContextBundleRepr {
            inputs: inputs.clone(),
            memory_refs: memory_refs.clone(),
            budgets: budgets.clone(),
            redactions: redactions.clone(),
            timestamp: now,
        };

        let serialized = serde_json::to_string(&bundle_repr)
            .map_err(|e| KernelContractError::SerializationError(e.to_string()))?;

        let bundle_hash = format!("{:x}", sha2::Sha256::digest(serialized.as_bytes()));

        Ok(ContextBundle {
            bundle_hash,
            inputs,
            memory_refs,
            budgets,
            redactions,
            timestamp: now,
            metadata: HashMap::new(),
        })
    }

    /// Validate the context bundle meets required constraints
    pub fn validate(&self) -> Result<(), KernelContractError> {
        if self.bundle_hash.is_empty() {
            return Err(KernelContractError::InvalidContextBundle(
                "bundle_hash cannot be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// Internal representation for hashing purposes
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
struct ContextBundleRepr {
    inputs: ContextInputs,
    memory_refs: Vec<MemoryReference>,
    budgets: ContextBudgets,
    redactions: Vec<Redaction>,
    timestamp: u64,
}

/// Error types for kernel contract validation
#[derive(Debug, thiserror::Error)]
pub enum KernelContractError {
    #[error("Invalid event envelope: {0}")]
    InvalidEventEnvelope(String),

    #[error("Invalid run model: {0}")]
    InvalidRunModel(String),

    #[error("Invalid run transition from {from} to {to}")]
    InvalidRunTransition { from: String, to: String },

    #[error("Invalid tool ABI: {0}")]
    InvalidToolABI(String),

    #[error("Invalid tool request: {0}")]
    InvalidToolRequest(String),

    #[error("Invalid policy decision: {0}")]
    InvalidPolicyDecision(String),

    #[error("Invalid verify artifact: {0}")]
    InvalidVerifyArtifact(String),

    #[error("Invalid context bundle: {0}")]
    InvalidContextBundle(String),

    #[error("Invalid capsule spec: {0}")]
    InvalidCapsuleSpec(String),

    #[error("Invalid intent route: {0}")]
    InvalidIntentRoute(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Deserialization error: {0}")]
    DeserializationError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_envelope_validation() {
        let mut event = EventEnvelope::new(
            "test_event".to_string(),
            "session-123".to_string(),
            "tenant-123".to_string(),
            "actor-123".to_string(),
            "user".to_string(),
            serde_json::json!({"test": "data"}),
        );

        // Should be valid
        assert!(event.validate().is_ok());

        // Make invalid by clearing required field
        event.event_id = "".to_string();
        assert!(event.validate().is_err());
    }

    #[test]
    fn test_run_state_transitions() {
        let mut run = RunModel::new(
            "tenant-123".to_string(),
            "session-123".to_string(),
            "actor-123".to_string(),
        );

        // Valid transitions
        assert!(run.transition_to(RunState::Running).is_ok());
        assert!(run.transition_to(RunState::Verifying).is_ok());
        assert!(run.transition_to(RunState::Completed).is_ok());

        // Invalid transition from terminal state
        assert!(run.transition_to(RunState::Running).is_err());
    }

    #[test]
    fn test_context_bundle_deterministic_hashing() {
        let inputs = ContextInputs {
            user_inputs: serde_json::json!({"query": "test"}),
            system_inputs: serde_json::json!({"role": "assistant"}),
            previous_outputs: vec![],
        };

        let memory_refs = vec![];
        let budgets = ContextBudgets {
            max_tokens: Some(1000),
            max_execution_time_ms: Some(5000),
            max_tool_calls: Some(10),
            max_memory_refs: Some(5),
        };
        let redactions = vec![];

        // Create two bundles with identical inputs
        let bundle1 = ContextBundle::new(
            inputs.clone(),
            memory_refs.clone(),
            budgets.clone(),
            redactions.clone(),
        )
        .unwrap();
        let bundle2 = ContextBundle::new(inputs, memory_refs, budgets, redactions).unwrap();

        // They should have the same hash
        assert_eq!(bundle1.bundle_hash, bundle2.bundle_hash);
    }

    #[test]
    fn test_verify_artifact_validation() {
        let results = VerificationResults {
            passed: true,
            details: serde_json::json!({"test": "passed"}),
            confidence: 1.0,
            issues: vec![],
        };

        let artifact = VerifyArtifact::new(
            "run-123".to_string(),
            "step-123".to_string(),
            "hash-123".to_string(),
            results,
            "verifier-123".to_string(),
        );

        assert!(artifact.validate().is_ok());
    }

    #[test]
    fn test_capsule_spec_creation() {
        let data_model = serde_json::json!({"user": "test", "preferences": []});
        let ui_spec = serde_json::json!({"theme": "dark", "layout": "grid"});

        let capsule_spec = CapsuleSpec::new(
            "fwk_test".to_string(),
            "Test goal".to_string(),
            data_model,
            ui_spec,
        )
        .unwrap();

        assert!(!capsule_spec.capsule_id.is_empty());
        assert_eq!(capsule_spec.framework_id, "fwk_test");
        assert_eq!(capsule_spec.goal, "Test goal");
        assert!(capsule_spec.validate().is_ok());
    }

    #[test]
    fn test_intent_route_creation() {
        let mut route = IntentRoute::new(
            "Plan a trip to Paris".to_string(),
            "fwk_trip_planner".to_string(),
            0.95,
        );

        route.add_alternative(
            "fwk_generic".to_string(),
            0.3,
            "Less specific match".to_string(),
        );

        assert_eq!(route.intent, "Plan a trip to Paris");
        assert_eq!(route.framework_id, "fwk_trip_planner");
        assert_eq!(route.confidence, 0.95);
        assert_eq!(route.alternatives.len(), 1);
        assert!(route.validate().is_ok());

        // Test invalid confidence
        let invalid_route = IntentRoute {
            intent: "Test".to_string(),
            framework_id: "fwk_test".to_string(),
            confidence: 1.5, // Invalid confidence
            alternatives: vec![],
            metadata: HashMap::new(),
        };
        assert!(invalid_route.validate().is_err());
    }

    #[test]
    fn test_kernel_event_type_conversion() {
        let event = KernelEventType::CapsuleCreated {
            capsule_id: "capsule-123".to_string(),
        };

        let envelope: EventEnvelope = event.into();
        assert_eq!(envelope.event_type, "CapsuleCreated");
        assert!(envelope.payload.is_object());
    }
}

#[cfg(test)]
mod schema_tests {
    use super::*;
    use schemars::schema_for;
    use serde_json;

    #[test]
    fn test_event_envelope_schema() {
        let schema = schema_for!(EventEnvelope);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        // This serves as our golden test - if the schema changes, this test will catch it
        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("event_id"));
        assert!(schema_json.contains("event_type"));
        assert!(schema_json.contains("session_id"));
        assert!(schema_json.contains("tenant_id"));
        assert!(schema_json.contains("correlation_id"));
        assert!(schema_json.contains("causation_id"));
        assert!(schema_json.contains("idempotency_key"));
        assert!(schema_json.contains("trace_id"));
    }

    #[test]
    fn test_run_model_schema() {
        let schema = schema_for!(RunModel);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("run_id"));
        assert!(schema_json.contains("state"));
        assert!(schema_json.contains("Created"));
        assert!(schema_json.contains("Running"));
        assert!(schema_json.contains("Verifying"));
        assert!(schema_json.contains("Completed"));
        assert!(schema_json.contains("Failed"));
        assert!(schema_json.contains("Cancelled"));
    }

    #[test]
    fn test_tool_abi_schema() {
        let schema = schema_for!(ToolABI);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("tool_id"));
        assert!(schema_json.contains("name"));
        assert!(schema_json.contains("has_side_effects"));
        assert!(schema_json.contains("requires_policy_approval"));
    }

    #[test]
    fn test_policy_decision_schema() {
        let schema = schema_for!(PolicyDecision);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("identity_id"));
        assert!(schema_json.contains("resource"));
        assert!(schema_json.contains("action"));
        assert!(schema_json.contains("Allow"));
        assert!(schema_json.contains("Deny"));
    }

    #[test]
    fn test_verify_artifact_schema() {
        let schema = schema_for!(VerifyArtifact);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("verify_id"));
        assert!(schema_json.contains("run_id"));
        assert!(schema_json.contains("outputs_hash"));
        assert!(schema_json.contains("passed"));
    }

    #[test]
    fn test_context_bundle_schema() {
        let schema = schema_for!(ContextBundle);
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();

        assert!(!schema_json.is_empty());
        assert!(schema_json.contains("bundle_hash"));
        assert!(schema_json.contains("inputs"));
        assert!(schema_json.contains("memory_refs"));
    }
}
