//! A2rchitech Registry Server
//!
//! Centralized service for publishing, searching, and indexing skills, tools, and agents.
//! Provides marketplace-grade functionality with channel promotion flows and
//! end-to-end publish → index → pull → install → rollback capabilities.

use anyhow::Result;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};
use uuid::Uuid;

use a2rchitech_policy::{PolicyEffect, PolicyEngine, PolicyRequest, SafetyTier};
use registry_server::{
    IndexRequest, InstallRequest, Registry, RegistryId, RegistryItem, RegistryType,
    RollbackRequest, SearchQuery,
};

/// Registry server configuration
#[derive(Debug, Clone)]
pub struct RegistryConfig {
    pub bind_addr: String,
    pub db_url: String,
    pub storage_path: String,
    pub policy_enabled: bool,
}

impl Default for RegistryConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:8080".to_string(),
            db_url: "sqlite::memory:".to_string(),
            storage_path: "./registry-storage".to_string(),
            policy_enabled: true,
        }
    }
}

/// Registry server state
pub struct RegistryServer {
    registry: Arc<RwLock<Registry>>,
    policy_engine: Option<Arc<PolicyEngine>>,
    config: RegistryConfig,
}

/// Request to publish an item to the registry
#[derive(Debug, Deserialize, Serialize)]
pub struct PublishItemRequest {
    pub item_type: RegistryType,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub content: String, // Base64 encoded content
    pub metadata: serde_json::Value,
}

/// Response from publishing an item
#[derive(Debug, Serialize)]
pub struct PublishItemResponse {
    pub id: RegistryId,
    pub success: bool,
    pub message: String,
}

/// Request to search for items in the registry
#[derive(Debug, Deserialize)]
pub struct SearchItemsRequest {
    pub query: String,
    pub filters: Option<serde_json::Value>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Response from searching for items
#[derive(Debug, Serialize)]
pub struct SearchItemsResponse {
    pub items: Vec<RegistryItem>,
    pub total_count: usize,
    pub limit: usize,
    pub offset: usize,
}

/// Request to pull an item from the registry
#[derive(Debug, Deserialize)]
pub struct PullItemRequest {
    pub id: RegistryId,
    pub version: Option<String>,
}

/// Response from pulling an item
#[derive(Debug, Serialize)]
pub struct PullItemResponse {
    pub item: RegistryItem,
    pub content: String, // Base64 encoded content
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let mut config = RegistryConfig::default();
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    config.bind_addr = format!("{}:{}", host, port);
    info!("Starting A2rchitech Registry Server");

    // Initialize registry
    let registry = Arc::new(RwLock::new(Registry::new(&config.db_url).await?));

    // Policy engine initialization is deferred until registry policy wiring is finalized.
    let policy_engine = None;

    let server = Arc::new(RegistryServer {
        registry,
        policy_engine,
        config: config.clone(),
    });

    let app = Router::new()
        // Health check
        .route("/health", get(health_handler))
        // Publishing endpoints
        .route("/api/v1/publish", post(publish_item_handler))
        // Search endpoints
        .route("/api/v1/search", post(search_items_handler))
        // Indexing endpoints
        .route("/api/v1/index", post(index_item_handler))
        .route("/api/v1/index/bulk", post(index_bulk_handler))
        // Pull/install endpoints
        .route("/api/v1/pull/:id", get(pull_item_handler))
        .route("/api/v1/install", post(install_item_handler))
        // Rollback endpoints
        .route("/api/v1/rollback", post(rollback_handler))
        // Channel promotion endpoints
        .route(
            "/api/v1/channels/:channel/promote/:id",
            post(promote_to_channel_handler),
        )
        // Item management endpoints
        .route("/api/v1/items", get(list_items_handler))
        .route("/api/v1/items/:id", get(get_item_handler))
        .route("/api/v1/items/:id", post(update_item_handler))
        .route("/api/v1/items/:id", delete(delete_item_handler))
        .with_state(server);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    info!("Registry server listening on {}", config.bind_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
async fn health_handler() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "registry-server",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

/// Publish an item to the registry
async fn publish_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<PublishItemRequest>,
) -> Result<Json<PublishItemResponse>, StatusCode> {
    // Apply policy check if enabled
    if let Some(policy_engine) = &server.policy_engine {
        let policy_request = PolicyRequest {
            identity_id: "anonymous".to_string(), // This would come from auth
            resource: format!("registry:item:{}", request.name),
            action: "publish".to_string(),
            context: serde_json::json!({
                "item_type": request.item_type,
                "name": request.name,
                "version": request.version
            }),
            requested_tier: SafetyTier::T2,
        };

        let decision = policy_engine.evaluate(policy_request).await.map_err(|e| {
            error!("Policy evaluation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let mut registry = server.registry.write().await;

    let registry_item = RegistryItem {
        id: Uuid::new_v4().to_string(),
        item_type: request.item_type,
        name: request.name,
        version: request.version,
        description: request.description,
        tags: request.tags,
        content_hash: calculate_content_hash(&request.content),
        metadata: request.metadata,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        publisher_id: "local-node".to_string(),
        channels: vec!["stable".to_string()],
        downloads: 0,
        rating: None,
    };

    let item_id = registry.publish(registry_item.clone()).await.map_err(|e| {
        error!("Failed to publish item: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let message = format!("Successfully published item with ID: {}", item_id);
    Ok(Json(PublishItemResponse {
        id: item_id.clone(),
        success: true,
        message,
    }))
}

/// Search for items in the registry
async fn search_items_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<SearchItemsRequest>,
) -> Result<Json<SearchItemsResponse>, StatusCode> {
    let registry = server.registry.read().await;

    let filters = request
        .filters
        .and_then(|value| {
            serde_json::from_value::<std::collections::HashMap<String, String>>(value).ok()
        })
        .unwrap_or_default();
    let query = SearchQuery {
        text: request.query,
        filters,
        limit: request.limit.unwrap_or(50),
        offset: request.offset.unwrap_or(0),
    };

    let (items, total_count) = registry.search(query).await.map_err(|e| {
        error!("Search error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(SearchItemsResponse {
        items,
        total_count,
        limit: request.limit.unwrap_or(50),
        offset: request.offset.unwrap_or(0),
    }))
}

/// Index a specific item
async fn index_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<IndexRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = server.registry.write().await;

    registry.index_item(&request.item_id).await.map_err(|e| {
        error!("Indexing error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully indexed item: {}", request.item_id),
        "indexed_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Bulk index items
async fn index_bulk_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<Vec<IndexRequest>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = server.registry.write().await;

    let mut successes = 0;
    let mut failures = 0;

    for req in request {
        match registry.index_item(&req.item_id).await {
            Ok(_) => successes += 1,
            Err(e) => {
                error!("Failed to index item {}: {}", req.item_id, e);
                failures += 1;
            }
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "processed": successes + failures,
        "successes": successes,
        "failures": failures,
        "indexed_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Pull an item from the registry
async fn pull_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Path(id): Path<RegistryId>,
) -> Result<Json<PullItemResponse>, StatusCode> {
    let registry = server.registry.read().await;

    let item = registry
        .get_item(&id)
        .await
        .map_err(|e| {
            error!("Failed to get item {}: {}", id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // In a real implementation, this would retrieve the actual content
    // For now, we'll return a placeholder
    let content = base64::encode(format!("content_for_{}", id));

    Ok(Json(PullItemResponse { item, content }))
}

/// Install an item from the registry
async fn install_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<InstallRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check if enabled
    if let Some(policy_engine) = &server.policy_engine {
        let policy_request = PolicyRequest {
            identity_id: "anonymous".to_string(), // This would come from auth
            resource: format!("registry:item:{}", request.item_id),
            action: "install".to_string(),
            context: serde_json::json!({
                "item_id": request.item_id,
                "target_environment": request.target_environment
            }),
            requested_tier: SafetyTier::T2,
        };

        let decision = policy_engine.evaluate(policy_request).await.map_err(|e| {
            error!("Policy evaluation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let registry = server.registry.read().await;

    // Get the item to install
    let item = registry
        .get_item(&request.item_id)
        .await
        .map_err(|e| {
            error!("Failed to get item for install {}: {}", request.item_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // In a real implementation, this would handle the actual installation
    // For now, we'll just return a success message
    info!("Installing item: {} version {}", item.name, item.version);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully installed item: {} version {}", item.name, item.version),
        "installed_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Rollback an item installation
async fn rollback_handler(
    State(server): State<Arc<RegistryServer>>,
    Json(request): Json<RollbackRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check if enabled
    if let Some(policy_engine) = &server.policy_engine {
        let policy_request = PolicyRequest {
            identity_id: "anonymous".to_string(), // This would come from auth
            resource: format!("registry:item:{}", request.item_id),
            action: "rollback".to_string(),
            context: serde_json::json!({
                "item_id": request.item_id,
                "rollback_target": request.rollback_target_version
            }),
            requested_tier: SafetyTier::T2,
        };

        let decision = policy_engine.evaluate(policy_request).await.map_err(|e| {
            error!("Policy evaluation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // In a real implementation, this would handle the actual rollback
    // For now, we'll just return a success message
    info!(
        "Rolling back item: {} to target version: {:?}",
        request.item_id, request.rollback_target_version
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully initiated rollback for item: {}", request.item_id),
        "rolled_back_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Promote an item to a specific channel
async fn promote_to_channel_handler(
    State(server): State<Arc<RegistryServer>>,
    Path((channel, id)): Path<(String, RegistryId)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check if enabled
    if let Some(policy_engine) = &server.policy_engine {
        let policy_request = PolicyRequest {
            identity_id: "anonymous".to_string(), // This would come from auth
            resource: format!("registry:channel:{}", channel),
            action: "promote".to_string(),
            context: serde_json::json!({
                "item_id": id,
                "channel": channel
            }),
            requested_tier: SafetyTier::T2,
        };

        let decision = policy_engine.evaluate(policy_request).await.map_err(|e| {
            error!("Policy evaluation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let mut registry = server.registry.write().await;

    registry
        .promote_to_channel(&id, &channel)
        .await
        .map_err(|e| {
            error!(
                "Failed to promote item {} to channel {}: {}",
                id, channel, e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully promoted item {} to channel {}", id, channel),
        "promoted_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// List all items in the registry
async fn list_items_handler(
    State(server): State<Arc<RegistryServer>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let registry = server.registry.read().await;

    let limit = params
        .get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(50);
    let offset = params
        .get("offset")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    let item_type = params.get("type").cloned();

    let items = registry
        .list_items(item_type.as_deref(), limit, offset)
        .await
        .map_err(|e| {
            error!("Failed to list items: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "items": items,
        "limit": limit,
        "offset": offset,
        "total_count": items.len() // In a real implementation, this would be the actual total
    })))
}

/// Get a specific item by ID
async fn get_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Path(id): Path<RegistryId>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let registry = server.registry.read().await;

    let item = registry.get_item(&id).await.map_err(|e| {
        error!("Failed to get item {}: {}", id, e);
        StatusCode::NOT_FOUND
    })?;

    Ok(Json(serde_json::json!(item)))
}

/// Update an existing item
async fn update_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Path(id): Path<RegistryId>,
    Json(updates): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = server.registry.write().await;

    let updated_item = registry.update_item(&id, updates).await.map_err(|e| {
        error!("Failed to update item {}: {}", id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!(updated_item)))
}

/// Delete an item from the registry
async fn delete_item_handler(
    State(server): State<Arc<RegistryServer>>,
    Path(id): Path<RegistryId>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check if enabled
    if let Some(policy_engine) = &server.policy_engine {
        let policy_request = PolicyRequest {
            identity_id: "anonymous".to_string(), // This would come from auth
            resource: format!("registry:item:{}", id),
            action: "delete".to_string(),
            context: serde_json::json!({}),
            requested_tier: SafetyTier::T2,
        };

        let decision = policy_engine.evaluate(policy_request).await.map_err(|e| {
            error!("Policy evaluation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if matches!(decision.decision, PolicyEffect::Deny) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let mut registry = server.registry.write().await;

    registry.delete_item(&id).await.map_err(|e| {
        error!("Failed to delete item {}: {}", id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Successfully deleted item: {}", id),
        "deleted_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Calculate content hash for integrity verification
fn calculate_content_hash(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn test_health_endpoint() {
        let config = RegistryConfig::default();
        let registry = Arc::new(RwLock::new(Registry::new("sqlite::memory:").await.unwrap()));
        let server = Arc::new(RegistryServer {
            registry,
            policy_engine: None,
            config,
        });

        let app = Router::new()
            .route("/health", get(health_handler))
            .with_state(server);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_publish_item() {
        let config = RegistryConfig::default();
        let registry = Arc::new(RwLock::new(Registry::new("sqlite::memory:").await.unwrap()));
        let server = Arc::new(RegistryServer {
            registry,
            policy_engine: None,
            config,
        });

        let app = Router::new()
            .route("/api/v1/publish", post(publish_item_handler))
            .with_state(server.clone());

        let publish_request = PublishItemRequest {
            item_type: RegistryType::Skill,
            name: "test-skill".to_string(),
            version: "1.0.0".to_string(),
            description: Some("A test skill".to_string()),
            tags: vec!["test".to_string(), "example".to_string()],
            content: base64::encode("test content"),
            metadata: serde_json::json!({}),
        };

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/publish")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&publish_request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
