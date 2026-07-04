use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    hook_registry: Arc<dyn HookRegistry>,
    event_bus: Arc<dyn EventBus>,
    policy_engine: Arc<dyn PolicyEngine>,
    audit_logger: Arc<dyn AuditLogger>,
}

#[derive(Deserialize)]
struct RegisterHookRequest {
    hook: HookDefinition,
    user_id: String,
    agent_id: String,
}

#[derive(Serialize)]
struct RegisterHookResponse {
    success: bool,
    hook_id: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct TriggerEventRequest {
    event_type: String,
    payload: serde_json::Value,
    source: String,
    user_id: Option<String>,
    agent_id: Option<String>,
}

#[derive(Serialize)]
struct TriggerEventResponse {
    success: bool,
    triggered_hooks: usize,
    error: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct HookDefinition {
    id: String,
    name: String,
    description: String,
    event_type: String, // "session_start", "pre_tool_use", "post_tool_use", "function_call", etc.
    condition: String,  // Expression that determines when hook triggers
    action: HookAction,
    enabled: bool,
    owner_id: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
struct HookAction {
    action_type: String, // "tool_call", "notification", "webhook", "app_intent", "logging"
    target: String,      // Function ID, URL, app intent, etc.
    parameters: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct ListHooksResponse {
    hooks: Vec<HookDefinition>,
    total_count: usize,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    timestamp: u64,
}

// Trait definitions for dependency injection
#[async_trait::async_trait]
trait HookRegistry: Send + Sync {
    async fn register_hook(&self, hook: HookDefinition) -> Result<(), Box<dyn std::error::Error>>;
    async fn unregister_hook(
        &self,
        hook_id: &str,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>>;
    async fn get_hooks_for_event(
        &self,
        event_type: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>>;
    async fn get_user_hooks(
        &self,
        user_id: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>>;
    async fn update_hook(
        &self,
        hook_id: &str,
        updates: HookUpdates,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>>;
    async fn evaluate_condition(
        &self,
        condition: &str,
        context: &serde_json::Value,
    ) -> Result<bool, Box<dyn std::error::Error>>;
    async fn get_statistics(&self) -> Result<HookStatistics, Box<dyn std::error::Error>>;
    async fn record_execution(
        &self,
        results: &[HookResult],
    ) -> Result<(), Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait EventBus: Send + Sync {
    async fn publish(&self, event: Event) -> Result<(), Box<dyn std::error::Error>>;
    async fn subscribe(
        &self,
        event_type: &str,
        handler: Box<dyn EventHandler>,
    ) -> Result<(), Box<dyn std::error::Error>>;
    async fn trigger_hooks_for_event(
        &self,
        event: &Event,
    ) -> Result<Vec<HookResult>, Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait PolicyEngine: Send + Sync {
    async fn check_permission(
        &self,
        user_id: &str,
        agent_id: &str,
        action: &str,
    ) -> Result<bool, Box<dyn std::error::Error>>;
    async fn requires_confirmation(
        &self,
        user_id: &str,
        agent_id: &str,
        action: &str,
    ) -> Result<bool, Box<dyn std::error::Error>>;
}

#[async_trait::async_trait]
trait AuditLogger: Send + Sync {
    async fn log(&self, event: &str) -> Result<(), Box<dyn std::error::Error>>;
}

#[derive(Deserialize, Serialize, Clone)]
struct Event {
    id: String,
    event_type: String,
    payload: serde_json::Value,
    source: String,
    timestamp: u64,
    user_id: Option<String>,
    agent_id: Option<String>,
    metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct HookResult {
    hook_id: String,
    success: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
    execution_time_ms: u64,
}

#[derive(Deserialize)]
struct HookUpdates {
    name: Option<String>,
    description: Option<String>,
    condition: Option<String>,
    action: Option<HookAction>,
    enabled: Option<bool>,
}

pub struct HookService {
    pub config: HookServiceConfig,
    pub registry: Arc<dyn HookRegistry>,
    pub event_bus: Arc<dyn EventBus>,
    pub policy_engine: Arc<dyn PolicyEngine>,
    pub audit_logger: Arc<dyn AuditLogger>,
}

#[derive(Debug, Clone)]
pub struct HookServiceConfig {
    pub max_hooks_per_user: usize,
    pub max_conditions_complexity: usize,
    pub enable_sandboxing: bool,
    pub default_timeout_ms: u64,
    pub audit_logging_enabled: bool,
}

impl HookService {
    pub fn new(
        config: HookServiceConfig,
        registry: Arc<dyn HookRegistry>,
        event_bus: Arc<dyn EventBus>,
        policy_engine: Arc<dyn PolicyEngine>,
        audit_logger: Arc<dyn AuditLogger>,
    ) -> Self {
        Self {
            config,
            registry,
            event_bus,
            policy_engine,
            audit_logger,
        }
    }

    pub async fn register_hook(
        &self,
        hook: HookDefinition,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Check permissions
        let allowed = self
            .policy_engine
            .check_permission(user_id, &hook.owner_id, "hooks.register")
            .await?;
        if !allowed {
            return Err("Permission denied".into());
        }

        // Validate hook definition
        self.validate_hook(&hook).await?;

        // Register the hook
        let hook_id = hook.id.clone();
        self.registry.register_hook(hook).await?;

        if self.config.audit_logging_enabled {
            self.audit_logger
                .log(&format!(
                    "HOOK_REGISTERED: user={} hook_id={}",
                    user_id, hook_id
                ))
                .await?;
        }

        Ok(())
    }

    pub async fn trigger_event(
        &self,
        event: Event,
    ) -> Result<Vec<HookResult>, Box<dyn std::error::Error>> {
        // Log the event
        if self.config.audit_logging_enabled {
            self.audit_logger
                .log(&format!(
                    "EVENT_RECEIVED: type={} source={} user={} agent={}",
                    event.event_type,
                    event.source,
                    event.user_id.as_deref().unwrap_or("unknown"),
                    event.agent_id.as_deref().unwrap_or("unknown")
                ))
                .await?;
        }

        // Get matching hooks
        let matching_hooks = self.registry.get_hooks_for_event(&event.event_type).await?;

        let mut results = Vec::new();
        for hook in matching_hooks {
            // Check if hook is enabled and condition matches
            if hook.enabled {
                let condition_met = self
                    .registry
                    .evaluate_condition(&hook.condition, &event.payload)
                    .await?;

                if condition_met {
                    let start_time = std::time::Instant::now();

                    // Execute the hook action
                    let result = self.execute_hook_action(&hook.action, &event).await;

                    let execution_time = start_time.elapsed().as_millis() as u64;

                    let hook_result = HookResult {
                        hook_id: hook.id.clone(),
                        success: result.is_ok(),
                        result: result.as_ref().ok().cloned(),
                        error: result.err().map(|e| e.to_string()),
                        execution_time_ms: execution_time,
                    };

                    results.push(hook_result);
                }
            }
        }

        Ok(results)
    }

    async fn execute_hook_action(
        &self,
        action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        match action.action_type.as_str() {
            "tool_call" => {
                // Execute a tool call
                self.execute_tool_call(action, event).await
            }
            "notification" => {
                // Send a notification
                self.send_notification(action, event).await
            }
            "webhook" => {
                // Call an external webhook
                self.call_webhook(action, event).await
            }
            "app_intent" => {
                // Execute an app intent (iOS/macOS)
                self.execute_app_intent(action, event).await
            }
            "logging" => {
                // Log the event
                self.log_event(action, event).await
            }
            _ => Err(format!("Unknown action type: {}", action.action_type).into()),
        }
    }

    async fn execute_tool_call(
        &self,
        action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // In a real implementation, this would call the tool execution service
        // For now, we'll simulate the execution
        Ok(serde_json::json!({
            "status": "executed",
            "action": "tool_call",
            "target": &action.target,
            "event_type": &event.event_type,
            "event_source": &event.source,
        }))
    }

    async fn send_notification(
        &self,
        action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // In a real implementation, this would send a push notification
        // For now, we'll just log it
        println!("Notification would be sent: {:?}", action);
        Ok(serde_json::json!({
            "status": "sent",
            "action": "notification",
            "event_type": &event.event_type,
        }))
    }

    async fn call_webhook(
        &self,
        action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // In a real implementation, this would make an HTTP call to the webhook
        // For now, we'll simulate the call
        let client = reqwest::Client::new();

        let payload = serde_json::json!({
            "event_type": &event.event_type,
            "payload": &event.payload,
            "source": &event.source,
            "timestamp": event.timestamp,
        });

        let response = client.post(&action.target).json(&payload).send().await?;

        let response_text = response.text().await?;
        Ok(serde_json::json!({
            "status": "called",
            "action": "webhook",
            "target": &action.target,
            "response": response_text,
        }))
    }

    async fn execute_app_intent(
        &self,
        action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // In a real implementation, this would execute an iOS/macOS app intent
        // For now, we'll simulate the execution
        Ok(serde_json::json!({
            "status": "executed",
            "action": "app_intent",
            "target": &action.target,
            "event_type": &event.event_type,
        }))
    }

    async fn log_event(
        &self,
        _action: &HookAction,
        event: &Event,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        // Log to audit trail
        if self.config.audit_logging_enabled {
            self.audit_logger
                .log(&format!(
                    "HOOK_LOG_EVENT: type={} source={} payload_len={}",
                    event.event_type,
                    event.source,
                    event.payload.to_string().len()
                ))
                .await?;
        }

        Ok(serde_json::json!({
            "status": "logged",
            "action": "logging",
            "event_type": &event.event_type,
        }))
    }

    async fn validate_hook(&self, hook: &HookDefinition) -> Result<(), Box<dyn std::error::Error>> {
        // Validate hook ID format
        if hook.id.is_empty() {
            return Err("Hook ID cannot be empty".into());
        }

        // Validate condition complexity (prevent overly complex conditions)
        if hook.condition.len() > self.config.max_conditions_complexity {
            return Err(format!(
                "Condition too complex, exceeds {} character limit",
                self.config.max_conditions_complexity
            )
            .into());
        }

        // Validate action
        if hook.action.action_type.is_empty() {
            return Err("Action type cannot be empty".into());
        }

        // Validate target
        if hook.action.target.is_empty() {
            return Err("Action target cannot be empty".into());
        }

        Ok(())
    }

    pub async fn get_user_hooks(
        &self,
        user_id: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>> {
        self.registry.get_user_hooks(user_id).await
    }

    pub async fn unregister_hook(
        &self,
        hook_id: &str,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Check permissions
        let allowed = self
            .policy_engine
            .check_permission(user_id, user_id, "hooks.unregister")
            .await?;
        if !allowed {
            return Err("Permission denied".into());
        }

        self.registry.unregister_hook(hook_id, user_id).await?;

        if self.config.audit_logging_enabled {
            self.audit_logger
                .log(&format!(
                    "HOOK_UNREGISTERED: user={} hook_id={}",
                    user_id, hook_id
                ))
                .await?;
        }

        Ok(())
    }

    pub async fn update_hook(
        &self,
        hook_id: &str,
        updates: HookUpdates,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Check permissions
        let allowed = self
            .policy_engine
            .check_permission(user_id, user_id, "hooks.update")
            .await?;
        if !allowed {
            return Err("Permission denied".into());
        }

        self.registry.update_hook(hook_id, updates, user_id).await?;

        if self.config.audit_logging_enabled {
            self.audit_logger
                .log(&format!(
                    "HOOK_UPDATED: user={} hook_id={}",
                    user_id, hook_id
                ))
                .await?;
        }

        Ok(())
    }

    pub async fn get_hooks_for_event_type(
        &self,
        event_type: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>> {
        self.registry.get_hooks_for_event(event_type).await
    }

    pub async fn execute_hooks_for_event(
        &self,
        event: &Event,
    ) -> Result<Vec<HookResult>, Box<dyn std::error::Error>> {
        // This would trigger all matching hooks for the event
        // In a real implementation, this would be called by the event bus
        let matching_hooks = self.get_hooks_for_event_type(&event.event_type).await?;

        let mut results = Vec::new();
        for hook in matching_hooks {
            if hook.enabled {
                let condition_met = self
                    .evaluate_condition(&hook.condition, &event.payload)
                    .await?;

                if condition_met {
                    let start_time = std::time::Instant::now();

                    let execution_result = self.execute_hook_action(&hook.action, event).await;

                    let execution_time = start_time.elapsed().as_millis() as u64;
                    let (result, error) = match execution_result {
                        Ok(value) => (Some(value), None),
                        Err(err) => (None, Some(err.to_string())),
                    };

                    results.push(HookResult {
                        hook_id: hook.id.clone(),
                        success: error.is_none(),
                        result,
                        error,
                        execution_time_ms: execution_time,
                    });
                }
            }
        }

        Ok(results)
    }

    pub async fn evaluate_condition(
        &self,
        condition: &str,
        context: &serde_json::Value,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        // In a real implementation, this would evaluate the condition expression
        // For now, we'll implement a simple evaluator
        // This is a very basic implementation - a real one would use a proper expression evaluator

        // Simple condition evaluation - check if context contains the condition string
        let context_str = context.to_string().to_lowercase();
        let condition_lower = condition.to_lowercase();

        // For now, just check if the condition appears in the context
        // In a real implementation, this would be a proper expression evaluation
        Ok(context_str.contains(&condition_lower))
    }

    pub async fn get_statistics(&self) -> Result<HookStatistics, Box<dyn std::error::Error>> {
        self.registry.get_statistics().await
    }
}

#[derive(Serialize, Deserialize)]
pub struct HookStatistics {
    pub total_hooks: usize,
    pub active_hooks: usize,
    pub triggered_hooks_today: u32,
    pub execution_errors_today: u32,
    pub average_execution_time_ms: f64,
}

async fn handle_register_hook(
    State(state): State<Arc<AppState>>,
    request: axum::Json<RegisterHookRequest>,
) -> Result<axum::Json<RegisterHookResponse>, StatusCode> {
    // Check permissions
    let allowed = state
        .policy_engine
        .check_permission(&request.user_id, &request.agent_id, "hooks.register")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !allowed {
        return Ok(axum::Json(RegisterHookResponse {
            success: false,
            hook_id: None,
            error: Some("Permission denied".to_string()),
        }));
    }

    // Validate the hook definition
    if request.hook.event_type.is_empty() {
        return Ok(axum::Json(RegisterHookResponse {
            success: false,
            hook_id: None,
            error: Some("Event type cannot be empty".to_string()),
        }));
    }

    if request.hook.action.action_type.is_empty() {
        return Ok(axum::Json(RegisterHookResponse {
            success: false,
            hook_id: None,
            error: Some("Action type cannot be empty".to_string()),
        }));
    }

    // Generate a unique ID if not provided
    let mut hook = request.hook.clone();
    if hook.id.is_empty() {
        hook.id = uuid::Uuid::new_v4().to_string();
    }

    // Set timestamps
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    hook.created_at = now;
    hook.updated_at = now;

    // Register the hook
    state
        .hook_registry
        .register_hook(hook)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Log the registration
    state
        .audit_logger
        .log(&format!(
            "HOOK_REGISTERED: user={} hook_id={}",
            request.user_id, request.hook.id
        ))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(axum::Json(RegisterHookResponse {
        success: true,
        hook_id: Some(request.hook.id.clone()),
        error: None,
    }))
}

async fn handle_trigger_event(
    State(state): State<Arc<AppState>>,
    request: axum::Json<TriggerEventRequest>,
) -> Result<axum::Json<TriggerEventResponse>, StatusCode> {
    let event = Event {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: request.event_type.clone(),
        payload: request.payload.clone(),
        source: request.source.clone(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        user_id: request.user_id.clone(),
        agent_id: request.agent_id.clone(),
        metadata: serde_json::json!({
            "trigger_source": "api",
            "api_caller": "external"
        }),
    };

    // Log the event
    state
        .audit_logger
        .log(&format!(
            "EVENT_RECEIVED: type={} source={} user={} agent={}",
            event.event_type,
            event.source,
            event.user_id.as_deref().unwrap_or("unknown"),
            event.agent_id.as_deref().unwrap_or("unknown")
        ))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Trigger matching hooks
    let hook_results = state
        .event_bus
        .trigger_hooks_for_event(&event)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let triggered_count = hook_results.len();

    // Log the results
    state
        .audit_logger
        .log(&format!(
            "EVENT_PROCESSED: type={} triggered_hooks={} results={:?}",
            event.event_type, triggered_count, hook_results
        ))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(axum::Json(TriggerEventResponse {
        success: true,
        triggered_hooks: triggered_count,
        error: None,
    }))
}

async fn handle_list_hooks(
    State(state): State<Arc<AppState>>,
    user_id: axum::extract::Query<String>,
) -> Result<axum::Json<ListHooksResponse>, StatusCode> {
    let hooks = state
        .hook_registry
        .get_user_hooks(&user_id.0)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total_count = hooks.len();
    Ok(axum::Json(ListHooksResponse { hooks, total_count }))
}

async fn handle_health_check() -> Result<axum::Json<HealthResponse>, StatusCode> {
    Ok(axum::Json(HealthResponse {
        status: "healthy".to_string(),
        service: "hooks-service".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = HookServiceConfig {
        max_hooks_per_user: 100,
        max_conditions_complexity: 1000,
        enable_sandboxing: false,
        default_timeout_ms: 5000,
        audit_logging_enabled: true,
    };

    let hook_registry: Arc<dyn HookRegistry> = Arc::new(InMemoryHookRegistry::new());
    let policy_engine: Arc<dyn PolicyEngine> = Arc::new(InMemoryPolicyEngine::new());
    let audit_logger: Arc<dyn AuditLogger> = Arc::new(InMemoryAuditLogger::new());

    let hook_service = Arc::new(HookService::new(
        config,
        hook_registry.clone(),
        Arc::new(NoopEventBus),
        policy_engine.clone(),
        audit_logger.clone(),
    ));

    let event_bus: Arc<dyn EventBus> = Arc::new(InMemoryEventBus::new(
        hook_service,
        hook_registry.clone(),
        audit_logger.clone(),
    ));

    let app_state = Arc::new(AppState {
        hook_registry,
        event_bus,
        policy_engine,
        audit_logger,
    });

    let app = Router::new()
        .route("/hooks/register", post(handle_register_hook))
        .route("/hooks/trigger", post(handle_trigger_event))
        .route("/hooks/list", get(handle_list_hooks))
        .route("/health", get(handle_health_check))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3107".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Hooks Service listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

// In-memory implementations
struct InMemoryHookRegistry {
    hooks: RwLock<Vec<HookDefinition>>,
    triggered_count: AtomicU32,
    error_count: AtomicU32,
    total_execution_time_ms: AtomicU32,
}

impl InMemoryHookRegistry {
    fn new() -> Self {
        Self {
            hooks: RwLock::new(Vec::new()),
            triggered_count: AtomicU32::new(0),
            error_count: AtomicU32::new(0),
            total_execution_time_ms: AtomicU32::new(0),
        }
    }
}

#[async_trait::async_trait]
impl HookRegistry for InMemoryHookRegistry {
    async fn register_hook(&self, hook: HookDefinition) -> Result<(), Box<dyn std::error::Error>> {
        let mut hooks = self.hooks.write().await;
        if let Some(existing) = hooks.iter_mut().find(|h| h.id == hook.id) {
            *existing = hook;
        } else {
            hooks.push(hook);
        }
        Ok(())
    }

    async fn unregister_hook(
        &self,
        hook_id: &str,
        _user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut hooks = self.hooks.write().await;
        hooks.retain(|h| h.id != hook_id);
        Ok(())
    }

    async fn get_hooks_for_event(
        &self,
        event_type: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>> {
        let hooks = self.hooks.read().await;
        Ok(hooks
            .iter()
            .filter(|h| h.event_type == event_type && h.enabled)
            .cloned()
            .collect())
    }

    async fn get_user_hooks(
        &self,
        user_id: &str,
    ) -> Result<Vec<HookDefinition>, Box<dyn std::error::Error>> {
        let hooks = self.hooks.read().await;
        Ok(hooks
            .iter()
            .filter(|h| h.owner_id == user_id)
            .cloned()
            .collect())
    }

    async fn update_hook(
        &self,
        hook_id: &str,
        updates: HookUpdates,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut hooks = self.hooks.write().await;
        let hook = hooks
            .iter_mut()
            .find(|h| h.id == hook_id && h.owner_id == user_id)
            .ok_or("Hook not found")?;

        if let Some(name) = updates.name {
            hook.name = name;
        }
        if let Some(description) = updates.description {
            hook.description = description;
        }
        if let Some(condition) = updates.condition {
            hook.condition = condition;
        }
        if let Some(action) = updates.action {
            hook.action = action;
        }
        if let Some(enabled) = updates.enabled {
            hook.enabled = enabled;
        }
        hook.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Ok(())
    }

    async fn evaluate_condition(
        &self,
        condition: &str,
        context: &serde_json::Value,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let condition = condition.trim();
        if condition == "true" || condition.is_empty() {
            return Ok(true);
        }
        if condition == "false" {
            return Ok(false);
        }
        Ok(context.to_string().to_lowercase().contains(&condition.to_lowercase()))
    }

    async fn get_statistics(&self) -> Result<HookStatistics, Box<dyn std::error::Error>> {
        let hooks = self.hooks.read().await;
        let total_hooks = hooks.len();
        let active_hooks = hooks.iter().filter(|h| h.enabled).count();
        let triggered = self.triggered_count.load(Ordering::Relaxed);
        let errors = self.error_count.load(Ordering::Relaxed);
        let total_time = self.total_execution_time_ms.load(Ordering::Relaxed);
        let average_execution_time_ms = if triggered > 0 {
            total_time as f64 / triggered as f64
        } else {
            0.0
        };
        Ok(HookStatistics {
            total_hooks,
            active_hooks,
            triggered_hooks_today: triggered,
            execution_errors_today: errors,
            average_execution_time_ms,
        })
    }

    async fn record_execution(
        &self,
        results: &[HookResult],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let triggered = results.len() as u32;
        let errors = results.iter().filter(|r| !r.success).count() as u32;
        let total_time: u64 = results.iter().map(|r| r.execution_time_ms).sum();
        self.triggered_count.fetch_add(triggered, Ordering::Relaxed);
        self.error_count.fetch_add(errors, Ordering::Relaxed);
        self.total_execution_time_ms
            .fetch_add(total_time as u32, Ordering::Relaxed);
        Ok(())
    }
}

struct InMemoryEventBus {
    hook_service: Arc<HookService>,
    registry: Arc<dyn HookRegistry>,
    audit_logger: Arc<dyn AuditLogger>,
}

impl InMemoryEventBus {
    fn new(
        hook_service: Arc<HookService>,
        registry: Arc<dyn HookRegistry>,
        audit_logger: Arc<dyn AuditLogger>,
    ) -> Self {
        Self {
            hook_service,
            registry,
            audit_logger,
        }
    }
}

#[async_trait::async_trait]
impl EventBus for InMemoryEventBus {
    async fn publish(&self, event: Event) -> Result<(), Box<dyn std::error::Error>> {
        self.audit_logger
            .log(&format!(
                "EVENT_PUBLISHED: type={} source={}",
                event.event_type, event.source
            ))
            .await?;
        Ok(())
    }

    async fn subscribe(
        &self,
        _event_type: &str,
        _handler: Box<dyn EventHandler>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // In-memory bus does not support external subscriptions in this implementation.
        Ok(())
    }

    async fn trigger_hooks_for_event(
        &self,
        event: &Event,
    ) -> Result<Vec<HookResult>, Box<dyn std::error::Error>> {
        let results = self.hook_service.trigger_event(event.clone()).await?;
        self.registry.record_execution(&results).await?;
        Ok(results)
    }
}

struct InMemoryPolicyEngine;

impl InMemoryPolicyEngine {
    fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl PolicyEngine for InMemoryPolicyEngine {
    async fn check_permission(
        &self,
        _user_id: &str,
        _agent_id: &str,
        _action: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        Ok(true)
    }

    async fn requires_confirmation(
        &self,
        _user_id: &str,
        _agent_id: &str,
        action: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        Ok(action.contains("finance") || action.contains("payment"))
    }
}

struct InMemoryAuditLogger;

impl InMemoryAuditLogger {
    fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl AuditLogger for InMemoryAuditLogger {
    async fn log(&self, event: &str) -> Result<(), Box<dyn std::error::Error>> {
        tracing::info!("{}", event);
        Ok(())
    }
}

struct NoopEventBus;

#[async_trait::async_trait]
impl EventBus for NoopEventBus {
    async fn publish(&self, _event: Event) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }

    async fn subscribe(
        &self,
        _event_type: &str,
        _handler: Box<dyn EventHandler>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }

    async fn trigger_hooks_for_event(
        &self,
        _event: &Event,
    ) -> Result<Vec<HookResult>, Box<dyn std::error::Error>> {
        Ok(vec![])
    }
}

// We need to define the EventHandler trait that was referenced
trait EventHandler: Send + Sync {
    fn handle(&self, event: &Event) -> Result<(), Box<dyn std::error::Error>>;
}


