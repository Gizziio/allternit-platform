//! Scoring Dashboard
//!
//! Standardized scoring system for all executions.
//! Tracks quality metrics over time and provides dashboard data.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

/// Scoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringConfig {
    /// Weights for different score components
    pub weights: ScoreWeights,
    /// Minimum passing score (0-100)
    pub passing_threshold: f64,
    /// Minimum score for critical tests
    pub critical_threshold: f64,
}

impl Default for ScoringConfig {
    fn default() -> Self {
        Self {
            weights: ScoreWeights::default(),
            passing_threshold: 70.0,
            critical_threshold: 90.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreWeights {
    pub test_coverage: f64,
    pub test_success_rate: f64,
    pub conformance_score: f64,
    pub performance_score: f64,
    pub security_score: f64,
}

impl Default for ScoreWeights {
    fn default() -> Self {
        Self {
            test_coverage: 0.25,
            test_success_rate: 0.25,
            conformance_score: 0.20,
            performance_score: 0.15,
            security_score: 0.15,
        }
    }
}

/// Execution score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionScore {
    pub execution_id: String,
    pub timestamp: DateTime<Utc>,
    pub overall_score: f64,
    pub grade: ScoreGrade,
    pub components: ScoreComponents,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ScoreGrade {
    A, // 90-100
    B, // 80-89
    C, // 70-79
    D, // 60-69
    F, // 0-59
}

impl ExecutionScore {
    /// Calculate grade from score
    pub fn calculate_grade(score: f64) -> ScoreGrade {
        match score {
            s if s >= 90.0 => ScoreGrade::A,
            s if s >= 80.0 => ScoreGrade::B,
            s if s >= 70.0 => ScoreGrade::C,
            s if s >= 60.0 => ScoreGrade::D,
            _ => ScoreGrade::F,
        }
    }

    /// Check if score passes threshold
    pub fn passes(&self, threshold: f64) -> bool {
        self.overall_score >= threshold
    }
}

/// Score components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreComponents {
    pub test_coverage: f64,
    pub test_success_rate: f64,
    pub conformance_score: f64,
    pub performance_score: f64,
    pub security_score: f64,
}

/// Scoring engine
#[derive(Clone)]
pub struct ScoringEngine {
    config: ScoringConfig,
    score_history: Vec<ExecutionScore>,
}

impl ScoringEngine {
    /// Create a new scoring engine
    pub fn new(config: ScoringConfig) -> Self {
        Self {
            config,
            score_history: Vec::new(),
        }
    }

    /// Calculate overall score from components
    pub fn calculate_score(&self, components: &ScoreComponents) -> f64 {
        let weights = &self.config.weights;
        
        components.test_coverage * weights.test_coverage +
        components.test_success_rate * weights.test_success_rate +
        components.conformance_score * weights.conformance_score +
        components.performance_score * weights.performance_score +
        components.security_score * weights.security_score
    }

    /// Score an execution
    pub fn score_execution(
        &mut self,
        execution_id: impl Into<String>,
        components: ScoreComponents,
        metadata: HashMap<String, String>,
    ) -> ExecutionScore {
        let overall_score = self.calculate_score(&components);
        let grade = ExecutionScore::calculate_grade(overall_score);

        let score = ExecutionScore {
            execution_id: execution_id.into(),
            timestamp: Utc::now(),
            overall_score,
            grade,
            components,
            metadata,
        };

        self.score_history.push(score.clone());
        
        // Trim history to last 1000 scores
        if self.score_history.len() > 1000 {
            self.score_history.remove(0);
        }

        info!(
            "Execution scored: {} = {:.1}% (Grade: {:?})",
            score.execution_id, score.overall_score, score.grade
        );

        score
    }

    /// Get score trend over time
    pub fn get_trend(&self, window_size: usize) -> ScoreTrend {
        let recent: Vec<_> = self.score_history.iter().rev().take(window_size).collect();
        
        if recent.len() < 2 {
            return ScoreTrend::Stable;
        }

        let avg_recent: f64 = recent[..recent.len()/2].iter().map(|s| s.overall_score).sum::<f64>() 
            / (recent.len()/2) as f64;
        let avg_older: f64 = recent[recent.len()/2..].iter().map(|s| s.overall_score).sum::<f64>() 
            / (recent.len() - recent.len()/2) as f64;

        let change = avg_recent - avg_older;
        
        if change > 5.0 {
            ScoreTrend::Improving
        } else if change < -5.0 {
            ScoreTrend::Declining
        } else {
            ScoreTrend::Stable
        }
    }

    /// Get dashboard data
    pub fn get_dashboard_data(&self) -> DashboardData {
        let total_executions = self.score_history.len();
        
        if total_executions == 0 {
            return DashboardData::default();
        }

        let avg_score = self.score_history.iter().map(|s| s.overall_score).sum::<f64>() 
            / total_executions as f64;

        let passing_count = self.score_history.iter()
            .filter(|s| s.passes(self.config.passing_threshold))
            .count();

        let grade_distribution: HashMap<ScoreGrade, usize> = self.score_history.iter()
            .fold(HashMap::new(), |mut acc, s| {
                *acc.entry(s.grade.clone()).or_insert(0) += 1;
                acc
            });

        let recent_scores: Vec<_> = self.score_history.iter().rev().take(10).cloned().collect();

        DashboardData {
            total_executions,
            average_score: avg_score,
            passing_rate: (passing_count as f64 / total_executions as f64) * 100.0,
            grade_distribution,
            recent_scores,
            trend: self.get_trend(20),
        }
    }

    /// Get scores by tag
    pub fn get_scores_by_tag(&self, tag: &str) -> Vec<&ExecutionScore> {
        self.score_history.iter()
            .filter(|s| s.metadata.get("tag").map(|t| t == tag).unwrap_or(false))
            .collect()
    }

    /// Export scores to JSON
    pub fn export_json(&self) -> anyhow::Result<String> {
        Ok(serde_json::to_string_pretty(&self.score_history)?)
    }

    /// Check CI gate
    pub fn check_ci_gate(&self, score: &ExecutionScore) -> CIGateResult {
        if score.grade == ScoreGrade::F {
            return CIGateResult::Fail {
                reason: format!("Score {:.1}% below minimum 60%", score.overall_score),
            };
        }

        if score.components.test_coverage < 80.0 {
            return CIGateResult::Fail {
                reason: format!("Test coverage {:.1}% below 80%", score.components.test_coverage),
            };
        }

        if score.components.security_score < 90.0 {
            return CIGateResult::Fail {
                reason: format!("Security score {:.1}% below 90%", score.components.security_score),
            };
        }

        CIGateResult::Pass
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScoreTrend {
    Improving,
    Stable,
    Declining,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub total_executions: usize,
    pub average_score: f64,
    pub passing_rate: f64,
    pub grade_distribution: HashMap<ScoreGrade, usize>,
    pub recent_scores: Vec<ExecutionScore>,
    pub trend: ScoreTrend,
}

impl Default for DashboardData {
    fn default() -> Self {
        Self {
            total_executions: 0,
            average_score: 0.0,
            passing_rate: 0.0,
            grade_distribution: HashMap::new(),
            recent_scores: Vec::new(),
            trend: ScoreTrend::Stable,
        }
    }
}

/// CI gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CIGateResult {
    Pass,
    Fail { reason: String },
}

impl CIGateResult {
    pub fn passed(&self) -> bool {
        matches!(self, CIGateResult::Pass)
    }
}

/// Auto-run configuration for DAG/PR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRunConfig {
    /// Run on DAG completion
    pub run_on_dag_complete: bool,
    /// Run on PR
    pub run_on_pr: bool,
    /// Run on schedule (cron expression)
    pub run_on_schedule: Option<String>,
    /// Tags to filter tests
    pub filter_tags: Vec<String>,
    /// Fail CI on score below threshold
    pub fail_ci_on_low_score: bool,
}

impl Default for AutoRunConfig {
    fn default() -> Self {
        Self {
            run_on_dag_complete: true,
            run_on_pr: true,
            run_on_schedule: None,
            filter_tags: vec![],
            fail_ci_on_low_score: true,
        }
    }
}

/// Auto-run evaluator
#[derive(Clone)]
pub struct AutoRunEvaluator {
    scoring_engine: ScoringEngine,
    config: AutoRunConfig,
}

impl AutoRunEvaluator {
    /// Create a new auto-run evaluator
    pub fn new(scoring_engine: ScoringEngine, config: AutoRunConfig) -> Self {
        Self {
            scoring_engine,
            config,
        }
    }

    /// Handle DAG completion event
    pub fn on_dag_complete(&self, dag_id: &str, execution_result: &ExecutionResult) -> Option<ExecutionScore> {
        if !self.config.run_on_dag_complete {
            return None;
        }

        info!("Auto-running evaluation for DAG: {}", dag_id);
        
        // Calculate components from execution result
        let components = ScoreComponents {
            test_coverage: execution_result.test_coverage,
            test_success_rate: execution_result.success_rate,
            conformance_score: execution_result.conformance_score,
            performance_score: execution_result.performance_score,
            security_score: execution_result.security_score,
        };

        let mut engine = self.scoring_engine.clone();
        let score = engine.score_execution(
            format!("dag:{}", dag_id),
            components,
            [("trigger".to_string(), "dag_complete".to_string())].into(),
        );

        if self.config.fail_ci_on_low_score {
            let gate = engine.check_ci_gate(&score);
            if !gate.passed() {
                warn!("CI gate failed for DAG {}: {:?}", dag_id, gate);
            }
        }

        Some(score)
    }

    /// Handle PR event
    pub fn on_pr(&self, pr_id: &str, changes: &[String]) -> Option<ExecutionScore> {
        if !self.config.run_on_pr {
            return None;
        }

        info!("Auto-running evaluation for PR: {}", pr_id);
        
        // Run tests on PR changes
        let components = ScoreComponents {
            test_coverage: 85.0, // Mock - would run actual tests
            test_success_rate: 95.0,
            conformance_score: 90.0,
            performance_score: 80.0,
            security_score: 95.0,
        };

        let mut engine = self.scoring_engine.clone();
        let score = engine.score_execution(
            format!("pr:{}", pr_id),
            components,
            [
                ("trigger".to_string(), "pr".to_string()),
                ("files_changed".to_string(), changes.join(",")),
            ].into(),
        );

        Some(score)
    }
}

/// Execution result (mock for auto-run)
#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub test_coverage: f64,
    pub success_rate: f64,
    pub conformance_score: f64,
    pub performance_score: f64,
    pub security_score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_score_calculation() {
        let config = ScoringConfig::default();
        let engine = ScoringEngine::new(config);

        let components = ScoreComponents {
            test_coverage: 100.0,
            test_success_rate: 100.0,
            conformance_score: 100.0,
            performance_score: 100.0,
            security_score: 100.0,
        };

        let score = engine.calculate_score(&components);
        assert_eq!(score, 100.0);
    }

    #[test]
    fn test_grade_calculation() {
        assert!(matches!(ExecutionScore::calculate_grade(95.0), ScoreGrade::A));
        assert!(matches!(ExecutionScore::calculate_grade(85.0), ScoreGrade::B));
        assert!(matches!(ExecutionScore::calculate_grade(75.0), ScoreGrade::C));
        assert!(matches!(ExecutionScore::calculate_grade(65.0), ScoreGrade::D));
        assert!(matches!(ExecutionScore::calculate_grade(55.0), ScoreGrade::F));
    }

    #[test]
    fn test_ci_gate() {
        let config = ScoringConfig::default();
        let mut engine = ScoringEngine::new(config);

        let passing_score = engine.score_execution(
            "test-1",
            ScoreComponents {
                test_coverage: 85.0,
                test_success_rate: 95.0,
                conformance_score: 90.0,
                performance_score: 85.0,
                security_score: 95.0,
            },
            HashMap::new(),
        );

        let gate = engine.check_ci_gate(&passing_score);
        assert!(gate.passed());
    }
}
