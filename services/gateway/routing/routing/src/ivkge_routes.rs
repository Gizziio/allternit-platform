//! IVKGE Advanced API Routes
//!
//! Provides HTTP endpoints for visual knowledge graph extraction:
//! - Screenshot upload and parsing
//! - Entity/relationship extraction
//! - User corrections
//! - Ambiguity resolution

use allternit_ivkge_advanced::VisualExtractionResult;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Create IVKGE router from engine
pub fn ivkge_router_from_engine() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Upload endpoints
        .route("/api/v1/ivkge/upload", post(upload_image_engine))
        // Extraction endpoints
        .route("/api/v1/ivkge/extract", post(extract_entities_engine))
        .route("/api/v1/ivkge/extractions", get(list_extractions_engine))
        .route("/api/v1/ivkge/extractions/:id", get(get_extraction_engine))
        // Correction endpoints
        .route("/api/v1/ivkge/corrections", post(apply_correction_engine))
        .route(
            "/api/v1/ivkge/extractions/:id/corrections",
            get(get_corrections_engine),
        )
        // Ambiguity endpoints
        .route(
            "/api/v1/ivkge/ambiguities/resolve",
            post(resolve_ambiguity_engine),
        )
        // Health check
        .route("/api/v1/ivkge/health", get(ivkge_health_check_engine))
}

/// Extraction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionRecord {
    pub extraction_id: String,
    pub source_type: String,
    pub entities: Vec<Entity>,
    pub relationships: Vec<Relationship>,
    pub ocr_text: Option<String>,
    pub ambiguity_report: Option<AmbiguityReport>,
    pub created_at: DateTime<Utc>,
}

/// Entity extracted from visual input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub entity_id: String,
    pub name: String,
    pub entity_type: String,
    pub confidence: f32,
    pub bounding_box: Option<BoundingBox>,
    pub properties: std::collections::HashMap<String, String>,
}

/// Relationship extracted from visual input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub relationship_id: String,
    pub source_entity: String,
    pub target_entity: String,
    pub relationship_type: String,
    pub confidence: f32,
    pub label: Option<String>,
}

/// Bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Ambiguity report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbiguityReport {
    pub report_id: String,
    pub ambiguities: Vec<serde_json::Value>,
    pub overall_confidence: f32,
}

/// Correction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectionRecord {
    pub correction_id: String,
    pub extraction_id: String,
    pub correction_type: String,
    pub changes: serde_json::Value,
    pub applied_at: DateTime<Utc>,
    pub status: String,
}

/// Upload response
#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub upload_id: String,
    pub filename: String,
    pub size_bytes: u64,
    pub content_type: String,
}

/// Extraction request
#[derive(Debug, Deserialize)]
pub struct ExtractionRequest {
    pub upload_id: String,
    pub extraction_type: String,
    pub options: Option<ExtractionOptions>,
}

/// Extraction options
#[derive(Debug, Deserialize)]
pub struct ExtractionOptions {
    pub include_ocr: bool,
    pub detect_ambiguities: bool,
    pub confidence_threshold: Option<f32>,
}

/// Correction request
#[derive(Debug, Deserialize)]
pub struct CorrectionRequest {
    pub extraction_id: String,
    pub correction_type: String,
    pub entity_id: Option<String>,
    pub changes: std::collections::HashMap<String, String>,
}

/// Ambiguity resolution request
#[derive(Debug, Deserialize)]
pub struct AmbiguityResolutionRequest {
    pub extraction_id: String,
    pub ambiguity_id: String,
    pub selected_option: usize,
    pub notes: Option<String>,
}

// ============================================================================
// Upload Endpoints
// Engine-based Handlers
// ============================================================================

async fn upload_image_engine(
    State(_state): State<Arc<crate::AppState>>,
) -> Result<Json<UploadResponse>, StatusCode> {
    // Stub implementation - multipart upload would require additional dependencies
    let upload_id = Uuid::new_v4().to_string();

    Ok(Json(UploadResponse {
        upload_id,
        filename: "upload.png".to_string(),
        size_bytes: 0,
        content_type: "image/png".to_string(),
    }))
}

async fn extract_entities_engine(
    State(state): State<Arc<crate::AppState>>,
    Json(_payload): Json<ExtractionRequest>,
) -> Result<Json<ExtractionRecord>, StatusCode> {
    let extraction = state
        .ivkge_engine
        .process_screenshot(&[])
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(extraction_record_from_engine(extraction)))
}

async fn list_extractions_engine(
    State(state): State<Arc<crate::AppState>>,
) -> Json<Vec<ExtractionRecord>> {
    let extractions = state.ivkge_engine.get_extractions().await;
    Json(
        extractions
            .into_iter()
            .map(extraction_record_from_engine)
            .collect(),
    )
}

async fn get_extraction_engine(
    State(state): State<Arc<crate::AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ExtractionRecord>, StatusCode> {
    state
        .ivkge_engine
        .get_extraction(&id)
        .await
        .map(|e| Json(extraction_record_from_engine(e)))
        .ok_or(StatusCode::NOT_FOUND)
}

async fn apply_correction_engine(
    State(_state): State<Arc<crate::AppState>>,
    Json(_payload): Json<CorrectionRequest>,
) -> StatusCode {
    StatusCode::NOT_IMPLEMENTED
}

async fn get_corrections_engine(
    State(_state): State<Arc<crate::AppState>>,
    Path(_id): Path<String>,
) -> Json<Vec<CorrectionRecord>> {
    Json(vec![])
}

async fn resolve_ambiguity_engine(
    State(_state): State<Arc<crate::AppState>>,
    Json(_payload): Json<AmbiguityResolutionRequest>,
) -> StatusCode {
    StatusCode::NOT_IMPLEMENTED
}

fn extraction_record_from_engine(e: VisualExtractionResult) -> ExtractionRecord {
    ExtractionRecord {
        extraction_id: e.extraction_id,
        source_type: format!("{:?}", e.source_type),
        entities: e
            .entities
            .into_iter()
            .map(|ent| Entity {
                entity_id: ent.entity_id,
                name: ent.name,
                entity_type: ent.entity_type,
                confidence: ent.confidence,
                bounding_box: ent.bounding_box.map(|bb| BoundingBox {
                    x: bb.x,
                    y: bb.y,
                    width: bb.width,
                    height: bb.height,
                }),
                properties: ent.properties,
            })
            .collect(),
        relationships: e
            .relationships
            .into_iter()
            .map(|rel| Relationship {
                relationship_id: rel.relationship_id,
                source_entity: rel.source_entity,
                target_entity: rel.target_entity,
                relationship_type: rel.relationship_type,
                confidence: rel.confidence,
                label: rel.label,
            })
            .collect(),
        ocr_text: e.ocr_text,
        ambiguity_report: e.ambiguity_report.map(|ar| AmbiguityReport {
            report_id: ar.report_id,
            ambiguities: ar
                .ambiguities
                .into_iter()
                .map(|a| serde_json::to_value(a).unwrap_or_default())
                .collect(),
            overall_confidence: ar.overall_confidence,
        }),
        created_at: e.created_at,
    }
}

/// Health check endpoint
async fn ivkge_health_check_engine() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "ivkge-advanced"
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let response = ivkge_health_check_engine().await;
        assert_eq!(response.0["status"], "healthy");
    }
}
