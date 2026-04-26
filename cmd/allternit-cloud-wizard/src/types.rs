//! Wizard API Types
//!
//! Request and response types for the deployment wizard.

use serde::{Deserialize, Serialize};
use allternit_cloud_core::{Region, InstanceType, PricingInfo, DeploymentStatus};

/// Wizard step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardStep {
    pub step_number: u32,
    pub step_name: String,
    pub title: String,
    pub description: String,
    pub data: serde_json::Value,
}

/// Provider info for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub logo_url: String,
    pub starting_price: f64,
    pub regions_count: u32,
}

/// Deployment type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentType {
    /// Self-host (BYOC)
    SelfHost,
    /// Managed hosting
    Managed,
    /// Partnership (VPS bundle)
    Partnership,
}

/// Wizard configuration request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardConfigRequest {
    pub deployment_type: DeploymentType,
    pub provider_id: String,
    pub region_id: String,
    pub instance_type_id: String,
    pub storage_gb: u32,
    pub instance_name: String,
}

/// Cost estimate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimate {
    pub instance_monthly: f64,
    pub instance_hourly: f64,
    pub storage_monthly: f64,
    pub network_monthly: f64,
    pub total_monthly: f64,
    pub total_hourly: f64,
    pub currency: String,
}

/// Deployment start request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartDeploymentRequest {
    pub config: WizardConfigRequest,
    pub credentials: ProviderCredentials,
}

/// Provider credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredentials {
    pub api_key: String,
    pub api_secret: String,
    pub endpoint: Option<String>,
}

/// Deployment start response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartDeploymentResponse {
    pub deployment_id: String,
    pub status: DeploymentStatus,
    pub estimated_time_minutes: u32,
}

/// Deployment status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentStatusResponse {
    pub deployment_id: String,
    pub phase: String,
    pub progress: u8,
    pub message: String,
    pub errors: Vec<String>,
    pub instance_ip: Option<String>,
    pub access_url: Option<String>,
}

/// Wizard progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WizardProgress {
    pub current_step: u32,
    pub total_steps: u32,
    pub completed_steps: Vec<u32>,
    pub can_proceed: bool,
}

/// Instance request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceRequest {
    pub provider_id: String,
    pub region_id: String,
}
