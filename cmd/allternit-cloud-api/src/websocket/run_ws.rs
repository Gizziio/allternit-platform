//! WebSocket handler for run events
//!
//! Provides bidirectional WebSocket connection for real-time run event streaming
//! and interactive approvals.

use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    response::Response,
};
use std::sync::Arc;

use crate::db::cowork_models::*;
use crate::services::{EventStore, EventStoreImpl, RunService};
use crate::{ApiError, ApiState};

/// Token carrier for the WebSocket upgrade. Browsers cannot set arbitrary
/// headers on a WebSocket handshake, so the credential may ride the query
/// string or the Sec-WebSocket-Protocol header instead.
#[derive(Debug, serde::Deserialize)]
pub struct RunWsQuery {
    pub token: Option<String>,
}

/// Which authentication mode a presented credential belongs to. Decided
/// purely from the token's shape (`token_mode`) so the dispatch is unit
/// testable without a Clerk JWKS round-trip.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WsAuthMode {
    /// `allternit_*` legacy/scoped tokens and `alt_*` platform keys — looked
    /// up in the database.
    ApiToken,
    /// Three-segment JWT — a Clerk session token, verified against JWKS.
    ClerkJwt,
}

/// Classify a token for auth dispatch. `allternit_`/`alt_` prefixed secrets
/// are unambiguous; anything else shaped like a JWT (header.payload.signature)
/// is tried as a Clerk session; a match on neither falls back to the
/// database lookup so exotic tokens still get a chance to validate.
fn token_mode(token: &str) -> WsAuthMode {
    if token.starts_with("allternit_") || token.starts_with("alt_") {
        WsAuthMode::ApiToken
    } else {
        WsAuthMode::ClerkJwt
    }
}

/// Extract the bearer credential from the supported carriers.
fn extract_ws_token(
    headers: &axum::http::HeaderMap,
    query: &RunWsQuery,
) -> Option<String> {
    query.token.clone().or_else(|| {
        headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .map(str::to_string)
    }).or_else(|| {
        headers
            .get("sec-websocket-protocol")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.strip_prefix("token."))
            .map(str::to_string)
    })
}

/// Authenticate the upgrade request. Accepts either an `allternit_*`/`alt_*`
/// API token (database lookup, same path as the REST middleware) or a Clerk
/// session JWT (JWKS-verified, the browser path). Mirrors the deployment
/// WebSocket's development-mode bypass.
async fn authenticate_run_ws(
    state: &ApiState,
    headers: &axum::http::HeaderMap,
    query: &RunWsQuery,
) -> Result<(), ApiError> {
    let development_mode = std::env::var("Allternit_API_DEVELOPMENT_MODE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    if development_mode {
        return Ok(());
    }

    let Some(token) = extract_ws_token(headers, query) else {
        return Err(ApiError::Unauthorized(
            "WebSocket authentication required. Pass a Clerk session or API token via ?token= query param, Authorization header, or Sec-WebSocket-Protocol header".to_string(),
        ));
    };

    match token_mode(&token) {
        WsAuthMode::ApiToken => {
            match crate::auth::middleware::validate_token_against_db(&state.db, &token).await {
                Ok(Some(_)) => Ok(()),
                Ok(None) => Err(ApiError::Unauthorized(
                    "Invalid or expired token".to_string(),
                )),
                Err(_) => Err(ApiError::Unauthorized(
                    "Token validation failed".to_string(),
                )),
            }
        }
        WsAuthMode::ClerkJwt => {
            match crate::auth::clerk::user_from_token(&token).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    // A Clerk-shaped token that fails verification might be an
                    // exotic API token — give the database path one chance.
                    match crate::auth::middleware::validate_token_against_db(&state.db, &token)
                        .await
                    {
                        Ok(Some(_)) => Ok(()),
                        _ => Err(e),
                    }
                }
            }
        }
    }
}

/// WebSocket handler for run events
pub async fn run_ws_handler(
    State(state): State<Arc<ApiState>>,
    Path(run_id): Path<String>,
    Query(query): Query<RunWsQuery>,
    headers: axum::http::HeaderMap,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    authenticate_run_ws(&state, &headers, &query).await?;

    // Verify run exists
    let run = sqlx::query_as::<_, Run>("SELECT * FROM runs WHERE id = $1")
        .bind(&run_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;

    if run.is_none() {
        return Err(ApiError::NotFound(format!("Run not found: {}", run_id)));
    }

    Ok(ws.on_upgrade(move |socket| handle_run_socket(socket, state, run_id)))
}

/// Handle WebSocket connection for a run
async fn handle_run_socket(
    mut socket: axum::extract::ws::WebSocket,
    state: Arc<ApiState>,
    run_id: String,
) {
    use axum::extract::ws::Message;
    use futures::stream::StreamExt;

    tracing::info!("WebSocket connected for run: {}", run_id);

    // Create event store and subscribe to events
    let event_store = EventStoreImpl::new(state.db.clone());
    let mut event_rx = match event_store.subscribe(&run_id).await {
        Ok(rx) => rx,
        Err(e) => {
            tracing::error!("Failed to subscribe to events: {}", e);
            let _ = socket.close().await;
            return;
        }
    };

    // Register attachment
    let client_id = uuid::Uuid::new_v4().to_string();
    let attachment_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    let _ = sqlx::query(
        r#"
        INSERT INTO attachments (id, run_id, client_id, client_type, cursor_sequence, attached_at, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(&attachment_id)
    .bind(&run_id)
    .bind(&client_id)
    .bind(ClientType::Web) // Default to Web, could be determined from headers
    .bind(0i64)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await;

    // Get latest sequence for cursor tracking
    let latest_sequence = event_store.get_latest_sequence(&run_id).await.unwrap_or(0);

    // Send initial connection acknowledgment
    let ack = serde_json::json!({
        "type": "connected",
        "run_id": &run_id,
        "client_id": &client_id,
        "latest_sequence": latest_sequence,
    });

    if let Err(e) = socket.send(Message::Text(ack.to_string())).await {
        tracing::error!("Failed to send ack: {}", e);
        return;
    }

    // Main message loop
    loop {
        tokio::select! {
            // Receive events from broadcast
            Ok(event) = event_rx.recv() => {
                let event_json = match serde_json::to_string(&event) {
                    Ok(json) => json,
                    Err(e) => {
                        tracing::error!("Failed to serialize event: {}", e);
                        continue;
                    }
                };

                if let Err(e) = socket.send(Message::Text(event_json)).await {
                    tracing::error!("Failed to send event: {}", e);
                    break;
                }

                // Update cursor position
                let _ = sqlx::query(
                    "UPDATE attachments SET cursor_sequence = $1, last_seen_at = $2 WHERE id = $3"
                )
                .bind(event.sequence)
                .bind(chrono::Utc::now())
                .bind(&attachment_id)
                .execute(&state.db)
                .await;
            }

            // Receive messages from client
            Some(msg) = socket.next() => {
                match msg {
                    Ok(Message::Text(text)) => {
                        // Handle client messages (approvals, commands, etc.)
                        if let Err(e) = handle_client_message(&text, &state, &run_id, &client_id).await {
                            let error_msg = serde_json::json!({
                                "type": "error",
                                "error": e.to_string(),
                            });
                            let _ = socket.send(Message::Text(error_msg.to_string())).await;
                        }
                    }
                    Ok(Message::Close(_)) => {
                        tracing::info!("WebSocket closed by client for run: {}", run_id);
                        break;
                    }
                    Ok(Message::Ping(data)) => {
                        if let Err(e) = socket.send(Message::Pong(data)).await {
                            tracing::error!("Failed to send pong: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }

            // Timeout/heartbeat check
            else => {
                // Send heartbeat
                let heartbeat = serde_json::json!({
                    "type": "heartbeat",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                });

                if let Err(e) = socket.send(Message::Text(heartbeat.to_string())).await {
                    tracing::error!("Failed to send heartbeat: {}", e);
                    break;
                }
            }
        }
    }

    // Clean up attachment
    let _ = sqlx::query("UPDATE attachments SET detached_at = $1 WHERE id = $2")
        .bind(chrono::Utc::now())
        .bind(&attachment_id)
        .execute(&state.db)
        .await;

    tracing::info!("WebSocket disconnected for run: {}", run_id);
}

/// Handle messages from WebSocket client
async fn handle_client_message(
    text: &str,
    state: &ApiState,
    run_id: &str,
    client_id: &str,
) -> Result<(), ApiError> {
    #[derive(serde::Deserialize)]
    struct ClientMessage {
        #[serde(rename = "type")]
        msg_type: String,
        #[serde(flatten)]
        payload: serde_json::Value,
    }

    let msg: ClientMessage = serde_json::from_str(text)
        .map_err(|e| ApiError::BadRequest(format!("Invalid message format: {}", e)))?;

    match msg.msg_type.as_str() {
        "approval_response" => {
            #[derive(serde::Deserialize)]
            struct ApprovalResponse {
                tool_name: String,
                approved: bool,
                reason: Option<String>,
            }

            let approval: ApprovalResponse = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid approval response: {}", e)))?;

            // Emit approval event
            let event_store = EventStoreImpl::new(state.db.clone());

            let event_type = if approval.approved {
                EventType::ApprovalGiven
            } else {
                EventType::ApprovalDenied
            };

            let payload = if approval.approved {
                serde_json::json!({
                    "tool_name": approval.tool_name,
                    "approved_by": client_id,
                    "approved_at": chrono::Utc::now().to_rfc3339(),
                })
            } else {
                serde_json::json!({
                    "tool_name": approval.tool_name,
                    "denied_by": client_id,
                    "reason": approval.reason,
                    "denied_at": chrono::Utc::now().to_rfc3339(),
                })
            };

            event_store
                .append_with_source(
                    run_id,
                    event_type,
                    payload,
                    Some(client_id),
                    Some(ClientType::Web),
                )
                .await?;

            tracing::info!(
                "Approval {} for tool {} in run {}",
                if approval.approved {
                    "granted"
                } else {
                    "denied"
                },
                approval.tool_name,
                run_id
            );
        }

        "cursor_sync" => {
            #[derive(serde::Deserialize)]
            struct CursorSync {
                sequence: i64,
            }

            let sync: CursorSync = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid cursor sync: {}", e)))?;

            // Update attachment cursor
            let _ = sqlx::query(
                "UPDATE attachments SET cursor_sequence = $1, last_seen_at = $2 
                 WHERE run_id = $3 AND client_id = $4",
            )
            .bind(sync.sequence)
            .bind(chrono::Utc::now())
            .bind(run_id)
            .bind(client_id)
            .execute(&state.db)
            .await;
        }

        "command" => {
            #[derive(serde::Deserialize)]
            struct Command {
                command: String,
            }

            let cmd: Command = serde_json::from_value(msg.payload)
                .map_err(|e| ApiError::BadRequest(format!("Invalid command: {}", e)))?;

            // Handle commands like pause, resume, cancel
            use crate::services::RunServiceImpl;
            let run_service = RunServiceImpl::from_arc(Arc::new(state.db.clone()));

            match cmd.command.as_str() {
                "pause" => {
                    run_service.pause(run_id).await?;
                }
                "resume" => {
                    run_service.resume(run_id).await?;
                }
                "cancel" => {
                    run_service.cancel(run_id, None).await?;
                }
                _ => {
                    return Err(ApiError::BadRequest(format!(
                        "Unknown command: {}",
                        cmd.command
                    )));
                }
            }
        }

        _ => {
            return Err(ApiError::BadRequest(format!(
                "Unknown message type: {}",
                msg.msg_type
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_mode_dispatch_prefixed_tokens_use_db_lookup() {
        assert_eq!(
            token_mode("allternit_abcdef0123456789abcdef0123456789"),
            WsAuthMode::ApiToken
        );
        assert_eq!(token_mode("alt_0123456789abcdef"), WsAuthMode::ApiToken);
    }

    #[test]
    fn token_mode_dispatch_jwt_shaped_tokens_use_clerk() {
        // Clerk session JWTs are header.payload.signature.
        assert_eq!(
            token_mode("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.fakesig"),
            WsAuthMode::ClerkJwt
        );
        assert_eq!(token_mode("not-a-prefixed-token"), WsAuthMode::ClerkJwt);
    }

    #[test]
    fn ws_token_extraction_priority_query_header_protocol() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderValue::from_static("Bearer header-token"),
        );
        headers.insert(
            "sec-websocket-protocol",
            axum::http::HeaderValue::from_static("token.protocol-token"),
        );

        // Query param wins.
        let query = RunWsQuery {
            token: Some("query-token".to_string()),
        };
        assert_eq!(extract_ws_token(&headers, &query).as_deref(), Some("query-token"));

        // Then the Authorization header.
        let query = RunWsQuery { token: None };
        assert_eq!(extract_ws_token(&headers, &query).as_deref(), Some("header-token"));

        // Then Sec-WebSocket-Protocol (token.<jwt> form).
        headers.remove(axum::http::header::AUTHORIZATION);
        assert_eq!(
            extract_ws_token(&headers, &query).as_deref(),
            Some("protocol-token")
        );

        // Nothing presented.
        headers.remove("sec-websocket-protocol");
        assert_eq!(extract_ws_token(&headers, &query), None);
    }
}
