// crates/skills/src/ui_tars/mod.rs
//! UI-TARS Proposal Skill Implementation
//! 
//! Implements the `model.ui_tars.propose` skill that analyzes screenshots
//! and generates action proposals for GUI automation.

use crate::{Skill, SkillManifest, SkillIO, SkillRuntime, RuntimeMode, SkillTimeouts, ResourceHints, SkillEnvironment, Environment, NetworkAccess, FilesystemAccess, SafetyTier, PublisherInfo, SignatureInfo, SkillWorkflow, WorkflowNode, WorkflowPhase, NodeConstraints, ToolDefinition};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Input structure for the UI-TARS proposal skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiTarsProposeInput {
    pub screenshot_id: String,   // From gui.observe
    pub task: String,            // Natural language goal
    pub history: Option<Vec<String>>, // Summary of previous steps
}

/// Output structure for the UI-TARS proposal skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiTarsProposeOutput {
    pub proposals: Vec<ActionProposal>,
    pub confidence: f64,         // 0.0 to 1.0
    pub reasoning: String,       // Chain-of-thought explanation
}

/// Represents a proposed action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionProposal {
    #[serde(rename = "type")]
    pub action_type: ActionType,
    pub params: std::collections::HashMap<String, serde_json::Value>, // {x: 100, y: 200} or {text: "hello"}
    pub description: String,    // Human-readable summary
}

/// Possible action types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ActionType {
    Click,
    Type,
    Scroll,
    Wait,
    Done,
}

/// Creates the UI-TARS proposal skill
pub fn create_ui_tars_propose_skill() -> Skill {
    let manifest = SkillManifest {
        id: "model.ui_tars.propose".to_string(),
        name: "UI-TARS Propose".to_string(),
        version: "1.0.0".to_string(),
        description: "Vision-Language Model that proposes GUI actions based on screenshots".to_string(),
        author: "A2rchitech".to_string(),
        license: "MIT".to_string(),
        tags: vec!["gui".to_string(), "automation".to_string(), "vision".to_string(), "proposal".to_string()],
        homepage: Some("https://a2rchitech.com".to_string()),
        repository: Some("https://github.com/a2rchitech/a2rchitech".to_string()),

        inputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "screenshot_id": {"type": "string", "description": "ID of the screenshot from gui.observe"},
                    "task": {"type": "string", "description": "Natural language goal"},
                    "history": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Previous steps summary"
                    }
                },
                "required": ["screenshot_id", "task"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "screenshot_id": "scr_abc123",
                    "task": "Click the login button",
                    "history": ["Opened the homepage"]
                })
            ]),
        },

        outputs: SkillIO {
            schema: r#"{
                "type": "object",
                "properties": {
                    "proposals": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["click", "type", "scroll", "wait", "done"]},
                                "params": {"type": "object"},
                                "description": {"type": "string"}
                            },
                            "required": ["type", "params", "description"]
                        }
                    },
                    "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "reasoning": {"type": "string"}
                },
                "required": ["proposals", "confidence", "reasoning"]
            }"#.to_string(),
            examples: Some(vec![
                serde_json::json!({
                    "proposals": [{
                        "type": "click",
                        "params": {"x": 100, "y": 200},
                        "description": "Click the login button at coordinates (100, 200)"
                    }],
                    "confidence": 0.95,
                    "reasoning": "The login button is clearly visible in the center of the screen"
                })
            ]),
        },

        runtime: SkillRuntime {
            mode: RuntimeMode::Sandbox,
            timeouts: SkillTimeouts {
                per_step: Some(30), // 30 seconds per step
                total: Some(120),   // 2 minutes total
            },
            resources: Some(ResourceHints {
                cpu: Some("2000m".to_string()), // 2 CPUs
                gpu: Some("1".to_string()),     // 1 GPU
                memory: Some("4Gi".to_string()), // 4GB RAM
            }),
        },

        environment: SkillEnvironment {
            allowed_envs: vec![Environment::Dev, Environment::Stage, Environment::Prod],
            network: NetworkAccess::DomainAllowlist(vec![
                "api.a2rchitech.com".to_string(),
                "models.a2rchitech.com".to_string(),
            ]),
            filesystem: FilesystemAccess::Allowlist(vec![
                "/tmp".to_string(),
                "/artifacts".to_string(),
            ]),
        },

        side_effects: vec!["read".to_string()], // Read-only (doesn't modify GUI)

        risk_tier: SafetyTier::T0, // Lowest risk tier (read-only analysis)
        required_permissions: vec!["model.inference".to_string()],
        requires_policy_gate: false,
        publisher: PublisherInfo {
            publisher_id: "a2rchitech.core".to_string(),
            public_key_id: "pk_a2rchitech_core_1".to_string(),
        },
        signature: SignatureInfo {
            manifest_sig: "placeholder_signature".to_string(),
            bundle_hash: "placeholder_bundle_hash".to_string(),
        },
    };

    // Define the workflow for the skill
    let workflow = SkillWorkflow {
        nodes: vec![
            WorkflowNode {
                id: "analyze_screenshot".to_string(),
                name: "Analyze Screenshot".to_string(),
                phase: WorkflowPhase::Think,
                tool_binding: "ui_tars_inference".to_string(),
                inputs: vec!["screenshot_id".to_string(), "task".to_string()],
                outputs: vec!["proposals".to_string()],
            }
        ],
        edges: vec![],
        per_node_constraints: {
            let mut map = HashMap::new();
            map.insert(
                "analyze_screenshot".to_string(),
                NodeConstraints {
                    time_budget: Some(60), // 60 seconds
                    resource_limits: Some(ResourceHints {
                        cpu: Some("1000m".to_string()),
                        gpu: Some("1".to_string()),
                        memory: Some("2Gi".to_string()),
                    }),
                    allowed_tools: vec!["ui_tars_inference".to_string()],
                },
            );
            map
        },
        artifact_outputs: vec!["proposals".to_string(), "reasoning".to_string()],
    };

    // Define the tools used by this skill
    let tools = vec![
        ToolDefinition {
            id: "ui_tars_inference".to_string(),
            name: "UI-TARS Inference".to_string(),
            description: "Runs UI-TARS model inference on screenshot to generate action proposals".to_string(),
            tool_type: a2rchitech_tools_gateway::ToolType::Http,
            command: "".to_string(),
            endpoint: "https://api.a2rchitech.com/v1/ui-tars".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "screenshot_id": {"type": "string"},
                    "task": {"type": "string"},
                    "history": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "required": ["screenshot_id", "task"]
            }),
            output_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "proposals": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "params": {"type": "object"},
                                "description": {"type": "string"}
                            }
                        }
                    },
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"}
                }
            }),
            side_effects: vec!["read".to_string()],
            idempotency_behavior: "idempotent".to_string(),
            retryable: true,
            failure_classification: "transient".to_string(),
            safety_tier: SafetyTier::T0,
            resource_limits: a2rchitech_tools_gateway::ResourceLimits {
                cpu: Some("500m".to_string()),
                memory: Some("1Gi".to_string()),
                network: a2rchitech_tools_gateway::NetworkAccess::DomainAllowlist(vec![
                    "api.a2rchitech.com".to_string()
                ]),
                filesystem: a2rchitech_tools_gateway::FilesystemAccess::None,
                time_limit: 60, // 60 seconds
            },
            subprocess: None,
        }
    ];

    // Human routing information
    let human_routing = r#"
# UI-TARS Propose Skill

This skill uses a vision-language model (UI-TARS) to analyze GUI screenshots and propose actions.

## Purpose
- Analyze visual interface elements
- Generate action proposals (click, type, scroll, etc.)
- Provide reasoning for proposed actions
- Enable GUI automation without direct execution

## Usage
The skill takes a screenshot ID and a natural language task, then returns a list of proposed actions with confidence scores.

## Constraints
- Pure function (no side effects)
- Requires valid screenshot ID
- Limited to read-only analysis
- Runs in sandboxed environment
    "#.to_string();

    Skill {
        manifest,
        workflow,
        tools,
        human_routing,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_ui_tars_propose_skill() {
        let skill = create_ui_tars_propose_skill();

        assert_eq!(skill.manifest.id, "model.ui_tars.propose");
        assert_eq!(skill.manifest.name, "UI-TARS Propose");
        assert_eq!(skill.manifest.version, "1.0.0");
        // Note: We can't directly compare SafetyTier since it doesn't implement PartialEq

        // Verify the tool exists
        assert!(!skill.tools.is_empty());
        let tool = &skill.tools[0];
        assert_eq!(tool.id, "ui_tars_inference");
    }

    #[test]
    fn test_action_proposal_serialization() {
        let proposal = ActionProposal {
            action_type: ActionType::Click,
            params: {
                let mut map = std::collections::HashMap::new();
                map.insert("x".to_string(), serde_json::json!(100));
                map.insert("y".to_string(), serde_json::json!(200));
                map
            },
            description: "Click the login button".to_string(),
        };

        let serialized = serde_json::to_string(&proposal).unwrap();
        let deserialized: ActionProposal = serde_json::from_str(&serialized).unwrap();

        assert_eq!(deserialized.action_type, ActionType::Click);
        assert_eq!(deserialized.description, "Click the login button");
        assert_eq!(deserialized.params.get("x").unwrap(), &serde_json::json!(100));
        assert_eq!(deserialized.params.get("y").unwrap(), &serde_json::json!(200));
    }
}
