//! Agent API routes — local SQLite persistence.
//!
//! Mirrors the Next.js `/api/v1/agents` layer.

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Write;
use std::sync::Arc;
use std::time::Duration;
use tracing::warn;

use crate::auth::get_user;
use crate::auth::AuthUser;
use crate::AppState;
use allternit_agent_system_rails::LedgerQuery;

fn unauthorized() -> axum::response::Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "Unauthorized"})),
    )
        .into_response()
}

pub fn agent_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents", get(list_agents).post(create_agent))
        .route("/agent-templates", get(list_templates))
        .route("/agents/from-template", post(instantiate_template))
        .route(
            "/agents/:id",
            get(get_agent).put(update_agent).delete(delete_agent),
        )
        .route("/agents/:id/runs", post(run_agent).get(list_agent_runs))
        .route("/agents/:id/events", get(stream_agent_events))
        .route(
            "/agents/:id/subagents",
            get(list_subagents).post(create_subagent),
        )
        .route("/agents/companion/ensure", post(ensure_companion))
        .route(
            "/agents/:id/workspace/initialize",
            post(initialize_agent_workspace),
        )
        .route(
            "/agents/identity",
            get(get_agent_identity).post(set_agent_identity),
        )
        .route("/agents/metrics", get(list_agent_metrics))
        .route(
            "/agents/suites",
            get(list_test_suites).post(create_test_suite),
        )
        .route("/agents/test", post(run_agent_test))
}

/// SSE stream of Rails ledger events scoped to one agent
/// (`GET /api/v1/agents/:id/events`). The UI's agent surfaces subscribe per
/// selected agent; without this route they fell into a 501 + retry loop.
/// Replays up to 50 recent matching events on connect, then polls the ledger
/// for new ones every 2s. The ledger is a local append-only store, so a poll
/// loop is sufficient — there is no in-process broadcast bus to hook into.
async fn stream_agent_events(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> impl IntoResponse {
    let stream = async_stream::stream! {
        let mut sent: std::collections::HashSet<String> = std::collections::HashSet::new();
        loop {
            match state.rails.ledger.query(LedgerQuery::default()).await {
                Ok(events) => {
                    let mut fresh: Vec<_> = events
                        .into_iter()
                        .filter(|e| {
                            e.payload.get("agent_id").and_then(|v| v.as_str())
                                == Some(agent_id.as_str())
                        })
                        .filter(|e| !sent.contains(&e.event_id))
                        .collect();
                    // On connect, replay only the most recent events as history.
                    if sent.is_empty() && fresh.len() > 50 {
                        fresh = fresh.split_off(fresh.len() - 50);
                    }
                    for event in fresh {
                        sent.insert(event.event_id.clone());
                        let frame = json!({
                            "event_type": event.r#type,
                            "agent_id": agent_id,
                            "run_id": event.scope.as_ref().and_then(|s| s.run_id.clone()),
                            "timestamp": event.ts,
                            "data": event.payload,
                        });
                        yield Ok::<Event, std::convert::Infallible>(
                            Event::default().data(frame.to_string()),
                        );
                    }
                }
                Err(err) => {
                    warn!(error = %err, agent_id = %agent_id, "agent events poll failed");
                }
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    )
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
    capabilities: Option<serde_json::Value>,
    system_prompt: Option<String>,
    tools: Option<serde_json::Value>,
    max_iterations: i64,
    temperature: f64,
    config: Option<serde_json::Value>,
    status: String,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
    trust_tier: String,
    harness_config: Option<serde_json::Value>,
    enabled_modes: serde_json::Value,
    character_json: Option<serde_json::Value>,
    allowed_skills: Option<serde_json::Value>,
    allowed_tools: Option<serde_json::Value>,
    category: Option<String>,
    tags: Option<serde_json::Value>,
    data_classification: Option<String>,
    write_scope: Option<String>,
    created_at: String,
    updated_at: String,
    last_run_at: Option<String>,
    mode: String,
    is_primary: bool,
    delegates: Option<serde_json::Value>,
}

fn parse_json_column(value: Option<String>) -> Option<serde_json::Value> {
    value.and_then(|s| serde_json::from_str(&s).ok())
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
                    status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                    enabled_modes, character_json, allowed_skills, allowed_tools, category, tags,
                    data_classification, write_scope, created_at, updated_at, last_run_at,
                    mode, is_primary, delegates
             FROM agents WHERE user_id = ?1",
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
        let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec
            .iter()
            .map(|s| s as &dyn rusqlite::ToSql)
            .collect();
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params_ref), |row| {
                Ok(AgentRow {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    agent_type: row.get(4)?,
                    parent_agent_id: row.get(5)?,
                    model: row.get(6)?,
                    provider: row.get(7)?,
                    capabilities: parse_json_column(row.get(8)?),
                    system_prompt: row.get(9)?,
                    tools: parse_json_column(row.get(10)?),
                    max_iterations: row.get(11)?,
                    temperature: row.get(12)?,
                    config: parse_json_column(row.get(13)?),
                    status: row.get(14)?,
                    workspace_id: row.get(15)?,
                    avatar: row.get(16)?,
                    identity_key: row.get(17)?,
                    trust_tier: row.get(18)?,
                    harness_config: parse_json_column(row.get(19)?),
                    enabled_modes: parse_json_column(row.get(20)?)
                        .unwrap_or(serde_json::Value::String("[\"chat\"]".to_string())),
                    character_json: parse_json_column(row.get(21)?),
                    allowed_skills: parse_json_column(row.get(22)?),
                    allowed_tools: parse_json_column(row.get(23)?),
                    category: row.get(24)?,
                    tags: parse_json_column(row.get(25)?),
                    data_classification: row.get(26)?,
                    write_scope: row.get(27)?,
                    created_at: row.get(28)?,
                    updated_at: row.get(29)?,
                    last_run_at: row.get(30)?,
                    mode: row.get(31)?,
                    is_primary: row.get::<_, i64>(32)? != 0,
                    delegates: parse_json_column(row.get(33)?),
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

// ─── Create agent ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateAgentBody {
    name: String,
    description: Option<String>,
    #[serde(rename = "type")]
    agent_type: Option<String>,
    parent_agent_id: Option<String>,
    /// Agent mode: primary | subagent | orchestrator | council. Defaults to
    /// "primary" when omitted (DB default). Subagents set "subagent".
    mode: Option<String>,
    model: String,
    provider: String,
    capabilities: Option<serde_json::Value>,
    system_prompt: Option<String>,
    tools: Option<serde_json::Value>,
    max_iterations: Option<i64>,
    temperature: Option<f64>,
    config: Option<serde_json::Value>,
    status: Option<String>,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
    trust_tier: Option<String>,
    harness_config: Option<serde_json::Value>,
    enabled_modes: Option<serde_json::Value>,
    character_json: Option<serde_json::Value>,
    allowed_skills: Option<serde_json::Value>,
    allowed_tools: Option<serde_json::Value>,
    category: Option<String>,
    tags: Option<serde_json::Value>,
    data_classification: Option<String>,
    write_scope: Option<String>,
}

fn json_to_string(value: Option<serde_json::Value>) -> Option<String> {
    value.map(|v| v.to_string())
}

/// Validate that an agent satisfies the platform creation checklist.
/// Returns `Ok(())` when valid, or `Err(message)` with the first failure.
fn validate_agent_against_checklist(body: &CreateAgentBody) -> Result<(), String> {
    if body.name.trim().len() < 3 {
        return Err("Agent name must be at least 3 characters".to_string());
    }
    if body.description.as_deref().unwrap_or("").trim().len() < 10 {
        return Err("Agent description must be at least 10 characters".to_string());
    }
    if body.agent_type.as_deref().unwrap_or("").trim().is_empty() {
        return Err("Agent type is required".to_string());
    }
    if body.model.trim().is_empty() {
        return Err("Model is required".to_string());
    }
    if body.provider.trim().is_empty() {
        return Err("Provider is required".to_string());
    }

    let harness_mode = body
        .harness_config
        .as_ref()
        .and_then(|h| h.get("mode"))
        .and_then(|v| v.as_str());
    match harness_mode {
        Some("byok") | Some("cloud") | Some("local") | Some("subprocess") => {}
        _ => return Err("Harness mode must be one of: byok, cloud, local, subprocess".to_string()),
    }

    let has_surface = body
        .enabled_modes
        .as_ref()
        .and_then(|v| v.as_array())
        .map(|arr| !arr.is_empty())
        .unwrap_or(false);
    if !has_surface {
        return Err("At least one enabled surface is required".to_string());
    }

    if body.trust_tier.as_deref().unwrap_or("").trim().is_empty() {
        return Err("Trust tier is required".to_string());
    }

    Ok(())
}

/// Single persistence path for every agent type (primary, subagent, orchestrator,
/// council, template-instantiated). Generates the id and writes the row using the
/// canonical column set. All creation flows go through `validate_agent_against_checklist`
/// first, then here.
fn persist_agent(
    conn: &rusqlite::Connection,
    user_id: &str,
    body: CreateAgentBody,
) -> Result<String, rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO agents (id, user_id, name, description, type, parent_agent_id, model, provider,
                            capabilities, system_prompt, tools, max_iterations, temperature, config,
                            status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                            enabled_modes, character_json, allowed_skills, allowed_tools, category,
                            tags, data_classification, write_scope, mode)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                 ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29)",
        params![
            id, user_id,
            body.name,
            body.description,
            body.agent_type.unwrap_or_else(|| "worker".to_string()),
            body.parent_agent_id,
            body.model,
            body.provider,
            json_to_string(body.capabilities),
            body.system_prompt,
            json_to_string(body.tools),
            body.max_iterations.unwrap_or(10),
            body.temperature.unwrap_or(0.7),
            json_to_string(body.config),
            body.status.unwrap_or_else(|| "idle".to_string()),
            body.workspace_id,
            body.avatar,
            body.identity_key,
            body.trust_tier.unwrap_or_else(|| "standard".to_string()),
            json_to_string(body.harness_config),
            json_to_string(body.enabled_modes).unwrap_or_else(|| "[\"chat\"]".to_string()),
            json_to_string(body.character_json),
            json_to_string(body.allowed_skills),
            json_to_string(body.allowed_tools),
            body.category,
            json_to_string(body.tags),
            body.data_classification,
            body.write_scope,
            body.mode.unwrap_or_else(|| "primary".to_string()),
        ],
    )?;
    Ok(id)
}

async fn create_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateAgentBody>,
) -> impl IntoResponse {
    if let Err(err) = validate_agent_against_checklist(&body) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": err}))).into_response();
    }

    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;
    let user_id_for_db = user_id.clone();

    // Capture clones for ledger event after the DB task consumes body
    let ledger_name = body.name.clone();
    let ledger_agent_type = body.agent_type.clone();
    let ledger_model = body.model.clone();
    let ledger_provider = body.provider.clone();
    let ledger_workspace_id = body.workspace_id.clone();
    let ledger_trust_tier = body.trust_tier.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agents (id, user_id, name, description, type, parent_agent_id, model, provider,
                                capabilities, system_prompt, tools, max_iterations, temperature, config,
                                status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                                enabled_modes, character_json, allowed_skills, allowed_tools, category,
                                tags, data_classification, write_scope, mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                     ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29)",
            params![
                id2,
                user_id_for_db,
                body.name,
                body.description,
                body.agent_type.unwrap_or_else(|| "worker".to_string()),
                body.parent_agent_id,
                body.model,
                body.provider,
                json_to_string(body.capabilities),
                body.system_prompt,
                json_to_string(body.tools),
                body.max_iterations.unwrap_or(10),
                body.temperature.unwrap_or(0.7),
                json_to_string(body.config),
                body.status.unwrap_or_else(|| "idle".to_string()),
                body.workspace_id,
                body.avatar,
                body.identity_key,
                body.trust_tier.unwrap_or_else(|| "standard".to_string()),
                json_to_string(body.harness_config),
                json_to_string(body.enabled_modes).unwrap_or_else(|| "[\"chat\"]".to_string()),
                json_to_string(body.character_json),
                json_to_string(body.allowed_skills),
                json_to_string(body.allowed_tools),
                body.category,
                json_to_string(body.tags),
                body.data_classification,
                body.write_scope,
                body.mode.unwrap_or_else(|| "primary".to_string()),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => {
            // Append agent creation event to Rails ledger for audit/traceability
            let ledger_event = allternit_agent_system_rails::AllternitEvent {
                event_id: String::new(),
                ts: String::new(),
                actor: allternit_agent_system_rails::Actor {
                    r#type: allternit_agent_system_rails::ActorType::User,
                    id: user_id.clone(),
                },
                scope: Some(allternit_agent_system_rails::EventScope {
                    project_id: None,
                    dag_id: None,
                    node_id: None,
                    wih_id: None,
                    run_id: None,
                    team_workspace_id: ledger_workspace_id,
                    team_name: None,
                }),
                r#type: "agent.created".to_string(),
                payload: json!({
                    "agent_id": id,
                    "name": ledger_name,
                    "agent_type": ledger_agent_type.unwrap_or_else(|| "worker".to_string()),
                    "model": ledger_model,
                    "provider": ledger_provider,
                    "trust_tier": ledger_trust_tier.unwrap_or_else(|| "standard".to_string()),
                }),
                provenance: None,
            };
            if let Err(e) = state.rails.ledger.append(ledger_event).await {
                warn!("Failed to append agent.created ledger event: {}", e);
            }

            (StatusCode::CREATED, Json(json!({ "agent": { "id": id } }))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error creating agent: {}", e);
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

// ─── Ensure primary Companion agent ───────────────────────────────────────────

/// Ensure the user has a designated primary "Allternit Companion" agent — the
/// always-on orchestrator that is the default entrypoint and routes work to
/// subagents. Idempotent: returns the existing primary if one already exists.
async fn ensure_companion(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    // Pick a runnable brain: the user's configured default, unless it is the
    // unconfigured kimi fallback — then use the local Ollama brain so the
    // Companion actually runs out of the box.
    let (mut provider, mut model) = state.config.default_model();
    if provider.is_empty() || provider == "kimi-for-coding" || provider == "echo" {
        provider = "ollama".to_string();
        model = "qwen2.5:0.5b".to_string();
    }

    let result = tokio::task::spawn_blocking(move || -> Result<serde_json::Value, rusqlite::Error> {
        let conn = db.connect()?;
        if let Ok((id, name, model, provider)) = conn.query_row(
            "SELECT id, name, model, provider FROM agents WHERE user_id = ?1 AND is_primary = 1 LIMIT 1",
            params![user_id],
            |row| Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            )),
        ) {
            return Ok(json!({
                "agent": { "id": id, "name": name, "model": model, "provider": provider,
                           "mode": "orchestrator", "is_primary": true },
                "created": false,
            }));
        }

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO agents (id, user_id, name, description, type, model, provider,
                                status, trust_tier, harness_config, enabled_modes, mode, is_primary)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                id, user_id,
                "Allternit Companion",
                "Your always-on Allternit agent. Routes tasks, spawns subagents, and runs in any surface.",
                "orchestrator",
                model, provider,
                "idle", "standard",
                "{\"mode\":\"local\"}",
                "[\"chat\",\"cowork\",\"code\",\"browser\",\"design\"]",
                "orchestrator", 1,
            ],
        )?;
        Ok(json!({
            "agent": { "id": id, "name": "Allternit Companion", "model": model, "provider": provider,
                       "mode": "orchestrator", "is_primary": true },
            "created": true,
        }))
    })
    .await;

    match result {
        Ok(Ok(v)) => (StatusCode::OK, Json(v)).into_response(),
        Ok(Err(e)) => {
            warn!("DB error ensuring companion: {}", e);
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

// ─── Subagents (delegates of an orchestrator / Companion) ─────────────────────

/// Compact subagent row returned by list_subagents. The frontend subagent panel
/// uses its own SubagentConfig shape, so a compact row avoids duplicating the
/// full AgentRow mapping.
#[derive(Serialize)]
struct SubagentRow {
    id: String,
    name: String,
    #[serde(rename = "type")]
    agent_type: String,
    mode: String,
    parent_agent_id: Option<String>,
    model: String,
    provider: String,
    status: String,
    created_at: String,
}

async fn list_subagents(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(parent_id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, type, mode, parent_agent_id, model, provider, status, created_at
             FROM agents WHERE parent_agent_id = ?1 AND user_id = ?2 ORDER BY created_at",
        )?;
        let rows = stmt
            .query_map(params![parent_id, user_id], |row| {
                Ok(SubagentRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    agent_type: row.get(2)?,
                    mode: row.get(3)?,
                    parent_agent_id: row.get(4)?,
                    model: row.get(5)?,
                    provider: row.get(6)?,
                    status: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match rows {
        Ok(Ok(subagents)) => Json(json!({ "subagents": subagents })).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing subagents: {}", e);
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

/// Create a subagent under a parent orchestrator. Flows through the SAME
/// creation checklist as every other agent (one validated entry point), then
/// forces parent_agent_id = :id and mode = "subagent".
async fn create_subagent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(parent_id): Path<String>,
    Json(mut body): Json<CreateAgentBody>,
) -> impl IntoResponse {
    if let Err(err) = validate_agent_against_checklist(&body) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": err}))).into_response();
    }

    let id = uuid::Uuid::new_v4().to_string();
    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;
    let user_id_for_db = user_id.clone();
    let parent_for_db = parent_id.clone();
    let parent_for_response = parent_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // Refuse to orphan a subagent under a non-existent / other user's parent.
        let parent_exists: bool = conn
            .query_row(
                "SELECT 1 FROM agents WHERE id = ?1 AND user_id = ?2",
                params![parent_for_db, user_id_for_db],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !parent_exists {
            return Ok::<_, rusqlite::Error>(false);
        }
        conn.execute(
            "INSERT INTO agents (id, user_id, name, description, type, parent_agent_id, model, provider,
                                capabilities, system_prompt, tools, max_iterations, temperature, config,
                                status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                                enabled_modes, character_json, allowed_skills, allowed_tools, category,
                                tags, data_classification, write_scope, mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                     ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29)",
            params![
                id2,
                user_id_for_db,
                body.name,
                body.description,
                body.agent_type.unwrap_or_else(|| "subagent".to_string()),
                Some(parent_id),
                body.model,
                body.provider,
                json_to_string(body.capabilities),
                body.system_prompt,
                json_to_string(body.tools),
                body.max_iterations.unwrap_or(10),
                body.temperature.unwrap_or(0.7),
                json_to_string(body.config),
                body.status.unwrap_or_else(|| "idle".to_string()),
                body.workspace_id,
                body.avatar,
                body.identity_key,
                body.trust_tier.unwrap_or_else(|| "standard".to_string()),
                json_to_string(body.harness_config),
                json_to_string(body.enabled_modes).unwrap_or_else(|| "[\"chat\"]".to_string()),
                json_to_string(body.character_json),
                json_to_string(body.allowed_skills),
                json_to_string(body.allowed_tools),
                body.category,
                json_to_string(body.tags),
                body.data_classification,
                body.write_scope,
                "subagent".to_string(),
            ],
        )?;
        Ok::<_, rusqlite::Error>(true)
    })
    .await;

    match result {
        Ok(Ok(true)) => (StatusCode::CREATED, Json(json!({ "agent": { "id": id, "parent_agent_id": parent_for_response, "mode": "subagent" } }))).into_response(),
        Ok(Ok(false)) => (StatusCode::NOT_FOUND, Json(json!({"error": "parent_not_found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating subagent: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── Agent pattern templates ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct BrainInput {
    provider: String,
    model: String,
}

#[derive(Deserialize)]
struct InstantiateBody {
    template_id: String,
    brain: Option<BrainInput>,
    name_override: Option<String>,
}

async fn list_templates(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let db = state.db.clone();
    let result =
        tokio::task::spawn_blocking(move || -> Result<Vec<serde_json::Value>, rusqlite::Error> {
            let conn = db.connect()?;
            let mut stmt = conn.prepare(
                "SELECT id, name, description, category, spec, is_builtin, created_at
             FROM agent_templates ORDER BY is_builtin DESC, name",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "category": row.get::<_, String>(3)?,
                    "spec": parse_json_column(row.get(4)?).unwrap_or_else(|| json!({})),
                    "is_builtin": row.get::<_, i64>(5)? != 0,
                    "created_at": row.get::<_, Option<String>>(6)?,
                }))
            })?;
            let mut out = Vec::new();
            for r in rows {
                out.push(r?);
            }
            Ok(out)
        })
        .await;

    match result {
        Ok(Ok(templates)) => {
            (StatusCode::OK, Json(json!({ "templates": templates }))).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing templates: {}", e);
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

/// Instantiate a persisted pattern template into a live, runnable agent crew.
/// Resolves the brain (request override → user default → local Ollama fallback),
/// injects it into every node, validates each node against the creation checklist,
/// then persists the orchestrator and its subagents through the canonical path.
async fn instantiate_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<InstantiateBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    // Resolve the brain the same way the Companion does so template crews run
    // out of the box without a configured provider.
    let (mut provider, mut model) = match body.brain {
        Some(b) => (b.provider, b.model),
        None => state.config.default_model(),
    };
    if provider.is_empty() || provider == "kimi-for-coding" || provider == "echo" {
        provider = "ollama".to_string();
        model = "qwen2.5:0.5b".to_string();
    }
    let template_id = body.template_id.clone();
    let name_override = body.name_override.clone();

    let result = tokio::task::spawn_blocking(
        move || -> Result<serde_json::Value, (StatusCode, serde_json::Value)> {
            let conn = db.connect().map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": e.to_string()}))
            })?;
            let spec_text: Option<String> = conn
                .query_row(
                    "SELECT spec FROM agent_templates WHERE id = ?1",
                    params![template_id],
                    |row| row.get(0),
                )
                .map_err(|_| (StatusCode::NOT_FOUND, json!({"error": "template_not_found"})))?;
            let spec: serde_json::Value = serde_json::from_str(&spec_text.unwrap_or_else(|| "{}".to_string()))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": e.to_string()})))?;

            let pattern = spec
                .get("pattern")
                .and_then(|v| v.as_str())
                .unwrap_or("custom")
                .to_string();

            // Phase 1: build + validate every node before any insert.
            let inject_brain = |node: &serde_json::Value| -> Result<CreateAgentBody, (StatusCode, serde_json::Value)> {
                let mut n = node.clone();
                if let Some(obj) = n.as_object_mut() {
                    obj.insert("model".to_string(), json!(model));
                    obj.insert("provider".to_string(), json!(provider));
                }
                serde_json::from_value::<CreateAgentBody>(n).map_err(|e| {
                    (StatusCode::UNPROCESSABLE_ENTITY, json!({"error": format!("invalid template node: {}", e)}))
                })
            };

            let agent_node = spec.get("agent").cloned().unwrap_or_else(|| json!({}));
            let mut orch = inject_brain(&agent_node)?;
            if orch.mode.is_none() {
                orch.mode = Some("orchestrator".to_string());
            }
            orch.parent_agent_id = None;
            if let Some(n) = name_override {
                orch.name = n;
            }
            validate_agent_against_checklist(&orch).map_err(|e| {
                (StatusCode::BAD_REQUEST, json!({"error": format!("orchestrator: {}", e)}))
            })?;

            let mut sub_bodies: Vec<CreateAgentBody> = Vec::new();
            if let Some(arr) = spec.get("subagents").and_then(|v| v.as_array()) {
                for node in arr {
                    let mut s = inject_brain(node)?;
                    s.mode = Some("subagent".to_string());
                    validate_agent_against_checklist(&s).map_err(|e| {
                        (StatusCode::BAD_REQUEST, json!({"error": format!("subagent '{}': {}", s.name, e)}))
                    })?;
                    sub_bodies.push(s);
                }
            }

            // Phase 2: persist orchestrator, then subagents wired to it.
            let orch_name = orch.name.clone();
            let orch_id = persist_agent(&conn, &user_id, orch).map_err(|e| {
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": e.to_string()}))
            })?;
            let mut subs: Vec<serde_json::Value> = Vec::new();
            for mut s in sub_bodies {
                s.parent_agent_id = Some(orch_id.clone());
                let name = s.name.clone();
                let id = persist_agent(&conn, &user_id, s).map_err(|e| {
                    (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": e.to_string()}))
                })?;
                subs.push(json!({ "id": id, "name": name }));
            }

            Ok(json!({
                "pattern": pattern,
                "orchestrator": { "id": orch_id, "name": orch_name },
                "subagents": subs,
            }))
        },
    )
    .await;

    match result {
        Ok(Ok(body)) => (StatusCode::CREATED, Json(body)).into_response(),
        Ok(Err((code, err))) => (code, Json(err)).into_response(),
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
                    status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                    enabled_modes, character_json, allowed_skills, allowed_tools, category, tags,
                    data_classification, write_scope, created_at, updated_at, last_run_at,
                    mode, is_primary, delegates
             FROM agents WHERE id = ?1 AND user_id = ?2",
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
                capabilities: parse_json_column(row.get(8)?),
                system_prompt: row.get(9)?,
                tools: parse_json_column(row.get(10)?),
                max_iterations: row.get(11)?,
                temperature: row.get(12)?,
                config: parse_json_column(row.get(13)?),
                status: row.get(14)?,
                workspace_id: row.get(15)?,
                avatar: row.get(16)?,
                identity_key: row.get(17)?,
                trust_tier: row.get(18)?,
                harness_config: parse_json_column(row.get(19)?),
                enabled_modes: parse_json_column(row.get(20)?)
                    .unwrap_or(serde_json::Value::String("[\"chat\"]".to_string())),
                character_json: parse_json_column(row.get(21)?),
                allowed_skills: parse_json_column(row.get(22)?),
                allowed_tools: parse_json_column(row.get(23)?),
                category: row.get(24)?,
                tags: parse_json_column(row.get(25)?),
                data_classification: row.get(26)?,
                write_scope: row.get(27)?,
                created_at: row.get(28)?,
                updated_at: row.get(29)?,
                last_run_at: row.get(30)?,
                mode: row.get(31)?,
                is_primary: row.get::<_, i64>(32)? != 0,
                delegates: parse_json_column(row.get(33)?),
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
    capabilities: Option<serde_json::Value>,
    system_prompt: Option<String>,
    tools: Option<serde_json::Value>,
    max_iterations: Option<i64>,
    temperature: Option<f64>,
    config: Option<serde_json::Value>,
    status: Option<String>,
    workspace_id: Option<String>,
    avatar: Option<String>,
    identity_key: Option<String>,
    trust_tier: Option<String>,
    harness_config: Option<serde_json::Value>,
    enabled_modes: Option<serde_json::Value>,
    character_json: Option<serde_json::Value>,
    allowed_skills: Option<serde_json::Value>,
    allowed_tools: Option<serde_json::Value>,
    category: Option<String>,
    tags: Option<serde_json::Value>,
    data_classification: Option<String>,
    write_scope: Option<String>,
}

async fn update_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateAgentBody>,
) -> impl IntoResponse {
    if let Some(ref name) = body.name {
        if name.trim().len() < 3 {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Agent name must be at least 3 characters"})),
            )
                .into_response();
        }
    }
    if let Some(ref harness) = body.harness_config {
        let mode = harness.get("mode").and_then(|v| v.as_str());
        if !matches!(
            mode,
            Some("byok") | Some("cloud") | Some("local") | Some("subprocess")
        ) {
            return (
                StatusCode::BAD_REQUEST,
                Json(
                    json!({"error": "Harness mode must be one of: byok, cloud, local, subprocess"}),
                ),
            )
                .into_response();
        }
    }
    if let Some(ref modes) = body.enabled_modes {
        if modes.as_array().map(|a| a.is_empty()).unwrap_or(true) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "At least one enabled surface is required"})),
            )
                .into_response();
        }
    }

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
                trust_tier = COALESCE(?17, trust_tier),
                harness_config = COALESCE(?18, harness_config),
                enabled_modes = COALESCE(?19, enabled_modes),
                character_json = COALESCE(?20, character_json),
                allowed_skills = COALESCE(?21, allowed_skills),
                allowed_tools = COALESCE(?22, allowed_tools),
                category = COALESCE(?23, category),
                tags = COALESCE(?24, tags),
                data_classification = COALESCE(?25, data_classification),
                write_scope = COALESCE(?26, write_scope),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?27 AND user_id = ?28",
            params![
                body.name,
                body.description,
                body.agent_type,
                body.parent_agent_id,
                body.model,
                body.provider,
                json_to_string(body.capabilities),
                body.system_prompt,
                json_to_string(body.tools),
                body.max_iterations,
                body.temperature,
                json_to_string(body.config),
                body.status,
                body.workspace_id,
                body.avatar,
                body.identity_key,
                body.trust_tier,
                json_to_string(body.harness_config),
                json_to_string(body.enabled_modes),
                json_to_string(body.character_json),
                json_to_string(body.allowed_skills),
                json_to_string(body.allowed_tools),
                body.category,
                json_to_string(body.tags),
                body.data_classification,
                body.write_scope,
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

// ─── Agent Workspace Initialization ───────────────────────────────────────────

#[derive(Deserialize)]
struct WorkspaceDocument {
    path: String,
    content: String,
}

#[derive(Deserialize)]
struct InitializeWorkspaceBody {
    documents: Vec<WorkspaceDocument>,
}

#[derive(Serialize)]
struct InitializeWorkspaceResponse {
    success: bool,
    workspace_path: String,
    written_files: Vec<String>,
}

async fn initialize_agent_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<InitializeWorkspaceBody>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = id.clone();

    // Verify the agent exists and belongs to the user
    let authorized = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM agents WHERE id = ?1 AND user_id = ?2",
            params![agent_id, user_id],
            |row| row.get(0),
        )?;
        Ok::<_, rusqlite::Error>(count > 0)
    })
    .await;

    match authorized {
        Ok(Ok(false)) | Ok(Err(_)) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "Agent not found"})),
            )
                .into_response();
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
        _ => {}
    }

    let workspace_dir = crate::agent_workspace_paths::workspace_dir_for(&id);
    let workspace_dir_for_task = workspace_dir.clone();

    let write_result = tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(&workspace_dir_for_task)?;
        let mut written = Vec::new();
        for doc in body.documents {
            let file_path = workspace_dir_for_task.join(&doc.path);
            if let Some(parent) = file_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut file = std::fs::File::create(&file_path)?;
            file.write_all(doc.content.as_bytes())?;
            written.push(doc.path);
        }
        Ok::<_, std::io::Error>(written)
    })
    .await;

    match write_result {
        Ok(Ok(written)) => Json(InitializeWorkspaceResponse {
            success: true,
            workspace_path: workspace_dir.to_string_lossy().to_string(),
            written_files: written,
        })
        .into_response(),
        Ok(Err(e)) => {
            warn!("Workspace initialization failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("Workspace task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
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
            let key: Option<String> = conn
                .query_row(
                    "SELECT identity_key FROM agents WHERE id = ?1 AND user_id = ?2",
                    params![aid, user_id],
                    |row| row.get(0),
                )
                .ok();
            Ok::<_, rusqlite::Error>(key)
        } else {
            Ok(None)
        }
    })
    .await;

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
    // No fabricated secrets: the client supplies the public key to bind to the
    // agent. We never invent or return a private key.
    let pk = match body.public_key.as_deref().map(str::trim) {
        Some(k) if !k.is_empty() => k.to_string(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "public_key is required"})),
            )
                .into_response();
        }
    };

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let rows = conn.execute(
            "UPDATE agents SET identity_key = ?1 WHERE id = ?2 AND user_id = ?3",
            params![pk, body.agent_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match result {
        Ok(Ok(rows)) if rows > 0 => {
            Json(json!({"success": true, "public_key": body.public_key})).into_response()
        }
        Ok(Ok(_)) => (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response(),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to set identity"})),
        )
            .into_response(),
    }
}

// ─── Agent Metrics ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct MetricRow {
    id: String,
    agent_id: String,
    metric_type: String,
    value: f64,
    unit: String,
    metadata: Option<String>,
    timestamp: String,
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
        // Columns match the V1 baseline agent_metrics schema (unit, metadata,
        // timestamp) — this query previously selected labels/created_at, which
        // never existed, so the endpoint always fell into the empty branch.
        let mut sql = String::from(
            "SELECT id, agent_id, metric_type, value, unit, metadata, timestamp
             FROM agent_metrics WHERE user_id = ?1 AND timestamp >= datetime('now', ?2 || ' days')"
        );
        if agent_id.is_some() {
            sql.push_str(" AND agent_id = ?3");
        }
        if metric_type.is_some() {
            sql.push_str(" AND metric_type = ?4");
        }
        sql.push_str(" ORDER BY timestamp DESC");

        let mut stmt = conn.prepare(&sql)?;
        let param_days = format!("-{}", days);
        let rows = match (&agent_id, &metric_type) {
            (Some(a), Some(t)) => {
                stmt.query_map(params![user_id, param_days, a, t], row_to_metric)?
            }
            (Some(a), None) => stmt.query_map(params![user_id, param_days, a], row_to_metric)?,
            (None, Some(t)) => stmt.query_map(params![user_id, param_days, t], row_to_metric)?,
            (None, None) => stmt.query_map(params![user_id, param_days], row_to_metric)?,
        }
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

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
        unit: row.get(4)?,
        metadata: row.get(5)?,
        timestamp: row.get(6)?,
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
                 FROM test_suites WHERE user_id = ?1 AND agent_id = ?2 ORDER BY created_at DESC",
            )?;
            rows = stmt
                .query_map(params![user_id, aid], row_to_suite)?
                .collect::<Result<Vec<_>, _>>()?;
        } else {
            stmt = conn.prepare(
                "SELECT id, user_id, agent_id, name, description, cases, created_at
                 FROM test_suites WHERE user_id = ?1 ORDER BY created_at DESC",
            )?;
            rows = stmt
                .query_map(params![user_id], row_to_suite)?
                .collect::<Result<Vec<_>, _>>()?;
        }
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

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
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({"suite": {"id": id, "name": body.name}})),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating test suite: {}", e);
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

// ─── Run Agent (real brain through Gizzi) ─────────────────────────────────────

#[derive(Deserialize)]
struct RunAgentBody {
    input: String,
    #[allow(dead_code)]
    plan: Option<serde_json::Value>,
    #[allow(dead_code)]
    metadata: Option<serde_json::Value>,
}

struct AgentRunRow {
    id: String,
    name: String,
    model: String,
    provider: String,
    system_prompt: Option<String>,
}

/// Run an existing agent by sending `input` through the Gizzi runtime using the
/// agent's configured brain (provider + model) and system prompt. This is the
/// "agent use" half of the creation checklist: every agent that passes
/// `validate_agent_against_checklist` must be runnable end-to-end through gizzi.
async fn run_agent(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<RunAgentBody>,
) -> impl IntoResponse {
    let input = body.input.trim().to_string();
    if input.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "input is required"})),
        )
            .into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let user_id_for_db = user_id.clone();
    let id_for_db = id.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, name, model, provider, system_prompt
             FROM agents WHERE id = ?1 AND user_id = ?2",
            params![id_for_db, user_id_for_db],
            |row| {
                Ok(AgentRunRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    model: row.get(2)?,
                    provider: row.get(3)?,
                    system_prompt: row.get(4)?,
                })
            },
        )
    })
    .await;

    let agent = match row {
        Ok(Ok(a)) => a,
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response();
        }
        Ok(Err(e)) => {
            warn!("DB error loading agent for run: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response();
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
    };

    let run_id = uuid::Uuid::new_v4().to_string();
    let started_at = std::time::Instant::now();

    // Record the run up front so even a gizzi-side failure leaves a trail.
    record_run_start(&state.db, &run_id, &agent.id, &user_id).await;
    append_run_ledger_event(
        &state,
        &user_id,
        &run_id,
        "agent.run.started",
        json!({
            "agent_id": agent.id,
            "run_id": run_id,
            "model": agent.model,
            "provider": agent.provider,
        }),
    )
    .await;

    let outcome = execute_agent_run(&state, &agent, &input).await;
    let duration_ms = started_at.elapsed().as_millis() as i64;

    match outcome {
        Ok((session_id, output)) => {
            record_run_outcome(
                &state,
                &user_id,
                &agent.id,
                &run_id,
                true,
                Some(&output),
                None,
                duration_ms,
            )
            .await;
            stamp_last_run_at(&state.db, &agent.id).await;

            (
                StatusCode::OK,
                Json(json!({
                    "run_id": run_id,
                    "agent_id": agent.id,
                    "session_id": session_id,
                    "status": "completed",
                    "output": output,
                    "model": agent.model,
                    "provider": agent.provider,
                })),
            )
                .into_response()
        }
        Err(RunFailure::Brain {
            session_id,
            message,
        }) => {
            record_run_outcome(
                &state,
                &user_id,
                &agent.id,
                &run_id,
                false,
                None,
                Some(&message),
                duration_ms,
            )
            .await;
            (
                StatusCode::OK,
                Json(json!({
                    "run_id": run_id,
                    "agent_id": agent.id,
                    "session_id": session_id,
                    "status": "error",
                    "error": message,
                    "model": agent.model,
                    "provider": agent.provider,
                })),
            )
                .into_response()
        }
        Err(RunFailure::Gateway(message)) => {
            record_run_outcome(
                &state,
                &user_id,
                &agent.id,
                &run_id,
                false,
                None,
                Some(&message),
                duration_ms,
            )
            .await;
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": message, "run_id": run_id})),
            )
                .into_response()
        }
    }
}

/// How a run failed, preserving the two response shapes `run_agent` has always
/// had: gizzi-hop failures are 502s, brain/provider errors are 200
/// status:"error".
enum RunFailure {
    Gateway(String),
    Brain { session_id: String, message: String },
}

/// The gizzi round-trip half of `run_agent`: create a session, post the
/// message, extract the text output. Split out so the handler can record the
/// run lifecycle around a single Result instead of minting an untracked
/// run_id per early return.
async fn execute_agent_run(
    state: &AppState,
    agent: &AgentRunRow,
    input: &str,
) -> Result<(String, String), RunFailure> {
    let gizzi = state
        .config
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| RunFailure::Gateway(e.to_string()))?;

    // Create a gizzi session bound to this agent.
    let session_payload = json!({
        "title": format!("Agent run: {}", agent.name),
        "surface": "chat",
    });
    let session = match client
        .post(format!("{}/v1/session", gizzi))
        .json(&session_payload)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
            Ok(v) => v,
            Err(e) => {
                return Err(RunFailure::Gateway(format!("gizzi session decode: {}", e)));
            }
        },
        Ok(r) => {
            let s = r.status();
            let t = r.text().await.unwrap_or_default();
            return Err(RunFailure::Gateway(format!(
                "gizzi session create failed: {} {}",
                s, t
            )));
        }
        Err(e) => {
            return Err(RunFailure::Gateway(format!("gizzi unreachable: {}", e)));
        }
    };
    let session_id = session
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if session_id.is_empty() {
        return Err(RunFailure::Gateway(
            "gizzi returned no session id".to_string(),
        ));
    }

    // Gizzi message parts only accept a fixed set of part types (no "system"),
    // so prepend the agent's system prompt to the user input when present.
    let full_prompt = match &agent.system_prompt {
        Some(sp) if !sp.trim().is_empty() => format!("{}\n\n{}", sp.trim(), input),
        _ => input.to_string(),
    };
    let message_payload = json!({
        "model": { "providerID": agent.provider, "modelID": agent.model },
        "agent": "build",
        "parts": [{ "type": "text", "text": full_prompt }],
    });
    let message = match client
        .post(format!("{}/v1/session/{}/message", gizzi, session_id))
        .json(&message_payload)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
            Ok(v) => v,
            Err(e) => {
                return Err(RunFailure::Gateway(format!("gizzi message decode: {}", e)));
            }
        },
        Ok(r) => {
            let s = r.status();
            let t = r.text().await.unwrap_or_default();
            return Err(RunFailure::Gateway(format!(
                "gizzi message failed: {} {}",
                s, t
            )));
        }
        Err(e) => {
            return Err(RunFailure::Gateway(format!("gizzi unreachable: {}", e)));
        }
    };

    // Surface brain/provider errors (auth, model not found) instead of fabricating output.
    if let Some(err) = message
        .get("info")
        .and_then(|i| i.get("error"))
        .filter(|e| !e.is_null())
    {
        let msg = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("gizzi brain error");
        return Err(RunFailure::Brain {
            session_id,
            message: msg.to_string(),
        });
    }

    let mut output = String::new();
    if let Some(parts) = message.get("parts").and_then(|p| p.as_array()) {
        for p in parts {
            if p.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(t) = p.get("text").and_then(|t| t.as_str()) {
                    output.push_str(t);
                }
            }
        }
    }

    Ok((session_id, output))
}

/// Insert the `agent_runs` row for a freshly-started run (status "running").
/// Best-effort: a recording failure never fails the run itself.
pub(crate) async fn record_run_start(db: &crate::db::DbHandle, run_id: &str, agent_id: &str, user_id: &str) {
    let db = db.clone();
    let run_id = run_id.to_string();
    let agent_id = agent_id.to_string();
    let user_id = user_id.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO agent_runs (id, agent_id, user_id, status) VALUES (?1, ?2, ?3, 'running')",
            params![run_id, agent_id, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
    match result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!("Failed to record agent run start: {}", e),
        Err(e) => warn!("Run-record task panicked: {}", e),
    }
}

/// Persist the terminal state of a run: the `agent_runs` row, a Rails ledger
/// event, and the `agent_metrics` samples. All best-effort — recording never
/// changes the response the caller gets.
#[allow(clippy::too_many_arguments)]
async fn record_run_outcome(
    state: &AppState,
    user_id: &str,
    agent_id: &str,
    run_id: &str,
    success: bool,
    output: Option<&str>,
    error: Option<&str>,
    duration_ms: i64,
) {
    let status = if success { "completed" } else { "failed" };
    record_run_finish(&state.db, run_id, status, output, error, duration_ms).await;

    let mut payload = json!({
        "agent_id": agent_id,
        "run_id": run_id,
        "duration_ms": duration_ms,
    });
    // Ledger events replay on the agent events SSE; cap output so a long
    // response doesn't bloat the append-only ledger.
    if let Some(o) = output {
        payload["output"] = json!(o.chars().take(2000).collect::<String>());
    }
    if let Some(e) = error {
        payload["error"] = json!(e);
    }
    let event_type = if success {
        "agent.run.completed"
    } else {
        "agent.run.failed"
    };
    append_run_ledger_event(state, user_id, run_id, event_type, payload).await;

    record_run_metrics(&state.db, user_id, agent_id, run_id, success, duration_ms).await;
}

/// Update the `agent_runs` row with the terminal status, output/error,
/// duration and completion timestamp. Best-effort.
pub(crate) async fn record_run_finish(
    db: &crate::db::DbHandle,
    run_id: &str,
    status: &str,
    output: Option<&str>,
    error: Option<&str>,
    duration_ms: i64,
) {
    let db = db.clone();
    let run_id = run_id.to_string();
    let status = status.to_string();
    let output = output.map(str::to_string);
    let error = error.map(str::to_string);
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE agent_runs SET status = ?2, output = ?3, error = ?4, duration_ms = ?5,
                    completed_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            params![run_id, status, output, error, duration_ms],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
    match result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!("Failed to record agent run finish: {}", e),
        Err(e) => warn!("Run-record task panicked: {}", e),
    }
}

/// Write the per-run metric samples `GET /agents/metrics` reads back: a run
/// counter, a success/failure counter, and a duration sample. The V1
/// `agent_metrics` table is event-style (one row per sample), so counters and
/// averages are aggregates over these rows, not a single rolled-up row.
async fn record_run_metrics(
    db: &crate::db::DbHandle,
    user_id: &str,
    agent_id: &str,
    run_id: &str,
    success: bool,
    duration_ms: i64,
) {
    let db = db.clone();
    let user_id = user_id.to_string();
    let agent_id = agent_id.to_string();
    let run_id = run_id.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let metadata = json!({"run_id": run_id}).to_string();
        let outcome_type = if success { "run_success" } else { "run_failure" };
        for (metric_type, value, unit) in [
            ("run", 1.0_f64, "count"),
            (outcome_type, 1.0, "count"),
            ("run_duration_ms", duration_ms as f64, "ms"),
        ] {
            conn.execute(
                "INSERT INTO agent_metrics (id, user_id, agent_id, run_id, metric_type, value, unit, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    user_id,
                    agent_id,
                    run_id,
                    metric_type,
                    value,
                    unit,
                    metadata,
                ],
            )?;
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;
    match result {
        Ok(Ok(())) => {}
        Ok(Err(e)) => warn!("Failed to record agent run metrics: {}", e),
        Err(e) => warn!("Run-metrics task panicked: {}", e),
    }
}

/// Append an agent run lifecycle event to the same Rails ledger
/// `agent.created` uses, so `GET /agents/:id/events` replays run activity.
/// Best-effort, same posture as the creation write.
async fn append_run_ledger_event(
    state: &AppState,
    user_id: &str,
    run_id: &str,
    event_type: &str,
    payload: serde_json::Value,
) {
    let event = allternit_agent_system_rails::AllternitEvent {
        event_id: String::new(),
        ts: String::new(),
        actor: allternit_agent_system_rails::Actor {
            r#type: allternit_agent_system_rails::ActorType::User,
            id: user_id.to_string(),
        },
        scope: Some(allternit_agent_system_rails::EventScope {
            project_id: None,
            dag_id: None,
            node_id: None,
            wih_id: None,
            run_id: Some(run_id.to_string()),
            team_workspace_id: None,
            team_name: None,
        }),
        r#type: event_type.to_string(),
        payload,
        provenance: None,
    };
    if let Err(e) = state.rails.ledger.append(event).await {
        warn!("Failed to append {} ledger event: {}", event_type, e);
    }
}

/// Stamp agents.last_run_at (best-effort; never fails the run).
async fn stamp_last_run_at(db: &crate::db::DbHandle, agent_id: &str) {
    let db = db.clone();
    let agent_id = agent_id.to_string();
    let _ = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE agents SET last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
            params![agent_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
}

// ─── Agent Run Records ────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AgentRunRecord {
    id: String,
    agent_id: String,
    status: String,
    output: Option<String>,
    error: Option<String>,
    duration_ms: Option<i64>,
    created_at: String,
    completed_at: Option<String>,
}

/// GET /agents/:id/runs — run history for one agent, newest first, capped at
/// 50. Ownership-checked the same way as the workspace routes.
async fn list_agent_runs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let agent_id = id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let owned: i64 = conn.query_row(
            "SELECT COUNT(*) FROM agents WHERE id = ?1 AND user_id = ?2",
            params![agent_id, user_id],
            |row| row.get(0),
        )?;
        if owned == 0 {
            return Ok::<_, rusqlite::Error>(None);
        }
        let mut stmt = conn.prepare(
            "SELECT id, agent_id, status, output, error, duration_ms, created_at, completed_at
             FROM agent_runs WHERE agent_id = ?1 AND user_id = ?2
             ORDER BY created_at DESC LIMIT 50",
        )?;
        let runs = stmt
            .query_map(params![agent_id, user_id], |row| {
                Ok(AgentRunRecord {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    status: row.get(2)?,
                    output: row.get(3)?,
                    error: row.get(4)?,
                    duration_ms: row.get(5)?,
                    created_at: row.get(6)?,
                    completed_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Some(runs))
    })
    .await;

    match result {
        Ok(Ok(Some(runs))) => Json(json!({ "runs": runs })).into_response(),
        Ok(Ok(None)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Agent not found"})),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing agent runs: {}", e);
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

// ─── Run Agent Test ───────────────────────────────────────────────────────────

struct GizziRunResult {
    output: String,
    tool_calls: Vec<serde_json::Value>,
    tokens: Option<u64>,
    error: Option<String>,
    session_id: String,
}

/// Single real gizzi round-trip for an agent. Shared by `run_agent_test` so the
/// test endpoint reports real behaviour instead of fabricated metrics.
async fn gizzi_run_once(
    state: &AppState,
    agent: &AgentRunRow,
    input: &str,
) -> Result<GizziRunResult, (StatusCode, Json<serde_json::Value>)> {
    let gizzi = state
        .config
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

    let session_payload =
        json!({ "title": format!("Agent test: {}", agent.name), "surface": "chat" });
    let session = match client
        .post(format!("{}/v1/session", gizzi))
        .json(&session_payload)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json::<serde_json::Value>().await.map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi session decode: {}", e)})),
            )
        })?,
        Ok(r) => {
            let s = r.status();
            let t = r.text().await.unwrap_or_default();
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi session create failed: {} {}", s, t)})),
            ));
        }
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi unreachable: {}", e)})),
            ))
        }
    };
    let session_id = session
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if session_id.is_empty() {
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": "gizzi returned no session id"})),
        ));
    }

    let full_prompt = match &agent.system_prompt {
        Some(sp) if !sp.trim().is_empty() => format!("{}\n\n{}", sp.trim(), input),
        _ => input.to_string(),
    };
    let message_payload = json!({
        "model": { "providerID": agent.provider, "modelID": agent.model },
        "agent": "build",
        "parts": [{ "type": "text", "text": full_prompt }],
    });
    let message = match client
        .post(format!("{}/v1/session/{}/message", gizzi, session_id))
        .json(&message_payload)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json::<serde_json::Value>().await.map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi message decode: {}", e)})),
            )
        })?,
        Ok(r) => {
            let s = r.status();
            let t = r.text().await.unwrap_or_default();
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi message failed: {} {}", s, t)})),
            ));
        }
        Err(e) => {
            return Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("gizzi unreachable: {}", e)})),
            ))
        }
    };

    let brain_error = message
        .get("info")
        .and_then(|i| i.get("error"))
        .filter(|e| !e.is_null())
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string());

    let tokens = message
        .get("info")
        .and_then(|i| i.get("tokens"))
        .and_then(|t| t.as_u64());

    let mut output = String::new();
    let mut tool_calls: Vec<serde_json::Value> = Vec::new();
    if let Some(parts) = message.get("parts").and_then(|p| p.as_array()) {
        for p in parts {
            match p.get("type").and_then(|t| t.as_str()) {
                Some("text") => {
                    if let Some(t) = p.get("text").and_then(|t| t.as_str()) {
                        output.push_str(t);
                    }
                }
                Some("tool-call") | Some("tool") => tool_calls.push(p.clone()),
                _ => {}
            }
        }
    }

    Ok(GizziRunResult {
        output,
        tool_calls,
        tokens,
        error: brain_error,
        session_id,
    })
}

#[derive(Deserialize)]
struct RunTestBody {
    #[serde(alias = "agentId")]
    agent_id: String,
    messages: Option<Vec<serde_json::Value>>,
    #[allow(dead_code)]
    variables: Option<serde_json::Value>,
}

async fn run_agent_test(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<RunTestBody>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };

    let db = state.db.clone();
    let user_id = user.user_id;
    let aid = body.agent_id.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT id, name, model, provider, system_prompt FROM agents WHERE id = ?1 AND user_id = ?2",
            params![aid, user_id],
            |row| Ok(AgentRunRow {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                provider: row.get(3)?,
                system_prompt: row.get(4)?,
            }),
        )
    }).await;

    let agent = match row {
        Ok(Ok(a)) => a,
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            return (StatusCode::NOT_FOUND, Json(json!({"error": "not_found"}))).into_response();
        }
        Ok(Err(e)) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response();
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response();
        }
    };

    // Use the last user message if the playground supplied one, otherwise a
    // deterministic connectivity probe.
    let input = body
        .messages
        .as_ref()
        .and_then(|m| {
            m.iter()
                .rev()
                .find(|x| x.get("role").and_then(|r| r.as_str()) == Some("user"))
        })
        .and_then(|x| x.get("content").and_then(|c| c.as_str()))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Connectivity test: reply with a short acknowledgement.")
        .to_string();

    let start = std::time::Instant::now();
    let result = match gizzi_run_once(&state, &agent, &input).await {
        Ok(r) => r,
        Err(resp) => return resp.into_response(),
    };
    let latency_ms = start.elapsed().as_millis() as u64;

    if let Some(err) = result.error {
        return Json(json!({
            "success": false,
            "response": { "role": "assistant", "content": "" },
            "metrics": { "latency_ms": latency_ms, "tokens": result.tokens },
            "tool_calls": result.tool_calls,
            "error": err,
            "session_id": result.session_id,
        }))
        .into_response();
    }

    Json(json!({
        "success": true,
        "response": { "role": "assistant", "content": result.output },
        "metrics": { "latency_ms": latency_ms, "tokens": result.tokens },
        "tool_calls": result.tool_calls,
        "session_id": result.session_id,
    }))
    .into_response()
}
