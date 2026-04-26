//! Terminal API routes for handling terminal messages from IDE extensions
//!
//! Handles requests from the Kimi For Coding extension and other IDE plugins

use anyhow::Context;
use axum::{
    body::Bytes,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path as StdPath, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::auth::authorize_request;
use crate::pty::{PtySessionInfo, PtySessionStatus, SessionAccessMode};
use crate::AppState;

/// Terminal message request from IDE extension
#[derive(Debug, Deserialize)]
pub struct TerminalMessageRequest {
    /// Message type (e.g., "input", "resize", "close")
    pub message_type: String,
    /// Message content - made optional with default to fix 422 errors
    #[serde(default)]
    pub content: Option<String>,
    /// Session identifier
    #[serde(default)]
    pub session_id: Option<String>,
    /// Additional metadata
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

/// Create terminal session request
#[derive(Debug, Deserialize)]
pub struct CreateTerminalSessionRequest {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub shell: Option<String>,
    #[serde(default)]
    pub cols: Option<u16>,
    #[serde(default)]
    pub rows: Option<u16>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub workdir: Option<String>,
}

/// Terminal message response
#[derive(Debug, Serialize)]
pub struct TerminalMessageResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Terminal input message request (backward compatibility)
#[derive(Debug, Deserialize)]
pub struct TerminalInputRequest {
    /// The input content - made optional with default
    #[serde(default)]
    pub content: Option<String>,
    /// Session identifier
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct TerminalSessionResponse {
    session_id: String,
    shell: String,
    cols: u16,
    rows: u16,
    status: PtySessionStatus,
    exit_code: Option<i32>,
    workdir: Option<String>,
    websocket_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum TerminalWsCommand {
    Resize { cols: u16, rows: u16 },
    Snapshot { snapshot: String, cols: u16, rows: u16 },
    Close,
    Keepalive,
}

#[derive(Debug, Serialize)]
struct SessionStatusResponse {
    exists: bool,
    session_id: String,
    connection_state: String,
    last_activity: String,
    can_reconnect: bool,
    cols: u16,
    rows: u16,
    shell: String,
    workdir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FilePathQuery {
    path: String,
}

#[derive(Debug, Deserialize, Default)]
struct TerminalSocketQuery {
    client_id: Option<String>,
    mode: Option<String>,
}

#[derive(Debug, Serialize)]
struct TerminalFileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: String,
    permissions: Option<u32>,
    mime_type: Option<String>,
}

/// Create terminal router
pub fn terminal_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/sessions",
            post(create_terminal_session).get(list_terminal_sessions),
        )
        .route(
            "/sessions/:session_id/status",
            get(get_terminal_session_status),
        )
        .route("/sessions/:session_id", delete(delete_terminal_session))
        .route("/:session_id", delete(delete_terminal_session))
        .route("/ws/:session_id", get(connect_terminal_websocket))
        .route("/:session_id/files/list", get(list_terminal_files))
        .route("/:session_id/files/download", get(download_terminal_file))
        .route("/:session_id/files/upload", post(upload_terminal_file))
        .route("/:session_id/files", delete(delete_terminal_file))
        .route("/:session_id/files/mkdir", post(create_terminal_directory))
        .route("/:session_id/files/stat", get(stat_terminal_file))
        .route("/health", get(terminal_health))
        .route("/message", post(handle_terminal_message))
        .route("/input", post(handle_terminal_input))
}

async fn create_terminal_session(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateTerminalSessionRequest>,
) -> Response {
    if let Err(response) = ensure_terminal_backend(&state) {
        return response.into_response();
    }
    let session_id = request
        .session_id
        .filter(|session_id| !session_id.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let cols = request.cols.unwrap_or(120);
    let rows = request.rows.unwrap_or(40);
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };

    match state
        .terminal_runtime
        .create_session(
            session_id.clone(),
            owner_id,
            request.shell,
            cols,
            rows,
            request.env,
            request.workdir,
        )
        .await
    {
        Ok(info) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "sessionId": info.session_id,
                "shell": info.shell,
                "cols": info.cols,
                "rows": info.rows,
                "reconnected": false,
                "workingDir": info.workdir,
                "websocketPath": format!("/terminal/ws/{}", session_id),
            })),
        )
            .into_response(),
        Err(error) => terminal_error(StatusCode::BAD_REQUEST, &error.to_string()).into_response(),
    }
}

async fn list_terminal_sessions(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    let sessions = state
        .terminal_runtime
        .list_sessions()
        .await
        .into_iter()
        .filter(|info| info.owner_id == owner_id)
        .map(|info| terminal_session_response(&info))
        .collect::<Vec<_>>();

    (
        StatusCode::OK,
        Json(TerminalMessageResponse {
            success: true,
            message: "Terminal sessions listed".to_string(),
            data: Some(serde_json::json!({ "sessions": sessions })),
        }),
    )
        .into_response()
}

async fn get_terminal_session_status(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(response) = ensure_terminal_backend(&state) {
        return response.into_response();
    }
    if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
        return response.into_response();
    }
    match state.terminal_runtime.get_session(&session_id).await {
        Some(info) => (
            StatusCode::OK,
            Json(
                serde_json::to_value(session_status_response(
                    &info,
                    state.terminal_runtime.can_reconnect(&session_id).await,
                ))
                .unwrap_or_default(),
            ),
        )
            .into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "exists": false,
                "session_id": session_id,
                "can_reconnect": false,
            })),
        )
            .into_response(),
    }
}

async fn delete_terminal_session(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
        return response.into_response();
    }
    match state.terminal_runtime.close_session(&session_id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => terminal_error(StatusCode::NOT_FOUND, &error.to_string()).into_response(),
    }
}

async fn connect_terminal_websocket(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<TerminalSocketQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
        return response.into_response();
    }

    let client_id = client_id_from_headers(&headers, query.client_id);
    let mode = socket_mode(query.mode.as_deref());
    ws.on_upgrade(move |socket| handle_terminal_socket(socket, state, session_id, client_id, mode))
}

async fn terminal_health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let health = state.terminal_runtime.health().await;
    (
        StatusCode::OK,
        Json(serde_json::to_value(health).unwrap_or_default()),
    )
}

async fn list_terminal_files(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };

    let mut entries = match tokio::fs::read_dir(&path).await {
        Ok(entries) => entries,
        Err(error) => {
            return terminal_error(
                StatusCode::BAD_REQUEST,
                &format!("failed to read directory: {error}"),
            )
            .into_response()
        }
    };

    let mut items = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        if let Ok(file_entry) = terminal_file_entry(entry.path()).await {
            items.push(file_entry);
        }
    }
    items.sort_by(|a, b| a.name.cmp(&b.name));

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "path": path.to_string_lossy(),
            "entries": items,
        })),
    )
        .into_response()
}

async fn download_terminal_file(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };
    match tokio::fs::read(&path).await {
        Ok(bytes) => bytes.into_response(),
        Err(error) => terminal_error(
            StatusCode::BAD_REQUEST,
            &format!("failed to read file: {error}"),
        )
        .into_response(),
    }
}

async fn upload_terminal_file(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };
    if let Some(parent) = path.parent() {
        if let Err(error) = tokio::fs::create_dir_all(parent).await {
            return terminal_error(
                StatusCode::BAD_REQUEST,
                &format!("failed to create parent directory: {error}"),
            )
            .into_response();
        }
    }
    match tokio::fs::write(&path, body).await {
        Ok(()) => {
            let _ = state
                .terminal_runtime
                .record_audit_event(
                    &session_id,
                    "file_uploaded",
                    serde_json::json!({
                        "path": path.to_string_lossy(),
                        "bytes": path.metadata().map(|m| m.len()).unwrap_or_default(),
                    }),
                    None,
                )
                .await;
            StatusCode::NO_CONTENT.into_response()
        }
        Err(error) => terminal_error(
            StatusCode::BAD_REQUEST,
            &format!("failed to write file: {error}"),
        )
        .into_response(),
    }
}

async fn delete_terminal_file(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };
    let metadata = match tokio::fs::metadata(&path).await {
        Ok(metadata) => metadata,
        Err(error) => {
            return terminal_error(
                StatusCode::BAD_REQUEST,
                &format!("failed to stat path: {error}"),
            )
            .into_response()
        }
    };
    let result = if metadata.is_dir() {
        tokio::fs::remove_dir_all(&path).await
    } else {
        tokio::fs::remove_file(&path).await
    };
    match result {
        Ok(()) => {
            let _ = state
                .terminal_runtime
                .record_audit_event(
                    &session_id,
                    "file_deleted",
                    serde_json::json!({
                        "path": path.to_string_lossy(),
                        "is_dir": metadata.is_dir(),
                    }),
                    None,
                )
                .await;
            StatusCode::NO_CONTENT.into_response()
        }
        Err(error) => terminal_error(
            StatusCode::BAD_REQUEST,
            &format!("failed to delete path: {error}"),
        )
        .into_response(),
    }
}

async fn create_terminal_directory(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };
    match tokio::fs::create_dir_all(&path).await {
        Ok(()) => {
            let _ = state
                .terminal_runtime
                .record_audit_event(
                    &session_id,
                    "directory_created",
                    serde_json::json!({
                        "path": path.to_string_lossy(),
                    }),
                    None,
                )
                .await;
            StatusCode::NO_CONTENT.into_response()
        }
        Err(error) => terminal_error(
            StatusCode::BAD_REQUEST,
            &format!("failed to create directory: {error}"),
        )
        .into_response(),
    }
}

async fn stat_terminal_file(
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Query(query): Query<FilePathQuery>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    if let Err(error) = state
        .terminal_runtime
        .verify_owner(&session_id, &owner_id)
        .await
    {
        return terminal_error(StatusCode::FORBIDDEN, &error.to_string()).into_response();
    }
    let base = match terminal_root(&state, &session_id).await {
        Ok(base) => base,
        Err(response) => return response.into_response(),
    };
    let path = match resolve_terminal_path(&base, &query.path) {
        Ok(path) => path,
        Err(response) => return response.into_response(),
    };
    match terminal_file_entry(path).await {
        Ok(entry) => (
            StatusCode::OK,
            Json(serde_json::to_value(entry).unwrap_or_default()),
        )
            .into_response(),
        Err(error) => terminal_error(StatusCode::BAD_REQUEST, &error.to_string()).into_response(),
    }
}

/// Handle terminal message from IDE extension
async fn handle_terminal_message(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(request): Json<TerminalMessageRequest>,
) -> Response {
    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };
    debug!(
        message_type = %request.message_type,
        has_content = request.content.is_some(),
        has_session_id = request.session_id.is_some(),
        has_metadata = request.metadata.is_some(),
        "Received terminal message"
    );

    // Handle the message based on type
    match request.message_type.as_str() {
        "input" => {
            let content = request.content.unwrap_or_default();
            debug!(content_len = content.len(), "Processing terminal input");
            handle_terminal_input_impl(state, request.session_id, owner_id, content)
                .await
                .into_response()
        }
        "resize" => {
            let session_id = match require_session_id(request.session_id) {
                Ok(session_id) => session_id,
                Err(response) => return response.into_response(),
            };

            let (cols, rows) = match parse_resize(request.metadata.as_ref()) {
                Ok(size) => size,
                Err(response) => return response.into_response(),
            };

            if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
                return response.into_response();
            }

            match state.terminal_runtime.resize(&session_id, cols, rows).await {
                Ok(()) => (
                    StatusCode::OK,
                    Json(TerminalMessageResponse {
                        success: true,
                        message: "Terminal resized".to_string(),
                        data: Some(serde_json::json!({
                            "session_id": session_id,
                            "cols": cols,
                            "rows": rows,
                        })),
                    }),
                )
                    .into_response(),
                Err(error) => {
                    terminal_error(StatusCode::NOT_FOUND, &error.to_string()).into_response()
                }
            }
        }
        "close" => {
            debug!("Processing terminal close");
            handle_terminal_close(state, request.session_id, owner_id)
                .await
                .into_response()
        }
        unknown => {
            warn!(message_type = %unknown, "Unknown terminal message type");
            terminal_error(
                StatusCode::BAD_REQUEST,
                &format!("Unsupported terminal message type '{}'", unknown),
            )
            .into_response()
        }
    }
}

/// Handle terminal input (backward compatibility endpoint)
async fn handle_terminal_input(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(request): Json<TerminalInputRequest>,
) -> Response {
    let content = request.content.unwrap_or_default();

    debug!(
        content_len = content.len(),
        session_id = ?request.session_id,
        "Received terminal input"
    );

    let owner_id = match authenticated_user_id(&headers) {
        Ok(owner_id) => owner_id,
        Err(response) => return response.into_response(),
    };

    handle_terminal_input_impl(state, request.session_id, owner_id, content)
        .await
        .into_response()
}

async fn handle_terminal_input_impl(
    state: Arc<AppState>,
    session_id: Option<String>,
    owner_id: String,
    content: String,
) -> (StatusCode, Json<TerminalMessageResponse>) {
    let session_id = match require_session_id(session_id) {
        Ok(session_id) => session_id,
        Err(response) => return response,
    };

    if content.trim().is_empty() {
        return terminal_error(StatusCode::BAD_REQUEST, "Terminal input cannot be empty");
    }

    if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
        return response;
    }

    match state
        .terminal_runtime
        .write(&session_id, content.as_bytes())
        .await
    {
        Ok(()) => (
            StatusCode::OK,
            Json(TerminalMessageResponse {
                success: true,
                message: "Terminal input forwarded".to_string(),
                data: Some(serde_json::json!({
                    "session_id": session_id,
                    "bytes_written": content.len(),
                })),
            }),
        ),
        Err(error) => terminal_error(StatusCode::NOT_FOUND, &error.to_string()),
    }
}

async fn handle_terminal_close(
    state: Arc<AppState>,
    session_id: Option<String>,
    owner_id: String,
) -> (StatusCode, Json<TerminalMessageResponse>) {
    let session_id = match require_session_id(session_id) {
        Ok(session_id) => session_id,
        Err(response) => return response,
    };

    if let Err(response) = ensure_owner(&state, &session_id, &owner_id).await {
        return response;
    }

    match state.terminal_runtime.close_session(&session_id).await {
        Ok(()) => (
            StatusCode::OK,
            Json(TerminalMessageResponse {
                success: true,
                message: "Session closed".to_string(),
                data: Some(serde_json::json!({ "session_id": session_id })),
            }),
        ),
        Err(error) => terminal_error(StatusCode::NOT_FOUND, &error.to_string()),
    }
}

fn require_session_id(
    session_id: Option<String>,
) -> Result<String, (StatusCode, Json<TerminalMessageResponse>)> {
    match session_id {
        Some(session_id) if !session_id.trim().is_empty() => Ok(session_id),
        _ => Err(terminal_error(
            StatusCode::BAD_REQUEST,
            "session_id is required for terminal operations",
        )),
    }
}

fn parse_resize(
    metadata: Option<&serde_json::Value>,
) -> Result<(u16, u16), (StatusCode, Json<TerminalMessageResponse>)> {
    let Some(metadata) = metadata else {
        return Err(terminal_error(
            StatusCode::BAD_REQUEST,
            "resize metadata must include cols and rows",
        ));
    };

    let cols = metadata
        .get("cols")
        .and_then(|value| value.as_u64())
        .and_then(|value| u16::try_from(value).ok());
    let rows = metadata
        .get("rows")
        .and_then(|value| value.as_u64())
        .and_then(|value| u16::try_from(value).ok());

    match (cols, rows) {
        (Some(cols), Some(rows)) if cols > 0 && rows > 0 => Ok((cols, rows)),
        _ => Err(terminal_error(
            StatusCode::BAD_REQUEST,
            "resize metadata must include positive integer cols and rows",
        )),
    }
}

fn terminal_session_response(info: &PtySessionInfo) -> TerminalSessionResponse {
    TerminalSessionResponse {
        session_id: info.session_id.clone(),
        shell: info.shell.clone(),
        cols: info.cols,
        rows: info.rows,
        status: info.status,
        exit_code: info.exit_code,
        workdir: info.workdir.clone(),
        websocket_path: format!("/terminal/ws/{}", info.session_id),
    }
}

fn terminal_error(
    status: StatusCode,
    message: &str,
) -> (StatusCode, Json<TerminalMessageResponse>) {
    (
        status,
        Json(TerminalMessageResponse {
            success: false,
            message: message.to_string(),
            data: None,
        }),
    )
}

async fn handle_terminal_socket(
    socket: WebSocket,
    state: Arc<AppState>,
    session_id: String,
    client_id: String,
    mode: SessionAccessMode,
) {
    if state
        .terminal_runtime
        .mark_connected(&session_id, &client_id, mode)
        .await
        .is_err()
    {
        return;
    }
    let Ok((_info, snapshot, backlog, log_path)) = state.terminal_runtime.subscribe(&session_id).await else {
        return;
    };

    let (mut sender, mut receiver) = socket.split();

    if let Some(snapshot) = snapshot {
        let frame = serde_json::json!({
            "type": "snapshot",
            "snapshot": snapshot.snapshot,
            "cols": snapshot.cols,
            "rows": snapshot.rows,
            "updated_at": snapshot.updated_at,
        });
        if sender.send(Message::Text(frame.to_string())).await.is_err() {
            let _ = state
                .terminal_runtime
                .mark_disconnected(&session_id, Some(&client_id))
                .await;
            return;
        }
    }

    if !backlog.is_empty() && sender.send(Message::Text(backlog)).await.is_err() {
        let _ = state
            .terminal_runtime
            .mark_disconnected(&session_id, Some(&client_id))
            .await;
        return;
    }

    let Ok(mut offset) = current_file_len(&log_path).await else {
        let _ = state
            .terminal_runtime
            .mark_disconnected(&session_id, Some(&client_id))
            .await;
        return;
    };

    loop {
        tokio::select! {
            message = receiver.next() => {
                match message {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(Some(remaining_seconds)) =
                            state.terminal_runtime.timeout_warning(&session_id).await
                        {
                            let warning = serde_json::json!({
                                "type": "timeout_warning",
                                "remaining_seconds": remaining_seconds,
                                "message": format!("Session will timeout in {} minutes", remaining_seconds / 60),
                            });
                            let _ = sender.send(Message::Text(warning.to_string())).await;
                        }
                        if handle_socket_text(&state, &session_id, &client_id, mode, &text, &mut sender).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        if mode == SessionAccessMode::ReadOnly || !state.terminal_runtime.can_write(&session_id, &client_id).await {
                            let _ = sender.send(Message::Text(serde_json::json!({
                                "type": "write_denied",
                                "message": "terminal session is read-only for this client",
                            }).to_string())).await;
                            continue;
                        }
                        if state.terminal_runtime.write(&session_id, &data).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        let _ = state
                            .terminal_runtime
                            .mark_disconnected(&session_id, Some(&client_id))
                            .await;
                        break;
                    }
                    Some(Ok(Message::Ping(_))) | Some(Ok(Message::Pong(_))) => {
                        let _ = state.terminal_runtime.keepalive(&session_id).await;
                    }
                    Some(Err(_)) | None => break,
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(75)) => {
                match read_log_delta(&log_path, &mut offset).await {
                    Ok(Some(chunk)) => {
                        if sender.send(Message::Text(chunk)).await.is_err() {
                            break;
                        }
                    }
                    Ok(None) => {}
                    Err(_) => break,
                }
            }
        }
    }

    let _ = state
        .terminal_runtime
        .mark_disconnected(&session_id, Some(&client_id))
        .await;
    info!(session_id, "Terminal websocket disconnected");
}

async fn current_file_len(path: &PathBuf) -> std::io::Result<u64> {
    tokio::fs::metadata(path)
        .await
        .map(|metadata| metadata.len())
}

async fn read_log_delta(path: &PathBuf, offset: &mut u64) -> std::io::Result<Option<String>> {
    let metadata = match tokio::fs::metadata(path).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };

    if metadata.len() <= *offset {
        *offset = metadata.len();
        return Ok(None);
    }

    let mut file = tokio::fs::File::open(path).await?;
    file.seek(std::io::SeekFrom::Start(*offset)).await?;
    let mut buf = vec![0; (metadata.len() - *offset) as usize];
    file.read_exact(&mut buf).await?;
    *offset = metadata.len();
    Ok(Some(String::from_utf8_lossy(&buf).into_owned()))
}

async fn handle_socket_text(
    state: &Arc<AppState>,
    session_id: &str,
    client_id: &str,
    mode: SessionAccessMode,
    text: &str,
    sender: &mut futures::stream::SplitSink<WebSocket, Message>,
) -> Result<(), ()> {
    match serde_json::from_str::<TerminalWsCommand>(text) {
        Ok(TerminalWsCommand::Resize { cols, rows }) => state
            .terminal_runtime
            .resize(session_id, cols, rows)
            .await
            .map_err(|_| ()),
        Ok(TerminalWsCommand::Snapshot {
            snapshot,
            cols,
            rows,
        }) => state
            .terminal_runtime
            .update_snapshot(session_id, &snapshot, cols, rows)
            .await
            .map_err(|_| ()),
        Ok(TerminalWsCommand::Close) => state
            .terminal_runtime
            .close_session(session_id)
            .await
            .map_err(|_| ()),
        Ok(TerminalWsCommand::Keepalive) => state
            .terminal_runtime
            .keepalive(session_id)
            .await
            .map_err(|_| ()),
        Err(_) => {
            if mode == SessionAccessMode::ReadOnly
                || !state
                    .terminal_runtime
                    .can_write(session_id, client_id)
                    .await
            {
                sender
                    .send(Message::Text(
                        serde_json::json!({
                            "type": "write_denied",
                            "message": "terminal session is read-only for this client",
                        })
                        .to_string(),
                    ))
                    .await
                    .map_err(|_| ())?;
                Ok(())
            } else {
                state
                    .terminal_runtime
                    .write(session_id, text.as_bytes())
                    .await
                    .map_err(|_| ())
            }
        }
    }
}

fn authenticated_user_id(
    headers: &HeaderMap,
) -> Result<String, (StatusCode, Json<TerminalMessageResponse>)> {
    authorize_request(headers)
        .map(|context| context.user_id)
        .map_err(|error| terminal_error(StatusCode::UNAUTHORIZED, &error.to_string()))
}

fn ensure_terminal_backend(
    state: &Arc<AppState>,
) -> Result<(), (StatusCode, Json<TerminalMessageResponse>)> {
    state
        .terminal_runtime
        .ensure_backend_available()
        .map_err(|error| terminal_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))
}

fn client_id_from_headers(headers: &HeaderMap, fallback: Option<String>) -> String {
    headers
        .get("x-terminal-client-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or(fallback)
        .unwrap_or_else(|| "anonymous-client".to_string())
}

fn socket_mode(mode: Option<&str>) -> SessionAccessMode {
    match mode {
        Some("read") | Some("readonly") => SessionAccessMode::ReadOnly,
        _ => SessionAccessMode::ReadWrite,
    }
}

async fn ensure_owner(
    state: &Arc<AppState>,
    session_id: &str,
    owner_id: &str,
) -> Result<(), (StatusCode, Json<TerminalMessageResponse>)> {
    let Some(info) = state.terminal_runtime.get_session(session_id).await else {
        return Err(terminal_error(
            StatusCode::NOT_FOUND,
            &format!("Terminal session '{}' not found", session_id),
        ));
    };
    if info.owner_id != owner_id {
        return Err(terminal_error(
            StatusCode::FORBIDDEN,
            "terminal session belongs to a different owner",
        ));
    }
    Ok(())
}

fn session_status_response(info: &PtySessionInfo, can_reconnect: bool) -> SessionStatusResponse {
    SessionStatusResponse {
        exists: true,
        session_id: info.session_id.clone(),
        connection_state: format!("{:?}", info.connection_state).to_lowercase(),
        last_activity: info.last_activity.to_rfc3339(),
        can_reconnect,
        cols: info.cols,
        rows: info.rows,
        shell: info.shell.clone(),
        workdir: info.workdir.clone(),
    }
}

async fn terminal_root(
    state: &Arc<AppState>,
    session_id: &str,
) -> Result<PathBuf, (StatusCode, Json<TerminalMessageResponse>)> {
    let Some(info) = state.terminal_runtime.get_session(session_id).await else {
        return Err(terminal_error(
            StatusCode::NOT_FOUND,
            &format!("Terminal session '{}' not found", session_id),
        ));
    };
    Ok(PathBuf::from(info.workdir.unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("/tmp"))
            .to_string_lossy()
            .into_owned()
    })))
}

fn resolve_terminal_path(
    base: &StdPath,
    raw_path: &str,
) -> Result<PathBuf, (StatusCode, Json<TerminalMessageResponse>)> {
    let base = normalize_absolute_path(base);
    let relative = normalize_request_path(raw_path, &base)?;
    Ok(base.join(relative))
}

fn normalize_request_path(
    raw_path: &str,
    base: &StdPath,
) -> Result<PathBuf, (StatusCode, Json<TerminalMessageResponse>)> {
    let candidate = PathBuf::from(raw_path);
    let relative = if candidate.is_absolute() {
        let normalized = normalize_absolute_path(&candidate);
        normalized
            .strip_prefix(base)
            .map(PathBuf::from)
            .map_err(|_| {
                terminal_error(
                    StatusCode::FORBIDDEN,
                    "terminal file access is restricted to the session root",
                )
            })?
    } else {
        normalize_relative_path(&candidate)
            .map_err(|message| terminal_error(StatusCode::BAD_REQUEST, &message))?
    };
    Ok(relative)
}

fn normalize_relative_path(path: &StdPath) -> Result<PathBuf, String> {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::Normal(part) => normalized.push(part),
            std::path::Component::ParentDir => {
                if !normalized.pop() {
                    return Err("path cannot escape the session root".to_string());
                }
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err("absolute paths must stay within the session root".to_string());
            }
        }
    }
    Ok(normalized)
}

fn normalize_absolute_path(path: &StdPath) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::RootDir => normalized.push(StdPath::new("/")),
            std::path::Component::CurDir => {}
            std::path::Component::Normal(part) => normalized.push(part),
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            std::path::Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
        }
    }
    normalized
}

async fn terminal_file_entry(path: PathBuf) -> Result<TerminalFileEntry, anyhow::Error> {
    let metadata = tokio::fs::metadata(&path)
        .await
        .with_context(|| format!("stat {}", path.display()))?;
    let modified = metadata
        .modified()
        .ok()
        .map(chrono::DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();
    let mime_type = if metadata.is_file() {
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| match ext {
                "txt" | "md" | "rs" | "ts" | "tsx" | "js" | "jsx" | "json" | "yaml" | "yml"
                | "toml" | "py" | "sh" => "text/plain",
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "pdf" => "application/pdf",
                _ => "application/octet-stream",
            })
            .map(str::to_string)
    } else {
        None
    };

    Ok(TerminalFileEntry {
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        path: path.to_string_lossy().into_owned(),
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        modified,
        permissions: Some(metadata.permissions().mode()),
        mime_type,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rails::RailsState;
    use crate::vm_session_routes::new_vm_session_store;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use futures::{sink::SinkExt, stream::StreamExt};
    use hmac::{Hmac, Mac};
    use serde_json::Value;
    use sha2::Sha256;
    use std::path::PathBuf;
    use std::sync::Once;
    use tokio::net::TcpListener;
    use tokio::time::{timeout, Duration};
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

    type TestHmacSha256 = Hmac<Sha256>;

    const TEST_JWT_SECRET: &str = "allternit-terminal-test-secret";
    const TEST_JWT_AUDIENCE: &str = "allternit-terminal-tests";

    fn init_auth_env() {
        static AUTH_ENV: Once = Once::new();
        AUTH_ENV.call_once(|| unsafe {
            std::env::set_var("JWT_SECRET", TEST_JWT_SECRET);
            std::env::set_var("JWT_AUDIENCE", TEST_JWT_AUDIENCE);
            std::env::remove_var("ALLOW_INSECURE_TOKENS");
            std::env::remove_var("ALLOW_DEV_TOKEN");
        });
    }

    fn test_auth_token(user_id: &str) -> String {
        let now = chrono::Utc::now().timestamp();
        let header = URL_SAFE_NO_PAD.encode(r#"{"alg":"HS256","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(
            serde_json::json!({
                "sub": user_id,
                "aud": TEST_JWT_AUDIENCE,
                "iat": now,
                "nbf": now - 5,
                "exp": now + 3600,
            })
            .to_string(),
        );
        let signing_input = format!("{}.{}", header, payload);
        let mut mac =
            TestHmacSha256::new_from_slice(TEST_JWT_SECRET.as_bytes()).expect("create test hmac");
        mac.update(signing_input.as_bytes());
        let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
        format!("{}.{}.{}", header, payload, signature)
    }

    fn bearer_auth(user_id: &str) -> String {
        format!("Bearer {}", test_auth_token(user_id))
    }

    async fn spawn_terminal_app_with_root_and_config(
        root_dir: PathBuf,
        config: crate::pty::PtyConfig,
    ) -> (String, tokio::task::JoinHandle<()>) {
        spawn_terminal_app_with_options(root_dir, config, None).await
    }

    async fn spawn_terminal_app_with_options(
        root_dir: PathBuf,
        config: crate::pty::PtyConfig,
        tmux_bin_override: Option<PathBuf>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        init_auth_env();
        std::fs::create_dir_all(&root_dir).expect("create rails test dir");

        let rails = RailsState::new(root_dir.clone())
            .await
            .expect("initialize rails state");
        let state = Arc::new(AppState {
            vm_driver: None,
            rails,
            vm_sessions: new_vm_session_store(),
            terminal_runtime: Arc::new(crate::terminal_runtime::TmuxTerminalRuntime::new(
                crate::pty::PtyManager::new_with_config_and_tmux_bin(
                    root_dir.join("terminal-sessions"),
                    config,
                    tmux_bin_override,
                ),
            )),
        });

        let app = Router::new().nest("/terminal", terminal_router().with_state(state));
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind test listener");
        let addr = listener.local_addr().expect("read listener addr");
        let server = tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("serve terminal app");
        });

        (format!("http://{}", addr), server)
    }

    async fn spawn_terminal_app_with_root(
        root_dir: PathBuf,
    ) -> (String, tokio::task::JoinHandle<()>) {
        spawn_terminal_app_with_root_and_config(root_dir, crate::pty::PtyConfig::default()).await
    }

    async fn spawn_terminal_app() -> (String, tokio::task::JoinHandle<()>) {
        spawn_terminal_app_with_root(
            std::env::temp_dir().join(format!("allternit-api-terminal-test-{}", Uuid::new_v4())),
        )
        .await
    }

    async fn read_ws_text(
        socket: &mut tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    ) -> String {
        loop {
            let message = timeout(Duration::from_secs(10), socket.next())
                .await
                .expect("timed out waiting for websocket message")
                .expect("websocket closed unexpectedly")
                .expect("websocket message error");
            if let WsMessage::Text(text) = message {
                return text.to_string();
            }
        }
    }

    async fn wait_for_output(
        socket: &mut tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        needle: &str,
    ) {
        for _ in 0..30 {
            let message = read_ws_text(socket).await;
            if message.contains(needle) {
                return;
            }
        }
        panic!("did not receive terminal output containing '{}'", needle);
    }

    async fn wait_for_text_message(
        socket: &mut tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        needle: &str,
    ) {
        for _ in 0..30 {
            let message = read_ws_text(socket).await;
            if message.contains(needle) {
                return;
            }
        }
        panic!("did not receive websocket message containing '{}'", needle);
    }

    #[tokio::test]
    async fn terminal_session_supports_http_input_and_websocket_streaming() {
        let (base_url, server) = spawn_terminal_app().await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let ws_url = format!(
            "ws://{}/terminal/ws/{}",
            base_url.trim_start_matches("http://"),
            session_id
        );
        let mut request = ws_url.into_client_request().expect("terminal ws request");
        request.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut socket, _) = connect_async(request)
            .await
            .expect("connect terminal websocket");

        let input_response = client
            .post(format!("{}/terminal/input", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "session_id": session_id,
                "content": "printf 'terminal-http-test\\n'\n",
            }))
            .send()
            .await
            .expect("send terminal input");
        assert_eq!(input_response.status().as_u16(), StatusCode::OK.as_u16());

        wait_for_output(&mut socket, "terminal-http-test").await;

        socket
            .send(WsMessage::Text(
                serde_json::json!({
                    "type": "resize",
                    "cols": 100,
                    "rows": 30,
                })
                .to_string(),
            ))
            .await
            .expect("send resize over websocket");
        let mut status_body = None;
        for _ in 0..10 {
            let response = client
                .get(format!(
                    "{}/terminal/sessions/{}/status",
                    base_url, session_id
                ))
                .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
                .send()
                .await
                .expect("get terminal session status");
            assert_eq!(response.status().as_u16(), StatusCode::OK.as_u16());
            let body: Value = response.json().await.expect("status response json");
            if body["cols"].as_u64() == Some(100) && body["rows"].as_u64() == Some(30) {
                status_body = Some(body);
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        let status_body = status_body.expect("status should reflect resize");
        assert_eq!(status_body["can_reconnect"].as_bool(), Some(false));
        assert_eq!(status_body["connection_state"].as_str(), Some("connected"));

        let close_response = client
            .post(format!("{}/terminal/message", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "message_type": "close",
                "session_id": session_id,
            }))
            .send()
            .await
            .expect("close terminal session");
        assert_eq!(close_response.status().as_u16(), StatusCode::OK.as_u16());

        let missing_status = client
            .get(format!(
                "{}/terminal/sessions/{}/status",
                base_url, session_id
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("get missing terminal session status");
        assert_eq!(
            missing_status.status().as_u16(),
            StatusCode::NOT_FOUND.as_u16()
        );
        server.abort();
    }

    #[tokio::test]
    async fn terminal_session_survives_server_restart_and_reconnects() {
        let root_dir =
            std::env::temp_dir().join(format!("allternit-api-terminal-restart-test-{}", Uuid::new_v4()));
        let client = reqwest::Client::new();

        let (base_url_1, server_1) = spawn_terminal_app_with_root(root_dir.clone()).await;
        let create_response = client
            .post(format!("{}/terminal/sessions", base_url_1))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let ws_url_1 = format!(
            "ws://{}/terminal/ws/{}",
            base_url_1.trim_start_matches("http://"),
            session_id
        );
        let mut request_1 = ws_url_1.into_client_request().expect("restart ws request");
        request_1.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut socket_1, _) = connect_async(request_1).await.expect("connect websocket");
        client
            .post(format!("{}/terminal/input", base_url_1))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "session_id": session_id,
                "content": "printf 'before-restart\\n'\n",
            }))
            .send()
            .await
            .expect("write before restart");
        wait_for_output(&mut socket_1, "before-restart").await;
        socket_1
            .close(None)
            .await
            .expect("close websocket before restart");
        tokio::time::sleep(Duration::from_millis(100)).await;
        server_1.abort();

        let (base_url_2, server_2) = spawn_terminal_app_with_root(root_dir).await;
        let status_response = client
            .get(format!(
                "{}/terminal/sessions/{}/status",
                base_url_2, session_id
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("get restarted status");
        assert_eq!(status_response.status().as_u16(), StatusCode::OK.as_u16());
        let status_body: Value = status_response.json().await.expect("status body");
        assert_eq!(status_body["exists"].as_bool(), Some(true));
        assert_eq!(status_body["can_reconnect"].as_bool(), Some(true));
        assert_eq!(
            status_body["connection_state"].as_str(),
            Some("disconnected")
        );

        let ws_url_2 = format!(
            "ws://{}/terminal/ws/{}",
            base_url_2.trim_start_matches("http://"),
            session_id
        );
        let mut request_2 = ws_url_2.into_client_request().expect("reconnect request");
        request_2.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut socket_2, _) = connect_async(request_2).await.expect("reconnect websocket");
        wait_for_output(&mut socket_2, "before-restart").await;
        client
            .post(format!("{}/terminal/input", base_url_2))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "session_id": session_id,
                "content": "printf 'after-restart\\n'\n",
            }))
            .send()
            .await
            .expect("write after restart");
        wait_for_output(&mut socket_2, "after-restart").await;

        let close_response = client
            .post(format!("{}/terminal/message", base_url_2))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "message_type": "close",
                "session_id": session_id,
            }))
            .send()
            .await
            .expect("close session after restart");
        assert_eq!(close_response.status().as_u16(), StatusCode::OK.as_u16());
        server_2.abort();
    }

    #[tokio::test]
    async fn terminal_file_routes_support_basic_browser_operations() {
        let (base_url, server) = spawn_terminal_app().await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let mkdir_response = client
            .post(format!(
                "{}/terminal/{}/files/mkdir?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("mkdir response");
        assert_eq!(
            mkdir_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let upload_response = client
            .post(format!(
                "{}/terminal/{}/files/upload?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test/hello.txt")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .body("hello from file api")
            .send()
            .await
            .expect("upload response");
        assert_eq!(
            upload_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let list_response = client
            .get(format!(
                "{}/terminal/{}/files/list?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("list response");
        assert_eq!(list_response.status().as_u16(), StatusCode::OK.as_u16());
        let list_body: Value = list_response.json().await.expect("list json");
        let entries = list_body["entries"].as_array().expect("entries array");
        assert!(entries
            .iter()
            .any(|entry| entry["name"].as_str() == Some("hello.txt")));

        let stat_response = client
            .get(format!(
                "{}/terminal/{}/files/stat?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test/hello.txt")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("stat response");
        assert_eq!(stat_response.status().as_u16(), StatusCode::OK.as_u16());
        let stat_body: Value = stat_response.json().await.expect("stat json");
        assert_eq!(stat_body["is_dir"].as_bool(), Some(false));

        let download_response = client
            .get(format!(
                "{}/terminal/{}/files/download?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test/hello.txt")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("download response");
        assert_eq!(download_response.status().as_u16(), StatusCode::OK.as_u16());
        let download_body = download_response.text().await.expect("download body");
        assert_eq!(download_body, "hello from file api");

        let delete_response = client
            .delete(format!(
                "{}/terminal/{}/files?path={}",
                base_url,
                session_id,
                urlencoding::encode("allternit-terminal-test")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("delete response");
        assert_eq!(
            delete_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let close_response = client
            .delete(format!("{}/terminal/{}", base_url, session_id))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("compat delete response");
        assert_eq!(
            close_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );
        server.abort();
    }

    #[tokio::test]
    async fn terminal_file_routes_reject_paths_outside_session_root() {
        let session_root =
            std::env::temp_dir().join(format!("allternit-api-terminal-path-test-{}", Uuid::new_v4()));
        let (base_url, server) = spawn_terminal_app_with_root(session_root.clone()).await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": session_root,
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let forbidden_download = client
            .get(format!(
                "{}/terminal/{}/files/download?path={}",
                base_url,
                session_id,
                urlencoding::encode("/etc/hosts")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("download outside root");
        assert_eq!(
            forbidden_download.status().as_u16(),
            StatusCode::FORBIDDEN.as_u16()
        );

        let forbidden_upload = client
            .post(format!(
                "{}/terminal/{}/files/upload?path={}",
                base_url,
                session_id,
                urlencoding::encode("../escape.txt")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .body("nope")
            .send()
            .await
            .expect("upload outside root");
        assert_eq!(
            forbidden_upload.status().as_u16(),
            StatusCode::BAD_REQUEST.as_u16()
        );

        server.abort();
    }

    #[tokio::test]
    async fn terminal_sessions_enforce_owner_isolation() {
        let (base_url, server) = spawn_terminal_app().await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let forbidden_status = client
            .get(format!(
                "{}/terminal/sessions/{}/status",
                base_url, session_id
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-b"))
            .send()
            .await
            .expect("forbidden status response");
        assert_eq!(
            forbidden_status.status().as_u16(),
            StatusCode::FORBIDDEN.as_u16()
        );

        let allowed_status = client
            .get(format!(
                "{}/terminal/sessions/{}/status",
                base_url, session_id
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("allowed status response");
        assert_eq!(allowed_status.status().as_u16(), StatusCode::OK.as_u16());

        let owner_a_list = client
            .get(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("owner-a list response");
        assert_eq!(owner_a_list.status().as_u16(), StatusCode::OK.as_u16());
        let owner_a_body: Value = owner_a_list.json().await.expect("owner-a list json");
        assert_eq!(
            owner_a_body["data"]["sessions"]
                .as_array()
                .map(|sessions| sessions.len()),
            Some(1)
        );

        let owner_b_list = client
            .get(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-b"))
            .send()
            .await
            .expect("owner-b list response");
        assert_eq!(owner_b_list.status().as_u16(), StatusCode::OK.as_u16());
        let owner_b_body: Value = owner_b_list.json().await.expect("owner-b list json");
        assert_eq!(
            owner_b_body["data"]["sessions"]
                .as_array()
                .map(|sessions| sessions.len()),
            Some(0)
        );

        let close_response = client
            .delete(format!("{}/terminal/{}", base_url, session_id))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("close session");
        assert_eq!(
            close_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );
        server.abort();
    }

    #[tokio::test]
    async fn terminal_health_reports_tmux_backend() {
        let (base_url, server) = spawn_terminal_app().await;
        let client = reqwest::Client::new();

        let health_response = client
            .get(format!("{}/terminal/health", base_url))
            .send()
            .await
            .expect("health response");
        assert_eq!(health_response.status().as_u16(), StatusCode::OK.as_u16());
        let health_body: Value = health_response.json().await.expect("health json");
        assert_eq!(health_body["tmux_available"].as_bool(), Some(true));
        assert!(health_body["state_dir"].as_str().is_some());

        server.abort();
    }

    #[tokio::test]
    async fn terminal_backend_unavailable_returns_degraded_health_and_503() {
        let root_dir =
            std::env::temp_dir().join(format!("allternit-api-terminal-degraded-test-{}", Uuid::new_v4()));
        let (base_url, server) = spawn_terminal_app_with_options(
            root_dir,
            crate::pty::PtyConfig::default(),
            Some(PathBuf::from("/definitely/missing/tmux")),
        )
        .await;
        let client = reqwest::Client::new();

        let health_response = client
            .get(format!("{}/terminal/health", base_url))
            .send()
            .await
            .expect("health response");
        assert_eq!(health_response.status().as_u16(), StatusCode::OK.as_u16());
        let health_body: Value = health_response.json().await.expect("health json");
        assert_eq!(health_body["tmux_available"].as_bool(), Some(false));
        assert_eq!(
            health_body["backend_error"].as_str(),
            Some("tmux not found at /definitely/missing/tmux")
        );

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::SERVICE_UNAVAILABLE.as_u16()
        );

        server.abort();
    }

    #[tokio::test]
    async fn terminal_websocket_denies_read_only_writes() {
        let root_dir =
            std::env::temp_dir().join(format!("allternit-api-terminal-timeout-test-{}", Uuid::new_v4()));
        let (base_url, server) = spawn_terminal_app_with_root_and_config(
            root_dir,
            crate::pty::PtyConfig {
                reconnection_window_seconds: 300,
                idle_timeout_seconds: 2,
                warning_window_seconds: 2,
            },
        )
        .await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        tokio::time::sleep(Duration::from_secs(1)).await;

        let ws_url = format!(
            "ws://{}/terminal/ws/{}?client_id=viewer-1&mode=read",
            base_url.trim_start_matches("http://"),
            session_id
        );
        let mut request = ws_url.into_client_request().expect("ws request");
        request.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut socket, _) = connect_async(request)
            .await
            .expect("connect readonly websocket");

        socket
            .send(WsMessage::Text("printf 'should-not-run\\n'\n".into()))
            .await
            .expect("send readonly input");

        wait_for_text_message(&mut socket, "\"type\":\"write_denied\"").await;

        let input_response = client
            .post(format!("{}/terminal/input", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "session_id": session_id,
                "content": "printf 'owner-http-write\\n'\n",
            }))
            .send()
            .await
            .expect("send owner input");
        assert_eq!(input_response.status().as_u16(), StatusCode::OK.as_u16());
        wait_for_output(&mut socket, "owner-http-write").await;

        server.abort();
    }

    #[tokio::test]
    async fn terminal_file_operations_are_audited() {
        let root_dir =
            std::env::temp_dir().join(format!("allternit-api-terminal-audit-test-{}", Uuid::new_v4()));
        let (base_url, server) = spawn_terminal_app_with_root(root_dir.clone()).await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let mkdir_response = client
            .post(format!(
                "{}/terminal/{}/files/mkdir?path={}",
                base_url,
                session_id,
                urlencoding::encode("audit-dir")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("mkdir response");
        assert_eq!(
            mkdir_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let upload_response = client
            .post(format!(
                "{}/terminal/{}/files/upload?path={}",
                base_url,
                session_id,
                urlencoding::encode("audit-dir/hello.txt")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .body("hello audit")
            .send()
            .await
            .expect("upload response");
        assert_eq!(
            upload_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let delete_response = client
            .delete(format!(
                "{}/terminal/{}/files?path={}",
                base_url,
                session_id,
                urlencoding::encode("audit-dir")
            ))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .send()
            .await
            .expect("delete response");
        assert_eq!(
            delete_response.status().as_u16(),
            StatusCode::NO_CONTENT.as_u16()
        );

        let audit_log = root_dir.join("terminal-sessions").join("audit.log");
        let audit_contents = tokio::fs::read_to_string(audit_log)
            .await
            .expect("read audit log");
        assert!(audit_contents.contains("\"event\":\"directory_created\""));
        assert!(audit_contents.contains("\"event\":\"file_uploaded\""));
        assert!(audit_contents.contains("\"event\":\"file_deleted\""));

        server.abort();
    }

    #[tokio::test]
    async fn terminal_websocket_allows_only_one_writer_client() {
        let (base_url, server) = spawn_terminal_app().await;
        let client = reqwest::Client::new();

        let create_response = client
            .post(format!("{}/terminal/sessions", base_url))
            .header(reqwest::header::AUTHORIZATION, bearer_auth("owner-a"))
            .json(&serde_json::json!({
                "cols": 80,
                "rows": 24,
                "workdir": PathBuf::from("/tmp"),
            }))
            .send()
            .await
            .expect("create terminal session");
        assert_eq!(
            create_response.status().as_u16(),
            StatusCode::CREATED.as_u16()
        );
        let create_body: Value = create_response.json().await.expect("create response json");
        let session_id = create_body["sessionId"]
            .as_str()
            .expect("session id")
            .to_string();

        let writer_one_url = format!(
            "ws://{}/terminal/ws/{}?client_id=writer-1&mode=write",
            base_url.trim_start_matches("http://"),
            session_id
        );
        let mut request_one = writer_one_url
            .into_client_request()
            .expect("writer one request");
        request_one.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut writer_one, _) = connect_async(request_one)
            .await
            .expect("connect writer one");

        let writer_two_url = format!(
            "ws://{}/terminal/ws/{}?client_id=writer-2&mode=write",
            base_url.trim_start_matches("http://"),
            session_id
        );
        let mut request_two = writer_two_url
            .into_client_request()
            .expect("writer two request");
        request_two.headers_mut().insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_str(&bearer_auth("owner-a")).expect("auth header"),
        );
        let (mut writer_two, _) = connect_async(request_two)
            .await
            .expect("connect writer two");

        writer_two
            .send(WsMessage::Text(
                "printf 'writer-two-should-fail\\n'\n".into(),
            ))
            .await
            .expect("send second writer input");
        wait_for_text_message(&mut writer_two, "\"type\":\"write_denied\"").await;

        writer_one
            .send(WsMessage::Text("printf 'writer-one-ok\\n'\n".into()))
            .await
            .expect("send first writer input");
        wait_for_output(&mut writer_one, "writer-one-ok").await;

        server.abort();
    }
}
