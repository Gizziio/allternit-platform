//! CI Integration
//!
//! Integrates evaluation harness with CI/CD pipelines.
//! Provides gates, reports, and webhook support.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};

use crate::scoring::{CIGateResult, ExecutionScore, ScoreGrade};

/// CI provider type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CIProvider {
    GitHubActions,
    GitLabCI,
    Jenkins,
    CircleCI,
    Travis,
    Custom(String),
}

/// CI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CIConfig {
    pub provider: CIProvider,
    /// Required score threshold (0-100)
    pub required_score: f64,
    /// Required grade
    pub required_grade: ScoreGrade,
    /// Minimum test coverage
    pub min_coverage: f64,
    /// Minimum security score
    pub min_security_score: f64,
    /// Block merge on failure
    pub block_merge_on_failure: bool,
    /// Post comments on PR
    pub post_pr_comments: bool,
    /// Webhook URL for notifications
    pub webhook_url: Option<String>,
}

impl Default for CIConfig {
    fn default() -> Self {
        Self {
            provider: CIProvider::GitHubActions,
            required_score: 70.0,
            required_grade: ScoreGrade::C,
            min_coverage: 80.0,
            min_security_score: 90.0,
            block_merge_on_failure: true,
            post_pr_comments: true,
            webhook_url: None,
        }
    }
}

/// CI reporter
pub struct CIReporter {
    config: CIConfig,
}

impl CIReporter {
    /// Create a new CI reporter
    pub fn new(config: CIConfig) -> Self {
        Self { config }
    }

    /// Generate CI report
    pub fn generate_report(&self, score: &ExecutionScore) -> CIReport {
        let gate_results = vec![
            ("Score Threshold".to_string(), self.check_score_threshold(score)),
            ("Grade Requirement".to_string(), self.check_grade_requirement(score)),
            ("Coverage Requirement".to_string(), self.check_coverage_requirement(score)),
            ("Security Requirement".to_string(), self.check_security_requirement(score)),
        ];

        let all_passed = gate_results.iter().all(|(_, r)| r.passed());

        CIReport {
            timestamp: Utc::now(),
            score: score.clone(),
            gate_results,
            overall_status: if all_passed {
                CIStatus::Passed
            } else {
                CIStatus::Failed
            },
            merge_allowed: all_passed || !self.config.block_merge_on_failure,
            summary: self.generate_summary(score, all_passed),
        }
    }

    /// Check score threshold
    fn check_score_threshold(&self, score: &ExecutionScore) -> CIGateResult {
        if score.overall_score >= self.config.required_score {
            CIGateResult::Pass
        } else {
            CIGateResult::Fail {
                reason: format!(
                    "Score {:.1}% below required {:.1}%",
                    score.overall_score, self.config.required_score
                ),
            }
        }
    }

    /// Check grade requirement
    fn check_grade_requirement(&self, score: &ExecutionScore) -> CIGateResult {
        let score_grade_level = grade_level(&score.grade);
        let required_grade_level = grade_level(&self.config.required_grade);

        if score_grade_level >= required_grade_level {
            CIGateResult::Pass
        } else {
            CIGateResult::Fail {
                reason: format!(
                    "Grade {:?} below required {:?}",
                    score.grade, self.config.required_grade
                ),
            }
        }
    }

    /// Check coverage requirement
    fn check_coverage_requirement(&self, score: &ExecutionScore) -> CIGateResult {
        if score.components.test_coverage >= self.config.min_coverage {
            CIGateResult::Pass
        } else {
            CIGateResult::Fail {
                reason: format!(
                    "Coverage {:.1}% below required {:.1}%",
                    score.components.test_coverage, self.config.min_coverage
                ),
            }
        }
    }

    /// Check security requirement
    fn check_security_requirement(&self, score: &ExecutionScore) -> CIGateResult {
        if score.components.security_score >= self.config.min_security_score {
            CIGateResult::Pass
        } else {
            CIGateResult::Fail {
                reason: format!(
                    "Security score {:.1}% below required {:.1}%",
                    score.components.security_score, self.config.min_security_score
                ),
            }
        }
    }

    /// Generate summary text
    fn generate_summary(&self, score: &ExecutionScore, passed: bool) -> String {
        let emoji = if passed { "✅" } else { "❌" };
        format!(
            "{} A2R Evaluation Results\n\n\
            **Score**: {:.1}% (Grade: {:?})\n\
            **Status**: {}\n\n\
            **Components**:\n\
            - Test Coverage: {:.1}%\n\
            - Test Success: {:.1}%\n\
            - Conformance: {:.1}%\n\
            - Performance: {:.1}%\n\
            - Security: {:.1}%\n\n\
            {}",
            emoji,
            score.overall_score,
            score.grade,
            if passed { "PASSED" } else { "FAILED" },
            score.components.test_coverage,
            score.components.test_success_rate,
            score.components.conformance_score,
            score.components.performance_score,
            score.components.security_score,
            if passed {
                "✅ All CI gates passed. Merge allowed.".to_string()
            } else {
                "❌ Some CI gates failed. Please fix issues before merging.".to_string()
            }
        )
    }

    /// Format report for GitHub Actions
    pub fn format_for_github(&self, report: &CIReport) -> String {
        let mut output = String::new();
        
        // GitHub Actions annotation format
        for (gate_name, result) in &report.gate_results {
            match result {
                CIGateResult::Pass => {}
                CIGateResult::Fail { reason } => {
                    output.push_str(&format!(
                        "::error title={}::{}{}",
                        gate_name, reason, "\n"
                    ));
                }
            }
        }

        output.push_str(&format!(
            "::set-output name=score::{:.1}\n",
            report.score.overall_score
        ));
        output.push_str(&format!(
            "::set-output name=passed::{}\n",
            report.overall_status == CIStatus::Passed
        ));

        output
    }

    /// Format report for GitLab CI
    pub fn format_for_gitlab(&self, report: &CIReport) -> String {
        let mut output = String::new();

        output.push_str(&format!(
            "A2R_SCORE={:.1}\n",
            report.score.overall_score
        ));
        output.push_str(&format!(
            "A2R_PASSED={}\n",
            report.overall_status == CIStatus::Passed
        ));
        output.push_str(&format!(
            "A2R_GRADE={:?}\n",
            report.score.grade
        ));

        output
    }

    /// Send webhook notification
    pub async fn send_webhook(&self, report: &CIReport) -> anyhow::Result<()> {
        if let Some(url) = &self.config.webhook_url {
            info!("Sending CI report to webhook: {}", url);
            
            let payload = serde_json::json!({
                "timestamp": report.timestamp,
                "score": report.score.overall_score,
                "grade": report.score.grade,
                "status": report.overall_status,
                "merge_allowed": report.merge_allowed,
                "components": report.score.components,
            });

            // In a real implementation, this would make an HTTP POST request
            info!("Webhook payload: {}", payload);
        }

        Ok(())
    }

    /// Write JUnit XML report
    pub fn write_junit_report(&self, report: &CIReport, path: &std::path::Path) -> anyhow::Result<()> {
        let mut xml = String::new();
        xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.push_str("<testsuites>\n");
        xml.push_str(&format!(
            "  <testsuite name=\"A2R Evaluation\" tests=\"5\" failures=\"{}\" errors=\"0\" timestamp=\"{}\">\n",
            report.gate_results.iter().filter(|(_, r)| !r.passed()).count(),
            report.timestamp
        ));

        for (gate_name, result) in &report.gate_results {
            xml.push_str(&format!("    <testcase name=\"{}\" classname=\"CI Gate\">\n", gate_name));
            match result {
                CIGateResult::Fail { reason } => {
                    xml.push_str(&format!(
                        "      <failure message=\"{}\"/>\n",
                        reason
                    ));
                }
                _ => {}
            }
            xml.push_str("    </testcase>\n");
        }

        xml.push_str("  </testsuite>\n");
        xml.push_str("</testsuites>\n");

        std::fs::write(path, xml)?;
        info!("JUnit report written to: {}", path.display());
        
        Ok(())
    }

    /// Exit with appropriate code for CI
    pub fn exit_code(&self, report: &CIReport) -> i32 {
        if report.overall_status == CIStatus::Passed {
            0
        } else {
            1
        }
    }
}

/// CI report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CIReport {
    pub timestamp: chrono::DateTime<Utc>,
    pub score: ExecutionScore,
    pub gate_results: Vec<(String, CIGateResult)>,
    pub overall_status: CIStatus,
    pub merge_allowed: bool,
    pub summary: String,
}

/// CI status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CIStatus {
    Passed,
    Failed,
}

/// Convert grade to numeric level (higher is better)
fn grade_level(grade: &ScoreGrade) -> u8 {
    match grade {
        ScoreGrade::A => 5,
        ScoreGrade::B => 4,
        ScoreGrade::C => 3,
        ScoreGrade::D => 2,
        ScoreGrade::F => 1,
    }
}

/// CI pipeline integration
pub struct CIPipeline {
    reporter: CIReporter,
    config: CIConfig,
}

impl CIPipeline {
    /// Create a new CI pipeline
    pub fn new(config: CIConfig) -> Self {
        let reporter = CIReporter::new(config.clone());
        Self { reporter, config }
    }

    /// Run full CI pipeline
    pub fn run(&self, score: &ExecutionScore) -> CIReport {
        info!("Running CI pipeline for execution: {}", score.execution_id);
        
        let report = self.reporter.generate_report(score);
        
        // Output formatted report based on provider
        let formatted = match self.config.provider {
            CIProvider::GitHubActions => self.reporter.format_for_github(&report),
            CIProvider::GitLabCI => self.reporter.format_for_gitlab(&report),
            _ => report.summary.clone(),
        };

        println!("{}", formatted);

        // Write JUnit report
        let junit_path = std::path::PathBuf::from("a2r-evaluation.xml");
        if let Err(e) = self.reporter.write_junit_report(&report, &junit_path) {
            warn!("Failed to write JUnit report: {}", e);
        }

        report
    }

    /// Check if merge should be blocked
    pub fn should_block_merge(&self, report: &CIReport) -> bool {
        self.config.block_merge_on_failure && report.overall_status == CIStatus::Failed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scoring::{ScoreComponents, ScoringConfig, ScoringEngine};

    #[test]
    fn test_ci_report_generation() {
        let config = CIConfig::default();
        let reporter = CIReporter::new(config);

        let score = ExecutionScore {
            execution_id: "test-1".to_string(),
            timestamp: Utc::now(),
            overall_score: 85.0,
            grade: ScoreGrade::B,
            components: ScoreComponents {
                test_coverage: 85.0,
                test_success_rate: 95.0,
                conformance_score: 90.0,
                performance_score: 80.0,
                security_score: 95.0,
            },
            metadata: HashMap::new(),
        };

        let report = reporter.generate_report(&score);
        assert_eq!(report.overall_status, CIStatus::Passed);
        assert!(report.merge_allowed);
    }

    #[test]
    fn test_ci_failures() {
        let config = CIConfig {
            required_score: 90.0,
            ..Default::default()
        };
        let reporter = CIReporter::new(config);

        let score = ExecutionScore {
            execution_id: "test-2".to_string(),
            timestamp: Utc::now(),
            overall_score: 85.0,
            grade: ScoreGrade::B,
            components: ScoreComponents {
                test_coverage: 85.0,
                test_success_rate: 95.0,
                conformance_score: 90.0,
                performance_score: 80.0,
                security_score: 95.0,
            },
            metadata: HashMap::new(),
        };

        let report = reporter.generate_report(&score);
        assert_eq!(report.overall_status, CIStatus::Failed);
        assert!(!report.merge_allowed);
    }
}
