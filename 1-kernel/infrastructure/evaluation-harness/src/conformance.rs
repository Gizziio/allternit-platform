//! Conformance Module
//!
//! Provides conformance checking against rules and standards.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// A conformance rule to check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConformanceRule {
    /// Rule ID
    pub rule_id: String,
    /// Rule name
    pub name: String,
    /// Rule description
    pub description: String,
    /// Rule severity
    pub severity: RuleSeverity,
    /// Rule category
    pub category: String,
    /// The check to perform
    pub check: RuleCheck,
}

/// Rule severity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleSeverity {
    Error,
    Warning,
    Info,
}

/// Types of rule checks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "check_type")]
pub enum RuleCheck {
    /// File exists check
    FileExists { path: String },
    /// File contains check
    FileContains { path: String, pattern: String },
    /// JSON schema validation
    JsonSchema { path: String, schema: String },
    /// Command success check
    CommandSuccess { command: String, args: Vec<String> },
    /// Custom check
    Custom { check_fn: String },
}

/// Conformance violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConformanceViolation {
    pub rule_id: String,
    pub rule_name: String,
    pub severity: RuleSeverity,
    pub message: String,
    pub location: Option<String>,
}

/// Conformance checker
pub struct ConformanceChecker {
    rules: Vec<ConformanceRule>,
}

impl ConformanceChecker {
    /// Create a new conformance checker
    pub fn new(rules: Vec<ConformanceRule>) -> Self {
        Self { rules }
    }

    /// Check all rules
    pub async fn check_all(&self) -> Result<Vec<ConformanceViolation>, ConformanceError> {
        let mut violations = Vec::new();

        for rule in &self.rules {
            match self.check_rule(rule).await {
                Ok(Some(violation)) => violations.push(violation),
                Ok(None) => {}
                Err(e) => {
                    violations.push(ConformanceViolation {
                        rule_id: rule.rule_id.clone(),
                        rule_name: rule.name.clone(),
                        severity: RuleSeverity::Error,
                        message: format!("Check failed: {}", e),
                        location: None,
                    });
                }
            }
        }

        Ok(violations)
    }

    /// Check a single rule
    async fn check_rule(
        &self,
        rule: &ConformanceRule,
    ) -> Result<Option<ConformanceViolation>, ConformanceError> {
        match &rule.check {
            RuleCheck::FileExists { path } => {
                if !std::path::Path::new(path).exists() {
                    Ok(Some(ConformanceViolation {
                        rule_id: rule.rule_id.clone(),
                        rule_name: rule.name.clone(),
                        severity: rule.severity.clone(),
                        message: format!("File does not exist: {}", path),
                        location: Some(path.clone()),
                    }))
                } else {
                    Ok(None)
                }
            }
            RuleCheck::FileContains { path, pattern } => {
                let content = tokio::fs::read_to_string(path).await
                    .map_err(|e| ConformanceError::IoError(e))?;
                
                if !content.contains(pattern) {
                    Ok(Some(ConformanceViolation {
                        rule_id: rule.rule_id.clone(),
                        rule_name: rule.name.clone(),
                        severity: rule.severity.clone(),
                        message: format!("File does not contain pattern: {}", pattern),
                        location: Some(path.clone()),
                    }))
                } else {
                    Ok(None)
                }
            }
            _ => {
                // Other check types not yet implemented
                Ok(None)
            }
        }
    }
}

/// Conformance errors
#[derive(Debug, Error)]
pub enum ConformanceError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Check error: {0}")]
    CheckError(String),
}
