//! User-facing prepaid credit balance.
//!
//! One authenticated endpoint (`GET /api/v1/billing/credits`) reporting the
//! user's remaining balance, month-to-date hosted usage, and their most
//! recent credit ledger entries (grants and usage debits). Free-path users
//! (no credits row, or a non-positive balance) additionally get their
//! monthly free inference allowance consumption (`free_inference`). Like the
//! hosted runtime routes, the Clerk session is verified per request.

use axum::{extract::State, http::HeaderMap, routing::get, Json, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use std::sync::Arc;

use crate::{auth::clerk, error::ApiError, services, ApiState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CreditBalanceResponse {
    balance_usd: f64,
    month_to_date_usage_usd: f64,
    recent_transactions: Vec<CreditTransactionResponse>,
    /// Present only for free-path users (no credits row, or a non-positive
    /// balance): their monthly free inference allowance consumption.
    free_inference: Option<FreeInferenceResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct FreeInferenceResponse {
    monthly_allowance_usd: f64,
    used_usd: f64,
    remaining_usd: f64,
}

#[derive(Debug, Serialize, FromRow)]
struct CreditTransactionRow {
    amount_usd: f64,
    source: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct CreditTransactionResponse {
    amount_usd: f64,
    source: String,
    created_at: DateTime<Utc>,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new().route("/api/v1/billing/credits", get(get_credit_balance))
}

async fn get_credit_balance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<CreditBalanceResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;

    let balance_row: Option<f64> =
        sqlx::query_scalar("SELECT balance_usd FROM user_credits WHERE user_id = $1")
            .bind(&user.id)
            .fetch_optional(&state.db)
            .await?;
    let balance_usd = balance_row.unwrap_or(0.0);
    let free_inference = if balance_row.is_none() || balance_usd <= 0.0 {
        let allowance: f64 = std::env::var("FREE_INFERENCE_MONTHLY_USD")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(2.0);
        let used: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(cost_usd), 0)
            FROM inference_usage
            WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())
            "#,
        )
        .bind(&user.id)
        .fetch_one(&state.db)
        .await?;
        Some(FreeInferenceResponse {
            monthly_allowance_usd: allowance,
            used_usd: used,
            remaining_usd: (allowance - used).max(0.0),
        })
    } else {
        None
    };
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    let recent = sqlx::query_as::<_, CreditTransactionRow>(
        r#"
        SELECT amount_usd, source, created_at
        FROM credit_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(CreditBalanceResponse {
        balance_usd,
        month_to_date_usage_usd: usage.estimated_cost_usd,
        recent_transactions: recent
            .into_iter()
            .map(|row| CreditTransactionResponse {
                amount_usd: row.amount_usd,
                source: row.source,
                created_at: row.created_at,
            })
            .collect(),
        free_inference,
    }))
}
