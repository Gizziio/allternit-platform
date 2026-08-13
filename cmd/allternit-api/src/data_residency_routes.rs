//! Data residency / region pinning controls for organizations.
//!
//! Admins can pin inference and storage to a set of regions and optionally
//! enforce that all requests stay within those regions.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/data-residency", get(get_policy).post(set_policy))
        .route("/admin/data-residency/regions", get(list_available_regions))
}

const VALID_REGIONS: &[&str] = &[
    "us-east-1",
    "us-west-2",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-1",
    "ap-northeast-1",
    "ca-central-1",
    "gb-london-1",
];

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "data residency operation failed");
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
            "Only organization owners/admins can manage data residency.",
        ));
    }
    Ok(org.to_string())
}

fn valid_regions(regions: &[String]) -> Result<(), ApiError> {
    for r in regions {
        if r.trim().is_empty() || !VALID_REGIONS.contains(&r.as_str()) {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_region",
                format!("{} is not a supported region.", r),
            ));
        }
    }
    Ok(())
}

fn policy_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let pinned_raw: String = row.get(1)?;
    let pinned: Vec<String> = serde_json::from_str(&pinned_raw).unwrap_or_default();
    Ok(json!({
        "org_id": row.get::<_, String>(0)?,
        "pinned_regions": pinned,
        "default_region": row.get::<_, Option<String>>(2)?,
        "enforce_region_pinning": row.get::<_, i64>(3)? != 0,
        "created_at": row.get::<_, String>(4)?,
        "updated_at": row.get::<_, String>(5)?,
    }))
}

async fn list_available_regions() -> Response {
    Json(json!({
        "regions": VALID_REGIONS,
    }))
    .into_response()
}

async fn get_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let policy = conn
            .query_row(
                "SELECT org_id, pinned_regions, default_region, enforce_region_pinning, created_at, updated_at
                 FROM data_residency_policies WHERE org_id = ?1",
                [&org],
                policy_json,
            )
            .optional()
            .map_err(internal)?
            .unwrap_or_else(|| {
                json!({
                    "org_id": org,
                    "pinned_regions": Vec::<String>::new(),
                    "default_region": serde_json::Value::Null,
                    "enforce_region_pinning": false,
                    "created_at": serde_json::Value::Null,
                    "updated_at": serde_json::Value::Null,
                })
            });
        Ok(policy)
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct SetPolicy {
    pinned_regions: Vec<String>,
    default_region: Option<String>,
    #[serde(default)]
    enforce_region_pinning: bool,
}

async fn set_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<SetPolicy>,
) -> Response {
    if let Err(e) = valid_regions(&body.pinned_regions) {
        return e.into_response();
    }
    if let Some(ref default) = body.default_region {
        if !body.pinned_regions.contains(default) {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_default_region",
                "default_region must be one of the pinned regions.",
            )
            .into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let pinned_json = serde_json::to_string(&body.pinned_regions).unwrap_or_else(|_| "[]".into());
        let enforce = if body.enforce_region_pinning { 1 } else { 0 };
        conn.execute(
            "INSERT INTO data_residency_policies (org_id, pinned_regions, default_region, enforce_region_pinning)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(org_id) DO UPDATE SET
                 pinned_regions = excluded.pinned_regions,
                 default_region = excluded.default_region,
                 enforce_region_pinning = excluded.enforce_region_pinning,
                 updated_at = CURRENT_TIMESTAMP",
            params![org, pinned_json, body.default_region, enforce],
        )
        .map_err(internal)?;
        conn.query_row(
            "SELECT org_id, pinned_regions, default_region, enforce_region_pinning, created_at, updated_at
             FROM data_residency_policies WHERE org_id = ?1",
            [&org],
            policy_json,
        )
        .map_err(internal)
    })
    .await;
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
        let path = std::env::temp_dir().join(format!("allternit-data-residency-test-{}.db", id));
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

    #[test]
    fn region_validation_rejects_unknown_regions() {
        assert!(valid_regions(&["us-east-1".into()]).is_ok());
        assert!(valid_regions(&["mars-1".into()]).is_err());
        assert!(valid_regions(&["".into()]).is_err());
    }
}
