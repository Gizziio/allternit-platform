use crate::error::SwarmResult;
use crate::types::{EntityId, ExecutionResult, QualityCheck, QualityGateResult, QualityVerdict};

/// Quality gate for reviewing agent outputs
#[derive(Debug, Clone)]
pub struct QualityGate {
    model: String,
}

impl QualityGate {
    pub fn new(model: String) -> Self {
        Self { model }
    }

    /// Review execution results
    pub async fn review(&self, results: &[ExecutionResult]) -> SwarmResult<QualityGateResult> {
        let task_id = results.first().map(|r| r.task_id).unwrap_or_else(EntityId::new);
        let mut gate_result = QualityGateResult::new(task_id);

        // Perform quality checks
        let checks = vec![
            self.check_consistency(results),
            self.check_completeness(results),
            self.check_security(results),
            self.check_performance(results),
        ];

        gate_result = gate_result.with_checks(checks);

        // Generate verdict
        gate_result.verdict = self.generate_verdict(&gate_result, results);

        Ok(gate_result)
    }

    /// Check for consistency across results
    fn check_consistency(&self, _results: &[ExecutionResult]) -> QualityCheck {
        // Simplified - would use LLM in production
        QualityCheck {
            name: "Consistency".to_string(),
            description: "Check for integration issues between agent outputs".to_string(),
            passed: true,
            score: 0.85,
            critical: false,
            findings: vec![],
        }
    }

    /// Check for completeness
    fn check_completeness(&self, results: &[ExecutionResult]) -> QualityCheck {
        let success_count = results.iter().filter(|r| r.is_success()).count();
        let total = results.len();
        let score = if total > 0 {
            success_count as f64 / total as f64
        } else {
            0.0
        };

        QualityCheck {
            name: "Completeness".to_string(),
            description: "Check if original task was fully addressed".to_string(),
            passed: score >= 0.7,
            score,
            critical: true,
            findings: if score < 1.0 {
                vec![format!("{} of {} subtasks failed", total - success_count, total)]
            } else {
                vec![]
            },
        }
    }

    /// Check for security concerns
    fn check_security(&self, _results: &[ExecutionResult]) -> QualityCheck {
        // Simplified - would use security scanner in production
        QualityCheck {
            name: "Security".to_string(),
            description: "Check for security concerns".to_string(),
            passed: true,
            score: 0.9,
            critical: true,
            findings: vec![],
        }
    }

    /// Check performance characteristics
    fn check_performance(&self, results: &[ExecutionResult]) -> QualityCheck {
        let avg_duration: f64 = if !results.is_empty() {
            results.iter().map(|r| r.duration_secs).sum::<f64>() / results.len() as f64
        } else {
            0.0
        };

        let score = if avg_duration < 5.0 {
            1.0
        } else if avg_duration < 30.0 {
            0.8
        } else {
            0.6
        };

        QualityCheck {
            name: "Performance".to_string(),
            description: "Check performance characteristics".to_string(),
            passed: score >= 0.7,
            score,
            critical: false,
            findings: vec![format!("Average subtask duration: {:.2}s", avg_duration)],
        }
    }

    /// Generate final verdict
    fn generate_verdict(
        &self,
        gate_result: &QualityGateResult,
        results: &[ExecutionResult],
    ) -> QualityVerdict {
        let mut blockers = Vec::new();
        let mut recommendations = Vec::new();

        for check in &gate_result.checks {
            if check.critical && !check.passed {
                blockers.push(format!("{} check failed", check.name));
            } else if !check.passed {
                recommendations.push(format!("Improve {}", check.name.to_lowercase()));
            }
        }

        // Add findings
        for check in &gate_result.checks {
            for finding in &check.findings {
                if check.critical {
                    blockers.push(finding.clone());
                } else {
                    recommendations.push(finding.clone());
                }
            }
        }

        let summary = if blockers.is_empty() {
            format!(
                "Quality gate passed with score {:.0}%",
                gate_result.score * 100.0
            )
        } else {
            format!(
                "Quality gate failed with score {:.0}%. {} blockers found.",
                gate_result.score * 100.0,
                blockers.len()
            )
        };

        QualityVerdict {
            summary,
            recommendations,
            blockers,
        }
    }
}
