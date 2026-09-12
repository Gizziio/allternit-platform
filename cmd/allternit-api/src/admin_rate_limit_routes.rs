//! Organization rate-limit management (task G14).
//!
//! Endpoints are gated to organization owners/admins (same gating as
//! `admin_spend_limit_routes`) and merged into the `/api/v1` chain in
//! main.rs, so paths land at `/api/v1/admin/rate-limits`.
//!
//! Two knobs, both columns on `organizations`:
//!
//! - `api_rate_limit_rpm` — the public Clerk-protected API cap enforced by
//!   `rate_limit::rate_limit_middleware`. Semantics (verified against the
//!   middleware): `NULL` means the platform default of **600 RPM**;
//!   any stored value is clamped with `.max(1)`, so `0` would mean *1 request
//!   per minute* — it is **not** unlimited. This API therefore rejects `0`
//!   and accepts `1..=1_000_000`, or explicit `null` to clear the override
//!   back to the default.
//! - `gateway_rate_limit_rpm` — per-organization cap on LLM gateway requests,
//!   enforced by `llm_gateway::auth::org_rate_limit_middleware` with an
//!   in-memory sliding window. Semantics: `NULL` (the default) means **no
//!   org-level cap** — only the per-key cap applies. Same value range; `0`
//!   is rejected (never unlimited).

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/admin/rate-limits", get(get_rate_limits).put(put_rate_limits))
}

/// Effective default for `organizations.api_rate_limit_rpm` when the column
/// is NULL — must stay in sync with `rate_limit::DEFAULT_PUBLIC_API_RATE_LIMIT_RPM`.
pub const DEFAULT_API_RATE_LIMIT_RPM: i64 = 600;
/// Valid override range for both knobs (0 is rejected — see module docs).
pub const MAX_RATE_LIMIT_RPM: i64 = 1_000_000;

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "rate limit management failed");
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
            "Only organization owners/admins can manage rate limits.",
        ));
    }
    Ok(org.to_string())
}

async fn get_rate_limits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let row = conn
            .query_row(
                "SELECT api_rate_limit_rpm, gateway_rate_limit_rpm
                 FROM organizations WHERE id = ?1",
                [&org],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                    ))
                },
            )
            .optional()
            .map_err(internal)?;
        let (api, gateway) = row.unwrap_or((None, None));
        Ok(json!({
            "org_id": org,
            "api_rate_limit_rpm": api,
            "gateway_rate_limit_rpm": gateway,
            "defaults": {
                "api_rate_limit_rpm": DEFAULT_API_RATE_LIMIT_RPM,
                "gateway_rate_limit_rpm": null,
            },
            "semantics": {
                "api_rate_limit_rpm": "NULL uses the 600 RPM platform default; values are clamped to a minimum of 1 by the middleware (0 is not unlimited).",
                "gateway_rate_limit_rpm": "NULL means no org-level gateway cap; values are clamped to a minimum of 1 (0 is not unlimited).",
            },
        }))
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct PutRateLimits {
    /// `Some(Some(v))` sets the override, `Some(None)` clears it (NULL);
    /// absent leaves the column untouched.
    #[serde(default, deserialize_with = "de_nullable_i64")]
    api_rate_limit_rpm: Option<Option<i64>>,
    #[serde(default, deserialize_with = "de_nullable_i64")]
    gateway_rate_limit_rpm: Option<Option<i64>>,
}

/// Distinguish `null` (`Some(None)`) from a missing key (`None`) — the plain
/// `Option<Option<i64>>` mapping treats both as `None`.
fn de_nullable_i64<'de, D>(deserializer: D) -> Result<Option<Option<i64>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

fn validate_value(field: &str, value: i64) -> Result<(), ApiError> {
    if !(1..=MAX_RATE_LIMIT_RPM).contains(&value) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_rate_limit",
            format!(
                "{field} must be between 1 and {MAX_RATE_LIMIT_RPM} RPM, or null to clear the override. 0 is not unlimited — the middleware clamps it to 1."
            ),
        ));
    }
    Ok(())
}

async fn put_rate_limits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<PutRateLimits>,
) -> Response {
    if body.api_rate_limit_rpm.is_none() && body.gateway_rate_limit_rpm.is_none() {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "Provide api_rate_limit_rpm and/or gateway_rate_limit_rpm.",
        )
        .into_response();
    }
    if let Some(Some(value)) = body.api_rate_limit_rpm {
        if let Err(e) = validate_value("api_rate_limit_rpm", value) {
            return e.into_response();
        }
    }
    if let Some(Some(value)) = body.gateway_rate_limit_rpm {
        if let Err(e) = validate_value("gateway_rate_limit_rpm", value) {
            return e.into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        if let Some(api) = body.api_rate_limit_rpm {
            conn.execute(
                "UPDATE organizations SET api_rate_limit_rpm = ?2 WHERE id = ?1",
                params![org, api],
            )
            .map_err(internal)?;
        }
        if let Some(gateway) = body.gateway_rate_limit_rpm {
            conn.execute(
                "UPDATE organizations SET gateway_rate_limit_rpm = ?2 WHERE id = ?1",
                params![org, gateway],
            )
            .map_err(internal)?;
        }
        let row = conn
            .query_row(
                "SELECT api_rate_limit_rpm, gateway_rate_limit_rpm
                 FROM organizations WHERE id = ?1",
                [&org],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                    ))
                },
            )
            .map_err(internal)?;
        Ok(json!({
            "org_id": org,
            "api_rate_limit_rpm": row.0,
            "gateway_rate_limit_rpm": row.1,
            "defaults": {
                "api_rate_limit_rpm": DEFAULT_API_RATE_LIMIT_RPM,
                "gateway_rate_limit_rpm": null,
            },
        }))
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
        let path = std::env::temp_dir().join(format!("allternit-rate-limits-test-{}.db", id));
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
    fn gating_accepts_owner_and_rejects_member() {
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
    fn value_validation_rejects_zero_and_out_of_range() {
        assert!(validate_value("api_rate_limit_rpm", 0).is_err());
        assert!(validate_value("api_rate_limit_rpm", -5).is_err());
        assert!(validate_value("api_rate_limit_rpm", MAX_RATE_LIMIT_RPM + 1).is_err());
        assert!(validate_value("api_rate_limit_rpm", 1).is_ok());
        assert!(validate_value("gateway_rate_limit_rpm", MAX_RATE_LIMIT_RPM).is_ok());
    }

    #[test]
    fn gateway_column_exists_and_defaults_null() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-col", "owner-col", "owner");
        let gateway: Option<i64> = conn
            .query_row(
                "SELECT gateway_rate_limit_rpm FROM organizations WHERE id = 'org-col'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(gateway, None);
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn get_returns_defaults_and_put_round_trips() {
        use tower::ServiceExt;

        let temp = tempfile::tempdir().unwrap();
        let state = crate::test_helpers::app_state(temp.path()).await;
        {
            let conn = state.db.connect().unwrap();
            seed_org_admin(&conn, "org-http", "owner-http", "owner");
        }
        let app = router().with_state(state);

        // GET before any override: NULL + defaults.
        let resp = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("GET")
                    .uri("/admin/rate-limits")
                    .extension(auth_user(Some("org-http"), "owner-http"))
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["api_rate_limit_rpm"], serde_json::Value::Null);
        assert_eq!(body["gateway_rate_limit_rpm"], serde_json::Value::Null);
        assert_eq!(body["defaults"]["api_rate_limit_rpm"], json!(600));

        // PUT both fields → reflected by GET.
        let resp = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/admin/rate-limits")
                    .header("content-type", "application/json")
                    .extension(auth_user(Some("org-http"), "owner-http"))
                    .body(axum::body::Body::from(
                        json!({"api_rate_limit_rpm": 120, "gateway_rate_limit_rpm": 30})
                            .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["api_rate_limit_rpm"], json!(120));
        assert_eq!(body["gateway_rate_limit_rpm"], json!(30));

        let resp = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("GET")
                    .uri("/admin/rate-limits")
                    .extension(auth_user(Some("org-http"), "owner-http"))
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["api_rate_limit_rpm"], json!(120));
        assert_eq!(body["gateway_rate_limit_rpm"], json!(30));

        // Clearing back to defaults with explicit nulls.
        let resp = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("PUT")
                    .uri("/admin/rate-limits")
                    .header("content-type", "application/json")
                    .extension(auth_user(Some("org-http"), "owner-http"))
                    .body(axum::body::Body::from(
                        json!({"api_rate_limit_rpm": null, "gateway_rate_limit_rpm": null})
                            .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["api_rate_limit_rpm"], serde_json::Value::Null);
        assert_eq!(body["gateway_rate_limit_rpm"], serde_json::Value::Null);
    }

    #[tokio::test]
    async fn put_validation_and_gating() {
        use tower::ServiceExt;

        let temp = tempfile::tempdir().unwrap();
        let state = crate::test_helpers::app_state(temp.path()).await;
        {
            let conn = state.db.connect().unwrap();
            seed_org_admin(&conn, "org-gate", "owner-gate", "owner");
            seed_org_admin(&conn, "org-gate", "member-gate", "member");
        }
        let app = router().with_state(state);

        let put = |user: &str, body: serde_json::Value| {
            axum::http::Request::builder()
                .method("PUT")
                .uri("/admin/rate-limits")
                .header("content-type", "application/json")
                .extension(auth_user(Some("org-gate"), user))
                .body(axum::body::Body::from(body.to_string()))
                .unwrap()
        };

        // Non-admin → 403.
        let resp = app.clone().oneshot(put("member-gate", json!({"api_rate_limit_rpm": 10}))).await.unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);

        // 0 is not unlimited → 400; out of range → 400; empty body → 400.
        let resp = app.clone().oneshot(put("owner-gate", json!({"api_rate_limit_rpm": 0}))).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let resp = app
            .clone()
            .oneshot(put("owner-gate", json!({"gateway_rate_limit_rpm": 1_000_001})))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let resp = app.clone().oneshot(put("owner-gate", json!({}))).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // No organization → 403 even for the owner id.
        let resp = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("GET")
                    .uri("/admin/rate-limits")
                    .extension(auth_user(None, "owner-gate"))
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }
}
