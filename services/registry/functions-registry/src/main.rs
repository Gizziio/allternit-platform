// /services/registry-functions/src/main.rs
use axum::{
    extract::State,
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
    function_store: Arc<RwLock<HashMap<String, FunctionDefinition>>>,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionDefinition {
    id: String,
    name: String,
    description: String,
    version: String,
    platform_support: PlatformSupport,
    risk_level: String, // "low", "medium", "high", "critical"
    requires_confirmation: bool,
    parameters: serde_json::Value,
    examples: Vec<FunctionExample>,
    execution_context: String, // "local", "remote", "hybrid"
    capabilities_required: Vec<String>,
    timeout_ms: u64,
    category: String,
}

#[derive(Deserialize, Serialize, Clone)]
struct PlatformSupport {
    ios: bool,
    android: bool,
    web: bool,
    desktop: bool,
    backend: bool,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionExample {
    description: String,
    input: serde_json::Value,
}

#[derive(Deserialize)]
struct RegisterFunctionRequest {
    function: FunctionDefinition,
}

#[derive(Deserialize)]
struct QueryFunctionsRequest {
    category: Option<String>,
    platform: Option<String>,
    risk_level: Option<String>,
    search: Option<String>,
}

#[derive(Serialize)]
struct RegisterFunctionResponse {
    success: bool,
    function_id: String,
}

#[tokio::main]
async fn main() {
    // Initialize function store with default functions
    let mut functions = HashMap::new();
    
    // Add the example functions from our spec
    functions.insert(
        "com.allternit.os.set_alarm".to_string(),
        FunctionDefinition {
            id: "com.allternit.os.set_alarm".to_string(),
            name: "Set Alarm".to_string(),
            description: "Sets an alarm on the device for a specified time".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: true,
                web: false,
                desktop: false,
                backend: false,
            },
            risk_level: "low".to_string(),
            requires_confirmation: true,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "time": {
                        "type": "string",
                        "description": "Time for the alarm in HH:MM format",
                        "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                    },
                    "label": {
                        "type": "string",
                        "description": "Optional label for the alarm"
                    }
                },
                "required": ["time"]
            }),
            examples: vec![
                FunctionExample {
                    description: "Set an alarm for 7:30 AM".to_string(),
                    input: serde_json::json!({
                        "time": "07:30",
                        "label": "Wake up"
                    }),
                }
            ],
            execution_context: "local".to_string(),
            capabilities_required: vec!["alarms".to_string()],
            timeout_ms: 5000,
            category: "system".to_string(),
        },
    );
    
    functions.insert(
        "com.allternit.os.send_message".to_string(),
        FunctionDefinition {
            id: "com.allternit.os.send_message".to_string(),
            name: "Send Message".to_string(),
            description: "Sends a text message to a contact".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: true,
                web: false,
                desktop: false,
                backend: false,
            },
            risk_level: "medium".to_string(),
            requires_confirmation: true,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "recipient": {
                        "type": "string",
                        "description": "Phone number or contact name"
                    },
                    "message": {
                        "type": "string",
                        "description": "Message content to send"
                    }
                },
                "required": ["recipient", "message"]
            }),
            examples: vec![
                FunctionExample {
                    description: "Send a message to a contact".to_string(),
                    input: serde_json::json!({
                        "recipient": "+1234567890",
                        "message": "Hello, how are you?"
                    }),
                }
            ],
            execution_context: "local".to_string(),
            capabilities_required: vec!["messages".to_string()],
            timeout_ms: 10000,
            category: "communication".to_string(),
        },
    );
    
    functions.insert(
        "com.allternit.finance.transfer_money".to_string(),
        FunctionDefinition {
            id: "com.allternit.finance.transfer_money".to_string(),
            name: "Transfer Money".to_string(),
            description: "Transfers money to another account".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: true,
                web: true,
                desktop: true,
                backend: false,
            },
            risk_level: "critical".to_string(),
            requires_confirmation: true,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "recipient": {
                        "type": "string",
                        "description": "Recipient account identifier"
                    },
                    "amount": {
                        "type": "number",
                        "description": "Amount to transfer"
                    },
                    "currency": {
                        "type": "string",
                        "description": "Currency code (e.g., USD, EUR)",
                        "default": "USD"
                    },
                    "note": {
                        "type": "string",
                        "description": "Optional note for the transfer"
                    }
                },
                "required": ["recipient", "amount"]
            }),
            examples: vec![
                FunctionExample {
                    description: "Transfer money to a friend".to_string(),
                    input: serde_json::json!({
                        "recipient": "jane.doe@example.com",
                        "amount": 50.00,
                        "currency": "USD",
                        "note": "For dinner"
                    }),
                }
            ],
            execution_context: "remote".to_string(),
            capabilities_required: vec!["finance".to_string()],
            timeout_ms: 30000,
            category: "finance".to_string(),
        },
    );

    let app_state = Arc::new(AppState {
        function_store: Arc::new(RwLock::new(functions)),
    });

    let app = Router::new()
        .route("/functions", post(handle_register_function))
        .route("/functions", get(handle_list_functions))
        .route("/functions/search", post(handle_search_functions))
        .route("/functions/:id", get(handle_get_function))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3005".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Function Registry Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

async fn handle_register_function(
    State(state): State<Arc<AppState>>,
    request: Json<RegisterFunctionRequest>,
) -> Result<Json<RegisterFunctionResponse>, StatusCode> {
    let mut functions = state.function_store.write().unwrap();
    
    functions.insert(request.function.id.clone(), request.function.clone());
    
    Ok(Json(RegisterFunctionResponse {
        success: true,
        function_id: request.function.id.clone(),
    }))
}

async fn handle_list_functions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FunctionDefinition>>, StatusCode> {
    let functions = state.function_store.read().unwrap();
    Ok(Json(functions.values().cloned().collect()))
}

async fn handle_search_functions(
    State(state): State<Arc<AppState>>,
    request: Json<QueryFunctionsRequest>,
) -> Result<Json<Vec<FunctionDefinition>>, StatusCode> {
    let functions = state.function_store.read().unwrap();
    
    let filtered_functions: Vec<FunctionDefinition> = functions
        .values()
        .filter(|func| {
            // Apply filters
            if let Some(ref category) = request.category {
                if func.category != *category {
                    return false;
                }
            }
            
            if let Some(ref platform) = request.platform {
                match platform.as_str() {
                    "ios" => if !func.platform_support.ios { return false; },
                    "android" => if !func.platform_support.android { return false; },
                    "web" => if !func.platform_support.web { return false; },
                    "desktop" => if !func.platform_support.desktop { return false; },
                    "backend" => if !func.platform_support.backend { return false; },
                    _ => {} // Unknown platform, no filter
                }
            }
            
            if let Some(ref risk_level) = request.risk_level {
                if func.risk_level != *risk_level {
                    return false;
                }
            }
            
            if let Some(ref search) = request.search {
                if !func.name.to_lowercase().contains(&search.to_lowercase()) && 
                   !func.description.to_lowercase().contains(&search.to_lowercase()) &&
                   !func.id.to_lowercase().contains(&search.to_lowercase()) {
                    return false;
                }
            }
            
            true
        })
        .cloned()
        .collect();

    Ok(Json(filtered_functions))
}

use axum::{
    extract::Path,
};

async fn handle_get_function(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<FunctionDefinition>, StatusCode> {
    let functions = state.function_store.read().unwrap();
    let function = functions.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(function.clone()))
}
