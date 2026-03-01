use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use chrono::Utc;
use serde_json::{json, Value};

use crate::core::ids::create_event_id;
use crate::core::types::{A2REvent, Actor, ActorType, LedgerQuery};
use crate::ledger::Ledger;
use crate::mail::projection::append_thread_event;

#[derive(Clone)]
pub struct MailOptions {
    pub root_dir: Option<PathBuf>,
    pub ledger: Arc<Ledger>,
    pub actor_id: Option<String>,
    pub actor_type: Option<ActorType>,
}

pub struct Mail {
    root_dir: PathBuf,
    ledger: Arc<Ledger>,
    actor: Actor,
}

impl Mail {
    pub fn new(opts: MailOptions) -> Self {
        let root_dir = opts
            .root_dir
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
        let actor = Actor {
            r#type: opts.actor_type.unwrap_or(ActorType::Agent),
            id: opts.actor_id.unwrap_or_else(|| "mail".to_string()),
        };
        Self {
            root_dir,
            ledger: opts.ledger,
            actor,
        }
    }

    pub async fn list_messages(
        &self,
        thread_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<A2REvent>> {
        let mut events = self
            .ledger
            .query(LedgerQuery::default())
            .await?
            .into_iter()
            .filter(|evt| {
                if let Some(tid) = thread_id {
                    evt.payload.get("thread_id").and_then(|v| v.as_str()) == Some(tid)
                } else {
                    evt.payload.get("thread_id").is_some()
                }
            })
            .collect::<Vec<_>>();
        events.sort_by(|a, b| a.ts.cmp(&b.ts));
        if events.len() > limit {
            events.truncate(limit);
        }
        Ok(events)
    }

    pub async fn acknowledge_message(
        &self,
        thread_id: &str,
        message_id: &str,
        note: Option<&str>,
    ) -> Result<String> {
        self.log_event(
            "MessageAcknowledged",
            json!({
                "thread_id": thread_id,
                "message_id": message_id,
                "note": note
            }),
        )
        .await
    }

    pub async fn share_asset(
        &self,
        thread_id: &str,
        asset_ref: &str,
        note: Option<&str>,
    ) -> Result<String> {
        self.log_event(
            "MailAssetShared",
            json!({
                "thread_id": thread_id,
                "asset_ref": asset_ref,
                "note": note
            }),
        )
        .await
    }

    pub async fn archive_thread(
        &self,
        thread_id: &str,
        archive_path: &str,
        reason: Option<&str>,
    ) -> Result<String> {
        self.log_event(
            "MailThreadArchived",
            json!({
                "thread_id": thread_id,
                "archive_path": archive_path,
                "reason": reason
            }),
        )
        .await
    }

    pub async fn guard_action(&self, action: &str, detail: Option<&str>) -> Result<String> {
        self.log_event(
            "MailGuardAction",
            json!({
                "action": action,
                "detail": detail
            }),
        )
        .await
    }

    pub async fn log_event(&self, event_type: &str, payload: Value) -> Result<String> {
        let event = self.event(event_type, payload);
        let event_id = event.event_id.clone();
        self.emit(event).await?;
        Ok(event_id)
    }

    pub async fn ensure_thread(&self, topic: &str) -> Result<String> {
        let thread_id = canonical_thread_id(topic)?;
        if self.thread_exists(&thread_id).await? {
            return Ok(thread_id);
        }
        let event = self.event(
            "ThreadCreated",
            json!({ "thread_id": thread_id, "topic": topic }),
        );
        self.emit(event).await?;
        Ok(thread_id)
    }

    pub async fn send_message(
        &self,
        thread_id: &str,
        body_ref: &str,
        attachments: Vec<String>,
    ) -> Result<()> {
        ensure_thread_id(thread_id)?;
        let event = self.event(
            "MessageSent",
            json!({
                "thread_id": thread_id,
                "body_ref": body_ref,
                "attachments": attachments,
                "sent_at": Utc::now().to_rfc3339()
            }),
        );
        self.emit(event).await?;
        Ok(())
    }

    pub async fn request_review(
        &self,
        thread_id: &str,
        wih_id: &str,
        diff_ref: &str,
    ) -> Result<()> {
        ensure_thread_id(thread_id)?;
        let event = self.event(
            "ReviewRequested",
            json!({
                "thread_id": thread_id,
                "wih_id": wih_id,
                "diff_ref": diff_ref
            }),
        );
        self.emit(event).await?;
        Ok(())
    }

    pub async fn decide_review(
        &self,
        thread_id: &str,
        decision: &str,
        notes_ref: Option<String>,
    ) -> Result<()> {
        ensure_thread_id(thread_id)?;
        let event = self.event(
            "ReviewDecision",
            json!({
                "thread_id": thread_id,
                "decision": decision,
                "notes_ref": notes_ref
            }),
        );
        self.emit(event).await?;
        Ok(())
    }

    fn event(&self, event_type: &str, payload: serde_json::Value) -> A2REvent {
        A2REvent {
            event_id: create_event_id(),
            ts: Utc::now().to_rfc3339(),
            actor: self.actor.clone(),
            scope: None,
            r#type: event_type.to_string(),
            payload,
            provenance: None,
        }
    }

    async fn emit(&self, event: A2REvent) -> Result<()> {
        self.ledger.append(event.clone()).await?;
        append_thread_event(&self.root_dir, &event)?;
        Ok(())
    }

    async fn thread_exists(&self, thread_id: &str) -> Result<bool> {
        let events = self
            .ledger
            .query(crate::core::types::LedgerQuery::default())
            .await?;
        Ok(events.iter().any(|evt| {
            evt.r#type == "ThreadCreated"
                && evt.payload.get("thread_id").and_then(|v| v.as_str()) == Some(thread_id)
        }))
    }
}

fn canonical_thread_id(topic: &str) -> Result<String> {
    if topic.starts_with("dag:") || topic.starts_with("wih:") {
        Ok(topic.to_string())
    } else {
        anyhow::bail!("thread topic must be dag:<id> or wih:<id>")
    }
}

fn ensure_thread_id(thread_id: &str) -> Result<()> {
    if thread_id.starts_with("dag:") || thread_id.starts_with("wih:") {
        Ok(())
    } else {
        anyhow::bail!("thread_id must be dag:<id> or wih:<id>")
    }
}
