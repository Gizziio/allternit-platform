use serde::{Deserialize, Serialize};
use std::collections::HashMap;
pub use a2rchitech_kernel_contracts::{
    FrameworkSpec, FrameworkStatus, CapsuleTemplate, CanvasSpec, LayoutSpec, 
    SectionSpec, ColumnSpec, ActionSpec, ToolRequirementSpec
};

pub fn create_workorder_detail_view(context: serde_json::Value) -> CanvasSpec {
    CanvasSpec {
        view_type: "record_view".to_string(),
        title: format!("Work Order {}", context["id"].as_str().unwrap_or("Unknown")),
        initial_state: Some(context),
        columns: None,
        actions: Some(vec![
            ActionSpec { id: "edit".to_string(), label: "Edit Record".to_string(), policy: Some("write".to_string()) },
            ActionSpec { id: "escalate".to_string(), label: "Escalate".to_string(), policy: Some("write".to_string()) }
        ]),
        layout: Some(LayoutSpec {
            sections: vec![
                SectionSpec {
                    title: "General Info".to_string(),
                    fields: vec!["id".to_string(), "site".to_string(), "priority".to_string(), "status".to_string()],
                }
            ]
        }),
    }
}

pub fn get_default_frameworks() -> Vec<FrameworkSpec> {
    vec![
        create_search_framework(),
        create_note_framework(),
        create_home_framework(),
        create_workorder_framework(),
        create_trip_planner_framework(),
        create_diff_review_framework(),
        create_research_synthesis_framework(),
        create_generic_framework(),
    ]
}

fn create_workorder_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_workorder".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "data_capsule".to_string(),
            default_canvases: vec![CanvasSpec {
                view_type: "table_view".to_string(),
                title: "Work Orders".to_string(),
                initial_state: Some(serde_json::json!({
                    "data": [
                        {"id": "WO-101", "site": "Site A", "priority": "High", "status": "Open"},
                        {"id": "WO-102", "site": "Site B", "priority": "Low", "status": "Closed"}
                    ]
                })),
                columns: Some(vec![
                    ColumnSpec { field: "id".to_string(), label: "ID".to_string(), r#type: Some("text".to_string()) },
                    ColumnSpec { field: "site".to_string(), label: "Site".to_string(), r#type: Some("text".to_string()) },
                    ColumnSpec { field: "priority".to_string(), label: "Priority".to_string(), r#type: Some("text".to_string()) },
                    ColumnSpec { field: "status".to_string(), label: "Status".to_string(), r#type: Some("status".to_string()) },
                ]),
                actions: Some(vec![
                    ActionSpec { id: "escalate".to_string(), label: "Escalate".to_string(), policy: Some("write".to_string()) },
                    ActionSpec { id: "close".to_string(), label: "Close".to_string(), policy: Some("write".to_string()) }
                ]),
                layout: None,
            }],
        },
        required_tools: vec![],
        directives: vec!["workorder".to_string(), "wo".to_string()],
        intent_patterns: vec!["workorder".to_string(), "wo".to_string()],
        eval_suite: vec![],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "default_columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["id", "site", "priority", "status"]
                },
                "enable_workflow": {
                    "type": "boolean",
                    "default": true
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("default_columns".to_string(), serde_json::json!(["id", "site", "priority", "status"])),
            ("enable_workflow".to_string(), serde_json::json!(true)),
        ])),
    }
}

fn create_search_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_search".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "search_capsule".to_string(),
            default_canvases: vec![CanvasSpec {
                view_type: "search_lens".to_string(),
                title: "Search Results".to_string(),
                initial_state: Some(serde_json::json!({
                    "query": "",
                    "results": []
                })),
                columns: None,
                actions: None,
                layout: None,
            }],
        },
        required_tools: vec![ToolRequirementSpec {
            tool_id: "web.search".to_string(),
            scope: "read".to_string(),
        }],
        directives: vec!["search_directive".to_string()],
        intent_patterns: vec!["search".to_string(), "find".to_string()],
        eval_suite: vec!["search_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "max_results": {
                    "type": "integer",
                    "default": 10
                },
                "result_format": {
                    "type": "string",
                    "enum": ["list", "grid", "cards"],
                    "default": "list"
                },
                "enable_filters": {
                    "type": "boolean",
                    "default": true
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("max_results".to_string(), serde_json::json!(10)),
            ("result_format".to_string(), serde_json::json!("list")),
            ("enable_filters".to_string(), serde_json::json!(true)),
        ])),
    }
}

fn create_note_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_note".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "note_capsule".to_string(),
            default_canvases: vec![CanvasSpec {
                view_type: "list_view".to_string(),
                title: "Notes".to_string(),
                initial_state: Some(serde_json::json!({
                    "columns": ["timestamp", "content"],
                    "data": []
                })),
                columns: None,
                actions: None,
                layout: None,
            }],
        },
        required_tools: vec![ToolRequirementSpec {
            tool_id: "note.create".to_string(),
            scope: "write".to_string(),
        }],
        directives: vec!["note_directive".to_string()],
        intent_patterns: vec!["note".to_string(), "remember".to_string()],
        eval_suite: vec!["note_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "editor_type": {
                    "type": "string",
                    "enum": ["plain", "markdown", "rich_text"],
                    "default": "markdown"
                },
                "default_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["personal"]
                },
                "enable_sync": {
                    "type": "boolean",
                    "default": true
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("editor_type".to_string(), serde_json::json!("markdown")),
            ("default_tags".to_string(), serde_json::json!(["personal"])),
            ("enable_sync".to_string(), serde_json::json!(true)),
        ])),
    }
}

fn create_home_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_home".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "home_capsule".to_string(),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "graph_view".to_string(),
                    title: "Intent Graph".to_string(),
                    initial_state: Some(serde_json::json!({
                        "nodes": [
                            { "id": "int_1", "title": "Welcome Intent", "type": "Intent" }
                        ],
                        "edges": []
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
                CanvasSpec {
                    view_type: "timeline_view".to_string(),
                    title: "Recent Activity".to_string(),
                    initial_state: Some(serde_json::json!({
                        "events": []
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
                CanvasSpec {
                    view_type: "list_view".to_string(),
                    title: "Quick Actions".to_string(),
                    initial_state: Some(serde_json::json!({
                        "columns": ["action", "description"],
                        "data": [
                            { "action": "Search", "description": "Search the web" },
                            { "action": "Note", "description": "Take a note" },
                            { "action": "Settings", "description": "Configure preferences" }
                        ]
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
            ],
        },
        required_tools: vec![],
        directives: vec![],
        intent_patterns: vec!["home".to_string(), "dashboard".to_string()],
        eval_suite: vec![],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "dashboard_layout": {
                    "type": "string",
                    "enum": ["compact", "spacious", "minimal"],
                    "default": "spacious"
                },
                "show_widgets": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["intent_graph", "recent_activity", "quick_actions"]
                },
                "default_view": {
                    "type": "string",
                    "default": "intent_graph"
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("dashboard_layout".to_string(), serde_json::json!("spacious")),
            ("show_widgets".to_string(), serde_json::json!(["intent_graph", "recent_activity", "quick_actions"])),
            ("default_view".to_string(), serde_json::json!("intent_graph")),
        ])),
    }
}
fn create_trip_planner_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_trip_planner".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "trip_planner_capsule".to_string(),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "form_view".to_string(),
                    title: "Trip Details".to_string(),
                    initial_state: Some(serde_json::json!({
                        "destination": "",
                        "dates": {"start": "", "end": ""},
                        "budget": 0,
                        "interests": []
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "search_attractions".to_string(), label: "Find Attractions".to_string(), policy: Some("read".to_string()) },
                        ActionSpec { id: "generate_itinerary".to_string(), label: "Generate Itinerary".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: Some(LayoutSpec {
                        sections: vec![
                            SectionSpec {
                                title: "Destination & Dates".to_string(),
                                fields: vec!["destination".to_string(), "dates.start".to_string(), "dates.end".to_string()],
                            },
                            SectionSpec {
                                title: "Preferences".to_string(),
                                fields: vec!["budget".to_string(), "interests".to_string()],
                            }
                        ]
                    }),
                },
                CanvasSpec {
                    view_type: "list_view".to_string(),
                    title: "Attractions".to_string(),
                    initial_state: Some(serde_json::json!({
                        "attractions": []
                    })),
                    columns: Some(vec![
                        ColumnSpec { field: "name".to_string(), label: "Name".to_string(), r#type: Some("text".to_string()) },
                        ColumnSpec { field: "location".to_string(), label: "Location".to_string(), r#type: Some("text".to_string()) },
                        ColumnSpec { field: "rating".to_string(), label: "Rating".to_string(), r#type: Some("number".to_string()) },
                    ]),
                    actions: Some(vec![
                        ActionSpec { id: "add_to_itinerary".to_string(), label: "Add to Itinerary".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                },
                CanvasSpec {
                    view_type: "calendar_view".to_string(),
                    title: "Itinerary".to_string(),
                    initial_state: Some(serde_json::json!({
                        "days": []
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "export_pdf".to_string(), label: "Export PDF".to_string(), policy: Some("read".to_string()) },
                        ActionSpec { id: "share".to_string(), label: "Share".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                }
            ],
        },
        required_tools: vec![
            ToolRequirementSpec {
                tool_id: "web.search".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirementSpec {
                tool_id: "calendar.create".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["plan_trip".to_string(), "travel".to_string(), "itinerary".to_string()],
        intent_patterns: vec!["trip".to_string(), "travel".to_string(), "itinerary".to_string()],
        eval_suite: vec!["trip_planner_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "enable_collaboration": {
                    "type": "boolean",
                    "default": false
                },
                "preferred_transportation": {
                    "type": "string",
                    "enum": ["car", "public", "walking", "mixed"],
                    "default": "mixed"
                },
                "budget_display_currency": {
                    "type": "string",
                    "default": "USD"
                },
                "itinerary_format": {
                    "type": "string",
                    "enum": ["daily", "hourly", "by_location"],
                    "default": "daily"
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("enable_collaboration".to_string(), serde_json::json!(false)),
            ("preferred_transportation".to_string(), serde_json::json!("mixed")),
            ("budget_display_currency".to_string(), serde_json::json!("USD")),
            ("itinerary_format".to_string(), serde_json::json!("daily")),
        ])),
    }
}

fn create_diff_review_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_diff_review".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "diff_review_capsule".to_string(),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "diff_view".to_string(),
                    title: "Changes Overview".to_string(),
                    initial_state: Some(serde_json::json!({
                        "summary": "",
                        "stats": {"added": 0, "removed": 0, "modified": 0}
                    })),
                    columns: Some(vec![
                        ColumnSpec { field: "file".to_string(), label: "File".to_string(), r#type: Some("text".to_string()) },
                        ColumnSpec { field: "changes".to_string(), label: "Changes".to_string(), r#type: Some("number".to_string()) },
                        ColumnSpec { field: "status".to_string(), label: "Status".to_string(), r#type: Some("status".to_string()) },
                    ]),
                    actions: Some(vec![
                        ActionSpec { id: "review_file".to_string(), label: "Review File".to_string(), policy: Some("read".to_string()) },
                        ActionSpec { id: "approve".to_string(), label: "Approve".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "reject".to_string(), label: "Reject".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                },
                CanvasSpec {
                    view_type: "code_editor".to_string(),
                    title: "Detailed Review".to_string(),
                    initial_state: Some(serde_json::json!({
                        "current_file": "",
                        "diff_content": ""
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "comment".to_string(), label: "Add Comment".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "resolve".to_string(), label: "Resolve".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                }
            ],
        },
        required_tools: vec![
            ToolRequirementSpec {
                tool_id: "git.diff".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirementSpec {
                tool_id: "code.review".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["review_diff".to_string(), "code_review".to_string(), "diff".to_string()],
        intent_patterns: vec!["diff".to_string(), "review".to_string()],
        eval_suite: vec!["diff_review_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "diff_context_lines": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 20,
                    "default": 3
                },
                "enable_auto_approve": {
                    "type": "boolean",
                    "default": false
                },
                "review_threshold": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 5
                },
                "supported_languages": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["javascript", "typescript", "python", "rust"]
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("diff_context_lines".to_string(), serde_json::json!(3)),
            ("enable_auto_approve".to_string(), serde_json::json!(false)),
            ("review_threshold".to_string(), serde_json::json!(5)),
            ("supported_languages".to_string(), serde_json::json!(["javascript", "typescript", "python", "rust"])),
        ])),
    }
}

fn create_research_synthesis_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_research_synthesis".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "research_synthesis_capsule".to_string(),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "graph_view".to_string(),
                    title: "Research Topics".to_string(),
                    initial_state: Some(serde_json::json!({
                        "topics": [],
                        "connections": []
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "add_topic".to_string(), label: "Add Topic".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "connect_topics".to_string(), label: "Connect Topics".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                },
                CanvasSpec {
                    view_type: "document_view".to_string(),
                    title: "Synthesis Document".to_string(),
                    initial_state: Some(serde_json::json!({
                        "outline": [],
                        "content": "",
                        "sources": []
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "generate_outline".to_string(), label: "Generate Outline".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "cite_sources".to_string(), label: "Cite Sources".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "export_doc".to_string(), label: "Export Document".to_string(), policy: Some("read".to_string()) }
                    ]),
                    layout: None,
                }
            ],
        },
        required_tools: vec![
            ToolRequirementSpec {
                tool_id: "web.search".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirementSpec {
                tool_id: "document.create".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["research".to_string(), "synthesize".to_string(), "study".to_string()],
        intent_patterns: vec!["research".to_string(), "synthesize".to_string()],
        eval_suite: vec!["research_synthesis_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "citation_style": {
                    "type": "string",
                    "enum": ["apa", "mla", "chicago", "ieee"],
                    "default": "apa"
                },
                "max_sources": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20
                },
                "enable_fact_checking": {
                    "type": "boolean",
                    "default": true
                },
                "document_format": {
                    "type": "string",
                    "enum": ["markdown", "latex", "docx", "pdf"],
                    "default": "markdown"
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("citation_style".to_string(), serde_json::json!("apa")),
            ("max_sources".to_string(), serde_json::json!(20)),
            ("enable_fact_checking".to_string(), serde_json::json!(true)),
            ("document_format".to_string(), serde_json::json!("markdown")),
        ])),
    }
}

fn create_generic_framework() -> FrameworkSpec {
    FrameworkSpec {
        framework_id: "fwk_generic".to_string(),
        version: "0.1.0".to_string(),
        status: FrameworkStatus::Active,
        capsule_template: CapsuleTemplate {
            capsule_type: "generic_capsule".to_string(),
            default_canvases: vec![
                CanvasSpec {
                    view_type: "freeform_view".to_string(),
                    title: "Workspace".to_string(),
                    initial_state: Some(serde_json::json!({
                        "elements": []
                    })),
                    columns: None,
                    actions: Some(vec![
                        ActionSpec { id: "add_element".to_string(), label: "Add Element".to_string(), policy: Some("write".to_string()) },
                        ActionSpec { id: "save".to_string(), label: "Save".to_string(), policy: Some("write".to_string()) }
                    ]),
                    layout: None,
                }
            ],
        },
        required_tools: vec![],
        directives: vec!["generic".to_string(), "default".to_string()],
        intent_patterns: vec![],
        eval_suite: vec!["generic_eval".to_string()],
        promotion_rules: None,
        config_schema: Some(serde_json::json!({
            "type": "object",
            "properties": {
                "supported_view_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["form_view", "list_view", "table_view", "graph_view", "document_view"]
                },
                "enable_custom_components": {
                    "type": "boolean",
                    "default": true
                },
                "default_theme": {
                    "type": "string",
                    "enum": ["light", "dark", "auto"],
                    "default": "auto"
                },
                "max_elements": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000,
                    "default": 100
                }
            }
        })),
        runtime_params: Some(HashMap::from([
            ("supported_view_types".to_string(), serde_json::json!(["form_view", "list_view", "table_view", "graph_view", "document_view"])),
            ("enable_custom_components".to_string(), serde_json::json!(true)),
            ("default_theme".to_string(), serde_json::json!("auto")),
            ("max_elements".to_string(), serde_json::json!(100)),
        ])),
    }
}