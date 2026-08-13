//! Device attestation records for organization-managed devices.
//!
//! Admins can register attestation tokens from platform attestation services
//! and revoke devices that are no longer trusted.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/device-attestation", post(register_attestation).get(list_attestations))
        .route(
            "/admin/device-attestation/:id",
            get(get_attestation).delete(revoke_attestation),
        )
        .route("/admin/device-attestation/verify", post(verify_attestation))
}

const VALID_PLATFORMS: &[&str] = &["ios", "android", "macos", "windows", "web"];

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "device attestation operation failed");
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
            "Only organization owners/admins can manage device attestation.",
        ));
    }
    Ok(org.to_string())
}

fn valid_platform(platform: &str) -> bool {
    VALID_PLATFORMS.contains(&platform)
}

fn attestation_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "org_id": row.get::<_, String>(1)?,
        "user_id": row.get::<_, String>(2)?,
        "platform": row.get::<_, String>(3)?,
        "attestation_token": row.get::<_, String>(4)?,
        "status": row.get::<_, String>(5)?,
        "expires_at": row.get::<_, Option<String>>(6)?,
        "created_at": row.get::<_, String>(7)?,
        "updated_at": row.get::<_, String>(8)?,
    }))
}

#[derive(Deserialize)]
struct RegisterAttestation {
    user_id: String,
    platform: String,
    attestation_token: String,
    expires_at: Option<String>,
}

async fn register_attestation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<RegisterAttestation>,
) -> Response {
    if !valid_platform(&body.platform) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_platform",
            "platform must be one of ios, android, macos, windows, web.",
        )
        .into_response();
    }
    if body.attestation_token.trim().is_empty() {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_token",
            "attestation_token is required.",
        )
        .into_response();
    }
    if let Some(expiry) = &body.expires_at {
        if chrono::DateTime::parse_from_rfc3339(expiry).is_err() {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_expiration",
                "expires_at must be RFC 3339.",
            )
            .into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO device_attestation_records (id, org_id, user_id, platform, attestation_token, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, org, body.user_id, body.platform, body.attestation_token, body.expires_at],
        ).map_err(internal)?;
        conn.query_row(
            "SELECT id, org_id, user_id, platform, attestation_token, status, expires_at, created_at, updated_at FROM device_attestation_records WHERE id = ?1",
            [&id],
            attestation_json,
        )
        .map_err(internal)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(default)]
    user_id: Option<String>,
    #[serde(default)]
    platform: Option<String>,
}

async fn list_attestations(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut sql = String::from(
            "SELECT id, org_id, user_id, platform, attestation_token, status, expires_at, created_at, updated_at FROM device_attestation_records WHERE org_id = ?1",
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(org)];
        if let Some(user_id) = query.user_id {
            sql.push_str(" AND user_id = ?2");
            params_vec.push(Box::new(user_id));
        }
        if let Some(platform) = query.platform {
            let next = params_vec.len() + 1;
            sql.push_str(&format!(" AND platform = ?{next}"));
            params_vec.push(Box::new(platform));
        }
        sql.push_str(" ORDER BY created_at DESC");
        let mut stmt = conn.prepare(&sql).map_err(internal)?;
        let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = stmt
            .query_map(&*params_ref, attestation_json)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"attestations": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_attestation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        conn.query_row(
            "SELECT id, org_id, user_id, platform, attestation_token, status, expires_at, created_at, updated_at FROM device_attestation_records WHERE id = ?1 AND org_id = ?2",
            params![id, org],
            attestation_json,
        )
        .optional()
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "attestation_not_found", "No such attestation record."))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn revoke_attestation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<(), ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn.execute(
            "UPDATE device_attestation_records SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND org_id = ?2 AND status != 'revoked'",
            params![id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "attestation_not_found",
                "No such active attestation record.",
            ));
        }
        Ok(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct VerifyAttestation {
    user_id: String,
    platform: String,
    attestation_token: String,
}

async fn verify_attestation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<VerifyAttestation>,
) -> Response {
    if !valid_platform(&body.platform) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_platform",
            "platform must be one of ios, android, macos, windows, web.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let record = conn
            .query_row(
                "SELECT id, org_id, user_id, platform, attestation_token, status, expires_at, created_at, updated_at FROM device_attestation_records
                 WHERE org_id = ?1 AND user_id = ?2 AND platform = ?3 AND attestation_token = ?4 AND status = 'valid'
                   AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
                params![org, body.user_id, body.platform, body.attestation_token],
                attestation_json,
            )
            .optional()
            .map_err(internal)?;
        let valid = record.is_some();
        Ok(json!({
            "valid": valid,
            "record": record,
        }))
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
        let path = std::env::temp_dir().join(format!("allternit-device-attestation-test-{}.db", id));
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
    fn platform_validation_accepts_known_platforms() {
        assert!(valid_platform("ios"));
        assert!(valid_platform("web"));
        assert!(!valid_platform("unknown"));
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

        let _ = std::fs::remove_file(&path);
    }
}
