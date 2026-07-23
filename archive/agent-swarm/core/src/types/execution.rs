use super::{Cost, EntityId, Metadata, Priority, Progress, Status};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Result of executing a task or subtask
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub status: Status,
    pub output: ExecutionOutput,
    pub cost: Cost,
    pub duration_secs: f64,
    pub timestamp: DateTime<Utc>,
}

impl ExecutionResult {
    pub fn success(task_id: EntityId, output: impl Into<String>) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            status: Status::Completed,
            output: ExecutionOutput::Success(output.into()),
            cost: Cost::default(),
            duration_secs: 0.0,
            timestamp: Utc::now(),
        }
    }

    pub fn failure(task_id: EntityId, error: impl Into<String>) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            status: Status::Failed,
            output: ExecutionOutput::Failure(error.into()),
            cost: Cost::default(),
            duration_secs: 0.0,
            timestamp: Utc::now(),
        }
    }

    pub fn with_cost(mut self, cost: Cost) -> Self {
        self.cost = cost;
        self
    }

    pub fn with_duration(mut self, secs: f64) -> Self {
        self.duration_secs = secs;
        self
    }

    pub fn is_success(&self) -> bool {
        matches!(self.status, Status::Completed) && matches!(self.output, ExecutionOutput::Success(_))
    }
}

/// Output from execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionOutput {
    Success(String),
    Failure(String),
    Partial(String, Vec<String>), // Partial success with warnings
}

/// Detailed trace of execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrace {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub events: Vec<ExecutionEvent>,
    pub agent_interactions: Vec<AgentInteraction>,
    pub file_operations: Vec<FileOperation>,
    pub tool_calls: Vec<ToolCall>,
}

impl ExecutionTrace {
    pub fn new(task_id: EntityId) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            events: Vec::new(),
            agent_interactions: Vec::new(),
            file_operations: Vec::new(),
            tool_calls: Vec::new(),
        }
    }

    pub fn add_event(&mut self, event: ExecutionEvent) {
        self.events.push(event);
    }

    pub fn add_interaction(&mut self, interaction: AgentInteraction) {
        self.agent_interactions.push(interaction);
    }

    pub fn add_file_operation(&mut self, op: FileOperation) {
        self.file_operations.push(op);
    }
}

/// Event in execution trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: EventType,
    pub description: String,
    pub agent_id: Option<EntityId>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Started,
    Completed,
    Failed,
    Retrying,
    Waiting,
    Resumed,
    Cancelled,
}

/// Interaction between agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInteraction {
    pub timestamp: DateTime<Utc>,
    pub from_agent: EntityId,
    pub to_agent: EntityId,
    pub interaction_type: InteractionType,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InteractionType {
    Request,
    Response,
    Handoff,
    Review,
    Block,
}

/// File operation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperation {
    pub timestamp: DateTime<Utc>,
    pub agent_id: EntityId,
    pub operation: FileOpType,
    pub path: String,
    pub success: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileOpType {
    Read,
    Write,
    Edit,
    Delete,
    Lock,
    Unlock,
}

/// Tool call record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub timestamp: DateTime<Utc>,
    pub agent_id: EntityId,
    pub tool_name: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub result: ToolResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolResult {
    Success(serde_json::Value),
    Failure(String),
}

/// Report of failures during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureReport {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub failures: Vec<Failure>,
    pub analysis: FailureAnalysis,
    pub repair_plan: RepairPlan,
}

impl FailureReport {
    pub fn new(task_id: EntityId) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            failures: Vec::new(),
            analysis: FailureAnalysis::default(),
            repair_plan: RepairPlan::default(),
        }
    }

    pub fn add_failure(&mut self, failure: Failure) {
        self.failures.push(failure);
    }

    pub fn has_critical(&self) -> bool {
        self.failures.iter().any(|f| f.severity == FailureSeverity::Critical)
    }
}

/// Individual failure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Failure {
    pub timestamp: DateTime<Utc>,
    pub agent_id: EntityId,
    pub failure_type: FailureType,
    pub severity: FailureSeverity,
    pub description: String,
    pub context: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailureType {
    ExecutionError,
    Timeout,
    ResourceExhaustion,
    InvalidOutput,
    PolicyViolation,
    CoordinationFailure,
    MissingSkill,
    ToolError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailureSeverity {
    Minor,
    Moderate,
    Serious,
    Critical,
}

/// Analysis of failures
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FailureAnalysis {
    pub root_causes: Vec<String>,
    pub missing_skills: Vec<String>,
    pub coordination_gaps: Vec<String>,
    pub patterns: Vec<String>,
}

/// Plan to repair failures
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RepairPlan {
    pub actions: Vec<RepairAction>,
    pub estimated_success_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairAction {
    pub action_type: RepairActionType,
    pub description: String,
    pub target: EntityId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RepairActionType {
    AddAgent,
    RemoveAgent,
    ModifyPrompt,
    ChangeTopology,
    AddSkill,
    Retry,
}

/// Quality gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGateResult {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub passed: bool,
    pub score: f64,
    pub checks: Vec<QualityCheck>,
    pub verdict: QualityVerdict,
}

impl QualityGateResult {
    pub fn new(task_id: EntityId) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            passed: false,
            score: 0.0,
            checks: Vec::new(),
            verdict: QualityVerdict::default(),
        }
    }

    pub fn with_checks(mut self, checks: Vec<QualityCheck>) -> Self {
        self.checks = checks;
        self.calculate_score();
        self
    }

    fn calculate_score(&mut self) {
        if self.checks.is_empty() {
            self.score = 0.0;
            return;
        }
        let total: f64 = self.checks.iter().map(|c| c.score).sum();
        self.score = total / self.checks.len() as f64;
        self.passed = self.score >= 0.7 && !self.checks.iter().any(|c| c.critical && !c.passed);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityCheck {
    pub name: String,
    pub description: String,
    pub passed: bool,
    pub score: f64,
    pub critical: bool,
    pub findings: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QualityVerdict {
    pub summary: String,
    pub recommendations: Vec<String>,
    pub blockers: Vec<String>,
}

/// Triage result from review phase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageResult {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub items: Vec<TriageItem>,
    pub p1_count: usize,
    pub p2_count: usize,
    pub p3_count: usize,
    pub can_ship: bool,
}

impl TriageResult {
    pub fn new(task_id: EntityId) -> Self {
        Self {
            metadata: Metadata::new(),
            task_id,
            items: Vec::new(),
            p1_count: 0,
            p2_count: 0,
            p3_count: 0,
            can_ship: true,
        }
    }

    pub fn add_item(&mut self, item: TriageItem) {
        match item.priority {
            Priority::P1 => self.p1_count += 1,
            Priority::P2 => self.p2_count += 1,
            Priority::P3 => self.p3_count += 1,
        }
        if item.priority == Priority::P1 && item.blocking {
            self.can_ship = false;
        }
        self.items.push(item);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageItem {
    pub id: EntityId,
    pub priority: Priority,
    pub category: String,
    pub description: String,
    pub location: Option<String>,
    pub blocking: bool,
    pub suggested_fix: Option<String>,
}

impl TriageItem {
    pub fn p1(description: impl Into<String>) -> Self {
        Self {
            id: EntityId::new(),
            priority: Priority::P1,
            category: String::new(),
            description: description.into(),
            location: None,
            blocking: true,
            suggested_fix: None,
        }
    }

    pub fn p2(description: impl Into<String>) -> Self {
        Self {
            id: EntityId::new(),
            priority: Priority::P2,
            category: String::new(),
            description: description.into(),
            location: None,
            blocking: false,
            suggested_fix: None,
        }
    }

    pub fn p3(description: impl Into<String>) -> Self {
        Self {
            id: EntityId::new(),
            priority: Priority::P3,
            category: String::new(),
            description: description.into(),
            location: None,
            blocking: false,
            suggested_fix: None,
        }
    }
}
