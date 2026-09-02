//! Stripe webhook receiver that syncs subscription state into hosted-compute
//! entitlements.
//!
//! Stripe signs every delivery with the `Stripe-Signature` v1 scheme
//! (`t=<unix>,v1=<hmac-sha256 hex>` over `"{t}.{raw body}"`); the endpoint
//! secret comes from `STRIPE_WEBHOOK_SECRET`. The event `id` is the
//! idempotency key, so Stripe retries reuse the `billing_entitlement_events`
//! dedupe that `routes::hosted_entitlements` already provides — both surfaces
//! mutate through the same `apply_hosted_entitlement`.
//!
//! Metadata convention (set on the Stripe subscription at checkout/portal
//! time):
//! - `clerk_user_id` — the Clerk user that owns the entitlement. If the
//!   subscription metadata lacks it, an expanded customer object's metadata
//!   is consulted as a fallback.
//! - `allternit_plan_tier` — the `plan_tiers.id` to grant while the
//!   subscription is active or trialing (e.g. `pro`, `team`).
//!
//! `customer.subscription.deleted` revokes by moving the user back to the
//! deployment's default tier (`DEFAULT_PLAN_TIER`, default `free`); plan
//! access is additive state in `user_runtime_quotas`, so revocation is the
//! same idempotent mutation with the free tier as its target.

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use std::sync::Arc;

use super::hosted_entitlements::apply_hosted_entitlement;
use crate::{error::ApiError, ApiState};

const STRIPE_SIGNATURE_HEADER: &str = "stripe-signature";
const SIGNATURE_TOLERANCE_SECONDS: i64 = 300;

/// How one Stripe event maps onto an entitlement change.
#[derive(Debug, Clone, PartialEq, Eq)]
enum MappedStripeEvent {
    /// Active/trialing subscription: grant the metadata plan tier.
    Grant {
        event_id: String,
        user_id: String,
        plan_tier_id: String,
    },
    /// Deleted subscription: fall back to the deployment's default tier.
    Revoke { event_id: String, user_id: String },
    /// Any other event type (or a non-billable subscription status).
    Ignored(String),
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new().route("/api/v1/webhooks/stripe", post(stripe_webhook))
}

fn webhook_not_configured_response() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": "webhook_not_configured" })),
    )
        .into_response()
}

fn ignored_response(event_type: &str) -> Response {
    Json(json!({ "received": true, "ignored": event_type })).into_response()
}

async fn stripe_webhook(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Ok(secret) = std::env::var("STRIPE_WEBHOOK_SECRET") else {
        return webhook_not_configured_response();
    };
    let signature_header = headers
        .get(STRIPE_SIGNATURE_HEADER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if let Err(error) = verify_stripe_signature(
        &secret,
        signature_header,
        &body,
        chrono::Utc::now().timestamp(),
    ) {
        return error.into_response();
    }
    let event: Value = match serde_json::from_slice(&body) {
        Ok(event) => event,
        Err(_) => {
            return ApiError::BadRequest("Invalid Stripe event payload".to_string())
                .into_response();
        }
    };

    let mapped = match map_stripe_event(&event) {
        Ok(mapped) => mapped,
        Err(error) => return error.into_response(),
    };
    match mapped {
        MappedStripeEvent::Ignored(event_type) => ignored_response(&event_type),
        MappedStripeEvent::Grant {
            event_id,
            user_id,
            plan_tier_id,
        } => apply_and_respond(&state, &event_id, &user_id, &plan_tier_id).await,
        MappedStripeEvent::Revoke { event_id, user_id } => {
            let default_tier =
                std::env::var("DEFAULT_PLAN_TIER").unwrap_or_else(|_| "free".to_string());
            apply_and_respond(&state, &event_id, &user_id, &default_tier).await
        }
    }
}

async fn apply_and_respond(
    state: &ApiState,
    event_id: &str,
    user_id: &str,
    plan_tier_id: &str,
) -> Response {
    match apply_hosted_entitlement(&state.db, event_id, user_id, plan_tier_id, None, "stripe")
        .await
    {
        Ok(applied) => Json(json!({
            "received": true,
            "eventId": event_id,
            "userId": user_id,
            "planTierId": plan_tier_id,
            "idempotentReplay": applied.idempotent_replay,
        }))
        .into_response(),
        Err(error) => error.into_response(),
    }
}

/// Verify a `Stripe-Signature` header against the raw body. Any one `v1`
/// value may match (Stripe can send several during secret rotation), the
/// timestamp must be within tolerance, and digest comparison is constant-time
/// (`Mac::verify_slice`).
fn verify_stripe_signature(
    secret: &str,
    header: &str,
    body: &[u8],
    now_unix: i64,
) -> Result<(), ApiError> {
    let invalid = || ApiError::Unauthorized("Invalid Stripe webhook signature.".to_string());
    let mut timestamp: Option<i64> = None;
    let mut signatures: Vec<&str> = Vec::new();
    for part in header.split(',') {
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };
        match key.trim() {
            "t" => timestamp = value.trim().parse().ok(),
            "v1" => signatures.push(value.trim()),
            _ => {}
        }
    }
    let timestamp = timestamp.ok_or_else(invalid)?;
    if (now_unix - timestamp).abs() > SIGNATURE_TOLERANCE_SECONDS {
        return Err(invalid());
    }
    if signatures.is_empty() {
        return Err(invalid());
    }

    let mut signed_payload = timestamp.to_string().into_bytes();
    signed_payload.push(b'.');
    signed_payload.extend_from_slice(body);
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|_| ApiError::Internal("Failed to build webhook verifier".to_string()))?;
    mac.update(&signed_payload);
    for signature in signatures {
        let Ok(expected) = hex::decode(signature) else {
            continue;
        };
        if mac.clone().verify_slice(&expected).is_ok() {
            return Ok(());
        }
    }
    Err(invalid())
}

/// Clerk user id from subscription metadata, falling back to an expanded
/// customer object's metadata.
fn subscription_clerk_user_id(subscription: &Value) -> Option<String> {
    subscription["metadata"]["clerk_user_id"]
        .as_str()
        .or_else(|| subscription["customer"]["metadata"]["clerk_user_id"].as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

/// Map a verified Stripe event onto an entitlement change. Missing metadata
/// on a mapped event is a 400 (a permanent misconfiguration Stripe should
/// surface); unmapped event types and non-billable subscription statuses are
/// acknowledged and ignored so Stripe stops retrying them.
fn map_stripe_event(event: &Value) -> Result<MappedStripeEvent, ApiError> {
    let event_type = event["type"].as_str().unwrap_or_default();
    let event_id = event["id"].as_str().unwrap_or_default().to_string();
    let subscription = &event["data"]["object"];
    match event_type {
        "customer.subscription.created" | "customer.subscription.updated" => {
            let status = subscription["status"].as_str().unwrap_or_default();
            if !matches!(status, "active" | "trialing") {
                return Ok(MappedStripeEvent::Ignored(event_type.to_string()));
            }
            if event_id.is_empty() {
                return Err(ApiError::BadRequest(
                    "Stripe event is missing its id.".to_string(),
                ));
            }
            let user_id = subscription_clerk_user_id(subscription).ok_or_else(|| {
                ApiError::BadRequest(
                    "Subscription is missing clerk_user_id metadata.".to_string(),
                )
            })?;
            let plan_tier_id = subscription["metadata"]["allternit_plan_tier"]
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    ApiError::BadRequest(
                        "Subscription is missing allternit_plan_tier metadata.".to_string(),
                    )
                })?
                .to_string();
            Ok(MappedStripeEvent::Grant {
                event_id,
                user_id,
                plan_tier_id,
            })
        }
        "customer.subscription.deleted" => {
            if event_id.is_empty() {
                return Err(ApiError::BadRequest(
                    "Stripe event is missing its id.".to_string(),
                ));
            }
            let user_id = subscription_clerk_user_id(subscription).ok_or_else(|| {
                ApiError::BadRequest(
                    "Subscription is missing clerk_user_id metadata.".to_string(),
                )
            })?;
            Ok(MappedStripeEvent::Revoke { event_id, user_id })
        }
        other => Ok(MappedStripeEvent::Ignored(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;

    const TEST_SECRET: &str = "whsec_test_secret";

    fn sign(secret: &str, TIMESTAMPTZ: i64, body: &[u8]) -> String {
        let mut signed_payload = TIMESTAMPTZ.to_string().into_bytes();
        signed_payload.push(b'.');
        signed_payload.extend_from_slice(body);
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(&signed_payload);
        format!(
            "t={},v1={}",
            TIMESTAMPTZ,
            hex::encode(mac.finalize().into_bytes())
        )
    }

    fn subscription_event(
        event_id: &str,
        event_type: &str,
        status: &str,
        metadata: Value,
    ) -> Value {
        json!({
            "id": event_id,
            "type": event_type,
            "data": {
                "object": {
                    "id": "sub_123",
                    "status": status,
                    "customer": "cus_123",
                    "metadata": metadata,
                }
            }
        })
    }

    /// Minimal billing schema matching migrations 001/012/014/015 for the
    /// entitlement mutation path.
    async fn test_pool() -> PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        sqlx::query("DROP TABLE IF EXISTS users CASCADE").execute(&pool).await.unwrap();
        sqlx::query(r#"
        CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                last_login_at TIMESTAMPTZ
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("DROP TABLE IF EXISTS plan_tiers CASCADE").execute(&pool).await.unwrap();
        sqlx::query(r#"
        CREATE TABLE plan_tiers (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                max_active_devices BIGINT NOT NULL DEFAULT 1,
                max_pairings_per_day BIGINT NOT NULL DEFAULT 5,
                max_relay_sockets BIGINT NOT NULL DEFAULT 5,
                max_relay_mb_per_day BIGINT NOT NULL DEFAULT 100,
                max_hosted_runtime_hours_monthly BIGINT NOT NULL DEFAULT 0,
                can_create_hosted_runtime BOOLEAN NOT NULL DEFAULT FALSE,
                max_hosted_runtimes BIGINT NOT NULL DEFAULT 0,
                max_hosted_runtime_memory_mb BIGINT NOT NULL DEFAULT 0,
                hard_spend_cap_usd DOUBLE PRECISION
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            INSERT INTO plan_tiers (
                id, display_name, max_active_devices, max_pairings_per_day,
                max_relay_sockets, max_relay_mb_per_day,
                max_hosted_runtime_hours_monthly, can_create_hosted_runtime,
                max_hosted_runtimes, max_hosted_runtime_memory_mb, hard_spend_cap_usd
            ) VALUES
                ('free', 'Free', 1, 5, 5, 100, 0, FALSE, 0, 0, 5.0),
                ('pro', 'Pro', 5, 50, 20, 5000, 100, TRUE, 1, 1024, 100.0)
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("DROP TABLE IF EXISTS user_runtime_quotas CASCADE").execute(&pool).await.unwrap();
        sqlx::query(r#"
        CREATE TABLE user_runtime_quotas (
                user_id TEXT PRIMARY KEY,
                plan_tier_id TEXT NOT NULL,
                max_active_devices BIGINT NOT NULL,
                max_pairings_per_day BIGINT NOT NULL,
                max_relay_sockets BIGINT NOT NULL,
                max_relay_mb_per_day BIGINT NOT NULL,
                max_hosted_runtime_hours_monthly BIGINT NOT NULL,
                can_create_hosted_runtime BOOLEAN NOT NULL,
                max_hosted_runtimes BIGINT NOT NULL,
                max_hosted_runtime_memory_mb BIGINT NOT NULL,
                hard_spend_cap_usd DOUBLE PRECISION
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("DROP TABLE IF EXISTS billing_entitlement_events CASCADE").execute(&pool).await.unwrap();
        sqlx::query(r#"
        CREATE TABLE billing_entitlement_events (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                previous_plan_tier_id TEXT,
                plan_tier_id TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'billing',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn quota_tier(pool: &PgPool, user_id: &str) -> Option<String> {
        sqlx::query_scalar("SELECT plan_tier_id FROM user_runtime_quotas WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .unwrap()
    }

    #[test]
    fn signature_verifies_a_correctly_signed_payload() {
        let body = br#"{"id":"evt_1","type":"customer.subscription.created"}"#;
        let now = 1_800_000_000_i64;
        let header = sign(TEST_SECRET, now, body);
        assert!(verify_stripe_signature(TEST_SECRET, &header, body, now).is_ok());
    }

    #[test]
    fn signature_rejects_tampered_body_wrong_secret_and_stale_timestamp() {
        let body = br#"{"id":"evt_1"}"#;
        let now = 1_800_000_000_i64;
        let header = sign(TEST_SECRET, now, body);

        let tampered = br#"{"id":"evt_2"}"#;
        assert!(verify_stripe_signature(TEST_SECRET, &header, tampered, now).is_err());
        assert!(verify_stripe_signature("whsec_other", &header, body, now).is_err());
        assert!(
            verify_stripe_signature(
                TEST_SECRET,
                &header,
                body,
                now + SIGNATURE_TOLERANCE_SECONDS + 1,
            )
            .is_err(),
            "TIMESTAMPTZ outside the 5 minute tolerance must fail"
        );
        assert!(verify_stripe_signature(TEST_SECRET, "", body, now).is_err());
        assert!(verify_stripe_signature(TEST_SECRET, "t=notanumber,v1=aa", body, now).is_err());
    }

    #[test]
    fn signature_accepts_one_matching_v1_among_rotation_candidates() {
        let body = br#"{"id":"evt_1"}"#;
        let now = 1_800_000_000_i64;
        let good = sign(TEST_SECRET, now, body);
        let header = format!("t={now},v1=deadbeef,{}", good.split(',').nth(1).unwrap());
        assert!(verify_stripe_signature(TEST_SECRET, &header, body, now).is_ok());
    }

    #[test]
    fn mapping_grants_active_and_trialing_subscriptions() {
        for (event_type, status) in [
            ("customer.subscription.created", "active"),
            ("customer.subscription.updated", "trialing"),
        ] {
            let event = subscription_event(
                "evt_1",
                event_type,
                status,
                json!({ "clerk_user_id": "user_1", "allternit_plan_tier": "pro" }),
            );
            assert_eq!(
                map_stripe_event(&event).unwrap(),
                MappedStripeEvent::Grant {
                    event_id: "evt_1".to_string(),
                    user_id: "user_1".to_string(),
                    plan_tier_id: "pro".to_string(),
                },
                "{event_type}/{status} must grant"
            );
        }
    }

    #[test]
    fn mapping_revokes_deleted_subscriptions() {
        let event = subscription_event(
            "evt_9",
            "customer.subscription.deleted",
            "canceled",
            json!({ "clerk_user_id": "user_1" }),
        );
        assert_eq!(
            map_stripe_event(&event).unwrap(),
            MappedStripeEvent::Revoke {
                event_id: "evt_9".to_string(),
                user_id: "user_1".to_string(),
            }
        );
    }

    #[test]
    fn mapping_ignores_unmapped_types_and_non_billable_statuses() {
        let unknown = json!({ "id": "evt_2", "type": "invoice.paid", "data": { "object": {} } });
        assert_eq!(
            map_stripe_event(&unknown).unwrap(),
            MappedStripeEvent::Ignored("invoice.paid".to_string())
        );

        let past_due = subscription_event(
            "evt_3",
            "customer.subscription.updated",
            "past_due",
            json!({ "clerk_user_id": "user_1", "allternit_plan_tier": "pro" }),
        );
        assert_eq!(
            map_stripe_event(&past_due).unwrap(),
            MappedStripeEvent::Ignored("customer.subscription.updated".to_string())
        );
    }

    #[test]
    fn mapping_falls_back_to_expanded_customer_metadata() {
        let mut event = subscription_event("evt_4", "customer.subscription.created", "active", json!({}));
        event["data"]["object"]["customer"] = json!({
            "id": "cus_123",
            "metadata": { "clerk_user_id": "user_7" }
        });
        event["data"]["object"]["metadata"] = json!({ "allternit_plan_tier": "pro" });
        assert_eq!(
            map_stripe_event(&event).unwrap(),
            MappedStripeEvent::Grant {
                event_id: "evt_4".to_string(),
                user_id: "user_7".to_string(),
                plan_tier_id: "pro".to_string(),
            }
        );
    }

    #[test]
    fn mapping_rejects_mapped_events_without_required_metadata() {
        let no_user = subscription_event(
            "evt_5",
            "customer.subscription.created",
            "active",
            json!({ "allternit_plan_tier": "pro" }),
        );
        assert!(map_stripe_event(&no_user).is_err());

        let no_tier = subscription_event(
            "evt_6",
            "customer.subscription.created",
            "active",
            json!({ "clerk_user_id": "user_1" }),
        );
        assert!(map_stripe_event(&no_tier).is_err());

        let deleted_no_user = subscription_event(
            "evt_7",
            "customer.subscription.deleted",
            "canceled",
            json!({}),
        );
        assert!(map_stripe_event(&deleted_no_user).is_err());
    }

    #[tokio::test]
    async fn grant_then_revoke_moves_quota_and_replays_are_noops() {
        let pool = test_pool().await;

        // Active subscription grants the metadata tier.
        let grant = apply_hosted_entitlement(&pool, "evt_1", "user_1", "pro", None, "stripe")
            .await
            .unwrap();
        assert!(!grant.idempotent_replay);
        assert_eq!(grant.previous_plan_tier_id, None);
        assert_eq!(quota_tier(&pool, "user_1").await.as_deref(), Some("pro"));

        // Stripe retries the same delivery: same event id, no second effect.
        let replay = apply_hosted_entitlement(&pool, "evt_1", "user_1", "pro", None, "stripe")
            .await
            .unwrap();
        assert!(replay.idempotent_replay);
        let event_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM billing_entitlement_events")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(event_count, 1, "the event id dedupes Stripe retries");

        // Reusing the event id for a different change is rejected.
        assert!(
            apply_hosted_entitlement(&pool, "evt_1", "user_1", "free", None, "stripe")
                .await
                .is_err()
        );

        // Deletion revokes back to the default tier, recording the previous one.
        let revoke = apply_hosted_entitlement(&pool, "evt_2", "user_1", "free", None, "stripe")
            .await
            .unwrap();
        assert!(!revoke.idempotent_replay);
        assert_eq!(revoke.previous_plan_tier_id.as_deref(), Some("pro"));
        assert_eq!(quota_tier(&pool, "user_1").await.as_deref(), Some("free"));

        let (can_create, max_runtimes): (bool, i64) = sqlx::query_as(
            "SELECT can_create_hosted_runtime, max_hosted_runtimes FROM user_runtime_quotas WHERE user_id = 'user_1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(!can_create);
        assert_eq!(max_runtimes, 0, "revocation restores the free tier limits");
    }
}
