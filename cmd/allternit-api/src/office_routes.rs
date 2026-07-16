use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, path::PathBuf, sync::Arc};
use uuid::Uuid;

use crate::AppState;

// ── TTL configuration ────────────────────────────────────────────────────────

/// Sessions older than this are considered stale and removed.
const SESSION_TTL_MINUTES: i64 = 10;
/// Bindings with no active sessions and last seen older than this are removed.
const BINDING_TTL_MINUTES: i64 = 60;

// ── Data models ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OfficeRuntimeFile {
    pub bindings: Vec<OfficeBinding>,
    pub sessions: Vec<OfficeRuntimeSession>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficeBinding {
    pub id: String,
    pub document_key: String,
    pub host: String,
    pub title: Option<String>,
    pub label: Option<String>,
    pub summary: Option<String>,
    pub document_url: Option<String>,
    pub document_id: Option<String>,
    pub fingerprint: Option<String>,
    pub project_id: Option<String>,
    pub workspace_id: Option<String>,
    pub taskpane_origin: Option<String>,
    pub taskpane_url: Option<String>,
    pub manifest_url: Option<String>,
    pub platform_origin: Option<String>,
    pub last_runtime_status: Option<String>,
    pub last_page_label: Option<String>,
    pub last_current_task: Option<String>,
    pub last_history_count: Option<i64>,
    pub connected: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_seen_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficeRuntimeSession {
    pub id: String,
    pub binding_id: String,
    pub status: Option<String>,
    pub page_label: Option<String>,
    pub current_task: Option<String>,
    pub history_count: i64,
    pub connected: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_seen_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OfficeBindingResponse {
    #[serde(flatten)]
    binding: OfficeBinding,
    active_sessions: Vec<OfficeRuntimeSession>,
    active_session_count: usize,
}

#[derive(Debug, Deserialize)]
struct OfficeDocumentRequest {
    host: String,
    title: Option<String>,
    label: Option<String>,
    summary: Option<String>,
    document_url: Option<String>,
    document_id: Option<String>,
    fingerprint: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OfficePlatformRequest {
    taskpane_origin: Option<String>,
    taskpane_url: Option<String>,
    manifest_url: Option<String>,
    platform_origin: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OfficeRuntimeStateRequest {
    status: Option<String>,
    page_label: Option<String>,
    current_task: Option<String>,
    history_count: Option<i64>,
    connected: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct OfficeBootstrapRequest {
    session_id: Option<String>,
    project_id: Option<String>,
    workspace_id: Option<String>,
    document: OfficeDocumentRequest,
    platform: Option<OfficePlatformRequest>,
    runtime_state: Option<OfficeRuntimeStateRequest>,
}

#[derive(Debug, Deserialize)]
struct OfficeRuntimeSyncRequest {
    binding_id: String,
    session_id: String,
    project_id: Option<String>,
    workspace_id: Option<String>,
    document: Option<OfficeDocumentRequest>,
    platform: Option<OfficePlatformRequest>,
    runtime_state: Option<OfficeRuntimeStateRequest>,
}

#[derive(Debug, Serialize)]
struct OfficeBootstrapResponse {
    ok: bool,
    binding: OfficeBindingResponse,
    session: OfficeRuntimeSession,
    gateway: OfficeGatewayInfo,
}

#[derive(Debug, Serialize)]
struct OfficeGatewayInfo {
    base_url: String,
    supports_runtime_sync: bool,
}

#[derive(Debug, Serialize)]
struct OfficeBindingsListResponse {
    ok: bool,
    bindings: Vec<OfficeBindingResponse>,
    count: usize,
}

#[derive(Debug, Serialize)]
struct OfficeBindingSingleResponse {
    ok: bool,
    binding: OfficeBindingResponse,
}

pub fn office_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/office/bootstrap", post(office_bootstrap))
        .route("/office/runtime/state", post(office_runtime_state))
        .route("/office/bindings", get(list_office_bindings))
        .route("/office/bindings/:binding_id", get(get_office_binding))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn runtime_store_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".allternit")
        .join("gateway-office-runtime.json")
}

/// Load runtime file from disk (fallback to default if missing or corrupt).
pub fn load_runtime_file() -> OfficeRuntimeFile {
    let path = runtime_store_path();
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<OfficeRuntimeFile>(&raw).unwrap_or_default(),
        Err(_) => OfficeRuntimeFile::default(),
    }
}

/// Save runtime file to disk.
fn save_runtime_file(data: &OfficeRuntimeFile) -> Result<(), std::io::Error> {
    let path = runtime_store_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(data).unwrap_or_default())
}

/// Remove stale sessions and orphaned bindings based on TTL rules.
fn cleanup_stale_data(data: &mut OfficeRuntimeFile) {
    let now = Utc::now();

    // Remove sessions that haven't been seen recently
    data.sessions.retain(|session| {
        if let Ok(last_seen) = DateTime::parse_from_rfc3339(&session.last_seen_at) {
            let elapsed = now.signed_duration_since(last_seen.with_timezone(&Utc));
            elapsed.num_minutes() < SESSION_TTL_MINUTES
        } else {
            false
        }
    });

    // Remove bindings with no active sessions and old last_seen_at
    data.bindings.retain(|binding| {
        let has_active_sessions = data.sessions.iter().any(|s| s.binding_id == binding.id);
        if has_active_sessions {
            return true;
        }
        if let Ok(last_seen) = DateTime::parse_from_rfc3339(&binding.last_seen_at) {
            let elapsed = now.signed_duration_since(last_seen.with_timezone(&Utc));
            elapsed.num_minutes() < BINDING_TTL_MINUTES
        } else {
            false
        }
    });
}

fn document_key(document: &OfficeDocumentRequest) -> String {
    let primary = document
        .document_id
        .as_ref()
        .or(document.document_url.as_ref())
        .or(document.fingerprint.as_ref())
        .cloned()
        .unwrap_or_else(|| {
            format!(
                "{}:{}:{}",
                document.host,
                document.title.clone().unwrap_or_default(),
                document.label.clone().unwrap_or_default()
            )
        });
    let mut hasher = Sha256::new();
    hasher.update(primary.as_bytes());
    hex::encode(hasher.finalize())
}

fn serialize_binding(data: &OfficeRuntimeFile, binding: &OfficeBinding) -> OfficeBindingResponse {
    let mut active_sessions: Vec<OfficeRuntimeSession> = data
        .sessions
        .iter()
        .filter(|session| session.binding_id == binding.id)
        .cloned()
        .collect();
    active_sessions.sort_by(|a, b| b.last_seen_at.cmp(&a.last_seen_at));
    OfficeBindingResponse {
        binding: binding.clone(),
        active_session_count: active_sessions.len(),
        active_sessions,
    }
}

async fn office_bootstrap(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<OfficeBootstrapRequest>,
) -> Result<Json<OfficeBootstrapResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut data = state.office_runtime.write().await;
    cleanup_stale_data(&mut data);

    let now = now_iso();
    let key = document_key(&payload.document);

    let binding_index = data
        .bindings
        .iter()
        .position(|binding| binding.document_key == key);

    let binding_id = binding_index
        .map(|index| data.bindings[index].id.clone())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if let Some(index) = binding_index {
        let binding = &mut data.bindings[index];
        binding.host = payload.document.host.clone();
        binding.title = payload.document.title.clone();
        binding.label = payload.document.label.clone();
        binding.summary = payload.document.summary.clone();
        binding.document_url = payload.document.document_url.clone();
        binding.document_id = payload.document.document_id.clone();
        binding.fingerprint = payload.document.fingerprint.clone();
        binding.project_id = payload.project_id.clone();
        binding.workspace_id = payload.workspace_id.clone();
        binding.taskpane_origin = payload
            .platform
            .as_ref()
            .and_then(|platform| platform.taskpane_origin.clone());
        binding.taskpane_url = payload
            .platform
            .as_ref()
            .and_then(|platform| platform.taskpane_url.clone());
        binding.manifest_url = payload
            .platform
            .as_ref()
            .and_then(|platform| platform.manifest_url.clone());
        binding.platform_origin = payload
            .platform
            .as_ref()
            .and_then(|platform| platform.platform_origin.clone());
        binding.last_runtime_status = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.status.clone());
        binding.last_page_label = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.page_label.clone());
        binding.last_current_task = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.current_task.clone());
        binding.last_history_count = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.history_count);
        binding.connected = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.connected)
            .unwrap_or(true);
        binding.updated_at = now.clone();
        binding.last_seen_at = now.clone();
    } else {
        data.bindings.push(OfficeBinding {
            id: binding_id.clone(),
            document_key: key,
            host: payload.document.host.clone(),
            title: payload.document.title.clone(),
            label: payload.document.label.clone(),
            summary: payload.document.summary.clone(),
            document_url: payload.document.document_url.clone(),
            document_id: payload.document.document_id.clone(),
            fingerprint: payload.document.fingerprint.clone(),
            project_id: payload.project_id.clone(),
            workspace_id: payload.workspace_id.clone(),
            taskpane_origin: payload
                .platform
                .as_ref()
                .and_then(|platform| platform.taskpane_origin.clone()),
            taskpane_url: payload
                .platform
                .as_ref()
                .and_then(|platform| platform.taskpane_url.clone()),
            manifest_url: payload
                .platform
                .as_ref()
                .and_then(|platform| platform.manifest_url.clone()),
            platform_origin: payload
                .platform
                .as_ref()
                .and_then(|platform| platform.platform_origin.clone()),
            last_runtime_status: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.status.clone()),
            last_page_label: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.page_label.clone()),
            last_current_task: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.current_task.clone()),
            last_history_count: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.history_count),
            connected: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.connected)
                .unwrap_or(true),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_seen_at: now.clone(),
        });
    }

    let session_id = payload
        .session_id
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    if let Some(session) = data
        .sessions
        .iter_mut()
        .find(|session| session.id == session_id)
    {
        session.binding_id = binding_id.clone();
        session.status = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.status.clone());
        session.page_label = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.page_label.clone());
        session.current_task = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.current_task.clone());
        session.history_count = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.history_count)
            .unwrap_or(0);
        session.connected = payload
            .runtime_state
            .as_ref()
            .and_then(|state| state.connected)
            .unwrap_or(true);
        session.updated_at = now.clone();
        session.last_seen_at = now.clone();
    } else {
        data.sessions.push(OfficeRuntimeSession {
            id: session_id.clone(),
            binding_id: binding_id.clone(),
            status: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.status.clone()),
            page_label: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.page_label.clone()),
            current_task: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.current_task.clone()),
            history_count: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.history_count)
                .unwrap_or(0),
            connected: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.connected)
                .unwrap_or(true),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_seen_at: now.clone(),
        });
    }

    data.updated_at = Some(now.clone());
    let _ = save_runtime_file(&data);

    let binding = data
        .bindings
        .iter()
        .find(|binding| binding.id == binding_id)
        .cloned()
        .ok_or_else(|| internal_error("binding missing after bootstrap"))?;
    let session = data
        .sessions
        .iter()
        .find(|session| session.id == session_id)
        .cloned()
        .ok_or_else(|| internal_error("session missing after bootstrap"))?;

    Ok(Json(OfficeBootstrapResponse {
        ok: true,
        binding: serialize_binding(&data, &binding),
        session,
        gateway: OfficeGatewayInfo {
            base_url: "/api/v1".to_string(),
            supports_runtime_sync: true,
        },
    }))
}

async fn office_runtime_state(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<OfficeRuntimeSyncRequest>,
) -> Result<Json<OfficeBootstrapResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut data = state.office_runtime.write().await;
    cleanup_stale_data(&mut data);
    let now = now_iso();

    let Some(binding) = data
        .bindings
        .iter_mut()
        .find(|binding| binding.id == payload.binding_id)
    else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Office binding not found" })),
        ));
    };

    if let Some(document) = payload.document.as_ref() {
        binding.host = document.host.clone();
        binding.title = document.title.clone();
        binding.label = document.label.clone();
        binding.summary = document.summary.clone();
        binding.document_url = document.document_url.clone();
        binding.document_id = document.document_id.clone();
        binding.fingerprint = document.fingerprint.clone();
    }
    if let Some(platform) = payload.platform.as_ref() {
        binding.taskpane_origin = platform.taskpane_origin.clone();
        binding.taskpane_url = platform.taskpane_url.clone();
        binding.manifest_url = platform.manifest_url.clone();
        binding.platform_origin = platform.platform_origin.clone();
    }
    if let Some(project_id) = payload.project_id.clone() {
        binding.project_id = Some(project_id);
    }
    if let Some(workspace_id) = payload.workspace_id.clone() {
        binding.workspace_id = Some(workspace_id);
    }
    if let Some(runtime_state) = payload.runtime_state.as_ref() {
        binding.last_runtime_status = runtime_state.status.clone();
        binding.last_page_label = runtime_state.page_label.clone();
        binding.last_current_task = runtime_state.current_task.clone();
        binding.last_history_count = runtime_state.history_count;
        binding.connected = runtime_state.connected.unwrap_or(binding.connected);
    }
    binding.updated_at = now.clone();
    binding.last_seen_at = now.clone();

    if let Some(session) = data
        .sessions
        .iter_mut()
        .find(|session| session.id == payload.session_id)
    {
        session.binding_id = payload.binding_id.clone();
        if let Some(runtime_state) = payload.runtime_state.as_ref() {
            session.status = runtime_state.status.clone();
            session.page_label = runtime_state.page_label.clone();
            session.current_task = runtime_state.current_task.clone();
            session.history_count = runtime_state.history_count.unwrap_or(session.history_count);
            session.connected = runtime_state.connected.unwrap_or(session.connected);
        }
        session.updated_at = now.clone();
        session.last_seen_at = now.clone();
    } else {
        data.sessions.push(OfficeRuntimeSession {
            id: payload.session_id.clone(),
            binding_id: payload.binding_id.clone(),
            status: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.status.clone()),
            page_label: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.page_label.clone()),
            current_task: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.current_task.clone()),
            history_count: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.history_count)
                .unwrap_or(0),
            connected: payload
                .runtime_state
                .as_ref()
                .and_then(|state| state.connected)
                .unwrap_or(true),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_seen_at: now.clone(),
        });
    }

    data.updated_at = Some(now.clone());
    let _ = save_runtime_file(&data);

    let binding = data
        .bindings
        .iter()
        .find(|binding| binding.id == payload.binding_id)
        .cloned()
        .ok_or_else(|| internal_error("binding missing after sync"))?;
    let session = data
        .sessions
        .iter()
        .find(|session| session.id == payload.session_id)
        .cloned()
        .ok_or_else(|| internal_error("session missing after sync"))?;

    Ok(Json(OfficeBootstrapResponse {
        ok: true,
        binding: serialize_binding(&data, &binding),
        session,
        gateway: OfficeGatewayInfo {
            base_url: "/api/v1".to_string(),
            supports_runtime_sync: true,
        },
    }))
}

async fn list_office_bindings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<OfficeBindingsListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut data = state.office_runtime.write().await;
    cleanup_stale_data(&mut data);
    let _ = save_runtime_file(&data);

    let mut bindings = data.bindings.clone();
    bindings.sort_by(|a, b| b.last_seen_at.cmp(&a.last_seen_at));
    let bindings = bindings
        .iter()
        .map(|binding| serialize_binding(&data, binding))
        .collect::<Vec<_>>();
    Ok(Json(OfficeBindingsListResponse {
        ok: true,
        count: bindings.len(),
        bindings,
    }))
}

async fn get_office_binding(
    State(state): State<Arc<AppState>>,
    Path(binding_id): Path<String>,
) -> Result<Json<OfficeBindingSingleResponse>, (StatusCode, Json<serde_json::Value>)> {
    let data = state.office_runtime.read().await;
    let Some(binding) = data
        .bindings
        .iter()
        .find(|binding| binding.id == binding_id)
    else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Office binding not found" })),
        ));
    };
    Ok(Json(OfficeBindingSingleResponse {
        ok: true,
        binding: serialize_binding(&data, binding),
    }))
}

fn internal_error<E: std::fmt::Display>(error: E) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({
            "error": "Internal server error",
            "message": error.to_string(),
        })),
    )
}
