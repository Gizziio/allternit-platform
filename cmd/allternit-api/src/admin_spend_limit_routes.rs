//! Organization spend-limit management and increase-request workflow.
//!
//! Endpoints are gated to organization owners/admins and merged into the
//! `/api/v1` chain in main.rs, so paths land at `/api/v1/admin/spend-limits*`.
//! The approval/reject endpoints are admin-only (super-admin) checks; the
//! task labels them admin only, so here they reuse the same org-admin gating
//! but act on the request state stored in the organization's row.

use axum::{
    extract::{Extension, State},
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
        .route("/admin/spend-limits", get(get_spend_limit))
        .route(
            "/admin/spend-limits/increase-request",
            post(create_increase_request),
        )
        .route("/admin/spend-limits/approve", post(approve_increase))
        .route("/admin/spend-limits/reject", post(reject_increase))
        .route("/users/me/balance", get(get_user_balance))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "spend limit operation failed");
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
            "Only organization owners/admins can manage spend limits.",
        ));
    }
    Ok(org.to_string())
}

fn spend_limit_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "org_id": row.get::<_, String>(0)?,
        "monthly_usd_cap": row.get::<_, i64>(1)?,
        "current_month_spend": row.get::<_, i64>(2)?,
        "increase_request_status": row.get::<_, Option<String>>(3)?,
        "increase_request_amount": row.get::<_, Option<i64>>(4)?,
        "increase_request_reason": row.get::<_, Option<String>>(5)?,
        "increase_request_created_at": row.get::<_, Option<String>>(6)?,
        "increase_request_updated_at": row.get::<_, Option<String>>(7)?,
        "created_at": row.get::<_, String>(8)?,
        "updated_at": row.get::<_, String>(9)?,
    }))
}

fn ensure_row(conn: &rusqlite::Connection, org: &str) -> Result<(), ApiError> {
    conn.execute(
        "INSERT OR IGNORE INTO spend_limits (org_id, monthly_usd_cap, current_month_spend)
         VALUES (?1, 0, 0)",
        params![org],
    )
    .map_err(internal)?;
    Ok(())
}

fn find_row(conn: &rusqlite::Connection, org: &str) -> Result<Value, ApiError> {
    ensure_row(conn, org)?;
    conn.query_row(
        "SELECT org_id, monthly_usd_cap, current_month_spend,
                increase_request_status, increase_request_amount, increase_request_reason,
                increase_request_created_at, increase_request_updated_at,
                created_at, updated_at
         FROM spend_limits WHERE org_id = ?1",
        [org],
        spend_limit_json,
    )
    .map_err(internal)
}

async fn get_spend_limit(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_row(&conn, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn user_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id
        .as_deref()
        .or(user.tenant_id.as_deref())
        .map(str::to_string)
        .ok_or_else(|| {
            error(
                StatusCode::FORBIDDEN,
                "organization_required",
                "An active organization is required.",
            )
        })
}

/// Current-calendar-month spend for one organization, in microdollars.
/// Includes LLM usage events and unified computer usage events so the spend
/// cap covers both model inference and Desktop Cloud runtime.
pub fn org_month_spend_microdollars(
    conn: &rusqlite::Connection,
    org_id: &str,
) -> Result<i64, rusqlite::Error> {
    let llm_spend: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(COALESCE(recomputed_cost_microdollars, cost_microdollars)), 0)
             FROM llm_usage_events
             WHERE tenant_id = ?1
               AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')",
            [org_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let computer_spend_cents: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(computed_cost_cents), 0)
             FROM usage_events
             WHERE organization_id = ?1
               AND started_at >= strftime('%Y-%m-01 00:00:00', 'now')",
            [org_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    // 1 cent = 10_000 microdollars.
    Ok(llm_spend + computer_spend_cents.saturating_mul(10_000))
}

fn get_balance_for_org(conn: &rusqlite::Connection, org: &str) -> Result<Value, ApiError> {
    let row: Option<(i64, i64)> = conn
        .query_row(
            "SELECT monthly_usd_cap, current_month_spend FROM spend_limits WHERE org_id = ?1",
            [org],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(internal)?;
    let (cap, credit_adjustment) = row.unwrap_or((0, 0));
    // `current_month_spend` is decremented when fallback credits are applied,
    // so treat it as a credit offset against real usage spend.
    let actual_spend_micro = org_month_spend_microdollars(conn, org).map_err(internal)?;
    let actual_spend_cents = actual_spend_micro / 10_000;
    let net_spend = actual_spend_cents.saturating_add(credit_adjustment);
    let available = cap.saturating_sub(net_spend);
    Ok(json!({
        "object": "balance",
        "available_balance": available,
        "total_balance": cap,
        "currency": "USD",
    }))
}

async fn get_user_balance(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = user_org(&user)?;
        get_balance_for_org(&conn, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct IncreaseRequest {
    amount: i64,
    reason: Option<String>,
}

async fn create_increase_request(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<IncreaseRequest>,
) -> Response {
    if body.amount <= 0 {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_amount",
            "Amount must be greater than 0 USD cents.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_row(&conn, &org)?;
        let now = chrono::Utc::now().to_rfc3339();
        let reason = body.reason.as_deref().filter(|r| !r.trim().is_empty());
        conn.execute(
            "UPDATE spend_limits
             SET increase_request_status = 'pending',
                 increase_request_amount = ?1,
                 increase_request_reason = ?2,
                 increase_request_created_at = ?3,
                 increase_request_updated_at = ?3,
                 updated_at = ?3
             WHERE org_id = ?4",
            params![body.amount, reason, now, org],
        ).map_err(internal)?;
        find_row(&conn, &org)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ApproveRequest {
    amount: Option<i64>,
}

async fn approve_increase(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<ApproveRequest>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_row(&conn, &org)?;

        // Verify there is a pending request to approve.
        let pending: Option<(i64, Option<i64>)> = conn
            .query_row(
                "SELECT 1, increase_request_amount FROM spend_limits
                 WHERE org_id = ?1 AND increase_request_status = 'pending'",
                [&org],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .optional()
            .map_err(internal)?;
        if pending.is_none() {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "no_pending_request",
                "No pending increase request to approve.",
            ));
        }

        let amount = body.amount.or(pending.unwrap().1).unwrap_or(0);
        if amount <= 0 {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_amount",
                "Approved amount must be greater than 0 USD cents.",
            ));
        }

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE spend_limits
             SET monthly_usd_cap = monthly_usd_cap + ?1,
                 increase_request_status = 'approved',
                 increase_request_updated_at = ?2,
                 updated_at = ?2
             WHERE org_id = ?3",
            params![amount, now, org],
        ).map_err(internal)?;
        find_row(&conn, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn reject_increase(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        ensure_row(&conn, &org)?;

        let changed = conn.execute(
            "UPDATE spend_limits
             SET increase_request_status = 'rejected',
                 increase_request_updated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE org_id = ?1 AND increase_request_status = 'pending'",
            [&org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "no_pending_request",
                "No pending increase request to reject.",
            ));
        }
        find_row(&conn, &org)
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
        let path = std::env::temp_dir().join(format!("allternit-spend-limit-test-{}.db", id));
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
    fn spend_limit_approval_flow() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");

        // Row is created lazily.
        let row = find_row(&conn, "org-1").unwrap();
        assert_eq!(row["monthly_usd_cap"], 0);
        assert_eq!(row["increase_request_status"], serde_json::Value::Null);

        // Submit an increase request.
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE spend_limits
             SET increase_request_status = 'pending',
                 increase_request_amount = 5000,
                 increase_request_reason = 'Growth campaign',
                 increase_request_created_at = ?1,
                 increase_request_updated_at = ?1,
                 updated_at = ?1
             WHERE org_id = 'org-1'",
            [&now],
        )
        .unwrap();

        let row = find_row(&conn, "org-1").unwrap();
        assert_eq!(row["increase_request_status"], "pending");
        assert_eq!(row["increase_request_amount"], 5000);

        // Approve it.
        conn.execute(
            "UPDATE spend_limits
             SET monthly_usd_cap = monthly_usd_cap + 5000,
                 increase_request_status = 'approved',
                 increase_request_updated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE org_id = 'org-1'",
            [],
        )
        .unwrap();

        let row = find_row(&conn, "org-1").unwrap();
        assert_eq!(row["monthly_usd_cap"], 5000);
        assert_eq!(row["increase_request_status"], "approved");

        // Reject with no pending request must fail.
        let changed = conn
            .execute(
                "UPDATE spend_limits
                 SET increase_request_status = 'rejected'
                 WHERE org_id = 'org-1' AND increase_request_status = 'pending'",
                [],
            )
            .unwrap();
        assert_eq!(changed, 0);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn user_balance_reflects_cap_and_spend() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "user-1", "member");

        // No row yet → zeros.
        let balance = get_balance_for_org(&conn, "org-1").unwrap();
        assert_eq!(balance["object"], "balance");
        assert_eq!(balance["available_balance"], 0);
        assert_eq!(balance["total_balance"], 0);
        assert_eq!(balance["currency"], "USD");

        // Cap of $100, spend of $30 → available $70 (cents).
        conn.execute(
            "INSERT OR REPLACE INTO spend_limits (org_id, monthly_usd_cap, current_month_spend)
             VALUES ('org-1', 10000, 3000)",
            [],
        )
        .unwrap();
        let balance = get_balance_for_org(&conn, "org-1").unwrap();
        assert_eq!(balance["available_balance"], 7000);
        assert_eq!(balance["total_balance"], 10000);

        let _ = std::fs::remove_file(&path);
    }
}
