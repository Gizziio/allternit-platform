//! Analytics routes
//!
//! Organization-scoped LLM usage analytics for the admin control plane.
//! Aggregates `llm_usage_events` into time-series and per-user summaries.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn analytics_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/analytics/csp-violation", post(analytics_csp_violation))
        .route("/admin/analytics/cost-over-time", get(cost_over_time))
        .route("/admin/analytics/token-usage", get(token_usage))
        .route("/admin/analytics/request-volume", get(request_volume))
        .route("/admin/analytics/per-user-cost", get(per_user_cost))
        .route("/admin/analytics/active-users", get(active_users))
}

async fn analytics_csp_violation(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "analytics query failed");
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
            "Only organization owners/admins can view analytics.",
        ));
    }
    Ok(org.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Granularity {
    Hour,
    Day,
    Week,
    Month,
}

impl Default for Granularity {
    fn default() -> Self {
        Self::Day
    }
}

impl Granularity {
    fn strftime(&self) -> &'static str {
        match self {
            Granularity::Hour => "%Y-%m-%d %H:00",
            Granularity::Day => "%Y-%m-%d",
            Granularity::Week => "%Y-%W",
            Granularity::Month => "%Y-%m",
        }
    }
}

#[derive(Debug, Deserialize)]
struct AnalyticsQuery {
    organization_id: String,
    start: String,
    end: String,
    #[serde(default)]
    granularity: Granularity,
}

fn validate_query(query: &AnalyticsQuery, org: &str) -> Result<(), ApiError> {
    if query.organization_id != org {
        return Err(error(
            StatusCode::FORBIDDEN,
            "organization_mismatch",
            "Requested organization does not match the active organization.",
        ));
    }
    if query.start >= query.end {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_range",
            "start must be before end.",
        ));
    }
    Ok(())
}

fn bucket_sql(granularity: &Granularity) -> String {
    format!("strftime('{}', created_at)", granularity.strftime())
}

async fn cost_over_time(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    validate_query(&query, &org)?;

    let bucket = bucket_sql(&query.granularity);
    let sql = format!(
        "SELECT {bucket} AS bucket,
                SUM(cost_microdollars) AS cost_microdollars,
                COUNT(*) AS requests
         FROM llm_usage_events
         WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3
         GROUP BY bucket
         ORDER BY bucket"
    );
    let mut stmt = conn.prepare(&sql).map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org, query.start, query.end], |row| {
            Ok(json!({
                "bucket": row.get::<_, String>(0)?,
                "cost_microdollars": row.get::<_, i64>(1)?,
                "requests": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

async fn token_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    validate_query(&query, &org)?;

    let bucket = bucket_sql(&query.granularity);
    let sql = format!(
        "SELECT {bucket} AS bucket,
                SUM(prompt_tokens) AS prompt_tokens,
                SUM(completion_tokens) AS completion_tokens,
                SUM(reasoning_tokens) AS reasoning_tokens,
                SUM(cached_tokens) AS cached_tokens,
                COUNT(*) AS requests
         FROM llm_usage_events
         WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3
         GROUP BY bucket
         ORDER BY bucket"
    );
    let mut stmt = conn.prepare(&sql).map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org, query.start, query.end], |row| {
            Ok(json!({
                "bucket": row.get::<_, String>(0)?,
                "prompt_tokens": row.get::<_, i64>(1)?,
                "completion_tokens": row.get::<_, i64>(2)?,
                "reasoning_tokens": row.get::<_, i64>(3)?,
                "cached_tokens": row.get::<_, i64>(4)?,
                "requests": row.get::<_, i64>(5)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

async fn request_volume(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    validate_query(&query, &org)?;

    let bucket = bucket_sql(&query.granularity);
    let sql = format!(
        "SELECT {bucket} AS bucket,
                COUNT(*) AS requests,
                SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN status = 'budget_exceeded' THEN 1 ELSE 0 END) AS budget_exceeded,
                SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) AS rate_limited,
                SUM(CASE WHEN status = 'dlp_blocked' THEN 1 ELSE 0 END) AS dlp_blocked
         FROM llm_usage_events
         WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3
         GROUP BY bucket
         ORDER BY bucket"
    );
    let mut stmt = conn.prepare(&sql).map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org, query.start, query.end], |row| {
            Ok(json!({
                "bucket": row.get::<_, String>(0)?,
                "requests": row.get::<_, i64>(1)?,
                "ok": row.get::<_, i64>(2)?,
                "errors": row.get::<_, i64>(3)?,
                "budget_exceeded": row.get::<_, i64>(4)?,
                "rate_limited": row.get::<_, i64>(5)?,
                "dlp_blocked": row.get::<_, i64>(6)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

#[derive(Debug, Deserialize)]
struct PerUserQuery {
    organization_id: String,
    start: String,
    end: String,
}

async fn per_user_cost(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<PerUserQuery>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    if query.organization_id != org {
        return Err(error(
            StatusCode::FORBIDDEN,
            "organization_mismatch",
            "Requested organization does not match the active organization.",
        ));
    }
    if query.start >= query.end {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_range",
            "start must be before end.",
        ));
    }

    let mut stmt = conn
        .prepare(
            "SELECT user_id,
                    SUM(cost_microdollars) AS cost_microdollars,
                    COUNT(*) AS requests
             FROM llm_usage_events
             WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3
             GROUP BY user_id
             ORDER BY cost_microdollars DESC",
        )
        .map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org, query.start, query.end], |row| {
            Ok(json!({
                "user_id": row.get::<_, String>(0)?,
                "cost_microdollars": row.get::<_, i64>(1)?,
                "requests": row.get::<_, i64>(2)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

async fn active_users(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<AnalyticsQuery>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    validate_query(&query, &org)?;

    let bucket = bucket_sql(&query.granularity);
    let daily_sql = format!(
        "SELECT {bucket} AS bucket,
                COUNT(DISTINCT user_id) AS unique_users
         FROM llm_usage_events
         WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3
         GROUP BY bucket
         ORDER BY bucket"
    );
    let mut stmt = conn.prepare(&daily_sql).map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org, query.start, query.end], |row| {
            Ok(json!({
                "bucket": row.get::<_, String>(0)?,
                "unique_users": row.get::<_, i64>(1)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    let total_unique: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT user_id)
             FROM llm_usage_events
             WHERE tenant_id = ?1 AND created_at >= ?2 AND created_at < ?3",
            params![org, query.start, query.end],
            |row| row.get(0),
        )
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({
        "daily": rows,
        "total_unique_users": total_unique,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::path::Path;
    use tower::ServiceExt;

    fn test_user(user_id: &str, org_id: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: org_id.map(|s| s.to_string()),
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: Some("org:admin".to_string()),
            organization_slug: None,
        }
    }

    async fn test_app_state(temp: &Path) -> Arc<AppState> {
        let config = crate::AppConfig {
            company: Default::default(),
            user: Default::default(),
        };
        let db = crate::db::DbHandle::new(temp.join("test.db")).expect("test db");
        let conn = db.connect().expect("test db conn");
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            params!["org-1"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            params!["admin-1", "admin-1@test.local"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            params!["org-1:admin-1", "org-1", "admin-1", "owner"],
        )
        .unwrap();
        drop(conn);
        let auth_config = crate::auth::AuthConfig::from_app_config(&config);
        let jwks = crate::auth::JwksManager::new(&auth_config);
        let rails = crate::rails::RailsState::new(temp.join("rails"))
            .await
            .expect("test rails");
        Arc::new(AppState {
            config,
            db,
            data_dir: temp.to_path_buf(),
            jwks,
            auth_config,
            vm_driver: None,
            rails,
            vm_sessions: crate::vm_session_routes::new_vm_session_store(),
            cowork_scheduler: None,
            cowork_background: None,
            cowork_run_manager: None,
            webhook_secret: None,
            office_runtime: Arc::new(tokio::sync::RwLock::new(
                crate::office_routes::OfficeRuntimeFile::default(),
            )),
            office_cli_docs: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            office_cli_watches: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            office_cli_mcp_sessions: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            design_skill_cache: crate::design_connector_routes::DesignSkillCache::new(),
            terminal_sessions: crate::terminal_routes::TerminalSessionStore::new(),
            mcp_dispatcher: crate::mcp_dispatcher::McpDispatcher::new(),
            approval_store: Arc::new(crate::permission_policy::ApprovalStore::new()),
        })
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    fn seed_events(conn: &rusqlite::Connection) {
        for (user, cost, prompt, completion, status, created) in [
            ("user-a", 100_000, 10, 5, "ok", "2026-08-01T10:00:00Z"),
            ("user-a", 200_000, 20, 10, "ok", "2026-08-01T12:00:00Z"),
            ("user-b", 50_000, 5, 2, "error", "2026-08-02T08:00:00Z"),
            ("user-b", 150_000, 15, 8, "ok", "2026-08-02T14:00:00Z"),
        ] {
            conn.execute(
                "INSERT INTO llm_usage_events
                 (id, tenant_id, user_id, cost_microdollars, prompt_tokens, completion_tokens,
                  reasoning_tokens, cached_tokens, status, latency_ms, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, 0, ?8)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    "org-1",
                    user,
                    cost,
                    prompt,
                    completion,
                    status,
                    created,
                ],
            )
            .unwrap();
        }
    }

    #[tokio::test]
    async fn cost_over_time_groups_by_day() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        seed_events(&state.db.connect().unwrap());
        let app = analytics_router().with_state(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/cost-over-time?organization_id=org-1&start=2026-08-01&end=2026-08-03&granularity=day")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let items = body["items"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["bucket"], "2026-08-01");
        assert_eq!(items[0]["cost_microdollars"], 300_000);
        assert_eq!(items[1]["cost_microdollars"], 200_000);
    }

    #[tokio::test]
    async fn token_usage_groups_by_day() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        seed_events(&state.db.connect().unwrap());
        let app = analytics_router().with_state(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/token-usage?organization_id=org-1&start=2026-08-01&end=2026-08-03&granularity=day")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let items = body["items"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["prompt_tokens"], 30);
        assert_eq!(items[0]["completion_tokens"], 15);
    }

    #[tokio::test]
    async fn request_volume_breaks_down_status() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        seed_events(&state.db.connect().unwrap());
        let app = analytics_router().with_state(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/request-volume?organization_id=org-1&start=2026-08-01&end=2026-08-03&granularity=day")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let items = body["items"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[1]["requests"], 2);
        assert_eq!(items[1]["errors"], 1);
        assert_eq!(items[1]["ok"], 1);
    }

    #[tokio::test]
    async fn per_user_cost_sorted_descending() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        seed_events(&state.db.connect().unwrap());
        let app = analytics_router().with_state(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/per-user-cost?organization_id=org-1&start=2026-08-01&end=2026-08-03")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let items = body["items"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["user_id"], "user-a");
        assert_eq!(items[0]["cost_microdollars"], 300_000);
    }

    #[tokio::test]
    async fn active_users_counts_distinct_users_per_day() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        seed_events(&state.db.connect().unwrap());
        let app = analytics_router().with_state(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/active-users?organization_id=org-1&start=2026-08-01&end=2026-08-03&granularity=day")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let daily = body["daily"].as_array().unwrap();
        assert_eq!(daily.len(), 2);
        assert_eq!(daily[0]["bucket"], "2026-08-01");
        assert_eq!(daily[0]["unique_users"], 1);
        assert_eq!(daily[1]["bucket"], "2026-08-02");
        assert_eq!(daily[1]["unique_users"], 1);
        assert_eq!(body["total_unique_users"], 2);
    }

    #[tokio::test]
    async fn analytics_rejects_non_admin() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = test_app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            params!["member-1", "member-1@test.local"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            params!["org-1:member-1", "org-1", "member-1", "member"],
        )
        .unwrap();
        drop(conn);
        let app = analytics_router().with_state(state);

        let mut user = test_user("member-1", Some("org-1"));
        user.organization_role = Some("org:member".to_string());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/analytics/request-volume?organization_id=org-1&start=2026-08-01&end=2026-08-03")
                    .extension(user)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }
}
