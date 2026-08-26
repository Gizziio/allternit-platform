//! Inference Router execution adapter.
//!
//! Runs a user prompt through a local CLI provider (`codex` or `claude-code`)
//! and returns the completed response. This is intentionally a local-dev feature
//! that shells out to the user's own authenticated CLIs.

use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::Command;
use tracing::{info, warn};

const EXEC_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutedTurnUsage {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cached_input_tokens: i64,
    pub reasoning_tokens: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoutedTurnResult {
    pub provider: String,
    pub output: String,
    pub exit_code: Option<i32>,
    pub error: Option<String>,
    pub usage: Option<RoutedTurnUsage>,
}

/// Execute a single routed turn against the requested local CLI provider.
pub async fn execute_routed_turn(provider: &str, prompt: &str, system_prompt: Option<&str>, cwd: Option<PathBuf>) -> RoutedTurnResult {
    let resolved_cwd = cwd.unwrap_or_else(|| {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    });

    match provider {
        "codex" => execute_codex(prompt, resolved_cwd).await,
        "claude-code" => execute_claude_code(prompt, resolved_cwd).await,
        "kimi" => execute_kimi(prompt, system_prompt, resolved_cwd).await,
        other => RoutedTurnResult {
            provider: provider.to_string(),
            output: String::new(),
            exit_code: None,
            error: Some(format!("Provider '{other}' does not support local CLI execution")),
            usage: None,
        },
    }
}

async fn execute_codex(prompt: &str, cwd: PathBuf) -> RoutedTurnResult {
    let output = match run_with_timeout(
        "codex",
        &["exec", "--json", "--skip-git-repo-check", "--enable", "hooks", prompt],
        &cwd,
    )
    .await
    {
        Ok(out) => out,
        Err(e) => {
            return RoutedTurnResult {
                provider: "codex".to_string(),
                output: String::new(),
                exit_code: None,
                error: Some(e),
                usage: None,
            };
        }
    };

    let mut answer = String::new();
    let mut usage: Option<RoutedTurnUsage> = None;
    for line in output.lines() {
        if let Ok(event) = serde_json::from_str::<serde_json::Value>(line) {
            match event.get("type").and_then(|v| v.as_str()) {
                Some("item.completed") => {
                    if let Some(item) = event.get("item") {
                        if item.get("type").and_then(|v| v.as_str()) == Some("agent_message") {
                            if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                answer.push_str(text);
                            }
                        }
                    }
                }
                Some("turn.completed") => {
                    if let Some(u) = event.get("usage") {
                        usage = Some(RoutedTurnUsage {
                            input_tokens: u.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                            output_tokens: u.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                            cached_input_tokens: u
                                .get("cached_input_tokens")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0),
                            reasoning_tokens: u
                                .get("reasoning_output_tokens")
                                .or_else(|| u.get("reasoning_tokens"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0),
                        });
                    }
                }
                _ => {}
            }
        }
    }

    if answer.is_empty() {
        // Fallback: return the raw output so the caller can see what happened.
        answer = output;
    }

    RoutedTurnResult {
        provider: "codex".to_string(),
        output: answer,
        exit_code: Some(0),
        error: None,
        usage,
    }
}

async fn execute_claude_code(prompt: &str, cwd: PathBuf) -> RoutedTurnResult {
    // The official Anthropic CLI binary is `claude`; some installs expose `claude-code`.
    let binary = if path_exists("claude-code").await {
        "claude-code"
    } else {
        "claude"
    };

    let output = match run_with_timeout(
        binary,
        &[
            "-p",
            "--allow-dangerously-skip-permissions",
            "--output-format",
            "json",
            prompt,
        ],
        &cwd,
    )
    .await
    {
        Ok(out) => out,
        Err(e) => {
            // Claude prints a JSON object to stdout even on failure; try to surface
            // the human-readable `result` field instead of a raw blob.
            let json_part = e.find('{').map(|i| &e[i..]).unwrap_or(&e);
            let error = if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_part) {
                value
                    .get("result")
                    .and_then(|v| v.as_str())
                    .map(|msg| format!("{binary} error: {msg}"))
                    .unwrap_or(e)
            } else {
                e
            };
            return RoutedTurnResult {
                provider: "claude-code".to_string(),
                output: String::new(),
                exit_code: Some(1),
                error: Some(error),
                usage: None,
            };
        }
    };

    let usage = serde_json::from_str::<serde_json::Value>(&output)
        .ok()
        .and_then(|value| value.get("usage").cloned())
        .and_then(|u| {
            Some(RoutedTurnUsage {
                input_tokens: u.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                output_tokens: u.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0),
                cached_input_tokens: u
                    .get("cache_read_input_tokens")
                    .or_else(|| u.get("cache_read_tokens"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
                reasoning_tokens: u
                    .get("output_tokens_details")
                    .and_then(|d| d.get("thinking_tokens"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0),
            })
        });

    RoutedTurnResult {
        provider: "claude-code".to_string(),
        output,
        exit_code: Some(0),
        error: None,
        usage,
    }
}

async fn execute_kimi(prompt: &str, system_prompt: Option<&str>, cwd: PathBuf) -> RoutedTurnResult {
    let full_prompt = match system_prompt {
        Some(sp) if !sp.trim().is_empty() => format!("{}\n\n{}", sp.trim(), prompt.trim()),
        _ => prompt.trim().to_string(),
    };
    let output = match run_with_timeout(
        "kimi",
        &["-p", &full_prompt, "--output-format", "stream-json"],
        &cwd,
    )
    .await
    {
        Ok(out) => out,
        Err(e) => {
            return RoutedTurnResult {
                provider: "kimi".to_string(),
                output: String::new(),
                exit_code: None,
                error: Some(e),
                usage: None,
            };
        }
    };

    // Kimi's stream-json prints one JSON object per line. Collect assistant
    // content and ignore meta/version/resume-hint lines.
    let mut answer = String::new();
    for line in output.lines() {
        if let Ok(event) = serde_json::from_str::<serde_json::Value>(line) {
            if event.get("role").and_then(|v| v.as_str()) == Some("assistant") {
                if let Some(text) = event.get("content").and_then(|v| v.as_str()) {
                    answer.push_str(text);
                }
            }
        }
    }

    if answer.is_empty() {
        // Fallback to raw output so the caller can diagnose what happened.
        answer = output;
    }

    RoutedTurnResult {
        provider: "kimi".to_string(),
        output: answer.trim().to_string(),
        exit_code: Some(0),
        error: None,
        usage: None,
    }
}

async fn run_with_timeout(program: &str, args: &[&str], cwd: &std::path::Path) -> Result<String, String> {
    info!(program, args = ?args, cwd = %cwd.display(), "Running routed CLI turn");

    let output = tokio::time::timeout(
        EXEC_TIMEOUT,
        Command::new(program)
            .args(args)
            .current_dir(cwd)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| format!("{program} timed out after {secs}s", secs = EXEC_TIMEOUT.as_secs()))?
    .map_err(|e| format!("failed to spawn {program}: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        let mut msg = format!("{program} exited with {status}", status = output.status);
        if !stderr.is_empty() {
            msg.push_str(": ");
            msg.push_str(&stderr);
        } else if !stdout.is_empty() {
            msg.push_str(": ");
            msg.push_str(&stdout);
        }
        warn!(%msg, "Routed CLI turn failed");
        return Err(msg);
    }

    if stdout.is_empty() && !stderr.is_empty() {
        Ok(stderr)
    } else {
        Ok(stdout)
    }
}

async fn path_exists(name: &str) -> bool {
    Command::new("command")
        .args(["-v", name])
        .output()
        .await
        .map(|out| out.status.success())
        .unwrap_or(false)
}
