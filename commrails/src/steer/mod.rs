//! Steering checkpoint / consult / commit-gate support for Rails.
//!
//! This is the Rust-side replacement for the `.steering/bin/steer-stop.sh` and
//! `steer-pre-commit-gate.sh` shell hooks.  It keeps the same semantics:
//! - `checkpoint` hashes `.steering/checkpoint.md` and emits a ledger event when
//!   it changes.
//! - `consult` builds a prompt context and invokes an external steering agent.
//! - `commit-gate` runs a consult specialized for a pending git commit/push.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::process::Stdio;

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::process::Command;

use crate::core::ids::create_event_id;
use crate::core::types::{Actor, ActorType, AllternitEvent};
use crate::ledger::Ledger;
use std::sync::Arc;

/// Hash a checkpoint file.  Uses a fast stable hash; the value is advisory.
pub fn hash_checkpoint(contents: &str) -> String {
    let mut hasher = DefaultHasher::new();
    contents.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Result of a checkpoint call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointResult {
    pub changed: bool,
    pub hash: String,
    pub event_id: Option<String>,
}

/// Steering coordinator.
pub struct Steer {
    ledger: Arc<Ledger>,
    actor: Actor,
}

impl Steer {
    pub fn new(ledger: Arc<Ledger>) -> Self {
        Self {
            ledger,
            actor: Actor {
                r#type: ActorType::Gate,
                id: "steer".to_string(),
            },
        }
    }

    /// Read `.steering/checkpoint.md` under `cwd`, hash it, and emit a
    /// `SteeringCheckpoint` ledger event when the hash differs from the last
    /// recorded hash (stored in `.steering/state/checkpoint.hash`).
    pub async fn checkpoint(&self, cwd: impl AsRef<Path>) -> Result<CheckpointResult> {
        let cwd = cwd.as_ref();
        let checkpoint_file = cwd.join(".steering").join("checkpoint.md");
        let state_dir = cwd.join(".steering").join("state");
        let hash_file = state_dir.join("checkpoint.hash");

        if !checkpoint_file.exists() {
            anyhow::bail!("checkpoint file not found: {}", checkpoint_file.display());
        }

        fs::create_dir_all(&state_dir)
            .with_context(|| format!("creating state dir {}", state_dir.display()))?;

        let contents = fs::read_to_string(&checkpoint_file)
            .with_context(|| format!("reading {}", checkpoint_file.display()))?;
        let hash = hash_checkpoint(&contents);

        let last_hash = fs::read_to_string(&hash_file).unwrap_or_default().trim().to_string();
        let changed = last_hash.is_empty() || last_hash != hash;

        let event_id = if changed {
            let event = AllternitEvent {
                event_id: create_event_id(),
                ts: Utc::now().to_rfc3339(),
                actor: self.actor.clone(),
                scope: None,
                r#type: "SteeringCheckpoint".to_string(),
                payload: json!({
                    "cwd": cwd.canonicalize().unwrap_or_else(|_| cwd.to_path_buf()).display().to_string(),
                    "hash": hash,
                    "previous_hash": last_hash,
                    "size_bytes": contents.len(),
                }),
                provenance: None,
            };
            let id = self.ledger.append(event).await?;
            fs::write(&hash_file, &hash)
                .with_context(|| format!("writing {}", hash_file.display()))?;
            Some(id)
        } else {
            None
        };

        Ok(CheckpointResult {
            changed,
            hash,
            event_id,
        })
    }

    /// Build the steering consult prompt context from:
    /// - `.steering/prompt.md`
    /// - `.steering/spec.md` (source of truth)
    /// - `.steering/checkpoint.md`
    /// - git status / diff evidence
    /// - optional `.steering/test-command` output
    pub fn build_context(&self, cwd: impl AsRef<Path>) -> Result<String> {
        let cwd = cwd.as_ref();
        let steering_dir = cwd.join(".steering");
        let prompt_path = steering_dir.join("prompt.md");
        let spec_path = steering_dir.join("spec.md");
        let checkpoint_path = steering_dir.join("checkpoint.md");
        let test_command = steering_dir.join("test-command");

        let mut context = String::new();

        if prompt_path.exists() {
            context.push_str(&fs::read_to_string(&prompt_path)?);
        }

        if spec_path.exists() {
            context.push_str("\n\n=== SPEC FILE (.steering/spec.md) ===\n");
            let spec = fs::read_to_string(&spec_path)?;
            context.push_str(&truncate(&spec, 12_000));
        }

        if checkpoint_path.exists() {
            context.push_str("\n\n=== CHECKPOINT FILE (.steering/checkpoint.md) ===\n");
            let checkpoint = fs::read_to_string(&checkpoint_path)?;
            context.push_str(&truncate(&checkpoint, 12_000));
        }

        context.push_str("\n\n=== EVIDENCE: git status --short ===\n");
        if let Ok(output) = std::process::Command::new("git")
            .args(["-C", &cwd.to_string_lossy(), "status", "--short"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines().take(50) {
                context.push_str(line);
                context.push('\n');
            }
        }

        context.push_str("\n=== EVIDENCE: git diff --stat HEAD ===\n");
        if let Ok(output) = std::process::Command::new("git")
            .args(["-C", &cwd.to_string_lossy(), "diff", "--stat", "HEAD"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            context.push_str(&truncate(&text, 2_000));
        }

        context.push_str("\n\n=== EVIDENCE: git diff HEAD (first 16KB) ===\n");
        if let Ok(output) = std::process::Command::new("git")
            .args(["-C", &cwd.to_string_lossy(), "diff", "HEAD"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            context.push_str(&truncate(&text, 16_384));
        }

        if test_command.exists() {
            context.push_str("\n\n=== EVIDENCE: test output (`.steering/test-command`, tail) ===\n");
            if let Ok(output) = std::process::Command::new("bash")
                .arg(&test_command)
                .current_dir(cwd)
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                context.push_str(&truncate(&text, 4_096));
                context.push_str(&format!("\ntest-command exit: {}\n", output.status.code().unwrap_or(-1)));
            }
        }

        Ok(context)
    }

    /// Invoke the configured steering consult command with the provided context.
    /// Returns the raw answer text (first line can be checked for APPROVE/STEER).
    pub async fn consult(&self, cwd: impl AsRef<Path>, context: &str) -> Result<String> {
        let cwd = cwd.as_ref();

        if let Ok(cmd) = std::env::var("STEER_CONSULT_CMD") {
            return run_shell_command(&cmd, cwd, context).await;
        }

        if command_exists("ao-consult") {
            return run_shell_command("ao-consult", cwd, context).await;
        }

        // Fallback: kimi -p <prompt>
        if command_exists("kimi") {
            let child = Command::new("kimi")
                .arg("-p")
                .arg(context)
                .current_dir(cwd)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .context("spawning kimi consult")?;
            let output = child.wait_with_output().await.context("waiting for kimi")?;
            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }

        anyhow::bail!("no steering consult backend found (set STEER_CONSULT_CMD, or install ao-consult/kimi)")
    }

    /// Run a commit-gate consult.  Returns the first-line verdict and full body.
    pub async fn commit_gate(&self, cwd: impl AsRef<Path>) -> Result<ConsultResult> {
        let cwd = cwd.as_ref();
        let mut context = self.build_context(cwd)?;
        context.push_str("\n\nThis is a COMMIT GATE consult. Approve only if the diff is safe, scoped, and matches the spec. Reply with APPROVE or STEER followed by reasoning and any required fixes.");
        let answer = self.consult(cwd, &context).await?;
        Ok(parse_verdict(&answer))
    }
}

/// Result of a consult / commit-gate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsultResult {
    pub verdict: String,
    pub body: String,
}

fn truncate(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        s.to_string()
    } else {
        let mut end = max_bytes;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}\n[truncated]", &s[..end])
    }
}

fn command_exists(name: &str) -> bool {
    std::process::Command::new("which")
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

async fn run_shell_command(cmd: &str, cwd: &Path, stdin: &str) -> Result<String> {
    let mut child = Command::new("bash")
        .arg("-c")
        .arg(cmd)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("spawning consult command: {}", cmd))?;

    if let Some(mut child_stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        child_stdin.write_all(stdin.as_bytes()).await?;
    }

    let output = child.wait_with_output().await?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_verdict(answer: &str) -> ConsultResult {
    let lines: Vec<&str> = answer.lines().collect();
    let first = lines
        .first()
        .map(|s| s.trim().trim_start_matches("• ").to_uppercase())
        .unwrap_or_default();
    let verdict = if first.starts_with("APPROVE") {
        "APPROVE".to_string()
    } else {
        "STEER".to_string()
    };
    ConsultResult {
        verdict,
        body: answer.trim().to_string(),
    }
}
