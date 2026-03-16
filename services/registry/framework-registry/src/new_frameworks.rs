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
            ToolRequirement {
                tool_id: "web.search".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirement {
                tool_id: "calendar.create".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["plan_trip".to_string(), "travel".to_string(), "itinerary".to_string()],
        eval_suite: vec!["trip_planner_eval".to_string()],
        promotion_rules: None,
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
            ToolRequirement {
                tool_id: "git.diff".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirement {
                tool_id: "code.review".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["review_diff".to_string(), "code_review".to_string(), "diff".to_string()],
        eval_suite: vec!["diff_review_eval".to_string()],
        promotion_rules: None,
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
            ToolRequirement {
                tool_id: "web.search".to_string(),
                scope: "read".to_string(),
            },
            ToolRequirement {
                tool_id: "document.create".to_string(),
                scope: "write".to_string(),
            }
        ],
        directives: vec!["research".to_string(), "synthesize".to_string(), "study".to_string()],
        eval_suite: vec!["research_synthesis_eval".to_string()],
        promotion_rules: None,
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
        eval_suite: vec!["generic_eval".to_string()],
        promotion_rules: None,
    }
}