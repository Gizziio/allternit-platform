mod engine_rust;
mod python_bridge;

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tracing::{info, error};
use std::collections::HashMap;

#[derive(Clone)]
struct AppState {
    rust_engine: Arc<Mutex<engine_rust::LlamaEngine>>,
    python_client: Arc<python_bridge::PythonGatewayClient>,
}

#[derive(Deserialize)]
struct InferenceRequest {
    model_id: String,
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
}

#[derive(Serialize)]
struct InferenceResponse {
    text: String,
    model_used: String,
    source: String,
}

#[derive(Serialize)]
struct ListModelsResponse {
    models: Vec<String>,
}

async fn handle_generate(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InferenceRequest>,
) -> Result<Json<InferenceResponse>, StatusCode> {
    info!("Inference request for model: {}", req.model_id);

    match req.model_id.as_str() {
        "qwen-2.5-7b" | "glm-4-9b" => {
            let mut engine = state.rust_engine.lock().await;
            let result = engine.generate(
                &req.model_id,
                &req.prompt,
                req.max_tokens.unwrap_or(512),
                req.temperature.unwrap_or(0.7)
            )
            .map_err(|e| {
                error!("Rust engine failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            Ok(Json(InferenceResponse {
                text: result,
                model_used: req.model_id,
                source: "rust-native".to_string(),
            }))
        },
        "lfm-3b" | "qwen-image-2512" => {
            let result = state.python_client.generate(&req.model_id, &req.prompt)
                .await
                .map_err(|e| {
                    error!("Python bridge failed: {}", e);
                    StatusCode::BAD_GATEWAY
                })?;

            Ok(Json(InferenceResponse {
                text: result,
                model_used: req.model_id,
                source: "python-gateway".to_string(),
            }))
        },
        _ => {
            error!("Unknown model requested: {}", req.model_id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn handle_list_models(
    State(state): State<Arc<AppState>>,
) -> Json<ListModelsResponse> {
    let engine = state.rust_engine.lock().await;
    let models = engine.list_models();
    Json(ListModelsResponse { models })
}

async fn handle_health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    // Define model paths - these would typically be configured via environment variables
    let mut model_paths = HashMap::new();
    model_paths.insert("qwen-2.5-7b".to_string(),
        std::env::var("QWEN_MODEL_PATH")
            .unwrap_or_else(|_| "/models/gguf/qwen2.5-7b-instruct-q4_k_m.gguf".to_string()));
    model_paths.insert("glm-4-9b".to_string(),
        std::env::var("GLM_MODEL_PATH")
            .unwrap_or_else(|_| "/models/gguf/glm-4-9b-chat-q4_k_m.gguf".to_string()));

    // Initialize Rust Engine with multiple models
    let rust_engine = Arc::new(Mutex::new(engine_rust::LlamaEngine::new(&model_paths)?));

    let python_client = Arc::new(python_bridge::PythonGatewayClient::new(
        &std::env::var("PYTHON_GATEWAY_URL")
            .unwrap_or_else(|_| "http://localhost:8000".to_string())
    ));

    let state = Arc::new(AppState {
        rust_engine,
        python_client,
    });

    let app = Router::new()
        .route("/v1/generate", post(handle_generate))
        .route("/v1/models", get(handle_list_models))
        .route("/health", get(handle_health_check))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3007".to_string());
    let addr = format!("{}:{}", host, port);
    info!("Local Inference Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
