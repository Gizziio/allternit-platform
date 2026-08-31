//! Ultrabrowse deep-research task tracking.
//!
//! Stores research queries and their synthesized results. The actual web
//! browsing and synthesis are executed by the ACU engine / research plugin;
//! this service records the task lifecycle and output.

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db::DbHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchTask {
    pub id: String,
    pub user_id: String,
    pub agent_id: Option<String>,
    pub query: String,
    pub mode: String,
    pub status: String,
    pub sources: Option<Value>,
    pub synthesis: Option<String>,
    pub max_depth: i64,
    pub max_sources: i64,
    pub metadata: Option<Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateResearchTaskRequest {
    pub agent_id: Option<String>,
    pub query: String,
    pub mode: Option<String>,
    pub max_depth: Option<i64>,
    pub max_sources: Option<i64>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateResearchTaskRequest {
    pub status: Option<String>,
    pub sources: Option<Value>,
    pub synthesis: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum ResearchTaskError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("not found")]
    NotFound,
    #[error("invalid request: {0}")]
    InvalidRequest(String),
}

fn row_to_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<ResearchTask> {
    let sources_json: Option<String> = row.get(6)?;
    let metadata_json: Option<String> = row.get(10)?;
    Ok(ResearchTask {
        id: row.get(0)?,
        user_id: row.get(1)?,
        agent_id: row.get(2)?,
        query: row.get(3)?,
        mode: row.get(4)?,
        status: row.get(5)?,
        sources: sources_json.and_then(|s| serde_json::from_str(&s).ok()),
        synthesis: row.get(7)?,
        max_depth: row.get(8)?,
        max_sources: row.get(9)?,
        metadata: metadata_json.and_then(|s| serde_json::from_str(&s).ok()),
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn create_research_task(
    db: &DbHandle,
    user_id: &str,
    req: &CreateResearchTaskRequest,
) -> Result<ResearchTask, ResearchTaskError> {
    let query = req.query.trim();
    if query.is_empty() {
        return Err(ResearchTaskError::InvalidRequest("query is required".into()));
    }
    let id = format!("rt_{}", Uuid::new_v4().simple());
    let mode = req.mode.as_deref().unwrap_or("ultrabrowse");
    let max_depth = req.max_depth.unwrap_or(3).max(1).min(10);
    let max_sources = req.max_sources.unwrap_or(10).max(1).min(100);
    let metadata = req.metadata.clone().unwrap_or_else(|| json!({}));

    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO research_tasks
         (id, user_id, agent_id, query, mode, status, max_depth, max_sources, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7, ?8)",
        params![
            id,
            user_id,
            req.agent_id.as_deref(),
            query,
            mode,
            max_depth,
            max_sources,
            metadata.to_string(),
        ],
    )?;

    get_research_task_by_id(db, user_id, &id)?.ok_or(ResearchTaskError::NotFound)
}

pub fn get_research_task_by_id(
    db: &DbHandle,
    user_id: &str,
    id: &str,
) -> Result<Option<ResearchTask>, ResearchTaskError> {
    let conn = db.connect()?;
    let item = conn
        .query_row(
            "SELECT id, user_id, agent_id, query, mode, status, sources, synthesis, max_depth, max_sources, metadata, created_at, updated_at
             FROM research_tasks
             WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
            row_to_task,
        )
        .optional()?;
    Ok(item)
}

pub fn list_research_tasks(
    db: &DbHandle,
    user_id: &str,
    limit: usize,
) -> Result<Vec<ResearchTask>, ResearchTaskError> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, user_id, agent_id, query, mode, status, sources, synthesis, max_depth, max_sources, metadata, created_at, updated_at
         FROM research_tasks
         WHERE user_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![user_id, limit.min(1000) as i64], row_to_task)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn update_research_task(
    db: &DbHandle,
    user_id: &str,
    id: &str,
    req: &UpdateResearchTaskRequest,
) -> Result<ResearchTask, ResearchTaskError> {
    let existing = get_research_task_by_id(db, user_id, id)?.ok_or(ResearchTaskError::NotFound)?;
    let status = req.status.as_deref().unwrap_or(&existing.status);
    let sources = req.sources.clone().or(existing.sources);
    let synthesis = req.synthesis.clone().or(existing.synthesis);
    let metadata = req.metadata.clone().or(existing.metadata);

    let conn = db.connect()?;
    conn.execute(
        "UPDATE research_tasks
         SET status = ?1, sources = ?2, synthesis = ?3, metadata = ?4, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5 AND user_id = ?6",
        params![
            status,
            sources.as_ref().map(|v| v.to_string()),
            synthesis.as_deref(),
            metadata.as_ref().map(|v| v.to_string()),
            id,
            user_id,
        ],
    )?;

    get_research_task_by_id(db, user_id, id)?.ok_or(ResearchTaskError::NotFound)
}

pub fn delete_research_task(db: &DbHandle, user_id: &str, id: &str) -> Result<bool, ResearchTaskError> {
    let conn = db.connect()?;
    let affected = conn.execute(
        "DELETE FROM research_tasks WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )?;
    Ok(affected > 0)
}
