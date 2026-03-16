// 3-adapters/rust/skills/src/browser_use/mod.rs
//! Browser-Use Skill Implementation
//!
//! Provides native browser automation skills with recording capability:
//! - `browser.use`: Navigation and interaction
//! - `browser.record_session`: GIF/video recording of browser sessions
//! - `browser.stop_recording`: Stop recording and save

pub mod recorder;

use crate::{
    Skill, SkillManifest, SkillIO, SkillRuntime, RuntimeMode, SkillTimeouts,
    ResourceHints, SkillEnvironment, Environment, NetworkAccess, FilesystemAccess,
    SafetyTier, PublisherInfo, SignatureInfo, SkillWorkflow, WorkflowNode, WorkflowPhase,
    NodeConstraints, ToolDefinition,
};
use recorder::{ScreenRecorder, RecordingConfig, RecordingFormat as RecFormat};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use a2rchitech_tools_gateway::{ToolType, ResourceLimits};

// ============================================================================
// Tool Definitions
// ============================================================================

fn create_browser_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            id: "browser.navigate".to_string(),
            name: "Browser Navigate".to_string(),
            description: "Navigate browser to a URL".to_string(),
            tool_type: ToolType::Local,
            command: "browser.navigate".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to navigate to"},
                    "session_id": {"type": "string", "description": "Browser session ID"}
                },
                "required": ["url"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "title": {"type": "string"},
                    "url": {"type": "string"}
                }
            }),
            side_effects: vec!["network".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("500m".to_string()),
                memory: Some("512Mi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::Unrestricted,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 30,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.click".to_string(),
            name: "Browser Click".to_string(),
            description: "Click an element in the browser".to_string(),
            tool_type: ToolType::Local,
            command: "browser.click".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector"},
                    "session_id": {"type": "string", "description": "Browser session ID"}
                },
                "required": ["selector"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"}
                }
            }),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("200m".to_string()),
                memory: Some("256Mi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 10,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.screenshot".to_string(),
            name: "Browser Screenshot".to_string(),
            description: "Take a screenshot of the browser".to_string(),
            tool_type: ToolType::Local,
            command: "browser.screenshot".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "Browser session ID"},
                    "full_page": {"type": "boolean", "description": "Capture full page"}
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "image_url": {"type": "string"},
                    "format": {"type": "string"}
                }
            }),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("500m".to_string()),
                memory: Some("512Mi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::Allowlist(vec!["./screenshots".to_string()]),
                time_limit: 15,
            },
            subprocess: None,
        },
    ]
}

fn create_browser_recording_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            id: "browser.start_recording".to_string(),
            name: "Browser Start Recording".to_string(),
            description: "Start recording browser session as GIF/video for review".to_string(),
            tool_type: ToolType::Local,
            command: "browser.start_recording".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "Browser session ID"},
                    "format": {"type": "string", "enum": ["gif", "webm", "mp4"], "default": "gif"},
                    "fps": {"type": "integer", "default": 10, "description": "Frames per second"},
                    "quality": {"type": "integer", "default": 80, "description": "Quality 1-100"},
                    "max_duration_secs": {"type": "integer", "description": "Max recording duration"}
                }
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "session_id": {"type": "string"},
                    "status": {"type": "string"},
                    "format": {"type": "string"}
                },
                "required": ["recording_id", "session_id", "status"]
            }),
            side_effects: vec!["filesystem".to_string(), "screen_capture".to_string()],
            idempotency_behavior: "not_idempotent".to_string(),
            retryable: false,
            failure_classification: "permanent".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("1000m".to_string()),
                memory: Some("1Gi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                time_limit: 300,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.stop_recording".to_string(),
            name: "Browser Stop Recording".to_string(),
            description: "Stop recording and save GIF/video output".to_string(),
            tool_type: ToolType::Local,
            command: "browser.stop_recording".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string", "description": "Recording session ID"},
                    "save": {"type": "boolean", "default": true, "description": "Save to file"}
                },
                "required": ["recording_id"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "success": {"type": "boolean"},
                    "file_path": {"type": "string"},
                    "file_size_bytes": {"type": "integer"},
                    "duration_secs": {"type": "number"},
                    "frames_captured": {"type": "integer"}
                },
                "required": ["recording_id", "success"]
            }),
            side_effects: vec!["filesystem".to_string()],
            idempotency_behavior: "not_idempotent".to_string(),
            retryable: false,
            failure_classification: "permanent".to_string(),
            safety_tier: SafetyTier::T1,
            resource_limits: ResourceLimits {
                cpu: Some("2000m".to_string()),
                memory: Some("2Gi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::Allowlist(vec!["./recordings".to_string()]),
                time_limit: 120,
            },
            subprocess: None,
        },
        ToolDefinition {
            id: "browser.recording_status".to_string(),
            name: "Browser Recording Status".to_string(),
            description: "Get status of active recording".to_string(),
            tool_type: ToolType::Local,
            command: "browser.recording_status".to_string(),
            endpoint: "".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string", "description": "Recording session ID"}
                },
                "required": ["recording_id"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "recording_id": {"type": "string"},
                    "is_recording": {"type": "boolean"},
                    "frames_captured": {"type": "integer"},
                    "duration_secs": {"type": "number"},
                    "format": {"type": "string"}
                }
            }),
            side_effects: vec![],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: ResourceLimits {
                cpu: Some("100m".to_string()),
                memory: Some("128Mi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::None,
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 5,
            },
            subprocess: None,
        },
    ]
}

// ============================================================================
// Browser Use Skill (Navigation & Interaction)
// ============================================================================

/// Input for browser navigation and interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserUseInput {
    pub action: BrowserAction,
    pub session_id: Option<String>,
    pub url: Option<String>,
    pub selector: Option<String>,
    pub value: Option<String>,
    pub options: Option<BrowserOptions>,
}

/// Browser actions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BrowserAction {
    Navigate { url: String },
    Click { selector: String },
    Type { selector: String, text: String },
    Scroll { direction: ScrollDirection, amount: Option<u32> },
    Screenshot { full_page: Option<bool> },
    StartRecording { format: RecordingFormat, fps: Option<u32> },
    StopRecording,
    GetState,
}

/// Scroll direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScrollDirection {
    Up,
    Down,
    Left,
    Right,
}

/// Recording format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingFormat {
    Gif,
    Webm,
    Mp4,
}

/// Browser options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserOptions {
    pub headless: Option<bool>,
    pub viewport_width: Option<u32>,
    pub viewport_height: Option<u32>,
    pub user_agent: Option<String>,
    pub timeout_ms: Option<u64>,
}

/// Output from browser operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserUseOutput {
    pub success: bool,
    pub session_id: Option<String>,
    pub result: Option<serde_json::Value>,
    pub recording_id: Option<String>,
    pub error: Option<String>,
}

// ============================================================================
// Browser Record Session Skill
// ============================================================================

/// Input for starting a recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordSessionInput {
    pub session_id: Option<String>,
    pub format: RecordingFormat,
    pub fps: Option<u32>,
    pub quality: Option<u32>,
    pub max_duration_secs: Option<u64>,
    pub output_path: Option<String>,
}

/// Output from recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordSessionOutput {
    pub recording_id: String,
    pub session_id: String,
    pub format: String,
    pub status: String,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub duration_secs: Option<f64>,
    pub frames_captured: Option<u32>,
}

// ============================================================================
// Stop Recording Skill
// ============================================================================

/// Input for stopping a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopRecordingInput {
    pub recording_id: String,
    pub save: Option<bool>,
}

/// Output from stopping a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopRecordingOutput {
    pub recording_id: String,
    pub success: bool,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub duration_secs: Option<f64>,
    pub frames_captured: Option<u32>,
    pub error: Option<String>,
}

// ============================================================================
// Skill Manifests
// ============================================================================

/// Create the browser.use skill
pub fn create_browser_use_skill() -> Skill {
    let manifest = SkillManifest {
        id: "browser.use".to_string(),
        name: "Browser Use".to_string(),
        version: "1.0.0".to_string(),
        description: "Native browser automation for navigation, interaction, and screen recording".to_string(),
        author: "A2rchitech".to_string(),
        license: "MIT".to_string(),
        tags: vec![
            "browser".to_string(),
            "automation".to_string(),
            "navigation".to_string(),
            "recording".to_string(),
        ],
        homepage: Some("https://a2rchitech.com".to_string()),
        repository: Some("https://github.com/a2rchitech/a2rchitech".to_string()),

        inputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "action": {
                        "type": "object",
                        "description": "Browser action to perform"
                    },
                    "session_id": {
                        "type": "string",
                        "description": "Browser session ID"
                    },
                    "url": {
                        "type": "string",
                        "description": "URL to navigate to"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for element interaction"
                    },
                    "value": {
                        "type": "string",
                        "description": "Value to type or set"
                    },
                    "options": {
                        "type": "object",
                        "description": "Browser options"
                    }
                },
                "required": ["action"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "action": { "type": "navigate", "url": "https://example.com" }
                }),
                serde_json::json!({
                    "action": { "type": "click", "selector": "#login-button" }
                }),
                serde_json::json!({
                    "action": { "type": "start_recording", "format": "gif", "fps": 10 }
                }),
            ]),
        },

        outputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "session_id": { "type": "string" },
                    "result": { "type": "object" },
                    "recording_id": { "type": "string" },
                    "error": { "type": "string" }
                },
                "required": ["success"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "success": true,
                    "session_id": "browser_sess_abc123",
                    "result": { "url": "https://example.com", "title": "Example" }
                }),
            ]),
        },

        runtime: SkillRuntime {
            mode: RuntimeMode::Host,
            timeouts: SkillTimeouts {
                per_step: Some(60),
                total: Some(600),
            },
            resources: Some(ResourceHints {
                cpu: Some("1000m".to_string()),
                gpu: Some("0".to_string()),
                memory: Some("2Gi".to_string()),
            }),
        },

        environment: SkillEnvironment {
            allowed_envs: vec![Environment::Dev, Environment::Stage, Environment::Prod],
            network: NetworkAccess::Unrestricted,
            filesystem: FilesystemAccess::Allowlist(vec![
                "/tmp".to_string(),
                "./recordings".to_string(),
                "./artifacts".to_string(),
            ]),
        },

        side_effects: vec!["network".to_string(), "filesystem".to_string()],

        risk_tier: SafetyTier::T1,
        required_permissions: vec!["browser.control".to_string()],
        requires_policy_gate: false,
        publisher: PublisherInfo {
            publisher_id: "a2rchitech.core".to_string(),
            public_key_id: "pk_a2rchitech_core_1".to_string(),
        },
        signature: SignatureInfo {
            manifest_sig: "".to_string(),
            bundle_hash: "".to_string(),
        },
    };

    Skill {
        manifest,
        workflow: create_browser_use_workflow(),
        tools: create_browser_tools(),
        human_routing: "Browser automation skill for navigation, interaction and screen recording".to_string(),
    }
}

/// Create the browser.record_session skill
pub fn create_browser_record_session_skill() -> Skill {
    let manifest = SkillManifest {
        id: "browser.record_session".to_string(),
        name: "Browser Record Session".to_string(),
        version: "1.0.0".to_string(),
        description: "Record browser session as GIF or video for review and analysis".to_string(),
        author: "A2rchitech".to_string(),
        license: "MIT".to_string(),
        tags: vec![
            "browser".to_string(),
            "recording".to_string(),
            "gif".to_string(),
            "video".to_string(),
            "capture".to_string(),
        ],
        homepage: Some("https://a2rchitech.com".to_string()),
        repository: Some("https://github.com/a2rchitech/a2rchitech".to_string()),

        inputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "session_id": {
                        "type": "string",
                        "description": "Browser session ID to record"
                    },
                    "format": {
                        "type": "string",
                        "enum": ["gif", "webm", "mp4"],
                        "description": "Recording format"
                    },
                    "fps": {
                        "type": "integer",
                        "description": "Frames per second (default: 10)"
                    },
                    "quality": {
                        "type": "integer",
                        "description": "Quality level 1-100 (default: 80)"
                    },
                    "max_duration_secs": {
                        "type": "integer",
                        "description": "Maximum recording duration"
                    },
                    "output_path": {
                        "type": "string",
                        "description": "Output file path"
                    }
                },
                "required": ["format"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "format": "gif",
                    "fps": 10,
                    "quality": 80
                }),
                serde_json::json!({
                    "format": "webm",
                    "fps": 30,
                    "quality": 90,
                    "output_path": "./recordings/session.webm"
                }),
            ]),
        },

        outputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "recording_id": { "type": "string" },
                    "session_id": { "type": "string" },
                    "format": { "type": "string" },
                    "status": { "type": "string" },
                    "file_path": { "type": "string" },
                    "file_size_bytes": { "type": "integer" },
                    "duration_secs": { "type": "number" },
                    "frames_captured": { "type": "integer" }
                },
                "required": ["recording_id", "session_id", "format", "status"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "recording_id": "rec_abc123",
                    "session_id": "browser_sess_xyz",
                    "format": "gif",
                    "status": "recording",
                    "frames_captured": 0
                }),
            ]),
        },

        runtime: SkillRuntime {
            mode: RuntimeMode::Host,
            timeouts: SkillTimeouts {
                per_step: Some(300),
                total: Some(1800),
            },
            resources: Some(ResourceHints {
                cpu: Some("2000m".to_string()),
                gpu: Some("1".to_string()),
                memory: Some("4Gi".to_string()),
            }),
        },

        environment: SkillEnvironment {
            allowed_envs: vec![Environment::Dev, Environment::Stage, Environment::Prod],
            network: NetworkAccess::None,
            filesystem: FilesystemAccess::Allowlist(vec![
                "/tmp".to_string(),
                "./recordings".to_string(),
                "./artifacts".to_string(),
                "*.gif".to_string(),
                "*.webm".to_string(),
                "*.mp4".to_string(),
            ]),
        },

        side_effects: vec!["filesystem".to_string(), "screen_capture".to_string()],

        risk_tier: SafetyTier::T1,
        required_permissions: vec!["browser.record".to_string(), "screen.capture".to_string()],
        requires_policy_gate: false,
        publisher: PublisherInfo {
            publisher_id: "a2rchitech.core".to_string(),
            public_key_id: "pk_a2rchitech_core_1".to_string(),
        },
        signature: SignatureInfo {
            manifest_sig: "".to_string(),
            bundle_hash: "".to_string(),
        },
    };

    Skill {
        manifest,
        workflow: create_record_session_workflow(),
        tools: create_browser_recording_tools(),
        human_routing: "Browser session recording skill for capturing GIF/video of browser activity".to_string(),
    }
}

/// Create the browser.stop_recording skill
pub fn create_browser_stop_recording_skill() -> Skill {
    let manifest = SkillManifest {
        id: "browser.stop_recording".to_string(),
        name: "Browser Stop Recording".to_string(),
        version: "1.0.0".to_string(),
        description: "Stop an active browser recording session and save the output".to_string(),
        author: "A2rchitech".to_string(),
        license: "MIT".to_string(),
        tags: vec![
            "browser".to_string(),
            "recording".to_string(),
            "stop".to_string(),
        ],
        homepage: Some("https://a2rchitech.com".to_string()),
        repository: Some("https://github.com/a2rchitech/a2rchitech".to_string()),

        inputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "recording_id": {
                        "type": "string",
                        "description": "Recording session ID to stop"
                    },
                    "save": {
                        "type": "boolean",
                        "description": "Whether to save the recording (default: true)"
                    }
                },
                "required": ["recording_id"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "recording_id": "rec_abc123",
                    "save": true
                }),
            ]),
        },

        outputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "recording_id": { "type": "string" },
                    "success": { "type": "boolean" },
                    "file_path": { "type": "string" },
                    "file_size_bytes": { "type": "integer" },
                    "duration_secs": { "type": "number" },
                    "frames_captured": { "type": "integer" },
                    "error": { "type": "string" }
                },
                "required": ["recording_id", "success"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "recording_id": "rec_abc123",
                    "success": true,
                    "file_path": "./recordings/rec_abc123.gif",
                    "file_size_bytes": 1024000,
                    "duration_secs": 15.5,
                    "frames_captured": 155
                }),
            ]),
        },

        runtime: SkillRuntime {
            mode: RuntimeMode::Host,
            timeouts: SkillTimeouts {
                per_step: Some(30),
                total: Some(60),
            },
            resources: Some(ResourceHints {
                cpu: Some("1000m".to_string()),
                gpu: Some("0".to_string()),
                memory: Some("1Gi".to_string()),
            }),
        },

        environment: SkillEnvironment {
            allowed_envs: vec![Environment::Dev, Environment::Stage, Environment::Prod],
            network: NetworkAccess::None,
            filesystem: FilesystemAccess::Allowlist(vec![
                "/tmp".to_string(),
                "./recordings".to_string(),
                "./artifacts".to_string(),
            ]),
        },

        side_effects: vec!["filesystem".to_string()],

        risk_tier: SafetyTier::T1,
        required_permissions: vec!["browser.record".to_string()],
        requires_policy_gate: false,
        publisher: PublisherInfo {
            publisher_id: "a2rchitech.core".to_string(),
            public_key_id: "pk_a2rchitech_core_1".to_string(),
        },
        signature: SignatureInfo {
            manifest_sig: "".to_string(),
            bundle_hash: "".to_string(),
        },
    };

    Skill {
        manifest,
        workflow: create_stop_recording_workflow(),
        tools: create_browser_recording_tools(),
        human_routing: "Stop browser recording and save the output file".to_string(),
    }
}

// ============================================================================
// Workflow Definitions
// ============================================================================

fn create_browser_use_workflow() -> crate::SkillWorkflow {
    crate::SkillWorkflow {
        nodes: vec![
            crate::WorkflowNode {
                id: "validate_input".to_string(),
                name: "Validate Input".to_string(),
                phase: crate::WorkflowPhase::Observe,
                tool_binding: "browser.validate".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
            crate::WorkflowNode {
                id: "execute_action".to_string(),
                name: "Execute Browser Action".to_string(),
                phase: crate::WorkflowPhase::Execute,
                tool_binding: "browser.execute".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
        ],
        edges: vec![],
        per_node_constraints: HashMap::new(),
        artifact_outputs: vec![],
    }
}

fn create_record_session_workflow() -> crate::SkillWorkflow {
    crate::SkillWorkflow {
        nodes: vec![
            crate::WorkflowNode {
                id: "init_recording".to_string(),
                name: "Initialize Recording".to_string(),
                phase: crate::WorkflowPhase::Execute,
                tool_binding: "browser.recording.init".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
            crate::WorkflowNode {
                id: "capture_frames".to_string(),
                name: "Capture Frames".to_string(),
                phase: crate::WorkflowPhase::Execute,
                tool_binding: "browser.recording.capture".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
        ],
        edges: vec![],
        per_node_constraints: HashMap::new(),
        artifact_outputs: vec![],
    }
}

fn create_stop_recording_workflow() -> crate::SkillWorkflow {
    crate::SkillWorkflow {
        nodes: vec![
            crate::WorkflowNode {
                id: "stop_recording".to_string(),
                name: "Stop Recording".to_string(),
                phase: crate::WorkflowPhase::Execute,
                tool_binding: "browser.recording.stop".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
            crate::WorkflowNode {
                id: "encode_output".to_string(),
                name: "Encode Output".to_string(),
                phase: crate::WorkflowPhase::Execute,
                tool_binding: "browser.recording.encode".to_string(),
                inputs: vec![],
                outputs: vec![],
            },
        ],
        edges: vec![],
        per_node_constraints: HashMap::new(),
        artifact_outputs: vec![],
    }
}

// ============================================================================
// Module Exports
// ============================================================================

pub fn create_all_browser_skills() -> Vec<Skill> {
    vec![
        create_browser_use_skill(),
        create_browser_record_session_skill(),
        create_browser_stop_recording_skill(),
    ]
}
