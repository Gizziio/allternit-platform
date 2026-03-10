use super::{Cost, EntityId, Metadata, Progress, Status};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// An agent in the swarm system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub metadata: Metadata,
    pub role: AgentRole,
    pub capabilities: Vec<AgentCapability>,
    pub config: AgentConfig,
    pub status: AgentStatus,
    pub stats: AgentStats,
}

impl Agent {
    pub fn new(role: AgentRole) -> Self {
        Self {
            metadata: Metadata::new(),
            role,
            capabilities: Vec::new(),
            config: AgentConfig::default(),
            status: AgentStatus::Idle,
            stats: AgentStats::default(),
        }
    }

    pub fn with_capabilities(mut self, caps: Vec<AgentCapability>) -> Self {
        self.capabilities = caps;
        self
    }

    pub fn with_config(mut self, config: AgentConfig) -> Self {
        self.config = config;
        self
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    /// Check if agent has a specific capability
    pub fn has_capability(&self, capability: &AgentCapability) -> bool {
        self.capabilities.contains(capability)
    }

    /// Check if agent can handle a task
    pub fn can_handle(&self, requirements: &[AgentCapability]) -> bool {
        requirements.iter().all(|req| self.has_capability(req))
    }

    /// Update agent status
    pub fn set_status(&mut self, status: AgentStatus) {
        self.status = status;
        self.metadata.bump_version();
    }
}

/// Role definition for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRole {
    pub name: String,
    pub description: String,
    pub responsibilities: Vec<String>,
    pub required_capabilities: Vec<AgentCapability>,
    pub prompt_template: String,
    pub model: String,
    pub temperature: f64,
}

impl AgentRole {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: String::new(),
            responsibilities: Vec::new(),
            required_capabilities: Vec::new(),
            prompt_template: String::new(),
            model: "claude-sonnet".to_string(),
            temperature: 0.7,
        }
    }

    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = desc.into();
        self
    }

    pub fn with_responsibilities(mut self, resp: Vec<String>) -> Self {
        self.responsibilities = resp;
        self
    }

    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    /// Standard roles for the system
    pub fn researcher() -> Self {
        Self::new("Researcher")
            .with_description("Researches solutions and gathers information")
            .with_responsibilities(vec![
                "Analyze requirements".to_string(),
                "Research existing solutions".to_string(),
                "Document findings".to_string(),
            ])
            .with_model("claude-sonnet")
    }

    pub fn coder() -> Self {
        Self::new("Coder")
            .with_description("Writes and modifies code")
            .with_responsibilities(vec![
                "Implement features".to_string(),
                "Fix bugs".to_string(),
                "Refactor code".to_string(),
            ])
            .with_model("claude-sonnet")
    }

    pub fn tester() -> Self {
        Self::new("Tester")
            .with_description("Writes and runs tests")
            .with_responsibilities(vec![
                "Write unit tests".to_string(),
                "Write integration tests".to_string(),
                "Run test suites".to_string(),
            ])
            .with_model("claude-haiku")
    }

    pub fn reviewer() -> Self {
        Self::new("Reviewer")
            .with_description("Reviews code for quality and correctness")
            .with_responsibilities(vec![
                "Review code quality".to_string(),
                "Check for bugs".to_string(),
                "Verify requirements".to_string(),
            ])
            .with_model("claude-opus")
    }

    pub fn architect() -> Self {
        Self::new("Architect")
            .with_description("Designs system architecture")
            .with_responsibilities(vec![
                "Design system structure".to_string(),
                "Define interfaces".to_string(),
                "Make technology choices".to_string(),
            ])
            .with_model("claude-opus")
    }

    pub fn planner() -> Self {
        Self::new("Planner")
            .with_description("Breaks down tasks into actionable steps")
            .with_responsibilities(vec![
                "Decompose tasks".to_string(),
                "Identify dependencies".to_string(),
                "Create execution plans".to_string(),
            ])
            .with_model("claude-sonnet")
    }
}

/// Capabilities an agent can have
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentCapability {
    // Code capabilities
    CodeReading,
    CodeWriting,
    CodeRefactoring,
    TestWriting,
    Debugging,
    CodeReview,

    // Design capabilities
    SystemDesign,
    ApiDesign,
    DatabaseDesign,
    UiDesign,

    // Analysis capabilities
    RequirementAnalysis,
    PerformanceAnalysis,
    SecurityAnalysis,
    CodeAnalysis,

    // Research capabilities
    Research,
    Documentation,
    Learning,

    // Communication capabilities
    Coordination,
    Teaching,
    Reporting,

    // Domain-specific
    RustProgramming,
    TypeScriptProgramming,
    PythonProgramming,
    GoProgramming,

    // Custom capability
    Custom(String),
}

impl AgentCapability {
    pub fn description(&self) -> String {
        match self {
            AgentCapability::CodeReading => "Read and understand code".to_string(),
            AgentCapability::CodeWriting => "Write new code".to_string(),
            AgentCapability::CodeRefactoring => "Refactor existing code".to_string(),
            AgentCapability::TestWriting => "Write tests".to_string(),
            AgentCapability::Debugging => "Debug issues".to_string(),
            AgentCapability::CodeReview => "Review code".to_string(),
            AgentCapability::SystemDesign => "Design system architecture".to_string(),
            AgentCapability::ApiDesign => "Design APIs".to_string(),
            AgentCapability::DatabaseDesign => "Design database schemas".to_string(),
            AgentCapability::UiDesign => "Design user interfaces".to_string(),
            AgentCapability::RequirementAnalysis => "Analyze requirements".to_string(),
            AgentCapability::PerformanceAnalysis => "Analyze performance".to_string(),
            AgentCapability::SecurityAnalysis => "Analyze security".to_string(),
            AgentCapability::CodeAnalysis => "Analyze code".to_string(),
            AgentCapability::Research => "Research topics".to_string(),
            AgentCapability::Documentation => "Write documentation".to_string(),
            AgentCapability::Learning => "Learn new concepts".to_string(),
            AgentCapability::Coordination => "Coordinate with other agents".to_string(),
            AgentCapability::Teaching => "Teach other agents".to_string(),
            AgentCapability::Reporting => "Report findings".to_string(),
            AgentCapability::RustProgramming => "Rust programming".to_string(),
            AgentCapability::TypeScriptProgramming => "TypeScript programming".to_string(),
            AgentCapability::PythonProgramming => "Python programming".to_string(),
            AgentCapability::GoProgramming => "Go programming".to_string(),
            AgentCapability::Custom(s) => format!("Custom: {}", s),
        }
    }
}

/// Configuration for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub max_iterations: u32,
    pub timeout_seconds: u64,
    pub max_tokens: u32,
    pub tools: Vec<String>,
    pub allowed_paths: Vec<String>,
    pub blocked_paths: Vec<String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_iterations: 10,
            timeout_seconds: 300,
            max_tokens: 4096,
            tools: Vec::new(),
            allowed_paths: Vec::new(),
            blocked_paths: Vec::new(),
        }
    }
}

/// Current status of an agent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Idle,
    Working,
    Waiting,    // Waiting for dependencies
    Completed,
    Failed,
}

impl AgentStatus {
    pub fn is_available(&self) -> bool {
        matches!(self, AgentStatus::Idle)
    }

    pub fn is_active(&self) -> bool {
        matches!(self, AgentStatus::Working)
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, AgentStatus::Completed | AgentStatus::Failed)
    }
}

/// Statistics for an agent
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentStats {
    pub tasks_completed: u32,
    pub tasks_failed: u32,
    pub total_cost: Cost,
    pub average_execution_time_secs: f64,
    pub success_rate: f64,
}

impl AgentStats {
    pub fn record_completion(&mut self, cost: Cost, duration_secs: f64) {
        self.tasks_completed += 1;
        self.total_cost.add(&cost);
        
        // Update rolling average
        let n = self.tasks_completed as f64;
        self.average_execution_time_secs = 
            (self.average_execution_time_secs * (n - 1.0) + duration_secs) / n;
        
        self.update_success_rate();
    }

    pub fn record_failure(&mut self) {
        self.tasks_failed += 1;
        self.update_success_rate();
    }

    fn update_success_rate(&mut self) {
        let total = self.tasks_completed + self.tasks_failed;
        if total > 0 {
            self.success_rate = self.tasks_completed as f64 / total as f64;
        }
    }
}

/// A team of agents working together
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTeam {
    pub metadata: Metadata,
    pub name: String,
    pub description: String,
    pub agents: Vec<EntityId>,
    pub topology: CollaborationTopology,
    pub created_for_task: EntityId,
}

impl AgentTeam {
    pub fn new(name: impl Into<String>, task_id: EntityId) -> Self {
        Self {
            metadata: Metadata::new(),
            name: name.into(),
            description: String::new(),
            agents: Vec::new(),
            topology: CollaborationTopology::default(),
            created_for_task: task_id,
        }
    }

    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = desc.into();
        self
    }

    pub fn with_topology(mut self, topology: CollaborationTopology) -> Self {
        self.topology = topology;
        self
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    pub fn add_agent(&mut self, agent_id: EntityId) {
        self.agents.push(agent_id);
    }

    /// Get agents in execution order based on topology
    pub fn execution_order(&self) -> Vec<Vec<EntityId>> {
        self.topology.execution_waves(&self.agents)
    }
}

/// Collaboration topology for a team
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationTopology {
    /// Edges representing collaboration relationships
    pub edges: Vec<CollaborationEdge>,
    /// Pattern of collaboration
    pub pattern: CollaborationPattern,
}

impl Default for CollaborationTopology {
    fn default() -> Self {
        Self {
            edges: Vec::new(),
            pattern: CollaborationPattern::Sequential,
        }
    }
}

impl CollaborationTopology {
    /// Create a sequential topology (A → B → C)
    pub fn sequential() -> Self {
        Self {
            edges: Vec::new(),
            pattern: CollaborationPattern::Sequential,
        }
    }

    /// Create a parallel topology (A, B, C all at once)
    pub fn parallel() -> Self {
        Self {
            edges: Vec::new(),
            pattern: CollaborationPattern::Parallel,
        }
    }

    /// Create a hub-and-spoke topology (center connected to all)
    pub fn hub_and_spoke(center: EntityId) -> Self {
        Self {
            edges: Vec::new(),
            pattern: CollaborationPattern::HubAndSpoke(center),
        }
    }

    /// Add a collaboration edge
    pub fn with_edge(mut self, from: EntityId, to: EntityId, edge_type: EdgeType) -> Self {
        self.edges.push(CollaborationEdge {
            from,
            to,
            edge_type,
        });
        self
    }

    /// Compute execution waves (which agents can run in parallel)
    pub fn execution_waves(&self, agents: &[EntityId]) -> Vec<Vec<EntityId>> {
        match self.pattern {
            CollaborationPattern::Sequential => {
                // Each agent depends on the previous
                agents.iter().map(|a| vec![*a]).collect()
            }
            CollaborationPattern::Parallel => {
                // All agents can run together
                vec![agents.to_vec()]
            }
            CollaborationPattern::HubAndSpoke(center) => {
                // Center first, then all others in parallel
                let others: Vec<EntityId> = agents.iter()
                    .filter(|a| **a != center)
                    .copied()
                    .collect();
                vec![vec![center], others]
            }
            CollaborationPattern::Custom => {
                // Build dependency graph from edges
                self.compute_waves_from_edges(agents)
            }
        }
    }

    fn compute_waves_from_edges(&self, agents: &[EntityId]) -> Vec<Vec<EntityId>> {
        // Build adjacency list of dependencies
        let mut dependencies: HashMap<EntityId, HashSet<EntityId>> = HashMap::new();
        for agent in agents {
            dependencies.insert(*agent, HashSet::new());
        }
        for edge in &self.edges {
            if let Some(deps) = dependencies.get_mut(&edge.to) {
                deps.insert(edge.from);
            }
        }

        // Topological sort into waves
        let mut waves: Vec<Vec<EntityId>> = Vec::new();
        let mut completed: HashSet<EntityId> = HashSet::new();
        let mut remaining: HashSet<EntityId> = agents.iter().copied().collect();

        while !remaining.is_empty() {
            let wave: Vec<EntityId> = remaining
                .iter()
                .filter(|agent| {
                    let deps = dependencies.get(agent).unwrap_or(&HashSet::new());
                    deps.iter().all(|dep| completed.contains(dep))
                })
                .copied()
                .collect();

            if wave.is_empty() {
                // Cycle detected or error
                break;
            }

            for agent in &wave {
                remaining.remove(agent);
                completed.insert(*agent);
            }
            waves.push(wave);
        }

        waves
    }
}

/// Edge in the collaboration graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationEdge {
    pub from: EntityId,
    pub to: EntityId,
    pub edge_type: EdgeType,
}

/// Type of collaboration edge
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    DependsOn,      // to depends on from
    ProvidesInput,  // from provides input to
    Reviews,        // from reviews work of to
    Blocks,         // from blocks to
}

/// Collaboration pattern
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollaborationPattern {
    Sequential,
    Parallel,
    HubAndSpoke(EntityId),
    Custom,
}

/// Particle representation for SwarmAgentic PSO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Particle {
    pub metadata: Metadata,
    pub position: Vec<f64>,        // Encoded agent team
    pub velocity: Vec<f64>,        // PSO velocity
    pub personal_best: Vec<f64>,   // Best position found by this particle
    pub personal_best_score: f64,
    pub team: AgentTeam,           // Decoded agent team
    pub score: f64,                // Current fitness score
}

impl Particle {
    pub fn new(team: AgentTeam, dimensions: usize) -> Self {
        let position = vec![0.0; dimensions];
        Self {
            metadata: Metadata::new(),
            position: position.clone(),
            velocity: vec![0.0; dimensions],
            personal_best: position.clone(),
            personal_best_score: 0.0,
            team,
            score: 0.0,
        }
    }

    pub fn id(&self) -> EntityId {
        self.metadata.id
    }

    /// Update velocity using PSO formula
    pub fn update_velocity(
        &mut self,
        global_best: &[f64],
        inertia: f64,
        cognitive: f64,
        social: f64,
        rng: &mut impl rand::Rng,
    ) {
        for i in 0..self.position.len() {
            let r1: f64 = rng.gen();
            let r2: f64 = rng.gen();

            let cognitive_component = cognitive * r1 * (self.personal_best[i] - self.position[i]);
            let social_component = social * r2 * (global_best[i] - self.position[i]);

            self.velocity[i] = inertia * self.velocity[i] + cognitive_component + social_component;
        }
    }

    /// Update position based on velocity
    pub fn update_position(&mut self) {
        for i in 0..self.position.len() {
            self.position[i] += self.velocity[i];
            // Clamp to valid range [0, 1]
            self.position[i] = self.position[i].clamp(0.0, 1.0);
        }
    }

    /// Update personal best if current score is better
    pub fn update_personal_best(&mut self) {
        if self.score > self.personal_best_score {
            self.personal_best = self.position.clone();
            self.personal_best_score = self.score;
        }
    }
}
