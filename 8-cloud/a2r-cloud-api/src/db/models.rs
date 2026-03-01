//! Database models for cloud deployment

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Deployment status as string (SQLite compatible)
pub type DeploymentStatus = String;

/// Deployment record
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Deployment {
    pub id: String,
    pub provider_id: String,
    pub region_id: String,
    pub instance_type_id: String,
    pub storage_gb: i32,
    pub instance_name: String,
    pub status: DeploymentStatus,
    pub progress: i32,
    pub message: String,
    pub error_message: Option<String>,
    pub instance_id: Option<String>,
    pub instance_ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Deployment event for WebSocket streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentEvent {
    pub deployment_id: Uuid,
    pub event_type: String,
    pub progress: i32,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub data: Option<serde_json::Value>,
}

/// Instance record
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub region_id: String,
    pub instance_type_id: String,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub status: String,
    pub deployment_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_seen: Option<DateTime<Utc>>,
}

/// Provider credential record (encrypted)
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProviderCredential {
    pub id: String,
    pub provider_id: String,
    pub credential_name: String,
    pub encrypted_data: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Audit log record
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub user_id: Option<String>,
    pub details: serde_json::Value,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}
