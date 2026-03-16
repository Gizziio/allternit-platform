//! Configuration Routes - Native Config System HTTP API
//!
//! Provides REST API endpoints for managing system configuration using the native
//! Rust implementation in a2r_openclaw_host::native_config_system.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use a2r_openclaw_host::native_config_system::{
    ConfigContext, ConfigManagementRequest, ConfigManagementResponse, ConfigOperation,
    ConfigSystemError, ConfigSystemService, ConfigValue,
};

/// Get config request query params
#[derive(Debug, Deserialize)]
pub struct GetConfigQuery {
    /// Config path using dot notation (e.g., "kernel.url")
    pub path: Option<String>,
}

/// Set config request body
#[derive(Debug, Deserialize, ToSchema)]
pub struct SetConfigRequest {
    /// Config path using dot notation (e.g., "kernel.url")
    pub path: String,
    /// Config value (string, number, boolean, array, or object)
    pub value: serde_json::Value,
}

/// Config response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigResponse {
    pub path: String,
    pub value: serde_json::Value,
    pub exists: bool,
}

/// Full config response
#[derive(Debug, Serialize, ToSchema)]
pub struct FullConfigResponse {
    pub config: HashMap<String, serde_json::Value>,
}

/// Config operation response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigOperationResponse {
    pub status: String,
    pub path: Option<String>,
}

/// Config validation response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigValidationResponse {
    pub valid: bool,
    pub message: Option<String>,
    pub errors: Option<Vec<String>>,
}

/// Config apply response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigApplyResponse {
    pub applied: bool,
    pub message: Option<String>,
    pub error: Option<String>,
    pub config_file: Option<String>,
}

/// Config history entry
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigHistoryEntry {
    pub key: String,
    pub old_value: Option<serde_json::Value>,
    pub new_value: serde_json::Value,
    pub changed_at: String,
    pub changed_by: Option<String>,
}

/// Config history response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigHistoryResponse {
    pub history: Vec<ConfigHistoryEntry>,
    pub count: usize,
    pub total: usize,
}

/// Config keys response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigKeysResponse {
    pub keys: Vec<String>,
    pub count: usize,
}

/// Error response
#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigErrorResponse {
    pub error: String,
}

/// Create router for config routes
pub fn create_config_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Config CRUD endpoints
        .route("/api/v1/config", get(get_config).patch(set_config))
        // Config management
        .route("/api/v1/config/apply", post(apply_config))
        .route("/api/v1/config/validate", post(validate_config))
        // Config history
        .route("/api/v1/config/history", get(get_config_history))
        // Config keys
        .route("/api/v1/config/keys", get(list_config_keys))
        // Config reset
        .route("/api/v1/config/reset", post(reset_config))
}

/// Get configuration value(s)
#[utoipa::path(
    get,
    path = "/api/v1/config",
    params(
        ("path" = Option<String>, Query, description = "Config path using dot notation (e.g., 'kernel.url')")
    ),
    responses(
        (status = 200, description = "Config retrieved successfully", body = ConfigResponse),
        (status = 404, description = "Config key not found", body = ConfigErrorResponse),
        (status = 500, description = "Failed to get config", body = ConfigErrorResponse)
    )
)]
async fn get_config(
    State(state): State<Arc<crate::AppState>>,
    Query(query): Query<GetConfigQuery>,
) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::Get { path: query.path },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                if let Some(result) = response.result {
                    (StatusCode::OK, Json(result)).into_response()
                } else {
                    (StatusCode::OK, Json(serde_json::json!({}))).into_response()
                }
            } else {
                let error = response
                    .error
                    .unwrap_or_else(|| "Config not found".to_string());
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": error})),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to get config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to get config: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Set configuration value
#[utoipa::path(
    patch,
    path = "/api/v1/config",
    request_body = SetConfigRequest,
    responses(
        (status = 200, description = "Config set successfully", body = ConfigOperationResponse),
        (status = 400, description = "Invalid request", body = ConfigErrorResponse),
        (status = 500, description = "Failed to set config", body = ConfigErrorResponse)
    )
)]
async fn set_config(
    State(state): State<Arc<crate::AppState>>,
    Json(req): Json<SetConfigRequest>,
) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    // Validate path
    if req.path.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Config path cannot be empty"})),
        )
            .into_response();
    }

    // Convert serde_json::Value to ConfigValue
    let config_value = json_to_config_value(req.value);

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::Set {
            path: req.path,
            value: config_value,
        },
        context: Some(ConfigContext {
            user_id: None,
            session_id: None,
            source: Some("api".to_string()),
        }),
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                (StatusCode::OK, Json(response.result.unwrap_or_default())).into_response()
            } else {
                let error = response
                    .error
                    .unwrap_or_else(|| "Failed to set config".to_string());
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": error})),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to set config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to set config: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Validate configuration
#[utoipa::path(
    post,
    path = "/api/v1/config/validate",
    responses(
        (status = 200, description = "Validation result", body = ConfigValidationResponse),
        (status = 500, description = "Failed to validate config", body = ConfigErrorResponse)
    )
)]
async fn validate_config(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::Validate,
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                (StatusCode::OK, Json(result)).into_response()
            } else {
                (
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "valid": false,
                        "message": "Validation returned no result"
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to validate config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to validate config: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Apply configuration changes
#[utoipa::path(
    post,
    path = "/api/v1/config/apply",
    responses(
        (status = 200, description = "Config applied successfully", body = ConfigApplyResponse),
        (status = 400, description = "Validation failed", body = ConfigApplyResponse),
        (status = 500, description = "Failed to apply config", body = ConfigErrorResponse)
    )
)]
async fn apply_config(State(state): State<Arc<crate::AppState>>) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::Apply,
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                let applied = result
                    .get("applied")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if applied {
                    (StatusCode::OK, Json(result)).into_response()
                } else {
                    (StatusCode::BAD_REQUEST, Json(result)).into_response()
                }
            } else {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Apply returned no result"})),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to apply config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to apply config: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Get configuration history
#[utoipa::path(
    get,
    path = "/api/v1/config/history",
    params(
        ("path" = Option<String>, Query, description = "Filter by config path"),
        ("limit" = Option<usize>, Query, description = "Maximum number of entries to return")
    ),
    responses(
        (status = 200, description = "History retrieved successfully", body = ConfigHistoryResponse),
        (status = 500, description = "Failed to get history", body = ConfigErrorResponse)
    )
)]
async fn get_config_history(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let path = params.get("path").cloned();
    let limit = params.get("limit").and_then(|s| s.parse().ok());

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::GetHistory { path, limit },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                (StatusCode::OK, Json(result)).into_response()
            } else {
                (
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "history": [],
                        "count": 0,
                        "total": 0
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to get config history: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to get history: {}", e)})),
            )
                .into_response()
        }
    }
}

/// List configuration keys
#[utoipa::path(
    get,
    path = "/api/v1/config/keys",
    params(
        ("prefix" = Option<String>, Query, description = "Filter by key prefix")
    ),
    responses(
        (status = 200, description = "Keys retrieved successfully", body = ConfigKeysResponse),
        (status = 500, description = "Failed to list keys", body = ConfigErrorResponse)
    )
)]
async fn list_config_keys(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let prefix = params.get("prefix").cloned();

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::ListKeys { prefix },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if let Some(result) = response.result {
                (StatusCode::OK, Json(result)).into_response()
            } else {
                (
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "keys": [],
                        "count": 0
                    })),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to list config keys: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to list keys: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Reset configuration to defaults
#[utoipa::path(
    post,
    path = "/api/v1/config/reset",
    params(
        ("path" = Option<String>, Query, description = "Specific path to reset, or omit to reset all")
    ),
    responses(
        (status = 200, description = "Config reset successfully", body = ConfigOperationResponse),
        (status = 404, description = "Config key not found", body = ConfigErrorResponse),
        (status = 500, description = "Failed to reset config", body = ConfigErrorResponse)
    )
)]
async fn reset_config(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let config_service = match state.config_service.as_ref() {
        Some(svc) => svc,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Config service not initialized"})),
            )
                .into_response();
        }
    };

    let path = params.get("path").cloned();

    let mut service = config_service.write().await;

    let request = ConfigManagementRequest {
        operation: ConfigOperation::Reset { path },
        context: None,
    };

    match service.execute(request).await {
        Ok(response) => {
            if response.success {
                (StatusCode::OK, Json(response.result.unwrap_or_default())).into_response()
            } else {
                let error = response
                    .error
                    .unwrap_or_else(|| "Failed to reset config".to_string());
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": error})),
                )
                    .into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to reset config: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to reset config: {}", e)})),
            )
                .into_response()
        }
    }
}

/// Convert serde_json::Value to ConfigValue
fn json_to_config_value(value: serde_json::Value) -> ConfigValue {
    match value {
        serde_json::Value::Null => ConfigValue::Null,
        serde_json::Value::Bool(b) => ConfigValue::Boolean(b),
        serde_json::Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                ConfigValue::Number(f)
            } else {
                ConfigValue::Null
            }
        }
        serde_json::Value::String(s) => ConfigValue::String(s),
        serde_json::Value::Array(arr) => {
            ConfigValue::Array(arr.into_iter().map(json_to_config_value).collect())
        }
        serde_json::Value::Object(obj) => ConfigValue::Object(
            obj.into_iter()
                .map(|(k, v)| (k, json_to_config_value(v)))
                .collect(),
        ),
    }
}
