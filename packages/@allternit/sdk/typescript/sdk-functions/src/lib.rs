//! # A2R SDK Functions
//!
//! Function registry and management for the A2R SDK.
//!
//! ## Overview
//!
//! This crate provides the function registry system for managing and
//! discovering functions within the A2R platform. It handles function
//! registration, search, validation, and permission checking.
//!
//! The function registry serves as a central catalog of all available
//! functions that agents can invoke, enabling discoverability and
//! governance across the system.
//!
//! ## Key Concepts
//!
//! - **FunctionDefinition**: Complete function specification
//! - **FunctionRegistry**: Central registry for function management
//! - **FunctionCall**: Request to invoke a function
//! - **PlatformSupport**: Cross-platform compatibility tracking
//! - **RateLimitConfig**: Function rate limiting configuration
//!
//! ## Example
//!
//! ```rust
//! use allternit_sdk_functions::{
//!     FunctionRegistry, FunctionDefinition, PlatformSupport,
//!     FunctionSearchRequest
//! };
//!
//! // Create a function registry
//! let mut registry = FunctionRegistry::new();
//!
//! // Register a function
//! let function = FunctionDefinition {
//!     id: "com.example.greet".to_string(),
//!     name: "Greet".to_string(),
//!     description: "Send a greeting".to_string(),
//!     version: "1.0.0".to_string(),
//!     platform_support: PlatformSupport {
//!         ios: true,
//!         android: true,
//!         web: true,
//!         desktop: true,
//!         backend: true,
//!     },
//!     risk_level: "low".to_string(),
//!     requires_confirmation: false,
//!     parameters: serde_json::json!({
//!         "type": "object",
//!         "properties": {
//!             "name": {"type": "string"}
//!         }
//!     }),
//!     returns: serde_json::json!({
//!         "type": "object",
//!         "properties": {
//!             "greeting": {"type": "string"}
//!         }
//!     }),
//!     execution_time_estimate_ms: 100,
//!     rate_limits: None,
//!     category: "utilities".to_string(),
//! };
//!
//! registry.register_function(function).unwrap();
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete definition of a function.
///
/// `FunctionDefinition` describes a callable function within the A2R
/// system, including its schema, platform support, risk classification,
/// and execution metadata.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::{FunctionDefinition, PlatformSupport, RateLimitConfig};
///
/// let function = FunctionDefinition {
///     id: "com.example.calculate".to_string(),
///     name: "Calculate Sum".to_string(),
///     description: "Add two numbers together".to_string(),
///     version: "1.0.0".to_string(),
///     platform_support: PlatformSupport {
///         ios: true,
///         android: true,
///         web: true,
///         desktop: true,
///         backend: true,
///     },
///     risk_level: "low".to_string(),
///     requires_confirmation: false,
///     parameters: serde_json::json!({
///         "type": "object",
///         "properties": {
///             "a": {"type": "number"},
///             "b": {"type": "number"}
///         },
///         "required": ["a", "b"]
///     }),
///     returns: serde_json::json!({
///         "type": "object",
///         "properties": {
///             "sum": {"type": "number"}
///         }
///     }),
///     execution_time_estimate_ms: 50,
///     rate_limits: Some(RateLimitConfig {
///         max_calls: 1000,
///         time_window_ms: 60000,
///     }),
///     category: "math".to_string(),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDefinition {
    /// Unique function identifier (reverse-domain notation)
    pub id: String,
    
    /// Human-readable function name
    pub name: String,
    
    /// Detailed description of what the function does
    pub description: String,
    
    /// Version string following semantic versioning
    pub version: String,
    
    /// Platform compatibility information
    pub platform_support: PlatformSupport,
    
    /// Risk level classification (`low`, `medium`, `high`, `critical`)
    pub risk_level: String,
    
    /// Whether user confirmation is required before execution
    pub requires_confirmation: bool,
    
    /// JSON Schema for input parameters
    pub parameters: serde_json::Value,
    
    /// JSON Schema for return value
    pub returns: serde_json::Value,
    
    /// Estimated execution time in milliseconds
    pub execution_time_estimate_ms: u64,
    
    /// Rate limiting configuration
    pub rate_limits: Option<RateLimitConfig>,
    
    /// Category for organization and discovery
    pub category: String,
}

impl FunctionDefinition {
    /// Returns true if this function supports the given platform.
    ///
    /// # Arguments
    ///
    /// * `platform` - Platform name (`ios`, `android`, `web`, `desktop`, `backend`)
    ///
    /// # Returns
    ///
    /// `true` if the function supports the platform, `false` otherwise
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{FunctionDefinition, PlatformSupport};
    ///
    /// let function = FunctionDefinition {
    ///     id: "test".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport {
    ///         ios: true,
    ///         android: true,
    ///         web: false,
    ///         desktop: true,
    ///         backend: false,
    ///     },
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// assert!(function.supports_platform("ios"));
    /// assert!(function.supports_platform("android"));
    /// assert!(!function.supports_platform("web"));
    /// assert!(function.supports_platform("desktop"));
    /// assert!(!function.supports_platform("backend"));
    /// ```
    pub fn supports_platform(&self, platform: &str) -> bool {
        match platform.to_lowercase().as_str() {
            "ios" => self.platform_support.ios,
            "android" => self.platform_support.android,
            "web" => self.platform_support.web,
            "desktop" => self.platform_support.desktop,
            "backend" => self.platform_support.backend,
            _ => false,
        }
    }
    
    /// Returns true if this function requires confirmation.
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{FunctionDefinition, PlatformSupport};
    ///
    /// let function = FunctionDefinition {
    ///     id: "test".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "high".to_string(),
    ///     requires_confirmation: true,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// assert!(function.requires_user_confirmation());
    /// ```
    pub fn requires_user_confirmation(&self) -> bool {
        self.requires_confirmation
    }
    
    /// Returns true if this function is classified as high or critical risk.
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{FunctionDefinition, PlatformSupport};
    ///
    /// let high_risk = FunctionDefinition {
    ///     id: "test".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "critical".to_string(),
    ///     requires_confirmation: true,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// assert!(high_risk.is_high_risk());
    /// ```
    pub fn is_high_risk(&self) -> bool {
        matches!(self.risk_level.as_str(), "high" | "critical")
    }
}

/// Platform support flags for a function.
///
/// `PlatformSupport` tracks which platforms a function can run on,
/// enabling platform-aware function routing and filtering.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::PlatformSupport;
///
/// // Create support for all platforms
/// let all_platforms = PlatformSupport::all();
/// assert!(all_platforms.ios);
/// assert!(all_platforms.android);
/// assert!(all_platforms.web);
/// assert!(all_platforms.desktop);
/// assert!(all_platforms.backend);
///
/// // Create support for mobile only
/// let mobile_only = PlatformSupport::mobile();
/// assert!(mobile_only.ios);
/// assert!(mobile_only.android);
/// assert!(!mobile_only.web);
/// assert!(!mobile_only.desktop);
/// assert!(!mobile_only.backend);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformSupport {
    /// Supports iOS platform
    pub ios: bool,
    /// Supports Android platform
    pub android: bool,
    /// Supports Web platform
    pub web: bool,
    /// Supports Desktop platform (Windows, macOS, Linux)
    pub desktop: bool,
    /// Supports Backend/server execution
    pub backend: bool,
}

impl PlatformSupport {
    /// Creates a `PlatformSupport` with all platforms enabled.
    ///
    /// # Returns
    ///
    /// A `PlatformSupport` with all fields set to `true`
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::PlatformSupport;
    ///
    /// let support = PlatformSupport::all();
    /// assert!(support.ios);
    /// assert!(support.android);
    /// assert!(support.web);
    /// assert!(support.desktop);
    /// assert!(support.backend);
    /// ```
    pub fn all() -> Self {
        Self {
            ios: true,
            android: true,
            web: true,
            desktop: true,
            backend: true,
        }
    }
    
    /// Creates a `PlatformSupport` with only mobile platforms enabled.
    ///
    /// # Returns
    ///
    /// A `PlatformSupport` with `ios` and `android` set to `true`
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::PlatformSupport;
    ///
    /// let support = PlatformSupport::mobile();
    /// assert!(support.ios);
    /// assert!(support.android);
    /// assert!(!support.web);
    /// assert!(!support.desktop);
    /// assert!(!support.backend);
    /// ```
    pub fn mobile() -> Self {
        Self {
            ios: true,
            android: true,
            web: false,
            desktop: false,
            backend: false,
        }
    }
    
    /// Creates a `PlatformSupport` with only web platform enabled.
    ///
    /// # Returns
    ///
    /// A `PlatformSupport` with only `web` set to `true`
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::PlatformSupport;
    ///
    /// let support = PlatformSupport::web_only();
    /// assert!(!support.ios);
    /// assert!(!support.android);
    /// assert!(support.web);
    /// assert!(!support.desktop);
    /// assert!(!support.backend);
    /// ```
    pub fn web_only() -> Self {
        Self {
            ios: false,
            android: false,
            web: true,
            desktop: false,
            backend: false,
        }
    }
    
    /// Creates a `PlatformSupport` with only backend platform enabled.
    ///
    /// # Returns
    ///
    /// A `PlatformSupport` with only `backend` set to `true`
    pub fn backend_only() -> Self {
        Self {
            ios: false,
            android: false,
            web: false,
            desktop: false,
            backend: true,
        }
    }
}

/// Rate limiting configuration for a function.
///
/// `RateLimitConfig` defines how many calls to a function are allowed
/// within a specific time window, preventing abuse and managing resources.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::RateLimitConfig;
///
/// // Allow 100 calls per minute
/// let rate_limit = RateLimitConfig {
///     max_calls: 100,
///     time_window_ms: 60_000,
/// };
///
/// assert_eq!(rate_limit.max_calls, 100);
/// assert_eq!(rate_limit.time_window_ms, 60_000);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Maximum number of calls allowed in the time window
    pub max_calls: u32,
    
    /// Time window in milliseconds
    pub time_window_ms: u64,
}

impl RateLimitConfig {
    /// Creates a per-second rate limit.
    ///
    /// # Arguments
    ///
    /// * `calls` - Number of calls allowed per second
    ///
    /// # Returns
    ///
    /// A `RateLimitConfig` with a 1-second window
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::RateLimitConfig;
    ///
    /// let limit = RateLimitConfig::per_second(10);
    /// assert_eq!(limit.max_calls, 10);
    /// assert_eq!(limit.time_window_ms, 1000);
    /// ```
    pub fn per_second(calls: u32) -> Self {
        Self {
            max_calls: calls,
            time_window_ms: 1000,
        }
    }
    
    /// Creates a per-minute rate limit.
    ///
    /// # Arguments
    ///
    /// * `calls` - Number of calls allowed per minute
    ///
    /// # Returns
    ///
    /// A `RateLimitConfig` with a 1-minute window
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::RateLimitConfig;
    ///
    /// let limit = RateLimitConfig::per_minute(100);
    /// assert_eq!(limit.max_calls, 100);
    /// assert_eq!(limit.time_window_ms, 60_000);
    /// ```
    pub fn per_minute(calls: u32) -> Self {
        Self {
            max_calls: calls,
            time_window_ms: 60_000,
        }
    }
    
    /// Creates a per-hour rate limit.
    ///
    /// # Arguments
    ///
    /// * `calls` - Number of calls allowed per hour
    ///
    /// # Returns
    ///
    /// A `RateLimitConfig` with a 1-hour window
    pub fn per_hour(calls: u32) -> Self {
        Self {
            max_calls: calls,
            time_window_ms: 3_600_000,
        }
    }
    
    /// Calculates the rate in calls per second.
    ///
    /// # Returns
    ///
    /// The average rate in calls per second
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::RateLimitConfig;
    ///
    /// let limit = RateLimitConfig::per_minute(60);
    /// assert_eq!(limit.calls_per_second(), 1.0);
    /// ```
    pub fn calls_per_second(&self) -> f64 {
        self.max_calls as f64 / (self.time_window_ms as f64 / 1000.0)
    }
}

/// A call to execute a function.
///
/// `FunctionCall` represents a request to invoke a function with
/// specific parameters within a given context.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::FunctionCall;
///
/// let call = FunctionCall {
///     function_id: "com.example.add".to_string(),
///     parameters: serde_json::json!({"a": 1, "b": 2}),
///     user_id: "user-123".to_string(),
///     agent_id: "agent-456".to_string(),
///     session_id: "session-789".to_string(),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    /// Identifier of the function to call
    pub function_id: String,
    
    /// Parameters for the function call
    pub parameters: serde_json::Value,
    
    /// ID of the user making the call
    pub user_id: String,
    
    /// ID of the agent handling the call
    pub agent_id: String,
    
    /// Session identifier for tracking
    pub session_id: String,
}

/// Request to execute a function with full context.
///
/// `FunctionExecutionRequest` contains all information needed to
/// execute a function, including priority hints.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::{FunctionExecutionRequest, FunctionCall};
///
/// let request = FunctionExecutionRequest {
///     function_call: FunctionCall {
///         function_id: "com.example.process".to_string(),
///         parameters: serde_json::json!({"data": "value"}),
///         user_id: "user-123".to_string(),
///         agent_id: "agent-456".to_string(),
///         session_id: "session-789".to_string(),
///     },
///     context: serde_json::json!({"priority": "high"}),
///     priority: 10,
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionExecutionRequest {
    /// The function call to execute
    pub function_call: FunctionCall,
    
    /// Additional execution context
    pub context: serde_json::Value,
    
    /// Priority level (higher = more urgent)
    pub priority: u32,
}

/// Response from function execution.
///
/// `FunctionExecutionResponse` contains the result of a function
/// execution, including success status and any error information.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::FunctionExecutionResponse;
///
/// let response = FunctionExecutionResponse {
///     success: true,
///     result: Some(serde_json::json!({"sum": 42})),
///     error: None,
///     execution_time_ms: 150,
///     requires_confirmation: false,
/// };
///
/// assert!(response.success);
/// assert!(response.error.is_none());
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionExecutionResponse {
    /// Whether the execution was successful
    pub success: bool,
    
    /// Result data if successful
    pub result: Option<serde_json::Value>,
    
    /// Error message if failed
    pub error: Option<String>,
    
    /// Actual execution time in milliseconds
    pub execution_time_ms: u64,
    
    /// Whether confirmation is required (for deferred execution)
    pub requires_confirmation: bool,
}

/// Registry for managing function definitions.
///
/// `FunctionRegistry` provides a central catalog for registering,
/// searching, and retrieving function definitions. It supports
/// filtering by category, platform, and text search.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::{
///     FunctionRegistry, FunctionDefinition, PlatformSupport
/// };
///
/// let mut registry = FunctionRegistry::new();
///
/// let function = FunctionDefinition {
///     id: "com.example.greet".to_string(),
///     name: "Greet".to_string(),
///     description: "Send a greeting".to_string(),
///     version: "1.0.0".to_string(),
///     platform_support: PlatformSupport::all(),
///     risk_level: "low".to_string(),
///     requires_confirmation: false,
///     parameters: serde_json::json!({}),
///     returns: serde_json::json!({}),
///     execution_time_estimate_ms: 100,
///     rate_limits: None,
///     category: "utilities".to_string(),
/// };
///
/// registry.register_function(function).unwrap();
///
/// let retrieved = registry.get_function("com.example.greet");
/// assert!(retrieved.is_some());
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionRegistry {
    /// Map of function ID to function definition
    pub functions: HashMap<String, FunctionDefinition>,
}

impl FunctionRegistry {
    /// Creates a new empty function registry.
    ///
    /// # Returns
    ///
    /// An empty `FunctionRegistry`
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::FunctionRegistry;
    ///
    /// let registry = FunctionRegistry::new();
    /// assert!(registry.functions.is_empty());
    /// ```
    pub fn new() -> Self {
        Self {
            functions: HashMap::new(),
        }
    }
    
    /// Registers a new function in the registry.
    ///
    /// # Arguments
    ///
    /// * `function` - The function definition to register
    ///
    /// # Returns
    ///
    /// `Ok(())` if successful, or an error if a function with the same ID already exists
    ///
    /// # Errors
    ///
    /// Returns an error if the function ID is already registered
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{FunctionRegistry, FunctionDefinition, PlatformSupport};
    ///
    /// let mut registry = FunctionRegistry::new();
    ///
    /// let function = FunctionDefinition {
    ///     id: "test.function".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// assert!(registry.register_function(function.clone()).is_ok());
    /// assert!(registry.register_function(function).is_err()); // Duplicate
    /// ```
    pub fn register_function(&mut self, function: FunctionDefinition) -> Result<(), String> {
        if self.functions.contains_key(&function.id) {
            return Err(format!("Function with ID {} already exists", function.id));
        }
        
        self.functions.insert(function.id.clone(), function);
        Ok(())
    }
    
    /// Retrieves a function by its ID.
    ///
    /// # Arguments
    ///
    /// * `function_id` - The function identifier
    ///
    /// # Returns
    ///
    /// `Some(&FunctionDefinition)` if found, `None` otherwise
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{FunctionRegistry, FunctionDefinition, PlatformSupport};
    ///
    /// let mut registry = FunctionRegistry::new();
    /// let function = FunctionDefinition {
    ///     id: "test.function".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// registry.register_function(function).unwrap();
    ///
    /// assert!(registry.get_function("test.function").is_some());
    /// assert!(registry.get_function("nonexistent").is_none());
    /// ```
    pub fn get_function(&self, function_id: &str) -> Option<&FunctionDefinition> {
        self.functions.get(function_id)
    }
    
    /// Searches for functions matching the given criteria.
    ///
    /// # Arguments
    ///
    /// * `request` - Search request with filters
    ///
    /// # Returns
    ///
    /// A vector of references to matching function definitions
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{
    ///     FunctionRegistry, FunctionDefinition, PlatformSupport, FunctionSearchRequest
    /// };
    ///
    /// let mut registry = FunctionRegistry::new();
    /// let function = FunctionDefinition {
    ///     id: "com.example.math.add".to_string(),
    ///     name: "Add".to_string(),
    ///     description: "Add two numbers".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "math".to_string(),
    /// };
    ///
    /// registry.register_function(function).unwrap();
    ///
    /// let request = FunctionSearchRequest {
    ///     category: Some("math".to_string()),
    ///     platform: None,
    ///     search: Some("add".to_string()),
    ///     limit: None,
    /// };
    ///
    /// let results = registry.search_functions(&request);
    /// assert_eq!(results.len(), 1);
    /// ```
    pub fn search_functions(&self, request: &FunctionSearchRequest) -> Vec<&FunctionDefinition> {
        self.functions
            .values()
            .filter(|func| {
                // Apply category filter
                if let Some(ref category) = request.category {
                    if func.category != *category {
                        return false;
                    }
                }
                
                // Apply platform filter
                if let Some(ref platform) = request.platform {
                    if !func.supports_platform(platform) {
                        return false;
                    }
                }
                
                // Apply text search filter
                if let Some(ref search) = request.search {
                    let search_lower = search.to_lowercase();
                    if !func.name.to_lowercase().contains(&search_lower) && 
                       !func.description.to_lowercase().contains(&search_lower) &&
                       !func.id.to_lowercase().contains(&search_lower) {
                        return false;
                    }
                }
                
                true
            })
            .take(request.limit.unwrap_or(usize::MAX))
            .collect()
    }
    
    /// Validates parameters against a function's schema.
    ///
    /// # Arguments
    ///
    /// * `function_id` - The function identifier
    /// * `parameters` - The parameters to validate
    ///
    /// # Returns
    ///
    /// `Ok(true)` if valid, or an error with details if invalid
    ///
    /// # Errors
    ///
    /// Returns an error if the function is not found or parameters are invalid
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{
    ///     FunctionRegistry, FunctionDefinition, PlatformSupport
    /// };
    ///
    /// let mut registry = FunctionRegistry::new();
    /// let function = FunctionDefinition {
    ///     id: "test.function".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// registry.register_function(function).unwrap();
    ///
    /// // Valid parameters (object)
    /// let valid = serde_json::json!({"key": "value"});
    /// assert!(registry.validate_parameters("test.function", &valid).is_ok());
    ///
    /// // Invalid parameters (not an object)
    /// let invalid = serde_json::json!("string");
    /// assert!(registry.validate_parameters("test.function", &invalid).is_err());
    /// ```
    pub fn validate_parameters(&self, function_id: &str, parameters: &serde_json::Value) -> Result<bool, String> {
        let _function = self.functions.get(function_id)
            .ok_or_else(|| format!("Function {} not found", function_id))?;

        // Basic validation: parameters must be a JSON object
        if !parameters.is_object() {
            return Err("Parameters must be a JSON object".to_string());
        }

        // TODO: Implement JSON Schema validation against function.parameters

        Ok(true)
    }
    
    /// Checks if a user/agent has permission to call a function.
    ///
    /// # Arguments
    ///
    /// * `function_id` - The function identifier
    /// * `user_id` - The user identifier
    /// * `agent_id` - The agent identifier
    ///
    /// # Returns
    ///
    /// `Ok(true)` if permitted, or an error if not permitted
    ///
    /// # Errors
    ///
    /// Returns an error if the function is not found or permission is denied
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{
    ///     FunctionRegistry, FunctionDefinition, PlatformSupport
    /// };
    ///
    /// let mut registry = FunctionRegistry::new();
    /// let function = FunctionDefinition {
    ///     id: "test.function".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// registry.register_function(function).unwrap();
    ///
    /// let result = registry.check_permission("test.function", "user-123", "agent-456");
    /// assert!(result.is_ok());
    /// ```
    pub fn check_permission(&self, function_id: &str, _user_id: &str, _agent_id: &str) -> Result<bool, String> {
        let _function = self.functions.get(function_id)
            .ok_or_else(|| format!("Function {} not found", function_id))?;

        // TODO: Implement proper permission checking against policy engine
        // For now, all functions are allowed for all users/agents

        Ok(true)
    }
    
    /// Checks if a function requires user confirmation.
    ///
    /// # Arguments
    ///
    /// * `function_id` - The function identifier
    ///
    /// # Returns
    ///
    /// `Ok(true)` if confirmation is required, `Ok(false)` otherwise
    ///
    /// # Errors
    ///
    /// Returns an error if the function is not found
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::{
    ///     FunctionRegistry, FunctionDefinition, PlatformSupport
    /// };
    ///
    /// let mut registry = FunctionRegistry::new();
    /// let function = FunctionDefinition {
    ///     id: "test.function".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test function".to_string(),
    ///     version: "1.0.0".to_string(),
    ///     platform_support: PlatformSupport::all(),
    ///     risk_level: "high".to_string(),
    ///     requires_confirmation: true,
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     execution_time_estimate_ms: 100,
    ///     rate_limits: None,
    ///     category: "test".to_string(),
    /// };
    ///
    /// registry.register_function(function).unwrap();
    ///
    /// let needs_confirmation = registry.requires_confirmation("test.function").unwrap();
    /// assert!(needs_confirmation);
    /// ```
    pub fn requires_confirmation(&self, function_id: &str) -> Result<bool, String> {
        let function = self.functions.get(function_id)
            .ok_or_else(|| format!("Function {} not found", function_id))?;

        Ok(function.requires_confirmation)
    }
    
    /// Returns the number of functions in the registry.
    ///
    /// # Returns
    ///
    /// The number of registered functions
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::FunctionRegistry;
    ///
    /// let registry = FunctionRegistry::new();
    /// assert_eq!(registry.len(), 0);
    /// ```
    pub fn len(&self) -> usize {
        self.functions.len()
    }
    
    /// Returns true if the registry contains no functions.
    ///
    /// # Returns
    ///
    /// `true` if empty, `false` otherwise
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::FunctionRegistry;
    ///
    /// let registry = FunctionRegistry::new();
    /// assert!(registry.is_empty());
    /// ```
    pub fn is_empty(&self) -> bool {
        self.functions.is_empty()
    }
}

impl Default for FunctionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Request for searching functions.
///
/// `FunctionSearchRequest` contains the criteria for searching
/// the function registry, including category, platform, and text filters.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::FunctionSearchRequest;
///
/// // Search for math functions on iOS
/// let request = FunctionSearchRequest {
///     category: Some("math".to_string()),
///     platform: Some("ios".to_string()),
///     search: Some("calculate".to_string()),
///     limit: Some(10),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionSearchRequest {
    /// Filter by category
    pub category: Option<String>,
    
    /// Filter by platform support
    pub platform: Option<String>,
    
    /// Text search query (matches name, description, ID)
    pub search: Option<String>,
    
    /// Maximum number of results to return
    pub limit: Option<usize>,
}

impl FunctionSearchRequest {
    /// Creates a new search request with no filters.
    ///
    /// # Returns
    ///
    /// A `FunctionSearchRequest` that matches all functions
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::FunctionSearchRequest;
    ///
    /// let request = FunctionSearchRequest::new();
    /// assert!(request.category.is_none());
    /// assert!(request.search.is_none());
    /// ```
    pub fn new() -> Self {
        Self {
            category: None,
            platform: None,
            search: None,
            limit: None,
        }
    }
    
    /// Sets the category filter.
    ///
    /// # Arguments
    ///
    /// * `category` - The category to filter by
    ///
    /// # Returns
    ///
    /// The updated `FunctionSearchRequest` for method chaining
    ///
    /// # Examples
    ///
    /// ```
    /// use allternit_sdk_functions::FunctionSearchRequest;
    ///
    /// let request = FunctionSearchRequest::new()
    ///     .with_category("math");
    ///
    /// assert_eq!(request.category, Some("math".to_string()));
    /// ```
    pub fn with_category(mut self, category: &str) -> Self {
        self.category = Some(category.to_string());
        self
    }
    
    /// Sets the platform filter.
    ///
    /// # Arguments
    ///
    /// * `platform` - The platform to filter by
    ///
    /// # Returns
    ///
    /// The updated `FunctionSearchRequest` for method chaining
    pub fn with_platform(mut self, platform: &str) -> Self {
        self.platform = Some(platform.to_string());
        self
    }
    
    /// Sets the text search query.
    ///
    /// # Arguments
    ///
    /// * `query` - The search query
    ///
    /// # Returns
    ///
    /// The updated `FunctionSearchRequest` for method chaining
    pub fn with_search(mut self, query: &str) -> Self {
        self.search = Some(query.to_string());
        self
    }
    
    /// Sets the result limit.
    ///
    /// # Arguments
    ///
    /// * `limit` - Maximum number of results
    ///
    /// # Returns
    ///
    /// The updated `FunctionSearchRequest` for method chaining
    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }
}

impl Default for FunctionSearchRequest {
    fn default() -> Self {
        Self::new()
    }
}

/// Response from a function search.
///
/// `FunctionSearchResponse` contains the results of a function
/// search operation, including the matching functions and total count.
///
/// # Examples
///
/// ```
/// use allternit_sdk_functions::{FunctionSearchResponse, FunctionDefinition};
///
/// let response = FunctionSearchResponse {
///     functions: vec![],
///     total_count: 0,
/// };
///
/// assert_eq!(response.total_count, 0);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionSearchResponse {
    /// Matching function definitions
    pub functions: Vec<FunctionDefinition>,
    
    /// Total number of matches (before limit applied)
    pub total_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test basic registry operations
    #[test]
    fn test_function_registry_basic_operations() {
        let mut registry = FunctionRegistry::new();
        
        let function = FunctionDefinition {
            id: "test.function".to_string(),
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
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "param1": {
                        "type": "string"
                    }
                }
            }),
            returns: serde_json::json!({
                "type": "object",
                "properties": {
                    "result": {
                        "type": "string"
                    }
                }
            }),
            execution_time_estimate_ms: 100,
            rate_limits: None,
            category: "test".to_string(),
        };

        // Test registration
        assert!(registry.register_function(function.clone()).is_ok());
        
        // Test duplicate registration
        assert!(registry.register_function(function.clone()).is_err());
        
        // Test retrieval
        let retrieved = registry.get_function("test.function").unwrap();
        assert_eq!(retrieved.name, "Test Function");
        
        // Test len and is_empty
        assert_eq!(registry.len(), 1);
        assert!(!registry.is_empty());
    }

    /// Test function search with various filters
    #[test]
    fn test_function_search() {
        let mut registry = FunctionRegistry::new();
        
        let function1 = FunctionDefinition {
            id: "com.allternit.os.set_alarm".to_string(),
            name: "Set Alarm".to_string(),
            description: "Sets an alarm on the device".to_string(),
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
                        "description": "Time for the alarm in HH:MM format"
                    },
                    "label": {
                        "type": "string",
                        "description": "Optional label for the alarm"
                    }
                },
                "required": ["time"]
            }),
            returns: serde_json::json!({
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Status of the alarm creation"
                    }
                }
            }),
            execution_time_estimate_ms: 500,
            rate_limits: Some(RateLimitConfig {
                max_calls: 10,
                time_window_ms: 60000, // 1 minute
            }),
            category: "system".to_string(),
        };

        let function2 = FunctionDefinition {
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
                    }
                },
                "required": ["recipient", "amount"]
            }),
            returns: serde_json::json!({
                "type": "object",
                "properties": {
                    "transaction_id": {
                        "type": "string",
                        "description": "ID of the transaction"
                    },
                    "status": {
                        "type": "string",
                        "description": "Status of the transaction"
                    }
                }
            }),
            execution_time_estimate_ms: 2000,
            rate_limits: Some(RateLimitConfig {
                max_calls: 1,
                time_window_ms: 300000, // 5 minutes
            }),
            category: "finance".to_string(),
        };

        registry.register_function(function1).unwrap();
        registry.register_function(function2).unwrap();

        // Test search by category
        let search_request = FunctionSearchRequest {
            category: Some("system".to_string()),
            platform: None,
            search: None,
            limit: None,
        };
        
        let results = registry.search_functions(&search_request);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "com.allternit.os.set_alarm");

        // Test search by platform
        let search_request = FunctionSearchRequest {
            category: None,
            platform: Some("web".to_string()),
            search: None,
            limit: None,
        };
        
        let results = registry.search_functions(&search_request);
        assert_eq!(results.len(), 1); // Only the finance function supports web
        assert_eq!(results[0].id, "com.allternit.finance.transfer_money");

        // Test search by text
        let search_request = FunctionSearchRequest {
            category: None,
            platform: None,
            search: Some("alarm".to_string()),
            limit: None,
        };
        
        let results = registry.search_functions(&search_request);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "com.allternit.os.set_alarm");
    }

    /// Test parameter validation
    #[test]
    fn test_parameter_validation() {
        let mut registry = FunctionRegistry::new();
        
        let function = FunctionDefinition {
            id: "test.validation".to_string(),
            name: "Validation Test".to_string(),
            description: "Test parameter validation".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: false,
                web: false,
                desktop: false,
                backend: false,
            },
            risk_level: "medium".to_string(),
            requires_confirmation: true,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "required_param": {
                        "type": "string"
                    }
                },
                "required": ["required_param"]
            }),
            returns: serde_json::json!({}),
            execution_time_estimate_ms: 100,
            rate_limits: None,
            category: "test".to_string(),
        };

        registry.register_function(function).unwrap();

        // Test valid parameters
        let valid_params = serde_json::json!({
            "required_param": "valid_value"
        });
        assert!(registry.validate_parameters("test.validation", &valid_params).is_ok());

        // Test invalid parameters (not an object)
        let invalid_params = serde_json::json!("string");
        assert!(registry.validate_parameters("test.validation", &invalid_params).is_err());
        
        // Test non-existent function
        assert!(registry.validate_parameters("nonexistent", &valid_params).is_err());
    }
    
    /// Test rate limit configuration
    #[test]
    fn test_rate_limit_config() {
        let per_second = RateLimitConfig::per_second(10);
        assert_eq!(per_second.max_calls, 10);
        assert_eq!(per_second.time_window_ms, 1000);
        assert_eq!(per_second.calls_per_second(), 10.0);
        
        let per_minute = RateLimitConfig::per_minute(60);
        assert_eq!(per_minute.max_calls, 60);
        assert_eq!(per_minute.time_window_ms, 60000);
        assert_eq!(per_minute.calls_per_second(), 1.0);
        
        let per_hour = RateLimitConfig::per_hour(3600);
        assert_eq!(per_hour.max_calls, 3600);
        assert_eq!(per_hour.time_window_ms, 3600000);
    }
    
    /// Test platform support helpers
    #[test]
    fn test_platform_support() {
        let all = PlatformSupport::all();
        assert!(all.ios && all.android && all.web && all.desktop && all.backend);
        
        let mobile = PlatformSupport::mobile();
        assert!(mobile.ios && mobile.android);
        assert!(!mobile.web && !mobile.desktop && !mobile.backend);
        
        let web = PlatformSupport::web_only();
        assert!(web.web);
        assert!(!web.ios && !web.android && !web.desktop && !web.backend);
        
        let backend = PlatformSupport::backend_only();
        assert!(backend.backend);
        assert!(!backend.ios && !backend.android && !backend.web && !backend.desktop);
    }
    
    /// Test function definition platform support
    #[test]
    fn test_function_platform_support() {
        let function = FunctionDefinition {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: "Test".to_string(),
            version: "1.0.0".to_string(),
            platform_support: PlatformSupport {
                ios: true,
                android: false,
                web: true,
                desktop: false,
                backend: false,
            },
            risk_level: "low".to_string(),
            requires_confirmation: false,
            parameters: serde_json::json!({}),
            returns: serde_json::json!({}),
            execution_time_estimate_ms: 100,
            rate_limits: None,
            category: "test".to_string(),
        };
        
        assert!(function.supports_platform("ios"));
        assert!(!function.supports_platform("android"));
        assert!(function.supports_platform("web"));
        assert!(!function.supports_platform("unknown"));
    }
    
    /// Test search request builder
    #[test]
    fn test_search_request_builder() {
        let request = FunctionSearchRequest::new()
            .with_category("math")
            .with_platform("ios")
            .with_search("calculate")
            .with_limit(10);
        
        assert_eq!(request.category, Some("math".to_string()));
        assert_eq!(request.platform, Some("ios".to_string()));
        assert_eq!(request.search, Some("calculate".to_string()));
        assert_eq!(request.limit, Some(10));
    }
}
