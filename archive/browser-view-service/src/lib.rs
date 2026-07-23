//! Allternit Browser View Service
//!
//! Provides resource browsing and viewing capabilities for the ShellUI.
//! Enables users to explore graphs, tasks, artifacts, and system state.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

pub mod handlers;
pub mod models;

use handlers::*;
use models::*;

// ============================================================================
// Browser View Service
// ============================================================================

/// Main browser view service
pub struct BrowserViewService {
    state: Arc<BrowserState>,
}

/// Internal state for the browser service
pub struct BrowserState {
    /// Cached views
    views: RwLock<HashMap<String, ViewCache>>,
    /// Active sessions
    sessions: RwLock<HashMap<String, BrowseSession>>,
    /// Resource providers
    providers: RwLock<Vec<Box<dyn ResourceProvider>>>,
}

impl BrowserViewService {
    /// Create a new browser view service
    pub fn new() -> Self {
        let state = Arc::new(BrowserState {
            views: RwLock::new(HashMap::new()),
            sessions: RwLock::new(HashMap::new()),
            providers: RwLock::new(Vec::new()),
        });

        Self { state }
    }

    /// Get the service router
    pub fn router(&self) -> Router {
        let state = self.state.clone();

        Router::new()
            .route("/api/v1/browser/session", post(create_session))
            .route("/api/v1/browser/session/:session_id", get(get_session))
            .route("/api/v1/browser/session/:session_id/navigate", post(navigate))
            .route("/api/v1/browser/session/:session_id/back", post(go_back))
            .route("/api/v1/browser/session/:session_id/forward", post(go_forward))
            .route("/api/v1/browser/session/:session_id/refresh", post(refresh))
            .route("/api/v1/browser/view/:resource_type", get(list_resources))
            .route("/api/v1/browser/view/:resource_type/:resource_id", get(get_resource))
            .route("/api/v1/browser/search", post(search_resources))
            .route("/api/v1/browser/breadcrumbs/:session_id", get(get_breadcrumbs))
            .route("/api/v1/browser/providers", get(list_providers))
            .with_state(state)
    }

    /// Register a resource provider
    pub async fn register_provider(&self, provider: Box<dyn ResourceProvider>) {
        let mut providers = self.state.providers.write().await;
        providers.push(provider);
        info!("Registered resource provider, total: {}", providers.len());
    }

    /// Create a new browsing session
    pub async fn create_session(
        &self,
        user_id: impl Into<String>,
        initial_resource: Option<ResourceRef>,
    ) -> BrowseSession {
        let session_id = format!("browse-{}", uuid::Uuid::new_v4().simple());
        let session = BrowseSession {
            session_id: session_id.clone(),
            user_id: user_id.into(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            history: vec![initial_resource.clone().unwrap_or_else(|| ResourceRef {
                resource_type: ResourceType::Dashboard,
                resource_id: "home".to_string(),
                display_name: "Home".to_string(),
            })],
            current_index: 0,
            view_mode: ViewMode::List,
            filters: ResourceFilters::default(),
        };

        let mut sessions = self.state.sessions.write().await;
        sessions.insert(session_id, session.clone());

        info!("Created browser session: {} for user: {}", session.session_id, session.user_id);
        session
    }

    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> Option<BrowseSession> {
        let sessions = self.state.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    /// Navigate to a resource
    pub async fn navigate(
        &self,
        session_id: &str,
        resource: ResourceRef,
    ) -> Result<BrowseSession, BrowserError> {
        let mut sessions = self.state.sessions.write().await;
        
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| BrowserError::SessionNotFound(session_id.to_string()))?;

        // Truncate forward history if not at the end
        if session.current_index < session.history.len() - 1 {
            session.history.truncate(session.current_index + 1);
        }

        // Add new resource to history
        session.history.push(resource);
        session.current_index = session.history.len() - 1;
        session.last_activity = Utc::now();

        Ok(session.clone())
    }

    /// Go back in history
    pub async fn go_back(&self, session_id: &str) -> Result<BrowseSession, BrowserError> {
        let mut sessions = self.state.sessions.write().await;
        
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| BrowserError::SessionNotFound(session_id.to_string()))?;

        if session.current_index > 0 {
            session.current_index -= 1;
            session.last_activity = Utc::now();
        }

        Ok(session.clone())
    }

    /// Go forward in history
    pub async fn go_forward(&self, session_id: &str) -> Result<BrowseSession, BrowserError> {
        let mut sessions = self.state.sessions.write().await;
        
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| BrowserError::SessionNotFound(session_id.to_string()))?;

        if session.current_index < session.history.len() - 1 {
            session.current_index += 1;
            session.last_activity = Utc::now();
        }

        Ok(session.clone())
    }

    /// List resources of a given type
    pub async fn list_resources(
        &self,
        resource_type: ResourceType,
        filters: &ResourceFilters,
    ) -> Result<Vec<ResourceSummary>, BrowserError> {
        let providers = self.state.providers.read().await;
        let mut all_resources = Vec::new();

        for provider in providers.iter() {
            if provider.supports_type(&resource_type) {
                let resources = provider.list_resources(filters).await?;
                all_resources.extend(resources);
            }
        }

        Ok(all_resources)
    }

    /// Get a specific resource
    pub async fn get_resource(
        &self,
        resource_type: ResourceType,
        resource_id: &str,
    ) -> Result<ResourceDetail, BrowserError> {
        let providers = self.state.providers.read().await;

        for provider in providers.iter() {
            if provider.supports_type(&resource_type) {
                if let Some(resource) = provider.get_resource(resource_id).await? {
                    return Ok(resource);
                }
            }
        }

        Err(BrowserError::ResourceNotFound(resource_type, resource_id.to_string()))
    }

    /// Search across resources
    pub async fn search(&self, query: &str, types: &[ResourceType]) -> Result<Vec<SearchResult>, BrowserError> {
        let providers = self.state.providers.read().await;
        let mut results = Vec::new();

        for provider in providers.iter() {
            let search_results = provider.search(query, types).await?;
            results.extend(search_results);
        }

        // Sort by relevance (simple string match score)
        results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());

        Ok(results)
    }

    /// Get breadcrumbs for current location
    pub async fn get_breadcrumbs(&self, session_id: &str) -> Result<Vec<Breadcrumb>, BrowserError> {
        let sessions = self.state.sessions.read().await;
        
        let session = sessions
            .get(session_id)
            .ok_or_else(|| BrowserError::SessionNotFound(session_id.to_string()))?;

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

        Ok(breadcrumbs)
    }

    /// Clean up expired sessions
    pub async fn cleanup_sessions(&self, max_age_minutes: i64) -> usize {
        let cutoff = Utc::now() - chrono::Duration::minutes(max_age_minutes);
        
        let mut sessions = self.state.sessions.write().await;
        let expired: Vec<String> = sessions
            .iter()
            .filter(|(_, session)| session.last_activity < cutoff)
            .map(|(id, _)| id.clone())
            .collect();

        let count = expired.len();
        for id in expired {
            sessions.remove(&id);
        }

        if count > 0 {
            info!("Cleaned up {} expired browser sessions", count);
        }

        count
    }
}

impl Default for BrowserViewService {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Resource Provider Trait
// ============================================================================

#[async_trait::async_trait]
pub trait ResourceProvider: Send + Sync {
    /// Check if this provider supports a resource type
    fn supports_type(&self, resource_type: &ResourceType) -> bool;

    /// List resources
    async fn list_resources(&self, filters: &ResourceFilters) -> Result<Vec<ResourceSummary>, BrowserError>;

    /// Get a specific resource
    async fn get_resource(&self, resource_id: &str) -> Result<Option<ResourceDetail>, BrowserError>;

    /// Search resources
    async fn search(&self, query: &str, types: &[ResourceType]) -> Result<Vec<SearchResult>, BrowserError>;
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum BrowserError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Resource not found: {0:?}/{1}")]
    ResourceNotFound(ResourceType, String),

    #[error("Invalid resource type: {0}")]
    InvalidResourceType(String),

    #[error("Provider error: {0}")]
    ProviderError(String),

    #[error("Navigation error: {0}")]
    NavigationError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_creation() {
        let service = BrowserViewService::new();
        let session = service.create_session("user-1", None).await;

        assert_eq!(session.user_id, "user-1");
        assert_eq!(session.history.len(), 1);
        assert_eq!(session.current_index, 0);
    }

    #[tokio::test]
    async fn test_navigation() {
        let service = BrowserViewService::new();
        let session = service.create_session("user-1", None).await;
        let session_id = session.session_id.clone();

        // Navigate to a resource
        let resource = ResourceRef {
            resource_type: ResourceType::Graph,
            resource_id: "graph-1".to_string(),
            display_name: "Graph 1".to_string(),
        };

        let session = service.navigate(&session_id, resource).await.unwrap();
        assert_eq!(session.history.len(), 2);
        assert_eq!(session.current_index, 1);
    }

    #[tokio::test]
    async fn test_go_back_forward() {
        let service = BrowserViewService::new();
        let session = service.create_session("user-1", None).await;
        let session_id = session.session_id.clone();

        // Navigate forward
        let resource1 = ResourceRef {
            resource_type: ResourceType::Graph,
            resource_id: "graph-1".to_string(),
            display_name: "Graph 1".to_string(),
        };
        service.navigate(&session_id, resource1).await.unwrap();

        let resource2 = ResourceRef {
            resource_type: ResourceType::Task,
            resource_id: "task-1".to_string(),
            display_name: "Task 1".to_string(),
        };
        service.navigate(&session_id, resource2).await.unwrap();

        // Go back
        let session = service.go_back(&session_id).await.unwrap();
        assert_eq!(session.current_index, 1);

        // Go forward
        let session = service.go_forward(&session_id).await.unwrap();
        assert_eq!(session.current_index, 2);
    }

    #[tokio::test]
    async fn test_session_cleanup() {
        let service = BrowserViewService::new();
        
        // Create a session
        let session = service.create_session("user-1", None).await;
        let session_id = session.session_id.clone();

        // Should exist
        assert!(service.get_session(&session_id).await.is_some());

        // Manually expire the session by setting old last_activity
        {
            let mut sessions = service.state.sessions.write().await;
            if let Some(session) = sessions.get_mut(&session_id) {
                session.last_activity = Utc::now() - chrono::Duration::minutes(10);
            }
        }

        // Clean up sessions older than 5 minutes
        let cleaned = service.cleanup_sessions(5).await;
        assert_eq!(cleaned, 1);

        // Should no longer exist
        assert!(service.get_session(&session_id).await.is_none());
    }
}
