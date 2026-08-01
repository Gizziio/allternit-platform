//! Typed mail envelopes (E1-R2) and the normalized message view used by the
//! per-agent inbox/outbox projections (E1-R3).

use serde::{Deserialize, Serialize};

use crate::core::types::AllternitEvent;

/// Message importance. Serialized as `low` / `normal` / `high`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MailImportance {
    Low,
    #[default]
    Normal,
    High,
}

/// Typed send input (E1-R2). The markdown `body` is persisted as a file under
/// `.allternit/mail/messages/`; the emitted `MessageSent` event carries
/// `body_path` instead of the body itself.
#[derive(Debug, Clone)]
pub struct TypedMessage {
    pub from_agent: String,
    /// Empty means broadcast.
    pub to_agents: Vec<String>,
    pub subject: Option<String>,
    pub importance: MailImportance,
    pub ack_required: bool,
    pub body: String,
}

/// Normalized view over a `MessageSent` event, covering both the typed
/// envelope shape (E1) and the legacy `body_ref` shape.
#[derive(Debug, Clone, Serialize)]
pub struct MailMessage {
    pub message_id: String,
    pub thread_id: String,
    pub from_agent: String,
    /// Empty means broadcast (and is what legacy sends map to).
    pub to_agents: Vec<String>,
    pub subject: Option<String>,
    pub importance: MailImportance,
    pub ack_required: bool,
    /// Typed envelope: path of the body file under `.allternit/mail/messages/`.
    pub body_path: Option<String>,
    /// Legacy envelope: inline body / body_ref payload.
    pub body_ref: Option<String>,
    pub timestamp: String,
}

impl MailMessage {
    /// Project an event into a message. Returns `None` for any event that is
    /// not `MessageSent` — the real `wih:pipeline-*` threads contain only
    /// `MailAssetShared` events with no from/to fields, and the inbox/outbox
    /// projections must skip them (E1-R2 builder note).
    pub fn from_event(event: &AllternitEvent) -> Option<Self> {
        if event.r#type != "MessageSent" {
            return None;
        }
        let payload = &event.payload;
        let thread_id = payload.get("thread_id")?.as_str()?.to_string();
        let from_agent = payload
            .get("from_agent")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| event.actor.id.clone());
        let to_agents = payload
            .get("to_agents")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let subject = payload
            .get("subject")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let importance = payload
            .get("importance")
            .and_then(|v| serde_json::from_value::<MailImportance>(v.clone()).ok())
            .unwrap_or_default();
        let ack_required = payload
            .get("ack_required")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let body_path = payload
            .get("body_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let body_ref = payload
            .get("body_ref")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        Some(Self {
            message_id: event.event_id.clone(),
            thread_id,
            from_agent,
            to_agents,
            subject,
            importance,
            ack_required,
            body_path,
            body_ref,
            timestamp: event.ts.clone(),
        })
    }
}
