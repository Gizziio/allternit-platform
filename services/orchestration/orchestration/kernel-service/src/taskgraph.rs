use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const GRAPH_DIR: &str = ".a2r/graphs";
const RUN_STATE_DIR: &str = ".a2r/run_state";
const RECEIPTS_DIR: &str = ".a2r/receipts";
const ARTIFACTS_DIR: &str = ".a2r/artifacts";
const AGENT_PROFILES_PATH: &str = "agent/agent_profiles.json";

const BEADS_KEYS: [&str; 8] = [
    "wih_version",
    "task_id",
    "graph_id",
    "title",
    "blocked_by",
    "write_scope",
    "tools",
    "acceptance",
];

const STATUS_PENDING: &str = "PENDING";
const STATUS_BLOCKED: &str = "BLOCKED";
const STATUS_RUNNING: &str = "RUNNING";
const STATUS_SUCCEEDED: &str = "SUCCEEDED";
const STATUS_FAILED: &str = "FAILED";
const STATUS_SKIPPED: &str = "SKIPPED";

#[derive(Debug, Deserialize)]
struct Graph {
    graph_id: String,
    nodes: Vec<GraphNode>,
}

#[derive(Debug, Deserialize)]
struct GraphNode {
    task_id: String,
    #[serde(default)]
    blocked_by: Vec<String>,
    wih_path: String,
}

fn load_json(path: &Path) -> Result<Value, String> {
    let data = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    serde_json::from_str(&data).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn load_graph(graph_id: &str) -> Result<Graph, String> {
    let path = Path::new(GRAPH_DIR).join(format!("{}.json", graph_id));
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Graph not found: {} ({})", path.display(), e))?;
    let graph: Graph = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse graph {}: {}", path.display(), e))?;
    if graph.graph_id != graph_id {
        return Err(format!("Graph id mismatch in {}", path.display()));
    }
    Ok(graph)
}

fn load_wih(wih_path: &str) -> Result<Value, String> {
    let rel = wih_path.trim_start_matches('/');
    let path = Path::new(rel);
    if !path.exists() {
        return Err(format!("WIH not found: {}", path.display()));
    }
    load_json(path)
}

fn value_as_str(value: &Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .ok_or_else(|| format!("Missing or invalid {}", key))
}

fn value_as_array(value: &Value, key: &str) -> Result<Vec<String>, String> {
    value
        .get(key)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect::<Vec<String>>()
        })
        .ok_or_else(|| format!("Missing or invalid {}", key))
}

fn validate_wih_node(node: &GraphNode, wih: &Value, graph_id: &str) -> Result<(), String> {
    let task_id = value_as_str(wih, "task_id")?;
    if task_id != node.task_id {
        return Err(format!("WIH task_id mismatch for {}", node.task_id));
    }
    let wih_graph_id = value_as_str(wih, "graph_id")?;
    if wih_graph_id != graph_id {
        return Err(format!("WIH graph_id mismatch for {}", node.task_id));
    }

    let wih_blocked = value_as_array(wih, "blocked_by")?;
    if wih_blocked != node.blocked_by {
        return Err(format!("blocked_by mismatch for {}", node.task_id));
    }

    let beads = wih
        .get("beads")
        .and_then(|v| v.as_object())
        .ok_or_else(|| format!("Beads envelope missing for {}", node.task_id))?;

    for key in BEADS_KEYS {
        let wih_val = wih.get(key);
        let beads_val = beads.get(key);
        if wih_val != beads_val {
            return Err(format!("Beads.{} mismatch for {}", key, node.task_id));
        }
    }

    Ok(())
}

fn load_agent_profiles() -> Result<HashSet<String>, String> {
    let data = fs::read_to_string(AGENT_PROFILES_PATH)
        .map_err(|e| format!("Agent profiles not found: {} ({})", AGENT_PROFILES_PATH, e))?;
    let json: Value = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse agent profiles: {}", e))?;
    let profiles = json
        .get("profiles")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Agent profiles missing profiles array".to_string())?;
    let mut ids = HashSet::new();
    for profile in profiles {
        let id = profile
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Agent profile missing id".to_string())?;
        ids.insert(id.to_string());
    }
    if ids.is_empty() {
        return Err("Agent profiles list is empty".to_string());
    }
    Ok(ids)
}

fn require_agent_profile(agent_profile_id: &str) -> Result<(), String> {
    let profiles = load_agent_profiles()?;
    if !profiles.contains(agent_profile_id) {
        return Err(format!("Unknown agent profile: {}", agent_profile_id));
    }
    Ok(())
}

pub fn install_run(graph_id: &str) -> Result<Value, String> {
    install_run_with_profile(graph_id, "kernel-default")
}

pub fn install_run_with_profile(graph_id: &str, agent_profile_id: &str) -> Result<Value, String> {
    require_agent_profile(agent_profile_id)?;
    let graph = load_graph(graph_id)?;
    if graph.nodes.is_empty() {
        return Err(format!("Graph has no nodes: {}", graph_id));
    }

    for node in &graph.nodes {
        let wih = load_wih(&node.wih_path)?;
        validate_wih_node(node, &wih, graph_id)?;
    }

    let run_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let mut node_states = Vec::new();
    let mut runnable = Vec::new();

    for node in &graph.nodes {
        let status = if node.blocked_by.is_empty() {
            runnable.push(node.task_id.clone());
            STATUS_PENDING
        } else {
            STATUS_BLOCKED
        };

        node_states.push(json!({
            "task_id": node.task_id,
            "status": status,
            "last_receipt_id": ""
        }));
    }

    let mut runnable_sorted = runnable.clone();
    runnable_sorted.sort();

    let run_state = json!({
        "run_id": run_id,
        "graph_id": graph_id,
        "status": "RUNNING",
        "started_at": now,
        "node_states": node_states,
        "resume_cursor": {
            "last_node": "",
            "next_nodes": runnable_sorted
        },
        "receipts": [],
        "artifacts": []
    });

    fs::create_dir_all(RUN_STATE_DIR)
        .map_err(|e| format!("Failed to create run_state dir: {}", e))?;
    let run_path = Path::new(RUN_STATE_DIR).join(format!("{}.json", run_id));
    fs::write(
        &run_path,
        serde_json::to_string_pretty(&run_state).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Failed to write run_state: {}", e))?;

    write_agent_execution_receipt(&run_id, graph_id, agent_profile_id, "INSTALLED", &run_path)?;

    Ok(json!({
        "run_id": run_id,
        "graph_id": graph_id,
        "run_state_path": run_path
    }))
}

pub fn resume_run(run_id: &str) -> Result<Value, String> {
    resume_run_with_profile(run_id, "kernel-default")
}

pub fn resume_run_with_profile(run_id: &str, agent_profile_id: &str) -> Result<Value, String> {
    require_agent_profile(agent_profile_id)?;
    let run_path = Path::new(RUN_STATE_DIR).join(format!("{}.json", run_id));
    if !run_path.exists() {
        return Err(format!("Run state not found: {}", run_path.display()));
    }

    let mut run_state = load_json(&run_path)?;
    let graph_id = value_as_str(&run_state, "graph_id")?;
    let graph = load_graph(&graph_id)?;

    let node_states_val = run_state
        .get("node_states")
        .and_then(|v| v.as_array())
        .ok_or_else(|| format!("Run state missing node_states: {}", run_path.display()))?;

    let mut state_by_task: HashMap<String, Value> = HashMap::new();
    for state in node_states_val {
        if let Some(task_id) = state.get("task_id").and_then(|v| v.as_str()) {
            state_by_task.insert(task_id.to_string(), state.clone());
        }
    }

    for node in &graph.nodes {
        if !state_by_task.contains_key(&node.task_id) {
            return Err(format!("Run state missing node state for {}", node.task_id));
        }
        let wih = load_wih(&node.wih_path)?;
        validate_wih_node(node, &wih, &graph_id)?;
    }

    let receipt_dir = Path::new(RECEIPTS_DIR).join(run_id);
    let mut receipt_nodes: HashSet<String> = HashSet::new();
    let mut receipt_ids: Vec<String> = Vec::new();
    if receipt_dir.exists() {
        for entry in
            fs::read_dir(&receipt_dir).map_err(|e| format!("Failed to read receipts: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read receipt entry: {}", e))?;
            if !entry
                .path()
                .extension()
                .map(|ext| ext == "json")
                .unwrap_or(false)
            {
                continue;
            }
            let receipt = load_json(&entry.path())?;
            if let Some(receipt_run_id) = receipt.get("run_id").and_then(|v| v.as_str()) {
                if receipt_run_id != run_id {
                    return Err(format!(
                        "Receipt run_id mismatch in {}",
                        entry.path().display()
                    ));
                }
            }
            if let Some(node_id) = receipt.get("node_id").and_then(|v| v.as_str()) {
                receipt_nodes.insert(node_id.to_string());
            } else if let Some(task_id) = receipt.get("task_id").and_then(|v| v.as_str()) {
                receipt_nodes.insert(task_id.to_string());
            }
            let receipt_id = receipt
                .get("receipt_id")
                .and_then(|v| v.as_str())
                .map(|v| v.to_string())
                .unwrap_or_else(|| {
                    entry
                        .path()
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });
            receipt_ids.push(receipt_id);
        }
    }

    for state in node_states_val {
        let status = state.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if status == STATUS_SUCCEEDED {
            let task_id = value_as_str(state, "task_id")?;
            if !receipt_nodes.contains(&task_id) {
                return Err(format!("Missing receipt for completed node {}", task_id));
            }
        }
    }

    let mut runnable = Vec::new();
    for node in &graph.nodes {
        let mut state = state_by_task
            .get(&node.task_id)
            .cloned()
            .unwrap_or_else(|| json!({}));
        let status = state
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or(STATUS_PENDING);
        if [STATUS_SUCCEEDED, STATUS_FAILED, STATUS_SKIPPED].contains(&status) {
            continue;
        }

        let deps_missing: Vec<String> = node
            .blocked_by
            .iter()
            .filter(|dep| !receipt_nodes.contains(*dep))
            .cloned()
            .collect();

        if !deps_missing.is_empty() {
            if status == STATUS_RUNNING {
                return Err(format!(
                    "Node {} running without dependency receipts",
                    node.task_id
                ));
            }
            state["status"] = Value::String(STATUS_BLOCKED.to_string());
        } else {
            if status == STATUS_BLOCKED {
                state["status"] = Value::String(STATUS_PENDING.to_string());
            }
            if state["status"] == Value::String(STATUS_PENDING.to_string()) {
                runnable.push(node.task_id.clone());
            }
        }

        run_state
            .get_mut("node_states")
            .and_then(|v| v.as_array_mut())
            .ok_or_else(|| "Run state node_states missing".to_string())?
            .iter_mut()
            .for_each(|item| {
                if item.get("task_id") == Some(&Value::String(node.task_id.clone())) {
                    *item = state.clone();
                }
            });
    }

    run_state["receipts"] = Value::Array(receipt_ids.into_iter().map(Value::String).collect());
    let mut resume_cursor = run_state
        .get("resume_cursor")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let mut runnable_sorted = runnable.clone();
    runnable_sorted.sort();
    resume_cursor["next_nodes"] =
        Value::Array(runnable_sorted.iter().cloned().map(Value::String).collect());
    run_state["resume_cursor"] = resume_cursor;

    fs::write(
        &run_path,
        serde_json::to_string_pretty(&run_state).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Failed to write run_state: {}", e))?;

    write_agent_execution_receipt(run_id, &graph_id, agent_profile_id, "RESUMED", &run_path)?;

    Ok(json!({
        "run_id": run_id,
        "graph_id": graph_id,
        "next_nodes": runnable_sorted
    }))
}

fn write_agent_execution_receipt(
    run_id: &str,
    graph_id: &str,
    agent_profile_id: &str,
    status: &str,
    run_state_path: &Path,
) -> Result<String, String> {
    let receipt_id = format!("agent-exec-{}", Uuid::new_v4());
    let created_at = Utc::now().to_rfc3339();
    let receipts_dir = Path::new(RECEIPTS_DIR).join(run_id);
    fs::create_dir_all(&receipts_dir)
        .map_err(|e| format!("Failed to create receipts dir: {}", e))?;

    let receipt = json!({
        "receipt_id": receipt_id,
        "created_at": created_at,
        "run_id": run_id,
        "graph_id": graph_id,
        "agent_profile_id": agent_profile_id,
        "status": status,
        "run_state_path": format!("/{}", run_state_path.display()),
        "receipts_dir": format!("/{}/{}", RECEIPTS_DIR, run_id),
        "artifacts_dir": format!("/{}/{}", ARTIFACTS_DIR, run_id),
        "node_receipts": [],
        "tool_receipts": [],
        "subprocess_receipts": []
    });

    let receipt_path = receipts_dir.join(format!("{}.json", receipt_id));
    fs::write(
        &receipt_path,
        serde_json::to_string_pretty(&receipt).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Failed to write agent execution receipt: {}", e))?;
    Ok(receipt_id)
}
