//! Provider routes

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;
use serde::{Deserialize, Serialize};

use crate::{ApiError, ApiState};

/// List all providers
pub async fn list_providers(
    _state: State<Arc<ApiState>>,
) -> Result<Json<Vec<ProviderResponse>>, ApiError> {
    // Return static list of providers
    let providers = vec![
        ProviderResponse {
            id: "hetzner".to_string(),
            name: "Hetzner Cloud".to_string(),
            automated: true,
        },
        ProviderResponse {
            id: "digitalocean".to_string(),
            name: "DigitalOcean".to_string(),
            automated: true,
        },
        ProviderResponse {
            id: "aws".to_string(),
            name: "Amazon Web Services".to_string(),
            automated: true,
        },
        ProviderResponse {
            id: "contabo".to_string(),
            name: "Contabo".to_string(),
            automated: false,
        },
        ProviderResponse {
            id: "racknerd".to_string(),
            name: "RackNerd".to_string(),
            automated: false,
        },
    ];
    
    Ok(Json(providers))
}

/// Validate provider credentials
pub async fn validate_credentials(
    State(_state): State<Arc<ApiState>>,
    Path(provider_id): Path<String>,
    Json(request): Json<ValidateCredentialsRequest>,
) -> Result<Json<ValidateCredentialsResponse>, ApiError> {
    // In production, actually validate with provider API
    // For now, just check if credentials are non-empty
    
    let valid = !request.api_key.is_empty() && !request.api_secret.is_empty();
    
    Ok(Json(ValidateCredentialsResponse {
        provider_id,
        valid,
        message: if valid {
            "Credentials validated successfully".to_string()
        } else {
            "Invalid credentials".to_string()
        },
    }))
}

#[derive(Debug, Serialize)]
pub struct ProviderResponse {
    pub id: String,
    pub name: String,
    pub automated: bool,
}

#[derive(Debug, Deserialize)]
pub struct ValidateCredentialsRequest {
    pub api_key: String,
    pub api_secret: String,
}

#[derive(Debug, Serialize)]
pub struct ValidateCredentialsResponse {
    pub provider_id: String,
    pub valid: bool,
    pub message: String,
}
