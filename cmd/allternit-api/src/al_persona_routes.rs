//! Al persona runtime v0.1 (A:// P-T5).
//!
//! The conversational surface over the orchestrator: a user talks to Al; Al
//! normalizes the request into a canonical intent, resolves the execution
//! target through the workspace delegation rules (the same resolution the
//! deterministic orchestrator uses), submits the intent under its own
//! principal (`a://principal/al`, delegator attribution), narrates status,
//! and reports against canonical run state.
//!
//! Posture (AL_IMPLEMENTATION_SPEC §5 never-inherit list): Al plans and
//! delegates only. Zero capabilities: this module never claims jobs, never
//! completes work, and never holds connector secrets. Model assistance uses
//! the existing model router/gateway (`run_completion`) — no new LLM path.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use allternit_cowork_runtime::sqlite_store;
use allternit_cowork_runtime::{
    IntentAction, IntentEnvelope,
};

use crate::auth::{get_user, AuthUser};
use crate::AppState;

pub fn al_persona_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/cowork/al/chat", post(al_chat))
        .route("/cowork/al/sessions/:session_id", get(get_al_session))
}

#[derive(Debug)]
struct AlError {
    status: StatusCode,
    body: Json<Value>,
}

impl AlError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            body: Json(json!({"error": code, "message": message.into()})),
        }
    }
}

impl IntoResponse for AlError {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct AlChatRequest {
    /// Conversation id; a new one is minted when absent.
    pub session_id: Option<String>,
    pub message: String,
    /// Workspace scope (default `default`), e.g. "acme".
    pub workspace: Option<String>,
}

/// The normalized work item Al extracts from a user message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedIntent {
    pub action_type: String,
    pub description: String,
}

/// Deterministic normalization, used whenever model assistance is
/// unavailable (no OS control plane) or returns unparseable output. The
/// first word becomes the action-type prefix (matching delegation rules by
/// prefix); the full message is the description.
pub fn fallback_extract(message: &str) -> ExtractedIntent {
    let first = message.split_whitespace().next().unwrap_or("chat");
    let action_type: String = first
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '.' {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .take(32)
        .collect();
    let action_type = if action_type.is_empty() {
        "chat".to_string()
    } else {
        action_type
    };
    ExtractedIntent {
        action_type,
        description: message.trim().to_string(),
    }
}

/// Parse the model's extraction reply: the first `{ ... }` JSON object with
/// string `action_type`/`description` fields.
pub fn parse_model_extraction(text: &str) -> Option<ExtractedIntent> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    let parsed: Value = serde_json::from_str(text.get(start..=end)?).ok()?;
    let action_type = parsed.get("action_type")?.as_str()?.trim().to_string();
    let description = parsed
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| action_type.clone());
    if action_type.is_empty() || action_type.len() > 64 {
        return None;
    }
    Some(ExtractedIntent {
        action_type,
        description,
    })
}

/// Canonicalize a delegation-rule target into a full principal id (same
/// rules as the orchestrator loop).
pub fn canonicalize_target(workspace: &str, target: &str) -> String {
    if target.contains("://") {
        target.to_string()
    } else if target.starts_with("bot/") || target.contains('/') {
        format!("a://workspace/{workspace}/{target}")
    } else {
        format!("a://workspace/{workspace}/principal/{target}")
    }
}

fn db_error(e: rusqlite::Error) -> AlError {
    AlError::new(StatusCode::INTERNAL_SERVER_ERROR, "store_error", e.to_string())
}

fn transport_error(e: allternit_cowork_runtime::transport::TransportError) -> AlError {
    AlError::new(
        StatusCode::from_u16(e.http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        e.wire(),
        e.message,
    )
}

fn append_al_message(
    conn: &rusqlite::Connection,
    user_id: &str,
    session_id: &str,
    role: &str,
    content: &str,
    intent_id: Option<&str>,
    run_id: Option<&str>,
) -> Result<(), AlError> {
    conn.execute(
        "INSERT INTO cowork_al_messages (id, user_id, session_id, role, content, intent_id, run_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            format!("almsg_{}", uuid::Uuid::new_v4()),
            user_id,
            session_id,
            role,
            content,
            intent_id,
            run_id,
        ],
    )
    .map_err(db_error)?;
    Ok(())
}

/// Best-effort model-assisted intent extraction through the existing model
/// router/gateway. Returns `None` when no OS control plane is configured or
/// the model output does not parse — callers use `fallback_extract`.
async fn model_extract(
    state: &AppState,
    user: &AuthUser,
    message: &str,
) -> Option<ExtractedIntent> {
    // Model assistance requires the OS control plane (the same condition
    // under which /v1/responses runs real inference); otherwise the caller's
    // deterministic fallback applies.
    state.os_control_plane.as_ref()?;
    let org = user.organization_id.clone()?;
    let model_full_id =
        std::env::var("ALLTERNIT_AL_MODEL").unwrap_or_else(|_| "openai/gpt-4o-mini".to_string());

    let db = state.db.clone();
    let lookup_id = model_full_id.clone();
    let model = tokio::task::spawn_blocking(move || {
        let catalog = crate::fabric::model_catalog::ModelCatalog::new(db);
        catalog.seed_builtin().ok()?;
        catalog.get_by_full_id(&lookup_id).ok()?
    })
    .await
    .ok()??;

    let req = crate::fabric_model_routes::ResponsesRequest {
        model: model_full_id,
        messages: vec![
            crate::fabric_model_routes::Message {
                role: "system".to_string(),
                content: "You normalize a user request into a canonical work intent. \
                          Reply with ONLY a JSON object: \
                          {\"action_type\": \"<snake_case prefix, e.g. shell_steps, research>\", \
                           \"description\": \"<one sentence>\"}."
                    .to_string(),
            },
            crate::fabric_model_routes::Message {
                role: "user".to_string(),
                content: message.to_string(),
            },
        ],
        max_tokens: Some(150),
        temperature: Some(0.0),
    };
    let request_id = uuid::Uuid::new_v4().to_string();
    let completion = crate::fabric_model_routes::run_completion(
        state,
        &org,
        user,
        &request_id,
        &model,
        &req,
    )
    .await
    .map_err(|e| {
        warn!(error = ?e.body.0, "Al model-assisted extraction failed; falling back");
    })
    .ok()?;
    parse_model_extraction(&completion.1)
}

/// Talk to Al. Al normalizes the request, resolves the delegation target
/// from the workspace rules, submits a canonical intent under its own
/// principal, and narrates the result. Al claims nothing and executes
/// nothing.
async fn al_chat(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(req): Json<AlChatRequest>,
) -> Result<Json<Value>, AlError> {
    let user = get_user(&headers).ok_or_else(|| {
        AlError::new(StatusCode::UNAUTHORIZED, "unauthorized", "authentication required")
    })?;
    let message = req.message.trim().to_string();
    if message.is_empty() {
        return Err(AlError::new(
            StatusCode::BAD_REQUEST,
            "empty_message",
            "message must not be empty",
        ));
    }
    let session_id = req
        .session_id
        .clone()
        .unwrap_or_else(|| format!("als_{}", uuid::Uuid::new_v4()));
    let workspace = req.workspace.clone().unwrap_or_else(|| "default".to_string());
    let workspace = workspace
        .strip_prefix("a://workspace/")
        .unwrap_or(&workspace)
        .to_string();
    let al_principal = format!("a://workspace/{workspace}/principal/al");

    // Record the user's turn.
    let conn = state.db.connect().map_err(db_error)?;
    append_al_message(&conn, &user.user_id, &session_id, "user", &message, None, None)?;

    // 1. Normalize toward the IntentEnvelope (model-assisted when the
    //    gateway can run a model; deterministic otherwise).
    let extracted = match model_extract(&state, &user, &message).await {
        Some(intent) => intent,
        None => fallback_extract(&message),
    };

    // 2. Resolve the execution target through the delegation rules — the
    //    same resolution the deterministic orchestrator uses.
    let target = sqlite_store::resolve_delegation_rule(&conn, &workspace, &extracted.action_type)
        .map_err(transport_error)?;

    let Some(target) = target else {
        let reply = format!(
            "I can take this on, but no delegation rule in workspace `{workspace}` matches \
             action type `{}`. Add one (action_type prefix → target principal) and ask again.",
            extracted.action_type
        );
        append_al_message(&conn, &user.user_id, &session_id, "assistant", &reply, None, None)?;
        return Ok(Json(json!({
            "session_id": session_id,
            "reply": reply,
            "delegated": false,
            "reason": "no delegation rule matched",
            "extracted": { "action_type": extracted.action_type, "description": extracted.description },
        })));
    };
    let target_principal = canonicalize_target(&workspace, &target);

    // 3. Submit the canonical intent: initiator = user, delegator = Al,
    //    chain [user, al]. Al never appears as executor.
    let envelope = IntentEnvelope {
        version: "a/0.1".to_string(),
        intent_id: format!("al_{}", uuid::Uuid::new_v4()),
        workspace: format!("a://workspace/{workspace}"),
        initiator: user.user_id.clone(),
        delegator: Some(al_principal.clone()),
        target: Some(target_principal.clone()),
        action: IntentAction {
            action_type: extracted.action_type.clone(),
            description: extracted.description.clone(),
            payload: Some(json!({ "message": message, "via": "al_persona" })),
        },
        permissions: vec![],
        compute: None,
        model: None,
        approval: None,
        return_channel: Some(json!({ "channel": "cowork", "session_id": session_id })),
        causation_chain: vec![user.user_id.clone(), al_principal.clone()],
    };
    let mut conn = state.db.connect().map_err(db_error)?;
    let submission = sqlite_store::submit_intent(&mut conn, &envelope).map_err(transport_error)?;
    sqlite_store::set_run_owner(&mut conn, &submission.run_id, &user.user_id)
        .map_err(transport_error)?;

    // 4. Narrate against canonical state: run state + pending approvals.
    let run_state: Option<String> = conn
        .query_row(
            "SELECT state FROM cowork_runs WHERE id = ?1",
            rusqlite::params![submission.run_id],
            |r| r.get(0),
        )
        .ok();
    let pending_approvals: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cowork_approval_bindings WHERE run_id = ?1 AND status = 'pending'",
            rusqlite::params![submission.run_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let run_state_str = run_state.clone().unwrap_or_else(|| "queued".to_string());
    let reply = format!(
        "Delegated to {target_principal} (run {}, state {}). {pending_approvals} approval(s) pending.",
        submission.run_id,
        run_state_str,
    );
    append_al_message(
        &conn,
        &user.user_id,
        &session_id,
        "assistant",
        &reply,
        Some(&submission.intent_id),
        Some(&submission.run_id),
    )?;

    info!(
        user = %user.user_id,
        session = %session_id,
        intent = %submission.intent_id,
        run = %submission.run_id,
        target = %target_principal,
        "Al persona delegated a request"
    );

    Ok(Json(json!({
        "session_id": session_id,
        "reply": reply,
        "delegated": true,
        "intent_id": submission.intent_id,
        "run_id": submission.run_id,
        "created": submission.created,
        "target": target_principal,
        "run_state": run_state,
        "pending_approvals": pending_approvals,
        "extracted": { "action_type": extracted.action_type, "description": extracted.description },
    })))
}

/// Transcript + observed canonical run states for a session (the control
/// surface renders canonical state, never model recollection).
async fn get_al_session(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, AlError> {
    let user = get_user(&headers).ok_or_else(|| {
        AlError::new(StatusCode::UNAUTHORIZED, "unauthorized", "authentication required")
    })?;
    let conn = state.db.connect().map_err(db_error)?;
    let mut stmt = conn
        .prepare(
            "SELECT m.role, m.content, m.intent_id, m.run_id, m.created_at,
                    COALESCE(r.state, '')
             FROM cowork_al_messages m
             LEFT JOIN cowork_runs r ON r.id = m.run_id
             WHERE m.session_id = ?1 AND m.user_id = ?2
             ORDER BY m.created_at ASC",
        )
        .map_err(db_error)?;
    let messages: Vec<Value> = stmt
        .query_map(rusqlite::params![session_id, user.user_id], |r| {
            Ok(json!({
                "role": r.get::<_, String>(0)?,
                "content": r.get::<_, String>(1)?,
                "intent_id": r.get::<_, Option<String>>(2)?,
                "run_id": r.get::<_, Option<String>>(3)?,
                "created_at": r.get::<_, String>(4)?,
                "run_state": r.get::<_, String>(5)?,
            }))
        })
        .map_err(db_error)?
        .collect::<Result<_, _>>()
        .map_err(db_error)?;
    Ok(Json(json!({ "session_id": session_id, "messages": messages })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_extract_first_word_action_type() {
        let intent = fallback_extract("shell_steps run the build and report");
        assert_eq!(intent.action_type, "shell_steps");
        assert_eq!(intent.description, "shell_steps run the build and report");

        let punct = fallback_extract("git-sync please reconcile branches");
        assert_eq!(punct.action_type, "git_sync");

        let empty = fallback_extract("   ");
        assert_eq!(empty.action_type, "chat");
    }

    #[test]
    fn parse_model_extraction_strict_json() {
        let text = "Here you go: {\"action_type\": \"research\", \"description\": \"Compare vendors.\"} hope that helps";
        let parsed = parse_model_extraction(text).unwrap();
        assert_eq!(parsed.action_type, "research");
        assert_eq!(parsed.description, "Compare vendors.");

        assert!(parse_model_extraction("no json here").is_none());
        assert!(parse_model_extraction("{\"action_type\": \"\"}").is_none());
        // description defaults to action_type when absent
        let nodesc = parse_model_extraction("{\"action_type\": \"shell\"}").unwrap();
        assert_eq!(nodesc.description, "shell");
    }

    #[test]
    fn canonicalize_target_matches_orchestrator_rules() {
        assert_eq!(
            canonicalize_target("acme", "gizzi"),
            "a://workspace/acme/principal/gizzi"
        );
        assert_eq!(
            canonicalize_target("acme", "bot/research"),
            "a://workspace/acme/bot/research"
        );
        assert_eq!(
            canonicalize_target("acme", "a://workspace/acme/principal/x"),
            "a://workspace/acme/principal/x"
        );
    }

    #[test]
    fn al_envelope_posture_delegates_without_executing() {
        // Al's envelope: delegator = al, chain [user, al], target = worker.
        // Al never claims, so executor attribution stays with the worker —
        // the envelope carries no executor field at all.
        let envelope = IntentEnvelope {
            version: "a/0.1".to_string(),
            intent_id: "al_test".to_string(),
            workspace: "a://workspace/acme".to_string(),
            initiator: "user_1".to_string(),
            delegator: Some("a://workspace/acme/principal/al".to_string()),
            target: Some("a://workspace/acme/principal/gizzi".to_string()),
            action: IntentAction {
                action_type: "shell_steps".to_string(),
                description: "do the thing".to_string(),
                payload: None,
            },
            permissions: vec![],
            compute: None,
            model: None,
            approval: None,
            return_channel: None,
            causation_chain: vec![
                "user_1".to_string(),
                "a://workspace/acme/principal/al".to_string(),
            ],
        };
        assert!(envelope.delegator.as_ref().unwrap().ends_with("/principal/al"));
        assert_eq!(envelope.causation_chain.len(), 2);
        assert!(!envelope.target.as_ref().unwrap().ends_with("/principal/al"));
    }
}
