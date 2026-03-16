//! Bootstrap Context

use std::path::PathBuf;

/// Bootstrap context
pub struct BootstrapContext {
    pub profile: String,
    pub project_root: Option<PathBuf>,
}

/// Initialize bootstrap context
pub fn initialize(profile: Option<&str>) -> anyhow::Result<BootstrapContext> {
    let profile = profile
        .map(|s| s.to_string())
        .or_else(|| std::env::var("A2R_PROFILE").ok())
        .unwrap_or_else(|| "default".to_string());

    let project_root = std::env::current_dir().ok();

    Ok(BootstrapContext {
        profile,
        project_root,
    })
}
