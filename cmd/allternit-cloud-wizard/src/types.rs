//! Wizard API Types
//!
//! Request and response types for the deployment wizard.

use serde::{Deserialize, Serialize};
use allternit_cloud_core::DeploymentStatus;

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
    /// Always true: rates come from the static table below, not live pricing.
    pub approximate: bool,
}

/// Approximate per-type hourly instance rates in USD. STATIC TABLE — a UX
/// ballpark only, not live pricing; verify against the provider's pricing
/// page before quoting real numbers.
const APPROX_HOURLY_RATES_USD: &[(&str, &str, f64)] = &[
    ("hetzner", "cx11", 0.0060),
    ("hetzner", "cx21", 0.0096),
    ("hetzner", "cx31", 0.0185),
    ("digitalocean", "s-1vcpu-1gb", 0.0089),
    ("digitalocean", "s-1vcpu-2gb", 0.0179),
    ("digitalocean", "s-2vcpu-2gb", 0.0268),
    ("digitalocean", "s-2vcpu-4gb", 0.0357),
];

/// Approximate block-storage rate (USD per GB-month) per provider.
fn approx_storage_rate_usd(provider: &str) -> f64 {
    match provider {
        "digitalocean" => 0.10,
        _ => 0.05, // hetzner volumes
    }
}

/// Average hours in a month, for hourly ↔ monthly conversion.
const HOURS_PER_MONTH: f64 = 730.0;

/// Estimate deployment cost from the static rate table. `None` for unknown
/// provider/instance-type combinations (caller should show "estimate
/// unavailable" rather than a made-up number).
pub fn estimate_cost(provider: &str, instance_type: &str, storage_gb: u32) -> Option<CostEstimate> {
    let instance_hourly = APPROX_HOURLY_RATES_USD
        .iter()
        .find(|(p, t, _)| *p == provider && *t == instance_type)
        .map(|(_, _, r)| *r)?;

    let instance_monthly = instance_hourly * HOURS_PER_MONTH;
    let storage_monthly = approx_storage_rate_usd(provider) * storage_gb as f64;
    let network_monthly = 0.0; // provider transfer allowance assumed sufficient

    Some(CostEstimate {
        instance_monthly,
        instance_hourly,
        storage_monthly,
        network_monthly,
        total_monthly: instance_monthly + storage_monthly + network_monthly,
        total_hourly: instance_hourly + storage_monthly / HOURS_PER_MONTH,
        currency: "USD".to_string(),
        approximate: true,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimate_cost_covers_hetzner_and_do_types() {
        let hetzner = estimate_cost("hetzner", "cx21", 40).unwrap();
        assert!(hetzner.approximate);
        assert_eq!(hetzner.currency, "USD");
        assert_eq!(hetzner.instance_hourly, 0.0096);
        // storage: 40 GB * $0.05/GB-mo
        assert!((hetzner.storage_monthly - 2.0).abs() < 1e-9);
        assert!((hetzner.total_monthly - (0.0096 * 730.0 + 2.0)).abs() < 1e-9);

        let do_estimate = estimate_cost("digitalocean", "s-1vcpu-2gb", 50).unwrap();
        assert!(do_estimate.approximate);
        // storage: 50 GB * $0.10/GB-mo
        assert!((do_estimate.storage_monthly - 5.0).abs() < 1e-9);
        assert!(do_estimate.total_hourly > do_estimate.instance_hourly);
    }

    #[test]
    fn estimate_cost_unknown_type_is_none() {
        assert!(estimate_cost("hetzner", "cx99", 40).is_none());
        assert!(estimate_cost("aws", "t3.small", 40).is_none()); // not in the static table yet
    }
}
