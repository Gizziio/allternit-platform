use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Framework {
    pub framework_id: String,
    pub capsule_type: String,
    pub default_canvases: Vec<CanvasTemplate>,
    pub required_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasTemplate {
    pub view_type: String,
    pub title: String,
    pub initial_state: Option<serde_json::Value>,
    pub columns: Option<serde_json::Value>,
    pub actions: Option<serde_json::Value>,
    pub layout: Option<serde_json::Value>,
}

pub fn get_default_frameworks() -> Vec<Framework> {
    vec![
        Framework {
            framework_id: "fwk_brain".to_string(),
            capsule_type: "brain_capsule".to_string(),
            default_canvases: vec![CanvasTemplate {
                view_type: "chat_view".to_string(),
                title: "Brain Session".to_string(),
                initial_state: Some(serde_json::json!({
                    "messages": [],
                    "session_id": ""
                })),
                columns: None,
                actions: None,
                layout: None,
            }],
            required_tools: vec![],
        },
        Framework {
            framework_id: "fwk_search".to_string(),
            capsule_type: "search_capsule".to_string(),
            default_canvases: vec![CanvasTemplate {
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
            required_tools: vec!["web.search".to_string()],
        },
        Framework {
            framework_id: "fwk_note".to_string(),
            capsule_type: "note_capsule".to_string(),
            default_canvases: vec![CanvasTemplate {
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
            required_tools: vec!["note.create".to_string()],
        },
        Framework {
            framework_id: "fwk_home".to_string(),
            capsule_type: "home_capsule".to_string(),
            default_canvases: vec![
                CanvasTemplate {
                    view_type: "graph_view".to_string(),
                    title: "Intent Graph".to_string(),
                    initial_state: Some(serde_json::json!({
                        "nodes": [],
                        "edges": []
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
                CanvasTemplate {
                    view_type: "timeline_view".to_string(),
                    title: "Recent Activity".to_string(),
                    initial_state: Some(serde_json::json!({
                        "events": []
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
                CanvasTemplate {
                    view_type: "list_view".to_string(),
                    title: "Quick Actions".to_string(),
                    initial_state: Some(serde_json::json!({
                        "columns": ["action", "description"],
                        "data": [
                            { "action": "Search", "description": "Search web" },
                            { "action": "Note", "description": "Take a note" },
                            { "action": "Settings", "description": "Configure preferences" }
                        ]
                    })),
                    columns: None,
                    actions: None,
                    layout: None,
                },
            ],
            required_tools: vec![],
        },
        Framework {
            framework_id: "fwk_workorder".to_string(),
            capsule_type: "data_capsule".to_string(),
            default_canvases: vec![CanvasTemplate {
                view_type: "table_view".to_string(),
                title: "Work Orders".to_string(),
                initial_state: Some(serde_json::json!({
                    "data": [
                        {"id": "WO-101", "site": "Site A", "priority": "High", "status": "Open"},
                        {"id": "WO-102", "site": "Site B", "priority": "Low", "status": "Closed"}
                    ]
                })),
                columns: Some(serde_json::json!([
                    {"field": "id", "label": "ID", "type": "text"},
                    {"field": "site", "label": "Site", "type": "text"},
                    {"field": "priority", "label": "Priority", "type": "text"},
                    {"field": "status", "label": "Status", "type": "status"}
                ])),
                actions: Some(serde_json::json!([
                    {"id": "escalate", "label": "Escalate", "policy": "write"},
                    {"id": "close", "label": "Close", "policy": "write"}
                ])),
                layout: None,
            }],
            required_tools: vec![],
        },
    ]
}
