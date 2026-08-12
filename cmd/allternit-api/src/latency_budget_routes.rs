//! Latency budgets and percentile reporting for the admin control plane.
//!
//! Endpoints (org-admin gated, merged at `/api/v1/admin`):
//!   GET    /admin/latency-budgets                       — list budgets
//!   PUT    /admin/latency-budgets/:model_id             — set a budget
//!   DELETE /admin/latency-budgets/:model_id             — remove a budget
//!   GET    /admin/latency-budgets/report?window_hours   — percentile report vs budgets
//!
//! Budgets are stored per organization and model. `model_id` may be `*` for a
//! global default. Percentiles are computed from `llm_usage_events` which
//! already records `latency_ms` and `ttft_ms` for every completed request.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, put},
    Extension, Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/latency-budgets", get(list_budgets))
        .route("/admin/latency-budgets/report", get(latency_report))
        .route("/admin/latency-budgets/:model_id", put(upsert_budget))
        .route("/admin/latency-budgets/:model_id", delete(delete_budget))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "latency budget operation failed");
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
            "Only organization owners/admins can manage latency budgets.",
        ));
    }
    Ok(org.to_string())
}

#[derive(Debug, Deserialize, Clone)]
struct UpsertBudgetBody {
    #[serde(default)]
    p50_ms: Option<i64>,
    #[serde(default)]
    p95_ms: Option<i64>,
    #[serde(default)]
    p99_ms: Option<i64>,
    #[serde(default)]
    ttft_p95_ms: Option<i64>,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

fn default_enabled() -> bool {
    true
}

fn budget_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "model_id": row.get::<_, String>(0)?,
        "p50_ms": row.get::<_, Option<i64>>(1)?,
        "p95_ms": row.get::<_, Option<i64>>(2)?,
        "p99_ms": row.get::<_, Option<i64>>(3)?,
        "ttft_p95_ms": row.get::<_, Option<i64>>(4)?,
        "enabled": row.get::<_, i64>(5)? == 1,
        "updated_at": row.get::<_, String>(6)?,
    }))
}

async fn list_budgets(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn
            .prepare(
                "SELECT model_id, p50_ms, p95_ms, p99_ms, ttft_p95_ms, enabled, updated_at
                 FROM latency_budgets
                 WHERE org_id = ?1
                 ORDER BY model_id",
            )
            .map_err(internal)?;
        let rows = stmt
            .query_map(params![org], budget_json)
            .map_err(internal)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({ "items": rows })))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn validate_model_id(model_id: &str) -> Result<(), ApiError> {
    if model_id.is_empty() || model_id.len() > 256 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_model_id",
            "model_id must be 1-256 characters.",
        ));
    }
    if model_id != "*" && !model_id.chars().all(|c| c.is_alphanumeric() || "-/_".contains(c)) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_model_id",
            "model_id contains invalid characters.",
        ));
    }
    Ok(())
}

async fn upsert_budget(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(model_id): Path<String>,
    Json(body): Json<UpsertBudgetBody>,
) -> Response {
    if let Err(e) = validate_model_id(&model_id) {
        return e.into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO latency_budgets
                (org_id, model_id, p50_ms, p95_ms, p99_ms, ttft_p95_ms, enabled, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(org_id, model_id) DO UPDATE SET
                p50_ms = excluded.p50_ms,
                p95_ms = excluded.p95_ms,
                p99_ms = excluded.p99_ms,
                ttft_p95_ms = excluded.ttft_p95_ms,
                enabled = excluded.enabled,
                updated_at = excluded.updated_at",
            params![
                org,
                model_id,
                body.p50_ms,
                body.p95_ms,
                body.p99_ms,
                body.ttft_p95_ms,
                if body.enabled { 1 } else { 0 },
                now,
            ],
        )
        .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({ "updated": true })))
    })
    .await;
    match result {
        Ok(Ok(v)) => (StatusCode::OK, v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_budget(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(model_id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn
            .execute(
                "DELETE FROM latency_budgets WHERE org_id = ?1 AND model_id = ?2",
                params![org, model_id],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "not_found",
                "Latency budget not found.",
            ));
        }
        Ok::<_, ApiError>(StatusCode::NO_CONTENT)
    })
    .await;
    match result {
        Ok(Ok(status)) => status.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ReportQuery {
    #[serde(default = "default_window")]
    window_hours: i64,
}

fn default_window() -> i64 {
    24
}

fn percentile(sorted: &[i64], p: f64) -> Option<f64> {
    if sorted.is_empty() {
        return None;
    }
    let n = sorted.len();
    let idx = (p / 100.0) * (n as f64 - 1.0);
    let lower = idx.floor() as usize;
    let upper = idx.ceil() as usize;
    if lower == upper || upper >= n {
        return Some(sorted[lower.min(n - 1)] as f64);
    }
    let frac = idx - lower as f64;
    let lower_val = sorted[lower] as f64;
    let upper_val = sorted[upper] as f64;
    Some(lower_val + frac * (upper_val - lower_val))
}

fn status_for(budget: Option<i64>, actual: Option<f64>) -> &'static str {
    match (budget, actual) {
        (Some(b), Some(a)) if a <= b as f64 => "within_budget",
        (Some(_), Some(_)) => "exceeded",
        (Some(_), None) => "no_data",
        (None, Some(_)) => "no_budget",
        (None, None) => "no_data",
    }
}

async fn latency_report(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ReportQuery>,
) -> Response {
    let window_hours = query.window_hours.max(1).min(168);
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let since = chrono::Utc::now() - chrono::Duration::hours(window_hours);
        let since_str = since.to_rfc3339();

        // Load budgets for this org.
        let mut budget_stmt = conn
            .prepare(
                "SELECT model_id, p50_ms, p95_ms, p99_ms, ttft_p95_ms
                 FROM latency_budgets
                 WHERE org_id = ?1 AND enabled = 1",
            )
            .map_err(internal)?;
        let budgets: std::collections::HashMap<String, (Option<i64>, Option<i64>, Option<i64>, Option<i64>)> = budget_stmt
            .query_map(params![org], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    (
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<i64>>(2)?,
                        row.get::<_, Option<i64>>(3)?,
                        row.get::<_, Option<i64>>(4)?,
                    ),
                ))
            })
            .map_err(internal)?
            .collect::<Result<_, _>>()
            .map_err(internal)?;

        // Gather raw latency and TTFT observations per model.
        let mut stmt = conn
            .prepare(
                "SELECT model_id, latency_ms, ttft_ms
                 FROM llm_usage_events
                 WHERE tenant_id = ?1 AND created_at >= ?2 AND status = 'ok'",
            )
            .map_err(internal)?;
        #[derive(Default)]
        struct Obs {
            latencies: Vec<i64>,
            ttfts: Vec<i64>,
        }
        let mut by_model: std::collections::HashMap<String, Obs> = std::collections::HashMap::new();
        let rows = stmt
            .query_map(params![org, since_str], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            })
            .map_err(internal)?;
        for row in rows {
            let (model_id, latency, ttft) = row.map_err(internal)?;
            let entry = by_model.entry(model_id).or_default();
            if let Some(l) = latency {
                entry.latencies.push(l);
            }
            if let Some(t) = ttft {
                entry.ttfts.push(t);
            }
        }

        // Compute percentiles and merge with budgets.
        let all_models: std::collections::HashSet<String> = budgets
            .keys()
            .chain(by_model.keys())
            .cloned()
            .collect();
        let mut items = Vec::new();
        for model_id in all_models {
            let obs = by_model.get(&model_id);
            let mut latencies = obs.map(|o| o.latencies.clone()).unwrap_or_default();
            let mut ttfts = obs.map(|o| o.ttfts.clone()).unwrap_or_default();
            latencies.sort();
            ttfts.sort();

            let p50 = percentile(&latencies, 50.0);
            let p95 = percentile(&latencies, 95.0);
            let p99 = percentile(&latencies, 99.0);
            let ttft_p95 = percentile(&ttfts, 95.0);

            let b = budgets.get(&model_id);
            items.push(json!({
                "model_id": model_id,
                "window_hours": window_hours,
                "samples": latencies.len(),
                "p50_ms": p50,
                "p95_ms": p95,
                "p99_ms": p99,
                "ttft_p95_ms": ttft_p95,
                "budget": {
                    "p50_ms": b.map(|x| x.0).unwrap_or(None),
                    "p95_ms": b.map(|x| x.1).unwrap_or(None),
                    "p99_ms": b.map(|x| x.2).unwrap_or(None),
                    "ttft_p95_ms": b.map(|x| x.3).unwrap_or(None),
                },
                "status": {
                    "p50_ms": status_for(b.and_then(|x| x.0), p50),
                    "p95_ms": status_for(b.and_then(|x| x.1), p95),
                    "p99_ms": status_for(b.and_then(|x| x.2), p99),
                    "ttft_p95_ms": status_for(b.and_then(|x| x.3), ttft_p95),
                }
            }));
        }
        Ok::<_, ApiError>(Json(json!({ "items": items })))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percentile_empty_is_none() {
        assert!(percentile(&[], 50.0).is_none());
    }

    #[test]
    fn percentile_single_value() {
        assert_eq!(percentile(&[42], 50.0), Some(42.0));
    }

    #[test]
    fn percentile_interpolates() {
        // [10, 20, 30, 40] at p50 -> index 1.5 -> 25.0
        assert_eq!(percentile(&[10, 20, 30, 40], 50.0), Some(25.0));
        // p95 -> index 2.85 -> 38.5
        assert_eq!(percentile(&[10, 20, 30, 40], 95.0), Some(38.5));
    }

    #[test]
    fn status_for_variants() {
        assert_eq!(status_for(Some(100), Some(50.0)), "within_budget");
        assert_eq!(status_for(Some(100), Some(150.0)), "exceeded");
        assert_eq!(status_for(Some(100), None), "no_data");
        assert_eq!(status_for(None, Some(150.0)), "no_budget");
        assert_eq!(status_for(None, None), "no_data");
    }

    #[test]
    fn validate_model_id_accepts_wildcard_and_known_models() {
        assert!(validate_model_id("*").is_ok());
        assert!(validate_model_id("claude-3-5-sonnet-20241022").is_ok());
        assert!(validate_model_id("openai/gpt-4o").is_ok());
    }

    #[test]
    fn validate_model_id_rejects_invalid() {
        assert!(validate_model_id("").is_err());
        assert!(validate_model_id("a$b").is_err());
    }
}
