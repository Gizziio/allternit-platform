//! Dev Container Specification Parser
//!
//! Implements the containers.dev specification:
//! https://containers.dev/implementors/json_reference/

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use super::{CommandSpec, ImageReference, ResourceRequirements};
use crate::EnvironmentSpecError;

/// Dev Container Configuration (devcontainer.json)
/// Based on https://containers.dev/implementors/json_reference/
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevContainerConfig {
    /// Name of the dev container
    #[serde(default)]
    pub name: Option<String>,

    /// Docker image reference
    #[serde(default)]
    pub image: Option<String>,

    /// Dockerfile configuration
    #[serde(default)]
    pub build: Option<BuildConfig>,

    /// Docker Compose configuration
    #[serde(default)]
    pub docker_compose_file: Option<serde_json::Value>,

    /// Workspace folder inside container
    #[serde(default = "default_workspace_folder")]
    pub workspace_folder: String,

    /// Workspace mount configuration
    #[serde(default)]
    pub workspace_mount: Option<String>,

    /// Features to install
    #[serde(default)]
    pub features: HashMap<String, HashMap<String, serde_json::Value>>,

    /// Environment variables for container
    #[serde(default)]
    pub container_env: HashMap<String, String>,

    /// Post-create command
    #[serde(default)]
    pub post_create_command: CommandSpec,

    /// Post-start command
    #[serde(default)]
    pub post_start_command: Option<CommandSpec>,

    /// Post-attach command
    #[serde(default)]
    pub post_attach_command: Option<CommandSpec>,

    /// Initialize command
    #[serde(default)]
    pub initialize_command: Option<CommandSpec>,

    /// On-create command
    #[serde(default)]
    pub on_create_command: Option<CommandSpec>,

    /// Update content command
    #[serde(default)]
    pub update_content_command: Option<CommandSpec>,

    /// Wait for command before considering container ready
    #[serde(default)]
    pub wait_for: Option<String>,

    /// User to run as inside container
    #[serde(default)]
    pub remote_user: Option<String>,

    /// Container user (for entrypoint)
    #[serde(default)]
    pub container_user: Option<String>,

    /// Mounts
    #[serde(default)]
    pub mounts: Vec<MountConfig>,

    /// Port forwards
    #[serde(default)]
    pub forward_ports: Vec<PortForward>,

    /// Port attributes
    #[serde(default)]
    pub ports_attributes: HashMap<u16, PortAttributes>,

    /// Run args for docker run
    #[serde(default)]
    pub run_args: Vec<String>,

    /// Shutdown action
    #[serde(default)]
    pub shutdown_action: Option<String>,

    /// Override command
    #[serde(default)]
    pub override_command: Option<bool>,

    /// Host requirements
    #[serde(default)]
    pub host_requirements: HostRequirements,

    /// Tool-specific customizations (VS Code, etc.)
    #[serde(default)]
    pub customizations: HashMap<String, serde_json::Value>,

    /// Secrets
    #[serde(default)]
    pub secrets: Option<HashMap<String, SecretConfig>>,

    /// Additional properties not in the spec
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Build configuration for Dockerfile-based dev containers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildConfig {
    /// Path to Dockerfile
    pub dockerfile: Option<String>,

    /// Build context
    pub context: Option<String>,

    /// Build args
    pub args: Option<HashMap<String, String>>,

    /// Target build stage
    pub target: Option<String>,

    /// Cache from
    pub cache_from: Option<Vec<String>>,
}

/// Mount configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountConfig {
    /// Mount type (bind, volume, tmpfs)
    #[serde(rename = "type")]
    pub mount_type: String,

    /// Source path
    pub source: String,

    /// Target path
    pub target: String,

    /// Read only
    #[serde(default, rename = "readOnly")]
    pub read_only: bool,
}

/// Port forward specification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PortForward {
    Number(u16),
    String(String),
}

/// Port attributes
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PortAttributes {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub on_auto_forward: Option<String>,
    #[serde(default)]
    pub protocol: Option<String>,
    #[serde(default)]
    pub require_local_port: Option<bool>,
}

/// Host resource requirements
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HostRequirements {
    /// CPU cores
    #[serde(default)]
    pub cpus: Option<f32>,

    /// Memory in MB
    #[serde(default)]
    pub memory: Option<u32>,

    /// Storage in MB
    #[serde(default)]
    pub storage: Option<u32>,

    /// GPU required
    #[serde(default)]
    pub gpu: Option<bool>,
}

/// Secret configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretConfig {
    pub description: Option<String>,
    pub documentation_url: Option<String>,
}

/// Dev Container Feature (individual feature definition)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevContainerFeature {
    /// Feature ID/URI
    pub id: String,

    /// Feature options
    #[serde(default)]
    pub options: HashMap<String, serde_json::Value>,
}

fn default_workspace_folder() -> String {
    "/workspace".to_string()
}

impl DevContainerConfig {
    /// Create a new minimal config with just an image
    pub fn with_image(image: impl Into<String>) -> Self {
        Self {
            name: None,
            image: Some(image.into()),
            build: None,
            docker_compose_file: None,
            workspace_folder: default_workspace_folder(),
            workspace_mount: None,
            features: HashMap::new(),
            container_env: HashMap::new(),
            post_create_command: CommandSpec::Array(vec![]),
            post_start_command: None,
            post_attach_command: None,
            initialize_command: None,
            on_create_command: None,
            update_content_command: None,
            wait_for: None,
            remote_user: None,
            container_user: None,
            mounts: vec![],
            forward_ports: vec![],
            ports_attributes: HashMap::new(),
            run_args: vec![],
            shutdown_action: None,
            override_command: None,
            host_requirements: HostRequirements::default(),
            customizations: HashMap::new(),
            secrets: None,
            extra: HashMap::new(),
        }
    }

    /// Parse from file
    pub async fn from_file(path: &PathBuf) -> Result<Self, EnvironmentSpecError> {
        let content = tokio::fs::read_to_string(path).await?;
        Self::from_str(&content)
    }

    /// Parse from string
    pub fn from_str(content: &str) -> Result<Self, EnvironmentSpecError> {
        // Handle JSON with comments (strip comments first)
        let without_comments = strip_json_comments(content);
        serde_json::from_str(&without_comments).map_err(|e| EnvironmentSpecError::ParseError {
            spec_type: crate::EnvironmentSource::DevContainer,
            message: format!("Failed to parse devcontainer.json: {}", e),
        })
    }

    /// Resolve the effective image reference
    pub async fn resolve_image(&self) -> Result<ImageReference, EnvironmentSpecError> {
        if let Some(ref image) = self.image {
            Ok(ImageReference {
                reference: image.clone(),
                digest: None,
            })
        } else if let Some(ref build) = self.build {
            // Need to build the Dockerfile
            let dockerfile = build.dockerfile.as_deref().unwrap_or("Dockerfile");
            let context = build.context.as_deref().unwrap_or(".");

            // For now, return a placeholder - actual build happens in converter
            Ok(ImageReference {
                reference: format!("devcontainer-built:context={}", context),
                digest: None,
            })
        } else {
            Err(EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::DevContainer,
                message: "No image or build configuration specified".to_string(),
            })
        }
    }

    /// Get resource requirements
    pub fn resources(&self) -> ResourceRequirements {
        ResourceRequirements {
            cpus: self.host_requirements.cpus,
            memory_mb: self.host_requirements.memory,
            storage_mb: self.host_requirements.storage,
        }
    }

    /// Get Allternit-specific configuration from customizations
    pub fn allternit_config(&self) -> Option<serde_json::Value> {
        self.customizations.get("allternit").cloned()
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), EnvironmentSpecError> {
        // Must have either image or build
        if self.image.is_none() && self.build.is_none() && self.docker_compose_file.is_none() {
            return Err(EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::DevContainer,
                message: "Must specify one of: image, build, or dockerComposeFile".to_string(),
            });
        }

        // Validate feature URIs
        for feature_id in self.features.keys() {
            if !is_valid_feature_uri(feature_id) {
                return Err(EnvironmentSpecError::ParseError {
                    spec_type: crate::EnvironmentSource::DevContainer,
                    message: format!("Invalid feature URI: {}", feature_id),
                });
            }
        }

        Ok(())
    }
}

/// Strip JSON comments (both // and /* */ style)
fn strip_json_comments(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some(ch) = chars.next() {
        if in_line_comment {
            if ch == '\n' {
                in_line_comment = false;
                output.push('\n');
            }
            continue;
        }

        if in_block_comment {
            if ch == '*' && chars.peek() == Some(&'/') {
                chars.next(); // consume '/'
                in_block_comment = false;
            }
            continue;
        }

        if in_string {
            output.push(ch);
            if ch == '"' && output.chars().nth_back(1) != Some('\\') {
                in_string = false;
            }
            continue;
        }

        match ch {
            '"' => {
                in_string = true;
                output.push(ch);
            }
            '/' => {
                match chars.peek() {
                    Some(&'/') => {
                        chars.next(); // consume second '/'
                        in_line_comment = true;
                    }
                    Some(&'*') => {
                        chars.next(); // consume '*'
                        in_block_comment = true;
                    }
                    _ => output.push(ch),
                }
            }
            _ => output.push(ch),
        }
    }

    output
}

/// Validate feature URI
fn is_valid_feature_uri(uri: &str) -> bool {
    // Valid formats:
    // - ghcr.io/owner/repo/feature:tag
    // - docker.io/owner/feature:tag
    // - ./local-feature
    // - https://example.com/feature.tgz
    uri.starts_with("ghcr.io/")
        || uri.starts_with("docker.io/")
        || uri.starts_with("./")
        || uri.starts_with("https://")
        || uri.starts_with("http://")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_devcontainer() {
        let json = r#"{
            "name": "Rust Development",
            "image": "mcr.microsoft.com/devcontainers/rust:1",
            "features": {
                "ghcr.io/devcontainers/features/node:1": {}
            }
        }"#;

        let config = DevContainerConfig::from_str(json).unwrap();
        assert_eq!(config.name, Some("Rust Development".to_string()));
        assert_eq!(
            config.image,
            Some("mcr.microsoft.com/devcontainers/rust:1".to_string())
        );
        assert!(config
            .features
            .contains_key("ghcr.io/devcontainers/features/node:1"));
    }

    #[test]
    fn test_strip_comments() {
        let input = r#"{
            // This is a comment
            "image": "ubuntu:22.04", /* inline comment */
            "name": "Test"
        }"#;

        let cleaned = strip_json_comments(input);
        assert!(!cleaned.contains("//"));
        assert!(!cleaned.contains("/*"));
        assert!(cleaned.contains("\"image\""));
        assert!(cleaned.contains("\"name\""));
    }

    #[test]
    fn test_validate_valid() {
        let config = DevContainerConfig::with_image("ubuntu:22.04");
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_validate_invalid() {
        let config = DevContainerConfig {
            image: None,
            ..DevContainerConfig::with_image("")
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_command_spec_to_commands() {
        let cmd = CommandSpec::Single("echo hello".to_string());
        assert_eq!(cmd.to_commands(), vec!["echo hello"]);

        let cmd = CommandSpec::Array(vec!["npm".to_string(), "install".to_string()]);
        assert_eq!(cmd.to_commands(), vec!["npm", "install"]);
    }
}
