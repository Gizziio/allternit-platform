use crate::schema::{Node, Edge, NodeId, EdgeId, ContextSlice};
use crate::storage::Storage;
use crate::error::{IGKError, Result};

#[derive(Clone)]
pub struct QueryEngine {
    storage: Storage,
}

impl QueryEngine {
    pub fn new(storage: Storage) -> Self {
        Self { storage }
    }

    pub async fn get_node(&self, node_id: &NodeId) -> Result<Node> {
        self.storage.get_node(node_id).await?
            .ok_or_else(|| IGKError::NodeNotFound(node_id.to_string()))
    }

    pub async fn search_nodes(
        &self,
        node_type: Option<crate::schema::NodeType>,
        owner: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<Node>> {
        self.storage.search_nodes(node_type, owner, limit).await
    }

    pub async fn get_subgraph(&self, root_node_id: &NodeId, depth: Option<usize>) -> Result<(Node, Vec<Edge>)> {
        let results = self.storage.get_subgraph(root_node_id, depth).await?;

        let root_node = self.get_node(root_node_id).await?;
        let edges = results.into_iter().map(|(_, e)| e).collect();

        Ok((root_node, edges))
    }

    pub async fn get_projections(&self, slice: &ContextSlice) -> Result<Vec<Node>> {
        let mut nodes = Vec::new();

        for root_id in &slice.root_nodes {
            let root_node = self.get_node(root_id).await?;
            nodes.push(root_node);

            let (related_node, _edges) = self.get_subgraph(root_id, Some(3)).await?;
            nodes.push(related_node);
        }

        Ok(nodes)
    }
}
