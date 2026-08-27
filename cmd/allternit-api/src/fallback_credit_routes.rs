//! Fallback credit policy and ledger.
//!
//! Endpoints:
//!   GET    /api/v1/admin/fallback-credit-policy
//!   PUT    /api/v1/admin/fallback-credit-policy
//!   GET    /api/v1/admin/fallback-credits
//!   POST   /api/v1/admin/fallback-credits/reconcile
//!   GET    /api/v1/admin/fallback-credits/:id
//!   POST   /api/v1/admin/fallback-credits/:id/apply
//!
//! Gated to organization owners/admins. The reconcile job scans for primary
//! usage events that failed/refused and were followed by a successful fallback
//! event in the configured window, then creates pending credit ledger rows.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Extension, Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

const ALLOWED_STATUSES: [&str; 7] = [
    "refusal",
    "error",
    "rate_limited",
    "budget_exceeded",
    "dlp_blocked",
    "client_disconnected",
    "in_progress",
];

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/fallback-credit-policy", get(get_policy))
        .route("/admin/fallback-credit-policy", put(put_policy))
        .route("/admin/fallback-credits", get(list_credits))
        .route("/admin/fallback-credits/reconcile", post(reconcile))
        .route("/admin/fallback-credits/:id", get(get_credit))
        .route("/admin/fallback-credits/:id/apply", post(apply_credit))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "fallback credit operation failed");
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
            "Only organization owners/admins can manage fallback credits.",
        ));
    }
    Ok(org.to_string())
}

fn ensure_policy(conn: &rusqlite::Connection, org: &str) -> Result<(), ApiError> {
    conn.execute(
        "INSERT OR IGNORE INTO fallback_credit_policies (org_id) VALUES (?1)",
        params![org],
    )
    .map_err(internal)?;
    Ok(())
}

fn ensure_spend_row(conn: &rusqlite::Connection, org: &str) -> Result<(), ApiError> {
    conn.execute(
        "INSERT OR IGNORE INTO spend_limits (org_id, monthly_usd_cap, current_month_spend)
         VALUES (?1, 0, 0)",
        params![org],
    )
    .map_err(internal)?;
    Ok(())
}

fn policy_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "org_id": row.get::<_, String>(0)?,
        "enabled": row.get::<_, i64>(1)? == 1,
        "eligible_statuses": serde_json::from_str::<Value>(&row.get::<_, String>(2)?)
            .unwrap_or_else(|_| json!([])),
        "max_credit_percent": row.get::<_, i64>(3)?,
        "credit_window_hours": row.get::<_, i64>(4)?,
        "auto_apply": row.get::<_, i64>(5)? == 1,
        "created_at": row.get::<_, String>(6)?,
        "updated_at": row.get::<_, String>(7)?,
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
            "SELECT org_id, enabled, eligible_statuses, max_credit_percent,
                    credit_window_hours, auto_apply, created_at, updated_at
             FROM fallback_credit_policies WHERE org_id = ?1",
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

#[derive(Deserialize)]
struct PutPolicyBody {
    enabled: Option<bool>,
    eligible_statuses: Option<Vec<String>>,
    max_credit_percent: Option<i64>,
    credit_window_hours: Option<i64>,
    auto_apply: Option<bool>,
}

fn validate_statuses(statuses: &[String]) -> Result<Vec<String>, ApiError> {
    if statuses.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_statuses",
            "eligible_statuses must be a non-empty array.",
        ));
    }
    let allowed: HashSet<&str> = ALLOWED_STATUSES.iter().copied().collect();
    for s in statuses {
        if !allowed.contains(s.as_str()) {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_status",
                format!("Status `{s}` is not eligible for fallback credit."),
            ));
        }
    }
    Ok(statuses.to_vec())
}

async fn put_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<PutPolicyBody>,
) -> Response {
    if let Some(pct) = body.max_credit_percent {
        if !(0..=100).contains(&pct) {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_percent",
                "max_credit_percent must be between 0 and 100.",
            )
            .into_response();
        }
    }
    if let Some(hours) = body.credit_window_hours {
        if hours <= 0 {
            return error(
                StatusCode::BAD_REQUEST,
                "invalid_window",
                "credit_window_hours must be positive.",
            )
            .into_response();
        }
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_policy(&conn, &org)?;

        let mut sets = Vec::new();
        let mut values: Vec<rusqlite::types::Value> = Vec::new();

        if let Some(enabled) = body.enabled {
            sets.push("enabled = ?");
            values.push((enabled as i64).into());
        }
        if let Some(statuses) = body.eligible_statuses {
            let statuses = validate_statuses(&statuses)?;
            sets.push("eligible_statuses = ?");
            values.push(serde_json::to_string(&statuses).unwrap().into());
        }
        if let Some(pct) = body.max_credit_percent {
            sets.push("max_credit_percent = ?");
            values.push(pct.into());
        }
        if let Some(hours) = body.credit_window_hours {
            sets.push("credit_window_hours = ?");
            values.push(hours.into());
        }
        if let Some(auto_apply) = body.auto_apply {
            sets.push("auto_apply = ?");
            values.push((auto_apply as i64).into());
        }

        if !sets.is_empty() {
            sets.push("updated_at = ?");
            let now = chrono::Utc::now().to_rfc3339();
            values.push(now.into());

            let sql = format!(
                "UPDATE fallback_credit_policies SET {} WHERE org_id = ?",
                sets.join(", ")
            );
            let mut params_iter = values.into_iter();
            let mut statement = conn.prepare(&sql).map_err(internal)?;
            for (idx, value) in params_iter.by_ref().enumerate() {
                statement.raw_bind_parameter(idx + 1, value).map_err(internal)?;
            }
            statement.raw_bind_parameter(sets.len(), &org).map_err(internal)?;
            statement.raw_execute().map_err(internal)?;
        }

        conn.query_row(
            "SELECT org_id, enabled, eligible_statuses, max_credit_percent,
                    credit_window_hours, auto_apply, created_at, updated_at
             FROM fallback_credit_policies WHERE org_id = ?1",
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

#[derive(Deserialize)]
struct ListCreditsQuery {
    status: Option<String>,
    #[serde(default)]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn credit_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "org_id": row.get::<_, String>(1)?,
        "original_event_id": row.get::<_, String>(2)?,
        "fallback_event_id": row.get::<_, Option<String>>(3)?,
        "amount_microdollars": row.get::<_, i64>(4)?,
        "reason": row.get::<_, String>(5)?,
        "status": row.get::<_, String>(6)?,
        "created_at": row.get::<_, String>(7)?,
        "applied_at": row.get::<_, Option<String>>(8)?,
    }))
}

async fn list_credits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListCreditsQuery>,
) -> Response {
    let limit = query.limit.max(1).min(100);
    let offset = query.offset.max(0);
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;

        let mut sql = "SELECT id, org_id, original_event_id, fallback_event_id,
                              amount_microdollars, reason, status, created_at, applied_at
                       FROM fallback_credit_ledger
                       WHERE org_id = ?1".to_string();
        let mut params_v: Vec<rusqlite::types::Value> = vec![org.to_string().into()];
        if let Some(status) = query.status {
            if !["pending", "applied", "rejected"].contains(&status.as_str()) {
                return Err(error(
                    StatusCode::BAD_REQUEST,
                    "invalid_status",
                    "status must be pending, applied, or rejected.",
                ));
            }
            sql.push_str(" AND status = ?");
            params_v.push(status.into());
        }
        sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");
        params_v.push(limit.into());
        params_v.push(offset.into());

        let mut stmt = conn.prepare(&sql).map_err(internal)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params_v), credit_json)
            .map_err(internal)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({
            "items": rows,
            "limit": limit,
            "offset": offset,
        })))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ReconcileBody {
    start: Option<String>,
    end: Option<String>,
}

#[derive(Serialize)]
struct ReconcileSummary {
    created: usize,
    applied: usize,
}

fn reconcile_credits(conn: &rusqlite::Connection, org: &str, body: ReconcileBody) -> Result<ReconcileSummary, ApiError> {
    ensure_policy(conn, org)?;
    let policy = conn
        .query_row(
            "SELECT enabled, eligible_statuses, max_credit_percent, credit_window_hours, auto_apply
             FROM fallback_credit_policies WHERE org_id = ?1",
            [org],
            |row| {
                Ok((
                    row.get::<_, i64>(0)? == 1,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)? == 1,
                ))
            },
        )
        .map_err(internal)?;

    if !policy.0 {
        return Ok(ReconcileSummary {
            created: 0,
            applied: 0,
        });
    }

    let statuses: Vec<String> =
        serde_json::from_str(&policy.1).map_err(|e| error(StatusCode::INTERNAL_SERVER_ERROR, "invalid_policy", e.to_string()))?;
    if statuses.is_empty() {
        return Ok(ReconcileSummary { created: 0, applied: 0 });
    }

    let (start, end) = match (body.start, body.end) {
        (Some(s), Some(e)) => (s, e),
        _ => {
            let now = chrono::Utc::now();
            let window = chrono::Duration::hours(policy.3);
            (
                (now - window).to_rfc3339(),
                now.to_rfc3339(),
            )
        }
    };

    let placeholders: Vec<String> = statuses.iter().map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(",");

    let mut params_v: Vec<rusqlite::types::Value> = Vec::new();
    params_v.push(org.to_string().into());
    params_v.push(start.to_string().into());
    params_v.push(end.to_string().into());
    for s in &statuses {
        params_v.push(s.clone().into());
    }

    let mut stmt = conn
        .prepare(&format!(
            "SELECT e.id, e.provider_id, e.model_id, e.cost_microdollars, e.created_at
             FROM llm_usage_events e
             WHERE e.tenant_id = ?1
               AND e.created_at BETWEEN ?2 AND ?3
               AND e.status IN ({})
               AND e.cost_microdollars > 0
               AND NOT EXISTS (
                   SELECT 1 FROM fallback_credit_ledger l
                   WHERE l.original_event_id = e.id
               )",
            in_clause
        ))
        .map_err(internal)?;

    let originals: Vec<(String, String, String, i64, String)> = stmt
        .query_map(rusqlite::params_from_iter(params_v), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    let mut created = 0usize;
    let mut applied = 0usize;
    let max_pct = policy.2;
    let window_hours = policy.3;

    for (orig_id, provider_id, model_id, orig_cost, orig_created) in originals {
        let fallback_from = format!("{}/{}", provider_id, model_id);
        let fallback: Option<(String, i64)> = conn
            .query_row(
                &format!(
                    "SELECT id, cost_microdollars FROM llm_usage_events
                     WHERE tenant_id = ?1
                       AND fallback_from = ?2
                       AND status = 'ok'
                       AND created_at > ?3
                       AND created_at <= datetime(?3, '+{} hours')
                     ORDER BY created_at ASC LIMIT 1",
                    window_hours
                ),
                params![org, fallback_from, orig_created],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(internal)?;

        if let Some((fallback_id, _fallback_cost)) = fallback {
            let raw_amount = (orig_cost * max_pct) / 100;
            let amount = raw_amount.min(orig_cost).max(0);
            if amount <= 0 {
                continue;
            }
            let credit_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO fallback_credit_ledger
                    (id, org_id, original_event_id, fallback_event_id, amount_microdollars, reason, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')",
                params![
                    credit_id,
                    org,
                    orig_id,
                    fallback_id,
                    amount,
                    format!("fallback_credit:{fallback_from}"),
                ],
            )
            .map_err(internal)?;
            created += 1;

            if policy.4 {
                if apply_ledger_credit(conn, org, &credit_id).is_ok() {
                    applied += 1;
                }
            }
        }
    }

    Ok(ReconcileSummary { created, applied })
}

async fn reconcile(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<ReconcileBody>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let summary = reconcile_credits(&conn, &org, body)?;
        Ok::<_, ApiError>(Json(json!({
            "created": summary.created,
            "applied": summary.applied,
        })))
    })
    .await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_credit(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        conn.query_row(
            "SELECT id, org_id, original_event_id, fallback_event_id,
                    amount_microdollars, reason, status, created_at, applied_at
             FROM fallback_credit_ledger WHERE id = ?1 AND org_id = ?2",
            params![id, org],
            credit_json,
        )
        .optional()
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "not_found", "Credit not found."))
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn apply_ledger_credit(
    conn: &rusqlite::Connection,
    org: &str,
    credit_id: &str,
) -> Result<(), ApiError> {
    ensure_spend_row(conn, org)?;
    let (amount, status): (i64, String) = conn
        .query_row(
            "SELECT amount_microdollars, status FROM fallback_credit_ledger
             WHERE id = ?1 AND org_id = ?2",
            params![credit_id, org],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(internal)?;
    if status != "pending" {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "not_pending",
            "Credit is not in pending status.",
        ));
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE spend_limits
         SET current_month_spend = max(0, current_month_spend - ?1),
             updated_at = ?2
         WHERE org_id = ?3",
        params![amount, &now, org],
    )
    .map_err(internal)?;
    conn.execute(
        "UPDATE fallback_credit_ledger
         SET status = 'applied', applied_at = ?1
         WHERE id = ?2",
        params![&now, credit_id],
    )
    .map_err(internal)?;
    Ok(())
}

async fn apply_credit(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        apply_ledger_credit(&conn, &org, &id)?;
        conn.query_row(
            "SELECT id, org_id, original_event_id, fallback_event_id,
                    amount_microdollars, reason, status, created_at, applied_at
             FROM fallback_credit_ledger WHERE id = ?1",
            [&id],
            credit_json,
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
    use crate::auth::AuthUser;
    use crate::db::DbHandle;

    fn test_db() -> DbHandle {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-fallback-credit-test-{}.db", id));
        DbHandle::new(path).unwrap()
    }

    fn seed_org(conn: &rusqlite::Connection, org_id: &str, user_id: &str) {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY, name TEXT NOT NULL
             )",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT NOT NULL
             )",
            [],
        )
        .unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS organization_members (
                id TEXT PRIMARY KEY, organization_id TEXT, user_id TEXT, role TEXT
             )",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test')",
            params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role)
             VALUES (?1, ?2, ?3, 'owner')",
            params![format!("{}:{}", org_id, user_id), org_id, user_id],
        )
        .unwrap();
    }

    fn seed_usage_tables(conn: &rusqlite::Connection) {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS llm_usage_events (
                id TEXT PRIMARY KEY,
                virtual_key_id TEXT,
                user_id TEXT,
                tenant_id TEXT,
                policy TEXT,
                provider_id TEXT,
                model_id TEXT,
                fallback_from TEXT,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                cached_tokens INTEGER NOT NULL DEFAULT 0,
                cost_microdollars INTEGER NOT NULL DEFAULT 0,
                latency_ms INTEGER NOT NULL DEFAULT 0,
                ttft_ms INTEGER,
                status TEXT NOT NULL,
                error_type TEXT,
                gizzi_session_id TEXT,
                idempotency_key TEXT UNIQUE,
                response_body TEXT,
                fallback_from_event_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS spend_limits (
                org_id TEXT PRIMARY KEY,
                monthly_usd_cap INTEGER NOT NULL DEFAULT 0,
                current_month_spend INTEGER NOT NULL DEFAULT 0,
                increase_request_status TEXT,
                increase_request_amount INTEGER,
                increase_request_reason TEXT,
                increase_request_created_at DATETIME,
                increase_request_updated_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS fallback_credit_policies (
                org_id TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                eligible_statuses TEXT NOT NULL DEFAULT '[\"refusal\",\"error\"]',
                max_credit_percent INTEGER NOT NULL DEFAULT 100,
                credit_window_hours INTEGER NOT NULL DEFAULT 24,
                auto_apply INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS fallback_credit_ledger (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                original_event_id TEXT NOT NULL,
                fallback_event_id TEXT REFERENCES llm_usage_events(id) ON DELETE SET NULL,
                amount_microdollars INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                applied_at DATETIME
            );",
        )
        .unwrap();
    }

    fn owner_user(org_id: &str, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: Some("Test Owner".to_string()),
            avatar_url: None,
            tenant_id: Some(org_id.to_string()),
            organization_id: Some(org_id.to_string()),
            organization_role: Some("owner".to_string()),
            organization_slug: None,
        }
    }

    #[test]
    fn policy_defaults_and_update() {
        let db = test_db();
        let conn = db.connect().unwrap();
        seed_org(&conn, "org-1", "user-1");
        seed_usage_tables(&conn);
        ensure_policy(&conn, "org-1").unwrap();

        let policy = conn
            .query_row("SELECT * FROM fallback_credit_policies WHERE org_id = 'org-1'", [], |r| {
                Ok((
                    r.get::<_, i64>(1).unwrap() == 1,
                    r.get::<_, String>(2).unwrap(),
                    r.get::<_, i64>(3).unwrap(),
                ))
            })
            .unwrap();
        assert!(policy.0);
        assert_eq!(policy.1, "[\"refusal\",\"error\"]");
        assert_eq!(policy.2, 100);

        conn.execute(
            "UPDATE fallback_credit_policies SET max_credit_percent = 50, enabled = 0 WHERE org_id = 'org-1'",
            [],
        )
        .unwrap();
        let policy = conn
            .query_row("SELECT enabled, max_credit_percent FROM fallback_credit_policies WHERE org_id = 'org-1'", [], |r| {
                Ok((r.get::<_, i64>(0).unwrap() == 1, r.get::<_, i64>(1).unwrap()))
            })
            .unwrap();
        assert!(!policy.0);
        assert_eq!(policy.1, 50);
    }

    #[test]
    fn reconcile_creates_credit_for_refused_then_ok_fallback() {
        let db = test_db();
        let conn = db.connect().unwrap();
        seed_org(&conn, "org-1", "user-1");
        seed_usage_tables(&conn);
        ensure_spend_row(&conn, "org-1").unwrap();
        conn.execute(
            "UPDATE spend_limits SET current_month_spend = 10000 WHERE org_id = 'org-1'",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO llm_usage_events (id, tenant_id, provider_id, model_id, cost_microdollars, status, created_at)
             VALUES ('evt-1', 'org-1', 'anthropic', 'claude-sonnet-4-5', 5000, 'refusal', '2026-08-09T00:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO llm_usage_events (id, tenant_id, fallback_from, cost_microdollars, status, created_at)
             VALUES ('evt-2', 'org-1', 'anthropic/claude-sonnet-4-5', 2000, 'ok', '2026-08-09T00:05:00Z')",
            [],
        )
        .unwrap();

        let summary = reconcile_credits(
            &conn,
            "org-1",
            ReconcileBody {
                start: Some("2026-08-08T00:00:00Z".to_string()),
                end: Some("2026-08-10T00:00:00Z".to_string()),
            },
        )
        .unwrap();
        assert_eq!(summary.created, 1);
        assert_eq!(summary.applied, 0);

        let amount: i64 = conn
            .query_row(
                "SELECT amount_microdollars FROM fallback_credit_ledger WHERE original_event_id = 'evt-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(amount, 5000);

        apply_ledger_credit(&conn, "org-1", &amount_credit_id(&conn, "evt-1")).unwrap();
        let spend: i64 = conn
            .query_row(
                "SELECT current_month_spend FROM spend_limits WHERE org_id = 'org-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(spend, 5000);
    }

    fn amount_credit_id(conn: &rusqlite::Connection, original_event_id: &str) -> String {
        conn.query_row(
            "SELECT id FROM fallback_credit_ledger WHERE original_event_id = ?1",
            [original_event_id],
            |r| r.get::<_, String>(0),
        )
        .unwrap()
    }

    #[test]
    fn reconcile_disabled_policy_is_noop() {
        let db = test_db();
        let conn = db.connect().unwrap();
        seed_org(&conn, "org-1", "user-1");
        seed_usage_tables(&conn);
        conn.execute(
            "INSERT INTO fallback_credit_policies (org_id, enabled) VALUES ('org-1', 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO llm_usage_events (id, tenant_id, provider_id, model_id, cost_microdollars, status, created_at)
             VALUES ('evt-1', 'org-1', 'anthropic', 'claude-sonnet-4-5', 1000, 'refusal', '2026-08-09T00:00:00Z')",
            [],
        )
        .unwrap();

        let summary = reconcile_credits(
            &conn,
            "org-1",
            ReconcileBody {
                start: Some("2026-08-08T00:00:00Z".to_string()),
                end: Some("2026-08-10T00:00:00Z".to_string()),
            },
        )
        .unwrap();
        assert_eq!(summary.created, 0);
    }
}
