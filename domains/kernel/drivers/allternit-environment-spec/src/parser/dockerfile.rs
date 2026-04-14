//! Dockerfile Parser
//!
//! Simple Dockerfile parser for legacy support.
//! Full parsing is handled by the converter building the image.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::EnvironmentSpecError;

/// Dockerfile configuration
#[derive(Debug, Clone)]
pub struct DockerfileConfig {
    /// Path to Dockerfile
    pub path: PathBuf,

    /// Build context directory
    pub context: PathBuf,

    /// Build args
    pub build_args: HashMap<String, String>,

    /// Base image extracted from Dockerfile
    pub base_image: Option<String>,

    /// Exposed ports
    pub exposed_ports: Vec<u16>,

    /// Environment variables from Dockerfile
    pub env_vars: HashMap<String, String>,

    /// Working directory
    pub workdir: Option<String>,

    /// Default command
    pub cmd: Option<Vec<String>>,

    /// Entrypoint
    pub entrypoint: Option<Vec<String>>,
}

impl DockerfileConfig {
    /// Create from file path
    pub fn new(path: impl AsRef<std::path::Path>) -> Self {
        let path = path.as_ref().to_path_buf();
        let context = path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();

        Self {
            path,
            context,
            build_args: HashMap::new(),
            base_image: None,
            exposed_ports: vec![],
            env_vars: HashMap::new(),
            workdir: None,
            cmd: None,
            entrypoint: None,
        }
    }

    /// Parse Dockerfile from file
    pub async fn from_file(path: &PathBuf) -> Result<Self, EnvironmentSpecError> {
        let content = tokio::fs::read_to_string(path).await?;
        let mut config = Self::new(path);
        config.parse_content(&content)?;
        Ok(config)
    }

    /// Parse Dockerfile content
    fn parse_content(&mut self, content: &str) -> Result<(), EnvironmentSpecError> {
        for line in content.lines() {
            let line = line.trim();

            // Skip comments and empty lines
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Parse FROM instruction
            if line.starts_with("FROM ") {
                let parts: Vec<&str> = line[5..].split_whitespace().collect();
                if let Some(image) = parts.first() {
                    self.base_image = Some(image.to_string());
                }
            }

            // Parse ENV instruction
            if let Some(env_line) = line.strip_prefix("ENV ") {
                // Handle both: ENV KEY=value and ENV KEY value
                if let Some(pos) = env_line.find('=') {
                    let key = env_line[..pos].trim().to_string();
                    let value = env_line[pos + 1..].trim().to_string();
                    self.env_vars.insert(key, value);
                } else if let Some(pos) = env_line.find(' ') {
                    let key = env_line[..pos].trim().to_string();
                    let value = env_line[pos + 1..].trim().to_string();
                    self.env_vars.insert(key, value);
                }
            }

            // Parse EXPOSE instruction
            if let Some(ports_str) = line.strip_prefix("EXPOSE ") {
                for port_part in ports_str.split_whitespace() {
                    // Handle port/protocol format (e.g., "8080/tcp")
                    let port = port_part.split('/').next().unwrap_or(port_part);
                    if let Ok(port_num) = port.parse::<u16>() {
                        self.exposed_ports.push(port_num);
                    }
                }
            }

            // Parse WORKDIR instruction
            if line.starts_with("WORKDIR ") {
                self.workdir = Some(line[8..].trim().to_string());
            }

            // Parse CMD instruction
            if line.starts_with("CMD ") {
                self.cmd = Some(parse_command(&line[4..]));
            }

            // Parse ENTRYPOINT instruction
            if line.starts_with("ENTRYPOINT ") {
                self.entrypoint = Some(parse_command(&line[11..]));
            }
        }

        Ok(())
    }

    /// Set build context
    pub fn with_context(mut self, context: impl AsRef<std::path::Path>) -> Self {
        self.context = context.as_ref().to_path_buf();
        self
    }

    /// Add build arg
    pub fn with_build_arg(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.build_args.insert(key.into(), value.into());
        self
    }

    /// Build the Dockerfile into an OCI image
    pub async fn build(&self) -> Result<String, EnvironmentSpecError> {
        // This requires either Docker, Buildah, or Nix
        // Try in order of preference: nix, buildah, docker, podman

        // Try Nix first (most reproducible)
        if which::which("nix").is_ok() {
            return self.build_with_nix().await;
        }

        // Try Buildah (doesn't require daemon)
        if which::which("buildah").is_ok() {
            return self.build_with_buildah().await;
        }

        // Try Docker
        if which::which("docker").is_ok() {
            return self.build_with_docker().await;
        }

        // Try Podman
        if which::which("podman").is_ok() {
            return self.build_with_podman().await;
        }

        Err(EnvironmentSpecError::ConversionError(
            "No container builder found (tried: nix, buildah, docker, podman)".to_string(),
        ))
    }

    /// Build using Nix (most reproducible)
    async fn build_with_nix(&self) -> Result<String, EnvironmentSpecError> {
        // Generate a Nix expression that builds the Dockerfile
        let nix_expr = self.generate_nix_expression();

        // Write to temp file
        let temp_dir = tempfile::tempdir()?;
        let nix_path = temp_dir.path().join("default.nix");
        tokio::fs::write(&nix_path, nix_expr).await?;

        // Build with Nix
        let output = tokio::process::Command::new("nix")
            .args([
                "build",
                "--json",
                "--no-link",
                "-f",
                nix_path.to_str().unwrap(),
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "Nix build failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Parse output path
        let json: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| {
            EnvironmentSpecError::ConversionError(format!("Failed to parse Nix output: {}", e))
        })?;
        if let Some(path) = json
            .get(0)
            .and_then(|o| o.get("outputs"))
            .and_then(|o| o.get("out"))
            .and_then(|o| o.as_str())
        {
            Ok(format!("nix:{}", path))
        } else {
            Err(EnvironmentSpecError::ConversionError(
                "Failed to get Nix build output".to_string(),
            ))
        }
    }

    /// Build using Docker
    async fn build_with_docker(&self) -> Result<String, EnvironmentSpecError> {
        let image_tag = format!("a2r-built:{}", uuid::Uuid::new_v4());

        let mut cmd = tokio::process::Command::new("docker");
        cmd.arg("build")
            .arg("-t")
            .arg(&image_tag)
            .arg("-f")
            .arg(&self.path);

        // Add build args
        for (key, value) in &self.build_args {
            cmd.arg("--build-arg").arg(format!("{}={}", key, value));
        }

        cmd.arg(&self.context);

        let output = cmd.output().await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "Docker build failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(image_tag)
    }

    /// Build using Buildah
    async fn build_with_buildah(&self) -> Result<String, EnvironmentSpecError> {
        let image_tag = format!("a2r-built:{}", uuid::Uuid::new_v4());

        let output = tokio::process::Command::new("buildah")
            .args(["bud", "-t", &image_tag, "-f", self.path.to_str().unwrap()])
            .arg(&self.context)
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "Buildah build failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(image_tag)
    }

    /// Build using Podman
    async fn build_with_podman(&self) -> Result<String, EnvironmentSpecError> {
        let image_tag = format!("a2r-built:{}", uuid::Uuid::new_v4());

        let output = tokio::process::Command::new("podman")
            .args(["build", "-t", &image_tag, "-f", self.path.to_str().unwrap()])
            .arg(&self.context)
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "Podman build failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(image_tag)
    }

    /// Generate Nix expression for building Dockerfile
    fn generate_nix_expression(&self) -> String {
        let build_args = self
            .build_args
            .iter()
            .map(|(k, v)| format!("  {} = \"{}\";", k, v))
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            r#"{{ pkgs ? import <nixpkgs> {{}} }}:

pkgs.dockerTools.buildLayeredImage {{
  name = "a2r-dockerfile-build";
  tag = "latest";
  
  contents = with pkgs; [
    # Base contents
  ];
  
  # Dockerfile build would go here
  # For now, we use the base image
  fromImage = pkgs.dockerTools.pullImage {{
    imageName = "{}";
    imageDigest = "sha256:...";  # Would need to resolve
  }};
  
  config = {{
    Env = [
{}
    ];
    WorkingDir = "{}";
  }};
}}
"#,
            self.base_image.as_deref().unwrap_or("ubuntu:22.04"),
            build_args,
            self.workdir.as_deref().unwrap_or("/workspace")
        )
    }
}

/// Parse command from Dockerfile (handles JSON array and shell formats)
fn parse_command(cmd_str: &str) -> Vec<String> {
    let cmd_str = cmd_str.trim();

    // JSON array format: ["cmd", "arg1", "arg2"]
    if cmd_str.starts_with('[') && cmd_str.ends_with(']') {
        // Simple parsing - remove brackets and split by comma
        let inner = &cmd_str[1..cmd_str.len() - 1];
        inner
            .split(',')
            .map(|s| s.trim().trim_matches('"').to_string())
            .collect()
    } else {
        // Shell format: just split by whitespace
        cmd_str.split_whitespace().map(|s| s.to_string()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_dockerfile() {
        let content = r#"
FROM ubuntu:22.04
ENV NODE_ENV=production
WORKDIR /app
EXPOSE 3000 8080
CMD ["node", "server.js"]
"#;

        let mut config = DockerfileConfig::new("Dockerfile");
        config.parse_content(content).unwrap();

        assert_eq!(config.base_image, Some("ubuntu:22.04".to_string()));
        assert_eq!(
            config.env_vars.get("NODE_ENV"),
            Some(&"production".to_string())
        );
        assert_eq!(config.workdir, Some("/app".to_string()));
        assert!(config.exposed_ports.contains(&3000));
        assert!(config.exposed_ports.contains(&8080));
        assert_eq!(
            config.cmd,
            Some(vec!["node".to_string(), "server.js".to_string()])
        );
    }

    #[test]
    fn test_parse_command() {
        assert_eq!(
            parse_command("[\"node\", \"server.js\"]"),
            vec!["node", "server.js"]
        );
        assert_eq!(parse_command("node server.js"), vec!["node", "server.js"]);
    }
}
