//! NDJSON wire protocol: requests, responses, and events.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// One client request, one line of JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    pub id: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

/// Server response carrying the same `id` as its request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

impl Response {
    pub fn ok(id: impl Into<String>, result: Value) -> Self {
        Self {
            id: id.into(),
            result: Some(result),
            error: None,
        }
    }

    pub fn err(id: impl Into<String>, code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            result: None,
            error: Some(RpcError {
                code: code.into(),
                message: message.into(),
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: String,
    pub message: String,
}

/// Server-pushed event on a subscribed connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub pane_id: Option<String>,
    #[serde(default)]
    pub data: Value,
}

impl Event {
    pub fn new(kind: impl Into<String>, data: Value) -> Self {
        Self {
            kind: kind.into(),
            session_id: None,
            pane_id: None,
            data,
        }
    }

    pub fn for_pane(mut self, session_id: &str, pane_id: &str) -> Self {
        self.session_id = Some(session_id.to_string());
        self.pane_id = Some(pane_id.to_string());
        self
    }
}
