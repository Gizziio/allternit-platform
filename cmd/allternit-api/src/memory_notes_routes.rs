//! Editable markdown memory notes for people, websites, and episodic memory.
//!
//! Mirrors Aside's editable memory surface: users can create, edit, and delete
//! markdown notes that the agent can recall through semantic search.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn memory_notes_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/memory/notes", get(list_notes).post(create_note))
        .route("/memory/notes/:id", get(get_note).post(update_note).delete(delete_note))
}

type ApiError = (StatusCode, Json<serde_json::Value>);

fn err(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(e: impl std::fmt::Display) -> ApiError {
    err(
        StatusCode::INTERNAL_SERVER_ERROR,
        "memory_notes_error",
        e.to_string(),
    )
}

#[derive(Debug, Serialize)]
struct MemoryNote {
    id: String,
    user_id: String,
    note_type: String,
    title: String,
    content: String,
    tags: Vec<String>,
    entity_id: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateNoteRequest {
    note_type: String,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    entity_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateNoteRequest {
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ListNotesQuery {
    note_type: Option<String>,
    search: Option<String>,
}

fn row_to_note(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryNote> {
    let tags_json: String = row.get(5)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    Ok(MemoryNote {
        id: row.get(0)?,
        user_id: row.get(1)?,
        note_type: row.get(2)?,
        title: row.get(3)?,
        content: row.get(4)?,
        tags,
        entity_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

async fn list_notes(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListNotesQuery>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let mut sql = "SELECT id, user_id, note_type, title, content, tags, entity_id, created_at, updated_at FROM memory_notes WHERE user_id = ?1".to_string();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id.clone())];

        if let Some(ref note_type) = query.note_type {
            sql.push_str(" AND note_type = ?");
            args.push(Box::new(note_type.clone()));
        }
        if let Some(ref search) = query.search {
            sql.push_str(" AND (title LIKE ? OR content LIKE ?)");
            let pattern = format!("%{}%", search);
            args.push(Box::new(pattern.clone()));
            args.push(Box::new(pattern));
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let arg_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        let mut stmt = conn.prepare(&sql).map_err(internal)?;
        let notes = stmt
            .query_map(arg_refs.as_slice(), row_to_note)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({"notes": notes})))
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_note(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let note = conn
            .query_row(
                "SELECT id, user_id, note_type, title, content, tags, entity_id, created_at, updated_at FROM memory_notes WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_note,
            )
            .optional()
            .map_err(internal)?;
        match note {
            Some(n) => Ok::<_, ApiError>(Json(json!(n))),
            None => Err(err(StatusCode::NOT_FOUND, "note_not_found", "No such note.")),
        }
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn create_note(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateNoteRequest>,
) -> Response {
    if body.note_type.trim().is_empty() || body.title.trim().is_empty() {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "note_type and title are required.",
        )
        .into_response();
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let id = format!("mn_{}", uuid::Uuid::new_v4().simple());
        let tags_json = serde_json::to_string(&body.tags.unwrap_or_default()).map_err(internal)?;
        conn.execute(
            "INSERT INTO memory_notes (id, user_id, note_type, title, content, tags, entity_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                user.user_id,
                body.note_type.trim(),
                body.title.trim(),
                body.content,
                tags_json,
                body.entity_id,
            ],
        ).map_err(internal)?;
        Ok::<_, ApiError>((StatusCode::CREATED, Json(json!({"id": id}))))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn update_note(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateNoteRequest>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let existing: Option<MemoryNote> = conn
            .query_row(
                "SELECT id, user_id, note_type, title, content, tags, entity_id, created_at, updated_at FROM memory_notes WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_note,
            )
            .optional()
            .map_err(internal)?;
        let note = match existing {
            Some(n) => n,
            None => return Err(err(StatusCode::NOT_FOUND, "note_not_found", "No such note.")),
        };

        let title = body.title.unwrap_or(note.title);
        let content = body.content.unwrap_or(note.content);
        let tags_json = serde_json::to_string(&body.tags.unwrap_or(note.tags)).map_err(internal)?;

        conn.execute(
            "UPDATE memory_notes SET title = ?1, content = ?2, tags = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4 AND user_id = ?5",
            params![title, content, tags_json, id, user.user_id],
        ).map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({"id": id, "updated": true})))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_note(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let affected = conn
            .execute(
                "DELETE FROM memory_notes WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
            )
            .map_err(internal)?;
        if affected == 0 {
            return Err(err(StatusCode::NOT_FOUND, "note_not_found", "No such note."));
        }
        Ok::<_, ApiError>(StatusCode::NO_CONTENT.into_response())
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}
