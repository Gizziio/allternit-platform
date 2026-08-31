//! Browser history ingestion and recall service.
//!
//! Stores visits from the browser extension and computer-use agent runtime so
//! they can be recalled during planning ("I was looking at X yesterday").

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db::DbHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserHistoryItem {
    pub id: String,
    pub user_id: String,
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub url: String,
    pub title: Option<String>,
    pub domain: String,
    pub visit_time: String,
    pub transition_type: Option<String>,
    pub source: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecordVisitRequest {
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub url: String,
    pub title: Option<String>,
    pub visit_time: Option<String>,
    pub transition_type: Option<String>,
    pub source: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecentHistoryQuery {
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub domain: Option<String>,
    pub since_hours: Option<i64>,
    pub limit: Option<usize>,
}

#[derive(Debug, thiserror::Error)]
pub enum BrowserHistoryError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid url: {0}")]
    InvalidUrl(String),
}

fn normalize_url(url: &str) -> Result<(String, String), BrowserHistoryError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(BrowserHistoryError::InvalidUrl("empty url".into()));
    }
    let lower = trimmed.to_lowercase();
    // Strip scheme.
    let without_scheme = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .unwrap_or(&lower);
    // Take host portion before first path segment.
    let host = without_scheme.split('/').next().unwrap_or(without_scheme);
    if host.is_empty() {
        return Err(BrowserHistoryError::InvalidUrl(trimmed.into()));
    }
    // Remove default port if present.
    let domain = host
        .strip_suffix(":443")
        .or_else(|| host.strip_suffix(":80"))
        .unwrap_or(host)
        .to_string();
    let canonical = format!("https://{}", without_scheme);
    Ok((canonical, domain))
}

/// Record a browser visit. Deduplicates against the most recent visit for the
/// same URL within a 5-minute window.
pub fn record_visit(
    db: &DbHandle,
    user_id: &str,
    req: &RecordVisitRequest,
) -> Result<String, BrowserHistoryError> {
    let (url, domain) = normalize_url(&req.url)?;
    let id = format!("bh_{}", Uuid::new_v4().simple());
    let conn = db.connect()?;

    // Deduplicate: if the same URL was recorded in the last 5 minutes, update
    // the title instead of creating a new row.
    let recent_id: Option<String> = conn
        .query_row(
            "SELECT id FROM browser_history_items
             WHERE user_id = ?1 AND url = ?2
               AND visit_time >= datetime('now', '-5 minutes')
             ORDER BY visit_time DESC LIMIT 1",
            params![user_id, url],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(existing_id) = recent_id {
        conn.execute(
            "UPDATE browser_history_items
             SET title = ?1, visit_time = CURRENT_TIMESTAMP, transition_type = ?2, metadata = ?3
             WHERE id = ?4",
            params![
                req.title.as_deref(),
                req.transition_type.as_deref(),
                req.metadata.as_ref().map(|m| m.to_string()),
                existing_id,
            ],
        )?;
        return Ok(existing_id);
    }

    let metadata = req
        .metadata
        .clone()
        .unwrap_or_else(|| json!({ "url": url, "title": req.title }));

    conn.execute(
        "INSERT INTO browser_history_items
         (id, user_id, agent_id, session_id, url, title, domain, visit_time, transition_type, source, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(?8, CURRENT_TIMESTAMP), ?9, ?10, ?11)",
        params![
            id,
            user_id,
            req.agent_id.as_deref(),
            req.session_id.as_deref(),
            url,
            req.title.as_deref(),
            domain,
            req.visit_time.as_deref(),
            req.transition_type.as_deref(),
            req.source.as_deref().unwrap_or("browser-extension"),
            metadata.to_string(),
        ],
    )?;

    Ok(id)
}

pub fn list_recent(
    db: &DbHandle,
    user_id: &str,
    query: &RecentHistoryQuery,
) -> Result<Vec<BrowserHistoryItem>, BrowserHistoryError> {
    let mut sql = "SELECT id, user_id, agent_id, session_id, url, title, domain, visit_time, transition_type, source, metadata
                   FROM browser_history_items
                   WHERE user_id = ?1".to_string();
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id.to_string())];

    if let Some(ref agent_id) = query.agent_id {
        sql.push_str(" AND agent_id = ?");
        args.push(Box::new(agent_id.clone()));
    }
    if let Some(ref session_id) = query.session_id {
        sql.push_str(" AND session_id = ?");
        args.push(Box::new(session_id.clone()));
    }
    if let Some(ref domain) = query.domain {
        sql.push_str(" AND domain = ?");
        args.push(Box::new(domain.to_lowercase()));
    }
    if let Some(hours) = query.since_hours {
        sql.push_str(" AND visit_time >= datetime('now', ?)");
        args.push(Box::new(format!("-{hours} hours")));
    }

    sql.push_str(" ORDER BY visit_time DESC LIMIT ?");
    let limit = query.limit.unwrap_or(100).min(1000);
    args.push(Box::new(limit as i64));

    let conn = db.connect()?;
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        args.iter().map(|a| a.as_ref()).collect::<Vec<_>>().as_slice(),
        |row| {
            Ok(BrowserHistoryItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                agent_id: row.get(2)?,
                session_id: row.get(3)?,
                url: row.get(4)?,
                title: row.get(5)?,
                domain: row.get(6)?,
                visit_time: row.get(7)?,
                transition_type: row.get(8)?,
                source: row.get(9)?,
                metadata: row.get::<_, Option<String>>(10)?.and_then(|s| serde_json::from_str(&s).ok()),
            })
        },
    )?;

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn search_history(
    db: &DbHandle,
    user_id: &str,
    q: &str,
    limit: usize,
) -> Result<Vec<BrowserHistoryItem>, BrowserHistoryError> {
    let pattern = format!("%{}%", q.replace('%', "\\%").replace('_', "\\_"));
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, user_id, agent_id, session_id, url, title, domain, visit_time, transition_type, source, metadata
         FROM browser_history_items
         WHERE user_id = ?1 AND (title LIKE ?2 ESCAPE '\\' OR url LIKE ?2 ESCAPE '\\' OR domain LIKE ?2 ESCAPE '\\')
         ORDER BY visit_time DESC
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![user_id, pattern, limit.min(1000) as i64], |row| {
        Ok(BrowserHistoryItem {
            id: row.get(0)?,
            user_id: row.get(1)?,
            agent_id: row.get(2)?,
            session_id: row.get(3)?,
            url: row.get(4)?,
            title: row.get(5)?,
            domain: row.get(6)?,
            visit_time: row.get(7)?,
            transition_type: row.get(8)?,
            source: row.get(9)?,
            metadata: row.get::<_, Option<String>>(10)?.and_then(|s| serde_json::from_str(&s).ok()),
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn delete_history_for_user(db: &DbHandle, user_id: &str) -> Result<usize, BrowserHistoryError> {
    let conn = db.connect()?;
    let count = conn.execute(
        "DELETE FROM browser_history_items WHERE user_id = ?1",
        params![user_id],
    )?;
    Ok(count)
}
