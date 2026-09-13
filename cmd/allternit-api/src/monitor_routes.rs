//! Monitor API routes — live operational view for the Agent Monitor surface
//! (`surfaces/ai.allternit.com/src/views/MonitorView.tsx`).
//!
//! Everything here is read-only and computed from real tables: no fabricated
//! per-agent telemetry. Agent rows report session/task aggregates the schema
//! actually tracks; fields the schema does not track (per-process memory,
//! per-agent latency) come back as zero/empty rather than invented numbers.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::json;
use std::sync::{Arc, OnceLock};
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

fn process_start() -> std::time::Instant {
    static START: OnceLock<std::time::Instant> = OnceLock::new();
    *START.get_or_init(std::time::Instant::now)
}

pub fn monitor_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/monitor/agents", get(monitor_agents))
        .route("/monitor/logs", get(monitor_logs))
        .route("/monitor/system", get(monitor_system))
}

/// "YYYY-MM-DD HH:MM:SS" (SQLite CURRENT_TIMESTAMP) → ("YYYY-MM-DD", "HH:MM:SS").
fn split_sqlite_datetime(raw: &str) -> (String, String) {
    let date = raw.get(..10).unwrap_or("").to_string();
    let time = raw
        .get(11..19)
        .filter(|_| raw.len() >= 19)
        .unwrap_or("")
        .to_string();
    (date, time)
}

fn hours_since(raw: &str) -> Option<f64> {
    let parsed = chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S").ok()?;
    let now = chrono::Utc::now().naive_utc();
    Some((now - parsed).num_minutes() as f64 / 60.0)
}

fn format_uptime(hours: f64) -> String {
    if hours >= 48.0 {
        format!("{:.0}d", hours / 24.0)
    } else if hours >= 1.0 {
        format!("{:.0}h", hours)
    } else {
        format!("{:.0}m", hours * 60.0)
    }
}

// ─── GET /monitor/agents ──────────────────────────────────────────────────────

async fn monitor_agents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Per-agent row: session aggregates the schema honestly tracks.
        let mut stmt = conn.prepare(
            "SELECT a.id, a.name, a.type, a.model, a.status, a.created_at, a.last_run_at, a.updated_at,
                    (SELECT COUNT(*) FROM beta_sessions s WHERE s.agent_id = a.id) AS session_count,
                    (SELECT COUNT(*) FROM beta_sessions s WHERE s.agent_id = a.id AND s.status = 'active') AS active_sessions,
                    COALESCE((SELECT SUM(s.tokens_used) FROM beta_sessions s WHERE s.agent_id = a.id), 0) AS tokens_used
             FROM agents a
             WHERE a.user_id = ?1 AND a.status != 'prototype'
             ORDER BY a.updated_at DESC",
        )?;
        let agents = stmt
            .query_map(params![user_id], |row| {
                let created_at: String = row.get(5)?;
                let last_run_at: Option<String> = row.get(6)?;
                let updated_at: String = row.get(7)?;
                let db_status: String = row.get(4)?;
                let active_sessions: i64 = row.get(9)?;
                // Surface status: an agent with live sessions reads as active;
                // otherwise map the stored lifecycle status.
                let status = if active_sessions > 0 {
                    "active"
                } else {
                    match db_status.as_str() {
                        "active" => "active",
                        "error" => "error",
                        "paused" | "archived" => "paused",
                        _ => "idle",
                    }
                };
                let last_activity = last_run_at.unwrap_or(updated_at);
                let (_, activity_time) = split_sqlite_datetime(&last_activity);
                let uptime = hours_since(&created_at)
                    .map(format_uptime)
                    .unwrap_or_else(|| "—".to_string());
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "type": row.get::<_, String>(2)?,
                    "model": row.get::<_, String>(3)?,
                    "status": status,
                    "taskCount": row.get::<_, i64>(8)?,
                    "tokensUsed": row.get::<_, i64>(10)?,
                    // Per-agent latency and memory are not tracked in the
                    // schema; zero renders as "—" / "0 MB" in the view.
                    "latencyMs": 0,
                    "uptime": uptime,
                    "lastActivity": activity_time,
                    "memMb": 0,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let summary = conn.query_row(
            "SELECT
                (SELECT COUNT(*) FROM agents WHERE user_id = ?1 AND status != 'prototype'),
                (SELECT COUNT(*) FROM beta_sessions WHERE user_id = ?1 AND status = 'active'),
                (SELECT COUNT(*) FROM beta_sessions WHERE user_id = ?1 AND status = 'archived'),
                (SELECT COUNT(*) FROM beta_work_tasks WHERE user_id = ?1 AND status IN ('queued', 'leased')),
                (SELECT COUNT(*) FROM beta_work_tasks WHERE user_id = ?1 AND status = 'running'),
                (SELECT COUNT(*) FROM beta_deployments
                  WHERE user_id = ?1 AND status = 'active'
                    AND next_run_at IS NOT NULL
                    AND next_run_at <= datetime('now', '+24 hours'))",
            params![user_id],
            |row| {
                Ok(json!({
                    "total_agents": row.get::<_, i64>(0)?,
                    "sessions": { "active": row.get::<_, i64>(1)?, "archived": row.get::<_, i64>(2)? },
                    "work_tasks": {
                        "pending": row.get::<_, i64>(3)?,
                        "in_flight": row.get::<_, i64>(4)?,
                    },
                    "deployments_due_24h": row.get::<_, i64>(5)?,
                }))
            },
        )?;

        Ok::<_, rusqlite::Error>((agents, summary))
    })
    .await;

    match result {
        Ok(Ok((agents, summary))) => Json(json!({ "agents": agents, "summary": summary }))
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error building monitor agents: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── GET /monitor/logs ────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct LogsQuery {
    limit: Option<u32>,
}

async fn monitor_logs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(q): Query<LogsQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(100).clamp(1, 500) as i64;
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let mut stmt = conn.prepare(
            "SELECT e.id, e.event_type, e.data, e.created_at, COALESCE(a.name, s.name, e.session_id)
             FROM beta_session_events e
             JOIN beta_sessions s ON s.id = e.session_id
             LEFT JOIN agents a ON a.id = s.agent_id
             WHERE s.user_id = ?1
             ORDER BY e.sequence DESC
             LIMIT ?2",
        )?;
        let session_events = stmt
            .query_map(params![user_id, limit], |row| {
                let id: String = row.get(0)?;
                let event_type: String = row.get(1)?;
                let data_raw: String = row.get(2)?;
                let created_at: String = row.get(3)?;
                let agent: Option<String> = row.get(4)?;
                let data: serde_json::Value =
                    serde_json::from_str(&data_raw).unwrap_or_else(|_| json!({}));
                let detail = data
                    .get("message")
                    .or_else(|| data.get("error"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let lower = event_type.to_lowercase();
                let level = if lower.contains("error") {
                    "error"
                } else if lower.contains("warn") {
                    "warn"
                } else {
                    "info"
                };
                let message = if detail.is_empty() {
                    event_type
                } else {
                    format!("{event_type}: {detail}")
                };
                let (_, time) = split_sqlite_datetime(&created_at);
                Ok(json!({
                    "id": id,
                    "source": "session",
                    "time": time,
                    "level": level,
                    "agent": agent.unwrap_or_else(|| "session".to_string()),
                    "message": message,
                    "created_at": created_at,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut stmt = conn.prepare(
            "SELECT id, model_id, status, error_type, latency_ms, created_at
             FROM llm_usage_events
             WHERE user_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;
        let llm_events = stmt
            .query_map(params![user_id, limit], |row| {
                let id: String = row.get(0)?;
                let model_id: Option<String> = row.get(1)?;
                let status: String = row.get(2)?;
                let error_type: Option<String> = row.get(3)?;
                let latency_ms: i64 = row.get(4)?;
                let created_at: String = row.get(5)?;
                let level = match status.as_str() {
                    "ok" | "in_progress" => "info",
                    "error" => "error",
                    _ => "warn",
                };
                let mut message = format!(
                    "{}: {status}",
                    model_id.as_deref().unwrap_or("llm-gateway")
                );
                if let Some(et) = error_type {
                    message.push_str(&format!(" ({et})"));
                }
                if latency_ms > 0 {
                    message.push_str(&format!(" {latency_ms}ms"));
                }
                let (_, time) = split_sqlite_datetime(&created_at);
                Ok(json!({
                    "id": id,
                    "source": "llm",
                    "time": time,
                    "level": level,
                    "agent": model_id.unwrap_or_else(|| "llm-gateway".to_string()),
                    "message": message,
                    "created_at": created_at,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut logs = session_events;
        logs.extend(llm_events);
        // Newest first across both sources; created_at strings share the
        // SQLite "YYYY-MM-DD HH:MM:SS" format, so lexicographic order is
        // chronological.
        logs.sort_by(|a, b| {
            b["created_at"]
                .as_str()
                .unwrap_or("")
                .cmp(a["created_at"].as_str().unwrap_or(""))
        });
        logs.truncate(limit as usize);
        for log in &mut logs {
            log.as_object_mut().map(|m| m.remove("created_at"));
        }
        Ok::<_, rusqlite::Error>(logs)
    })
    .await;

    match result {
        Ok(Ok(logs)) => Json(json!({ "logs": logs })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error building monitor logs: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── GET /monitor/system ──────────────────────────────────────────────────────

const COUNTED_TABLES: &[&str] = &[
    "agents",
    "beta_sessions",
    "beta_session_events",
    "llm_usage_events",
    "beta_work_tasks",
];

async fn monitor_system(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let uptime_seconds = process_start().elapsed().as_secs();
    let db_size_bytes = std::fs::metadata(state.db.path()).map(|m| m.len()).unwrap_or(0);
    let db = state.db.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let mut table_counts = serde_json::Map::new();
        for table in COUNTED_TABLES {
            let count: i64 = conn.query_row(
                &format!("SELECT COUNT(*) FROM {table}"),
                [],
                |row| row.get(0),
            )?;
            table_counts.insert(table.to_string(), json!(count));
        }

        let mut work_queue = serde_json::Map::new();
        for status in ["queued", "leased", "running", "succeeded", "failed", "cancelled"] {
            work_queue.insert(status.to_string(), json!(0));
        }
        let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM beta_work_tasks GROUP BY status")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (status, count) = row?;
            work_queue.insert(status, json!(count));
        }

        Ok::<_, rusqlite::Error>(json!({
            "table_counts": table_counts,
            "work_queue": work_queue,
        }))
    })
    .await;

    match result {
        Ok(Ok(stats)) => Json(json!({
            "uptime_seconds": uptime_seconds,
            "db_size_bytes": db_size_bytes,
            "table_counts": stats["table_counts"],
            "work_queue": stats["work_queue"],
            "deployment_scheduler": state.deployment_scheduler.snapshot(),
        }))
        .into_response(),
        Ok(Err(e)) => {
            warn!("DB error building monitor system: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::beta_session_routes::tests as beta_test;

    async fn get_json(router: &Router, path: &str, user: &str) -> (StatusCode, serde_json::Value) {
        let response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(path)
                    .extension(beta_test::test_user(user))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = response.status();
        let payload: serde_json::Value = serde_json::from_slice(
            &response.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap_or_else(|_| json!({}));
        (status, payload)
    }

    /// Seed one agent, one active + one archived session with events, one
    /// queued + one running work task, one due deployment, one LLM usage row.
    fn seed_fixture(state: &Arc<AppState>, user: &str) {
        let conn = state.db.connect().unwrap();
        let agent_id = "agent-fixture-1";
        conn.execute(
            "INSERT INTO agents (id, user_id, name, model, provider, status, type)
             VALUES (?1, ?2, 'Fixture Agent', 'allternit-fast', 'allternit', 'idle', 'worker')",
            params![agent_id, user],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_sessions (id, user_id, agent_id, name, status, tokens_used)
             VALUES ('sess-active', ?1, ?2, 'Active Session', 'active', 1500)",
            params![user, agent_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_sessions (id, user_id, agent_id, name, status, tokens_used)
             VALUES ('sess-archived', ?1, ?2, 'Archived Session', 'archived', 500)",
            params![user, agent_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_session_events (id, session_id, event_type, data)
             VALUES ('evt-1', 'sess-active', 'message.completed', '{\"message\": \"hello\"}')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_session_events (id, session_id, event_type, data)
             VALUES ('evt-2', 'sess-active', 'run.error', '{\"error\": \"boom\"}')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_work_tasks (id, user_id, session_id, status)
             VALUES ('task-1', ?1, 'sess-active', 'queued')",
            params![user],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_work_tasks (id, user_id, session_id, status)
             VALUES ('task-2', ?1, 'sess-active', 'running')",
            params![user],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO beta_deployments (id, user_id, agent_id, cron, status, next_run_at)
             VALUES ('dep-1', ?1, ?2, '0 * * * *', 'active', datetime('now', '+1 hour'))",
            params![user, agent_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO llm_usage_events (id, user_id, model_id, status, latency_ms)
             VALUES ('llm-1', ?1, 'allternit-fast', 'ok', 42)",
            params![user],
        )
        .unwrap();
    }

    #[tokio::test]
    async fn monitor_agents_reports_honest_rows_and_summary() {
        let temp = beta_test::temp_dir("monitor-agents");
        let state = beta_test::test_app_state(&temp).await;
        seed_fixture(&state, "user-a");
        let router = monitor_router().with_state(state);

        let (status, payload) = get_json(&router, "/monitor/agents", "user-a").await;
        assert_eq!(status, StatusCode::OK);

        let agents = payload["agents"].as_array().unwrap();
        assert_eq!(agents.len(), 1);
        let agent = &agents[0];
        assert_eq!(agent["name"], "Fixture Agent");
        // One active session → the agent reads as active.
        assert_eq!(agent["status"], "active");
        // taskCount is the session count; tokens come from session rows.
        assert_eq!(agent["taskCount"], 2);
        assert_eq!(agent["tokensUsed"], 2000);

        let summary = &payload["summary"];
        assert_eq!(summary["total_agents"], 1);
        assert_eq!(summary["sessions"]["active"], 1);
        assert_eq!(summary["sessions"]["archived"], 1);
        assert_eq!(summary["work_tasks"]["pending"], 1);
        assert_eq!(summary["work_tasks"]["in_flight"], 1);
        assert_eq!(summary["deployments_due_24h"], 1);

        // Other users see nothing.
        let (status, payload) = get_json(&router, "/monitor/agents", "user-b").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["agents"].as_array().unwrap().len(), 0);
        assert_eq!(payload["summary"]["total_agents"], 0);
    }

    #[tokio::test]
    async fn monitor_agents_excludes_prototypes() {
        let temp = beta_test::temp_dir("monitor-proto");
        let state = beta_test::test_app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT INTO agents (id, user_id, name, model, provider, status)
             VALUES ('proto-1', 'user-a', 'Draft', 'allternit-fast', 'allternit', 'prototype')",
            [],
        )
        .unwrap();
        let router = monitor_router().with_state(state);

        let (_, payload) = get_json(&router, "/monitor/agents", "user-a").await;
        assert_eq!(payload["agents"].as_array().unwrap().len(), 0);
        assert_eq!(payload["summary"]["total_agents"], 0);
    }

    #[tokio::test]
    async fn monitor_logs_interleaves_sources_newest_first() {
        let temp = beta_test::temp_dir("monitor-logs");
        let state = beta_test::test_app_state(&temp).await;
        seed_fixture(&state, "user-a");
        let router = monitor_router().with_state(state);

        let (status, payload) = get_json(&router, "/monitor/logs", "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let logs = payload["logs"].as_array().unwrap();
        assert_eq!(logs.len(), 3);

        let sources: Vec<&str> = logs.iter().map(|l| l["source"].as_str().unwrap()).collect();
        assert!(sources.contains(&"session"));
        assert!(sources.contains(&"llm"));

        let by_id = |id: &str| logs.iter().find(|l| l["id"] == id).unwrap();
        assert_eq!(by_id("evt-2")["level"], "error");
        assert!(by_id("evt-2")["message"].as_str().unwrap().contains("boom"));
        assert_eq!(by_id("evt-1")["level"], "info");
        assert_eq!(by_id("llm-1")["level"], "info");
        assert!(by_id("llm-1")["message"].as_str().unwrap().contains("allternit-fast"));
        // Every row carries a HH:MM:SS timestamp.
        for log in logs {
            assert_eq!(log["time"].as_str().unwrap().len(), 8);
        }

        // Limit is honored.
        let (_, payload) = get_json(&router, "/monitor/logs?limit=2", "user-a").await;
        assert_eq!(payload["logs"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn monitor_system_reports_uptime_db_and_counts() {
        let temp = beta_test::temp_dir("monitor-system");
        let state = beta_test::test_app_state(&temp).await;
        seed_fixture(&state, "user-a");
        let router = monitor_router().with_state(state);

        let (status, payload) = get_json(&router, "/monitor/system", "user-a").await;
        assert_eq!(status, StatusCode::OK);

        assert!(payload["uptime_seconds"].as_u64().is_some());
        assert!(payload["db_size_bytes"].as_u64().unwrap() > 0);

        let tables = &payload["table_counts"];
        assert_eq!(tables["agents"], 1);
        assert_eq!(tables["beta_sessions"], 2);
        assert_eq!(tables["beta_session_events"], 2);
        assert_eq!(tables["llm_usage_events"], 1);
        assert_eq!(tables["beta_work_tasks"], 2);

        let queue = &payload["work_queue"];
        assert_eq!(queue["queued"], 1);
        assert_eq!(queue["running"], 1);
        assert_eq!(queue["succeeded"], 0);
    }
}
