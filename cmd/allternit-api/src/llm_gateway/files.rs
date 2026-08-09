//! OpenAI-compatible file endpoints for PDF upload and retrieval.
//!
//! Mounted under `/v1` by the LLM gateway router so the path surface matches
//! OpenAI's `POST /v1/files` and `GET /v1/files/:id`. These endpoints use the
//! gateway's existing virtual-key middleware chain for authentication.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

use super::translate::{OpenAiErrorResponse, error_code};

#[derive(Debug, Deserialize)]
pub struct CreateFileRequest {
    /// Base64-encoded file bytes. OpenAI's real endpoint accepts
    /// `multipart/form-data`; this simplified implementation accepts a JSON
    /// body so clients can upload PDFs without a multipart dependency.
    pub file: String,
    #[serde(default = "default_filename")]
    pub filename: String,
    #[serde(default = "default_purpose")]
    pub purpose: String,
}

fn default_filename() -> String {
    "upload.pdf".to_string()
}

fn default_purpose() -> String {
    "assistants".to_string()
}

#[derive(Debug, Serialize)]
pub struct FileObject {
    pub id: String,
    pub object: &'static str,
    pub bytes: i64,
    pub created_at: i64,
    pub filename: String,
    pub purpose: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

/// `POST /v1/files` — store a base64-encoded PDF in SQLite and return an
/// OpenAI-shaped file object.
pub async fn create_file(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateFileRequest>,
) -> Response {
    let bytes = match STANDARD.decode(&body.file) {
        Ok(bytes) => bytes,
        Err(_) => {
            return OpenAiErrorResponse::new(
                StatusCode::BAD_REQUEST,
                "Invalid base64 in file field.",
                "invalid_request_error",
                Some("file"),
                Some(error_code::INVALID_REQUEST),
            )
            .into_response();
        }
    };

    if bytes.is_empty() {
        return OpenAiErrorResponse::new(
            StatusCode::BAD_REQUEST,
            "File body cannot be empty.",
            "invalid_request_error",
            Some("file"),
            Some(error_code::INVALID_REQUEST),
        )
        .into_response();
    }

    let id = format!("file_{}", uuid::Uuid::new_v4().simple());
    let size = bytes.len() as i64;
    let filename = body.filename;
    let purpose = body.purpose;
    let created_at = chrono::Utc::now().timestamp();

    let db = state.db.clone();
    let id_for_db = id.clone();
    let filename_for_db = filename.clone();
    let purpose_for_db = purpose.clone();

    let result = tokio::task::spawn_blocking(move || -> Result<(), rusqlite::Error> {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO files (id, filename, purpose, bytes, size, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime(?6, 'unixepoch'))",
            rusqlite::params![
                id_for_db,
                filename_for_db,
                purpose_for_db,
                bytes,
                size,
                created_at,
            ],
        )?;
        Ok(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(FileObject {
            id,
            object: "file",
            bytes: size,
            created_at,
            filename,
            purpose,
            data: None,
        })
        .into_response(),
        Ok(Err(e)) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to store file: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
        Err(e) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to store file: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
    }
}

/// `GET /v1/files/:id` — retrieve a stored file's metadata and base64 content.
pub async fn get_file(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<Option<FileRow>, rusqlite::Error> {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, filename, purpose, bytes, size, CAST(strftime('%s', created_at) AS INTEGER) as created_at
             FROM files WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(FileRow {
                    id: row.get(0)?,
                    filename: row.get(1)?,
                    purpose: row.get(2)?,
                    bytes: row.get(3)?,
                    size: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .optional()
    })
    .await;

    match result {
        Ok(Ok(Some(row))) => Json(FileObject {
            id: row.id,
            object: "file",
            bytes: row.size,
            created_at: row.created_at,
            filename: row.filename,
            purpose: row.purpose,
            data: Some(STANDARD.encode(&row.bytes)),
        })
        .into_response(),
        Ok(Ok(None)) => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "error": {
                    "message": "File not found.",
                    "type": "invalid_request_error",
                    "code": error_code::INVALID_REQUEST,
                }
            })),
        )
            .into_response(),
        Ok(Err(e)) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to retrieve file: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
        Err(e) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to retrieve file: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
    }
}

struct FileRow {
    id: String,
    filename: String,
    purpose: String,
    bytes: Vec<u8>,
    size: i64,
    created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use std::path::Path;

    fn test_db() -> DbHandle {
        let temp = std::env::temp_dir().join(format!("allternit-api-files-test-{}.db", uuid::Uuid::new_v4()));
        DbHandle::new(temp).expect("test db")
    }

    #[test]
    fn round_trip_file_storage() {
        let db = test_db();
        let id = "file_test_001".to_string();
        let bytes = b"%PDF-1.4 test pdf bytes".to_vec();
        let filename = "test.pdf".to_string();
        let purpose = "assistants".to_string();
        let size = bytes.len() as i64;

        {
            let conn = db.connect().unwrap();
            conn.execute(
                "INSERT INTO files (id, filename, purpose, bytes, size)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, filename, purpose, bytes.clone(), size],
            )
            .unwrap();
        }

        let conn = db.connect().unwrap();
        let row: FileRow = conn
            .query_row(
                "SELECT id, filename, purpose, bytes, size, CAST(strftime('%s', created_at) AS INTEGER)
                 FROM files WHERE id = ?1",
                rusqlite::params![id],
                |row| {
                    Ok(FileRow {
                        id: row.get(0)?,
                        filename: row.get(1)?,
                        purpose: row.get(2)?,
                        bytes: row.get(3)?,
                        size: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                },
            )
            .unwrap();

        assert_eq!(row.id, id);
        assert_eq!(row.filename, filename);
        assert_eq!(row.purpose, purpose);
        assert_eq!(row.bytes, bytes);
        assert_eq!(row.size, size);
    }
}
