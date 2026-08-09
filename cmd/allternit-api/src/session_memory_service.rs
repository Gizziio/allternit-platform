//! Session-scoped key/value memory store backed by SQLite.
//!
//! This service powers the model-facing `memory` tool: read, write, and delete
//! values keyed by `(user_id, session_id, key)`. Values are stored as JSON so
//! the tool can hold strings, numbers, booleans, objects, or arrays.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::DbHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMemoryEntry {
    pub id: String,
    pub user_id: String,
    pub session_id: String,
    pub key: String,
    pub value: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WriteSessionMemoryRequest {
    pub session_id: String,
    pub key: String,
    pub value: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReadSessionMemoryQuery {
    pub session_id: String,
    pub key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteSessionMemoryQuery {
    pub session_id: String,
    pub key: String,
}

#[derive(thiserror::Error, Debug)]
pub enum SessionMemoryError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("missing required field: {0}")]
    MissingField(String),
}

/// Read a single session memory value by key.
pub fn read_session_memory(
    db: &DbHandle,
    user_id: &str,
    session_id: &str,
    key: &str,
) -> Result<Option<SessionMemoryEntry>, SessionMemoryError> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, user_id, session_id, memory_key, value, created_at, updated_at
         FROM session_memory
         WHERE user_id = ?1 AND session_id = ?2 AND memory_key = ?3",
    )?;
    let row = stmt.query_row(params![user_id, session_id, key], |row| {
        Ok(SessionMemoryEntry {
            id: row.get(0)?,
            user_id: row.get(1)?,
            session_id: row.get(2)?,
            key: row.get(3)?,
            value: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(Value::Null),
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    });
    match row {
        Ok(entry) => Ok(Some(entry)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// List all memory keys for a session.
pub fn list_session_memory(
    db: &DbHandle,
    user_id: &str,
    session_id: &str,
) -> Result<Vec<SessionMemoryEntry>, SessionMemoryError> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, user_id, session_id, memory_key, value, created_at, updated_at
         FROM session_memory
         WHERE user_id = ?1 AND session_id = ?2
         ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map(params![user_id, session_id], |row| {
        Ok(SessionMemoryEntry {
            id: row.get(0)?,
            user_id: row.get(1)?,
            session_id: row.get(2)?,
            key: row.get(3)?,
            value: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(Value::Null),
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.into())
}

/// Write (create or update) a session memory value.
pub fn write_session_memory(
    db: &DbHandle,
    user_id: &str,
    session_id: &str,
    key: &str,
    value: &Value,
) -> Result<SessionMemoryEntry, SessionMemoryError> {
    if session_id.is_empty() {
        return Err(SessionMemoryError::MissingField("session_id".to_string()));
    }
    if key.is_empty() {
        return Err(SessionMemoryError::MissingField("key".to_string()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let value_json = value.to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO session_memory (id, user_id, session_id, memory_key, value, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT(user_id, session_id, memory_key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at",
        params![&id, user_id, session_id, key, value_json, now],
    )?;

    read_session_memory(db, user_id, session_id, key)?.ok_or_else(|| {
        SessionMemoryError::Database(rusqlite::Error::QueryReturnedNoRows)
    })
}

/// Delete a session memory value by key. Returns true if a row was removed.
pub fn delete_session_memory(
    db: &DbHandle,
    user_id: &str,
    session_id: &str,
    key: &str,
) -> Result<bool, SessionMemoryError> {
    let conn = db.connect()?;
    let rows = conn.execute(
        "DELETE FROM session_memory
         WHERE user_id = ?1 AND session_id = ?2 AND memory_key = ?3",
        params![user_id, session_id, key],
    )?;
    Ok(rows > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_db() -> DbHandle {
        let path = PathBuf::from(format!(
            "/tmp/allternit-session-memory-test-{}.db",
            uuid::Uuid::new_v4()
        ));
        DbHandle::new(path).unwrap()
    }

    #[test]
    fn write_then_read_round_trip() {
        let db = temp_db();
        let entry = write_session_memory(&db, "u1", "s1", "mode", &serde_json::json!("fast"))
            .unwrap();
        assert_eq!(entry.user_id, "u1");
        assert_eq!(entry.session_id, "s1");
        assert_eq!(entry.key, "mode");
        assert_eq!(entry.value, serde_json::json!("fast"));

        let read = read_session_memory(&db, "u1", "s1", "mode").unwrap();
        assert!(read.is_some());
        assert_eq!(read.unwrap().value, serde_json::json!("fast"));
    }

    #[test]
    fn read_missing_returns_none() {
        let db = temp_db();
        let read = read_session_memory(&db, "u1", "s1", "missing").unwrap();
        assert!(read.is_none());
    }

    #[test]
    fn write_updates_existing_value() {
        let db = temp_db();
        write_session_memory(&db, "u1", "s1", "mode", &serde_json::json!("fast")).unwrap();
        let entry = write_session_memory(&db, "u1", "s1", "mode", &serde_json::json!("slow")).unwrap();
        assert_eq!(entry.value, serde_json::json!("slow"));

        let entries = list_session_memory(&db, "u1", "s1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].value, serde_json::json!("slow"));
    }

    #[test]
    fn delete_removes_entry() {
        let db = temp_db();
        write_session_memory(&db, "u1", "s1", "mode", &serde_json::json!("fast")).unwrap();
        let deleted = delete_session_memory(&db, "u1", "s1", "mode").unwrap();
        assert!(deleted);
        assert!(read_session_memory(&db, "u1", "s1", "mode").unwrap().is_none());
    }

    #[test]
    fn delete_missing_returns_false() {
        let db = temp_db();
        let deleted = delete_session_memory(&db, "u1", "s1", "mode").unwrap();
        assert!(!deleted);
    }

    #[test]
    fn entries_are_scoped_by_user_and_session() {
        let db = temp_db();
        write_session_memory(&db, "u1", "s1", "mode", &serde_json::json!("a")).unwrap();
        write_session_memory(&db, "u1", "s2", "mode", &serde_json::json!("b")).unwrap();
        write_session_memory(&db, "u2", "s1", "mode", &serde_json::json!("c")).unwrap();

        assert_eq!(
            read_session_memory(&db, "u1", "s1", "mode").unwrap().unwrap().value,
            serde_json::json!("a")
        );
        assert_eq!(
            read_session_memory(&db, "u1", "s2", "mode").unwrap().unwrap().value,
            serde_json::json!("b")
        );
        assert_eq!(
            read_session_memory(&db, "u2", "s1", "mode").unwrap().unwrap().value,
            serde_json::json!("c")
        );

        assert_eq!(list_session_memory(&db, "u1", "s1").unwrap().len(), 1);
        assert_eq!(list_session_memory(&db, "u1", "s2").unwrap().len(), 1);
        assert_eq!(list_session_memory(&db, "u2", "s1").unwrap().len(), 1);
    }
}
