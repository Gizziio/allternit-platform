//! # Allternit Environment Specification (N5)
//!
//! Hybrid environment definition system supporting:
//! - Dev Container Specification (primary) - containers.dev
//! - Nix Flakes (optional advanced) - nixos.org
//! - OCI Images (direct) - opencontainers.org
//! - Dockerfile (legacy) - docker.com
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                   EnvironmentSpec                           │
//! │                     (Unified API)                           │
//! └─────────────────────────────────────────────────────────────┘
//!                            │
//!        ┌───────────────────┼───────────────────┐
//!        ▼                   ▼                   ▼
//! ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
//! │  DevContainer │   │  NixFlake    │   │   OCIImage   │
//! │    Parser     │   │    Parser    │   │   Resolver   │
//! └──────────────┘   └──────────────┘   └──────────────┘
//!        │                   │                   │
//!        └───────────────────┼───────────────────┘
//!                            ▼
//!              ┌─────────────────────────┐
//!              │     ImageConverter      │
//!              │  (OCI → Rootfs/initrd)  │
//!              └─────────────────────────┘
//!                            │
//!        ┌───────────────────┼───────────────────┐
//!        ▼                   ▼                   ▼
//! ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
//! │    Process   │   │   Container  │   │    MicroVM   │
//! │    Driver    │   │    Driver    │   │    Driver    │
//! └──────────────┘   └──────────────┘   └──────────────┘
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

pub mod converter;
pub mod parser;
pub mod resolver;

// Re-export main types
pub use converter::{ImageConverter, RootfsBuilder};
pub use parser::{
    DevContainerConfig, DevContainerFeature, DockerfileConfig, EnvSpecType, NixFlakeConfig,
};
pub use resolver::{ImageResolution, OciResolver, RegistryAuth};

/// Environment specification source types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnvironmentSource {
    /// Dev Container Specification (devcontainer.json)
    /// Primary recommendation for Allternit users
    DevContainer,

    /// Nix Flake (flake.nix)
    /// For users needing maximum reproducibility
    Nix,

    /// OCI Image reference (docker.io/library/ubuntu:22.04)
    /// Direct container image usage
    Oci,

    /// Dockerfile
    /// Legacy Docker build support
    Dockerfile,
}

impl std::fmt::Display for EnvironmentSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EnvironmentSource::DevContainer => write!(f, "devcontainer"),
            EnvironmentSource::Nix => write!(f, "nix"),
            EnvironmentSource::Oci => write!(f, "oci"),
            EnvironmentSource::Dockerfile => write!(f, "dockerfile"),
        }
    }
}

/// Unified environment specification
/// This is the primary interface used by execution drivers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentSpec {
    /// Source type of the specification
    pub source: EnvironmentSource,

    /// Original source URI or path
    /// Examples:
    /// - "mcr.microsoft.com/devcontainers/rust:1"
    /// - "github:user/repo#flake"
    /// - ".devcontainer/devcontainer.json"
    pub source_uri: String,

    /// Resolved OCI image reference
    /// This is the canonical image after parsing source
    pub image: String,

    /// Image digest (SHA256) for reproducibility
    pub image_digest: Option<String>,

    /// Working directory inside the environment
    #[serde(default = "default_workspace")]
    pub workspace_folder: String,

    /// Environment variables to set
    #[serde(default)]
    pub env_vars: HashMap<String, String>,

    /// Packages to install (language-agnostic)
    #[serde(default)]
    pub packages: Vec<String>,

    /// Features (devcontainer terminology) or extensions
    #[serde(default)]
    pub features: Vec<FeatureSpec>,

    /// Mount points (host → guest)
    #[serde(default)]
    pub mounts: Vec<MountSpec>,

    /// Post-creation commands
    #[serde(default)]
    pub post_create_commands: Vec<String>,

    /// Resource requirements
    #[serde(default)]
    pub resources: ResourceRequirements,

    /// Allternit-specific configuration
    #[serde(default)]
    pub allternit_config: AllternitEnvironmentConfig,
}

/// Feature specification (tools/libraries to install)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureSpec {
    /// Feature ID or URI
    /// Examples:
    /// - "ghcr.io/devcontainers/features/node:1"
    /// - "ghcr.io/devcontainers/features/docker-in-docker:2"
    pub id: String,

    /// Feature options
    #[serde(default)]
    pub options: HashMap<String, serde_json::Value>,
}

/// Mount specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountSpec {
    /// Host path
    pub source: PathBuf,

    /// Guest path
    pub target: String,

    /// Mount type
    #[serde(default)]
    pub mount_type: MountType,

    /// Read-only mount
    #[serde(default)]
    pub read_only: bool,
}

/// Mount types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum MountType {
    #[default]
    Bind,
    Volume,
    Tmpfs,
    Secret,
}

/// Resource requirements
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceRequirements {
    /// CPU cores (or millicores if < 1)
    #[serde(default)]
    pub cpus: Option<f32>,

    /// Memory in GB
    #[serde(default)]
    pub memory_gb: Option<f32>,

    /// Disk space in GB
    #[serde(default)]
    pub disk_gb: Option<f32>,
}

/// Allternit-specific environment configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AllternitEnvironmentConfig {
    /// Preferred execution driver
    #[serde(default)]
    pub driver: Option<String>,

    /// Isolation level
    #[serde(default)]
    pub isolation: Option<String>,

    /// Enable prewarm pool for this environment
    #[serde(default)]
    pub enable_prewarm: bool,

    /// Determinism settings
    #[serde(default)]
    pub determinism: DeterminismConfig,
}

/// Determinism configuration for reproducible builds
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeterminismConfig {
    /// Freeze time inside container
    #[serde(default)]
    pub freeze_time: bool,

    /// Set specific timestamp
    #[serde(default)]
    pub timestamp: Option<u64>,

    /// Set random seed
    #[serde(default)]
    pub seed: Option<u64>,
}

/// Environment specification errors
#[derive(Debug, Error)]
pub enum EnvironmentSpecError {
    #[error("Failed to parse {spec_type}: {message}")]
    ParseError {
        spec_type: EnvironmentSource,
        message: String,
    },

    #[error("Failed to resolve image {image}: {reason}")]
    ResolutionError { image: String, reason: String },

    #[error("Failed to convert image: {0}")]
    ConversionError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Registry error: {0}")]
    RegistryError(String),

    #[error("Nix not installed or not in PATH")]
    NixNotAvailable,

    #[error("Invalid source URI: {0}")]
    InvalidSourceUri(String),
}

/// Environment spec builder and loader
pub struct EnvironmentSpecLoader {
    /// OCI image resolver
    resolver: OciResolver,

    /// Image converter
    converter: ImageConverter,

    /// Cache directory for downloaded images
    cache_dir: PathBuf,
}

impl EnvironmentSpecLoader {
    /// Create a new loader with default settings
    pub fn new() -> Result<Self, EnvironmentSpecError> {
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("allternit")
            .join("environments");

        std::fs::create_dir_all(&cache_dir)?;

        Ok(Self {
            resolver: OciResolver::new(),
            converter: ImageConverter::new(cache_dir.clone()),
            cache_dir,
        })
    }

    /// Create a new loader with custom cache directory
    pub fn with_cache_dir(cache_dir: impl AsRef<Path>) -> Result<Self, EnvironmentSpecError> {
        let cache_dir = cache_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&cache_dir)?;

        Ok(Self {
            resolver: OciResolver::new(),
            converter: ImageConverter::new(cache_dir.clone()),
            cache_dir,
        })
    }

    /// Load environment spec from a source
    pub async fn load(&self, source: &str) -> Result<EnvironmentSpec, EnvironmentSpecError> {
        // Detect source type from URI
        let source_type = Self::detect_source_type(source);

        match source_type {
            EnvironmentSource::DevContainer => self.load_devcontainer(source).await,
            EnvironmentSource::Nix => self.load_nix_flake(source).await,
            EnvironmentSource::Oci => self.load_oci_image(source).await,
            EnvironmentSource::Dockerfile => self.load_dockerfile(source).await,
        }
    }

    /// Load from devcontainer.json file or directory
    async fn load_devcontainer(
        &self,
        source: &str,
    ) -> Result<EnvironmentSpec, EnvironmentSpecError> {
        let config_path = if source.ends_with("devcontainer.json") {
            PathBuf::from(source)
        } else {
            PathBuf::from(source)
                .join(".devcontainer")
                .join("devcontainer.json")
        };

        let content = tokio::fs::read_to_string(&config_path).await?;
        let config: DevContainerConfig =
            serde_json::from_str(&content).map_err(|e| EnvironmentSpecError::ParseError {
                spec_type: EnvironmentSource::DevContainer,
                message: e.to_string(),
            })?;

        // Resolve the image
        let image = config.resolve_image().await?;

        // Build the unified spec
        let spec = EnvironmentSpec {
            source: EnvironmentSource::DevContainer,
            source_uri: source.to_string(),
            image: image.reference.clone(),
            image_digest: image.digest.clone(),
            workspace_folder: config.workspace_folder.clone(),
            env_vars: config.container_env.clone(),
            packages: vec![],
            features: config
                .features
                .iter()
                .map(|(id, options)| FeatureSpec {
                    id: id.clone(),
                    options: options.clone(),
                })
                .collect(),
            mounts: config
                .mounts
                .iter()
                .map(|m| MountSpec {
                    source: PathBuf::from(&m.source),
                    target: m.target.clone(),
                    mount_type: MountType::Bind,
                    read_only: m.read_only,
                })
                .collect(),
            post_create_commands: config.post_create_command.to_commands(),
            resources: ResourceRequirements {
                cpus: config.host_requirements.cpus,
                memory_gb: config.host_requirements.memory.map(|m| m as f32 / 1024.0),
                disk_gb: config.host_requirements.storage.map(|s| s as f32 / 1024.0),
            },
            allternit_config: config
                .customizations
                .get("allternit")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default(),
        };

        Ok(spec)
    }

    /// Load from Nix flake
    async fn load_nix_flake(&self, source: &str) -> Result<EnvironmentSpec, EnvironmentSpecError> {
        // Check if nix is available
        if which::which("nix").is_err() {
            return Err(EnvironmentSpecError::NixNotAvailable);
        }

        // Parse flake reference
        let config = NixFlakeConfig::from_uri(source)?;

        // Build the development shell and get output path
        let output = tokio::process::Command::new("nix")
            .args(["build", "--json", &format!("{}#devShells.default", source)])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ParseError {
                spec_type: EnvironmentSource::Nix,
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        // For Nix, we create a container image from the flake
        let image = config.build_container_image().await?;

        let spec = EnvironmentSpec {
            source: EnvironmentSource::Nix,
            source_uri: source.to_string(),
            image,
            image_digest: None,
            workspace_folder: "/workspace".to_string(),
            env_vars: HashMap::new(),
            packages: config.packages.clone(),
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: ResourceRequirements::default(),
            allternit_config: AllternitEnvironmentConfig::default(),
        };

        Ok(spec)
    }

    /// Load from OCI image reference
    async fn load_oci_image(&self, source: &str) -> Result<EnvironmentSpec, EnvironmentSpecError> {
        let resolution = self.resolver.resolve(source).await?;

        let spec = EnvironmentSpec {
            source: EnvironmentSource::Oci,
            source_uri: source.to_string(),
            image: resolution.reference,
            image_digest: resolution.digest,
            workspace_folder: "/workspace".to_string(),
            env_vars: HashMap::new(),
            packages: vec![],
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: ResourceRequirements::default(),
            allternit_config: AllternitEnvironmentConfig::default(),
        };

        Ok(spec)
    }

    /// Load from Dockerfile
    async fn load_dockerfile(&self, source: &str) -> Result<EnvironmentSpec, EnvironmentSpecError> {
        let dockerfile_path = PathBuf::from(source);
        let config = DockerfileConfig::from_file(&dockerfile_path).await?;

        // Build the Dockerfile to get an image
        let image = config.build().await?;

        let spec = EnvironmentSpec {
            source: EnvironmentSource::Dockerfile,
            source_uri: source.to_string(),
            image,
            image_digest: None,
            workspace_folder: "/workspace".to_string(),
            env_vars: HashMap::new(),
            packages: vec![],
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: ResourceRequirements::default(),
            allternit_config: AllternitEnvironmentConfig::default(),
        };

        Ok(spec)
    }

    /// Convert environment spec to rootfs for MicroVM
    pub async fn to_rootfs(&self, spec: &EnvironmentSpec) -> Result<PathBuf, EnvironmentSpecError> {
        self.converter.to_rootfs(spec).await
    }

    /// Convert environment spec to initramfs
    pub async fn to_initramfs(
        &self,
        spec: &EnvironmentSpec,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        self.converter.to_initramfs(spec).await
    }

    /// Detect source type from URI
    fn detect_source_type(source: &str) -> EnvironmentSource {
        if source.contains("devcontainer.json")
            || source.contains(".devcontainer")
            || PathBuf::from(source).join(".devcontainer").exists()
            || PathBuf::from(source)
                .with_file_name(".devcontainer")
                .join("devcontainer.json")
                .exists()
        {
            EnvironmentSource::DevContainer
        } else if source.contains("flake.nix")
            || source.starts_with("github:")
            || source.starts_with("path:")
        {
            EnvironmentSource::Nix
        } else if source.contains("Dockerfile") {
            EnvironmentSource::Dockerfile
        } else {
            // Assume OCI image by default
            EnvironmentSource::Oci
        }
    }
}

impl Default for EnvironmentSpecLoader {
    fn default() -> Self {
        Self::new().expect("Failed to create EnvironmentSpecLoader")
    }
}

fn default_workspace() -> String {
    "/workspace".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_source_type() {
        assert_eq!(
            EnvironmentSpecLoader::detect_source_type(".devcontainer/devcontainer.json"),
            EnvironmentSource::DevContainer
        );
        assert_eq!(
            EnvironmentSpecLoader::detect_source_type("github:user/repo"),
            EnvironmentSource::Nix
        );
        assert_eq!(
            EnvironmentSpecLoader::detect_source_type("Dockerfile"),
            EnvironmentSource::Dockerfile
        );
        assert_eq!(
            EnvironmentSpecLoader::detect_source_type("ubuntu:22.04"),
            EnvironmentSource::Oci
        );
    }

    #[test]
    fn test_env_spec_default() {
        let spec = EnvironmentSpec {
            source: EnvironmentSource::Oci,
            source_uri: "test".to_string(),
            image: "ubuntu:22.04".to_string(),
            image_digest: None,
            workspace_folder: default_workspace(),
            env_vars: HashMap::new(),
            packages: vec![],
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: ResourceRequirements::default(),
            allternit_config: AllternitEnvironmentConfig::default(),
        };

        assert_eq!(spec.workspace_folder, "/workspace");
    }
}
