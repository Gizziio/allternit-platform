//! Canvas API Routes (N20)
//!
//! Provides A2UI canvas operations for agent sessions.
//! Supports both A2UI component model and document/content model.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use super::{AgentApiState, ApiError};

/// Canvas type - supports both A2UI and Document modes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanvasType {
    /// A2UI component-based canvas
    A2UI,
    /// Document/content-based canvas
    Document,
    /// Code editor canvas
    Code,
    /// Terminal canvas
    Terminal,
    /// Visualization canvas
    Visualization,
}

/// Canvas document content (for document mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentContent {
    pub content: String,
    pub language: Option<String>,
    pub doc_type: String,
}

/// Canvas response
#[derive(Debug, Serialize, Clone)]
pub struct CanvasResponse {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub canvas_type: CanvasType,
    /// A2UI components (for A2UI mode)
    pub components: Option<Vec<Value>>,
    /// A2UI layout (for A2UI mode)
    pub layout: Option<Value>,
    /// Document content (for document/code/terminal modes)
    pub document: Option<DocumentContent>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: Option<HashMap<String, Value>>,
}

/// Create canvas request
#[derive(Debug, Deserialize)]
pub struct CreateCanvasRequest {
    pub session_id: String,
    pub title: Option<String>,
    pub canvas_type: Option<CanvasType>,
    /// A2UI layout (for A2UI mode)
    pub layout: Option<Value>,
    /// Document content (for document/code/terminal modes)
    pub content: Option<String>,
    pub language: Option<String>,
    pub metadata: Option<HashMap<String, Value>>,
}

/// Canvas operation request
#[derive(Debug, Deserialize)]
pub struct CanvasOperationBody {
    pub operation: String,
    /// For component operations
    pub component: Option<Value>,
    /// For document operations
    pub content: Option<String>,
    pub position: Option<Value>,
}

/// Canvas operation response
#[derive(Debug, Serialize)]
pub struct CanvasOperationResponse {
    pub success: bool,
    pub canvas_id: String,
    pub operation: String,
    pub result: Option<Value>,
}

/// Query parameters for listing canvases
#[derive(Debug, Deserialize)]
pub struct ListCanvasesQuery {
    pub session_id: Option<String>,
    pub canvas_type: Option<CanvasType>,
}

/// List canvases response
#[derive(Debug, Serialize)]
pub struct ListCanvasesResponse {
    pub canvases: Vec<CanvasResponse>,
    pub count: usize,
}

/// Create a new canvas
pub async fn create_canvas(
    State(state): State<AgentApiState>,
    Json(req): Json<CreateCanvasRequest>,
) -> Result<(StatusCode, Json<CanvasResponse>), (StatusCode, Json<ApiError>)> {
    let mut canvases = state.canvas.write().await;

    let canvas_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let canvas_type = req.canvas_type.unwrap_or(CanvasType::Document);

    let (components, layout, document) = match &canvas_type {
        CanvasType::A2UI => (Some(vec![]), req.layout, None),
        _ => {
            let doc = DocumentContent {
                content: req.content.unwrap_or_default(),
                language: req.language,
                doc_type: match canvas_type {
                    CanvasType::Code => "code".to_string(),
                    CanvasType::Terminal => "terminal".to_string(),
                    CanvasType::Visualization => "visualization".to_string(),
                    _ => "text".to_string(),
                },
            };
            (None, None, Some(doc))
        }
    };

    let canvas = CanvasResponse {
        id: canvas_id.clone(),
        session_id: req.session_id.clone(),
        title: req.title.unwrap_or_else(|| "Untitled Canvas".to_string()),
        canvas_type: canvas_type.clone(),
        components,
        layout,
        document,
        created_at: now.clone(),
        updated_at: now,
        metadata: req.metadata,
    };

    canvases.insert_canvas_api(canvas.clone()).await;

    Ok((StatusCode::CREATED, Json(canvas)))
}

/// List canvases with optional filtering
pub async fn list_canvases(
    State(state): State<AgentApiState>,
    Query(query): Query<ListCanvasesQuery>,
) -> Result<Json<ListCanvasesResponse>, (StatusCode, Json<ApiError>)> {
    let canvases = state.canvas.read().await;

    let mut result: Vec<CanvasResponse> = canvases.list_canvases_api().await;

    // Filter by session_id if provided
    if let Some(session_id) = query.session_id {
        result.retain(|c| c.session_id == session_id);
    }

    // Filter by canvas_type if provided
    if let Some(canvas_type) = query.canvas_type {
        result.retain(|c| {
            std::mem::discriminant(&c.canvas_type) == std::mem::discriminant(&canvas_type)
        });
    }

    let count = result.len();
    Ok(Json(ListCanvasesResponse {
        canvases: result,
        count,
    }))
}

/// Get canvas state
pub async fn get_canvas(
    State(state): State<AgentApiState>,
    Path(canvas_id): Path<String>,
) -> Result<Json<CanvasResponse>, (StatusCode, Json<ApiError>)> {
    let canvases = state.canvas.read().await;

    match canvases.get_canvas_api(&canvas_id).await {
        Some(canvas) => Ok(Json(canvas)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Canvas not found", "CANVAS_NOT_FOUND")),
        )),
    }
}

/// Execute a canvas operation
pub async fn canvas_operation(
    State(state): State<AgentApiState>,
    Path(canvas_id): Path<String>,
    Json(req): Json<CanvasOperationBody>,
) -> Result<Json<CanvasOperationResponse>, (StatusCode, Json<ApiError>)> {
    let mut canvases = state.canvas.write().await;

    // First check if canvas exists using read lock equivalent
    if canvases.get_canvas_api(&canvas_id).await.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Canvas not found", "CANVAS_NOT_FOUND")),
        ));
    }

    // Get mutable reference
    if let Some(canvas) = canvases.get_canvas_mut_api(&canvas_id) {
        let result = match req.operation.as_str() {
            "add_component" => {
                if let Some(component) = req.component {
                    // Convert JSON to A2UiComponent and add
                    canvas
                        .components
                        .push(crate::native_canvas_a2ui::A2UiComponent {
                            id: component
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            component_type: component
                                .get("type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            properties: component
                                .get("properties")
                                .and_then(|v| v.as_object())
                                .map(|obj| {
                                    obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
                                })
                                .unwrap_or_default(),
                            children: None,
                            timestamp: Utc::now(),
                            metadata: None,
                        });
                    Some(serde_json::json!({"added": true}))
                } else {
                    None
                }
            }
            "remove_component" => {
                // Would need component ID in request
                None
            }
            "update_layout" => {
                if let Some(layout) = req.component {
                    canvas.metadata = Some(
                        layout
                            .as_object()
                            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                            .unwrap_or_default(),
                    );
                    Some(serde_json::json!({"updated": true}))
                } else {
                    None
                }
            }
            "update_content" => {
                // Not applicable for A2UI canvas - use document mode
                None
            }
            "append_content" => {
                // Not applicable for A2UI canvas - use document mode
                None
            }
            _ => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ApiError::new(
                        format!("Unknown operation: {}", req.operation),
                        "INVALID_OPERATION",
                    )),
                ));
            }
        };

        canvas.updated_at = Utc::now();

        Ok(Json(CanvasOperationResponse {
            success: true,
            canvas_id,
            operation: req.operation,
            result,
        }))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Canvas not found", "CANVAS_NOT_FOUND")),
        ))
    }
}

/// Delete a canvas
pub async fn delete_canvas(
    State(state): State<AgentApiState>,
    Path(canvas_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ApiError>)> {
    let mut canvases = state.canvas.write().await;

    match canvases.remove_canvas_api(&canvas_id).await {
        true => Ok(StatusCode::NO_CONTENT),
        false => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::new("Canvas not found", "CANVAS_NOT_FOUND")),
        )),
    }
}
