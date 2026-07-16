//! Canvas routes for agent session canvases.
//!
//! Provides CRUD for persistent canvas artifacts. Canvases are stored in the
//! local SQLite database and are independent from Gizzi runtime state.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct CreateCanvasPayload {
    title: Option<String>,
    components: Option<serde_json::Value>,
    layout: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct UpdateCanvasPayload {
    title: Option<String>,
    components: Option<serde_json::Value>,
    layout: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct CanvasResponse {
    id: String,
    session_id: String,
    title: Option<String>,
    components: serde_json::Value,
    layout: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "updated_at")]
    updated_at: String,
}

pub fn canvas_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/agent-sessions/:session_id/canvases",
            get(list_canvases).post(create_canvas),
        )
        .route(
            "/canvases/:canvas_id",
            get(get_canvas).patch(update_canvas).delete(delete_canvas),
        )
}

async fn list_canvases(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    let mut stmt = match conn.prepare(
        "SELECT id, session_id, user_id, title, components, layout, metadata, created_at, updated_at
         FROM agent_canvases WHERE session_id = ?1 ORDER BY updated_at DESC"
    ) {
        Ok(s) => s,
        Err(e) => {
            warn!(error = %e, "Failed to prepare list canvases statement");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error" })));
        }
    };

    let rows = stmt.query_map([&session_id], |row| {
        Ok(CanvasResponse {
            id: row.get(0)?,
            session_id: row.get(1)?,
            title: row.get(3)?,
            components: parse_json_column(
                row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string()),
            ),
            layout: row
                .get::<_, Option<String>>(5)?
                .map(parse_json_column_optional),
            metadata: row
                .get::<_, Option<String>>(6)?
                .map(parse_json_column_optional),
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    });

    match rows {
        Ok(iter) => {
            let canvases: Vec<CanvasResponse> = iter.filter_map(|r| r.ok()).collect();
            (StatusCode::OK, Json(json!({ "canvases": canvases })))
        }
        Err(e) => {
            warn!(error = %e, "Failed to list canvases");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            )
        }
    }
}

async fn create_canvas(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(session_id): Path<String>,
    Json(payload): Json<CreateCanvasPayload>,
) -> impl IntoResponse {
    let user_id = user.user_id;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let title = payload.title.unwrap_or_default();
    let components = payload.components.unwrap_or_else(|| json!([]));
    let layout = payload.layout.map(|v| v.to_string());
    let metadata = payload.metadata.map(|v| v.to_string());

    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    match conn.execute(
        "INSERT INTO agent_canvases (id, session_id, user_id, title, components, layout, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            &id,
            &session_id,
            &user_id,
            title,
            components.to_string(),
            layout,
            metadata,
            &now,
            &now,
        ],
    ) {
        Ok(_) => {
            info!(canvas_id = %id, session_id = %session_id, "Created canvas");
            (StatusCode::CREATED, Json(json!({ "id": id, "session_id": session_id })))
        }
        Err(e) => {
            warn!(error = %e, "Failed to create canvas");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error" })))
        }
    }
}

async fn get_canvas(
    State(state): State<Arc<AppState>>,
    Path(canvas_id): Path<String>,
) -> impl IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    let result = conn.query_row(
        "SELECT id, session_id, user_id, title, components, layout, metadata, created_at, updated_at
         FROM agent_canvases WHERE id = ?1",
        [&canvas_id],
        |row| {
            Ok(CanvasResponse {
                id: row.get(0)?,
                session_id: row.get(1)?,
                title: row.get(3)?,
                components: parse_json_column(row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string())),
                layout: row.get::<_, Option<String>>(5)?.map(parse_json_column_optional),
                metadata: row.get::<_, Option<String>>(6)?.map(parse_json_column_optional),
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    );

    match result {
        Ok(canvas) => (StatusCode::OK, Json(json!(canvas))),
        Err(rusqlite::Error::QueryReturnedNoRows) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Canvas not found" })),
        ),
        Err(e) => {
            warn!(error = %e, "Failed to get canvas");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            )
        }
    }
}

async fn update_canvas(
    State(state): State<Arc<AppState>>,
    Path(canvas_id): Path<String>,
    Json(payload): Json<UpdateCanvasPayload>,
) -> impl IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    let existing = conn.query_row(
        "SELECT title, components, layout, metadata FROM agent_canvases WHERE id = ?1",
        [&canvas_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        },
    );

    let (existing_title, existing_components, existing_layout, existing_metadata) = match existing {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Canvas not found" })),
            );
        }
        Err(e) => {
            warn!(error = %e, "Failed to fetch canvas for update");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    let title = payload.title.or(existing_title);
    let components = payload
        .components
        .map(|v| v.to_string())
        .unwrap_or(existing_components);
    let layout = payload.layout.map(|v| v.to_string()).or(existing_layout);
    let metadata = payload
        .metadata
        .map(|v| v.to_string())
        .or(existing_metadata);
    let now = chrono::Utc::now().to_rfc3339();

    match conn.execute(
        "UPDATE agent_canvases SET title = ?1, components = ?2, layout = ?3, metadata = ?4, updated_at = ?5 WHERE id = ?6",
        rusqlite::params![title, components, layout, metadata, now, &canvas_id],
    ) {
        Ok(_) => (StatusCode::OK, Json(json!({ "id": canvas_id, "updated_at": now }))),
        Err(e) => {
            warn!(error = %e, "Failed to update canvas");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Database error" })))
        }
    }
}

async fn delete_canvas(
    State(state): State<Arc<AppState>>,
    Path(canvas_id): Path<String>,
) -> impl IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            );
        }
    };

    match conn.execute("DELETE FROM agent_canvases WHERE id = ?1", [&canvas_id]) {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Canvas not found" })),
        ),
        Ok(_) => (StatusCode::NO_CONTENT, Json(json!({}))),
        Err(e) => {
            warn!(error = %e, "Failed to delete canvas");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            )
        }
    }
}

fn parse_json_column(value: String) -> serde_json::Value {
    serde_json::from_str(&value).unwrap_or_else(|_| json!([]))
}

fn parse_json_column_optional(value: String) -> serde_json::Value {
    serde_json::from_str(&value).unwrap_or_else(|_| json!(null))
}
