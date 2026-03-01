use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use validator::Validate;

use crate::models::*;
use crate::registry::PackRegistry;
use crate::renderer::PromptRenderer;
use crate::storage::StorageManager;

/// Application state shared across handlers
pub struct AppState {
    pub registry: Arc<PackRegistry>,
    pub renderer: PromptRenderer,
    pub storage: Arc<StorageManager>,
}

/// Create the API router
pub fn create_router(registry: Arc<PackRegistry>, storage: Arc<StorageManager>) -> Router {
    let renderer = PromptRenderer::new(storage.clone());
    
    let state = Arc::new(AppState {
        registry,
        renderer,
        storage,
    });

    Router::new()
        // Health
        .route("/health", get(health_handler))
        
        // Pack management
        .route("/v1/packs", get(list_packs).post(create_pack))
        .route("/v1/packs/:pack_id", get(get_pack))
        .route("/v1/packs/:pack_id/versions", get(list_versions).post(publish_version))
        .route("/v1/packs/:pack_id/versions/:version", get(get_version))
        .route("/v1/packs/:pack_id/diff", get(diff_versions))
        
        // Rendering
        .route("/v1/render", post(render_prompt))
        .route("/v1/render/batch", post(render_batch))
        .route("/v1/render/contextual", post(render_contextual))
        
        // Validation
        .route("/v1/validate", post(validate_pack))
        .route("/v1/test-render", post(test_render))
        
        // Receipts
        .route("/v1/receipts/:receipt_id", get(get_receipt).post(record_ledger_tx))
        
        .with_state(state)
}

/// Health check handler
async fn health_handler(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let packs = state.registry.list_packs().await.unwrap_or_default();
    
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: "1.0.0".to_string(),
        packs_loaded: packs.len() as u64,
        cache_hit_rate: 0.0, // TODO: implement metrics
    })
}

/// List all packs
async fn list_packs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<PackMetadata>>, (StatusCode, Json<ErrorResponse>)> {
    match state.registry.list_packs().await {
        Ok(packs) => Ok(Json(packs)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to list packs".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Get pack metadata
async fn get_pack(
    State(state): State<Arc<AppState>>,
    Path(pack_id): Path<String>,
) -> Result<Json<PackMetadata>, (StatusCode, Json<ErrorResponse>)> {
    let versions = state.registry.list_versions(&pack_id).await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: "Failed to get pack".to_string(),
            details: Some(e.to_string()),
        }),
    ))?;

    if versions.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Pack '{}' not found", pack_id),
                details: None,
            }),
        ));
    }

    let latest = versions.last().cloned().unwrap_or_default();
    let pack = state.registry.get_pack(&pack_id, &latest).await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: "Failed to get pack".to_string(),
            details: Some(e.to_string()),
        }),
    ))?;

    match pack {
        Some(p) => Ok(Json(PackMetadata {
            pack_id: p.pack_id,
            name: p.name,
            latest_version: p.version,
            versions,
            tags: p.tags,
            description: p.description,
        })),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Pack '{}' not found", pack_id),
                details: None,
            }),
        )),
    }
}

/// List all versions of a pack
async fn list_versions(
    State(state): State<Arc<AppState>>,
    Path(pack_id): Path<String>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<ErrorResponse>)> {
    match state.registry.list_versions(&pack_id).await {
        Ok(versions) => Ok(Json(versions)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to list versions".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Get specific pack version
async fn get_version(
    State(state): State<Arc<AppState>>,
    Path((pack_id, version)): Path<(String, String)>,
) -> Result<Json<PromptPack>, (StatusCode, Json<ErrorResponse>)> {
    match state.registry.get_pack(&pack_id, &version).await {
        Ok(Some(pack)) => Ok(Json(pack)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Version '{}' of pack '{}' not found", version, pack_id),
                details: None,
            }),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get pack".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Create a new pack
async fn create_pack(
    State(state): State<Arc<AppState>>,
    Json(pack): Json<PromptPack>,
) -> Result<Json<PromptPack>, (StatusCode, Json<ErrorResponse>)> {
    // Validate pack
    if let Err(e) = pack.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Validation failed".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    match state.registry.register_pack(pack.clone()).await {
        Ok(_) => Ok(Json(pack)),
        Err(e) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Failed to create pack".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Publish a new version (alias for create with version)
async fn publish_version(
    State(state): State<Arc<AppState>>,
    Path(pack_id): Path<String>,
    Json(pack): Json<PromptPack>,
) -> Result<Json<PromptPack>, (StatusCode, Json<ErrorResponse>)> {
    // Ensure pack_id matches path
    if pack.pack_id != pack_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Pack ID mismatch".to_string(),
                details: Some(format!("Path: {}, Body: {}", pack_id, pack.pack_id)),
            }),
        ));
    }

    create_pack(State(state), Json(pack)).await
}

/// Diff two versions
async fn diff_versions(
    State(state): State<Arc<AppState>>,
    Path(pack_id): Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<PackDiff>, (StatusCode, Json<ErrorResponse>)> {
    let from = params.get("from").cloned().unwrap_or_default();
    let to = params.get("to").cloned().unwrap_or_default();

    if from.is_empty() || to.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Missing version parameters".to_string(),
                details: Some("Required: 'from' and 'to' versions".to_string()),
            }),
        ));
    }

    match state.registry.diff_versions(&pack_id, &from, &to).await {
        Ok(diff) => Ok(Json(diff)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to diff versions".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Render a prompt
async fn render_prompt(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RenderRequest>,
) -> Result<Json<RenderResult>, (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if let Err(e) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid request".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    // Get pack
    let version = request.version.clone().unwrap_or_else(|| "latest".to_string());
    let pack = if version == "latest" {
        state.registry.get_latest(&request.pack_id).await
    } else {
        state.registry.get_pack(&request.pack_id, &version).await
    }.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: "Failed to get pack".to_string(),
            details: Some(e.to_string()),
        }),
    ))?;

    let pack = match pack {
        Some(p) => p,
        None => return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Pack '{}' not found", request.pack_id),
                details: None,
            }),
        )),
    };

    // Render
    match state.renderer.render(&request, &pack).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Render failed".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Batch render
async fn render_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchRenderRequest>,
) -> Result<Json<BatchRenderResult>, (StatusCode, Json<ErrorResponse>)> {
    let mut results = Vec::new();

    for render_req in request.renders {
        // Get pack
        let version = render_req.version.clone().unwrap_or_else(|| "latest".to_string());
        let pack = if version == "latest" {
            state.registry.get_latest(&render_req.pack_id).await
        } else {
            state.registry.get_pack(&render_req.pack_id, &version).await
        }.map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get pack".to_string(),
                details: Some(e.to_string()),
            }),
        ))?;

        let pack = match pack {
            Some(p) => p,
            None => return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Pack '{}' not found", render_req.pack_id),
                    details: None,
                }),
            )),
        };

        // Render
        match state.renderer.render(&render_req, &pack).await {
            Ok(result) => results.push(result),
            Err(e) => return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Batch render failed".to_string(),
                    details: Some(e.to_string()),
                }),
            )),
        }
    }

    Ok(Json(BatchRenderResult { results }))
}

/// Contextual render (DAK integration)
async fn render_contextual(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ContextualRenderRequest>,
) -> Result<Json<ContextualRenderResult>, (StatusCode, Json<ErrorResponse>)> {
    let mut rendered_prompts = Vec::new();

    for prompt_ref in &request.prompt_refs {
        let render_req = RenderRequest {
            pack_id: prompt_ref.pack_id.clone(),
            prompt_id: prompt_ref.prompt_id.clone(),
            version: Some(prompt_ref.version.clone()),
            variables: request.variables.clone(),
            options: None,
        };

        // Get pack
        let pack = state.registry.get_pack(&prompt_ref.pack_id, &prompt_ref.version).await
            .map_err(|e| (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to get pack".to_string(),
                    details: Some(e.to_string()),
                }),
            ))?;

        let pack = match pack {
            Some(p) => p,
            None => return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Pack '{}' not found", prompt_ref.pack_id),
                    details: None,
                }),
            )),
        };

        // Render
        match state.renderer.render(&render_req, &pack).await {
            Ok(result) => rendered_prompts.push(result),
            Err(e) => return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Contextual render failed".to_string(),
                    details: Some(e.to_string()),
                }),
            )),
        }
    }

    // Calculate context hash
    let context_hash = format!("ctx_{}", chrono::Utc::now().timestamp_millis());
    let receipt_id = format!("rpt_ctx_{}", chrono::Utc::now().timestamp_millis());

    Ok(Json(ContextualRenderResult {
        rendered_prompts,
        context_hash,
        receipt_id,
    }))
}

/// Validate a pack
async fn validate_pack(
    Json(_pack): Json<PromptPack>,
) -> Result<Json<ValidationResult>, (StatusCode, Json<ErrorResponse>)> {
    // TODO: Implement validation
    Ok(Json(ValidationResult {
        valid: true,
        errors: vec![],
        warnings: vec![],
    }))
}

/// Test render
async fn test_render(
    Json(request): Json<RenderRequest>,
) -> Result<Json<RenderResult>, (StatusCode, Json<ErrorResponse>)> {
    // Simple test render without storing
    let rendered = format!("Test render for {}:{}", request.pack_id, request.prompt_id);
    
    Ok(Json(RenderResult {
        rendered,
        content_hash: "sha256:test".to_string(),
        rendered_hash: "sha256:test".to_string(),
        receipt_id: "rpt_test".to_string(),
        pack_id: request.pack_id,
        prompt_id: request.prompt_id,
        version: request.version.unwrap_or_else(|| "test".to_string()),
        rendered_at: chrono::Utc::now(),
        deterministic: true,
    }))
}

/// Get receipt
async fn get_receipt(
    State(state): State<Arc<AppState>>,
    Path(receipt_id): Path<String>,
) -> Result<Json<PromptReceipt>, (StatusCode, Json<ErrorResponse>)> {
    match state.storage.get_receipt(&receipt_id).await {
        Ok(Some(receipt)) => Ok(Json(receipt)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Receipt '{}' not found", receipt_id),
                details: None,
            }),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get receipt".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

/// Record ledger transaction
async fn record_ledger_tx(
    State(state): State<Arc<AppState>>,
    Path(receipt_id): Path<String>,
    Json(ledger_req): Json<RecordLedgerRequest>,
) -> Result<Json<PromptReceipt>, (StatusCode, Json<ErrorResponse>)> {
    match state.storage.record_ledger_tx(&receipt_id, &ledger_req.rails_ledger_tx).await {
        Ok(_) => {
            // Get updated receipt
            match state.storage.get_receipt(&receipt_id).await {
                Ok(Some(receipt)) => Ok(Json(receipt)),
                _ => Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to get updated receipt".to_string(),
                        details: None,
                    }),
                )),
            }
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to record ledger transaction".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}
