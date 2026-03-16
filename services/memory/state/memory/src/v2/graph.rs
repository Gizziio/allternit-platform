use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub edge_id: String,
    pub tenant_id: String,
    pub subject: String,
    pub predicate: String,
    pub object: String,
    pub status: String,
    pub confidence: f64,
    pub authority: String,
    pub valid_from: u64,
    pub valid_to: Option<u64>,
    pub source_memory_id: Option<String>,
    pub source_resource_id: Option<String>,
    pub last_accessed: Option<u64>,
    pub access_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQuery {
    pub tenant_id: String,
    pub seed: String,
    pub max_hops: u8,
}

pub trait GraphStore: Send + Sync {
    fn upsert_edge(&self, edge: GraphEdge) -> anyhow::Result<()>;
    fn traverse(&self, query: GraphQuery) -> anyhow::Result<Vec<GraphEdge>>;
}
