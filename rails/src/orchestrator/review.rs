//! Review request / accept / reject logging for executor outputs.
//!
//! Reviews are ledger events. The actual review payload is stored elsewhere
//! (the executor's notes file, a mail thread, or a context pack) and referenced
//! by `notes_ref` when a decision is recorded.

use anyhow::Result;
use chrono::Utc;
use serde_json::json;

use crate::core::ids::create_event_id;
use crate::core::types::{Actor, AllternitEvent};
use crate::ledger::Ledger;

/// Append a `ReviewPending` event for the given executor slug.
pub async fn log_review_pending(
    ledger: &Ledger,
    actor: &Actor,
    slug: &str,
    notes_ref: Option<&str>,
) -> Result<String> {
    log_review_event(ledger, actor, "ReviewPending", slug, None, notes_ref).await
}

/// Append a `ReviewAccepted` event for the given executor slug.
pub async fn log_review_accepted(
    ledger: &Ledger,
    actor: &Actor,
    slug: &str,
    notes_ref: Option<&str>,
) -> Result<String> {
    log_review_event(ledger, actor, "ReviewAccepted", slug, Some(true), notes_ref).await
}

/// Append a `ReviewRejected` event for the given executor slug.
pub async fn log_review_rejected(
    ledger: &Ledger,
    actor: &Actor,
    slug: &str,
    notes_ref: Option<&str>,
) -> Result<String> {
    log_review_event(ledger, actor, "ReviewRejected", slug, Some(false), notes_ref).await
}

async fn log_review_event(
    ledger: &Ledger,
    actor: &Actor,
    event_type: &str,
    slug: &str,
    accepted: Option<bool>,
    notes_ref: Option<&str>,
) -> Result<String> {
    let mut payload = json!({ "slug": slug });
    if let Some(accepted) = accepted {
        payload["accepted"] = json!(accepted);
    }
    if let Some(notes_ref) = notes_ref {
        payload["notes_ref"] = json!(notes_ref);
    }

    let event = AllternitEvent {
        event_id: create_event_id(),
        ts: Utc::now().to_rfc3339(),
        actor: actor.clone(),
        scope: None,
        r#type: event_type.to_string(),
        payload,
        provenance: None,
    };

    ledger.append(event).await
}
