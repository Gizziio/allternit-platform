//! Internal wallet-transfer routes — move user wallet balance to/from an
//! external ledger (the platform org fabric credits ledger).
//!
//! These endpoints are server-to-server: they are gated by the shared
//! `ALLTERNIT_BILLING_SYNC_SECRET` (same credential as the entitlement/credit
//! sync routes in `hosted_entitlements`), not by user auth. The caller
//! (allternit-api) debits the wallet here and credits its local org ledger
//! with the same idempotency key; on failure it compensates with the
//! `credit` direction.

use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    routing::post,
    Router,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::error::ApiError;
use crate::services::cost_service::CostService;
use crate::ApiState;

const BILLING_SECRET_HEADER: &str = "x-allternit-billing-secret";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransferRequest {
    user_id: String,
    /// Transfer amount in integer USD cents (the fabric ledger's unit).
    amount_cents: i64,
    /// Shared idempotency key; also recorded as the wallet ledger
    /// transaction id so replays are no-ops.
    idempotency_key: String,
    /// `debit` moves money out of the wallet; `credit` refunds it back
    /// (compensation path).
    #[serde(default = "default_direction")]
    direction: String,
}

fn default_direction() -> String {
    "debit".to_string()
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new().route(
        "/api/v1/internal/billing/credits/transfer",
        post(transfer_credits),
    )
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.as_bytes()
        .iter()
        .zip(right.as_bytes())
        .fold(0_u8, |difference, (left, right)| difference | (left ^ right))
        == 0
}

fn require_billing_secret(headers: &HeaderMap) -> Result<(), ApiError> {
    let expected = std::env::var("ALLTERNIT_BILLING_SYNC_SECRET").map_err(|_| {
        ApiError::ServiceUnavailable(
            "Billing transfer is not configured on this deployment.".to_string(),
        )
    })?;
    let provided = headers
        .get(BILLING_SECRET_HEADER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if expected.len() < 32 || !constant_time_eq(&expected, &provided) {
        return Err(ApiError::Unauthorized(
            "Invalid billing synchronization credential.".to_string(),
        ));
    }
    Ok(())
}

async fn transfer_credits(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(request): Json<TransferRequest>,
) -> Result<(StatusCode, axum::Json<serde_json::Value>), ApiError> {
    require_billing_secret(&headers)?;
    if request.user_id.trim().is_empty() || request.user_id.len() > 160 {
        return Err(ApiError::BadRequest(
            "userId is required and must be 160 characters or fewer.".to_string(),
        ));
    }
    if request.amount_cents <= 0 {
        return Err(ApiError::BadRequest(
            "amountCents must be a positive integer.".to_string(),
        ));
    }
    if request.idempotency_key.trim().is_empty() || request.idempotency_key.len() > 160 {
        return Err(ApiError::BadRequest(
            "idempotencyKey is required and must be 160 characters or fewer.".to_string(),
        ));
    }
    let amount_usd = request.amount_cents as f64 / 100.0;

    let existing: Option<String> = sqlx::query_scalar(
        "SELECT transaction_id FROM credit_transactions WHERE transaction_id = $1",
    )
    .bind(&request.idempotency_key)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?;
    let idempotent_replay = existing.is_some();

    let balance_usd = match request.direction.as_str() {
        "debit" => {
            state
                .cost_service
                .debit_credits_for_transfer(
                    &request.user_id,
                    amount_usd,
                    &request.idempotency_key,
                    "fabric_transfer",
                )
                .await?
        }
        "credit" => {
            state
                .cost_service
                .add_credits(
                    &request.user_id,
                    amount_usd,
                    &request.idempotency_key,
                    "fabric_transfer_refund",
                )
                .await?
        }
        other => {
            return Err(ApiError::BadRequest(format!(
                "direction must be 'debit' or 'credit', got '{other}'."
            )));
        }
    };

    Ok((
        StatusCode::CREATED,
        axum::Json(json!({
            "transaction_id": request.idempotency_key,
            "user_id": request.user_id,
            "amount_cents": request.amount_cents,
            "balance_usd": balance_usd,
            "idempotent_replay": idempotent_replay,
        })),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_time_eq_compares_values() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "abcd"));
        assert!(!constant_time_eq("", "x"));
    }

    // DB-backed behavior (debit, replay, insufficient, refund) is covered by
    // cost_service::tests::transfer_* — this module adds the HTTP shell only.
}
