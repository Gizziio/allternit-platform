//! CLI provider detector for the inference router settings panel.
//!
//! Probes the local machine for installed/authenticated CLI brains and returns
//! a status list the frontend can render in the "Route via" dock.

use serde::Serialize;
use std::path::PathBuf;
use tokio::process::Command;

/// Status of one CLI provider, matching the frontend's `CliProviderStatus` schema.
#[derive(Debug, Clone, Serialize)]
pub struct CliProviderStatus {
    pub provider: String,
    pub installed: bool,
    pub authenticated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Detect every provider the inference router can route to.
pub async fn detect_all() -> Vec<CliProviderStatus> {
    let mut results = Vec::new();
    for provider in ["codex", "claude-code", "cursor", "openrouter", "kimi"] {
        results.push(detect_provider(provider).await);
    }
    results
}

async fn detect_provider(provider: &str) -> CliProviderStatus {
    let binary = match provider {
        "claude-code" => "claude",
        _ => provider,
    };

    // Only the local CLI providers can actually be probed; API-only providers
    // are reported as not installed so the UI doesn't offer a broken route.
    let is_cli = matches!(provider, "codex" | "claude-code" | "kimi");
    if !is_cli {
        return CliProviderStatus {
            provider: provider.to_string(),
            installed: false,
            authenticated: false,
            version: None,
            path: None,
            error: Some("API provider — configure via Settings > Brains".to_string()),
        };
    }

    let path = which(binary).await;
    let installed = path.is_some();

    let version = if installed {
        match run_version(binary).await {
            Ok(v) => Some(v),
            Err(e) => {
                return CliProviderStatus {
                    provider: provider.to_string(),
                    installed: true,
                    authenticated: false,
                    version: None,
                    path,
                    error: Some(e),
                };
            }
        }
    } else {
        None
    };

    let authenticated = if installed {
        is_authenticated(provider, binary).await
    } else {
        false
    };

    CliProviderStatus {
        provider: provider.to_string(),
        installed,
        authenticated,
        version,
        path,
        error: None,
    }
}

async fn which(binary: &str) -> Option<String> {
    let output = Command::new("command")
        .args(["-v", binary])
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

async fn run_version(binary: &str) -> Result<String, String> {
    let output = Command::new(binary)
        .args(["--version"])
        .output()
        .await
        .map_err(|e| format!("failed to run {binary} --version: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

async fn is_authenticated(provider: &str, binary: &str) -> bool {
    match provider {
        "claude-code" => {
            // Claude's official CLI exposes `claude auth status`.
            Command::new(binary)
                .args(["auth", "status"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .await
                .map(|s| s.success())
                .unwrap_or(false)
        }
        "codex" => home_file(&[".codex", "auth.json"]).exists(),
        "kimi" => {
            home_file(&[".kimi-code", "auth.json"]).exists()
                || home_file(&[".kimi-code", "config.json"]).exists()
        }
        _ => false,
    }
}

fn home_file(segments: &[&str]) -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(segments.iter().collect::<PathBuf>())
}
