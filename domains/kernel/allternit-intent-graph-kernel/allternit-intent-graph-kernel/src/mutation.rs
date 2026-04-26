use crate::schema::{Node, Edge, Event, NodeId, EdgeId, NodeStatus, NodeType};
use crate::storage::Storage;
use crate::error::{Result, IGKError};

#[derive(Clone)]
pub struct MutationEngine {
    storage: Storage,
}

impl MutationEngine {
    pub fn new(storage: Storage) -> Self {
        Self { storage }
    }

    pub async fn propose_create_node(
        &self,
        node: &Node,
    ) -> Result<ProposedMutation> {
        Ok(ProposedMutation {
            node: node.clone(),
            requires_policy: node.node_type == NodeType::Intent || node.node_type == NodeType::Goal,
        })
    }

    pub async fn commit_create_node(
        &self,
        node: &Node,
        actor: &str,
        policy_decision: Option<String>,
    ) -> Result<Event> {
        let event = Event {
            event_id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            actor: actor.to_string(),
            action: "create_node".to_string(),
            target: node.node_id.to_string(),
            before_state: None,
            after_state: Some(serde_json::to_value(node)?),
            policy_decision: policy_decision.map(|s| s.to_string()),
        };

        self.storage.create_node(node).await?;
        self.storage.create_event(&event).await?;

        Ok(event)
    }

    pub async fn commit_create_edge(
        &self,
        edge: &Edge,
        actor: &str,
        policy_decision: Option<String>,
    ) -> Result<Event> {
        self.storage.create_edge(edge).await?;

        let event = Event {
            event_id: uuid::Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            actor: actor.to_string(),
            action: "create_edge".to_string(),
            target: edge.edge_id.to_string(),
            before_state: None,
            after_state: Some(serde_json::to_value(edge)?),
            policy_decision: policy_decision.map(|s| s.to_string()),
        };

        self.storage.create_event(&event).await?;

        Ok(event)
    }
}

#[derive(Debug)]
pub struct ProposedMutation {
    pub node: Node,
    pub requires_policy: bool,
}
