//! WIH (Work Item Header) Integration for Purpose Binding
//!
//! Provides hard gates for tool calls based on purpose declarations in WIH.
//! Ensures all tool calls have explicit purpose that matches WIH scope.

use crate::{DataSubject, OperationType, PurposeCategory, PurposeRegistry, SensitivityLevel};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tracing::{error, info};

/// WIH Purpose Binding Error
#[derive(Debug, Error)]
pub enum WihPurposeError {
    #[error("Purpose missing for tool call: {0}")]
    MissingPurpose(String),
    #[error("Purpose scope violation: purpose {purpose} not allowed for WIH {wih_id}")]
    ScopeViolation { purpose: String, wih_id: String },
    #[error("Consent required but not granted for data subject: {0}")]
    ConsentRequired(String),
    #[error("Sensitivity level too high: {level} not allowed for purpose {purpose}")]
    SensitivityViolation { level: String, purpose: String },
    #[error("Hard gate blocked: {0}")]
    HardGateBlocked(String),
}

/// Purpose-enabled WIH
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeWih {
    /// Original WIH ID
    pub wih_id: String,
    /// Declared purpose for this work item
    pub purpose: PurposeDeclaration,
    /// Scope paths this WIH can access
    pub scope_paths: Vec<String>,
    /// Allowed tool categories
    pub allowed_tool_categories: Vec<String>,
    /// Data subjects involved
    pub data_subjects: Vec<DataSubject>,
    /// Maximum sensitivity level allowed
    pub max_sensitivity: SensitivityLevel,
    /// Whether consent is required
    pub consent_required: bool,
    /// Audit level
    pub audit_level: AuditLevel,
}

/// Purpose declaration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeDeclaration {
    pub purpose_id: String,
    pub category: PurposeCategory,
    pub description: String,
    pub legal_basis: LegalBasis,
}

/// Legal basis for processing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegalBasis {
    Consent,
    Contract,
    LegalObligation,
    VitalInterests,
    PublicTask,
    LegitimateInterests,
}

/// Audit level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditLevel {
    Minimal,
    Standard,
    High,
}

/// Tool call request with purpose
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeToolCall {
    pub tool_id: String,
    pub purpose: PurposeDeclaration,
    pub data_subjects: Vec<String>,
    pub operation: OperationType,
    pub scope_path: Option<String>,
}

/// Purpose gate - hard enforcement for tool calls
pub struct PurposeGate {
    purpose_registry: PurposeRegistry,
    audit_log: Vec<PurposeGateAudit>,
}

impl PurposeGate {
    /// Create a new purpose gate
    pub fn new(purpose_registry: PurposeRegistry) -> Self {
        Self {
            purpose_registry,
            audit_log: Vec::new(),
        }
    }

    /// Validate tool call against WIH purpose - HARD GATE
    pub async fn validate_tool_call(
        &mut self,
        wih: &PurposeWih,
        tool_call: &PurposeToolCall,
    ) -> Result<GateValidationResult, WihPurposeError> {
        let start_time = std::time::Instant::now();

        // 1. Check purpose is declared (HARD FAIL if missing)
        if tool_call.purpose.purpose_id.is_empty() {
            self.audit(PurposeGateAudit {
                timestamp: Utc::now(),
                wih_id: wih.wih_id.clone(),
                tool_id: tool_call.tool_id.clone(),
                decision: GateDecision::Blocked,
                reason: "Purpose missing".to_string(),
                duration_ms: start_time.elapsed().as_millis() as u64,
            });
            return Err(WihPurposeError::MissingPurpose(tool_call.tool_id.clone()));
        }

        // 2. Check purpose matches WIH scope
        if !self.purpose_in_scope(&tool_call.purpose, wih) {
            self.audit(PurposeGateAudit {
                timestamp: Utc::now(),
                wih_id: wih.wih_id.clone(),
                tool_id: tool_call.tool_id.clone(),
                decision: GateDecision::Blocked,
                reason: format!("Purpose {} not in WIH scope", tool_call.purpose.purpose_id),
                duration_ms: start_time.elapsed().as_millis() as u64,
            });
            return Err(WihPurposeError::ScopeViolation {
                purpose: tool_call.purpose.purpose_id.clone(),
                wih_id: wih.wih_id.clone(),
            });
        }

        // 3. Check tool category is allowed
        let tool_category = self.categorize_tool(&tool_call.tool_id);
        if !wih.allowed_tool_categories.contains(&tool_category) {
            self.audit(PurposeGateAudit {
                timestamp: Utc::now(),
                wih_id: wih.wih_id.clone(),
                tool_id: tool_call.tool_id.clone(),
                decision: GateDecision::Blocked,
                reason: format!("Tool category {} not allowed", tool_category),
                duration_ms: start_time.elapsed().as_millis() as u64,
            });
            return Err(WihPurposeError::HardGateBlocked(format!(
                "Tool category {} not in allowed categories: {:?}",
                tool_category, wih.allowed_tool_categories
            )));
        }

        // 4. Check scope path if specified
        if let Some(ref path) = tool_call.scope_path {
            if !self.path_in_scope(path, &wih.scope_paths) {
                self.audit(PurposeGateAudit {
                    timestamp: Utc::now(),
                    wih_id: wih.wih_id.clone(),
                    tool_id: tool_call.tool_id.clone(),
                    decision: GateDecision::Blocked,
                    reason: format!("Path {} not in WIH scope", path),
                    duration_ms: start_time.elapsed().as_millis() as u64,
                });
                return Err(WihPurposeError::HardGateBlocked(format!(
                    "Path {} not in allowed scope: {:?}",
                    path, wih.scope_paths
                )));
            }
        }

        // 5. Check consent if required
        if wih.consent_required {
            for subject_id in &tool_call.data_subjects {
                if !self.has_consent(subject_id, &tool_call.purpose).await {
                    self.audit(PurposeGateAudit {
                        timestamp: Utc::now(),
                        wih_id: wih.wih_id.clone(),
                        tool_id: tool_call.tool_id.clone(),
                        decision: GateDecision::Blocked,
                        reason: format!("Consent required for subject {}", subject_id),
                        duration_ms: start_time.elapsed().as_millis() as u64,
                    });
                    return Err(WihPurposeError::ConsentRequired(subject_id.clone()));
                }
            }
        }

        // All checks passed
        self.audit(PurposeGateAudit {
            timestamp: Utc::now(),
            wih_id: wih.wih_id.clone(),
            tool_id: tool_call.tool_id.clone(),
            decision: GateDecision::Allowed,
            reason: "All purpose checks passed".to_string(),
            duration_ms: start_time.elapsed().as_millis() as u64,
        });

        info!(
            "Purpose gate passed for tool {} in WIH {}",
            tool_call.tool_id, wih.wih_id
        );

        Ok(GateValidationResult {
            allowed: true,
            purpose_matched: true,
            scope_validated: true,
            consent_verified: wih.consent_required,
        })
    }

    /// Check if purpose is in WIH scope
    fn purpose_in_scope(&self, purpose: &PurposeDeclaration, wih: &PurposeWih) -> bool {
        // Primary purpose must match or be compatible
        purpose.category == wih.purpose.category
            || self.compatible_purposes(&purpose.category, &wih.purpose.category)
    }

    /// Check if two purposes are compatible
    fn compatible_purposes(&self, a: &PurposeCategory, b: &PurposeCategory) -> bool {
        use PurposeCategory::*;
        match (a, b) {
            // System operations can support any purpose
            (SystemOperations, _) => true,
            (_, SystemOperations) => true,
            // Security/Safety can access UserRequested data
            (SecuritySafety, UserRequested) => true,
            // Same category is compatible
            (a, b) if a == b => true,
            // Otherwise incompatible
            _ => false,
        }
    }

    /// Categorize a tool by ID
    fn categorize_tool(&self, tool_id: &str) -> String {
        if tool_id.starts_with("file.") {
            "file_io".to_string()
        } else if tool_id.starts_with("net.") {
            "network".to_string()
        } else if tool_id.starts_with("db.") {
            "database".to_string()
        } else if tool_id.starts_with("exec.") {
            "execution".to_string()
        } else if tool_id.starts_with("ai.") {
            "ai_model".to_string()
        } else {
            "general".to_string()
        }
    }

    /// Check if path is within scope
    fn path_in_scope(&self, path: &str, scope_paths: &[String]) -> bool {
        // Empty scope means all paths allowed (for system operations)
        if scope_paths.is_empty() {
            return true;
        }

        scope_paths
            .iter()
            .any(|scope| path.starts_with(scope) || path == scope)
    }

    /// Check if data subject has consent
    async fn has_consent(&self, _subject_id: &str, _purpose: &PurposeDeclaration) -> bool {
        // Query purpose registry for consent record
        // This is a simplified implementation
        true // Would check actual consent records
    }

    /// Record audit entry
    fn audit(&mut self, entry: PurposeGateAudit) {
        if self.audit_log.len() >= 10000 {
            self.audit_log.remove(0);
        }
        self.audit_log.push(entry);
    }

    /// Get audit log
    pub fn get_audit_log(&self) -> &[PurposeGateAudit] {
        &self.audit_log
    }

    /// Get gate statistics
    pub fn get_statistics(&self) -> GateStatistics {
        let total = self.audit_log.len();
        let allowed = self
            .audit_log
            .iter()
            .filter(|e| e.decision == GateDecision::Allowed)
            .count();
        let blocked = total - allowed;

        let avg_duration_ms = if total > 0 {
            self.audit_log.iter().map(|e| e.duration_ms).sum::<u64>() / total as u64
        } else {
            0
        };

        GateStatistics {
            total_validations: total,
            allowed,
            blocked,
            allow_rate: if total > 0 {
                (allowed as f64 / total as f64) * 100.0
            } else {
                0.0
            },
            avg_validation_time_ms: avg_duration_ms,
        }
    }
}

/// Gate validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateValidationResult {
    pub allowed: bool,
    pub purpose_matched: bool,
    pub scope_validated: bool,
    pub consent_verified: bool,
}

/// Purpose gate audit entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeGateAudit {
    pub timestamp: chrono::DateTime<Utc>,
    pub wih_id: String,
    pub tool_id: String,
    pub decision: GateDecision,
    pub reason: String,
    pub duration_ms: u64,
}

/// Gate decision
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GateDecision {
    Allowed,
    Blocked,
}

/// Gate statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateStatistics {
    pub total_validations: usize,
    pub allowed: usize,
    pub blocked: usize,
    pub allow_rate: f64,
    pub avg_validation_time_ms: u64,
}

/// Purpose drift detector
pub struct PurposeDriftDetector {
    /// Baseline purpose distribution
    baseline: HashMap<PurposeCategory, u64>,
    /// Current purpose distribution
    current: HashMap<PurposeCategory, u64>,
    /// Drift threshold (percentage change)
    threshold: f64,
}

impl PurposeDriftDetector {
    /// Create a new drift detector
    pub fn new(threshold: f64) -> Self {
        Self {
            baseline: HashMap::new(),
            current: HashMap::new(),
            threshold,
        }
    }

    /// Record purpose usage
    pub fn record_usage(&mut self, category: PurposeCategory) {
        *self.current.entry(category).or_insert(0) += 1;
    }

    /// Set baseline from current distribution
    pub fn set_baseline(&mut self) {
        self.baseline = self.current.clone();
        self.current.clear();
    }

    /// Detect drift
    pub fn detect_drift(&self) -> Vec<PurposeDrift> {
        let mut drifts = Vec::new();

        for (category, current_count) in &self.current {
            let baseline_count = self.baseline.get(category).copied().unwrap_or(0);
            let total_baseline: u64 = self.baseline.values().sum();
            let total_current: u64 = self.current.values().sum();

            if total_baseline == 0 || total_current == 0 {
                continue;
            }

            let baseline_pct = (*current_count as f64 / total_current as f64) * 100.0;
            let current_pct = (baseline_count as f64 / total_baseline as f64) * 100.0;

            let change = if current_pct > 0.0 {
                ((baseline_pct - current_pct) / current_pct) * 100.0
            } else {
                100.0
            };

            if change.abs() > self.threshold {
                drifts.push(PurposeDrift {
                    category: category.clone(),
                    baseline_percentage: current_pct,
                    current_percentage: baseline_pct,
                    change_percentage: change,
                    severity: if change.abs() > 50.0 {
                        DriftSeverity::High
                    } else {
                        DriftSeverity::Medium
                    },
                });
            }
        }

        drifts
    }
}

/// Purpose drift
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeDrift {
    pub category: PurposeCategory,
    pub baseline_percentage: f64,
    pub current_percentage: f64,
    pub change_percentage: f64,
    pub severity: DriftSeverity,
}

/// Drift severity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DriftSeverity {
    Low,
    Medium,
    High,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_wih() -> PurposeWih {
        PurposeWih {
            wih_id: "wih-test-001".to_string(),
            purpose: PurposeDeclaration {
                purpose_id: "purpose-1".to_string(),
                category: PurposeCategory::UserRequested,
                description: "User requested file operation".to_string(),
                legal_basis: LegalBasis::Consent,
            },
            scope_paths: vec!["src/".to_string(), "docs/".to_string()],
            allowed_tool_categories: vec!["file_io".to_string()],
            data_subjects: vec![],
            max_sensitivity: SensitivityLevel::Internal,
            consent_required: false,
            audit_level: AuditLevel::Standard,
        }
    }

    #[tokio::test]
    async fn test_purpose_gate_allows_valid_call() {
        let registry = PurposeRegistry::new();
        let mut gate = PurposeGate::new(registry);
        let wih = create_test_wih();

        let tool_call = PurposeToolCall {
            tool_id: "file.read".to_string(),
            purpose: wih.purpose.clone(),
            data_subjects: vec![],
            operation: OperationType::Read,
            scope_path: Some("src/main.rs".to_string()),
        };

        let result = gate.validate_tool_call(&wih, &tool_call).await;
        assert!(result.is_ok());

        let validation = result.unwrap();
        assert!(validation.allowed);
    }

    #[tokio::test]
    async fn test_purpose_gate_blocks_missing_purpose() {
        let registry = PurposeRegistry::new();
        let mut gate = PurposeGate::new(registry);
        let wih = create_test_wih();

        let tool_call = PurposeToolCall {
            tool_id: "file.read".to_string(),
            purpose: PurposeDeclaration {
                purpose_id: "".to_string(),
                category: PurposeCategory::UserRequested,
                description: "".to_string(),
                legal_basis: LegalBasis::Consent,
            },
            data_subjects: vec![],
            operation: OperationType::Read,
            scope_path: None,
        };

        let result = gate.validate_tool_call(&wih, &tool_call).await;
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            WihPurposeError::MissingPurpose(_)
        ));
    }

    #[tokio::test]
    async fn test_purpose_gate_blocks_out_of_scope() {
        let registry = PurposeRegistry::new();
        let mut gate = PurposeGate::new(registry);
        let wih = create_test_wih();

        let tool_call = PurposeToolCall {
            tool_id: "file.read".to_string(),
            purpose: wih.purpose.clone(),
            data_subjects: vec![],
            operation: OperationType::Read,
            scope_path: Some("/etc/passwd".to_string()),
        };

        let result = gate.validate_tool_call(&wih, &tool_call).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_drift_detection() {
        let mut detector = PurposeDriftDetector::new(10.0);

        // Set baseline
        detector.record_usage(PurposeCategory::UserRequested);
        detector.record_usage(PurposeCategory::UserRequested);
        detector.set_baseline();

        // Record current with different distribution
        detector.record_usage(PurposeCategory::SystemOperations);
        detector.record_usage(PurposeCategory::SystemOperations);
        detector.record_usage(PurposeCategory::SystemOperations);

        let drifts = detector.detect_drift();
        assert!(!drifts.is_empty());
    }
}
