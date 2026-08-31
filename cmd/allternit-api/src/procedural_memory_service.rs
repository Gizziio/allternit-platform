//! Site-specific procedural memory.
//!
//! Stores reusable successful agent paths extracted from trajectories.
//! Each memory has trigger patterns (domains / keywords) and a ordered list of
//! steps that the planner can recall when starting a similar task.

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db::DbHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProceduralMemoryItem {
    pub id: String,
    pub user_id: String,
    pub agent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub trigger_patterns: Vec<String>,
    pub steps: Vec<Value>,
    pub success_count: i64,
    pub last_used_at: Option<String>,
    pub source_session_id: Option<String>,
    pub verified: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProceduralMemoryRequest {
    pub agent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub trigger_patterns: Vec<String>,
    pub steps: Vec<Value>,
    pub source_session_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProceduralMemoryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub trigger_patterns: Option<Vec<String>>,
    pub steps: Option<Vec<Value>>,
    pub verified: Option<bool>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProceduralMemoryError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("browser history error: {0}")]
    BrowserHistory(#[from] crate::browser_history_service::BrowserHistoryError),
    #[error("not found")]
    NotFound,
    #[error("invalid request: {0}")]
    InvalidRequest(String),
}

fn normalize_patterns(patterns: &[String]) -> Vec<String> {
    patterns
        .iter()
        .map(|p| p.trim().to_lowercase())
        .filter(|p| !p.is_empty())
        .collect()
}

pub fn create_procedural_memory(
    db: &DbHandle,
    user_id: &str,
    req: &CreateProceduralMemoryRequest,
) -> Result<ProceduralMemoryItem, ProceduralMemoryError> {
    if req.name.trim().is_empty() {
        return Err(ProceduralMemoryError::InvalidRequest("name is required".into()));
    }
    if req.trigger_patterns.is_empty() {
        return Err(ProceduralMemoryError::InvalidRequest(
            "at least one trigger pattern is required".into(),
        ));
    }
    if req.steps.is_empty() {
        return Err(ProceduralMemoryError::InvalidRequest(
            "at least one step is required".into(),
        ));
    }

    let id = format!("proc_{}", Uuid::new_v4().simple());
    let patterns = normalize_patterns(&req.trigger_patterns);
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO procedural_memory
         (id, user_id, agent_id, name, description, trigger_patterns, steps, source_session_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            user_id,
            req.agent_id.as_deref(),
            req.name.trim(),
            req.description.as_deref(),
            json!(patterns).to_string(),
            json!(req.steps).to_string(),
            req.source_session_id.as_deref(),
        ],
    )?;
    get_procedural_memory_by_id(db, user_id, &id)?.ok_or(ProceduralMemoryError::NotFound)
}

fn row_to_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProceduralMemoryItem> {
    let patterns_json: String = row.get(5)?;
    let steps_json: String = row.get(6)?;
    Ok(ProceduralMemoryItem {
        id: row.get(0)?,
        user_id: row.get(1)?,
        agent_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        trigger_patterns: serde_json::from_str(&patterns_json).unwrap_or_default(),
        steps: serde_json::from_str(&steps_json).unwrap_or_default(),
        success_count: row.get(7)?,
        last_used_at: row.get(8)?,
        source_session_id: row.get(9)?,
        verified: row.get::<_, i64>(10)? != 0,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn get_procedural_memory_by_id(
    db: &DbHandle,
    user_id: &str,
    id: &str,
) -> Result<Option<ProceduralMemoryItem>, ProceduralMemoryError> {
    let conn = db.connect()?;
    let item = conn
        .query_row(
            "SELECT id, user_id, agent_id, name, description, trigger_patterns, steps, success_count, last_used_at, source_session_id, verified, created_at, updated_at
             FROM procedural_memory
             WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
            row_to_item,
        )
        .optional()?;
    Ok(item)
}

pub fn list_procedural_memory(
    db: &DbHandle,
    user_id: &str,
    agent_id: Option<&str>,
    limit: usize,
) -> Result<Vec<ProceduralMemoryItem>, ProceduralMemoryError> {
    let mut sql = "SELECT id, user_id, agent_id, name, description, trigger_patterns, steps, success_count, last_used_at, source_session_id, verified, created_at, updated_at
                   FROM procedural_memory
                   WHERE user_id = ?1".to_string();
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id.to_string())];
    if let Some(aid) = agent_id {
        sql.push_str(" AND agent_id = ?");
        args.push(Box::new(aid.to_string()));
    }
    sql.push_str(" ORDER BY success_count DESC, updated_at DESC LIMIT ?");
    args.push(Box::new(limit.min(1000) as i64));

    let conn = db.connect()?;
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        args.iter().map(|a| a.as_ref()).collect::<Vec<_>>().as_slice(),
        row_to_item,
    )?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

/// Find procedural memories whose trigger patterns match the provided text
/// (domain, URL, or task description). Simple substring matching.
pub fn find_matching_procedural_memory(
    db: &DbHandle,
    user_id: &str,
    agent_id: Option<&str>,
    context: &str,
    limit: usize,
) -> Result<Vec<ProceduralMemoryItem>, ProceduralMemoryError> {
    let all = list_procedural_memory(db, user_id, agent_id, 1000)?;
    let lower = context.to_lowercase();
    let mut scored: Vec<(i64, ProceduralMemoryItem)> = all
        .into_iter()
        .filter_map(|item| {
            let hits: i64 = item
                .trigger_patterns
                .iter()
                .filter(|p| lower.contains(p.as_str()))
                .count() as i64;
            if hits > 0 {
                Some((hits * item.success_count, item))
            } else {
                None
            }
        })
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(scored.into_iter().map(|(_, item)| item).take(limit).collect())
}

pub fn update_procedural_memory(
    db: &DbHandle,
    user_id: &str,
    id: &str,
    req: &UpdateProceduralMemoryRequest,
) -> Result<ProceduralMemoryItem, ProceduralMemoryError> {
    let existing = get_procedural_memory_by_id(db, user_id, id)?.ok_or(ProceduralMemoryError::NotFound)?;
    let name = req.name.as_deref().unwrap_or(&existing.name).trim();
    if name.is_empty() {
        return Err(ProceduralMemoryError::InvalidRequest("name is required".into()));
    }
    let description = req.description.clone().or(existing.description);
    let patterns = req
        .trigger_patterns
        .as_ref()
        .map(|p| normalize_patterns(p))
        .unwrap_or(existing.trigger_patterns);
    let steps = req.steps.clone().unwrap_or(existing.steps);
    let verified = req.verified.unwrap_or(existing.verified);

    let conn = db.connect()?;
    conn.execute(
        "UPDATE procedural_memory
         SET name = ?1, description = ?2, trigger_patterns = ?3, steps = ?4, verified = ?5, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?6 AND user_id = ?7",
        params![
            name,
            description.as_deref(),
            json!(patterns).to_string(),
            json!(steps).to_string(),
            verified,
            id,
            user_id,
        ],
    )?;
    get_procedural_memory_by_id(db, user_id, id)?.ok_or(ProceduralMemoryError::NotFound)
}

pub fn record_procedural_memory_use(
    db: &DbHandle,
    user_id: &str,
    id: &str,
) -> Result<ProceduralMemoryItem, ProceduralMemoryError> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE procedural_memory
         SET success_count = success_count + 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )?;
    get_procedural_memory_by_id(db, user_id, id)?.ok_or(ProceduralMemoryError::NotFound)
}

pub fn delete_procedural_memory(
    db: &DbHandle,
    user_id: &str,
    id: &str,
) -> Result<bool, ProceduralMemoryError> {
    let conn = db.connect()?;
    let affected = conn.execute(
        "DELETE FROM procedural_memory WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )?;
    Ok(affected > 0)
}

/// Heuristic extraction of a procedural memory from browser history for a
/// session. Groups consecutive visits by domain and builds a step list.
pub fn extract_from_session_history(
    db: &DbHandle,
    user_id: &str,
    agent_id: Option<&str>,
    session_id: &str,
) -> Result<Option<ProceduralMemoryItem>, ProceduralMemoryError> {
    let history = crate::browser_history_service::list_recent(
        db,
        user_id,
        &crate::browser_history_service::RecentHistoryQuery {
            agent_id: agent_id.map(|s| s.to_string()),
            session_id: Some(session_id.to_string()),
            domain: None,
            since_hours: None,
            limit: Some(100),
        },
    )?;

    if history.len() < 2 {
        return Ok(None);
    }

    let domains: Vec<String> = history
        .iter()
        .map(|h| h.domain.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let steps: Vec<Value> = history
        .iter()
        .map(|h| {
            json!({
                "action": "navigate",
                "url": h.url,
                "title": h.title,
                "domain": h.domain,
                "visit_time": h.visit_time,
            })
        })
        .collect();

    let name = format!(
        "Workflow on {}",
        domains.first().cloned().unwrap_or_else(|| "unknown".into())
    );
    let description = Some(format!(
        "Extracted path across {} domains from session {}",
        domains.len(),
        session_id
    ));

    create_procedural_memory(
        db,
        user_id,
        &CreateProceduralMemoryRequest {
            agent_id: agent_id.map(|s| s.to_string()),
            name,
            description,
            trigger_patterns: domains,
            steps,
            source_session_id: Some(session_id.to_string()),
        },
    )
    .map(Some)
}
