//! Visual Verification Policy
//! 
//! Defines governance-controlled thresholds and requirements
//! for visual evidence before autoland.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// Visual verification policy - controlled by governance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualVerificationPolicy {
    /// Whether visual verification is required
    pub enabled: bool,
    
    /// Minimum confidence score (0.0 - 1.0)
    pub min_confidence: f64,
    
    /// Required artifact types
    pub required_types: Vec<ArtifactType>,
    
    /// Provider to use: "file" or "grpc"
    pub provider_type: ProviderType,
    
    /// Timeout for evidence gathering (seconds)
    pub timeout_seconds: u64,
    
    /// Whether to allow bypass with approval
    pub allow_bypass: bool,
    
    /// Roles that can bypass
    pub bypass_roles: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ArtifactType {
    UiState,
    CoverageMap,
    ConsoleOutput,
    VisualDiff,
    ErrorState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderType {
    FileBased,
    Grpc,
}

/// Errors that can occur when loading or validating policies
#[derive(Debug)]
pub enum PolicyError {
    Io(std::io::Error),
    Serialization(serde_json::Error),
}

impl From<std::io::Error> for PolicyError {
    fn from(err: std::io::Error) -> Self {
        PolicyError::Io(err)
    }
}

impl From<serde_json::Error> for PolicyError {
    fn from(err: serde_json::Error) -> Self {
        PolicyError::Serialization(err)
    }
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PolicyError::Io(e) => write!(f, "IO error: {}", e),
            PolicyError::Serialization(e) => write!(f, "Serialization error: {}", e),
        }
    }
}

impl std::error::Error for PolicyError {}

/// Result of validating evidence against policy
#[derive(Debug, Clone)]
pub enum ValidationResult {
    Pass,
    Fail(String),
}

/// Evidence artifact from substrate
#[derive(Debug, Clone)]
pub struct Artifact {
    pub artifact_type: ArtifactType,
    pub data: Vec<u8>,
    pub metadata: std::collections::HashMap<String, String>,
}

/// Evidence collection from substrate
#[derive(Debug, Clone)]
pub struct Evidence {
    pub success: bool,
    pub overall_confidence: f64,
    pub artifacts: Vec<Artifact>,
}

impl Default for VisualVerificationPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            min_confidence: 0.7,
            required_types: vec![
                ArtifactType::ConsoleOutput,
                ArtifactType::CoverageMap,
            ],
            provider_type: ProviderType::FileBased,
            timeout_seconds: 60,
            allow_bypass: true,
            bypass_roles: vec!["admin".to_string()],
        }
    }
}

impl VisualVerificationPolicy {
    /// Production policy - stricter
    pub fn production() -> Self {
        Self {
            enabled: true,
            min_confidence: 0.8,
            required_types: vec![
                ArtifactType::UiState,
                ArtifactType::CoverageMap,
                ArtifactType::ConsoleOutput,
                ArtifactType::VisualDiff,
            ],
            provider_type: ProviderType::Grpc,
            timeout_seconds: 30,
            allow_bypass: false,
            bypass_roles: vec![],
        }
    }
    
    /// Development policy - more lenient
    pub fn development() -> Self {
        Self {
            enabled: true,
            min_confidence: 0.5,
            required_types: vec![],
            provider_type: ProviderType::FileBased,
            timeout_seconds: 120,
            allow_bypass: true,
            bypass_roles: vec!["developer".to_string(), "admin".to_string()],
        }
    }
    
    /// Load from config file
    pub fn from_file(path: &Path) -> Result<Self, PolicyError> {
        let content = std::fs::read_to_string(path)?;
        let policy: Self = serde_json::from_str(&content)?;
        Ok(policy)
    }
    
    /// Save to config file
    pub fn to_file(&self, path: &Path) -> Result<(), PolicyError> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
    
    /// Validate that evidence meets policy requirements
    pub fn validate_evidence(&self, evidence: &Evidence) -> ValidationResult {
        if !self.enabled {
            return ValidationResult::Pass;
        }
        
        if !evidence.success {
            return ValidationResult::Fail("Evidence gathering failed".to_string());
        }
        
        if evidence.overall_confidence < self.min_confidence {
            return ValidationResult::Fail(format!(
                "Confidence {:.1}% below threshold {:.1}%",
                evidence.overall_confidence * 100.0,
                self.min_confidence * 100.0
            ));
        }
        
        // Check required types
        let present_types: HashSet<_> = evidence.artifacts
            .iter()
            .map(|a| &a.artifact_type)
            .collect();
            
        for required in &self.required_types {
            if !present_types.contains(required) {
                return ValidationResult::Fail(format!(
                    "Missing required artifact type: {:?}",
                    required
                ));
            }
        }
        
        ValidationResult::Pass
    }
    
    /// Check if a role can bypass verification
    pub fn can_bypass(&self, role: &str) -> bool {
        self.allow_bypass && self.bypass_roles.contains(&role.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_policy() {
        let policy = VisualVerificationPolicy::default();
        assert!(policy.enabled);
        assert_eq!(policy.min_confidence, 0.7);
        assert_eq!(policy.required_types.len(), 2);
        assert!(matches!(policy.provider_type, ProviderType::FileBased));
    }

    #[test]
    fn test_production_policy() {
        let policy = VisualVerificationPolicy::production();
        assert!(policy.enabled);
        assert_eq!(policy.min_confidence, 0.8);
        assert_eq!(policy.required_types.len(), 4);
        assert!(!policy.allow_bypass);
        assert!(matches!(policy.provider_type, ProviderType::Grpc));
    }

    #[test]
    fn test_development_policy() {
        let policy = VisualVerificationPolicy::development();
        assert!(policy.enabled);
        assert_eq!(policy.min_confidence, 0.5);
        assert!(policy.required_types.is_empty());
        assert!(policy.allow_bypass);
        assert!(policy.can_bypass("developer"));
        assert!(policy.can_bypass("admin"));
        assert!(!policy.can_bypass("user"));
    }

    #[test]
    fn test_validate_evidence_disabled() {
        let mut policy = VisualVerificationPolicy::default();
        policy.enabled = false;
        
        let evidence = Evidence {
            success: false,
            overall_confidence: 0.0,
            artifacts: vec![],
        };
        
        assert!(matches!(policy.validate_evidence(&evidence), ValidationResult::Pass));
    }

    #[test]
    fn test_validate_evidence_low_confidence() {
        let policy = VisualVerificationPolicy::default();
        
        let evidence = Evidence {
            success: true,
            overall_confidence: 0.5,
            artifacts: vec![],
        };
        
        let result = policy.validate_evidence(&evidence);
        assert!(matches!(result, ValidationResult::Fail(_)));
    }

    #[test]
    fn test_validate_evidence_missing_artifacts() {
        let policy = VisualVerificationPolicy::default();
        
        let evidence = Evidence {
            success: true,
            overall_confidence: 0.9,
            artifacts: vec![],
        };
        
        let result = policy.validate_evidence(&evidence);
        assert!(matches!(result, ValidationResult::Fail(_)));
    }

    #[test]
    fn test_validate_evidence_pass() {
        let policy = VisualVerificationPolicy::default();
        
        let evidence = Evidence {
            success: true,
            overall_confidence: 0.9,
            artifacts: vec![
                Artifact {
                    artifact_type: ArtifactType::ConsoleOutput,
                    data: vec![],
                    metadata: std::collections::HashMap::new(),
                },
                Artifact {
                    artifact_type: ArtifactType::CoverageMap,
                    data: vec![],
                    metadata: std::collections::HashMap::new(),
                },
            ],
        };
        
        assert!(matches!(policy.validate_evidence(&evidence), ValidationResult::Pass));
    }
}
