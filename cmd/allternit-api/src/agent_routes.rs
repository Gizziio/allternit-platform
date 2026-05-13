
//! Agent API routes — local SQLite persistence.
//!
//! Mirrors the Next.js `/api/v1/agents` layer.

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

fn unauthorized() -> axum::response::Response {
    (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))).into_response()
}

pub fn agent_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents", get(list_agents).post(create_agent))
        .route("/agents/:id", get(get_agent).put(update_agent).delete(delete_agent))
        .route("/agents/identity", get(get_agent_identity).post(set_agent_identity))
        .route("/agents/metrics", get(list_agent_metrics))
        .route("/agents/suites", get(list_test_suites).post(create_test_suite))
        .route("/agents/test", post(run_agent_test))
}

// ─── Data models ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AgentRow {
    id: String,
    user_id: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "type")]
    agent_type: String,
    parent_agent_id: Option<String>,
    model: String,
    provider: String,
    capabilities: Option<String>,
    system_prompt: Option<String>,
    tools: Option<String>,
    max_iterations: i64,
    temperature: f64,
    config: Option<String>,
    status: String,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
    created_at: String,
    updated_at: String,
    last_run_at: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    workspace_id: Option<String>,
    status: Option<String>,
    #[serde(rename = "type")]
    agent_type: Option<String>,
}

// ─── List agents ──────────────────────────────────────────────────────────────

async fn list_agents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT id, user_id, name, description, type, parent_agent_id, model, provider,
                    capabilities, system_prompt, tools, max_iterations, temperature, config,
                    status, workspace_id, avatar, identity_key, created_at, updated_at, last_run_at
             FROM agents WHERE user_id = ?1"
        );
        let mut params_vec: Vec<String> = vec![user_id];

        if let Some(ws) = &q.workspace_id {
            sql.push_str(" AND workspace_id = ?");
            params_vec.push(ws.clone());
        }
        if let Some(st) = &q.status {
            sql.push_str(" AND status = ?");
            params_vec.push(st.clone());
        }
        if let Some(tp) = &q.agent_type {
            sql.push_str(" AND type = ?");
            params_vec.push(tp.clone());
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let rows = stmt.query_map(rusqlite::params_from_iter(params_ref), |row| {
            Ok(AgentRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                agent_type: row.get(4)?,
                parent_agent_id: row.get(5)?,
                model: row.get(6)?,
                provider: row.get(7)?,
                capabilities: row.get(8)?,
                system_prompt: row.get(9)?,
                tools: row.get(10)?,
                max_iterations: row.get(11)?,
                temperature: row.get(12)?,
                config: row.get(13)?,
                status: row.get(14)?,
                workspace_id: row.get(15)?,
                avatar: row.get(16)?,
                identity_key: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                last_run_at: row.get(20)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(agents)) => Json(json!({ "agents": agents })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing agents: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Create agent ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateAgentBody {
    name: String,
    description: Option<String>,
    #[serde(rename = "type")]
    agent_type: Option<String>,
    parent_agent_id: Option<String>,
    model: String,
    provider: String,
    capabilities: Option<String>,
    system_prompt: Option<String>,
    tools: Option<String>,
    max_iterations: Option<i64>,
    temperature: Option<f64>,
    config: Option<String>,
    status: Option<String>,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
}

async fn create_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateAgentBody>,
) -> impl IntoResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agents (id, user_id, name, description, type, parent_agent_id, model, provider,
                                capabilities, system_prompt, tools, max_iterations, temperature, config,
                                status, workspace_id, avatar, identity_key)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                id2,
                user_id,
                body.name,
                body.description,
                body.agent_type.unwrap_or_else(|| "worker".to_string()),
                body.parent_agent_id,
                body.model,
                body.provider,
                body.capabilities,
                body.system_prompt,
                body.tools,
                body.max_iterations.unwrap_or(10),
                body.temperature.unwrap_or(0.7),
                body.config,
                body.status.unwrap_or_else(|| "idle".to_string()),
                body.workspace_id,
                body.avatar,
                body.identity_key,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "agent": { "id": id } }))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating agent: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Get agent ────────────────────────────────────────────────────────────────

async fn get_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, type, parent_agent_id, model, provider,
                    capabilities, system_prompt, tools, max_iterations, temperature, config,
                    status, workspace_id, avatar, identity_key, created_at, updated_at, last_run_at
             FROM agents WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id, user_id], |row| {
            Ok(AgentRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                agent_type: row.get(4)?,
                parent_agent_id: row.get(5)?,
                model: row.get(6)?,
                provider: row.get(7)?,
                capabilities: row.get(8)?,
                system_prompt: row.get(9)?,
                tools: row.get(10)?,
                max_iterations: row.get(11)?,
                temperature: row.get(12)?,
                config: row.get(13)?,
                status: row.get(14)?,
                workspace_id: row.get(15)?,
                avatar: row.get(16)?,
                identity_key: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                last_run_at: row.get(20)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match row {
        Ok(Ok(agent)) => Json(json!({ "agent": agent })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting agent: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Update agent ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UpdateAgentBody {
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "type")]
    agent_type: Option<String>,
    parent_agent_id: Option<String>,
    model: Option<String>,
    provider: Option<String>,
    capabilities: Option<String>,
    system_prompt: Option<String>,
    tools: Option<String>,
    max_iterations: Option<i64>,
    temperature: Option<f64>,
    config: Option<String>,
    status: Option<String>,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
}

async fn update_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateAgentBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE agents SET
                name = COALESCE(?1, name),
                description = COALESCE(?2, description),
                type = COALESCE(?3, type),
                parent_agent_id = COALESCE(?4, parent_agent_id),
                model = COALESCE(?5, model),
                provider = COALESCE(?6, provider),
                capabilities = COALESCE(?7, capabilities),
                system_prompt = COALESCE(?8, system_prompt),
                tools = COALESCE(?9, tools),
                max_iterations = COALESCE(?10, max_iterations),
                temperature = COALESCE(?11, temperature),
                config = COALESCE(?12, config),
                status = COALESCE(?13, status),
                workspace_id = COALESCE(?14, workspace_id),
                avatar = COALESCE(?15, avatar),
                identity_key = COALESCE(?16, identity_key),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?17 AND user_id = ?18",
            params![
                body.name,
                body.description,
                body.agent_type,
                body.parent_agent_id,
                body.model,
                body.provider,
                body.capabilities,
                body.system_prompt,
                body.tools,
                body.max_iterations,
                body.temperature,
                body.config,
                body.status,
                body.workspace_id,
                body.avatar,
                body.identity_key,
                id,
                user_id,
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating agent: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Delete agent ─────────────────────────────────────────────────────────────

async fn delete_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM agents WHERE id = ?1 AND user_id = ?2",
            params![id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting agent: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Agent Identity ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct IdentityQuery {
    agent_id: Option<String>,
}

async fn get_agent_identity(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<IdentityQuery>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = params.agent_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        if let Some(ref aid) = agent_id {
            let key: Option<String> = conn.query_row(
                "SELECT identity_key FROM agents WHERE id = ?1 AND user_id = ?2",
                params![aid, user_id],
                |row| row.get(0),
            ).ok();
            Ok::<_, rusqlite::Error>(key)
        } else {
            Ok(None)
        }
    }).await;

    match row {
        Ok(Ok(Some(key))) => Json(json!({"has_identity": true, "public_key": key})).into_response(),
        _ => Json(json!({"has_identity": false, "public_key": null})).into_response(),
    }
}

#[derive(Deserialize)]
struct SetIdentityBody {
    #[serde(alias = "agentId")]
    agent_id: String,
    #[serde(alias = "publicKey")]
    public_key: Option<String>,
}

async fn set_agent_identity(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<SetIdentityBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let pk = body.public_key.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE agents SET identity_key = ?1 WHERE id = ?2 AND user_id = ?3",
            params![pk, body.agent_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => Json(json!({"success": true, "public_key": body.public_key, "private_key": "demo-only-do-not-use-in-production"})).into_response(),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to set identity"}))).into_response(),
    }
}

// ─── Agent Metrics ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct MetricRow {
    id: String,
    agent_id: String,
    metric_type: String,
    value: f64,
    labels: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct MetricsQuery {
    #[serde(alias = "agentId")]
    agent_id: Option<String>,
    #[serde(alias = "metricType")]
    metric_type: Option<String>,
    days: Option<i64>,
}

async fn list_agent_metrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<MetricsQuery>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = params.agent_id;
    let metric_type = params.metric_type;
    let days = params.days.unwrap_or(7);

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT id, agent_id, metric_type, value, labels, created_at
             FROM agent_metrics WHERE user_id = ?1 AND created_at >= datetime('now', ?2 || ' days')"
        );
        if agent_id.is_some() { sql.push_str(" AND agent_id = ?3"); }
        if metric_type.is_some() { sql.push_str(" AND metric_type = ?4"); }
        sql.push_str(" ORDER BY created_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let param_days = format!("-{}", days);
        let rows = match (&agent_id, &metric_type) {
            (Some(a), Some(t)) => stmt.query_map(params![user_id, param_days, a, t], row_to_metric)?,
            (Some(a), None) => stmt.query_map(params![user_id, param_days, a], row_to_metric)?,
            (None, Some(t)) => stmt.query_map(params![user_id, param_days, t], row_to_metric)?,
            (None, None) => stmt.query_map(params![user_id, param_days], row_to_metric)?,
        }.collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"metrics": data})).into_response(),
        _ => Json(json!({"metrics": [], "summaries": []})).into_response(),
    }
}

fn row_to_metric(row: &rusqlite::Row) -> Result<MetricRow, rusqlite::Error> {
    Ok(MetricRow {
        id: row.get(0)?,
        agent_id: row.get(1)?,
        metric_type: row.get(2)?,
        value: row.get(3)?,
        labels: row.get(4)?,
        created_at: row.get(5)?,
    })
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct SuiteRow {
    id: String,
    user_id: String,
    agent_id: String,
    name: String,
    description: Option<String>,
    cases: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct SuitesQuery {
    #[serde(alias = "agentId")]
    agent_id: Option<String>,
}

async fn list_test_suites(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(params): Query<SuitesQuery>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = params.agent_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt;
        let rows: Vec<SuiteRow>;
        if let Some(ref aid) = agent_id {
            stmt = conn.prepare(
                "SELECT id, user_id, agent_id, name, description, cases, created_at
                 FROM test_suites WHERE user_id = ?1 AND agent_id = ?2 ORDER BY created_at DESC"
            )?;
            rows = stmt.query_map(params![user_id, aid], row_to_suite)?.collect::<Result<Vec<_>, _>>()?;
        } else {
            stmt = conn.prepare(
                "SELECT id, user_id, agent_id, name, description, cases, created_at
                 FROM test_suites WHERE user_id = ?1 ORDER BY created_at DESC"
            )?;
            rows = stmt.query_map(params![user_id], row_to_suite)?.collect::<Result<Vec<_>, _>>()?;
        }
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => Json(json!({"suites": data})).into_response(),
        _ => Json(json!({"suites": []})).into_response(),
    }
}

fn row_to_suite(row: &rusqlite::Row) -> Result<SuiteRow, rusqlite::Error> {
    Ok(SuiteRow {
        id: row.get(0)?,
        user_id: row.get(1)?,
        agent_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        cases: row.get(5)?,
        created_at: row.get(6)?,
    })
}

#[derive(Deserialize)]
struct CreateSuiteBody {
    #[serde(alias = "agentId")]
    agent_id: String,
    name: String,
    description: Option<String>,
    cases: Option<serde_json::Value>,
}

async fn create_test_suite(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSuiteBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let suite_name = body.name.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO test_suites (id, user_id, agent_id, name, description, cases)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id2,
                user_id,
                body.agent_id,
                suite_name,
                body.description,
                body.cases.map(|c| c.to_string()),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({"suite": {"id": id, "name": body.name}}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating test suite: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Run Agent Test ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct RunTestBody {
    #[serde(alias = "agentId")]
    _agent_id: String,
    _messages: Option<Vec<serde_json::Value>>,
    _variables: Option<serde_json::Value>,
}

async fn run_agent_test(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(_body): Json<RunTestBody>,
) -> impl IntoResponse {
    let _user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    // Simulate a test run with mock metrics
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let latency_ms = now % 1200 + 800;
    let tokens = now % 500 + 100;

    Json(json!({
        "success": true,
        "response": {
            "role": "assistant",
            "content": "Mock test response from agent",
        },
        "metrics": {
            "latency_ms": latency_ms,
            "tokens": tokens,
        },
        "tool_calls": [],
    })).into_response()
}
