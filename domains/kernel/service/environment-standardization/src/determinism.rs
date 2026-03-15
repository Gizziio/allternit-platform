// OWNER: T1-A4

//! Deterministic Environment Hashing
//!
//! Create deterministic hashes of environment state.

use crate::types::*;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

/// Compute deterministic hash of environment
pub fn compute_env_hash(env: &EnvironmentState) -> EnvironmentHash {
    let mut hasher = Sha256::new();
    let mut components = HashMap::new();

    // Hash language
    if let Some(ref lang) = env.language {
        let lang_str = format!("{}:{}", lang.language, lang.version.as_deref().unwrap_or("unknown"));
        hasher.update(&lang_str);
        components.insert("language".to_string(), lang_str);
    }

    // Hash package manager
    if let Some(ref pm) = env.package_manager {
        let pm_str = format!("{}:{:?}", pm.manager, pm.version);
        hasher.update(&pm_str);
        components.insert("package_manager".to_string(), pm_str);
    }

    // Hash runtime
    let runtime_str = format!("{:?}", env.runtime);
    hasher.update(&runtime_str);
    components.insert("runtime".to_string(), runtime_str);

    // Hash system info
    if let Some(ref sys) = env.system_info {
        for (key, value) in sys {
            let kv_str = format!("{}={}", key, value);
            hasher.update(&kv_str);
            components.insert(key.clone(), value.clone());
        }
    }

    let hash_bytes = hasher.finalize();
    let hash_hex = hex::encode(hash_bytes);

    EnvironmentHash::new(&hash_hex)
        .with_component("algorithm", "sha256")
}

/// Environment state for hashing
#[derive(Debug, Clone, Default)]
pub struct EnvironmentState {
    pub language: Option<DetectedLanguage>,
    pub package_manager: Option<PackageManagerInfo>,
    pub runtime: ContainerRuntime,
    pub system_info: Option<HashMap<String, String>>,
}

impl EnvironmentState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_language(mut self, lang: DetectedLanguage) -> Self {
        self.language = Some(lang);
        self
    }

    pub fn with_package_manager(mut self, pm: PackageManagerInfo) -> Self {
        self.package_manager = Some(pm);
        self
    }

    pub fn with_runtime(mut self, runtime: ContainerRuntime) -> Self {
        self.runtime = runtime;
        self
    }

    pub fn with_system_info(mut self, info: HashMap<String, String>) -> Self {
        self.system_info = Some(info);
        self
    }
}

/// Get system information
pub fn get_system_info() -> HashMap<String, String> {
    let mut info = HashMap::new();

    // OS info
    info.insert("os".to_string(), std::env::consts::OS.to_string());
    info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    info.insert("family".to_string(), std::env::consts::FAMILY.to_string());

    // Rust version
    info.insert("rust_version".to_string(), 
        env!("CARGO_PKG_VERSION").to_string());

    info
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_deterministic() {
        let env1 = EnvironmentState::new()
            .with_language(DetectedLanguage::new(Language::Rust, "test"))
            .with_runtime(ContainerRuntime::Docker);

        let env2 = EnvironmentState::new()
            .with_language(DetectedLanguage::new(Language::Rust, "test"))
            .with_runtime(ContainerRuntime::Docker);

        let hash1 = compute_env_hash(&env1);
        let hash2 = compute_env_hash(&env2);

        assert_eq!(hash1.hash, hash2.hash);
    }

    #[test]
    fn test_hash_different_inputs() {
        let env1 = EnvironmentState::new()
            .with_language(DetectedLanguage::new(Language::Rust, "test"))
            .with_runtime(ContainerRuntime::Docker);

        let env2 = EnvironmentState::new()
            .with_language(DetectedLanguage::new(Language::Python, "test"))
            .with_runtime(ContainerRuntime::Docker);

        let hash1 = compute_env_hash(&env1);
        let hash2 = compute_env_hash(&env2);

        assert_ne!(hash1.hash, hash2.hash);
    }

    #[test]
    fn test_hash_components() {
        let env = EnvironmentState::new()
            .with_language(DetectedLanguage::new(Language::Rust, "test"))
            .with_runtime(ContainerRuntime::Docker);

        let hash = compute_env_hash(&env);

        assert!(hash.components.contains_key("language"));
        assert!(hash.components.contains_key("runtime"));
    }

    #[test]
    fn test_system_info() {
        let info = get_system_info();
        assert!(info.contains_key("os"));
        assert!(info.contains_key("arch"));
    }
}
