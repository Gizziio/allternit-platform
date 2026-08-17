//! Inbound webhook triggers (`/api/v1/webhook-triggers` + public `/webhooks/inbound/:id`).
//!
//! An organization creates a trigger that targets a specific bot. External systems
//! POST to the public inbound URL with an `X-Webhook-Signature` header containing
//! the hex HMAC-SHA256 of the raw body, keyed by the trigger's secret. When the
//! signature verifies, the platform creates a Rails ticket assigned to the target
//! bot and records the delivery attempt.

use axum::{
    body::Bytes,
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use hmac::{Hmac, Mac};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::sync::Arc;
use tracing::{info, warn};

use crate::{auth::AuthUser, error::ApiError, AppState};
use allternit_agent_system_rails::rails_id::{HierarchicalId, TicketId};
use allternit_agent_system_rails::tickets::{
    Ticket, TicketKind, TicketPriority, TicketStatus, TicketStore,
};

type HmacSha256 = Hmac<Sha256>;

pub fn webhook_trigger_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/webhook-triggers", get(list_triggers).post(create_trigger))
        .route(
            "/webhook-triggers/:id",
            get(get_trigger)
                .patch(update_trigger)
                .delete(delete_trigger),
        )
        .route(
            "/webhook-triggers/:id/deliveries",
            get(list_deliveries),
        )
}

pub fn webhook_trigger_public_router() -> Router<Arc<AppState>> {
    Router::new().route("/webhooks/inbound/:id", post(receive_webhook))
}

// ─── Models ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CreateTriggerBody {
    name: String,
    target_bot_id: String,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateTriggerBody {
    name: Option<String>,
    target_bot_id: Option<String>,
    active: Option<bool>,
}

#[derive(Debug, Serialize)]
struct TriggerRow {
    id: String,
    org_id: String,
    name: String,
    target_bot_id: String,
    active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DeliveryRow {
    id: String,
    trigger_id: String,
    event: Option<String>,
    status: String,
    response_status: Option<i32>,
    error: Option<String>,
    attempts: i32,
    created_at: String,
    updated_at: String,
}

fn read_trigger(row: &rusqlite::Row<'_>) -> rusqlite::Result<TriggerRow> {
    Ok(TriggerRow {
        id: row.get(0)?,
        org_id: row.get(1)?,
        name: row.get(2)?,
        target_bot_id: row.get(3)?,
        active: row.get::<_, i32>(4)? != 0,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn read_delivery(row: &rusqlite::Row<'_>) -> rusqlite::Result<DeliveryRow> {
    Ok(DeliveryRow {
        id: row.get(0)?,
        trigger_id: row.get(1)?,
        event: row.get(2)?,
        status: row.get(3)?,
        response_status: row.get(4)?,
        error: row.get(5)?,
        attempts: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn require_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id
        .clone()
        .ok_or_else(|| ApiError::BadRequest("organization required".into()))
}

fn generate_secret() -> String {
    use rand::distributions::{Alphanumeric, DistString};
    Alphanumeric.sample_string(&mut rand::thread_rng(), 48)
}

fn verify_hmac(secret: &str, body: &[u8], signature: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    let expected = hex::encode(mac.finalize().into_bytes());
    expected.as_bytes() == signature.as_bytes()
}

// ─── Protected CRUD ─────────────────────────────────────────────────────────

async fn create_trigger(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateTriggerBody>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".into()));
    }
    if body.target_bot_id.trim().is_empty() {
        return Err(ApiError::BadRequest("target_bot_id is required".into()));
    }

    let org_id = require_org(&user)?;
    let id = uuid::Uuid::new_v4().to_string();
    let secret = generate_secret();

    let db = state.db.clone();
    let lookup_id = id.clone();
    let trigger = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO webhook_triggers (id, org_id, name, target_bot_id, secret, active)
             VALUES (?1, ?2, ?3, ?4, ?5, 1)",
            params![id, org_id, body.name, body.target_bot_id, secret],
        )?;
        conn.query_row(
            "SELECT id, org_id, name, target_bot_id, active, created_at, updated_at
             FROM webhook_triggers WHERE id = ?1",
            params![lookup_id],
            read_trigger,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    info!(
        "Created webhook trigger {} for org {} targeting bot {}",
        trigger.id, trigger.org_id, trigger.target_bot_id
    );
    Ok((StatusCode::CREATED, Json(json!({ "trigger": trigger }))))
}

async fn list_triggers(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, org_id, name, target_bot_id, active, created_at, updated_at
             FROM webhook_triggers WHERE org_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(params![org_id], read_trigger)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    Ok(Json(json!({ "triggers": rows, "total": rows.len() })))
}

async fn get_trigger(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, org_id, name, target_bot_id, active, created_at, updated_at
             FROM webhook_triggers WHERE id = ?1 AND org_id = ?2",
            params![id, org_id],
            read_trigger,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            ApiError::NotFound("trigger not found".into())
        } else {
            ApiError::DbError(e.to_string())
        }
    })?;

    Ok(Json(json!({ "trigger": row })))
}

async fn update_trigger(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTriggerBody>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;

    if let Some(ref name) = body.name {
        if name.trim().is_empty() {
            return Err(ApiError::BadRequest("name cannot be empty".into()));
        }
    }
    if let Some(ref bot_id) = body.target_bot_id {
        if bot_id.trim().is_empty() {
            return Err(ApiError::BadRequest("target_bot_id cannot be empty".into()));
        }
    }

    let db = state.db.clone();
    let lookup_id = id.clone();
    let trigger = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sets = Vec::new();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(name) = body.name {
            sets.push("name = ?".to_string());
            args.push(Box::new(name));
        }
        if let Some(bot_id) = body.target_bot_id {
            sets.push("target_bot_id = ?".to_string());
            args.push(Box::new(bot_id));
        }
        if let Some(active) = body.active {
            sets.push("active = ?".to_string());
            args.push(Box::new(if active { 1 } else { 0 }));
        }

        if sets.is_empty() {
            return Err::<_, Box<dyn std::error::Error + Send + Sync>>(
                ApiError::BadRequest("no fields to update".into()).into(),
            );
        }

        sets.push("updated_at = CURRENT_TIMESTAMP".to_string());
        let sql = format!(
            "UPDATE webhook_triggers SET {} WHERE id = ? AND org_id = ?",
            sets.join(", ")
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        params.push(&lookup_id);
        params.push(&org_id);
        let changed = conn.execute(&sql, params.as_slice())?;
        if changed == 0 {
            return Err::<_, Box<dyn std::error::Error + Send + Sync>>(
                ApiError::NotFound("trigger not found".into()).into(),
            );
        }

        conn.query_row(
            "SELECT id, org_id, name, target_bot_id, active, created_at, updated_at
             FROM webhook_triggers WHERE id = ?1 AND org_id = ?2",
            rusqlite::params![lookup_id, org_id],
            read_trigger,
        )
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: Box<dyn std::error::Error + Send + Sync>| {
        ApiError::Internal(e.to_string())
    })?;

    Ok(Json(json!({ "trigger": trigger })))
}

async fn delete_trigger(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let deleted = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM webhook_triggers WHERE id = ?1 AND org_id = ?2",
            params![id, org_id],
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    if deleted == 0 {
        return Err(ApiError::NotFound("trigger not found".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn list_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify ownership in the same query.
        let mut stmt = conn.prepare(
            "SELECT d.id, d.trigger_id, d.event, d.status, d.response_status, d.error,
                    d.attempts, d.created_at, d.updated_at
             FROM webhook_trigger_deliveries d
             JOIN webhook_triggers t ON t.id = d.trigger_id
             WHERE d.trigger_id = ?1 AND t.org_id = ?2
             ORDER BY d.created_at DESC
             LIMIT 100",
        )?;
        let rows = stmt
            .query_map(params![id, org_id], read_delivery)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    Ok(Json(json!({ "deliveries": rows, "total": rows.len() })))
}

// ─── Public receiver ────────────────────────────────────────────────────────

async fn receive_webhook(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: axum::http::HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    let signature = headers
        .get("x-webhook-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let db = state.db.clone();
    let trigger_id = id.clone();
    let trigger = match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, name, target_bot_id, secret, active
             FROM webhook_triggers WHERE id = ?1",
            params![trigger_id],
            read_trigger_with_secret,
        )
        .optional()
    })
    .await
    {
        Ok(Ok(Some(t))) => t,
        Ok(Ok(None)) => {
            warn!("Inbound webhook received for unknown trigger {}", id);
            return (StatusCode::NOT_FOUND, Json(json!({"error": "trigger_not_found"})));
        }
        Ok(Err(e)) => {
            warn!("DB error looking up webhook trigger {}: {}", id, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal_error"})),
            );
        }
        Err(e) => {
            warn!("Task error looking up webhook trigger {}: {}", id, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal_error"})),
            );
        }
    };

    if !trigger.active {
        warn!("Inbound webhook received for inactive trigger {}", id);
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "trigger_inactive"})),
        );
    }

    if signature.is_empty() || !verify_hmac(&trigger.secret, &body, &signature) {
        warn!("Inbound webhook signature verification failed for trigger {}", id);
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "invalid_signature"})),
        );
    }

    let event_name = headers
        .get("x-webhook-event")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("webhook.received")
        .to_string();

    let payload_json: Value = serde_json::from_slice(&body).unwrap_or_else(|_| {
        json!({
            "raw": String::from_utf8_lossy(&body).to_string(),
        })
    });

    let ticket_result = create_ticket_from_webhook(&state, &trigger, &event_name, &payload_json);

    let delivery_status;
    let response_status;
    let error_msg;
    match ticket_result {
        Ok(ticket_id) => {
            info!(
                "Webhook trigger {} created ticket {} for bot {}",
                trigger.id, ticket_id, trigger.target_bot_id
            );
            delivery_status = "delivered";
            response_status = Some(201);
            error_msg = None;
        }
        Err(e) => {
            warn!(
                "Webhook trigger {} failed to create ticket for bot {}: {}",
                trigger.id, trigger.target_bot_id, e
            );
            delivery_status = "failed";
            response_status = Some(500);
            error_msg = Some(e.to_string());
        }
    }

    // Record delivery attempt.
    let db = state.db.clone();
    let trigger_id = trigger.id.clone();
    let event2 = event_name.clone();
    let payload_str = payload_json.to_string();
    let status2 = delivery_status.to_string();
    let error2 = error_msg.clone();
    let _ = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO webhook_trigger_deliveries
             (id, trigger_id, event, payload, status, response_status, error, attempts, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![
                uuid::Uuid::new_v4().to_string(),
                trigger_id,
                event2,
                payload_str,
                status2,
                response_status,
                error2,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    if let Some(err) = error_msg {
        return (
            StatusCode::ACCEPTED,
            Json(json!({
                "ok": false,
                "ticket_error": err,
            })),
        );
    }

    (StatusCode::ACCEPTED, Json(json!({ "ok": true })))
}

#[derive(Debug)]
struct TriggerWithSecret {
    id: String,
    name: String,
    target_bot_id: String,
    secret: String,
    active: bool,
}

fn read_trigger_with_secret(row: &rusqlite::Row<'_>) -> rusqlite::Result<TriggerWithSecret> {
    Ok(TriggerWithSecret {
        id: row.get(0)?,
        name: row.get(1)?,
        target_bot_id: row.get(2)?,
        secret: row.get(3)?,
        active: row.get::<_, i32>(4)? != 0,
    })
}

fn create_ticket_from_webhook(
    state: &AppState,
    trigger: &TriggerWithSecret,
    event: &str,
    payload: &Value,
) -> anyhow::Result<String> {
    let store = TicketStore::new(&state.rails.root_dir)?;
    let now = chrono::Utc::now();
    let id = TicketId::mint(format!("{}:{}:{}", trigger.id, event, now).as_bytes());

    let title = format!("Inbound webhook: {}", trigger.name);
    let description = format!(
        "Webhook trigger `{}` ({}) received event `{}` for bot `{}`.\n\nPayload:\n```json\n{}\n```",
        trigger.name,
        trigger.id,
        event,
        trigger.target_bot_id,
        serde_json::to_string_pretty(payload).unwrap_or_else(|_| payload.to_string())
    );

    let ticket = Ticket {
        id: id.clone(),
        hierarchical_id: HierarchicalId::root(id.clone()),
        title,
        description,
        design: None,
        acceptance: None,
        notes: Vec::new(),
        status: TicketStatus::Open,
        kind: TicketKind::Task,
        priority: TicketPriority::P1,
        assignee: Some(trigger.target_bot_id.clone()),
        estimate_minutes: None,
        due_at: None,
        defer_until: None,
        labels: vec!["webhook".to_string(), event.to_string()],
        external_ref: Some(trigger.id.clone()),
        metadata: {
            let mut m = std::collections::HashMap::new();
            m.insert("trigger_id".to_string(), json!(trigger.id));
            m.insert("event".to_string(), json!(event));
            m
        },
        created_at: now,
        updated_at: now,
        closed_at: None,
        close_reason: None,
    };

    store.create(ticket)?;
    Ok(id.to_string())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hmac_verification_accepts_valid_signature() {
        let secret = "super-secret";
        let body = b"hello world";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let sig = hex::encode(mac.finalize().into_bytes());
        assert!(verify_hmac(secret, body, &sig));
    }

    #[test]
    fn hmac_verification_rejects_invalid_signature() {
        let secret = "super-secret";
        let body = b"hello world";
        assert!(!verify_hmac(secret, body, "deadbeef"));
    }
}
