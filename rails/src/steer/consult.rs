//! Steering consults and commit gate backed by the Rails ledger.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use chrono::Utc;
use serde_json::json;

use crate::core::ids::create_event_id;
use crate::core::types::{AllternitEvent, Actor, ActorType, LedgerQuery};
use crate::ledger::Ledger;
use crate::steer::checkpoint::load_checkpoint;
use crate::steer::types::{SteeringCheckpoint, SteeringConsult, SteeringGateResult, SteeringVerdict};

#[derive(Clone)]
pub struct SteeringOptions {
    pub root_dir: PathBuf,
    pub ledger: Arc<Ledger>,
    pub actor_id: Option<String>,
}

pub struct Steering {
    root_dir: PathBuf,
    ledger: Arc<Ledger>,
    actor: Actor,
}

impl Steering {
    pub fn new(opts: SteeringOptions) -> Self {
        let actor = Actor {
            r#type: ActorType::Gate,
            id: opts.actor_id.unwrap_or_else(|| "steering".to_string()),
        };
        Self {
            root_dir: opts.root_dir,
            ledger: opts.ledger,
            actor,
        }
    }

    async fn log_event(&self, event_type: &str, payload: serde_json::Value) -> Result<String> {
        let event = AllternitEvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: self.actor.clone(),
            scope: None,
            r#type: event_type.to_string(),
            payload,
            provenance: None,
        };
        self.ledger.append(event).await
    }

    /// Load the current checkpoint and emit a `SteeringCheckpointUpdated` event.
    pub async fn checkpoint(&self) -> Result<SteeringCheckpoint> {
        let checkpoint = load_checkpoint(&self.root_dir).await?;
        self.log_event(
            "SteeringCheckpointUpdated",
            json!({
                "goal": checkpoint.goal,
                "just_did": checkpoint.just_did,
                "next_steps": checkpoint.next_steps,
                "open_questions": checkpoint.open_questions,
            }),
        )
        .await?;
        Ok(checkpoint)
    }

    /// Create a consult request for the steering agent.  In Phase 1 this
    /// records the request as a ledger event and returns the consult id; a
    /// later phase will wire it to a Mail thread and a steering agent peer.
    pub async fn request_consult(&self) -> Result<SteeringConsult> {
        let checkpoint = self.checkpoint().await?;
        let consult_id = format!("steer_{}", create_event_id());
        let thread_id = format!("steering-{}", consult_id);
        let consult = SteeringConsult {
            consult_id: consult_id.clone(),
            checkpoint,
            thread_id: thread_id.clone(),
        };
        self.log_event(
            "SteeringConsultRequested",
            json!({
                "consult_id": consult_id,
                "thread_id": thread_id,
            }),
        )
        .await?;
        Ok(consult)
    }

    /// Record a steering verdict.
    pub async fn resolve_consult(
        &self,
        consult_id: &str,
        verdict: SteeringVerdict,
        reason: Option<&str>,
    ) -> Result<()> {
        self.log_event(
            "SteeringConsultResolved",
            json!({
                "consult_id": consult_id,
                "verdict": verdict,
                "reason": reason,
            }),
        )
        .await?;
        Ok(())
    }

    /// Gate a git commit or push mutation.  Allowed when the latest checkpoint
    /// is non-empty and there are no unresolved consults with a `Block`
    /// verdict.  This is intentionally conservative: an empty checkpoint
    /// blocks commits because there is nothing to steer on.
    pub async fn commit_gate(&self) -> Result<SteeringGateResult> {
        let checkpoint = load_checkpoint(&self.root_dir).await?;
        if checkpoint.goal.is_empty() {
            self.log_event(
                "SteeringGateBlocked",
                json!({"reason": "no checkpoint goal"}),
            )
            .await?;
            return Ok(SteeringGateResult {
                allowed: false,
                reason: Some("No steering checkpoint goal found.".to_string()),
                pending_consult_ids: Vec::new(),
            });
        }

        let events = self
            .ledger
            .query(LedgerQuery {
                r#type: Some("SteeringConsultRequested".to_string()),
                ..Default::default()
            })
            .await?;
        let mut pending = Vec::new();
        for event in &events {
            if let Some(id) = event.payload.get("consult_id").and_then(|v| v.as_str()) {
                if self.latest_verdict(id).await?.is_none() {
                    pending.push(id.to_string());
                }
            }
        }

        if !pending.is_empty() {
            self.log_event(
                "SteeringGateBlocked",
                json!({
                    "reason": "pending steering consults",
                    "pending_consult_ids": pending,
                }),
            )
            .await?;
            return Ok(SteeringGateResult {
                allowed: false,
                reason: Some(format!(
                    "Pending steering consults: {}",
                    pending.join(", ")
                )),
                pending_consult_ids: pending,
            });
        }

        // Check the most recent resolved consult; any Block verdict blocks.
        let mut blocked = false;
        for event in events.iter().rev() {
            if let Some(id) = event.payload.get("consult_id").and_then(|v| v.as_str()) {
                if let Some(verdict) = self.latest_verdict(id).await? {
                    if verdict == SteeringVerdict::Block {
                        blocked = true;
                        break;
                    }
                }
            }
        }

        if blocked {
            self.log_event(
                "SteeringGateBlocked",
                json!({"reason": "steering blocked"}),
            )
            .await?;
            return Ok(SteeringGateResult {
                allowed: false,
                reason: Some("Steering verdict is block.".to_string()),
                pending_consult_ids: Vec::new(),
            });
        }

        Ok(SteeringGateResult {
            allowed: true,
            reason: None,
            pending_consult_ids: Vec::new(),
        })
    }

    async fn latest_verdict(&self, consult_id: &str) -> Result<Option<SteeringVerdict>> {
        let events = self
            .ledger
            .query(LedgerQuery {
                r#type: Some("SteeringConsultResolved".to_string()),
                ..Default::default()
            })
            .await?;
        for event in events.iter().rev() {
            if event
                .payload
                .get("consult_id")
                .and_then(|v| v.as_str())
                == Some(consult_id)
            {
                if let Some(v) = event.payload.get("verdict") {
                    return Ok(serde_json::from_value(v.clone()).ok());
                }
            }
        }
        Ok(None)
    }
}
