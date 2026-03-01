use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Intent,
    Task,
    Goal,
    Decision,
    Artifact,
    Observation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentNode {
    pub id: String,
    pub node_type: NodeType,
    pub title: String,
    pub content: serde_json::Value,
    pub created_at: i64,
    pub provenance_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentEdge {
    pub from: String,
    pub to: String,
    pub relation: String, // e.g., "PART_OF", "BLOCKS", "DERIVED_FROM"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IntentGraphKernel {
    pub nodes: HashMap<String, IntentNode>,
    pub edges: Vec<IntentEdge>,
}

impl IntentGraphKernel {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
        }
    }

    pub fn add_node(
        &mut self,
        node_type: NodeType,
        title: String,
        content: serde_json::Value,
    ) -> String {
        let id = format!(
            "{}_{}",
            match node_type {
                NodeType::Intent => "int",
                NodeType::Task => "tsk",
                NodeType::Goal => "gol",
                NodeType::Decision => "dec",
                NodeType::Artifact => "art",
                NodeType::Observation => "obs",
            },
            Uuid::new_v4().to_string().get(0..8).unwrap()
        );

        let node = IntentNode {
            id: id.clone(),
            node_type,
            title,
            content,
            created_at: chrono::Utc::now().timestamp_millis(),
            provenance_id: None,
        };

        self.nodes.insert(id.clone(), node);
        id
    }

    pub fn add_edge(&mut self, from: &str, to: &str, relation: &str) {
        self.edges.push(IntentEdge {
            from: from.to_string(),
            to: to.to_string(),
            relation: relation.to_string(),
        });
    }

    pub fn add_goal(&mut self, title: String, description: String) -> String {
        let content = serde_json::json!({ "description": description });
        self.add_node(NodeType::Goal, title, content)
    }

    pub fn decompose_goal(&mut self, goal_id: &str, tasks: Vec<(String, String)>) -> Vec<String> {
        let mut task_ids = Vec::new();
        for (title, desc) in tasks {
            let content = serde_json::json!({ "description": desc });
            let task_id = self.add_node(NodeType::Task, title, content);
            self.add_edge(goal_id, &task_id, "DECOMPOSED_INTO");
            task_ids.push(task_id);
        }
        task_ids
    }

    pub fn save_to_disk(&self) -> anyhow::Result<()> {
        let path = std::path::Path::new("workspace/vault/graph.json");
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load_from_disk() -> Self {
        let path = std::path::Path::new("workspace/vault/graph.json");
        if path.exists() {
            let data = std::fs::read_to_string(path).unwrap_or_default();
            serde_json::from_str(&data).unwrap_or_else(|_| Self::new())
        } else {
            Self::new()
        }
    }
}
