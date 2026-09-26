//! User-facing API key management.
//!
//! Endpoints:
//! - `GET /api/v1/api-keys` — list active keys for the authenticated user.
//! - `POST /api/v1/api-keys` — create a new scoped key.
//! - `DELETE /api/v1/api-keys/:id` — revoke a key.
//!
//! Keys are tied to the user's subscription tier, with monthly quota tracking
//! and enforcement at inference time.

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    auth::clerk,
    error::ApiError,
    services::{self, api_keys::CreatedApiKey},
    ApiState,
};

/// Public view of an API key (no token hash).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyResponse {
    pub id: String,
    pub name: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monthly_quota_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_this_period_usd: Option<f64>,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    #[serde(default)]
    pub scopes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateApiKeyResponse {
    #[serde(flatten)]
    pub key: ApiKeyResponse,
    pub token: String,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/api-keys", get(list_api_keys))
        .route("/api/v1/api-keys", post(create_api_key))
        .route("/api/v1/api-keys/:id", delete(revoke_api_key))
}

async fn list_api_keys(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ApiKeyResponse>>, ApiError> {
    let user_id = crate::auth::resolve_user_scoped(&state.db, &headers, "account")
        .await?
        .id;
    let keys = services::api_keys::list_api_keys(&state.db, &user_id).await?;
    Ok(Json(keys.into_iter().map(into_response).collect()))
}

/// Token minting stays Clerk-session-gated on purpose: an `allternit_*` API
/// token must not be able to mint further tokens (no privilege escalation),
/// and the organization binding comes from the Clerk claims.
///
/// Keys are automatically scoped to the user's subscription tier with
/// appropriate monthly quota limits.
async fn create_api_key(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;

    // Fetch active subscription to determine tier and quota
    let subscription_row: Option<(String, String)> = sqlx::query_as(
        r#"
        SELECT plan_id, plan_tier
        FROM billing_subscriptions
        WHERE user_id = $1 AND status IN ('active', 'trialing')
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(&user.id)
    .fetch_optional(&state.db)
    .await?;

    let (subscription_tier, monthly_quota_usd) = match subscription_row {
        Some((plan_id, plan_tier)) => {
            let quota = services::api_keys::get_quota_for_plan(&plan_id);
            (Some(plan_tier), Some(quota))
        }
        None => {
            // Free tier: $5/month quota
            (Some("free".to_string()), Some(services::api_keys::QUOTA_FREE))
        }
    };

    let created = services::api_keys::create_api_key(
        &state.db,
        services::api_keys::CreateApiKeyInput {
            user_id: user.id.clone(),
            organization_id: user.organization_id,
            name: body.name,
            scopes: body.scopes,
            subscription_tier,
            monthly_quota_usd,
        },
    )
    .await?;

    services::audit::write_audit_log(
        &state.db,
        services::audit::AuditEvent {
            action: "api_key.create".to_string(),
            resource_type: "api_key".to_string(),
            resource_id: Some(created.key.id.clone()),
            user_id: Some(user.id),
            user_email: user.email,
            details: Some(serde_json::json!({
                "name": created.key.name,
                "prefix": created.key.prefix,
                "scopes": created.key.scopes,
                "subscription_tier": created.key.subscription_tier,
                "monthly_quota_usd": created.key.monthly_quota_usd,
            })),
            success: true,
        },
    )
    .await;

    Ok(Json(into_created_response(created)))
}

async fn revoke_api_key(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = crate::auth::resolve_user_scoped(&state.db, &headers, "account")
        .await?
        .id;
    services::api_keys::revoke_api_key(&state.db, &user_id, &id).await?;
    services::audit::write_audit_log(
        &state.db,
        services::audit::AuditEvent {
            action: "api_key.revoke".to_string(),
            resource_type: "api_key".to_string(),
            resource_id: Some(id),
            user_id: Some(user_id),
            user_email: None,
            details: None,
            success: true,
        },
    )
    .await;
    Ok(Json(serde_json::json!({ "ok": true })))
}

fn into_response(key: services::api_keys::ApiKey) -> ApiKeyResponse {
    ApiKeyResponse {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
        subscription_tier: key.subscription_tier,
        monthly_quota_usd: key.monthly_quota_usd,
        usage_this_period_usd: key.usage_this_period_usd,
        created_at: key.created_at.to_rfc3339(),
        last_used_at: key.last_used_at.map(|t| t.to_rfc3339()),
        revoked_at: key.revoked_at.map(|t| t.to_rfc3339()),
    }
}

fn into_created_response(created: CreatedApiKey) -> CreateApiKeyResponse {
    CreateApiKeyResponse {
        key: into_response(created.key),
        token: created.token,
    }
}
