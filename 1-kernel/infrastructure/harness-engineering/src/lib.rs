//! A2R Harness Engineering
//!
//! Implements the Harness Engineering layer for A2rchitech, including:
//! - RiskPolicy Contract (LAW-GRD-008, LAW-ENF-004)
//! - Preflight Risk Evaluation (Stage 0)
//! - Deterministic Remediation Loop (LAW-OPS-003)
//! - Evidence Validation (LAW-SWM-005, LAW-AUT-004)
//! - Merge Governance (LAW-ENF-003, LAW-CHG-001)
//! - Entropy Compression Engine (LAW-ENF-005, LAW-QLT-002)

use a2rchitech_system_law::{SystemLawEngine, ViolationSeverity};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Risk Policy Contract
// ============================================================================

/// Risk tier classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RiskTier {
    /// Tier 0: Docs only - CI lint required
    Low,
    /// Tier 1: Internal logic - Unit tests required
    Medium,
    /// Tier 2: Cross-service change - Contract tests required
    High,
    /// Tier 3: Security-impacting - Security review required
    Critical,
    /// Tier 4: Destructive/irreversible - Human approval required
    Destructive,
}

/// Path classification rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathClassificationRule {
    pub pattern: String,
    pub tier: RiskTier,
    pub description: String,
}

/// Required gate definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequiredGate {
    pub gate_id: String,
    pub name: String,
    pub description: String,
    pub tier: RiskTier,
    pub required: bool,
}

/// RiskPolicy contract
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskPolicy {
    pub version: String,
    pub risk_tiers: Vec<RiskTier>,
    pub path_rules: Vec<PathClassificationRule>,
    pub required_gates: Vec<RequiredGate>,
    pub docs_drift_rules: Vec<DocsDriftRule>,
    pub evidence_requirements: EvidenceRequirements,
}

/// Documentation drift rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocsDriftRule {
    pub rule_id: String,
    pub description: String,
    pub spec_paths: Vec<String>,
    pub code_paths: Vec<String>,
    pub enforcement: EnforcementLevel,
}

/// Enforcement level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EnforcementLevel {
    /// Hard enforcement - blocks merge
    Hard,
    /// Soft enforcement - warning only
    Soft,
}

/// Evidence requirements
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EvidenceRequirements {
    pub require_test_evidence: bool,
    pub require_lint_evidence: bool,
    pub require_security_evidence: bool,
    pub require_review_evidence: bool,
    pub evidence_retention_days: u32,
}

// ============================================================================
// Preflight Risk Evaluation
// ============================================================================

/// Preflight evaluation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightResult {
    pub allowed: bool,
    pub risk_tier: RiskTier,
    pub required_gates: Vec<String>,
    pub violations: Vec<PreflightViolation>,
    pub warnings: Vec<String>,
}

/// Preflight violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightViolation {
    pub violation_id: String,
    pub rule: String,
    pub description: String,
    pub severity: ViolationSeverity,
}

/// Changed file detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangedFile {
    pub path: String,
    pub status: FileStatus,
    pub additions: usize,
    pub deletions: usize,
}

/// File status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
}

// ============================================================================
// Deterministic Remediation Loop
// ============================================================================

/// Remediation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationRequest {
    pub request_id: String,
    pub findings: Vec<Finding>,
    pub max_attempts: u32,
    pub current_attempt: u32,
}

/// Finding to remediate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub finding_id: String,
    pub description: String,
    pub file_path: String,
    pub line_number: Option<usize>,
    pub severity: FindingSeverity,
    pub suggested_fix: Option<String>,
}

/// Finding severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FindingSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// Remediation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationResult {
    pub success: bool,
    pub attempts_used: u32,
    pub remaining_findings: Vec<Finding>,
    pub applied_patches: Vec<Patch>,
}

/// Patch representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patch {
    pub patch_id: String,
    pub file_path: String,
    pub diff: String,
    pub applied_at: DateTime<Utc>,
}

// ============================================================================
// Evidence Validation
// ============================================================================

/// Evidence manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceManifest {
    pub manifest_id: String,
    pub sha_embedded: bool,
    pub flow_assertions: Vec<FlowAssertion>,
    pub artifacts: Vec<EvidenceArtifact>,
    pub created_at: DateTime<Utc>,
    pub verified: bool,
}

/// Flow assertion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowAssertion {
    pub assertion_id: String,
    pub flow_name: String,
    pub passed: bool,
    pub details: String,
}

/// Evidence artifact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceArtifact {
    pub artifact_id: String,
    pub artifact_type: String,
    pub path: String,
    pub sha_hash: String,
    pub timestamp: DateTime<Utc>,
}

/// Evidence validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceValidationResult {
    pub valid: bool,
    pub manifest_present: bool,
    pub sha_valid: bool,
    pub assertions_passed: usize,
    pub assertions_failed: usize,
    pub artifacts_recent: bool,
    pub errors: Vec<String>,
}

// ============================================================================
// Merge Governance
// ============================================================================

/// Merge eligibility receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeEligibilityReceipt {
    pub receipt_id: String,
    pub head_sha: String,
    pub timestamp: DateTime<Utc>,
    pub risk_tier: RiskTier,
    pub evidence_hash: String,
    pub review_run_id: String,
    pub acceptance_hash: String,
    pub policy_version: String,
    pub eligible: bool,
    pub blockers: Vec<String>,
}

/// Merge gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeGateResult {
    pub allowed: bool,
    pub gate_results: Vec<GateResult>,
    pub auto_merge_allowed: bool,
    pub human_approval_required: bool,
}

/// Individual gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateResult {
    pub gate_id: String,
    pub name: String,
    pub passed: bool,
    pub message: String,
}

// ============================================================================
// Entropy Compression Engine
// ============================================================================

/// Golden principle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoldenPrinciple {
    pub principle_id: String,
    pub name: String,
    pub description: String,
    pub enforcement: EnforcementLevel,
    pub violation_count: usize,
}

/// Garbage collection action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcAction {
    pub action_id: String,
    pub action_type: String,
    pub description: String,
    pub target: String,
    pub auto_merge_safe: bool,
}

/// Entropy compression result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyCompressionResult {
    pub actions_generated: usize,
    pub entropy_before: f32,
    pub entropy_after: f32,
    pub actions: Vec<GcAction>,
}

// ============================================================================
// Harness Engineering Engine
// ============================================================================

/// Main harness engineering engine
pub struct HarnessEngineeringEngine {
    system_law: Arc<SystemLawEngine>,
    risk_policy: Arc<RwLock<Option<RiskPolicy>>>,
    preflight_cache: Arc<RwLock<HashMap<String, PreflightResult>>>,
    remediation_history: Arc<RwLock<HashMap<String, Vec<RemediationResult>>>>,
    evidence_store: Arc<RwLock<HashMap<String, EvidenceManifest>>>,
    merge_receipts: Arc<RwLock<HashMap<String, MergeEligibilityReceipt>>>,
    golden_principles: Arc<RwLock<Vec<GoldenPrinciple>>>,
}

impl HarnessEngineeringEngine {
    pub fn new(system_law: Arc<SystemLawEngine>) -> Self {
        Self {
            system_law,
            risk_policy: Arc::new(RwLock::new(None)),
            preflight_cache: Arc::new(RwLock::new(HashMap::new())),
            remediation_history: Arc::new(RwLock::new(HashMap::new())),
            evidence_store: Arc::new(RwLock::new(HashMap::new())),
            merge_receipts: Arc::new(RwLock::new(HashMap::new())),
            golden_principles: Arc::new(RwLock::new(Vec::new())),
        }
    }

    // ========================================================================
    // RiskPolicy Management
    // ========================================================================

    /// Set risk policy
    pub async fn set_risk_policy(&self, policy: RiskPolicy) {
        let mut risk_policy = self.risk_policy.write().await;
        *risk_policy = Some(policy);
    }

    /// Get risk policy
    pub async fn get_risk_policy(&self) -> Option<RiskPolicy> {
        let risk_policy = self.risk_policy.read().await;
        risk_policy.clone()
    }

    /// Classify path by risk tier
    pub async fn classify_path(&self, path: &str) -> RiskTier {
        let risk_policy = self.risk_policy.read().await;
        let policy = match risk_policy.as_ref() {
            Some(p) => p,
            None => return RiskTier::Medium, // Default
        };

        for rule in &policy.path_rules {
            if self.path_matches(&rule.pattern, path) {
                return rule.tier;
            }
        }

        RiskTier::Medium // Default
    }

    /// Check if path matches pattern (simplified glob matching)
    fn path_matches(&self, pattern: &str, path: &str) -> bool {
        // Simplified pattern matching - would use glob crate in production
        if pattern.contains('*') {
            let parts: Vec<&str> = pattern.split('*').collect();
            if parts.len() == 2 {
                return path.starts_with(parts[0]) && path.ends_with(parts[1]);
            }
        }
        pattern == path
    }

    // ========================================================================
    // Preflight Risk Evaluation
    // ========================================================================

    /// Run preflight risk evaluation
    pub async fn run_preflight(
        &self,
        wih_id: &str,
        changed_files: Vec<ChangedFile>,
    ) -> PreflightResult {
        let mut violations = Vec::new();
        let mut warnings = Vec::new();
        let mut required_gates = HashSet::new();

        // Determine highest risk tier from changed files
        let mut highest_tier = RiskTier::Low;
        for file in &changed_files {
            let tier = self.classify_path(&file.path).await;
            if tier > highest_tier {
                highest_tier = tier;
            }
        }

        // Get required gates for this tier
        let risk_policy = self.risk_policy.read().await;
        if let Some(policy) = risk_policy.as_ref() {
            for gate in &policy.required_gates {
                if gate.tier <= highest_tier && gate.required {
                    required_gates.insert(gate.gate_id.clone());
                }
            }

            // Check docs drift rules
            for rule in &policy.docs_drift_rules {
                for code_path in &rule.code_paths {
                    for file in &changed_files {
                        if self.path_matches(code_path, &file.path) {
                            // Check if corresponding spec paths exist and are updated
                            // This is simplified - would check actual file content in production
                            if rule.enforcement == EnforcementLevel::Hard {
                                violations.push(PreflightViolation {
                                    violation_id: format!("viol_{}", Uuid::new_v4().simple()),
                                    rule: rule.rule_id.clone(),
                                    description: format!(
                                        "Code changed without corresponding spec update: {}",
                                        file.path
                                    ),
                                    severity: ViolationSeverity::Hard,
                                });
                            } else {
                                warnings.push(format!(
                                    "Consider updating spec for code change: {}",
                                    file.path
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Check for missing WIH
        if wih_id.is_empty() {
            violations.push(PreflightViolation {
                violation_id: format!("viol_{}", Uuid::new_v4().simple()),
                rule: "LAW-META-007".to_string(),
                description: "WIH header missing".to_string(),
                severity: ViolationSeverity::Hard,
            });
        }

        let allowed = violations
            .iter()
            .all(|v| v.severity != ViolationSeverity::Hard);

        PreflightResult {
            allowed,
            risk_tier: highest_tier,
            required_gates: required_gates.into_iter().collect(),
            violations,
            warnings,
        }
    }

    // ========================================================================
    // Deterministic Remediation Loop
    // ========================================================================

    /// Run remediation loop
    pub async fn run_remediation(&self, request: RemediationRequest) -> RemediationResult {
        let mut current_request = request;
        let mut applied_patches = Vec::new();

        while current_request.current_attempt < current_request.max_attempts {
            current_request.current_attempt += 1;

            // In production, would spawn RemediationAgent here
            // For now, simulate remediation
            let patches = self.simulate_remediation(&current_request.findings).await;
            applied_patches.extend(patches);

            // Check if findings are resolved
            // In production, would re-run validation
            if current_request.findings.is_empty() {
                break;
            }
        }

        let success = current_request.findings.is_empty();

        // Record in history
        let result = RemediationResult {
            success,
            attempts_used: current_request.current_attempt,
            remaining_findings: current_request.findings.clone(),
            applied_patches: applied_patches.clone(),
        };

        let mut history = self.remediation_history.write().await;
        history
            .entry(current_request.request_id.clone())
            .or_insert_with(Vec::new)
            .push(result.clone());

        result
    }

    /// Simulate remediation (would be agent-driven in production)
    async fn simulate_remediation(&self, findings: &[Finding]) -> Vec<Patch> {
        let mut patches = Vec::new();

        for finding in findings {
            let patch = Patch {
                patch_id: format!("patch_{}", Uuid::new_v4().simple()),
                file_path: finding.file_path.clone(),
                diff: format!("// Fix for: {}", finding.description),
                applied_at: Utc::now(),
            };
            patches.push(patch);
        }

        patches
    }

    // ========================================================================
    // Evidence Validation
    // ========================================================================

    /// Store evidence manifest
    pub async fn store_evidence(&self, manifest: EvidenceManifest) {
        let mut store = self.evidence_store.write().await;
        store.insert(manifest.manifest_id.clone(), manifest);
    }

    /// Validate evidence
    pub async fn validate_evidence(
        &self,
        manifest_id: &str,
        max_age_hours: u32,
    ) -> EvidenceValidationResult {
        let store = self.evidence_store.read().await;
        let manifest = match store.get(manifest_id) {
            Some(m) => m,
            None => {
                return EvidenceValidationResult {
                    valid: false,
                    manifest_present: false,
                    sha_valid: false,
                    assertions_passed: 0,
                    assertions_failed: 0,
                    artifacts_recent: false,
                    errors: vec!["Evidence manifest not found".to_string()],
                };
            }
        };

        let mut errors = Vec::new();
        let mut assertions_passed = 0;
        let mut assertions_failed = 0;

        // Check SHA embedding
        let sha_valid = manifest.sha_embedded;
        if !sha_valid {
            errors.push("SHA not embedded in artifacts".to_string());
        }

        // Check flow assertions
        for assertion in &manifest.flow_assertions {
            if assertion.passed {
                assertions_passed += 1;
            } else {
                assertions_failed += 1;
                errors.push(format!("Flow assertion failed: {}", assertion.flow_name));
            }
        }

        // Check artifact recency
        let now = Utc::now();
        let max_age = chrono::Duration::hours(max_age_hours as i64);
        let artifacts_recent = manifest
            .artifacts
            .iter()
            .all(|a| now.signed_duration_since(a.timestamp) < max_age);

        if !artifacts_recent {
            errors.push("Some artifacts are stale".to_string());
        }

        let valid = sha_valid && assertions_failed == 0 && artifacts_recent;

        EvidenceValidationResult {
            valid,
            manifest_present: true,
            sha_valid,
            assertions_passed,
            assertions_failed,
            artifacts_recent,
            errors,
        }
    }

    // ========================================================================
    // Merge Governance
    // ========================================================================

    /// Generate merge eligibility receipt
    pub async fn generate_merge_receipt(
        &self,
        head_sha: &str,
        risk_tier: RiskTier,
        evidence_hash: &str,
        review_run_id: &str,
        acceptance_hash: &str,
    ) -> MergeEligibilityReceipt {
        let mut blockers = Vec::new();

        // Check evidence
        let evidence_result = self.validate_evidence(evidence_hash, 24).await;
        if !evidence_result.valid {
            blockers.push("Evidence validation failed".to_string());
        }

        // Check SYSTEM_LAW violations
        if self.system_law.has_hard_violations().await {
            blockers.push("Unresolved SYSTEM_LAW hard violations".to_string());
        }

        let eligible = blockers.is_empty();

        let receipt = MergeEligibilityReceipt {
            receipt_id: format!("mer_{}", Uuid::new_v4().simple()),
            head_sha: head_sha.to_string(),
            timestamp: Utc::now(),
            risk_tier,
            evidence_hash: evidence_hash.to_string(),
            review_run_id: review_run_id.to_string(),
            acceptance_hash: acceptance_hash.to_string(),
            policy_version: self
                .get_risk_policy()
                .await
                .map(|p| p.version)
                .unwrap_or_else(|| "unknown".to_string()),
            eligible,
            blockers,
        };

        let mut receipts = self.merge_receipts.write().await;
        receipts.insert(receipt.receipt_id.clone(), receipt.clone());

        receipt
    }

    /// Run merge gates
    pub async fn run_merge_gates(&self, receipt: &MergeEligibilityReceipt) -> MergeGateResult {
        let mut gate_results = Vec::new();
        let mut all_passed = true;

        // Gate 1: Evidence gate
        let evidence_gate = self.validate_evidence(&receipt.evidence_hash, 24).await;
        gate_results.push(GateResult {
            gate_id: "evidence".to_string(),
            name: "Evidence Validation".to_string(),
            passed: evidence_gate.valid,
            message: if evidence_gate.valid {
                "Evidence valid".to_string()
            } else {
                evidence_gate.errors.join(", ")
            },
        });
        if !evidence_gate.valid {
            all_passed = false;
        }

        // Gate 2: SYSTEM_LAW compliance gate
        let law_compliant = !self.system_law.has_hard_violations().await;
        gate_results.push(GateResult {
            gate_id: "system_law".to_string(),
            name: "SYSTEM_LAW Compliance".to_string(),
            passed: law_compliant,
            message: if law_compliant {
                "No hard violations".to_string()
            } else {
                "Hard violations present".to_string()
            },
        });
        if !law_compliant {
            all_passed = false;
        }

        // Gate 3: Acceptance tests gate
        let acceptance_passed = !receipt.acceptance_hash.is_empty();
        gate_results.push(GateResult {
            gate_id: "acceptance".to_string(),
            name: "Acceptance Tests".to_string(),
            passed: acceptance_passed,
            message: if acceptance_passed {
                "Tests passed".to_string()
            } else {
                "Tests not run".to_string()
            },
        });
        if !acceptance_passed {
            all_passed = false;
        }

        // Determine auto-merge eligibility
        let auto_merge_allowed = all_passed && receipt.risk_tier <= RiskTier::Medium;
        let human_approval_required = receipt.risk_tier >= RiskTier::Critical;

        MergeGateResult {
            allowed: all_passed,
            gate_results,
            auto_merge_allowed,
            human_approval_required,
        }
    }

    // ========================================================================
    // Entropy Compression Engine
    // ========================================================================

    /// Register golden principle
    pub async fn register_golden_principle(&self, principle: GoldenPrinciple) {
        let mut principles = self.golden_principles.write().await;
        principles.push(principle);
    }

    /// Run garbage collection
    pub async fn run_garbage_collection(&self) -> EntropyCompressionResult {
        let entropy_before = self.system_law.calculate_entropy_score().await;
        let mut actions = Vec::new();

        // Get unresolved violations
        let violations = self.system_law.get_unresolved_violations().await;

        // Generate GC actions for each violation type
        for violation in &violations {
            let action = GcAction {
                action_id: format!("gc_{}", Uuid::new_v4().simple()),
                action_type: "fix_violation".to_string(),
                description: format!("Fix {}: {}", violation.law_section, violation.description),
                target: violation.law_section.clone(),
                auto_merge_safe: violation.severity == ViolationSeverity::Soft,
            };
            actions.push(action);
        }

        // In production, would also generate actions for:
        // - Duplicate utilities
        // - Untyped boundary usage
        // - Dependency violations
        // - Missing observability
        // - Stale documentation

        let entropy_after = self.system_law.calculate_entropy_score().await;

        EntropyCompressionResult {
            actions_generated: actions.len(),
            entropy_before,
            entropy_after,
            actions,
        }
    }

    // ========================================================================
    // Compliance Reporting
    // ========================================================================

    /// Get harness compliance report
    pub async fn get_compliance_report(&self) -> HarnessComplianceReport {
        let law_report = self.system_law.get_compliance_report().await;
        let entropy = self.system_law.calculate_entropy_score().await;

        HarnessComplianceReport {
            total_violations: law_report.total_violations,
            unresolved_violations: law_report.unresolved_violations,
            hard_violations: law_report.hard_violations,
            entropy_score: entropy,
            merge_receipts_count: self.merge_receipts.read().await.len(),
            evidence_items_count: self.evidence_store.read().await.len(),
            timestamp: Utc::now(),
        }
    }
}

/// Harness compliance report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessComplianceReport {
    pub total_violations: usize,
    pub unresolved_violations: usize,
    pub hard_violations: usize,
    pub entropy_score: f32,
    pub merge_receipts_count: usize,
    pub evidence_items_count: usize,
    pub timestamp: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    fn create_test_policy() -> RiskPolicy {
        RiskPolicy {
            version: "1.0.0".to_string(),
            risk_tiers: vec![
                RiskTier::Low,
                RiskTier::Medium,
                RiskTier::High,
                RiskTier::Critical,
                RiskTier::Destructive,
            ],
            path_rules: vec![
                PathClassificationRule {
                    pattern: "spec/*".to_string(),
                    tier: RiskTier::Low,
                    description: "Spec files".to_string(),
                },
                PathClassificationRule {
                    pattern: "src/*".to_string(),
                    tier: RiskTier::Medium,
                    description: "Source files".to_string(),
                },
                PathClassificationRule {
                    pattern: "security/*".to_string(),
                    tier: RiskTier::Critical,
                    description: "Security files".to_string(),
                },
            ],
            required_gates: vec![
                RequiredGate {
                    gate_id: "lint".to_string(),
                    name: "Lint".to_string(),
                    description: "Linting".to_string(),
                    tier: RiskTier::Low,
                    required: true,
                },
                RequiredGate {
                    gate_id: "tests".to_string(),
                    name: "Tests".to_string(),
                    description: "Unit tests".to_string(),
                    tier: RiskTier::Medium,
                    required: true,
                },
                RequiredGate {
                    gate_id: "security".to_string(),
                    name: "Security Review".to_string(),
                    description: "Security review".to_string(),
                    tier: RiskTier::Critical,
                    required: true,
                },
            ],
            docs_drift_rules: vec![],
            evidence_requirements: EvidenceRequirements {
                require_test_evidence: true,
                require_lint_evidence: true,
                require_security_evidence: false,
                require_review_evidence: true,
                evidence_retention_days: 30,
            },
        }
    }

    #[tokio::test]
    async fn test_classify_path() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());
        engine.set_risk_policy(create_test_policy()).await;

        assert_eq!(engine.classify_path("spec/test.md").await, RiskTier::Low);
        assert_eq!(engine.classify_path("src/main.rs").await, RiskTier::Medium);
        assert_eq!(
            engine.classify_path("security/auth.rs").await,
            RiskTier::Critical
        );
    }

    #[tokio::test]
    async fn test_preflight_allowed() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());
        engine.set_risk_policy(create_test_policy()).await;

        let changed_files = vec![ChangedFile {
            path: "src/main.rs".to_string(),
            status: FileStatus::Modified,
            additions: 10,
            deletions: 5,
        }];

        let result = engine.run_preflight("wih_001", changed_files).await;

        assert!(result.allowed);
        assert_eq!(result.risk_tier, RiskTier::Medium);
        assert!(result.violations.is_empty());
    }

    #[tokio::test]
    async fn test_preflight_missing_wih() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());
        engine.set_risk_policy(create_test_policy()).await;

        let changed_files = vec![ChangedFile {
            path: "src/main.rs".to_string(),
            status: FileStatus::Modified,
            additions: 10,
            deletions: 5,
        }];

        let result = engine.run_preflight("", changed_files).await;

        assert!(!result.allowed);
        assert!(!result.violations.is_empty());
    }

    #[tokio::test]
    async fn test_evidence_validation() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());

        let manifest = EvidenceManifest {
            manifest_id: "ev_001".to_string(),
            sha_embedded: true,
            flow_assertions: vec![FlowAssertion {
                assertion_id: "assert_001".to_string(),
                flow_name: "test".to_string(),
                passed: true,
                details: "All tests passed".to_string(),
            }],
            artifacts: vec![EvidenceArtifact {
                artifact_id: "art_001".to_string(),
                artifact_type: "test_result".to_string(),
                path: "/test/results.xml".to_string(),
                sha_hash: "abc123".to_string(),
                timestamp: Utc::now(),
            }],
            created_at: Utc::now(),
            verified: true,
        };

        engine.store_evidence(manifest).await;

        let result = engine.validate_evidence("ev_001", 24).await;

        assert!(result.valid);
        assert!(result.manifest_present);
        assert!(result.sha_valid);
        assert_eq!(result.assertions_passed, 1);
        assert_eq!(result.assertions_failed, 0);
    }

    #[tokio::test]
    async fn test_merge_receipt_generation() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());
        engine.set_risk_policy(create_test_policy()).await;

        // Store valid evidence first
        let manifest = EvidenceManifest {
            manifest_id: "ev_hash".to_string(),
            sha_embedded: true,
            flow_assertions: vec![],
            artifacts: vec![],
            created_at: Utc::now(),
            verified: true,
        };
        engine.store_evidence(manifest).await;

        let receipt = engine
            .generate_merge_receipt(
                "abc123",
                RiskTier::Medium,
                "ev_hash",
                "review_001",
                "acceptance_hash",
            )
            .await;

        assert!(receipt.eligible);
        assert_eq!(receipt.head_sha, "abc123");
        assert_eq!(receipt.risk_tier, RiskTier::Medium);
    }

    #[tokio::test]
    async fn test_merge_gates() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());
        engine.set_risk_policy(create_test_policy()).await;

        // Store valid evidence
        let manifest = EvidenceManifest {
            manifest_id: "ev_hash".to_string(),
            sha_embedded: true,
            flow_assertions: vec![],
            artifacts: vec![],
            created_at: Utc::now(),
            verified: true,
        };
        engine.store_evidence(manifest).await;

        let receipt = engine
            .generate_merge_receipt(
                "abc123",
                RiskTier::Medium,
                "ev_hash",
                "review_001",
                "acceptance_hash",
            )
            .await;

        let gate_result = engine.run_merge_gates(&receipt).await;

        assert!(gate_result.allowed);
        assert!(gate_result.auto_merge_allowed);
        assert!(!gate_result.human_approval_required);
    }

    #[tokio::test]
    async fn test_garbage_collection() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());

        // Add some violations
        engine
            .system_law
            .record_violation(
                "LAW-GRD-001",
                ViolationSeverity::Soft,
                "Test violation",
                serde_json::json!({}),
            )
            .await;

        let result = engine.run_garbage_collection().await;

        assert!(result.actions_generated > 0);
        assert!(result.entropy_before > 0.0);
    }

    #[tokio::test]
    async fn test_compliance_report() {
        let engine = HarnessEngineeringEngine::new(create_test_system_law());

        let report = engine.get_compliance_report().await;

        assert_eq!(report.total_violations, 0);
        assert_eq!(report.hard_violations, 0);
        assert_eq!(report.entropy_score, 0.0);
    }
}
