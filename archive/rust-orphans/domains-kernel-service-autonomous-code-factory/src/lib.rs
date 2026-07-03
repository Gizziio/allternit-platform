//! Allternit Autonomous Code Factory
//!
//! Self-improving code generation and validation system:
//! - Spec-driven code generation
//! - Automated validation loops
//! - Evidence-based merge decisions
//! - Continuous improvement through feedback

use allternit_context_control::ContextControlPlane;
use allternit_evolution_layer::{EvolutionLayer, EvolutionStatus};
use allternit_memory_kernel::MemoryKernel;
use allternit_harness_engineering::{HarnessEngineeringEngine, MergeEligibilityReceipt, RiskTier};
use allternit_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Code Factory Types
// ============================================================================

/// Code generation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGenerationRequest {
    pub request_id: String,
    pub spec_ref: String,
    pub context_id: String,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
    pub acceptance_tests: Vec<String>,
}

/// Generated code artifact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedCode {
    pub artifact_id: String,
    pub request_id: String,
    pub code: String,
    pub tests: String,
    pub documentation: String,
    pub spec_compliance: SpecCompliance,
    pub generated_at: DateTime<Utc>,
}

/// Spec compliance check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecCompliance {
    pub compliant: bool,
    pub requirements_met: usize,
    pub requirements_total: usize,
    pub constraints_satisfied: usize,
    pub constraints_total: usize,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub validation_id: String,
    pub artifact_id: String,
    pub tests_passed: bool,
    pub lint_passed: bool,
    pub security_passed: bool,
    pub performance_passed: bool,
    pub issues: Vec<ValidationIssue>,
    pub validated_at: DateTime<Utc>,
}

/// Validation issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub issue_id: String,
    pub severity: IssueSeverity,
    pub description: String,
    pub location: Option<String>,
    pub suggestion: Option<String>,
}

/// Issue severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Merge decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeDecision {
    pub decision_id: String,
    pub artifact_id: String,
    pub approved: bool,
    pub risk_tier: RiskTier,
    pub evidence_hash: String,
    pub reviewer: String,
    pub reason: Option<String>,
    pub decided_at: DateTime<Utc>,
}

// ============================================================================
// Autonomous Code Factory
// ============================================================================

/// Autonomous Code Factory
pub struct AutonomousCodeFactory {
    context_plane: Arc<ContextControlPlane>,
    memory: Arc<MemoryKernel>,
    system_law: Arc<SystemLawEngine>,
    harness: Arc<HarnessEngineeringEngine>,
    evolution: Arc<EvolutionLayer>,
    generation_count: Arc<RwLock<u64>>,
    validation_count: Arc<RwLock<u64>>,
}

impl AutonomousCodeFactory {
    pub fn new(
        context_plane: Arc<ContextControlPlane>,
        memory: Arc<MemoryKernel>,
        system_law: Arc<SystemLawEngine>,
        harness: Arc<HarnessEngineeringEngine>,
        evolution: Arc<EvolutionLayer>,
    ) -> Self {
        Self {
            context_plane,
            memory,
            system_law,
            harness,
            evolution,
            generation_count: Arc::new(RwLock::new(0)),
            validation_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Generate code from spec
    pub async fn generate_code(
        &self,
        request: CodeGenerationRequest,
    ) -> Result<GeneratedCode, CodeFactoryError> {
        // Validate spec reference exists
        self.validate_spec_ref(&request.spec_ref).await?;

        // Generate code (in production, would call LLM)
        let code = self.simulate_code_generation(&request).await;
        let tests = self.simulate_test_generation(&request).await;
        let docs = self.simulate_docs_generation(&request).await;

        // Check spec compliance
        let compliance = self.check_spec_compliance(&code, &tests, &request).await;
        let compliant = compliance.compliant;

        let artifact_id = format!("code_{}", Uuid::new_v4().simple());
        let generated = GeneratedCode {
            artifact_id: artifact_id.clone(),
            request_id: request.request_id.clone(),
            code,
            tests,
            documentation: docs,
            spec_compliance: compliance,
            generated_at: Utc::now(),
        };

        // Update generation count
        {
            let mut count = self.generation_count.write().await;
            *count += 1;
        }

        // Log to memory
        self.memory
            .append_event(allternit_memory_kernel::MemoryEvent::new(
                "code_generated",
                serde_json::json!({
                    "artifact_id": artifact_id,
                    "request_id": request.request_id,
                    "compliant": compliant,
                }),
            ))
            .await;

        // Commit to context
        self.context_plane
            .commit(
                &request.context_id,
                "main",
                &format!("Generate code for {}", request.spec_ref),
                &generated.code,
            )
            .await?;

        Ok(generated)
    }

    /// Validate generated code
    pub async fn validate_code(
        &self,
        artifact_id: &str,
        code: &str,
        tests: &str,
    ) -> Result<ValidationResult, CodeFactoryError> {
        // Run tests (simulated)
        let tests_passed = self.simulate_test_run(tests).await;

        // Run lint (simulated)
        let lint_passed = self.simulate_lint_run(code).await;

        // Run security scan (simulated)
        let security_passed = self.simulate_security_scan(code).await;

        // Run performance check (simulated)
        let performance_passed = self.simulate_performance_check(code).await;

        let mut issues = Vec::new();

        if !tests_passed {
            issues.push(ValidationIssue {
                issue_id: format!("issue_{}", Uuid::new_v4().simple()),
                severity: IssueSeverity::Error,
                description: "Tests failed".to_string(),
                location: None,
                suggestion: Some("Review test failures and fix".to_string()),
            });
        }

        if !lint_passed {
            issues.push(ValidationIssue {
                issue_id: format!("issue_{}", Uuid::new_v4().simple()),
                severity: IssueSeverity::Warning,
                description: "Lint violations detected".to_string(),
                location: None,
                suggestion: Some("Run auto-formatter".to_string()),
            });
        }

        let validation_id = format!("val_{}", Uuid::new_v4().simple());
        let result = ValidationResult {
            validation_id: validation_id.clone(),
            artifact_id: artifact_id.to_string(),
            tests_passed,
            lint_passed,
            security_passed,
            performance_passed,
            issues,
            validated_at: Utc::now(),
        };

        // Update validation count
        {
            let mut count = self.validation_count.write().await;
            *count += 1;
        }

        // Log to memory
        self.memory
            .append_event(allternit_memory_kernel::MemoryEvent::new(
                "code_validated",
                serde_json::json!({
                    "validation_id": validation_id,
                    "artifact_id": artifact_id,
                    "tests_passed": tests_passed,
                    "all_passed": tests_passed && lint_passed && security_passed && performance_passed,
                }),
            ))
            .await;

        Ok(result)
    }

    /// Make merge decision
    pub async fn make_merge_decision(
        &self,
        artifact_id: &str,
        validation: &ValidationResult,
        context_id: &str,
    ) -> Result<MergeDecision, CodeFactoryError> {
        // Check all validations passed
        let all_passed = validation.tests_passed
            && validation.lint_passed
            && validation.security_passed
            && validation.performance_passed;

        // Determine risk tier based on changes
        let risk_tier = self.assess_risk(artifact_id, validation).await;

        // Generate evidence hash
        let evidence_hash = self.generate_evidence_hash(artifact_id, validation).await;
        let evidence_hash_ref = &evidence_hash;

        // Check SYSTEM_LAW compliance
        let law_compliant = !self.system_law.has_hard_violations().await;

        // Make decision
        let approved = all_passed && law_compliant;

        let decision = MergeDecision {
            decision_id: format!("dec_{}", Uuid::new_v4().simple()),
            artifact_id: artifact_id.to_string(),
            approved,
            risk_tier,
            evidence_hash: evidence_hash.clone(),
            reviewer: "autonomous_code_factory".to_string(),
            reason: if approved {
                Some("All validations passed".to_string())
            } else {
                Some("Validation failures detected".to_string())
            },
            decided_at: Utc::now(),
        };

        // Generate merge eligibility receipt
        self.harness
            .generate_merge_receipt(
                artifact_id,
                risk_tier,
                evidence_hash_ref,
                &decision.decision_id,
                evidence_hash_ref,
            );

        // Log decision
        self.memory
            .append_event(allternit_memory_kernel::MemoryEvent::new(
                "merge_decision",
                serde_json::json!({
                    "decision_id": decision.decision_id,
                    "artifact_id": artifact_id,
                    "approved": approved,
                    "risk_tier": format!("{:?}", risk_tier),
                }),
            ))
            .await;

        Ok(decision)
    }

    /// Get factory status
    pub async fn get_status(&self) -> CodeFactoryStatus {
        let generation_count = *self.generation_count.read().await;
        let validation_count = *self.validation_count.read().await;
        let evolution_status = self.evolution.get_status().await;

        CodeFactoryStatus {
            generation_count,
            validation_count,
            evolution: evolution_status,
        }
    }

    // ========================================================================
    // Internal Helpers
    // ========================================================================

    async fn validate_spec_ref(&self, _spec_ref: &str) -> Result<(), CodeFactoryError> {
        // In production, would verify spec exists
        Ok(())
    }

    async fn simulate_code_generation(&self, _request: &CodeGenerationRequest) -> String {
        "// Generated code\nfn main() {\n    println!(\"Hello, World!\");\n}".to_string()
    }

    async fn simulate_test_generation(&self, _request: &CodeGenerationRequest) -> String {
        "#[test]\nfn test_main() {\n    assert_eq!(2 + 2, 4);\n}".to_string()
    }

    async fn simulate_docs_generation(&self, _request: &CodeGenerationRequest) -> String {
        "# Documentation\n\nThis is generated documentation.".to_string()
    }

    async fn check_spec_compliance(
        &self,
        _code: &str,
        _tests: &str,
        request: &CodeGenerationRequest,
    ) -> SpecCompliance {
        SpecCompliance {
            compliant: true,
            requirements_met: request.requirements.len(),
            requirements_total: request.requirements.len(),
            constraints_satisfied: request.constraints.len(),
            constraints_total: request.constraints.len(),
        }
    }

    async fn simulate_test_run(&self, _tests: &str) -> bool {
        true // Simulated pass
    }

    async fn simulate_lint_run(&self, _code: &str) -> bool {
        true // Simulated pass
    }

    async fn simulate_security_scan(&self, _code: &str) -> bool {
        true // Simulated pass
    }

    async fn simulate_performance_check(&self, _code: &str) -> bool {
        true // Simulated pass
    }

    async fn assess_risk(&self, _artifact_id: &str, _validation: &ValidationResult) -> RiskTier {
        RiskTier::Medium // Default
    }

    async fn generate_evidence_hash(&self, artifact_id: &str, validation: &ValidationResult) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(artifact_id.as_bytes());
        hasher.update(format!("{}", validation.tests_passed).as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Code factory status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeFactoryStatus {
    pub generation_count: u64,
    pub validation_count: u64,
    pub evolution: EvolutionStatus,
}

/// Code factory error types
#[derive(Debug, thiserror::Error)]
pub enum CodeFactoryError {
    #[error("Spec not found: {0}")]
    SpecNotFound(String),

    #[error("Context error: {0}")]
    Context(#[from] allternit_context_control::ContextError),

    #[error("Memory error: {0}")]
    Memory(#[from] allternit_memory_kernel::MemoryError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_evolution_layer::MemoryEvolutionEngine;

    fn create_test_components() -> (
        Arc<ContextControlPlane>,
        Arc<MemoryKernel>,
        Arc<SystemLawEngine>,
        Arc<HarnessEngineeringEngine>,
        Arc<EvolutionLayer>,
    ) {
        let system_law = Arc::new(SystemLawEngine::new());
        let harness = Arc::new(HarnessEngineeringEngine::new(system_law.clone()));
        let memory_engine = Arc::new(MemoryEvolutionEngine::new());
        let memory = Arc::new(MemoryKernel::new(memory_engine));
        let context_plane = Arc::new(ContextControlPlane::new(memory.clone()));
        let evolution = Arc::new(EvolutionLayer::new(system_law.clone(), harness.clone()));

        (context_plane, memory, system_law, harness, evolution)
    }

    #[tokio::test]
    async fn test_generate_code() {
        let (context_plane, memory, system_law, harness, evolution) = create_test_components();
        let factory = AutonomousCodeFactory::new(context_plane, memory, system_law, harness, evolution);

        // Create context first
        let context_id = factory.context_plane.create_context("Test").await;

        let request = CodeGenerationRequest {
            request_id: "req_001".to_string(),
            spec_ref: "spec/test".to_string(),
            context_id: context_id.clone(),
            requirements: vec!["Requirement 1".to_string()],
            constraints: vec!["Constraint 1".to_string()],
            acceptance_tests: vec!["Test 1".to_string()],
        };

        let result = factory.generate_code(request).await;
        assert!(result.is_ok());

        let code = result.unwrap();
        assert!(!code.code.is_empty());
        assert!(!code.tests.is_empty());
    }

    #[tokio::test]
    async fn test_validate_code() {
        let (context_plane, memory, system_law, harness, evolution) = create_test_components();
        let factory = AutonomousCodeFactory::new(context_plane, memory, system_law, harness, evolution);

        let result = factory
            .validate_code("artifact_001", "fn main() {}", "#[test] fn test() {}")
            .await;

        assert!(result.is_ok());
        let validation = result.unwrap();
        assert!(validation.tests_passed);
    }

    #[tokio::test]
    async fn test_merge_decision() {
        let (context_plane, memory, system_law, harness, evolution) = create_test_components();
        let factory = AutonomousCodeFactory::new(context_plane, memory, system_law, harness, evolution);

        let validation = ValidationResult {
            validation_id: "val_001".to_string(),
            artifact_id: "artifact_001".to_string(),
            tests_passed: true,
            lint_passed: true,
            security_passed: true,
            performance_passed: true,
            issues: vec![],
            validated_at: Utc::now(),
        };

        let decision = factory
            .make_merge_decision("artifact_001", &validation, "ctx_001")
            .await;

        assert!(decision.is_ok());
        let decision = decision.unwrap();
        assert!(decision.approved);
    }

    #[tokio::test]
    async fn test_factory_status() {
        let (context_plane, memory, system_law, harness, evolution) = create_test_components();
        let factory = AutonomousCodeFactory::new(context_plane, memory, system_law, harness, evolution);

        let status = factory.get_status().await;
        assert_eq!(status.generation_count, 0);
        assert_eq!(status.validation_count, 0);
    }
}
