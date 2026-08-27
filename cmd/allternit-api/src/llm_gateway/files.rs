//! OpenAI-compatible file endpoints with purpose-driven upload metadata (A8).
//!
//! Mounted under `/v1` by the LLM gateway router so the path surface matches
//! OpenAI's `POST /v1/files` and `GET /v1/files/:id`. These endpoints use the
//! gateway's existing virtual-key middleware chain for authentication.
//!
//! Supports purpose validation against known purposes:
//! `fine-tune`, `assistants`, `batch`, `embeddings`, `vision`, `user_data`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

use super::translate::{OpenAiErrorResponse, error_code};

/// Valid purpose values for file uploads.
const VALID_PURPOSES: &[&str] = &[
    "fine-tune",
    "assistants",
    "assistants_output",
    "batch",
    "batch_output",
    "embeddings",
    "vision",
    "user_data",
];

/// Map file extensions to MIME types.
fn detect_content_type(filename: &str) -> &'static str {
    match filename.rsplit('.').next().unwrap_or("").to_lowercase().as_str() {
        "pdf" => "application/pdf",
        "jsonl" | "json" => "application/json",
        "txt" | "log" => "text/plain",
        "csv" => "text/csv",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

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
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_details: Option<String>,
    /// Detected MIME type based on filename extension.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

/// `POST /v1/files` — store a base64-encoded file in SQLite and return an
/// OpenAI-shaped file object with purpose and content-type metadata.
pub async fn create_file(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateFileRequest>,
) -> Response {
    // Validate purpose against known values.
    if !VALID_PURPOSES.contains(&body.purpose.as_str()) {
        return OpenAiErrorResponse::invalid_request(
            format!(
                "`purpose` must be one of {VALID_PURPOSES:?}, got `{}`.",
                body.purpose
            ),
            Some("purpose"),
        )
        .into_response();
    }

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

    let content_type = detect_content_type(&body.filename).to_string();
    let id = format!("file_{}", uuid::Uuid::new_v4().simple());
    let size = bytes.len() as i64;
    let filename = body.filename;
    let purpose = body.purpose;
    let created_at = chrono::Utc::now().timestamp();

    let db = state.db.clone();
    let id_for_db = id.clone();
    let filename_for_db = filename.clone();
    let purpose_for_db = purpose.clone();
    let ct_for_db = content_type.clone();

    let result = tokio::task::spawn_blocking(move || -> Result<(), rusqlite::Error> {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO files (id, filename, purpose, bytes, size, content_type, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime(?7, 'unixepoch'))",
            rusqlite::params![
                id_for_db,
                filename_for_db,
                purpose_for_db,
                bytes,
                size,
                ct_for_db,
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
            status: "processed",
            status_details: None,
            content_type: Some(content_type),
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

/// `GET /v1/files` — list stored files.
pub async fn list_files(State(state): State<Arc<AppState>>) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<FileObject>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, filename, purpose, size, CAST(strftime('%s', created_at) AS INTEGER), content_type
             FROM files ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(FileObject {
                    id: row.get(0)?,
                    object: "file",
                    filename: row.get(1)?,
                    purpose: row.get(2)?,
                    bytes: row.get(3)?,
                    created_at: row.get(4)?,
                    status: "processed",
                    status_details: None,
                    content_type: row.get(5)?,
                    data: None,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })
    .await;

    match result {
        Ok(Ok(rows)) => Json(json!({
            "object": "list",
            "data": rows,
        }))
        .into_response(),
        Ok(Err(e)) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list files: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
        Err(e) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list files: {e}"),
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
            "SELECT id, filename, purpose, bytes, size, CAST(strftime('%s', created_at) AS INTEGER) as created_at, content_type
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
                    content_type: row.get(6)?,
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
            status: "processed",
            status_details: None,
            content_type: row.content_type,
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

/// `DELETE /v1/files/:id` — remove a stored file.
pub async fn delete_file(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> Response {
    let db = state.db.clone();
    let id_for_db = id.clone();
    let result = tokio::task::spawn_blocking(
        move || -> Result<bool, rusqlite::Error> {
            let conn = db.connect()?;
            let changed = conn.execute("DELETE FROM files WHERE id = ?1", params![id_for_db])?;
            Ok(changed > 0)
        },
    )
    .await;

    match result {
        Ok(Ok(true)) => Json(json!({
            "id": id,
            "object": "file",
            "deleted": true,
        }))
        .into_response(),
        Ok(Ok(false)) => (
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
            format!("Failed to delete file: {e}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )
        .into_response(),
        Err(e) => OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to delete file: {e}"),
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
    content_type: Option<String>,
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
                "SELECT id, filename, purpose, bytes, size, CAST(strftime('%s', created_at) AS INTEGER), content_type
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
                        content_type: row.get(6)?,
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

    #[test]
    fn file_list_and_delete_helpers() {
        let db = test_db();
        let conn = db.connect().unwrap();
        let insert = |id: &str, filename: &str, bytes: &[u8]| {
            conn.execute(
                "INSERT INTO files (id, filename, purpose, bytes, size)
                 VALUES (?1, ?2, 'assistants', ?3, ?4)",
                rusqlite::params![id, filename, bytes, bytes.len() as i64],
            )
            .unwrap();
        };
        insert("file_a", "a.pdf", b"a");
        insert("file_b", "b.pdf", b"bb");

        let mut stmt = conn.prepare(
            "SELECT id, filename, purpose, size, CAST(strftime('%s', created_at) AS INTEGER), content_type
             FROM files ORDER BY created_at DESC",
        ).unwrap();
        let rows: Vec<FileObject> = stmt
            .query_map([], |row| {
                Ok(FileObject {
                    id: row.get(0)?,
                    object: "file",
                    filename: row.get(1)?,
                    purpose: row.get(2)?,
                    bytes: row.get(3)?,
                    created_at: row.get(4)?,
                    status: "processed",
                    status_details: None,
                    content_type: row.get(5)?,
                    data: None,
                })
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        assert_eq!(rows.len(), 2);
        let ids: std::collections::HashSet<_> = rows.iter().map(|r| r.id.clone()).collect();
        assert!(ids.contains("file_a"));
        assert!(ids.contains("file_b"));

        let changed = conn.execute("DELETE FROM files WHERE id = 'file_a'", []).unwrap();
        assert_eq!(changed, 1);
        let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0)).unwrap();
        assert_eq!(remaining, 1);
    }
}
