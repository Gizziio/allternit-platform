use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, Router},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{info, Level};
use tracing_subscriber;
mod templates;

use templates::{FrameworkSpec, FrameworkStatus, CapsuleTemplate, CanvasSpec, ToolRequirementSpec, get_default_frameworks, create_workorder_detail_view};
mod dynamic_framework;
use dynamic_framework::create_dynamic_framework;

#[derive(Clone)]
pub struct FrameworkRegistry {
    frameworks: Arc<RwLock<HashMap<String, FrameworkSpec>>>,
}

impl FrameworkRegistry {
    pub fn new() -> Self {
        Self {
            frameworks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register(&self, framework: FrameworkSpec) -> Result<(), anyhow::Error> {
        let mut frameworks = self.frameworks.write().await;
        let framework_id = framework.framework_id.clone();
        frameworks.insert(framework_id, framework.clone());
        info!("Registered framework: {}", framework.framework_id);
        Ok(())
    }

    pub async fn list(&self) -> Vec<FrameworkSpec> {
        let frameworks = self.frameworks.read().await;
        frameworks.values().cloned().collect()
    }

    pub async fn get(&self, framework_id: &str) -> Option<FrameworkSpec> {
        let frameworks = self.frameworks.read().await;
        frameworks.get(framework_id).cloned()
    }

    pub async fn delete(&self, framework_id: &str) -> Result<bool, anyhow::Error> {
        let mut frameworks = self.frameworks.write().await;
        Ok(frameworks.remove(framework_id).is_some())
    }
}

#[derive(Clone)]
struct AppState {
    registry: FrameworkRegistry,
}

#[derive(Deserialize)]
struct ViewContext {
    context: String, // serialized JSON
}

async fn get_view(
    Path((framework_id, view_id)): Path<(String, String)>,
    Query(params): Query<ViewContext>,
    State(_state): State<AppState>,
) -> Result<Json<CanvasSpec>, StatusCode> {
    if framework_id == "fwk_workorder" && view_id == "workorder.detail" {
        let context: serde_json::Value = serde_json::from_str(&params.context)
            .map_err(|_| StatusCode::BAD_REQUEST)?;
        Ok(Json(create_workorder_detail_view(context)))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn list_frameworks(State(state): State<AppState>) -> Json<Vec<FrameworkSpec>> {
    Json(state.registry.list().await)
}

async fn get_framework(
    Path(framework_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<FrameworkSpec>, StatusCode> {
    match state.registry.get(&framework_id).await {
        Some(framework) => Ok(Json(framework)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn register_framework(
    State(state): State<AppState>,
    Json(framework): Json<FrameworkSpec>,
) -> Result<Json<FrameworkSpec>, StatusCode> {
    state.registry
        .register(framework.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(framework))
}

#[derive(Deserialize)]
struct DynamicFrameworkRequest {
    framework_id: String,
    framework_type: String,
    config: Option<serde_json::Value>,
}

async fn create_dynamic_framework_endpoint(
    State(state): State<AppState>,
    Json(request): Json<DynamicFrameworkRequest>,
) -> Result<Json<FrameworkSpec>, StatusCode> {
    let framework = create_dynamic_framework(
        request.framework_id,
        request.framework_type,
        request.config,
    );

    state.registry
        .register(framework.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(framework))
}

async fn delete_framework(
    Path(framework_id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, StatusCode> {
    state.registry
        .delete(&framework_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

fn create_router(registry: FrameworkRegistry) -> Router {
    Router::new()
        .route("/frameworks", get(list_frameworks).post(register_framework))
        .route("/frameworks/dynamic", post(create_dynamic_framework_endpoint))
        .route("/frameworks/:framework_id", get(get_framework).delete(delete_framework))
        .route("/frameworks/:framework_id/views/:view_id", get(get_view))
        .layer(CorsLayer::permissive())
        .with_state(AppState { registry })
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting Framework Service...");

    let registry = FrameworkRegistry::new();

    for framework in templates::get_default_frameworks() {
        registry.register(framework).await?;
    }
    info!("Framework registry initialized with default frameworks");

    let app = create_router(registry);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3010".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Framework Service listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
