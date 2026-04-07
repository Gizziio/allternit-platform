use std::collections::HashMap;

use serde_json::Value;

use crate::core::types::A2REvent;
use crate::work::types::{DagEdge, DagNode, DagRelation, DagState};

pub fn project_dag(events: &[A2REvent], dag_id: &str) -> DagState {
    let mut dag = DagState {
        dag_id: dag_id.to_string(),
        nodes: HashMap::new(),
        edges: Vec::new(),
        relations: Vec::new(),
    };

    for evt in events {
        match evt.r#type.as_str() {
            "DagNodeCreated" => {
                if let Some(node) = parse_node_created(evt, dag_id) {
                    dag.nodes.insert(node.node_id.clone(), node);
                }
            }
            "DagNodeUpdated" => {
                if let Some(node_id) = get_str(&evt.payload, "node_id") {
                    if let Some(node) = dag.nodes.get_mut(&node_id) {
                        if let Some(patch) = evt.payload.get("patch") {
                            apply_node_patch(node, patch);
                            node.updated_at = Some(evt.ts.clone());
                        }
                    }
                }
            }
            "DagEdgeAdded" => {
                if let Some(edge) = parse_edge_added(&evt.payload) {
                    dag.edges.push(edge);
                }
            }
            "DagRelationAdded" => {
                if let Some(rel) = parse_relation_added(&evt.payload) {
                    dag.relations.push(rel);
                }
            }
            "DagNodeStatusChanged" => {
                if let Some(node_id) = get_str(&evt.payload, "node_id") {
                    if let Some(node) = dag.nodes.get_mut(&node_id) {
                        if let Some(to) = get_str(&evt.payload, "to") {
                            node.status = to;
                            node.updated_at = Some(evt.ts.clone());
                        }
                    }
                }
            }
            "LabelAdded" => {
                if let Some(node_id) = get_str(&evt.payload, "node_id") {
                    if let Some(node) = dag.nodes.get_mut(&node_id) {
                        if let Some(label) = get_str(&evt.payload, "label") {
                            if !node.labels.contains(&label) {
                                node.labels.push(label);
                                node.updated_at = Some(evt.ts.clone());
                            }
                        }
                    }
                }
            }
            "LabelRemoved" => {
                if let Some(node_id) = get_str(&evt.payload, "node_id") {
                    if let Some(node) = dag.nodes.get_mut(&node_id) {
                        if let Some(label) = get_str(&evt.payload, "label") {
                            node.labels.retain(|l| l != &label);
                            node.updated_at = Some(evt.ts.clone());
                        }
                    }
                }
            }
            "StateSet" => {
                if let Some(node_id) = get_str(&evt.payload, "node_id") {
                    if let Some(node) = dag.nodes.get_mut(&node_id) {
                        if let (Some(dim), Some(value)) = (
                            get_str(&evt.payload, "dimension"),
                            get_str(&evt.payload, "value"),
                        ) {
                            node.state.insert(dim, value);
                            node.updated_at = Some(evt.ts.clone());
                        }
                    }
                }
            }
            _ => {}
        }
    }

    apply_readiness(&mut dag);
    dag
}

fn parse_node_created(evt: &A2REvent, dag_id: &str) -> Option<DagNode> {
    let payload = &evt.payload;
    let payload_dag = get_str(payload, "dag_id")?;
    if payload_dag != dag_id {
        return None;
    }
    let node_id = get_str(payload, "node_id")?;
    let node_kind = get_str(payload, "node_kind").unwrap_or_else(|| "task".to_string());
    let title = get_str(payload, "title").unwrap_or_else(|| "Untitled".to_string());
    let parent_node_id = payload
        .get("parent_node_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let description = payload
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let execution_mode = get_str(payload, "execution_mode").unwrap_or_else(|| "shared".to_string());
    let owner_role = payload
        .get("owner_role")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let priority = payload.get("priority").and_then(|v| v.as_i64());
    let labels = payload
        .get("labels")
        .or_else(|| payload.get("tags"))
        .and_then(|v| v.as_array())
        .map(|arr| extract_string_vec(arr))
        .unwrap_or_default();
    let assignee = payload
        .get("assignee")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let spec_id = payload
        .get("spec_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let notes = payload
        .get("notes")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let acceptance = payload
        .get("acceptance")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let design = payload
        .get("design")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Some(DagNode {
        node_id,
        dag_id: payload_dag,
        parent_node_id,
        node_kind,
        title,
        description,
        execution_mode,
        owner_role,
        priority,
        labels,
        status: "NEW".to_string(),
        current_wih_id: None,
        assignee,
        spec_id,
        notes,
        acceptance,
        design,
        state: HashMap::new(),
        created_at: Some(evt.ts.clone()),
        updated_at: Some(evt.ts.clone()),
        worktree: None,
    })
}

fn parse_edge_added(payload: &Value) -> Option<DagEdge> {
    Some(DagEdge {
        from_node_id: get_str(payload, "from_node_id")?,
        to_node_id: get_str(payload, "to_node_id")?,
        edge_type: get_str(payload, "edge_type").unwrap_or_else(|| "blocked_by".to_string()),
    })
}

fn parse_relation_added(payload: &Value) -> Option<DagRelation> {
    let context_share = payload
        .get("context_share")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    Some(DagRelation {
        a: get_str(payload, "a")?,
        b: get_str(payload, "b")?,
        note: payload
            .get("note")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        context_share,
    })
}

fn apply_node_patch(node: &mut DagNode, patch: &Value) {
    if let Some(title) = patch.get("title").and_then(|v| v.as_str()) {
        node.title = title.to_string();
    }
    if let Some(kind) = patch.get("node_kind").and_then(|v| v.as_str()) {
        node.node_kind = kind.to_string();
    }
    if let Some(desc) = patch.get("description").and_then(|v| v.as_str()) {
        node.description = Some(desc.to_string());
    }
    if let Some(mode) = patch.get("execution_mode").and_then(|v| v.as_str()) {
        node.execution_mode = mode.to_string();
    }
    if let Some(role) = patch.get("owner_role").and_then(|v| v.as_str()) {
        node.owner_role = Some(role.to_string());
    }
    if let Some(priority) = patch.get("priority").and_then(|v| v.as_i64()) {
        node.priority = Some(priority);
    }
    if let Some(labels) = patch
        .get("labels")
        .or_else(|| patch.get("tags"))
        .and_then(|v| v.as_array())
    {
        node.labels = extract_string_vec(labels);
    }
    if let Some(assignee) = patch.get("assignee").and_then(|v| v.as_str()) {
        node.assignee = Some(assignee.to_string());
    }
    if let Some(spec_id) = patch.get("spec_id").and_then(|v| v.as_str()) {
        node.spec_id = Some(spec_id.to_string());
    }
    if let Some(notes) = patch.get("notes").and_then(|v| v.as_str()) {
        node.notes = Some(notes.to_string());
    }
    if let Some(acceptance) = patch.get("acceptance").and_then(|v| v.as_str()) {
        node.acceptance = Some(acceptance.to_string());
    }
    if let Some(design) = patch.get("design").and_then(|v| v.as_str()) {
        node.design = Some(design.to_string());
    }
}

fn apply_readiness(dag: &mut DagState) {
    let edges = dag.edges.clone();
    let status_map: std::collections::HashMap<String, String> = dag
        .nodes
        .iter()
        .map(|(id, node)| (id.clone(), node.status.clone()))
        .collect();

    for (node_id, node) in dag.nodes.iter_mut() {
        if node.status != "NEW" {
            continue;
        }
        let blockers: Vec<&DagEdge> = edges
            .iter()
            .filter(|edge| edge.to_node_id == *node_id && edge.edge_type == "blocked_by")
            .collect();
        let deps_satisfied = blockers.iter().all(|edge| {
            status_map
                .get(&edge.from_node_id)
                .map(|status| status == "DONE")
                .unwrap_or(false)
        });
        if deps_satisfied {
            node.status = "READY".to_string();
        }
    }
}

fn get_str(payload: &Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn extract_string_vec(values: &[Value]) -> Vec<String> {
    values
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect()
}
