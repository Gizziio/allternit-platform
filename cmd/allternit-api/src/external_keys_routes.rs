//! External keys API (BYO KMS scaffold) — organization-owned registrations
//! of cloud provider KMS keys (AWS/Azure/GCP). This is a scaffold: `validate`
//! flips `validation_status` locally rather than calling out to the cloud
//! provider to confirm the key is usable. Wiring a real validation call
//! (assume-role + `DescribeKey`/`GetKey`/`GetCryptoKey` per provider) is
//! follow-on work — see docs/SWARM_E_PHASE2_NOTES.md.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/admin/external-keys",
            post(create_key).get(list_keys),
        )
        .route(
            "/admin/external-keys/:id",
            axum::routing::get(get_key)
                .put(update_key)
                .delete(delete_key),
        )
        .route("/admin/external-keys/:id/validate", post(validate_key))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "external key operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn admin_org(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = user.organization_id.as_deref().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })?;
    if !crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage external keys.",
        ));
    }
    Ok(org.to_string())
}

fn valid_provider(provider: &str) -> bool {
    matches!(provider, "aws" | "azure" | "gcp")
}

fn key_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "provider": row.get::<_, String>(1)?,
        "key_ref": row.get::<_, String>(2)?,
        "name": row.get::<_, String>(3)?,
        "validation_status": row.get::<_, String>(4)?,
        "last_validated_at": row.get::<_, Option<String>>(5)?,
        "created_by": row.get::<_, String>(6)?,
        "created_at": row.get::<_, String>(7)?,
        "updated_at": row.get::<_, String>(8)?,
    }))
}

fn find_key(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, provider, key_ref, name, validation_status, last_validated_at, created_by, created_at, updated_at FROM external_keys WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        key_json,
    ).optional().map_err(internal)?.ok_or_else(|| error(StatusCode::NOT_FOUND, "external_key_not_found", "No such external key."))
}

#[derive(Deserialize)]
struct CreateKey {
    provider: String,
    key_ref: String,
    name: String,
}

fn validate_create(body: &CreateKey) -> Result<(), ApiError> {
    if !valid_provider(&body.provider) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_provider",
            "provider must be one of aws, azure, gcp.",
        ));
    }
    if body.key_ref.trim().is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_key_ref",
            "key_ref must not be empty.",
        ));
    }
    if body.name.trim().is_empty() || body.name.len() > 128 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Name must be 1-128 characters.",
        ));
    }
    Ok(())
}

async fn create_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateKey>,
) -> Response {
    if let Err(e) = validate_create(&body) {
        return e.into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO external_keys (id, organization_id, provider, key_ref, name, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, org, body.provider, body.key_ref.trim(), body.name.trim(), user.user_id],
        ).map_err(internal)?;
        find_key(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_keys(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare("SELECT id, provider, key_ref, name, validation_status, last_validated_at, created_by, created_at, updated_at FROM external_keys WHERE organization_id = ?1 ORDER BY created_at DESC").map_err(internal)?;
        let rows = stmt.query_map([org], key_json).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"external_keys": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_key(&conn, &id, &org)
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateKey {
    name: Option<String>,
    key_ref: Option<String>,
}

async fn update_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateKey>,
) -> Response {
    if let Some(name) = &body.name {
        if name.trim().is_empty() || name.len() > 128 {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_name",
                "Name must be 1-128 characters.",
            )
            .into_response();
        }
    }
    if let Some(key_ref) = &body.key_ref {
        if key_ref.trim().is_empty() {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_key_ref",
                "key_ref must not be empty.",
            )
            .into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_key(&conn, &id, &org)?;
        // Editing key_ref invalidates any prior validation — it now points
        // at a different cloud resource.
        conn.execute(
            "UPDATE external_keys SET name = COALESCE(?1, name), key_ref = COALESCE(?2, key_ref), validation_status = CASE WHEN ?2 IS NOT NULL THEN 'pending' ELSE validation_status END, last_validated_at = CASE WHEN ?2 IS NOT NULL THEN NULL ELSE last_validated_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?3 AND organization_id = ?4",
            params![
                body.name.as_deref().map(|n| n.trim()),
                body.key_ref.as_deref().map(|k| k.trim()),
                id,
                org
            ],
        ).map_err(internal)?;
        find_key(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn
            .execute(
                "DELETE FROM external_keys WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "external_key_not_found",
                "No such external key.",
            ));
        }
        Ok::<_, ApiError>(())
    })
    .await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

/// Scaffold: marks the key as validated without contacting the cloud
/// provider. Always succeeds (`validation_status = 'valid'`) once the key
/// exists — real provider-side verification is Phase 3 follow-on work.
async fn validate_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_key(&conn, &id, &org)?;
        conn.execute(
            "UPDATE external_keys SET validation_status = 'valid', last_validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND organization_id = ?2",
            params![id, org],
        ).map_err(internal)?;
        find_key(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_validation_accepts_only_supported_clouds() {
        assert!(valid_provider("aws"));
        assert!(valid_provider("azure"));
        assert!(valid_provider("gcp"));
        assert!(!valid_provider("oci"));
        assert!(!valid_provider(""));
    }

    #[test]
    fn create_validation_requires_ref_and_name() {
        let ok = CreateKey {
            provider: "aws".into(),
            key_ref: "arn:aws:kms:us-east-1:123:key/abc".into(),
            name: "Prod KMS".into(),
        };
        assert!(validate_create(&ok).is_ok());
        let bad_provider = CreateKey {
            provider: "oci".into(),
            ..ok_clone(&ok)
        };
        assert!(validate_create(&bad_provider).is_err());
        let blank_ref = CreateKey {
            key_ref: "  ".into(),
            ..ok_clone(&ok)
        };
        assert!(validate_create(&blank_ref).is_err());
    }

    fn ok_clone(k: &CreateKey) -> CreateKey {
        CreateKey {
            provider: k.provider.clone(),
            key_ref: k.key_ref.clone(),
            name: k.name.clone(),
        }
    }

    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-external-keys-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            rusqlite::params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    fn auth_user(org_id: Option<&str>, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    #[test]
    fn admin_org_gates_non_admins() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");
        seed_org_user(&conn, "org-1", "member-1", "member");

        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "admin-1")).unwrap(), "org-1");
        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "member-1")).unwrap_err().0, StatusCode::FORBIDDEN);
        assert_eq!(admin_org(&conn, &auth_user(None, "admin-1")).unwrap_err().0, StatusCode::FORBIDDEN);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn external_key_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        let key_id = "key-1";
        conn.execute(
            "INSERT INTO external_keys (id, organization_id, provider, key_ref, name, validation_status, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![key_id, "org-1", "aws", "arn:aws:kms:us-east-1:123:key/abc", "Prod KMS", "pending", "admin-1"],
        )
        .unwrap();

        let key = find_key(&conn, key_id, "org-1").unwrap();
        assert_eq!(key["provider"], "aws");
        assert_eq!(key["validation_status"], "pending");

        conn.execute(
            "UPDATE external_keys SET validation_status = 'valid', last_validated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            rusqlite::params![key_id],
        )
        .unwrap();
        let key = find_key(&conn, key_id, "org-1").unwrap();
        assert_eq!(key["validation_status"], "valid");
        assert!(key["last_validated_at"].is_string());

        let _ = std::fs::remove_file(&path);
    }
}
