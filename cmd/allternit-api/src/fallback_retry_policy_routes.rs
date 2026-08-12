//! Fallback retry policy admin API.
//!
//! Endpoints (org-admin gated, merged at `/api/v1/admin`):
//!   GET /admin/fallback-retry-policy  — read the org policy
//!   PUT /admin/fallback-retry-policy  — update the org policy
//!
//! The policy configures automatic request-level retries for the LLM gateway
//! and whether the cross-provider fallback chain (`fallbackModels`) is sent to
//! Gizzi. The actual retry orchestration is implemented in
//! `llm_gateway::failover`; this API owns the durable configuration.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/fallback-retry-policy", get(get_policy))
        .route("/admin/fallback-retry-policy", put(put_policy))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "fallback retry policy operation failed");
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
            "Only organization owners/admins can manage fallback retry policies.",
        ));
    }
    Ok(org.to_string())
}

const ALLOWED_STATUSES: [&str; 7] = [
    "refusal",
    "error",
    "rate_limited",
    "budget_exceeded",
    "dlp_blocked",
    "client_disconnected",
    "timeout",
];

fn ensure_policy(conn: &rusqlite::Connection, org: &str) -> Result<(), ApiError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO fallback_retry_policies
            (org_id, enabled, max_retries, retryable_statuses, retryable_errors,
             base_delay_ms, max_delay_ms, fallback_chain_enabled, created_at, updated_at)
         VALUES (?1, 1, 2, '[\"refusal\",\"error\",\"rate_limited\",\"timeout\"]', '[\"*\"]', 500, 8000, 1, ?2, ?2)",
        params![org, now],
    )
    .map_err(internal)?;
    Ok(())
}

fn policy_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "org_id": row.get::<_, String>(0)?,
        "enabled": row.get::<_, i64>(1)? == 1,
        "max_retries": row.get::<_, i64>(2)?,
        "retryable_statuses": serde_json::from_str::<Value>(&row.get::<_, String>(3)?)
            .unwrap_or_else(|_| json!([])),
        "retryable_errors": serde_json::from_str::<Value>(&row.get::<_, String>(4)?)
            .unwrap_or_else(|_| json!([])),
        "base_delay_ms": row.get::<_, i64>(5)?,
        "max_delay_ms": row.get::<_, i64>(6)?,
        "fallback_chain_enabled": row.get::<_, i64>(7)? == 1,
        "created_at": row.get::<_, String>(8)?,
        "updated_at": row.get::<_, String>(9)?,
    }))
}

async fn get_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_policy(&conn, &org)?;
        conn.query_row(
            "SELECT org_id, enabled, max_retries, retryable_statuses, retryable_errors,
                    base_delay_ms, max_delay_ms, fallback_chain_enabled, created_at, updated_at
             FROM fallback_retry_policies WHERE org_id = ?1",
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

#[derive(Debug, Deserialize)]
struct PutPolicyBody {
    enabled: Option<bool>,
    max_retries: Option<i64>,
    retryable_statuses: Option<Vec<String>>,
    retryable_errors: Option<Vec<String>>,
    base_delay_ms: Option<i64>,
    max_delay_ms: Option<i64>,
    fallback_chain_enabled: Option<bool>,
}

fn validate_statuses(statuses: &[String]) -> Result<(), ApiError> {
    if statuses.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_statuses",
            "retryable_statuses must be a non-empty array.",
        ));
    }
    let allowed: HashSet<&str> = ALLOWED_STATUSES.iter().copied().collect();
    for s in statuses {
        if !allowed.contains(s.as_str()) {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_status",
                format!("Status `{s}` is not retryable."),
            ));
        }
    }
    Ok(())
}

async fn put_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<PutPolicyBody>,
) -> Response {
    if let Some(retries) = body.max_retries {
        if !(0..=5).contains(&retries) {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_max_retries",
                "max_retries must be between 0 and 5.",
            )
            .into_response();
        }
    }
    if let Some(statuses) = &body.retryable_statuses {
        if let Err(e) = validate_statuses(statuses) {
            return e.into_response();
        }
    }
    if let Some(base) = body.base_delay_ms {
        if base <= 0 {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_delay",
                "base_delay_ms must be positive.",
            )
            .into_response();
        }
    }
    if let Some(max) = body.max_delay_ms {
        if max <= 0 {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_delay",
                "max_delay_ms must be positive.",
            )
            .into_response();
        }
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_policy(&conn, &org)?;

        let existing: Value = conn.query_row(
            "SELECT org_id, enabled, max_retries, retryable_statuses, retryable_errors,
                    base_delay_ms, max_delay_ms, fallback_chain_enabled, created_at, updated_at
             FROM fallback_retry_policies WHERE org_id = ?1",
            [&org],
            policy_json,
        )
        .map_err(internal)?;

        let enabled = body.enabled.unwrap_or(existing["enabled"].as_bool().unwrap_or(true));
        let max_retries = body.max_retries.unwrap_or(existing["max_retries"].as_i64().unwrap_or(2));
        let retryable_statuses = body.retryable_statuses.unwrap_or_else(|| {
            existing["retryable_statuses"]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
                .unwrap_or_default()
        });
        let retryable_errors = body.retryable_errors.unwrap_or_else(|| {
            existing["retryable_errors"]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
                .unwrap_or_else(|| vec!["*".to_string()])
        });
        let base_delay_ms = body.base_delay_ms.unwrap_or(existing["base_delay_ms"].as_i64().unwrap_or(500));
        let max_delay_ms = body.max_delay_ms.unwrap_or(existing["max_delay_ms"].as_i64().unwrap_or(8000));
        let fallback_chain_enabled = body
            .fallback_chain_enabled
            .unwrap_or(existing["fallback_chain_enabled"].as_bool().unwrap_or(true));
        let created_at = existing["created_at"]
            .as_str()
            .unwrap_or(&chrono::Utc::now().to_rfc3339())
            .to_string();
        let updated_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO fallback_retry_policies
                (org_id, enabled, max_retries, retryable_statuses, retryable_errors,
                 base_delay_ms, max_delay_ms, fallback_chain_enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(org_id) DO UPDATE SET
                enabled = excluded.enabled,
                max_retries = excluded.max_retries,
                retryable_statuses = excluded.retryable_statuses,
                retryable_errors = excluded.retryable_errors,
                base_delay_ms = excluded.base_delay_ms,
                max_delay_ms = excluded.max_delay_ms,
                fallback_chain_enabled = excluded.fallback_chain_enabled,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at",
            params![
                org,
                if enabled { 1 } else { 0 },
                max_retries,
                serde_json::to_string(&retryable_statuses).unwrap(),
                serde_json::to_string(&retryable_errors).unwrap(),
                base_delay_ms,
                max_delay_ms,
                if fallback_chain_enabled { 1 } else { 0 },
                created_at,
                updated_at,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_statuses_accepts_allowed() {
        assert!(validate_statuses(&[
            "refusal".to_string(),
            "error".to_string(),
            "timeout".to_string(),
        ])
        .is_ok());
    }

    #[test]
    fn validate_statuses_rejects_empty_and_unknown() {
        assert!(validate_statuses(&[]).is_err());
        assert!(validate_statuses(&["bad_status".to_string()]).is_err());
    }
}
