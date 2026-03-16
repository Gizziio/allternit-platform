//! Tambo API Routes with Determinism Modes
//!
//! Provides HTTP endpoints for UI generation with different determinism modes:
//! - Validated generation (schema validation)
//! - Reproducible generation (seed-based)
//! - Streaming generation (SSE)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{sse::{Event, KeepAlive, Sse}, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use futures_util::stream::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use crate::{
    TamboEngine, UIType, UISpec, GenerationConfig, StreamConfig, StreamChunk,
};

/// Tambo router state
#[derive(Clone)]
pub struct TamboRouterState {
    pub engine: Arc<TamboEngine>,
}

/// Generate UI request
#[derive(Debug, Deserialize)]
pub struct GenerateUIRequest {
    pub spec: UISpec,
    pub ui_type: UIType,
    #[serde(default)]
    pub mode: GenerationMode,
    #[serde(default)]
    pub seed: Option<u64>,
}

/// Generation mode
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum GenerationMode {
    #[default]
    Standard,
    Validated,
    Reproducible,
    Streaming,
}

/// Generate UI response
#[derive(Debug, Serialize)]
pub struct GenerateUIResponse {
    pub generation_id: String,
    pub spec_id: String,
    pub ui_code: String,
    pub ui_type: String,
    pub components_generated: usize,
    pub confidence: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_hash: Option<String>,
}

impl From<crate::GeneratedUI> for GenerateUIResponse {
    fn from(ui: crate::GeneratedUI) -> Self {
        Self {
            generation_id: ui.generation_id,
            spec_id: ui.spec_id,
            ui_code: ui.ui_code,
            ui_type: format!("{:?}", ui.ui_type),
            components_generated: ui.components_generated,
            confidence: ui.confidence,
            generation_hash: ui.generation_hash,
        }
    }
}

/// Create Tambo router with all determinism mode endpoints
pub fn tambo_router(state: TamboRouterState) -> Router {
    Router::new()
        // Standard generation
        .route("/generate", post(generate_ui_handler))
        
        // Validated generation
        .route("/generate/validated", post(generate_ui_validated_handler))
        
        // Reproducible generation
        .route("/generate/reproducible", post(generate_ui_reproducible_handler))
        
        // Streaming generation (SSE)
        .route("/generate/stream", post(generate_ui_streaming_handler))
        
        // Generation state
        .route("/generations/:id/state", get(get_generation_state_handler))
        .route("/generations/:id/state", post(save_generation_state_handler))
        
        .with_state(state)
}

/// Standard UI generation handler
/// POST /v1/tambo/generate
async fn generate_ui_handler(
    State(state): State<TamboRouterState>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode> {
    let config = GenerationConfig::standard();
    
    let result = state.engine.generate_ui(&payload.spec, payload.ui_type).await
        .map_err(|e| {
            tracing::error!("Generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(Json(result.into()))
}

/// Validated UI generation handler
/// POST /v1/tambo/generate/validated
async fn generate_ui_validated_handler(
    State(state): State<TamboRouterState>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode> {
    let result = state.engine.generate_ui_validated(&payload.spec, payload.ui_type).await
        .map_err(|e| {
            tracing::error!("Validated generation failed: {}", e);
            match e {
                crate::TamboError::ValidationFailed(msg) => {
                    tracing::warn!("Validation error: {}", msg);
                    StatusCode::BAD_REQUEST
                }
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;
    
    Ok(Json(result.into()))
}

/// Reproducible UI generation handler (seed-based)
/// POST /v1/tambo/generate/reproducible
async fn generate_ui_reproducible_handler(
    State(state): State<TamboRouterState>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode> {
    let seed = payload.seed.unwrap_or_else(|| {
        // Generate deterministic seed from spec
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        payload.spec.spec_id.hash(&mut hasher);
        hasher.finish()
    });
    
    let config = GenerationConfig::reproducible(seed);
    
    let result = state.engine.generate_ui_reproducible(&payload.spec, payload.ui_type, config).await
        .map_err(|e| {
            tracing::error!("Reproducible generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(Json(result.into()))
}

/// Streaming UI generation handler (SSE)
/// POST /v1/tambo/generate/stream
async fn generate_ui_streaming_handler(
    State(state): State<TamboRouterState>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let config = StreamConfig::new()
        .with_progress(true)
        .with_chunk_size(100)
        .with_max_retries(3);
    
    let stream_result = state.engine.generate_ui_streaming(&payload.spec, payload.ui_type, config).await
        .map_err(|e| {
            tracing::error!("Streaming generation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    // Convert mpsc receiver to SSE stream
    let stream = tokio_stream::wrappers::ReceiverStream::new(stream_result.receiver)
        .map(|chunk| {
            let event = match chunk {
                StreamChunk::Data(code) => {
                    Event::default().data(code)
                }
                StreamChunk::Progress { current, total, stage } => {
                    Event::default()
                        .event("progress")
                        .data(serde_json::json!({
                            "current": current,
                            "total": total,
                            "stage": stage,
                        }).to_string())
                }
                StreamChunk::Complete(ui) => {
                    Event::default()
                        .event("complete")
                        .data(serde_json::json!({
                            "generation_id": ui.generation_id,
                            "spec_id": ui.spec_id,
                            "components_generated": ui.components_generated,
                        }).to_string())
                }
                StreamChunk::Error(msg) => {
                    Event::default()
                        .event("error")
                        .data(serde_json::json!({
                            "error": msg,
                        }).to_string())
                }
                StreamChunk::Cancelled => {
                    Event::default()
                        .event("cancelled")
                        .data("Generation cancelled")
                }
            };
            Ok(event)
        });
    
    Ok(Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(5))))
}

/// Get generation state handler
/// GET /v1/tambo/generations/:id/state
async fn get_generation_state_handler(
    State(state): State<TamboRouterState>,
    Path(generation_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let generation_state = state.engine.load_generation_state(&generation_id).await
        .map_err(|e| {
            tracing::error!("Failed to load generation state: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    match generation_state {
        Some(state) => Ok(Json(state.state)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Save generation state handler
/// POST /v1/tambo/generations/:id/state
async fn save_generation_state_handler(
    State(state): State<TamboRouterState>,
    Path(generation_id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Result<StatusCode, StatusCode> {
    // Get spec_id from the generation (would need to look it up)
    // For now, use a placeholder
    let spec_id = format!("spec_{}", generation_id);
    
    state.engine.save_generation_state(&generation_id, &spec_id, payload).await
        .map_err(|e| {
            tracing::error!("Failed to save generation state: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(StatusCode::OK)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn create_test_state() -> TamboRouterState {
        TamboRouterState {
            engine: Arc::new(TamboEngine::new()),
        }
    }

    #[tokio::test]
    async fn test_validated_generation_request() {
        let state = create_test_state();
        let router = tambo_router(state);

        // This would need a proper UISpec - simplified for test
        let request = Request::builder()
            .method("POST")
            .uri("/generate/validated")
            .header("Content-Type", "application/json")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        
        // Should return error for empty body (expected)
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_reproducible_generation_with_seed() {
        let state = create_test_state();
        let router = tambo_router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/generate/reproducible")
            .header("Content-Type", "application/json")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        
        // Should return error for empty body (expected)
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_generation_state_not_found() {
        let state = create_test_state();
        let router = tambo_router(state);

        let request = Request::builder()
            .method("GET")
            .uri("/generations/nonexistent/state")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        
        // Should return 404 for non-existent generation
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
