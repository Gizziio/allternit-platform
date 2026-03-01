//! Instance routes

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{ApiError, ApiState};

/// List all instances
pub async fn list_instances(
    State(_state): State<Arc<ApiState>>,
) -> Result<Json<Vec<InstanceResponse>>, ApiError> {
    // Return demo data for now
    let instances = vec![
        InstanceResponse {
            id: Uuid::new_v4(),
            name: "a2r-worker-1".to_string(),
            provider: "hetzner".to_string(),
            region: "fsn1".to_string(),
            status: "running".to_string(),
            public_ip: Some("88.99.123.45".to_string()),
            private_ip: Some("10.0.0.2".to_string()),
            cpu: 34,
            ram: 2.1,
            agents: 12,
            cost_hr: 0.0067,
            last_seen: "1m ago".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
    ];
    
    Ok(Json(instances))
}

/// Get instance by ID
pub async fn get_instance(
    State(_state): State<Arc<ApiState>>,
    Path(_id): Path<Uuid>,
) -> Result<Json<InstanceResponse>, ApiError> {
    Err(ApiError::InstanceNotFound("not implemented".to_string()))
}

/// Restart instance
pub async fn restart_instance(
    State(_state): State<Arc<ApiState>>,
    Path(_id): Path<Uuid>,
) -> Result<Json<InstanceResponse>, ApiError> {
    Err(ApiError::InstanceNotFound("not implemented".to_string()))
}

/// Destroy instance
pub async fn destroy_instance(
    State(_state): State<Arc<ApiState>>,
    Path(_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    Err(ApiError::InstanceNotFound("not implemented".to_string()))
}

#[derive(Debug, Serialize)]
pub struct InstanceResponse {
    pub id: Uuid,
    pub name: String,
    pub provider: String,
    pub region: String,
    pub status: String,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub cpu: u32,
    pub ram: f64,
    pub agents: u32,
    pub cost_hr: f64,
    pub last_seen: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
