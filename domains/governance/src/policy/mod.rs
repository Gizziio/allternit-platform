//! Governance Policy Module
//!
//! Defines policies that the substrate layer enforces.
//! Policies are configurable without code changes via JSON config files.

pub mod visual_verification;

pub use visual_verification::{
    Artifact,
    ArtifactType,
    Evidence,
    PolicyError,
    ProviderType,
    ValidationResult,
    VisualVerificationPolicy,
};

/// Policy configuration loader
use std::path::Path;

/// Load a policy from the config directory
/// 
/// Looks for config files in the following order:
/// 1. `config/visual-verification.json` (user overrides)
/// 2. `config/visual-verification.default.json` (defaults)
pub fn load_visual_verification_policy(
    config_dir: &Path,
) -> Result<VisualVerificationPolicy, PolicyError> {
    // Try user config first
    let user_config = config_dir.join("visual-verification.json");
    if user_config.exists() {
        return VisualVerificationPolicy::from_file(&user_config);
    }
    
    // Fall back to default config
    let default_config = config_dir.join("visual-verification.default.json");
    if default_config.exists() {
        return VisualVerificationPolicy::from_file(&default_config);
    }
    
    // Return default policy if no config files exist
    Ok(VisualVerificationPolicy::default())
}

/// Policy environment presets
#[derive(Debug, Clone, Copy)]
pub enum PolicyEnvironment {
    Development,
    Staging,
    Production,
}

/// Get policy for a specific environment
pub fn policy_for_environment(env: PolicyEnvironment) -> VisualVerificationPolicy {
    match env {
        PolicyEnvironment::Development => VisualVerificationPolicy::development(),
        PolicyEnvironment::Staging => VisualVerificationPolicy::default(),
        PolicyEnvironment::Production => VisualVerificationPolicy::production(),
    }
}
