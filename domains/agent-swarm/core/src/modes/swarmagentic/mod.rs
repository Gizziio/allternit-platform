use crate::controller::SwarmModeImplementation;
use crate::error::{SwarmError, SwarmResult};
use crate::knowledge::KnowledgeStore;
use crate::types::{
    AgentRole, AgentTeam, CollaborationTopology, Cost, EntityId, ExecutionResult, Metadata,
    ModeConfig, ModeOptions, Particle, Pattern, PatternContent, PatternType, Status, SwarmMode,
    Task,
};
use async_trait::async_trait;
use std::sync::Arc;
use tracing::{info, warn};

pub mod pso;

pub use pso::PSOEngine;

/// Auto-Architect Mode using SwarmAgentic PSO
#[derive(Debug, Clone)]
pub struct AutoArchitectMode {
    config: ModeConfig,
    knowledge: Arc<dyn KnowledgeStore>,
}

/// Result of architecture discovery
#[derive(Debug, Clone)]
pub struct DiscoveryResult {
    pub pattern: Pattern,
    pub architecture: AgentTeam,
    pub score: f64,
}

impl AutoArchitectMode {
    pub fn new(
        config: ModeConfig,
        knowledge: Arc<dyn KnowledgeStore>,
    ) -> SwarmResult<Self> {
        Ok(Self { config, knowledge })
    }

    /// Discover optimal architecture for a task
    pub async fn discover_architecture(
        &self,
        task: Task,
    ) -> SwarmResult<DiscoveryResult> {
        info!("Starting architecture discovery for task {}", task.id());

        // Extract PSO parameters from config
        let (population_size, max_iterations, inertia, cognitive, social, convergence_threshold) =
            match self.config.options {
                ModeOptions::SwarmAgentic {
                    population_size,
                    max_iterations,
                    inertia_weight,
                    cognitive_coefficient,
                    social_coefficient,
                    convergence_threshold,
                } => (
                    population_size,
                    max_iterations,
                    inertia_weight,
                    cognitive_coefficient,
                    social_coefficient,
                    convergence_threshold,
                ),
                _ => (5, 10, 0.7, 1.5, 1.5, 0.01),
            };

        // Initialize particles with candidate architectures
        let mut particles = Vec::new();
        for i in 0..population_size {
            let team = self.generate_candidate_team(&task, i);
            let particle = Particle::new(team, 10);
            particles.push(particle);
        }

        // Run PSO optimization
        let mut pso = PSOEngine::new(
            population_size,
            max_iterations,
            inertia,
            cognitive,
            social,
            convergence_threshold,
        );

        let best_particle = pso.optimize(&mut particles, |particle| {
            // Evaluate fitness: simulate execution score
            self.evaluate_team_fitness(&particle.team, &task)
        }).await?;

        // Create pattern from best architecture
        let pattern = Pattern::new(
            format!("discovered_architecture_{}", task.id()),
            PatternType::Architecture,
        )
        .with_description(format!(
            "Auto-discovered optimal architecture for: {}",
            task.description
        ))
        .with_domain(format!("{:?}", task.classification.domain));

        let pattern_content = PatternContent {
            problem_template: task.description.clone(),
            solution_template: format!("Use team: {:?}", best_particle.team),
            example_usage: vec![],
            caveats: vec![],
            metadata: {
                let mut m = std::collections::HashMap::new();
                m.insert(
                    "agent_count".to_string(),
                    serde_json::json!(best_particle.team.agents.len()),
                );
                m.insert("score".to_string(), serde_json::json!(best_particle.score));
                m
            },
        };

        info!(
            "Architecture discovery complete. Best score: {:.2}",
            best_particle.score
        );

        Ok(DiscoveryResult {
            pattern,
            architecture: best_particle.team.clone(),
            score: best_particle.score,
        })
    }

    /// Generate a candidate agent team
    fn generate_candidate_team(&self, task: &Task, index: usize) -> AgentTeam {
        let mut team = AgentTeam::new(
            format!("candidate_team_{}", index),
            task.id(),
        );

        // Generate different team compositions based on index
        let roles = match index % 5 {
            0 => vec![AgentRole::researcher(), AgentRole::coder()],
            1 => vec![AgentRole::researcher(), AgentRole::coder(), AgentRole::tester()],
            2 => vec![AgentRole::architect(), AgentRole::coder(), AgentRole::reviewer()],
            3 => vec![
                AgentRole::researcher(),
                AgentRole::coder(),
                AgentRole::tester(),
                AgentRole::reviewer(),
            ],
            _ => vec![
                AgentRole::architect(),
                AgentRole::researcher(),
                AgentRole::coder(),
                AgentRole::tester(),
                AgentRole::reviewer(),
            ],
        };

        // Assign agent IDs (would be actual agent creation in production)
        for (i, role) in roles.iter().enumerate() {
            let agent_id = EntityId::new();
            team.add_agent(agent_id);
        }

        // Set topology based on team size
        let topology = if team.agents.len() <= 2 {
            CollaborationTopology::sequential()
        } else if team.agents.len() <= 4 {
            CollaborationTopology::parallel()
        } else {
            let center = team.agents[0];
            CollaborationTopology::hub_and_spoke(center)
        };

        team.with_topology(topology)
    }

    /// Evaluate fitness of a team for a task
    fn evaluate_team_fitness(&self, team: &AgentTeam, task: &Task) -> f64 {
        // Simple heuristic-based scoring
        let mut score = 0.5;

        // Factor 1: Team size appropriateness
        let optimal_size = match task.classification.complexity {
            crate::types::Complexity::Trivial | crate::types::Complexity::Low => 2,
            crate::types::Complexity::Medium => 3,
            crate::types::Complexity::High => 4,
            crate::types::Complexity::Extreme => 5,
        };

        let size_diff = (team.agents.len() as i32 - optimal_size as i32).abs();
        score -= size_diff as f64 * 0.05;

        // Factor 2: Topology appropriateness
        score += 0.1; // Simplified

        // Factor 3: Domain match (simplified)
        score += 0.1;

        score.clamp(0.0, 1.0)
    }
}

#[async_trait]
impl SwarmModeImplementation for AutoArchitectMode {
    async fn execute(&self, task: Task) -> SwarmResult<ExecutionResult> {
        let discovery = self.discover_architecture(task.clone()).await?;

        // Store discovered pattern
        self.knowledge.store_pattern(discovery.pattern.clone()).await?;

        Ok(ExecutionResult::success(
            task.id(),
            format!(
                "Discovered optimal architecture with score {:.2}: {:?}",
                discovery.score, discovery.architecture
            ),
        ))
    }

    fn mode(&self) -> SwarmMode {
        SwarmMode::SwarmAgentic
    }

    async fn shutdown(&self) -> SwarmResult<()> {
        info!("AutoArchitectMode shutdown");
        Ok(())
    }
}
