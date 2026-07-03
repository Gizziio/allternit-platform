//! Goals, Routines, and Loops API
//!
//! Surfaces gizzi-code's cron/routine/loop runtime through the Allternit
//! platform API. Goals are platform-owned objectives that can own routines
//! (persistent scheduled jobs) and loops (session-scoped recurring jobs).

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use crate::auth::get_user;
use crate::AppState;

fn cron_daemon_base() -> String {
    crate::config::AppConfig::load()
        .cron_daemon_url()
        .trim_end_matches('/')
        .to_string()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Types
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub agent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub target_date: Option<String>,
    pub progress: i32,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Routine {
    pub id: String,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub agent_id: Option<String>,
    pub goal_id: Option<String>,
    pub gizzi_job_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub schedule_type: String,
    pub schedule_expression: String,
    pub timezone: Option<String>,
    pub config: serde_json::Value,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    pub max_runs: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub max_retries: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Loop {
    pub id: String,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub agent_id: Option<String>,
    pub goal_id: Option<String>,
    pub gizzi_job_id: Option<String>,
    pub session_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub schedule_type: String,
    pub schedule_expression: String,
    pub config: serde_json::Value,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineRun {
    pub id: String,
    pub routine_id: String,
    pub gizzi_run_id: Option<String>,
    pub status: String,
    pub scheduled_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub duration_ms: Option<i32>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub attempt: i32,
    pub triggered_by: String,
    pub metadata: Option<serde_json::Value>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request / Response Types
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateGoalRequest {
    pub title: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub target_date: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGoalRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub target_date: Option<String>,
    #[serde(default)]
    pub progress: Option<i32>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoutineRequest {
    pub name: String,
    pub schedule_type: String,
    pub schedule_expression: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub config: Option<serde_json::Value>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub max_runs: Option<i32>,
    #[serde(default)]
    pub timeout_seconds: Option<i32>,
    #[serde(default)]
    pub max_retries: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoutineRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub schedule_type: Option<String>,
    #[serde(default)]
    pub schedule_expression: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub config: Option<serde_json::Value>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub max_runs: Option<i32>,
    #[serde(default)]
    pub timeout_seconds: Option<i32>,
    #[serde(default)]
    pub max_retries: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLoopRequest {
    pub name: String,
    pub schedule_type: String,
    pub schedule_expression: String,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub goal_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub config: Option<serde_json::Value>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLoopRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub schedule_type: Option<String>,
    #[serde(default)]
    pub schedule_expression: Option<String>,
    #[serde(default)]
    pub config: Option<serde_json::Value>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: gizzi cron bridge
// ═══════════════════════════════════════════════════════════════════════════════

async fn cron_daemon_create_job(
    client: &reqwest::Client,
    job: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/jobs", cron_daemon_base());
    let res = client
        .post(&url)
        .json(&job)
        .send()
        .await
        .map_err(|e| format!("cron daemon create failed: {}", e))?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("cron daemon create error: {}", text));
    }

    res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("cron daemon create decode failed: {}", e))
}

async fn cron_daemon_update_job(
    client: &reqwest::Client,
    daemon_job_id: &str,
    job: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/jobs/{}", cron_daemon_base(), daemon_job_id);
    let res = client
        .patch(&url)
        .json(&job)
        .send()
        .await
        .map_err(|e| format!("cron daemon update failed: {}", e))?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("cron daemon update error: {}", text));
    }

    res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("cron daemon update decode failed: {}", e))
}

async fn cron_daemon_delete_job(
    client: &reqwest::Client,
    daemon_job_id: &str,
) -> Result<(), String> {
    let url = format!("{}/jobs/{}", cron_daemon_base(), daemon_job_id);
    let res = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("cron daemon delete failed: {}", e))?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("cron daemon delete error: {}", text));
    }

    Ok(())
}

async fn cron_daemon_run_job(
    client: &reqwest::Client,
    daemon_job_id: &str,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/jobs/{}/run", cron_daemon_base(), daemon_job_id);
    let res = client
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("cron daemon run failed: {}", e))?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("cron daemon run error: {}", text));
    }

    res.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("cron daemon run decode failed: {}", e))
}

async fn resolve_agent_harness(db: &crate::db::DbHandle, agent_id: &str) -> Option<serde_json::Value> {
    let db = db.clone();
    let agent_id = agent_id.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        let harness: String = conn
            .query_row(
                "SELECT harness_config FROM agents WHERE id = ?1",
                params![agent_id],
                |row| row.get(0),
            )
            .ok()?;
        serde_json::from_str::<serde_json::Value>(&harness).ok()
    })
    .await
    .ok()
    .flatten()
}

fn build_daemon_job_from_routine(
    routine: &Routine,
    job_type: &str,
    harness_config: Option<serde_json::Value>,
) -> serde_json::Value {
    json!({
        "name": routine.name,
        "description": routine.description,
        "type": job_type,
        "status": routine.status,
        "schedule": {
            "type": routine.schedule_type,
            "expression": routine.schedule_expression,
            "timezone": routine.timezone,
        },
        "config": routine.config,
        "scope": "persistent",
        "agentId": routine.agent_id,
        "harness": harness_config,
        "tags": routine.tags,
        "metadata": routine.metadata,
        "maxRuns": routine.max_runs,
        "timeoutSeconds": routine.timeout_seconds,
        "maxRetries": routine.max_retries,
    })
}

fn build_daemon_job_from_loop(loop_item: &Loop, job_type: &str, harness_config: Option<serde_json::Value>) -> serde_json::Value {
    json!({
        "name": loop_item.name,
        "description": loop_item.description,
        "type": job_type,
        "status": loop_item.status,
        "schedule": {
            "type": loop_item.schedule_type,
            "expression": loop_item.schedule_expression,
        },
        "config": loop_item.config,
        "scope": "session",
        "sessionId": loop_item.session_id,
        "agentId": loop_item.agent_id,
        "harness": harness_config,
        "expiresAt": loop_item.expires_at,
        "tags": loop_item.tags,
        "metadata": loop_item.metadata,
    })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Goals Handlers
// ═══════════════════════════════════════════════════════════════════════════════

async fn list_goals(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Goal>>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, workspace_id, agent_id, title, description, status, priority, target_date, progress, metadata, created_at, updated_at
             FROM goals WHERE user_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let goals = stmt
        .query_map([&user.user_id], |row| {
            Ok(Goal {
                id: row.get(0)?,
                user_id: row.get(1)?,
                workspace_id: row.get(2)?,
                agent_id: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                status: row.get(6)?,
                priority: row.get(7)?,
                target_date: row.get(8)?,
                progress: row.get(9)?,
                metadata: row.get::<_, Option<String>>(10)?.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)),
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(goals))
}

async fn create_goal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateGoalRequest>,
) -> Result<Json<Goal>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    conn.execute(
        "INSERT INTO goals (id, user_id, workspace_id, agent_id, title, description, status, priority, target_date, progress, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        (
            &id,
            &user.user_id,
            &req.workspace_id,
            &req.agent_id,
            &req.title,
            &req.description,
            "active",
            req.priority.as_deref().unwrap_or("medium"),
            &req.target_date,
            0i32,
            req.metadata.as_ref().map(|m| m.to_string()),
            &now,
            &now,
        ),
    )
    .map_err(|e| {
        warn!("insert goal failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("goal created: {}", id);

    Ok(Json(Goal {
        id,
        user_id: user.user_id,
        workspace_id: req.workspace_id,
        agent_id: req.agent_id,
        title: req.title,
        description: req.description,
        status: "active".to_string(),
        priority: req.priority.unwrap_or_else(|| "medium".to_string()),
        target_date: req.target_date,
        progress: 0,
        metadata: req.metadata,
        created_at: now.clone(),
        updated_at: now,
    }))
}

async fn get_goal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Goal>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let goal = conn
        .query_row(
            "SELECT id, user_id, workspace_id, agent_id, title, description, status, priority, target_date, progress, metadata, created_at, updated_at
             FROM goals WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| {
                Ok(Goal {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    workspace_id: row.get(2)?,
                    agent_id: row.get(3)?,
                    title: row.get(4)?,
                    description: row.get(5)?,
                    status: row.get(6)?,
                    priority: row.get(7)?,
                    target_date: row.get(8)?,
                    progress: row.get(9)?,
                    metadata: row.get::<_, Option<String>>(10)?.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)),
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(goal))
}

async fn update_goal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateGoalRequest>,
) -> Result<Json<Goal>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let existing = conn
        .query_row(
            "SELECT status, progress FROM goals WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?)),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let title = req.title;
    let description = req.description;
    let status = req.status.unwrap_or(existing.0);
    let priority = req.priority;
    let target_date = req.target_date;
    let progress = req.progress.unwrap_or(existing.1);
    let metadata = req.metadata;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE goals SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            status = ?3,
            priority = COALESCE(?4, priority),
            target_date = COALESCE(?5, target_date),
            progress = ?6,
            metadata = COALESCE(?7, metadata),
            updated_at = ?8
         WHERE id = ?9 AND user_id = ?10",
        (
            title.as_ref(),
            description.as_ref(),
            &status,
            priority.as_ref(),
            target_date.as_ref(),
            progress,
            metadata.as_ref().map(|m| m.to_string()),
            &now,
            &id,
            &user.user_id,
        ),
    )
    .map_err(|e| {
        warn!("update goal failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    get_goal(State(state), headers, Path(id)).await
}

async fn delete_goal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    conn.execute(
        "DELETE FROM goals WHERE id = ?1 AND user_id = ?2",
        [&id, &user.user_id],
    )
    .map_err(|e| {
        warn!("delete goal failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("goal deleted: {}", id);
    Ok(StatusCode::NO_CONTENT)
}

async fn list_goal_children(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let routines: Vec<Routine> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, name, description, status, schedule_type, schedule_expression, timezone, config, tags, metadata, max_runs, timeout_seconds, max_retries, created_at, updated_at
                 FROM routines WHERE goal_id = ?1 AND user_id = ?2 ORDER BY created_at DESC",
            )
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let rows = stmt
            .query_map([&goal_id, &user.user_id], |row| row_to_routine(row))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let loops: Vec<Loop> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, session_id, name, description, status, schedule_type, schedule_expression, config, tags, metadata, expires_at, created_at, updated_at
                 FROM loops WHERE goal_id = ?1 AND user_id = ?2 ORDER BY created_at DESC",
            )
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let rows = stmt
            .query_map([&goal_id, &user.user_id], |row| row_to_loop(row))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(json!({
        "routines": routines,
        "loops": loops,
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Routines Handlers
// ═══════════════════════════════════════════════════════════════════════════════

fn row_to_routine(row: &rusqlite::Row) -> Result<Routine, rusqlite::Error> {
    Ok(Routine {
        id: row.get(0)?,
        user_id: row.get(1)?,
        workspace_id: row.get(2)?,
        agent_id: row.get(3)?,
        goal_id: row.get(4)?,
        gizzi_job_id: row.get(5)?,
        name: row.get(6)?,
        description: row.get(7)?,
        status: row.get(8)?,
        schedule_type: row.get(9)?,
        schedule_expression: row.get(10)?,
        timezone: row.get(11)?,
        config: row.get::<_, String>(12).map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null))?,
        tags: row.get::<_, Option<String>>(13)?.map(|s| serde_json::from_str(&s).unwrap_or_default()),
        metadata: row.get::<_, Option<String>>(14)?.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)),
        max_runs: row.get(15)?,
        timeout_seconds: row.get(16)?,
        max_retries: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
    })
}

async fn list_routines(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Routine>>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, name, description, status, schedule_type, schedule_expression, timezone, config, tags, metadata, max_runs, timeout_seconds, max_retries, created_at, updated_at
             FROM routines WHERE user_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let routines = stmt
        .query_map([&user.user_id], row_to_routine)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(routines))
}

async fn create_routine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateRoutineRequest>,
) -> Result<Json<Routine>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let config = req.config.unwrap_or_else(|| json!({}));
    let job_type = config
        .get("jobType")
        .and_then(|v| v.as_str())
        .unwrap_or("agent")
        .to_string();

    let routine = Routine {
        id: id.clone(),
        user_id: user.user_id.clone(),
        workspace_id: req.workspace_id.clone(),
        agent_id: req.agent_id.clone(),
        goal_id: req.goal_id.clone(),
        gizzi_job_id: None,
        name: req.name.clone(),
        description: req.description.clone(),
        status: "active".to_string(),
        schedule_type: req.schedule_type.clone(),
        schedule_expression: req.schedule_expression.clone(),
        timezone: req.timezone.clone(),
        config: config.clone(),
        tags: req.tags.clone(),
        metadata: req.metadata.clone(),
        max_runs: req.max_runs,
        timeout_seconds: req.timeout_seconds,
        max_retries: req.max_retries,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let harness_config = if let Some(ref agent_id) = routine.agent_id {
        resolve_agent_harness(&state.db, agent_id).await
    } else {
        None
    };
    let daemon_job = build_daemon_job_from_routine(&routine, &job_type, harness_config);
    let client = reqwest::Client::new();
    let daemon_res = cron_daemon_create_job(&client, daemon_job).await;

    let daemon_job_id = match daemon_res {
        Ok(res) => res
            .get("job")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        Err(e) => {
            warn!("failed to create daemon routine job: {}", e);
            None
        }
    };

    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    conn.execute(
        "INSERT INTO routines (id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, name, description, status, schedule_type, schedule_expression, timezone, config, tags, metadata, max_runs, timeout_seconds, max_retries, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
        params![
            &routine.id,
            &routine.user_id,
            &routine.workspace_id,
            &routine.agent_id,
            &routine.goal_id,
            &daemon_job_id,
            &routine.name,
            &routine.description,
            &routine.status,
            &routine.schedule_type,
            &routine.schedule_expression,
            &routine.timezone,
            routine.config.to_string(),
            routine.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default()),
            routine.metadata.as_ref().map(|m| m.to_string()),
            routine.max_runs,
            routine.timeout_seconds,
            routine.max_retries,
            &routine.created_at,
            &routine.updated_at,
        ],
    )
    .map_err(|e| {
        warn!("insert routine failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("routine created: {} daemon_job_id={:?}", id, daemon_job_id);

    Ok(Json(Routine {
        gizzi_job_id: daemon_job_id,
        ..routine
    }))
}

async fn get_routine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Routine>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let routine = conn
        .query_row(
            "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, name, description, status, schedule_type, schedule_expression, timezone, config, tags, metadata, max_runs, timeout_seconds, max_retries, created_at, updated_at
             FROM routines WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            row_to_routine,
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(routine))
}

async fn update_routine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateRoutineRequest>,
) -> Result<Json<Routine>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let existing = conn
        .query_row(
            "SELECT config, gizzi_job_id FROM routines WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let mut config: serde_json::Value = serde_json::from_str(&existing.0).unwrap_or_default();
    if let Some(new_config) = req.config {
        config = new_config;
    }

    let job_type = config
        .get("jobType")
        .and_then(|v| v.as_str())
        .unwrap_or("agent")
        .to_string();

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE routines SET
            name = COALESCE(?1, name),
            description = COALESCE(?2, description),
            status = COALESCE(?3, status),
            schedule_type = COALESCE(?4, schedule_type),
            schedule_expression = COALESCE(?5, schedule_expression),
            timezone = COALESCE(?6, timezone),
            config = COALESCE(?7, config),
            tags = COALESCE(?8, tags),
            metadata = COALESCE(?9, metadata),
            max_runs = COALESCE(?10, max_runs),
            timeout_seconds = COALESCE(?11, timeout_seconds),
            max_retries = COALESCE(?12, max_retries),
            updated_at = ?13
         WHERE id = ?14 AND user_id = ?15",
        (
            req.name.as_ref(),
            req.description.as_ref(),
            req.status.as_ref(),
            req.schedule_type.as_ref(),
            req.schedule_expression.as_ref(),
            req.timezone.as_ref(),
            Some(config.to_string()),
            req.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default()),
            req.metadata.as_ref().map(|m| m.to_string()),
            req.max_runs,
            req.timeout_seconds,
            req.max_retries,
            &now,
            &id,
            &user.user_id,
        ),
    )
    .map_err(|e| {
        warn!("update routine failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(gizzi_job_id) = existing.1 {
        let updated_routine = get_routine(State(state.clone()), headers.clone(), Path(id.clone())).await?.0;
        let harness_config = if let Some(ref agent_id) = updated_routine.agent_id {
            resolve_agent_harness(&state.db, agent_id).await
        } else {
            None
        };
        let gizzi_job = build_daemon_job_from_routine(&updated_routine, &job_type, harness_config);
        let client = reqwest::Client::new();
        if let Err(e) = cron_daemon_update_job(&client, &gizzi_job_id, gizzi_job).await {
            warn!("failed to update daemon routine job: {}", e);
        }
    }

    get_routine(State(state), headers, Path(id)).await
}

async fn delete_routine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let gizzi_job_id: Option<String> = conn
        .query_row(
            "SELECT gizzi_job_id FROM routines WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| row.get(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if let Some(gizzi_job_id) = gizzi_job_id {
        let client = reqwest::Client::new();
        if let Err(e) = cron_daemon_delete_job(&client, &gizzi_job_id).await {
            warn!("failed to delete daemon routine job: {}", e);
        }
    }

    conn.execute(
        "DELETE FROM routines WHERE id = ?1 AND user_id = ?2",
        [&id, &user.user_id],
    )
    .map_err(|e| {
        warn!("delete routine failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("routine deleted: {}", id);
    Ok(StatusCode::NO_CONTENT)
}

async fn run_routine(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let gizzi_job_id: Option<String> = conn
        .query_row(
            "SELECT gizzi_job_id FROM routines WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| row.get(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let gizzi_job_id = gizzi_job_id.ok_or(StatusCode::BAD_REQUEST)?;
    let client = reqwest::Client::new();
    let run = cron_daemon_run_job(&client, &gizzi_job_id)
        .await
        .map_err(|e| {
            warn!("routine run failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(run))
}

async fn list_routine_runs(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Vec<RoutineRun>>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    conn.query_row(
        "SELECT 1 FROM routines WHERE id = ?1 AND user_id = ?2",
        [&id, &user.user_id],
        |_| Ok(()),
    )
    .map_err(|_| StatusCode::NOT_FOUND)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, routine_id, gizzi_run_id, status, scheduled_at, started_at, finished_at, duration_ms, output, error, attempt, triggered_by, metadata
             FROM routine_runs WHERE routine_id = ?1 ORDER BY scheduled_at DESC",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let runs = stmt
        .query_map([&id], |row| {
            Ok(RoutineRun {
                id: row.get(0)?,
                routine_id: row.get(1)?,
                gizzi_run_id: row.get(2)?,
                status: row.get(3)?,
                scheduled_at: row.get(4)?,
                started_at: row.get(5)?,
                finished_at: row.get(6)?,
                duration_ms: row.get(7)?,
                output: row.get(8)?,
                error: row.get(9)?,
                attempt: row.get(10)?,
                triggered_by: row.get(11)?,
                metadata: row.get::<_, Option<String>>(12)?.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)),
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(runs))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Loops Handlers
// ═══════════════════════════════════════════════════════════════════════════════

fn row_to_loop(row: &rusqlite::Row) -> Result<Loop, rusqlite::Error> {
    Ok(Loop {
        id: row.get(0)?,
        user_id: row.get(1)?,
        workspace_id: row.get(2)?,
        agent_id: row.get(3)?,
        goal_id: row.get(4)?,
        gizzi_job_id: row.get(5)?,
        session_id: row.get(6)?,
        name: row.get(7)?,
        description: row.get(8)?,
        status: row.get(9)?,
        schedule_type: row.get(10)?,
        schedule_expression: row.get(11)?,
        config: row.get::<_, String>(12).map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null))?,
        tags: row.get::<_, Option<String>>(13)?.map(|s| serde_json::from_str(&s).unwrap_or_default()),
        metadata: row.get::<_, Option<String>>(14)?.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)),
        expires_at: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

async fn list_loops(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Loop>>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, session_id, name, description, status, schedule_type, schedule_expression, config, tags, metadata, expires_at, created_at, updated_at
             FROM loops WHERE user_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let loops = stmt
        .query_map([&user.user_id], row_to_loop)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(loops))
}

async fn create_loop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateLoopRequest>,
) -> Result<Json<Loop>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let config = req.config.unwrap_or_else(|| json!({}));
    let job_type = config
        .get("jobType")
        .and_then(|v| v.as_str())
        .unwrap_or("agent")
        .to_string();

    let loop_item = Loop {
        id: id.clone(),
        user_id: user.user_id.clone(),
        workspace_id: req.workspace_id.clone(),
        agent_id: req.agent_id.clone(),
        goal_id: req.goal_id.clone(),
        gizzi_job_id: None,
        session_id: req.session_id.clone(),
        name: req.name.clone(),
        description: req.description.clone(),
        status: "active".to_string(),
        schedule_type: req.schedule_type.clone(),
        schedule_expression: req.schedule_expression.clone(),
        config: config.clone(),
        tags: req.tags.clone(),
        metadata: req.metadata.clone(),
        expires_at: req.expires_at.clone(),
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let harness_config = if let Some(ref agent_id) = loop_item.agent_id {
        resolve_agent_harness(&state.db, agent_id).await
    } else {
        None
    };
    let daemon_job = build_daemon_job_from_loop(&loop_item, &job_type, harness_config);
    let client = reqwest::Client::new();
    let daemon_res = cron_daemon_create_job(&client, daemon_job).await;

    let daemon_job_id = match daemon_res {
        Ok(res) => res
            .get("job")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        Err(e) => {
            warn!("failed to create daemon loop job: {}", e);
            None
        }
    };

    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    conn.execute(
        "INSERT INTO loops (id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, session_id, name, description, status, schedule_type, schedule_expression, config, tags, metadata, expires_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            &loop_item.id,
            &loop_item.user_id,
            &loop_item.workspace_id,
            &loop_item.agent_id,
            &loop_item.goal_id,
            &daemon_job_id,
            &loop_item.session_id,
            &loop_item.name,
            &loop_item.description,
            &loop_item.status,
            &loop_item.schedule_type,
            &loop_item.schedule_expression,
            loop_item.config.to_string(),
            loop_item.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default()),
            loop_item.metadata.as_ref().map(|m| m.to_string()),
            &loop_item.expires_at,
            &loop_item.created_at,
            &loop_item.updated_at,
        ],
    )
    .map_err(|e| {
        warn!("insert loop failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("loop created: {} daemon_job_id={:?}", id, daemon_job_id);

    Ok(Json(Loop {
        gizzi_job_id: daemon_job_id,
        ..loop_item
    }))
}

async fn get_loop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Loop>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let loop_item = conn
        .query_row(
            "SELECT id, user_id, workspace_id, agent_id, goal_id, gizzi_job_id, session_id, name, description, status, schedule_type, schedule_expression, config, tags, metadata, expires_at, created_at, updated_at
             FROM loops WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            row_to_loop,
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(loop_item))
}

async fn update_loop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateLoopRequest>,
) -> Result<Json<Loop>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let existing = conn
        .query_row(
            "SELECT config, gizzi_job_id FROM loops WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let mut config: serde_json::Value = serde_json::from_str(&existing.0).unwrap_or_default();
    if let Some(new_config) = req.config {
        config = new_config;
    }

    let job_type = config
        .get("jobType")
        .and_then(|v| v.as_str())
        .unwrap_or("agent")
        .to_string();

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE loops SET
            name = COALESCE(?1, name),
            description = COALESCE(?2, description),
            status = COALESCE(?3, status),
            schedule_type = COALESCE(?4, schedule_type),
            schedule_expression = COALESCE(?5, schedule_expression),
            config = COALESCE(?6, config),
            tags = COALESCE(?7, tags),
            metadata = COALESCE(?8, metadata),
            expires_at = COALESCE(?9, expires_at),
            updated_at = ?10
         WHERE id = ?11 AND user_id = ?12",
        (
            req.name.as_ref(),
            req.description.as_ref(),
            req.status.as_ref(),
            req.schedule_type.as_ref(),
            req.schedule_expression.as_ref(),
            Some(config.to_string()),
            req.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default()),
            req.metadata.as_ref().map(|m| m.to_string()),
            req.expires_at.as_ref(),
            &now,
            &id,
            &user.user_id,
        ),
    )
    .map_err(|e| {
        warn!("update loop failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(gizzi_job_id) = existing.1 {
        let updated_loop = get_loop(State(state.clone()), headers.clone(), Path(id.clone())).await?.0;
        let harness_config = if let Some(ref agent_id) = updated_loop.agent_id {
            resolve_agent_harness(&state.db, agent_id).await
        } else {
            None
        };
        let gizzi_job = build_daemon_job_from_loop(&updated_loop, &job_type, harness_config);
        let client = reqwest::Client::new();
        if let Err(e) = cron_daemon_update_job(&client, &gizzi_job_id, gizzi_job).await {
            warn!("failed to update daemon loop job: {}", e);
        }
    }

    get_loop(State(state), headers, Path(id)).await
}

async fn delete_loop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let gizzi_job_id: Option<String> = conn
        .query_row(
            "SELECT gizzi_job_id FROM loops WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| row.get(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if let Some(gizzi_job_id) = gizzi_job_id {
        let client = reqwest::Client::new();
        if let Err(e) = cron_daemon_delete_job(&client, &gizzi_job_id).await {
            warn!("failed to delete daemon loop job: {}", e);
        }
    }

    conn.execute(
        "DELETE FROM loops WHERE id = ?1 AND user_id = ?2",
        [&id, &user.user_id],
    )
    .map_err(|e| {
        warn!("delete loop failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!("loop deleted: {}", id);
    Ok(StatusCode::NO_CONTENT)
}

async fn run_loop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user = get_user(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    let conn = state.db.connect().map_err(|e| {
        warn!("db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let gizzi_job_id: Option<String> = conn
        .query_row(
            "SELECT gizzi_job_id FROM loops WHERE id = ?1 AND user_id = ?2",
            [&id, &user.user_id],
            |row| row.get(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let gizzi_job_id = gizzi_job_id.ok_or(StatusCode::BAD_REQUEST)?;
    let client = reqwest::Client::new();
    let run = cron_daemon_run_job(&client, &gizzi_job_id)
        .await
        .map_err(|e| {
            warn!("loop run failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(run))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════════

pub fn automation_router() -> Router<Arc<AppState>> {
    Router::new()
        // Goals
        .route("/automation/goals", get(list_goals).post(create_goal))
        .route(
            "/automation/goals/:id",
            get(get_goal).put(update_goal).delete(delete_goal),
        )
        .route("/automation/goals/:id/children", get(list_goal_children))
        // Routines
        .route("/automation/routines", get(list_routines).post(create_routine))
        .route(
            "/automation/routines/:id",
            get(get_routine).put(update_routine).delete(delete_routine),
        )
        .route("/automation/routines/:id/run", post(run_routine))
        .route("/automation/routines/:id/runs", get(list_routine_runs))
        // Loops
        .route("/automation/loops", get(list_loops).post(create_loop))
        .route(
            "/automation/loops/:id",
            get(get_loop).put(update_loop).delete(delete_loop),
        )
        .route("/automation/loops/:id/run", post(run_loop))
}
