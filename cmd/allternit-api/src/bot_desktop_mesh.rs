//! Bot desktop mesh VPN endpoints.
//!
//! Lets a provisioned Linux/Windows/macOS desktop join a Tailscale or
//! Headscale tailnet so that agents and operators can reach it by a stable
//! IP even when the underlying substrate NATs the guest.

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_routes::{build_handle, verify_bot_ownership};
use crate::AppState;
use allternit_driver_interface::{CommandSpec, ExecResult};

/// Request body for joining the mesh. All fields are optional; when omitted
/// the API falls back to the mesh configuration baked into the VM driver.
#[derive(Debug, Deserialize, Default)]
pub struct JoinMeshRequest {
    provider: Option<String>,
    server_url: Option<String>,
    auth_key: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct MeshStatusResponse {
    pub connected: bool,
    pub provider: Option<String>,
    pub tailscale_ip: Option<String>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MeshJoinResponse {
    pub joined: bool,
    pub provider: Option<String>,
    pub tailscale_ip: Option<String>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
}

/// POST /api/v1/bots/:bot_id/desktop/mesh/join
/// Installs the Tailscale client (if missing) and joins the configured mesh.
pub async fn join_desktop_mesh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Json(body): Json<JoinMeshRequest>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response();
        }
    };

    let sandbox_id = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(record)) => record.sandbox_id,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "bot has no desktop sandbox"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to read sandbox record"})),
            )
                .into_response();
        }
    };

    let script = match build_join_script(&body) {
        Ok(s) => s,
        Err(resp) => return resp,
    };

    let handle = build_handle(&sandbox_id, None);
    let cmd = CommandSpec {
        command: vec!["bash".to_string(), "-c".to_string(), script],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    info!(bot_id, sandbox_id, "Joining desktop to mesh");
    let result = match driver.exec(&handle, cmd).await {
        Ok(r) => r,
        Err(e) => {
            warn!(bot_id, sandbox_id, error = %e, "Failed to execute mesh join");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to join mesh: {}", e)})),
            )
                .into_response();
        }
    };

    // Give tailscaled a moment to register, then read back the IP.
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
    let status = fetch_mesh_status(&*driver, &sandbox_id).await;

    Json(MeshJoinResponse {
        joined: status.connected,
        provider: status.provider.clone(),
        tailscale_ip: status.tailscale_ip.clone(),
        stdout: Some(String::from_utf8_lossy(result.stdout.as_deref().unwrap_or(&[])).to_string()),
        stderr: Some(String::from_utf8_lossy(result.stderr.as_deref().unwrap_or(&[])).to_string()),
    })
    .into_response()
}

/// GET /api/v1/bots/:bot_id/desktop/mesh/status
pub async fn desktop_mesh_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response();
        }
    };

    let sandbox_id = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(record)) => record.sandbox_id,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "bot has no desktop sandbox"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to read sandbox record"})),
            )
                .into_response();
        }
    };

    Json(fetch_mesh_status(&*driver, &sandbox_id).await).into_response()
}

/// POST /api/v1/bots/:bot_id/desktop/mesh/leave
pub async fn leave_desktop_mesh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response();
        }
    };

    let sandbox_id = match crate::bot_desktop_routes::read_bot_sandbox(&state.db, &bot_id) {
        Ok(Some(record)) => record.sandbox_id,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "bot has no desktop sandbox"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot sandbox");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to read sandbox record"})),
            )
                .into_response();
        }
    };

    let handle = build_handle(&sandbox_id, None);
    let cmd = CommandSpec {
        command: vec!["tailscale".to_string(), "down".to_string()],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    match driver.exec(&handle, cmd).await {
        Ok(r) => Json(json!({
            "left": r.exit_code == 0,
            "exit_code": r.exit_code,
            "stdout": String::from_utf8_lossy(r.stdout.as_deref().unwrap_or(&[])),
            "stderr": String::from_utf8_lossy(r.stderr.as_deref().unwrap_or(&[])),
        }))
        .into_response(),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": format!("failed to leave mesh: {}", e)})),
        )
            .into_response(),
    }
}

async fn fetch_mesh_status(driver: &dyn allternit_driver_interface::ExecutionDriver, sandbox_id: &str) -> MeshStatusResponse {
    let handle = build_handle(sandbox_id, None);
    let cmd = CommandSpec {
        command: vec![
            "tailscale".to_string(),
            "status".to_string(),
            "--json".to_string(),
        ],
        env_vars: HashMap::new(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    match driver.exec(&handle, cmd).await {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(result.stdout.as_deref().unwrap_or(&[]));
            let stderr = String::from_utf8_lossy(result.stderr.as_deref().unwrap_or(&[]));
            let connected = result.exit_code == 0 && stdout.contains("\"Self\"");
            let tailscale_ip = if connected {
                allternit_computer_cloud::parse_tailscale_ip(&stdout)
            } else {
                None
            };
            MeshStatusResponse {
                connected,
                provider: None,
                tailscale_ip,
                stdout: Some(stdout.to_string()),
                stderr: Some(stderr.to_string()),
            }
        }
        Err(e) => {
            warn!(sandbox_id, error = %e, "Failed to fetch mesh status");
            MeshStatusResponse {
                connected: false,
                provider: None,
                tailscale_ip: None,
                stdout: None,
                stderr: Some(e.to_string()),
            }
        }
    }
}

fn build_join_script(
    body: &JoinMeshRequest,
) -> Result<String, axum::response::Response> {
    use allternit_computer_cloud::MeshConfig;

    let config = if let (Some(provider), Some(auth_key)) = (&body.provider, &body.auth_key) {
        match provider.as_str() {
            "tailscale" => MeshConfig::Tailscale {
                auth_key: auth_key.clone(),
                tags: body.tags.clone(),
            },
            "headscale" => {
                let server_url = body
                    .server_url
                    .clone()
                    .ok_or_else(|| {
                        (StatusCode::BAD_REQUEST, Json(json!({"error": "server_url required for headscale"})))
                            .into_response()
                    })?;
                MeshConfig::Headscale {
                    server_url,
                    auth_key: auth_key.clone(),
                    tags: body.tags.clone(),
                }
            }
            other => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("unknown provider: {}", other)})),
                )
                    .into_response());
            }
        }
    } else {
        // Fall back to the mesh config baked into the VM driver.
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "mesh provider not configured; pass provider + auth_key + server_url"})),
        )
            .into_response());
    };

    Ok(config.guest_join_script())
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_computer_cloud::MeshConfig;

    #[test]
    fn headscale_join_script_includes_login_server() {
        let cfg = MeshConfig::Headscale {
            server_url: "http://10.0.0.1:8081".to_string(),
            auth_key: "hskey-auth-xyz".to_string(),
            tags: vec![],
        };
        let script = cfg.guest_join_script();
        assert!(script.contains("tailscale up"));
        assert!(script.contains("--reset"));
        assert!(script.contains("--login-server 'http://10.0.0.1:8081'"));
    }

    #[test]
    fn parse_status_extracts_ip() {
        let json = r#"{"TailscaleIPs":["100.64.0.5"],"Self":{"ID":"node"}}"#;
        assert_eq!(allternit_computer_cloud::parse_tailscale_ip(json).unwrap(), "100.64.0.5");
    }
}
