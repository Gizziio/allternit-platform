//! Tambo Integration API Routes
//!
//! Provides HTTP endpoints for UI generation:
//! - UI specification management
//! - Code generation
//! - Component library
//! - Template registration

use allternit_tambo_integration::{ComponentTemplate, GeneratedUI, UISpec, UIType};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Generation record (local type for API response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationRecord {
    pub generation_id: String,
    pub spec_id: String,
    pub ui_type: String,
    pub code: String,
    pub components_generated: usize,
    pub confidence: f32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Generate UI Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateUIRequest {
    pub spec_id: String,
    pub ui_type: String,
}

/// Generate UI Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateUIResponse {
    pub generation_id: String,
    pub spec_id: String,
    pub ui_type: String,
    pub code: String,
    pub components_generated: usize,
    pub confidence: f32,
}

/// Health check endpoint
async fn tambo_health_check_engine() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "tambo-integration"
    }))
}

/// Create Tambo router from engine
pub fn tambo_router_from_engine() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route(
            "/api/v1/tambo/specs",
            get(list_specs_engine).post(create_spec_engine),
        )
        .route(
            "/api/v1/tambo/specs/:id",
            get(get_spec_engine).delete(delete_spec_engine),
        )
        .route("/api/v1/tambo/generate", post(generate_ui_engine))
        .route("/api/v1/tambo/generations", get(list_generations_engine))
        .route("/api/v1/tambo/generations/:id", get(get_generation_engine))
        .route("/api/v1/tambo/components", get(list_components_engine))
        .route(
            "/api/v1/tambo/templates",
            get(list_templates_engine).post(register_template_engine),
        )
        .route("/api/v1/tambo/templates/:type", get(get_template_engine))
        .route("/api/v1/tambo/health", get(tambo_health_check_engine))
}

// ============================================================================
// Engine-based Handlers
// ============================================================================

async fn list_specs_engine(State(state): State<Arc<crate::AppState>>) -> Json<Vec<UISpec>> {
    Json(state.tambo_engine.get_specs().await)
}

async fn create_spec_engine(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<UISpec>,
) -> StatusCode {
    state.tambo_engine.create_spec(payload).await;
    StatusCode::CREATED
}

async fn get_spec_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Json<UISpec>, StatusCode> {
    state
        .tambo_engine
        .get_spec(&id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn delete_spec_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> StatusCode {
    if state.tambo_engine.delete_spec(&id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn generate_ui_engine(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode> {
    let spec = state
        .tambo_engine
        .get_spec(&payload.spec_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let ui_type = match payload.ui_type.as_str() {
        "react" => UIType::React,
        "vue" => UIType::Vue,
        "svelte" => UIType::Svelte,
        _ => UIType::PlainHtml,
    };
    let result = state
        .tambo_engine
        .generate_ui(&spec, ui_type)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(GenerateUIResponse {
        generation_id: result.generation_id,
        spec_id: result.spec_id,
        ui_type: format!("{:?}", result.ui_type),
        code: result.ui_code,
        components_generated: result.components_generated,
        confidence: result.confidence,
    }))
}

async fn list_generations_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<GeneratedUI>> {
    Json(state.tambo_engine.get_generations().await)
}

async fn get_generation_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Json<GeneratedUI>, StatusCode> {
    state
        .tambo_engine
        .get_generation(&id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_components_engine(State(state): State<Arc<crate::AppState>>) -> Json<Vec<String>> {
    Json(state.tambo_engine.get_component_types().await)
}

async fn list_templates_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<ComponentTemplate>> {
    Json(state.tambo_engine.get_templates().await)
}

async fn register_template_engine(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<ComponentTemplate>,
) -> StatusCode {
    state.tambo_engine.register_template(payload).await;
    StatusCode::CREATED
}

async fn get_template_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(component_type): Path<String>,
) -> Result<Json<ComponentTemplate>, StatusCode> {
    let templates = state.tambo_engine.get_templates().await;
    templates
        .into_iter()
        .find(|t| t.component_type == component_type)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let response = tambo_health_check_engine().await;
        assert_eq!(response.0["status"], "healthy");
    }
}
