//! User-facing API key management.
//!
//! Endpoints:
//! - `GET /api/v1/api-keys` — list active keys for the authenticated user.
//! - `POST /api/v1/api-keys` — create a new scoped key.
//! - `DELETE /api/v1/api-keys/:id` — revoke a key.

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
    let user = clerk::user_from_headers(&headers).await?;
    let keys = services::api_keys::list_api_keys(&state.db, &user.id).await?;
    Ok(Json(keys.into_iter().map(into_response).collect()))
}

async fn create_api_key(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;

    let created = services::api_keys::create_api_key(
        &state.db,
        services::api_keys::CreateApiKeyInput {
            user_id: user.id,
            organization_id: user.organization_id,
            name: body.name,
            scopes: body.scopes,
        },
    )
    .await?;

    Ok(Json(into_created_response(created)))
}

async fn revoke_api_key(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    services::api_keys::revoke_api_key(&state.db, &user.id, &id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

fn into_response(key: services::api_keys::ApiKey) -> ApiKeyResponse {
    ApiKeyResponse {
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        scopes: key.scopes,
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
