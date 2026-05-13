use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use russh::client;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

use crate::AppState;
use crate::auth::AuthUser;

struct SshClient;

impl client::Handler for SshClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        // TODO: verify against known_hosts in production
        Ok(true)
    }
}

pub fn ssh_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ssh", get(ssh_status))
        .route("/ssh-connections", get(list_ssh).post(create_ssh))
        .route("/ssh-connections/:id", get(get_ssh).put(update_ssh).delete(delete_ssh))
        .route("/ssh-connections/:id/connect", post(connect_ssh))
        .route("/ssh-connections/:id/disconnect", post(disconnect_ssh))
        .route("/ssh-connections/:id/execute", post(execute_ssh))
        .route("/ssh-connections/test", post(test_ssh))
}

async fn list_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!([]))).into_response(),
    };

    let mut stmt = match conn.prepare(
        "SELECT id, name, host, port, username, status, os, architecture, docker_installed, allternit_installed, allternit_version, last_connected_at, created_at, updated_at FROM ssh_connections WHERE user_id = ?1 ORDER BY created_at DESC"
    ) {
        Ok(s) => s,
        Err(_) => return (StatusCode::OK, Json(json!([]))).into_response(),
    };

    let connections: Vec<serde_json::Value> = match stmt.query_map([&user.user_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "host": row.get::<_, String>(2)?,
            "port": row.get::<_, i64>(3)?,
            "username": row.get::<_, String>(4)?,
            "status": row.get::<_, String>(5)?,
            "os": row.get::<_, Option<String>>(6)?,
            "architecture": row.get::<_, Option<String>>(7)?,
            "docker_installed": row.get::<_, i64>(8)? != 0,
            "allternit_installed": row.get::<_, i64>(9)? != 0,
            "allternit_version": row.get::<_, Option<String>>(10)?,
            "last_connected": row.get::<_, Option<String>>(11)?,
            "created_at": row.get::<_, String>(12)?,
            "updated_at": row.get::<_, String>(13)?,
        }))
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };

    (StatusCode::OK, Json(json!(connections))).into_response()
}

#[derive(Deserialize)]
struct CreateSsh {
    name: String,
    host: String,
    port: Option<i64>,
    username: String,
    auth_type: Option<String>,
    #[allow(dead_code)]
    private_key: Option<String>,
    #[allow(dead_code)]
    password: Option<String>,
}

async fn create_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSsh>,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))).into_response(),
    };

    let id = uuid::Uuid::new_v4().to_string();
    match conn.execute(
        "INSERT INTO ssh_connections (id, user_id, name, host, port, username, auth_type, encrypted_private_key, encrypted_password, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'disconnected')",
        rusqlite::params![&id, &user.user_id, &body.name, &body.host, body.port.unwrap_or(22), &body.username, body.auth_type.as_deref().unwrap_or("password"), body.private_key.as_deref().unwrap_or(""), body.password.as_deref().unwrap_or("")],
    ) {
        Ok(_) => (StatusCode::CREATED, Json(json!({
            "id": id,
            "name": body.name,
            "host": body.host,
            "port": body.port.unwrap_or(22),
            "username": body.username,
            "status": "disconnected",
        }))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create"}))).into_response(),
    }
}

async fn get_ssh(
    Path(id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
    };

    let result: Option<(String, String, String, i64, String, String)> = conn
        .query_row(
            "SELECT id, name, host, port, username, status FROM ssh_connections WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )
        .ok();

    match result {
        Some((id, name, host, port, username, status)) => {
            (StatusCode::OK, Json(json!({"id": id, "name": name, "host": host, "port": port, "username": username, "status": status}))).into_response()
        }
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Not found"}))).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateSsh {
    name: Option<String>,
    host: Option<String>,
    port: Option<i64>,
    username: Option<String>,
    auth_type: Option<String>,
}

async fn update_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateSsh>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE ssh_connections SET
                name = COALESCE(?1, name),
                host = COALESCE(?2, host),
                port = COALESCE(?3, port),
                username = COALESCE(?4, username),
                auth_type = COALESCE(?5, auth_type),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?6 AND user_id = ?7",
            params![body.name, body.host, body.port, body.username, body.auth_type, id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating ssh: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn delete_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM ssh_connections WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting ssh: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn connect_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE ssh_connections SET status = 'connected', last_connected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true, "status": "connected"})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error connecting ssh: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn disconnect_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE ssh_connections SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true, "status": "disconnected"})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error disconnecting ssh: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct ExecuteSsh {
    command: String,
}

#[derive(Deserialize)]
struct SshConnRow {
    host: String,
    port: i64,
    username: String,
    auth_type: String,
    encrypted_private_key: Option<String>,
    encrypted_password: Option<String>,
}

async fn execute_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ExecuteSsh>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let id2 = id.clone();

    let conn_row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let row = conn.query_row(
            "SELECT host, port, username, auth_type, encrypted_private_key, encrypted_password FROM ssh_connections WHERE id = ?1 AND user_id = ?2",
            params![id2, user_id],
            |row| {
                Ok(SshConnRow {
                    host: row.get(0)?,
                    port: row.get(1)?,
                    username: row.get(2)?,
                    auth_type: row.get(3)?,
                    encrypted_private_key: row.get(4)?,
                    encrypted_password: row.get(5)?,
                })
            },
        )?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    let conn_info = match conn_row {
        Ok(Ok(row)) => row,
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response();
        }
        Ok(Err(e)) => {
            warn!("DB error fetching ssh connection: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response();
        }
    };

    // Attempt SSH connection and execute command
    let config = Arc::new(client::Config::default());
    let sh = SshClient;
    let addr = (conn_info.host.as_str(), conn_info.port as u16);

    let mut handle = match client::connect(config, addr, sh).await {
        Ok(h) => h,
        Err(e) => {
            warn!("SSH connection failed to {}:{}: {}", conn_info.host, conn_info.port, e);
            return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "connection_failed", "message": e.to_string()}))).into_response();
        }
    };

    let auth_result = match conn_info.auth_type.as_str() {
        "password" => {
            let password = conn_info.encrypted_password.unwrap_or_default();
            if password.is_empty() {
                return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "missing_password"}))).into_response();
            }
            handle.authenticate_password(&conn_info.username, password).await
        }
        "private_key" => {
            let key_pem = conn_info.encrypted_private_key.unwrap_or_default();
            if key_pem.is_empty() {
                return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "missing_private_key"}))).into_response();
            }
            match russh::keys::decode_secret_key(&key_pem, None) {
                Ok(key) => {
                    let key_with_alg = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
                    handle.authenticate_publickey(&conn_info.username, key_with_alg).await
                }
                Err(e) => {
                    warn!("Failed to decode SSH private key: {}", e);
                    return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "invalid_private_key", "message": e.to_string()}))).into_response();
                }
            }
        }
        _ => {
            return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({"error": "unsupported_auth_type", "auth_type": conn_info.auth_type}))).into_response();
        }
    };

    match auth_result {
        Ok(russh::client::AuthResult::Success) => {}
        Ok(russh::client::AuthResult::Failure { .. }) => {
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "ssh_auth_failed"}))).into_response();
        }
        Err(e) => {
            warn!("SSH authentication error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "ssh_auth_error", "message": e.to_string()}))).into_response();
        }
    }

    let mut channel = match handle.channel_open_session().await {
        Ok(ch) => ch,
        Err(e) => {
            warn!("Failed to open SSH channel: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "channel_open_failed", "message": e.to_string()}))).into_response();
        }
    };

    if let Err(e) = channel.exec(true, body.command.as_str()).await {
        warn!("Failed to exec command on SSH channel: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "exec_failed", "message": e.to_string()}))).into_response();
    }

    let mut stdout = String::new();
    let mut stderr = String::new();
    let mut exit_code: Option<u32> = None;

    loop {
        match channel.wait().await {
            Some(russh::ChannelMsg::Data { data }) => {
                stdout.push_str(&String::from_utf8_lossy(&data));
            }
            Some(russh::ChannelMsg::ExtendedData { data, ext }) if ext == 1 => {
                stderr.push_str(&String::from_utf8_lossy(&data));
            }
            Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                exit_code = Some(exit_status);
            }
            Some(russh::ChannelMsg::Eof) | None => break,
            _ => {}
        }
    }

    let _ = handle.disconnect(russh::Disconnect::ByApplication, "done", "en").await;

    info!("SSH execute success on {}@{}: {}", conn_info.username, conn_info.host, body.command);

    Json(json!({
        "success": true,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
    })).into_response()
}

async fn test_ssh(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let connections = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, host, port FROM ssh_connections WHERE user_id = ?1"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, i64>(3)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    let conns = match connections {
        Ok(Ok(rows)) => rows,
        _ => {
            return (StatusCode::OK, Json(json!({"success": true, "connections": [], "latency_ms": 0}))).into_response();
        }
    };

    let mut results = Vec::new();
    let mut total_latency = 0u64;
    let mut reachable = 0usize;

    for (id, name, host, port) in conns {
        let start = std::time::Instant::now();
        let result = tokio::net::TcpStream::connect((host.as_str(), port as u16)).await;
        let latency_ms = start.elapsed().as_millis() as u64;
        total_latency += latency_ms;

        match result {
            Ok(_) => {
                reachable += 1;
                results.push(json!({
                    "id": id,
                    "name": name,
                    "host": host,
                    "port": port,
                    "reachable": true,
                    "latency_ms": latency_ms,
                }));
            }
            Err(e) => {
                results.push(json!({
                    "id": id,
                    "name": name,
                    "host": host,
                    "port": port,
                    "reachable": false,
                    "latency_ms": latency_ms,
                    "error": e.to_string(),
                }));
            }
        }
    }

    let avg_latency = if !results.is_empty() { total_latency / results.len() as u64 } else { 0 };

    Json(json!({
        "success": true,
        "connections": results,
        "reachable": reachable,
        "total": results.len(),
        "avg_latency_ms": avg_latency,
    })).into_response()
}


async fn ssh_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "ssh",
    }))
}
