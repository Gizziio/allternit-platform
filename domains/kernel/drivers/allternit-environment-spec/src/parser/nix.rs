//! Nix Flake Parser
//!
//! Supports Nix Flakes for maximum reproducibility.
//! Falls back to shell.nix for simpler setups.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::EnvironmentSpecError;

/// Nix Flake Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NixFlakeConfig {
    /// Flake URI (github:user/repo, path:./flake.nix, etc.)
    pub uri: String,

    /// Output attribute to use (default: devShells.default)
    pub output: Option<String>,

    /// System architecture (auto-detected if not specified)
    pub system: Option<String>,

    /// Parsed packages from the flake
    #[serde(default)]
    pub packages: Vec<String>,

    /// Environment variables
    #[serde(default)]
    pub env_vars: HashMap<String, String>,

    /// Shell hook commands
    #[serde(default)]
    pub shell_hook: Vec<String>,
}

/// Simple shell.nix configuration (legacy)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellNixConfig {
    /// Packages to install
    pub packages: Vec<String>,

    /// Environment variables
    #[serde(default)]
    pub env_vars: HashMap<String, String>,

    /// Shell hook
    #[serde(default)]
    pub shell_hook: Option<String>,
}

impl NixFlakeConfig {
    /// Parse from URI
    pub fn from_uri(uri: &str) -> Result<Self, EnvironmentSpecError> {
        // Validate URI format
        if !is_valid_nix_uri(uri) {
            return Err(EnvironmentSpecError::InvalidSourceUri(uri.to_string()));
        }

        Ok(Self {
            uri: uri.to_string(),
            output: None,
            system: None,
            packages: vec![],
            env_vars: HashMap::new(),
            shell_hook: vec![],
        })
    }

    /// Parse from flake.nix file
    pub async fn from_file(path: &PathBuf) -> Result<Self, EnvironmentSpecError> {
        // Read and parse flake.nix
        let content = tokio::fs::read_to_string(path).await?;
        Self::from_str(&content)
    }

    /// Parse from string content
    pub fn from_str(content: &str) -> Result<Self, EnvironmentSpecError> {
        // This is a simplified parser - full Nix parsing requires Nix itself
        // We extract basic info from the flake.nix

        let mut packages = vec![];
        let env_vars = HashMap::new();

        // Extract packages from buildInputs
        if let Some(start) = content.find("buildInputs") {
            let rest = &content[start..];
            if let Some(end) = rest.find("];\n") {
                let inputs = &rest[..end];
                // Simple extraction - look for pkgs.XXX
                for line in inputs.lines() {
                    if let Some(pos) = line.find("pkgs.") {
                        let after_pkgs = &line[pos + 5..];
                        let pkg_name: String = after_pkgs
                            .chars()
                            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                            .collect();
                        if !pkg_name.is_empty() {
                            packages.push(pkg_name);
                        }
                    }
                }
            }
        }

        Ok(Self {
            uri: "path:.".to_string(),
            output: None,
            system: None,
            packages,
            env_vars,
            shell_hook: vec![],
        })
    }

    /// Get the flake reference string
    pub fn flake_ref(&self) -> String {
        match &self.output {
            Some(output) => format!("{}#{}", self.uri, output),
            None => self.uri.clone(),
        }
    }

    /// Build a container image from the flake
    pub async fn build_container_image(&self) -> Result<String, EnvironmentSpecError> {
        // Use nix build to create a container image
        let output = tokio::process::Command::new("nix")
            .args([
                "build",
                "--json",
                "--no-link",
                &format!("{}#containerImage", self.uri),
            ])
            .output()
            .await
            .map_err(|e| EnvironmentSpecError::NixNotAvailable)?;

        if !output.status.success() {
            // Try alternative attribute names
            for attr in &["ociImage", "dockerImage", "image"] {
                let output = tokio::process::Command::new("nix")
                    .args([
                        "build",
                        "--json",
                        "--no-link",
                        &format!("{}#{}", self.uri, attr),
                    ])
                    .output()
                    .await?;

                if output.status.success() {
                    return self.parse_build_output(&output.stdout);
                }
            }

            return Err(EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::Nix,
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        self.parse_build_output(&output.stdout)
    }

    /// Parse nix build --json output
    fn parse_build_output(&self, output: &[u8]) -> Result<String, EnvironmentSpecError> {
        // Parse JSON output to get the output path
        let json: serde_json::Value =
            serde_json::from_slice(output).map_err(|e| EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::Nix,
                message: format!("Failed to parse nix build output: {}", e),
            })?;

        // Extract the output path
        if let Some(outputs) = json.as_array().and_then(|a| a.first()) {
            if let Some(path) = outputs
                .get("outputs")
                .and_then(|o| o.get("out"))
                .and_then(|o| o.as_str())
            {
                return Ok(path.to_string());
            }
        }

        Err(EnvironmentSpecError::ParseError {
            spec_type: crate::EnvironmentSource::Nix,
            message: "Could not find output path in nix build output".to_string(),
        })
    }

    /// Load the flake and extract information
    pub async fn load(&mut self) -> Result<(), EnvironmentSpecError> {
        // Use nix flake show to get info
        let output = tokio::process::Command::new("nix")
            .args(["flake", "show", "--json", &self.uri])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::Nix,
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        // Parse the flake info
        let info: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| {
            EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::Nix,
                message: format!("Failed to parse flake info: {}", e),
            }
        })?;

        // Extract available outputs
        if let Some(outputs) = info.as_object() {
            // Look for devShells
            if outputs.contains_key("devShells") {
                // Default to devShells.default
                self.output = Some("devShells.default".to_string());
            } else if outputs.contains_key("packages") {
                // Fall back to packages
                self.output = Some("packages.default".to_string());
            }
        }

        Ok(())
    }

    /// Get packages from the flake
    pub async fn get_packages(&self) -> Result<Vec<String>, EnvironmentSpecError> {
        // Enter the dev shell and capture environment
        let output = tokio::process::Command::new("nix")
            .args(["develop", &self.flake_ref(), "--command", "env"])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ParseError {
                spec_type: crate::EnvironmentSource::Nix,
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        // Parse PATH to extract packages
        let env_output = String::from_utf8_lossy(&output.stdout);
        let mut packages = vec![];

        for line in env_output.lines() {
            if let Some(path) = line.strip_prefix("PATH=") {
                // Extract package names from /nix/store paths
                for entry in path.split(':') {
                    if entry.contains("/nix/store/") {
                        // Extract package name from store path
                        // Format: /nix/store/<hash>-<name>-<version>/bin
                        if let Some(name) = extract_package_name(entry) {
                            packages.push(name);
                        }
                    }
                }
            }
        }

        Ok(packages)
    }
}

/// Validate Nix URI
fn is_valid_nix_uri(uri: &str) -> bool {
    // Valid formats:
    // - github:owner/repo[/ref]
    // - gitlab:owner/repo[/ref]
    // - path:/path/to/flake
    // - /absolute/path
    // - ./relative/path
    uri.starts_with("github:")
        || uri.starts_with("gitlab:")
        || uri.starts_with("path:")
        || uri.starts_with('/')
        || uri.starts_with("./")
        || uri.starts_with("../")
}

/// Extract package name from /nix/store path
fn extract_package_name(path: &str) -> Option<String> {
    // Path format: /nix/store/<hash>-<name>-<version>
    let components: Vec<&str> = path.split('/').collect();
    if let Some(store_entry) = components.iter().find(|c| c.len() > 32 && c.contains('-')) {
        // Remove hash prefix (32 chars) and extract name
        let without_hash = &store_entry[33..];
        // Remove version suffix if present
        let name = without_hash.split('-').next().unwrap_or(without_hash);
        Some(name.to_string())
    } else {
        None
    }
}

impl ShellNixConfig {
    /// Parse shell.nix file
    pub async fn from_file(path: &PathBuf) -> Result<Self, EnvironmentSpecError> {
        let content = tokio::fs::read_to_string(path).await?;
        Self::from_str(&content)
    }

    /// Parse from string
    pub fn from_str(content: &str) -> Result<Self, EnvironmentSpecError> {
        // Simple parsing - look for buildInputs
        let mut packages = vec![];
        let mut env_vars = HashMap::new();
        let mut shell_hook = None;

        // Extract buildInputs
        if let Some(start) = content.find("buildInputs") {
            let rest = &content[start..];
            if let Some(end) = rest.find("];\n") {
                let inputs = &rest[..end];
                for line in inputs.lines() {
                    if let Some(pos) = line.find("pkgs.") {
                        let after_pkgs = &line[pos + 5..];
                        let pkg_name: String = after_pkgs
                            .chars()
                            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                            .collect();
                        if !pkg_name.is_empty() {
                            packages.push(pkg_name);
                        }
                    }
                }
            }
        }

        // Extract MYVAR = "value" patterns
        for line in content.lines() {
            if let Some(pos) = line.find("=") {
                let key = line[..pos].trim();
                let value = line[pos + 1..].trim().trim_matches('"');
                if !key.is_empty() && !value.is_empty() {
                    env_vars.insert(key.to_string(), value.to_string());
                }
            }
        }

        // Extract shellHook
        if let Some(start) = content.find("shellHook") {
            let rest = &content[start..];
            if let Some(end) = rest.find("'\"") {
                let hook = &rest[..end];
                shell_hook = Some(hook.to_string());
            }
        }

        Ok(Self {
            packages,
            env_vars,
            shell_hook,
        })
    }

    /// Convert to flake.nix format
    pub fn to_flake(&self) -> String {
        let packages_str = self
            .packages
            .iter()
            .map(|p| format!("pkgs.{}", p))
            .collect::<Vec<_>>()
            .join("\n      ");

        let env_vars_str = self
            .env_vars
            .iter()
            .map(|(k, v)| format!("{} = \"{}\";", k, v))
            .collect::<Vec<_>>()
            .join("\n    ");

        format!(
            r#"{{
  description = "Allternit Environment";

  inputs = {{
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  }};

  outputs = {{ self, nixpkgs, flake-utils }}:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${{system}};
      in {{
        devShells.default = pkgs.mkShell {{
          buildInputs = [
            {packages}
          ];
          {env_vars}
        }};
      }});
}}"#,
            packages = packages_str,
            env_vars = if env_vars_str.is_empty() {
                "".to_string()
            } else {
                format!("\n    {}", env_vars_str)
            }
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nix_uri_validation() {
        assert!(is_valid_nix_uri("github:user/repo"));
        assert!(is_valid_nix_uri("path:./flake.nix"));
        assert!(is_valid_nix_uri("/absolute/path"));
        assert!(is_valid_nix_uri("./relative/path"));
        assert!(!is_valid_nix_uri("invalid"));
    }

    #[test]
    fn test_extract_package_name() {
        // Real nix store paths have 32-character hashes
        let path = "/nix/store/abcdef1234567890abcdef1234567890-rust-1.70.0/bin/rustc";
        assert_eq!(extract_package_name(path), Some("rust".to_string()));
    }

    #[test]
    fn test_nix_flake_from_uri() {
        let config = NixFlakeConfig::from_uri("github:user/repo").unwrap();
        assert_eq!(config.uri, "github:user/repo");
    }

    #[test]
    fn test_shell_nix_parsing() {
        let content = r#"
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.rustc
    pkgs.cargo
    pkgs.nodejs
  ];
  
  MY_VAR = "test_value";
  
  shellHook = '''
    echo "Welcome!"
  ''';
}
"#;

        let config = ShellNixConfig::from_str(content).unwrap();
        assert!(config.packages.contains(&"rustc".to_string()));
        assert!(config.packages.contains(&"cargo".to_string()));
        assert!(config.packages.contains(&"nodejs".to_string()));
    }
}
