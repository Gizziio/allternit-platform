use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;

// Re-export the main types for use by other services
pub use app_types::*;

pub mod app_types {
    use serde::{Deserialize, Serialize};

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct AppDefinition {
        pub id: String,
        pub name: String,
        pub description: String,
        pub version: String,
        pub developer: String,
        pub website: String,
        pub icon_url: String,
        pub categories: Vec<String>,
        pub auth_type: String, // "oauth2", "api_key", "none"
        pub oauth_config: Option<OAuthConfig>,
        pub capabilities: Vec<String>,
        pub supported_platforms: Vec<String>, // ["ios", "android", "web", "desktop"]
        pub privacy_policy_url: Option<String>,
        pub terms_of_service_url: Option<String>,
        pub tools: Vec<ToolDefinition>,
        pub ui_cards: Vec<UICardTemplate>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct OAuthConfig {
        pub authorization_url: String,
        pub token_url: String,
        pub client_id: String,
        pub scopes: Vec<String>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct ToolDefinition {
        pub id: String,
        pub name: String,
        pub description: String,
        pub category: String,
        pub parameters: serde_json::Value,
        pub returns: serde_json::Value,
        pub risk_level: String, // "low", "medium", "high", "critical"
        pub requires_confirmation: bool,
        pub execution_time_estimate_ms: u64,
        pub rate_limits: Option<RateLimitConfig>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct RateLimitConfig {
        pub max_calls: u32,
        pub time_window_ms: u64,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct UICardTemplate {
        pub card_type: String, // "basic", "list", "grid", "form", "action"
        pub title_template: String,
        pub content_template: serde_json::Value,
        pub actions: Vec<CardActionTemplate>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct CardActionTemplate {
        pub id: String,
        pub label: String,
        pub action_type: String, // "primary", "secondary", "destructive"
        pub handler: ActionHandlerTemplate,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct ActionHandlerTemplate {
        pub handler_type: String, // "tool_call", "deep_link", "web_view", "app_intent"
        pub target: String,
        pub parameters: Option<serde_json::Value>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct UserAuthInfo {
        pub user_id: String,
        pub app_id: String,
        pub auth_credentials: AuthCredentials,
        pub scopes: Vec<String>,
        pub created_at: u64,
        pub updated_at: u64,
        pub expires_at: Option<u64>,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct AuthCredentials {
        pub auth_type: String, // "oauth2_token", "api_key", "session_cookie"
        pub access_token: Option<String>,
        pub refresh_token: Option<String>,
        pub api_key: Option<String>,
        pub expires_at: Option<u64>,
    }
}

#[derive(Debug, Clone)]
pub struct RegistryAppState {
    pub app_store: Arc<RwLock<HashMap<String, AppDefinition>>>,
    pub user_auth_store: Arc<RwLock<HashMap<String, UserAuthInfo>>>,
}

impl RegistryAppState {
    pub fn new() -> Self {
        Self {
            app_store: Arc::new(RwLock::new(HashMap::new())),
            user_auth_store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_app(&self, app: AppDefinition) -> Result<(), String> {
        let mut apps = self.app_store.write().map_err(|e| e.to_string())?;
        apps.insert(app.id.clone(), app);
        Ok(())
    }

    pub fn get_app(&self, app_id: &str) -> Option<AppDefinition> {
        let apps = self.app_store.read().unwrap();
        apps.get(app_id).cloned()
    }

    pub fn list_apps(&self) -> Vec<AppDefinition> {
        let apps = self.app_store.read().unwrap();
        apps.values().cloned().collect()
    }

    pub fn search_apps(&self, category: Option<&str>, platform: Option<&str>, search: Option<&str>) -> Vec<AppDefinition> {
        let apps = self.app_store.read().unwrap();

        apps.values()
            .filter(|app| {
                // Apply filters
                if let Some(category) = category {
                    if !app.categories.contains(&category.to_string()) {
                        return false;
                    }
                }

                if let Some(platform) = platform {
                    if !app.supported_platforms.contains(&platform.to_string()) {
                        return false;
                    }
                }

                if let Some(search) = search {
                    if !app.name.to_lowercase().contains(&search.to_lowercase()) &&
                       !app.description.to_lowercase().contains(&search.to_lowercase()) &&
                       !app.id.to_lowercase().contains(&search.to_lowercase()) {
                        return false;
                    }
                }

                true
            })
            .cloned()
            .collect()
    }
}

#[derive(Deserialize)]
pub struct RegisterAppRequest {
    pub app: AppDefinition,
}

#[derive(Deserialize)]
pub struct AuthenticateUserRequest {
    pub app_id: String,
    pub auth_type: String,
    pub credentials: serde_json::Value,
}

#[derive(Deserialize)]
pub struct ExecuteToolRequest {
    pub app_id: String,
    pub tool_id: String,
    pub user_id: String,
    pub parameters: serde_json::Value,
}

#[derive(Serialize)]
pub struct RegisterAppResponse {
    pub success: bool,
    pub app_id: String,
}

#[derive(Serialize)]
pub struct AuthenticateUserResponse {
    pub success: bool,
    pub auth_token: Option<String>,
    pub requires_redirect: bool,
    pub redirect_url: Option<String>,
}

#[derive(Serialize)]
pub struct ExecuteToolResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub ui_card: Option<UICardTemplate>,
}

#[derive(Deserialize)]
pub struct QueryAppsRequest {
    pub category: Option<String>,
    pub platform: Option<String>,
    pub search: Option<String>,
    pub limit: Option<usize>,
}

// Handler functions that can be used by the service
pub async fn handle_register_app(
    State(state): State<Arc<RegistryAppState>>,
    request: Json<RegisterAppRequest>,
) -> Result<Json<RegisterAppResponse>, StatusCode> {
    let mut apps = state.app_store.write().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    apps.insert(request.app.id.clone(), request.app.clone());

    Ok(Json(RegisterAppResponse {
        success: true,
        app_id: request.app.id.clone(),
    }))
}

pub async fn handle_list_apps(
    State(state): State<Arc<RegistryAppState>>,
) -> Result<Json<Vec<AppDefinition>>, StatusCode> {
    let apps = state.app_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(apps.values().cloned().collect()))
}

pub async fn handle_get_app(
    State(state): State<Arc<RegistryAppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<AppDefinition>, StatusCode> {
    let apps = state.app_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let app = apps.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(app.clone()))
}

pub async fn handle_search_apps(
    State(state): State<Arc<RegistryAppState>>,
    request: Json<QueryAppsRequest>,
) -> Result<Json<Vec<AppDefinition>>, StatusCode> {
    let apps = state.app_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let filtered_apps: Vec<AppDefinition> = apps
        .values()
        .filter(|app| {
            // Apply filters
            if let Some(ref category) = request.category {
                if !app.categories.contains(category) {
                    return false;
                }
            }

            if let Some(ref platform) = request.platform {
                if !app.supported_platforms.contains(platform) {
                    return false;
                }
            }

            if let Some(ref search) = request.search {
                if !app.name.to_lowercase().contains(&search.to_lowercase()) &&
                   !app.description.to_lowercase().contains(&search.to_lowercase()) &&
                   !app.id.to_lowercase().contains(&search.to_lowercase()) {
                    return false;
                }
            }

            true
        })
        .cloned()
        .collect();

    // Apply limit if specified
    let result = if let Some(limit) = request.limit {
        filtered_apps.into_iter().take(limit).collect()
    } else {
        filtered_apps
    };

    Ok(Json(result))
}

pub async fn handle_authenticate_user(
    State(state): State<Arc<RegistryAppState>>,
    axum::extract::Path(app_id): axum::extract::Path<String>,
    request: Json<AuthenticateUserRequest>,
) -> Result<Json<AuthenticateUserResponse>, StatusCode> {
    let apps = state.app_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let app = apps.get(&app_id).ok_or(StatusCode::NOT_FOUND)?;

    // In a real implementation, this would handle the actual authentication
    // For now, we'll simulate the process
    match app.auth_type.as_str() {
        "oauth2" => {
            // For OAuth2, we typically need to redirect the user to the provider
            Ok(Json(AuthenticateUserResponse {
                success: true,
                auth_token: None, // OAuth requires redirect flow
                requires_redirect: true,
                redirect_url: app.oauth_config.as_ref().map(|config| {
                    format!("{}?client_id={}&redirect_uri={}&scope={}&response_type=code",
                        config.authorization_url,
                        config.client_id,
                        "https://a2rchitech.com/oauth/callback", // This would come from request
                        config.scopes.join(" ")
                    )
                }),
            }))
        },
        "api_key" => {
            // For API key, we'd validate the provided key
            Ok(Json(AuthenticateUserResponse {
                success: true,
                auth_token: Some("mock_api_token".to_string()),
                requires_redirect: false,
                redirect_url: None,
            }))
        },
        "none" => {
            // For no auth, just return success
            Ok(Json(AuthenticateUserResponse {
                success: true,
                auth_token: Some("mock_session_token".to_string()),
                requires_redirect: false,
                redirect_url: None,
            }))
        },
        _ => {
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

pub async fn handle_execute_tool(
    State(state): State<Arc<RegistryAppState>>,
    axum::extract::Path((app_id, tool_id)): axum::extract::Path<(String, String)>,
    request: Json<ExecuteToolRequest>,
) -> Result<Json<ExecuteToolResponse>, StatusCode> {
    let apps = state.app_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let app = apps.get(&app_id).ok_or(StatusCode::NOT_FOUND)?;

    // Find the tool in the app
    let tool = app.tools.iter().find(|t| t.id == tool_id).ok_or(StatusCode::NOT_FOUND)?;

    // In a real implementation, this would call the actual tool
    // For now, we'll simulate the execution
    let result = match tool_id.as_str() {
        "create_event" => {
            // Simulate creating a calendar event
            Some(serde_json::json!({
                "event_id": format!("event_{}", uuid::Uuid::new_v4()),
                "status": "created",
                "title": request.parameters.get("title").unwrap_or(&serde_json::Value::String("".to_string())),
                "start_time": request.parameters.get("start_time").unwrap_or(&serde_json::Value::String("".to_string())),
                "end_time": request.parameters.get("end_time").unwrap_or(&serde_json::Value::String("".to_string())),
            }))
        },
        _ => {
            // For other tools, return a generic success
            Some(serde_json::json!({
                "status": "success",
                "tool_id": tool_id,
                "parameters": request.parameters,
            }))
        }
    };

    // Find the appropriate UI card for this tool
    let ui_card = app.ui_cards.iter()
        .find(|card| {
            // Simple matching - in reality this would be more sophisticated
            card.title_template.to_lowercase().contains(&tool.name.to_lowercase()) ||
            card.content_template.to_string().contains(&tool.id)
        })
        .cloned();

    Ok(Json(ExecuteToolResponse {
        success: true,
        result,
        ui_card,
    }))
}