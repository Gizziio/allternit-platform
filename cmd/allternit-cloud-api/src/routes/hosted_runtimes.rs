//! Hosted runtime management for paid Allternit users.
//!
//! Runtimes are provisioned as Fly Machines in the cloud API's own Fly
//! organization. The agent-daemon inside the machine auto-pairs using a
//! bootstrap token, so the user never enters a pairing code.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{auth::clerk, error::ApiError, services, ApiState};

const BOOTSTRAP_TOKEN_BYTES: usize = 32;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHostedRuntimeRequest {
    #[serde(default = "default_region")]
    region: String,
    #[serde(default = "default_memory_mb")]
    memory_mb: i64,
    #[serde(default)]
    name: Option<String>,
}

fn default_region() -> String {
    std::env::var("FLY_DEFAULT_REGION").unwrap_or_else(|_| "lax".to_string())
}

fn default_memory_mb() -> i64 {
    1024
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostedRuntimeResponse {
    id: String,
    name: String,
    region: String,
    status: String,
    runtime_device_id: Option<String>,
    cpus: i64,
    memory_mb: i64,
    created_at: DateTime<Utc>,
    started_at: Option<DateTime<Utc>>,
    stopped_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct HostedRuntimeRow {
    id: String,
    name: String,
    region: String,
    status: String,
    runtime_device_id: Option<String>,
    cpus: i64,
    memory_mb: i64,
    created_at: DateTime<Utc>,
    started_at: Option<DateTime<Utc>>,
    stopped_at: Option<DateTime<Utc>>,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/hosted-runtimes", get(list_hosted_runtimes))
        .route("/api/v1/hosted-runtimes", post(create_hosted_runtime))
        .route(
            "/api/v1/hosted-runtimes/:id/start",
            post(start_hosted_runtime),
        )
        .route(
            "/api/v1/hosted-runtimes/:id/stop",
            post(stop_hosted_runtime),
        )
        .route(
            "/api/v1/hosted-runtimes/:id",
            delete(destroy_hosted_runtime),
        )
}

async fn list_hosted_runtimes(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<HostedRuntimeResponse>>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let rows = sqlx::query_as::<_, HostedRuntimeRow>(
        r#"
        SELECT id, name, region, status, runtime_device_id, cpus, memory_mb,
               created_at, started_at, stopped_at
        FROM hosted_runtime_instances
        WHERE user_id = ? AND status != 'destroyed'
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows.into_iter().map(into_response).collect()))
}

async fn create_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(request): Json<CreateHostedRuntimeRequest>,
) -> Result<(StatusCode, Json<HostedRuntimeResponse>), ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let quota = state.quota_service.ensure_quota(&user.id).await?;

    if !state.quota_service.can_create_hosted_runtime(&quota) {
        return Err(ApiError::Forbidden(
            "Your plan does not include hosted runtimes. Upgrade to Pro or Team.".to_string(),
        ));
    }
    state
        .quota_service
        .check_spend_cap(&user.id, &quota)
        .await?;

    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable(
            "Hosted runtimes are not configured. Set FLY_API_TOKEN.".to_string(),
        )
    })?;

    let instance_id = format!("hr_{}", Uuid::new_v4().simple());
    let name = request
        .name
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Allternit Hosted ({})", request.region));
    let bootstrap_token = crate::routes::runtime_pairing::random_secret(BOOTSTRAP_TOKEN_BYTES);
    let bootstrap_hash = sha256_hex(bootstrap_token.as_bytes());
    let cpus = 1_i64;
    let cpu_kind = "shared".to_string();
    let cost_rate_instance_type = format!("shared-cpu-{}x-{}mb", cpus, request.memory_mb);

    sqlx::query(
        r#"
        INSERT INTO hosted_runtime_instances (
            id, user_id, organization_id, name, region, cpu_kind, cpus, memory_mb,
            status, bootstrap_token_hash, billing_mode, cost_rate_provider,
            cost_rate_region, cost_rate_instance_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'creating', ?, 'allternit', 'fly', ?, ?)
        "#,
    )
    .bind(&instance_id)
    .bind(&user.id)
    .bind(user.organization_id.as_deref())
    .bind(&name)
    .bind(&request.region)
    .bind(&cpu_kind)
    .bind(cpus)
    .bind(request.memory_mb)
    .bind(&bootstrap_hash)
    .bind(&request.region)
    .bind(&cost_rate_instance_type)
    .execute(&state.db)
    .await?;

    let config = services::HostedMachineConfig {
        region: request.region.clone(),
        cpu_kind: cpu_kind.clone(),
        cpus,
        memory_mb: request.memory_mb,
        volume_size_gb: 1,
        env: vec![
            (
                "ALLTERNIT_HOSTED_INSTANCE_ID".to_string(),
                instance_id.clone(),
            ),
            ("ALLTERNIT_HOSTED_USER_ID".to_string(), user.id.clone()),
            (
                "ALLTERNIT_HOSTED_BOOTSTRAP_TOKEN".to_string(),
                bootstrap_token.clone(),
            ),
        ],
    };

    let provisioned = match fly.provision(&config, &bootstrap_token).await {
        Ok(machine) => machine,
        Err(error) => {
            error!(%instance_id, "Failed to provision hosted runtime: {}", error);
            sqlx::query(
                "UPDATE hosted_runtime_instances SET status = 'error', error_message = ? WHERE id = ?",
            )
            .bind(format!("{error}"))
            .bind(&instance_id)
            .execute(&state.db)
            .await?;
            return Err(error);
        }
    };

    sqlx::query(
        r#"
        UPDATE hosted_runtime_instances
        SET status = 'starting', fly_app = ?, fly_machine_id = ?, fly_volume_id = ?,
            started_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&provisioned.app)
    .bind(&provisioned.machine_id)
    .bind(provisioned.volume_id.as_deref())
    .bind(&instance_id)
    .execute(&state.db)
    .await?;

    info!(%instance_id, machine_id = %provisioned.machine_id, "Hosted runtime provisioned");

    let row = fetch_instance(&state, &instance_id).await?;
    Ok((StatusCode::CREATED, Json(into_response(row))))
}

async fn start_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<HostedRuntimeResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let row = fetch_instance_for_user(&state, &id, &user.id).await?;
    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
    })?;

    let machine_id = row
        .fly_machine_id
        .ok_or_else(|| ApiError::BadRequest("Hosted runtime has no machine".to_string()))?;

    fly.start(&machine_id).await?;

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'starting', started_at = CURRENT_TIMESTAMP, stopped_at = NULL WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    let row = fetch_instance(&state, &id).await?;
    Ok(Json(into_response(row)))
}

async fn stop_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<HostedRuntimeResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let row = fetch_instance_for_user(&state, &id, &user.id).await?;
    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
    })?;

    let machine_id = row
        .fly_machine_id
        .ok_or_else(|| ApiError::BadRequest("Hosted runtime has no machine".to_string()))?;

    fly.stop(&machine_id).await?;

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'stopping', stopped_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    let row = fetch_instance(&state, &id).await?;
    Ok(Json(into_response(row)))
}

async fn destroy_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let row = fetch_instance_for_user(&state, &id, &user.id).await?;
    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
    })?;

    if let Some(machine_id) = row.fly_machine_id {
        if let Err(error) = fly.destroy(&machine_id, row.fly_volume_id.as_deref()).await {
            warn!(%id, "Fly destroy returned error, marking instance destroyed anyway: {}", error);
        }
    }

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'destroyed', destroyed_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    if let Some(runtime_id) = row.runtime_device_id {
        sqlx::query(
            "UPDATE runtime_devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(&runtime_id)
        .execute(&state.db)
        .await?;
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn fetch_instance(state: &ApiState, id: &str) -> Result<HostedRuntimeRow, ApiError> {
    sqlx::query_as::<_, HostedRuntimeRow>(
        r#"
        SELECT id, name, region, status, runtime_device_id, cpus, memory_mb,
               created_at, started_at, stopped_at
        FROM hosted_runtime_instances
        WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Hosted runtime not found".to_string()))
}

async fn fetch_instance_for_user(
    state: &ApiState,
    id: &str,
    user_id: &str,
) -> Result<services::HostedInstanceRow, ApiError> {
    sqlx::query_as::<_, services::HostedInstanceRow>(
        "SELECT * FROM hosted_runtime_instances WHERE id = ? AND user_id = ?",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Hosted runtime not found".to_string()))
}

fn into_response(row: HostedRuntimeRow) -> HostedRuntimeResponse {
    HostedRuntimeResponse {
        id: row.id,
        name: row.name,
        region: row.region,
        status: row.status,
        runtime_device_id: row.runtime_device_id,
        cpus: row.cpus,
        memory_mb: row.memory_mb,
        created_at: row.created_at,
        started_at: row.started_at,
        stopped_at: row.stopped_at,
    }
}

fn sha256_hex(value: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(value))
}
