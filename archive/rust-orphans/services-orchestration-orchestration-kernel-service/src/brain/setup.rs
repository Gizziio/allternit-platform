use crate::brain::BrainProvider;
use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupStatus {
    pub binaries: Vec<BinaryStatus>,
    pub env_vars: Vec<EnvVarStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVarStatus {
    pub name: String,
    pub set: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupPlan {
    pub brain_id: String,
    pub steps: Vec<SetupStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupStep {
    pub description: String,
    pub command: Option<String>,
    pub docs_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub success: bool,
    pub message: String,
    pub events: Vec<crate::brain::types::BrainEvent>,
}

pub async fn verify_brain_setup<S>(
    State(state): State<S>,
    axum::extract::Path(brain_id): axum::extract::Path<String>,
) -> Result<Json<VerificationResult>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    // Find profile
    let profile = state
        .model_router()
        .list_profiles()
        .await
        .into_iter()
        .find(|p| p.config.id == brain_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    // Create a temporary session for verification
    let mut runtime = state
        .brain_manager()
        .create_session(profile.config, None, Some(brain_id.clone()), None, None, Some("api".to_string()))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let runtime_lock = state
        .brain_manager()
        .get_runtime(&runtime.id)
        .await
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut rx = {
        let r = runtime_lock.read().await;
        r.subscribe()
    };

    // Send a test prompt
    {
        let mut r = runtime_lock.write().await;
        r.send_input("Hello, respond with exactly 'VERIFIED'")
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Collect events for 5 seconds or until ChatMessageCompleted
    let mut events = Vec::new();
    let mut success = false;
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(10));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Ok(event) => {
                        events.push(event.clone());
                        if let crate::brain::types::BrainEvent::ChatMessageCompleted { text, event_id: _ } = event {
                            if text.contains("VERIFIED") || !text.is_empty() {
                                success = true;
                            }
                            break;
                        }
                        if let crate::brain::types::BrainEvent::Error { .. } = event {
                            break;
                        }
                    },
                    Err(_) => break,
                }
            },
            _ = &mut timeout => break,
        }
    }

    // Cleanup
    let _ = state.brain_manager().terminate_session(&runtime.id).await;

    Ok(Json(VerificationResult {
        success,
        message: if success {
            "Verification successful".to_string()
        } else {
            "Verification failed or timed out".to_string()
        },
        events,
    }))
}

pub async fn get_setup_status<S>(State(_state): State<S>) -> Json<SetupStatus>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let binaries = vec!["claude", "codex", "gemini", "kimi", "ollama", "node", "npm", "python3"];
    let mut binary_statuses = Vec::new();

    for bin in binaries {
        let installed = std::process::Command::new("which")
            .arg(bin)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        let version = if installed {
            std::process::Command::new(bin)
                .arg("--version")
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        };

        binary_statuses.push(BinaryStatus {
            name: bin.to_string(),
            installed,
            version,
        });
    }

    // CLI brains handle auth internally via their own auth commands
    // Only check for Claude API key as it may be needed for non-CLI usage
    let env_vars = vec!["ANTHROPIC_API_KEY"];
    let mut env_statuses = Vec::new();

    for var in env_vars {
        env_statuses.push(EnvVarStatus {
            name: var.to_string(),
            set: std::env::var(var).is_ok(),
        });
    }

    Json(SetupStatus {
        binaries: binary_statuses,
        env_vars: env_statuses,
    })
}

pub async fn get_setup_plan<S>(
    State(_state): State<S>,
    axum::extract::Path(brain_id): axum::extract::Path<String>,
) -> Result<Json<SetupPlan>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let steps = match brain_id.as_str() {
        "claude-code" => vec![
            SetupStep {
                description: "Install Claude Code via npm".to_string(),
                command: Some("npm install -g @anthropic-ai/claude-code".to_string()),
                docs_url: Some("https://docs.anthropic.com/claude/docs/claude-code".to_string()),
            },
            SetupStep {
                description: "Set ANTHROPIC_API_KEY environment variable".to_string(),
                command: None,
                docs_url: None,
            },
        ],
        "codex" => vec![
            SetupStep {
                description: "Install OpenAI Codex via npm".to_string(),
                command: Some("npm install -g @openai/codex".to_string()),
                docs_url: Some("https://github.com/openai/codex".to_string()),
            },
            SetupStep {
                description: "Run `codex auth` to authenticate".to_string(),
                command: Some("codex auth".to_string()),
                docs_url: None,
            },
        ],
        "gemini-cli" => vec![
            SetupStep {
                description: "Install Google Gemini CLI via npm".to_string(),
                command: Some("npm install -g @google/gemini-cli".to_string()),
                docs_url: Some("https://github.com/google-gemini/gemini-cli".to_string()),
            },
            SetupStep {
                description: "Run `gemini auth` to authenticate".to_string(),
                command: Some("gemini auth".to_string()),
                docs_url: None,
            },
        ],
        "kimi-cli" => vec![
            SetupStep {
                description: "Install Moonshot Kimi CLI via npm".to_string(),
                command: Some("npm install -g @moonshot-ai/kimi-cli".to_string()),
                docs_url: Some("https://github.com/moonshot-ai/kimi-cli".to_string()),
            },
            SetupStep {
                description: "Run `kimi auth` to authenticate".to_string(),
                command: Some("kimi auth".to_string()),
                docs_url: None,
            },
        ],
        _ => return Err(StatusCode::NOT_FOUND),
    };

    Ok(Json(SetupPlan { brain_id, steps }))
}
