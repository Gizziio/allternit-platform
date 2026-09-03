//! Contabo-hosted runtime provisioning endpoints.
//!
//! Provisions user workloads as Docker containers on the existing Contabo VPS.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    error::ApiError,
    services::ProvisionedContaboRuntime,
    ApiState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContaboRuntimeRequest {
    #[serde(default = "default_name")]
    name: String,
    #[serde(default = "default_memory_mb")]
    memory_mb: i64,
}

fn default_name() -> String {
    "Contabo Workload".to_string()
}

fn default_memory_mb() -> i64 {
    1024
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContaboRuntimeResponse {
    instance_id: String,
    container_id: String,
    runtime_device_id: String,
    mesh_ip: Option<String>,
    gateway_url: String,
    bootstrap_token: String,
    status: String,
}

impl From<ProvisionedContaboRuntime> for ContaboRuntimeResponse {
    fn from(r: ProvisionedContaboRuntime) -> Self {
        Self {
            instance_id: r.instance_id,
            container_id: r.container_id,
            runtime_device_id: r.runtime_device_id,
            mesh_ip: r.mesh_ip,
            gateway_url: r.gateway_url,
            bootstrap_token: r.bootstrap_token,
            status: "running".to_string(),
        }
    }
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/hosted-runtimes/contabo", post(create_contabo_runtime))
        .route(
            "/api/v1/hosted-runtimes/contabo/:id",
            delete(destroy_contabo_runtime),
        )
}

async fn create_contabo_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(req): Json<CreateContaboRuntimeRequest>,
) -> Result<Json<ContaboRuntimeResponse>, ApiError> {
    let user_id = crate::auth::resolve_user_id(&state.db, &headers).await?;

    let runtime = state
        .contabo_runtime_service
        .provision(&user_id, &req.name, req.memory_mb)
        .await?;

    Ok(Json(runtime.into()))
}

async fn destroy_contabo_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let user_id = crate::auth::resolve_user_id(&state.db, &headers).await?;
    // Ownership check: the destroy below is not user-scoped in the service,
    // so the route must verify the instance belongs to the caller first.
    let owned: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM hosted_runtime_instances WHERE id = $1 AND user_id = $2 AND status != 'destroyed'",
    )
    .bind(&id)
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?;
    if owned.is_none() {
        return Err(ApiError::NotFound("Hosted runtime not found".to_string()));
    }

    state.contabo_runtime_service.destroy(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}
