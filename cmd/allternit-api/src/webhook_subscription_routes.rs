//! Webhook subscription management (`/beta/webhooks`) and event delivery.
//!
//! Subscriptions are scoped to an organization. When a subscribed event
//! occurs, the API POSTs a signed JSON payload to the subscription URL and
//! records the delivery attempt in `webhook_deliveries` for observability and
//! retries.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use hmac::{Hmac, Mac};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::sync::Arc;
use tracing::{info, warn};

use crate::{auth::AuthUser, error::ApiError, AppState};

type HmacSha256 = Hmac<Sha256>;

/// Event emitted when a new event is appended to a managed session.
pub const SESSION_EVENT: &str = "session.event_created";
/// Event emitted when a deployment run is updated to a terminal status.
pub const DEPLOYMENT_RUN_EVENT: &str = "deployment.run_updated";

pub fn webhook_subscription_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/beta/webhooks", get(list_subscriptions).post(create_subscription))
        .route(
            "/beta/webhooks/:id",
            get(get_subscription)
                .patch(update_subscription)
                .delete(delete_subscription),
        )
}

#[derive(Debug, Deserialize)]
struct CreateSubscriptionBody {
    url: String,
    events: Vec<String>,
    secret: String,
}

#[derive(Debug, Deserialize, Default)]
struct UpdateSubscriptionBody {
    url: Option<String>,
    events: Option<Vec<String>>,
    secret: Option<String>,
    active: Option<bool>,
}

#[derive(Debug, Serialize)]
struct SubscriptionRow {
    id: String,
    org_id: String,
    url: String,
    events: Vec<String>,
    active: bool,
    created_at: String,
    updated_at: String,
}

fn read_subscription(row: &rusqlite::Row<'_>) -> rusqlite::Result<SubscriptionRow> {
    let events_json: String = row.get(3)?;
    Ok(SubscriptionRow {
        id: row.get(0)?,
        org_id: row.get(1)?,
        url: row.get(2)?,
        events: serde_json::from_str(&events_json).unwrap_or_default(),
        active: row.get::<_, i32>(4)? != 0,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn validate_subscription_body(url: &str, events: &[String], secret: &str) -> Result<(), ApiError> {
    if url.is_empty() || !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(ApiError::BadRequest("url must be an http/https URL".into()));
    }
    if events.is_empty() || events.iter().any(|e| e.is_empty()) {
        return Err(ApiError::BadRequest("events must be a non-empty array of strings".into()));
    }
    if secret.is_empty() {
        return Err(ApiError::BadRequest("secret is required".into()));
    }
    Ok(())
}

fn require_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id
        .clone()
        .ok_or_else(|| ApiError::BadRequest("organization required".into()))
}

async fn create_subscription(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateSubscriptionBody>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    validate_subscription_body(&body.url, &body.events, &body.secret)?;
    let org_id = require_org(&user)?;
    let id = uuid::Uuid::new_v4().to_string();
    let events_json =
        serde_json::to_string(&body.events).map_err(|e| ApiError::Internal(e.to_string()))?;

    let db = state.db.clone();
    let lookup_id = id.clone();
    let subscription = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO webhook_subscriptions (id, org_id, url, events, secret, active)
             VALUES (?1, ?2, ?3, ?4, ?5, 1)",
            params![id, org_id, body.url, events_json, body.secret],
        )?;
        conn.query_row(
            "SELECT id, org_id, url, events, active, created_at, updated_at
             FROM webhook_subscriptions WHERE id = ?1",
            params![lookup_id],
            read_subscription,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    info!("Created webhook subscription {} for org {}", subscription.id, subscription.org_id);
    Ok((StatusCode::CREATED, Json(json!({"subscription": subscription}))))
}

async fn list_subscriptions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, org_id, url, events, active, created_at, updated_at
             FROM webhook_subscriptions WHERE org_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(params![org_id], read_subscription)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({"subscriptions": rows, "total": rows.len()})))
}

async fn get_subscription(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, org_id, url, events, active, created_at, updated_at
             FROM webhook_subscriptions WHERE id = ?1 AND org_id = ?2",
            params![id, org_id],
            read_subscription,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            ApiError::NotFound("subscription not found".into())
        } else {
            ApiError::DbError(e.to_string())
        }
    })?;
    Ok(Json(json!({"subscription": row})))
}

async fn update_subscription(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSubscriptionBody>,
) -> Result<Json<Value>, ApiError> {
    let org_id = require_org(&user)?;

    if let Some(ref url) = body.url {
        if url.is_empty() || (!url.starts_with("http://") && !url.starts_with("https://")) {
            return Err(ApiError::BadRequest("url must be an http/https URL".into()));
        }
    }
    if let Some(ref events) = body.events {
        if events.is_empty() || events.iter().any(|e| e.is_empty()) {
            return Err(ApiError::BadRequest(
                "events must be a non-empty array of strings".into(),
            ));
        }
    }
    if let Some(ref secret) = body.secret {
        if secret.is_empty() {
            return Err(ApiError::BadRequest("secret is required".into()));
        }
    }

    let has_fields = body.url.is_some()
        || body.events.is_some()
        || body.secret.is_some()
        || body.active.is_some();
    if !has_fields {
        return Err(ApiError::BadRequest("no fields provided".into()));
    }

    let db = state.db.clone();
    let lookup_id = id.clone();
    let affected = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sets: Vec<&'static str> = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(url) = body.url {
            sets.push("url = ?");
            params.push(Box::new(url));
        }
        if let Some(events) = body.events {
            sets.push("events = ?");
            params.push(Box::new(serde_json::to_string(&events).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(Box::new(e))
            })?));
        }
        if let Some(secret) = body.secret {
            sets.push("secret = ?");
            params.push(Box::new(secret));
        }
        if let Some(active) = body.active {
            sets.push("active = ?");
            params.push(Box::new(if active { 1 } else { 0 }));
        }

        sets.push("updated_at = CURRENT_TIMESTAMP");

        let sql = format!(
            "UPDATE webhook_subscriptions SET {} WHERE id = ? AND org_id = ?",
            sets.join(", ")
        );
        let mut stmt = conn.prepare(&sql)?;
        for (i, param) in params.iter().enumerate() {
            stmt.raw_bind_parameter(i + 1, param.as_ref())?;
        }
        stmt.raw_bind_parameter(params.len() + 1, &id)?;
        stmt.raw_bind_parameter(params.len() + 2, &org_id)?;
        stmt.raw_execute()
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    if affected == 0 {
        return Err(ApiError::NotFound("subscription not found".into()));
    }

    let db = state.db.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, org_id, url, events, active, created_at, updated_at
             FROM webhook_subscriptions WHERE id = ?1",
            params![lookup_id],
            read_subscription,
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;
    Ok(Json(json!({"subscription": row})))
}

async fn delete_subscription(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let org_id = require_org(&user)?;
    let db = state.db.clone();
    let affected = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM webhook_subscriptions WHERE id = ?1 AND org_id = ?2",
            params![id, org_id],
        )
    })
    .await
    .map_err(|e| ApiError::Internal(e.to_string()))?
    .map_err(|e: rusqlite::Error| ApiError::DbError(e.to_string()))?;

    if affected == 0 {
        return Err(ApiError::NotFound("subscription not found".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Deliver a session event to all active subscriptions in the organization.
pub async fn deliver_session_event(
    state: Arc<AppState>,
    org_id: Option<&str>,
    session_id: &str,
    event: &Value,
) {
    let Some(org_id) = org_id else { return };
    let payload = json!({
        "event": SESSION_EVENT,
        "session_id": session_id,
        "event_data": event,
    });
    deliver_event(state, org_id, SESSION_EVENT, payload).await;
}

/// Deliver a deployment run update to all active subscriptions in the organization.
pub async fn deliver_deployment_run_update(
    state: Arc<AppState>,
    org_id: Option<&str>,
    deployment_id: &str,
    run: &Value,
) {
    let Some(org_id) = org_id else { return };
    let payload = json!({
        "event": DEPLOYMENT_RUN_EVENT,
        "deployment_id": deployment_id,
        "run": run,
    });
    deliver_event(state, org_id, DEPLOYMENT_RUN_EVENT, payload).await;
}

async fn deliver_event(state: Arc<AppState>, org_id: &str, event: &str, payload: Value) {
    let db = state.db.clone();
    let org_id = org_id.to_string();
    let event = event.to_string();

    let subscriptions = match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, url, secret, events FROM webhook_subscriptions
             WHERE org_id = ?1 AND active = 1",
        )?;
        let rows = stmt
            .query_map(params![org_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await
    {
        Ok(Ok(rows)) => rows,
        Ok(Err(e)) => {
            warn!("failed to load webhook subscriptions: {}", e);
            return;
        }
        Err(e) => {
            warn!("webhook subscription lookup panicked: {}", e);
            return;
        }
    };

    for (sub_id, url, secret, events_json) in subscriptions {
        let events: Vec<String> = serde_json::from_str(&events_json).unwrap_or_default();
        if !events.iter().any(|e| e == &event || e == "*") {
            continue;
        }

        let delivery_id = uuid::Uuid::new_v4().to_string();
        let payload_str = payload.to_string();
        let event_for_db = event.clone();
        let db = state.db.clone();
        let delivery_id_for_spawn = delivery_id.clone();
        if let Err(e) = tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "INSERT INTO webhook_deliveries (id, subscription_id, event, payload, status, attempts)
                 VALUES (?1, ?2, ?3, ?4, 'pending', 0)",
                params![delivery_id_for_spawn, sub_id, event_for_db, payload_str],
            )?;
            Ok::<_, rusqlite::Error>(())
        })
        .await
        {
            warn!("failed to record pending webhook delivery: {}", e);
            continue;
        }

        let state = state.clone();
        let payload = payload.clone();
        tokio::spawn(async move {
            attempt_delivery(state, delivery_id, url, secret, payload).await;
        });
    }
}

async fn attempt_delivery(
    state: Arc<AppState>,
    delivery_id: String,
    url: String,
    secret: String,
    payload: Value,
) {
    let body_bytes = match serde_json::to_vec(&payload) {
        Ok(bytes) => bytes,
        Err(e) => {
            warn!("failed to serialize webhook payload: {}", e);
            record_delivery_result(state, delivery_id, "failed", None, None, Some(e.to_string())).await;
            return;
        }
    };
    let signature = sign_payload(&secret, &body_bytes);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let result = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Allternit-Signature", signature)
        .body(body_bytes)
        .send()
        .await;

    let (status, response_status, response_body, error) = match result {
        Ok(resp) => {
            let code = resp.status().as_u16() as i32;
            let body_text = resp.text().await.unwrap_or_default();
            let delivery_status = if (200..300).contains(&code) { "delivered" } else { "failed" };
            (delivery_status, Some(code), Some(body_text), None)
        }
        Err(e) => ("failed", None, None, Some(e.to_string())),
    };

    record_delivery_result(state, delivery_id, status, response_status, response_body, error).await;
}

async fn record_delivery_result(
    state: Arc<AppState>,
    delivery_id: String,
    status: &str,
    response_status: Option<i32>,
    response_body: Option<String>,
    error: Option<String>,
) {
    let db = state.db.clone();
    let status = status.to_string();
    if let Err(e) = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE webhook_deliveries
             SET status = ?1, response_status = ?2, response_body = ?3, error = ?4,
                 attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?5",
            params![status, response_status, response_body, error, delivery_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await
    {
        warn!("failed to record webhook delivery result: {}", e);
    }
}

fn sign_payload(secret: &str, body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(body);
    hex::encode(mac.finalize().into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use std::collections::HashMap;
    use std::path::Path as FsPath;
    use std::sync::{Arc, Mutex};
    use tokio::sync::RwLock;
    use tower::ServiceExt;

    #[derive(Clone)]
    struct ReceivedRequest {
        signature: Option<String>,
        body: Value,
    }

    fn test_user(id: &str, org_id: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: id.to_string(),
            email: Some(format!("{}@example.test", id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "allternit-webhooks-{}-{}",
            tag,
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    async fn test_app_state(temp: &FsPath) -> Arc<AppState> {
        let config = crate::AppConfig {
            company: Default::default(),
            user: Default::default(),
        };
        let db = crate::db::DbHandle::new(temp.join("test.db")).expect("test db");
        let auth_config = crate::auth::AuthConfig::from_app_config(&config);
        let jwks = crate::auth::JwksManager::new(&auth_config);
        let rails = crate::rails::RailsState::new(temp.join("rails"))
            .await
            .expect("test rails");
        Arc::new(AppState {
            config,
            db,
            data_dir: temp.to_path_buf(),
            jwks,
            auth_config,
            vm_driver: None,
            bot_desktop_sessions: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            rails,
            vm_sessions: crate::vm_session_routes::new_vm_session_store(),
            cowork_scheduler: None,
            cowork_background: None,
            cowork_run_manager: None,
            webhook_secret: None,
            office_runtime: Arc::new(RwLock::new(
                crate::office_routes::OfficeRuntimeFile::default(),
            )),
            design_skill_cache: crate::design_connector_routes::DesignSkillCache::new(),
            terminal_sessions: crate::terminal_routes::TerminalSessionStore::new(),
            mcp_dispatcher: crate::mcp_dispatcher::McpDispatcher::new(),
            office_cli_docs: Arc::new(RwLock::new(HashMap::new())),
            office_cli_watches: Arc::new(RwLock::new(HashMap::new())),
            office_cli_mcp_sessions: Arc::new(RwLock::new(HashMap::new())),
            approval_store: Arc::new(crate::permission_policy::ApprovalStore::new()),
            passkey_state: None,
        })
    }

    fn json_body(value: &Value) -> Body {
        Body::from(value.to_string())
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    async fn start_receiver(
        received: Arc<Mutex<Vec<ReceivedRequest>>>,
    ) -> String {
        use axum::{extract::State, http::HeaderMap, routing::post, Router};

        async fn capture(
            State(received): State<Arc<Mutex<Vec<ReceivedRequest>>>>,
            headers: HeaderMap,
            body: Body,
        ) -> StatusCode {
            let bytes = body.collect().await.unwrap().to_bytes();
            let value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
            received.lock().unwrap().push(ReceivedRequest {
                signature: headers
                    .get("X-Allternit-Signature")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string()),
                body: value,
            });
            StatusCode::OK
        }

        let app = Router::new()
            .route("/webhook", post(capture))
            .with_state(received);
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://127.0.0.1:{}/webhook", port)
    }

    fn verify_signature(secret: &str, body: &Value, signature: &str) -> bool {
        let bytes = serde_json::to_vec(body).unwrap();
        sign_payload(secret, &bytes) == signature
    }

    #[tokio::test]
    async fn subscription_crud() {
        let temp = temp_dir("crud");
        let state = test_app_state(&temp).await;
        let app = webhook_subscription_router().with_state(state);
        let org = "org-crud";

        // Create
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/webhooks")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some(org)))
                    .body(json_body(&json!({
                        "url": "https://example.test/hook",
                        "events": [SESSION_EVENT],
                        "secret": "s3cret"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let id = body["subscription"]["id"].as_str().unwrap().to_string();
        assert_eq!(body["subscription"]["url"], "https://example.test/hook");
        assert_eq!(body["subscription"]["events"], json!([SESSION_EVENT]));
        assert_eq!(body["subscription"]["active"], true);

        // List
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/webhooks")
                    .extension(test_user("user-a", Some(org)))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["subscriptions"].as_array().unwrap().len(), 1);

        // Other org cannot see
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/beta/webhooks")
                    .extension(test_user("user-b", Some("other-org")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["subscriptions"].as_array().unwrap().len(), 0);

        // Get
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/beta/webhooks/{}", id))
                    .extension(test_user("user-a", Some(org)))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Update
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/beta/webhooks/{}", id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some(org)))
                    .body(json_body(&json!({
                        "active": false,
                        "events": [DEPLOYMENT_RUN_EVENT]
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["subscription"]["active"], false);
        assert_eq!(body["subscription"]["events"], json!([DEPLOYMENT_RUN_EVENT]));

        // Delete
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/beta/webhooks/{}", id))
                    .extension(test_user("user-a", Some(org)))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[tokio::test]
    async fn signed_delivery_to_matching_subscriptions() {
        let temp = temp_dir("delivery");
        let state = test_app_state(&temp).await;
        let app = webhook_subscription_router().with_state(state.clone());
        let org = "org-delivery";
        let secret = "delivery-secret";

        let received = Arc::new(Mutex::new(Vec::new()));
        let url = start_receiver(received.clone()).await;

        // Create subscription
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/webhooks")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some(org)))
                    .body(json_body(&json!({
                        "url": url,
                        "events": [SESSION_EVENT],
                        "secret": secret
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);

        // Create an inactive subscription to verify filtering
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/webhooks")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some(org)))
                    .body(json_body(&json!({
                        "url": url,
                        "events": [SESSION_EVENT],
                        "secret": secret
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let inactive_id = body_json(resp.into_body()).await["subscription"]["id"]
            .as_str()
            .unwrap()
            .to_string();

        // Deactivate the second subscription
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/beta/webhooks/{}", inactive_id))
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some(org)))
                    .body(json_body(&json!({"active": false})))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Trigger delivery
        let event = json!({"type": "thinking_delta", "delta": "hello"});
        deliver_session_event(state.clone(), Some(org), "session-1", &event).await;

        // Wait for the spawned HTTP delivery task.
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let received = received.lock().unwrap();
        assert_eq!(received.len(), 1);
        let req = &received[0];
        assert_eq!(req.body["event"], SESSION_EVENT);
        assert_eq!(req.body["session_id"], "session-1");
        assert_eq!(req.body["event_data"], event);
        let signature = req.signature.as_ref().unwrap();
        assert!(verify_signature(secret, &req.body, signature));

        // A delivery row should have been recorded.
        let conn = state.db.connect().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'delivered'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[tokio::test]
    async fn rejects_invalid_subscription_body() {
        let temp = temp_dir("validation");
        let state = test_app_state(&temp).await;
        let app = webhook_subscription_router().with_state(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/webhooks")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some("org")))
                    .body(json_body(&json!({
                        "url": "ftp://example.test/hook",
                        "events": [SESSION_EVENT],
                        "secret": "s"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/beta/webhooks")
                    .header("content-type", "application/json")
                    .extension(test_user("user-a", Some("org")))
                    .body(json_body(&json!({
                        "url": "https://example.test/hook",
                        "events": [],
                        "secret": "s"
                    })))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let _ = std::fs::remove_dir_all(&temp);
    }
}
