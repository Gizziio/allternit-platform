//! Secret-gated subscription entitlement synchronization.
//!
//! Stripe, a billing worker, or an operator can map a paid subscription to a
//! runtime plan without exposing quota mutation to the user's Clerk session.
//! Event IDs make retries idempotent. This is plan access only; provider-credit
//! balances are intentionally not part of this surface.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{error::ApiError, ApiState};

const BILLING_SECRET_HEADER: &str = "x-allternit-billing-secret";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncHostedEntitlementRequest {
    event_id: String,
    user_id: String,
    plan_tier_id: String,
    email: Option<String>,
    source: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncHostedEntitlementResponse {
    event_id: String,
    user_id: String,
    previous_plan_tier_id: Option<String>,
    plan_tier_id: String,
    can_create_hosted_runtime: bool,
    max_hosted_runtimes: i64,
    max_memory_mb: i64,
    max_hours_monthly: i64,
    idempotent_replay: bool,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new().route(
        "/api/v1/internal/billing/hosted-entitlement",
        post(sync_hosted_entitlement),
    )
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.as_bytes()
        .iter()
        .zip(right.as_bytes())
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

fn require_billing_secret(headers: &HeaderMap) -> Result<(), ApiError> {
    let expected = std::env::var("ALLTERNIT_BILLING_SYNC_SECRET").map_err(|_| {
        ApiError::ServiceUnavailable(
            "Billing entitlement sync is not configured on this deployment.".to_string(),
        )
    })?;
    let provided = headers
        .get(BILLING_SECRET_HEADER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if expected.len() < 32 || !constant_time_eq(&expected, provided) {
        return Err(ApiError::Unauthorized(
            "Invalid billing synchronization credential.".to_string(),
        ));
    }
    Ok(())
}

async fn sync_hosted_entitlement(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(request): Json<SyncHostedEntitlementRequest>,
) -> Result<(StatusCode, Json<SyncHostedEntitlementResponse>), ApiError> {
    require_billing_secret(&headers)?;
    if request.event_id.trim().is_empty() || request.event_id.len() > 160 {
        return Err(ApiError::BadRequest(
            "eventId is required and must be 160 characters or fewer.".to_string(),
        ));
    }
    if request.user_id.trim().is_empty() || request.user_id.len() > 160 {
        return Err(ApiError::BadRequest(
            "userId is required and must be 160 characters or fewer.".to_string(),
        ));
    }
    let source = request
        .source
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("billing")
        .to_string();
    if source.len() > 80 {
        return Err(ApiError::BadRequest(
            "source must be 80 characters or fewer.".to_string(),
        ));
    }

    // Keep the entitlement mutation and its idempotency/audit record in one
    // transaction. This prevents a webhook failure from granting a plan
    // without recording the event (or recording an event without granting it).
    let mut transaction = state.db.begin().await?;
    let existing: Option<(String, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT user_id, plan_tier_id, previous_plan_tier_id
        FROM billing_entitlement_events
        WHERE id = ?
        "#,
    )
    .bind(&request.event_id)
    .fetch_optional(&mut *transaction)
    .await?;
    if let Some(existing) = existing {
        if existing.0 != request.user_id || existing.1 != request.plan_tier_id {
            return Err(ApiError::BadRequest(
                "eventId was already used for a different entitlement change.".to_string(),
            ));
        }
        transaction.commit().await?;
        let quota = state.quota_service.ensure_quota(&request.user_id).await?;
        return Ok((
            StatusCode::OK,
            Json(SyncHostedEntitlementResponse {
                event_id: request.event_id,
                user_id: request.user_id,
                previous_plan_tier_id: existing.2,
                plan_tier_id: quota.plan_tier_id,
                can_create_hosted_runtime: quota.can_create_hosted_runtime,
                max_hosted_runtimes: quota.max_hosted_runtimes,
                max_memory_mb: quota.max_hosted_runtime_memory_mb,
                max_hours_monthly: quota.max_hosted_runtime_hours_monthly,
                idempotent_replay: true,
            }),
        ));
    }
    let tier_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM plan_tiers WHERE id = ?)")
            .bind(&request.plan_tier_id)
            .fetch_one(&mut *transaction)
            .await?;
    if !tier_exists {
        return Err(ApiError::BadRequest(format!(
            "Unknown hosted compute plan tier: {}",
            request.plan_tier_id
        )));
    }

    let email = request.email.unwrap_or_else(|| {
        format!(
            "{}@billing.allternit.local",
            request.user_id.replace('@', "_")
        )
    });
    sqlx::query(
        r#"
        INSERT INTO users (id, email, status, last_login_at)
        VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET status = 'active'
        "#,
    )
    .bind(&request.user_id)
    .bind(email)
    .execute(&mut *transaction)
    .await?;

    let previous_plan_tier_id: Option<String> =
        sqlx::query_scalar("SELECT plan_tier_id FROM user_runtime_quotas WHERE user_id = ?")
            .bind(&request.user_id)
            .fetch_optional(&mut *transaction)
            .await?;
    let event_insert = sqlx::query(
        r#"
        INSERT INTO billing_entitlement_events (
            id, user_id, previous_plan_tier_id, plan_tier_id, source
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        "#,
    )
    .bind(&request.event_id)
    .bind(&request.user_id)
    .bind(previous_plan_tier_id.as_deref())
    .bind(&request.plan_tier_id)
    .bind(source)
    .execute(&mut *transaction)
    .await?;

    if event_insert.rows_affected() == 0 {
        let existing: (String, String, Option<String>) = sqlx::query_as(
            r#"
            SELECT user_id, plan_tier_id, previous_plan_tier_id
            FROM billing_entitlement_events
            WHERE id = ?
            "#,
        )
        .bind(&request.event_id)
        .fetch_one(&mut *transaction)
        .await?;
        if existing.0 != request.user_id || existing.1 != request.plan_tier_id {
            return Err(ApiError::BadRequest(
                "eventId was already used for a different entitlement change.".to_string(),
            ));
        }
        transaction.commit().await?;
        let quota = state.quota_service.ensure_quota(&request.user_id).await?;
        return Ok((
            StatusCode::OK,
            Json(SyncHostedEntitlementResponse {
                event_id: request.event_id,
                user_id: request.user_id,
                previous_plan_tier_id: existing.2,
                plan_tier_id: quota.plan_tier_id,
                can_create_hosted_runtime: quota.can_create_hosted_runtime,
                max_hosted_runtimes: quota.max_hosted_runtimes,
                max_memory_mb: quota.max_hosted_runtime_memory_mb,
                max_hours_monthly: quota.max_hosted_runtime_hours_monthly,
                idempotent_replay: true,
            }),
        ));
    }

    let quota_update = sqlx::query(
        r#"
        INSERT INTO user_runtime_quotas (
            user_id, plan_tier_id,
            max_active_devices, max_pairings_per_day, max_relay_sockets,
            max_relay_mb_per_day, max_hosted_runtime_hours_monthly,
            can_create_hosted_runtime, max_hosted_runtimes,
            max_hosted_runtime_memory_mb, hard_spend_cap_usd
        )
        SELECT ?, id,
            max_active_devices, max_pairings_per_day, max_relay_sockets,
            max_relay_mb_per_day, max_hosted_runtime_hours_monthly,
            can_create_hosted_runtime, max_hosted_runtimes,
            max_hosted_runtime_memory_mb, hard_spend_cap_usd
        FROM plan_tiers
        WHERE id = ?
        ON CONFLICT(user_id) DO UPDATE SET
            plan_tier_id = excluded.plan_tier_id,
            max_active_devices = excluded.max_active_devices,
            max_pairings_per_day = excluded.max_pairings_per_day,
            max_relay_sockets = excluded.max_relay_sockets,
            max_relay_mb_per_day = excluded.max_relay_mb_per_day,
            max_hosted_runtime_hours_monthly = excluded.max_hosted_runtime_hours_monthly,
            can_create_hosted_runtime = excluded.can_create_hosted_runtime,
            max_hosted_runtimes = excluded.max_hosted_runtimes,
            max_hosted_runtime_memory_mb = excluded.max_hosted_runtime_memory_mb,
            hard_spend_cap_usd = excluded.hard_spend_cap_usd
        "#,
    )
    .bind(&request.user_id)
    .bind(&request.plan_tier_id)
    .execute(&mut *transaction)
    .await?;
    if quota_update.rows_affected() != 1 {
        return Err(ApiError::Internal(
            "Failed to apply hosted compute entitlement.".to_string(),
        ));
    }
    transaction.commit().await?;
    let quota = state.quota_service.ensure_quota(&request.user_id).await?;

    Ok((
        StatusCode::CREATED,
        Json(SyncHostedEntitlementResponse {
            event_id: request.event_id,
            user_id: request.user_id,
            previous_plan_tier_id,
            plan_tier_id: quota.plan_tier_id,
            can_create_hosted_runtime: quota.can_create_hosted_runtime,
            max_hosted_runtimes: quota.max_hosted_runtimes,
            max_memory_mb: quota.max_hosted_runtime_memory_mb,
            max_hours_monthly: quota.max_hosted_runtime_hours_monthly,
            idempotent_replay: false,
        }),
    ))
}
