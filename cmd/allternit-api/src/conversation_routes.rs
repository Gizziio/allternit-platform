//! Conversation API routes — local SQLite persistence.
//!
//! Mirrors the Next.js `/api/v1/conversations` layer.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::{get_user, AuthUser};
use crate::AppState;

fn unauthorized() -> impl IntoResponse {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"})))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn conversation_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/conversations", get(list_conversations).post(create_conversation))
        .route("/conversations/:id", get(get_conversation))
        .route("/conversations/:id/messages", get(list_messages).post(create_message))
        .route("/conversations/:id/replies", get(list_replies))
        .route("/conversations/:id/fork", post(fork_conversation))
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

fn require_user(headers: &HeaderMap) -> Option<AuthUser> {
    get_user(headers)
}

// ─── List conversations ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListQuery {
    #[allow(dead_code)]
    user_id: Option<String>,
}

async fn list_conversations(
    State(state): State<Arc<AppState>>,
    Query(_q): Query<ListQuery>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, title, user_id, parent_conversation_id,
                    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = conversations.id) as message_count,
                    (SELECT COUNT(*) FROM conversations WHERE parent_conversation_id = conversations.id) as branch_count
             FROM conversations
             WHERE user_id = ?1
             ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map(params![user_id], |row| {
            Ok(ConversationRow {
                id: row.get(0)?,
                created_at: row.get(1)?,
                updated_at: row.get(2)?,
                title: row.get(3)?,
                user_id: row.get(4)?,
                parent_conversation_id: row.get(5)?,
                message_count: row.get(6)?,
                branch_count: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(rows)
    })
    .await
    .unwrap_or_else(|e| {
        warn!("DB task panicked: {}", e);
        Ok(Vec::new())
    });

    match rows {
        Ok(data) => Json(json!({
            "object": "list",
            "data": data,
            "has_more": false,
        })).into_response(),
        Err(e) => {
            warn!("DB error listing conversations: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
    }
}

// ─── Create conversation ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateConversationBody {
    #[serde(alias = "conversationId")]
    conversation_id: Option<String>,
    title: Option<String>,
    metadata: Option<serde_json::Value>,
}

async fn create_conversation(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreateConversationBody>,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let id = body.conversation_id.unwrap_or_else(|| {
        format!("conv_{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().to_string().split('-').next().unwrap())
    });

    let db = state.db.clone();
    let id2 = id.clone();
    let title = body.title.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO conversations (id, title, user_id) VALUES (?1, ?2, ?3)",
            params![id2, title, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    if let Err(e) = &result {
        warn!("DB error creating conversation (non-fatal): {}", e);
    }

    Json(json!({
        "id": id,
        "object": "conversation",
        "created_at": chrono::Utc::now().timestamp(),
        "metadata": body.metadata.unwrap_or(serde_json::Value::Null),
    })).into_response()
}

// ─── Get conversation ─────────────────────────────────────────────────────────

async fn get_conversation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, title, user_id, parent_conversation_id,
                    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = conversations.id) as message_count,
                    (SELECT COUNT(*) FROM conversations WHERE parent_conversation_id = conversations.id) as branch_count
             FROM conversations WHERE id = ?1 AND user_id = ?2"
        )?;

        let row = stmt.query_row(params![id2, user_id], |row| {
            Ok(ConversationRow {
                id: row.get(0)?,
                created_at: row.get(1)?,
                updated_at: row.get(2)?,
                title: row.get(3)?,
                user_id: row.get(4)?,
                parent_conversation_id: row.get(5)?,
                message_count: row.get(6)?,
                branch_count: row.get(7)?,
            })
        })?;

        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(conv)) => Json(json!(conv)).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found", "message": format!("Conversation '{}' not found.", id)}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting conversation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── List messages ────────────────────────────────────────────────────────────

async fn list_messages(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let conv_id = conversation_id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify conversation ownership first
        let _ = conn.query_row(
            "SELECT 1 FROM conversations WHERE id = ?1 AND user_id = ?2",
            params![conv_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, created_at, conversation_id, role, content, parent_message_id, metadata
             FROM conversation_messages
             WHERE conversation_id = ?1
             ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map(params![conv_id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                created_at: row.get(1)?,
                conversation_id: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                parent_message_id: row.get(5)?,
                metadata: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(data)) => {
            let parsed: Vec<serde_json::Value> = data.into_iter().map(|m| {
                let metadata_json: Option<serde_json::Value> = m.metadata.as_ref().and_then(|s| serde_json::from_str(s).ok());
                json!({
                    "id": m.id,
                    "object": "conversation.message",
                    "created_at": m.created_at,
                    "conversation_id": m.conversation_id,
                    "role": m.role,
                    "content": m.content,
                    "parent_message_id": m.parent_message_id,
                    "metadata": metadata_json,
                })
            }).collect();
            Json(json!({"object": "list", "conversation_id": conversation_id, "data": parsed, "has_more": false})).into_response()
        }
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing messages: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Create message ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateMessageBody {
    role: String,
    content: String,
    #[serde(alias = "parentMessageId")]
    parent_message_id: Option<String>,
    metadata: Option<serde_json::Value>,
}

async fn create_message(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<CreateMessageBody>,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let conv_id = conversation_id.clone();
    let user_id = user.user_id;

    let role = body.role.clone();
    let content = body.content.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Auto-create conversation if it doesn't exist (idempotent)
        let _ = conn.execute(
            "INSERT OR IGNORE INTO conversations (id, user_id) VALUES (?1, ?2)",
            params![conv_id, user_id],
        );
        // Verify conversation ownership
        let _ = conn.query_row(
            "SELECT 1 FROM conversations WHERE id = ?1 AND user_id = ?2",
            params![conv_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        conn.execute(
            "INSERT INTO conversation_messages (id, conversation_id, role, content, parent_message_id, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id2,
                conv_id,
                body.role,
                body.content,
                body.parent_message_id,
                body.metadata.map(|m| m.to_string()),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({
            "id": id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "created_at": chrono::Utc::now().timestamp(),
        })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error creating message: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── List replies (branches) ────────────────────────────────────────────────────

async fn list_replies(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let conv_id = conversation_id.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Verify conversation ownership
        let _ = conn.query_row(
            "SELECT 1 FROM conversations WHERE id = ?1 AND user_id = ?2",
            params![conv_id, user_id],
            |_| Ok(true),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        let mut stmt = conn.prepare(
            "SELECT id, created_at, updated_at, title, user_id, parent_conversation_id,
                    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count
             FROM conversations c
             WHERE parent_conversation_id = ?1 AND user_id = ?2
             ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map(params![conv_id, user_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "object": "conversation",
                "created_at": row.get::<_, String>(1)?,
                "updated_at": row.get::<_, String>(2)?,
                "title": row.get::<_, Option<String>>(3)?,
                "parent_conversation_id": row.get::<_, Option<String>>(5)?,
                "message_count": row.get::<_, i64>(6)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(data)) => Json(json!({"object": "list", "conversation_id": conversation_id, "data": data, "has_more": false})).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::FORBIDDEN, Json(json!({"error": "Access denied"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing replies: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Fork conversation ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ForkBody {
    #[serde(alias = "fromMessageId")]
    from_message_id: Option<String>,
    title: Option<String>,
}

async fn fork_conversation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<ForkBody>,
) -> impl IntoResponse {
    let user = match require_user(&headers) {
        Some(u) => u,
        None => return unauthorized().into_response(),
    };

    let db = state.db.clone();
    let source_id = id.clone();
    let user_id = user.user_id;
    let new_title = body.title.clone();
    let from_msg_id = body.from_message_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Get source conversation
        let source: (Option<String>,) = conn.query_row(
            "SELECT title FROM conversations WHERE id = ?1 AND user_id = ?2",
            params![source_id, user_id],
            |row| Ok((row.get(0)?,)),
        ).map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

        // Get messages to copy
        let mut stmt = conn.prepare(
            "SELECT id, role, content, parent_message_id, metadata
             FROM conversation_messages
             WHERE conversation_id = ?1
             ORDER BY created_at ASC"
        )?;
        let messages: Vec<(String, String, String, Option<String>, Option<String>)> = stmt
            .query_map(params![source_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let messages_to_copy: Vec<_> = if let Some(ref msg_id) = from_msg_id {
            let cutoff = messages.iter().position(|(id, _, _, _, _)| id == msg_id);
            match cutoff {
                Some(idx) => messages.into_iter().take(idx + 1).collect(),
                None => return Err(rusqlite::Error::QueryReturnedNoRows),
            }
        } else {
            messages
        };
        let msg_count = messages_to_copy.len();
        let from_msg_id2 = from_msg_id.clone();

        let new_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO conversations (id, title, user_id, parent_conversation_id) VALUES (?1, ?2, ?3, ?4)",
            params![new_id, new_title.or(source.0), user_id, source_id],
        )?;

        for (_msg_id, role, content, parent_id, metadata) in messages_to_copy {
            let new_msg_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO conversation_messages (id, conversation_id, role, content, parent_message_id, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![new_msg_id, new_id, role, content, parent_id, metadata],
            )?;
        }

        Ok::<_, rusqlite::Error>((new_id, msg_count, from_msg_id2))
    })
    .await;

    match result {
        Ok(Ok((new_id, msg_count, from_msg_id2))) => (StatusCode::CREATED, Json(json!({
            "id": new_id,
            "object": "conversation",
            "created_at": chrono::Utc::now().timestamp(),
            "title": body.title,
            "parent_conversation_id": id,
            "forked_from_message_id": from_msg_id2,
            "message_count": msg_count,
        }))).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found", "message": format!("Conversation '{}' not found.", id)}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error forking conversation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Data models ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ConversationRow {
    id: String,
    created_at: String,
    updated_at: String,
    title: Option<String>,
    user_id: Option<String>,
    parent_conversation_id: Option<String>,
    message_count: i64,
    branch_count: i64,
}

#[derive(Serialize)]
struct MessageRow {
    id: String,
    created_at: String,
    conversation_id: String,
    role: String,
    content: String,
    parent_message_id: Option<String>,
    metadata: Option<String>,
}

