
//! OpenAI-compatible Agents v1 API routes
//!
//! Mirrors Next.js `/api/agents/v1/*` layer.

use axum::extract::Extension;
use axum::{
    extract::{Json, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn agents_v1_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agents-v1", get(agents_v1_status))
        .route("/agents/v1/models", get(list_models))
        .route("/agents/v1/models/:model", get(get_model))
        .route("/agents/v1/responses/models", get(list_models))
        .route("/agents/v1/tools", get(list_tools))
        .route("/agents/v1/tools/search", post(search_tools))
        .route("/agents/v1/tools/activate", post(activate_tools))
        .route("/agents/v1/responses/:id", get(get_response))
}

// ─── Shared agent fetch ───────────────────────────────────────────────────────

fn fetch_agent_by_id(
    conn: &rusqlite::Connection,
    agent_id: &str,
    user_id: &str,
) -> Result<Option<AgentRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, name, description, type, parent_agent_id, model, provider,
                capabilities, system_prompt, tools, max_iterations, temperature, config,
                status, workspace_id, avatar, identity_key, created_at, updated_at, last_run_at
         FROM agents WHERE id = ?1 AND user_id = ?2"
    )?;
    let rows: Vec<AgentRow> = stmt.query_map(params![agent_id, user_id], map_agent_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows.into_iter().next())
}

fn list_user_agents(
    conn: &rusqlite::Connection,
    user_id: &str,
) -> Result<Vec<AgentRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, name, description, type, parent_agent_id, model, provider,
                capabilities, system_prompt, tools, max_iterations, temperature, config,
                status, workspace_id, avatar, identity_key, created_at, updated_at, last_run_at
         FROM agents WHERE user_id = ?1 ORDER BY updated_at DESC"
    )?;
    let rows: Vec<AgentRow> = stmt.query_map(params![user_id], map_agent_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn map_agent_row(row: &rusqlite::Row) -> Result<AgentRow, rusqlite::Error> {
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
}

#[derive(Clone)]
#[allow(dead_code)]
struct AgentRow {
    id: String,
    user_id: String,
    name: String,
    description: Option<String>,
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

// ─── Profile builder (mirrors Next.js buildAgentProfile) ──────────────────────

fn build_agent_profile(agent: &AgentRow) -> Value {
    let config: Value = agent.config.as_ref()
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or(json!({}));

    let profile_override = config.get("profile").cloned().unwrap_or(json!({}));

    let instructions = profile_override.get("instructions")
        .and_then(|v| v.as_str())
        .or(agent.system_prompt.as_deref())
        .unwrap_or("");

    let model_config = profile_override.get("modelConfig").cloned().unwrap_or(json!({}));
    let provider = model_config.get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or(&agent.provider);
    let model = model_config.get("model")
        .and_then(|v| v.as_str())
        .unwrap_or(&agent.model);
    let temperature = model_config.get("temperature")
        .and_then(|v| v.as_f64())
        .or(Some(agent.temperature));
    let max_context_tokens = model_config.get("maxContextTokens")
        .and_then(|v| v.as_u64())
        .or_else(|| config.get("maxContextTokens").and_then(|v| v.as_u64()));
    let max_output_tokens = model_config.get("maxOutputTokens")
        .and_then(|v| v.as_u64())
        .or_else(|| config.get("maxOutputTokens").and_then(|v| v.as_u64()));
    let max_steps = model_config.get("maxSteps")
        .and_then(|v| v.as_u64())
        .or_else(|| config.get("maxSteps").and_then(|v| v.as_u64()))
        .or_else(|| Some(agent.max_iterations as u64));

    let capabilities = derive_capabilities(agent, &profile_override);

    let tool_policy = profile_override.get("toolPolicy").cloned().unwrap_or(json!({}));
    let built_in_tool_ids = tool_policy.get("builtInToolIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_else(|| parse_json_string_array(agent.tools.as_deref()));
    let mcp_server_ids = tool_policy.get("mcpServerIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_else(|| parse_json_string_array(config.get("mcpServerIds").and_then(|v| v.as_str())));
    let allowed_mcp_tool_ids = tool_policy.get("allowedMcpToolIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_else(|| parse_json_string_array(config.get("allowedMcpToolIds").and_then(|v| v.as_str())));
    let deferred_tool_ids = tool_policy.get("deferredToolIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_else(|| parse_json_string_array(config.get("deferredToolIds").and_then(|v| v.as_str())));

    json!({
        "agentId": agent.id,
        "version": profile_override.get("version").and_then(|v| v.as_str()).unwrap_or("1"),
        "avatarUrl": profile_override.get("avatarUrl").and_then(|v| v.as_str()).or(agent.avatar.as_deref()),
        "instructions": instructions,
        "modelConfig": {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "maxContextTokens": max_context_tokens,
            "maxOutputTokens": max_output_tokens,
            "maxSteps": max_steps,
        },
        "capabilities": capabilities,
        "toolPolicy": {
            "builtInToolIds": built_in_tool_ids,
            "mcpServerIds": mcp_server_ids,
            "allowedMcpToolIds": allowed_mcp_tool_ids,
            "deferredToolIds": deferred_tool_ids,
        },
        "files": profile_override.get("files").cloned().unwrap_or(Value::Null),
        "artifactPolicy": profile_override.get("artifactPolicy").cloned().unwrap_or(Value::Null),
    })
}

fn derive_capabilities(agent: &AgentRow, profile_override: &Value) -> Value {
    if let Some(cap) = profile_override.get("capabilities").and_then(|v| v.as_object()) {
        return json!(cap);
    }

    let caps = parse_json_string_array(agent.capabilities.as_deref());
    let mut flags = serde_json::Map::new();
    for cap in caps {
        match cap.as_str() {
            "execute_code" => { flags.insert("execute_code".to_string(), json!(true)); }
            "file_search" => { flags.insert("file_search".to_string(), json!(true)); }
            "context" => { flags.insert("context".to_string(), json!(true)); }
            "mcp_tools" => { flags.insert("mcp_tools".to_string(), json!(true)); }
            "deferred_tools" => { flags.insert("deferred_tools".to_string(), json!(true)); }
            "artifacts" => { flags.insert("artifacts".to_string(), json!(true)); }
            "actions" => { flags.insert("actions".to_string(), json!(true)); }
            "chain" => { flags.insert("chain".to_string(), json!(true)); }
            "web_search" => { flags.insert("web_search".to_string(), json!(true)); }
            "computer-use" => { flags.insert("computer_use".to_string(), json!(true)); }
            "filesystem" => { flags.insert("filesystem".to_string(), json!(true)); }
            _ => {}
        }
    }
    json!(flags)
}

fn parse_json_string_array(value: Option<&str>) -> Vec<String> {
    value.and_then(|v| serde_json::from_str::<Vec<String>>(v).ok())
        .unwrap_or_default()
}

fn agent_to_remote_model(agent: &AgentRow) -> Value {
    let created = agent.created_at.parse::<chrono::DateTime<chrono::Utc>>()
        .map(|d| d.timestamp())
        .unwrap_or_else(|_| {
            // Fallback: try parsing as RFC3339 or naive datetime
            chrono::NaiveDateTime::parse_from_str(&agent.created_at, "%Y-%m-%d %H:%M:%S")
                .map(|ndt| ndt.and_utc().timestamp())
                .unwrap_or(0)
        });

    json!({
        "id": agent.id,
        "object": "model",
        "created": created,
        "owned_by": "allternit",
        "profile": build_agent_profile(agent),
    })
}

// ─── GET /agents/v1/models ────────────────────────────────────────────────────

async fn list_models(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let agents = list_user_agents(&conn, &user_id)?;
        Ok::<_, rusqlite::Error>(agents)
    }).await;

    match result {
        Ok(Ok(agents)) => {
            let data: Vec<Value> = agents.iter().map(|a| agent_to_remote_model(a)).collect();
            Json(json!({
                "object": "list",
                "data": data,
            })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error listing models: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── GET /agents/v1/models/:model ─────────────────────────────────────────────

async fn get_model(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(model_id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let agent = fetch_agent_by_id(&conn, &model_id, &user_id)?;
        Ok::<_, rusqlite::Error>(agent)
    }).await;

    match result {
        Ok(Ok(Some(agent))) => Json(agent_to_remote_model(&agent)).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error getting model: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── GET /agents/v1/tools ─────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListToolsQuery {
    model: String,
}

async fn list_tools(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListToolsQuery>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let model_id = q.model;
    let model_id_resp = model_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let agent = fetch_agent_by_id(&conn, &model_id, &user_id)?;
        Ok::<_, rusqlite::Error>(agent)
    }).await;

    match result {
        Ok(Ok(Some(agent))) => {
            let tools = build_deferred_tools(&agent);
            Json(json!({
                "object": "list",
                "data": tools,
                "model": model_id_resp,
            })).into_response()
        }
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing tools: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

fn build_deferred_tools(agent: &AgentRow) -> Vec<Value> {
    let config: Value = agent.config.as_ref()
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or(json!({}));

    let profile_override = config.get("profile").cloned().unwrap_or(json!({}));
    let tool_policy = profile_override.get("toolPolicy").cloned().unwrap_or(json!({}));

    let deferred_tool_ids = tool_policy.get("deferredToolIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
        .unwrap_or_else(|| parse_json_string_array(config.get("deferredToolIds").and_then(|v| v.as_str())));

    let allowed_mcp_tool_ids: Vec<String> = tool_policy.get("allowedMcpToolIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_else(|| parse_json_string_array(config.get("allowedMcpToolIds").and_then(|v| v.as_str())));

    let mcp_server_ids: Vec<String> = tool_policy.get("mcpServerIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_else(|| parse_json_string_array(config.get("mcpServerIds").and_then(|v| v.as_str())));

    deferred_tool_ids.iter().enumerate().map(|(i, id)| {
        let is_allowed = allowed_mcp_tool_ids.contains(id);
        let server_id = mcp_server_ids.get(i).or(mcp_server_ids.first()).cloned();
        json!({
            "id": id,
            "label": id,
            "serverId": server_id,
            "description": if is_allowed {
                "Deferred MCP tool available to this agent profile."
            } else {
                "Deferred tool declared on this agent profile."
            },
        })
    }).collect()
}

// ─── POST /agents/v1/tools/search ─────────────────────────────────────────────

#[derive(Deserialize)]
struct SearchToolsBody {
    model: String,
    query: Option<String>,
}

async fn search_tools(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<SearchToolsBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let model_id = body.model;
    let query = body.query.unwrap_or_default().to_lowercase();
    let model_id_resp = model_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let agent = fetch_agent_by_id(&conn, &model_id, &user_id)?;
        Ok::<_, rusqlite::Error>(agent)
    }).await;

    match result {
        Ok(Ok(Some(agent))) => {
            let tools = build_deferred_tools(&agent);
            let filtered: Vec<Value> = if query.is_empty() {
                tools
            } else {
                tools.into_iter().filter(|t| {
                    t.get("id").and_then(|v| v.as_str()).map(|s| s.to_lowercase().contains(&query)).unwrap_or(false)
                    || t.get("label").and_then(|v| v.as_str()).map(|s| s.to_lowercase().contains(&query)).unwrap_or(false)
                    || t.get("description").and_then(|v| v.as_str()).map(|s| s.to_lowercase().contains(&query)).unwrap_or(false)
                }).collect()
            };
            Json(json!({
                "object": "list",
                "data": filtered,
                "model": model_id_resp,
            })).into_response()
        }
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error searching tools: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── POST /agents/v1/tools/activate ───────────────────────────────────────────

#[derive(Deserialize)]
struct ActivateToolsBody {
    #[serde(alias = "model")]
    model_id: String,
    #[serde(alias = "session_id")]
    session_id: String,
    #[serde(alias = "tool_ids")]
    tool_ids: Option<Vec<String>>,
    #[serde(alias = "tool_id")]
    tool_id: Option<String>,
}

async fn activate_tools(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<ActivateToolsBody>,
) -> impl IntoResponse {

    let tool_ids: Vec<String> = body.tool_ids
        .or_else(|| body.tool_id.map(|id| vec![id]))
        .unwrap_or_default();

    if tool_ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "At least one tool_id is required"}))).into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let model_id = body.model_id;
    let session_id = body.session_id;
    let model_id_resp = model_id.clone();
    let session_id_resp = session_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Verify agent ownership
        let agent = fetch_agent_by_id(&conn, &model_id, &user_id)?;
        if agent.is_none() {
            return Ok::<_, rusqlite::Error>((false, Vec::<String>::new()));
        }

        // Get current deferred tools to validate activation
        let agent = agent.unwrap();
        let deferred = build_deferred_tools(&agent);
        let allowed: std::collections::HashSet<String> = deferred.iter()
            .filter_map(|t| t.get("id").and_then(|v| v.as_str()).map(String::from))
            .collect();

        let activated: Vec<String> = tool_ids.into_iter()
            .filter(|id| allowed.contains(id))
            .collect();

        if activated.is_empty() {
            return Ok((true, Vec::new()));
        }

        // Upsert session and persist activated tools in metadata
        let existing: Option<(String, Option<String>)> = conn.query_row(
            "SELECT id, metadata FROM agent_sessions WHERE id = ?1",
            params![&session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).ok();

        let mut metadata = existing.as_ref()
            .and_then(|(_, m)| m.as_ref())
            .and_then(|m| serde_json::from_str::<Value>(m).ok())
            .unwrap_or(json!({}));

        let existing_active = metadata.get("toolSnapshot")
            .and_then(|v| v.get("activeToolNames"))
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>())
            .unwrap_or_default();

        let merged: Vec<String> = existing_active.into_iter()
            .chain(activated.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        metadata["toolSnapshot"] = json!({
            "activeToolNames": merged.clone(),
            "discoveredToolIds": metadata.get("toolSnapshot").and_then(|v| v.get("discoveredToolIds")).cloned()
                .unwrap_or(json!(merged.clone())),
            "sessionPolicies": metadata.get("toolSnapshot").and_then(|v| v.get("sessionPolicies")).cloned()
                .unwrap_or(json!({})),
        });
        metadata["deferredToolIds"] = json!(merged);
        metadata["deferredToolsUpdatedAt"] = json!(chrono::Utc::now().to_rfc3339());

        if existing.is_some() {
            conn.execute(
                "UPDATE agent_sessions SET metadata = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                params![metadata.to_string(), &session_id],
            )?;
        } else {
            let agent_name = agent.name;
            let runtime_model = agent.model;
            conn.execute(
                "INSERT INTO agent_sessions (id, name, agent_id, agent_name, runtime_model, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    metadata = excluded.metadata,
                    updated_at = CURRENT_TIMESTAMP",
                params![&session_id, &format!("{} remote session", agent_name), &model_id, &agent_name, &runtime_model, metadata.to_string()],
            )?;
        }

        Ok::<_, rusqlite::Error>((true, merged))
    }).await;

    match result {
        Ok(Ok((found, activated))) => {
            if !found {
                return (StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response();
            }
            Json(json!({
                "success": true,
                "sessionId": session_id_resp,
                "model": model_id_resp,
                "activatedToolIds": activated,
            })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error activating tools: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ─── GET /agents/v1/responses/:id ─────────────────────────────────────────────

async fn get_response(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(response_id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;
    let response_id_for_db = response_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Find assistant message with matching response_id in metadata
        // Since SQLite doesn't support JSON path queries natively, we do a LIKE search
        let pattern = format!("%\"response_id\":\"{}\"%", response_id_for_db);
        let row: Option<(String, String, String, String)> = conn.query_row(
            "SELECT cm.id, cm.content, cm.metadata, c.id as conversation_id
             FROM conversation_messages cm
             JOIN conversations c ON cm.conversation_id = c.id
             WHERE cm.role = 'assistant' AND cm.metadata LIKE ?1 AND c.user_id = ?2
             ORDER BY cm.created_at DESC LIMIT 1",
            params![&pattern, &user_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        ).ok();

        Ok::<_, rusqlite::Error>(row)
    }).await;

    match result {
        Ok(Ok(Some((_, content, metadata, conversation_id)))) => {
            let meta: Value = serde_json::from_str(&metadata).unwrap_or(json!({}));
            let model_id = meta.get("model").and_then(|v| v.as_str()).unwrap_or("unknown");

            Json(json!({
                "id": response_id,
                "object": "response",
                "created_at": chrono::Utc::now().timestamp(),
                "status": "completed",
                "model": model_id,
                "output_text": content,
                "output": [
                    {
                        "id": format!("msg_{}", response_id),
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": [
                            {
                                "type": "output_text",
                                "text": content,
                                "annotations": [],
                                "logprobs": [],
                            }
                        ],
                    }
                ],
                "allternit": {
                    "conversation_id": conversation_id,
                    "agent_profile": null,
                    "artifacts": [],
                },
            })).into_response()
        }
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Response not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error getting response: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}




async fn agents_v1_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "agents-v1",
    }))
}
