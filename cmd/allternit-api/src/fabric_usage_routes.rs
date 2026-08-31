//! Fabric usage ingestion routes.
//!
//! Admin routes are mounted under `/api/v1` so paths land at
//! `/api/v1/admin/fabric/usage`. They accept usage events from providers or
//! internal daemons and optionally trigger batch conversion to cost events.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use rusqlite::OptionalExtension;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    fabric::credits::CreditsLedger,
    fabric::usage::{UsageError, UsageIngestor},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/fabric/usage", post(submit_usage))
        .route("/admin/fabric/usage/process", post(process_usage_batch))
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    body: Json<Value>,
}

impl ApiError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            body: Json(json!({"error": code, "message": message.into()})),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(status, code, message)
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "fabric usage operation failed");
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn usage_error(err: UsageError) -> ApiError {
    match err {
        UsageError::ResourceNotFound(_) => {
            error(StatusCode::NOT_FOUND, "resource_not_found", err.to_string())
        }
        UsageError::NoPricing(_) | UsageError::InvalidUnit(_) => {
            error(StatusCode::BAD_REQUEST, "invalid_usage", err.to_string())
        }
        UsageError::Credits(e) => {
            error(StatusCode::PAYMENT_REQUIRED, "credits_error", e.to_string())
        }
        UsageError::Db(e) => internal(e),
    }
}

fn require_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id.clone().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })
}

fn require_org_admin(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = require_org(user)?;
    if !crate::rbac::is_org_admin(conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric usage.",
        ));
    }
    Ok(org)
}

#[derive(Debug, Deserialize)]
struct SubmitUsageRequest {
    resource_id: String,
    event_type: String,
    quantity: f64,
    unit: String,
    #[serde(default)]
    measured_at: Option<String>,
}

async fn submit_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<SubmitUsageRequest>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let measured_at = req
        .measured_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let event_id = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let org = require_org_admin(&conn, &user_for_admin)?;

        // Ensure the resource belongs to the admin's organization so one org
        // cannot inject usage events against another org's resources.
        let resource_org: Option<String> = conn
            .query_row(
                "SELECT organization_id FROM fabric_resources WHERE id = ?1",
                rusqlite::params![&req.resource_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(internal)?;
        let resource_org = resource_org.ok_or_else(|| {
            error(StatusCode::NOT_FOUND, "resource_not_found", "No such resource")
        })?;
        if resource_org != org {
            return Err(error(
                StatusCode::FORBIDDEN,
                "wrong_organization",
                "Resource belongs to a different organization.",
            ));
        }

        let ingestor = UsageIngestor::new(db);
        ingestor
            .record_usage_event(
                &req.resource_id,
                &req.event_type,
                req.quantity,
                &req.unit,
                measured_at,
            )
            .map_err(usage_error)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({
        "usage_event_id": event_id,
        "status": "recorded",
    })))
}

#[derive(Debug, Deserialize)]
struct ProcessBatchQuery {
    #[serde(default = "default_batch_size")]
    batch_size: usize,
}

fn default_batch_size() -> usize {
    100
}

async fn process_usage_batch(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ProcessBatchQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let processed = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let _org = require_org_admin(&conn, &user_for_admin)?;
        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db);
        ingestor
            .run_batch(&ledger, query.batch_size)
            .map_err(usage_error)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({"processed": processed})))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use rusqlite::params;
    use serde_json::Value;
    use tower::ServiceExt;

    fn seed_org_user_role(
        state: &AppState,
        org_id: &str,
        user_id: &str,
        role: &str,
    ) -> AuthUser {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name, status) VALUES (?1, ?2, 'active')",
            params![org_id, "Test Org"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            params![user_id, format!("{user_id}@test.com")],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role)
             VALUES (?1, ?2, ?3, ?4)",
            params![format!("{org_id}-{user_id}"), org_id, user_id, role],
        )
        .unwrap();
        AuthUser {
            user_id: user_id.to_string(),
            organization_id: Some(org_id.to_string()),
            email: Some(format!("{user_id}@test.com")),
            organization_role: Some(role.to_string()),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_slug: None,
        }
    }

    fn seed_resource(state: &AppState, resource_id: &str, org_id: &str) {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_resource_classes
             (id, kind, class, vcpu_min, memory_mib_min, gpu_vram_mib_min,
              reliability_tier, retail_price_per_hour_cents,
              retail_price_per_request_cents, retail_price_per_token_cents)
             VALUES (?1, 'compute', 's', 1, 1024, 0, 'standard', 3600, 0, 0)",
            params![format!("compute.s")],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO fabric_resources (id, organization_id, kind, class, status)
             VALUES (?1, ?2, 'compute', 's', 'active')",
            params![resource_id, org_id],
        )
        .unwrap();
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::Null)
    }

    #[tokio::test]
    async fn submit_usage_records_event() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "resource-1", "org-1");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/usage")
                    .extension(user)
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"resource_id":"resource-1","event_type":"compute_seconds","quantity":60.0,"unit":"seconds"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert!(!body["usage_event_id"].as_str().unwrap().is_empty());

        let conn = state.db.connect().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fabric_usage_events WHERE resource_id = ?1",
                params!["resource-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn submit_usage_requires_admin() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "user-1", "member");
        seed_resource(&state, "resource-1", "org-1");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/usage")
                    .extension(user)
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"resource_id":"resource-1","event_type":"compute_seconds","quantity":60.0,"unit":"seconds"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn process_batch_requires_admin() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "user-1", "member");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/usage/process")
                    .extension(user)
                    .header("content-type", "application/json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn process_batch_returns_count() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "resource-1", "org-1");

        let ingestor = UsageIngestor::new(state.db.clone());
        ingestor
            .record_usage_event("resource-1", "compute_seconds", 60.0, "seconds", None)
            .unwrap();

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/usage/process")
                    .extension(user)
                    .header("content-type", "application/json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["processed"], 1);
    }
}
