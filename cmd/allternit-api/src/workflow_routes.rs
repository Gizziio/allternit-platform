use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn workflow_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/workflows", get(list_workflows).post(create_workflow))
        .route("/workflows/:id", get(get_workflow).put(update_workflow).delete(delete_workflow))
        .route("/workflows/:id/execute", post(execute_workflow))
        .route("/workflows/:id/executions", get(list_executions))
        .route("/workflows/:id/executions/:exec_id", get(get_execution))
        .route("/workflows/:id/executions/:exec_id/cancel", post(cancel_execution))
}

// ─── List workflows ─────────────────────────────────────────────────────────────

async fn list_workflows(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"workflows": [], "total": 0}))),
    };

    let mut stmt = match conn.prepare("SELECT id, title, description, nodes, edges, created_at, updated_at FROM workflows WHERE user_id = ?1 ORDER BY created_at DESC") {
        Ok(s) => s,
        Err(_) => return (StatusCode::OK, Json(json!({"workflows": [], "total": 0}))),
    };

    let workflows: Vec<serde_json::Value> = match stmt.query_map([&user.user_id], |row| {
        let nodes_str: String = row.get(3)?;
        let edges_str: String = row.get(4)?;
        let nodes: Vec<serde_json::Value> = serde_json::from_str(&nodes_str).unwrap_or_default();
        let edges: Vec<serde_json::Value> = serde_json::from_str(&edges_str).unwrap_or_default();
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "title": row.get::<_, String>(1)?,
            "description": row.get::<_, Option<String>>(2)?,
            "nodes": nodes,
            "edges": edges,
            "node_count": nodes.len(),
            "created_at": row.get::<_, String>(5)?,
            "updated_at": row.get::<_, String>(6)?,
            "status": "draft",
        }))
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };

    (StatusCode::OK, Json(json!({"workflows": workflows, "total": workflows.len()})))
}

// ─── Create workflow ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateWorkflow {
    name: Option<String>,
    title: Option<String>,
    description: Option<String>,
    nodes: Option<Vec<serde_json::Value>>,
    edges: Option<Vec<serde_json::Value>>,
}

async fn create_workflow(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateWorkflow>,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))),
    };

    let id = uuid::Uuid::new_v4().to_string();
    let title = body.name.or(body.title).unwrap_or_else(|| "Untitled Workflow".to_string());
    let nodes = serde_json::to_string(&body.nodes.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());
    let edges = serde_json::to_string(&body.edges.unwrap_or_default()).unwrap_or_else(|_| "[]".to_string());

    match conn.execute(
        "INSERT INTO workflows (id, user_id, title, description, nodes, edges) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![&id, &user.user_id, &title, &body.description, &nodes, &edges],
    ) {
        Ok(_) => (StatusCode::CREATED, Json(json!({
            "id": id,
            "name": title,
            "title": title,
            "description": body.description,
            "node_count": 0,
            "status": "draft",
        }))),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create"}))),
    }
}

// ─── Get workflow ───────────────────────────────────────────────────────────────

async fn get_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, nodes, edges, created_at, updated_at
             FROM workflows WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id2, user_id], |row| {
            let nodes_str: String = row.get(3)?;
            let edges_str: String = row.get(4)?;
            let nodes: Vec<serde_json::Value> = serde_json::from_str(&nodes_str).unwrap_or_default();
            let edges: Vec<serde_json::Value> = serde_json::from_str(&edges_str).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(1)?,
                "description": row.get::<_, Option<String>>(2)?,
                "nodes": nodes,
                "edges": edges,
                "node_count": nodes.len(),
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
                "status": "draft",
            }))
        })?;
        Ok::<_, rusqlite::Error>(row)
    }).await;

    match result {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"workflow": data}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

// ─── Update workflow ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UpdateWorkflow {
    name: Option<String>,
    title: Option<String>,
    description: Option<String>,
    nodes: Option<Vec<serde_json::Value>>,
    edges: Option<Vec<serde_json::Value>>,
}

async fn update_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<UpdateWorkflow>,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;
    let title = body.name.or(body.title);
    let description = body.description;
    let nodes = body.nodes.map(|n| serde_json::to_string(&n).unwrap_or_else(|_| "[]".to_string()));
    let edges = body.edges.map(|e| serde_json::to_string(&e).unwrap_or_else(|_| "[]".to_string()));

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sets = vec![];
        let mut params_vec: Vec<String> = vec![];

        if let Some(t) = title {
            sets.push("title = ?".to_string());
            params_vec.push(t);
        }
        if let Some(d) = description {
            sets.push("description = ?".to_string());
            params_vec.push(d);
        }
        if let Some(n) = nodes {
            sets.push("nodes = ?".to_string());
            params_vec.push(n);
        }
        if let Some(e) = edges {
            sets.push("edges = ?".to_string());
            params_vec.push(e);
        }

        if sets.is_empty() {
            return Ok::<_, rusqlite::Error>(());
        }

        let sql = format!("UPDATE workflows SET {} WHERE id = ?{} AND user_id = ?{}",
            sets.join(", "),
            sets.len() + 1,
            sets.len() + 2
        );
        let mut all_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        all_params.push(&id2);
        all_params.push(&user_id);
        conn.execute(&sql, all_params.as_slice())?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"success": true}))),
        Ok(Err(e)) => {
            warn!("DB error updating workflow: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Delete workflow ────────────────────────────────────────────────────────────

async fn delete_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM workflow_executions WHERE workflow_id = ?1",
            params![id2],
        )?;
        conn.execute(
            "DELETE FROM workflows WHERE id = ?1 AND user_id = ?2",
            params![id2, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"success": true}))),
        Ok(Err(e)) => {
            warn!("DB error deleting workflow: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Execute workflow ───────────────────────────────────────────────────────────

async fn execute_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let workflow_id = id.clone();
    let user_id = user.user_id;
    let execution_id = uuid::Uuid::new_v4().to_string();
    let execution_id2 = execution_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workflow exists and belongs to user
        let _: String = conn.query_row(
            "SELECT id FROM workflows WHERE id = ?1 AND user_id = ?2",
            params![workflow_id, user_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "INSERT INTO workflow_executions (id, workflow_id, status, started_at)
             VALUES (?1, ?2, 'pending', datetime('now'))",
            params![execution_id2, workflow_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({
            "execution_id": execution_id,
            "status": "pending",
        }))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Workflow not found"})))
        }
        Ok(Err(e)) => {
            warn!("DB error executing workflow: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── List executions ────────────────────────────────────────────────────────────

async fn list_executions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let workflow_id = id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workflow ownership
        let _: String = conn.query_row(
            "SELECT id FROM workflows WHERE id = ?1 AND user_id = ?2",
            params![workflow_id, user_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, status, started_at, completed_at, result, error, created_at
             FROM workflow_executions WHERE workflow_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![workflow_id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "workflow_id": row.get::<_, String>(1)?,
                "status": row.get::<_, String>(2)?,
                "started_at": row.get::<_, Option<String>>(3)?,
                "completed_at": row.get::<_, Option<String>>(4)?,
                "result": row.get::<_, Option<String>>(5)?,
                "error": row.get::<_, Option<String>>(6)?,
                "created_at": row.get::<_, String>(7)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!({"executions": data}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

// ─── Get execution ──────────────────────────────────────────────────────────────

async fn get_execution(
    State(state): State<Arc<AppState>>,
    Path((workflow_id, exec_id)): Path<(String, String)>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let wf_id = workflow_id.clone();
    let eid = exec_id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workflow ownership
        let _: String = conn.query_row(
            "SELECT id FROM workflows WHERE id = ?1 AND user_id = ?2",
            params![wf_id, user_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let row = conn.query_row(
            "SELECT id, workflow_id, status, started_at, completed_at, result, error, created_at
             FROM workflow_executions WHERE id = ?1 AND workflow_id = ?2",
            params![eid, wf_id],
            |row| {
                Ok(json!({
                    "execution_id": row.get::<_, String>(0)?,
                    "workflow_id": row.get::<_, String>(1)?,
                    "status": row.get::<_, String>(2)?,
                    "start_time": row.get::<_, Option<String>>(3)?,
                    "completed_at": row.get::<_, Option<String>>(4)?,
                    "error": row.get::<_, Option<String>>(6)?,
                }))
            },
        )?;
        Ok::<_, rusqlite::Error>(row)
    }).await;

    match row {
        Ok(Ok(data)) => (StatusCode::OK, Json(data)),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Execution not found"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

// ─── Cancel execution ───────────────────────────────────────────────────────────

async fn cancel_execution(
    State(state): State<Arc<AppState>>,
    Path((workflow_id, exec_id)): Path<(String, String)>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let wf_id = workflow_id.clone();
    let eid = exec_id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify workflow ownership
        let _: String = conn.query_row(
            "SELECT id FROM workflows WHERE id = ?1 AND user_id = ?2",
            params![wf_id, user_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        // Check current status
        let status: String = conn.query_row(
            "SELECT status FROM workflow_executions WHERE id = ?1 AND workflow_id = ?2",
            params![eid, wf_id],
            |row| row.get(0),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        if status == "completed" || status == "failed" || status == "cancelled" {
            return Ok::<_, rusqlite::Error>((status, true));
        }

        conn.execute(
            "UPDATE workflow_executions SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?1",
            params![eid],
        )?;
        Ok(("cancelled".to_string(), false))
    }).await;

    match result {
        Ok(Ok((status, already_done))) => {
            if already_done {
                (StatusCode::CONFLICT, Json(json!({"error": format!("Cannot cancel execution with status \"{}\"", status)})))
            } else {
                (StatusCode::OK, Json(json!({
                    "execution_id": exec_id,
                    "workflow_id": workflow_id,
                    "status": "cancelled",
                    "completed_at": chrono::Utc::now().to_rfc3339(),
                })))
            }
        }
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Execution not found"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}
