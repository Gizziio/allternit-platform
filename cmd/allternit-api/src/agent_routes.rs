
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
use std::io::Write;
use std::path::PathBuf;
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
        .route("/agents/:id/workspace/initialize", post(initialize_agent_workspace))
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
                    data_classification, write_scope, created_at, updated_at, last_run_at
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
                enabled_modes: parse_json_column(row.get(20)?).unwrap_or(serde_json::Value::String("[\"chat\"]".to_string())),
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
                                tags, data_classification, write_scope)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                     ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)",
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
                    status, workspace_id, avatar, identity_key, trust_tier, harness_config,
                    enabled_modes, character_json, allowed_skills, allowed_tools, category, tags,
                    data_classification, write_scope, created_at, updated_at, last_run_at
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
                enabled_modes: parse_json_column(row.get(20)?).unwrap_or(serde_json::Value::String("[\"chat\"]".to_string())),
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
            return (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response();
        }
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response();
        }
        _ => {}
    }

    let data_dir = dirs::data_dir()
        .map(|d| d.join("allternit"))
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"));
    let workspace_dir = data_dir.join("agent-workspaces").join(&id);
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
        }).into_response(),
        Ok(Err(e)) => {
            warn!("Workspace initialization failed: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("Workspace task panicked: {}", e);
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
