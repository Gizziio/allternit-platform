//! Sandbox API routes for VM-based code execution
//!
//! Replaces Docker-based sandboxing with VM-based execution

use axum::{
    body::Body,
    extract::{Json, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;
use tracing::{debug, error};

use allternit_driver_interface::{
    CommandSpec, ExecutionId,
    PolicySpec, ResourceSpec, SpawnSpec, TenantId, EnvironmentSpec,
};

use crate::AppState;

/// Sandbox execution request
#[derive(Debug, Deserialize)]
pub struct SandboxExecuteRequest {
    /// Code or command to execute
    pub code: String,
    /// Language/runtime
    pub language: String,
    /// Working directory
    #[serde(default)]
    pub workdir: Option<String>,
    /// Environment variables
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
    /// Timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Resource limits
    #[serde(default)]
    pub resources: Option<ResourceLimitsRequest>,
    /// Toolchain layers
    #[serde(default)]
    pub toolchains: Vec<String>,
    /// Enable network
    #[serde(default)]
    pub network_enabled: bool,
}

fn default_timeout() -> u64 {
    300
}

#[derive(Debug, Deserialize)]
pub struct ResourceLimitsRequest {
    pub cpu_cores: Option<f64>,
    pub memory_mb: Option<u64>,
}

/// Sandbox execution response
#[derive(Debug, Serialize)]
pub struct SandboxExecuteResponse {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub session_id: Option<String>,
}

/// Sandbox capabilities response
#[derive(Debug, Serialize)]
pub struct SandboxCapabilitiesResponse {
    pub driver_type: String,
    pub isolation_level: String,
    pub supported_languages: Vec<String>,
    pub available_toolchains: Vec<String>,
    pub max_concurrent_sessions: usize,
    pub supports_snapshots: bool,
    pub supports_streaming: bool,
}

/// Create sandbox router
pub fn sandbox_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(sandbox_status))
        .route("/execute", post(execute_handler))
        .route("/execute/stream", post(execute_stream_handler))
        .route("/capabilities", get(capabilities_handler))
        .route("/health", get(health_handler))
}

async fn sandbox_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "sandbox",
    }))
}

/// Execute code in sandbox
async fn execute_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SandboxExecuteRequest>,
) -> Result<Json<SandboxExecuteResponse>, (StatusCode, String)> {
    debug!("Sandbox execute request: {:?}", request);
    
    // Get the execution driver
    let driver = state.vm_driver.as_ref()
        .ok_or((StatusCode::SERVICE_UNAVAILABLE, "VM driver not available".to_string()))?;
    
    // Build spawn spec
    let spawn_spec = build_spawn_spec(&request)?;
    
    // Spawn execution environment
    let handle = driver.spawn(spawn_spec).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to spawn: {}", e)))?;
    
    // Build command spec
    let command_spec = CommandSpec {
        command: vec![
            get_interpreter(&request.language),
            "-c".to_string(),
            request.code.clone(),
        ],
        env_vars: request.env.clone(),
        working_dir: request.workdir.clone(),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };
    
    let result = driver.exec(&handle, command_spec).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Execution failed: {}", e)))?;
    
    // Cleanup
    let _ = driver.destroy(&handle).await;
    
    let stdout = result.stdout.map(|v| String::from_utf8_lossy(&v).into_owned()).unwrap_or_default();
    let stderr = result.stderr.map(|v| String::from_utf8_lossy(&v).into_owned()).unwrap_or_default();
    
    Ok(Json(SandboxExecuteResponse {
        exit_code: result.exit_code,
        stdout,
        stderr,
        duration_ms: result.duration_ms,
        session_id: Some(handle.id.to_string()),
    }))
}

/// Execute code with streaming output (SSE)
async fn execute_stream_handler(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<SandboxExecuteRequest>,
) -> Response {
    let (cmd, args): (&str, Vec<&str>) = match request.language.as_str() {
        "python" | "python3" => ("python3", vec!["-c", &request.code]),
        "node" | "javascript" => ("node", vec!["-e", &request.code]),
        "bash" | "sh" => ("bash", vec!["-c", &request.code]),
        _ => {
            let body = format!("data: {{\"type\":\"error\",\"message\":\"Unsupported language: {}\"}}\n\n", request.language);
            return Response::builder()
                .status(200)
                .header(header::CONTENT_TYPE, "text/event-stream")
                .header(header::CACHE_CONTROL, "no-cache")
                .body(Body::from(body))
                .unwrap_or_default();
        }
    };

    let timeout = std::time::Duration::from_secs(request.timeout_secs.min(300));
    let _code = request.code.clone();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    let stream_body = async_stream::stream! {
        let mut child = match tokio::process::Command::new(cmd)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("data: {{\"type\":\"error\",\"message\":\"{}\"}}\n\n", e);
                yield Ok::<_, std::convert::Infallible>(bytes::Bytes::from(msg));
                return;
            }
        };

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let mut stdout_lines = tokio::io::BufReader::new(stdout).lines();
        let mut stderr_lines = tokio::io::BufReader::new(stderr).lines();

        let deadline = tokio::time::Instant::now() + timeout;

        loop {
            tokio::select! {
                line = stdout_lines.next_line() => {
                    match line {
                        Ok(Some(text)) => {
                            let escaped = text.replace('"', "\\\"");
                            let msg = format!("data: {{\"type\":\"stdout\",\"line\":\"{escaped}\"}}\n\n");
                            yield Ok::<_, std::convert::Infallible>(bytes::Bytes::from(msg));
                        }
                        Ok(None) => break,
                        Err(e) => {
                            error!(error=%e, "stdout read error");
                            break;
                        }
                    }
                }
                line = stderr_lines.next_line() => {
                    match line {
                        Ok(Some(text)) => {
                            let escaped = text.replace('"', "\\\"");
                            let msg = format!("data: {{\"type\":\"stderr\",\"line\":\"{escaped}\"}}\n\n");
                            yield Ok::<_, std::convert::Infallible>(bytes::Bytes::from(msg));
                        }
                        Ok(None) => {}
                        Err(e) => {
                            error!(error=%e, "stderr read error");
                        }
                    }
                }
                _ = tokio::time::sleep_until(deadline) => {
                    let _ = child.kill().await;
                    let msg = "data: {\"type\":\"error\",\"message\":\"Execution timed out\"}\n\n".to_string();
                    yield Ok::<_, std::convert::Infallible>(bytes::Bytes::from(msg));
                    return;
                }
            }
        }

        let exit_code = child.wait().await.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let done = format!("data: {{\"type\":\"done\",\"exit_code\":{exit_code}}}\n\n");
        yield Ok::<_, std::convert::Infallible>(bytes::Bytes::from(done));
    };

    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::CONNECTION, "keep-alive")
        .body(Body::from_stream(stream_body))
        .unwrap_or_default()
}

/// Get sandbox capabilities
async fn capabilities_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SandboxCapabilitiesResponse>, (StatusCode, String)> {
    let caps = if let Some(driver) = state.vm_driver.as_ref() {
        driver.capabilities()
    } else {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "VM driver not available".to_string()));
    };
    
    let driver_type = format!("{:?}", caps.driver_type).to_lowercase();
    let isolation_level = format!("{:?}", caps.isolation).to_lowercase();
    
    Ok(Json(SandboxCapabilitiesResponse {
        driver_type,
        isolation_level,
        supported_languages: vec![
            "python".to_string(),
            "node".to_string(),
            "bash".to_string(),
            "rust".to_string(),
        ],
        available_toolchains: vec![
            "python-3.12".to_string(),
            "node-22".to_string(),
            "rust-stable".to_string(),
        ],
        max_concurrent_sessions: 10, // Default or obtain from elsewhere
        supports_snapshots: caps.features.snapshot,
        supports_streaming: true,
    }))
}

/// Health check endpoint
async fn health_handler(
    State(state): State<Arc<AppState>>,
) -> Result<String, (StatusCode, String)> {
    if state.vm_driver.is_none() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "VM driver not initialized".to_string()));
    }
    
    Ok("OK".to_string())
}

/// Build SpawnSpec from request
fn build_spawn_spec(request: &SandboxExecuteRequest) -> Result<SpawnSpec, (StatusCode, String)> {
    let resources = if let Some(req) = &request.resources {
        ResourceSpec {
            cpu_millis: (req.cpu_cores.unwrap_or(1.0) * 1000.0) as u32,
            memory_mib: req.memory_mb.unwrap_or(512) as u32,
            ..Default::default()
        }
    } else {
        ResourceSpec::minimal()
    };
    
    let tenant = TenantId::new(format!("api-{}", uuid::Uuid::new_v4()))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let env = EnvironmentSpec {
        image: "ubuntu-22.04-minimal".to_string(),
        env_vars: request.env.clone(),
        working_dir: request.workdir.clone(),
        ..Default::default()
    };

    Ok(SpawnSpec {
        tenant,
        project: None,
        workspace: None,
        run_id: Some(ExecutionId::new()),
        env,
        policy: PolicySpec::default_permissive(),
        resources,
        envelope: None,
        prewarm_pool: None,
    })
}

/// Get interpreter for language
fn get_interpreter(language: &str) -> String {
    match language.to_lowercase().as_str() {
        "python" | "py" => "python3".to_string(),
        "node" | "js" | "javascript" => "node".to_string(),
        "bash" | "sh" => "bash".to_string(),
        "rust" | "rs" => "rustc".to_string(),
        _ => language.to_string(),
    }
}
