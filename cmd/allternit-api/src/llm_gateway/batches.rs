//! Phase 1 batch metadata storage. Execution and provider polling are Phase 2.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{db::DbHandle, AppState};

use super::{
    auth::LlmKeyContext,
    translate::{validate_request, ChatCompletionRequest, OpenAiErrorResponse},
};

#[derive(Debug, Deserialize)]
pub struct CreateBatchRequest {
    pub requests: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Batch {
    pub id: String,
    pub object: &'static str,
    pub status: String,
    pub request_count: usize,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<String>,
}

pub struct BatchesService<'a> {
    db: &'a DbHandle,
}

impl<'a> BatchesService<'a> {
    pub fn new(db: &'a DbHandle) -> Self {
        Self { db }
    }

    pub fn create(&self, key: &LlmKeyContext, requests: &[Value]) -> rusqlite::Result<Batch> {
        let id = format!("batch_{}", uuid::Uuid::new_v4().simple());
        let requests_json = serde_json::to_string(requests)
            .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO llm_batches (id, virtual_key_id, user_id, tenant_id, requests_json)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, key.key_id, key.user_id, key.tenant_id, requests_json],
        )?;
        self.get(&key.key_id, &id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list(&self, key_id: &str) -> rusqlite::Result<Vec<Batch>> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, status, requests_json, created_at, updated_at, cancelled_at
             FROM llm_batches WHERE virtual_key_id = ?1 ORDER BY created_at DESC, id DESC",
        )?;
        let rows = stmt.query_map([key_id], batch_from_row)?;
        rows.collect()
    }

    pub fn get(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Batch>> {
        let conn = self.db.connect()?;
        conn.query_row(
            "SELECT id, status, requests_json, created_at, updated_at, cancelled_at
             FROM llm_batches WHERE virtual_key_id = ?1 AND id = ?2",
            params![key_id, id],
            batch_from_row,
        )
        .optional()
    }

    pub fn cancel(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Batch>> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE llm_batches SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
             WHERE virtual_key_id = ?1 AND id = ?2 AND status != 'cancelled'",
            params![key_id, id],
        )?;
        drop(conn);
        self.get(key_id, id)
    }

    pub fn results(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Value>> {
        let conn = self.db.connect()?;
        conn.query_row(
            "SELECT results_json FROM llm_batches WHERE virtual_key_id = ?1 AND id = ?2",
            params![key_id, id],
            |row| {
                let raw: String = row.get(0)?;
                serde_json::from_str(&raw).map_err(|err| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(err),
                    )
                })
            },
        )
        .optional()
    }
}

fn batch_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Batch> {
    let requests_json: String = row.get(2)?;
    let request_count = serde_json::from_str::<Vec<Value>>(&requests_json)
        .map(|requests| requests.len())
        .unwrap_or(0);
    Ok(Batch {
        id: row.get(0)?,
        object: "batch",
        status: row.get(1)?,
        request_count,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        cancelled_at: row.get(5)?,
    })
}

fn internal_error(err: impl std::fmt::Display) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Internal error: {err}"),
        "server_error",
        None,
        Some(super::translate::error_code::INTERNAL_ERROR),
    )
    .into_response()
}

fn not_found(id: &str) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::NOT_FOUND,
        format!("Batch `{id}` was not found."),
        "invalid_request_error",
        Some("id"),
        Some(super::translate::error_code::INVALID_REQUEST),
    )
    .into_response()
}

pub async fn create_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Json(body): Json<CreateBatchRequest>,
) -> Response {
    if body.requests.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`requests` must contain at least one request.",
            Some("requests"),
        )
        .into_response();
    }
    for (index, value) in body.requests.iter().enumerate() {
        let request: ChatCompletionRequest = match serde_json::from_value(value.clone()) {
            Ok(request) => request,
            Err(err) => {
                return OpenAiErrorResponse::invalid_request(
                    format!("Invalid request at index {index}: {err}"),
                    Some("requests"),
                )
                .into_response()
            }
        };
        if let Err(err) = validate_request(&request) {
            return err.into_response();
        }
        if !key.model_allowed(&request.model) {
            return OpenAiErrorResponse::new(
                StatusCode::FORBIDDEN,
                format!(
                    "This API key is not allowed to use model `{}`.",
                    request.model
                ),
                "permission_error",
                Some("model"),
                Some(super::translate::error_code::PERMISSION_DENIED),
            )
            .into_response();
        }
    }
    match BatchesService::new(&state.db).create(&key, &body.requests) {
        Ok(batch) => (StatusCode::CREATED, Json(batch)).into_response(),
        Err(err) => internal_error(err),
    }
}

pub async fn list_batches(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    match BatchesService::new(&state.db).list(&key.key_id) {
        Ok(data) => Json(json!({ "object": "list", "data": data })).into_response(),
        Err(err) => internal_error(err),
    }
}

pub async fn get_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(&state.db).get(&key.key_id, &id) {
        Ok(Some(batch)) => Json(batch).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}

pub async fn cancel_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(&state.db).cancel(&key.key_id, &id) {
        Ok(Some(batch)) => Json(batch).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}

pub async fn batch_results(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(&state.db).results(&key.key_id, &id) {
        Ok(Some(data)) => Json(json!({ "object": "list", "data": data })).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}
