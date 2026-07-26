//! Instance Management API Routes
//!
//! Provides REST endpoints for managing cloud instances across providers.
//! Supports Hetzner Cloud and AWS (extensible to other providers).

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::{auth::clerk, routes::providers, ApiError, ApiState};

/// Cloud provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CloudProvider {
    Hetzner,
    DigitalOcean,
    Aws,
    /// Box adopted over universal SSH (no API driver)
    Other,
}

impl std::fmt::Display for CloudProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CloudProvider::Hetzner => write!(f, "hetzner"),
            CloudProvider::DigitalOcean => write!(f, "digitalocean"),
            CloudProvider::Aws => write!(f, "aws"),
            CloudProvider::Other => write!(f, "other"),
        }
    }
}

impl std::str::FromStr for CloudProvider {
    type Err = ApiError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "hetzner" => Ok(CloudProvider::Hetzner),
            "digitalocean" => Ok(CloudProvider::DigitalOcean),
            "aws" => Ok(CloudProvider::Aws),
            "other" => Ok(CloudProvider::Other),
            _ => Err(ApiError::BadRequest(format!("Unknown provider: {}", s))),
        }
    }
}

/// Instance status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum InstanceStatus {
    Running,
    Stopped,
    Creating,
    Destroying,
    Error,
}

impl std::fmt::Display for InstanceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstanceStatus::Running => write!(f, "running"),
            InstanceStatus::Stopped => write!(f, "stopped"),
            InstanceStatus::Creating => write!(f, "creating"),
            InstanceStatus::Destroying => write!(f, "destroying"),
            InstanceStatus::Error => write!(f, "error"),
        }
    }
}

/// Cloud instance database model
#[derive(Debug, Clone, sqlx::FromRow, Serialize, Deserialize)]
pub struct CloudInstance {
    pub id: String,
    pub server_id: String,
    pub provider: CloudProvider,
    pub name: String,
    pub region: String,
    pub instance_type: String,
    pub status: InstanceStatus,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub ssh_key: Option<String>,
    pub run_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List all cloud instances
///
/// Returns a list of all cloud instances across all providers.
/// Results are ordered by creation date (newest first).
pub async fn list_instances(
    State(state): State<Arc<ApiState>>,
) -> Result<Json<Vec<InstanceResponse>>, ApiError> {
    info!("Listing all cloud instances");

    let instances = sqlx::query_as::<_, CloudInstance>(
        r#"
        SELECT 
            id, server_id, provider, name, region, instance_type,
            status, public_ip, private_ip, ssh_key, run_id,
            created_at, updated_at
        FROM cloud_instances
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        error!("Database error fetching instances: {}", e);
        ApiError::DatabaseError(e)
    })?;

    debug!("Found {} cloud instances", instances.len());

    let responses: Vec<InstanceResponse> =
        instances.into_iter().map(InstanceResponse::from).collect();

    Ok(Json(responses))
}

/// Get a specific instance by ID
///
/// Returns detailed information about a single cloud instance.
pub async fn get_instance(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<InstanceResponse>, ApiError> {
    info!("Fetching cloud instance: {}", id);

    let instance = sqlx::query_as::<_, CloudInstance>(
        r#"
        SELECT 
            id, server_id, provider, name, region, instance_type,
            status, public_ip, private_ip, ssh_key, run_id,
            created_at, updated_at
        FROM cloud_instances
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        error!("Database error fetching instance {}: {}", id, e);
        ApiError::DatabaseError(e)
    })?;

    match instance {
        Some(instance) => {
            debug!(
                "Found cloud instance: {} (provider: {:?})",
                instance.id, instance.provider
            );
            Ok(Json(InstanceResponse::from(instance)))
        }
        None => {
            warn!("Cloud instance not found: {}", id);
            Err(ApiError::InstanceNotFound(id))
        }
    }
}

/// Restart a cloud instance
///
/// Initiates a restart of the instance through the provider's API.
/// Currently supports Hetzner Cloud (AWS support can be added).
pub async fn restart_instance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<InstanceResponse>, ApiError> {
    info!("Restarting cloud instance: {}", id);

    // Fetch the instance from database
    let instance = sqlx::query_as::<_, CloudInstance>(
        r#"
        SELECT 
            id, server_id, provider, name, region, instance_type,
            status, public_ip, private_ip, ssh_key, run_id,
            created_at, updated_at
        FROM cloud_instances
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        error!("Database error fetching instance {} for restart: {}", id, e);
        ApiError::DatabaseError(e)
    })?;

    let instance = match instance {
        Some(i) => i,
        None => {
            warn!("Cannot restart - instance not found: {}", id);
            return Err(ApiError::InstanceNotFound(id));
        }
    };

    // Check if instance can be restarted
    match instance.status {
        InstanceStatus::Creating | InstanceStatus::Destroying => {
            warn!(
                "Cannot restart instance {} - current status is {:?}",
                id, instance.status
            );
            return Err(ApiError::BadRequest(format!(
                "Cannot restart instance with status: {}",
                instance.status
            )));
        }
        _ => {}
    }

    // Call provider-specific restart (real driver calls)
    restart_via_driver(&state, &headers, &instance).await?;

    // Update status in database
    sqlx::query(
        r#"
        UPDATE cloud_instances 
        SET status = 'running', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        error!(
            "Database error updating instance {} status after restart: {}",
            id, e
        );
        ApiError::DatabaseError(e)
    })?;

    info!("Successfully initiated restart for instance: {}", id);

    // Fetch updated instance
    let updated_instance = sqlx::query_as::<_, CloudInstance>(
        r#"
        SELECT 
            id, server_id, provider, name, region, instance_type,
            status, public_ip, private_ip, ssh_key, run_id,
            created_at, updated_at
        FROM cloud_instances
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        error!("Database error fetching updated instance {}: {}", id, e);
        ApiError::DatabaseError(e)
    })?;

    Ok(Json(InstanceResponse::from(updated_instance)))
}

/// Destroy a cloud instance
///
/// Permanently deletes the instance from the cloud provider.
/// This action is irreversible.
pub async fn destroy_instance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    info!("Destroying cloud instance: {}", id);

    // Fetch the instance from database
    let instance = sqlx::query_as::<_, CloudInstance>(
        r#"
        SELECT
            id, server_id, provider, name, region, instance_type,
            status, public_ip, private_ip, ssh_key, run_id,
            created_at, updated_at
        FROM cloud_instances
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        error!("Database error fetching instance {} for destroy: {}", id, e);
        ApiError::DatabaseError(e)
    })?;

    let instance = match instance {
        Some(i) => i,
        None => {
            warn!("Cannot destroy - instance not found: {}", id);
            return Err(ApiError::InstanceNotFound(id));
        }
    };

    // Check if instance is already being destroyed
    if instance.status == InstanceStatus::Destroying {
        warn!("Instance {} is already being destroyed", id);
        return Err(ApiError::BadRequest(
            "Instance is already being destroyed".to_string(),
        ));
    }

    // Update status to destroying before making API call
    sqlx::query(
        r#"
        UPDATE cloud_instances
        SET status = 'destroying', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        error!(
            "Database error updating instance {} status to destroying: {}",
            id, e
        );
        ApiError::DatabaseError(e)
    })?;

    // Call provider-specific destroy (real driver calls)
    let destroy_result = destroy_via_driver(&state, &headers, &instance).await;

    // Handle destroy result
    match destroy_result {
        Ok(()) => {
            // Delete from database after successful API call
            sqlx::query("DELETE FROM cloud_instances WHERE id = ?")
                .bind(&id)
                .execute(&state.db)
                .await
                .map_err(|e| {
                    error!("Database error deleting instance {}: {}", id, e);
                    ApiError::DatabaseError(e)
                })?;

            info!("Successfully destroyed cloud instance: {}", id);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            // Update status back to error on failure
            sqlx::query(
                r#"
                UPDATE cloud_instances
                SET status = 'error', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                "#,
            )
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|db_err| {
                error!(
                    "Database error updating instance {} status to error: {}",
                    id, db_err
                );
                ApiError::DatabaseError(db_err)
            })?;

            error!("Failed to destroy instance {}: {}", id, e);
            Err(e)
        }
    }
}

/// Resolve the API token for a provider: the Clerk user's stored token
/// (encrypted in `provider_tokens`) wins; the platform-level env var is
/// the fallback for legacy cowork flows that carry no Clerk session.
async fn resolve_provider_token(
    state: &ApiState,
    headers: &HeaderMap,
    provider: CloudProvider,
) -> Result<String, ApiError> {
    let provider_key = provider.to_string();

    if let Ok(user) = clerk::user_from_headers(headers).await {
        if let Some(token) =
            providers::load_provider_token(state, &user.id, &provider_key).await?
        {
            debug!("Using stored {} token for user {}", provider_key, user.id);
            return Ok(token);
        }
    }

    let env_var = match provider {
        CloudProvider::Hetzner => "HETZNER_API_TOKEN",
        CloudProvider::DigitalOcean => "DIGITALOCEAN_API_TOKEN",
        _ => unreachable!("driver-backed providers only"),
    };
    if let Some(token) = std::env::var(env_var).ok().filter(|t| !t.is_empty()) {
        debug!("Using platform {} for {} op", env_var, provider_key);
        return Ok(token);
    }

    Err(ApiError::Unauthorized(format!(
        "no {} credentials - store a token via PUT /api/v1/provider-tokens/{} or set {}",
        provider_key, provider_key, env_var
    )))
}

/// Build the wizard provider driver for an instance, or a 501 pointing at
/// the universal SSH path for providers without an automated driver.
fn driver_for_instance(
    instance: &CloudInstance,
    token: String,
) -> Result<Box<dyn allternit_cloud_wizard::ProviderDriver>, ApiError> {
    let provider = match instance.provider {
        CloudProvider::Hetzner => allternit_cloud_wizard::SupportedProvider::Hetzner,
        CloudProvider::DigitalOcean => allternit_cloud_wizard::SupportedProvider::DigitalOcean,
        other => {
            warn!("No automated driver for {} (instance {})", other, instance.id);
            return Err(ApiError::NotImplemented(format!(
                "no automated driver for {} - manage this box over SSH mode",
                other
            )));
        }
    };
    allternit_cloud_wizard::driver_for(provider, token).ok_or_else(|| {
        ApiError::NotImplemented(format!(
            "no automated driver for {} - manage this box over SSH mode",
            instance.provider
        ))
    })
}

/// Restart an instance through its provider driver.
async fn restart_via_driver(
    state: &ApiState,
    headers: &HeaderMap,
    instance: &CloudInstance,
) -> Result<(), ApiError> {
    // 501 (not unauthorized) for driverless providers.
    let probe = driver_for_instance(instance, String::new())?;
    drop(probe);
    let token = resolve_provider_token(state, headers, instance.provider).await?;
    let driver = driver_for_instance(instance, token)?;

    info!(
        "Restarting {} instance {} (server_id: {})",
        instance.provider, instance.id, instance.server_id
    );
    driver
        .reboot_server(&instance.server_id)
        .await
        .map_err(|e| {
            error!("{} reboot failed for {}: {}", instance.provider, instance.id, e);
            ApiError::Internal(format!("provider reboot failed: {}", e))
        })
}

/// Destroy an instance through its provider driver.
async fn destroy_via_driver(
    state: &ApiState,
    headers: &HeaderMap,
    instance: &CloudInstance,
) -> Result<(), ApiError> {
    let probe = driver_for_instance(instance, String::new())?;
    drop(probe);
    let token = resolve_provider_token(state, headers, instance.provider).await?;
    let driver = driver_for_instance(instance, token)?;

    info!(
        "Destroying {} instance {} (server_id: {})",
        instance.provider, instance.id, instance.server_id
    );
    driver
        .destroy_server(&instance.server_id)
        .await
        .map_err(|e| {
            error!("{} destroy failed for {}: {}", instance.provider, instance.id, e);
            ApiError::Internal(format!("provider destroy failed: {}", e))
        })
}

/// Instance response DTO
#[derive(Debug, Serialize)]
pub struct InstanceResponse {
    pub id: String,
    pub server_id: String,
    pub provider: String,
    pub name: String,
    pub region: String,
    pub instance_type: String,
    pub status: String,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub ssh_key: Option<String>,
    pub run_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CloudInstance> for InstanceResponse {
    fn from(instance: CloudInstance) -> Self {
        Self {
            id: instance.id,
            server_id: instance.server_id,
            provider: instance.provider.to_string(),
            name: instance.name,
            region: instance.region,
            instance_type: instance.instance_type,
            status: instance.status.to_string(),
            public_ip: instance.public_ip,
            private_ip: instance.private_ip,
            ssh_key: instance.ssh_key,
            run_id: instance.run_id,
            created_at: instance.created_at,
            updated_at: instance.updated_at,
        }
    }
}

/// Create instance request (for future use)
#[derive(Debug, Deserialize)]
pub struct CreateInstanceRequest {
    pub name: String,
    pub provider: CloudProvider,
    pub region: String,
    pub instance_type: String,
    pub ssh_key: Option<String>,
    pub run_id: Option<String>,
}

/// Update instance request (for future use)
#[derive(Debug, Deserialize, Default)]
pub struct UpdateInstanceRequest {
    pub name: Option<String>,
    pub status: Option<InstanceStatus>,
}
