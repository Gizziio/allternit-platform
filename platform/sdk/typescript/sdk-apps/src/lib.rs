//! # A2R SDK Apps
//!
//! Application definitions and management for the A2R SDK.
//!
//! ## Overview
//!
//! This crate provides types and utilities for defining, registering,
//! and managing A2R-compatible applications. It handles app manifests,
//! tool definitions, UI card templates, and platform support.
//!
//! Applications in A2R are self-contained packages that provide tools
//! and UI components that agents can use to interact with external
//! services and systems.
//!
//! ## Key Concepts
//!
//! - **AppDefinition**: Complete application manifest
//! - **ToolDefinition**: Tools exposed by the application
//! - **UICardTemplate**: Reusable UI component templates
//! - **AppAdapter**: Adapter for integrating apps with the A2R system
//! - **OAuthConfig**: OAuth 2.0 authentication configuration
//!
//! ## Example
//!
//! ```rust
//! use a2rchitech_sdk_apps::{
//!     AppDefinition, ToolDefinition, UICardTemplate,
//!     CardActionTemplate, ActionHandlerTemplate, OAuthConfig
//! };
//!
//! // Create a new app definition
//! let mut app = AppDefinition::new(
//!     "com.example.myapp".to_string(),
//!     "My App".to_string(),
//!     "An example application".to_string(),
//!     "1.0.0".to_string(),
//!     "Example Inc".to_string(),
//! );
//!
//! // Add capabilities
//! app.capabilities.push("scheduling".to_string());
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete application definition for A2R.
///
/// `AppDefinition` describes an application that can be registered
/// and used within the A2R ecosystem. It includes metadata about the
/// app, its authentication configuration, supported platforms,
/// and the tools it provides.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::{
///     AppDefinition, OAuthConfig, ToolDefinition, UICardTemplate
/// };
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
///     capabilities: vec!["scheduling".to_string()],
///     supported_platforms: vec!["ios".to_string(), "android".to_string(), "web".to_string()],
///     tools: vec![],
///     ui_cards: vec![],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppDefinition {
    /// Unique application identifier (reverse-domain notation)
    /// 
    /// Example: `com.example.myapp`
    pub id: String,
    
    /// Human-readable application name
    pub name: String,
    
    /// Brief description of the application
    pub description: String,
    
    /// Version string following semantic versioning
    /// 
    /// Example: `1.0.0`
    pub version: String,
    
    /// Name of the developer or organization
    pub developer: String,
    
    /// Website URL for the application
    pub website: String,
    
    /// URL to the application icon
    pub icon_url: String,
    
    /// List of category tags for discovery
    /// 
    /// Common categories: productivity, communication, finance, etc.
    pub categories: Vec<String>,
    
    /// Authentication type required by the app
    /// 
    /// Valid values: `oauth2`, `api_key`, `none`
    pub auth_type: String,
    
    /// List of capability identifiers the app provides
    /// 
    /// These describe what the app can do for agent matching
    pub capabilities: Vec<String>,
    
    /// Platforms supported by the app
    /// 
    /// Valid values: `ios`, `android`, `web`, `desktop`
    pub supported_platforms: Vec<String>,
    
    /// Tools exposed by this application
    /// 
    /// These tools can be called by agents through the A2R system
    pub tools: Vec<ToolDefinition>,
    
    /// UI card templates provided by the app
    /// 
    /// These templates define how the app renders rich content
    pub ui_cards: Vec<UICardTemplate>,
}

impl AppDefinition {
    /// Creates a new `AppDefinition` with default values.
    ///
    /// This constructor initializes an app with the required fields
    /// and sensible defaults for optional fields.
    ///
    /// # Arguments
    ///
    /// * `id` - Unique application identifier (reverse-domain notation)
    /// * `name` - Human-readable application name
    /// * `description` - Brief description of the application
    /// * `version` - Version string (semantic versioning recommended)
    /// * `developer` - Name of the developer or organization
    ///
    /// # Returns
    ///
    /// A new `AppDefinition` with default values for optional fields
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::AppDefinition;
    ///
    /// let app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// assert_eq!(app.id, "com.example.myapp");
    /// assert_eq!(app.supported_platforms, vec!["ios", "android", "web"]);
    /// assert!(app.website.is_empty());
    /// ```
    pub fn new(
        id: String,
        name: String,
        description: String,
        version: String,
        developer: String,
    ) -> Self {
        Self {
            id,
            name,
            description,
            version,
            developer,
            website: String::new(),
            icon_url: String::new(),
            categories: Vec::new(),
            auth_type: "none".to_string(),
            capabilities: Vec::new(),
            supported_platforms: vec!["ios".to_string(), "android".to_string(), "web".to_string()],
            tools: Vec::new(),
            ui_cards: Vec::new(),
        }
    }
    
    /// Adds a tool to the application definition.
    ///
    /// # Arguments
    ///
    /// * `tool` - The tool definition to add
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::{AppDefinition, ToolDefinition};
    ///
    /// let mut app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// let tool = ToolDefinition {
    ///     id: "com.example.myapp.create_task".to_string(),
    ///     name: "Create Task".to_string(),
    ///     description: "Create a new task".to_string(),
    ///     category: "productivity".to_string(),
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     risk_level: "low".to_string(),
    ///     requires_confirmation: false,
    ///     execution_time_estimate_ms: 1000,
    /// };
    ///
    /// app.add_tool(tool);
    /// assert_eq!(app.tools.len(), 1);
    /// ```
    pub fn add_tool(&mut self, tool: ToolDefinition) {
        self.tools.push(tool);
    }
    
    /// Adds a UI card template to the application.
    ///
    /// # Arguments
    ///
    /// * `template` - The UI card template to add
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::{AppDefinition, UICardTemplate};
    ///
    /// let mut app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// let template = UICardTemplate {
    ///     card_type: "info".to_string(),
    ///     title_template: "Welcome".to_string(),
    ///     content_template: serde_json::json!({}),
    ///     actions: vec![],
    /// };
    ///
    /// app.add_ui_card(template);
    /// assert_eq!(app.ui_cards.len(), 1);
    /// ```
    pub fn add_ui_card(&mut self, template: UICardTemplate) {
        self.ui_cards.push(template);
    }
    
    /// Sets the OAuth configuration for the application.
    ///
    /// This also sets the `auth_type` to `"oauth2"`.
    ///
    /// # Arguments
    ///
    /// * `oauth_config` - The OAuth 2.0 configuration
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::{AppDefinition, OAuthConfig};
    ///
    /// let mut app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// app.set_oauth_config(OAuthConfig {
    ///     authorization_url: "https://example.com/auth".to_string(),
    ///     token_url: "https://example.com/token".to_string(),
    ///     client_id: "client123".to_string(),
    ///     scopes: vec!["read".to_string()],
    /// });
    ///
    /// assert_eq!(app.auth_type, "oauth2");
    /// ```
    pub fn set_oauth_config(&mut self, oauth_config: OAuthConfig) {
        self.auth_type = "oauth2".to_string();
        // Note: oauth_config field would need to be added to AppDefinition
        // This is a placeholder for demonstration
    }
}

/// Definition of a tool exposed by an application.
///
/// `ToolDefinition` describes a single function or capability
/// that an application makes available to agents through the A2R
/// system. It includes the tool's schema, risk classification,
/// and execution metadata.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::ToolDefinition;
///
/// let tool = ToolDefinition {
///     id: "com.example.create_task".to_string(),
///     name: "Create Task".to_string(),
///     description: "Create a new task in the task manager".to_string(),
///     category: "productivity".to_string(),
///     parameters: serde_json::json!({
///         "type": "object",
///         "properties": {
///             "title": {"type": "string"},
///             "due_date": {"type": "string", "format": "date"}
///         },
///         "required": ["title"]
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
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Unique tool identifier (typically `{app_id}.{tool_name}`)
    pub id: String,
    
    /// Human-readable tool name
    pub name: String,
    
    /// Detailed description of what the tool does
    pub description: String,
    
    /// Category for organization and discovery
    pub category: String,
    
    /// JSON Schema for input parameters
    pub parameters: serde_json::Value,
    
    /// JSON Schema for return value
    pub returns: serde_json::Value,
    
    /// Risk level classification (`low`, `medium`, `high`, `critical`)
    pub risk_level: String,
    
    /// Whether user confirmation is required before execution
    pub requires_confirmation: bool,
    
    /// Estimated execution time in milliseconds
    pub execution_time_estimate_ms: u64,
}

impl ToolDefinition {
    /// Returns true if this tool requires user confirmation.
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::ToolDefinition;
    ///
    /// let tool = ToolDefinition {
    ///     id: "test".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test tool".to_string(),
    ///     category: "test".to_string(),
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     risk_level: "high".to_string(),
    ///     requires_confirmation: true,
    ///     execution_time_estimate_ms: 100,
    /// };
    ///
    /// assert!(tool.is_confirmation_required());
    /// ```
    pub fn is_confirmation_required(&self) -> bool {
        self.requires_confirmation
    }
    
    /// Returns true if this tool is classified as high risk.
    ///
    /// High risk tools include those with risk level "high" or "critical".
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::ToolDefinition;
    ///
    /// let high_risk = ToolDefinition {
    ///     id: "test".to_string(),
    ///     name: "Test".to_string(),
    ///     description: "Test tool".to_string(),
    ///     category: "test".to_string(),
    ///     parameters: serde_json::json!({}),
    ///     returns: serde_json::json!({}),
    ///     risk_level: "critical".to_string(),
    ///     requires_confirmation: true,
    ///     execution_time_estimate_ms: 100,
    /// };
    ///
    /// assert!(high_risk.is_high_risk());
    /// ```
    pub fn is_high_risk(&self) -> bool {
        matches!(self.risk_level.as_str(), "high" | "critical")
    }
}

/// Template for rendering a UI card.
///
/// `UICardTemplate` defines a reusable template for displaying
/// rich content cards in the A2R UI. Templates support variable
/// substitution and can include actions.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::{UICardTemplate, CardActionTemplate, ActionHandlerTemplate};
///
/// let template = UICardTemplate {
///     card_type: "info".to_string(),
///     title_template: "Welcome, {{username}}!".to_string(),
///     content_template: serde_json::json!({
///         "message": "You have {{count}} new notifications"
///     }),
///     actions: vec![
///         CardActionTemplate {
///             id: "view".to_string(),
///             label: "View All".to_string(),
///             action_type: "primary".to_string(),
///             handler: ActionHandlerTemplate {
///                 handler_type: "deep_link".to_string(),
///                 target: "/notifications".to_string(),
///                 parameters: None,
///             },
///         },
///     ],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UICardTemplate {
    /// Type of card (e.g., "info", "warning", "error", "success")
    ///
    /// Determines the visual styling of the card
    pub card_type: String,
    
    /// Template string for the card title
    ///
    /// Supports variable substitution with `{{variable}}` syntax
    pub title_template: String,
    
    /// Template for the card content
    ///
    /// JSON object where values may contain template variables
    pub content_template: serde_json::Value,
    
    /// Available actions for the card
    pub actions: Vec<CardActionTemplate>,
}

/// Template for a card action.
///
/// `CardActionTemplate` defines an interactive action that can
/// be triggered from a UI card.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::{CardActionTemplate, ActionHandlerTemplate};
///
/// let action = CardActionTemplate {
///     id: "submit".to_string(),
///     label: "Submit".to_string(),
///     action_type: "primary".to_string(),
///     handler: ActionHandlerTemplate {
///         handler_type: "tool_call".to_string(),
///         target: "form.submit".to_string(),
///         parameters: None,
///     },
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardActionTemplate {
    /// Unique action identifier within the card
    pub id: String,
    
    /// Display label for the action button
    pub label: String,
    
    /// Visual style type
    ///
    /// Valid values: `primary`, `secondary`, `destructive`
    pub action_type: String,
    
    /// Handler to execute when action is triggered
    pub handler: ActionHandlerTemplate,
}

/// Template for an action handler.
///
/// `ActionHandlerTemplate` specifies what happens when a card
/// action is triggered by the user.
///
/// # Handler Types
///
/// - `tool_call`: Execute a tool/function
/// - `deep_link`: Navigate to a deep link
/// - `web_view`: Open a web view
/// - `app_intent`: Trigger an app-specific intent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionHandlerTemplate {
    /// Type of handler
    ///
    /// Valid values: `tool_call`, `deep_link`, `web_view`, `app_intent`
    pub handler_type: String,
    
    /// Target identifier (tool ID, URL, etc.)
    pub target: String,
    
    /// Template parameters for the handler
    pub parameters: Option<serde_json::Value>,
}

/// OAuth 2.0 configuration.
///
/// `OAuthConfig` contains the settings needed to authenticate
/// with an OAuth 2.0 provider. This is used when an app requires
/// user authentication via OAuth.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::OAuthConfig;
///
/// let oauth = OAuthConfig {
///     authorization_url: "https://accounts.google.com/o/oauth2/auth".to_string(),
///     token_url: "https://oauth2.googleapis.com/token".to_string(),
///     client_id: "123456789.apps.googleusercontent.com".to_string(),
///     scopes: vec![
///         "https://www.googleapis.com/auth/calendar".to_string(),
///         "https://www.googleapis.com/auth/tasks".to_string(),
///     ],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    /// OAuth authorization endpoint URL
    pub authorization_url: String,
    
    /// OAuth token endpoint URL
    pub token_url: String,
    
    /// OAuth client ID
    pub client_id: String,
    
    /// Requested OAuth scopes
    pub scopes: Vec<String>,
}

/// Adapter for integrating external apps with A2R.
///
/// `AppAdapter` wraps an `AppDefinition` with additional configuration
/// needed to integrate it into the A2R system.
///
/// # Examples
///
/// ```
/// use a2rchitech_sdk_apps::{AppAdapter, AppDefinition};
///
/// let app = AppDefinition::new(
///     "com.example.myapp".to_string(),
///     "My App".to_string(),
///     "An example application".to_string(),
///     "1.0.0".to_string(),
///     "Example Inc".to_string(),
/// );
///
/// let adapter = AppAdapter {
///     app_definition: app,
///     adapter_config: serde_json::json!({
///         "webhook_url": "https://example.com/webhook",
///         "rate_limit": 100
///     }),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppAdapter {
    /// The wrapped application definition
    pub app_definition: AppDefinition,
    
    /// Adapter-specific configuration
    ///
    /// This can include webhook URLs, rate limits, caching
    /// settings, and other adapter-specific options
    pub adapter_config: serde_json::Value,
}

impl AppAdapter {
    /// Creates a new app adapter with the given app definition.
    ///
    /// # Arguments
    ///
    /// * `app_definition` - The application to wrap
    ///
    /// # Returns
    ///
    /// A new `AppAdapter` with empty adapter configuration
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::{AppAdapter, AppDefinition};
    ///
    /// let app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// let adapter = AppAdapter::new(app);
    /// assert_eq!(adapter.app_definition.id, "com.example.myapp");
    /// ```
    pub fn new(app_definition: AppDefinition) -> Self {
        Self {
            app_definition,
            adapter_config: serde_json::json!({}),
        }
    }
    
    /// Sets the adapter configuration.
    ///
    /// # Arguments
    ///
    /// * `config` - The configuration object
    ///
    /// # Examples
    ///
    /// ```
    /// use a2rchitech_sdk_apps::{AppAdapter, AppDefinition};
    ///
    /// let app = AppDefinition::new(
    ///     "com.example.myapp".to_string(),
    ///     "My App".to_string(),
    ///     "An example application".to_string(),
    ///     "1.0.0".to_string(),
    ///     "Example Inc".to_string(),
    /// );
    ///
    /// let mut adapter = AppAdapter::new(app);
    /// adapter.set_config(serde_json::json!({
    ///     "webhook_url": "https://example.com/webhook"
    /// }));
    /// ```
    pub fn set_config(&mut self, config: serde_json::Value) {
        self.adapter_config = config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that AppDefinition::new creates an app with correct defaults
    #[test]
    fn test_app_definition_new() {
        let app = AppDefinition::new(
            "com.example.test".to_string(),
            "Test App".to_string(),
            "A test application".to_string(),
            "1.0.0".to_string(),
            "Test Developer".to_string(),
        );

        assert_eq!(app.id, "com.example.test");
        assert_eq!(app.name, "Test App");
        assert_eq!(app.version, "1.0.0");
        assert_eq!(app.auth_type, "none");
        assert!(app.tools.is_empty());
        assert!(app.ui_cards.is_empty());
    }

    /// Test adding tools to an app
    #[test]
    fn test_add_tool() {
        let mut app = AppDefinition::new(
            "com.example.test".to_string(),
            "Test App".to_string(),
            "A test application".to_string(),
            "1.0.0".to_string(),
            "Test Developer".to_string(),
        );

        let tool = ToolDefinition {
            id: "test.tool".to_string(),
            name: "Test Tool".to_string(),
            description: "A test tool".to_string(),
            category: "test".to_string(),
            parameters: serde_json::json!({}),
            returns: serde_json::json!({}),
            risk_level: "low".to_string(),
            requires_confirmation: false,
            execution_time_estimate_ms: 100,
        };

        app.add_tool(tool);
        assert_eq!(app.tools.len(), 1);
        assert_eq!(app.tools[0].id, "test.tool");
    }

    /// Test ToolDefinition risk classification
    #[test]
    fn test_tool_risk_classification() {
        let low_risk = ToolDefinition {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: "Test".to_string(),
            category: "test".to_string(),
            parameters: serde_json::json!({}),
            returns: serde_json::json!({}),
            risk_level: "low".to_string(),
            requires_confirmation: false,
            execution_time_estimate_ms: 100,
        };

        let high_risk = ToolDefinition {
            id: "test2".to_string(),
            name: "Test2".to_string(),
            description: "Test2".to_string(),
            category: "test".to_string(),
            parameters: serde_json::json!({}),
            returns: serde_json::json!({}),
            risk_level: "high".to_string(),
            requires_confirmation: true,
            execution_time_estimate_ms: 100,
        };

        let critical_risk = ToolDefinition {
            id: "test3".to_string(),
            name: "Test3".to_string(),
            description: "Test3".to_string(),
            category: "test".to_string(),
            parameters: serde_json::json!({}),
            returns: serde_json::json!({}),
            risk_level: "critical".to_string(),
            requires_confirmation: true,
            execution_time_estimate_ms: 100,
        };

        assert!(!low_risk.is_high_risk());
        assert!(high_risk.is_high_risk());
        assert!(critical_risk.is_high_risk());
    }

    /// Test AppAdapter creation
    #[test]
    fn test_app_adapter() {
        let app = AppDefinition::new(
            "com.example.test".to_string(),
            "Test App".to_string(),
            "A test application".to_string(),
            "1.0.0".to_string(),
            "Test Developer".to_string(),
        );

        let adapter = AppAdapter::new(app);
        assert_eq!(adapter.app_definition.id, "com.example.test");
        assert!(adapter.adapter_config.is_object());
    }
}
