//! Browser View Handlers
//!
//! HTTP handlers for the Browser View Service API.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::{
    models::*,
    BrowserError, BrowserState,
};

/// Query parameters for listing resources
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
}

/// Create a new browsing session
pub async fn create_session(
    State(state): State<Arc<BrowserState>>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, (StatusCode, String)> {
    let session_id = format!("browse-{}", uuid::Uuid::new_v4().simple());
    
    let session = BrowseSession {
        session_id: session_id.clone(),
        user_id: request.user_id,
        created_at: chrono::Utc::now(),
        last_activity: chrono::Utc::now(),
        history: vec![request.initial_resource.unwrap_or_else(|| ResourceRef {
            resource_type: ResourceType::Dashboard,
            resource_id: "home".to_string(),
            display_name: "Home".to_string(),
        })],
        current_index: 0,
        view_mode: ViewMode::List,
        filters: ResourceFilters::default(),
    };

    let mut sessions = state.sessions.write().await;
    sessions.insert(session_id.clone(), session.clone());

    Ok(Json(CreateSessionResponse { session_id, session }))
}

/// Get a session by ID
pub async fn get_session(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
) -> Result<Json<BrowseSession>, (StatusCode, String)> {
    let sessions = state.sessions.read().await;
    
    match sessions.get(&session_id) {
        Some(session) => Ok(Json(session.clone())),
        None => Err((StatusCode::NOT_FOUND, format!("Session not found: {}", session_id))),
    }
}

/// Navigate to a resource
pub async fn navigate(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
    Json(request): Json<NavigateRequest>,
) -> Result<Json<BrowseSession>, (StatusCode, String)> {
    let mut sessions = state.sessions.write().await;
    
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Session not found: {}", session_id)))?;

    // Truncate forward history if not at the end
    if session.current_index < session.history.len() - 1 {
        session.history.truncate(session.current_index + 1);
    }

    // Add new resource to history
    let resource = ResourceRef {
        resource_type: request.resource_type,
        resource_id: request.resource_id,
        display_name: request.display_name,
    };
    
    session.history.push(resource);
    session.current_index = session.history.len() - 1;
    session.last_activity = chrono::Utc::now();

    Ok(Json(session.clone()))
}

/// Go back in history
pub async fn go_back(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
) -> Result<Json<BrowseSession>, (StatusCode, String)> {
    let mut sessions = state.sessions.write().await;
    
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Session not found: {}", session_id)))?;

    if session.current_index > 0 {
        session.current_index -= 1;
        session.last_activity = chrono::Utc::now();
    }

    Ok(Json(session.clone()))
}

/// Go forward in history
pub async fn go_forward(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
) -> Result<Json<BrowseSession>, (StatusCode, String)> {
    let mut sessions = state.sessions.write().await;
    
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Session not found: {}", session_id)))?;

    if session.current_index < session.history.len() - 1 {
        session.current_index += 1;
        session.last_activity = chrono::Utc::now();
    }

    Ok(Json(session.clone()))
}

/// Refresh current view
pub async fn refresh(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
) -> Result<Json<BrowseSession>, (StatusCode, String)> {
    let mut sessions = state.sessions.write().await;
    
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Session not found: {}", session_id)))?;

    session.last_activity = chrono::Utc::now();

    Ok(Json(session.clone()))
}

/// List resources of a given type
pub async fn list_resources(
    State(_state): State<Arc<BrowserState>>,
    Path(resource_type): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<ResourceSummary>>, (StatusCode, String)> {
    let rtype = parse_resource_type(&resource_type)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    // Build filters from query
    let filters = ResourceFilters {
        search_query: query.search,
        resource_types: vec![rtype.clone()],
        status_filter: query.status.and_then(|s| parse_status(&s)),
        date_from: None,
        date_to: None,
        tags: vec![],
        custom_filters: HashMap::new(),
    };

    // For now, return mock data
    // In production, this would query the providers
    let summaries = vec![
        ResourceSummary {
            resource_type: rtype.clone(),
            resource_id: format!("{}-1", resource_type),
            display_name: format!("{} 1", rtype.display_name()),
            description: Some(format!("Description for {} 1", rtype.display_name())),
            status: ResourceStatus::Active,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
            metadata: HashMap::new(),
        },
        ResourceSummary {
            resource_type: rtype.clone(),
            resource_id: format!("{}-2", resource_type),
            display_name: format!("{} 2", rtype.display_name()),
            description: Some(format!("Description for {} 2", rtype.display_name())),
            status: ResourceStatus::Active,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
            metadata: HashMap::new(),
        },
    ];

    Ok(Json(summaries))
}

/// Get a specific resource
pub async fn get_resource(
    State(_state): State<Arc<BrowserState>>,
    Path((resource_type, resource_id)): Path<(String, String)>,
) -> Result<Json<ResourceDetail>, (StatusCode, String)> {
    let rtype = parse_resource_type(&resource_type)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;

    // For now, return mock data
    let detail = ResourceDetail {
        resource_type: rtype.clone(),
        resource_id: resource_id.clone(),
        display_name: format!("{} {}", rtype.display_name(), resource_id),
        description: Some(format!("Detailed view of {} {}", rtype.display_name(), resource_id)),
        status: ResourceStatus::Active,
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        content: serde_json::json!({
            "id": resource_id,
            "type": resource_type,
            "data": "Mock content for testing",
        }),
        related_resources: vec![],
        metadata: HashMap::new(),
    };

    Ok(Json(detail))
}

/// Search across resources
pub async fn search_resources(
    State(_state): State<Arc<BrowserState>>,
    Json(_request): Json<SearchRequest>,
) -> Result<Json<Vec<SearchResult>>, (StatusCode, String)> {
    // For now, return mock results
    let results = vec![
        SearchResult {
            resource_type: ResourceType::Graph,
            resource_id: "graph-1".to_string(),
            display_name: "Graph 1".to_string(),
            description: Some("A sample graph".to_string()),
            relevance_score: 0.95,
            matched_fields: vec!["name".to_string()],
        },
        SearchResult {
            resource_type: ResourceType::Task,
            resource_id: "task-1".to_string(),
            display_name: "Task 1".to_string(),
            description: Some("A sample task".to_string()),
            relevance_score: 0.85,
            matched_fields: vec!["name".to_string(), "description".to_string()],
        },
    ];

    Ok(Json(results))
}

/// Get breadcrumbs for a session
pub async fn get_breadcrumbs(
    State(state): State<Arc<BrowserState>>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<Breadcrumb>>, (StatusCode, String)> {
    let sessions = state.sessions.read().await;
    
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Session not found: {}", session_id)))?;

    let breadcrumbs: Vec<Breadcrumb> = session
        .history
        .iter()
        .take(session.current_index + 1)
        .enumerate()
        .map(|(idx, resource)| Breadcrumb {
            index: idx,
            resource_type: resource.resource_type.clone(),
            resource_id: resource.resource_id.clone(),
            display_name: resource.display_name.clone(),
            is_current: idx == session.current_index,
        })
        .collect();

    Ok(Json(breadcrumbs))
}

/// List available providers
pub async fn list_providers() -> Json<Vec<ProviderInfo>> {
    let providers = vec![
        ProviderInfo {
            provider_id: "dag".to_string(),
            name: "DAG Provider".to_string(),
            description: "Provides access to DAG graphs and tasks".to_string(),
            supported_types: vec![ResourceType::Graph, ResourceType::Task],
        },
        ProviderInfo {
            provider_id: "ontology".to_string(),
            name: "Ontology Provider".to_string(),
            description: "Provides access to ontology types and instances".to_string(),
            supported_types: vec![ResourceType::Tool, ResourceType::Agent],
        },
    ];

    Json(providers)
}

// Helper functions

fn parse_resource_type(s: &str) -> Result<ResourceType, String> {
    match s {
        "dashboard" => Ok(ResourceType::Dashboard),
        "graph" => Ok(ResourceType::Graph),
        "task" => Ok(ResourceType::Task),
        "workflow" => Ok(ResourceType::Workflow),
        "artifact" => Ok(ResourceType::Artifact),
        "receipt" => Ok(ResourceType::Receipt),
        "session" => Ok(ResourceType::Session),
        "tool" => Ok(ResourceType::Tool),
        "agent" => Ok(ResourceType::Agent),
        "memory" => Ok(ResourceType::Memory),
        "policy" => Ok(ResourceType::Policy),
        _ => Ok(ResourceType::Custom(s.to_string())),
    }
}

fn parse_status(s: &str) -> Option<ResourceStatus> {
    match s {
        "active" => Some(ResourceStatus::Active),
        "inactive" => Some(ResourceStatus::Inactive),
        "pending" => Some(ResourceStatus::Pending),
        "running" => Some(ResourceStatus::Running),
        "completed" => Some(ResourceStatus::Completed),
        "failed" => Some(ResourceStatus::Failed),
        "archived" => Some(ResourceStatus::Archived),
        _ => None,
    }
}
