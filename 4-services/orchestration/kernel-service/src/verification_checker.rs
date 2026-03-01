use a2rchitech_kernel_contracts::{
    VerificationIssue, VerificationResults, VerificationSeverity, VerifyArtifact,
};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct VerificationCheckResult {
    pub allowed: bool,
    pub reason: String,
    pub confidence: f64,
    pub issues: Vec<VerificationIssue>,
}

#[derive(Debug)]
pub struct VerificationChecker {
    // In a real implementation, this might store verification policies/rules
    // For now, we'll implement basic checks
}

impl VerificationChecker {
    pub fn new() -> Self {
        Self {}
    }

    /// Check if a verification artifact should allow an operation to proceed
    pub async fn check_verification(&self, artifact: &VerifyArtifact) -> VerificationCheckResult {
        let mut issues = Vec::new();
        let mut allowed = true;
        let mut reason = String::new();

        // Check if verification passed
        if !artifact.results.passed {
            allowed = false;
            reason.push_str(&format!(
                "Verification failed: {}",
                artifact
                    .results
                    .details
                    .as_str()
                    .unwrap_or("Unknown failure")
            ));

            // Add any existing issues
            issues.extend(artifact.results.issues.clone());

            // Add a critical issue for failed verification
            issues.push(VerificationIssue {
                issue_type: "VERIFICATION_FAILED".to_string(),
                description: "Verification artifact indicates operation should not proceed"
                    .to_string(),
                severity: VerificationSeverity::Critical,
                location: Some("verification.results.passed".to_string()),
            });
        } else if artifact.results.confidence < 0.5 {
            // Low confidence verification - may want to restrict or log
            issues.push(VerificationIssue {
                issue_type: "LOW_CONFIDENCE".to_string(),
                description: format!(
                    "Verification confidence is low: {:.2}",
                    artifact.results.confidence
                )
                .to_string(),
                severity: VerificationSeverity::Warning,
                location: Some("verification.results.confidence".to_string()),
            });
        }

        // Check for critical issues in the verification results
        for issue in &artifact.results.issues {
            if matches!(
                issue.severity,
                VerificationSeverity::Critical | VerificationSeverity::Error
            ) {
                allowed = false;
                if !reason.is_empty() {
                    reason.push_str("; ");
                }
                reason.push_str(&format!(
                    "Critical verification issue: {}",
                    issue.description
                ));
            }
        }

        if allowed && reason.is_empty() {
            reason = "Verification passed and all checks succeeded".to_string();
        }

        VerificationCheckResult {
            allowed,
            reason,
            confidence: artifact.results.confidence,
            issues,
        }
    }

    /// Check multiple verification artifacts and return the combined result
    pub async fn check_multiple_verifications(
        &self,
        artifacts: &[VerifyArtifact],
    ) -> VerificationCheckResult {
        let mut overall_allowed = true;
        let mut overall_reasons = Vec::new();
        let mut overall_issues = Vec::new();
        let mut min_confidence = 1.0;

        for artifact in artifacts {
            let result = self.check_verification(artifact).await;

            if !result.allowed {
                overall_allowed = false;
                overall_reasons.push(result.reason);
            }

            if result.confidence < min_confidence {
                min_confidence = result.confidence;
            }

            overall_issues.extend(result.issues);
        }

        let final_reason = if overall_reasons.is_empty() {
            "All verifications passed".to_string()
        } else {
            format!("Verification issues: {}", overall_reasons.join("; "))
        };

        VerificationCheckResult {
            allowed: overall_allowed,
            reason: final_reason,
            confidence: min_confidence,
            issues: overall_issues,
        }
    }

    /// Check if an operation should proceed based on verification artifacts
    pub async fn should_allow_operation(&self, artifacts: &[VerifyArtifact]) -> bool {
        if artifacts.is_empty() {
            // If no verification artifacts exist, we might want to be restrictive
            // For now, we'll allow but in a real system you might want to require verification
            return true;
        }

        let result = self.check_multiple_verifications(artifacts).await;
        result.allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_verification_checker() {
        let checker = VerificationChecker::new();

        // Test with a passing verification
        let passing_artifact = VerifyArtifact::new(
            "test-run".to_string(),
            "test-step".to_string(),
            "test-hash".to_string(),
            VerificationResults {
                passed: true,
                details: serde_json::json!({"test": "passed"}),
                confidence: 0.9,
                issues: vec![],
            },
            "test-verifier".to_string(),
        );

        let result = checker.check_verification(&passing_artifact).await;
        assert!(result.allowed);
        assert_eq!(result.confidence, 0.9);

        // Test with a failing verification
        let failing_artifact = VerifyArtifact::new(
            "test-run".to_string(),
            "test-step".to_string(),
            "test-hash".to_string(),
            VerificationResults {
                passed: false,
                details: serde_json::json!({"error": "something went wrong"}),
                confidence: 0.3,
                issues: vec![],
            },
            "test-verifier".to_string(),
        );

        let result = checker.check_verification(&failing_artifact).await;
        assert!(!result.allowed);
        assert!(result.reason.contains("Verification failed"));

        // Test with critical issues
        let critical_artifact = VerifyArtifact::new(
            "test-run".to_string(),
            "test-step".to_string(),
            "test-hash".to_string(),
            VerificationResults {
                passed: true,
                details: serde_json::json!({"test": "passed"}),
                confidence: 0.8,
                issues: vec![VerificationIssue {
                    issue_type: "SECURITY".to_string(),
                    description: "Potential security issue detected".to_string(),
                    severity: VerificationSeverity::Critical,
                    location: Some("test.location".to_string()),
                }],
            },
            "test-verifier".to_string(),
        );

        let result = checker.check_verification(&critical_artifact).await;
        assert!(!result.allowed);
        assert!(result.reason.contains("Critical verification issue"));
    }
}
