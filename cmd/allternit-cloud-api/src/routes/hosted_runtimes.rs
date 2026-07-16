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
use tracing::{error, info};
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
    idle_timeout_minutes: i64,
    last_activity_at: Option<DateTime<Utc>>,
    stop_reason: Option<String>,
    monthly_usage_seconds: i64,
    monthly_estimated_cost_usd: f64,
    created_at: DateTime<Utc>,
    started_at: Option<DateTime<Utc>>,
    stopped_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct HostedRuntimeRow {
    id: String,
    user_id: String,
    name: String,
    region: String,
    status: String,
    runtime_device_id: Option<String>,
    cpus: i64,
    memory_mb: i64,
    idle_timeout_minutes: i64,
    last_activity_at: Option<DateTime<Utc>>,
    stop_reason: Option<String>,
    created_at: DateTime<Utc>,
    started_at: Option<DateTime<Utc>>,
    stopped_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostedRuntimeEntitlementResponse {
    plan_tier_id: String,
    plan_display_name: String,
    can_create_hosted_runtime: bool,
    max_hosted_runtimes: i64,
    max_memory_mb: i64,
    max_hours_monthly: i64,
    used_seconds_monthly: i64,
    remaining_seconds_monthly: i64,
    estimated_cost_usd_monthly: f64,
    active_instances: i64,
    idle_timeout_minutes: i64,
    upgrade_url: String,
    billing_portal_url: String,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/hosted-runtimes", get(list_hosted_runtimes))
        .route("/api/v1/hosted-runtimes", post(create_hosted_runtime))
        .route(
            "/api/v1/hosted-runtimes/entitlement",
            get(hosted_runtime_entitlement),
        )
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
    ensure_cloud_user(&state, &user).await?;
    let rows = sqlx::query_as::<_, HostedRuntimeRow>(
        r#"
        SELECT id, user_id, name, region, status, runtime_device_id, cpus, memory_mb,
               idle_timeout_minutes, last_activity_at, stop_reason,
               created_at, started_at, stopped_at
        FROM hosted_runtime_instances
        WHERE user_id = ? AND status != 'destroyed'
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| into_response(row, &usage))
            .collect(),
    ))
}

async fn create_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(request): Json<CreateHostedRuntimeRequest>,
) -> Result<(StatusCode, Json<HostedRuntimeResponse>), ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    ensure_cloud_user(&state, &user).await?;
    let quota = state.quota_service.ensure_quota(&user.id).await?;

    state
        .quota_service
        .check_hosted_runtime_creation(&user.id, &quota, request.memory_mb)
        .await?;
    state
        .quota_service
        .check_spend_cap(&user.id, &quota)
        .await?;
    validate_region(&request.region)?;

    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable(
            "Hosted runtimes are not configured. Set FLY_API_TOKEN.".to_string(),
        )
    })?;

    let instance_id = format!("hr_{}", Uuid::new_v4().simple());
    let name = request
        .name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Allternit Hosted ({})", request.region));
    if name.len() > 80 {
        return Err(ApiError::BadRequest(
            "Hosted runtime name must be 80 characters or fewer.".to_string(),
        ));
    }
    let bootstrap_token = crate::routes::runtime_pairing::random_secret(BOOTSTRAP_TOKEN_BYTES);
    let bootstrap_hash = sha256_hex(bootstrap_token.as_bytes());
    let cpus = 1_i64;
    let cpu_kind = "shared".to_string();
    let cost_rate_instance_type = format!("shared-cpu-{}x-{}mb", cpus, request.memory_mb);
    let idle_timeout_minutes = hosted_idle_timeout_minutes();

    let reservation = sqlx::query(
        r#"
        INSERT INTO hosted_runtime_instances (
            id, user_id, organization_id, name, region, cpu_kind, cpus, memory_mb,
            status, bootstrap_token_hash, billing_mode, cost_rate_provider,
            cost_rate_region, cost_rate_instance_type, idle_timeout_minutes,
            last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'creating', ?, 'allternit', 'fly', ?, ?, ?, CURRENT_TIMESTAMP)
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
    .bind(idle_timeout_minutes)
    .execute(&state.db)
    .await;
    if let Err(error) = reservation {
        let message = error.to_string();
        if message.contains("hosted_runtime_entitlement_required")
            || message.contains("hosted_runtime_memory_limit")
            || message.contains("hosted_runtime_instance_limit")
        {
            return Err(ApiError::Forbidden(
                "Hosted runtime plan limit reached. Refresh your entitlement and try again."
                    .to_string(),
            ));
        }
        return Err(error.into());
    }

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
            started_at = CURRENT_TIMESTAMP, active_since = CURRENT_TIMESTAMP,
            last_activity_at = CURRENT_TIMESTAMP, stop_reason = NULL
        WHERE id = ?
        "#,
    )
    .bind(&provisioned.app)
    .bind(&provisioned.machine_id)
    .bind(provisioned.volume_id.as_deref())
    .bind(&instance_id)
    .execute(&state.db)
    .await?;
    services::record_runtime_started(&state.db, &instance_id).await?;

    info!(%instance_id, machine_id = %provisioned.machine_id, "Hosted runtime provisioned");

    let row = fetch_instance(&state, &instance_id).await?;
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    Ok((StatusCode::CREATED, Json(into_response(row, &usage))))
}

async fn start_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<HostedRuntimeResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    ensure_cloud_user(&state, &user).await?;
    let quota = state.quota_service.ensure_quota(&user.id).await?;
    if !state.quota_service.can_create_hosted_runtime(&quota) {
        return Err(ApiError::Forbidden(
            "Your current plan does not include hosted runtime starts.".to_string(),
        ));
    }
    state
        .quota_service
        .check_hosted_runtime_hours(&user.id, &quota)
        .await?;
    state
        .quota_service
        .check_spend_cap(&user.id, &quota)
        .await?;
    let row = fetch_instance_for_user(&state, &id, &user.id).await?;
    let instance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM hosted_runtime_instances WHERE user_id = ? AND status NOT IN ('destroying', 'destroyed')",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await?;
    if row.memory_mb > quota.max_hosted_runtime_memory_mb
        || instance_count > quota.max_hosted_runtimes
    {
        return Err(ApiError::Forbidden(
            "This runtime exceeds your current plan limits. Destroy excess or oversized runtimes before starting it."
                .to_string(),
        ));
    }
    if matches!(row.status.as_str(), "running" | "starting") {
        let response_row = fetch_instance(&state, &id).await?;
        let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
        return Ok(Json(into_response(response_row, &usage)));
    }
    if matches!(row.status.as_str(), "destroying" | "destroyed") {
        return Err(ApiError::BadRequest(
            "A destroyed hosted runtime cannot be started.".to_string(),
        ));
    }
    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
    })?;

    let machine_id = row
        .fly_machine_id
        .ok_or_else(|| ApiError::BadRequest("Hosted runtime has no machine".to_string()))?;

    fly.start(&machine_id).await?;

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'starting', started_at = CURRENT_TIMESTAMP, stopped_at = NULL, active_since = CURRENT_TIMESTAMP, last_activity_at = CURRENT_TIMESTAMP, stop_reason = NULL WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;
    services::record_runtime_started(&state.db, &id).await?;

    let row = fetch_instance(&state, &id).await?;
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    Ok(Json(into_response(row, &usage)))
}

async fn stop_hosted_runtime(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<HostedRuntimeResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let row = fetch_instance_for_user(&state, &id, &user.id).await?;
    if row.status == "stopped" {
        let response_row = fetch_instance(&state, &id).await?;
        let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
        return Ok(Json(into_response(response_row, &usage)));
    }
    let fly = state.fly_runtime_service.as_ref().ok_or_else(|| {
        ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
    })?;

    let machine_id = row
        .fly_machine_id
        .ok_or_else(|| ApiError::BadRequest("Hosted runtime has no machine".to_string()))?;

    fly.stop(&machine_id).await?;

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'stopped', stopped_at = CURRENT_TIMESTAMP, active_since = NULL, stop_reason = 'user_stopped' WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;
    services::record_runtime_stopped(&state.db, &id, "user_stopped").await?;

    let row = fetch_instance(&state, &id).await?;
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    Ok(Json(into_response(row, &usage)))
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
        fly.destroy(&machine_id, row.fly_volume_id.as_deref())
            .await?;
    }

    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'destroyed', destroyed_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;
    services::record_runtime_stopped(&state.db, &id, "destroyed").await?;

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
        SELECT id, user_id, name, region, status, runtime_device_id, cpus, memory_mb,
               idle_timeout_minutes, last_activity_at, stop_reason,
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

fn into_response(
    row: HostedRuntimeRow,
    usage: &services::HostedUsageSummary,
) -> HostedRuntimeResponse {
    HostedRuntimeResponse {
        id: row.id,
        name: row.name,
        region: row.region,
        status: row.status,
        runtime_device_id: row.runtime_device_id,
        cpus: row.cpus,
        memory_mb: row.memory_mb,
        idle_timeout_minutes: row.idle_timeout_minutes,
        last_activity_at: row.last_activity_at,
        stop_reason: row.stop_reason,
        monthly_usage_seconds: usage.total_seconds,
        monthly_estimated_cost_usd: usage.estimated_cost_usd,
        created_at: row.created_at,
        started_at: row.started_at,
        stopped_at: row.stopped_at,
    }
}

async fn hosted_runtime_entitlement(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<HostedRuntimeEntitlementResponse>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    ensure_cloud_user(&state, &user).await?;
    let quota = state.quota_service.ensure_quota(&user.id).await?;
    let usage = services::hosted_usage_summary(&state.db, &user.id).await?;
    let active_instances: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM hosted_runtime_instances WHERE user_id = ? AND status NOT IN ('destroying', 'destroyed')",
    )
    .bind(&user.id)
    .fetch_one(&state.db)
    .await?;
    let display_name: String =
        sqlx::query_scalar("SELECT display_name FROM plan_tiers WHERE id = ?")
            .bind(&quota.plan_tier_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or_else(|| quota.plan_tier_id.clone());
    let max_seconds = quota.max_hosted_runtime_hours_monthly.max(0) * 3600;

    Ok(Json(HostedRuntimeEntitlementResponse {
        plan_tier_id: quota.plan_tier_id,
        plan_display_name: display_name,
        can_create_hosted_runtime: quota.can_create_hosted_runtime,
        max_hosted_runtimes: quota.max_hosted_runtimes,
        max_memory_mb: quota.max_hosted_runtime_memory_mb,
        max_hours_monthly: quota.max_hosted_runtime_hours_monthly,
        used_seconds_monthly: usage.total_seconds,
        remaining_seconds_monthly: (max_seconds - usage.total_seconds).max(0),
        estimated_cost_usd_monthly: usage.estimated_cost_usd,
        active_instances,
        idle_timeout_minutes: hosted_idle_timeout_minutes(),
        upgrade_url: std::env::var("ALLTERNIT_HOSTED_UPGRADE_URL")
            .unwrap_or_else(|_| "https://billing.allternit.com/hosted-compute".to_string()),
        billing_portal_url: std::env::var("ALLTERNIT_BILLING_PORTAL_URL")
            .unwrap_or_else(|_| "https://billing.allternit.com".to_string()),
    }))
}

async fn ensure_cloud_user(state: &ApiState, user: &clerk::ClerkUser) -> Result<(), ApiError> {
    let email = user
        .email
        .clone()
        .unwrap_or_else(|| format!("{}@users.allternit.local", user.id));
    sqlx::query(
        r#"
        INSERT INTO users (id, email, name, avatar_url, status, last_login_at)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            name = COALESCE(excluded.name, users.name),
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            status = 'active',
            last_login_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&user.id)
    .bind(email)
    .bind(user.name.as_deref())
    .bind(user.image_url.as_deref())
    .execute(&state.db)
    .await?;
    Ok(())
}

fn hosted_idle_timeout_minutes() -> i64 {
    std::env::var("HOSTED_RUNTIME_IDLE_TIMEOUT_MINUTES")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|value| *value >= 5)
        .unwrap_or(15)
}

fn validate_region(region: &str) -> Result<(), ApiError> {
    let allowed = std::env::var("FLY_HOSTED_ALLOWED_REGIONS")
        .unwrap_or_else(|_| default_region())
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if !allowed
        .iter()
        .any(|allowed_region| allowed_region == region)
    {
        return Err(ApiError::BadRequest(format!(
            "Hosted runtime region is not allowed. Choose one of: {}",
            allowed.join(", ")
        )));
    }
    Ok(())
}

fn sha256_hex(value: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(value))
}
