use axum::extract::{
    ws::{Message, WebSocket, WebSocketUpgrade},
    State,
};
use axum::response::IntoResponse;
use chrono::{Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, SeekFrom},
};
use uuid::Uuid;

use a2r_openclaw_host::final_integration_verification::{
    IntegrationVerificationOperation, IntegrationVerificationRequest,
};
use a2r_openclaw_host::native_channel_abstraction_native::{
    ChannelAbstractionRequest, ChannelId, ChannelOperation,
};
use a2r_openclaw_host::native_cron_system::{
    CronJobDefinition, CronJobExecutionRequest, CronJobId, CronJobManagementRequest,
    CronJobOperation,
};
use a2r_openclaw_host::native_provider_management::{ProviderManagementRequest, ProviderOperation};
use a2r_openclaw_host::native_session_manager::{SessionId, SessionMessage};
use a2r_openclaw_host::skill_installer_service::{
    InstallSkillRequest, ListSkillsRequest, UninstallSkillRequest,
};

use crate::{count_active_services, ServiceState};

const PROTOCOL_VERSION: u64 = 3;
const DEFAULT_MAX_LOG_BYTES: u64 = 2_000_000;
const MAX_LOG_BYTES_LIMIT: u64 = 20_000_000;

#[derive(Debug, Deserialize)]
struct GatewayReqFrame {
    #[serde(rename = "type")]
    frame_type: String,
    id: String,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct GatewayResFrame {
    #[serde(rename = "type")]
    frame_type: &'static str,
    id: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<GatewayErrorFrame>,
}

#[derive(Debug, Serialize)]
struct GatewayEventFrame {
    #[serde(rename = "type")]
    frame_type: &'static str,
    event: String,
    payload: Value,
    seq: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    state_version: Option<u64>,
}

#[derive(Debug, Serialize)]
struct GatewayErrorFrame {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    retryable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    retry_after_ms: Option<u64>,
}

#[derive(Debug, Clone)]
struct GatewayRuntimeState {
    authenticated: bool,
    role: String,
    scopes: Vec<String>,
    seq: u64,
    last_heartbeat_ms: Option<i64>,
    session_key_map: HashMap<String, SessionId>,
}

impl Default for GatewayRuntimeState {
    fn default() -> Self {
        Self {
            authenticated: false,
            role: "operator".to_string(),
            scopes: vec![
                "operator.admin".to_string(),
                "operator.approvals".to_string(),
                "operator.pairing".to_string(),
            ],
            seq: 0,
            last_heartbeat_ms: None,
            session_key_map: HashMap::new(),
        }
    }
}

#[derive(Debug)]
struct GatewayMethodError {
    code: String,
    message: String,
    details: Option<Value>,
    retryable: Option<bool>,
    retry_after_ms: Option<u64>,
}

impl GatewayMethodError {
    fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            code: "UNAUTHORIZED".to_string(),
            message: message.into(),
            details: None,
            retryable: None,
            retry_after_ms: None,
        }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            code: "BAD_REQUEST".to_string(),
            message: message.into(),
            details: None,
            retryable: None,
            retry_after_ms: None,
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            code: "NOT_FOUND".to_string(),
            message: message.into(),
            details: None,
            retryable: None,
            retry_after_ms: None,
        }
    }

    fn method_not_available(method: &str) -> Self {
        Self {
            code: "METHOD_NOT_AVAILABLE".to_string(),
            message: format!("Method is not available on native backend yet: {}", method),
            details: Some(json!({ "method": method })),
            retryable: None,
            retry_after_ms: None,
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            code: "INTERNAL_ERROR".to_string(),
            message: message.into(),
            details: None,
            retryable: None,
            retry_after_ms: None,
        }
    }
}

fn extract_string(value: &Value, pointer: &str) -> Option<String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|raw| !raw.is_empty())
        .map(ToOwned::to_owned)
}

fn extract_string_array(value: &Value, pointer: &str) -> Option<Vec<String>> {
    value
        .pointer(pointer)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
}

fn parse_limit(value: &Value, pointer: &str, fallback: usize) -> usize {
    value
        .pointer(pointer)
        .and_then(Value::as_u64)
        .map(|v| v as usize)
        .filter(|v| *v > 0)
        .unwrap_or(fallback)
}

fn resolve_project_root() -> PathBuf {
    let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for ancestor in current.ancestors() {
        let has_openclaw_env = ancestor.join(".openclaw.env").exists();
        let has_workspace_shape = ancestor.join("Cargo.toml").exists()
            && ancestor.join("1-kernel").exists()
            && ancestor.join("6-ui").exists();
        if has_openclaw_env || has_workspace_shape {
            return ancestor.to_path_buf();
        }
    }
    current
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

fn sanitize_file_component(raw: &str) -> String {
    let mut cleaned = String::with_capacity(raw.len());
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
            cleaned.push(ch);
        } else {
            cleaned.push('_');
        }
    }
    let normalized = cleaned.trim_matches('_');
    if normalized.is_empty() {
        "default".to_string()
    } else {
        normalized.to_string()
    }
}

fn approvals_dir(root: &Path) -> PathBuf {
    root.join("auth-profiles")
}

fn gateway_approvals_path(root: &Path) -> PathBuf {
    approvals_dir(root).join("exec-approvals.gateway.json")
}

fn node_approvals_path(root: &Path, node_id: &str) -> PathBuf {
    let safe = sanitize_file_component(node_id);
    approvals_dir(root).join(format!("exec-approvals.node.{}.json", safe))
}

fn skill_api_keys_path(root: &Path) -> PathBuf {
    approvals_dir(root).join("skill-api-keys.json")
}

fn runtime_config_path(root: &Path) -> PathBuf {
    approvals_dir(root).join("openclaw-runtime-config.json")
}

fn default_exec_approvals() -> Value {
    json!({
        "schemaVersion": 1,
        "mode": "confirm",
        "allow": [],
        "deny": [],
        "requireReason": true,
    })
}

async fn read_json_file(path: &Path) -> Result<Value, GatewayMethodError> {
    let content = fs::read_to_string(path).await.map_err(|e| {
        GatewayMethodError::internal(format!("Failed to read {}: {}", path.display(), e))
    })?;
    serde_json::from_str::<Value>(&content).map_err(|e| {
        GatewayMethodError::internal(format!("Failed to parse {} as JSON: {}", path.display(), e))
    })
}

async fn write_json_file(path: &Path, value: &Value) -> Result<(), GatewayMethodError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|e| {
            GatewayMethodError::internal(format!(
                "Failed to create directory {}: {}",
                parent.display(),
                e
            ))
        })?;
    }

    let content = serde_json::to_string_pretty(value)
        .map_err(|e| GatewayMethodError::internal(format!("Failed to serialize JSON: {}", e)))?;
    let temp_path = path.with_extension(format!("{}.tmp", Uuid::new_v4().simple()));

    fs::write(&temp_path, content).await.map_err(|e| {
        GatewayMethodError::internal(format!(
            "Failed to write temporary config {}: {}",
            temp_path.display(),
            e
        ))
    })?;

    fs::rename(&temp_path, path).await.map_err(|e| {
        GatewayMethodError::internal(format!("Failed to replace {}: {}", path.display(), e))
    })?;

    Ok(())
}

fn extract_bool(value: &Value, pointer: &str) -> Option<bool> {
    value.pointer(pointer).and_then(Value::as_bool)
}

fn extract_u64(value: &Value, pointer: &str) -> Option<u64> {
    value.pointer(pointer).and_then(Value::as_u64)
}

fn extract_usize(value: &Value, pointer: &str) -> Option<usize> {
    value
        .pointer(pointer)
        .and_then(Value::as_u64)
        .map(|v| v as usize)
}

fn extract_string_vec(value: &Value, pointer: &str) -> Option<Vec<String>> {
    value
        .pointer(pointer)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
}

fn default_log_candidates(root: &Path) -> Vec<PathBuf> {
    vec![
        root.join("a2rchitech.jsonl"),
        root.join(".logs").join("openclaw-host.log"),
        root.join("kernel_bin.log"),
        root.join("kernel_run.log"),
        root.join("target")
            .join("debug")
            .join("a2r-openclaw-host.log"),
    ]
}

fn resolve_log_file(root: &Path, requested: Option<String>) -> Result<PathBuf, GatewayMethodError> {
    if let Some(raw) = requested {
        let requested_path = PathBuf::from(raw);
        let candidate = if requested_path.is_absolute() {
            requested_path
        } else {
            root.join(requested_path)
        };

        if !candidate.exists() {
            return Err(GatewayMethodError::bad_request(format!(
                "Log file does not exist: {}",
                candidate.display()
            )));
        }

        let root_canonical = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        let file_canonical = candidate.canonicalize().map_err(|e| {
            GatewayMethodError::internal(format!(
                "Failed to resolve log file {}: {}",
                candidate.display(),
                e
            ))
        })?;

        if !(file_canonical.starts_with(&root_canonical)
            || file_canonical.starts_with(Path::new("/tmp")))
        {
            return Err(GatewayMethodError::bad_request(format!(
                "Log file must be inside project root or /tmp: {}",
                file_canonical.display()
            )));
        }

        return Ok(file_canonical);
    }

    for candidate in default_log_candidates(root) {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(GatewayMethodError::not_found(
        "No log file found. Configure one with logs.tail { file: ... } or set A2R_OPENCLAW_LOG_FILE.",
    ))
}

fn make_error_frame(error: GatewayMethodError) -> GatewayErrorFrame {
    GatewayErrorFrame {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        retry_after_ms: error.retry_after_ms,
    }
}

async fn send_response_frame(
    socket: &mut WebSocket,
    id: String,
    result: Result<Value, GatewayMethodError>,
) {
    let frame = match result {
        Ok(payload) => GatewayResFrame {
            frame_type: "res",
            id,
            ok: true,
            payload: Some(payload),
            error: None,
        },
        Err(error) => GatewayResFrame {
            frame_type: "res",
            id,
            ok: false,
            payload: None,
            error: Some(make_error_frame(error)),
        },
    };

    if let Ok(serialized) = serde_json::to_string(&frame) {
        let _ = socket.send(Message::Text(serialized)).await;
    }
}

async fn send_event_frame(
    socket: &mut WebSocket,
    runtime: &mut GatewayRuntimeState,
    event: &str,
    payload: Value,
) {
    runtime.seq += 1;
    let frame = GatewayEventFrame {
        frame_type: "event",
        event: event.to_string(),
        payload,
        seq: runtime.seq,
        state_version: None,
    };
    if let Ok(serialized) = serde_json::to_string(&frame) {
        let _ = socket.send(Message::Text(serialized)).await;
    }
}

async fn resolve_or_create_session_id(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    session_key: &str,
) -> Result<SessionId, GatewayMethodError> {
    if let Some(existing) = runtime.session_key_map.get(session_key) {
        return Ok(existing.clone());
    }

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let mut manager = session_manager.lock().await;
    let created = manager
        .create_session(
            Some(session_key.to_string()),
            Some("Control UI session".to_string()),
        )
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to create session: {}", e)))?;

    runtime
        .session_key_map
        .insert(session_key.to_string(), created.id.clone());
    Ok(created.id)
}

async fn handle_connect(
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let client_id = extract_string(params, "/client/id")
        .ok_or_else(|| GatewayMethodError::bad_request("Missing connect.params.client.id"))?;

    if client_id != "openclaw-control-ui" {
        return Err(GatewayMethodError::bad_request(format!(
            "invalid connect params: client.id must be openclaw-control-ui (got {})",
            client_id
        )));
    }

    let min_protocol = params
        .pointer("/minProtocol")
        .and_then(Value::as_u64)
        .unwrap_or(PROTOCOL_VERSION);
    let max_protocol = params
        .pointer("/maxProtocol")
        .and_then(Value::as_u64)
        .unwrap_or(PROTOCOL_VERSION);

    if min_protocol > PROTOCOL_VERSION || max_protocol < PROTOCOL_VERSION {
        return Err(GatewayMethodError::bad_request(format!(
            "Unsupported protocol range [{}, {}], required {}",
            min_protocol, max_protocol, PROTOCOL_VERSION
        )));
    }

    let provided_token = extract_string(params, "/auth/token");
    let provided_password = extract_string(params, "/auth/password");
    let expected_token = std::env::var("OPENCLAW_GATEWAY_TOKEN")
        .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    if let Some(expected) = expected_token {
        let token_ok = provided_token
            .as_ref()
            .map(|token| token == &expected)
            .unwrap_or(false);
        let password_ok = provided_password
            .as_ref()
            .map(|password| password == &expected)
            .unwrap_or(false);

        if !(token_ok || password_ok) {
            return Err(GatewayMethodError::unauthorized(
                "Invalid token/password for connect",
            ));
        }
    }

    let role = extract_string(params, "/role").unwrap_or_else(|| "operator".to_string());
    let scopes = extract_string_array(params, "/scopes").unwrap_or_else(|| {
        vec![
            "operator.admin".to_string(),
            "operator.approvals".to_string(),
            "operator.pairing".to_string(),
        ]
    });

    runtime.authenticated = true;
    runtime.role = role.clone();
    runtime.scopes = scopes.clone();
    runtime.last_heartbeat_ms = Some(Utc::now().timestamp_millis());

    Ok(json!({
        "type": "hello",
        "protocol": PROTOCOL_VERSION,
        "auth": {
            "role": role,
            "scopes": scopes,
        },
        "snapshot": {
            "health": {
                "ok": true,
                "status": "healthy",
            },
            "presence": [
                {
                    "nodeId": "a2r-host-local",
                    "mode": "native",
                    "role": "gateway",
                    "status": "online",
                }
            ],
            "ts": Utc::now().timestamp_millis(),
        }
    }))
}

async fn handle_status(
    state: &Arc<ServiceState>,
    runtime: &GatewayRuntimeState,
) -> Result<Value, GatewayMethodError> {
    let active_services = count_active_services(state).await;
    Ok(json!({
        "status": "ok",
        "connected": runtime.authenticated,
        "role": runtime.role,
        "scopes": runtime.scopes,
        "service": {
            "activeServices": active_services,
            "totalServices": 24,
        },
        "ts": Utc::now().timestamp_millis(),
    }))
}

async fn handle_health(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let mut health = json!({
        "ok": true,
        "status": "healthy",
        "ts": Utc::now().timestamp_millis(),
    });

    if let Some(gateway) = state.gateway.as_ref() {
        let mut bridge = gateway.lock().await;
        if let Ok(status) = bridge.health_check().await {
            health = json!({
                "ok": status.healthy,
                "status": status.status,
                "uptime": status.uptime,
                "version": status.version,
                "ts": Utc::now().timestamp_millis(),
            });
        }
    }

    Ok(health)
}

async fn handle_models_list(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let service = state.provider_management.as_ref().ok_or_else(|| {
        GatewayMethodError::internal("Provider management service is unavailable")
    })?;

    let mut manager = service.lock().await;
    let response = manager
        .execute(ProviderManagementRequest {
            operation: ProviderOperation::ListProviders,
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to list providers: {}", e)))?;

    let mut models: Vec<Value> = Vec::new();
    if let Some(result) = response.result {
        if let Some(providers) = result.get("providers").and_then(Value::as_array) {
            for provider in providers {
                let provider_id = provider
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string();
                if let Some(provider_models) = provider.get("models").and_then(Value::as_array) {
                    for model in provider_models {
                        if let Some(model_name) = model.as_str() {
                            models.push(json!({
                                "id": format!("{}/{}", provider_id, model_name),
                                "provider": provider_id,
                                "model": model_name,
                            }));
                        }
                    }
                }
            }
        }
    }

    Ok(json!({ "models": models }))
}

async fn handle_sessions_list(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
) -> Result<Value, GatewayMethodError> {
    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let manager = session_manager.lock().await;
    let sessions = manager
        .list_sessions()
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to list sessions: {}", e)))?;

    let mut payload_sessions: Vec<Value> = Vec::new();
    for session in sessions {
        let key = session
            .name
            .clone()
            .unwrap_or_else(|| session.id.to_string());
        runtime
            .session_key_map
            .insert(key.clone(), session.id.clone());
        payload_sessions.push(json!({
            "key": key,
            "sessionKey": key,
            "id": session.id.to_string(),
            "name": session.name,
            "description": session.description,
            "messageCount": session.message_count,
            "createdAt": session.created_at,
            "updatedAt": session.updated_at,
            "active": session.active,
        }));
    }

    Ok(json!({ "sessions": payload_sessions }))
}

async fn handle_sessions_delete(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let key = extract_string(params, "/key")
        .or_else(|| extract_string(params, "/sessionKey"))
        .ok_or_else(|| {
            GatewayMethodError::bad_request("sessions.delete requires key/sessionKey")
        })?;

    let session_id = runtime
        .session_key_map
        .get(&key)
        .cloned()
        .unwrap_or_else(|| SessionId::new(key.clone()));

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let mut manager = session_manager.lock().await;
    manager
        .delete_session(&session_id)
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to delete session: {}", e)))?;

    runtime.session_key_map.remove(&key);
    Ok(json!({ "status": "deleted", "key": key }))
}

async fn handle_sessions_patch(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let key = extract_string(params, "/key")
        .or_else(|| extract_string(params, "/sessionKey"))
        .ok_or_else(|| GatewayMethodError::bad_request("sessions.patch requires key/sessionKey"))?;

    let session_id = runtime
        .session_key_map
        .get(&key)
        .cloned()
        .unwrap_or_else(|| SessionId::new(key.clone()));

    let label = extract_string(params, "/label")
        .or_else(|| extract_string(params, "/name"))
        .filter(|v| !v.trim().is_empty());
    let description = extract_string(params, "/description").filter(|v| !v.trim().is_empty());
    let active = params.pointer("/active").and_then(Value::as_bool);
    let tags = extract_string_vec(params, "/tags");

    let mut metadata_patch: HashMap<String, Value> = HashMap::new();
    if let Some(v) = extract_string(params, "/thinkingLevel") {
        metadata_patch.insert("thinkingLevel".to_string(), Value::String(v));
    }
    if let Some(v) = extract_string(params, "/verboseLevel") {
        metadata_patch.insert("verboseLevel".to_string(), Value::String(v));
    }
    if let Some(v) = extract_string(params, "/reasoningLevel") {
        metadata_patch.insert("reasoningLevel".to_string(), Value::String(v));
    }
    if let Some(extra) = params.pointer("/metadata").and_then(Value::as_object) {
        for (k, v) in extra {
            metadata_patch.insert(k.clone(), v.clone());
        }
    }
    let metadata = if metadata_patch.is_empty() {
        None
    } else {
        Some(metadata_patch)
    };

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let mut manager = session_manager.lock().await;
    let patched = manager
        .patch_session(
            &session_id,
            label.clone(),
            description,
            active,
            metadata,
            tags,
        )
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to patch session: {}", e)))?;

    if let Some(name) = patched.name.as_ref() {
        runtime
            .session_key_map
            .insert(name.clone(), patched.id.clone());
    }
    runtime
        .session_key_map
        .insert(key.clone(), patched.id.clone());

    Ok(json!({
        "status": "patched",
        "key": key,
        "id": patched.id.to_string(),
        "name": patched.name,
        "description": patched.description,
        "active": patched.active,
        "updatedAt": patched.updated_at,
    }))
}

async fn handle_chat_history(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let session_key = extract_string(params, "/sessionKey").unwrap_or_else(|| "main".to_string());
    let limit = parse_limit(params, "/limit", 200);
    let session_id = resolve_or_create_session_id(state, runtime, &session_key).await?;

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let manager = session_manager.lock().await;
    let messages = manager
        .get_messages(&session_id)
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to read chat history: {}", e)))?;

    let mut payload_messages: Vec<Value> = messages
        .into_iter()
        .map(|msg| {
            json!({
                "id": msg.id,
                "role": msg.role,
                "text": msg.content,
                "timestamp": msg.timestamp.timestamp_millis(),
                "metadata": msg.metadata,
            })
        })
        .collect();

    if payload_messages.len() > limit {
        let keep_from = payload_messages.len().saturating_sub(limit);
        payload_messages = payload_messages.into_iter().skip(keep_from).collect();
    }

    Ok(json!({
        "sessionKey": session_key,
        "messages": payload_messages,
    }))
}

async fn handle_chat_send(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let session_key = extract_string(params, "/sessionKey").unwrap_or_else(|| "main".to_string());
    let message = extract_string(params, "/message")
        .ok_or_else(|| GatewayMethodError::bad_request("chat.send requires message"))?;
    let run_id =
        extract_string(params, "/idempotencyKey").unwrap_or_else(|| Uuid::new_v4().to_string());
    let session_id = resolve_or_create_session_id(state, runtime, &session_key).await?;

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let mut manager = session_manager.lock().await;
    manager
        .add_message(
            &session_id,
            SessionMessage {
                id: Uuid::new_v4().to_string(),
                role: "user".to_string(),
                content: message,
                timestamp: Utc::now(),
                metadata: None,
            },
        )
        .await
        .map_err(|e| {
            GatewayMethodError::internal(format!("Failed to store chat message: {}", e))
        })?;

    runtime.last_heartbeat_ms = Some(Utc::now().timestamp_millis());
    Ok(json!({
        "runId": run_id,
        "status": "started",
        "sessionKey": session_key,
    }))
}

async fn handle_chat_inject(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let session_key = extract_string(params, "/sessionKey").unwrap_or_else(|| "main".to_string());
    let message = extract_string(params, "/message")
        .ok_or_else(|| GatewayMethodError::bad_request("chat.inject requires message"))?;
    let session_id = resolve_or_create_session_id(state, runtime, &session_key).await?;

    let session_manager = state
        .session_manager_native
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Session manager service is unavailable"))?;

    let mut manager = session_manager.lock().await;
    manager
        .add_message(
            &session_id,
            SessionMessage {
                id: Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: message,
                timestamp: Utc::now(),
                metadata: Some(HashMap::from([("injected".to_string(), Value::Bool(true))])),
            },
        )
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to inject message: {}", e)))?;

    runtime.last_heartbeat_ms = Some(Utc::now().timestamp_millis());
    Ok(json!({
        "status": "ok",
        "sessionKey": session_key,
    }))
}

async fn handle_channels_status(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let channel_service = state.channel_abstraction.as_ref().ok_or_else(|| {
        GatewayMethodError::internal("Channel abstraction service is unavailable")
    })?;

    let mut channels = channel_service.lock().await;
    let response = channels
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::ListChannels,
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to list channels: {}", e)))?;

    if response.success {
        Ok(response.result.unwrap_or_else(|| json!({ "channels": [] })))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to list channels".to_string()),
        ))
    }
}

async fn handle_cron_status(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;
    let response = cron
        .execute(CronJobManagementRequest {
            operation: CronJobOperation::GetStatus,
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to get cron status: {}", e)))?;

    if response.success {
        Ok(response.result.unwrap_or_else(|| json!({})))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to get cron status".to_string()),
        ))
    }
}

async fn handle_cron_list(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;
    let response = cron
        .execute(CronJobManagementRequest {
            operation: CronJobOperation::ListJobs,
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to list cron jobs: {}", e)))?;

    if response.success {
        Ok(response.result.unwrap_or_else(|| json!({ "jobs": [] })))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to list cron jobs".to_string()),
        ))
    }
}

async fn handle_cron_runs(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let id = extract_string(params, "/id")
        .ok_or_else(|| GatewayMethodError::bad_request("cron.runs requires id"))?;
    let limit = params
        .pointer("/limit")
        .and_then(Value::as_u64)
        .map(|v| v as usize);
    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;
    let response = cron
        .execute(CronJobManagementRequest {
            operation: CronJobOperation::GetHistory {
                id: CronJobId::new(id),
                limit,
            },
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to fetch cron runs: {}", e)))?;

    if response.success {
        Ok(response.result.unwrap_or_else(|| json!({ "entries": [] })))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to fetch cron runs".to_string()),
        ))
    }
}

async fn handle_skills_status(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let service = state
        .skill_installer
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Skill installer service is unavailable"))?;
    let installer = service.lock().await;
    let response = installer
        .list_skills(ListSkillsRequest {
            category: None,
            search: None,
            include_installed: Some(true),
            include_available: Some(true),
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to list skills: {}", e)))?;

    let skills = response
        .skills
        .into_iter()
        .map(|skill| {
            let enabled = matches!(
                skill.status,
                a2r_openclaw_host::skill_installer_service::SkillStatus::Installed
            );
            json!({
                "skillKey": skill.id,
                "name": skill.name,
                "description": skill.description,
                "version": skill.version,
                "enabled": enabled,
                "status": format!("{:?}", skill.status).to_lowercase(),
                "tags": skill.tags,
                "requires": skill.requires,
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({
        "skills": skills,
        "total": response.total_count,
    }))
}

fn handle_node_list() -> Value {
    json!({
        "nodes": [
            {
                "id": "a2r-host-local",
                "name": "A2R Host Local",
                "caps": ["chat", "sessions", "skills", "cron", "channels"],
                "status": "online",
                "platform": std::env::consts::OS,
                "arch": std::env::consts::ARCH,
            }
        ]
    })
}

async fn read_skill_api_keys(root: &Path) -> Result<HashMap<String, String>, GatewayMethodError> {
    let path = skill_api_keys_path(root);
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let value = read_json_file(&path).await?;
    let mut keys = HashMap::new();
    if let Some(obj) = value.as_object() {
        for (skill, raw) in obj {
            if let Some(key) = raw.as_str() {
                keys.insert(skill.clone(), key.to_string());
            }
        }
    }

    Ok(keys)
}

async fn write_skill_api_keys(
    root: &Path,
    keys: &HashMap<String, String>,
) -> Result<(), GatewayMethodError> {
    let mut obj = serde_json::Map::new();
    for (skill, key) in keys {
        obj.insert(skill.clone(), Value::String(key.clone()));
    }
    write_json_file(&skill_api_keys_path(root), &Value::Object(obj)).await
}

async fn handle_skills_install(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let skill_id = extract_string(params, "/name")
        .or_else(|| extract_string(params, "/skillKey"))
        .ok_or_else(|| GatewayMethodError::bad_request("skills.install requires name"))?;
    let version = extract_string(params, "/version");

    let installer = state
        .skill_installer
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Skill installer service is unavailable"))?;

    let mut service = installer.lock().await;
    let response = service
        .install_skill(InstallSkillRequest {
            skill_id: skill_id.clone(),
            version,
            options: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to install skill: {}", e)))?;

    if response.success {
        Ok(json!({
            "status": "installed",
            "skillKey": skill_id,
            "message": response.message,
        }))
    } else {
        Err(GatewayMethodError::internal(
            response.error.unwrap_or(response.message),
        ))
    }
}

async fn handle_skills_update(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let skill_key = extract_string(params, "/skillKey")
        .or_else(|| extract_string(params, "/name"))
        .ok_or_else(|| GatewayMethodError::bad_request("skills.update requires skillKey"))?;

    let installer = state
        .skill_installer
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Skill installer service is unavailable"))?;
    let mut service = installer.lock().await;

    let mut changes: Vec<String> = Vec::new();

    if let Some(enabled) = params.pointer("/enabled").and_then(Value::as_bool) {
        if enabled {
            let response = service
                .install_skill(InstallSkillRequest {
                    skill_id: skill_key.clone(),
                    version: None,
                    options: None,
                })
                .await
                .map_err(|e| {
                    GatewayMethodError::internal(format!("Failed to enable skill: {}", e))
                })?;

            if !response.success
                && !response
                    .message
                    .to_lowercase()
                    .contains("already installed")
            {
                return Err(GatewayMethodError::internal(
                    response.error.unwrap_or(response.message),
                ));
            }
            changes.push("enabled".to_string());
        } else {
            let response = service
                .uninstall_skill(UninstallSkillRequest {
                    skill_id: skill_key.clone(),
                })
                .await
                .map_err(|e| {
                    GatewayMethodError::internal(format!("Failed to disable skill: {}", e))
                })?;

            if !response.success {
                return Err(GatewayMethodError::internal(
                    response.error.unwrap_or(response.message),
                ));
            }
            changes.push("disabled".to_string());
        }
    }

    if let Some(version) = extract_string(params, "/version") {
        service
            .update_skill(skill_key.clone(), Some(version))
            .await
            .map_err(|e| {
                GatewayMethodError::internal(format!("Failed to update skill version: {}", e))
            })?;
        changes.push("version".to_string());
    }

    if let Some(api_key) = params.pointer("/apiKey").and_then(Value::as_str) {
        let root = resolve_project_root();
        let mut keys = read_skill_api_keys(&root).await?;
        if api_key.trim().is_empty() {
            keys.remove(&skill_key);
        } else {
            keys.insert(skill_key.clone(), api_key.trim().to_string());
        }
        write_skill_api_keys(&root, &keys).await?;
        changes.push("apiKey".to_string());
    }

    if changes.is_empty() {
        return Err(GatewayMethodError::bad_request(
            "skills.update requires one of enabled/version/apiKey",
        ));
    }

    Ok(json!({
        "status": "updated",
        "skillKey": skill_key,
        "changes": changes,
    }))
}

fn cron_schedule_to_expression(schedule: &Value) -> Result<String, GatewayMethodError> {
    let kind = extract_string(schedule, "/kind").unwrap_or_else(|| "cron".to_string());
    match kind.as_str() {
        "cron" => extract_string(schedule, "/expr").ok_or_else(|| {
            GatewayMethodError::bad_request("cron.add schedule.expr is required for kind=cron")
        }),
        "every" => {
            let every_ms = extract_u64(schedule, "/everyMs").ok_or_else(|| {
                GatewayMethodError::bad_request("cron.add schedule.everyMs is required")
            })?;

            if every_ms == 0 {
                return Err(GatewayMethodError::bad_request(
                    "cron.add schedule.everyMs must be > 0",
                ));
            }

            if every_ms % 60_000 == 0 {
                let minutes = (every_ms / 60_000).max(1);
                Ok(format!("*/{} * * * *", minutes))
            } else if every_ms % 1_000 == 0 {
                let seconds = (every_ms / 1_000).max(1);
                Ok(format!("*/{} * * * * *", seconds))
            } else {
                Err(GatewayMethodError::bad_request(
                    "cron.add schedule.everyMs must align to 1s or 1m increments",
                ))
            }
        }
        "at" => {
            let at_ms = extract_u64(schedule, "/atMs").ok_or_else(|| {
                GatewayMethodError::bad_request("cron.add schedule.atMs is required")
            })?;
            let at =
                chrono::DateTime::<Utc>::from_timestamp_millis(at_ms as i64).ok_or_else(|| {
                    GatewayMethodError::bad_request("cron.add schedule.atMs is invalid")
                })?;
            Ok(format!(
                "{} {} {} {} *",
                at.minute(),
                at.hour(),
                at.day(),
                at.month()
            ))
        }
        _ => Err(GatewayMethodError::bad_request(format!(
            "Unsupported cron schedule kind: {}",
            kind
        ))),
    }
}

async fn handle_cron_add(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let name = extract_string(params, "/name")
        .ok_or_else(|| GatewayMethodError::bad_request("cron.add requires name"))?;
    let description = extract_string(params, "/description").unwrap_or_default();
    let schedule_obj = params
        .pointer("/schedule")
        .cloned()
        .ok_or_else(|| GatewayMethodError::bad_request("cron.add requires schedule"))?;
    let schedule_expr = cron_schedule_to_expression(&schedule_obj)?;

    let payload = params
        .pointer("/payload")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let arguments = payload.as_object().map(|obj| {
        obj.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect::<HashMap<String, Value>>()
    });

    let command = payload
        .pointer("/kind")
        .and_then(Value::as_str)
        .unwrap_or("agentTurn")
        .to_string();

    let mut metadata = HashMap::new();
    metadata.insert("request".to_string(), params.clone());
    metadata.insert("schedule".to_string(), schedule_obj);

    let definition = CronJobDefinition {
        id: CronJobId::new(Uuid::new_v4().to_string()),
        name,
        description,
        schedule: schedule_expr,
        command,
        arguments,
        enabled: true,
        metadata: Some(metadata),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        last_run: None,
        next_run: None,
    };

    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;

    let response = cron
        .execute(CronJobManagementRequest {
            operation: CronJobOperation::UpsertJob { definition },
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to add cron job: {}", e)))?;

    if response.success {
        Ok(response
            .result
            .unwrap_or_else(|| json!({"status": "added"})))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to add cron job".to_string()),
        ))
    }
}

async fn handle_cron_update(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let id = extract_string(params, "/id")
        .ok_or_else(|| GatewayMethodError::bad_request("cron.update requires id"))?;
    let patch = params
        .pointer("/patch")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;

    if let Some(enabled) = patch.pointer("/enabled").and_then(Value::as_bool) {
        let operation = if enabled {
            CronJobOperation::EnableJob {
                id: CronJobId::new(id.clone()),
            }
        } else {
            CronJobOperation::DisableJob {
                id: CronJobId::new(id.clone()),
            }
        };

        let response = cron
            .execute(CronJobManagementRequest {
                operation,
                context: None,
            })
            .await
            .map_err(|e| {
                GatewayMethodError::internal(format!("Failed to update cron job: {}", e))
            })?;

        if response.success {
            return Ok(response
                .result
                .unwrap_or_else(|| json!({"status": "updated", "id": id, "enabled": enabled})));
        }

        return Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to update cron job".to_string()),
        ));
    }

    Err(GatewayMethodError::bad_request(
        "cron.update currently supports patch.enabled",
    ))
}

async fn handle_cron_remove(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let id = extract_string(params, "/id")
        .ok_or_else(|| GatewayMethodError::bad_request("cron.remove requires id"))?;

    let cron_system = state
        .cron_system
        .as_ref()
        .ok_or_else(|| GatewayMethodError::internal("Cron system service is unavailable"))?;
    let mut cron = cron_system.lock().await;

    let response = cron
        .execute(CronJobManagementRequest {
            operation: CronJobOperation::RemoveJob {
                id: CronJobId::new(id.clone()),
            },
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to remove cron job: {}", e)))?;

    if response.success {
        Ok(response
            .result
            .unwrap_or_else(|| json!({"status": "removed", "id": id})))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to remove cron job".to_string()),
        ))
    }
}

async fn handle_web_login_start(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let force = extract_bool(params, "/force").unwrap_or(false);
    let channel_id = ChannelId::new("whatsapp".to_string());

    let channel_service = state.channel_abstraction.as_ref().ok_or_else(|| {
        GatewayMethodError::internal("Channel abstraction service is unavailable")
    })?;
    let mut channels = channel_service.lock().await;

    if force {
        let _ = channels
            .execute(ChannelAbstractionRequest {
                operation: ChannelOperation::ToggleChannel {
                    channel_id: channel_id.clone(),
                    enabled: false,
                },
                context: None,
            })
            .await;
    }

    let toggle = channels
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::ToggleChannel {
                channel_id,
                enabled: true,
            },
            context: None,
        })
        .await;

    match toggle {
        Ok(response) if response.success => Ok(json!({
            "connected": false,
            "message": "WhatsApp channel enabled. Native QR pairing is not implemented yet; use existing bridge channel session.",
            "qrDataUrl": null,
        })),
        Ok(response) => {
            Err(GatewayMethodError::internal(response.error.unwrap_or_else(
                || "Failed to start WhatsApp login".to_string(),
            )))
        }
        Err(error) => Err(GatewayMethodError::internal(format!(
            "Failed to start WhatsApp login: {}",
            error
        ))),
    }
}

async fn handle_web_login_wait(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let snapshot = handle_channels_status(state).await?;
    let connected = snapshot
        .pointer("/channels")
        .and_then(Value::as_array)
        .map(|channels| {
            channels.iter().any(|channel| {
                channel.get("type").and_then(Value::as_str) == Some("whatsapp")
                    && channel.get("enabled").and_then(Value::as_bool) == Some(true)
            })
        })
        .unwrap_or(false);

    Ok(json!({
        "connected": connected,
        "message": if connected {
            "WhatsApp channel is enabled."
        } else {
            "WhatsApp channel is not enabled."
        }
    }))
}

async fn handle_channels_logout(
    state: &Arc<ServiceState>,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    let channel = extract_string(params, "/channel").unwrap_or_else(|| "whatsapp".to_string());
    let channel_service = state.channel_abstraction.as_ref().ok_or_else(|| {
        GatewayMethodError::internal("Channel abstraction service is unavailable")
    })?;
    let mut channels = channel_service.lock().await;
    let response = channels
        .execute(ChannelAbstractionRequest {
            operation: ChannelOperation::ToggleChannel {
                channel_id: ChannelId::new(channel.clone()),
                enabled: false,
            },
            context: None,
        })
        .await
        .map_err(|e| GatewayMethodError::internal(format!("Failed to logout channel: {}", e)))?;

    if response.success {
        Ok(json!({
            "status": "logged_out",
            "channel": channel,
        }))
    } else {
        Err(GatewayMethodError::internal(
            response
                .error
                .unwrap_or_else(|| "Failed to logout channel".to_string()),
        ))
    }
}

async fn read_or_build_runtime_config(
    state: &Arc<ServiceState>,
    root: &Path,
) -> Result<(Value, bool), GatewayMethodError> {
    let path = runtime_config_path(root);
    if path.exists() {
        return Ok((read_json_file(&path).await?, true));
    }

    let mut config = serde_json::Map::new();
    config.insert("schemaVersion".to_string(), json!(1));
    config.insert("generatedAt".to_string(), json!(Utc::now().to_rfc3339()));
    config.insert(
        "gateway".to_string(),
        json!({
            "bind": std::env::var("A2R_OPENCLAW_HOST_BIND")
                .or_else(|_| std::env::var("OPENCLAW_HOST_BIND"))
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            "port": std::env::var("A2R_OPENCLAW_HOST_PORT")
                .or_else(|_| std::env::var("OPENCLAW_PORT"))
                .unwrap_or_else(|_| "8080".to_string()),
            "authTokenSet": std::env::var("OPENCLAW_GATEWAY_TOKEN")
                .or_else(|_| std::env::var("A2R_GATEWAY_TOKEN"))
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false),
        }),
    );
    config.insert(
        "paths".to_string(),
        json!({
            "root": root.to_string_lossy(),
            "runtimeConfig": runtime_config_path(root).to_string_lossy(),
            "gatewayApprovals": gateway_approvals_path(root).to_string_lossy(),
        }),
    );

    if let Some(session_manager) = state.session_manager_native.as_ref() {
        let manager = session_manager.lock().await;
        if let Ok(value) = serde_json::to_value(manager.config()) {
            config.insert("session".to_string(), value);
        }
    }
    if let Some(cron_system) = state.cron_system.as_ref() {
        let cron = cron_system.lock().await;
        if let Ok(value) = serde_json::to_value(cron.config()) {
            config.insert("cron".to_string(), value);
        }
    }
    if let Some(channels) = state.channel_abstraction.as_ref() {
        let channel_service = channels.lock().await;
        if let Ok(value) = serde_json::to_value(channel_service.config()) {
            config.insert("channels".to_string(), value);
        }
    }
    if let Some(providers) = state.provider_management.as_ref() {
        let provider_service = providers.lock().await;
        if let Ok(value) = serde_json::to_value(provider_service.config()) {
            config.insert("providers".to_string(), value);
        }
    }
    if let Some(skills) = state.skill_installer.as_ref() {
        let skill_service = skills.lock().await;
        if let Ok(value) = serde_json::to_value(skill_service.config()) {
            config.insert("skills".to_string(), value);
        }
    }

    Ok((Value::Object(config), false))
}

async fn apply_runtime_config(
    state: &Arc<ServiceState>,
    config: &Value,
) -> Result<Vec<String>, GatewayMethodError> {
    let mut applied = Vec::new();

    if let Some(token) = extract_string(config, "/gateway/authToken") {
        unsafe {
            std::env::set_var("OPENCLAW_GATEWAY_TOKEN", token.clone());
            std::env::set_var("A2R_GATEWAY_TOKEN", token);
        }
        applied.push("gateway.authToken".to_string());
    }

    if let Some(session_manager) = state.session_manager_native.as_ref() {
        let mut manager = session_manager.lock().await;
        let session_cfg = manager.config_mut();

        if let Some(v) = extract_u64(config, "/session/max_session_size_mb") {
            session_cfg.max_session_size_mb = Some(v);
            applied.push("session.max_session_size_mb".to_string());
        }
        if let Some(v) = extract_u64(config, "/session/max_session_age_days") {
            session_cfg.max_session_age_days = Some(v as u32);
            applied.push("session.max_session_age_days".to_string());
        }
        if let Some(v) = extract_bool(config, "/session/enable_compaction") {
            session_cfg.enable_compaction = v;
            applied.push("session.enable_compaction".to_string());
        }
        if let Some(v) = extract_usize(config, "/session/compaction_threshold_messages") {
            session_cfg.compaction_threshold_messages = Some(v);
            applied.push("session.compaction_threshold_messages".to_string());
        }
        if let Some(v) = extract_bool(config, "/session/enable_persistence") {
            session_cfg.enable_persistence = v;
            applied.push("session.enable_persistence".to_string());
        }
        if let Some(v) = extract_u64(config, "/session/default_timeout_ms") {
            session_cfg.default_timeout_ms = v;
            applied.push("session.default_timeout_ms".to_string());
        }
    }

    if let Some(cron_system) = state.cron_system.as_ref() {
        let mut cron = cron_system.lock().await;
        let cron_cfg = cron.config_mut();
        if let Some(v) = extract_bool(config, "/cron/enable_persistence") {
            cron_cfg.enable_persistence = v;
            applied.push("cron.enable_persistence".to_string());
        }
        if let Some(v) = extract_bool(config, "/cron/enable_logging") {
            cron_cfg.enable_logging = v;
            applied.push("cron.enable_logging".to_string());
        }
        if let Some(v) = extract_usize(config, "/cron/max_history_entries") {
            cron_cfg.max_history_entries = Some(v);
            applied.push("cron.max_history_entries".to_string());
        }
        if let Some(v) = extract_u64(config, "/cron/default_timeout_ms") {
            cron_cfg.default_timeout_ms = v;
            applied.push("cron.default_timeout_ms".to_string());
        }
    }

    if let Some(channels) = state.channel_abstraction.as_ref() {
        let mut channel_service = channels.lock().await;
        let channel_cfg = channel_service.config_mut();
        if let Some(v) = extract_bool(config, "/channels/enable_persistence") {
            channel_cfg.enable_persistence = v;
            applied.push("channels.enable_persistence".to_string());
        }
        if let Some(v) = extract_bool(config, "/channels/enable_rate_limiting") {
            channel_cfg.enable_rate_limiting = v;
            applied.push("channels.enable_rate_limiting".to_string());
        }
        if let Some(v) = extract_bool(config, "/channels/enable_security_controls") {
            channel_cfg.enable_security_controls = v;
            applied.push("channels.enable_security_controls".to_string());
        }
        if let Some(v) = extract_u64(config, "/channels/default_webhook_timeout_ms") {
            channel_cfg.default_webhook_timeout_ms = v;
            applied.push("channels.default_webhook_timeout_ms".to_string());
        }
    }

    if let Some(providers) = state.provider_management.as_ref() {
        let mut provider_service = providers.lock().await;
        let provider_cfg = provider_service.config_mut();
        if let Some(v) = extract_bool(config, "/providers/enable_health_checks") {
            provider_cfg.enable_health_checks = v;
            applied.push("providers.enable_health_checks".to_string());
        }
        if let Some(v) = extract_u64(config, "/providers/health_check_interval_minutes") {
            provider_cfg.health_check_interval_minutes = Some(v);
            applied.push("providers.health_check_interval_minutes".to_string());
        }
        if let Some(v) = extract_bool(config, "/providers/enable_rate_limiting") {
            provider_cfg.enable_rate_limiting = v;
            applied.push("providers.enable_rate_limiting".to_string());
        }
        if let Some(v) = extract_u64(config, "/providers/default_timeout_ms") {
            provider_cfg.default_timeout_ms = v;
            applied.push("providers.default_timeout_ms".to_string());
        }
    }

    if let Some(skills) = state.skill_installer.as_ref() {
        let mut skill_service = skills.lock().await;
        let skill_cfg = skill_service.config_mut();
        if let Some(v) = extract_bool(config, "/skills/allow_remote_installs") {
            skill_cfg.allow_remote_installs = v;
            applied.push("skills.allow_remote_installs".to_string());
        }
        if let Some(v) = extract_bool(config, "/skills/allow_local_installs") {
            skill_cfg.allow_local_installs = v;
            applied.push("skills.allow_local_installs".to_string());
        }
        if let Some(v) = extract_bool(config, "/skills/verify_signatures") {
            skill_cfg.verify_signatures = v;
            applied.push("skills.verify_signatures".to_string());
        }
    }

    Ok(applied)
}

async fn handle_config_get(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let root = resolve_project_root();
    let path = runtime_config_path(&root);
    let (config, from_file) = read_or_build_runtime_config(state, &root).await?;
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|e| GatewayMethodError::internal(format!("Failed to serialize config: {}", e)))?;
    let hash = sha256_hex(raw.as_bytes());

    Ok(json!({
        "config": config,
        "raw": raw,
        "hash": hash,
        "file": path.to_string_lossy(),
        "source": if from_file { "file" } else { "runtime" },
    }))
}

async fn handle_config_set(
    state: &Arc<ServiceState>,
    params: &Value,
    apply: bool,
) -> Result<Value, GatewayMethodError> {
    let root = resolve_project_root();
    let path = runtime_config_path(&root);

    let (current_config, _from_file) = read_or_build_runtime_config(state, &root).await?;
    let current_raw = serde_json::to_string_pretty(&current_config)
        .map_err(|e| GatewayMethodError::internal(format!("Failed to serialize config: {}", e)))?;
    let current_hash = sha256_hex(current_raw.as_bytes());

    if let Some(base_hash) = extract_string(params, "/baseHash") {
        if base_hash != current_hash {
            return Err(GatewayMethodError {
                code: "BASE_HASH_MISMATCH".to_string(),
                message: format!(
                    "Config changed since last load (expected {}, current {})",
                    base_hash, current_hash
                ),
                details: Some(json!({
                    "expected": base_hash,
                    "current": current_hash,
                })),
                retryable: Some(true),
                retry_after_ms: None,
            });
        }
    }

    let next_config = if let Some(raw) = extract_string(params, "/raw") {
        serde_json::from_str::<Value>(&raw).map_err(|e| {
            GatewayMethodError::bad_request(format!("config.set raw JSON is invalid: {}", e))
        })?
    } else if let Some(cfg) = params.pointer("/config") {
        cfg.clone()
    } else {
        current_config.clone()
    };

    if !next_config.is_object() {
        return Err(GatewayMethodError::bad_request(
            "config.set expects a JSON object",
        ));
    }

    let mut applied = Vec::new();
    if apply {
        applied = apply_runtime_config(state, &next_config).await?;
    }

    write_json_file(&path, &next_config).await?;

    let next_raw = serde_json::to_string_pretty(&next_config)
        .map_err(|e| GatewayMethodError::internal(format!("Failed to serialize config: {}", e)))?;
    let next_hash = sha256_hex(next_raw.as_bytes());

    Ok(json!({
        "status": if apply { "applied" } else { "saved" },
        "hash": next_hash,
        "raw": next_raw,
        "applied": applied,
        "file": path.to_string_lossy(),
    }))
}

fn config_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "gateway": { "type": "object" },
            "session": { "type": "object" },
            "cron": { "type": "object" },
            "channels": { "type": "object" },
            "providers": { "type": "object" },
            "skills": { "type": "object" },
            "paths": { "type": "object" }
        },
        "additionalProperties": true
    })
}

async fn handle_config_schema() -> Result<Value, GatewayMethodError> {
    Ok(json!({
        "version": "1.0.0",
        "schema": config_schema(),
        "uiHints": {
            "sections": ["gateway", "session", "cron", "channels", "providers", "skills", "paths"],
            "readOnlyPaths": ["paths"]
        }
    }))
}

async fn handle_logs_tail(params: &Value) -> Result<Value, GatewayMethodError> {
    let root = resolve_project_root();
    let requested = extract_string(params, "/file")
        .or_else(|| std::env::var("A2R_OPENCLAW_LOG_FILE").ok())
        .or_else(|| std::env::var("OPENCLAW_LOG_FILE").ok());
    let file_path = resolve_log_file(&root, requested)?;

    let limit = parse_limit(params, "/limit", 200);
    let max_bytes = extract_u64(params, "/maxBytes")
        .unwrap_or(DEFAULT_MAX_LOG_BYTES)
        .clamp(1024, MAX_LOG_BYTES_LIMIT);
    let requested_cursor = extract_u64(params, "/cursor");

    let mut file = fs::File::open(&file_path).await.map_err(|e| {
        GatewayMethodError::internal(format!(
            "Failed to open log file {}: {}",
            file_path.display(),
            e
        ))
    })?;
    let metadata = file.metadata().await.map_err(|e| {
        GatewayMethodError::internal(format!(
            "Failed to stat log file {}: {}",
            file_path.display(),
            e
        ))
    })?;
    let file_len = metadata.len();

    let mut start = requested_cursor.unwrap_or_else(|| file_len.saturating_sub(max_bytes));
    let mut reset = requested_cursor.is_none();
    if start > file_len {
        start = file_len.saturating_sub(max_bytes);
        reset = true;
    }

    let mut end = file_len;
    let mut truncated = start > 0;
    if end.saturating_sub(start) > max_bytes {
        end = start + max_bytes;
        truncated = true;
    }

    file.seek(SeekFrom::Start(start)).await.map_err(|e| {
        GatewayMethodError::internal(format!(
            "Failed to seek log file {}: {}",
            file_path.display(),
            e
        ))
    })?;

    let read_len = end.saturating_sub(start) as usize;
    let mut buffer = vec![0u8; read_len];
    if read_len > 0 {
        file.read_exact(&mut buffer).await.map_err(|e| {
            GatewayMethodError::internal(format!(
                "Failed to read log file {}: {}",
                file_path.display(),
                e
            ))
        })?;
    }

    if start > 0 && !buffer.is_empty() && buffer[0] != b'\n' {
        if let Some(first_newline) = buffer.iter().position(|b| *b == b'\n') {
            buffer = buffer[(first_newline + 1)..].to_vec();
        } else {
            buffer.clear();
        }
    }

    let mut lines = String::from_utf8_lossy(&buffer)
        .lines()
        .map(|line| line.to_string())
        .collect::<Vec<_>>();

    if lines.len() > limit {
        let drop_count = lines.len() - limit;
        lines = lines.split_off(drop_count);
        truncated = true;
    }

    Ok(json!({
        "lines": lines,
        "cursor": end,
        "file": file_path.to_string_lossy(),
        "reset": reset,
        "truncated": truncated,
    }))
}

async fn load_exec_approvals(path: &Path) -> Result<Value, GatewayMethodError> {
    if path.exists() {
        read_json_file(path).await
    } else {
        Ok(default_exec_approvals())
    }
}

async fn handle_exec_approvals_get(params: &Value) -> Result<Value, GatewayMethodError> {
    let root = resolve_project_root();
    let path = gateway_approvals_path(&root);
    let file = load_exec_approvals(&path).await?;
    let hash = sha256_hex(
        serde_json::to_string(&file)
            .map_err(|e| GatewayMethodError::internal(format!("Failed to hash approvals: {}", e)))?
            .as_bytes(),
    );

    if let Some(node_id) = extract_string(params, "/nodeId") {
        return Ok(json!({
            "nodeId": node_id,
            "file": file,
            "hash": hash,
            "path": path.to_string_lossy(),
        }));
    }

    Ok(json!({
        "file": file,
        "hash": hash,
        "path": path.to_string_lossy(),
    }))
}

async fn handle_exec_approvals_node_get(params: &Value) -> Result<Value, GatewayMethodError> {
    let node_id = extract_string(params, "/nodeId").ok_or_else(|| {
        GatewayMethodError::bad_request("exec.approvals.node.get requires nodeId")
    })?;
    let root = resolve_project_root();
    let path = node_approvals_path(&root, &node_id);
    let file = load_exec_approvals(&path).await?;
    let hash = sha256_hex(
        serde_json::to_string(&file)
            .map_err(|e| GatewayMethodError::internal(format!("Failed to hash approvals: {}", e)))?
            .as_bytes(),
    );

    Ok(json!({
        "nodeId": node_id,
        "file": file,
        "hash": hash,
        "path": path.to_string_lossy(),
    }))
}

async fn handle_exec_approvals_set(params: &Value) -> Result<Value, GatewayMethodError> {
    let root = resolve_project_root();
    let path = gateway_approvals_path(&root);

    let mut next = params.clone();
    if let Some(obj) = next.as_object_mut() {
        obj.remove("baseHash");
    }
    if !next.is_object() {
        return Err(GatewayMethodError::bad_request(
            "exec.approvals.set expects an object payload",
        ));
    }

    write_json_file(&path, &next).await?;
    let hash = sha256_hex(
        serde_json::to_string(&next)
            .map_err(|e| GatewayMethodError::internal(format!("Failed to hash approvals: {}", e)))?
            .as_bytes(),
    );

    Ok(json!({
        "status": "saved",
        "hash": hash,
        "path": path.to_string_lossy(),
    }))
}

async fn handle_exec_approvals_node_set(params: &Value) -> Result<Value, GatewayMethodError> {
    let node_id = extract_string(params, "/nodeId").ok_or_else(|| {
        GatewayMethodError::bad_request("exec.approvals.node.set requires nodeId")
    })?;
    let root = resolve_project_root();
    let path = node_approvals_path(&root, &node_id);

    let mut next = params.clone();
    if let Some(obj) = next.as_object_mut() {
        obj.remove("nodeId");
        obj.remove("baseHash");
    }
    if !next.is_object() {
        return Err(GatewayMethodError::bad_request(
            "exec.approvals.node.set expects an object payload",
        ));
    }

    write_json_file(&path, &next).await?;
    let hash = sha256_hex(
        serde_json::to_string(&next)
            .map_err(|e| GatewayMethodError::internal(format!("Failed to hash approvals: {}", e)))?
            .as_bytes(),
    );

    Ok(json!({
        "status": "saved",
        "nodeId": node_id,
        "hash": hash,
        "path": path.to_string_lossy(),
    }))
}

async fn handle_update_run(state: &Arc<ServiceState>) -> Result<Value, GatewayMethodError> {
    let verifier = state.integration_verification.as_ref().ok_or_else(|| {
        GatewayMethodError::internal("Integration verification service is unavailable")
    })?;

    let mut service = verifier.lock().await;
    let response = service
        .execute(IntegrationVerificationRequest {
            operation: IntegrationVerificationOperation::VerifyNativeImplementations,
            context: None,
        })
        .await
        .map_err(|e| {
            GatewayMethodError::internal(format!("Failed to run update verification: {}", e))
        })?;

    Ok(json!({
        "status": if response.success { "completed" } else { "failed" },
        "operation": response.operation,
        "summary": response.summary,
        "results": response.results,
        "error": response.error,
        "executionTimeMs": response.execution_time_ms,
    }))
}

async fn handle_request(
    state: &Arc<ServiceState>,
    runtime: &mut GatewayRuntimeState,
    method: &str,
    params: &Value,
) -> Result<Value, GatewayMethodError> {
    if method == "connect" {
        return handle_connect(runtime, params).await;
    }

    if !runtime.authenticated {
        return Err(GatewayMethodError::unauthorized(
            "connect must be called before invoking methods",
        ));
    }

    match method {
        "status" => handle_status(state, runtime).await,
        "health" => handle_health(state).await,
        "models.list" => handle_models_list(state).await,
        "system-presence" => Ok(json!([
            {
                "nodeId": "a2r-host-local",
                "status": "online",
                "role": runtime.role,
                "scopes": runtime.scopes,
                "updatedAt": Utc::now().timestamp_millis(),
            }
        ])),
        "last-heartbeat" => Ok(json!({
            "ts": runtime.last_heartbeat_ms.unwrap_or_else(|| Utc::now().timestamp_millis()),
        })),
        "chat.history" => handle_chat_history(state, runtime, params).await,
        "chat.send" => handle_chat_send(state, runtime, params).await,
        "chat.inject" => handle_chat_inject(state, runtime, params).await,
        "chat.abort" => Ok(json!({
            "status": "aborted",
            "sessionKey": extract_string(params, "/sessionKey").unwrap_or_else(|| "main".to_string()),
            "runId": extract_string(params, "/runId"),
        })),
        "sessions.list" => handle_sessions_list(state, runtime).await,
        "sessions.delete" => handle_sessions_delete(state, runtime, params).await,
        "sessions.patch" => handle_sessions_patch(state, runtime, params).await,
        "channels.status" => handle_channels_status(state).await,
        "channels.logout" => handle_channels_logout(state, params).await,
        "web.login.start" => handle_web_login_start(state, params).await,
        "web.login.wait" => handle_web_login_wait(state).await,
        "cron.status" => handle_cron_status(state).await,
        "cron.list" => handle_cron_list(state).await,
        "cron.runs" => handle_cron_runs(state, params).await,
        "cron.add" => handle_cron_add(state, params).await,
        "cron.update" => handle_cron_update(state, params).await,
        "cron.remove" => handle_cron_remove(state, params).await,
        "cron.run" => {
            let id = extract_string(params, "/id")
                .ok_or_else(|| GatewayMethodError::bad_request("cron.run requires id"))?;
            let cron_system = state.cron_system.as_ref().ok_or_else(|| {
                GatewayMethodError::internal("Cron system service is unavailable")
            })?;
            let mut cron = cron_system.lock().await;
            let response = cron
                .execute(CronJobManagementRequest {
                    operation: CronJobOperation::ExecuteJob {
                        request: CronJobExecutionRequest {
                            job_id: CronJobId::new(id),
                            force_execution: true,
                            override_arguments: None,
                        },
                    },
                    context: None,
                })
                .await
                .map_err(|e| {
                    GatewayMethodError::internal(format!("Failed to run cron job: {}", e))
                })?;
            if response.success {
                Ok(response
                    .result
                    .unwrap_or_else(|| json!({"status": "started"})))
            } else {
                Err(GatewayMethodError::internal(
                    response
                        .error
                        .unwrap_or_else(|| "Failed to run cron job".to_string()),
                ))
            }
        }
        "skills.status" => handle_skills_status(state).await,
        "skills.list" => handle_skills_status(state).await,
        "skills.install" => handle_skills_install(state, params).await,
        "skills.update" => handle_skills_update(state, params).await,
        "node.list" => Ok(handle_node_list()),
        "nodes.list" => Ok(handle_node_list()),
        "exec.approvals.get" => handle_exec_approvals_get(params).await,
        "exec.approvals.set" => handle_exec_approvals_set(params).await,
        "exec.approvals.node.get" => handle_exec_approvals_node_get(params).await,
        "exec.approvals.node.set" => handle_exec_approvals_node_set(params).await,
        "config.get" => handle_config_get(state).await,
        "config.set" => handle_config_set(state, params, false).await,
        "config.apply" => handle_config_set(state, params, true).await,
        "config.schema" => handle_config_schema().await,
        "logs.tail" => handle_logs_tail(params).await,
        "update.run" => handle_update_run(state).await,
        _ => Err(GatewayMethodError::method_not_available(method)),
    }
}

async fn gateway_ws_session(socket: WebSocket, state: Arc<ServiceState>) {
    let socket = Arc::new(Mutex::new(socket));
    let mut runtime = GatewayRuntimeState::default();

    loop {
        let message = {
            let mut guard = socket.lock().await;
            guard.recv().await
        };

        let Some(Ok(message)) = message else {
            break;
        };

        match message {
            Message::Text(text) => {
                let parsed = serde_json::from_str::<GatewayReqFrame>(&text);
                let frame = match parsed {
                    Ok(frame) => frame,
                    Err(err) => {
                        let mut guard = socket.lock().await;
                        send_response_frame(
                            &mut guard,
                            Uuid::new_v4().to_string(),
                            Err(GatewayMethodError::bad_request(format!(
                                "Invalid gateway frame: {}",
                                err
                            ))),
                        )
                        .await;
                        continue;
                    }
                };

                if frame.frame_type != "req" {
                    let mut guard = socket.lock().await;
                    send_response_frame(
                        &mut guard,
                        frame.id,
                        Err(GatewayMethodError::bad_request(
                            "Only req frame type is supported",
                        )),
                    )
                    .await;
                    continue;
                }

                let result =
                    handle_request(&state, &mut runtime, &frame.method, &frame.params).await;
                let method = frame.method.clone();

                {
                    let mut guard = socket.lock().await;
                    send_response_frame(&mut guard, frame.id, result).await;

                    if method == "chat.send" {
                        let session_key = extract_string(&frame.params, "/sessionKey")
                            .unwrap_or_else(|| "main".to_string());
                        let run_id = extract_string(&frame.params, "/idempotencyKey")
                            .unwrap_or_else(|| Uuid::new_v4().to_string());
                        send_event_frame(
                            &mut guard,
                            &mut runtime,
                            "chat",
                            json!({
                                "state": "final",
                                "sessionKey": session_key,
                                "runId": run_id,
                            }),
                        )
                        .await;
                    }
                }
            }
            Message::Ping(payload) => {
                let mut guard = socket.lock().await;
                let _ = guard.send(Message::Pong(payload)).await;
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}

pub async fn gateway_ws(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServiceState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| gateway_ws_session(socket, state))
}
