//! BROWSER.* Tool Family
//!
//! Chrome Extension / Browser Capsule tool contracts for browser automation.
//! These tools execute via the Chrome Extension native messaging host.

pub mod executor;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub use executor::BrowserToolExecutor;

// ============================================================================
// Tool Definitions
// ============================================================================

/// BROWSER.GET_CONTEXT - Get current browser context
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GetContextParams {
    /// Specific tab ID (optional, uses active tab if not specified)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tab_id: Option<String>,
    /// Include DOM snapshot
    #[serde(default)]
    pub include_dom: bool,
    /// Include accessibility tree
    #[serde(default)]
    pub include_accessibility: bool,
    /// Include network log
    #[serde(default)]
    pub include_network_log: bool,
    /// Include cookies
    #[serde(default)]
    pub include_cookies: bool,
}

/// BROWSER.ACT - Perform browser actions
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ActParams {
    /// Actions to perform (executed in order)
    pub actions: Vec<BrowserAction>,
    /// Timeout for all actions (ms)
    #[serde(default = "default_action_timeout")]
    pub timeout_ms: u64,
    /// Wait for navigation after action
    #[serde(default)]
    pub wait_for_navigation: bool,
}

fn default_action_timeout() -> u64 {
    30000
}

/// BROWSER.NAV - Navigation actions
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NavParams {
    /// Navigation type
    pub nav_type: NavigationType,
    /// URL (for Navigate type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// Wait conditions after navigation
    #[serde(default)]
    pub wait_for: Vec<WaitCondition>,
    /// Timeout (ms)
    #[serde(default = "default_nav_timeout")]
    pub timeout_ms: u64,
}

fn default_nav_timeout() -> u64 {
    30000
}

/// BROWSER.EXTRACT - Extract data from page
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExtractParams {
    /// Queries to execute
    pub queries: Vec<ExtractQuery>,
    /// Scope (specific frame or entire page)
    #[serde(default)]
    pub scope: ExtractionScope,
    /// Maximum results per query
    #[serde(default = "default_max_results")]
    pub max_results: usize,
}

fn default_max_results() -> usize {
    100
}

/// BROWSER.SCREENSHOT - Capture screenshots
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ScreenshotParams {
    /// Screenshot type
    #[serde(default)]
    pub target: ScreenshotTarget,
    /// Image format
    #[serde(default)]
    pub format: ImageFormat,
    /// Image quality (0-100, for JPEG)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<u8>,
    /// Clip region (for element screenshots)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clip: Option<ClipRegion>,
}

/// BROWSER.WAIT - Wait for conditions
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WaitParams {
    /// Conditions to wait for (OR logic - any one satisfies)
    pub conditions: Vec<WaitCondition>,
    /// Timeout (ms)
    #[serde(default = "default_wait_timeout")]
    pub timeout_ms: u64,
}

fn default_wait_timeout() -> u64 {
    30000
}

// ============================================================================
// Types
// ============================================================================

/// Browser action types
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BrowserAction {
    /// Click on element
    Click {
        target: Target,
        #[serde(default)]
        options: ActionOptions,
    },
    /// Type text into input
    Type {
        target: Target,
        text: String,
        #[serde(default)]
        options: TypeOptions,
    },
    /// Clear input field
    Clear {
        target: Target,
    },
    /// Scroll page or element
    Scroll {
        #[serde(default)]
        target: Option<Target>,
        direction: ScrollDirection,
        amount: u32,
        #[serde(default)]
        unit: ScrollUnit,
    },
    /// Hover over element
    Hover {
        target: Target,
    },
    /// Focus element
    Focus {
        target: Target,
    },
    /// Press key
    Press {
        key: String,
        #[serde(default)]
        modifiers: Vec<KeyModifier>,
    },
    /// Select option in dropdown
    Select {
        target: Target,
        value: String,
    },
}

/// Target specification for element selection
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Target {
    /// CSS selector
    Selector { value: String },
    /// Text content (partial match)
    Text { value: String, #[serde(default)] exact: bool },
    /// ARIA role
    Role { role: String, #[serde(skip_serializing_if = "Option::is_none")] name: Option<String> },
    /// XPath expression
    XPath { value: String },
    /// Coordinates (x, y)
    Coordinates { x: f64, y: f64 },
    /// Element index (for multiple matches)
    Index { selector: String, index: usize },
}

/// Navigation types
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NavigationType {
    Navigate,
    Back,
    Forward,
    Reload,
}

/// Wait conditions
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WaitCondition {
    Time { ms: u64 },
    Element { target: Target, #[serde(default)] state: ElementState },
    Navigation,
    NetworkIdle { #[serde(default = "default_idle_ms")] idle_ms: u64 },
    Custom { script: String },
}

fn default_idle_ms() -> u64 {
    500
}

/// Element state for waiting
#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ElementState {
    #[default]
    Visible,
    Hidden,
    Enabled,
    Disabled,
    Attached,
}

/// Extraction queries
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExtractQuery {
    /// Extract text content
    Text { selector: String },
    /// Extract attribute
    Attribute { selector: String, attribute: String },
    /// Extract HTML
    Html { selector: String },
    /// Extract form values
    Form { selector: String },
    /// Extract table as structured data
    Table { selector: String },
    /// Extract links
    Links { #[serde(default)] pattern: Option<String> },
    /// Extract images
    Images { #[serde(default)] selector: Option<String> },
    /// Execute custom JavaScript
    Custom { script: String, #[serde(skip_serializing_if = "Option::is_none")] args: Option<Vec<serde_json::Value>> },
    /// Extract accessibility tree
    AccessibilityTree,
    /// Extract computed styles
    ComputedStyles { selector: String, #[serde(skip_serializing_if = "Option::is_none")] properties: Option<Vec<String>> },
}

/// Extraction scope
#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionScope {
    #[default]
    Page,
    ActiveElement,
    Viewport,
}

/// Screenshot targets
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ScreenshotTarget {
    /// Current viewport
    #[default]
    Viewport,
    /// Full page (entire scrollable area)
    FullPage,
    /// Specific element
    Element { selector: String },
}

/// Image formats
#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ImageFormat {
    #[default]
    Png,
    Jpeg,
    Webp,
}

/// Clip region for screenshots
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ClipRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Scroll directions
#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollDirection {
    Up,
    Down,
    Left,
    Right,
    ToTop,
    ToBottom,
    ToPosition { x: f64, y: f64 },
}

/// Scroll units
#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ScrollUnit {
    #[default]
    Pixels,
    Percentage,
    Lines,
    Pages,
}

/// Action options
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ActionOptions {
    /// Force action even if element not visible
    #[serde(default)]
    pub force: bool,
    /// Delay before action (ms)
    #[serde(default)]
    pub delay_ms: u64,
    /// Timeout for finding element (ms)
    #[serde(default)]
    pub timeout_ms: u64,
}

/// Type-specific options
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct TypeOptions {
    #[serde(flatten)]
    pub base: ActionOptions,
    /// Clear field before typing
    #[serde(default = "default_true")]
    pub clear: bool,
    /// Submit form after typing (press Enter)
    #[serde(default)]
    pub submit: bool,
}

fn default_true() -> bool {
    true
}

/// Key modifiers
#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KeyModifier {
    Control,
    Alt,
    Shift,
    Meta,
}

// ============================================================================
// Response Types
// ============================================================================

/// Response from BROWSER.GET_CONTEXT
#[derive(Debug, Clone, Serialize)]
pub struct ContextResponse {
    pub tab_id: String,
    pub url: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessibility_tree: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_log: Option<Vec<NetworkEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookies: Option<Vec<CookieInfo>>,
    pub viewport: ViewportInfo,
}

/// Network log entry
#[derive(Debug, Clone, Serialize)]
pub struct NetworkEntry {
    pub url: String,
    pub method: String,
    pub status: u16,
    pub timestamp: u64,
}

/// Cookie information
#[derive(Debug, Clone, Serialize)]
pub struct CookieInfo {
    pub name: String,
    pub value: String,
    pub domain: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// Viewport information
#[derive(Debug, Clone, Serialize)]
pub struct ViewportInfo {
    pub width: u32,
    pub height: u32,
    pub device_pixel_ratio: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
}

/// Response from BROWSER.ACT
#[derive(Debug, Clone, Serialize)]
pub struct ActResponse {
    pub success: bool,
    pub actions_completed: usize,
    pub actions_total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub results: Vec<ActionResult>,
}

/// Individual action result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub action_index: usize,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub element_found: Option<bool>,
}

/// Response from BROWSER.NAV
#[derive(Debug, Clone, Serialize)]
pub struct NavResponse {
    pub success: bool,
    pub url: String,
    pub title: String,
    pub navigation_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Response from BROWSER.EXTRACT
#[derive(Debug, Clone, Serialize)]
pub struct ExtractResponse {
    pub results: HashMap<String, ExtractResult>,
    pub extraction_time_ms: u64,
}

/// Extraction result for single query
#[derive(Debug, Clone, Serialize)]
pub struct ExtractResult {
    pub query_type: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub count: usize,
}

/// Response from BROWSER.SCREENSHOT
#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotResponse {
    pub success: bool,
    pub format: String,
    pub width: u32,
    pub height: u32,
    /// Base64-encoded image data
    pub data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Response from BROWSER.WAIT
#[derive(Debug, Clone, Serialize)]
pub struct WaitResponse {
    pub success: bool,
    pub condition_met: Option<String>,
    pub wait_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ============================================================================
// Tool Names
// ============================================================================

pub const TOOL_GET_CONTEXT: &str = "BROWSER.GET_CONTEXT";
pub const TOOL_ACT: &str = "BROWSER.ACT";
pub const TOOL_NAV: &str = "BROWSER.NAV";
pub const TOOL_EXTRACT: &str = "BROWSER.EXTRACT";
pub const TOOL_SCREENSHOT: &str = "BROWSER.SCREENSHOT";
pub const TOOL_WAIT: &str = "BROWSER.WAIT";

/// All browser tool names
pub fn all_tool_names() -> Vec<&'static str> {
    vec![
        TOOL_GET_CONTEXT,
        TOOL_ACT,
        TOOL_NAV,
        TOOL_EXTRACT,
        TOOL_SCREENSHOT,
        TOOL_WAIT,
    ]
}
