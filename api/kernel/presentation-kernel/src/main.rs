mod canvas_selector;
mod error;
mod interaction;
mod resolver;
mod tokenizer;
mod types;

use axum::{
    extract::Extension,
    routing::{get, post},
    Json, Router,
};
use error::PKError;
use interaction::InteractionGenerator;
use resolver::SituationResolver;
use serde::Deserialize;
use std::sync::Arc;
use tokenizer::IntentTokenizer;
use tokio::sync::RwLock;
use types::{CanvasSelection, IntentPattern, IntentToken, Situation};
use uuid::Uuid;

pub type AppState = Arc<PresentationKernelService>;

#[derive(Clone)]
pub struct PresentationKernelService {
    tokenizer: Arc<RwLock<IntentTokenizer>>,
    resolver: Arc<RwLock<SituationResolver>>,
    generator: Arc<RwLock<InteractionGenerator>>,
}

impl PresentationKernelService {
    pub fn new() -> Self {
        Self {
            tokenizer: Arc::new(RwLock::new(IntentTokenizer::new())),
            resolver: Arc::new(RwLock::new(SituationResolver::new())),
            generator: Arc::new(RwLock::new(InteractionGenerator::new())),
        }
    }
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/tokenize", post(tokenize_intent))
        .route("/resolve", post(resolve_situation))
        .route("/select", post(select_canvas))
        .route("/patterns", get(get_patterns))
        .route("/patterns", post(register_pattern))
        .layer(Extension(state))
}

async fn health_check() -> &'static str {
    "Presentation Kernel service healthy"
}

#[derive(Deserialize)]
struct TokenizeRequest {
    input: String,
}

async fn tokenize_intent(
    Extension(service): Extension<AppState>,
    Json(req): Json<TokenizeRequest>,
) -> Result<Json<Vec<IntentToken>>, PKError> {
    let tokens = service.tokenizer.read().await.tokenize(&req.input).await?;
    Ok(Json(tokens))
}

#[derive(Deserialize)]
struct ResolveRequest {
    input: String,
    journal_events: Option<Vec<String>>,
}

async fn resolve_situation(
    Extension(service): Extension<AppState>,
    Json(req): Json<ResolveRequest>,
) -> Result<Json<Situation>, PKError> {
    let recent_events = req
        .journal_events
        .unwrap_or_default()
        .into_iter()
        .filter_map(|id| Uuid::parse_str(&id).ok())
        .collect();
    let context = crate::types::JournalContext {
        recent_events,
        active_node_id: None,
        active_capsules: vec![],
    };

    let situation = service
        .resolver
        .read()
        .await
        .resolve_situation(&req.input, context)
        .await?;

    Ok(Json(situation))
}

#[derive(Deserialize)]
struct SelectCanvasRequest {
    canvas_type: String,
}

async fn select_canvas(
    Extension(service): Extension<AppState>,
    Json(req): Json<SelectCanvasRequest>,
) -> Result<Json<CanvasSelection>, PKError> {
    let selection = service
        .resolver
        .read()
        .await
        .select_canvas(req.canvas_type.as_str())
        .await?;

    match selection {
        Some(canvas_selection) => Ok(Json(canvas_selection)),
        None => Err(PKError::InvalidCanvasType(req.canvas_type)),
    }
}

#[derive(Deserialize)]
struct PatternRegisterRequest {
    trigger: String,
    pattern: crate::types::IntentPattern,
}

async fn get_patterns(
    Extension(service): Extension<AppState>,
) -> Result<Json<Vec<IntentPattern>>, PKError> {
    Ok(Json(service.generator.read().await.get_all_patterns()?))
}

async fn register_pattern(
    Extension(service): Extension<AppState>,
    Json(req): Json<PatternRegisterRequest>,
) -> Result<Json<serde_json::Value>, PKError> {
    service
        .generator
        .write()
        .await
        .register_pattern(&req.trigger, req.pattern)?;
    Ok(Json(serde_json::json!({"status": "registered"})))
}

pub async fn run_server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(PresentationKernelService::new());
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3121".to_string());
    let addr = format!("{}:{}", host, port);
    run_server(&addr).await
}
