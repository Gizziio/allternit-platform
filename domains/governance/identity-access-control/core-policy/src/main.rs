// /services/policy/src/main.rs
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
    permission_store: Arc<RwLock<HashMap<String, PermissionSet>>>,
    function_registry: Arc<RwLock<HashMap<String, FunctionDefinition>>>,
}

#[derive(Deserialize, Serialize, Clone)]
struct PermissionSet {
    id: String,
    user_id: String,
    agent_id: String,
    permissions: Permissions,
    confirmation_rules: Vec<ConfirmationRule>,
    default_confirmation_threshold: String,
    created_at: u64,
    updated_at: u64,
    status: String,
}

#[derive(Deserialize, Serialize, Clone)]
struct Permissions {
    functions: FunctionPermissions,
    data_access: DataAccessPermissions,
    system_capabilities: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionPermissions {
    allowed: Vec<String>,
    denied: Vec<String>,
    scoped: Vec<ScopedFunctionPermission>,
}

#[derive(Deserialize, Serialize, Clone)]
struct ScopedFunctionPermission {
    function_id: String,
    constraints: FunctionConstraints,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionConstraints {
    parameter_restrictions: HashMap<String, ParameterRestriction>,
    frequency_limits: Option<FrequencyLimit>,
    context_restrictions: Option<ContextRestriction>,
}

#[derive(Deserialize, Serialize, Clone)]
struct ParameterRestriction {
    allowed_values: Option<Vec<serde_json::Value>>,
    min_value: Option<f64>,
    max_value: Option<f64>,
    pattern: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct FrequencyLimit {
    max_calls: u32,
    time_window_ms: u64,
}

#[derive(Deserialize, Serialize, Clone)]
struct ContextRestriction {
    allowed_times: Option<Vec<String>>,
    allowed_locations: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize, Clone)]
struct DataAccessPermissions {
    read: Vec<String>,
    write: Vec<String>,
    delete: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct ConfirmationRule {
    id: String,
    name: String,
    description: String,
    condition: RuleCondition,
    action: String, // "require_confirmation", "block", "log", "notify"
    priority: i32,
}

#[derive(Deserialize, Serialize, Clone)]
struct RuleCondition {
    condition_type: String, // "risk_level", "function_id", "parameter_value", "frequency", "context"
    operator: String, // "equals", "greater_than", "less_than", "contains", "matches", "in_list"
    value: serde_json::Value,
    field: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct FunctionDefinition {
    id: String,
    name: String,
    description: String,
    risk_level: String, // "low", "medium", "high", "critical"
    requires_confirmation: bool,
    parameters: serde_json::Value,
}

#[derive(Deserialize)]
struct PermissionCheckRequest {
    user_id: String,
    agent_id: String,
    function_call: FunctionCall,
}

#[derive(Deserialize, Serialize)]
struct FunctionCall {
    function_id: String,
    parameters: serde_json::Value,
}

#[derive(Serialize)]
struct PermissionCheckResponse {
    allowed: bool,
    requires_confirmation: bool,
    reason: Option<String>,
}

#[tokio::main]
async fn main() {
    // Initialize permission store with default permissions
    let mut permissions = HashMap::new();
    permissions.insert(
        "perm-default-user-default-agent".to_string(),
        PermissionSet {
            id: "perm-default-user-default-agent".to_string(),
            user_id: "default_user".to_string(),
            agent_id: "default_agent".to_string(),
            permissions: Permissions {
                functions: FunctionPermissions {
                    allowed: vec![
                        "com.allternit.os.set_alarm".to_string(),
                        "com.allternit.os.create_note".to_string(),
                        "com.allternit.web.search".to_string(),
                    ],
                    denied: vec![
                        "com.allternit.finance.transfer_money".to_string(),
                    ],
                    scoped: vec![
                        ScopedFunctionPermission {
                            function_id: "com.allternit.os.send_message".to_string(),
                            constraints: FunctionConstraints {
                                parameter_restrictions: {
                                    let mut map = HashMap::new();
                                    map.insert("recipient".to_string(), ParameterRestriction {
                                        allowed_values: Some(vec![
                                            serde_json::Value::String("+1234567890".to_string()),
                                            serde_json::Value::String("+0987654321".to_string()),
                                        ]),
                                        min_value: None,
                                        max_value: None,
                                        pattern: None,
                                    });
                                    map
                                },
                                frequency_limits: Some(FrequencyLimit {
                                    max_calls: 10,
                                    time_window_ms: 3600000, // 1 hour
                                }),
                                context_restrictions: None,
                            },
                        }
                    ],
                },
                data_access: DataAccessPermissions {
                    read: vec!["calendar".to_string(), "notes".to_string()],
                    write: vec!["notes".to_string()],
                    delete: vec![],
                },
                system_capabilities: vec!["alarms".to_string(), "location".to_string()],
            },
            confirmation_rules: vec![
                ConfirmationRule {
                    id: "rule-medium-risk".to_string(),
                    name: "Require confirmation for medium+ risk".to_string(),
                    description: "Require user confirmation for functions with medium risk level or higher".to_string(),
                    condition: RuleCondition {
                        condition_type: "risk_level".to_string(),
                        operator: "greater_than".to_string(),
                        value: serde_json::Value::String("low".to_string()),
                        field: None,
                    },
                    action: "require_confirmation".to_string(),
                    priority: 10,
                },
                ConfirmationRule {
                    id: "rule-finance".to_string(),
                    name: "Always confirm finance functions".to_string(),
                    description: "Always require confirmation for finance-related functions".to_string(),
                    condition: RuleCondition {
                        condition_type: "function_id".to_string(),
                        operator: "contains".to_string(),
                        value: serde_json::Value::String("finance".to_string()),
                        field: None,
                    },
                    action: "require_confirmation".to_string(),
                    priority: 20,
                },
            ],
            default_confirmation_threshold: "medium".to_string(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            status: "active".to_string(),
        },
    );

    // Initialize function registry
    let mut functions = HashMap::new();
    functions.insert(
        "com.allternit.os.set_alarm".to_string(),
        FunctionDefinition {
            id: "com.allternit.os.set_alarm".to_string(),
            name: "Set Alarm".to_string(),
            description: "Sets an alarm on the device for a specified time".to_string(),
            risk_level: "low".to_string(),
            requires_confirmation: true,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "time": {
                        "type": "string",
                        "description": "Time for the alarm in HH:MM format"
                    },
                    "label": {
                        "type": "string",
                        "description": "Optional label for the alarm"
                    }
                },
                "required": ["time"]
            }),
        },
    );
    functions.insert(
        "com.allternit.finance.transfer_money".to_string(),
        FunctionDefinition {
            id: "com.allternit.finance.transfer_money".to_string(),
            name: "Transfer Money".to_string(),
            description: "Transfers money to another account".to_string(),
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
        },
    );

    let app_state = Arc::new(AppState {
        permission_store: Arc::new(RwLock::new(permissions)),
        function_registry: Arc::new(RwLock::new(functions)),
    });

    let app = Router::new()
        .route("/check", post(handle_permission_check))
        .route("/confirm", post(handle_confirmation_check))
        .route("/permissions", get(handle_list_permissions))
        .route("/functions", get(handle_list_functions))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3003".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Policy Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

async fn handle_permission_check(
    State(state): State<Arc<AppState>>,
    request: Json<PermissionCheckRequest>,
) -> Result<Json<PermissionCheckResponse>, StatusCode> {
    let permissions = state.permission_store.read().unwrap();
    let functions = state.function_registry.read().unwrap();
    
    // Find the permission set for this user-agent combination
    let perm_key = format!("perm-{}-{}", request.user_id, request.agent_id);
    let permission_set = permissions.get(&perm_key).ok_or(StatusCode::NOT_FOUND)?;

    // Check if the function is denied
    if permission_set.permissions.functions.denied.contains(&request.function_call.function_id) {
        return Ok(Json(PermissionCheckResponse {
            allowed: false,
            requires_confirmation: false,
            reason: Some("Function is explicitly denied".to_string()),
        }));
    }

    // Check if the function is allowed
    if !permission_set.permissions.functions.allowed.contains(&request.function_call.function_id) {
        return Ok(Json(PermissionCheckResponse {
            allowed: false,
            requires_confirmation: false,
            reason: Some("Function is not in allowed list".to_string()),
        }));
    }

    // Check function-specific constraints
    for scoped_perm in &permission_set.permissions.functions.scoped {
        if scoped_perm.function_id == request.function_call.function_id {
            // Check parameter restrictions
            for (param_name, restriction) in &scoped_perm.constraints.parameter_restrictions {
                if let Some(param_value) = request.function_call.parameters.get(param_name) {
                    if let Some(allowed_values) = &restriction.allowed_values {
                        if !allowed_values.contains(param_value) {
                            return Ok(Json(PermissionCheckResponse {
                                allowed: false,
                                requires_confirmation: false,
                                reason: Some(format!("Parameter '{}' has invalid value", param_name)),
                            }));
                        }
                    }
                }
            }
        }
    }

    // Check if function requires confirmation based on risk level
    let function_def = functions.get(&request.function_call.function_id);
    let requires_confirmation = if let Some(def) = function_def {
        def.requires_confirmation || 
        is_risk_level_at_threshold(&def.risk_level, &permission_set.default_confirmation_threshold)
    } else {
        // If function not found in registry, default to requiring confirmation for safety
        true
    };

    // Apply confirmation rules
    let mut final_confirmation = requires_confirmation;
    for rule in &permission_set.confirmation_rules {
        if evaluate_rule(&rule.condition, &request.function_call, function_def)? {
            if rule.action == "require_confirmation" {
                final_confirmation = true;
            } else if rule.action == "block" {
                return Ok(Json(PermissionCheckResponse {
                    allowed: false,
                    requires_confirmation: false,
                    reason: Some("Blocked by policy rule".to_string()),
                }));
            }
        }
    }

    Ok(Json(PermissionCheckResponse {
        allowed: true,
        requires_confirmation: final_confirmation,
        reason: None,
    }))
}

async fn handle_confirmation_check(
    State(state): State<Arc<AppState>>,
    request: Json<PermissionCheckRequest>,
) -> Result<Json<PermissionCheckResponse>, StatusCode> {
    // This is a simplified version that just checks if confirmation is needed
    // In a real implementation, this would track confirmation status
    handle_permission_check(State(state), request).await
}

async fn handle_list_permissions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<PermissionSet>>, StatusCode> {
    let permissions = state.permission_store.read().unwrap();
    Ok(Json(permissions.values().cloned().collect()))
}

async fn handle_list_functions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FunctionDefinition>>, StatusCode> {
    let functions = state.function_registry.read().unwrap();
    Ok(Json(functions.values().cloned().collect()))
}

fn is_risk_level_at_threshold(risk_level: &str, threshold: &str) -> bool {
    let risk_order = ["low", "medium", "high", "critical"];
    if let (Some(risk_idx), Some(threshold_idx)) = (
        risk_order.iter().position(|&r| r == risk_level),
        risk_order.iter().position(|&r| r == threshold),
    ) {
        risk_idx >= threshold_idx
    } else {
        false
    }
}

fn evaluate_rule(
    condition: &RuleCondition,
    function_call: &FunctionCall,
    function_def: Option<&FunctionDefinition>,
) -> Result<bool, StatusCode> {
    match condition.condition_type.as_str() {
        "risk_level" => {
            if let Some(def) = function_def {
                match condition.operator.as_str() {
                    "greater_than" => {
                        let risk_order = ["low", "medium", "high", "critical"];
                        if let (Some(risk_idx), Some(threshold_idx)) = (
                            risk_order.iter().position(|&r| r == def.risk_level),
                            risk_order.iter().position(|&r| r == condition.value.as_str().unwrap_or(""))
                        ) {
                            Ok(risk_idx > threshold_idx)
                        } else {
                            Ok(false)
                        }
                    }
                    _ => Ok(false),
                }
            } else {
                Ok(false)
            }
        }
        "function_id" => {
            match condition.operator.as_str() {
                "contains" => {
                    if let Some(value) = condition.value.as_str() {
                        Ok(function_call.function_id.contains(value))
                    } else {
                        Ok(false)
                    }
                }
                _ => Ok(false),
            }
        }
        _ => Ok(false),
    }
}
