//! Model download and cache routes.

use crate::cache::model::{CachedModel, ModelSource};
use crate::cache::store::ModelStore;
use crate::download::huggingface::validate_repo_id;
use crate::download::task::{build_cached_model, spawn_download_task};
use crate::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::info;

/// Request body for `POST /models/download`.
#[derive(Debug, Deserialize)]
pub struct DownloadRequest {
    pub repo_id: String,
    #[serde(default = "default_revision")]
    pub revision: String,
    pub quantization: Option<String>,
}

fn default_revision() -> String {
    "main".to_string()
}

/// Request body for `POST /models/import`.
#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    pub path: String,
    pub name: Option<String>,
    #[serde(default)]
    pub source: ImportSource,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportSource {
    #[default]
    LocalPath,
    UnslothOutput,
}

impl From<ImportSource> for ModelSource {
    fn from(value: ImportSource) -> Self {
        match value {
            ImportSource::LocalPath => ModelSource::LocalPath,
            ImportSource::UnslothOutput => ModelSource::UnslothOutput,
        }
    }
}

/// Response returned after queueing a download.
#[derive(Debug, Serialize)]
pub struct DownloadResponse {
    pub id: String,
    pub repo_id: String,
    pub revision: String,
    pub status: String,
    pub message: String,
}

/// API representation of a cached model (matches the frontend contract).
#[derive(Debug, Serialize)]
pub struct CachedModelResponse {
    pub id: String,
    pub name: String,
    pub source: String,
    pub path: String,
    pub status: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub created_at: String,
}

impl From<&CachedModel> for CachedModelResponse {
    fn from(model: &CachedModel) -> Self {
        Self {
            id: model.id.clone(),
            name: model.repo_id.clone(),
            source: model.source.to_string(),
            path: model.path.to_string_lossy().into_owned(),
            status: model.status.to_string(),
            downloaded_bytes: model.downloaded_bytes,
            total_bytes: model.total_bytes,
            created_at: model.created_at.to_rfc3339(),
        }
    }
}

/// Wrapper for the list response expected by the frontend.
#[derive(Debug, Serialize)]
pub struct ListModelsResponse {
    pub models: Vec<CachedModelResponse>,
}

/// Error response body.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Create the model cache router.
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/models", get(list_models))
        .route("/models/download", post(download_model))
        .route("/models/import", post(import_model))
        .with_state(state)
}

async fn list_models(State(state): State<Arc<AppState>>) -> Json<ListModelsResponse> {
    let models = state.store.list().await;
    Json(ListModelsResponse {
        models: models.iter().map(CachedModelResponse::from).collect(),
    })
}

async fn import_model(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ImportRequest>,
) -> Result<Json<CachedModelResponse>, (StatusCode, Json<ErrorResponse>)> {
    let path = std::path::PathBuf::from(&payload.path);

    if path.as_os_str().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "path must not be empty".into(),
            }),
        ));
    }

    let name = payload
        .name
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("imported-model")
                .to_string()
        });

    // Verify the path exists and is a directory.
    match tokio::fs::metadata(&path).await {
        Ok(meta) if meta.is_dir() => {}
        Ok(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "import path must be a directory".into(),
                }),
            ));
        }
        Err(err) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("cannot access import path: {}", err),
                }),
            ));
        }
    }

    let id = format!("local--{}--{}", name, Utc::now().timestamp_millis());
    let source: ModelSource = payload.source.into();
    let model = CachedModel::new_local(id.clone(), name, path, source);

    if state.store.get(&id).await.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: "model import already tracked".into(),
            }),
        ));
    }

    state.store.insert(model).await;
    info!(%id, "model imported");

    let imported = state.store.get(&id).await.unwrap();
    Ok(Json(CachedModelResponse::from(&imported)))
}

async fn download_model(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DownloadRequest>,
) -> Result<Json<DownloadResponse>, (StatusCode, Json<ErrorResponse>)> {
    let repo_id = payload.repo_id.trim().to_string();

    if let Err(err) = validate_repo_id(&repo_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: err.to_string(),
            }),
        ));
    }

    let model_id =
        ModelStore::model_id(&repo_id, &payload.revision, payload.quantization.as_deref());

    // If the model is already known, return its current state without re-spawning.
    if let Some(existing) = state.store.get(&model_id).await {
        info!(%model_id, "download already exists");
        return Ok(Json(DownloadResponse {
            id: existing.id,
            repo_id: existing.repo_id,
            revision: existing.revision,
            status: existing.status.to_string(),
            message: "model download already tracked".into(),
        }));
    }

    let model = build_cached_model(
        &repo_id,
        &payload.revision,
        payload.quantization,
        &state.models_dir,
    );
    let response = DownloadResponse {
        id: model.id.clone(),
        repo_id: model.repo_id.clone(),
        revision: model.revision.clone(),
        status: model.status.to_string(),
        message: "download queued".into(),
    };

    state.store.insert(model).await;

    spawn_download_task(
        state.store.clone(),
        model_id.clone(),
        repo_id,
        payload.revision,
        state.models_dir.clone(),
    );

    info!(%model_id, "download task spawned");
    Ok(Json(response))
}
