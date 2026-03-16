//! # A2R SDK Core
//!
//! Core types and traits for the A2R SDK.
//!
//! ## Overview
//!
//! This crate provides foundational types, error handling, and traits
//! used across all A2R SDK components. It defines the common interfaces
//! for applications, functions, policies, and transport layers.
//!
//! The SDK Core serves as the foundation of the A2R platform, providing
//! serialization-friendly types that can be used across FFI boundaries,
//! network transports, and language bindings.
//!
//! ## Key Concepts
//!
//! - **MessageEnvelope**: Universal message container for cross-service communication
//! - **FunctionCall/ExecuteRequest/ExecuteResponse**: Standardized function execution patterns
//! - **AgentConfig/AgentSpec**: Agent configuration and specification types
//! - **ToolGatewayDefinition**: Comprehensive tool definitions with safety tiers
//! - **WorkflowDefinition**: Workflow orchestration with phase-based execution
//! - **AppDefinition**: Application manifest for A2R-compatible apps
//! - **SafetyTier**: Security classification system (T0-T4)
//! - **CoreError**: Unified error type for SDK operations
//!
//! ## Example
//!
//! ```rust
//! use a2rchitech_sdk_core::{
//!     MessageEnvelope, FunctionCall, ExecuteRequest,
//!     ExecuteResponse, SafetyTier, ToolGatewayDefinition, ToolType
//! };
//!
//! // Create a message envelope for cross-service communication
//! let envelope = MessageEnvelope {
//!     id: "msg-001".to_string(),
//!     source: "agent-1".to_string(),
//!     destination: "service-1".to_string(),
//!     content: "Hello, world!".to_string(),
//!     transport: "http".to_string(),
//!     timestamp: 1704067200,
//!     metadata: serde_json::json!({"priority": "high"}),
//! };
//!
//! // Create a function call
//! let function_call = FunctionCall {
//!     function_id: "com.example.greet".to_string(),
//!     parameters: serde_json::json!({"name": "Alice"}),
//! };
//! ```

use serde::{Deserialize, Serialize};

/// Universal message envelope for cross-service communication.
///
/// The `MessageEnvelope` is the standard container for all messages
/// passing through the A2R system. It provides routing information,
/// transport metadata, and extensible payload storage.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::MessageEnvelope;
///
/// let envelope = MessageEnvelope {
///     id: "msg-123".to_string(),
///     source: "user-service".to_string(),
///     destination: "agent-service".to_string(),
///     content: "Process this request".to_string(),
///     transport: "http".to_string(),
///     timestamp: 1704067200,
///     metadata: serde_json::json!({}),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEnvelope {
    /// Unique message identifier
    pub id: String,
    /// Source entity (service, agent, or user ID)
    pub source: String,
    /// Destination entity (service, agent, or user ID)
    pub destination: String,
    /// Message content (typically serialized JSON)
    pub content: String,
    /// Transport protocol used (http, ws, sms, etc.)
    pub transport: String,
    /// Unix timestamp in seconds
    pub timestamp: u64,
    /// Additional metadata as JSON
    pub metadata: serde_json::Value,
}

/// Represents a function call with its parameters.
///
/// `FunctionCall` encapsulates the invocation of a function or tool
/// within the A2R system. It contains the function identifier and
/// the parameters as a JSON value.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::FunctionCall;
///
/// let call = FunctionCall {
///     function_id: "com.a2rchitech.os.set_reminder".to_string(),
///     parameters: serde_json::json!({
///         "title": "Team meeting",
///         "time": "14:00"
///     }),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    /// Unique function identifier (typically reverse-domain notation)
    pub function_id: String,
    /// Function parameters as JSON
    pub parameters: serde_json::Value,
}

/// Request to execute a function.
///
/// `ExecuteRequest` contains all context needed for function execution,
/// including the function call itself, user identity, agent context,
/// and session information.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{ExecuteRequest, FunctionCall};
///
/// let request = ExecuteRequest {
///     function_call: FunctionCall {
///         function_id: "com.example.calc".to_string(),
///         parameters: serde_json::json!({"a": 1, "b": 2}),
///     },
///     user_id: "user-123".to_string(),
///     agent_id: "agent-456".to_string(),
///     session_id: "session-789".to_string(),
///     context: serde_json::json!({"tenant": "acme"}),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteRequest {
    /// The function call to execute
    pub function_call: FunctionCall,
    /// ID of the user making the request
    pub user_id: String,
    /// ID of the agent handling the request
    pub agent_id: String,
    /// Session identifier for tracking
    pub session_id: String,
    /// Additional execution context as JSON
    pub context: serde_json::Value,
}

/// Response from function execution.
///
/// `ExecuteResponse` contains the result of a function execution,
/// including success status, result data, error information, and
/// optional UI card for rendering.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::ExecuteResponse;
///
/// let response = ExecuteResponse {
///     success: true,
///     result: Some(serde_json::json!({"sum": 42})),
///     error: None,
///     execution_time_ms: 150,
///     ui_card: None,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteResponse {
    /// Whether the execution was successful
    pub success: bool,
    /// Result data if successful
    pub result: Option<serde_json::Value>,
    /// Error message if unsuccessful
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// Optional UI card for rendering the result
    pub ui_card: Option<UICard>,
}

/// UI card for displaying rich content.
///
/// `UICard` represents a structured UI component that can be rendered
/// across different platforms (web, mobile, desktop). It supports
/// various card types and includes action handlers for interactivity.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{UICard, CardAction, ActionHandler};
///
/// let card = UICard {
///     card_type: "info".to_string(),
///     title: "Weather Update".to_string(),
///     subtitle: Some("San Francisco".to_string()),
///     content: serde_json::json!({"temperature": 72, "condition": "Sunny"}),
///     actions: Some(vec![CardAction {
///         id: "refresh".to_string(),
///         label: "Refresh".to_string(),
///         action_type: "primary".to_string(),
///         handler: ActionHandler {
///             handler_type: "tool_call".to_string(),
///             target: "weather.refresh".to_string(),
///             parameters: Some(serde_json::json!({"city": "SF"})),
///         },
///     }]),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UICard {
    /// Card type (e.g., "info", "warning", "error", "success")
    pub card_type: String,
    /// Primary title of the card
    pub title: String,
    /// Optional subtitle
    pub subtitle: Option<String>,
    /// Card content as JSON
    pub content: serde_json::Value,
    /// Optional list of actions
    pub actions: Option<Vec<CardAction>>,
}

/// Action that can be triggered from a UI card.
///
/// `CardAction` defines an interactive element within a `UICard`,
/// including its visual style and the handler to execute when triggered.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{CardAction, ActionHandler};
///
/// let action = CardAction {
///     id: "submit".to_string(),
///     label: "Submit".to_string(),
///     action_type: "primary".to_string(),
///     handler: ActionHandler {
///         handler_type: "tool_call".to_string(),
///         target: "form.submit".to_string(),
///         parameters: None,
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardAction {
    /// Unique action identifier
    pub id: String,
    /// Display label for the action
    pub label: String,
    /// Visual style ("primary", "secondary", "destructive")
    pub action_type: String,
    /// Handler to execute when action is triggered
    pub handler: ActionHandler,
}

/// Handler for card actions.
///
/// `ActionHandler` specifies what happens when a card action is triggered.
/// It supports multiple handler types for different interaction patterns.
///
/// # Handler Types
///
/// - `tool_call`: Execute a tool/function
/// - `deep_link`: Navigate to a deep link
/// - `web_view`: Open a web view
/// - `app_intent`: Trigger an app-specific intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionHandler {
    /// Handler type ("tool_call", "deep_link", "web_view", "app_intent")
    pub handler_type: String,
    /// Target identifier (tool ID, URL, etc.)
    pub target: String,
    /// Optional parameters for the handler
    pub parameters: Option<serde_json::Value>,
}

/// Configuration for an AI agent.
///
/// `AgentConfig` defines the behavior and capabilities of an agent
/// within the A2R system, including its permissions and confirmation
/// thresholds.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{AgentConfig, AgentPermissions};
///
/// let config = AgentConfig {
///     id: "assistant-001".to_string(),
///     name: "Personal Assistant".to_string(),
///     description: "A helpful AI assistant".to_string(),
///     personality: "friendly and professional".to_string(),
///     default: true,
///     capabilities: vec!["conversation".to_string(), "scheduling".to_string()],
///     permissions: AgentPermissions {
///         allowed_functions: vec!["com.a2rchitech.os.*".to_string()],
///         denied_functions: vec!["com.a2rchitech.os.delete_*".to_string()],
///         confirmation_threshold: "medium".to_string(),
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Unique agent identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Personality description for the LLM
    pub personality: String,
    /// Whether this is the default agent
    pub default: bool,
    /// List of capability identifiers
    pub capabilities: Vec<String>,
    /// Permission settings
    pub permissions: AgentPermissions,
}

/// Permissions for an agent.
///
/// `AgentPermissions` controls what functions an agent can execute
/// and when user confirmation is required.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissions {
    /// List of allowed function patterns (wildcards supported)
    pub allowed_functions: Vec<String>,
    /// List of denied function patterns (overrides allowed)
    pub denied_functions: Vec<String>,
    /// Confirmation threshold ("low", "medium", "high", "critical")
    pub confirmation_threshold: String,
}

/// Specification for an agent package.
///
/// `AgentSpec` contains the full specification for a deployable agent,
/// including its tools, policies, and cryptographic signatures.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{AgentSpec, AgentPublisher, AgentSignature};
///
/// let spec = AgentSpec {
///     id: "com.example.agent".to_string(),
///     role: "assistant".to_string(),
///     description: "Example agent".to_string(),
///     tools: vec!["tool-1".to_string()],
///     policies: vec!["policy-1".to_string()],
///     publisher: AgentPublisher {
///         publisher_id: "pub-123".to_string(),
///         public_key_id: "key-456".to_string(),
///     },
///     signature: AgentSignature {
///         manifest_sig: "sig...".to_string(),
///         bundle_hash: "hash...".to_string(),
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpec {
    /// Unique agent identifier
    pub id: String,
    /// Agent role/type
    pub role: String,
    /// Human-readable description
    pub description: String,
    /// List of tool IDs the agent can use
    pub tools: Vec<String>,
    /// List of policy IDs the agent follows
    pub policies: Vec<String>,
    /// Publisher information
    pub publisher: AgentPublisher,
    /// Cryptographic signature
    pub signature: AgentSignature,
}

/// Information about the agent publisher.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPublisher {
    /// Unique publisher identifier
    pub publisher_id: String,
    /// Public key identifier for verification
    pub public_key_id: String,
}

/// Cryptographic signature for an agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSignature {
    /// Signature of the manifest
    pub manifest_sig: String,
    /// Hash of the agent bundle
    pub bundle_hash: String,
}

/// Safety tier classification for security levels.
///
/// The A2R platform uses a tiered safety system (T0-T4) where:
/// - T0: No risk (informational only)
/// - T1: Low risk (read-only operations)
/// - T2: Medium risk (non-destructive writes)
/// - T3: High risk (destructive operations)
/// - T4: Critical risk (irreversible, sensitive data)
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::SafetyTier;
///
/// let tier = SafetyTier::T2; // Medium risk
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SafetyTier {
    /// T0: No risk, informational only
    T0,
    /// T1: Low risk, read-only operations
    T1,
    /// T2: Medium risk, non-destructive writes
    T2,
    /// T3: High risk, destructive operations
    T3,
    /// T4: Critical risk, irreversible operations
    T4,
}

/// Type of tool execution environment.
///
/// `ToolType` specifies how a tool is implemented and executed:
/// - `Local`: Runs locally on the device
/// - `Http`: Remote HTTP API call
/// - `Mpc`: Multi-party computation
/// - `Sdk`: SDK-provided native implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolType {
    /// Local execution on device
    Local,
    /// Remote HTTP API
    Http,
    /// Multi-party computation
    Mpc,
    /// SDK native implementation
    Sdk,
}

/// Network access permissions for a tool.
///
/// `NetworkAccess` controls network access for tool execution,
/// supporting restrictions by domain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NetworkAccess {
    /// No network access
    None,
    /// Access only to allowed domains
    DomainAllowlist(Vec<String>),
    /// Unrestricted access
    Unrestricted,
}

/// Filesystem access permissions for a tool.
///
/// `FilesystemAccess` controls file system access for tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilesystemAccess {
    /// No filesystem access
    None,
    /// Read access to allowed paths
    Allowlist(Vec<String>),
    /// Read/write access to allowed paths
    ReadWrite(Vec<String>),
}

/// Resource limits for tool execution.
///
/// `ToolResourceLimits` defines the computational resources available
/// to a tool during execution.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{ToolResourceLimits, NetworkAccess, FilesystemAccess};
///
/// let limits = ToolResourceLimits {
///     cpu: Some("1 core".to_string()),
///     memory: Some("512MB".to_string()),
///     network: NetworkAccess::DomainAllowlist(vec!["api.example.com".to_string()]),
///     filesystem: FilesystemAccess::None,
///     time_limit: 30000, // 30 seconds
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResourceLimits {
    /// CPU allocation (e.g., "1 core", "500m")
    pub cpu: Option<String>,
    /// Memory allocation (e.g., "512MB", "1GB")
    pub memory: Option<String>,
    /// Network access permissions
    pub network: NetworkAccess,
    /// Filesystem access permissions
    pub filesystem: FilesystemAccess,
    /// Maximum execution time in milliseconds
    pub time_limit: u64,
}

/// Complete definition of a tool gateway.
///
/// `ToolGatewayDefinition` is the comprehensive specification for a tool
/// that can be registered and executed within the A2R system. It includes
/// all metadata, schemas, safety information, and resource requirements.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{
///     ToolGatewayDefinition, ToolType, SafetyTier,
///     ToolResourceLimits, NetworkAccess, FilesystemAccess
/// };
///
/// let tool = ToolGatewayDefinition {
///     id: "com.example.weather.get".to_string(),
///     name: "Get Weather".to_string(),
///     description: "Get current weather for a location".to_string(),
///     tool_type: ToolType::Http,
///     command: "GET".to_string(),
///     endpoint: "https://api.weather.com/v1/current".to_string(),
///     input_schema: serde_json::json!({
///         "type": "object",
///         "properties": {"city": {"type": "string"}}
///     }),
///     output_schema: serde_json::json!({
///         "type": "object",
///         "properties": {"temperature": {"type": "number"}}
///     }),
///     side_effects: vec!["network_call".to_string()],
///     idempotency_behavior: "cacheable".to_string(),
///     retryable: true,
///     failure_classification: "recoverable".to_string(),
///     safety_tier: SafetyTier::T1,
///     resource_limits: ToolResourceLimits {
///         cpu: None,
///         memory: Some("64MB".to_string()),
///         network: NetworkAccess::Unrestricted,
///         filesystem: FilesystemAccess::None,
///         time_limit: 5000,
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolGatewayDefinition {
    /// Unique tool identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Tool implementation type
    pub tool_type: ToolType,
    /// Command or HTTP method
    pub command: String,
    /// Endpoint URL or command path
    pub endpoint: String,
    /// JSON Schema for input validation
    pub input_schema: serde_json::Value,
    /// JSON Schema for output validation
    pub output_schema: serde_json::Value,
    /// List of side effect categories
    pub side_effects: Vec<String>,
    /// Idempotency behavior description
    pub idempotency_behavior: String,
    /// Whether the tool can be retried on failure
    pub retryable: bool,
    /// Failure classification
    pub failure_classification: String,
    /// Safety tier for this tool
    pub safety_tier: SafetyTier,
    /// Resource limits for execution
    pub resource_limits: ToolResourceLimits,
}

/// Payload for tool execution.
///
/// `ToolExecutePayload` contains the input data and execution context
/// for invoking a tool through the gateway.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::ToolExecutePayload;
///
/// let payload = ToolExecutePayload {
///     input: serde_json::json!({"city": "San Francisco"}),
///     identity_id: Some("user-123".to_string()),
///     session_id: Some("session-456".to_string()),
///     tenant_id: Some("tenant-789".to_string()),
///     trace_id: Some("trace-abc".to_string()),
///     idempotency_key: Some("idem-xyz".to_string()),
///     retry_count: Some(0),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutePayload {
    /// Input parameters for the tool
    pub input: serde_json::Value,
    /// Identity of the user/entity making the request
    pub identity_id: Option<String>,
    /// Session identifier for tracking
    pub session_id: Option<String>,
    /// Tenant identifier for multi-tenancy
    pub tenant_id: Option<String>,
    /// Trace identifier for distributed tracing
    pub trace_id: Option<String>,
    /// Key for idempotent execution
    pub idempotency_key: Option<String>,
    /// Current retry attempt count
    pub retry_count: Option<u32>,
}

/// Result of a tool execution.
///
/// `ToolExecutionResult` contains the complete output of a tool execution,
/// including stdout, stderr, exit code, and resource usage metrics.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{ToolExecutionResult, ResourceUsage};
///
/// let result = ToolExecutionResult {
///     execution_id: "exec-123".to_string(),
///     tool_id: "com.example.tool".to_string(),
///     input: serde_json::json!({}),
///     output: Some(serde_json::json!({"status": "ok"})),
///     error: None,
///     stdout: "Success".to_string(),
///     stderr: "".to_string(),
///     exit_code: Some(0),
///     execution_time_ms: 250,
///     resources_used: ResourceUsage {
///         cpu_time_ms: 100,
///         memory_peak_kb: 10240,
///         network_bytes: 512,
///         filesystem_ops: 0,
///     },
///     timestamp: 1704067200,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    /// Unique execution identifier
    pub execution_id: String,
    /// Tool that was executed
    pub tool_id: String,
    /// Input that was provided
    pub input: serde_json::Value,
    /// Output data if successful
    pub output: Option<serde_json::Value>,
    /// Error message if failed
    pub error: Option<String>,
    /// Standard output from the tool
    pub stdout: String,
    /// Standard error from the tool
    pub stderr: String,
    /// Exit code (if applicable)
    pub exit_code: Option<i32>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// Resource usage metrics
    pub resources_used: ResourceUsage,
    /// Unix timestamp of execution
    pub timestamp: u64,
}

/// Resource usage metrics for a tool execution.
///
/// `ResourceUsage` tracks computational resources consumed during
/// tool execution for monitoring and billing purposes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// CPU time consumed in milliseconds
    pub cpu_time_ms: u64,
    /// Peak memory usage in kilobytes
    pub memory_peak_kb: u64,
    /// Network bytes transferred
    pub network_bytes: u64,
    /// Filesystem operations performed
    pub filesystem_ops: u32,
}

/// Public key for a publisher.
///
/// `PublisherKey` represents a cryptographic key used to verify
/// the identity of a tool or app publisher.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::PublisherKey;
///
/// let key = PublisherKey {
///     publisher_id: "pub-123".to_string(),
///     public_key_id: "key-456".to_string(),
///     public_key: "-----BEGIN PUBLIC KEY-----...".to_string(),
///     created_at: 1704067200,
///     revoked: false,
///     revoked_at: None,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherKey {
    /// Publisher identifier
    pub publisher_id: String,
    /// Unique key identifier
    pub public_key_id: String,
    /// The public key content (PEM format)
    pub public_key: String,
    /// Unix timestamp of creation
    pub created_at: u64,
    /// Whether the key has been revoked
    pub revoked: bool,
    /// Unix timestamp of revocation (if revoked)
    pub revoked_at: Option<u64>,
}

/// Request to register a new publisher key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherKeyRegistrationRequest {
    /// Publisher identifier
    pub publisher_id: String,
    /// Unique key identifier
    pub public_key_id: String,
    /// The public key content (PEM format)
    pub public_key: String,
}

/// Request to revoke a publisher key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherKeyRevokeRequest {
    /// Key identifier to revoke
    pub public_key_id: String,
}

/// Phase in a workflow execution.
///
/// `WorkflowPhase` represents the standard phases of the A2R
/// agent workflow lifecycle.
///
/// # Phases
///
/// 1. **Observe**: Gather information and context
/// 2. **Think**: Analyze and reason about the situation
/// 3. **Plan**: Create an action plan
/// 4. **Build**: Construct artifacts or code
/// 5. **Execute**: Run actions and tools
/// 6. **Verify**: Validate results
/// 7. **Learn**: Update knowledge from experience
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowPhase {
    /// Gather information and context
    Observe,
    /// Analyze and reason
    Think,
    /// Create action plan
    Plan,
    /// Construct artifacts
    Build,
    /// Run actions
    Execute,
    /// Validate results
    Verify,
    /// Update knowledge
    Learn,
}

/// Node in a workflow graph.
///
/// `WorkflowNode` represents a single step in a workflow definition,
/// specifying the skill to execute and its constraints.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{WorkflowNode, WorkflowPhase, NodeConstraints};
///
/// let node = WorkflowNode {
///     id: "node-1".to_string(),
///     name: "Data Processing".to_string(),
///     phase: WorkflowPhase::Execute,
///     skill_id: "com.example.process".to_string(),
///     inputs: vec!["input-1".to_string()],
///     outputs: vec!["output-1".to_string()],
///     constraints: NodeConstraints {
///         time_budget: Some(30000),
///         resource_limits: None,
///         allowed_tools: vec![],
///         required_permissions: vec!["execute".to_string()],
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    /// Unique node identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Workflow phase for this node
    pub phase: WorkflowPhase,
    /// Skill ID to execute
    pub skill_id: String,
    /// Input variable names
    pub inputs: Vec<String>,
    /// Output variable names
    pub outputs: Vec<String>,
    /// Execution constraints
    pub constraints: NodeConstraints,
}

/// Constraints for a workflow node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConstraints {
    /// Maximum execution time in milliseconds
    pub time_budget: Option<u64>,
    /// Resource limits for execution
    pub resource_limits: Option<ToolResourceLimits>,
    /// List of allowed tool IDs
    pub allowed_tools: Vec<String>,
    /// Required permission identifiers
    pub required_permissions: Vec<String>,
}

/// Edge in a workflow graph connecting two nodes.
///
/// `WorkflowEdge` defines the flow between workflow nodes,
/// with optional conditional logic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEdge {
    /// Source node ID
    pub from: String,
    /// Destination node ID
    pub to: String,
    /// Optional condition expression
    pub condition: Option<String>,
}

/// Complete workflow definition.
///
/// `WorkflowDefinition` is the full specification of a workflow,
/// including all nodes, edges, and execution requirements.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{
///     WorkflowDefinition, WorkflowNode, WorkflowEdge,
///     WorkflowPhase, NodeConstraints, SafetyTier
/// };
///
/// let workflow = WorkflowDefinition {
///     workflow_id: "wf-001".to_string(),
///     version: "1.0.0".to_string(),
///     description: "Example workflow".to_string(),
///     required_roles: vec!["executor".to_string()],
///     allowed_skill_tiers: vec![SafetyTier::T0, SafetyTier::T1],
///     phases_used: vec![WorkflowPhase::Observe, WorkflowPhase::Execute],
///     success_criteria: "All nodes completed".to_string(),
///     failure_modes: vec!["timeout".to_string()],
///     nodes: vec![],
///     edges: vec![],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    /// Unique workflow identifier
    pub workflow_id: String,
    /// Version string (semver)
    pub version: String,
    /// Human-readable description
    pub description: String,
    /// Required role identifiers
    pub required_roles: Vec<String>,
    /// Allowed safety tiers for skills
    pub allowed_skill_tiers: Vec<SafetyTier>,
    /// Phases used in this workflow
    pub phases_used: Vec<WorkflowPhase>,
    /// Success criteria description
    pub success_criteria: String,
    /// Possible failure modes
    pub failure_modes: Vec<String>,
    /// Workflow nodes
    pub nodes: Vec<WorkflowNode>,
    /// Workflow edges
    pub edges: Vec<WorkflowEdge>,
}

/// Status of a workflow execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStatus {
    /// Waiting to start
    Pending,
    /// Currently executing
    Running,
    /// Completed successfully
    Completed,
    /// Failed with an error
    Failed,
    /// Stopped manually
    Stopped,
}

/// Status of an individual node execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeStatus {
    /// Waiting to start
    Pending,
    /// Currently executing
    Running,
    /// Completed successfully
    Completed,
    /// Failed with an error
    Failed,
    /// Skipped due to condition
    Skipped,
}

/// Result of a node execution.
///
/// `NodeResult` captures the output and status of a single
/// workflow node execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    /// Node identifier
    pub node_id: String,
    /// Execution status
    pub status: NodeStatus,
    /// Output data
    pub output: Option<serde_json::Value>,
    /// Error details if failed
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// List of artifact IDs produced
    pub artifacts_produced: Vec<String>,
    /// Unix timestamp
    pub timestamp: u64,
}

/// Active or completed workflow execution.
///
/// `WorkflowExecution` tracks the state of a running or completed
/// workflow instance.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{WorkflowExecution, WorkflowStatus};
/// use std::collections::HashMap;
///
/// let execution = WorkflowExecution {
///     execution_id: "exec-001".to_string(),
///     workflow_id: "wf-001".to_string(),
///     session_id: "session-123".to_string(),
///     tenant_id: "tenant-456".to_string(),
///     start_time: 1704067200,
///     end_time: None,
///     status: WorkflowStatus::Running,
///     current_phase: None,
///     node_results: HashMap::new(),
///     artifacts: vec![],
///     trace_id: Some("trace-abc".to_string()),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    /// Unique execution identifier
    pub execution_id: String,
    /// Workflow definition ID
    pub workflow_id: String,
    /// Session identifier
    pub session_id: String,
    /// Tenant identifier
    pub tenant_id: String,
    /// Start time (Unix timestamp)
    pub start_time: u64,
    /// End time (Unix timestamp, None if running)
    pub end_time: Option<u64>,
    /// Current execution status
    pub status: WorkflowStatus,
    /// Currently executing phase
    pub current_phase: Option<WorkflowPhase>,
    /// Results for each node
    pub node_results: std::collections::HashMap<String, NodeResult>,
    /// List of artifact IDs produced
    pub artifacts: Vec<String>,
    /// Trace identifier
    pub trace_id: Option<String>,
}

/// Metadata for an artifact in the registry.
///
/// `ArtifactMetadata` describes a published artifact including
/// its trust score and usage statistics.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::ArtifactMetadata;
///
/// let artifact = ArtifactMetadata {
///     artifact_id: "art-001".to_string(),
///     name: "My Tool".to_string(),
///     version: "1.0.0".to_string(),
///     artifact_type: "tool".to_string(),
///     description: "A useful tool".to_string(),
///     author: "John Doe".to_string(),
///     license: "MIT".to_string(),
///     tags: vec!["utility".to_string()],
///     created_at: 1704067200,
///     updated_at: 1704067200,
///     published_at: None,
///     deprecated_at: None,
///     download_count: 0,
///     trust_score: 0.95,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactMetadata {
    /// Unique artifact identifier
    pub artifact_id: String,
    /// Display name
    pub name: String,
    /// Version string (semver)
    pub version: String,
    /// Type of artifact (tool, agent, workflow, etc.)
    pub artifact_type: String,
    /// Human-readable description
    pub description: String,
    /// Author name
    pub author: String,
    /// License identifier
    pub license: String,
    /// List of tags
    pub tags: Vec<String>,
    /// Creation timestamp
    pub created_at: u64,
    /// Last update timestamp
    pub updated_at: u64,
    /// Publication timestamp (None if unpublished)
    pub published_at: Option<u64>,
    /// Deprecation timestamp (None if active)
    pub deprecated_at: Option<u64>,
    /// Number of downloads
    pub download_count: u64,
    /// Trust score (0.0 to 1.0)
    pub trust_score: f64,
}

/// Response to an artifact query.
///
/// `ArtifactQueryResponse` contains the results of searching
/// the artifact registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactQueryResponse {
    /// Query identifier
    pub query_id: String,
    /// Matching artifacts
    pub artifacts: Vec<ArtifactMetadata>,
    /// Total number of matches
    pub total_count: u64,
    /// Number returned in this response
    pub returned_count: u64,
    /// Response timestamp
    pub timestamp: u64,
    /// Trace identifier
    pub trace_id: Option<String>,
}

/// Index of all templates available.
///
/// `TemplateIndex` provides a catalog of all agent, workflow,
/// and pipeline templates available in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateIndex {
    /// Available agent templates
    pub agents: Vec<AgentSpec>,
    /// Available workflow templates
    pub workflows: Vec<WorkflowDefinition>,
    /// Available pipeline templates
    pub pipelines: Vec<serde_json::Value>,
}

/// Configuration for an AI model.
///
/// `ModelConfig` defines the settings for an AI model including
/// its capabilities and provider-specific configuration.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{ModelConfig, ModelSpecificConfig};
///
/// let model = ModelConfig {
///     id: "gpt-4".to_string(),
///     name: "GPT-4".to_string(),
///     description: "Large language model".to_string(),
///     model_type: "reasoning".to_string(),
///     provider: "openai".to_string(),
///     capabilities: vec!["chat".to_string(), "code".to_string()],
///     default: true,
///     config: ModelSpecificConfig {
///         temperature: Some(0.7),
///         max_tokens: Some(4096),
///         top_p: Some(1.0),
///         frequency_penalty: Some(0.0),
///         presence_penalty: Some(0.0),
///         local_model_path: None,
///         api_key: None,
///         endpoint: Some("https://api.openai.com".to_string()),
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Unique model identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Model type (reasoning, function, embedding, etc.)
    pub model_type: String,
    /// Provider identifier (openai, anthropic, local, etc.)
    pub provider: String,
    /// List of capability identifiers
    pub capabilities: Vec<String>,
    /// Whether this is the default model
    pub default: bool,
    /// Provider-specific configuration
    pub config: ModelSpecificConfig,
}

/// Provider-specific model configuration.
///
/// `ModelSpecificConfig` contains the parameters and settings
/// that vary by model provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSpecificConfig {
    /// Sampling temperature
    pub temperature: Option<f32>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Nucleus sampling parameter
    pub top_p: Option<f32>,
    /// Frequency penalty
    pub frequency_penalty: Option<f32>,
    /// Presence penalty
    pub presence_penalty: Option<f32>,
    /// Path to local model file
    pub local_model_path: Option<String>,
    /// API key for remote providers
    pub api_key: Option<String>,
    /// API endpoint URL
    pub endpoint: Option<String>,
}

/// Definition of an A2R-compatible application.
///
/// `AppDefinition` describes an application that can be registered
/// and used within the A2R ecosystem, including its authentication,
/// capabilities, and tools.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{AppDefinition, OAuthConfig, ToolDefinition, UICardTemplate};
///
/// let app = AppDefinition {
///     id: "com.example.myapp".to_string(),
///     name: "My App".to_string(),
///     description: "An example application".to_string(),
///     version: "1.0.0".to_string(),
///     developer: "Example Inc".to_string(),
///     website: "https://example.com".to_string(),
///     icon_url: "https://example.com/icon.png".to_string(),
///     categories: vec!["productivity".to_string()],
///     auth_type: "oauth2".to_string(),
///     oauth_config: Some(OAuthConfig {
///         authorization_url: "https://example.com/auth".to_string(),
///         token_url: "https://example.com/token".to_string(),
///         client_id: "client123".to_string(),
///         scopes: vec!["read".to_string(), "write".to_string()],
///     }),
///     capabilities: vec!["scheduling".to_string()],
///     supported_platforms: vec!["ios".to_string(), "android".to_string()],
///     privacy_policy_url: Some("https://example.com/privacy".to_string()),
///     terms_of_service_url: Some("https://example.com/tos".to_string()),
///     tools: vec![],
///     ui_cards: vec![],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppDefinition {
    /// Unique app identifier (reverse-domain notation)
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Version string (semver)
    pub version: String,
    /// Developer name
    pub developer: String,
    /// Website URL
    pub website: String,
    /// Icon URL
    pub icon_url: String,
    /// List of category tags
    pub categories: Vec<String>,
    /// Authentication type (oauth2, api_key, none)
    pub auth_type: String,
    /// OAuth configuration (if applicable)
    pub oauth_config: Option<OAuthConfig>,
    /// List of capability identifiers
    pub capabilities: Vec<String>,
    /// Supported platforms (ios, android, web, desktop)
    pub supported_platforms: Vec<String>,
    /// Privacy policy URL
    pub privacy_policy_url: Option<String>,
    /// Terms of service URL
    pub terms_of_service_url: Option<String>,
    /// Tools provided by this app
    pub tools: Vec<ToolDefinition>,
    /// UI card templates
    pub ui_cards: Vec<UICardTemplate>,
}

/// OAuth 2.0 configuration for an app.
///
/// `OAuthConfig` contains the settings needed to authenticate
/// with an OAuth 2.0 provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    /// Authorization endpoint URL
    pub authorization_url: String,
    /// Token endpoint URL
    pub token_url: String,
    /// OAuth client ID
    pub client_id: String,
    /// Requested scopes
    pub scopes: Vec<String>,
}

/// Definition of a tool provided by an app.
///
/// `ToolDefinition` describes a single tool/function that an app
/// makes available to the A2R system.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{ToolDefinition, RateLimitConfig};
///
/// let tool = ToolDefinition {
///     id: "com.example.create_task".to_string(),
///     name: "Create Task".to_string(),
///     description: "Create a new task".to_string(),
///     category: "productivity".to_string(),
///     parameters: serde_json::json!({
///         "type": "object",
///         "properties": {
///             "title": {"type": "string"}
///         }
///     }),
///     returns: serde_json::json!({
///         "type": "object",
///         "properties": {
///             "task_id": {"type": "string"}
///         }
///     }),
///     risk_level: "low".to_string(),
///     requires_confirmation: false,
///     execution_time_estimate_ms: 1000,
///     rate_limits: Some(RateLimitConfig {
///         max_calls: 100,
///         time_window_ms: 60000,
///     }),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Unique tool identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable description
    pub description: String,
    /// Category tag
    pub category: String,
    /// JSON Schema for parameters
    pub parameters: serde_json::Value,
    /// JSON Schema for return value
    pub returns: serde_json::Value,
    /// Risk level (low, medium, high, critical)
    pub risk_level: String,
    /// Whether user confirmation is required
    pub requires_confirmation: bool,
    /// Estimated execution time in milliseconds
    pub execution_time_estimate_ms: u64,
    /// Rate limiting configuration
    pub rate_limits: Option<RateLimitConfig>,
}

/// Rate limiting configuration.
///
/// `RateLimitConfig` defines the maximum number of calls allowed
/// within a time window.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Maximum number of calls
    pub max_calls: u32,
    /// Time window in milliseconds
    pub time_window_ms: u64,
}

/// Template for a UI card.
///
/// `UICardTemplate` provides a reusable template for rendering
/// cards with dynamic content.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{UICardTemplate, CardActionTemplate, ActionHandlerTemplate};
///
/// let template = UICardTemplate {
///     card_type: "info".to_string(),
///     title_template: "Welcome, {{name}}!".to_string(),
///     content_template: serde_json::json!({
///         "message": "Hello from {{app_name}}"
///     }),
///     actions: vec![CardActionTemplate {
///         id: "action-1".to_string(),
///         label: "Continue".to_string(),
///         action_type: "primary".to_string(),
///         handler: ActionHandlerTemplate {
///             handler_type: "deep_link".to_string(),
///             target: "/next".to_string(),
///             parameters: None,
///         },
///     }],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UICardTemplate {
    /// Card type (basic, list, grid, form, action)
    pub card_type: String,
    /// Title template string (may use template syntax)
    pub title_template: String,
    /// Content template as JSON
    pub content_template: serde_json::Value,
    /// Available actions
    pub actions: Vec<CardActionTemplate>,
}

/// Template for a card action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardActionTemplate {
    /// Action identifier
    pub id: String,
    /// Display label
    pub label: String,
    /// Action type (primary, secondary, destructive)
    pub action_type: String,
    /// Handler configuration
    pub handler: ActionHandlerTemplate,
}

/// Template for an action handler.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionHandlerTemplate {
    /// Handler type (tool_call, deep_link, web_view, app_intent)
    pub handler_type: String,
    /// Target identifier
    pub target: String,
    /// Template parameters
    pub parameters: Option<serde_json::Value>,
}

/// Request to check permissions.
///
/// `PermissionCheckRequest` is used to verify if a user/agent
/// is authorized to execute a function.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::{PermissionCheckRequest, FunctionCall};
///
/// let request = PermissionCheckRequest {
///     user_id: "user-123".to_string(),
///     agent_id: "agent-456".to_string(),
///     function_call: FunctionCall {
///         function_id: "com.example.delete".to_string(),
///         parameters: serde_json::json!({}),
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheckRequest {
    /// User identifier
    pub user_id: String,
    /// Agent identifier
    pub agent_id: String,
    /// Function call to check
    pub function_call: FunctionCall,
}

/// Response from a permission check.
///
/// `PermissionCheckResponse` indicates whether an operation is allowed
/// and whether confirmation is required.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::PermissionCheckResponse;
///
/// let response = PermissionCheckResponse {
///     allowed: true,
///     requires_confirmation: true,
///     reason: Some("Destructive operation".to_string()),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheckResponse {
    /// Whether the operation is allowed
    pub allowed: bool,
    /// Whether user confirmation is required
    pub requires_confirmation: bool,
    /// Reason for denial or confirmation requirement
    pub reason: Option<String>,
}

/// Audit event record.
///
/// `AuditEvent` captures security-relevant events for compliance
/// and monitoring purposes.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::AuditEvent;
///
/// let event = AuditEvent {
///     id: "evt-001".to_string(),
///     timestamp: 1704067200,
///     event_type: "function_call".to_string(),
///     user_id: Some("user-123".to_string()),
///     agent_id: Some("agent-456".to_string()),
///     session_id: Some("session-789".to_string()),
///     action: "com.example.tool.execute".to_string(),
///     details: serde_json::json!({"status": "success"}),
///     source: "gateway".to_string(),
///     metadata: serde_json::json!({}),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unique event identifier
    pub id: String,
    /// Event timestamp (Unix)
    pub timestamp: u64,
    /// Event type/category
    pub event_type: String,
    /// User identifier (if applicable)
    pub user_id: Option<String>,
    /// Agent identifier (if applicable)
    pub agent_id: Option<String>,
    /// Session identifier (if applicable)
    pub session_id: Option<String>,
    /// Action that was performed
    pub action: String,
    /// Event details as JSON
    pub details: serde_json::Value,
    /// Source service/component
    pub source: String,
    /// Additional metadata
    pub metadata: serde_json::Value,
}

/// Request to route a message to an agent.
///
/// `AgentRouteRequest` is used by the agent router to determine
/// which agent should handle a user message.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::AgentRouteRequest;
///
/// let request = AgentRouteRequest {
///     message: "Schedule a meeting tomorrow".to_string(),
///     user_id: "user-123".to_string(),
///     context: serde_json::json!({"timezone": "PST"}),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRouteRequest {
    /// The user message to route
    pub message: String,
    /// User identifier
    pub user_id: String,
    /// Additional context
    pub context: serde_json::Value,
}

/// Response from agent routing.
///
/// `AgentRouteResponse` indicates which agent should handle
/// the user's message.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::AgentRouteResponse;
///
/// let response = AgentRouteResponse {
///     agent_id: "scheduler-agent".to_string(),
///     agent_name: "Scheduler".to_string(),
///     confidence: 0.95,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRouteResponse {
    /// Selected agent identifier
    pub agent_id: String,
    /// Agent display name
    pub agent_name: String,
    /// Routing confidence score (0.0 to 1.0)
    pub confidence: f64,
}

/// Request to select an appropriate model.
///
/// `ModelSelectionRequest` is used by the model router to choose
/// the best model for a given task.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::ModelSelectionRequest;
///
/// let request = ModelSelectionRequest {
///     agent_id: "agent-123".to_string(),
///     message: "Write a Python function".to_string(),
///     context: serde_json::json!({"language": "python"}),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSelectionRequest {
    /// Agent making the request
    pub agent_id: String,
    /// The task/message to process
    pub message: String,
    /// Additional context
    pub context: serde_json::Value,
}

/// Response from model selection.
///
/// `ModelSelectionResponse` indicates which model should be used.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::ModelSelectionResponse;
///
/// let response = ModelSelectionResponse {
///     model_id: "gpt-4".to_string(),
///     confidence: 0.92,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSelectionResponse {
    /// Selected model identifier
    pub model_id: String,
    /// Selection confidence score (0.0 to 1.0)
    pub confidence: f64,
}

/// Errors that can occur in SDK operations.
///
/// `CoreError` is the unified error type for all SDK operations,
/// providing structured error information that can be serialized
/// and transmitted across service boundaries.
///
/// # Error Variants
///
/// - `Serialization`: JSON serialization/deserialization error
/// - `Validation`: Input validation error
/// - `Transport`: Network/transport error
/// - `Execution`: Function execution error
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_core::CoreError;
///
/// // Creating a validation error
/// let err = CoreError::Validation("Invalid input".to_string());
/// ```
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    /// Serialization error from serde_json
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Validation error for invalid input
    #[error("Validation error: {0}")]
    Validation(String),

    /// Transport error for network failures
    #[error("Transport error: {0}")]
    Transport(String),

    /// Execution error for function failures
    #[error("Execution error: {0}")]
    Execution(String),
}

/// Result type alias for SDK operations.
///
/// This is a convenience type alias for operations that return
/// a `CoreError` on failure.
pub type Result<T> = std::result::Result<T, CoreError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that MessageEnvelope can be serialized and deserialized
    #[test]
    fn test_message_envelope_roundtrip() {
        let original = MessageEnvelope {
            id: "test-123".to_string(),
            source: "source-1".to_string(),
            destination: "dest-1".to_string(),
            content: "Hello".to_string(),
            transport: "http".to_string(),
            timestamp: 1704067200,
            metadata: serde_json::json!({"key": "value"}),
        };

        let json = serde_json::to_string(&original).unwrap();
        let deserialized: MessageEnvelope = serde_json::from_str(&json).unwrap();

        assert_eq!(original.id, deserialized.id);
        assert_eq!(original.source, deserialized.source);
    }

    /// Test that ExecuteResponse reports success correctly
    #[test]
    fn test_execute_response_success() {
        let response = ExecuteResponse {
            success: true,
            result: Some(serde_json::json!({"data": "value"})),
            error: None,
            execution_time_ms: 100,
            ui_card: None,
        };

        assert!(response.success);
        assert!(response.error.is_none());
    }

    /// Test that SafetyTier variants exist
    #[test]
    fn test_safety_tier_variants() {
        let tiers = vec![
            SafetyTier::T0,
            SafetyTier::T1,
            SafetyTier::T2,
            SafetyTier::T3,
            SafetyTier::T4,
        ];

        assert_eq!(tiers.len(), 5);
    }
}
