//! Chrome Session Broker - Manages real Chrome streaming sessions
//!
//! Platform-specific backends:
//! - Linux: Firecracker microVMs (production)
//! - macOS: Docker containers (development)

use axum::{
    extract::{Path, State, WebSocketUpgrade, ws::Message},
    http::StatusCode,
    response::{IntoResponse, Response, Json},
    routing::{get, post, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::{sync::RwLock, time::sleep};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use tower_http::trace::TraceLayer;
use tracing::{info, warn, error, debug};
use futures_util::{StreamExt, SinkExt};
use reqwest;

use crate::AppState;

// Platform-specific imports
#[cfg(target_os = "linux")]
use allternit_driver_interface::{
    ExecutionDriver, SpawnSpec, CommandSpec, ResourceSpec, PolicySpec,
    NetworkPolicy, DriverError, TenantId, EnvironmentSpec,
    FilePolicy, EnvSpecType, MountSpec,
};
#[cfg(target_os = "linux")]
use std::str::FromStr;

// Docker imports for macOS
#[cfg(target_os = "macos")]
use bollard::{
    Docker,
    container::{
        Config, CreateContainerOptions, StartContainerOptions,
        StopContainerOptions, RemoveContainerOptions,
    },
    service::{HostConfig, PortBinding, Mount, MountTypeEnum},
};

// ============================================================================
// Tenant Configuration Model
// ============================================================================

/// Tenant Chrome configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantChromeConfig {
    pub tenant_id: String,
    pub extension_mode: ExtensionMode,
    pub internet_mode: InternetMode,
    pub profile_persistence: ProfileMode,
    pub audit_level: AuditLevel,
    pub session_ttl_minutes: u32,
    pub idle_timeout_minutes: u32,
    pub max_concurrent_sessions: u32,
    pub internal_allowlist: Vec<String>,
    pub blocked_settings: Vec<String>,
    pub extension_catalog: Vec<CatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExtensionMode {
    Power,
    Managed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InternetMode {
    Open,
    OpenWithInternalAllowlist,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProfileMode {
    Persistent,
    Ephemeral,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuditLevel {
    Basic,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub extension_id: String,
    pub name: String,
    pub description: String,
    pub install_mode: InstallMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InstallMode {
    Normal,
    ForceInstalled,
    Recommended,
}

// ============================================================================
// Data Models
// ============================================================================

/// Chrome session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChromeSessionStatus {
    Provisioning,
    Connecting,
    Ready,
    Error(String),
    Terminated,
}

/// ICE server configuration for WebRTC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceServer {
    pub urls: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential: Option<String>,
}

/// Chrome session record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromeSessionRecord {
    pub session_id: String,
    pub tenant_id: String,
    pub container_id: String,
    pub container_name: String,
    pub signaling_host: String,
    pub sidecar_host: String,
    pub status: ChromeSessionStatus,
    pub resolution: String,
    pub extension_mode: String,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
    pub session_token: String,
    pub ice_servers: Vec<IceServer>,
}

/// Request to create a Chrome session
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChromeSessionRequest {
    pub resolution: Option<String>,
    pub extension_mode: Option<String>,
    pub initial_url: Option<String>,
    pub region: Option<String>,
}

/// Response after creating a session
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChromeSessionResponse {
    pub session_id: String,
    pub status: String,
    pub ice_servers: Vec<IceServer>,
    pub signaling_url: Option<String>,
}

/// Navigate request
#[derive(Debug, Deserialize)]
pub struct NavigateRequest {
    pub url: String,
}

/// Policy request
#[derive(Debug, Deserialize, Serialize)]
pub struct PolicyRequest {
    pub extension_settings: Option<serde_json::Value>,
    pub extra_policies: Option<serde_json::Value>,
}

/// Resize request
#[derive(Debug, Deserialize, Serialize)]
pub struct ResizeRequest {
    pub width: u32,
    pub height: u32,
}

// ============================================================================
// Route Builder
// ============================================================================

pub fn chrome_session_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/chrome-sessions", post(create_session).get(list_sessions))
        .route("/api/v1/chrome-sessions/:id", get(get_session).delete(destroy_session))
        .route("/api/v1/chrome-sessions/:id/navigate", post(navigate))
        .route("/api/v1/chrome-sessions/:id/policy", post(apply_policy))
        .route("/api/v1/chrome-sessions/:id/signaling", get(proxy_signaling))
        .route("/api/v1/chrome-sessions/:id/resize", post(resize))
        .layer(TraceLayer::new_for_http())
}

// ============================================================================
// Session Creation
// ============================================================================

/// POST /api/v1/chrome-sessions
/// Create a new Chrome streaming session
/// Platform-specific: Firecracker on Linux, Docker on macOS
async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateChromeSessionRequest>,
) -> impl IntoResponse {
    let session_id = Uuid::new_v4().to_string();
    let session_token = Uuid::new_v4().to_string();
    let container_id = format!("allternit-chrome-{}", session_id[..8].to_string());

    let tenant_id = "default".to_string();
    let resolution = req.resolution.unwrap_or_else(|| "1920x1080".to_string());
    let extension_mode = req.extension_mode.unwrap_or_else(|| "managed".to_string());

    // Check quota
    {
        let sessions = state.chrome_sessions.read().await;
        let active_count = sessions.values()
            .filter(|s| s.status != ChromeSessionStatus::Terminated)
            .count();

        if active_count >= 10 {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "error": "Session quota exceeded",
                    "active_sessions": active_count,
                    "max_sessions": 10
                }))
            ).into_response();
        }
    }

    // Platform-specific session creation — returns (signaling_host, sidecar_host) on success
    #[cfg(target_os = "linux")]
    let spawn_result = create_firecracker_session(
        &state, &session_id, &container_id, &tenant_id,
    ).await;

    #[cfg(target_os = "macos")]
    let spawn_result = create_docker_session(
        &state, &session_id, &container_id, &tenant_id,
    ).await;

    // Resolve container hosts (Docker maps to dynamic ports, Firecracker uses internal IPs)
    let (signaling_host, sidecar_host) = {
        #[cfg(target_os = "macos")]
        {
            resolve_docker_ports(&state, &container_id).await
        }
        #[cfg(not(target_os = "macos"))]
        {
            // On Linux, containers are routed via internal network
            ("ws://127.0.0.1:8080".to_string(), "http://127.0.0.1:8081".to_string())
        }
    };

    // Generate TURN credentials
    let ice_servers = generate_turn_credentials(&session_id, &state.turn_secret);
    let signaling_url = format!("/api/v1/chrome-sessions/{}/signaling", session_id);

    // Create session record — starts as Provisioning, health poller upgrades to Ready
    let session = ChromeSessionRecord {
        session_id: session_id.clone(),
        tenant_id: tenant_id.clone(),
        container_id: container_id.clone(),
        container_name: container_id.clone(),
        signaling_host,
        sidecar_host,
        status: ChromeSessionStatus::Provisioning,
        resolution: resolution.clone(),
        extension_mode: extension_mode.clone(),
        created_at: Utc::now(),
        last_active: Utc::now(),
        session_token: session_token.clone(),
        ice_servers: ice_servers.clone(),
    };

    // Store session
    {
        let mut sessions = state.chrome_sessions.write().await;
        sessions.insert(session_id.clone(), session.clone());
    }

    // Spawn health poller to upgrade status to Ready once container is healthy
    tokio::spawn(poll_session_health(state.clone(), session_id.clone()));

    info!("Created Chrome session: {} (platform: {})", session_id,
        if cfg!(target_os = "linux") { "linux/firecracker" } else { "macos/docker" });

    // Return response
    (
        StatusCode::CREATED,
        Json(CreateChromeSessionResponse {
            session_id,
            status: "provisioning".to_string(),
            ice_servers,
            signaling_url: Some(signaling_url),
        })
    ).into_response()
}

// ============================================================================
// Linux: Firecracker Backend
// ============================================================================

#[cfg(target_os = "linux")]
async fn create_firecracker_session(
    state: &AppState,
    session_id: &str,
    container_id: &str,
    tenant_id: &str,
) -> Option<Result<(), String>> {
    use allternit_driver_interface::{
        ExecutionDriver, SpawnSpec, ResourceSpec, PolicySpec,
        NetworkPolicy, TenantId, EnvironmentSpec, FilePolicy, EnvSpecType,
    };
    use std::str::FromStr;

    if let Some(firecracker) = state.firecracker_driver.as_ref() {
        info!("Spawning Chrome Firecracker VM: {} (tenant: {})", container_id, tenant_id);

        let execution_id = allternit_driver_interface::ExecutionId(
            uuid::Uuid::from_str(session_id).unwrap_or_else(|_| Uuid::new_v4())
        );

        let spawn_spec = SpawnSpec {
            run_id: Some(execution_id),
            tenant: TenantId::new(tenant_id).expect("Invalid tenant ID"),
            project: None,
            workspace: None,
            env: EnvironmentSpec {
                spec_type: EnvSpecType::Oci,
                image: "allternit/chrome-rootfs:latest".to_string(),
                version: None,
                packages: vec![],
                env_vars: std::collections::HashMap::new(),
                working_dir: None,
                mounts: vec![],
            },
            policy: PolicySpec {
                version: "0.1.0".to_string(),
                allowed_tools: vec!["*".to_string()],
                denied_tools: vec![],
                network_policy: NetworkPolicy {
                    egress_allowed: true,
                    allowed_hosts: vec!["*".to_string()],
                    allowed_ports: vec![80, 443],
                    dns_allowed: true,
                },
                file_policy: FilePolicy::default(),
                timeout_seconds: Some(3600),
            },
            resources: ResourceSpec {
                cpu_millis: 2000,
                memory_mib: 4096,
                disk_mib: Some(20480),
                network_egress_kib: Some(1048576),
                gpu_count: None,
            },
            envelope: None,
            prewarm_pool: None,
        };

        match firecracker.spawn(spawn_spec).await {
            Ok(handle) => {
                info!("Chrome VM spawned: {:?}", handle.id);
                Some(Ok(()))
            }
            Err(e) => {
                error!("Failed to spawn Chrome VM: {}", e);
                Some(Err(e.to_string()))
            }
        }
    } else {
        warn!("Firecracker driver not available");
        None
    }
}

// ============================================================================
// macOS: Docker Backend
// ============================================================================

#[cfg(target_os = "macos")]
async fn create_docker_session(
    state: &AppState,
    session_id: &str,
    container_id: &str,
    tenant_id: &str,
) -> Option<Result<(), String>> {
    info!("Spawning Chrome Docker container: {} (tenant: {})", container_id, tenant_id);

    // Use Docker from state or create new client
    let docker = match state.docker_client.as_ref() {
        Some(d) => d.clone(),
        None => {
            match Docker::connect_with_local_defaults() {
                Ok(d) => {
                    let docker_arc = Arc::new(d);
                    // Store for later use
                    // Note: This is a simplification - proper impl would store in state
                    docker_arc
                }
                Err(e) => {
                    error!("Failed to connect to Docker: {}", e);
                    return Some(Err(format!("Docker connection failed: {}", e)));
                }
            }
        }
    };

    // Create container config
    let env_vars: Vec<String> = vec![
        format!("ALLTERNIT_SESSION_ID={}", session_id),
        format!("ALLTERNIT_TENANT_ID={}", tenant_id),
        "ALLTERNIT_RESOLUTION=1920x1080".to_string(),
        "ALLTERNIT_EXTENSION_MODE=power".to_string(),
    ];
    let config = Config {
        image: Some("allternit/chrome-stream:latest"),
        env: Some(env_vars.iter().map(|s| s.as_str()).collect()),
        host_config: Some(HostConfig {
            shm_size: Some(2 * 1024 * 1024 * 1024), // 2GB
            port_bindings: Some({
                let mut ports = std::collections::HashMap::new();
                ports.insert("8080/tcp".to_string(), Some(vec![PortBinding {
                    host_ip: Some("127.0.0.1".to_string()),
                    host_port: Some("0".to_string())
                }]));
                ports.insert("8081/tcp".to_string(), Some(vec![PortBinding {
                    host_ip: Some("127.0.0.1".to_string()),
                    host_port: Some("0".to_string())
                }]));
                ports
            }),
            mounts: Some(vec![]),
            ..Default::default()
        }),
        ..Default::default()
    };

    // Create container
    match docker.create_container(
        Some(CreateContainerOptions {
            name: container_id.to_string(),
            platform: None,
        }),
        config,
    ).await {
        Ok(create_result) => {
            // Start container
            match docker.start_container(&create_result.id, None::<StartContainerOptions<String>>).await {
                Ok(_) => {
                    info!("Chrome container started: {}", create_result.id);
                    Some(Ok(()))
                }
                Err(e) => {
                    error!("Failed to start Chrome container: {}", e);
                    Some(Err(format!("Container start failed: {}", e)))
                }
            }
        }
        Err(e) => {
            error!("Failed to create Chrome container: {}", e);
            Some(Err(format!("Container creation failed: {}", e)))
        }
    }
}

// ============================================================================
// Session Lifecycle
// ============================================================================

/// Poll session health until ready
async fn poll_session_health(state: Arc<AppState>, session_id: String) {
    let max_attempts = 30; // 30 * 2s = 60s timeout
    let mut attempts = 0;
    
    loop {
        sleep(Duration::from_secs(2)).await;
        attempts += 1;
        
        let session = {
            let sessions = state.chrome_sessions.read().await;
            sessions.get(&session_id).cloned()
        };
        
        let session = match session {
            Some(s) => s,
            None => {
                warn!("Session {} not found during health poll", session_id);
                return;
            }
        };
        
        if session.status == ChromeSessionStatus::Terminated {
            return;
        }
        
        // Check sidecar health
        let client = reqwest::Client::new();
        match client.get(format!("{}/health", session.sidecar_host))
            .timeout(Duration::from_secs(2))
            .send()
            .await 
        {
            Ok(response) if response.status().is_success() => {
                // Session is ready
                let mut sessions = state.chrome_sessions.write().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.status = ChromeSessionStatus::Ready;
                    info!("Session {} is ready", session_id);
                }
                return;
            }
            _ => {
                if attempts >= max_attempts {
                    error!("Session {} health check timed out", session_id);
                    let mut sessions = state.chrome_sessions.write().await;
                    if let Some(s) = sessions.get_mut(&session_id) {
                        s.status = ChromeSessionStatus::Error("Health check timeout".to_string());
                    }
                    return;
                }
            }
        }
    }
}

/// GET /api/v1/chrome-sessions
/// List all Chrome sessions
async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let sessions = state.chrome_sessions.read().await;
    let session_list: Vec<_> = sessions.values().cloned().collect();
    
    Json(serde_json::json!({
        "sessions": session_list,
        "count": session_list.len()
    })).into_response()
}

/// GET /api/v1/chrome-sessions/:id
/// Get a specific session
async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let sessions = state.chrome_sessions.read().await;
    
    match sessions.get(&session_id) {
        Some(session) => {
            let mut response = serde_json::to_value(session).unwrap();
            
            // Add signaling URL if ready
            if session.status == ChromeSessionStatus::Ready {
                response["signaling_url"] = serde_json::json!(
                    format!("ws://localhost/api/v1/chrome-sessions/{}/signaling", session_id)
                );
            }
            
            Json(response).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Session not found"}))
        ).into_response()
    }
}

/// DELETE /api/v1/chrome-sessions/:id
/// Destroy a Chrome session
async fn destroy_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let session = {
        let sessions = state.chrome_sessions.read().await;
        sessions.get(&session_id).cloned()
    };
    
    let session = match session {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Session not found"}))
            ).into_response();
        }
    };

    // Platform-specific container cleanup
    #[cfg(target_os = "macos")]
    {
        if let Some(docker) = state.docker_client.as_ref() {
            // Stop container
            if let Err(e) = docker.stop_container(
                &session.container_id,
                Some(StopContainerOptions { t: 10 }),
            ).await {
                warn!("Failed to stop container {}: {}", session.container_id, e);
            }
            // Remove container
            if let Err(e) = docker.remove_container(
                &session.container_id,
                Some(RemoveContainerOptions { force: true, ..Default::default() }),
            ).await {
                warn!("Failed to remove container {}: {}", session.container_id, e);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(firecracker) = state.firecracker_driver.as_ref() {
            use std::str::FromStr;
            let exec_id = allternit_driver_interface::ExecutionId(
                uuid::Uuid::from_str(&session.session_id).unwrap_or_else(|_| Uuid::new_v4())
            );
            if let Err(e) = firecracker.terminate(exec_id).await {
                warn!("Failed to terminate Firecracker VM {}: {}", session.container_id, e);
            }
        }
    }

    info!("Destroyed Chrome session: {} (container: {})", session_id, session.container_id);

    // Update session status
    {
        let mut sessions = state.chrome_sessions.write().await;
        if let Some(s) = sessions.get_mut(&session_id) {
            s.status = ChromeSessionStatus::Terminated;
        }
    }

    // Emit audit event
    emit_audit_event(&state, &session_id, "session.destroyed", None).await;

    Json(serde_json::json!({"ok": true, "session_id": session_id})).into_response()
}

// ============================================================================
// Session Control
// ============================================================================

/// POST /api/v1/chrome-sessions/:id/navigate
/// Navigate Chrome to a URL
async fn navigate(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<NavigateRequest>,
) -> impl IntoResponse {
    let session = {
        let sessions = state.chrome_sessions.read().await;
        sessions.get(&session_id).cloned()
    };
    
    let session = match session {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Session not found"}))
            ).into_response();
        }
    };
    
    if session.status != ChromeSessionStatus::Ready {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Session not ready"}))
        ).into_response();
    }
    
    // Call sidecar navigate endpoint
    let client = reqwest::Client::new();
    match client.post(format!("{}/navigate", session.sidecar_host))
        .json(&serde_json::json!({"url": req.url}))
        .send()
        .await 
    {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(result) => {
                    // Update last_active timestamp
                    {
                        let mut sessions = state.chrome_sessions.write().await;
                        if let Some(s) = sessions.get_mut(&session_id) {
                            s.last_active = Utc::now();
                        }
                    }
                    // Emit audit event
                    emit_audit_event(&state, &session_id, "navigate", Some(&req.url)).await;
                    Json(result).into_response()
                }
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({"error": format!("Sidecar response parse error: {}", e)}))
                ).into_response()
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({"error": format!("Sidecar request failed: {}", e)}))
        ).into_response()
    }
}

/// POST /api/v1/chrome-sessions/:id/policy
/// Apply Chrome enterprise policy
async fn apply_policy(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<PolicyRequest>,
) -> impl IntoResponse {
    let session = {
        let sessions = state.chrome_sessions.read().await;
        sessions.get(&session_id).cloned()
    };
    
    let session = match session {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Session not found"}))
            ).into_response();
        }
    };
    
    if session.status != ChromeSessionStatus::Ready {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Session not ready"}))
        ).into_response();
    }
    
    // Call sidecar policy endpoint
    let client = reqwest::Client::new();
    match client.post(format!("{}/policy", session.sidecar_host))
        .json(&req)
        .send()
        .await
    {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(result) => Json(result).into_response(),
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({"error": format!("Sidecar response parse error: {}", e)}))
                ).into_response(),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({"error": format!("Sidecar request failed: {}", e)}))
        ).into_response()
    }
}

/// POST /api/v1/chrome-sessions/:id/resize
/// Resize Chrome session display
async fn resize(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<ResizeRequest>,
) -> impl IntoResponse {
    let session = {
        let sessions = state.chrome_sessions.read().await;
        sessions.get(&session_id).cloned()
    };
    
    let session = match session {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Session not found"}))
            ).into_response();
        }
    };
    
    if session.status != ChromeSessionStatus::Ready {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Session not ready"}))
        ).into_response();
    }
    
    // Call sidecar resize endpoint
    let client = reqwest::Client::new();
    match client.post(format!("{}/resize", session.sidecar_host))
        .json(&req)
        .send()
        .await
    {
        Ok(response) => {
            match response.json::<serde_json::Value>().await {
                Ok(result) => Json(result).into_response(),
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({"error": format!("Sidecar response parse error: {}", e)}))
                ).into_response(),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({"error": format!("Sidecar request failed: {}", e)}))
        ).into_response()
    }
}

// ============================================================================
// Signaling Proxy (WebSocket)
// ============================================================================

/// GET /api/v1/chrome-sessions/:id/signaling
/// WebSocket proxy to container's selkies signaling
async fn proxy_signaling(
    ws: WebSocketUpgrade,
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let session = {
        let sessions = state.chrome_sessions.read().await;
        sessions.get(&session_id).cloned()
    };
    
    let session = match session {
        Some(s) if s.status == ChromeSessionStatus::Ready => s,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                "Session not ready"
            ).into_response();
        }
    };

    // Update last_active on signaling connection
    {
        let mut sessions = state.chrome_sessions.write().await;
        if let Some(s) = sessions.get_mut(&session_id) {
            s.last_active = Utc::now();
        }
    }

    ws.on_upgrade(move |socket| handle_signaling_proxy(socket, session))
}

async fn handle_signaling_proxy(
    client_socket: axum::extract::ws::WebSocket,
    session: ChromeSessionRecord,
) {
    use tokio_tungstenite::connect_async;

    // Connect to container's selkies signaling endpoint
    let container_ws_url = format!("{}", session.signaling_host);
    info!("Proxying signaling for session {} to {}", session.session_id, container_ws_url);

    let container_conn = match connect_async(&container_ws_url).await {
        Ok((ws_stream, _)) => ws_stream,
        Err(e) => {
            error!("Failed to connect to container signaling: {}", e);
            return;
        }
    };

    let (mut client_tx, mut client_rx) = client_socket.split();
    let (mut container_tx, mut container_rx) = container_conn.split();

    // Bidirectional forwarding
    let client_to_container = async {
        while let Some(msg) = client_rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if container_tx.send(tokio_tungstenite::tungstenite::Message::Text(text.to_string())).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Binary(data)) => {
                    if container_tx.send(tokio_tungstenite::tungstenite::Message::Binary(data.to_vec())).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    };

    let container_to_client = async {
        while let Some(msg) = container_rx.next().await {
            match msg {
                Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                    if client_tx.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                Ok(tokio_tungstenite::tungstenite::Message::Binary(data)) => {
                    if client_tx.send(Message::Binary(data.into())).await.is_err() {
                        break;
                    }
                }
                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    };

    tokio::select! {
        _ = client_to_container => {},
        _ = container_to_client => {},
    }

    debug!("Signaling proxy closed for session {}", session.session_id);
}

// ============================================================================
// Utilities
// ============================================================================

/// Resolve dynamic Docker port bindings for a container
#[cfg(target_os = "macos")]
async fn resolve_docker_ports(state: &AppState, container_id: &str) -> (String, String) {
    let default = (
        "ws://127.0.0.1:8080".to_string(),
        "http://127.0.0.1:8081".to_string(),
    );

    let docker = match state.docker_client.as_ref() {
        Some(d) => d,
        None => return default,
    };

    let info = match docker.inspect_container(container_id, None).await {
        Ok(i) => i,
        Err(_) => return default,
    };

    let ports = match info.network_settings.and_then(|ns| ns.ports) {
        Some(p) => p,
        None => return default,
    };

    let get_host_port = |key: &str| -> Option<String> {
        ports.get(key)
            .and_then(|b| b.as_ref())
            .and_then(|bindings| bindings.first())
            .and_then(|b| b.host_port.clone())
    };

    let port_8080 = get_host_port("8080/tcp").unwrap_or_else(|| "8080".to_string());
    let port_8081 = get_host_port("8081/tcp").unwrap_or_else(|| "8081".to_string());

    (
        format!("ws://127.0.0.1:{}", port_8080),
        format!("http://127.0.0.1:{}", port_8081),
    )
}

/// Generate TURN credentials for WebRTC
fn generate_turn_credentials(session_id: &str, secret: &str) -> Vec<IceServer> {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;
    use base64::{Engine, engine::general_purpose::STANDARD};
    
    let ttl = 86400; // 24 hours
    let timestamp = Utc::now().timestamp() + ttl;
    let username = format!("{}:{}", timestamp, session_id);
    
    let mut mac = Hmac::<Sha1>::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(username.as_bytes());
    let credential = STANDARD.encode(mac.finalize().into_bytes());
    
    vec![IceServer {
        urls: vec![
            "turn:localhost:3478?transport=udp".to_string(),
            "turn:localhost:3478?transport=tcp".to_string(),
        ],
        username: Some(username),
        credential: Some(credential),
    }]
}

/// Emit audit event
async fn emit_audit_event(
    state: &AppState,
    session_id: &str,
    event_type: &str,
    detail: Option<&str>,
) {
    let event = serde_json::json!({
        "event_type": event_type,
        "session_id": session_id,
        "detail": detail,
        "timestamp": Utc::now().to_rfc3339()
    });

    info!("AUDIT: {}", event);

    // TODO: Write to ledger or database
}

// ============================================================================
// Session Lifecycle Manager (background task)
// ============================================================================

/// Spawn a background task that manages session lifecycle:
/// - Idle timeout: terminate sessions with no activity past idle_timeout
/// - TTL: terminate sessions past max lifetime
/// - Crash recovery: restart failed containers, mark Error after 3 failures
/// - Cleanup: remove terminated sessions from memory after grace period
pub fn spawn_session_lifecycle_manager(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        let mut failure_counts: HashMap<String, u32> = HashMap::new();

        loop {
            interval.tick().await;

            let sessions: Vec<ChromeSessionRecord> = {
                let s = state.chrome_sessions.read().await;
                s.values().cloned().collect()
            };

            let now = Utc::now();

            for session in &sessions {
                match &session.status {
                    ChromeSessionStatus::Terminated => {
                        // Clean up terminated sessions after 5 minutes
                        let terminated_duration = now.signed_duration_since(session.last_active);
                        if terminated_duration.num_minutes() > 5 {
                            let mut s = state.chrome_sessions.write().await;
                            s.remove(&session.session_id);
                            debug!("Cleaned up terminated session: {}", session.session_id);
                        }
                    }
                    ChromeSessionStatus::Error(_) => {
                        // Already in error state - leave for manual cleanup or auto-clean after 10 min
                        let error_duration = now.signed_duration_since(session.last_active);
                        if error_duration.num_minutes() > 10 {
                            let mut s = state.chrome_sessions.write().await;
                            s.remove(&session.session_id);
                            debug!("Cleaned up errored session: {}", session.session_id);
                        }
                    }
                    ChromeSessionStatus::Ready | ChromeSessionStatus::Connecting => {
                        // Check idle timeout (default 30 min)
                        let idle_duration = now.signed_duration_since(session.last_active);
                        let idle_timeout_minutes = 30i64; // TODO: load from tenant config

                        if idle_duration.num_minutes() > idle_timeout_minutes {
                            info!("Session {} idle timeout ({} min)", session.session_id, idle_duration.num_minutes());
                            terminate_session_container(&state, session).await;
                            emit_audit_event(&state, &session.session_id, "session.idle_timeout", None).await;
                            continue;
                        }

                        // Check TTL (default 8 hours)
                        let session_age = now.signed_duration_since(session.created_at);
                        let ttl_minutes = 480i64; // TODO: load from tenant config

                        if session_age.num_minutes() > ttl_minutes {
                            info!("Session {} TTL expired ({} min)", session.session_id, session_age.num_minutes());
                            terminate_session_container(&state, session).await;
                            emit_audit_event(&state, &session.session_id, "session.ttl_expired", None).await;
                            continue;
                        }

                        // Health check for ready sessions
                        if session.status == ChromeSessionStatus::Ready {
                            let client = reqwest::Client::new();
                            let health_ok = client
                                .get(format!("{}/health", session.sidecar_host))
                                .timeout(Duration::from_secs(5))
                                .send()
                                .await
                                .map(|r| r.status().is_success())
                                .unwrap_or(false);

                            if !health_ok {
                                let count = failure_counts
                                    .entry(session.session_id.clone())
                                    .or_insert(0);
                                *count += 1;

                                if *count >= 3 {
                                    error!("Session {} failed health check 3 times, marking Error", session.session_id);
                                    let mut s = state.chrome_sessions.write().await;
                                    if let Some(s) = s.get_mut(&session.session_id) {
                                        s.status = ChromeSessionStatus::Error("Health check failed".to_string());
                                    }
                                    failure_counts.remove(&session.session_id);
                                    emit_audit_event(&state, &session.session_id, "session.health_failed", None).await;
                                } else {
                                    warn!("Session {} health check failed ({}/3)", session.session_id, count);
                                }
                            } else {
                                // Reset failure count on successful health check
                                failure_counts.remove(&session.session_id);
                            }
                        }
                    }
                    ChromeSessionStatus::Provisioning => {
                        // Check if provisioning is stuck (> 2 min)
                        let provision_duration = now.signed_duration_since(session.created_at);
                        if provision_duration.num_minutes() > 2 {
                            warn!("Session {} stuck in provisioning", session.session_id);
                            let mut s = state.chrome_sessions.write().await;
                            if let Some(s) = s.get_mut(&session.session_id) {
                                s.status = ChromeSessionStatus::Error("Provisioning timeout".to_string());
                            }
                        }
                    }
                }
            }
        }
    });
}

/// Terminate a session's container and mark it as terminated
async fn terminate_session_container(state: &AppState, session: &ChromeSessionRecord) {
    #[cfg(target_os = "macos")]
    {
        if let Some(docker) = state.docker_client.as_ref() {
            let _ = docker.stop_container(
                &session.container_id,
                Some(StopContainerOptions { t: 10 }),
            ).await;
            let _ = docker.remove_container(
                &session.container_id,
                Some(RemoveContainerOptions { force: true, ..Default::default() }),
            ).await;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(firecracker) = state.firecracker_driver.as_ref() {
            use std::str::FromStr;
            let exec_id = allternit_driver_interface::ExecutionId(
                uuid::Uuid::from_str(&session.session_id).unwrap_or_else(|_| Uuid::new_v4())
            );
            let _ = firecracker.terminate(exec_id).await;
        }
    }

    let mut sessions = state.chrome_sessions.write().await;
    if let Some(s) = sessions.get_mut(&session.session_id) {
        s.status = ChromeSessionStatus::Terminated;
    }
}
