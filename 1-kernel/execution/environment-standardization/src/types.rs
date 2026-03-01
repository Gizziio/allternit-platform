// OWNER: T1-A3

//! Environment Types
//!
//! Type definitions for environment standardization.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

// ============================================================================
// Error Types
// ============================================================================

/// Environment error types
#[derive(Debug, Error)]
pub enum EnvironmentError {
    #[error("Language detection failed: {0}")]
    LanguageDetectionFailed(String),

    #[error("Package manager not found: {0}")]
    PackageManagerNotFound(String),

    #[error("Container runtime error: {0}")]
    ContainerRuntimeError(String),

    #[error("Runtime not supported: {0}")]
    RuntimeNotSupported(String),

    #[error("Lifecycle error: {0}")]
    LifecycleError(String),

    #[error("Provisioning failed: {0}")]
    ProvisioningFailed(String),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Cleanup failed: {0}")]
    CleanupFailed(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),
}

pub type Result<T> = std::result::Result<T, EnvironmentError>;

// ============================================================================
// Language Types
// ============================================================================

/// Programming language
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Rust,
    TypeScript,
    JavaScript,
    Python,
    Go,
    Java,
    Cpp,
    C,
    Ruby,
    Swift,
    Kotlin,
    Scala,
    PHP,
    CSharp,
    Shell,
    Unknown,
}

impl Default for Language {
    fn default() -> Self {
        Language::Unknown
    }
}

impl std::fmt::Display for Language {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Language::Rust => write!(f, "rust"),
            Language::TypeScript => write!(f, "typescript"),
            Language::JavaScript => write!(f, "javascript"),
            Language::Python => write!(f, "python"),
            Language::Go => write!(f, "go"),
            Language::Java => write!(f, "java"),
            Language::Cpp => write!(f, "cpp"),
            Language::C => write!(f, "c"),
            Language::Ruby => write!(f, "ruby"),
            Language::Swift => write!(f, "swift"),
            Language::Kotlin => write!(f, "kotlin"),
            Language::Scala => write!(f, "scala"),
            Language::PHP => write!(f, "php"),
            Language::CSharp => write!(f, "csharp"),
            Language::Shell => write!(f, "shell"),
            Language::Unknown => write!(f, "unknown"),
        }
    }
}

/// Detected language with version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedLanguage {
    pub language: Language,
    pub version: Option<String>,
    pub confidence: f64,
    pub source: String,
}

impl DetectedLanguage {
    pub fn new(language: Language, source: &str) -> Self {
        Self {
            language,
            version: None,
            confidence: 1.0,
            source: source.to_string(),
        }
    }

    pub fn with_version(mut self, version: &str) -> Self {
        self.version = Some(version.to_string());
        self
    }

    pub fn with_confidence(mut self, confidence: f64) -> Self {
        self.confidence = confidence;
        self
    }
}

// ============================================================================
// Package Manager Types
// ============================================================================

/// Package manager
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PackageManager {
    Cargo,
    Npm,
    Yarn,
    Pnpm,
    Pip,
    Pip3,
    Poetry,
    GoMod,
    Maven,
    Gradle,
    NuGet,
    Bundler,
    Composer,
    Apt,
    Yum,
    Dnf,
    Brew,
    Unknown,
}

impl Default for PackageManager {
    fn default() -> Self {
        PackageManager::Unknown
    }
}

impl std::fmt::Display for PackageManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PackageManager::Cargo => write!(f, "cargo"),
            PackageManager::Npm => write!(f, "npm"),
            PackageManager::Yarn => write!(f, "yarn"),
            PackageManager::Pnpm => write!(f, "pnpm"),
            PackageManager::Pip => write!(f, "pip"),
            PackageManager::Pip3 => write!(f, "pip3"),
            PackageManager::Poetry => write!(f, "poetry"),
            PackageManager::GoMod => write!(f, "go mod"),
            PackageManager::Maven => write!(f, "maven"),
            PackageManager::Gradle => write!(f, "gradle"),
            PackageManager::NuGet => write!(f, "nuget"),
            PackageManager::Bundler => write!(f, "bundler"),
            PackageManager::Composer => write!(f, "composer"),
            PackageManager::Apt => write!(f, "apt"),
            PackageManager::Yum => write!(f, "yum"),
            PackageManager::Dnf => write!(f, "dnf"),
            PackageManager::Brew => write!(f, "brew"),
            PackageManager::Unknown => write!(f, "unknown"),
        }
    }
}

/// Package manager info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageManagerInfo {
    pub manager: PackageManager,
    pub version: Option<String>,
    pub lock_file: Option<String>,
    pub config_file: Option<String>,
}

// ============================================================================
// Container Runtime Types
// ============================================================================

/// Container runtime
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ContainerRuntime {
    Docker,
    Podman,
    Containerd,
    Firecracker,
    None,
}

impl Default for ContainerRuntime {
    fn default() -> Self {
        ContainerRuntime::None
    }
}

impl std::fmt::Display for ContainerRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContainerRuntime::Docker => write!(f, "docker"),
            ContainerRuntime::Podman => write!(f, "podman"),
            ContainerRuntime::Containerd => write!(f, "containerd"),
            ContainerRuntime::Firecracker => write!(f, "firecracker"),
            ContainerRuntime::None => write!(f, "none"),
        }
    }
}

/// Container configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerConfig {
    pub image: String,
    pub command: Option<Vec<String>>,
    pub env: HashMap<String, String>,
    pub volumes: Vec<String>,
    pub network_mode: Option<String>,
    pub working_dir: Option<String>,
}

impl ContainerConfig {
    pub fn new(image: &str) -> Self {
        Self {
            image: image.to_string(),
            command: None,
            env: HashMap::new(),
            volumes: Vec::new(),
            network_mode: None,
            working_dir: None,
        }
    }

    pub fn with_command(mut self, command: Vec<String>) -> Self {
        self.command = Some(command);
        self
    }

    pub fn with_env(mut self, env: HashMap<String, String>) -> Self {
        self.env = env;
        self
    }

    pub fn with_volume(mut self, volume: &str) -> Self {
        self.volumes.push(volume.to_string());
        self
    }
}

/// Container result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

// ============================================================================
// Determinism Types
// ============================================================================

/// Environment hash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentHash {
    pub hash: String,
    pub components: HashMap<String, String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl EnvironmentHash {
    pub fn new(hash: &str) -> Self {
        Self {
            hash: hash.to_string(),
            components: HashMap::new(),
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn with_component(mut self, name: &str, value: &str) -> Self {
        self.components.insert(name.to_string(), value.to_string());
        self
    }
}

// ============================================================================
// Lifecycle Types
// ============================================================================

/// Lifecycle specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleSpec {
    pub name: String,
    pub language: DetectedLanguage,
    pub package_manager: PackageManager,
    pub runtime: ContainerRuntime,
    pub source_path: String,
    pub build_command: Option<String>,
    pub run_command: Option<String>,
    pub test_command: Option<String>,
    pub env: HashMap<String, String>,
}

impl LifecycleSpec {
    pub fn new(name: &str, source_path: &str) -> Self {
        Self {
            name: name.to_string(),
            language: DetectedLanguage::new(Language::Unknown, "auto"),
            package_manager: PackageManager::Unknown,
            runtime: ContainerRuntime::None,
            source_path: source_path.to_string(),
            build_command: None,
            run_command: None,
            test_command: None,
            env: HashMap::new(),
        }
    }

    pub fn with_language(mut self, language: DetectedLanguage) -> Self {
        self.language = language;
        self
    }

    pub fn with_package_manager(mut self, manager: PackageManager) -> Self {
        self.package_manager = manager;
        self
    }

    pub fn with_runtime(mut self, runtime: ContainerRuntime) -> Self {
        self.runtime = runtime;
        self
    }

    pub fn with_build_command(mut self, cmd: &str) -> Self {
        self.build_command = Some(cmd.to_string());
        self
    }

    pub fn with_run_command(mut self, cmd: &str) -> Self {
        self.run_command = Some(cmd.to_string());
        self
    }
}

/// Lifecycle result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleResult {
    pub success: bool,
    pub stages_completed: Vec<String>,
    pub output: String,
    pub error: Option<String>,
    pub duration_ms: u64,
}

impl LifecycleResult {
    pub fn success(stages: Vec<&str>, output: &str) -> Self {
        Self {
            success: true,
            stages_completed: stages.iter().map(|s| s.to_string()).collect(),
            output: output.to_string(),
            error: None,
            duration_ms: 0,
        }
    }

    pub fn failure(stages: Vec<&str>, error: &str) -> Self {
        Self {
            success: false,
            stages_completed: stages.iter().map(|s| s.to_string()).collect(),
            output: String::new(),
            error: Some(error.to_string()),
            duration_ms: 0,
        }
    }
}

/// Provisioner trait
#[async_trait::async_trait]
pub trait Provisioner {
    async fn provision(&self, spec: &LifecycleSpec) -> Result<()>;
    async fn cleanup(&self, spec: &LifecycleSpec) -> Result<()>;
}
