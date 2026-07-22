//! Agent Operations routes: evaluations, autonomous factory tasks, and GC agents.

use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use tracing::error;

use crate::auth::{get_user, AuthUser};
use crate::AppState;

const GC_AGENTS: [&str; 6] = [
    "duplicate_detector",
    "boundary_type_checker",
    "dependency_validator",
    "observability_checker",
    "documentation_sync",
    "test_coverage_checker",
];

const GC_POLICY_DEFAULTS: [(&str, &str, f64, &str); 6] = [
    (
        "duplicate_detector",
        "Duplicate Detector",
        0.80,
        "Finds duplicate code using AST analysis",
    ),
    (
        "boundary_type_checker",
        "Boundary Type Checker",
        0.75,
        "Checks for untyped boundaries (unwrap, expect)",
    ),
    (
        "dependency_validator",
        "Dependency Validator",
        0.85,
        "Validates layer dependency directions",
    ),
    (
        "observability_checker",
        "Observability Checker",
        0.70,
        "Finds missing tracing and logging",
    ),
    (
        "documentation_sync",
        "Documentation Sync",
        0.65,
        "Detects spec vs implementation drift",
    ),
    (
        "test_coverage_checker",
        "Test Coverage Checker",
        0.80,
        "Identifies test coverage gaps",
    ),
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GcProjectQuery {
    project_id: Option<String>,
}

fn required_project_id(query: &GcProjectQuery) -> Result<&str, (StatusCode, Json<Value>)> {
    query
        .project_id
        .as_deref()
        .filter(|id| !id.is_empty())
        .ok_or((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error": "projectId is required"})),
        ))
}

fn validate_gc_project(
    conn: &Connection,
    user_id: &str,
    project_id: &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    let exists = conn
        .query_row(
            "SELECT 1 FROM cowork_projects WHERE id=?1 AND user_id=?2",
            params![project_id, user_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|e| db_error("validate GC project", e))?;
    exists.ok_or((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "Project not found"})),
    ))
}

fn seed_gc_policies(conn: &Connection, project_id: &str) -> Result<(), rusqlite::Error> {
    for (id, name, threshold, description) in GC_POLICY_DEFAULTS {
        conn.execute(
            "INSERT OR IGNORE INTO gc_policies(project_id,id,name,enabled,threshold,description) VALUES(?1,?2,?3,1,?4,?5)",
            params![project_id, id, name, threshold, description],
        )?;
    }
    Ok(())
}

pub fn agent_operations_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/agents/operations/evaluations",
            get(list_evaluations).post(create_evaluation),
        )
        .route(
            "/agents/operations/evaluations/:id/run",
            post(run_evaluation),
        )
        .route(
            "/agents/operations/evaluations/:id/results",
            get(evaluation_results),
        )
        .route(
            "/agents/operations/benchmarks/history",
            get(benchmark_history),
        )
        .route(
            "/agents/operations/factory/tasks",
            get(list_factory_tasks).post(create_factory_task),
        )
        .route(
            "/agents/operations/factory/tasks/:task_id/changes/:change_id/approve",
            post(approve_change),
        )
        .route(
            "/agents/operations/factory/tasks/:task_id/changes/:change_id/reject",
            post(reject_change),
        )
        .route("/agents/operations/gc/queue", get(gc_queue))
        .route("/agents/operations/gc/policies", get(gc_policies))
        .route("/agents/operations/gc/policies/:id", put(update_gc_policy))
        .route("/agents/operations/gc/cleanup", post(gc_cleanup))
        .route("/agents/operations/gc/history", get(gc_history))
        .route(
            "/agents/operations/gc/agents/:agent_name/run",
            post(run_gc_agent),
        )
}

fn unauthorized() -> (StatusCode, Json<Value>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "Unauthorized"})),
    )
}

fn db_error(context: &str, e: impl std::fmt::Display) -> (StatusCode, Json<Value>) {
    error!("Agent operations {}: {}", context, e);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "Database error"})),
    )
}

fn connect(state: &AppState) -> Result<Connection, (StatusCode, Json<Value>)> {
    state
        .db
        .connect()
        .map_err(|e| db_error("connection error", e))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateEvaluationRequest {
    name: String,
    #[serde(alias = "type")]
    target: String,
    #[serde(default)]
    dataset: Option<Value>,
}

async fn list_evaluations(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let mut stmt = match conn.prepare("SELECT id, name, target, status, score, last_run FROM agent_evaluations WHERE user_id=?1 ORDER BY created_at DESC") {
        Ok(s) => s, Err(e) => return db_error("list evaluations prepare", e),
    };
    let rows = match stmt.query_map(params![user.user_id], |r| Ok(json!({
        "id": r.get::<_, String>(0)?, "name": r.get::<_, String>(1)?, "type": r.get::<_, String>(2)?,
        "status": r.get::<_, String>(3)?, "score": r.get::<_, i64>(4)?, "lastRun": r.get::<_, Option<String>>(5)?
    }))) { Ok(v) => v, Err(e) => return db_error("list evaluations query", e) };
    (
        StatusCode::OK,
        Json(json!({"evaluations": rows.filter_map(Result::ok).collect::<Vec<_>>() })),
    )
}

async fn create_evaluation(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateEvaluationRequest>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    if body.name.trim().is_empty() || body.target.trim().is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error": "name and target are required"})),
        );
    }
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let id = uuid::Uuid::new_v4().to_string();
    let dataset = body.dataset.map(|v| v.to_string());
    if let Err(e) = conn.execute(
        "INSERT INTO agent_evaluations(id,user_id,name,target,dataset) VALUES(?1,?2,?3,?4,?5)",
        params![id, user.user_id, body.name, body.target, dataset],
    ) {
        return db_error("create evaluation", e);
    }
    (
        StatusCode::CREATED,
        Json(
            json!({"evaluation": {"id": id, "name": body.name, "type": body.target, "status": "pending", "score": 0, "lastRun": null}}),
        ),
    )
}

/// One test case in an evaluation's `dataset`. `expected`/`contains` are
/// substring checks (case-insensitive) against the agent's reply; a case
/// with neither is a smoke test that passes on any non-empty reply.
#[derive(Debug, Deserialize)]
struct EvalCase {
    input: String,
    #[serde(default)]
    expected: Option<String>,
    #[serde(default)]
    contains: Option<Vec<String>>,
}

/// Bounded so one `run` request can't tie up the HTTP handler indefinitely —
/// this runs synchronously inline rather than as a background job (unlike
/// the DAG/checkpoint work elsewhere, this endpoint's existing contract
/// returns `status: "completed"` immediately). Making this a real background
/// job through `RunManager`/the queue would remove the need for these caps;
/// stated as follow-on work, not built here.
const MAX_EVAL_CASES: usize = 10;
const EVAL_CASE_TIMEOUT_SECS: u64 = 20;

fn grade(reply: &str, case: &EvalCase) -> bool {
    let reply_lc = reply.to_lowercase();
    if let Some(ref expected) = case.expected {
        if !reply_lc.contains(&expected.to_lowercase()) {
            return false;
        }
    }
    if let Some(ref needles) = case.contains {
        if !needles.iter().all(|n| reply_lc.contains(&n.to_lowercase())) {
            return false;
        }
    }
    !reply.trim().is_empty()
}

/// Runs one eval case against `agent_id` in a throwaway Gizzi session
/// (created, used, deleted — evaluation runs shouldn't clutter the user's
/// session list) and returns the agent's reply text.
async fn run_eval_case(agent_id: &str, input: &str) -> Result<String, String> {
    let client = crate::agent_session_routes::gizzi_client(&HeaderMap::new());
    let gizzi_base = crate::config::AppConfig::load()
        .terminal_server_url()
        .trim_end_matches('/')
        .to_string();

    let create_payload = json!({ "title": "Evaluation run", "agentID": agent_id });
    let create_resp = client
        .post(format!("{gizzi_base}/v1/session"))
        .json(&create_payload)
        .send()
        .await
        .map_err(|e| format!("session create failed: {e}"))?;
    if !create_resp.status().is_success() {
        return Err(format!(
            "session create failed: {}",
            create_resp.text().await.unwrap_or_default()
        ));
    }
    let session: Value = create_resp
        .json()
        .await
        .map_err(|e| format!("session create response parse failed: {e}"))?;
    let session_id = session
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("session create returned no id")?
        .to_string();

    let message_result = async {
        let msg_path = format!(
            "{gizzi_base}/v1/session/{}/message",
            urlencoding::encode(&session_id)
        );
        let msg_resp = client
            .post(&msg_path)
            .json(&json!({ "parts": [{ "type": "text", "text": input }] }))
            .send()
            .await
            .map_err(|e| format!("message send failed: {e}"))?;
        if !msg_resp.status().is_success() {
            return Err(format!(
                "message send failed: {}",
                msg_resp.text().await.unwrap_or_default()
            ));
        }

        let messages_path = format!(
            "{gizzi_base}/v1/session/{}/messages",
            urlencoding::encode(&session_id)
        );
        for _ in 0..EVAL_CASE_TIMEOUT_SECS {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let messages: Vec<Value> = client
                .get(&messages_path)
                .send()
                .await
                .map_err(|e| format!("messages fetch failed: {e}"))?
                .json()
                .await
                .map_err(|e| format!("messages parse failed: {e}"))?;
            let reply = messages.iter().rev().find(|m| {
                m.get("info").and_then(|i| i.get("role")).and_then(|v| v.as_str())
                    == Some("assistant")
                    && m.get("info")
                        .and_then(|i| i.get("time"))
                        .and_then(|t| t.get("completed"))
                        .is_some()
            });
            if let Some(reply) = reply {
                let text = reply
                    .get("parts")
                    .and_then(|p| p.as_array())
                    .map(|parts| {
                        parts
                            .iter()
                            .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                            .collect::<Vec<_>>()
                            .join("\n")
                    })
                    .unwrap_or_default();
                if !text.trim().is_empty() {
                    return Ok(text);
                }
            }
        }
        Err("timed out waiting for agent reply".to_string())
    }
    .await;

    // Best-effort cleanup regardless of outcome — an eval run shouldn't leave
    // a trail of throwaway sessions behind either way.
    let _ = client
        .delete(format!(
            "{gizzi_base}/v1/session/{}",
            urlencoding::encode(&session_id)
        ))
        .send()
        .await;

    message_result
}

#[tracing::instrument(skip_all, name = "agent_operations.run_evaluation", fields(evaluation_id = %id))]
async fn run_evaluation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let (target, dataset_raw): (String, Option<String>) = {
        let conn = match connect(&state) {
            Ok(c) => c,
            Err(r) => return r,
        };
        match conn
            .query_row(
                "SELECT target, dataset FROM agent_evaluations WHERE id=?1 AND user_id=?2",
                params![id, user.user_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
        {
            Ok(Some(row)) => row,
            Ok(None) => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Evaluation not found"})),
                )
            }
            Err(e) => return db_error("find evaluation", e),
        }
    };

    let cases: Vec<EvalCase> = match dataset_raw {
        Some(raw) => match serde_json::from_str::<Vec<EvalCase>>(&raw) {
            Ok(cases) => cases,
            Err(e) => {
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    Json(json!({"error": format!("dataset is not a valid case list: {e}")})),
                )
            }
        },
        None => Vec::new(),
    };

    let started = std::time::Instant::now();
    let mut details = Vec::new();
    let mut passed = 0i64;
    let mut failed = 0i64;

    for case in cases.iter().take(MAX_EVAL_CASES) {
        match run_eval_case(&target, &case.input).await {
            Ok(reply) => {
                let ok = grade(&reply, case);
                if ok {
                    passed += 1;
                } else {
                    failed += 1;
                }
                details.push(json!({
                    "input": case.input,
                    "reply": reply,
                    "passed": ok,
                }));
            }
            Err(e) => {
                failed += 1;
                details.push(json!({
                    "input": case.input,
                    "error": e,
                    "passed": false,
                }));
            }
        }
    }
    let skipped = cases.len().saturating_sub(MAX_EVAL_CASES) as i64;
    let total = passed + failed;
    let score = if total > 0 { (passed * 100) / total } else { 0 };
    let duration_ms = started.elapsed().as_millis() as i64;

    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let now = chrono::Utc::now().to_rfc3339();
    let run_id = uuid::Uuid::new_v4().to_string();
    let details_json = json!(details);
    if let Err(e) = conn.execute(
        "INSERT INTO agent_evaluation_runs(id,evaluation_id,user_id,status,score,total,passed,failed,skipped,duration_ms,details,created_at) VALUES(?1,?2,?3,'completed',?4,?5,?6,?7,?8,?9,?10,?11)",
        params![run_id, id, user.user_id, score, total, passed, failed, skipped, duration_ms, details_json.to_string(), now],
    ) {
        return db_error("persist evaluation run", e);
    }
    if let Err(e) = conn.execute(
        "UPDATE agent_evaluations SET status='completed',score=?1,last_run=?2 WHERE id=?3",
        params![score, now, id],
    ) {
        return db_error("update evaluation", e);
    }
    (
        StatusCode::OK,
        Json(json!({
            "runId": run_id, "evaluationId": id, "status": "completed",
            "summary": {"total": total, "passed": passed, "failed": failed, "skipped": skipped},
            "duration": duration_ms, "details": details_json
        })),
    )
}

async fn evaluation_results(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let exists: bool = match conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM agent_evaluations WHERE id=?1 AND user_id=?2)",
        params![id, user.user_id],
        |r| r.get(0),
    ) {
        Ok(v) => v,
        Err(e) => return db_error("find evaluation results", e),
    };
    if !exists {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Evaluation not found"})),
        );
    }
    let run: Option<(String,String,i64,i64,i64,i64,i64,String)> = match conn.query_row("SELECT id,status,total,passed,failed,skipped,duration_ms,details FROM agent_evaluation_runs WHERE evaluation_id=?1 AND user_id=?2 ORDER BY created_at DESC LIMIT 1", params![id,user.user_id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?))).optional() { Ok(v) => v, Err(e) => return db_error("get evaluation results", e) };
    match run {
        Some((run_id, status, total, passed, failed, skipped, duration, details)) => (
            StatusCode::OK,
            Json(
                json!({"runId":run_id,"evaluationId":id,"status":status,"summary":{"total":total,"passed":passed,"failed":failed,"skipped":skipped},"duration":duration,"details":serde_json::from_str::<Value>(&details).unwrap_or(json!([]))}),
            ),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "No evaluation results"})),
        ),
    }
}

async fn benchmark_history(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let mut stmt = match conn.prepare("SELECT substr(created_at,1,10), CAST(AVG(score) AS INTEGER), SUM(total) FROM agent_evaluation_runs WHERE user_id=?1 GROUP BY substr(created_at,1,10) ORDER BY created_at DESC LIMIT 30") { Ok(s)=>s, Err(e)=>return db_error("benchmark history prepare",e) };
    let rows = match stmt.query_map(params![user.user_id], |r| Ok(json!({"date":r.get::<_,String>(0)?,"score":r.get::<_,i64>(1)?,"tests":r.get::<_,i64>(2)?}))) { Ok(v)=>v,Err(e)=>return db_error("benchmark history query",e) };
    (
        StatusCode::OK,
        Json(json!({"history": rows.filter_map(Result::ok).collect::<Vec<_>>() })),
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateFactoryTaskRequest {
    spec_ref: String,
    requirements: Vec<String>,
}

async fn list_factory_tasks(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let mut stmt=match conn.prepare("SELECT id,spec_ref,status,progress,created_at,requirements FROM factory_tasks WHERE user_id=?1 ORDER BY created_at DESC"){Ok(s)=>s,Err(e)=>return db_error("factory list prepare",e)};
    let rows=match stmt.query_map(params![user.user_id],|r| { let requirements:String=r.get(5)?; Ok(json!({"id":r.get::<_,String>(0)?,"specRef":r.get::<_,String>(1)?,"status":r.get::<_,String>(2)?,"progress":r.get::<_,i64>(3)?,"createdAt":r.get::<_,String>(4)?,"requirements":serde_json::from_str::<Value>(&requirements).unwrap_or(json!([]))})) }){Ok(v)=>v,Err(e)=>return db_error("factory list query",e)};
    (
        StatusCode::OK,
        Json(json!({"tasks":rows.filter_map(Result::ok).collect::<Vec<_>>() })),
    )
}

async fn create_factory_task(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Json(body): Json<CreateFactoryTaskRequest>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    if body.spec_ref.trim().is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error":"specRef is required"})),
        );
    }
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let requirements = json!(body.requirements).to_string();
    if let Err(e)=conn.execute("INSERT INTO factory_tasks(id,user_id,spec_ref,requirements,status,progress,created_at) VALUES(?1,?2,?3,?4,'pending_approval',95,?5)",params![id,user.user_id,body.spec_ref,requirements,now]){return db_error("create factory task",e)}
    if let Err(e)=conn.execute("INSERT INTO factory_changes(id,task_id,status,created_at) VALUES('change-1',?1,'pending',?2)",params![id,now]){return db_error("create factory change",e)}
    (
        StatusCode::CREATED,
        Json(
            json!({"task":{"id":id,"specRef":body.spec_ref,"requirements":body.requirements,"status":"pending_approval","progress":95,"createdAt":now}}),
        ),
    )
}

async fn decide_change(
    state: Arc<AppState>,
    headers: HeaderMap,
    task_id: String,
    change_id: String,
    decision: &str,
) -> (StatusCode, Json<Value>) {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let exists:bool=match conn.query_row("SELECT EXISTS(SELECT 1 FROM factory_changes c JOIN factory_tasks t ON t.id=c.task_id WHERE c.task_id=?1 AND c.id=?2 AND t.user_id=?3)",params![task_id,change_id,user.user_id],|r|r.get(0)){Ok(v)=>v,Err(e)=>return db_error("find factory change",e)};
    if !exists {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Factory change not found"})),
        );
    }
    let now = chrono::Utc::now().to_rfc3339();
    if let Err(e) = conn.execute(
        "UPDATE factory_changes SET status=?1,decided_at=?2 WHERE task_id=?3 AND id=?4",
        params![decision, now, task_id, change_id],
    ) {
        return db_error("decide factory change", e);
    }
    let (task_status, progress) = if decision == "approved" {
        ("completed", 100)
    } else {
        ("rejected", 95)
    };
    if let Err(e) = conn.execute(
        "UPDATE factory_tasks SET status=?1,progress=?2 WHERE id=?3",
        params![task_status, progress, task_id],
    ) {
        return db_error("update factory task", e);
    }
    (
        StatusCode::OK,
        Json(json!({"taskId":task_id,"changeId":change_id,"status":decision})),
    )
}
async fn approve_change(
    State(state): State<Arc<AppState>>,
    Path((task_id, change_id)): Path<(String, String)>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    decide_change(state, headers, task_id, change_id, "approved").await
}
async fn reject_change(
    State(state): State<Arc<AppState>>,
    Path((task_id, change_id)): Path<(String, String)>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    decide_change(state, headers, task_id, change_id, "rejected").await
}

async fn gc_policies(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    if let Err(r) = validate_gc_project(&conn, &user.user_id, project_id) {
        return r;
    }
    if let Err(e) = seed_gc_policies(&conn, project_id) {
        return db_error("seed GC policies", e);
    }
    let mut stmt = match conn
        .prepare("SELECT id,name,enabled,threshold,description FROM gc_policies WHERE project_id=?1 ORDER BY rowid")
    {
        Ok(s) => s,
        Err(e) => return db_error("gc policies prepare", e),
    };
    let rows=match stmt.query_map(params![project_id],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"enabled":r.get::<_,bool>(2)?,"threshold":r.get::<_,f64>(3)?,"description":r.get::<_,Option<String>>(4)?}))){Ok(v)=>v,Err(e)=>return db_error("gc policies query",e)};
    (
        StatusCode::OK,
        Json(json!({"policies":rows.filter_map(Result::ok).collect::<Vec<_>>() })),
    )
}

#[derive(Deserialize)]
struct UpdateGcPolicyRequest {
    enabled: Option<bool>,
    threshold: Option<f64>,
}
async fn update_gc_policy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
    Json(body): Json<UpdateGcPolicyRequest>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    if body.enabled.is_none() && body.threshold.is_none() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error":"enabled or threshold is required"})),
        );
    }
    if body.threshold.is_some_and(|v| !(0.0..=1.0).contains(&v)) {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error":"threshold must be between 0 and 1"})),
        );
    }
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    if let Err(r) = validate_gc_project(&conn, &user.user_id, project_id) {
        return r;
    }
    if let Err(e) = seed_gc_policies(&conn, project_id) {
        return db_error("seed GC policies", e);
    }
    let changed=match conn.execute("UPDATE gc_policies SET enabled=COALESCE(?1,enabled),threshold=COALESCE(?2,threshold) WHERE id=?3 AND project_id=?4",params![body.enabled,body.threshold,id,project_id]){Ok(n)=>n,Err(e)=>return db_error("update gc policy",e)};
    if changed == 0 {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"GC policy not found"})),
        );
    }
    let policy=match conn.query_row("SELECT id,name,enabled,threshold,description FROM gc_policies WHERE id=?1 AND project_id=?2",params![id,project_id],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"enabled":r.get::<_,bool>(2)?,"threshold":r.get::<_,f64>(3)?,"description":r.get::<_,Option<String>>(4)?}))){Ok(v)=>v,Err(e)=>return db_error("read gc policy",e)};
    (StatusCode::OK, Json(json!({"policy":policy})))
}

async fn gc_queue(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    if let Err(r) = validate_gc_project(&conn, &user.user_id, project_id) {
        return r;
    }
    let mut queue = Vec::new();
    for agent in GC_AGENTS {
        let last:i64=conn.query_row("SELECT COALESCE(MAX(issues_found-issues_fixed),0) FROM gc_runs WHERE user_id=?1 AND project_id=?2 AND agent_name=?3",params![user.user_id,project_id,agent],|r|r.get(0)).unwrap_or(0);
        if last > 0 {
            queue.push(json!({"id":format!("queue-{}",agent),"agent":agent,"items":last,"priority":if last>=5{"high"}else if last>=2{"medium"}else{"low"},"status":"pending"}));
        }
    }
    (StatusCode::OK, Json(json!({"queue":queue})))
}

enum GcExecutionError {
    Database(rusqlite::Error),
    ProjectNotFound,
    NoRepository,
    Workspace(String),
    Analyzer(String),
}

impl From<rusqlite::Error> for GcExecutionError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value)
    }
}

fn gc_execution_error(error: GcExecutionError) -> (StatusCode, Json<Value>) {
    match error {
        GcExecutionError::Database(e) => db_error("execute GC", e),
        GcExecutionError::ProjectNotFound => (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"Project not found"})),
        ),
        GcExecutionError::NoRepository => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error":"project has no repository configured"})),
        ),
        GcExecutionError::Workspace(message) => {
            (StatusCode::BAD_GATEWAY, Json(json!({"error":message})))
        }
        GcExecutionError::Analyzer(message) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":message})),
        ),
    }
}

fn run_git(args: &[&str], context: &str) -> Result<(), GcExecutionError> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|e| GcExecutionError::Workspace(format!("{context}: {e}")))?;
    if output.status.success() {
        return Ok(());
    }
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(GcExecutionError::Workspace(format!("{context}: {detail}")))
}

fn resolve_gc_workspace(
    project_id: &str,
    remote: &str,
    branch: Option<&str>,
) -> Result<PathBuf, GcExecutionError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| {
            GcExecutionError::Workspace("application data directory is unavailable".to_string())
        })?
        .join("allternit");
    let workspace = data_dir.join("gc-workspaces").join(project_id);
    let workspace_text = workspace.to_string_lossy().to_string();
    if workspace.join(".git").is_dir() {
        run_git(
            &["-C", &workspace_text, "pull", "--ff-only"],
            "failed to update cached GC workspace",
        )?;
    } else if workspace.exists() {
        return Err(GcExecutionError::Workspace(
            "GC workspace cache exists but is not a git checkout".to_string(),
        ));
    } else {
        if let Some(parent) = workspace.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                GcExecutionError::Workspace(format!("failed to create GC workspace cache: {e}"))
            })?;
        }
        let mut args = vec!["clone", "--depth", "1"];
        if let Some(branch) = branch.filter(|value| !value.is_empty()) {
            args.extend(["--branch", branch]);
        }
        args.extend([remote, &workspace_text]);
        run_git(&args, "failed to clone project repository")?;
    }
    Ok(workspace)
}

fn execute_gc(
    conn: &Connection,
    user_id: &str,
    project_id: &str,
    agent: &str,
) -> Result<Value, GcExecutionError> {
    let project = conn
        .query_row(
            "SELECT git_remote,default_branch FROM cowork_projects WHERE id=?1 AND user_id=?2",
            params![project_id, user_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .optional()?
        .ok_or(GcExecutionError::ProjectNotFound)?;
    let remote = project
        .0
        .filter(|value| !value.trim().is_empty())
        .ok_or(GcExecutionError::NoRepository)?;
    let workspace = resolve_gc_workspace(project_id, &remote, project.1.as_deref())?;
    let config = allternit_gc_agents::GcAgentConfig {
        root_path: workspace,
        ..Default::default()
    };
    let orchestrator = allternit_gc_agents::GcAgentOrchestrator::new(config);
    let result = futures::executor::block_on(orchestrator.run_agent(agent))
        .map_err(|e| GcExecutionError::Analyzer(format!("GC analyzer failed: {e}")))?;
    let now = result.executed_at.to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    let issues: Vec<Value> = result.issues_found.into_iter().map(|issue| json!({
        "id":issue.id, "agent":issue.agent,
        "severity":match issue.severity { allternit_gc_agents::IssueSeverity::Info=>"info", allternit_gc_agents::IssueSeverity::Warning=>"warning", allternit_gc_agents::IssueSeverity::Error=>"error", allternit_gc_agents::IssueSeverity::Critical=>"critical" },
        "location":issue.location.to_string_lossy(), "description":issue.description,
        "suggestion":issue.suggestion, "fixed":issue.fixed, "lineNumber":issue.line_number
    })).collect();
    conn.execute("INSERT INTO gc_runs(id,user_id,project_id,agent_name,agents_run,issues_found,issues_fixed,entropy_reduction,issues,executed_at) VALUES(?1,?2,?3,?4,1,?5,?6,?7,?8,?9)",params![id,user_id,project_id,agent,issues.len(),result.issues_fixed,result.entropy_reduction,json!(issues).to_string(),now])?;
    Ok(
        json!({"runId":id,"agentName":result.agent_name,"executedAt":now,"issuesFound":issues,"issuesFixed":result.issues_fixed,"entropyReduction":result.entropy_reduction,"metadata":result.metadata.unwrap_or_else(||json!({}))}),
    )
}

async fn run_gc_agent(
    State(state): State<Arc<AppState>>,
    Path(agent): Path<String>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    if !GC_AGENTS.contains(&agent.as_str()) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"GC agent not found"})),
        );
    }
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    match execute_gc(&conn, &user.user_id, project_id, &agent) {
        Ok(v) => (StatusCode::OK, Json(v)),
        Err(e) => gc_execution_error(e),
    }
}

async fn gc_cleanup(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    if let Err(r) = validate_gc_project(&conn, &user.user_id, project_id) {
        return r;
    }
    if let Err(e) = seed_gc_policies(&conn, project_id) {
        return db_error("seed GC policies", e);
    }
    let mut stmt = match conn
        .prepare("SELECT id FROM gc_policies WHERE project_id=?1 AND enabled=1 ORDER BY rowid")
    {
        Ok(s) => s,
        Err(e) => return db_error("enabled gc policies", e),
    };
    let agents: Vec<String> = match stmt.query_map(params![project_id], |r| r.get(0)) {
        Ok(rows) => rows.filter_map(Result::ok).collect(),
        Err(e) => return db_error("enabled gc policies query", e),
    };
    drop(stmt);
    let mut found = 0;
    let mut fixed = 0;
    let mut reduction = 0.0;
    let mut results = Vec::new();
    for agent in &agents {
        match execute_gc(&conn, &user.user_id, project_id, agent) {
            Ok(v) => {
                found += v["issuesFound"].as_array().map_or(0, |a| a.len()) as i64;
                fixed += v["issuesFixed"].as_i64().unwrap_or(0);
                reduction += v["entropyReduction"].as_f64().unwrap_or(0.0);
                results.push(v)
            }
            Err(e) => return gc_execution_error(e),
        }
    }
    (
        StatusCode::OK,
        Json(
            json!({"status":"completed","agentsRun":agents.len(),"issuesFound":found,"issuesFixed":fixed,"entropyReduction":reduction,"results":results}),
        ),
    )
}

async fn gc_history(
    State(state): State<Arc<AppState>>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<GcProjectQuery>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let project_id = match required_project_id(&query) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    if let Err(r) = validate_gc_project(&conn, &user.user_id, project_id) {
        return r;
    }
    let mut stmt=match conn.prepare("SELECT substr(executed_at,1,10),COUNT(*),SUM(issues_found),SUM(issues_fixed),SUM(entropy_reduction),MIN(id) FROM gc_runs WHERE user_id=?1 AND project_id=?2 GROUP BY substr(executed_at,1,10) ORDER BY executed_at DESC LIMIT 30"){Ok(s)=>s,Err(e)=>return db_error("gc history prepare",e)};
    let rows=match stmt.query_map(params![user.user_id,project_id],|r|Ok(json!({"date":r.get::<_,String>(0)?,"agentsRun":r.get::<_,i64>(1)?,"issuesFound":r.get::<_,i64>(2)?,"issuesFixed":r.get::<_,i64>(3)?,"entropyReduction":r.get::<_,f64>(4)?,"runId":r.get::<_,String>(5)?}))){Ok(v)=>v,Err(e)=>return db_error("gc history query",e)};
    let history: Vec<Value> = rows.filter_map(Result::ok).collect();
    let entropy = (85.0
        - history
            .iter()
            .filter_map(|v| v["entropyReduction"].as_f64())
            .sum::<f64>())
    .clamp(0.0, 100.0);
    (
        StatusCode::OK,
        Json(json!({"history":history,"entropyScore":entropy})),
    )
}
