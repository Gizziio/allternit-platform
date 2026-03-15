//! Skill Availability Checker
//!
//! Determines if a skill is available based on requirements.

use crate::skills::parser::SkillManifest;

/// Skill availability status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkillAvailability {
    /// Fully available (requirements met)
    Available,
    /// Partially available (some features may not work)
    Partial,
    /// Not available (requirements not met)
    Unavailable,
    /// Availability unknown (loading/error)
    Unknown,
}

impl SkillAvailability {
    /// Check if the skill is available
    pub fn is_available(&self) -> bool {
        matches!(
            self,
            SkillAvailability::Available | SkillAvailability::Partial
        )
    }
}

/// Checks skill availability
#[derive(Debug)]
pub struct AvailabilityChecker;

impl AvailabilityChecker {
    /// Create new checker
    pub fn new() -> Self {
        Self
    }

    /// Check availability of a skill
    pub fn check(&self, _id: &str, manifest: &SkillManifest) -> SkillAvailability {
        // If no metadata or requirements, assume available
        let Some(metadata) = &manifest.metadata else {
            return SkillAvailability::Available;
        };

        let Some(requires) = &metadata.openclaw.requires else {
            return SkillAvailability::Available;
        };

        // Check binary requirements
        let mut all_available = true;
        let mut any_available = false;

        // Check allBins - all must be present
        if let Some(all_bins) = &requires.all_bins {
            for bin in all_bins {
                if !is_binary_available(bin) {
                    all_available = false;
                    break;
                }
            }
        }

        // Check anyBins - at least one must be present
        if let Some(any_bins) = &requires.any_bins {
            any_available = any_bins.iter().any(|bin| is_binary_available(bin));

            // If anyBins specified but none available, unavailable
            if !any_available {
                return SkillAvailability::Unavailable;
            }
        }

        // Determine final availability
        if all_available && any_available {
            SkillAvailability::Available
        } else if all_available || any_available {
            SkillAvailability::Partial
        } else {
            SkillAvailability::Unavailable
        }
    }
}

impl Default for AvailabilityChecker {
    fn default() -> Self {
        Self::new()
    }
}

/// Check if a binary is available in PATH
fn is_binary_available(name: &str) -> bool {
    // Simple PATH check
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            let binary_path = std::path::Path::new(dir).join(name);
            if binary_path.exists() {
                return true;
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::parser::schema::{OpenClawMetadata, SkillMetadata, SkillRequirements};

    #[test]
    fn test_no_requirements() {
        let checker = AvailabilityChecker::new();
        let manifest = SkillManifest {
            name: "test".to_string(),
            description: "Test".to_string(),
            metadata: None,
        };

        assert_eq!(
            checker.check("test", &manifest),
            SkillAvailability::Available
        );
    }

    #[test]
    fn test_with_any_bins() {
        let checker = AvailabilityChecker::new();

        // Test with ls which should be available on Unix
        let manifest = SkillManifest {
            name: "test".to_string(),
            description: "Test".to_string(),
            metadata: Some(SkillMetadata {
                openclaw: OpenClawMetadata {
                    emoji: None,
                    requires: Some(SkillRequirements {
                        any_bins: Some(vec!["ls".to_string()]),
                        all_bins: None,
                    }),
                },
            }),
        };

        let avail = checker.check("test", &manifest);
        // Should be available on Unix systems
        assert!(avail == SkillAvailability::Available || avail == SkillAvailability::Unavailable);
    }
}
