//! Provider Router Bridge - OC-010
//!
//! Bridge between OpenClaw's provider system and Allternit's native provider management.
//! Implements the adapter pattern to translate between OpenClaw provider operations
//! and Allternit provider operations while maintaining Allternit interface.

use crate::{HostError, OpenClawHost};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Request to list available providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListProvidersRequest {
    pub include_inactive: Option<bool>,
    pub include_unhealthy: Option<bool>,
}

/// Response from list providers request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListProvidersResponse {
    pub providers: Vec<ProviderInfo>,
    pub total_count: usize,
    pub success: bool,
}

/// Request to get provider information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetProviderRequest {
    pub provider_id: String,
}

/// Response from get provider request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetProviderResponse {
    pub provider: Option<ProviderInfo>,
    pub success: bool,
}

/// Request to check provider health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckHealthRequest {
    pub provider_id: String,
}

/// Response from check health request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckHealthResponse {
    pub provider_id: String,
    pub healthy: bool,
    pub status: String,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub success: bool,
}

/// Request to rotate provider credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateCredentialsRequest {
    pub provider_id: String,
    pub force: Option<bool>,
}

/// Response from rotate credentials request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateCredentialsResponse {
    pub provider_id: String,
    pub success: bool,
    pub rotated: bool,
    pub error: Option<String>,
}

/// Request to update provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProviderConfigRequest {
    pub provider_id: String,
    pub config_updates: std::collections::HashMap<String, serde_json::Value>,
}

/// Response from update provider config request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProviderConfigResponse {
    pub provider_id: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Provider information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub provider_type: String, // e.g., "openai", "anthropic", "google", etc.
    pub status: ProviderStatus,
    pub health: ProviderHealth,
    pub models: Vec<String>,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub rate_limits: Option<RateLimits>,
    pub cost_metrics: Option<CostMetrics>,
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,
}

/// Provider status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub active: bool,
    pub enabled: bool,
    pub priority: u32,
}

/// Provider health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub healthy: bool,
    pub last_checked: String,
    pub consecutive_errors: u32,
    pub last_error: Option<String>,
    pub latency_ms: Option<u64>,
}

/// Rate limits information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimits {
    pub requests_per_minute: Option<u32>,
    pub tokens_per_minute: Option<u32>,
    pub tokens_per_day: Option<u32>,
}

/// Cost metrics information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostMetrics {
    pub cost_per_million_input_tokens: Option<f64>,
    pub cost_per_million_output_tokens: Option<f64>,
    pub cached_cost_multiplier: Option<f64>,
}

/// Provider router bridge
pub struct ProviderRouterBridge {
    host: Arc<Mutex<OpenClawHost>>,
}

impl ProviderRouterBridge {
    /// Create new provider router bridge
    pub fn new(host: Arc<Mutex<OpenClawHost>>) -> Self {
        Self { host }
    }

    /// List available providers
    pub async fn list_providers(
        &mut self,
        request: ListProvidersRequest,
    ) -> Result<ListProvidersResponse, HostError> {
        let params = serde_json::json!({
            "includeInactive": request.include_inactive,
            "includeUnhealthy": request.include_unhealthy,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("provider.list", params).await?
        };
        let result = &call_result.result;

        let providers =
            if let Some(provider_array) = result.get("providers").and_then(|v| v.as_array()) {
                let mut result_providers = Vec::new();
                for prov in provider_array {
                    let id = match prov.get("id").and_then(|v| v.as_str()) {
                        Some(s) => s.to_string(),
                        None => continue, // Skip this provider if id is missing
                    };

                    let name = match prov.get("name").and_then(|v| v.as_str()) {
                        Some(s) => s.to_string(),
                        None => continue, // Skip this provider if name is missing
                    };

                    let provider_type = match prov.get("type").and_then(|v| v.as_str()) {
                        Some(s) => s.to_string(),
                        None => continue, // Skip this provider if type is missing
                    };

                    let status = match prov.get("status") {
                        Some(status_val) => match serde_json::from_value(status_val.clone()) {
                            Ok(status) => status,
                            Err(_) => continue, // Skip this provider if status is invalid
                        },
                        None => continue, // Skip this provider if status is missing
                    };

                    let health = match prov.get("health") {
                        Some(health_val) => match serde_json::from_value(health_val.clone()) {
                            Ok(health) => health,
                            Err(_) => continue, // Skip this provider if health is invalid
                        },
                        None => continue, // Skip this provider if health is missing
                    };

                    let provider_info = ProviderInfo {
                        id,
                        name,
                        provider_type,
                        status,
                        health,
                        models: prov
                            .get("models")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|m| m.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        region: prov
                            .get("region")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        endpoint: prov
                            .get("endpoint")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        rate_limits: prov
                            .get("rateLimits")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                        cost_metrics: prov
                            .get("costMetrics")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                        metadata: prov
                            .get("metadata")
                            .and_then(|v| serde_json::from_value(v.clone()).ok()),
                    };

                    result_providers.push(provider_info);
                }
                result_providers
            } else {
                vec![]
            };

        let total_count = result
            .get("totalCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(ListProvidersResponse {
            providers,
            total_count,
            success,
        })
    }

    /// Get provider information
    pub async fn get_provider(
        &mut self,
        request: GetProviderRequest,
    ) -> Result<GetProviderResponse, HostError> {
        let params = serde_json::json!({
            "providerId": request.provider_id,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("provider.get", params).await?
        };
        let result = &call_result.result;

        let provider = if let Some(provider_obj) = result.get("provider") {
            // Extract required fields
            let id_opt = provider_obj
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let name_opt = provider_obj
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let type_opt = provider_obj
                .get("type")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if let (Some(id), Some(name), Some(provider_type)) = (id_opt, name_opt, type_opt) {
                let status = match provider_obj.get("status") {
                    Some(status_val) => match serde_json::from_value(status_val.clone()) {
                        Ok(status) => status,
                        Err(_) => {
                            return Err(HostError::Serialization(
                                "Invalid provider status".to_string(),
                            ))
                        }
                    },
                    None => {
                        return Err(HostError::Serialization(
                            "Missing provider status".to_string(),
                        ))
                    }
                };

                let health = match provider_obj.get("health") {
                    Some(health_val) => match serde_json::from_value(health_val.clone()) {
                        Ok(health) => health,
                        Err(_) => {
                            return Err(HostError::Serialization(
                                "Invalid provider health".to_string(),
                            ))
                        }
                    },
                    None => {
                        return Err(HostError::Serialization(
                            "Missing provider health".to_string(),
                        ))
                    }
                };

                Some(ProviderInfo {
                    id,
                    name,
                    provider_type,
                    status,
                    health,
                    models: provider_obj
                        .get("models")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default(),
                    region: provider_obj
                        .get("region")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    endpoint: provider_obj
                        .get("endpoint")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    rate_limits: provider_obj
                        .get("rateLimits")
                        .and_then(|v| serde_json::from_value(v.clone()).ok()),
                    cost_metrics: provider_obj
                        .get("costMetrics")
                        .and_then(|v| serde_json::from_value(v.clone()).ok()),
                    metadata: provider_obj
                        .get("metadata")
                        .and_then(|v| serde_json::from_value(v.clone()).ok()),
                })
            } else {
                // If any required field is missing, return an error
                return Err(HostError::Serialization(
                    "Missing required provider field".to_string(),
                ));
            }
        } else {
            None
        };

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(GetProviderResponse { provider, success })
    }

    /// Check provider health
    pub async fn check_health(
        &mut self,
        request: CheckHealthRequest,
    ) -> Result<CheckHealthResponse, HostError> {
        let params = serde_json::json!({
            "providerId": request.provider_id,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("provider.health", params).await?
        };
        let result = &call_result.result;

        let healthy = result
            .get("healthy")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let status = result
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let latency_ms = result.get("latencyMs").and_then(|v| v.as_u64());

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(CheckHealthResponse {
            provider_id: request.provider_id,
            healthy,
            status,
            latency_ms,
            error,
            success: true,
        })
    }

    /// Rotate provider credentials
    pub async fn rotate_credentials(
        &mut self,
        request: RotateCredentialsRequest,
    ) -> Result<RotateCredentialsResponse, HostError> {
        let params = serde_json::json!({
            "providerId": request.provider_id,
            "force": request.force.unwrap_or(false),
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("provider.rotate", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let rotated = result
            .get("rotated")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(RotateCredentialsResponse {
            provider_id: request.provider_id,
            success,
            rotated,
            error,
        })
    }

    /// Update provider configuration
    pub async fn update_provider_config(
        &mut self,
        request: UpdateProviderConfigRequest,
    ) -> Result<UpdateProviderConfigResponse, HostError> {
        let params = serde_json::json!({
            "providerId": request.provider_id,
            "updates": request.config_updates,
        });

        let call_result = {
            let mut host = self.host.lock().await;

            host.call("provider.update", params).await?
        };
        let result = &call_result.result;

        let success = result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let error = result
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(UpdateProviderConfigResponse {
            provider_id: request.provider_id,
            success,
            error,
        })
    }

    /// Get the underlying host
    pub fn host(&self) -> Arc<Mutex<OpenClawHost>> {
        Arc::clone(&self.host)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_structures() {
        // Test that our structures compile and have expected fields
        let health = ProviderHealth {
            healthy: true,
            last_checked: "2023-01-01T00:00:00Z".to_string(),
            consecutive_errors: 0,
            last_error: None,
            latency_ms: Some(100),
        };

        assert!(health.healthy);

        let rate_limits = RateLimits {
            requests_per_minute: Some(1000),
            tokens_per_minute: Some(10000),
            tokens_per_day: Some(1000000),
        };

        assert_eq!(rate_limits.requests_per_minute, Some(1000));
    }
}
