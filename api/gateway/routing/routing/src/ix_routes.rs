//! A2R-IX (Interface eXecution) API Routes
//!
//! Provides REST API endpoints for LLM-generated UI:
//! - POST /ix/capsules - Create IX capsule from UI definition
//! - POST /ix/capsules/json-render - Create from Vercel json-render format
//! - GET /ix/capsules/:id - Get capsule state
//! - POST /ix/capsules/:id/patch - Apply JSON Patch updates
//! - POST /ix/capsules/:id/action - Dispatch action
//! - GET /ix/capsules/:id/stream - SSE stream for state changes
//! - DELETE /ix/capsules/:id - Close capsule

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use futures_util::stream::{self, BoxStream, Stream, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tokio::time::{interval, Duration};
use tracing::{debug, info, warn};
use uuid::Uuid;

/// IX Capsule Registry
pub struct IXCapsuleRegistry {
    capsules: RwLock<HashMap<String, IXCapsuleEntry>>,
}

impl IXCapsuleRegistry {
    pub fn new() -> Self {
        Self {
            capsules: RwLock::new(HashMap::new()),
        }
    }

    pub async fn create(&self, config: IXCapsuleConfig) -> String {
        let id = Uuid::new_v4().to_string();
        let (event_tx, _) = broadcast::channel(100);

        let entry = IXCapsuleEntry {
            id: id.clone(),
            ui: config.ui,
            state: config.initial_state.unwrap_or_default(),
            event_tx: event_tx.clone(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::seconds(config.ttl_seconds as i64),
        };

        let mut capsules = self.capsules.write().await;
        capsules.insert(id.clone(), entry);

        // Emit mount event
        let _ = event_tx.send(IXCapsuleEvent {
            event_type: "lifecycle".to_string(),
            capsule_id: id.clone(),
            lifecycle: Some("mount".to_string()),
            ..Default::default()
        });

        id
    }

    pub async fn get(&self, id: &str) -> Option<IXCapsuleEntry> {
        let capsules = self.capsules.read().await;
        capsules.get(id).cloned()
    }

    pub async fn apply_patch(&self, id: &str, patch: JsonPatch) -> Result<(), String> {
        let mut capsules = self.capsules.write().await;

        if let Some(entry) = capsules.get_mut(id) {
            // Apply each operation
            for op in patch.operations {
                match op.op.as_str() {
                    "add" | "replace" => {
                        if let Some(value) = op.value {
                            set_path(&mut entry.state, &op.path, value);
                        }
                    }
                    "remove" => {
                        remove_path(&mut entry.state, &op.path);
                    }
                    _ => {}
                }
            }

            entry.updated_at = Utc::now();

            // Emit state change event
            let _ = entry.event_tx.send(IXCapsuleEvent {
                event_type: "state-change".to_string(),
                capsule_id: id.to_string(),
                state_update: Some(entry.state.clone()),
                ..Default::default()
            });

            Ok(())
        } else {
            Err("Capsule not found".to_string())
        }
    }

    pub async fn dispatch_action(&self, id: &str, action: ActionDispatch) -> Result<(), String> {
        let capsules = self.capsules.read().await;

        if let Some(entry) = capsules.get(id) {
            // Emit action event
            let _ = entry.event_tx.send(IXCapsuleEvent {
                event_type: "action".to_string(),
                capsule_id: id.to_string(),
                action: Some(action.action_id),
                action_params: action.params,
                ..Default::default()
            });

            Ok(())
        } else {
            Err("Capsule not found".to_string())
        }
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        let mut capsules = self.capsules.write().await;

        if let Some(entry) = capsules.get(id) {
            // Emit unmount event
            let _ = entry.event_tx.send(IXCapsuleEvent {
                event_type: "lifecycle".to_string(),
                capsule_id: id.to_string(),
                lifecycle: Some("unmount".to_string()),
                ..Default::default()
            });
        }

        capsules.remove(id);
        Ok(())
    }

    pub async fn event_stream(&self, id: &str) -> Option<broadcast::Receiver<IXCapsuleEvent>> {
        let capsules = self.capsules.read().await;
        capsules.get(id).map(|entry| entry.event_tx.subscribe())
    }
}

/// IX Capsule Entry
#[derive(Clone)]
pub struct IXCapsuleEntry {
    pub id: String,
    pub ui: UIRoot,
    pub state: serde_json::Value,
    pub event_tx: broadcast::Sender<IXCapsuleEvent>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
    pub expires_at: chrono::DateTime<Utc>,
}

/// IX Capsule Configuration
#[derive(Debug, Deserialize)]
pub struct IXCapsuleConfig {
    /// UI definition
    pub ui: UIRoot,
    /// Initial state
    #[serde(default)]
    pub initial_state: Option<serde_json::Value>,
    /// TTL in seconds (default: 3600)
    #[serde(default = "default_ix_ttl")]
    pub ttl_seconds: u64,
}

fn default_ix_ttl() -> u64 {
    3600
}

/// UI Root Definition
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UIRoot {
    /// Schema version
    pub version: String,
    /// Component tree
    pub components: Vec<UIComponent>,
    /// State definitions
    pub state: UIState,
    /// Action handlers
    pub actions: Vec<UIAction>,
    /// Custom CSS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
}

/// UI Component
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UIComponent {
    /// Unique component ID
    pub id: String,
    /// Component type
    #[serde(rename = "type")]
    pub component_type: String,
    /// Component properties
    #[serde(default)]
    pub props: serde_json::Value,
    /// Child components
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<UIComponent>>,
    /// State bindings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bindings: Option<Vec<StateBinding>>,
    /// Event handlers
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events: Option<Vec<EventHandler>>,
}

/// State Binding
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StateBinding {
    pub prop: String,
    pub state_path: String,
    pub direction: String,
}

/// Event Handler
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct EventHandler {
    pub event: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// UI State
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UIState {
    pub variables: Vec<StateVariable>,
}

/// State Variable
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StateVariable {
    pub path: String,
    #[serde(rename = "type")]
    pub var_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
}

/// UI Action
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UIAction {
    pub id: String,
    #[serde(rename = "type")]
    pub action_type: String,
    pub handler: serde_json::Value,
}

/// JSON Patch
#[derive(Debug, Deserialize)]
pub struct JsonPatch {
    pub operations: Vec<PatchOperation>,
}

/// Patch Operation (RFC 6902)
#[derive(Debug, Deserialize)]
pub struct PatchOperation {
    pub op: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
}

/// Action Dispatch
#[derive(Debug, Deserialize)]
pub struct ActionDispatch {
    pub action_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// IX Capsule Event
#[derive(Debug, Serialize, Clone, Default)]
pub struct IXCapsuleEvent {
    pub event_type: String,
    pub capsule_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lifecycle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_update: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Create IX capsule from UI definition
async fn create_ix_capsule(
    State(state): State<Arc<AppState>>,
    Json(config): Json<IXCapsuleConfig>,
) -> Result<Json<CreateCapsuleResponse>, (StatusCode, String)> {
    info!("Creating IX capsule");

    let id = state.ix_capsule_registry.create(config).await;

    Ok(Json(CreateCapsuleResponse {
        capsule_id: id,
        status: "created".to_string(),
    }))
}

/// Create from json-render format
async fn create_from_json_render(
    State(state): State<Arc<AppState>>,
    Json(req): Json<JsonRenderRequest>,
) -> Result<Json<CreateCapsuleResponse>, (StatusCode, String)> {
    info!("Creating IX capsule from json-render");

    // Convert json-render to UIRoot
    let ui = convert_json_render_to_ui(req.schema)?;

    let config = IXCapsuleConfig {
        ui,
        initial_state: req.initial_state,
        ttl_seconds: req.ttl_seconds.unwrap_or_else(default_ix_ttl),
    };

    let id = state.ix_capsule_registry.create(config).await;

    Ok(Json(CreateCapsuleResponse {
        capsule_id: id,
        status: "created".to_string(),
    }))
}

/// Get capsule state
async fn get_ix_capsule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CapsuleStateResponse>, (StatusCode, String)> {
    if let Some(entry) = state.ix_capsule_registry.get(&id).await {
        Ok(Json(CapsuleStateResponse {
            capsule_id: id,
            ui: entry.ui,
            state: entry.state,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        }))
    } else {
        Err((StatusCode::NOT_FOUND, "Capsule not found".to_string()))
    }
}

/// Apply JSON Patch
async fn apply_patch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(patch): Json<JsonPatch>,
) -> Result<Json<PatchResponse>, (StatusCode, String)> {
    match state.ix_capsule_registry.apply_patch(&id, patch).await {
        Ok(_) => Ok(Json(PatchResponse {
            success: true,
            message: "Patch applied".to_string(),
        })),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

/// Dispatch action
async fn dispatch_action(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(action): Json<ActionDispatch>,
) -> Result<Json<ActionResponse>, (StatusCode, String)> {
    match state.ix_capsule_registry.dispatch_action(&id, action).await {
        Ok(_) => Ok(Json(ActionResponse {
            success: true,
            message: "Action dispatched".to_string(),
        })),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

/// SSE stream for capsule events
async fn event_stream(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.ix_capsule_registry.event_stream(&id).await;

    let stream: BoxStream<'static, Result<Event, Infallible>> = match rx {
        Some(rx) => {
            tokio::spawn(async move {
                // Cleanup when client disconnects
                // Note: Actual cleanup happens via TTL
            });

            stream::unfold(rx, |mut rx| async move {
                match rx.recv().await {
                    Ok(event) => {
                        let event_json = serde_json::to_string(&event).unwrap_or_default();
                        let sse_event = Event::default().data(event_json);
                        Some((Ok(sse_event), rx))
                    }
                    Err(_) => {
                        // Channel closed or lagged
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        Some((Ok(Event::default().comment("heartbeat")), rx))
                    }
                }
            })
            .boxed()
        }
        None => {
            // Capsule not found, return empty stream
            stream::empty().boxed()
        }
    };

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

/// Delete capsule
async fn delete_ix_capsule(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    match state.ix_capsule_registry.delete(&id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => Err((StatusCode::NOT_FOUND, e)),
    }
}

/// Json-render request
#[derive(Debug, Deserialize)]
pub struct JsonRenderRequest {
    pub schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_state: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl_seconds: Option<u64>,
}

/// Create capsule response
#[derive(Debug, Serialize)]
pub struct CreateCapsuleResponse {
    pub capsule_id: String,
    pub status: String,
}

/// Capsule state response
#[derive(Debug, Serialize)]
pub struct CapsuleStateResponse {
    pub capsule_id: String,
    pub ui: UIRoot,
    pub state: serde_json::Value,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

/// Patch response
#[derive(Debug, Serialize)]
pub struct PatchResponse {
    pub success: bool,
    pub message: String,
}

/// Action response
#[derive(Debug, Serialize)]
pub struct ActionResponse {
    pub success: bool,
    pub message: String,
}

/// Convert json-render schema to UIRoot
fn convert_json_render_to_ui(schema: serde_json::Value) -> Result<UIRoot, (StatusCode, String)> {
    // Extract version
    let version = schema
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0.0")
        .to_string();

    // Extract root components
    let root = schema
        .get("root")
        .ok_or((StatusCode::BAD_REQUEST, "Missing root".to_string()))?;

    let components = convert_json_render_node(root)?;

    // Extract state
    let state = schema
        .get("state")
        .and_then(|s| serde_json::from_value(s.clone()).ok())
        .unwrap_or(UIState { variables: vec![] });

    // Extract actions
    let actions = schema
        .get("actions")
        .and_then(|a| serde_json::from_value(a.clone()).ok())
        .unwrap_or_default();

    Ok(UIRoot {
        version,
        components,
        state,
        actions,
        css: None,
    })
}

/// Convert json-render node to UI components
fn convert_json_render_node(
    node: &serde_json::Value,
) -> Result<Vec<UIComponent>, (StatusCode, String)> {
    let mut components = vec![];

    let node_type = node
        .get("type")
        .and_then(|t| t.as_str())
        .ok_or((StatusCode::BAD_REQUEST, "Missing type".to_string()))?;

    // Handle Fragment wrapper
    if node_type == "Fragment" {
        if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            for child in children {
                let child_components = convert_json_render_node(child)?;
                components.extend(child_components);
            }
        }
    } else {
        let id = format!(
            "comp_{}",
            Uuid::new_v4().to_string().split('-').next().unwrap_or("")
        );

        let props = node.get("props").cloned().unwrap_or_default();

        // Extract bindings from $state references
        let mut bindings = vec![];
        if let Some(props_obj) = props.as_object() {
            for (key, value) in props_obj {
                if let Some(state_path) = value.get("$state").and_then(|s| s.as_str()) {
                    bindings.push(StateBinding {
                        prop: key.clone(),
                        state_path: state_path.to_string(),
                        direction: "one-way".to_string(),
                    });
                }
            }
        }

        // Extract children
        let children = if let Some(child_nodes) = node.get("children").and_then(|c| c.as_array()) {
            let mut child_components = vec![];
            for child in child_nodes {
                let comps = convert_json_render_node(child)?;
                child_components.extend(comps);
            }
            Some(child_components)
        } else {
            None
        };

        components.push(UIComponent {
            id,
            component_type: node_type.to_string(),
            props,
            children,
            bindings: if bindings.is_empty() {
                None
            } else {
                Some(bindings)
            },
            events: None,
        });
    }

    Ok(components)
}

/// Helper to set value at path
fn set_path(obj: &mut serde_json::Value, path: &str, value: serde_json::Value) {
    let parts: Vec<&str> = path
        .trim_start_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();
    if parts.is_empty() {
        return;
    }

    let mut current = obj;

    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            if let Some(obj) = current.as_object_mut() {
                obj.insert(part.to_string(), value);
            }
            return;
        }

        if current.get_mut(*part).is_none() {
            if let Some(obj) = current.as_object_mut() {
                obj.insert(part.to_string(), serde_json::json!({}));
            }
        }

        if let Some(next) = current.get_mut(*part) {
            current = next;
        } else {
            return;
        }
    }
}

/// Helper to remove value at path
fn remove_path(obj: &mut serde_json::Value, path: &str) {
    let parts: Vec<&str> = path
        .trim_start_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();
    if parts.is_empty() {
        return;
    }

    if parts.len() == 1 {
        if let Some(obj) = obj.as_object_mut() {
            obj.remove(parts[0]);
        }
        return;
    }

    let mut current = obj;
    for part in &parts[..parts.len() - 1] {
        if let Some(next) = current.get_mut(*part) {
            current = next;
        } else {
            return;
        }
    }

    if let Some(obj) = current.as_object_mut() {
        obj.remove(parts[parts.len() - 1]);
    }
}

use crate::AppState;

/// Create router
pub fn ix_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ix/capsules", post(create_ix_capsule))
        .route("/ix/capsules/json-render", post(create_from_json_render))
        .route(
            "/ix/capsules/:id",
            get(get_ix_capsule).delete(delete_ix_capsule),
        )
        .route("/ix/capsules/:id/patch", post(apply_patch))
        .route("/ix/capsules/:id/action", post(dispatch_action))
        .route("/ix/capsules/:id/stream", get(event_stream))
}
