//! Reporters Module
//!
//! GC Agent result reporting

use crate::{GcAgentResult, IssueSeverity};
use chrono::Utc;
use std::path::Path;

/// Report generator for GC agent results
pub struct GcReportGenerator;

impl GcReportGenerator {
    pub fn new() -> Self {
        Self
    }

    /// Generate markdown report
    pub fn generate_markdown(&self, results: &[GcAgentResult]) -> String {
        let mut report = String::new();

        report.push_str("# GC Agent Run Report\n\n");
        report.push_str(&format!(
            "**Generated:** {}\n\n",
            Utc::now().format("%Y-%m-%d %H:%M:%S")
        ));

        let total_issues: usize = results.iter().map(|r| r.issues_found.len()).sum();
        let total_fixed: usize = results.iter().map(|r| r.issues_fixed).sum();
        let total_reduction: f64 = results.iter().map(|r| r.entropy_reduction).sum();

        report.push_str("## Summary\n\n");
        report.push_str(&format!("- **Total Issues Found:** {}\n", total_issues));
        report.push_str(&format!("- **Total Issues Fixed:** {}\n", total_fixed));
        report.push_str(&format!(
            "- **Entropy Reduction:** {:.2}\n\n",
            total_reduction
        ));

        report.push_str("## Results by Agent\n\n");

        for result in results {
            report.push_str(&format!("### {}\n\n", result.agent_name));
            report.push_str(&format!(
                "- Executed: {}\n",
                result.executed_at.format("%Y-%m-%d %H:%M:%S")
            ));
            report.push_str(&format!("- Issues Found: {}\n", result.issues_found.len()));
            report.push_str(&format!("- Issues Fixed: {}\n", result.issues_fixed));
            report.push_str(&format!(
                "- Entropy Reduction: {:.2}\n\n",
                result.entropy_reduction
            ));

            if !result.issues_found.is_empty() {
                report.push_str("#### Issues\n\n");
                report.push_str("| Severity | Location | Description |\n");
                report.push_str("|----------|----------|-------------|\n");

                for issue in &result.issues_found {
                    let severity = match issue.severity {
                        IssueSeverity::Critical => "🔴 Critical",
                        IssueSeverity::Error => "🔴 Error",
                        IssueSeverity::Warning => "🟡 Warning",
                        IssueSeverity::Info => "🔵 Info",
                    };

                    let location = issue.location.to_string_lossy();
                    report.push_str(&format!(
                        "| {} | `{}` | {} |\n",
                        severity, location, issue.description
                    ));
                }
                report.push('\n');
            }
        }

        report
    }

    /// Generate JSON report
    pub fn generate_json(&self, results: &[GcAgentResult]) -> String {
        serde_json::to_string_pretty(results).unwrap_or_default()
    }

    /// Save report to file
    pub fn save_report(
        &self,
        results: &[GcAgentResult],
        output_path: &Path,
    ) -> std::io::Result<()> {
        let report = self.generate_markdown(results);
        std::fs::write(output_path, report)
    }
}

impl Default for GcReportGenerator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_report_generation() {
        let results = vec![GcAgentResult {
            agent_name: "test_agent".to_string(),
            executed_at: Utc::now(),
            issues_found: vec![],
            issues_fixed: 0,
            entropy_reduction: 0.0,
            metadata: None,
        }];

        let generator = GcReportGenerator::new();
        let report = generator.generate_markdown(&results);

        assert!(report.contains("GC Agent Run Report"));
        assert!(report.contains("test_agent"));
    }
}
