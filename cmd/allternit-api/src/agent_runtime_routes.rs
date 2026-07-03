//! Agent Runtime API routes

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::agent_execution::{AgentRuntime, JobSpec, LocalAgentRuntime};
use crate::AppState;
use crate::auth::AuthUser;
use crate::error::ApiError;

pub fn agent_runtime_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-runtimes", get(list_runtimes).post(create_runtime))
        .route(
            "/agent-runtimes/:id",
            get(get_runtime).patch(update_runtime).delete(delete_runtime),
        )
        .route("/agent-runtimes/:id/heartbeat", post(heartbeat_runtime))
        .route(
            "/agent-runtimes/:id/jobs",
            get(list_runtime_jobs).post(create_runtime_job),
        )
}

#[derive(Serialize)]
struct RuntimeRow {
    id: String,
    name: String,
    host: String,
    agent_clis: Option<String>,
    status: String,
    last_heartbeat: Option<String>,
    workspace_id: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct CreateRuntimeBody {
    name: String,
    host: String,
    #[serde(alias = "agentClis")]
    agent_clis: Option<Vec<String>>,
    #[serde(alias = "workspaceId")]
    workspace_id: Option<String>,
}

#[derive(Deserialize)]
struct UpdateRuntimeBody {
    name: Option<String>,
    host: Option<String>,
    status: Option<String>,
    #[serde(alias = "agentClis")]
    agent_clis: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct HeartbeatBody {
    status: Option<String>,
}

#[derive(Serialize)]
struct JobRow {
    id: String,
    runtime_id: String,
    status: String,
    command: Option<String>,
    args: Option<String>,
    env: Option<String>,
    working_dir: Option<String>,
    result: Option<String>,
    exit_code: Option<i32>,
    stdout: Option<String>,
    stderr: Option<String>,
    duration_ms: Option<i64>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Deserialize)]
struct CreateJobBody {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: std::collections::HashMap<String, String>,
    working_dir: Option<String>,
}

async fn list_runtimes(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, host, agent_clis, status, last_heartbeat, workspace_id, created_at, updated_at
             FROM agent_runtimes WHERE user_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(RuntimeRow {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                agent_clis: row.get(3)?,
                status: row.get(4)?,
                last_heartbeat: row.get(5)?,
                workspace_id: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"runtimes": data})).into_response(),
        _ => Json(json!({"runtimes": []})).into_response(),
    }
}

async fn create_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateRuntimeBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name = body.name.clone();
    let clis = body.agent_clis.map(|c| serde_json::to_string(&c).unwrap_or_default());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agent_runtimes (id, user_id, name, host, agent_clis, status, workspace_id)
             VALUES (?1, ?2, ?3, ?4, ?5, 'online', ?6)",
            params![id2, user_id, body.name, body.host, clis, body.workspace_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"runtime": {"id": id, "name": name, "status": "online"}}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating runtime: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn get_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;

    let runtime = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, host, agent_clis, status, last_heartbeat, workspace_id, created_at, updated_at
             FROM agent_runtimes WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(RuntimeRow {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                agent_clis: row.get(3)?,
                status: row.get(4)?,
                last_heartbeat: row.get(5)?,
                workspace_id: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => ApiError::NotFound("runtime not found".to_string()),
        _ => ApiError::DbError(e.to_string()),
    })?;

    Ok(Json(json!({ "runtime": runtime })))
}

async fn update_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRuntimeBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if body.name.is_none() && body.host.is_none() && body.status.is_none() && body.agent_clis.is_none() {
        return Err(ApiError::BadRequest("no fields to update".to_string()));
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let runtime_id = id.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sets = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(name) = body.name {
            sets.push("name = ?".to_string());
            params_vec.push(Box::new(name));
        }
        if let Some(host) = body.host {
            sets.push("host = ?".to_string());
            params_vec.push(Box::new(host));
        }
        if let Some(status) = body.status {
            sets.push("status = ?".to_string());
            params_vec.push(Box::new(status));
        }
        if let Some(clis) = body.agent_clis {
            sets.push("agent_clis = ?".to_string());
            params_vec.push(Box::new(serde_json::to_string(&clis).unwrap_or_default()));
        }

        sets.push("updated_at = CURRENT_TIMESTAMP".to_string());

        let sql = format!("UPDATE agent_runtimes SET {} WHERE id = ? AND user_id = ?", sets.join(", "));
        let mut params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        params_ref.push(&runtime_id);
        params_ref.push(&user_id);

        let affected = conn.execute(&sql, params_ref.as_slice())?;
        Ok::<_, rusqlite::Error>(affected)
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    Ok(Json(json!({ "id": id, "updated": true })))
}

async fn heartbeat_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<HeartbeatBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;
    let runtime_id = id.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let affected = if let Some(status) = body.status {
            conn.execute(
                "UPDATE agent_runtimes SET last_heartbeat = CURRENT_TIMESTAMP, status = ?1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?2 AND user_id = ?3",
                params![status, runtime_id, user_id],
            )?
        } else {
            conn.execute(
                "UPDATE agent_runtimes SET last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1 AND user_id = ?2",
                params![runtime_id, user_id],
            )?
        };
        Ok::<_, rusqlite::Error>(affected)
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    Ok(Json(json!({ "id": id, "heartbeat": "ok" })))
}

async fn delete_runtime(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;

    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM agent_runtimes WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn list_runtime_jobs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(runtime_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;

    let jobs = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        verify_runtime_access(&conn, &runtime_id, &user_id)?;
        let mut stmt = conn.prepare(
            "SELECT id, runtime_id, status, command, args, env, working_dir, result, exit_code, stdout, stderr, duration_ms, created_at, updated_at
             FROM agent_runtime_jobs WHERE runtime_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![runtime_id], |row| {
            Ok(JobRow {
                id: row.get(0)?,
                runtime_id: row.get(1)?,
                status: row.get(2)?,
                command: row.get(3)?,
                args: row.get(4)?,
                env: row.get(5)?,
                working_dir: row.get(6)?,
                result: row.get(7)?,
                exit_code: row.get(8)?,
                stdout: row.get(9)?,
                stderr: row.get(10)?,
                duration_ms: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    Ok(Json(json!({ "jobs": jobs })))
}

async fn create_runtime_job(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(runtime_id): Path<String>,
    Json(body): Json<CreateJobBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let job_id = uuid::Uuid::new_v4().to_string();
    let job_id2 = job_id.clone();
    let runtime_id2 = runtime_id.clone();
    let command = body.command.clone();
    let args_json = serde_json::to_string(&body.args).unwrap_or_default();
    let env_json = serde_json::to_string(&body.env).unwrap_or_default();
    let working_dir = body.working_dir.clone();

    // Persist the queued job and verify ownership inside the DB task.
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        verify_runtime_access(&conn, &runtime_id2, &user_id)?;
        conn.execute(
            "INSERT INTO agent_runtime_jobs (id, runtime_id, user_id, status, command, args, env, working_dir)
             VALUES (?1, ?2, ?3, 'queued', ?4, ?5, ?6, ?7)",
            params![job_id2, runtime_id2, user_id, command, args_json, env_json, working_dir],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    // Dispatch the job using the local agent runtime.
    let runtime = LocalAgentRuntime::new(state.vm_driver.clone());
    let dispatch_result = runtime
        .dispatch(JobSpec {
            command: body.command,
            args: body.args,
            env: body.env,
            working_dir: body.working_dir,
        })
        .await;

    let (status, exit_code, stdout, stderr, duration_ms, result_json) = match dispatch_result {
        Ok(result) => {
            let status = if result.exit_code == 0 { "completed" } else { "failed" };
            let result_json = serde_json::to_string(&result).unwrap_or_default();
            (
                status.to_string(),
                Some(result.exit_code),
                Some(result.stdout),
                Some(result.stderr),
                Some(result.duration_ms as i64),
                Some(result_json),
            )
        }
        Err(e) => {
            warn!("Job dispatch failed: {}", e);
            (
                "failed".to_string(),
                None,
                None,
                Some(e.to_string()),
                None,
                None,
            )
        }
    };

    // Update the job record with the result.
    let db = state.db.clone();
    let job_id3 = job_id.clone();
    let db_status = status.clone();
    let db_stdout = stdout.clone();
    let db_stderr = stderr.clone();
    let db_result_json = result_json.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE agent_runtime_jobs SET status = ?1, exit_code = ?2, stdout = ?3, stderr = ?4, duration_ms = ?5, result = ?6, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?7",
            params![db_status, exit_code, db_stdout, db_stderr, duration_ms, db_result_json, job_id3],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;

    Ok(Json(json!({
        "job": {
            "id": job_id,
            "runtime_id": runtime_id,
            "status": status,
            "exit_code": exit_code,
            "stdout": stdout,
            "stderr": stderr,
            "duration_ms": duration_ms,
        }
    })))
}

fn verify_runtime_access(
    conn: &rusqlite::Connection,
    runtime_id: &str,
    user_id: &str,
) -> Result<(), rusqlite::Error> {
    let exists: bool = conn.query_row(
        "SELECT 1 FROM agent_runtimes WHERE id = ?1 AND user_id = ?2 LIMIT 1",
        params![runtime_id, user_id],
        |_| Ok(true),
    ).unwrap_or(false);

    if !exists {
        // Return a custom error so callers can map it to a 404.
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}
