use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::templates::{FrameworkSpec, FrameworkStatus, CapsuleTemplate, CanvasSpec, ActionSpec, ToolRequirementSpec};

// Dynamic framework factory for runtime creation of specialized frameworks
pub fn create_dynamic_framework(
    framework_id: String,
    framework_type: String,
    config: Option<serde_json::Value>,
) -> FrameworkSpec {
    FrameworkSpec {
        framework_id,
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: format!("{}_capsule", framework_type),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "dynamic_view".to_string(),
                    title: format!("{} Workspace", framework_type).to_string(),
                    initial_state: config.clone(),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "configure".to_string(), label: "Configure".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "export".to_string(), label: "Export Config".to_string(), policy: Some("read".to_string()) }
                    ]),
                    layout: None,
                }
            ],
        },
        required_tools: vec![],
        directives: vec![framework_type.clone()],
        intent_patterns: vec![framework_type.clone()],
        eval_suite: vec![format!("{}_eval", framework_type)],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "framework_type": {
                    "type": "string",
                    "default": framework_type
                },
                "custom_config": {
                    "type": "object",
                    "description": "Custom configuration for the dynamic framework"
                }
            }
        })),
        runtime_params: config.map(|c| HashMap::from([("custom_config".to_string(), c)])),
    }
}