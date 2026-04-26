use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    function_registry: Arc<dyn FunctionRegistry>,
    apps_registry: Arc<dyn AppsRegistry>,
    policy_engine: Arc<dyn PolicyEngine>,
    audit_logger: Arc<dyn AuditLogger>,
}

#[derive(Deserialize, Serialize)]
struct ExecuteRequest {
    function_call: FunctionCall,
    user_id: String,
    agent_id: String,
    session_id: String,
    context: serde_json::Value,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionCall {
    function_id: String,
    parameters: serde_json::Value,
}

#[derive(Serialize)]
struct ExecuteResponse {
    success: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
    execution_time_ms: u64,
    ui_card: Option<UICard>,
}

#[derive(Serialize, Deserialize, Clone)]
struct UICard {
    card_type: String,
    title: String,
    subtitle: Option<String>,
    content: serde_json::Value,
    actions: Option<Vec<CardAction>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct CardAction {
    id: String,
    label: String,
    action_type: String,
    handler: ActionHandler,
}

#[derive(Serialize, Deserialize, Clone)]
struct ActionHandler {
    handler_type: String,
    target: String,
    parameters: Option<serde_json::Value>,
}

// Trait definitions for dependency injection
#[async_trait::async_trait]
trait FunctionRegistry: Send + Sync {
    async fn get_function(&self, function_id: &str) -> Result<FunctionDefinition, Box<dyn std::error::Error>>;
    async fn validate_parameters(&self, function_id: &str, parameters: &serde_json::Value) -> Result<bool, Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait AppsRegistry: Send + Sync {
    async fn get_app(&self, app_id: &str) -> Result<AppDefinition, Box<dyn std::error::Error>>;
    async fn execute_tool(&self, app_id: &str, tool_id: &str, parameters: &serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>>;
    async fn get_ui_card(&self, app_id: &str, tool_id: &str, result: &serde_json::Value) -> Result<Option<UICard>, Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait PolicyEngine: Send + Sync {
    async fn check_permission(&self, user_id: &str, agent_id: &str, function_call: &FunctionCall) -> Result<bool, Box<dyn std::error::Error>>;
    async fn requires_confirmation(&self, function_call: &FunctionCall) -> Result<bool, Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait AuditLogger: Send + Sync {
    async fn log(&self, event: &str) -> Result<(), Box<dyn std::error::Error>>;
}

#[derive(Serialize, Deserialize, Clone)]
struct FunctionDefinition {
    id: String,
    name: String,
    description: String,
    version: String,
    platform_support: PlatformSupport,
    risk_level: String,
    requires_confirmation: bool,
    parameters: serde_json::Value,
    examples: Vec<FunctionExample>,
    execution_context: String,
    capabilities_required: Vec<String>,
    timeout_ms: u64,
    category: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct PlatformSupport {
    ios: bool,
    android: bool,
    web: bool,
    desktop: bool,
    backend: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct FunctionExample {
    description: String,
    input: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
struct AppDefinition {
    id: String,
    name: String,
    description: String,
    version: String,
    developer: String,
    website: String,
    icon_url: String,
    categories: Vec<String>,
    auth_type: String,
    tools: Vec<ToolDefinition>,
    ui_cards: Vec<UICardTemplate>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ToolDefinition {
    id: String,
    name: String,
    description: String,
    category: String,
    parameters: serde_json::Value,
    returns: serde_json::Value,
    risk_level: String,
    requires_confirmation: bool,
    execution_time_estimate_ms: u64,
    rate_limits: Option<RateLimitConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
struct RateLimitConfig {
    max_calls: u32,
    time_window_ms: u64,
}

#[derive(Serialize, Deserialize, Clone)]
struct UICardTemplate {
    card_type: String,
    title_template: String,
    content_template: serde_json::Value,
    actions: Vec<CardActionTemplate>,
}

#[derive(Serialize, Deserialize, Clone)]
struct CardActionTemplate {
    id: String,
    label: String,
    action_type: String,
    handler: ActionHandlerTemplate,
}

#[derive(Serialize, Deserialize, Clone)]
struct ActionHandlerTemplate {
    handler_type: String,
    target: String,
    parameters: Option<serde_json::Value>,
}

async fn handle_execute(
    State(state): State<Arc<AppState>>,
    request: Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>, StatusCode> {
    let start_time = std::time::Instant::now();
    
    // Log the execution request
    state.audit_logger
        .log(&format!("EXECUTE_REQUEST: user={} agent={} function={} session={}", 
            request.user_id, request.agent_id, request.function_call.function_id, request.session_id))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check permissions
    let allowed = state
        .policy_engine
        .check_permission(&request.user_id, &request.agent_id, &request.function_call)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !allowed {
        state.audit_logger
            .log(&format!("EXECUTE_DENIED: user={} agent={} function={} reason=permission_denied", 
                request.user_id, request.agent_id, request.function_call.function_id))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Ok(Json(ExecuteResponse {
            success: false,
            result: None,
            error: Some("Permission denied for this function".to_string()),
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            ui_card: None,
        }));
    }

    // Check if confirmation is required
    let requires_confirmation = state
        .policy_engine
        .requires_confirmation(&request.function_call)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if requires_confirmation {
        state.audit_logger
            .log(&format!("EXECUTE_CONFIRMATION_REQUIRED: user={} agent={} function={} reason=risk_level", 
                request.user_id, request.agent_id, request.function_call.function_id))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        return Ok(Json(ExecuteResponse {
            success: false,
            result: None,
            error: Some("Confirmation required for this action".to_string()),
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            ui_card: Some(create_confirmation_card(&request.function_call)),
        }));
    }

    // Determine if this is a system function or app tool
    let result = if request.function_call.function_id.starts_with("com.allternit.os.") {
        // This is a system function - execute locally or via system APIs
        execute_system_function(&request.function_call, &request.context).await
    } else if request.function_call.function_id.contains('.') {
        // This is an app tool - extract app and tool IDs
        let parts: Vec<&str> = request.function_call.function_id.split('.').collect();
        if parts.len() >= 3 {
            let app_id = format!("{}.{}", parts[0], parts[1]); // e.g., "com.doordash"
            let tool_id = parts[2..].join("."); // e.g., "app.place_order"
            
            state.apps_registry
                .execute_tool(&app_id, &tool_id, &request.function_call.parameters)
                .await
                .map_err(|e| {
                    eprintln!("Error executing app tool: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
        } else {
            return Err(StatusCode::BAD_REQUEST);
        }
    } else {
        // Unknown function type
        return Err(StatusCode::BAD_REQUEST);
    };

    // Get UI card for the result
    let ui_card = if request.function_call.function_id.contains('.') {
        let parts: Vec<&str> = request.function_call.function_id.split('.').collect();
        if parts.len() >= 3 {
            let app_id = format!("{}.{}", parts[0], parts[1]);
            let tool_id = parts[2..].join(".");
            
            state.apps_registry
                .get_ui_card(&app_id, &tool_id, &result)
                .await
                .map_err(|e| {
                    eprintln!("Error getting UI card: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
        } else {
            None
        }
    } else {
        // For system functions, create a generic UI card
        create_system_function_card(&request.function_call.function_id, &result)
    };

    // Log successful execution
    state.audit_logger
        .log(&format!("EXECUTE_SUCCESS: user={} agent={} function={} session={} execution_time_ms={}", 
            request.user_id, request.agent_id, request.function_call.function_id, 
            request.session_id, start_time.elapsed().as_millis()))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ExecuteResponse {
        success: true,
        result: Some(result),
        error: None,
        execution_time_ms: start_time.elapsed().as_millis() as u64,
        ui_card,
    }))
}

async fn execute_system_function(function_call: &FunctionCall, context: &serde_json::Value) -> serde_json::Value {
    // In a real implementation, this would call actual system functions
    // For now, we'll simulate based on the function ID
    match function_call.function_id.as_str() {
        "com.allternit.os.set_alarm" => {
            // Simulate setting an alarm
            serde_json::json!({
                "status": "success",
                "message": format!("Alarm set for {}", 
                    function_call.parameters.get("time").unwrap_or(&serde_json::Value::String("unknown".to_string()))),
                "time": function_call.parameters.get("time").unwrap_or(&serde_json::Value::String("unknown".to_string())),
                "label": function_call.parameters.get("label").unwrap_or(&serde_json::Value::String("".to_string()))
            })
        },
        "com.allternit.os.create_note" => {
            // Simulate creating a note
            serde_json::json!({
                "status": "success", 
                "message": "Note created successfully",
                "title": function_call.parameters.get("title").unwrap_or(&serde_json::Value::String("".to_string())),
                "content": function_call.parameters.get("content").unwrap_or(&serde_json::Value::String("".to_string()))
            })
        },
        "com.allternit.os.schedule_event" => {
            // Simulate scheduling an event
            serde_json::json!({
                "status": "success",
                "message": "Event scheduled successfully",
                "title": function_call.parameters.get("title").unwrap_or(&serde_json::Value::String("".to_string())),
                "start_time": function_call.parameters.get("start_time").unwrap_or(&serde_json::Value::String("".to_string())),
                "end_time": function_call.parameters.get("end_time").unwrap_or(&serde_json::Value::String("".to_string()))
            })
        },
        _ => {
            // Unknown system function
            serde_json::json!({
                "status": "error",
                "message": format!("Unknown system function: {}", function_call.function_id)
            })
        }
    }
}

fn create_confirmation_card(function_call: &FunctionCall) -> UICard {
    UICard {
        card_type: "action".to_string(),
        title: "Action Confirmation Required".to_string(),
        subtitle: Some("This action requires your explicit confirmation".to_string()),
        content: serde_json::json!({
            "function": function_call.function_id,
            "parameters": function_call.parameters,
            "risk_level": "high"
        }),
        actions: Some(vec![
            CardAction {
                id: "confirm".to_string(),
                label: "Confirm".to_string(),
                action_type: "primary".to_string(),
                handler: ActionHandler {
                    handler_type: "tool_call".to_string(),
                    target: "confirm_action".to_string(),
                    parameters: Some(serde_json::json!({
                        "function_call": function_call
                    })),
                },
            },
            CardAction {
                id: "cancel".to_string(),
                label: "Cancel".to_string(),
                action_type: "secondary".to_string(),
                handler: ActionHandler {
                    handler_type: "tool_call".to_string(),
                    target: "cancel_action".to_string(),
                    parameters: Some(serde_json::json!({
                        "function_call": function_call
                    })),
                },
            },
        ]),
    }
}

fn create_system_function_card(function_id: &str, result: &serde_json::Value) -> Option<UICard> {
    match function_id {
        "com.allternit.os.set_alarm" => Some(UICard {
            card_type: "basic".to_string(),
            title: "Alarm Set".to_string(),
            subtitle: result.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
            content: serde_json::json!({
                "time": result.get("time").unwrap_or(&serde_json::Value::String("unknown".to_string())),
                "label": result.get("label").unwrap_or(&serde_json::Value::String("".to_string()))
            }),
            actions: None,
        }),
        "com.allternit.os.create_note" => Some(UICard {
            card_type: "basic".to_string(),
            title: "Note Created".to_string(),
            subtitle: result.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
            content: serde_json::json!({
                "title": result.get("title").unwrap_or(&serde_json::Value::String("".to_string())),
                "content": result.get("content").unwrap_or(&serde_json::Value::String("".to_string()))
            }),
            actions: Some(vec![
                CardAction {
                    id: "view_note".to_string(),
                    label: "View Note".to_string(),
                    action_type: "primary".to_string(),
                    handler: ActionHandler {
                        handler_type: "app_intent".to_string(),
                        target: "view_note".to_string(),
                        parameters: None,
                    },
                }
            ]),
        }),
        "com.allternit.os.schedule_event" => Some(UICard {
            card_type: "basic".to_string(),
            title: "Event Scheduled".to_string(),
            subtitle: result.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
            content: serde_json::json!({
                "title": result.get("title").unwrap_or(&serde_json::Value::String("".to_string())),
                "start_time": result.get("start_time").unwrap_or(&serde_json::Value::String("".to_string())),
                "end_time": result.get("end_time").unwrap_or(&serde_json::Value::String("".to_string()))
            }),
            actions: Some(vec![
                CardAction {
                    id: "view_event".to_string(),
                    label: "View Event".to_string(),
                    action_type: "primary".to_string(),
                    handler: ActionHandler {
                        handler_type: "app_intent".to_string(),
                        target: "view_calendar_event".to_string(),
                        parameters: None,
                    },
                }
            ]),
        }),
        _ => None,
    }
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "executor",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    })))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // In a real implementation, these would be actual service instances
    // For now, we'll use mock implementations
    let function_registry: Arc<dyn FunctionRegistry> = Arc::new(MockFunctionRegistry);
    let apps_registry: Arc<dyn AppsRegistry> = Arc::new(MockAppsRegistry);
    let policy_engine: Arc<dyn PolicyEngine> = Arc::new(MockPolicyEngine);
    let audit_logger: Arc<dyn AuditLogger> = Arc::new(MockAuditLogger);

    let app_state = Arc::new(AppState {
        function_registry,
        apps_registry,
        policy_engine,
        audit_logger,
    });

    let app = Router::new()
        .route("/execute", post(handle_execute))
        .route("/health", get(health_check))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3510".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Executor Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

// Mock implementations for demonstration
struct MockFunctionRegistry;
struct MockAppsRegistry;
struct MockPolicyEngine;
struct MockAuditLogger;

#[async_trait::async_trait]
impl FunctionRegistry for MockFunctionRegistry {
    async fn get_function(&self, function_id: &str) -> Result<FunctionDefinition, Box<dyn std::error::Error>> {
        // Return a mock function definition
        Ok(FunctionDefinition {
            id: function_id.to_string(),
            name: "Mock Function".to_string(),
            description: "A mock function for testing".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: true,
                web: true,
                desktop: true,
                backend: true,
            },
            risk_level: "low".to_string(),
            requires_confirmation: false,
            parameters: serde_json::json!({}),
            examples: vec![],
            execution_context: "backend".to_string(),
            capabilities_required: vec![],
            timeout_ms: 5000,
            category: "mock".to_string(),
        })
    }
    
    async fn validate_parameters(&self, _function_id: &str, _parameters: &serde_json::Value) -> Result<bool, Box<dyn std::error::Error>> {
        Ok(true)
    }
}

#[async_trait::async_trait]
impl AppsRegistry for MockAppsRegistry {
    async fn get_app(&self, app_id: &str) -> Result<AppDefinition, Box<dyn std::error::Error>> {
        // Return a mock app definition
        Ok(AppDefinition {
            id: app_id.to_string(),
            name: "Mock App".to_string(),
            description: "A mock app for testing".to_string(),
            version: "1.0.0".to_string(),
            developer: "Mock Developer".to_string(),
            website: "https://mock.example.com".to_string(),
            icon_url: "https://mock.example.com/icon.png".to_string(),
            categories: vec!["mock".to_string()],
            auth_type: "none".to_string(),
            tools: vec![],
            ui_cards: vec![],
        })
    }
    
    async fn execute_tool(&self, _app_id: &str, _tool_id: &str, _parameters: &serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // Return a mock result
        Ok(serde_json::json!({
            "status": "success",
            "message": "Mock tool executed successfully"
        }))
    }
    
    async fn get_ui_card(&self, _app_id: &str, _tool_id: &str, _result: &serde_json::Value) -> Result<Option<UICard>, Box<dyn std::error::Error>> {
        // Return a mock UI card
        Ok(Some(UICard {
            card_type: "basic".to_string(),
            title: "Mock Result".to_string(),
            subtitle: Some("Mock execution completed".to_string()),
            content: serde_json::json!({
                "message": "This is a mock result"
            }),
            actions: None,
        }))
    }
}

#[async_trait::async_trait]
impl PolicyEngine for MockPolicyEngine {
    async fn check_permission(&self, _user_id: &str, _agent_id: &str, _function_call: &FunctionCall) -> Result<bool, Box<dyn std::error::Error>> {
        // For demo purposes, allow all
        Ok(true)
    }
    
    async fn requires_confirmation(&self, function_call: &FunctionCall) -> Result<bool, Box<dyn std::error::Error>> {
        // Require confirmation for finance-related functions
        Ok(function_call.function_id.contains("finance") || function_call.function_id.contains("money"))
    }
}

#[async_trait::async_trait]
impl AuditLogger for MockAuditLogger {
    async fn log(&self, event: &str) -> Result<(), Box<dyn std::error::Error>> {
        println!("AUDIT: {}", event);
        Ok(())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_definition_creation() {
        let func = FunctionDefinition {
            id: "test_func".to_string(),
            name: "Test Function".to_string(),
            description: "A test function".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: true,
                web: true,
                desktop: true,
                backend: true,
            },
            risk_level: "low".to_string(),
            requires_confirmation: false,
            parameters: serde_json::json!({}),
            examples: vec![],
            execution_context: "backend".to_string(),
            capabilities_required: vec![],
            timeout_ms: 5000,
            category: "test".to_string(),
        };

        assert_eq!(func.id, "test_func");
        assert_eq!(func.risk_level, "low");
        assert!(!func.requires_confirmation);
    }

    #[test]
    fn test_app_definition_creation() {
        let app = AppDefinition {
            id: "test_app".to_string(),
            name: "Test App".to_string(),
            description: "A test application".to_string(),
            version: "1.0.0".to_string(),
            developer: "Test Developer".to_string(),
            website: "https://test.example.com".to_string(),
            icon_url: "https://test.example.com/icon.png".to_string(),
            categories: vec!["test".to_string()],
            auth_type: "oauth".to_string(),
            tools: vec![],
            ui_cards: vec![],
        };

        assert_eq!(app.id, "test_app");
        assert_eq!(app.categories.len(), 1);
    }

    #[test]
    fn test_ui_card_creation() {
        let card = UICard {
            card_type: "result".to_string(),
            title: "Test Result".to_string(),
            subtitle: Some("Test completed".to_string()),
            content: serde_json::json!({"status": "success"}),
            actions: Some(vec![CardAction {
                id: "action_1".to_string(),
                label: "Click Me".to_string(),
                action_type: "submit".to_string(),
                handler: ActionHandler {
                    handler_type: "http".to_string(),
                    target: "/api/submit".to_string(),
                    parameters: None,
                },
            }]),
        };

        assert_eq!(card.card_type, "result");
        assert!(card.actions.is_some());
        assert_eq!(card.actions.unwrap().len(), 1);
    }

    #[test]
    fn test_execute_request_serialization() {
        let request = ExecuteRequest {
            function_call: FunctionCall {
                function_id: "test_func".to_string(),
                parameters: serde_json::json!({"key": "value"}),
            },
            user_id: "user_123".to_string(),
            agent_id: "agent_456".to_string(),
            session_id: "session_789".to_string(),
            context: serde_json::json!({}),
        };

        let serialized = serde_json::to_string(&request).unwrap();
        assert!(serialized.contains("test_func"));
        assert!(serialized.contains("user_123"));
    }

    #[test]
    fn test_execute_response_serialization() {
        let response = ExecuteResponse {
            success: true,
            result: Some(serde_json::json!({"data": "test"})),
            error: None,
            execution_time_ms: 150,
            ui_card: None,
        };

        let serialized = serde_json::to_string(&response).unwrap();
        assert!(serialized.contains("true"));
        assert!(serialized.contains("150"));
    }
}
