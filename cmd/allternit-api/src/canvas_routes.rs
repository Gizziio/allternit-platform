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
use rusqlite::OptionalExtension;
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
    /// Caller-supplied stable key for redeploy-in-place. When present and a
    /// row already exists for `(session_id, artifact_key)`, this call
    /// updates that row (bumping `version`) instead of creating a new one.
    artifact_key: Option<String>,
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
    artifact_key: Option<String>,
    version: i64,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "updated_at")]
    updated_at: String,
}

pub fn canvas_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/canvases", get(list_user_canvases))
        .route(
            "/agent-sessions/:session_id/canvases",
            get(list_canvases).post(create_canvas),
        )
        .route(
            "/canvases/:canvas_id",
            get(get_canvas).patch(update_canvas).delete(delete_canvas),
        )
}

/// Lists the authenticated user's newest canvases across all sessions.
/// Artifact publishers may use a stable synthetic session id that is not a
/// Gizzi chat session, so consumers cannot discover every canvas by sweeping
/// `/agent-sessions` first.
async fn list_user_canvases(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let conn = match state.db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "Failed to connect to database");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let mut stmt = match conn.prepare(
        "SELECT id, session_id, title, components, layout, metadata, created_at, updated_at, artifact_key, version
         FROM agent_canvases WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 200",
    ) {
        Ok(s) => s,
        Err(e) => {
            warn!(error = %e, "Failed to prepare user canvas list statement");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            );
        }
    };

    let rows = stmt.query_map([&user.user_id], |row| {
        Ok(CanvasResponse {
            id: row.get(0)?,
            session_id: row.get(1)?,
            title: row.get(2)?,
            components: parse_json_column(
                row.get::<_, String>(3).unwrap_or_else(|_| "[]".to_string()),
            ),
            layout: row
                .get::<_, Option<String>>(4)?
                .map(parse_json_column_optional),
            metadata: row
                .get::<_, Option<String>>(5)?
                .map(parse_json_column_optional),
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            artifact_key: row.get(8)?,
            version: row.get(9)?,
        })
    });

    match rows {
        Ok(iter) => {
            let canvases: Vec<CanvasResponse> = iter.filter_map(|row| row.ok()).collect();
            (StatusCode::OK, Json(json!({ "canvases": canvases })))
        }
        Err(e) => {
            warn!(error = %e, "Failed to list user canvases");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error"})),
            )
        }
    }
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
        "SELECT id, session_id, user_id, title, components, layout, metadata, created_at, updated_at, artifact_key, version
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
            artifact_key: row.get(9)?,
            version: row.get(10)?,
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

    // Stable-key upsert: when the caller supplies `artifact_key`, redeploy
    // the existing row for `(session_id, artifact_key)` in place instead of
    // minting a new one. A separate SELECT-then-branch would race two
    // concurrent redeploys of the same key against each other (this
    // handler opens its own independent connection per call, per
    // `DbHandle::connect`, so there's no app-level lock serializing them) —
    // do it as one atomic statement instead, same idiom already used by
    // `set_session_origin_surface` (db.rs) and `ensure_user_in_db`
    // (auth.rs). A redeploy is a full publish of the artifact's current
    // state, not a partial patch, so every column is replaced outright
    // (unlike `PATCH /canvases/:id`, which keeps its field-level merge via
    // `apply_canvas_update` for cosmetic edits by known id).
    if let Some(artifact_key) = payload.artifact_key.clone() {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let title = payload.title.unwrap_or_default();
        let components = payload.components.unwrap_or_else(|| json!([]));
        let layout = payload.layout.map(|v| v.to_string());
        let metadata = payload.metadata.map(|v| v.to_string());

        let result: Result<(String, i64, String), rusqlite::Error> = conn.query_row(
            "INSERT INTO agent_canvases (id, session_id, user_id, title, components, layout, metadata, artifact_key, version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)
             ON CONFLICT(session_id, artifact_key) WHERE artifact_key IS NOT NULL DO UPDATE SET
                 title = excluded.title,
                 components = excluded.components,
                 layout = excluded.layout,
                 metadata = excluded.metadata,
                 version = agent_canvases.version + 1,
                 updated_at = excluded.updated_at
             RETURNING id, version, updated_at",
            rusqlite::params![
                &id,
                &session_id,
                &user_id,
                title,
                components.to_string(),
                layout,
                metadata,
                &artifact_key,
                &now,
            ],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );

        return match result {
            Ok((row_id, version, updated_at)) => {
                // A fresh insert always lands at version 1; any redeploy
                // starts from an existing_version >= 1 and increments, so
                // version 1 uniquely identifies "just created".
                let status = if version == 1 {
                    StatusCode::CREATED
                } else {
                    StatusCode::OK
                };
                info!(canvas_id = %row_id, session_id = %session_id, version, "Upserted canvas by artifact_key");
                (
                    status,
                    Json(json!({
                        "id": row_id,
                        "session_id": session_id,
                        "artifact_key": artifact_key,
                        "version": version,
                        "updated_at": updated_at,
                    })),
                )
            }
            Err(e) => {
                warn!(error = %e, "Failed to upsert canvas by artifact_key");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Database error" })),
                )
            }
        };
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let title = payload.title.unwrap_or_default();
    let components = payload.components.unwrap_or_else(|| json!([]));
    let layout = payload.layout.map(|v| v.to_string());
    let metadata = payload.metadata.map(|v| v.to_string());

    match conn.execute(
        "INSERT INTO agent_canvases (id, session_id, user_id, title, components, layout, metadata, artifact_key, version, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10)",
        rusqlite::params![
            &id,
            &session_id,
            &user_id,
            title,
            components.to_string(),
            layout,
            metadata,
            &payload.artifact_key,
            &now,
            &now,
        ],
    ) {
        Ok(_) => {
            info!(canvas_id = %id, session_id = %session_id, "Created canvas");
            (
                StatusCode::CREATED,
                Json(json!({
                    "id": id,
                    "session_id": session_id,
                    "artifact_key": payload.artifact_key,
                    "version": 1,
                })),
            )
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
        "SELECT id, session_id, user_id, title, components, layout, metadata, created_at, updated_at, artifact_key, version
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
                artifact_key: row.get(9)?,
                version: row.get(10)?,
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

    let fields = CanvasUpdateFields {
        title: payload.title,
        components: payload.components,
        layout: payload.layout,
        metadata: payload.metadata,
    };

    match apply_canvas_update(&conn, &canvas_id, fields, false) {
        Ok(Some((updated_at, version, artifact_key))) => (
            StatusCode::OK,
            Json(json!({
                "id": canvas_id,
                "updated_at": updated_at,
                "artifact_key": artifact_key,
                "version": version,
            })),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Canvas not found" })),
        ),
        Err(e) => {
            warn!(error = %e, "Failed to update canvas");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Database error" })),
            )
        }
    }
}

struct CanvasUpdateFields {
    title: Option<String>,
    components: Option<serde_json::Value>,
    layout: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
}

/// Shared UPDATE path for `PATCH /canvases/:id` and the stable-key upsert in
/// `create_canvas`: fetch the existing row, merge in whatever fields are
/// present in `fields` (payload wins, else keep the existing value), and
/// write it back. `bump_version` distinguishes an artifact-key redeploy
/// (increments `version`) from an ordinary PATCH (leaves it as-is). Returns
/// `Ok(None)` when `canvas_id` doesn't exist.
fn apply_canvas_update(
    conn: &rusqlite::Connection,
    canvas_id: &str,
    fields: CanvasUpdateFields,
    bump_version: bool,
) -> Result<Option<(String, i64, Option<String>)>, rusqlite::Error> {
    let existing = conn
        .query_row(
            "SELECT title, components, layout, metadata, version, artifact_key FROM agent_canvases WHERE id = ?1",
            [canvas_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .optional()?;

    let Some((
        existing_title,
        existing_components,
        existing_layout,
        existing_metadata,
        existing_version,
        artifact_key,
    )) = existing
    else {
        return Ok(None);
    };

    let title = fields.title.or(existing_title);
    let components = fields
        .components
        .map(|v| v.to_string())
        .unwrap_or(existing_components);
    let layout = fields.layout.map(|v| v.to_string()).or(existing_layout);
    let metadata = fields.metadata.map(|v| v.to_string()).or(existing_metadata);
    let now = chrono::Utc::now().to_rfc3339();
    let version = if bump_version {
        existing_version + 1
    } else {
        existing_version
    };

    conn.execute(
        "UPDATE agent_canvases SET title = ?1, components = ?2, layout = ?3, metadata = ?4, updated_at = ?5, version = ?6 WHERE id = ?7",
        rusqlite::params![title, components, layout, metadata, now, version, canvas_id],
    )?;

    Ok(Some((now, version, artifact_key)))
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
