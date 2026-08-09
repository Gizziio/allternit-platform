//! Memory Stores API scaffold (`/beta/memory-stores`).
//!
//! A memory store is a named, user-scoped container agents can read/write
//! long-term memory into. This scaffold only owns the store record itself
//! (create/list/get/delete) plus its `redaction_policy` — the policy applied
//! to content before it is persisted or surfaced to a model. Reading/writing
//! memory contents through a store is out of scope for this slice.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, error::ApiError, AppState};

fn empty_object() -> Value {
    json!({})
}

pub fn beta_memory_store_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/beta/memory-stores",
            get(list_memory_stores).post(create_memory_store),
        )
        .route(
            "/beta/memory-stores/:id",
            get(get_memory_store).delete(delete_memory_store),
        )
}

#[derive(Debug, Deserialize)]
struct CreateMemoryStoreBody {
    name: String,
    #[serde(default = "empty_object")]
    redaction_policy: Value,
    #[serde(default = "empty_object")]
    metadata: Value,
}

#[derive(Debug, Serialize)]
struct MemoryStoreRow {
    id: String,
    organization_id: Option<String>,
    name: String,
    redaction_policy: Value,
    metadata: Value,
    created_at: String,
    updated_at: String,
}

const MEMORY_STORE_SELECT: &str = "SELECT id, organization_id, name, redaction_policy, metadata,
    created_at, updated_at FROM beta_memory_stores";

fn read_memory_store(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryStoreRow> {
    let redaction_policy: String = row.get(3)?;
    let metadata: String = row.get(4)?;
    Ok(MemoryStoreRow {
        id: row.get(0)?,
        organization_id: row.get(1)?,
        name: row.get(2)?,
        redaction_policy: serde_json::from_str(&redaction_policy).unwrap_or_else(|_| json!({})),
        metadata: serde_json::from_str(&metadata).unwrap_or_else(|_| json!({})),
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

async fn create_memory_store(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateMemoryStoreBody>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    if !body.redaction_policy.is_object() || !body.metadata.is_object() {
        return Err(ApiError::BadRequest(
            "redaction_policy and metadata must be objects".into(),
        ));
    }
    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let result_id = id.clone();
    let name = name.to_string();
    let store = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO beta_memory_stores
             (id, user_id, organization_id, name, redaction_policy, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                user.user_id,
                user.organization_id,
                name,
                body.redaction_policy.to_string(),
                body.metadata.to_string()
            ],
        )?;
        conn.query_row(
            &format!("{MEMORY_STORE_SELECT} WHERE id = ?1"),
            params![id],
            read_memory_store,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| match e {
        rusqlite::Error::SqliteFailure(err, _)
            if err.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            ApiError::BadRequest("a memory store with this name already exists".into())
        }
        other => ApiError::DbError(other.to_string()),
    })?;
    Ok((
        StatusCode::CREATED,
        Json(json!({"memory_store": store, "id": result_id})),
    ))
}

async fn list_memory_stores(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(&format!(
            "{MEMORY_STORE_SELECT} WHERE user_id = ?1 ORDER BY created_at DESC"
        ))?;
        let rows = stmt
            .query_map(params![user.user_id], read_memory_store)?
            .collect::<Result<Vec<MemoryStoreRow>, _>>()?;
        Ok::<Vec<MemoryStoreRow>, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    Ok(Json(json!({"memory_stores": rows})))
}

async fn get_memory_store(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_id = user.user_id;
    let store = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            &format!("{MEMORY_STORE_SELECT} WHERE id = ?1 AND user_id = ?2"),
            params![id, user_id],
            read_memory_store,
        )
        .optional()
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??
    .ok_or_else(|| ApiError::NotFound("memory store not found".into()))?;
    Ok(Json(json!({"memory_store": store})))
}

async fn delete_memory_store(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let db = state.db.clone();
    let deleted = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM beta_memory_stores WHERE id = ?1 AND user_id = ?2",
            params![id, user.user_id],
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))??;
    if deleted == 0 {
        return Err(ApiError::NotFound("memory store not found".into()));
    }
    Ok(StatusCode::NO_CONTENT)
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

    fn test_user(id: &str, org_id: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: id.to_string(),
            email: Some(format!("{}@example.test", id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(str::to_string),
            organization_role: None,
            organization_slug: None,
        }
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "allternit-beta-memory-stores-{}-{}",
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
    fn empty_object_default_is_a_json_object() {
        assert!(empty_object().is_object());
    }

    #[tokio::test]
    async fn memory_store_crud_and_isolation() {
        let temp = temp_dir("crud");
        let state = test_app_state(&temp).await;
        let app = beta_memory_store_router().with_state(state);

        // Create a store.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/memory-stores")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some("org-1")))
                    .body(json_body(&json!({
                        "name": "knowledge-base",
                        "redaction_policy": {"pii": true},
                        "metadata": {"domain": "support"}
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let store_id = body["memory_store"]["id"].as_str().unwrap().to_string();
        assert_eq!(body["memory_store"]["name"], json!("knowledge-base"));
        assert_eq!(body["memory_store"]["organization_id"], json!("org-1"));
        assert_eq!(body["memory_store"]["redaction_policy"]["pii"], json!(true));

        // Duplicate name for the same user is rejected.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/memory-stores")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", None))
                    .body(json_body(&json!({"name": "knowledge-base"})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // List only shows the owner's stores.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/memory-stores")
                    .extension(test_user("user-a", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["memory_stores"].as_array().unwrap().len(), 1);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/memory-stores")
                    .extension(test_user("user-b", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["memory_stores"].as_array().unwrap().len(), 0);

        // Get by id.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/memory-stores/{}", store_id))
                    .extension(test_user("user-a", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Another user cannot get it.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/memory-stores/{}", store_id))
                    .extension(test_user("user-b", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        // Delete.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/beta/memory-stores/{}", store_id))
                    .extension(test_user("user-a", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);

        // Getting it after deletion returns 404.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/memory-stores/{}", store_id))
                    .extension(test_user("user-a", None))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[tokio::test]
    async fn rejects_invalid_store_input() {
        let temp = temp_dir("validation");
        let state = test_app_state(&temp).await;
        let app = beta_memory_store_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/memory-stores")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", None))
                    .body(json_body(&json!({"name": "   "})))
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
                    .uri("/beta/memory-stores")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", None))
                    .body(json_body(&json!({
                        "name": "ok",
                        "redaction_policy": "not-an-object"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let _ = std::fs::remove_dir_all(&temp);
    }
}
