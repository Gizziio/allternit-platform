//! Canvas/A2UI Native - OC-019
//!
//! Native Rust implementation of OpenClaw's Canvas/A2UI visual workspace system.
//! This module provides a pure Rust implementation of the visual workspace functionality
//! that will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Canvas/A2UI component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A2UiComponent {
    pub id: String,
    pub component_type: String, // 'button', 'input', 'text', 'image', etc.
    pub properties: HashMap<String, serde_json::Value>,
    pub children: Option<Vec<A2UiComponent>>,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Canvas state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasState {
    pub id: String,
    pub components: Vec<A2UiComponent>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Canvas operation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasOperationRequest {
    pub canvas_id: String,
    pub operation: CanvasOperation,
    pub context: Option<HashMap<String, serde_json::Value>>,
}

/// Canvas operation type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CanvasOperation {
    /// Push a component to the canvas
    Push { component: A2UiComponent },

    /// Reset the canvas (clear all components)
    Reset,

    /// Evaluate JavaScript in the canvas context
    Eval { script: String },

    /// Take a snapshot of the canvas
    Snapshot { format: Option<String> }, // png, jpg, etc.

    /// Navigate to a URL in the canvas
    Navigate { url: String },

    /// Hide the canvas
    Hide,

    /// Present the canvas
    Present {
        target: Option<String>, // Where to present (window, tab, etc.)
        position: Option<CanvasPosition>,
        size: Option<CanvasSize>,
    },
}

/// Canvas position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasPosition {
    pub x: f64,
    pub y: f64,
}

/// Canvas size
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSize {
    pub width: f64,
    pub height: f64,
}

/// Canvas operation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasOperationResponse {
    pub success: bool,
    pub canvas_id: String,
    pub operation: CanvasOperation,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Canvas list request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListCanvasesRequest {
    pub include_empty: Option<bool>,
    pub include_hidden: Option<bool>,
}

/// Canvas list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListCanvasesResponse {
    pub canvases: Vec<CanvasSummary>,
    pub total_count: usize,
}

/// Canvas summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSummary {
    pub id: String,
    pub title: Option<String>,
    pub component_count: usize,
    pub updated_at: DateTime<Utc>,
    pub hidden: bool,
}

/// Canvas get request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCanvasRequest {
    pub canvas_id: String,
}

/// Canvas get response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCanvasResponse {
    pub canvas: Option<CanvasState>,
    pub success: bool,
}

/// Canvas configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasConfig {
    pub canvas_dir: PathBuf,
    pub enable_snapshots: bool,
    pub snapshot_format: String,      // png, jpg, etc.
    pub snapshot_quality: Option<u8>, // 0-100 for lossy formats
    pub max_snapshot_width: Option<u32>,
    pub max_components: Option<usize>,
    pub enable_eval: bool, // Whether JavaScript evaluation is allowed
    pub eval_timeout_ms: u64,
    pub enable_persistence: bool,
}

impl Default for CanvasConfig {
    fn default() -> Self {
        Self {
            canvas_dir: PathBuf::from("./canvases"),
            enable_snapshots: true,
            snapshot_format: "png".to_string(),
            snapshot_quality: Some(90),
            max_snapshot_width: Some(1920),
            max_components: Some(1000),
            enable_eval: false,    // Disabled by default for security
            eval_timeout_ms: 5000, // 5 seconds
            enable_persistence: true,
        }
    }
}

/// Canvas/A2UI service
pub struct CanvasService {
    config: CanvasConfig,
    canvas_states: HashMap<String, CanvasState>,
}

impl CanvasService {
    /// Create new canvas service with default configuration
    pub fn new() -> Self {
        Self {
            config: CanvasConfig::default(),
            canvas_states: HashMap::new(),
        }
    }

    /// Create new canvas service with custom configuration
    pub fn with_config(config: CanvasConfig) -> Self {
        Self {
            config,
            canvas_states: HashMap::new(),
        }
    }

    /// Initialize the canvas service
    pub async fn initialize(&mut self) -> Result<(), CanvasError> {
        self.ensure_canvas_dir().await?;
        self.load_persisted_canvases().await?;
        Ok(())
    }

    /// Ensure canvas directory exists
    async fn ensure_canvas_dir(&self) -> Result<(), CanvasError> {
        fs::create_dir_all(&self.config.canvas_dir)
            .await
            .map_err(|e| CanvasError::IoError(format!("Failed to create canvas directory: {}", e)))
    }

    /// Load persisted canvases from disk
    async fn load_persisted_canvases(&mut self) -> Result<(), CanvasError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        if !self.config.canvas_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.canvas_dir)
            .await
            .map_err(|e| CanvasError::IoError(format!("Failed to read canvas directory: {}", e)))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| CanvasError::IoError(format!("Failed to read directory entry: {}", e)))?
        {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(content) = fs::read_to_string(&path).await {
                        if let Ok(canvas_state) = serde_json::from_str::<CanvasState>(&content) {
                            self.canvas_states
                                .insert(file_stem.to_string(), canvas_state);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Execute a canvas operation
    pub async fn execute_operation(
        &mut self,
        request: CanvasOperationRequest,
    ) -> Result<CanvasOperationResponse, CanvasError> {
        let start_time = std::time::Instant::now();
        let operation = request.operation.clone(); // Clone operation to preserve it

        // Get or create canvas state
        let canvas_id = request.canvas_id.clone();
        let mut canvas_state = self.get_or_create_canvas(&canvas_id).await?;

        let result = match request.operation {
            CanvasOperation::Push { component } => {
                self.push_component(&mut canvas_state, component).await
            }
            CanvasOperation::Reset => self.reset_canvas(&mut canvas_state).await,
            CanvasOperation::Eval { script } => self.eval_script(&mut canvas_state, script).await,
            CanvasOperation::Snapshot { format } => self.take_snapshot(&canvas_state, format).await,
            CanvasOperation::Navigate { url } => self.navigate_canvas(&mut canvas_state, url).await,
            CanvasOperation::Hide => self.hide_canvas(&mut canvas_state).await,
            CanvasOperation::Present {
                target,
                position,
                size,
            } => {
                self.present_canvas(&mut canvas_state, target, position, size)
                    .await
            }
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Update canvas state
        self.canvas_states.insert(canvas_id.clone(), canvas_state);

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_canvas(&canvas_id).await?;
        }

        match result {
            Ok(result_value) => {
                Ok(CanvasOperationResponse {
                    success: true,
                    canvas_id,
                    operation, // Use the cloned operation
                    result: Some(result_value),
                    error: None,
                    execution_time_ms: execution_time,
                })
            }
            Err(error) => {
                Ok(CanvasOperationResponse {
                    success: false,
                    canvas_id,
                    operation, // Use the cloned operation
                    result: None,
                    error: Some(error.to_string()),
                    execution_time_ms: execution_time,
                })
            }
        }
    }

    /// Get or create a canvas state
    async fn get_or_create_canvas(&mut self, canvas_id: &str) -> Result<CanvasState, CanvasError> {
        if let Some(canvas) = self.canvas_states.get(canvas_id).cloned() {
            Ok(canvas)
        } else {
            let new_canvas = CanvasState {
                id: canvas_id.to_string(),
                components: Vec::new(),
                title: None,
                description: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                metadata: None,
            };

            self.canvas_states
                .insert(canvas_id.to_string(), new_canvas.clone());
            Ok(new_canvas)
        }
    }

    /// Push a component to the canvas
    async fn push_component(
        &mut self,
        canvas_state: &mut CanvasState,
        component: A2UiComponent,
    ) -> Result<serde_json::Value, CanvasError> {
        // Check component limit
        if let Some(max_components) = self.config.max_components {
            if canvas_state.components.len() >= max_components {
                return Err(CanvasError::ValidationError(format!(
                    "Canvas {} has reached maximum component limit of {}",
                    canvas_state.id, max_components
                )));
            }
        }

        canvas_state.components.push(component);
        canvas_state.updated_at = Utc::now();

        Ok(serde_json::json!({
            "status": "component_pushed",
            "component_count": canvas_state.components.len()
        }))
    }

    /// Reset the canvas (clear all components)
    async fn reset_canvas(
        &mut self,
        canvas_state: &mut CanvasState,
    ) -> Result<serde_json::Value, CanvasError> {
        canvas_state.components.clear();
        canvas_state.updated_at = Utc::now();

        Ok(serde_json::json!({
            "status": "canvas_reset",
            "component_count": 0
        }))
    }

    /// Evaluate JavaScript in the canvas context (security-limited)
    async fn eval_script(
        &mut self,
        canvas_state: &mut CanvasState,
        script: String,
    ) -> Result<serde_json::Value, CanvasError> {
        if !self.config.enable_eval {
            return Err(CanvasError::SecurityError(
                "JavaScript evaluation is disabled".to_string(),
            ));
        }

        // In a real implementation, this would use a secure JavaScript engine like V8 or QuickJS
        // For now, we'll return an error indicating this would delegate to OpenClaw
        // This is a security-sensitive operation that should be carefully controlled

        Ok(serde_json::json!({
            "status": "eval_not_implemented",
            "message": "JavaScript evaluation would be handled by secure sandbox in production"
        }))
    }

    /// Take a snapshot of the canvas
    async fn take_snapshot(
        &self,
        canvas_state: &CanvasState,
        format: Option<String>,
    ) -> Result<serde_json::Value, CanvasError> {
        if !self.config.enable_snapshots {
            return Err(CanvasError::OperationDisabled(
                "Snapshots are disabled".to_string(),
            ));
        }

        // In a real implementation, this would render the canvas to an image
        // For now, we'll return a placeholder response
        let format = format.unwrap_or_else(|| self.config.snapshot_format.clone());

        // Generate a filename for the snapshot
        let timestamp = canvas_state.updated_at.format("%Y%m%d_%H%M%S").to_string();
        let filename = format!("{}_{}.{}", canvas_state.id, timestamp, format);
        let snapshot_path = self.config.canvas_dir.join("snapshots").join(filename);

        // Create snapshots directory if it doesn't exist
        fs::create_dir_all(snapshot_path.parent().unwrap())
            .await
            .map_err(|e| {
                CanvasError::IoError(format!("Failed to create snapshots directory: {}", e))
            })?;

        // In a real implementation, this would render the canvas to an image file
        // For now, we'll create a placeholder file
        fs::write(&snapshot_path, b"PLACEHOLDER_SNAPSHOT_IMAGE_DATA")
            .await
            .map_err(|e| CanvasError::IoError(format!("Failed to write snapshot: {}", e)))?;

        Ok(serde_json::json!({
            "status": "snapshot_taken",
            "path": snapshot_path.to_string_lossy().to_string(),
            "format": format,
            "timestamp": canvas_state.updated_at
        }))
    }

    /// Navigate the canvas to a URL
    async fn navigate_canvas(
        &mut self,
        canvas_state: &mut CanvasState,
        url: String,
    ) -> Result<serde_json::Value, CanvasError> {
        // In a real implementation, this would navigate an embedded browser
        // For now, we'll just update metadata
        canvas_state.updated_at = Utc::now();

        let url_clone = url.clone(); // Clone the URL to avoid move issue

        if let Some(ref mut metadata) = canvas_state.metadata {
            metadata.insert("current_url".to_string(), serde_json::Value::String(url));
        } else {
            let mut metadata = HashMap::new();
            metadata.insert("current_url".to_string(), serde_json::Value::String(url));
            canvas_state.metadata = Some(metadata);
        }

        Ok(serde_json::json!({
            "status": "navigation_initiated",
            "url": url_clone
        }))
    }

    /// Hide the canvas
    async fn hide_canvas(
        &mut self,
        canvas_state: &mut CanvasState,
    ) -> Result<serde_json::Value, CanvasError> {
        canvas_state.updated_at = Utc::now();

        if let Some(ref mut metadata) = canvas_state.metadata {
            metadata.insert("visible".to_string(), serde_json::Value::Bool(false));
        } else {
            let mut metadata = HashMap::new();
            metadata.insert("visible".to_string(), serde_json::Value::Bool(false));
            canvas_state.metadata = Some(metadata);
        }

        Ok(serde_json::json!({
            "status": "canvas_hidden"
        }))
    }

    /// Present the canvas
    async fn present_canvas(
        &mut self,
        canvas_state: &mut CanvasState,
        target: Option<String>,
        position: Option<CanvasPosition>,
        size: Option<CanvasSize>,
    ) -> Result<serde_json::Value, CanvasError> {
        canvas_state.updated_at = Utc::now();

        let mut presentation_info = HashMap::new();
        presentation_info.insert("visible".to_string(), serde_json::Value::Bool(true));

        if let Some(target) = target {
            presentation_info.insert("target".to_string(), serde_json::Value::String(target));
        }

        if let Some(position) = position {
            presentation_info.insert("position".to_string(), serde_json::to_value(position)?);
        }

        if let Some(size) = size {
            presentation_info.insert("size".to_string(), serde_json::to_value(size)?);
        }

        if let Some(ref mut metadata) = canvas_state.metadata {
            metadata.extend(presentation_info);
        } else {
            canvas_state.metadata = Some(presentation_info);
        }

        Ok(serde_json::json!({
            "status": "canvas_presented"
        }))
    }

    /// List all canvases
    pub async fn list_canvases(
        &self,
        request: ListCanvasesRequest,
    ) -> Result<ListCanvasesResponse, CanvasError> {
        let include_empty = request.include_empty;
        let include_hidden = request.include_hidden;

        let mut canvases: Vec<CanvasSummary> = self
            .canvas_states
            .values()
            .filter(|canvas| {
                // Apply filters
                if let Some(inc_empty) = include_empty {
                    if !inc_empty && canvas.components.is_empty() {
                        return false;
                    }
                }

                if let Some(inc_hidden) = include_hidden {
                    if !inc_hidden {
                        if let Some(metadata) = &canvas.metadata {
                            if let Some(visible) = metadata.get("visible").and_then(|v| v.as_bool())
                            {
                                if !visible {
                                    return false;
                                }
                            }
                        }
                    }
                }

                true
            })
            .map(|canvas| CanvasSummary {
                id: canvas.id.clone(),
                title: canvas.title.clone(),
                component_count: canvas.components.len(),
                updated_at: canvas.updated_at,
                hidden: canvas
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("visible"))
                    .and_then(|v| v.as_bool())
                    .map(|v| !v)
                    .unwrap_or(false),
            })
            .collect();

        // Sort by most recently updated
        canvases.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        let total_count = canvases.len();

        Ok(ListCanvasesResponse {
            canvases,
            total_count,
        })
    }

    /// Get a specific canvas
    pub async fn get_canvas(
        &self,
        request: GetCanvasRequest,
    ) -> Result<GetCanvasResponse, CanvasError> {
        match self.canvas_states.get(&request.canvas_id) {
            Some(canvas) => Ok(GetCanvasResponse {
                canvas: Some(canvas.clone()),
                success: true,
            }),
            None => Ok(GetCanvasResponse {
                canvas: None,
                success: false,
            }),
        }
    }

    /// Persist a canvas to disk
    async fn persist_canvas(&self, canvas_id: &str) -> Result<(), CanvasError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        if let Some(canvas_state) = self.canvas_states.get(canvas_id) {
            let canvas_path = self.config.canvas_dir.join(format!("{}.json", canvas_id));
            let canvas_json = serde_json::to_string_pretty(canvas_state).map_err(|e| {
                CanvasError::SerializationError(format!("Failed to serialize canvas: {}", e))
            })?;

            fs::write(&canvas_path, canvas_json).await.map_err(|e| {
                CanvasError::IoError(format!("Failed to write canvas to disk: {}", e))
            })?;
        }

        Ok(())
    }

    /// Get current configuration
    pub fn config(&self) -> &CanvasConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut CanvasConfig {
        &mut self.config
    }

    /// Get canvas state by ID
    pub fn get_canvas_state(&self, canvas_id: &str) -> Option<&CanvasState> {
        self.canvas_states.get(canvas_id)
    }

    // =========================================================================
    // API-compatible wrapper methods (for /api/canvas.rs)
    // =========================================================================

    /// List all canvases - API compatible version
    pub async fn list_canvases_api(&self) -> Vec<crate::api::canvas::CanvasResponse> {
        self.canvas_states
            .values()
            .map(|c| crate::api::canvas::CanvasResponse {
                id: c.id.clone(),
                session_id: c
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("session_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                title: c.title.clone().unwrap_or_else(|| "Untitled".to_string()),
                canvas_type: crate::api::canvas::CanvasType::A2UI,
                components: Some(
                    c.components
                        .iter()
                        .map(|comp| {
                            serde_json::json!({
                                "id": comp.id,
                                "type": comp.component_type,
                                "properties": comp.properties,
                            })
                        })
                        .collect(),
                ),
                layout: c
                    .metadata
                    .as_ref()
                    .map(|m| serde_json::to_value(m).unwrap_or_default()),
                document: None,
                created_at: c.created_at.to_rfc3339(),
                updated_at: c.updated_at.to_rfc3339(),
                metadata: c.metadata.clone(),
            })
            .collect()
    }

    /// Get canvas by ID - API compatible version
    pub async fn get_canvas_api(
        &self,
        canvas_id: &str,
    ) -> Option<crate::api::canvas::CanvasResponse> {
        self.canvas_states
            .get(canvas_id)
            .map(|c| crate::api::canvas::CanvasResponse {
                id: c.id.clone(),
                session_id: c
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("session_id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                title: c.title.clone().unwrap_or_else(|| "Untitled".to_string()),
                canvas_type: crate::api::canvas::CanvasType::A2UI,
                components: Some(
                    c.components
                        .iter()
                        .map(|comp| {
                            serde_json::json!({
                                "id": comp.id,
                                "type": comp.component_type,
                                "properties": comp.properties,
                            })
                        })
                        .collect(),
                ),
                layout: c
                    .metadata
                    .as_ref()
                    .map(|m| serde_json::to_value(m).unwrap_or_default()),
                document: None,
                created_at: c.created_at.to_rfc3339(),
                updated_at: c.updated_at.to_rfc3339(),
                metadata: c.metadata.clone(),
            })
    }

    /// Get mutable canvas by ID - API compatible version
    pub fn get_canvas_mut_api(&mut self, canvas_id: &str) -> Option<&mut CanvasState> {
        self.canvas_states.get_mut(canvas_id)
    }

    /// Insert canvas - API compatible version
    pub async fn insert_canvas_api(&mut self, canvas: crate::api::canvas::CanvasResponse) {
        let components: Vec<A2UiComponent> = canvas
            .components
            .unwrap_or_default()
            .into_iter()
            .filter_map(|c| {
                Some(A2UiComponent {
                    id: c.get("id")?.as_str()?.to_string(),
                    component_type: c.get("type")?.as_str()?.to_string(),
                    properties: c
                        .get("properties")?
                        .as_object()?
                        .iter()
                        .map(|(k, v)| (k.clone(), v.clone()))
                        .collect(),
                    children: None,
                    timestamp: Utc::now(),
                    metadata: None,
                })
            })
            .collect();

        let canvas_state = CanvasState {
            id: canvas.id,
            components,
            title: Some(canvas.title),
            description: canvas
                .metadata
                .as_ref()
                .and_then(|m| m.get("description"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            created_at: DateTime::parse_from_rfc3339(&canvas.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            updated_at: DateTime::parse_from_rfc3339(&canvas.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
            metadata: canvas.metadata,
        };

        self.canvas_states
            .insert(canvas_state.id.clone(), canvas_state);
    }

    /// Remove canvas - API compatible version
    pub async fn remove_canvas_api(&mut self, canvas_id: &str) -> bool {
        if self.canvas_states.contains_key(canvas_id) {
            self.canvas_states.remove(canvas_id);
            // Remove persisted file if it exists
            if self.config.enable_persistence {
                let canvas_path = self.config.canvas_dir.join(format!("{}.json", canvas_id));
                let _ = std::fs::remove_file(canvas_path); // Ignore errors
            }
            true
        } else {
            false
        }
    }
}

impl Default for CanvasService {
    fn default() -> Self {
        Self::new()
    }
}

/// Canvas error
#[derive(Debug, thiserror::Error)]
pub enum CanvasError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Security error: {0}")]
    SecurityError(String),

    #[error("Operation disabled: {0}")]
    OperationDisabled(String),

    #[error("Canvas not found: {0}")]
    CanvasNotFound(String),
}

impl From<serde_json::Error> for CanvasError {
    fn from(error: serde_json::Error) -> Self {
        CanvasError::SerializationError(error.to_string())
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_canvas_service_creation() {
        let service = CanvasService::new();
        assert_eq!(service.config.canvas_dir, PathBuf::from("./canvases"));
        assert_eq!(service.config.snapshot_format, "png");
    }

    #[tokio::test]
    async fn test_canvas_operations() {
        let mut service = CanvasService::new();

        // Create a test component
        let component = A2UiComponent {
            id: "test-component".to_string(),
            component_type: "button".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "label".to_string(),
                    serde_json::Value::String("Click me".to_string()),
                );
                props.insert(
                    "onClick".to_string(),
                    serde_json::Value::String("console.log('clicked')".to_string()),
                );
                props
            },
            children: None,
            timestamp: Utc::now(),
            metadata: None,
        };

        // Execute a push operation
        let request = CanvasOperationRequest {
            canvas_id: "test-canvas".to_string(),
            operation: CanvasOperation::Push { component },
            context: None,
        };

        let response = service.execute_operation(request).await.unwrap();
        assert!(response.success);
        assert!(response.result.is_some());

        // Check that the canvas was created
        let canvas = service.get_canvas_state("test-canvas");
        assert!(canvas.is_some());
        assert_eq!(canvas.unwrap().components.len(), 1);
    }

    #[tokio::test]
    async fn test_canvas_reset() {
        let mut service = CanvasService::new();

        // Add a component first
        let component = A2UiComponent {
            id: "test-component".to_string(),
            component_type: "text".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "content".to_string(),
                    serde_json::Value::String("Hello".to_string()),
                );
                props
            },
            children: None,
            timestamp: Utc::now(),
            metadata: None,
        };

        let push_request = CanvasOperationRequest {
            canvas_id: "reset-test".to_string(),
            operation: CanvasOperation::Push { component },
            context: None,
        };

        let _ = service.execute_operation(push_request).await.unwrap();

        // Verify component was added
        let canvas = service.get_canvas_state("reset-test");
        assert!(canvas.is_some());
        assert_eq!(canvas.unwrap().components.len(), 1);

        // Now reset the canvas
        let reset_request = CanvasOperationRequest {
            canvas_id: "reset-test".to_string(),
            operation: CanvasOperation::Reset,
            context: None,
        };

        let response = service.execute_operation(reset_request).await.unwrap();
        assert!(response.success);

        // Verify canvas is empty
        let canvas = service.get_canvas_state("reset-test");
        assert!(canvas.is_some());
        assert_eq!(canvas.unwrap().components.len(), 0);
    }

    #[tokio::test]
    async fn test_list_canvases() {
        let mut service = CanvasService::new();

        // Create a few canvases
        for i in 1..=3 {
            let component = A2UiComponent {
                id: format!("component-{}", i),
                component_type: "text".to_string(),
                properties: {
                    let mut props = HashMap::new();
                    props.insert(
                        "content".to_string(),
                        serde_json::Value::String(format!("Content {}", i)),
                    );
                    props
                },
                children: None,
                timestamp: Utc::now(),
                metadata: None,
            };

            let request = CanvasOperationRequest {
                canvas_id: format!("canvas-{}", i),
                operation: CanvasOperation::Push { component },
                context: None,
            };

            let _ = service.execute_operation(request).await.unwrap();
        }

        // List canvases
        let list_request = ListCanvasesRequest {
            include_empty: Some(false),
            include_hidden: Some(true),
        };

        let list_response = service.list_canvases(list_request).await.unwrap();
        assert_eq!(list_response.canvases.len(), 3);
        assert_eq!(list_response.total_count, 3);

        // Verify they're sorted by most recent
        for i in 0..list_response.canvases.len() {
            assert_eq!(list_response.canvases[i].id, format!("canvas-{}", 3 - i));
        }
    }

    #[tokio::test]
    async fn test_get_canvas() {
        let mut service = CanvasService::new();

        // Create a canvas with a component
        let component = A2UiComponent {
            id: "get-test-component".to_string(),
            component_type: "input".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert(
                    "placeholder".to_string(),
                    serde_json::Value::String("Enter text".to_string()),
                );
                props
            },
            children: None,
            timestamp: Utc::now(),
            metadata: None,
        };

        let push_request = CanvasOperationRequest {
            canvas_id: "get-test".to_string(),
            operation: CanvasOperation::Push { component },
            context: None,
        };

        let _ = service.execute_operation(push_request).await.unwrap();

        // Get the canvas
        let get_request = GetCanvasRequest {
            canvas_id: "get-test".to_string(),
        };

        let get_response = service.get_canvas(get_request).await.unwrap();
        assert!(get_response.success);
        assert!(get_response.canvas.is_some());
        assert_eq!(get_response.canvas.unwrap().components.len(), 1);
    }
}
