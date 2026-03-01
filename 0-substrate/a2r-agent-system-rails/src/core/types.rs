use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActorType {
    User,
    Agent,
    Gate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    pub r#type: ActorType,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventScope {
    pub project_id: Option<String>,
    pub dag_id: Option<String>,
    pub node_id: Option<String>,
    pub wih_id: Option<String>,
    pub run_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventProvenance {
    pub prompt_id: Option<String>,
    pub delta_id: Option<String>,
    pub agent_decision_id: Option<String>,
    pub parent_event_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A2REvent {
    pub event_id: String,
    pub ts: String,
    pub actor: Actor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<EventScope>,
    pub r#type: String,
    #[serde(default)]
    pub payload: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<EventProvenance>,
}

#[derive(Debug, Clone, Default)]
pub struct LedgerQuery {
    pub r#type: Option<String>,
    pub types: Option<Vec<String>>,
    pub scope: Option<EventScope>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptExit {
    pub code: Option<i32>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptRecord {
    pub receipt_id: String,
    pub run_id: String,
    pub step: Option<i32>,
    pub tool: String,
    pub tool_version: Option<String>,
    pub inputs_ref: Option<String>,
    pub outputs_ref: Option<String>,
    pub exit: Option<ReceiptExit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseRequest {
    pub lease_id: String,
    pub wih_id: String,
    pub agent_id: String,
    pub paths: Vec<String>,
    pub requested_at: String,
    pub ttl_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseRecord {
    pub lease_id: String,
    pub wih_id: String,
    pub agent_id: String,
    pub paths: Vec<String>,
    pub requested_at: String,
    pub ttl_seconds: Option<i64>,
    pub status: String,
    pub granted_until: Option<String>,
    pub denied_reason: Option<String>,
}
