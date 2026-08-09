//! Service account management for organization-scoped API access.
//!
//! Endpoints are gated to organization owners/admins and merged into the
//! `/api/v1` chain in main.rs, so paths land at `/api/v1/admin/service-accounts*`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/service-accounts", post(create_account).get(list_accounts))
        .route(
            "/admin/service-accounts/:id",
            get(get_account)
                .patch(update_account)
                .delete(delete_account),
        )
        .route(
            "/admin/service-accounts/:id/rotate",
            post(rotate_account_secret),
        )
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "service account operation failed");
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
            "Only organization owners/admins can manage service accounts.",
        ));
    }
    Ok(org.to_string())
}

fn generate_client_id() -> String {
    format!("sa-{}", uuid::Uuid::new_v4().simple())
}

fn generate_client_secret() -> String {
    let mut bytes = [0u8; 32];
    bytes[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    bytes[16..].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    format!("sasec-{}", URL_SAFE_NO_PAD.encode(bytes))
}

fn hash_secret(plain: &str) -> String {
    hex::encode(Sha256::digest(plain.as_bytes()))
}

fn parse_scopes(value: Option<String>) -> Result<Option<Vec<String>>, ApiError> {
    match value {
        None => Ok(None),
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            let parsed: Vec<String> = trimmed
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            Ok(Some(parsed))
        }
    }
}

fn validate_name(name: &str) -> Result<(), ApiError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Name must be 1-128 characters.",
        ));
    }
    Ok(())
}

fn account_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let scopes_raw: Option<String> = row.get(4)?;
    let scopes: Option<Vec<String>> = scopes_raw
        .as_deref()
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "org_id": row.get::<_, String>(1)?,
        "name": row.get::<_, String>(2)?,
        "client_id": row.get::<_, String>(3)?,
        "scopes": scopes,
        "created_at": row.get::<_, String>(5)?,
        "last_rotated_at": row.get::<_, String>(6)?,
    }))
}

fn find_account(
    conn: &rusqlite::Connection,
    id: &str,
    org: &str,
) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, org_id, name, client_id, scopes, created_at, last_rotated_at
         FROM service_accounts WHERE id = ?1 AND org_id = ?2",
        params![id, org],
        account_json,
    )
    .optional()
    .map_err(internal)?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "account_not_found", "No such service account."))
}

#[derive(Deserialize)]
struct CreateAccount {
    name: String,
    scopes: Option<String>,
}

#[derive(Serialize)]
struct CreateAccountResponse {
    id: String,
    org_id: String,
    name: String,
    client_id: String,
    #[serde(rename = "client_secret")]
    client_secret: String,
    scopes: Option<Vec<String>>,
    created_at: String,
    last_rotated_at: String,
}

async fn create_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateAccount>,
) -> Response {
    if let Err(e) = validate_name(&body.name) {
        return e.into_response();
    }
    let scopes = match parse_scopes(body.scopes) {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let id = uuid::Uuid::new_v4().to_string();
        let client_id = generate_client_id();
        let client_secret = generate_client_secret();
        let hashed_secret = hash_secret(&client_secret);
        let scopes_json = scopes.as_ref().and_then(|s| serde_json::to_string(s).ok());
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO service_accounts (id, org_id, name, client_id, hashed_secret, scopes, created_at, last_rotated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![id, org, body.name.trim(), client_id, hashed_secret, scopes_json, now],
        ).map_err(internal)?;
        Ok::<_, ApiError>(CreateAccountResponse {
            id,
            org_id: org,
            name: body.name.trim().to_string(),
            client_id,
            client_secret,
            scopes,
            created_at: now.clone(),
            last_rotated_at: now,
        })
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_accounts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare(
            "SELECT id, org_id, name, client_id, scopes, created_at, last_rotated_at
             FROM service_accounts WHERE org_id = ?1 ORDER BY created_at DESC"
        ).map_err(internal)?;
        let rows = stmt
            .query_map([org], account_json)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"service_accounts": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_account(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateAccount {
    name: Option<String>,
    scopes: Option<String>,
}

async fn update_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateAccount>,
) -> Response {
    if let Some(name) = &body.name {
        if let Err(e) = validate_name(name) {
            return e.into_response();
        }
    }
    let scopes = match parse_scopes(body.scopes) {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_account(&conn, &id, &org)?;
        let scopes_json = scopes.as_ref().and_then(|s| serde_json::to_string(s).ok());
        conn.execute(
            "UPDATE service_accounts
             SET name = COALESCE(?1, name),
                 scopes = COALESCE(?2, scopes)
             WHERE id = ?3 AND org_id = ?4",
            params![body.name.as_deref().map(|n| n.trim()), scopes_json, id, org],
        ).map_err(internal)?;
        find_account(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn.execute(
            "DELETE FROM service_accounts WHERE id = ?1 AND org_id = ?2",
            params![id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "account_not_found",
                "No such service account.",
            ));
        }
        Ok::<_, ApiError>(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Serialize)]
struct RotateResponse {
    id: String,
    client_id: String,
    #[serde(rename = "client_secret")]
    client_secret: String,
    last_rotated_at: String,
}

async fn rotate_account_secret(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let client_id: String = conn
            .query_row(
                "SELECT client_id FROM service_accounts WHERE id = ?1 AND org_id = ?2",
                params![id, org],
                |row| row.get(0),
            )
            .optional()
            .map_err(internal)?
            .ok_or_else(|| error(StatusCode::NOT_FOUND, "account_not_found", "No such service account."))?;
        let client_secret = generate_client_secret();
        let hashed_secret = hash_secret(&client_secret);
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE service_accounts SET hashed_secret = ?1, last_rotated_at = ?2 WHERE id = ?3",
            params![hashed_secret, now, id],
        ).map_err(internal)?;
        Ok::<_, ApiError>(RotateResponse {
            id,
            client_id,
            client_secret,
            last_rotated_at: now,
        })
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
    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-service-account-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_admin(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
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
    fn name_validation_rejects_blank_and_oversized_names() {
        assert!(validate_name("Pipeline CI").is_ok());
        assert!(validate_name("   ").is_err());
        assert!(validate_name(&"x".repeat(129)).is_err());
    }

    #[test]
    fn admin_org_accepts_owner_and_rejects_member() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");
        seed_org_admin(&conn, "org-1", "member-1", "member");

        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "owner-1")).unwrap(), "org-1");
        let err = admin_org(&conn, &auth_user(Some("org-1"), "member-1")).unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);
        let err = admin_org(&conn, &auth_user(None, "owner-1")).unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn service_account_roundtrip_and_rotation() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");

        let account_id = uuid::Uuid::new_v4().to_string();
        let client_id = generate_client_id();
        let client_secret = generate_client_secret();
        let hashed = hash_secret(&client_secret);
        let scopes = serde_json::to_string(&vec!["gateway:read".to_string()]).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO service_accounts (id, org_id, name, client_id, hashed_secret, scopes, created_at, last_rotated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            rusqlite::params![account_id, "org-1", "CI Pipeline", client_id, hashed, scopes, now],
        )
        .unwrap();

        let row = find_account(&conn, &account_id, "org-1").unwrap();
        assert_eq!(row["name"], "CI Pipeline");
        assert_eq!(row["client_id"], client_id);
        assert!(row["scopes"].as_array().unwrap().contains(&json!("gateway:read")));

        let new_secret = generate_client_secret();
        let new_hash = hash_secret(&new_secret);
        conn.execute(
            "UPDATE service_accounts SET hashed_secret = ?1, last_rotated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            rusqlite::params![new_hash, account_id],
        )
        .unwrap();

        let rotated: String = conn
            .query_row(
                "SELECT hashed_secret FROM service_accounts WHERE id = ?1",
                [&account_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(rotated, new_hash);

        let _ = std::fs::remove_file(&path);
    }
}
