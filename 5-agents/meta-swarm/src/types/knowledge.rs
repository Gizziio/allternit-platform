use super::{AgentTeam, Cost, EntityId, ExecutionResult, Metadata, SwarmMode};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A discovered pattern in the knowledge base
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub metadata: Metadata,
    pub name: String,
    pub description: String,
    pub pattern_type: PatternType,
    pub domain: String,
    pub content: PatternContent,
    pub effectiveness: EffectivenessMetrics,
    pub source: PatternSource,
}

impl Pattern {
    pub fn new(name: impl Into<String>, pattern_type: PatternType) -> Self {
        Self {
            metadata: Metadata::new(),
            name: name.into(),
            description: String::new(),
            pattern_type,
            domain: String::new(),
            content: PatternContent::default(),
            effectiveness: EffectivenessMetrics::default(),
            source: PatternSource::Discovered,
        }
    }

    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = desc.into();
        self
    }

    pub fn with_domain(mut self, domain: impl Into<String>) -> Self {
        self.domain = domain.into();
        self
    }

    pub fn is_proven(&self) -> bool {
        self.effecticiency.usage_count > 5 && self.effecticiency.success_rate > 0.8
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PatternType {
    Architecture,
    Collaboration,
    Fix,
    Prevention,
    RootCause,
    Process,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PatternContent {
    pub problem_template: String,
    pub solution_template: String,
    pub example_usage: Vec<String>,
    pub caveats: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectivenessMetrics {
    pub usage_count: u32,
    pub success_count: u32,
    pub failure_count: u32,
    pub average_cost: Cost,
    pub average_duration_secs: f64,
    pub last_used: Option<DateTime<Utc>>,
}

impl Default for EffectivenessMetrics {
    fn default() -> Self {
        Self {
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            average_cost: Cost::default(),
            average_duration_secs: 0.0,
            last_used: None,
        }
    }
}

impl EffectivenessMetrics {
    pub fn record_usage(&mut self, success: bool, cost: Cost, duration_secs: f64) {
        self.usage_count += 1;
        if success {
            self.success_count += 1;
        } else {
            self.failure_count += 1;
        }
        
        // Update rolling averages
        let n = self.usage_count as f64;
        self.average_cost.estimated_usd = 
            (self.average_cost.estimated_usd * (n - 1.0) + cost.estimated_usd) / n;
        self.average_duration_secs = 
            (self.average_duration_secs * (n - 1.0) + duration_secs) / n;
        
        self.last_used = Some(Utc::now());
    }

    pub fn success_rate(&self) -> f64 {
        if self.usage_count == 0 {
            return 0.0;
        }
        self.success_count as f64 / self.usage_count as f64
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PatternSource {
    Discovered,      // Discovered by SwarmAgentic
    Extracted,       // Extracted by Compound phase
    Curated,         // Human-curated
    Imported,        // Imported from external source
}

/// A stored solution to a problem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Solution {
    pub metadata: Metadata,
    pub problem_summary: String,
    pub problem_hash: String,
    pub approach: String,
    pub agent_team: Option<AgentTeam>,
    pub mode_used: SwarmMode,
    pub outcome: SolutionOutcome,
    pub artifacts: Vec<SolutionArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionOutcome {
    pub success: bool,
    pub duration_secs: f64,
    pub cost: Cost,
    pub quality_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionArtifact {
    pub artifact_type: String,
    pub path: String,
    pub description: String,
}

/// Archive of PSO particles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticleArchive {
    pub metadata: Metadata,
    pub task_id: EntityId,
    pub particles: Vec<ArchivedParticle>,
    pub global_best: Option<ArchivedParticle>,
    pub convergence_history: Vec<ConvergencePoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivedParticle {
    pub particle_id: EntityId,
    pub position: Vec<f64>,
    pub score: f64,
    pub team_structure: TeamStructure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamStructure {
    pub role_names: Vec<String>,
    pub topology_type: String,
    pub agent_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergencePoint {
    pub iteration: usize,
    pub best_score: f64,
    pub average_score: f64,
    pub diversity: f64,
}

/// Knowledge query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeQueryResult {
    pub query: String,
    pub patterns: Vec<ScoredPattern>,
    pub solutions: Vec<ScoredSolution>,
    pub total_matches: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredPattern {
    pub pattern: Pattern,
    pub similarity_score: f64,
    pub relevance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredSolution {
    pub solution: Solution,
    pub similarity_score: f64,
}

/// Cross-mode learning record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossModeLearning {
    pub metadata: Metadata,
    pub from_mode: SwarmMode,
    pub to_mode: SwarmMode,
    pub transfer_type: TransferType,
    pub content: TransferContent,
    pub effectiveness: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferType {
    ArchitectureExport,    // SwarmAgentic → Claude Swarm
    PatternSharing,        // ClosedLoop → All
    TeamTemplate,          // Any → Any
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferContent {
    pub pattern_id: Option<EntityId>,
    pub team_template_id: Option<EntityId>,
    pub custom_data: HashMap<String, serde_json::Value>,
}
