//! Mesh VPN integration for agent desktops.
//!
//! Supports Tailscale's hosted coordination server and a self-hosted Headscale
//! control plane. The abstraction lets the rest of the platform stay agnostic
//! to the provider; only the cloud-init / guest bootstrap script changes.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Provider-specific mesh configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "provider", rename_all = "snake_case")]
pub enum MeshConfig {
    Tailscale {
        /// Reusable Tailscale auth key generated in the Tailscale admin console.
        auth_key: String,
        /// Optional ACL tags to assign to the node, e.g. ["tag:desktop"].
        #[serde(default)]
        tags: Vec<String>,
    },
    Headscale {
        /// Base URL of the Headscale control plane, e.g. http://10.1.169.1:8081.
        server_url: String,
        /// Reusable pre-auth key generated with `headscale preauthkeys create`.
        auth_key: String,
        /// Optional ACL tags to assign to the node.
        #[serde(default)]
        tags: Vec<String>,
    },
}

impl MeshConfig {
    /// Provider short name used for telemetry and labels.
    pub fn provider_name(&self) -> &'static str {
        match self {
            MeshConfig::Tailscale { .. } => "tailscale",
            MeshConfig::Headscale { .. } => "headscale",
        }
    }

    /// Environment variables that should be injected into the guest so that
    /// late-stage boot scripts can join the mesh without recompiling cloud-init.
    pub fn guest_env(&self) -> HashMap<String, String> {
        let mut env = HashMap::new();
        match self {
            MeshConfig::Tailscale { auth_key, tags } => {
                env.insert("ALLTERNIT_MESH_PROVIDER".to_string(), "tailscale".to_string());
                env.insert(
                    "ALLTERNIT_MESH_AUTH_KEY".to_string(),
                    auth_key.trim().to_string(),
                );
                if !tags.is_empty() {
                    env.insert(
                        "ALLTERNIT_MESH_TAGS".to_string(),
                        tags.join(","),
                    );
                }
            }
            MeshConfig::Headscale {
                server_url,
                auth_key,
                tags,
            } => {
                env.insert("ALLTERNIT_MESH_PROVIDER".to_string(), "headscale".to_string());
                env.insert(
                    "ALLTERNIT_MESH_SERVER_URL".to_string(),
                    server_url.trim().to_string(),
                );
                env.insert(
                    "ALLTERNIT_MESH_AUTH_KEY".to_string(),
                    auth_key.trim().to_string(),
                );
                if !tags.is_empty() {
                    env.insert(
                        "ALLTERNIT_MESH_TAGS".to_string(),
                        tags.join(","),
                    );
                }
            }
        }
        env
    }

    /// Render a shell script that installs the official Tailscale client and
    /// joins the configured mesh. This is injected as a cloud-init `runcmd` or
    /// executed ad-hoc via the desktop shell endpoint.
    pub fn guest_join_script(&self) -> String {
        let install = r#"#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/ubuntu noble main" > /etc/apt/sources.list.d/tailscale.list
  apt-get update -y
  apt-get install -y tailscale
fi
"#;
        match self {
            MeshConfig::Tailscale { auth_key, tags } => {
                let tags_flag = if tags.is_empty() {
                    String::new()
                } else {
                    format!(" --advertise-tags {}", shell_escape(&tags.join(",")))
                };
                format!(
                    r#"{}{}tailscale up --reset --auth-key {} --accept-routes{} 2>&1"#,
                    install,
                    tailscale_down_guard(),
                    shell_escape(auth_key),
                    tags_flag
                )
            }
            MeshConfig::Headscale {
                server_url,
                auth_key,
                tags,
            } => {
                let tags_flag = if tags.is_empty() {
                    String::new()
                } else {
                    format!(" --advertise-tags {}", shell_escape(&tags.join(",")))
                };
                format!(
                    r#"{}{}tailscale up --reset --login-server {} --auth-key {} --accept-routes{} 2>&1"#,
                    install,
                    tailscale_down_guard(),
                    shell_escape(server_url),
                    shell_escape(auth_key),
                    tags_flag
                )
            }
        }
    }

    /// Command that returns JSON-ish status from the guest tailscale daemon.
    pub fn status_command(&self) -> Vec<String> {
        vec![
            "tailscale".to_string(),
            "status".to_string(),
            "--json".to_string(),
        ]
    }

    /// Command that instructs the guest to leave the mesh.
    pub fn leave_command(&self) -> Vec<String> {
        vec!["tailscale".to_string(), "down".to_string()]
    }
}

fn tailscale_down_guard() -> &'static str {
    // If tailscaled is already running for another control plane, bring it down
    // first so the new `--login-server` / `--auth-key` pair is respected.
    r#"if systemctl is-active tailscaled >/dev/null 2>&1; then
  tailscale down 2>/dev/null || true
fi
"#
}

/// Escape a string for safe inclusion in a generated shell script.
fn shell_escape(s: &str) -> String {
    // Single-quote wrapping handles everything except single quotes themselves.
    format!("'{}'", s.replace('"', "'\"'\"'"))
}

/// Parse the Tailscale IP from `tailscale status --json` output.
pub fn parse_tailscale_ip(status_json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(status_json).ok()?;
    value
        .get("TailscaleIPs")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headscale_env_includes_all_keys() {
        let cfg = MeshConfig::Headscale {
            server_url: "http://10.1.169.1:8081".to_string(),
            auth_key: "hskey-auth-xyz".to_string(),
            tags: vec!["tag:desktop".to_string()],
        };
        let env = cfg.guest_env();
        assert_eq!(env.get("ALLTERNIT_MESH_PROVIDER").unwrap(), "headscale");
        assert_eq!(
            env.get("ALLTERNIT_MESH_SERVER_URL").unwrap(),
            "http://10.1.169.1:8081"
        );
        assert_eq!(env.get("ALLTERNIT_MESH_AUTH_KEY").unwrap(), "hskey-auth-xyz");
        assert_eq!(env.get("ALLTERNIT_MESH_TAGS").unwrap(), "tag:desktop");
    }

    #[test]
    fn tailscale_script_uses_hosted_auth_key() {
        let cfg = MeshConfig::Tailscale {
            auth_key: "tskey-auth-abc".to_string(),
            tags: vec![],
        };
        let script = cfg.guest_join_script();
        assert!(script.contains("tailscale up"));
        assert!(script.contains("--reset"));
        assert!(script.contains("--auth-key 'tskey-auth-abc'"));
        assert!(!script.contains("--login-server"));
    }

    #[test]
    fn headscale_script_uses_login_server() {
        let cfg = MeshConfig::Headscale {
            server_url: "http://10.0.0.1:8081".to_string(),
            auth_key: "hskey-auth-xyz".to_string(),
            tags: vec!["tag:desktop".to_string()],
        };
        let script = cfg.guest_join_script();
        assert!(script.contains("tailscale up"));
        assert!(script.contains("--reset"));
        assert!(script.contains("--login-server 'http://10.0.0.1:8081'"));
        assert!(script.contains("--auth-key 'hskey-auth-xyz'"));
        assert!(script.contains("--advertise-tags 'tag:desktop'"));
    }

    #[test]
    fn parse_tailscale_ip_extracts_first_ip() {
        let json = r#"{"TailscaleIPs":["100.64.0.1","fd7a:115c:a1e0::1"],"Self":{"ID":"node"}}"#;
        assert_eq!(parse_tailscale_ip(json).unwrap(), "100.64.0.1");
    }

    #[test]
    fn parse_tailscale_ip_returns_none_for_invalid_json() {
        assert!(parse_tailscale_ip("not json").is_none());
    }
}
