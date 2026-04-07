//! Sandbox API routes for VM-based code execution
//!
//! Replaces Docker-based sandboxing with VM-based execution

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{get, post},
    Router,
};
use futures::stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tracing::debug;

use allternit_driver_interface::{
    CommandSpec, EnvironmentSpec, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
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
    pub max_concurrent_sessions: Option<usize>,
    pub max_resource_limits: SandboxResourceLimitsResponse,
    pub supported_environment_specs: Vec<String>,
    pub supports_snapshots: bool,
    pub supports_streaming: bool,
}

#[derive(Debug, Serialize)]
pub struct SandboxResourceLimitsResponse {
    pub cpu_millis: u32,
    pub memory_mib: u32,
    pub disk_mib: Option<u32>,
    pub network_egress_kib: Option<u64>,
    pub gpu_count: Option<u8>,
}

/// Create sandbox router
pub fn sandbox_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/execute", post(execute_handler))
        .route("/execute/stream", post(execute_stream_handler))
        .route("/capabilities", get(capabilities_handler))
        .route("/health", get(health_handler))
}

/// Execute code in sandbox
async fn execute_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SandboxExecuteRequest>,
) -> Result<Json<SandboxExecuteResponse>, (StatusCode, String)> {
    execute_request(state, request).await.map(Json)
}

/// Execute code with streaming output
async fn execute_stream_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SandboxExecuteRequest>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let start_payload = serde_json::json!({
        "language": request.language.clone(),
        "workdir": request.workdir.clone(),
        "timeout_secs": request.timeout_secs,
    });

    let result = execute_request(state, request).await;
    let terminal_event = match result {
        Ok(response) => json_event("result", &response),
        Err((status, message)) => json_event(
            "error",
            serde_json::json!({
                "status": status.as_u16(),
                "error": message,
            }),
        ),
    };

    Sse::new(stream::iter(vec![
        json_event("start", start_payload),
        terminal_event,
    ]))
}

async fn execute_request(
    state: Arc<AppState>,
    request: SandboxExecuteRequest,
) -> Result<SandboxExecuteResponse, (StatusCode, String)> {
    debug!("Sandbox execute request: {:?}", request);

    // Get the execution driver
    let driver = state.vm_driver.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "VM driver not available".to_string(),
    ))?;

    // Build spawn spec
    let spawn_spec = build_spawn_spec(&request)?;

    // Spawn execution environment
    let handle = driver.spawn(spawn_spec).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to spawn: {}", e),
        )
    })?;

    // Execute command
    let command = build_command_spec(&request);

    let result = driver.exec(&handle, command).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Execution failed: {}", e),
        )
    })?;

    // Cleanup
    let _ = driver.destroy(&handle).await;

    Ok(SandboxExecuteResponse {
        exit_code: result.exit_code,
        stdout: decode_output(result.stdout),
        stderr: decode_output(result.stderr),
        duration_ms: result.duration_ms,
        session_id: Some(handle.id.to_string()),
    })
}

/// Get sandbox capabilities
async fn capabilities_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SandboxCapabilitiesResponse>, (StatusCode, String)> {
    let caps = if let Some(driver) = state.vm_driver.as_ref() {
        driver.capabilities()
    } else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "VM driver not available".to_string(),
        ));
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
        max_concurrent_sessions: None,
        max_resource_limits: SandboxResourceLimitsResponse {
            cpu_millis: caps.max_resources.cpu_millis,
            memory_mib: caps.max_resources.memory_mib,
            disk_mib: caps.max_resources.disk_mib,
            network_egress_kib: caps.max_resources.network_egress_kib,
            gpu_count: caps.max_resources.gpu_count,
        },
        supported_environment_specs: caps
            .supported_env_specs
            .into_iter()
            .map(|spec| format!("{:?}", spec).to_lowercase())
            .collect(),
        supports_snapshots: caps.features.snapshot,
        supports_streaming: true,
    }))
}

/// Health check endpoint
async fn health_handler(
    State(state): State<Arc<AppState>>,
) -> Result<String, (StatusCode, String)> {
    let driver = state.vm_driver.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "VM driver not initialized".to_string(),
    ))?;

    let health = driver.health_check().await.map_err(|e| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("VM driver unhealthy: {}", e),
        )
    })?;

    if !health.healthy {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            health
                .message
                .unwrap_or_else(|| "VM driver reported unhealthy".to_string()),
        ));
    }

    Ok(health.message.unwrap_or_else(|| "OK".to_string()))
}

/// Build SpawnSpec from request
fn build_spawn_spec(request: &SandboxExecuteRequest) -> Result<SpawnSpec, (StatusCode, String)> {
    let tenant = TenantId::new(format!("api-{}", uuid::Uuid::new_v4()))
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid tenant id: {}", e)))?;

    Ok(SpawnSpec {
        tenant,
        project: None,
        workspace: request.workdir.clone(),
        run_id: None,
        env: EnvironmentSpec {
            image: "ubuntu-24.04-minimal".to_string(),
            packages: request.toolchains.clone(),
            env_vars: request.env.clone(),
            working_dir: request.workdir.clone(),
            ..Default::default()
        },
        policy: build_policy_spec(request),
        resources: build_resource_spec(request),
        envelope: None,
        prewarm_pool: None,
    })
}

fn build_policy_spec(request: &SandboxExecuteRequest) -> PolicySpec {
    let mut policy = PolicySpec::default_permissive();
    policy.network_policy = if request.network_enabled {
        allternit_driver_interface::NetworkPolicy {
            egress_allowed: true,
            allowed_hosts: vec![],
            allowed_ports: vec![],
            dns_allowed: true,
        }
    } else {
        allternit_driver_interface::NetworkPolicy::default()
    };
    policy.timeout_seconds = Some(request.timeout_secs.min(u64::from(u32::MAX)) as u32);
    policy
}

fn build_resource_spec(request: &SandboxExecuteRequest) -> ResourceSpec {
    let cpu_millis = request
        .resources
        .as_ref()
        .and_then(|req| req.cpu_cores)
        .map(|cores| (cores.max(0.1) * 1000.0).round() as u32)
        .unwrap_or(1000);
    let memory_mib = request
        .resources
        .as_ref()
        .and_then(|req| req.memory_mb)
        .map(|memory_mb| memory_mb.min(u64::from(u32::MAX)) as u32)
        .unwrap_or(512);

    ResourceSpec {
        cpu_millis,
        memory_mib,
        disk_mib: Some(1024),
        network_egress_kib: if request.network_enabled {
            None
        } else {
            Some(0)
        },
        gpu_count: None,
    }
}

fn build_command_spec(request: &SandboxExecuteRequest) -> CommandSpec {
    let command = match request.language.to_lowercase().as_str() {
        "python" | "py" => vec![
            "python3".to_string(),
            "-c".to_string(),
            request.code.clone(),
        ],
        "node" | "js" | "javascript" => vec![
            "node".to_string(),
            "-e".to_string(),
            request.code.clone(),
        ],
        "bash" | "sh" => vec![
            "bash".to_string(),
            "-lc".to_string(),
            request.code.clone(),
        ],
        "rust" | "rs" => vec![
            "bash".to_string(),
            "-lc".to_string(),
            format!(
                "cat <<'__ALLTERNIT_RS__' >/tmp/allternit-main.rs\n{}\n__ALLTERNIT_RS__\nrustc /tmp/allternit-main.rs -o /tmp/allternit-main && /tmp/allternit-main",
                request.code
            ),
        ],
        _ => vec![
            "bash".to_string(),
            "-lc".to_string(),
            request.code.clone(),
        ],
    };

    CommandSpec {
        command,
        env_vars: request.env.clone(),
        working_dir: request.workdir.clone(),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    }
}

fn decode_output(output: Option<Vec<u8>>) -> String {
    output
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default()
}

fn json_event<T: Serialize>(name: &str, payload: T) -> Result<Event, Infallible> {
    Ok(Event::default()
        .event(name)
        .json_data(payload)
        .expect("serializable SSE payload"))
}
