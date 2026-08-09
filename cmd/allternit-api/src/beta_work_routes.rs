//! Self-hosted sandbox worker poll protocol (`/beta/work`).
//!
//! External workers (self-hosted sandbox runners) do not receive pushed
//! work; they poll for it. The protocol is intentionally small:
//!
//! 1. A caller enqueues a task with `POST /beta/work`, optionally tied to a
//!    session or a deployment, carrying a `sandbox_image` + `env` payload.
//! 2. A worker leases the oldest available task with
//!    `GET /beta/work/queue?worker_id=<id>`. Leasing is exclusive: the task
//!    moves to `leased` and is held for [`LEASE_SECONDS`]. A task whose
//!    lease expires without a heartbeat becomes eligible for another worker
//!    to lease (crash recovery).
//! 3. While executing, the worker calls
//!    `POST /beta/work/:id/heartbeat` (body `{"worker_id": "..."}`)
//!    periodically to renew the lease and mark the task `running`.
//! 4. On completion the worker calls `POST /beta/work/:id/ack` (body
//!    `{"worker_id": "...", "result": {...}}`) to report success, or
//!    `POST /beta/work/:id/stop` to cancel/fail the task and release it.
//!
//! Tasks are scoped to the authenticated caller's `user_id`, the same as
//! `beta_sessions` and `beta_deployments` — a self-hosted worker polls with
//! the owning user's own API credentials.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, error::ApiError, AppState};

/// How long a lease is held before it is eligible for another worker to
/// reclaim (i.e. the worker crashed or stalled without heartbeating).
const LEASE_SECONDS: i64 = 60;

fn empty_object() -> Value {
    json!({})
}

pub fn beta_work_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/beta/work", get(list_tasks).post(create_task))
        .route("/beta/work/queue", get(lease_task))
        .route("/beta/work/:id/heartbeat", post(heartbeat_task))
        .route("/beta/work/:id/ack", post(ack_task))
        .route("/beta/work/:id/stop", post(stop_task))
}

#[derive(Debug, Deserialize)]
struct CreateTaskBody {
    session_id: Option<String>,
    deployment_id: Option<String>,
    sandbox_image: Option<String>,
    #[serde(default = "empty_object")]
    env: Value,
    #[serde(default = "empty_object")]
    payload: Value,
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LeaseQuery {
    worker_id: String,
}

#[derive(Debug, Deserialize)]
struct HeartbeatBody {
    worker_id: String,
}

#[derive(Debug, Deserialize)]
struct AckBody {
    worker_id: String,
    #[serde(default)]
    result: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct StopBody {
    #[serde(default)]
    worker_id: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct TaskRow {
    id: String,
    session_id: Option<String>,
    deployment_id: Option<String>,
    status: String,
    payload: Value,
    sandbox_image: Option<String>,
    env: Value,
    lease_worker_id: Option<String>,
    lease_expires_at: Option<String>,
    result: Option<Value>,
    error: Option<String>,
    created_at: String,
    updated_at: String,
}

const TASK_SELECT: &str = "SELECT id, session_id, deployment_id, status, payload, sandbox_image,
    env, lease_worker_id, lease_expires_at, result, error, created_at, updated_at
    FROM beta_work_tasks";

fn read_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskRow> {
    let payload: String = row.get(4)?;
    let env: String = row.get(6)?;
    let result: Option<String> = row.get(9)?;
    Ok(TaskRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        deployment_id: row.get(2)?,
        status: row.get(3)?,
        payload: serde_json::from_str(&payload).unwrap_or_else(|_| json!({})),
        sandbox_image: row.get(5)?,
        env: serde_json::from_str(&env).unwrap_or_else(|_| json!({})),
        lease_worker_id: row.get(7)?,
        lease_expires_at: row.get(8)?,
        result: result.and_then(|value| serde_json::from_str(&value).ok()),
        error: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

async fn create_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateTaskBody>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    if !body.env.is_object() || !body.payload.is_object() {
        return Err(ApiError::BadRequest(
            "env and payload must be objects".into(),
        ));
    }
    let db = state.db.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let result_id = id.clone();
    let task = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        if let Some(session_id) = body.session_id.as_deref() {
            let exists = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM beta_sessions WHERE id = ?1 AND user_id = ?2)",
                params![session_id, user_id],
                |row| row.get::<_, bool>(0),
            )?;
            if !exists {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        if let Some(deployment_id) = body.deployment_id.as_deref() {
            let exists = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM beta_deployments WHERE id = ?1 AND user_id = ?2)",
                params![deployment_id, user_id],
                |row| row.get::<_, bool>(0),
            )?;
            if !exists {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }
        }
        conn.execute(
            "INSERT INTO beta_work_tasks
             (id, user_id, session_id, deployment_id, payload, sandbox_image, env)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                user_id,
                body.session_id,
                body.deployment_id,
                body.payload.to_string(),
                body.sandbox_image,
                body.env.to_string()
            ],
        )?;
        conn.query_row(&format!("{TASK_SELECT} WHERE id = ?1"), params![id], read_task)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            ApiError::BadRequest("session_id or deployment_id not found".into())
        }
        other => ApiError::DbError(other.to_string()),
    })?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"task": task, "id": result_id})),
    ))
}

async fn list_tasks(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(&format!(
            "{TASK_SELECT} WHERE user_id = ?1 AND (?2 IS NULL OR status = ?2)
             ORDER BY created_at DESC"
        ))?;
        let rows = stmt
            .query_map(params![user.user_id, query.status], read_task)?
            .collect::<Result<Vec<TaskRow>, _>>()?;
        Ok::<Vec<TaskRow>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    Ok(Json(json!({"tasks": rows})))
}

async fn lease_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<LeaseQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;
    let worker_id = query.worker_id;
    let now = Utc::now();
    let lease_expires_at = now + Duration::seconds(LEASE_SECONDS);
    let task = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;
        let candidate = tx
            .query_row(
                "SELECT id FROM beta_work_tasks
                 WHERE user_id = ?1
                   AND (status = 'queued'
                        OR (status IN ('leased', 'running') AND lease_expires_at < ?2))
                 ORDER BY created_at ASC LIMIT 1",
                params![user_id, now.to_rfc3339()],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let Some(id) = candidate else {
            return Ok::<Option<TaskRow>, rusqlite::Error>(None);
        };
        tx.execute(
            "UPDATE beta_work_tasks SET status = 'leased', lease_worker_id = ?1,
             lease_expires_at = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            params![worker_id, lease_expires_at.to_rfc3339(), id],
        )?;
        let task = tx.query_row(&format!("{TASK_SELECT} WHERE id = ?1"), params![id], read_task)?;
        tx.commit()?;
        Ok(Some(task))
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({"task": task})))
}

async fn load_leased_task(
    db: crate::db::DbHandle,
    user_id: String,
    id: String,
    worker_id: String,
) -> Result<(), ApiError> {
    let owns_lease = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM beta_work_tasks
             WHERE id = ?1 AND user_id = ?2 AND lease_worker_id = ?3
               AND status IN ('leased', 'running'))",
            params![id, user_id, worker_id],
            |row| row.get::<_, bool>(0),
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::from)?;
    if !owns_lease {
        return Err(ApiError::NotFound(
            "no active lease for this task and worker".into(),
        ));
    }
    Ok(())
}

async fn heartbeat_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<HeartbeatBody>,
) -> Result<Json<Value>, ApiError> {
    load_leased_task(
        state.db.clone(),
        user.user_id.clone(),
        id.clone(),
        body.worker_id.clone(),
    )
    .await?;
    let db = state.db.clone();
    let lease_expires_at = Utc::now() + Duration::seconds(LEASE_SECONDS);
    let task = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE beta_work_tasks SET status = 'running', lease_expires_at = ?1,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND lease_worker_id = ?3",
            params![lease_expires_at.to_rfc3339(), id, body.worker_id],
        )?;
        conn.query_row(&format!("{TASK_SELECT} WHERE id = ?1"), params![id], read_task)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({"task": task})))
}

async fn ack_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AckBody>,
) -> Result<Json<Value>, ApiError> {
    load_leased_task(
        state.db.clone(),
        user.user_id.clone(),
        id.clone(),
        body.worker_id.clone(),
    )
    .await?;
    let db = state.db.clone();
    let task = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE beta_work_tasks SET status = 'succeeded', result = ?1, lease_worker_id = NULL,
             lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND lease_worker_id = ?3",
            params![body.result.map(|v| v.to_string()), id, body.worker_id],
        )?;
        conn.query_row(&format!("{TASK_SELECT} WHERE id = ?1"), params![id], read_task)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({"task": task})))
}

async fn stop_task(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<StopBody>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;
    let affected = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE beta_work_tasks SET status = 'cancelled', error = ?1, lease_worker_id = NULL,
             lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2 AND user_id = ?3
               AND (?4 IS NULL OR lease_worker_id = ?4)
               AND status NOT IN ('succeeded', 'failed', 'cancelled')",
            params![body.error, id, user_id, body.worker_id],
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    if affected == 0 {
        return Err(ApiError::NotFound(
            "task not found, already terminal, or leased by a different worker".into(),
        ));
    }
    Ok(Json(json!({"stopped": true})))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use std::collections::HashMap;
    use std::path::Path as FsPath;
    use tokio::sync::RwLock;
    use tower::ServiceExt;

    fn test_user(id: &str) -> AuthUser {
        AuthUser {
            user_id: id.to_string(),
            email: Some(format!("{}@example.test", id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        }
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "allternit-beta-work-{}-{}",
            tag,
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    async fn test_app_state(temp: &FsPath) -> Arc<AppState> {
        let config = crate::AppConfig {
            company: Default::default(),
            user: Default::default(),
        };
        let db = crate::db::DbHandle::new(temp.join("test.db")).expect("test db");
        let auth_config = crate::auth::AuthConfig::from_app_config(&config);
        let jwks = crate::auth::JwksManager::new(&auth_config);
        let rails = crate::rails::RailsState::new(temp.join("rails"))
            .await
            .expect("test rails");
        Arc::new(AppState {
            config,
            db,
            jwks,
            auth_config,
            vm_driver: None,
            rails,
            vm_sessions: crate::vm_session_routes::new_vm_session_store(),
            cowork_scheduler: None,
            cowork_background: None,
            cowork_run_manager: None,
            webhook_secret: None,
            office_runtime: Arc::new(RwLock::new(
                crate::office_routes::OfficeRuntimeFile::default(),
            )),
            design_skill_cache: crate::design_connector_routes::DesignSkillCache::new(),
            terminal_sessions: crate::terminal_routes::TerminalSessionStore::new(),
            office_cli_docs: Arc::new(RwLock::new(HashMap::new())),
            office_cli_watches: Arc::new(RwLock::new(HashMap::new())),
            office_cli_mcp_sessions: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    fn json_body(value: &Value) -> Body {
        Body::from(value.to_string())
    }

    #[test]
    fn lease_seconds_is_positive() {
        assert!(LEASE_SECONDS > 0);
    }

    #[tokio::test]
    async fn work_queue_lease_heartbeat_ack_and_isolation() {
        let temp = temp_dir("queue");
        let state = test_app_state(&temp).await;
        let app = beta_work_router().with_state(state);

        // Enqueue a task.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/work")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "sandbox_image": "alpine:latest",
                        "env": {"FOO": "bar"},
                        "payload": {"command": "echo hello"}
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let task_id = body["task"]["id"].as_str().unwrap().to_string();
        assert_eq!(body["task"]["status"], json!("queued"));

        // Another user leasing sees no task.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/work/queue?worker_id=worker-b")
                    .extension(test_user("user-b"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = body_json(resp.into_body()).await;
        assert!(body["task"].is_null());

        // Worker-a leases the task.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/work/queue?worker_id=worker-a")
                    .extension(test_user("user-a"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["task"]["id"], json!(task_id));
        assert_eq!(body["task"]["status"], json!("leased"));
        assert_eq!(body["task"]["lease_worker_id"], json!("worker-a"));

        // Heartbeat renews the lease and marks running.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/work/{}/heartbeat", task_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"worker_id": "worker-a"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["task"]["status"], json!("running"));

        // Another worker cannot heartbeat.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/work/{}/heartbeat", task_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"worker_id": "worker-b"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        // Complete the task.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/work/{}/ack", task_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({
                        "worker_id": "worker-a",
                        "result": {"output": "hello"}
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["task"]["status"], json!("succeeded"));
        assert_eq!(body["task"]["result"]["output"], json!("hello"));
        assert!(body["task"]["lease_worker_id"].is_null());

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[tokio::test]
    async fn stop_releases_task_and_rejects_terminal_ack() {
        let temp = temp_dir("stop");
        let state = test_app_state(&temp).await;
        let app = beta_work_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/work")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"payload": {}})))
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = body_json(resp.into_body()).await;
        let task_id = body["task"]["id"].as_str().unwrap().to_string();

        // Owner can stop before it is leased.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/work/{}/stop", task_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"error": "user cancelled"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Ack after stop fails.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/beta/work/{}/ack", task_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"worker_id": "worker-a"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[tokio::test]
    async fn rejects_missing_session_or_deployment_reference() {
        let temp = temp_dir("refs");
        let state = test_app_state(&temp).await;
        let app = beta_work_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/work")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"session_id": "no-such-session"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/work")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a"))
                    .body(json_body(&json!({"deployment_id": "no-such-deployment"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let _ = std::fs::remove_dir_all(&temp);
    }
}
