//! Sandbox API routes for VM-based code execution
//!
//! Replaces Docker-based sandboxing with VM-based execution

use axum::{
    extract::{Json, State},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, info, warn};

use a2r_driver_interface::{
    DriverCapabilities, ExecutionDriver, IsolationLevel, ResourceLimits, SpawnSpec,
    TargetArch,
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
    debug!("Sandbox execute request: {:?}", request);
    
    // Get the execution driver
    let driver = state.vm_driver.as_ref()
        .ok_or((StatusCode::SERVICE_UNAVAILABLE, "VM driver not available".to_string()))?;
    
    // Build spawn spec
    let spawn_spec = build_spawn_spec(&request)?;
    
    // Spawn execution environment
    let handle = driver.spawn(spawn_spec).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to spawn: {}", e)))?;
    
    // Execute command
    let command = vec![
        get_interpreter(&request.language),
        "-c".to_string(),
        request.code.clone(),
    ];
    
    let timeout_ms = Some(request.timeout_secs * 1000);
    
    let result = driver.exec(handle, command, request.env, timeout_ms).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Execution failed: {}", e)))?;
    
    // Cleanup
    let _ = driver.destroy(handle).await;
    
    Ok(Json(SandboxExecuteResponse {
        exit_code: result.exit_code,
        stdout: result.stdout,
        stderr: result.stderr,
        duration_ms: result.duration_ms,
        session_id: Some(handle.session_id.to_string()),
    }))
}

/// Execute code with streaming output
async fn execute_stream_handler(
    State(_state): State<Arc<AppState>>,
    Json(_request): Json<SandboxExecuteRequest>,
) -> Result<Json<SandboxExecuteResponse>, (StatusCode, String)> {
    // TODO: Implement streaming execution
    Err((StatusCode::NOT_IMPLEMENTED, "Streaming not yet implemented".to_string()))
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
    let isolation_level = format!("{:?}", caps.isolation_level).to_lowercase();
    
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
        max_concurrent_sessions: caps.max_concurrent_executions,
        supports_snapshots: caps.supports_snapshots,
        supports_streaming: false, // TODO
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
        ResourceLimits {
            cpu_cores: req.cpu_cores.unwrap_or(1.0),
            memory_mb: req.memory_mb.unwrap_or(512),
            ..Default::default()
        }
    } else {
        ResourceLimits::development()
    };
    
    Ok(SpawnSpec {
        tenant_id: format!("api-{}", uuid::Uuid::new_v4()),
        workspace_id: None,
        arch: TargetArch::current(),
        resources,
        rootfs: a2r_driver_interface::RootfsSpec {
            base_image: "ubuntu-22.04-minimal".to_string(),
            overlays: request.toolchains.clone(),
            kernel_path: None,
            kernel_args: None,
        },
        mounts: vec![],
        env: std::collections::HashMap::new(),
        network: a2r_driver_interface::NetworkPolicy {
            allow_all: request.network_enabled,
            ..Default::default()
        },
        chrome_session: false,
        toolchains: request.toolchains.clone(),
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
