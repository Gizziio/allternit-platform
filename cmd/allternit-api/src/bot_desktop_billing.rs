//! Desktop usage billing and metering.
//!
//! Reads the `desktop_usage` table populated by the quota module and applies
//! per-provider/OS prices from `desktop_pricing`.

use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/desktop-usage", get(list_usage))
        .route("/desktop-usage/summary", get(usage_summary))
}

#[derive(Debug, Deserialize)]
pub struct UsageQuery {
    pub start: Option<String>,
    pub end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UsageRow {
    pub bot_id: String,
    pub sandbox_id: String,
    pub provider: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub minutes: Option<i64>,
    pub cost: f64,
    pub currency: String,
}

#[derive(Debug, Serialize)]
pub struct UsageSummary {
    pub total_minutes: i64,
    pub total_cost: f64,
    pub currency: String,
    pub rows: usize,
}

fn parse_rfc3339(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .ok()
}

async fn list_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<UsageQuery>,
) -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let mut sql = String::from(
            "SELECT u.bot_id, u.sandbox_id, u.provider, u.os, u.started_at, u.ended_at, u.minutes \
             FROM desktop_usage u \
             WHERE u.user_id = ?1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id.clone())];

        if let Some(ref start) = query.start {
            sql.push_str(&format!(" AND u.started_at >= ?{}", params.len() + 1));
            params.push(Box::new(start.clone()));
        }
        if let Some(ref end) = query.end {
            sql.push_str(&format!(" AND u.started_at <= ?{}", params.len() + 1));
            params.push(Box::new(end.clone()));
        }
        sql.push_str(" ORDER BY u.started_at DESC");

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<i64>>(6)?,
            ))
        }).map_err(|e| e.to_string())?;

        let mut usage = Vec::new();
        let prices = load_pricing(&conn).map_err(|e| e.to_string())?;
        for row in rows {
            let (bot_id, sandbox_id, provider, os, started_at, ended_at, minutes) = row.map_err(|e| e.to_string())?;
            let os = os.unwrap_or_else(|| "linux".to_string());
            let key = format!("{}:{}", provider, os);
            let price = prices.get(&key).copied().unwrap_or(0.0);
            let cost = minutes.unwrap_or(0) as f64 * price;
            usage.push(UsageRow {
                bot_id,
                sandbox_id,
                provider,
                started_at,
                ended_at,
                minutes,
                cost,
                currency: "USD".to_string(),
            });
        }
        Ok::<_, String>(usage)
    })
    .await;

    match result {
        Ok(Ok(usage)) => (StatusCode::OK, Json(serde_json::json!({ "usage": usage }))).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list desktop usage");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing desktop usage");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
    }
}

async fn usage_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<UsageQuery>,
) -> impl IntoResponse {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(|e| e.to_string())?;
        let mut sql = String::from(
            "SELECT u.provider, u.os, COALESCE(SUM(u.minutes), 0) \
             FROM desktop_usage u \
             WHERE u.user_id = ?1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id.clone())];

        if let Some(ref start) = query.start {
            sql.push_str(&format!(" AND u.started_at >= ?{}", params.len() + 1));
            params.push(Box::new(start.clone()));
        }
        if let Some(ref end) = query.end {
            sql.push_str(&format!(" AND u.started_at <= ?{}", params.len() + 1));
            params.push(Box::new(end.clone()));
        }
        sql.push_str(" GROUP BY u.provider, u.os");

        let prices = load_pricing(&conn).map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, i64>(2)?))
        }).map_err(|e| e.to_string())?;

        let mut total_minutes = 0i64;
        let mut total_cost = 0.0;
        let mut row_count = 0usize;
        for row in rows {
            let (provider, os, minutes) = row.map_err(|e| e.to_string())?;
            let os = os.unwrap_or_else(|| "linux".to_string());
            let key = format!("{}:{}", provider, os);
            let price = prices.get(&key).copied().unwrap_or(0.0);
            total_minutes += minutes;
            total_cost += minutes as f64 * price;
            row_count += 1;
        }
        Ok::<_, String>(UsageSummary {
            total_minutes,
            total_cost,
            currency: "USD".to_string(),
            rows: row_count,
        })
    })
    .await;

    match result {
        Ok(Ok(summary)) => (StatusCode::OK, Json(serde_json::json!(summary))).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to summarize desktop usage");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked summarizing desktop usage");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response()
        }
    }
}

fn load_pricing(conn: &rusqlite::Connection) -> Result<HashMap<String, f64>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT provider, os, price_per_minute FROM desktop_pricing")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            format!("{}:{}", row.get::<_, String>(0)?, row.get::<_, String>(1)?),
            row.get::<_, f64>(2)?,
        ))
    })?;
    let mut map = HashMap::new();
    for row in rows {
        let (k, v) = row?;
        map.insert(k, v);
    }
    Ok(map)
}
