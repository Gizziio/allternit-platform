use crate::brain::providers::{
    AuthStatus, ModelAdapterRegistry, ModelDiscoveryResponse, ModelsResponse, ProviderAuthRegistry,
    ModelsValidateRequest, ModelsValidateResponse, profile_to_provider_id,
};
use crate::brain::router::{BrainPlan, BrainProfile};
use crate::brain::types::{BrainConfig, BrainEvent, BrainSession, BrainType};
use crate::brain::BrainProvider;
use axum::{
    debug_handler,
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    BoxError, Json,
};
use futures::stream::Stream;
use serde::Deserialize;
use std::collections::HashMap;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

#[derive(Deserialize)]
pub struct RouteRequest {
    pub intent: String,
    pub preferred_type: Option<BrainType>,
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub config: BrainConfig,
    pub workspace_dir: Option<String>,
    pub profile_id: Option<String>,
    pub plan_id: Option<String>,
    pub attach: Option<bool>,
    /// Optional prompt to pass as CLI argument for one-shot CLI brains
    pub prompt: Option<String>,
    /// Source of the session: "chat", "terminal", or "api"
    /// Chat sessions cannot use Terminal event mode (PTY-based)
    pub source: Option<String>,
    /// Runtime overrides for this session (e.g., model_id, temperature)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_overrides: Option<serde_json::Value>,
}

pub async fn list_brain_profiles<S>(State(state): State<S>) -> Json<Vec<BrainProfile>>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    Json(state.model_router().list_profiles().await)
}

pub async fn register_brain_profile<S>(
    State(state): State<S>,
    Json(profile): Json<BrainProfile>,
) -> StatusCode
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    state.model_router().register_profile(profile).await;
    StatusCode::CREATED
}

pub async fn route_brain<S>(
    State(state): State<S>,
    Json(req): Json<RouteRequest>,
) -> Result<Json<BrainPlan>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    state
        .model_router()
        .select_brain(&req.intent, req.preferred_type)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_brain_session<S>(
    State(state): State<S>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<BrainSession>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    tracing::info!("[BrainGateway] Creating brain session with config: id={}, name={}, brain_type={:?}, command={:?}, has_prompt={}",
        req.config.id,
        req.config.name,
        req.config.brain_type,
        req.config.command,
        req.prompt.is_some()
    );

    // Inject runtime_overrides into config if provided
    let mut config = req.config;
    if let Some(overrides) = req.runtime_overrides {
        // Merge runtime_overrides into env for ACP clients
        // This allows passing model and other settings to the agent
        if let Some(model) = overrides.get("model").and_then(|m| m.as_str()) {
            if config.env.is_none() {
                config.env = Some(HashMap::new());
            }
            if let Some(ref mut env) = config.env {
                env.insert("OPENCODE_MODEL".to_string(), model.to_string());
            }
        }
        config.runtime_overrides = Some(overrides);
    }

    // If attach is requested, try to attach first
    if let Some(true) = req.attach {
        if let Some(profile_id) = &req.profile_id {
            // For create, we usually have a session_id if attaching, but CreateSessionRequest doesn't have it.
            // Usually /sessions/:id/attach is preferred.
        }
    }

    let session = state
        .brain_manager()
        .create_session(config, req.workspace_dir, req.profile_id, req.plan_id, req.prompt, req.source)
        .await
        .map_err(|e| {
            tracing::error!("[BrainGateway] Failed to create brain session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    tracing::info!("[BrainGateway] Brain session created successfully: id={}, pid={:?}", session.id, session.pid);
    Ok(Json(session))
}

pub async fn attach_brain_session<S>(
    State(state): State<S>,
    Path(id): Path<String>,
) -> Result<Json<BrainSession>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    state
        .brain_manager()
        .attach_session(&id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::NOT_FOUND)
}

pub async fn list_brain_sessions<S>(State(state): State<S>) -> Json<Vec<BrainSession>>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let sessions = state.brain_manager().list_sessions().await;
    Json(sessions)
}

pub async fn stream_brain_events<S>(
    State(state): State<S>,
    Path(session_id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, BoxError>>>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let runtime_lock = state
        .brain_manager()
        .get_runtime(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let rx = {
        let runtime = runtime_lock.read().await;
        runtime.subscribe()
    };

    let stream = BroadcastStream::new(rx).map(|msg| {
        match msg {
            Ok(event) => Event::default().json_data(event).map_err(|e| e.into()),
            Err(_) => {
                // Channel lag or closed
                Ok(Event::default().event("error").data("stream error"))
            }
        }
    });

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}

// SSE endpoint for integration lifecycle events (profile registration, PTY setup, etc.)
pub async fn stream_integration_events<S>(
    State(state): State<S>,
) -> Result<Sse<impl Stream<Item = Result<Event, BoxError>>>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let rx = state.model_router().subscribe_integration_events();

    let stream = BroadcastStream::new(rx).map(|msg| match msg {
        Ok(event) => Event::default().json_data(event).map_err(|e| e.into()),
        Err(_) => Ok(Event::default().event("error").data("stream error")),
    });

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()))
}

pub async fn send_brain_input<S>(
    State(state): State<S>,
    Path(session_id): Path<String>,
    Json(input): Json<String>,
) -> Result<StatusCode, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let runtime_lock = state
        .brain_manager()
        .get_runtime(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut runtime = runtime_lock.write().await;
    runtime.send_input(&input).await.map_err(|e| {
        tracing::error!("Failed to send input: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::OK)
}

// Provider Authentication Endpoints

#[derive(serde::Serialize)]
pub struct ProviderAuthStatusResponse {
    pub provider_id: String,
    pub status: AuthStatus,
    pub authenticated: bool,
    pub auth_profile_id: Option<String>,
    pub chat_profile_ids: Vec<String>,
}

/// Check authentication status for a provider
pub async fn get_provider_auth_status<S>(
    State(state): State<S>,
    Path(provider_id): Path<String>,
) -> Result<Json<ProviderAuthStatusResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let registry = ProviderAuthRegistry::new();
    
    let status = registry
        .check_auth_status(&provider_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check auth status: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let auth_profile_id = registry.get_auth_profile(&provider_id);
    let chat_profile_ids = registry
        .get_chat_profiles(&provider_id)
        .unwrap_or_default();

    Ok(Json(ProviderAuthStatusResponse {
        provider_id: provider_id.clone(),
        status: status.clone(),
        authenticated: status.is_authenticated(),
        auth_profile_id,
        chat_profile_ids,
    }))
}

/// List all providers with their auth status
#[derive(serde::Serialize)]
pub struct ProviderListResponse {
    pub providers: Vec<ProviderAuthStatusResponse>,
}

pub async fn list_providers_auth_status<S>(
    State(state): State<S>,
) -> Result<Json<ProviderListResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let registry = state.provider_auth_registry();
    let mut providers = Vec::new();

    for config in registry.list_providers() {
        let status = registry
            .check_auth_status(&config.provider_id)
            .await
            .unwrap_or(AuthStatus::Unknown);

        providers.push(ProviderAuthStatusResponse {
            provider_id: config.provider_id.clone(),
            status: status.clone(),
            authenticated: status.is_authenticated(),
            auth_profile_id: Some(config.auth_profile_id.clone()),
            chat_profile_ids: config.chat_profile_ids.clone(),
        });
    }

    Ok(Json(ProviderListResponse { providers }))
}

/// Get available models for a brain profile
pub async fn get_brain_profile_models<S>(
    State(state): State<S>,
    Path(profile_id): Path<String>,
) -> Result<Json<ModelsResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let registry = state.provider_auth_registry();
    
    let response = registry
        .discover_models(&profile_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to discover models: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(response))
}

// Provider Model Discovery Endpoints (New)

/// Query parameters for provider model discovery
#[derive(Deserialize, Debug)]
pub struct ListProviderModelsQuery {
    /// Optional profile ID for context-aware model discovery
    pub profile_id: Option<String>,
}

/// Discover models for a provider
/// GET /v1/providers/:provider/models?profile_id=<optional>
pub async fn list_provider_models<S>(
    State(state): State<S>,
    Path(provider_id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<ListProviderModelsQuery>,
) -> Result<Json<ModelDiscoveryResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let registry = state.model_adapter_registry();
    let auth_registry = state.provider_auth_registry();
    
    // Check auth status first
    let auth_status = auth_registry
        .check_auth_status(&provider_id)
        .await
        .unwrap_or(AuthStatus::Unknown);
    
    if !auth_status.is_authenticated() {
        return Ok(Json(ModelDiscoveryResponse {
            supported: false,
            models: None,
            default_model_id: None,
            allow_freeform: true,
            freeform_hint: Some(format!(
                "Provider '{}' is not authenticated. Run auth wizard first.",
                provider_id
            )),
            error: Some("Not authenticated".to_string()),
        }));
    }
    
    // Profile ID is available in query.profile_id if needed for context
    if let Some(ref profile_id) = query.profile_id {
        tracing::debug!("Model discovery for provider {} with profile_id {}", provider_id, profile_id);
    }
    
    let response = registry.discover_models(&provider_id).await;
    Ok(Json(response))
}

/// Validate a model ID for a provider
/// POST /v1/providers/:provider/models/validate
pub async fn validate_provider_model<S>(
    State(state): State<S>,
    Path(provider_id): Path<String>,
    Json(req): Json<ModelsValidateRequest>,
) -> Result<Json<ModelsValidateResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let registry = state.model_adapter_registry();
    let auth_registry = state.provider_auth_registry();
    
    // Check auth status first
    let auth_status = auth_registry
        .check_auth_status(&provider_id)
        .await
        .unwrap_or(AuthStatus::Unknown);
    
    if !auth_status.is_authenticated() {
        return Ok(Json(ModelsValidateResponse {
            valid: false,
            model: None,
            suggested: None,
            message: Some(format!(
                "Provider '{}' is not authenticated. Run auth wizard first.",
                provider_id
            )),
        }));
    }
    
    let response = registry.validate_model(&provider_id, &req.model_id).await;
    Ok(Json(response))
}

/// Validate a model ID for a specific brain profile
/// POST /v1/brains/:profile_id/models/validate
pub async fn validate_brain_profile_model<S>(
    State(state): State<S>,
    Path(profile_id): Path<String>,
    Json(req): Json<ModelsValidateRequest>,
) -> Result<Json<ModelsValidateResponse>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    // Extract provider from profile ID
    let provider_id = match profile_to_provider_id(&profile_id) {
        Some(provider) => provider,
        None => {
            return Ok(Json(ModelsValidateResponse {
                valid: false,
                model: None,
                suggested: None,
                message: Some(format!(
                    "Cannot determine provider from profile ID: {}",
                    profile_id
                )),
            }));
        }
    };
    
    let registry = state.model_adapter_registry();
    let response = registry.validate_model(&provider_id, &req.model_id).await;
    Ok(Json(response))
}

/// Get Allternit Native state (GSD context) for a session
pub async fn get_allternit_native_state<S>(
    State(state): State<S>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode>
where
    S: BrainProvider + Send + Sync + 'static + Clone,
{
    let session = state
        .brain_manager()
        .get_session(&session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let workspace_path = std::path::PathBuf::from(&session.workspace_dir);
    let allternit_dir = workspace_path.join(".allternit");

    if !allternit_dir.exists() {
        return Ok(Json(serde_json::json!({
            "status": "not_initialized",
            "message": "Allternit Native (.allternit) directory not found in workspace"
        })));
    }

    // Read STATE.md
    let _state_content = std::fs::read_to_string(allternit_dir.join("STATE.md")).unwrap_or_default();
    let _project_content = std::fs::read_to_string(allternit_dir.join("PROJECT.md")).unwrap_or_default();
    let _roadmap_content = std::fs::read_to_string(allternit_dir.join("ROADMAP.md")).unwrap_or_default();

    // Simple parser for demonstration - in real implementation use a proper Markdown/Frontmatter parser
    let mut native_state = serde_json::json!({
        "project": {
            "name": session.brain_id,
            "description": "Allternit Native Project",
            "core_value": "Context-driven engineering",
            "last_updated": chrono::Utc::now().to_rfc3339()
        },
        "current_state": {
            "phase": "Discovery",
            "plan_index": 0,
            "total_plans_in_phase": 0,
            "status": "Running",
            "progress_percent": 0,
            "last_activity": "Session started"
        }
    });

    // Try to find active plan
    let plans_dir = allternit_dir.join("plans");
    if plans_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(plans_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    if content.contains("status: active") || content.contains("type: execute") {
                        // Found a potential active plan
                        native_state["active_plan"] = serde_json::json!({
                            "id": path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown"),
                            "objective": "Executing tasks...",
                            "wave": 1,
                            "tasks": []
                        });
                        break;
                    }
                }
            }
        }
    }

    Ok(Json(native_state))
}
