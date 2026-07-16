//! Fly.io hosted runtime provisioning service.
//!
//! Creates, starts, stops, and destroys Fly Machines that run the Allternit
//! agent-daemon on behalf of paying users. All traffic flows back through the
//! cloud API relay; the machines have no public services.

use crate::error::ApiError;
use serde_json::json;
use std::time::Duration;
use tracing::info;
use uuid::Uuid;

const FLY_API_BASE: &str = "https://api.machines.dev/v1";
const DEFAULT_IMAGE: &str = "ghcr.io/gizziio/allternit-hosted-runtime:latest";

/// Configuration for a new hosted runtime machine.
#[derive(Debug, Clone)]
pub struct HostedMachineConfig {
    pub region: String,
    pub cpu_kind: String,
    pub cpus: i64,
    pub memory_mb: i64,
    pub volume_size_gb: i64,
    pub env: Vec<(String, String)>,
}

impl Default for HostedMachineConfig {
    fn default() -> Self {
        Self {
            region: std::env::var("FLY_DEFAULT_REGION").unwrap_or_else(|_| "lax".to_string()),
            cpu_kind: "shared".to_string(),
            cpus: 1,
            memory_mb: 1024,
            volume_size_gb: 1,
            env: Vec::new(),
        }
    }
}

/// A provisioned Fly machine record.
#[derive(Debug, Clone)]
pub struct ProvisionedMachine {
    pub app: String,
    pub machine_id: String,
    pub volume_id: Option<String>,
    pub region: String,
    pub private_ip: Option<String>,
}

/// Fly machine status as returned by the Machines API.
#[derive(Debug, Clone)]
pub enum FlyMachineState {
    Created,
    Starting,
    Started,
    Stopping,
    Stopped,
    Destroying,
    Destroyed,
    Other(String),
}

/// Thin wrapper around the Fly Machines API.
#[derive(Debug, Clone)]
pub struct FlyRuntimeService {
    client: reqwest::Client,
    token: String,
    app: String,
    org_slug: String,
    image: String,
}

impl FlyRuntimeService {
    pub fn new(token: String) -> Result<Self, ApiError> {
        let app = std::env::var("FLY_HOSTED_APP")
            .unwrap_or_else(|_| "allternit-hosted-runtimes".to_string());
        let image =
            std::env::var("HOSTED_RUNTIME_IMAGE").unwrap_or_else(|_| DEFAULT_IMAGE.to_string());
        let org_slug = std::env::var("FLY_ORG_SLUG").map_err(|_| {
            ApiError::ServiceUnavailable(
                "FLY_ORG_SLUG is required for hosted runtime provisioning.".to_string(),
            )
        })?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| ApiError::Internal(format!("Failed to build Fly client: {e}")))?;
        Ok(Self {
            client,
            token,
            app,
            org_slug,
            image,
        })
    }

    fn auth(&self) -> String {
        format!("Bearer {}", self.token)
    }

    /// Ensure the target Fly app exists. Creates it if missing.
    pub async fn ensure_app(&self) -> Result<(), ApiError> {
        let url = format!("{}/apps/{}", FLY_API_BASE, self.app);
        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth())
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly API request failed: {e}")))?;

        if response.status().is_success() {
            return Ok(());
        }
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            info!("Creating Fly app for hosted runtimes: {}", self.app);
            let create_url = format!("{}/apps", FLY_API_BASE);
            let body = json!({ "app_name": self.app, "org_slug": self.org_slug });
            let create = self
                .client
                .post(&create_url)
                .header("Authorization", self.auth())
                .json(&body)
                .send()
                .await
                .map_err(|e| ApiError::Internal(format!("Fly app creation failed: {e}")))?;
            let status = create.status();
            if !status.is_success() {
                let text = create.text().await.unwrap_or_default();
                return Err(ApiError::Internal(format!(
                    "Fly app creation returned {}: {}",
                    status, text
                )));
            }
            return Ok(());
        }

        let status = response.status();

        let text = response.text().await.unwrap_or_default();
        Err(ApiError::Internal(format!(
            "Fly app check returned {}: {}",
            status, text
        )))
    }

    /// Provision a new machine, volume, and start it.
    pub async fn provision(
        &self,
        config: &HostedMachineConfig,
        bootstrap_token: &str,
    ) -> Result<ProvisionedMachine, ApiError> {
        self.ensure_app().await?;

        let volume_id = self
            .create_volume(&config.region, config.volume_size_gb)
            .await?;
        let machine_id = match self
            .create_machine(config, &volume_id, bootstrap_token)
            .await
        {
            Ok(machine_id) => machine_id,
            Err(machine_error) => {
                if let Err(cleanup_error) = self.delete_volume(&volume_id).await {
                    return Err(ApiError::Internal(format!(
                        "{machine_error}; cleanup of Fly volume {volume_id} also failed: {cleanup_error}"
                    )));
                }
                return Err(machine_error);
            }
        };

        Ok(ProvisionedMachine {
            app: self.app.clone(),
            machine_id,
            volume_id: Some(volume_id),
            region: config.region.clone(),
            private_ip: None,
        })
    }

    async fn create_volume(&self, region: &str, size_gb: i64) -> Result<String, ApiError> {
        let url = format!("{}/apps/{}/volumes", FLY_API_BASE, self.app);
        let body = json!({
            "name": format!("allternit-hosted-data-{}", Uuid::new_v4().simple()),
            "region": region,
            "size_gb": size_gb,
            "encrypted": true
        });
        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth())
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly volume creation failed: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fly volume creation returned {}: {}",
                status, text
            )));
        }

        let payload: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ApiError::Internal(format!("Invalid Fly volume response: {e}")))?;
        let id = payload["id"]
            .as_str()
            .ok_or_else(|| ApiError::Internal("Fly volume response missing id".to_string()))?;
        Ok(id.to_string())
    }

    async fn delete_volume(&self, volume_id: &str) -> Result<(), ApiError> {
        let url = format!("{}/apps/{}/volumes/{}", FLY_API_BASE, self.app, volume_id);
        let response = self
            .client
            .delete(&url)
            .header("Authorization", self.auth())
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly volume destroy failed: {e}")))?;
        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(());
        }
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(ApiError::Internal(format!(
            "Fly volume destroy returned {}: {}",
            status, text
        )))
    }

    async fn create_machine(
        &self,
        config: &HostedMachineConfig,
        volume_id: &str,
        bootstrap_token: &str,
    ) -> Result<String, ApiError> {
        let url = format!("{}/apps/{}/machines", FLY_API_BASE, self.app);
        let cloud_api_url = std::env::var("ALLTERNIT_CLOUD_API_URL")
            .unwrap_or_else(|_| "https://allternit-cloud-api.fly.dev".to_string());

        let mut env = serde_json::Map::new();
        env.insert("ALLTERNIT_CLOUD_API_URL".to_string(), json!(cloud_api_url));
        env.insert("ALLTERNIT_PAIRING_MODE".to_string(), json!("hosted_auto"));
        env.insert(
            "ALLTERNIT_HOSTED_BOOTSTRAP_TOKEN".to_string(),
            json!(bootstrap_token),
        );
        env.insert(
            "ALLTERNIT_RUNTIME_NAME".to_string(),
            json!(format!("Allternit Hosted ({})", config.region)),
        );
        for (key, value) in &config.env {
            env.insert(key.clone(), json!(value));
        }

        let body = json!({
            "region": config.region,
            "config": {
                "image": self.image,
                "guest": {
                    "cpu_kind": config.cpu_kind,
                    "cpus": config.cpus,
                    "memory_mb": config.memory_mb
                },
                "env": env,
                "mounts": [{
                    "volume": volume_id,
                    "path": "/data"
                }],
                "services": [],
                "auto_destroy": false,
                "restart": { "policy": "on-failure", "max_retries": 10 }
            }
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", self.auth())
            .json(&body)
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly machine creation failed: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fly machine creation returned {}: {}",
                status, text
            )));
        }

        let payload: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ApiError::Internal(format!("Invalid Fly machine response: {e}")))?;
        let id = payload["id"]
            .as_str()
            .ok_or_else(|| ApiError::Internal("Fly machine response missing id".to_string()))?;
        Ok(id.to_string())
    }

    /// Start a stopped machine.
    pub async fn start(&self, machine_id: &str) -> Result<(), ApiError> {
        let url = format!(
            "{}/apps/{}/machines/{}/start",
            FLY_API_BASE, self.app, machine_id
        );
        self.send_empty_post(&url).await
    }

    /// Stop a running machine.
    pub async fn stop(&self, machine_id: &str) -> Result<(), ApiError> {
        let url = format!(
            "{}/apps/{}/machines/{}/stop",
            FLY_API_BASE, self.app, machine_id
        );
        self.send_empty_post(&url).await
    }

    /// Destroy a machine and its volume.
    pub async fn destroy(&self, machine_id: &str, volume_id: Option<&str>) -> Result<(), ApiError> {
        let url = format!(
            "{}/apps/{}/machines/{}?force=true",
            FLY_API_BASE, self.app, machine_id
        );
        let response = self
            .client
            .delete(&url)
            .header("Authorization", self.auth())
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly machine destroy failed: {e}")))?;
        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fly machine destroy returned {}: {}",
                status, text
            )));
        }

        if let Some(volume_id) = volume_id {
            self.delete_volume(volume_id).await?;
        }
        Ok(())
    }

    /// Get current machine status from Fly.
    pub async fn status(&self, machine_id: &str) -> Result<FlyMachineState, ApiError> {
        let url = format!("{}/apps/{}/machines/{}", FLY_API_BASE, self.app, machine_id);
        let response = self
            .client
            .get(&url)
            .header("Authorization", self.auth())
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly machine status failed: {e}")))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fly machine status returned {}: {}",
                status, text
            )));
        }
        let payload: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ApiError::Internal(format!("Invalid Fly status response: {e}")))?;
        let state = payload["state"]
            .as_str()
            .ok_or_else(|| ApiError::Internal("Fly status response missing state".to_string()))?;
        Ok(match state {
            "created" => FlyMachineState::Created,
            "starting" => FlyMachineState::Starting,
            "started" => FlyMachineState::Started,
            "stopping" => FlyMachineState::Stopping,
            "stopped" => FlyMachineState::Stopped,
            "destroying" => FlyMachineState::Destroying,
            "destroyed" => FlyMachineState::Destroyed,
            other => FlyMachineState::Other(other.to_string()),
        })
    }

    async fn send_empty_post(&self, url: &str) -> Result<(), ApiError> {
        let response = self
            .client
            .post(url)
            .header("Authorization", self.auth())
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("Fly API request failed: {e}")))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ApiError::Internal(format!(
                "Fly API returned {}: {}",
                status, text
            )));
        }
        Ok(())
    }
}

/// Stored instance of a hosted runtime with its Fly identifiers.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct HostedInstanceRow {
    pub id: String,
    pub user_id: String,
    pub organization_id: Option<String>,
    pub name: String,
    pub runtime_device_id: Option<String>,
    pub billing_mode: String,
    pub fly_app: Option<String>,
    pub fly_machine_id: Option<String>,
    pub fly_volume_id: Option<String>,
    pub region: String,
    pub cpu_kind: String,
    pub cpus: i64,
    pub memory_mb: i64,
    pub status: String,
    pub idle_timeout_minutes: i64,
    pub last_activity_at: Option<chrono::DateTime<chrono::Utc>>,
    pub active_since: Option<chrono::DateTime<chrono::Utc>>,
    pub stop_reason: Option<String>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub stopped_at: Option<chrono::DateTime<chrono::Utc>>,
    pub destroyed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub monthly_cost_cap: Option<f64>,
    pub cost_rate_provider: Option<String>,
    pub cost_rate_region: Option<String>,
    pub cost_rate_instance_type: Option<String>,
    pub last_synced_at: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
