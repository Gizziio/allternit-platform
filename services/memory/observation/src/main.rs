use axum::{
    extract::{State},
    http::StatusCode,
    response::{Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, Level};
use tracing_subscriber;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;
use allternit_history::{HistoryLedger};
use tempfile::NamedTempFile;

#[derive(Clone)]
struct AppState {
    history_ledger: Arc<std::sync::Mutex<HistoryLedger>>,
    // Store artifacts in memory for this implementation
    artifacts: Arc<Mutex<Vec<ObservationArtifact>>>,
    // Store observations in memory for this implementation
    observations: Arc<Mutex<Vec<GuiObservation>>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GuiObservation {
    id: String,
    session_id: String,
    timestamp: u64,
    event_type: String,
    element_id: Option<String>,
    element_type: Option<String>,
    action: String,
    target: Option<String>,
    metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
struct ObservationArtifact {
    artifact_id: String,
    observation_id: String,
    session_id: String,
    timestamp: u64,
    content: serde_json::Value,
    tags: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct ObserveRequest {
    session_id: String,
    event_type: String,
    element_id: Option<String>,
    element_type: Option<String>,
    action: String,
    target: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct ObserveResponse {
    success: bool,
    observation_id: String,
    artifact_ids: Vec<String>,
}

async fn health_check() -> &'static str {
    "Observation service healthy"
}

async fn gui_observe(
    State(state): State<AppState>,
    Json(request): Json<ObserveRequest>,
) -> Result<Json<ObserveResponse>, StatusCode> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Create the observation
    let observation = GuiObservation {
        id: Uuid::new_v4().to_string(),
        session_id: request.session_id,
        timestamp,
        event_type: request.event_type,
        element_id: request.element_id,
        element_type: request.element_type,
        action: request.action,
        target: request.target,
        metadata: request.metadata.unwrap_or_default(),
    };

    // Store the observation in memory
    {
        let mut observations = state.observations.lock().await;
        observations.push(observation.clone());
    }

    // Log the observation to history
    {
        let mut history = state.history_ledger.lock().unwrap();
        let content = serde_json::to_value(&observation).unwrap();
        history.append(content).unwrap();
    }

    // Create an artifact from the observation
    let artifact = ObservationArtifact {
        artifact_id: Uuid::new_v4().to_string(),
        observation_id: observation.id.clone(),
        session_id: observation.session_id.clone(),
        timestamp: observation.timestamp,
        content: serde_json::to_value(&observation).unwrap(),
        tags: vec!["gui_observation".to_string(), "artifact".to_string(), "observation".to_string()],
    };

    // Store the artifact in memory
    {
        let mut artifacts = state.artifacts.lock().await;
        artifacts.push(artifact.clone());
    }

    info!("GUI observation recorded: {} for session {}, created artifact: {}",
          observation.id, observation.session_id, artifact.artifact_id);

    Ok(Json(ObserveResponse {
        success: true,
        observation_id: observation.id,
        artifact_ids: vec![artifact.artifact_id],
    }))
}

async fn get_observations_for_session(
    State(state): State<AppState>,
    axum::extract::Path(session_id): axum::extract::Path<String>,
) -> Result<Json<Vec<GuiObservation>>, StatusCode> {
    let observations = state.observations.lock().await;
    let filtered = observations
        .iter()
        .filter(|obs| obs.session_id == session_id)
        .cloned()
        .collect();

    Ok(Json(filtered))
}

async fn get_artifacts_for_session(
    State(state): State<AppState>,
    axum::extract::Path(session_id): axum::extract::Path<String>,
) -> Result<Json<Vec<ObservationArtifact>>, StatusCode> {
    let artifacts = state.artifacts.lock().await;
    let filtered = artifacts
        .iter()
        .filter(|artifact| artifact.session_id == session_id)
        .cloned()
        .collect();

    Ok(Json(filtered))
}

// New endpoint to get all artifacts
async fn get_all_artifacts(State(state): State<AppState>) -> Result<Json<Vec<ObservationArtifact>>, StatusCode> {
    let artifacts = state.artifacts.lock().await;
    Ok(Json(artifacts.clone()))
}

// New endpoint to get all observations
async fn get_all_observations(State(state): State<AppState>) -> Result<Json<Vec<GuiObservation>>, StatusCode> {
    let observations = state.observations.lock().await;
    Ok(Json(observations.clone()))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting Observation Service...");

    // Initialize components (in a real system, these would be properly configured)
    let temp_path = format!("/tmp/observation_{}.jsonl", Uuid::new_v4());
    let history_ledger = Arc::new(std::sync::Mutex::new(
        allternit_history::HistoryLedger::new(&temp_path).unwrap(),
    ));

    let app_state = AppState {
        history_ledger,
        artifacts: Arc::new(Mutex::new(Vec::new())),
        observations: Arc::new(Mutex::new(Vec::new())),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/gui/observe", post(gui_observe))
        .route("/observations/session/:session_id", get(get_observations_for_session))
        .route("/artifacts/session/:session_id", get(get_artifacts_for_session))
        .route("/artifacts", get(get_all_artifacts))
        .route("/observations", get(get_all_observations))
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3012".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("Observation Service listening on {}", addr);

    axum::serve(listener, app).await.unwrap();
}
