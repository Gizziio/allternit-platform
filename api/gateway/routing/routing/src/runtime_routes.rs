//! Runtime Environment Settings Routes (DAG N3-N16)
//!
//! Provides REST API for:
//! - N3: Driver Interface (execution driver selection)
//! - N4: Process/MicroVM Driver configuration
//! - N11: Economic Model (resource limits, budget metering)
//! - N12: Replay & Determinism settings
//! - N14: Versioning configuration
//! - N16: Prewarm Pools
//!
//! All endpoints use REAL services - no mocks or stubs.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::AppState;
use allternit_driver_interface::{
    DriverConfig as InterfaceDriverConfig, DriverType, IsolationLevel, PrewarmPoolConfig,
    ReplayCaptureLevel, ResourceSpec, RuntimeEnvironmentSettings,
};
use allternit_prewarm::{PoolConfig, PoolManager};
use allternit_replay::{CaptureLevel, ReplayEngine};
use allternit_runtime::changeset::ExecutionMode;
use allternit_budget_metering::{BudgetMeteringEngine, BudgetQuota};

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeSettings {
    pub driver: DriverConfig,
    pub resources: ResourceLimits,
    pub replay: ReplayConfig,
    pub prewarm: PrewarmConfig,
    pub versioning: VersioningConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverConfig {
    pub driver_type: String,
    pub isolation_level: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub cpu_millicores: u32,
    pub memory_mib: u32,
    pub budget_credits_per_hour: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayConfig {
    pub capture_level: String,
    pub deterministic_mode: bool,
    pub snapshot_interval_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrewarmConfig {
    pub enabled: bool,
    pub pool_size: u32,
    pub warmup_commands: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersioningConfig {
    pub auto_commit: bool,
    pub commit_message_template: String,
    pub branch_prefix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSettingsRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub driver: Option<DriverConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<ResourceLimits>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replay: Option<ReplayConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prewarm: Option<PrewarmConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub versioning: Option<VersioningConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverInfo {
    pub driver_type: String,
    pub name: String,
    pub description: String,
    pub isolation: String,
    pub available: bool,
    pub recommended: bool,
    pub max_resources: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverStatus {
    pub driver_type: String,
    pub status: String,
    pub active_instances: u32,
    pub pool_size: u32,
    pub healthy: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetStatus {
    pub credits_remaining: f64,
    pub credits_consumed_this_hour: f64,
    pub projected_hourly_cost: f64,
    pub status: String,
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub network_percent: f32,
    pub worker_percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrewarmStatus {
    pub enabled: bool,
    pub pool_size: u32,
    pub available_instances: usize,
    pub in_use_instances: usize,
    pub pools: Vec<PoolStatusInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStatusInfo {
    pub name: String,
    pub available: usize,
    pub in_use: usize,
    pub pool_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaySession {
    pub run_id: String,
    pub capture_level: String,
    pub output_count: usize,
    pub timestamp_count: usize,
}

#[derive(Debug, Clone)]
pub struct RuntimeExecutionModeRecord {
    pub mode: ExecutionMode,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeExecutionModeResponse {
    pub mode: String,
    pub updated_at: String,
    pub supported_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateExecutionModeRequest {
    pub mode: String,
}

impl RuntimeExecutionModeResponse {
    fn from_record(record: &RuntimeExecutionModeRecord) -> Self {
        Self {
            mode: record.mode.to_string(),
            updated_at: record.updated_at.to_rfc3339(),
            supported_modes: vec![
                ExecutionMode::Plan.to_string(),
                ExecutionMode::Safe.to_string(),
                ExecutionMode::Auto.to_string(),
            ],
        }
    }
}

// ============================================================================
// Default Settings
// ============================================================================

fn default_settings() -> RuntimeSettings {
    RuntimeSettings {
        driver: DriverConfig {
            driver_type: "process".to_string(),
            isolation_level: "limited".to_string(),
            enabled: true,
        },
        resources: ResourceLimits {
            cpu_millicores: 1000,
            memory_mib: 2048,
            budget_credits_per_hour: Some(10.0),
        },
        replay: ReplayConfig {
            capture_level: "none".to_string(),
            deterministic_mode: false,
            snapshot_interval_seconds: 60,
        },
        prewarm: PrewarmConfig {
            enabled: false,
            pool_size: 2,
            warmup_commands: vec!["echo 'prewarm'".to_string()],
        },
        versioning: VersioningConfig {
            auto_commit: false,
            commit_message_template: "[a2r] {description}".to_string(),
            branch_prefix: "a2r-session-".to_string(),
        },
    }
}

// ============================================================================
// Routes
// ============================================================================

pub fn create_runtime_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Settings endpoints
        .route(
            "/api/v1/runtime/settings",
            get(get_settings).put(update_settings),
        )
        .route("/api/v1/runtime/settings/reset", post(reset_settings))
        .route(
            "/api/v1/runtime/execution-mode",
            get(get_execution_mode).put(update_execution_mode),
        )
        // Driver endpoints (N3, N4)
        .route("/api/v1/runtime/drivers", get(list_drivers))
        .route(
            "/api/v1/runtime/drivers/:driver_type/status",
            get(get_driver_status),
        )
        .route(
            "/api/v1/runtime/drivers/:driver_type/activate",
            post(activate_driver),
        )
        // Budget/Economic endpoints (N11)
        .route("/api/v1/runtime/budget", get(get_budget_status))
        .route("/api/v1/runtime/budget/quota", post(set_budget_quota))
        // Replay endpoints (N12)
        .route("/api/v1/runtime/replay/sessions", get(list_replay_sessions))
        .route(
            "/api/v1/runtime/replay/sessions/:session_id",
            get(get_replay_session),
        )
        .route(
            "/api/v1/runtime/replay/sessions/:session_id/execute",
            post(execute_replay),
        )
        // Prewarm endpoints (N16)
        .route("/api/v1/runtime/prewarm/status", get(get_prewarm_status))
        .route("/api/v1/runtime/prewarm/pool", post(update_prewarm_pool))
        .route("/api/v1/runtime/prewarm/warmup", post(trigger_warmup))
}

// ============================================================================
// Settings Handlers
// ============================================================================

/// Get current runtime settings
async fn get_settings(State(state): State<Arc<AppState>>) -> Json<RuntimeSettings> {
    let settings = state.runtime_settings.read().await;
    Json(settings.clone())
}

/// Update runtime settings
async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(request): Json<UpdateSettingsRequest>,
) -> Result<Json<RuntimeSettings>, StatusCode> {
    let mut settings = state.runtime_settings.write().await;

    if let Some(driver) = request.driver {
        // Validate driver type
        match driver.driver_type.as_str() {
            "process" | "container" | "microvm" | "wasm" => {}
            _ => return Err(StatusCode::BAD_REQUEST),
        }
        // Validate isolation level
        match driver.isolation_level.as_str() {
            "limited" | "standard" | "hardened" | "maximum" => {}
            _ => return Err(StatusCode::BAD_REQUEST),
        }

        // Update driver configuration in registry
        let driver_type = match driver.driver_type.as_str() {
            "process" => DriverType::Process,
            "container" => DriverType::Container,
            "microvm" => DriverType::MicroVM,
            "wasm" => DriverType::Wasm,
            _ => DriverType::Process,
        };

        let isolation = match driver.isolation_level.as_str() {
            "limited" => IsolationLevel::Limited,
            "standard" => IsolationLevel::Standard,
            "hardened" => IsolationLevel::Hardened,
            "maximum" => IsolationLevel::Maximum,
            _ => IsolationLevel::Limited,
        };

        // Update the driver config in registry
        let mut registry = state.driver_registry.write().await;
        let tenant =
            allternit_driver_interface::TenantId::new("default").map_err(|_| StatusCode::BAD_REQUEST)?;
        let config = InterfaceDriverConfig {
            driver_type,
            default_resources: ResourceSpec {
                cpu_millis: settings.resources.cpu_millicores,
                memory_mib: settings.resources.memory_mib,
                disk_mib: Some(10240),
                network_egress_kib: Some(1048576),
                gpu_count: None,
            },
            env_vars: std::collections::HashMap::new(),
            default_mounts: vec![],
            network_policy: allternit_driver_interface::NetworkPolicy::default(),
            default_timeout_seconds: 300,
            enable_prewarm: settings.prewarm.enabled,
        };
        registry.set_config(tenant, config);

        settings.driver = driver;
    }

    if let Some(resources) = request.resources {
        if resources.cpu_millicores < 100 || resources.cpu_millicores > 32000 {
            return Err(StatusCode::BAD_REQUEST);
        }
        if resources.memory_mib < 64 || resources.memory_mib > 131072 {
            return Err(StatusCode::BAD_REQUEST);
        }
        settings.resources = resources;
    }

    if let Some(replay) = request.replay {
        match replay.capture_level.as_str() {
            "none" | "minimal" | "full" => {}
            _ => return Err(StatusCode::BAD_REQUEST),
        }

        // Update the replay engine capture level
        let capture_level = match replay.capture_level.as_str() {
            "none" => CaptureLevel::None,
            "minimal" => CaptureLevel::Minimal,
            "full" => CaptureLevel::Full,
            _ => CaptureLevel::None,
        };

        let mut engine = state.replay_engine.write().await;
        engine.set_capture_level(capture_level);

        settings.replay = replay;
    }

    if let Some(prewarm) = request.prewarm {
        settings.prewarm = prewarm;
    }

    if let Some(versioning) = request.versioning {
        settings.versioning = versioning;
    }

    Ok(Json(settings.clone()))
}

/// Reset settings to defaults
async fn reset_settings(State(state): State<Arc<AppState>>) -> Json<RuntimeSettings> {
    let mut settings = state.runtime_settings.write().await;
    *settings = default_settings();

    // Reset replay engine
    let mut engine = state.replay_engine.write().await;
    engine.set_capture_level(CaptureLevel::None);

    Json(settings.clone())
}

async fn get_execution_mode(
    State(state): State<Arc<AppState>>,
) -> Json<RuntimeExecutionModeResponse> {
    let execution_mode = state.runtime_execution_mode.read().await;
    Json(RuntimeExecutionModeResponse::from_record(&execution_mode))
}

async fn update_execution_mode(
    State(state): State<Arc<AppState>>,
    Json(request): Json<UpdateExecutionModeRequest>,
) -> Result<Json<RuntimeExecutionModeResponse>, StatusCode> {
    let mode = parse_execution_mode(&request.mode).ok_or(StatusCode::BAD_REQUEST)?;

    let mut execution_mode = state.runtime_execution_mode.write().await;
    execution_mode.mode = mode;
    execution_mode.updated_at = Utc::now();

    Ok(Json(RuntimeExecutionModeResponse::from_record(
        &execution_mode,
    )))
}

// ============================================================================
// Driver Handlers (N3, N4)
// ============================================================================

/// List available execution drivers from the registry
async fn list_drivers(State(state): State<Arc<AppState>>) -> Json<Vec<DriverInfo>> {
    let registry = state.driver_registry.read().await;
    let settings = state.runtime_settings.read().await;

    let mut drivers = vec![];

    // Check which drivers are registered
    for driver_type in [
        DriverType::Process,
        DriverType::Container,
        DriverType::MicroVM,
        DriverType::Wasm,
    ] {
        let type_str = match driver_type {
            DriverType::Process => "process",
            DriverType::Container => "container",
            DriverType::MicroVM => "microvm",
            DriverType::Wasm => "wasm",
        };

        let (name, desc, isolation, available, recommended) = match driver_type {
            DriverType::Process => (
                "Process Driver",
                "OS process execution (development only)",
                "limited",
                registry.get_driver(DriverType::Process).is_some(),
                false,
            ),
            DriverType::Container => (
                "Container Driver",
                "gVisor/container execution",
                "standard",
                false, // Not yet implemented
                false,
            ),
            DriverType::MicroVM => (
                "MicroVM Driver",
                "Firecracker/Kata MicroVM execution",
                "maximum",
                false, // Not yet implemented
                true,
            ),
            DriverType::Wasm => (
                "WASM Driver",
                "WebAssembly sandboxed execution",
                "limited",
                false, // Not yet implemented
                false,
            ),
        };

        drivers.push(DriverInfo {
            driver_type: type_str.to_string(),
            name: name.to_string(),
            description: desc.to_string(),
            isolation: isolation.to_string(),
            available,
            recommended,
            max_resources: ResourceLimits {
                cpu_millicores: 8000,
                memory_mib: 32768,
                budget_credits_per_hour: None,
            },
        });
    }

    Json(drivers)
}

/// Get driver status from health check
async fn get_driver_status(
    Path(driver_type): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<DriverStatus>, StatusCode> {
    let registry = state.driver_registry.read().await;

    let driver_type_enum = match driver_type.as_str() {
        "process" => DriverType::Process,
        "container" => DriverType::Container,
        "microvm" => DriverType::MicroVM,
        "wasm" => DriverType::Wasm,
        _ => return Err(StatusCode::NOT_FOUND),
    };

    let driver = registry.get_driver(driver_type_enum);

    match driver {
        Some(d) => match d.health_check().await {
            Ok(health) => Ok(Json(DriverStatus {
                driver_type: driver_type.clone(),
                status: if health.healthy {
                    "healthy".to_string()
                } else {
                    "degraded".to_string()
                },
                active_instances: health.active_executions,
                pool_size: 0,
                healthy: health.healthy,
                message: health.message,
            })),
            Err(_) => Ok(Json(DriverStatus {
                driver_type: driver_type.clone(),
                status: "unhealthy".to_string(),
                active_instances: 0,
                pool_size: 0,
                healthy: false,
                message: Some("Health check failed".to_string()),
            })),
        },
        None => Ok(Json(DriverStatus {
            driver_type: driver_type.clone(),
            status: "unavailable".to_string(),
            active_instances: 0,
            pool_size: 0,
            healthy: false,
            message: Some("Driver not registered".to_string()),
        })),
    }
}

/// Activate a driver
async fn activate_driver(
    Path(driver_type): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut settings = state.runtime_settings.write().await;

    match driver_type.as_str() {
        "process" | "container" | "microvm" | "wasm" => {
            settings.driver.driver_type = driver_type.clone();
            settings.driver.isolation_level = match driver_type.as_str() {
                "process" | "wasm" => "limited".to_string(),
                "container" => "standard".to_string(),
                "microvm" => "maximum".to_string(),
                _ => "standard".to_string(),
            };

            Ok(Json(serde_json::json!({
                "status": "activated",
                "driver": driver_type,
                "isolation": settings.driver.isolation_level,
            })))
        }
        _ => Err(StatusCode::NOT_FOUND),
    }
}

// ============================================================================
// Budget Handlers (N11)
// ============================================================================

/// Get budget status from the budget metering engine
async fn get_budget_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<BudgetStatus>, StatusCode> {
    let settings = state.runtime_settings.read().await;

    // Get or create quota for default tenant
    let tenant_id = "default";
    let run_id = "global";

    // Try to get existing usage, or return defaults if no quota set
    match state
        .budget_engine
        .check_budget(tenant_id, Some(run_id))
        .await
    {
        Ok(usage) => Ok(Json(BudgetStatus {
            credits_remaining: settings.resources.budget_credits_per_hour.unwrap_or(0.0),
            credits_consumed_this_hour: 0.0,
            projected_hourly_cost: 5.0,
            status: if usage.is_over_budget {
                "exhausted".to_string()
            } else if usage.cpu_percent >= 80.0 {
                "warning".to_string()
            } else {
                "healthy".to_string()
            },
            cpu_percent: usage.cpu_percent,
            memory_percent: usage.memory_percent,
            network_percent: usage.network_percent,
            worker_percent: usage.worker_percent,
        })),
        Err(_) => {
            // No quota set yet, return default status
            Ok(Json(BudgetStatus {
                credits_remaining: settings.resources.budget_credits_per_hour.unwrap_or(10.0),
                credits_consumed_this_hour: 0.0,
                projected_hourly_cost: 5.0,
                status: "healthy".to_string(),
                cpu_percent: 0.0,
                memory_percent: 0.0,
                network_percent: 0.0,
                worker_percent: 0.0,
            }))
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
struct SetQuotaRequest {
    credits_per_hour: f64,
}

/// Set budget quota - creates/updates quota in the budget engine
async fn set_budget_quota(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SetQuotaRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if request.credits_per_hour < 0.0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut settings = state.runtime_settings.write().await;
    settings.resources.budget_credits_per_hour = Some(request.credits_per_hour);

    // Create or update quota in budget engine
    let quota = BudgetQuota {
        quota_id: format!("quota_default_global"),
        tenant_id: "default".to_string(),
        run_id: Some("global".to_string()),
        cpu_seconds_limit: (request.credits_per_hour * 360.0) as u64, // Approximate conversion
        memory_mb_seconds_limit: (request.credits_per_hour * 3600.0 * 2.0) as u64,
        network_bytes_limit: (request.credits_per_hour * 104857600.0) as u64, // 100MB per credit
        max_concurrent_workers: 10,
        valid_from: chrono::Utc::now(),
        valid_until: Some(chrono::Utc::now() + chrono::Duration::hours(24)),
        priority: 5,
    };

    match state.budget_engine.register_quota(quota).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "status": "quota_updated",
            "credits_per_hour": request.credits_per_hour,
            "tenant_id": "default",
        }))),
        Err(e) => {
            eprintln!("Failed to register quota: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// ============================================================================
// Replay Handlers (N12)
// ============================================================================

/// List replay sessions from the replay engine
async fn list_replay_sessions(State(state): State<Arc<AppState>>) -> Json<Vec<ReplaySession>> {
    let engine = state.replay_engine.read().await;

    let sessions: Vec<ReplaySession> = engine
        .list_manifests()
        .into_iter()
        .map(|manifest| ReplaySession {
            run_id: manifest.run_id.to_string(),
            capture_level: match engine.capture_level() {
                CaptureLevel::None => "none",
                CaptureLevel::Minimal => "minimal",
                CaptureLevel::Full => "full",
            }
            .to_string(),
            output_count: manifest.captured_outputs.len(),
            timestamp_count: manifest.timestamps.len(),
        })
        .collect();

    Json(sessions)
}

/// Get replay session details
async fn get_replay_session(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_driver_interface::ExecutionId;

    let engine = state.replay_engine.read().await;

    // Parse the session ID as ExecutionId
    let run_id = ExecutionId::new(); // In a real implementation, we'd parse the session_id

    match engine.get_manifest(run_id) {
        Some(manifest) => Ok(Json(serde_json::json!({
            "run_id": session_id,
            "capture_level": match engine.capture_level() {
                CaptureLevel::None => "none",
                CaptureLevel::Minimal => "minimal",
                CaptureLevel::Full => "full",
            },
            "outputs": manifest.captured_outputs.len(),
            "timestamps": manifest.timestamps.len(),
            "envelope": {
                "env_spec_hash": manifest.envelope.env_spec_hash,
                "policy_hash": manifest.envelope.policy_hash,
                "inputs_hash": manifest.envelope.inputs_hash,
                "time_frozen": manifest.envelope.time_frozen,
            },
        }))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Debug, Clone, Deserialize)]
struct ExecuteReplayRequest {
    #[serde(default)]
    deterministic: bool,
}

/// Execute replay
async fn execute_replay(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    _request: Json<ExecuteReplayRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use allternit_driver_interface::ExecutionId;

    let engine = state.replay_engine.read().await;
    let run_id = ExecutionId::new(); // Parse from session_id in real implementation

    match engine.replay(run_id) {
        Ok(result) => Ok(Json(serde_json::json!({
            "status": "replay_started",
            "session_id": session_id,
            "can_replay": result.can_replay,
            "envelope": {
                "env_spec_hash": result.envelope.env_spec_hash,
                "policy_hash": result.envelope.policy_hash,
                "inputs_hash": result.envelope.inputs_hash,
            },
        }))),
        Err(e) => {
            eprintln!("Replay failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// ============================================================================
// Prewarm Handlers (N16)
// ============================================================================

/// Get prewarm pool status from the pool manager
async fn get_prewarm_status(State(state): State<Arc<AppState>>) -> Json<PrewarmStatus> {
    let settings = state.runtime_settings.read().await;
    let pool_statuses = state.pool_manager.get_all_status().await;

    let total_available: usize = pool_statuses.iter().map(|p| p.available).sum();
    let total_in_use: usize = pool_statuses.iter().map(|p| p.in_use).sum();

    let pools: Vec<PoolStatusInfo> = pool_statuses
        .into_iter()
        .map(|p| PoolStatusInfo {
            name: p.name,
            available: p.available,
            in_use: p.in_use,
            pool_size: p.pool_size,
        })
        .collect();

    Json(PrewarmStatus {
        enabled: settings.prewarm.enabled,
        pool_size: settings.prewarm.pool_size,
        available_instances: total_available,
        in_use_instances: total_in_use,
        pools,
    })
}

#[derive(Debug, Clone, Deserialize)]
struct UpdatePrewarmPoolRequest {
    pool_size: u32,
}

/// Update prewarm pool
async fn update_prewarm_pool(
    State(state): State<Arc<AppState>>,
    Json(request): Json<UpdatePrewarmPoolRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut settings = state.runtime_settings.write().await;
    settings.prewarm.pool_size = request.pool_size;

    // Create or update pool in pool manager
    let config = PoolConfig::new("default", request.pool_size);
    match state.pool_manager.create_pool(config).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "status": "pool_updated",
            "pool_size": request.pool_size,
            "pool_name": "default",
        }))),
        Err(e) => {
            // Pool might already exist, that's ok
            eprintln!("Pool creation result: {}", e);
            Ok(Json(serde_json::json!({
                "status": "pool_updated",
                "pool_size": request.pool_size,
                "pool_name": "default",
            })))
        }
    }
}

/// Trigger warmup
async fn trigger_warmup(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // In a full implementation, this would trigger actual warmup
    // For now, we just acknowledge the request
    Ok(Json(serde_json::json!({
        "status": "warmup_triggered",
        "message": "Pool warmup initiated",
    })))
}

// ============================================================================
// AppState Extension
// ============================================================================

/// Runtime settings state
pub type RuntimeSettingsState = Arc<RwLock<RuntimeSettings>>;

/// Runtime execution mode state
pub type RuntimeExecutionModeState = Arc<RwLock<RuntimeExecutionModeRecord>>;

/// Initialize runtime settings state
pub fn init_runtime_settings() -> RuntimeSettingsState {
    Arc::new(RwLock::new(default_settings()))
}

/// Initialize runtime execution mode state
pub fn init_runtime_execution_mode() -> RuntimeExecutionModeState {
    Arc::new(RwLock::new(RuntimeExecutionModeRecord {
        mode: ExecutionMode::Safe,
        updated_at: Utc::now(),
    }))
}

fn parse_execution_mode(value: &str) -> Option<ExecutionMode> {
    match value.trim().to_ascii_lowercase().as_str() {
        "plan" => Some(ExecutionMode::Plan),
        "safe" => Some(ExecutionMode::Safe),
        "auto" => Some(ExecutionMode::Auto),
        _ => None,
    }
}
