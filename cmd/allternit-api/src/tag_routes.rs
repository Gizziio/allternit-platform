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
    }
}
