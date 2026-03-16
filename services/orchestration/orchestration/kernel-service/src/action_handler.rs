use crate::journal_ledger::JournalLedger;
use crate::types::{ActionRequest, ActionResponse, JournalEvent};
use std::sync::Arc;

#[derive(Debug)]
pub struct ActionHandler {
    ledger: Arc<JournalLedger>,
}

impl ActionHandler {
    pub fn new(ledger: Arc<JournalLedger>) -> Self {
        Self { ledger }
    }

    pub async fn handle_action(
        &self,
        request: ActionRequest,
    ) -> Result<ActionResponse, anyhow::Error> {
        let event_id = uuid::Uuid::new_v4().to_string();
        let timestamp = chrono::Utc::now().timestamp_millis();

        // Create a journal entry for the action
        let event = JournalEvent {
            event_id: event_id.clone(),
            timestamp,
            kind: "action_triggered".to_string(),
            capsule_id: Some(request.capsule_id.clone()),
            payload: serde_json::json!({
                "action_id": request.action_id,
                "view_id": request.view_id,
                "context": request.context,
                "payload": request.payload
            }),
            parent_ids: vec![], // Actions are usually roots or triggered by human
            root_id: Some(event_id.clone()),
        };

        self.ledger.add_event(event.clone()).await;

        // Mock logic for "Escalate"
        let message = if request.action_id == "escalate" {
            Some("Work Order Escalated to Level 2".to_string())
        } else if request.action_id == "close" {
            Some("Work Order Closed".to_string())
        } else {
            Some(format!("Action {} executed", request.action_id))
        };

        Ok(ActionResponse {
            success: true,
            message,
            events: vec![event],
            state_updates: None,
        })
    }
}
