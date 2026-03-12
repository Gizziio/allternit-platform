//! Deployment routes

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;
use tracing::{info, error, warn};

use crate::{ApiError, ApiState, Deployment, DeploymentEvent};

/// Deployment mode
#[derive(Debug, serde::Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentMode {
    /// We create VPS via provider API
    Automated {
        api_token: String,
    },
    /// User already has VPS, we install via SSH
    Manual {
        ssh_host: String,
        ssh_port: u16,
        ssh_username: String,
        ssh_private_key: String,
    },
}

impl Default for DeploymentMode {
    fn default() -> Self {
        DeploymentMode::Manual {
            ssh_host: String::new(),
            ssh_port: 22,
            ssh_username: "root".to_string(),
            ssh_private_key: String::new(),
        }
    }
}

/// Create deployment request
#[derive(Debug, serde::Deserialize)]
pub struct CreateDeploymentRequest {
    pub provider_id: String,
    pub region_id: String,
    pub instance_type_id: String,
    pub storage_gb: i32,
    pub instance_name: String,
    #[serde(default)]
    pub mode: DeploymentMode,
}

/// Deployment response
#[derive(Debug, serde::Serialize)]
pub struct DeploymentResponse {
    pub deployment_id: String,
    pub provider_id: String,
    pub region_id: String,
    pub instance_type_id: String,
    pub storage_gb: i32,
    pub instance_name: String,
    pub status: String,
    pub progress: i32,
    pub message: String,
    pub error_message: Option<String>,
    pub instance_id: Option<String>,
    pub instance_ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

use chrono::DateTime;

impl From<Deployment> for DeploymentResponse {
    fn from(deployment: Deployment) -> Self {
        Self {
            deployment_id: deployment.id,
            provider_id: deployment.provider_id,
            region_id: deployment.region_id,
            instance_type_id: deployment.instance_type_id,
            storage_gb: deployment.storage_gb,
            instance_name: deployment.instance_name,
            status: deployment.status,
            progress: deployment.progress,
            message: deployment.message,
            error_message: deployment.error_message,
            instance_id: deployment.instance_id,
            instance_ip: deployment.instance_ip,
            created_at: deployment.created_at,
            updated_at: deployment.updated_at,
            completed_at: deployment.completed_at,
        }
    }
}

/// Create a new deployment

pub async fn create_deployment(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<CreateDeploymentRequest>,
) -> Result<Json<DeploymentResponse>, ApiError> {
    tracing::info!("Creating deployment for provider: {}", request.provider_id);
    
    let deployment_id = Uuid::new_v4().to_string();
    
    // Create deployment record
    let deployment = sqlx::query_as::<_, Deployment>(
        r#"
        INSERT INTO deployments (
            id, provider_id, region_id, instance_type_id, storage_gb,
            instance_name, status, progress, message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&deployment_id)
    .bind(&request.provider_id)
    .bind(&request.region_id)
    .bind(&request.instance_type_id)
    .bind(request.storage_gb)
    .bind(&request.instance_name)
    .bind("pending")
    .bind(0)
    .bind("Initializing deployment")
    .bind(Utc::now())
    .bind(Utc::now())
    .fetch_one(&state.db)
    .await?;
    
    // Broadcast deployment started event
    let event = DeploymentEvent {
        deployment_id: Uuid::parse_str(&deployment_id).unwrap_or_default(),
        event_type: "deployment_started".to_string(),
        progress: 0,
        message: "Deployment initialized".to_string(),
        timestamp: Utc::now(),
        data: None,
    };
    let _ = state.event_tx.send(event);
    
    // Start deployment in background
    let state_for_spawn = state.clone();
    let deployment_id_clone = deployment_id.clone();
    tokio::spawn(async move {
        if let Err(e) = run_deployment(state_for_spawn, &deployment_id_clone, request).await {
            tracing::error!("Deployment failed: {}", e);
            let _ = sqlx::query(
                "UPDATE deployments SET status = ?, error_message = ?, updated_at = ? WHERE id = ?"
            )
            .bind("failed")
            .bind(&e.to_string())
            .bind(Utc::now())
            .bind(&deployment_id_clone)
            .execute(&state.db)
            .await;
        }
    });
    
    Ok(Json(DeploymentResponse::from(deployment)))
}

/// List all deployments
pub async fn list_deployments(
    State(state): State<Arc<ApiState>>,
) -> Result<Json<Vec<DeploymentResponse>>, ApiError> {
    let deployments = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments ORDER BY created_at DESC LIMIT 100"
    )
    .fetch_all(&state.db)
    .await?;
    
    Ok(Json(deployments.into_iter().map(Into::into).collect()))
}

/// Get deployment by ID
pub async fn get_deployment(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<DeploymentResponse>, ApiError> {
    let deployment = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::DeploymentNotFound(id))?;
    
    Ok(Json(DeploymentResponse::from(deployment)))
}

/// Cancel deployment
pub async fn cancel_deployment(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<DeploymentResponse>, ApiError> {
    let result = sqlx::query(
        "UPDATE deployments SET status = ?, updated_at = ?, completed_at = ? WHERE id = ? AND status IN (?, ?)"
    )
    .bind("cancelled")
    .bind(Utc::now())
    .bind(Utc::now())
    .bind(&id)
    .bind("pending")
    .bind("provisioning")
    .execute(&state.db)
    .await?;
    
    if result.rows_affected() == 0 {
        return Err(ApiError::DeploymentNotFound(id));
    }
    
    // Broadcast cancellation event
    let event = DeploymentEvent {
        deployment_id: Uuid::parse_str(&id).unwrap_or_default(),
        event_type: "deployment_cancelled".to_string(),
        progress: 0,
        message: "Deployment cancelled by user".to_string(),
        timestamp: Utc::now(),
        data: None,
    };
    let _ = state.event_tx.send(event);
    
    let deployment = sqlx::query_as::<_, Deployment>(
        "SELECT * FROM deployments WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await?;
    
    Ok(Json(DeploymentResponse::from(deployment)))
}

/// Run deployment process (background task)
async fn run_deployment(
    state: Arc<ApiState>,
    deployment_id: &str,
    request: CreateDeploymentRequest,
) -> Result<(), ApiError> {
    // Update to provisioning status
    update_deployment_status(&state, deployment_id, "provisioning", 10, "Creating VM instance")
        .await?;

    match request.mode {
        DeploymentMode::Automated { ref api_token } => {
            run_automated_deployment(&state, deployment_id, &request, api_token).await
        }
        DeploymentMode::Manual { ref ssh_host, ssh_port, ref ssh_username, ref ssh_private_key } => {
            run_manual_deployment(&state, deployment_id, ssh_host, ssh_port, ssh_username, ssh_private_key).await
        }
    }
}

/// Run automated deployment (we create VPS)
async fn run_automated_deployment(
    state: &ApiState,
    deployment_id: &str,
    request: &CreateDeploymentRequest,
    api_token: &str,
) -> Result<(), ApiError> {
    if api_token.is_empty() {
        update_deployment_status(state, deployment_id, "failed", 0, "API token required for automated deployment")
            .await?;
        return Err(ApiError::InvalidCredentials("API token is empty".to_string()));
    }

    // Create Hetzner provider
    let provider = a2r_cloud_hetzner::HetznerProvider::new(api_token);

    // Validate credentials
    match provider.validate_credentials().await {
        Ok(true) => info!("Hetzner credentials validated"),
        Ok(false) => {
            update_deployment_status(state, deployment_id, "failed", 0, "Invalid Hetzner credentials")
                .await?;
            return Err(ApiError::InvalidCredentials("Hetzner API token invalid".to_string()));
        }
        Err(e) => {
            update_deployment_status(state, deployment_id, "failed", 0, &format!("Credential validation failed: {}", e))
                .await?;
            return Err(ApiError::Internal(format!("Credential validation failed: {}", e)));
        }
    }

    // Create deployment config
    let deploy_config = a2r_cloud_hetzner::DeploymentConfig {
        instance_name: request.instance_name.clone(),
        instance_type_id: request.instance_type_id.clone(),
        region_id: request.region_id.clone(),
        storage_gb: request.storage_gb,
        control_plane_url: std::env::var("CONTROL_PLANE_URL")
            .unwrap_or_else(|_| "wss://console.a2r.sh".to_string()),
        deployment_token: deployment_id.to_string(),
    };

    // Deploy to Hetzner
    update_deployment_status(state, deployment_id, "provisioning", 30, "Provisioning VM on Hetzner Cloud")
        .await?;

    match provider.deploy(&deploy_config).await {
        Ok(result) => {
            info!("Deployment successful: {} ({})", result.server_name, result.instance_ip);
            
            update_deployment_status(state, deployment_id, "installing", 60, "A2R runtime installed")
                .await?;
            
            update_deployment_status(state, deployment_id, "complete", 100, "Deployment complete")
                .await?;

            info!("Instance IP: {}", result.instance_ip);
        }
        Err(e) => {
            error!("Deployment failed: {}", e);
            update_deployment_status(state, deployment_id, "failed", 0, &format!("Deployment failed: {}", e))
                .await?;
            return Err(ApiError::DeploymentFailed(e.to_string()));
        }
    }

    Ok(())
}

/// Run manual deployment (user already has VPS)
async fn run_manual_deployment(
    state: &ApiState,
    deployment_id: &str,
    ssh_host: &str,
    ssh_port: u16,
    ssh_username: &str,
    ssh_private_key: &str,
) -> Result<(), ApiError> {
    info!("Starting manual deployment to {}:{}", ssh_host, ssh_port);

    // Test SSH connection first
    let ssh_executor = a2r_cloud_ssh::SshExecutor::new();
    
    update_deployment_status(state, deployment_id, "provisioning", 20, "Testing SSH connection")
        .await?;

    match ssh_executor.test_connection(ssh_host, ssh_port, ssh_username, ssh_private_key).await {
        Ok(true) => info!("SSH connection successful"),
        Ok(false) => {
            update_deployment_status(state, deployment_id, "failed", 0, "SSH connection failed")
                .await?;
            return Err(ApiError::InvalidCredentials("SSH connection test failed".to_string()));
        }
        Err(e) => {
            update_deployment_status(state, deployment_id, "failed", 0, &format!("SSH connection error: {}", e))
                .await?;
            return Err(ApiError::DeploymentFailed(format!("SSH connection error: {}", e)));
        }
    }

    // Install A2R runtime
    update_deployment_status(state, deployment_id, "installing", 50, "Installing A2R runtime")
        .await?;

    let control_plane_url = std::env::var("CONTROL_PLANE_URL")
        .unwrap_or_else(|_| "wss://console.a2r.sh".to_string());

    match ssh_executor.install_a2r_runtime(
        ssh_host,
        ssh_port,
        ssh_username,
        ssh_private_key,
        &control_plane_url,
        deployment_id,
    ).await {
        Ok(output) => {
            info!("A2R runtime installed successfully");
            info!("Installation output: {}", output.stdout);
            
            update_deployment_status(state, deployment_id, "complete", 100, "Deployment complete")
                .await?;
        }
        Err(e) => {
            error!("A2R installation failed: {}", e);
            update_deployment_status(state, deployment_id, "failed", 0, &format!("Installation failed: {}", e))
                .await?;
            return Err(ApiError::DeploymentFailed(e.to_string()));
        }
    }

    Ok(())
}

/// Helper to update deployment status and broadcast event
async fn update_deployment_status(
    state: &ApiState,
    deployment_id: &str,
    status: &str,
    progress: i32,
    message: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        "UPDATE deployments SET status = ?, progress = ?, message = ?, updated_at = ? WHERE id = ?"
    )
    .bind(status)
    .bind(progress)
    .bind(message)
    .bind(Utc::now())
    .bind(deployment_id)
    .execute(&state.db)
    .await?;
    
    // Broadcast event
    let event = DeploymentEvent {
        deployment_id: Uuid::parse_str(deployment_id).unwrap_or_default(),
        event_type: "progress_update".to_string(),
        progress,
        message: message.to_string(),
        timestamp: Utc::now(),
        data: Some(serde_json::json!({
            "status": status
        })),
    };
    let _ = state.event_tx.send(event);
    
    Ok(())
}
