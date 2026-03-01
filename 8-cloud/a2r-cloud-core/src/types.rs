//! Common Types
//!
//! Shared types used across all cloud providers.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Cloud region
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub id: String,
    pub name: String,
    pub location: String,
    pub available: bool,
}

/// Instance type (VM size)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceType {
    pub id: String,
    pub name: String,
    pub vcpus: u32,
    pub memory_gb: u32,
    pub storage_gb: u32,
    pub price_monthly: f64,
    pub price_hourly: f64,
}

/// Pricing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingInfo {
    pub currency: String,
    pub instances: Vec<InstancePricing>,
    pub storage: StoragePricing,
    pub network: NetworkPricing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstancePricing {
    pub instance_type: String,
    pub price_monthly: f64,
    pub price_hourly: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoragePricing {
    pub price_per_gb_month: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPricing {
    pub price_per_gb: f64,
    pub free_gb_monthly: u32,
}

/// VM Instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub region: String,
    pub instance_type: String,
    pub status: InstanceStatus,
    pub created_at: DateTime<Utc>,
    pub ssh_key: Option<String>,
}

/// Instance status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstanceStatus {
    Pending,
    Running,
    Stopped,
    Terminated,
    Error,
}

/// Health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub status: String,
    pub checks: Vec<HealthCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub passed: bool,
    pub message: String,
}

/// Deployment status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentStatus {
    pub id: String,
    pub phase: DeploymentPhase,
    pub progress: u8,
    pub message: String,
    pub errors: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Deployment phase
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentPhase {
    Pending,
    Validating,
    Provisioning,
    Installing,
    Configuring,
    HealthChecking,
    Complete,
    Failed,
}
