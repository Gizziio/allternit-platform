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
use std::time::Duration;
use tokio::io::AsyncBufReadExt;
use tracing::{debug, error};

use allternit_driver_interface::{
    CommandSpec, EnvironmentSpec, ExecutionDriver, ExecutionId, PolicySpec, ResourceSpec, SpawnSpec,
    TenantId,
};

use crate::AppState;
use crate::env_allowlist::minimal_child_env;

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
        .route("/pool", get(pool_status_handler))
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
    let driver = state.vm_driver.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "VM driver not available".to_string(),
    ))?;

    // Warm pooled path: checkout a health-checked VM, exec, checkin. Pool
    // errors fail closed below — a checkout failure is a 503, never a silent
    // unsandboxed fallback.
    if let Some(pool) = crate::vm_pool::global_pool() {
        let response = execute_via_pool(&pool, &request)
            .await
            .map_err(|e| (e.0, e.1))?;
        return Ok(Json(response));
    }

    let response = execute_with_driver(driver, &request)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(response))
}

/// Execute against a pooled VM. Mirrors `execute_with_driver`'s command
/// construction; the VM survives the request and is returned to the pool.
async fn execute_via_pool(
    pool: &Arc<crate::vm_pool::VmPool>,
    request: &SandboxExecuteRequest,
) -> Result<SandboxExecuteResponse, (StatusCode, String)> {
    use allternit_driver_interface::CommandSpec;

    let checkout = pool
        .checkout()
        .await
        .map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e.message()))?;

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

    let result = pool
        .exec_on(&checkout, command_spec)
        .await
        .map_err(|e| format!("Execution failed: {e}"));

    match result {
        Ok(exec_result) => {
            // A completed exec (any exit code) proves the VM is alive; return
            // it to the warm pool.
            pool.checkin(checkout.vm_id, true).await;
            let stdout = exec_result
                .stdout
                .map(|v| String::from_utf8_lossy(&v).into_owned())
                .unwrap_or_default();
            let stderr = exec_result
                .stderr
                .map(|v| String::from_utf8_lossy(&v).into_owned())
                .unwrap_or_default();
            Ok(SandboxExecuteResponse {
                exit_code: exec_result.exit_code,
                stdout,
                stderr,
                duration_ms: exec_result.duration_ms,
                session_id: Some(checkout.vm_id.to_string()),
            })
        }
        Err(message) => {
            // Driver-level exec failure usually means a dead VM: destroy it.
            pool.checkin(checkout.vm_id, false).await;
            Err((StatusCode::INTERNAL_SERVER_ERROR, message))
        }
    }
}

/// Pool status for operators: warm counts, limits, and state-file location.
async fn pool_status_handler() -> Response {
    match crate::vm_pool::global_pool() {
        Some(pool) => Json(serde_json::to_value(pool.stats()).unwrap_or_default()).into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "vm_pool_disabled",
                "message": "VM pool is disabled or no VM driver is configured.",
                "enabled": false,
            })),
        )
            .into_response(),
    }
}

async fn execute_with_driver(
    driver: &Arc<dyn ExecutionDriver>,
    request: &SandboxExecuteRequest,
) -> Result<SandboxExecuteResponse, String> {
    let spawn_spec = build_spawn_spec(request).map_err(|e| e.1)?;

    let handle = driver.spawn(spawn_spec).await.map_err(|e| format!("Failed to spawn: {e}"))?;

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

    let result = driver
        .exec(&handle, command_spec)
        .await
        .map_err(|e| format!("Execution failed: {e}"))?;

    let _ = driver.destroy(&handle).await;

    let stdout = result
        .stdout
        .map(|v| String::from_utf8_lossy(&v).into_owned())
        .unwrap_or_default();
    let stderr = result
        .stderr
        .map(|v| String::from_utf8_lossy(&v).into_owned())
        .unwrap_or_default();

    Ok(SandboxExecuteResponse {
        exit_code: result.exit_code,
        stdout,
        stderr,
        duration_ms: result.duration_ms,
        session_id: Some(handle.id.to_string()),
    })
}

/// Best-effort sandbox execution. Uses the VM driver when available; otherwise
/// falls back to a local subprocess so server tools and tests can run without
/// a full WebVM backend.
pub async fn execute_sandbox_or_subprocess(
    state: &AppState,
    request: &SandboxExecuteRequest,
) -> Result<SandboxExecuteResponse, String> {
    if let Some(driver) = state.vm_driver.as_ref() {
        execute_with_driver(driver, request).await
    } else {
        execute_subprocess_fallback(request).await
    }
}

async fn execute_subprocess_fallback(
    request: &SandboxExecuteRequest,
) -> Result<SandboxExecuteResponse, String> {
    let interpreter = get_interpreter(&request.language);
    let mut cmd = tokio::process::Command::new(&interpreter);
    cmd.arg("-c").arg(&request.code);
    // Strip the full API environment before applying the caller's explicit env.
    cmd.env_clear().envs(minimal_child_env(Some(request.env.clone())));
    if let Some(dir) = &request.workdir {
        cmd.current_dir(dir);
    }
    let timeout = Duration::from_secs(request.timeout_secs.max(1));
    let output = tokio::time::timeout(timeout, cmd.output())
        .await
        .map_err(|_| "Execution timed out".to_string())?
        .map_err(|e| format!("Failed to execute: {e}"))?;

    Ok(SandboxExecuteResponse {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        duration_ms: 0,
        session_id: None,
    })
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
            let body = format!(
                "data: {{\"type\":\"error\",\"message\":\"Unsupported language: {}\"}}\n\n",
                request.language
            );
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
            .env_clear()
            .envs(minimal_child_env(Some(request.env.clone())))
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
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            "VM driver not initialized".to_string(),
        ));
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

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_driver_interface::{
        DriverCapabilities, DriverError, DriverHealth, DriverType, ExecResult, ExecutionHandle,
        IsolationLevel, ResourceConsumption, SpawnSpec, TenantId,
    };
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use tower::ServiceExt;
    use uuid::Uuid;

    /// Minimal driver: every exec succeeds, spawns return fresh handles, and
    /// spawn/destroy calls are counted so tests can prove pooling.
    #[derive(Debug, Default)]
    struct SmokeMockDriver {
        spawns: Mutex<u32>,
        destroys: Mutex<u32>,
    }

    #[async_trait::async_trait]
    impl allternit_driver_interface::ExecutionDriver for SmokeMockDriver {
        fn capabilities(&self) -> DriverCapabilities {
            DriverCapabilities {
                resize: false,
                clone: false,
                driver_type: DriverType::Container,
                isolation: IsolationLevel::Standard,
                max_resources: ResourceSpec::minimal(),
                supported_env_specs: vec![],
                features: Default::default(),
            }
        }

        async fn spawn(&self, _spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
            *self.spawns.lock().unwrap() += 1;
            Ok(ExecutionHandle {
                id: allternit_driver_interface::ExecutionId(Uuid::new_v4()),
                tenant: TenantId::new("allternit-vm-pool".to_string()).unwrap(),
                driver_info: HashMap::new(),
                env_spec: Default::default(),
            })
        }

        async fn pause_vm(&self, _h: &ExecutionHandle) -> Result<(), DriverError> {
            Ok(())
        }
        async fn resume_vm(&self, _h: &ExecutionHandle) -> Result<(), DriverError> {
            Ok(())
        }

        async fn exec(
            &self,
            _h: &ExecutionHandle,
            _cmd: CommandSpec,
        ) -> Result<ExecResult, DriverError> {
            Ok(ExecResult {
                exit_code: 0,
                stdout: Some(b"pooled-ok".to_vec()),
                stderr: None,
                duration_ms: 1,
                resource_usage: ResourceConsumption::default(),
            })
        }

        async fn stream_logs(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Vec<allternit_driver_interface::LogEntry>, DriverError> {
            Ok(vec![])
        }
        async fn get_artifacts(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Vec<allternit_driver_interface::Artifact>, DriverError> {
            Ok(vec![])
        }

        async fn destroy(&self, _h: &ExecutionHandle) -> Result<(), DriverError> {
            *self.destroys.lock().unwrap() += 1;
            Ok(())
        }

        async fn get_consumption(&self, _h: &ExecutionHandle) -> Result<ResourceConsumption, DriverError> {
            Ok(Default::default())
        }
        async fn get_receipt(
            &self,
            _h: &ExecutionHandle,
        ) -> Result<Option<allternit_driver_interface::Receipt>, DriverError> {
            Ok(None)
        }

        async fn health_check(&self) -> Result<DriverHealth, DriverError> {
            Ok(DriverHealth {
                healthy: true,
                message: None,
                active_executions: 0,
                available_capacity: ResourceSpec::minimal(),
                capabilities: vec![],
            })
        }
    }

    async fn body_json(body: Body) -> serde_json::Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| serde_json::Value::Null)
    }

    /// Live HTTP smoke of the pooled sandbox path: boot the sandbox router
    /// over a mock driver, execute twice (second request must reuse the warm
    /// VM), then "restart" the gateway (re-init the pool from the same state
    /// file) and confirm the warm VM survived and is reused — never
    /// respawned, never leaked.
    #[tokio::test]
    async fn pooled_execute_over_http_and_restart_reuse() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state_path = temp.join("pool-state.json");
        let driver = Arc::new(SmokeMockDriver::default());
        let cfg = crate::vm_pool::PoolConfig {
            min_idle: 0,
            max_total: 4,
            idle_ttl: std::time::Duration::from_secs(600),
        };

        // ── Gateway boot #1 ──
        let pool = crate::vm_pool::init_global_for_test(
            driver.clone(),
            cfg,
            Some(state_path.clone()),
        );
        let state = crate::test_helpers::app_state_with_driver(&temp, Some(driver.clone())).await;
        let app = sandbox_router().with_state(state);

        let execute = |code: &str| {
            let app = app.clone();
            let body = serde_json::json!({
                "code": code,
                "language": "bash",
            });
            async move {
                app.oneshot(
                    Request::post("/execute")
                        .header("content-type", "application/json")
                        .body(Body::from(body.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap()
            }
        };

        let resp = execute("echo one").await;
        assert_eq!(resp.status(), StatusCode::OK);
        let json = body_json(resp.into_body()).await;
        assert_eq!(json["exit_code"], 0);
        assert_eq!(json["stdout"], "pooled-ok");
        assert_eq!(driver.spawns.lock().unwrap().clone(), 1);

        // Second request: the first VM was checked in warm and must be
        // reused, not respawned.
        let resp = execute("echo two").await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(driver.spawns.lock().unwrap().clone(), 1, "warm VM reused");
        assert_eq!(pool.stats().idle, 1);

        // Pool status route reports the warm VM.
        let state2 = crate::test_helpers::app_state(&temp).await;
        let app2 = sandbox_router().with_state(state2);
        let resp = app2
            .oneshot(Request::get("/pool").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let json = body_json(resp.into_body()).await;
        assert_eq!(json["enabled"], true);
        assert_eq!(json["idle"], 1);
        assert_eq!(json["max_total"], 4);

        // ── Gateway boot #2 (simulated restart, same state file) ──
        drop(pool);
        let pool2 = crate::vm_pool::init_global_for_test(driver.clone(), cfg, Some(state_path));
        // The checked-in VM from boot #1 is restored as warm; the checked-out
        // state from boot #1 was empty, so nothing to reclaim.
        assert_eq!(pool2.stats().idle, 1, "warm VM restored from disk");

        let state3 = crate::test_helpers::app_state_with_driver(&temp, Some(driver.clone())).await;
        let app3 = sandbox_router().with_state(state3);
        let resp = app3
            .oneshot(
                Request::post("/execute")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::json!({"code": "echo three", "language": "bash"}).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            driver.spawns.lock().unwrap().clone(),
            1,
            "restored warm VM must be reused after restart — no leak, no respawn"
        );
    }
}
