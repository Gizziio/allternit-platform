//! Resource tag management API (task G8), Clerk-protected.
//!
//! Merged into the `/api/v1` chain in main.rs, so paths land at
//! `/api/v1/tags*`. Tags label taggable resources (agents, sessions, gateway
//! keys, deployments) so spend and activity can be attributed per team /
//! project / customer from the surfaces that read them (today: the LLM
//! gateway usage write path inherits `gateway_key` tags onto
//! `llm_usage_events`).
//!
//! Write semantics: POST upserts on `(resource_type, resource_id, key)` —
//! console UIs edit one value at a time and a duplicate-key 409 would force
//! every editor to read-then-write; upsert keeps "set tag" idempotent.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::AppState;

/// Resource types a tag may be attached to. Extend here (and in V-migrations
/// consumers) when new surfaces become taggable.
const RESOURCE_TYPES: [&str; 4] = ["agent", "session", "gateway_key", "deployment"];

pub fn tag_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/tags", get(list_tags).post(create_tag).delete(delete_tag_by_query))
        .route("/tags/:id", delete(delete_tag_by_id))
}

#[derive(Debug, Deserialize)]
pub struct ListTagsQuery {
    resource_type: Option<String>,
    resource_id: Option<String>,
    key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTagRequest {
    resource_type: String,
    resource_id: String,
    key: String,
    value: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteTagQuery {
    resource_type: String,
    resource_id: String,
    key: String,
}

fn validate_resource_type(resource_type: &str) -> Result<(), ApiError> {
    if RESOURCE_TYPES.contains(&resource_type) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(format!(
            "`resource_type` must be one of: {}.",
            RESOURCE_TYPES.join(", ")
        )))
    }
}

fn validate_key_value(key: &str, value: &str) -> Result<(), ApiError> {
    if key.is_empty() || key.len() > 128 {
        return Err(ApiError::BadRequest(
            "`key` must be 1-128 characters.".to_string(),
        ));
    }
    if value.len() > 128 {
        return Err(ApiError::BadRequest(
            "`value` must be at most 128 characters.".to_string(),
        ));
    }
    Ok(())
}

/// GET /tags?resource_type=&resource_id=[&key=] — list tags, filterable.
/// Without filters this returns the caller's ten most recent tags so an
/// unscoped list stays bounded.
async fn list_tags(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Query(query): Query<ListTagsQuery>,
) -> Result<Json<Value>, ApiError> {
    if let Some(resource_type) = &query.resource_type {
        validate_resource_type(resource_type)?;
    }
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, String> {
        let conn = db.connect().map_err(|e| e.to_string())?;
        let mut sql = String::from(
            "SELECT id, resource_type, resource_id, key, value, created_at
             FROM resource_tags WHERE 1=1",
        );
        if query.resource_type.is_some() {
            sql.push_str(" AND resource_type = ?");
        }
        if query.resource_id.is_some() {
            sql.push_str(" AND resource_id = ?");
        }
        if query.key.is_some() {
            sql.push_str(" AND key = ?");
        }
        sql.push_str(" ORDER BY created_at DESC, id DESC LIMIT 500");

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let param_values: Vec<&String> = [
            query.resource_type.as_ref(),
            query.resource_id.as_ref(),
            query.key.as_ref(),
        ]
        .into_iter()
        .flatten()
        .collect();
        let rows = stmt
            .query_map(rusqlite::params_from_iter(param_values), |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "resource_type": row.get::<_, String>(1)?,
                    "resource_id": row.get::<_, String>(2)?,
                    "key": row.get::<_, String>(3)?,
                    "value": row.get::<_, String>(4)?,
                    "created_at": row.get::<_, String>(5)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::DbError)?;

    Ok(Json(json!({ "tags": rows })))
}

/// POST /tags — create or update (upsert) a tag. Duplicate `(resource_type,
/// resource_id, key)` replaces the value and returns the row with
/// `"updated": true`.
async fn create_tag(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Json(payload): Json<CreateTagRequest>,
) -> Result<Json<Value>, ApiError> {
    validate_resource_type(&payload.resource_type)?;
    validate_key_value(&payload.key, &payload.value)?;

    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let (row, updated) = tokio::task::spawn_blocking(
        move || -> Result<(Value, bool), String> {
            let conn = db.connect().map_err(|e| e.to_string())?;
            let existing: Option<String> = conn
                .query_row(
                    "SELECT id FROM resource_tags
                     WHERE resource_type = ?1 AND resource_id = ?2 AND key = ?3",
                    params![payload.resource_type, payload.resource_id, payload.key],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some(existing_id) = existing {
                conn.execute(
                    "UPDATE resource_tags SET value = ?2 WHERE id = ?1",
                    params![existing_id, payload.value],
                )
                .map_err(|e| e.to_string())?;
                let created_at: String = conn
                    .query_row(
                        "SELECT created_at FROM resource_tags WHERE id = ?1",
                        params![existing_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                return Ok((
                    json!({
                        "id": existing_id,
                        "resource_type": payload.resource_type,
                        "resource_id": payload.resource_id,
                        "key": payload.key,
                        "value": payload.value,
                        "created_at": created_at,
                    }),
                    true,
                ));
            }
            conn.execute(
                "INSERT INTO resource_tags (id, resource_type, resource_id, key, value)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    id,
                    payload.resource_type,
                    payload.resource_id,
                    payload.key,
                    payload.value
                ],
            )
            .map_err(|e| e.to_string())?;
            let created_at: String = conn
                .query_row(
                    "SELECT created_at FROM resource_tags WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            Ok((
                json!({
                    "id": id,
                    "resource_type": payload.resource_type,
                    "resource_id": payload.resource_id,
                    "key": payload.key,
                    "value": payload.value,
                    "created_at": created_at,
                }),
                false,
            ))
        },
    )
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::DbError)?;

    Ok(Json(json!({ "tag": row, "updated": updated })))
}

/// DELETE /tags/:id — delete one tag by row id. 404 when absent.
async fn delete_tag_by_id(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let db = state.db.clone();
    let id_for_delete = id.clone();
    let deleted = tokio::task::spawn_blocking(
        move || -> Result<usize, String> {
            let conn = db.connect().map_err(|e| e.to_string())?;
            conn.execute("DELETE FROM resource_tags WHERE id = ?1", params![id_for_delete])
                .map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::DbError)?;

    if deleted == 0 {
        return Err(ApiError::NotFound(format!("Tag `{id}` was not found.")));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /tags?resource_type=&resource_id=&key= — delete by identity.
/// Registered as the `DELETE /tags` handler on [`tag_router`].
async fn delete_tag_by_query(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Query(query): Query<DeleteTagQuery>,
) -> Result<StatusCode, ApiError> {
    validate_resource_type(&query.resource_type)?;
    let db = state.db.clone();
    let (resource_type, resource_id, key) = (
        query.resource_type.clone(),
        query.resource_id.clone(),
        query.key.clone(),
    );
    let deleted = tokio::task::spawn_blocking(
        move || -> Result<usize, String> {
            let conn = db.connect().map_err(|e| e.to_string())?;
            conn.execute(
                "DELETE FROM resource_tags
                 WHERE resource_type = ?1 AND resource_id = ?2 AND key = ?3",
                params![resource_type, resource_id, key],
            )
            .map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(ApiError::DbError)?;

    if deleted == 0 {
        return Err(ApiError::NotFound(format!(
            "No tag `{}` on {} `{}`.",
            query.key, query.resource_type, query.resource_id
        )));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    fn auth_user(user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{user_id}@test.local")),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        }
    }

    fn build_request(method: &str, uri: &str, user: AuthUser, body: Option<Value>) -> Request<Body> {
        let body = body
            .map(|b| Body::from(serde_json::to_string(&b).unwrap()))
            .unwrap_or_else(Body::empty);
        let mut req = Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json")
            .body(body)
            .unwrap();
        req.extensions_mut().insert(user);
        req
    }

    async fn body_json(resp: axum::response::Response) -> Value {
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    }

    async fn test_app() -> Arc<AppState> {
        let temp = tempfile::tempdir().unwrap().keep();
        crate::test_helpers::app_state(&temp).await
    }

    #[tokio::test]
    async fn create_list_update_delete_roundtrip() {
        let state = test_app().await;
        let app = tag_router().with_state(state);

        // Create.
        let resp = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "agent",
                    "resource_id": "agent_1",
                    "key": "team",
                    "value": "alpha",
                })),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp).await;
        assert_eq!(body["tag"]["key"], "team");
        assert_eq!(body["tag"]["value"], "alpha");
        assert_eq!(body["updated"], false);

        // Upsert same key → value replaced, same id, updated=true.
        let resp = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "agent",
                    "resource_id": "agent_1",
                    "key": "team",
                    "value": "beta",
                })),
            ))
            .await
            .unwrap();
        let body = body_json(resp).await;
        assert_eq!(body["tag"]["value"], "beta");
        assert_eq!(body["updated"], true);
        let tag_id = body["tag"]["id"].as_str().unwrap().to_string();

        // List, filtered.
        let resp = app
            .clone()
            .oneshot(build_request(
                "GET",
                "/tags?resource_type=agent&resource_id=agent_1",
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        let body = body_json(resp).await;
        let tags = body["tags"].as_array().unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0]["value"], "beta");

        // Delete by id.
        let resp = app
            .clone()
            .oneshot(build_request(
                "DELETE",
                &format!("/tags/{tag_id}"),
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);

        // Delete by identity (recreate first).
        app.clone()
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "deployment",
                    "resource_id": "dep_1",
                    "key": "env",
                    "value": "prod",
                })),
            ))
            .await
            .unwrap();
        let resp = app
            .clone()
            .oneshot(build_request(
                "DELETE",
                "/tags?resource_type=deployment&resource_id=dep_1&key=env",
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);

        // Gone.
        let resp = app
            .oneshot(build_request(
                "GET",
                "/tags?resource_type=deployment&resource_id=dep_1",
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        let body = body_json(resp).await;
        assert_eq!(body["tags"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn rejects_invalid_resource_type_and_bad_fields() {
        let state = test_app().await;
        let app = tag_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "widget",
                    "resource_id": "x",
                    "key": "k",
                    "value": "v",
                })),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let resp = app
            .clone()
            .oneshot(build_request(
                "GET",
                "/tags?resource_type=widget",
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Empty key.
        let resp = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "session",
                    "resource_id": "s1",
                    "key": "",
                    "value": "v",
                })),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // Over-long value (129 chars).
        let resp = app
            .oneshot(build_request(
                "POST",
                "/tags",
                auth_user("u1"),
                Some(json!({
                    "resource_type": "session",
                    "resource_id": "s1",
                    "key": "k",
                    "value": "x".repeat(129),
                })),
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn delete_missing_tag_is_404() {
        let state = test_app().await;
        let app = tag_router().with_state(state);
        let resp = app
            .oneshot(build_request(
                "DELETE",
                "/tags?resource_type=agent&resource_id=nope&key=k",
                auth_user("u1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
//! Allternit Tagging Subsystem — REST API routes.
//!
//! Provides user-scoped tags and taggings under `/api/v1/tags` and
//! `/api/v1/taggings`. Tags are lightweight labels; taggings attach them to
//! platform entities (agents, tools, scripts, artifacts, sessions, etc.).

use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get};
use axum::{Json, Router};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::AppState;

/// Allowed scopes match the TypeScript `TagScope` union.
const TAG_SCOPES: &[&str] = &[
    "agent", "tool", "script", "artifact", "session", "plugin", "mcp", "skill", "global",
];

/// Allowed colors match the TypeScript `TagColor` union.
const TAG_COLORS: &[&str] = &[
    "slate", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
    "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

pub fn tag_router() -> Router<Arc<AppState>> {
    Router::new()
        // Tags
        .route("/tags", get(list_tags).post(create_tag))
        .route("/tags/:id", get(get_tag).patch(update_tag).delete(delete_tag))
        .route("/tags/target/:target_type/:target_id", get(get_tags_for_target))
        // Taggings
        .route("/taggings", get(list_taggings).post(create_tagging))
        .route("/taggings/:id", delete(delete_tagging))
}

// ── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Tag {
    id: String,
    label: String,
    color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    scope: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Tagging {
    id: String,
    tag_id: String,
    target_id: String,
    target_type: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTagBody {
    label: String,
    #[serde(default = "default_color")]
    color: String,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default = "default_scope")]
    scope: String,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateTagBody {
    label: Option<String>,
    color: Option<String>,
    icon: Option<Option<String>>,
    scope: Option<String>,
    description: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTaggingBody {
    tag_id: String,
    target_id: String,
    target_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListTagsQuery {
    scope: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListTaggingsQuery {
    tag_id: Option<String>,
    target_id: Option<String>,
    target_type: Option<String>,
}

fn default_color() -> String {
    "blue".to_string()
}

fn default_scope() -> String {
    "global".to_string()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn validate_scope(scope: &str) -> Result<(), String> {
    if TAG_SCOPES.contains(&scope) {
        Ok(())
    } else {
        Err(format!(
            "invalid scope '{}'; must be one of: {}",
            scope,
            TAG_SCOPES.join(", ")
        ))
    }
}

fn validate_color(color: &str) -> Result<(), String> {
    if TAG_COLORS.contains(&color) {
        Ok(())
    } else {
        Err(format!(
            "invalid color '{}'; must be one of: {}",
            color,
            TAG_COLORS.join(", ")
        ))
    }
}

fn validate_label(label: &str) -> Result<(), String> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        Err("label is required".to_string())
    } else if trimmed.len() > 64 {
        Err("label must be 64 characters or fewer".to_string())
    } else {
        Ok(())
    }
}

fn iso_now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn db_err(e: rusqlite::Error) -> (StatusCode, Json<serde_json::Value>) {
    tracing::warn!("Tag DB error: {}", e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "database error"})),
    )
}

fn row_to_tag(row: &rusqlite::Row) -> Result<Tag, rusqlite::Error> {
    Ok(Tag {
        id: row.get(0)?,
        label: row.get(1)?,
        color: row.get(2)?,
        icon: row.get(3)?,
        scope: row.get(4)?,
        description: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn row_to_tagging(row: &rusqlite::Row) -> Result<Tagging, rusqlite::Error> {
    Ok(Tagging {
        id: row.get(0)?,
        tag_id: row.get(1)?,
        target_id: row.get(2)?,
        target_type: row.get(3)?,
        created_at: row.get(4)?,
    })
}

// ── Tags ─────────────────────────────────────────────────────────────────────

async fn list_tags(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListTagsQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let db = state.db.clone();
    let user_id = user.user_id;
    let scope = query.scope;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql =
            "SELECT id, label, color, icon, scope, description, created_at, updated_at
             FROM tags WHERE user_id = ?1".to_string();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id)];
        if let Some(ref s) = scope {
            sql.push_str(" AND scope = ?2");
            args.push(Box::new(s.clone()));
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(refs), row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match result {
        Ok(Ok(tags)) => (StatusCode::OK, Json(json!({ "tags": tags }))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tag list task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn create_tag(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateTagBody>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(msg) = validate_label(&body.label) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
    }
    if let Err(msg) = validate_color(&body.color) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
    }
    if let Err(msg) = validate_scope(&body.scope) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let now = iso_now();
    let tag = Tag {
        id: id.clone(),
        label: body.label.trim().to_string(),
        color: body.color,
        icon: body.icon,
        scope: body.scope,
        description: body.description,
        created_at: now.clone(),
        updated_at: now,
    };

    let response_tag = tag.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO tags (id, user_id, label, color, icon, scope, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &tag.id,
                &user_id,
                &tag.label,
                &tag.color,
                &tag.icon,
                &tag.scope,
                &tag.description,
                &tag.created_at,
                &tag.updated_at,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!(response_tag))),
        Ok(Err(rusqlite::Error::SqliteFailure(code, Some(_))))
            if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
        {
            (
                StatusCode::CONFLICT,
                Json(json!({"error": "a tag with this label already exists"})),
            )
        }
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tag create task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn get_tag(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, label, color, icon, scope, description, created_at, updated_at
             FROM tags WHERE id = ?1 AND user_id = ?2",
        )?;
        let tag = stmt
            .query_row(params![&id, &user_id], row_to_tag)
            .optional()?;
        Ok::<_, rusqlite::Error>(tag)
    })
    .await;

    match result {
        Ok(Ok(Some(tag))) => (StatusCode::OK, Json(json!(tag))),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "tag not found"}))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tag get task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn update_tag(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTagBody>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Some(ref label) = body.label {
        if let Err(msg) = validate_label(label) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
        }
    }
    if let Some(ref color) = body.color {
        if let Err(msg) = validate_color(color) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
        }
    }
    if let Some(ref scope) = body.scope {
        if let Err(msg) = validate_scope(scope) {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
        }
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let now = iso_now();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Fetch existing to apply partial updates.
        let mut stmt = conn.prepare(
            "SELECT id, label, color, icon, scope, description, created_at, updated_at
             FROM tags WHERE id = ?1 AND user_id = ?2",
        )?;
        let existing = match stmt.query_row(params![&id, &user_id], row_to_tag).optional()? {
            Some(t) => t,
            None => return Ok::<_, rusqlite::Error>(None),
        };

        let label = body
            .label
            .map(|s| s.trim().to_string())
            .unwrap_or(existing.label);
        let color = body.color.unwrap_or(existing.color);
        let icon = body.icon.unwrap_or(existing.icon);
        let scope = body.scope.unwrap_or(existing.scope);
        let description = body.description.unwrap_or(existing.description);

        conn.execute(
            "UPDATE tags
             SET label = ?1, color = ?2, icon = ?3, scope = ?4, description = ?5, updated_at = ?6
             WHERE id = ?7 AND user_id = ?8",
            params![
                &label,
                &color,
                &icon,
                &scope,
                &description,
                &now,
                &id,
                &user_id,
            ],
        )?;

        Ok(Some(Tag {
            id,
            label,
            color,
            icon,
            scope,
            description,
            created_at: existing.created_at,
            updated_at: now,
        }))
    })
    .await;

    match result {
        Ok(Ok(Some(tag))) => (StatusCode::OK, Json(json!(tag))),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "tag not found"}))),
        Ok(Err(rusqlite::Error::SqliteFailure(code, Some(_))))
            if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
        {
            (
                StatusCode::CONFLICT,
                Json(json!({"error": "a tag with this label already exists"})),
            )
        }
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tag update task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn delete_tag(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let db = state.db.clone();
    let user_id = user.user_id;

    let response_id = id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let affected = conn.execute(
            "DELETE FROM tags WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
        )?;
        Ok::<_, rusqlite::Error>(affected)
    })
    .await;

    match result {
        Ok(Ok(0)) => (StatusCode::NOT_FOUND, Json(json!({"error": "tag not found"}))),
        Ok(Ok(_)) => (StatusCode::OK, Json(json!({"deleted": true, "id": response_id}))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tag delete task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn get_tags_for_target(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((target_type, target_id)): Path<(String, String)>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(msg) = validate_scope(&target_type) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
    }

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT t.id, t.label, t.color, t.icon, t.scope, t.description, t.created_at, t.updated_at
             FROM tags t
             JOIN taggings tg ON tg.tag_id = t.id
             WHERE t.user_id = ?1 AND tg.target_type = ?2 AND tg.target_id = ?3
             ORDER BY t.updated_at DESC",
        )?;
        let tags = stmt
            .query_map(params![&user_id, &target_type, &target_id], row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(tags)
    })
    .await;

    match result {
        Ok(Ok(tags)) => (StatusCode::OK, Json(json!({ "tags": tags }))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Target tags task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

// ── Taggings ─────────────────────────────────────────────────────────────────

async fn list_taggings(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListTaggingsQuery>,
) -> (StatusCode, Json<serde_json::Value>) {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql =
            "SELECT tg.id, tg.tag_id, tg.target_id, tg.target_type, tg.created_at
             FROM taggings tg
             JOIN tags t ON t.id = tg.tag_id
             WHERE t.user_id = ?1".to_string();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id)];

        if let Some(ref tag_id) = query.tag_id {
            sql.push_str(" AND tg.tag_id = ?2");
            args.push(Box::new(tag_id.clone()));
        }
        if let Some(ref target_id) = query.target_id {
            let idx = args.len() + 1;
            sql.push_str(&format!(" AND tg.target_id = ?{idx}"));
            args.push(Box::new(target_id.clone()));
        }
        if let Some(ref target_type) = query.target_type {
            let idx = args.len() + 1;
            sql.push_str(&format!(" AND tg.target_type = ?{idx}"));
            args.push(Box::new(target_type.clone()));
        }
        sql.push_str(" ORDER BY tg.created_at DESC");

        let refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let taggings = stmt
            .query_map(rusqlite::params_from_iter(refs), row_to_tagging)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(taggings)
    })
    .await;

    match result {
        Ok(Ok(taggings)) => (StatusCode::OK, Json(json!({ "taggings": taggings }))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Taggings list task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn create_tagging(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateTaggingBody>,
) -> (StatusCode, Json<serde_json::Value>) {
    if let Err(msg) = validate_scope(&body.target_type) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})));
    }
    if body.target_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "target_id is required"})),
        );
    }
    if body.tag_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "tag_id is required"})),
        );
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let id = uuid::Uuid::new_v4().to_string();
    let now = iso_now();
    let tagging = Tagging {
        id: id.clone(),
        tag_id: body.tag_id.clone(),
        target_id: body.target_id.clone(),
        target_type: body.target_type.clone(),
        created_at: now,
    };

    let response_tagging = tagging.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify the tag exists and belongs to the user.
        let tag_exists = conn
            .query_row(
                "SELECT 1 FROM tags WHERE id = ?1 AND user_id = ?2",
                params![&body.tag_id, &user_id],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !tag_exists {
            return Ok::<_, rusqlite::Error>(false);
        }
        conn.execute(
            "INSERT INTO taggings (id, tag_id, target_id, target_type, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                &tagging.id,
                &tagging.tag_id,
                &tagging.target_id,
                &tagging.target_type,
                &tagging.created_at,
            ],
        )?;
        Ok(true)
    })
    .await;

    match result {
        Ok(Ok(true)) => (StatusCode::CREATED, Json(json!(response_tagging))),
        Ok(Ok(false)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "tag not found or not owned by user"})),
        ),
        Ok(Err(rusqlite::Error::SqliteFailure(code, Some(_))))
            if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY =>
        {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "tag not found"})),
            )
        }
        Ok(Err(rusqlite::Error::SqliteFailure(code, Some(_))))
            if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
        {
            (
                StatusCode::CONFLICT,
                Json(json!({"error": "target already tagged with this tag"})),
            )
        }
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tagging create task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn delete_tagging(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let db = state.db.clone();
    let user_id = user.user_id;

    let response_id = id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let affected = conn.execute(
            "DELETE FROM taggings
             WHERE id = ?1
               AND EXISTS (SELECT 1 FROM tags WHERE id = taggings.tag_id AND user_id = ?2)",
            params![&id, &user_id],
        )?;
        Ok::<_, rusqlite::Error>(affected)
    })
    .await;

    match result {
        Ok(Ok(0)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "tagging not found"})),
        ),
        Ok(Ok(_)) => (StatusCode::OK, Json(json!({"deleted": true, "id": response_id}))),
        Ok(Err(e)) => db_err(e),
        Err(e) => {
            tracing::warn!("Tagging delete task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_state() -> (Arc<AppState>, tempfile::TempDir) {
        let temp = tempfile::tempdir().expect("temp dir");
        let state = crate::test_helpers::app_state(temp.path()).await;
        (state, temp)
    }

    #[tokio::test]
    async fn tag_crud_round_trip() {
        let (state, _temp) = test_state().await;
        let user = AuthUser {
            user_id: "test-user".to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        };

        // Create
        let create_resp = create_tag(
            State(state.clone()),
            Extension(user.clone()),
            Json(CreateTagBody {
                label: "  SEO  ".to_string(),
                color: "blue".to_string(),
                icon: Some("Tag".to_string()),
                scope: "agent".to_string(),
                description: Some("Marketing tag".to_string()),
            }),
        )
        .await;
        assert_eq!(create_resp.0, StatusCode::CREATED);

        // List
        let list_resp = list_tags(
            State(state.clone()),
            Extension(user.clone()),
            Query(ListTagsQuery { scope: None }),
        )
        .await;
        assert_eq!(list_resp.0, StatusCode::OK);
        let tags = list_resp.1 .0.get("tags").unwrap().as_array().unwrap();
        assert_eq!(tags.len(), 1);
        let id = tags[0]["id"].as_str().unwrap().to_string();
        assert_eq!(tags[0]["label"], "SEO");

        // Get
        let get_resp = get_tag(
            State(state.clone()),
            Extension(user.clone()),
            Path(id.clone()),
        )
        .await;
        assert_eq!(get_resp.0, StatusCode::OK);

        // Update
        let update_resp = update_tag(
            State(state.clone()),
            Extension(user.clone()),
            Path(id.clone()),
            Json(UpdateTagBody {
                label: Some("SEO v2".to_string()),
                color: None,
                icon: None,
                scope: None,
                description: None,
            }),
        )
        .await;
        assert_eq!(update_resp.0, StatusCode::OK);
        assert_eq!(update_resp.1 .0["label"], "SEO v2");

        // Delete
        let delete_resp = delete_tag(State(state.clone()), Extension(user.clone()), Path(id)).await;
        assert_eq!(delete_resp.0, StatusCode::OK);

        let list_resp = list_tags(
            State(state.clone()),
            Extension(user),
            Query(ListTagsQuery { scope: None }),
        )
        .await;
        assert_eq!(list_resp.0, StatusCode::OK);
        assert_eq!(list_resp.1 .0["tags"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn tagging_ownership_isolation() {
        let (state, _temp) = test_state().await;
        let alice = AuthUser {
            user_id: "alice".to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        };
        let bob = AuthUser {
            user_id: "bob".to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: None,
            organization_role: None,
            organization_slug: None,
        };

        let tag_resp = create_tag(
            State(state.clone()),
            Extension(alice.clone()),
            Json(CreateTagBody {
                label: "Alice tag".to_string(),
                color: "red".to_string(),
                icon: None,
                scope: "agent".to_string(),
                description: None,
            }),
        )
        .await;
        let tag_id = tag_resp.1 .0["id"].as_str().unwrap().to_string();

        // Bob cannot tag with Alice's tag.
        let tagging_resp = create_tagging(
            State(state.clone()),
            Extension(bob.clone()),
            Json(CreateTaggingBody {
                tag_id: tag_id.clone(),
                target_id: "agent-1".to_string(),
                target_type: "agent".to_string(),
            }),
        )
        .await;
        assert_eq!(tagging_resp.0, StatusCode::NOT_FOUND);

        // Alice can.
        let tagging_resp = create_tagging(
            State(state.clone()),
            Extension(alice.clone()),
            Json(CreateTaggingBody {
                tag_id: tag_id.clone(),
                target_id: "agent-1".to_string(),
                target_type: "agent".to_string(),
            }),
        )
        .await;
        assert_eq!(tagging_resp.0, StatusCode::CREATED);
        let tagging_id = tagging_resp.1 .0["id"].as_str().unwrap().to_string();

        // Bob cannot delete Alice's tagging.
        let del_resp = delete_tagging(State(state.clone()), Extension(bob), Path(tagging_id.clone())).await;
        assert_eq!(del_resp.0, StatusCode::NOT_FOUND);

        // Alice can.
        let del_resp = delete_tagging(State(state.clone()), Extension(alice), Path(tagging_id)).await;
        assert_eq!(del_resp.0, StatusCode::OK);
    }
}
