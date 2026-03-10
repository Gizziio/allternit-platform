use crate::config::RoutingConfig;
use crate::error::{SwarmError, SwarmResult};
use crate::knowledge::KnowledgeStore;
use crate::types::{
    Complexity, Domain, KnowledgeQueryResult, RoutingDecision, SimilarTask, SwarmMode, Task,
    TaskAnalysis,
};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info, warn};

pub mod analyzer;

pub use analyzer::TaskAnalyzer;

/// Routes tasks to appropriate swarm modes
#[derive(Debug, Clone)]
pub struct ModeRouter {
    config: RoutingConfig,
    analyzer: TaskAnalyzer,
}

impl ModeRouter {
    pub fn new(config: &RoutingConfig) -> Self {
        Self {
            config: config.clone(),
            analyzer: TaskAnalyzer::new(config.clone()),
        }
    }

    /// Route a task to the most appropriate swarm mode
    pub async fn route(
        &self,
        task: &Task,
        knowledge: &dyn KnowledgeStore,
    ) -> SwarmResult<RoutingDecision> {
        debug!("Routing task: {}", task.id());

        // Step 1: Check constraints
        if let Some(allowed) = self.check_constraints(task) {
            info!("Task {} constrained to {:?}", task.id(), allowed);
            return Ok(RoutingDecision::new(
                allowed,
                1.0,
                "Mode constrained by task requirements".to_string(),
            ));
        }

        // Step 2: Analyze the task
        let analysis = self.analyzer.analyze(task).await?;

        // Step 3: Query knowledge base for similar tasks
        let similar = knowledge
            .query_similar_tasks(&task.description, self.config.knowledge_query_limit)
            .await?;

        // Step 4: Calculate scores for each mode
        let scores = self.calculate_mode_scores(task, &analysis, &similar);

        // Step 5: Select best mode
        let (best_mode, best_score) = scores
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(m, s)| (*m, *s))
            .unwrap_or((SwarmMode::ClaudeSwarm, 0.5));

        // Step 6: Build alternatives
        let alternatives: Vec<(SwarmMode, f64)> = scores
            .iter()
            .filter(|(m, _)| *m != best_mode)
            .map(|(m, s)| (*m, *s))
            .collect();

        // Step 7: Generate reasoning
        let reasoning = self.generate_reasoning(best_mode, &analysis, &similar);

        let decision = RoutingDecision::new(best_mode, best_score, reasoning)
            .with_alternatives(alternatives);

        info!(
            "Task {} routed to {:?} with confidence {:.2}",
            task.id(),
            decision.mode,
            decision.confidence
        );

        Ok(decision)
    }

    /// Check if task constraints force a specific mode
    fn check_constraints(&self, task: &Task) -> Option<SwarmMode> {
        // Check blocked modes
        for mode in [SwarmMode::SwarmAgentic, SwarmMode::ClaudeSwarm, SwarmMode::ClosedLoop] {
            if !task.constraints.is_mode_allowed(mode) {
                continue;
            }
        }

        // Check if specific modes are required
        if !task.constraints.allowed_modes.is_empty() {
            return task.constraints.allowed_modes.first().copied();
        }

        // Check if production workflow is required
        if task.requires_production_workflow() && self.config.closedloop_review_required {
            return Some(SwarmMode::ClosedLoop);
        }

        None
    }

    /// Calculate scores for each mode
    fn calculate_mode_scores(
        &self,
        task: &Task,
        analysis: &TaskAnalysis,
        similar: &KnowledgeQueryResult,
    ) -> HashMap<SwarmMode, f64> {
        let mut scores = HashMap::new();

        // SwarmAgentic score: higher for novel, complex tasks
        let swarmagentic_score = self.calculate_swarmagentic_score(task, analysis, similar);
        scores.insert(SwarmMode::SwarmAgentic, swarmagentic_score);

        // Claude Swarm score: higher for known, simple tasks
        let claudeswarm_score = self.calculate_claudeswarm_score(task, analysis, similar);
        scores.insert(SwarmMode::ClaudeSwarm, claudeswarm_score);

        // ClosedLoop score: higher for production, review-required tasks
        let closedloop_score = self.calculate_closedloop_score(task, analysis);
        scores.insert(SwarmMode::ClosedLoop, closedloop_score);

        // Hybrid score: complex tasks that might benefit from all modes
        let hybrid_score = self.calculate_hybrid_score(task, analysis);
        scores.insert(SwarmMode::Hybrid, hybrid_score);

        scores
    }

    fn calculate_swarmagentic_score(
        &self,
        _task: &Task,
        analysis: &TaskAnalysis,
        similar: &KnowledgeQueryResult,
    ) -> f64 {
        let mut score = 0.0;

        // Novelty factor: higher novelty = higher score
        score += analysis.novelty_assessment.score * 0.4;

        // Complexity factor: higher complexity = higher score
        score += analysis.complexity_assessment.score * 0.3;

        // Similarity factor: fewer similar tasks = higher score
        let similar_count = similar.solutions.len() as f64;
        let similarity_penalty = (similar_count / 10.0).min(1.0) * 0.2;
        score += 0.2 - similarity_penalty;

        // Domain factor: research/design tasks favor SwarmAgentic
        if matches!(
            analysis.domain_assessment.primary_domain,
            Domain::Research | Domain::Architecture | Domain::Design
        ) {
            score += 0.1;
        }

        score.min(1.0)
    }

    fn calculate_claudeswarm_score(
        &self,
        _task: &Task,
        analysis: &TaskAnalysis,
        similar: &KnowledgeQueryResult,
    ) -> f64 {
        let mut score = 0.0;

        // Inverse novelty: known tasks score higher
        score += (1.0 - analysis.novelty_assessment.score) * 0.3;

        // Inverse complexity: simpler tasks score higher
        score += (1.0 - analysis.complexity_assessment.score) * 0.3;

        // Similarity factor: more similar successful tasks = higher score
        let similar_count = similar.solutions.len() as f64;
        let similarity_bonus = (similar_count / 5.0).min(1.0) * 0.3;
        score += similarity_bonus;

        // Domain factor: coding tasks favor Claude Swarm
        if matches!(
            analysis.domain_assessment.primary_domain,
            Domain::Code | Domain::Analysis
        ) {
            score += 0.1;
        }

        score.min(1.0)
    }

    fn calculate_closedloop_score(&self, task: &Task, analysis: &TaskAnalysis) -> f64 {
        let mut score = 0.0;

        // Review requirement
        if task.requires_production_workflow() {
            score += 0.4;
        }

        // Complexity factor: medium complexity
        if analysis.complexity_assessment.score > 0.3
            && analysis.complexity_assessment.score < 0.8
        {
            score += 0.2;
        }

        // Security sensitivity
        if task.constraints.security_sensitive {
            score += 0.2;
        }

        // Deadline pressure (ClosedLoop has better tracking)
        if task.constraints.deadline.is_some() {
            score += 0.1;
        }

        score.min(1.0)
    }

    fn calculate_hybrid_score(&self, task: &Task, analysis: &TaskAnalysis) -> f64 {
        let mut score = 0.0;

        // Very complex tasks benefit from hybrid
        if analysis.complexity_assessment.score > 0.8 {
            score += 0.4;
        }

        // Tasks with budget for thoroughness
        if task.constraints.max_budget_usd.unwrap_or(0.0) > 15.0 {
            score += 0.3;
        }

        // No time pressure
        if task.constraints.deadline.is_none() {
            score += 0.2;
        }

        score.min(1.0)
    }

    fn generate_reasoning(
        &self,
        mode: SwarmMode,
        analysis: &TaskAnalysis,
        similar: &KnowledgeQueryResult,
    ) -> String {
        let mut reasons = Vec::new();

        reasons.push(format!(
            "Complexity: {:.0}% - {}",
            analysis.complexity_assessment.score * 100.0,
            analysis.complexity_assessment.explanation
        ));

        reasons.push(format!(
            "Novelty: {:.0}% - {}",
            analysis.novelty_assessment.score * 100.0,
            analysis.novelty_assessment.explanation
        ));

        if !similar.solutions.is_empty() {
            reasons.push(format!(
                "Found {} similar past solutions",
                similar.solutions.len()
            ));
        }

        reasons.push(format!("Selected mode: {:?}", mode));

        reasons.join("; ")
    }
}
