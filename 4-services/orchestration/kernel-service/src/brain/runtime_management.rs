use crate::brain::runtime_registry::{CliRuntimeDefinition, RuntimeRegistry, RuntimeType};
use crate::brain::types::BrainEvent;
use crate::brain::BrainProvider;
use crate::terminal_manager::TerminalManager;
use anyhow::{anyhow, Result};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use futures::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Deserialize)]
pub struct InstallRequest {
    pub preset_id: String,
}

#[derive(Debug, Serialize)]
pub struct InstallResponse {
    pub session_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthRequest {
    pub preset_id: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub session_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub preset_id: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub installed: bool,
    pub version: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct RuntimeInfo {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub r#type: String,
    pub logo_asset: String,
    pub description: String,
    pub installed: bool,
    pub last_verified: Option<i64>,
    pub auth_complete: bool,
    pub detected_version: Option<String>,
    pub running_sessions: u32,
    pub auth_required: bool,
    pub auth_instructions: Option<String>,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RuntimesListResponse {
    pub groups: Vec<RuntimeGroup>,
}

#[derive(Debug, Serialize)]
pub struct RuntimeGroup {
    pub title: String,
    pub runtimes: Vec<RuntimeInfo>,
}

pub async fn list_runtimes<S>(
    State(state): State<S>,
) -> Result<Json<RuntimesListResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let runtime_registry = state.runtime_registry();
    let registry_response = RuntimeRegistry::list_all_definitions();

    let groups = registry_response
        .groups
        .into_iter()
        .map(|group| RuntimeGroup {
            title: group.title,
            runtimes: group
                .runtimes
                .into_iter()
                .map(|def| {
                    let state = runtime_registry.get_runtime_state(&def.id);

                    RuntimeInfo {
                        id: def.id.clone(),
                        name: def.name.clone(),
                        vendor: def.vendor.clone(),
                        r#type: match def.runtime_type {
                            RuntimeType::Api => "api".to_string(),
                            RuntimeType::Cli => "cli".to_string(),
                            RuntimeType::Local => "local".to_string(),
                        },
                        logo_asset: def.logo_asset.clone(),
                        description: format!("{} - {}", def.name, def.capabilities.join(", ")),
                        installed: state.as_ref().map(|s| s.installed).unwrap_or(false),
                        last_verified: state.as_ref().and_then(|s| {
                            if s.last_verified > 0 {
                                Some(s.last_verified)
                            } else {
                                None
                            }
                        }),
                        auth_complete: state.as_ref().map(|s| s.auth_complete).unwrap_or(false),
                        detected_version: state.as_ref().and_then(|s| s.detected_version.clone()),
                        running_sessions: 0,
                        auth_required: def.auth_required,
                        auth_instructions: def.auth_instructions.clone(),
                        capabilities: def.capabilities.clone(),
                    }
                })
                .collect(),
        })
        .collect();

    Ok(Json(RuntimesListResponse { groups }))
}

pub async fn get_runtime<S>(
    State(state): State<S>,
    Path(id): Path<String>,
) -> Result<Json<RuntimeInfo>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let runtime_registry = state.runtime_registry();

    let definition =
        RuntimeRegistry::get_runtime_definition(&id).ok_or_else(|| StatusCode::NOT_FOUND)?;

    let state = runtime_registry.get_runtime_state(&id);

    Ok(Json(RuntimeInfo {
        id: definition.id.clone(),
        name: definition.name.clone(),
        vendor: definition.vendor.clone(),
        r#type: match definition.runtime_type {
            RuntimeType::Api => "api".to_string(),
            RuntimeType::Cli => "cli".to_string(),
            RuntimeType::Local => "local".to_string(),
        },
        logo_asset: definition.logo_asset.clone(),
        description: format!(
            "{} - {}",
            definition.name,
            definition.capabilities.join(", ")
        ),
        installed: state.as_ref().map(|s| s.installed).unwrap_or(false),
        last_verified: state.as_ref().map(|s| s.last_verified),
        auth_complete: state.as_ref().map(|s| s.auth_complete).unwrap_or(false),
        detected_version: state.as_ref().and_then(|s| s.detected_version.clone()),
        running_sessions: 0,
        auth_required: definition.auth_required,
        auth_instructions: definition.auth_instructions.clone(),
        capabilities: definition.capabilities.clone(),
    }))
}

pub async fn install_runtime<S>(
    State(state): State<S>,
    Json(req): Json<InstallRequest>,
) -> Result<Json<InstallResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let terminal_manager = state.terminal_manager();
    let runtime_registry = state.runtime_registry();

    let def = RuntimeRegistry::get_runtime_definition(&req.preset_id)
        .ok_or_else(|| anyhow!("Runtime '{}' not found", req.preset_id))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let install_cmd = match std::env::consts::OS {
        "macos" => def
            .install_platform
            .as_ref()
            .and_then(|p| p.darwin.as_ref())
            .or(def.install_cmd.as_ref())
            .ok_or(StatusCode::BAD_REQUEST)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        "linux" => def
            .install_platform
            .as_ref()
            .and_then(|p| p.linux.as_ref())
            .or(def.install_cmd.as_ref())
            .ok_or(StatusCode::BAD_REQUEST)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        "windows" => def
            .install_platform
            .as_ref()
            .and_then(|p| p.windows.as_ref())
            .or(def.install_cmd.as_ref())
            .ok_or(StatusCode::BAD_REQUEST)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    tracing::info!("Installing runtime {}: {}", req.preset_id, install_cmd);

    let session_id = terminal_manager
        .create_custom_session(&install_cmd, &[], None, None)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create install session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(InstallResponse {
        session_id,
        status: "installing".to_string(),
        message: format!("Installing {} via: {}", def.name, install_cmd),
    }))
}

pub async fn auth_runtime<S>(
    State(state): State<S>,
    Json(req): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let terminal_manager = state.terminal_manager();
    let runtime_registry = state.runtime_registry();

    let def = RuntimeRegistry::get_runtime_definition(&req.preset_id)
        .ok_or_else(|| anyhow!("Runtime '{}' not found", req.preset_id))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if !def.auth_required {
        let session_id = uuid::Uuid::new_v4().to_string();

        runtime_registry.mark_auth_complete(&req.preset_id).await;

        return Ok(Json(AuthResponse {
            session_id,
            status: "no-auth-required".to_string(),
            message: "This runtime does not require authentication".to_string(),
        }));
    }

    let auth_cmd = def.auth_cmd.clone().unwrap_or_else(|| def.run_cmd.clone());

    let args = if let Some(ref auth_args) = def.auth_cmd {
        if auth_cmd == def.run_cmd {
            def.run_args.clone()
        } else {
            vec![]
        }
    } else {
        def.run_args.clone()
    };

    tracing::info!(
        "Authenticating runtime {}: {} {:?}",
        req.preset_id,
        auth_cmd,
        args
    );

    let session_id = terminal_manager
        .create_custom_session(&auth_cmd, &args, None, None)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create auth session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(AuthResponse {
        session_id,
        status: "authenticating".to_string(),
        message: format!("Authenticating {} with provided credentials", def.name),
    }))
}

pub async fn verify_runtime<S>(
    State(_state): State<S>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let runtime_registry = _state.runtime_registry();

    let def = RuntimeRegistry::get_runtime_definition(&req.preset_id)
        .ok_or_else(|| anyhow!("Runtime '{}' not found", req.preset_id))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let check_parts: Vec<&str> = def.check_cmd.split_whitespace().collect();
    let command = check_parts
        .first()
        .ok_or(StatusCode::BAD_REQUEST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let args: Vec<&str> = if check_parts.len() > 1 {
        check_parts[1..].to_vec()
    } else {
        vec![]
    };

    tracing::info!(
        "Verifying runtime {}: {} {:?}",
        req.preset_id,
        command,
        args
    );

    let output = std::process::Command::new(command).args(args).output();

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout).to_string();
            let stderr = String::from_utf8_lossy(&result.stderr).to_string();
            let version = if result.status.success() {
                Some(stdout.trim().to_string())
            } else {
                None
            };

            let message = if result.status.success() {
                format!(
                    "{} is installed (version: {})",
                    def.name,
                    version.as_deref().unwrap_or("unknown")
                )
            } else {
                format!("Verification failed: {}", stderr.trim())
            };

            if let Some(v) = &version {
                runtime_registry
                    .mark_installed(&req.preset_id, Some(v.clone()))
                    .await;
            }

            Ok(Json(VerifyResponse {
                installed: result.status.success(),
                version,
                message,
            }))
        }
        Err(e) => {
            tracing::error!("Failed to verify runtime: {}", e);

            Ok(Json(VerifyResponse {
                installed: false,
                version: None,
                message: format!("Failed to verify: {}", e),
            }))
        }
    }
}

#[derive(Debug, Serialize, Clone)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    data: String,
    timestamp: i64,
}

pub async fn stream_install_events<S>(
    State(state): State<S>,
    Path(session_id): Path<String>,
) -> Result<
    axum::response::Sse<impl Stream<Item = Result<axum::response::sse::Event, axum::BoxError>>>,
    StatusCode,
>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let terminal_manager = state.terminal_manager();
    let runtime_registry = state.runtime_registry();

    let (tx, _rx) = broadcast::channel::<BrainEvent>(100);

    let session = terminal_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| anyhow!("Session '{}' not found", session_id))
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let tx_clone = tx.clone();
    let master = session.master.clone();

    tokio::task::spawn_blocking(move || {
        let mut master_lock = master.lock().unwrap();
        let mut reader = master_lock.try_clone_reader().unwrap();
        let mut buf = [0u8; 1024];

        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = tx_clone.send(BrainEvent::TerminalDelta {
                        data: data.clone(),
                        stream: "stdout".to_string(),
                        event_id: None,
                    });
                }
                Err(_) => break,
            }
        }
    });

    let stream =
        tokio_stream::wrappers::BroadcastStream::new(tx.subscribe()).map(|result| match result {
            Ok(event) => {
                let json_data = serde_json::to_string(&event).unwrap_or_default();
                let stream_event = StreamEvent {
                    event_type: match event {
                        BrainEvent::TerminalDelta { .. } => "terminal_delta".to_string(),
                        _ => "unknown".to_string(),
                    },
                    data: json_data,
                    timestamp: chrono::Utc::now().timestamp(),
                };

                let event_json = serde_json::to_string(&stream_event).unwrap_or_default();
                Ok(axum::response::sse::Event::default()
                    .json_data(event_json)
                    .unwrap())
            }
            Err(_) => Ok(axum::response::sse::Event::default()),
        });

    Ok(axum::response::Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::new()))
}
