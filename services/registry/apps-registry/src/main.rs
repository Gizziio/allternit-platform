use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    app_store: Arc<RwLock<HashMap<String, AppDefinition>>>,
    user_auth_store: Arc<RwLock<HashMap<String, UserAuthInfo>>>,
}

#[derive(Deserialize, Serialize, Clone)]
struct AppDefinition {
    id: String,
    name: String,
    description: String,
    version: String,
    developer: String,
    website: String,
    icon_url: String,
    categories: Vec<String>,
    auth_type: String, // "oauth2", "api_key", "none"
    oauth_config: Option<OAuthConfig>,
    capabilities: Vec<String>,
    supported_platforms: Vec<String>, // ["ios", "android", "web", "desktop"]
    privacy_policy_url: Option<String>,
    terms_of_service_url: Option<String>,
    tools: Vec<ToolDefinition>,
    ui_cards: Vec<UICardTemplate>,
}

#[derive(Deserialize, Serialize, Clone)]
struct OAuthConfig {
    authorization_url: String,
    token_url: String,
    client_id: String,
    scopes: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct ToolDefinition {
    id: String,
    name: String,
    description: String,
    category: String,
    parameters: serde_json::Value,
    returns: serde_json::Value,
    risk_level: String, // "low", "medium", "high", "critical"
    requires_confirmation: bool,
    execution_time_estimate_ms: u64,
    rate_limits: Option<RateLimitConfig>,
}

#[derive(Deserialize, Serialize, Clone)]
struct RateLimitConfig {
    max_calls: u32,
    time_window_ms: u64,
}

#[derive(Deserialize, Serialize, Clone)]
struct UICardTemplate {
    card_type: String, // "basic", "list", "grid", "form", "action"
    title_template: String,
    content_template: serde_json::Value,
    actions: Vec<CardActionTemplate>,
}

#[derive(Deserialize, Serialize, Clone)]
struct CardActionTemplate {
    id: String,
    label: String,
    action_type: String, // "primary", "secondary", "destructive"
    handler: ActionHandlerTemplate,
}

#[derive(Deserialize, Serialize, Clone)]
struct ActionHandlerTemplate {
    handler_type: String, // "tool_call", "deep_link", "web_view", "app_intent"
    target: String,
    parameters: Option<serde_json::Value>,
}

#[derive(Deserialize, Serialize, Clone)]
struct UserAuthInfo {
    user_id: String,
    app_id: String,
    auth_credentials: AuthCredentials,
    scopes: Vec<String>,
    created_at: u64,
    updated_at: u64,
    expires_at: Option<u64>,
}

#[derive(Deserialize, Serialize, Clone)]
struct AuthCredentials {
    auth_type: String, // "oauth2_token", "api_key", "session_cookie"
    access_token: Option<String>,
    refresh_token: Option<String>,
    api_key: Option<String>,
    expires_at: Option<u64>,
}

#[derive(Deserialize)]
struct RegisterAppRequest {
    app: AppDefinition,
}

#[derive(Deserialize)]
struct AuthenticateUserRequest {
    app_id: String,
    auth_type: String,
    credentials: serde_json::Value,
}

#[derive(Deserialize)]
struct ExecuteToolRequest {
    app_id: String,
    tool_id: String,
    user_id: String,
    parameters: serde_json::Value,
}

#[derive(Serialize)]
struct RegisterAppResponse {
    success: bool,
    app_id: String,
}

#[derive(Serialize)]
struct AuthenticateUserResponse {
    success: bool,
    auth_token: Option<String>,
    requires_redirect: bool,
    redirect_url: Option<String>,
}

#[derive(Serialize)]
struct ExecuteToolResponse {
    success: bool,
    result: Option<serde_json::Value>,
    ui_card: Option<UICardTemplate>,
}

#[derive(Deserialize)]
struct QueryAppsRequest {
    category: Option<String>,
    platform: Option<String>,
    search: Option<String>,
    limit: Option<usize>,
}

#[tokio::main]
async fn main() {
    // Initialize app store with some example apps
    let mut apps = HashMap::new();
    
    // Example: DoorDash app
    apps.insert(
        "com.doordash.app".to_string(),
        AppDefinition {
            id: "com.doordash.app".to_string(),
            name: "DoorDash".to_string(),
            description: "Order food delivery from DoorDash".to_string(),
            version: "1.0.0".to_string(),
            developer: "DoorDash".to_string(),
            website: "https://www.doordash.com".to_string(),
            icon_url: "https://example.com/doordash-icon.png".to_string(),
            categories: vec!["food".to_string(), "delivery".to_string()],
            auth_type: "oauth2".to_string(),
            oauth_config: Some(OAuthConfig {
                authorization_url: "https://api.doordash.com/v2/connect/auth".to_string(),
                token_url: "https://api.doordash.com/v2/connect/token".to_string(),
                client_id: "your_client_id".to_string(),
                scopes: vec!["account_info".to_string(), "delivery_read".to_string(), "delivery_write".to_string()],
            }),
            capabilities: vec!["food_ordering".to_string(), "delivery_tracking".to_string()],
            supported_platforms: vec!["ios".to_string(), "android".to_string(), "web".to_string(), "desktop".to_string()],
            privacy_policy_url: Some("https://www.doordash.com/privacy".to_string()),
            terms_of_service_url: Some("https://www.doordash.com/terms".to_string()),
            tools: vec![
                ToolDefinition {
                    id: "search_restaurants".to_string(),
                    name: "Search Restaurants".to_string(),
                    description: "Search for restaurants by cuisine or location".to_string(),
                    category: "food".to_string(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query (cuisine, restaurant name, etc.)"
                            },
                            "location": {
                                "type": "string",
                                "description": "Location to search in"
                            }
                        },
                        "required": ["query", "location"]
                    }),
                    returns: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "restaurants": {
                                "type": "array",
                                "description": "List of matching restaurants"
                            }
                        }
                    }),
                    risk_level: "low".to_string(),
                    requires_confirmation: false,
                    execution_time_estimate_ms: 2000,
                    rate_limits: Some(RateLimitConfig {
                        max_calls: 10,
                        time_window_ms: 60000, // 1 minute
                    }),
                },
                ToolDefinition {
                    id: "place_order".to_string(),
                    name: "Place Order".to_string(),
                    description: "Place a food delivery order".to_string(),
                    category: "food".to_string(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "restaurant_id": {
                                "type": "string",
                                "description": "ID of the restaurant"
                            },
                            "items": {
                                "type": "array",
                                "description": "List of items to order"
                            },
                            "delivery_address": {
                                "type": "string",
                                "description": "Delivery address"
                            }
                        },
                        "required": ["restaurant_id", "items", "delivery_address"]
                    }),
                    returns: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "ID of the placed order"
                            },
                            "status": {
                                "type": "string",
                                "description": "Current status of the order"
                            }
                        }
                    }),
                    risk_level: "high".to_string(),
                    requires_confirmation: true,
                    execution_time_estimate_ms: 5000,
                    rate_limits: Some(RateLimitConfig {
                        max_calls: 5,
                        time_window_ms: 300000, // 5 minutes
                    }),
                }
            ],
            ui_cards: vec![
                UICardTemplate {
                    card_type: "list".to_string(),
                    title_template: "Restaurants Found".to_string(),
                    content_template: serde_json::json!({
                        "restaurants": "{{restaurants}}"
                    }),
                    actions: vec![
                        CardActionTemplate {
                            id: "view_menu".to_string(),
                            label: "View Menu".to_string(),
                            action_type: "primary".to_string(),
                            handler: ActionHandlerTemplate {
                                handler_type: "web_view".to_string(),
                                target: "https://www.doordash.com".to_string(),
                                parameters: None,
                            },
                        }
                    ],
                },
                UICardTemplate {
                    card_type: "basic".to_string(),
                    title_template: "Order Placed".to_string(),
                    content_template: serde_json::json!({
                        "message": "Your food is on the way!"
                    }),
                    actions: vec![
                        CardActionTemplate {
                            id: "track_order".to_string(),
                            label: "Track Order".to_string(),
                            action_type: "primary".to_string(),
                            handler: ActionHandlerTemplate {
                                handler_type: "web_view".to_string(),
                                target: "https://www.doordash.com".to_string(),
                                parameters: Some(serde_json::json!({
                                    "path": "/order/{{order_id}}"
                                })),
                            },
                        }
                    ],
                }
            ],
        }
    );

    let app_state = Arc::new(AppState {
        app_store: Arc::new(RwLock::new(apps)),
        user_auth_store: Arc::new(RwLock::new(HashMap::new())),
    });

    let app = Router::new()
        .route("/apps", post(handle_register_app))
        .route("/apps", get(handle_list_apps))
        .route("/apps/:id", get(handle_get_app))
        .route("/apps/search", post(handle_search_apps))
        .route("/apps/:app_id/auth", post(handle_authenticate_user))
        .route("/apps/:app_id/tools/:tool_id", post(handle_execute_tool))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3109".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Apps Registry Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

async fn handle_register_app(
    State(state): State<Arc<AppState>>,
    request: Json<RegisterAppRequest>,
) -> Result<Json<RegisterAppResponse>, StatusCode> {
    let mut apps = state.app_store.write().unwrap();
    
    apps.insert(request.app.id.clone(), request.app.clone());
    
    Ok(Json(RegisterAppResponse {
        success: true,
        app_id: request.app.id.clone(),
    }))
}

async fn handle_list_apps(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AppDefinition>>, StatusCode> {
    let apps = state.app_store.read().unwrap();
    Ok(Json(apps.values().cloned().collect()))
}

async fn handle_get_app(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<AppDefinition>, StatusCode> {
    let apps = state.app_store.read().unwrap();
    let app = apps.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(app.clone()))
}

async fn handle_search_apps(
    State(state): State<Arc<AppState>>,
    request: Json<QueryAppsRequest>,
) -> Result<Json<Vec<AppDefinition>>, StatusCode> {
    let apps = state.app_store.read().unwrap();
    
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

async fn handle_authenticate_user(
    State(state): State<Arc<AppState>>,
    Path(app_id): Path<String>,
    request: Json<AuthenticateUserRequest>,
) -> Result<Json<AuthenticateUserResponse>, StatusCode> {
    let apps = state.app_store.read().unwrap();
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

async fn handle_execute_tool(
    State(state): State<Arc<AppState>>,
    Path((app_id, tool_id)): Path<(String, String)>,
    request: Json<ExecuteToolRequest>,
) -> Result<Json<ExecuteToolResponse>, StatusCode> {
    let apps = state.app_store.read().unwrap();
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
