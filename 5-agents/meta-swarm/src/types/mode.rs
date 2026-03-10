use serde::{Deserialize, Serialize};

/// Available swarm modes in the meta-swarm system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwarmMode {
    /// SwarmAgentic - PSO-based automatic architecture discovery
    /// Use for: Novel tasks where optimal team structure is unknown
    SwarmAgentic,

    /// Claude Swarm - Parallel execution with dependency graphs
    /// Use for: Known patterns, fast parallel execution
    ClaudeSwarm,

    /// ClosedLoop - 5-step methodology with knowledge compounding
    /// Use for: Production workflows requiring review
    ClosedLoop,

    /// Hybrid - Combines all three modes in sequence
    /// Use for: Complex multi-phase projects
    Hybrid,
}

impl SwarmMode {
    /// Get display name for the mode
    pub fn display_name(&self) -> &'static str {
        match self {
            SwarmMode::SwarmAgentic => "Auto-Architect (SwarmAgentic)",
            SwarmMode::ClaudeSwarm => "Parallel Execution (Claude Swarm)",
            SwarmMode::ClosedLoop => "Production Workflow (ClosedLoop)",
            SwarmMode::Hybrid => "Hybrid Multi-Mode",
        }
    }

    /// Get description of when to use this mode
    pub fn when_to_use(&self) -> &'static str {
        match self {
            SwarmMode::SwarmAgentic => {
                "Novel tasks where optimal agent team structure is unknown. \
                 Automatically discovers optimal architectures through PSO."
            }
            SwarmMode::ClaudeSwarm => {
                "Well-understood task types with known patterns. \
                 Fast parallel execution with dependency-aware scheduling."
            }
            SwarmMode::ClosedLoop => {
                "Production code workflows requiring review. \
                 5-step methodology: Brainstorm → Plan → Work → Review → Compound."
            }
            SwarmMode::Hybrid => {
                "Complex multi-phase projects. \
                 Sequences: Discover → Execute → Review → Learn."
            }
        }
    }

    /// Get default max concurrent agents for this mode
    pub fn default_max_agents(&self) -> usize {
        match self {
            SwarmMode::SwarmAgentic => 5,    // PSO population size
            SwarmMode::ClaudeSwarm => 4,     // Parallel workers
            SwarmMode::ClosedLoop => 29,     // As mentioned by user
            SwarmMode::Hybrid => 10,         // Flexible
        }
    }

    /// Get default budget for this mode (USD)
    pub fn default_budget(&self) -> f64 {
        match self {
            SwarmMode::SwarmAgentic => 10.0,  // Higher for exploration
            SwarmMode::ClaudeSwarm => 5.0,    // Standard
            SwarmMode::ClosedLoop => 15.0,    // Higher for thoroughness
            SwarmMode::Hybrid => 20.0,        // Combined
        }
    }

    /// Check if this mode supports auto-discovery
    pub fn supports_discovery(&self) -> bool {
        matches!(self, SwarmMode::SwarmAgentic | SwarmMode::Hybrid)
    }

    /// Check if this mode supports quality gating
    pub fn supports_quality_gate(&self) -> bool {
        matches!(self, SwarmMode::ClaudeSwarm | SwarmMode::ClosedLoop | SwarmMode::Hybrid)
    }

    /// Check if this mode compounds knowledge
    pub fn compounds_knowledge(&self) -> bool {
        matches!(self, SwarmMode::ClosedLoop | SwarmMode::Hybrid)
    }

    /// Get phases for this mode (if applicable)
    pub fn phases(&self) -> Vec<ModePhase> {
        match self {
            SwarmMode::SwarmAgentic => vec![
                ModePhase::Discovery,
                ModePhase::Execution,
                ModePhase::Selection,
            ],
            SwarmMode::ClaudeSwarm => vec![
                ModePhase::Decomposition,
                ModePhase::Execution,
                ModePhase::QualityGate,
            ],
            SwarmMode::ClosedLoop => vec![
                ModePhase::Brainstorm,
                ModePhase::Plan,
                ModePhase::Work,
                ModePhase::Review,
                ModePhase::Compound,
            ],
            SwarmMode::Hybrid => vec![
                ModePhase::Discovery,    // SwarmAgentic
                ModePhase::Decomposition,
                ModePhase::Execution,    // Claude Swarm
                ModePhase::QualityGate,
                ModePhase::Review,       // ClosedLoop
                ModePhase::Compound,
            ],
        }
    }
}

impl std::fmt::Display for SwarmMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

/// Phases within a swarm mode execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModePhase {
    // SwarmAgentic phases
    Discovery,
    Selection,

    // Claude Swarm phases
    Decomposition,
    QualityGate,

    // ClosedLoop phases
    Brainstorm,
    Plan,
    Work,
    Review,
    Compound,

    // Common
    Execution,
}

impl ModePhase {
    /// Get display name
    pub fn display_name(&self) -> &'static str {
        match self {
            ModePhase::Discovery => "Discovery",
            ModePhase::Selection => "Selection",
            ModePhase::Decomposition => "Decomposition",
            ModePhase::QualityGate => "Quality Gate",
            ModePhase::Brainstorm => "Brainstorm",
            ModePhase::Plan => "Plan",
            ModePhase::Work => "Work",
            ModePhase::Review => "Review",
            ModePhase::Compound => "Compound",
            ModePhase::Execution => "Execution",
        }
    }

    /// Check if this phase is review-oriented
    pub fn is_review(&self) -> bool {
        matches!(self, ModePhase::QualityGate | ModePhase::Review)
    }

    /// Check if this phase produces knowledge
    pub fn produces_knowledge(&self) -> bool {
        matches!(self, ModePhase::Discovery | ModePhase::Compound)
    }
}

/// Configuration for a specific swarm mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeConfig {
    pub mode: SwarmMode,
    pub enabled: bool,
    pub max_agents: usize,
    pub budget_usd: f64,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub options: ModeOptions,
}

impl ModeConfig {
    pub fn new(mode: SwarmMode) -> Self {
        Self {
            mode,
            enabled: true,
            max_agents: mode.default_max_agents(),
            budget_usd: mode.default_budget(),
            timeout_seconds: 3600,
            retry_attempts: 2,
            options: ModeOptions::default_for_mode(mode),
        }
    }

    pub fn disabled(mut self) -> Self {
        self.enabled = false;
        self
    }

    pub fn with_max_agents(mut self, max: usize) -> Self {
        self.max_agents = max;
        self
    }

    pub fn with_budget(mut self, budget: f64) -> Self {
        self.budget_usd = budget;
        self
    }
}

/// Mode-specific options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ModeOptions {
    SwarmAgentic {
        population_size: usize,
        max_iterations: usize,
        inertia_weight: f64,
        cognitive_coefficient: f64,
        social_coefficient: f64,
        convergence_threshold: f64,
    },
    ClaudeSwarm {
        enable_quality_gate: bool,
        quality_gate_model: String,
        file_conflict_detection: bool,
        wave_execution: bool,
    },
    ClosedLoop {
        enable_brainstorm: bool,
        enable_review: bool,
        enable_compound: bool,
        min_reviewers: usize,
        p1_blocking: bool,
    },
    Hybrid {
        sequence: Vec<SwarmMode>,
        transition_criteria: HashMap<String, String>,
    },
}

use std::collections::HashMap;

impl ModeOptions {
    pub fn default_for_mode(mode: SwarmMode) -> Self {
        match mode {
            SwarmMode::SwarmAgentic => ModeOptions::SwarmAgentic {
                population_size: 5,
                max_iterations: 10,
                inertia_weight: 0.7,
                cognitive_coefficient: 1.5,
                social_coefficient: 1.5,
                convergence_threshold: 0.01,
            },
            SwarmMode::ClaudeSwarm => ModeOptions::ClaudeSwarm {
                enable_quality_gate: true,
                quality_gate_model: "claude-opus".to_string(),
                file_conflict_detection: true,
                wave_execution: true,
            },
            SwarmMode::ClosedLoop => ModeOptions::ClosedLoop {
                enable_brainstorm: true,
                enable_review: true,
                enable_compound: true,
                min_reviewers: 2,
                p1_blocking: true,
            },
            SwarmMode::Hybrid => ModeOptions::Hybrid {
                sequence: vec![
                    SwarmMode::SwarmAgentic,
                    SwarmMode::ClaudeSwarm,
                    SwarmMode::ClosedLoop,
                ],
                transition_criteria: HashMap::new(),
            },
        }
    }
}

/// Routing decision with confidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingDecision {
    pub mode: SwarmMode,
    pub confidence: f64,
    pub reasoning: String,
    pub alternatives: Vec<(SwarmMode, f64)>,
}

impl RoutingDecision {
    pub fn new(mode: SwarmMode, confidence: f64, reasoning: String) -> Self {
        Self {
            mode,
            confidence: confidence.clamp(0.0, 1.0),
            reasoning,
            alternatives: Vec::new(),
        }
    }

    pub fn with_alternatives(mut self, alternatives: Vec<(SwarmMode, f64)>) -> Self {
        self.alternatives = alternatives;
        self
    }

    pub fn is_confident(&self) -> bool {
        self.confidence >= 0.8
    }
}
