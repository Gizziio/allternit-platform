//! Parsers for different environment specification formats

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

pub mod devcontainer;
pub mod dockerfile;
pub mod nix;

pub use devcontainer::{DevContainerConfig, DevContainerFeature};
pub use dockerfile::DockerfileConfig;
pub use nix::NixFlakeConfig;

/// Environment specification type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnvSpecType {
    Oci,
    Nix,
    Devcontainer,
    Wasm,
}

/// Common trait for all environment configurations
#[async_trait::async_trait]
pub trait EnvironmentConfig: Sized {
    /// Parse from a file
    async fn from_file(path: &PathBuf) -> Result<Self, crate::EnvironmentSpecError>;

    /// Parse from string content
    fn from_str(content: &str) -> Result<Self, crate::EnvironmentSpecError>;

    /// Get the resolved OCI image reference
    async fn resolve_image(&self) -> Result<ImageReference, crate::EnvironmentSpecError>;

    /// Get resource requirements
    fn resources(&self) -> ResourceRequirements;
}

/// Image reference with optional digest
#[derive(Debug, Clone)]
pub struct ImageReference {
    pub reference: String,
    pub digest: Option<String>,
}

/// Resource requirements from any spec type
#[derive(Debug, Clone, Default)]
pub struct ResourceRequirements {
    pub cpus: Option<f32>,
    pub memory_mb: Option<u32>,
    pub storage_mb: Option<u32>,
}

/// Command specification (handles string, array, or object formats)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CommandSpec {
    Single(String),
    Array(Vec<String>),
    Object(HashMap<String, CommandSpec>),
}

impl CommandSpec {
    /// Convert to list of shell commands
    pub fn to_commands(&self) -> Vec<String> {
        match self {
            CommandSpec::Single(cmd) => vec![cmd.clone()],
            CommandSpec::Array(cmds) => cmds.clone(),
            CommandSpec::Object(obj) => {
                // For object format, run commands in parallel (order not guaranteed)
                obj.values().flat_map(|v| v.to_commands()).collect()
            }
        }
    }

    /// Convert to single shell string
    pub fn to_shell_string(&self) -> String {
        match self {
            CommandSpec::Single(cmd) => cmd.clone(),
            CommandSpec::Array(cmds) => cmds.join(" "),
            CommandSpec::Object(obj) => {
                // Join all commands with && for sequential execution
                obj.values()
                    .map(|v| v.to_shell_string())
                    .collect::<Vec<_>>()
                    .join(" && ")
            }
        }
    }
}

impl Default for CommandSpec {
    fn default() -> Self {
        CommandSpec::Array(vec![])
    }
}
