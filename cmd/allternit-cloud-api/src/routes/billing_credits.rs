//! User-facing prepaid credit balance.
//!
//! One authenticated endpoint (`GET /api/v1/billing/credits`) reporting the
//! user's remaining balance, month-to-date hosted usage, and their most
//! recent credit ledger entries (grants and usage debits). Like the hosted
//! runtime routes, the Clerk session is verified per request.

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

    let balance_usd: f64 =
        sqlx::query_scalar("SELECT balance_usd FROM user_credits WHERE user_id = $1")
            .bind(&user.id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(0.0);
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
    }))
}
