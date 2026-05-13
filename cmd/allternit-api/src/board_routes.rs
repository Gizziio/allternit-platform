use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
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

pub fn board_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/board-items", get(list_board).post(create_board))
        .route("/board-items/:id", get(get_board).put(update_board).delete(delete_board))
        .route("/board-items/:id/assign", post(assign_board))
        .route("/board-items/:id/comments", get(list_comments).post(add_comment))
}

#[derive(Deserialize)]
struct BoardQuery {
    workspace_id: String,
}

async fn list_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<BoardQuery>,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::OK, Json(json!({"items": []}))).into_response(),
    };

    // Verify user has access to workspace
    let has_access: bool = conn
        .query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2))",
            [&params.workspace_id, &user.user_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !has_access {
        return (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response();
    }

    let mut stmt = match conn.prepare(
        "SELECT id, workspace_id, title, description, status, priority, labels, created_at, updated_at FROM board_items WHERE workspace_id = ?1 ORDER BY updated_at DESC"
    ) {
        Ok(s) => s,
        Err(_) => return (StatusCode::OK, Json(json!({"items": []}))).into_response(),
    };

    let items: Vec<serde_json::Value> = match stmt.query_map([&params.workspace_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "workspaceId": row.get::<_, String>(1)?,
            "title": row.get::<_, String>(2)?,
            "description": row.get::<_, Option<String>>(3)?,
            "status": row.get::<_, String>(4)?,
            "priority": row.get::<_, i64>(5)?,
            "labels": row.get::<_, Option<String>>(6)?.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok()),
            "createdAt": row.get::<_, String>(7)?,
            "updatedAt": row.get::<_, String>(8)?,
        }))
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };

    (StatusCode::OK, Json(json!({"items": items}))).into_response()
}

#[derive(Deserialize)]
struct CreateBoard {
    #[serde(alias = "workspaceId")]
    workspace_id: String,
    title: String,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    labels: Option<Vec<String>>,
    #[serde(alias = "estimatedMinutes")]
    estimated_minutes: Option<i64>,
    deadline: Option<String>,
    dependencies: Option<Vec<String>>,
}

async fn create_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateBoard>,
) -> impl axum::response::IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "DB error"}))).into_response(),
    };

    // Verify user has access to workspace
    let has_access: bool = conn
        .query_row(
            "SELECT 1 FROM workspaces WHERE id = ?1 AND (owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2))",
            [&body.workspace_id, &user.user_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !has_access {
        return (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response();
    }

    let id = uuid::Uuid::new_v4().to_string();
    let labels = body.labels.map(|l| serde_json::to_string(&l).unwrap_or_default());
    let deps = body.dependencies.map(|d| serde_json::to_string(&d).unwrap_or_default());

    match conn.execute(
        "INSERT INTO board_items (id, workspace_id, title, description, status, priority, labels, estimated_minutes, deadline, dependencies, reporter_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            &id,
            &body.workspace_id,
            &body.title,
            &body.description,
            body.status.as_deref().unwrap_or("backlog"),
            body.priority.unwrap_or(0),
            &labels,
            &body.estimated_minutes,
            &body.deadline,
            &deps,
            &user.user_id,
        ],
    ) {
        Ok(_) => (StatusCode::CREATED, Json(json!({"item": {"id": id, "title": body.title, "status": body.status.unwrap_or_else(|| "backlog".to_string())}}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to create"}))).into_response(),
    }
}

async fn get_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT i.id, i.workspace_id, i.title, i.description, i.status, i.priority, i.labels, i.estimated_minutes, i.deadline, i.dependencies, i.reporter_id, i.assignee_id, i.created_at, i.updated_at
             FROM board_items i
             WHERE i.id = ?1 AND EXISTS (
                 SELECT 1 FROM workspaces w
                 WHERE w.id = i.workspace_id AND (w.owner_id = ?2 OR EXISTS (
                     SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?2
                 ))
             )"
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "workspaceId": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
                "status": row.get::<_, String>(4)?,
                "priority": row.get::<_, i64>(5)?,
                "labels": row.get::<_, Option<String>>(6)?.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok()),
                "estimatedMinutes": row.get::<_, Option<i64>>(7)?,
                "deadline": row.get::<_, Option<String>>(8)?,
                "dependencies": row.get::<_, Option<String>>(9)?.and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok()),
                "reporterId": row.get::<_, Option<String>>(10)?,
                "assigneeId": row.get::<_, Option<String>>(11)?,
                "createdAt": row.get::<_, String>(12)?,
                "updatedAt": row.get::<_, String>(13)?,
            }))
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(item)) => Json(json!({ "item": item })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting board: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateBoard {
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    priority: Option<i64>,
    labels: Option<Vec<String>>,
    #[serde(alias = "estimatedMinutes")]
    estimated_minutes: Option<i64>,
    deadline: Option<String>,
    dependencies: Option<Vec<String>>,
}

async fn update_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateBoard>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let labels = body.labels.map(|l| serde_json::to_string(&l).unwrap_or_default());
        let deps = body.dependencies.map(|d| serde_json::to_string(&d).unwrap_or_default());
        let affected = conn.execute(
            "UPDATE board_items SET
                title = COALESCE(?1, title),
                description = COALESCE(?2, description),
                status = COALESCE(?3, status),
                priority = COALESCE(?4, priority),
                labels = COALESCE(?5, labels),
                estimated_minutes = COALESCE(?6, estimated_minutes),
                deadline = COALESCE(?7, deadline),
                dependencies = COALESCE(?8, dependencies),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?9 AND EXISTS (
                 SELECT 1 FROM workspaces w
                 WHERE w.id = board_items.workspace_id AND (w.owner_id = ?10 OR EXISTS (
                     SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?11
                 ))
             )",
            params![
                body.title,
                body.description,
                body.status,
                body.priority,
                labels,
                body.estimated_minutes,
                body.deadline,
                deps,
                id,
                user_id,
                user_id,
            ],
        )?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error updating board: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn delete_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let affected = conn.execute(
            "DELETE FROM board_items WHERE id = ?1 AND EXISTS (
                 SELECT 1 FROM workspaces w
                 WHERE w.id = board_items.workspace_id AND (w.owner_id = ?2 OR EXISTS (
                     SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?3
                 ))
             )",
            params![id, user_id, user_id],
        )?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error deleting board: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct AssignBoard {
    #[serde(alias = "assigneeId")]
    assignee_id: String,
}

async fn assign_board(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<AssignBoard>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let affected = conn.execute(
            "UPDATE board_items SET assignee_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND EXISTS (
                 SELECT 1 FROM workspaces w
                 WHERE w.id = board_items.workspace_id AND (w.owner_id = ?3 OR EXISTS (
                     SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?4
                 ))
             )",
            params![body.assignee_id, id, user_id, user_id],
        )?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error assigning board: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn list_comments(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let has_access: bool = conn
            .query_row(
                "SELECT 1 FROM board_items i JOIN workspaces w ON w.id = i.workspace_id WHERE i.id = ?1 AND (w.owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?2))",
                params![id, user_id],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        let mut stmt = conn.prepare(
            "SELECT id, item_id, author_type, author_id, body, created_at FROM board_comments WHERE item_id = ?1 ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(params![id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "itemId": row.get::<_, String>(1)?,
                "authorType": row.get::<_, String>(2)?,
                "authorId": row.get::<_, String>(3)?,
                "body": row.get::<_, String>(4)?,
                "createdAt": row.get::<_, String>(5)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(comments)) => Json(json!({"comments": comments})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing comments: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct AddComment {
    body: String,
}

async fn add_comment(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<AddComment>,
) -> impl axum::response::IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let comment_id = uuid::Uuid::new_v4().to_string();
    let comment_id2 = comment_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let has_access: bool = conn
            .query_row(
                "SELECT 1 FROM board_items i JOIN workspaces w ON w.id = i.workspace_id WHERE i.id = ?1 AND (w.owner_id = ?2 OR EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id AND m.user_id = ?2))",
                params![id, user_id],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !has_access {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        conn.execute(
            "INSERT INTO board_comments (id, item_id, author_type, author_id, body) VALUES (?1, ?2, 'user', ?3, ?4)",
            params![comment_id2, id, user_id, body.body],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"id": comment_id}))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error adding comment: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}
