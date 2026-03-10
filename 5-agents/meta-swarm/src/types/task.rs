use super::{Confidence, Cost, EntityId, Metadata, Priority, Progress, Status};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A task to be processed by the meta-swarm system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub metadata: Metadata,
    pub description: String,
    pub objective: String,
    pub classification: TaskClassification,
    pub constraints: TaskConstraints,
    pub context: TaskContext,
    pub status: Status,
    pub progress: Progress,
    pub cost: Cost,
}

impl Task {
    pub fn new(description: impl Into<String>) -> Self {
        let desc = description.into();
        Self {
            metadata: Metadata::new(),
            objective: desc.clone(),
            description: desc,
            classification: TaskClassification::default(),
            constraints: TaskConstraints::default(),
            context: TaskContext::default(),
            status: Status::Pending,
            progress: Progress::new(0),
            cost: Cost::default(),
        }
    }

    pub fn with_objective(mut self, objective: impl Into<String>) -> Self {
        self.objective = objective.into();
        self
    }

    pub fn with_classification(mut self, classification: TaskClassification) -> Self {
        self.classification = classification;
        self
    }

    pub fn with_constraints(mut self, constraints: TaskConstraints) -> Self {
        self.constraints = constraints;
        self
    }

    pub fn with_context(mut self, context: TaskContext) -> Self {
        self.context = context;
        self
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    /// Calculate complexity score (0.0 to 1.0)
    pub fn complexity_score(&self) -> f64 {
        self.classification.complexity.score()
    }

    /// Check if task is novel (high novelty score)
    pub fn is_novel(&self) -> bool {
        self.classification.novelty.score() > 0.7
    }

    /// Check if task requires production workflow
    pub fn requires_production_workflow(&self) -> bool {
        self.constraints.requires_review || self.constraints.production_code
    }
}

/// Classification of a task's characteristics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskClassification {
    pub complexity: Complexity,
    pub novelty: Novelty,
    pub domain: Domain,
    pub estimated_duration: DurationEstimate,
}

impl Default for TaskClassification {
    fn default() -> Self {
        Self {
            complexity: Complexity::Medium,
            novelty: Novelty::Unknown,
            domain: Domain::General,
            estimated_duration: DurationEstimate::Hours(1),
        }
    }
}

/// Task complexity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Complexity {
    Trivial,    // Simple, well-understood tasks
    Low,        // Straightforward with clear approach
    Medium,     // Some uncertainty, requires planning
    High,       // Complex, multiple components
    Extreme,    // Novel, research-level difficulty
}

impl Complexity {
    /// Get numeric score (0.0 to 1.0)
    pub fn score(&self) -> f64 {
        match self {
            Complexity::Trivial => 0.1,
            Complexity::Low => 0.3,
            Complexity::Medium => 0.5,
            Complexity::High => 0.75,
            Complexity::Extreme => 0.95,
        }
    }

    /// Get description
    pub fn description(&self) -> &'static str {
        match self {
            Complexity::Trivial => "Simple, well-understood task with clear solution path",
            Complexity::Low => "Straightforward task with minimal uncertainty",
            Complexity::Medium => "Moderate complexity, requires some planning",
            Complexity::High => "Complex task with multiple interacting components",
            Complexity::Extreme => "Highly complex, potentially novel research-level task",
        }
    }

    /// Suggest swarm mode based on complexity
    pub fn suggested_mode(&self) -> super::SwarmMode {
        match self {
            Complexity::Trivial | Complexity::Low => super::SwarmMode::ClaudeSwarm,
            Complexity::Medium => super::SwarmMode::ClosedLoop,
            Complexity::High | Complexity::Extreme => super::SwarmMode::SwarmAgentic,
        }
    }
}

/// Task novelty - how novel is this type of task
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Novelty {
    Known,      // We've done this exact task before
    Similar,    // Similar to past tasks
    Unknown,    // Unclear if novel
    Novel,      // Recognizably new
    Breakthrough, // Completely new domain/approach
}

impl Novelty {
    /// Get numeric score (0.0 to 1.0)
    pub fn score(&self) -> f64 {
        match self {
            Novelty::Known => 0.0,
            Novelty::Similar => 0.25,
            Novelty::Unknown => 0.5,
            Novelty::Novel => 0.75,
            Novelty::Breakthrough => 1.0,
        }
    }

    /// Whether auto-discovery is recommended
    pub fn should_discover(&self) -> bool {
        self.score() >= 0.5
    }
}

/// Task domain classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Domain {
    Code,       // Software development
    Design,     // UI/UX design
    Architecture, // System architecture
    Planning,   // Project/goal planning
    Research,   // Research tasks
    Writing,    // Content creation
    Analysis,   // Data analysis
    General,    // General purpose
}

impl Domain {
    /// Get domain expertise tags
    pub fn expertise_tags(&self) -> Vec<&'static str> {
        match self {
            Domain::Code => vec!["coding", "programming", "software", "engineering"],
            Domain::Design => vec!["design", "ui", "ux", "visual"],
            Domain::Architecture => vec!["architecture", "systems", "infrastructure"],
            Domain::Planning => vec!["planning", "project management", "strategy"],
            Domain::Research => vec!["research", "analysis", "investigation"],
            Domain::Writing => vec!["writing", "content", "documentation"],
            Domain::Analysis => vec!["analysis", "data", "metrics"],
            Domain::General => vec!["general"],
        }
    }
}

/// Duration estimate
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DurationEstimate {
    Minutes(u32),
    Hours(u32),
    Days(u32),
    Weeks(u32),
}

impl DurationEstimate {
    /// Convert to estimated minutes
    pub fn to_minutes(&self) -> u32 {
        match self {
            DurationEstimate::Minutes(m) => *m,
            DurationEstimate::Hours(h) => h * 60,
            DurationEstimate::Days(d) => d * 60 * 8,  // 8 hour workday
            DurationEstimate::Weeks(w) => w * 60 * 8 * 5, // 5 day work week
        }
    }
}

/// Constraints on task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskConstraints {
    pub max_budget_usd: Option<f64>,
    pub deadline: Option<DateTime<Utc>>,
    pub requires_review: bool,
    pub production_code: bool,
    pub security_sensitive: bool,
    pub allowed_modes: Vec<super::SwarmMode>,
    pub blocked_modes: Vec<super::SwarmMode>,
    pub required_agents: Vec<String>,
    pub excluded_agents: Vec<String>,
}

impl Default for TaskConstraints {
    fn default() -> Self {
        Self {
            max_budget_usd: None,
            deadline: None,
            requires_review: false,
            production_code: false,
            security_sensitive: false,
            allowed_modes: Vec::new(),
            blocked_modes: Vec::new(),
            required_agents: Vec::new(),
            excluded_agents: Vec::new(),
        }
    }
}

impl TaskConstraints {
    pub fn with_budget(mut self, budget: f64) -> Self {
        self.max_budget_usd = Some(budget);
        self
    }

    pub fn with_deadline(mut self, deadline: DateTime<Utc>) -> Self {
        self.deadline = Some(deadline);
        self
    }

    pub fn requires_review(mut self) -> Self {
        self.requires_review = true;
        self
    }

    pub fn is_mode_allowed(&self, mode: super::SwarmMode) -> bool {
        if !self.blocked_modes.is_empty() && self.blocked_modes.contains(&mode) {
            return false;
        }
        if !self.allowed_modes.is_empty() {
            return self.allowed_modes.contains(&mode);
        }
        true
    }
}

/// Context for task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskContext {
    pub codebase_path: Option<String>,
    pub relevant_files: Vec<String>,
    pub related_tasks: Vec<EntityId>,
    pub similar_patterns: Vec<EntityId>,
    pub previous_attempts: Vec<PreviousAttempt>,
    pub custom_context: HashMap<String, serde_json::Value>,
}

impl Default for TaskContext {
    fn default() -> Self {
        Self {
            codebase_path: None,
            relevant_files: Vec::new(),
            related_tasks: Vec::new(),
            similar_patterns: Vec::new(),
            previous_attempts: Vec::new(),
            custom_context: HashMap::new(),
        }
    }
}

/// Record of a previous attempt at this or similar task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviousAttempt {
    pub task_id: EntityId,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
    pub approach: String,
    pub lessons_learned: Vec<String>,
}

/// Subtask within a larger task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtask {
    pub metadata: Metadata,
    pub parent_id: EntityId,
    pub description: String,
    pub dependencies: Vec<EntityId>,
    pub status: Status,
    pub priority: Priority,
    pub estimated_cost: Cost,
    pub assigned_agent: Option<EntityId>,
}

impl Subtask {
    pub fn new(parent_id: EntityId, description: impl Into<String>) -> Self {
        Self {
            metadata: Metadata::new(),
            parent_id,
            description: description.into(),
            dependencies: Vec::new(),
            status: Status::Pending,
            priority: Priority::P2,
            estimated_cost: Cost::default(),
            assigned_agent: None,
        }
    }

    pub fn with_dependencies(mut self, deps: Vec<EntityId>) -> Self {
        self.dependencies = deps;
        self
    }

    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    /// Check if this subtask is ready to execute (all dependencies completed)
    pub fn is_ready(&self, completed_ids: &[EntityId]) -> bool {
        self.dependencies.iter().all(|dep| completed_ids.contains(dep))
    }
}

/// Task analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysis {
    pub task_id: EntityId,
    pub timestamp: DateTime<Utc>,
    pub complexity_assessment: ComplexityAssessment,
    pub novelty_assessment: NoveltyAssessment,
    pub domain_assessment: DomainAssessment,
    pub similarity_to_past: Vec<SimilarTask>,
    pub recommended_mode: super::SwarmMode,
    pub confidence: Confidence,
    pub reasoning: String,
}

impl TaskAnalysis {
    pub fn new(task_id: EntityId) -> Self {
        Self {
            task_id,
            timestamp: Utc::now(),
            complexity_assessment: ComplexityAssessment::default(),
            novelty_assessment: NoveltyAssessment::default(),
            domain_assessment: DomainAssessment::default(),
            similarity_to_past: Vec::new(),
            recommended_mode: super::SwarmMode::ClaudeSwarm,
            confidence: Confidence::default(),
            reasoning: String::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComplexityAssessment {
    pub score: f64,
    pub factors: Vec<String>,
    pub explanation: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NoveltyAssessment {
    pub score: f64,
    pub similar_tasks_found: usize,
    pub explanation: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DomainAssessment {
    pub primary_domain: Domain,
    pub secondary_domains: Vec<Domain>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarTask {
    pub task_id: EntityId,
    pub similarity_score: f64,
    pub outcome: TaskOutcome,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOutcome {
    pub success: bool,
    pub mode_used: super::SwarmMode,
    pub duration_minutes: u32,
    pub final_cost: Cost,
}
