use crate::schema::{Node, NodeId, ContextSlice};
use crate::storage::Storage;
use crate::error::{Result, IGKError};

#[derive(Clone)]
pub struct ProjectionEngine {
    storage: Storage,
}

impl ProjectionEngine {
    pub fn new(storage: Storage) -> Self {
        Self { storage }
    }

    pub async fn compute_temporal_projections(
        &self,
        root_node_id: &NodeId,
    ) -> Result<TemporalProjections> {
        let nodes = self.storage.search_nodes(None, None, None).await?;

        Ok(TemporalProjections {
            now: nodes
                .iter()
                .filter(|n| n.node_id == *root_node_id || matches(&n.updated_at))
                .cloned()
                .collect(),
            next: nodes
                .iter()
                .filter(|n| matches(&n.updated_at) && n.node_id != *root_node_id)
                .cloned()
                .collect(),
            later: nodes
                .iter()
                .filter(|n| !matches(&n.updated_at) && n.node_id != *root_node_id)
                .cloned()
                .collect(),
        })
    }

    pub async fn compute_context_window(
        &self,
        slice: &ContextSlice,
    ) -> Result<ContextWindow> {
        let mut nodes = Vec::new();

        for root_id in &slice.root_nodes {
            let subgraph = self.storage.get_subgraph(root_id, Some(3)).await?;
            
            if let Ok(Some(root_node)) = self.storage.get_node(root_id).await {
                nodes.push(root_node);
            }

            for (_, edge) in subgraph {
                if slice.edges.contains(&edge.edge_id) {
                    if let Some(target_node) = self.storage.get_node(&edge.to_node_id).await? {
                        nodes.push(target_node);
                    }
                }
            }
        }

        let total_tokens = estimate_token_count(&nodes, &slice.sources);

        Ok(ContextWindow {
            nodes,
            token_count: total_tokens,
            budget: slice.token_budget,
            within_budget: total_tokens <= slice.token_budget,
        })
    }
}

#[derive(Debug)]
pub struct TemporalProjections {
    pub now: Vec<Node>,
    pub next: Vec<Node>,
    pub later: Vec<Node>,
}

#[derive(Debug)]
pub struct ContextWindow {
    pub nodes: Vec<Node>,
    pub token_count: usize,
    pub budget: usize,
    pub within_budget: bool,
}

fn matches(dt: &chrono::DateTime<chrono::Utc>) -> bool {
    let now = chrono::Utc::now();
    let age = now.signed_duration_since(*dt);
    age.num_seconds() < 3600
}

fn estimate_token_count(nodes: &[Node], sources: &[crate::schema::SourceRef]) -> usize {
    let mut count = 0;

    for node in nodes {
        count += node.attributes.as_object()
            .map(|obj| obj.len())
            .unwrap_or(0) * 10;
    }

    for source in sources {
        count += source.excerpt.as_ref().map(|e| e.len()).unwrap_or(0);
    }

    count
}
