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
