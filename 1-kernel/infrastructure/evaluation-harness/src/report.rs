//! Report Module
//!
//! Generates evaluation reports in various formats.

use crate::{HarnessError, TestSuiteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Report format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportFormat {
    Json,
    JUnit,
    Html,
    Markdown,
    Text,
}

/// Evaluation reporter
pub struct EvaluationReporter {
    output_dir: PathBuf,
    format: ReportFormat,
}

impl EvaluationReporter {
    /// Create a new reporter
    pub fn new(output_dir: &PathBuf, format: ReportFormat) -> Self {
        Self {
            output_dir: output_dir.clone(),
            format,
        }
    }

    /// Generate report for a test suite result
    pub async fn report_suite(&self, result: &TestSuiteResult) -> Result<(), HarnessError> {
        // Ensure output directory exists
        tokio::fs::create_dir_all(&self.output_dir).await
            .map_err(|e| HarnessError::ReportError(format!("Failed to create output dir: {}", e)))?;

        let report_path = self.output_dir.join(format!("{}.json", result.suite_id));
        
        let report_json = serde_json::to_string_pretty(result)
            .map_err(|e| HarnessError::ReportError(format!("Failed to serialize report: {}", e)))?;
        
        tokio::fs::write(&report_path, report_json).await
            .map_err(|e| HarnessError::ReportError(format!("Failed to write report: {}", e)))?;

        Ok(())
    }

    /// Generate a summary report across all suites
    pub async fn report_summary(
        &self,
        suite_results: &[&TestSuiteResult],
    ) -> Result<(), HarnessError> {
        let summary_path = self.output_dir.join("summary.json");
        
        let summary = serde_json::json!({
            "total_suites": suite_results.len(),
            "suites": suite_results.iter().map(|r| {
                serde_json::json!({
                    "suite_id": r.suite_id,
                    "passed": r.summary.passed,
                    "failed": r.summary.failed,
                    "skipped": r.summary.skipped,
                    "errors": r.summary.errors,
                    "total": r.summary.total,
                    "pass_rate": r.summary.pass_rate(),
                })
            }).collect::<Vec<_>>(),
        });
        
        tokio::fs::write(&summary_path, serde_json::to_string_pretty(&summary).unwrap()).await
            .map_err(|e| HarnessError::ReportError(format!("Failed to write summary: {}", e)))?;

        Ok(())
    }
}
