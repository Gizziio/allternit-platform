//! Agent Operations routes: evaluations, autonomous factory tasks, and GC agents.

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
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
        Err(e) => return db_error("find evaluation", e),
    };
    if !exists {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Evaluation not found"})),
        );
    }

    // No evaluation engine exists yet: record an honest empty run (zero tests, no results).
    let now = chrono::Utc::now().to_rfc3339();
    let run_id = uuid::Uuid::new_v4().to_string();
    let details = json!([]);
    if let Err(e) = conn.execute("INSERT INTO agent_evaluation_runs(id,evaluation_id,user_id,status,score,total,passed,failed,skipped,duration_ms,details,created_at) VALUES(?1,?2,?3,'completed',0,0,0,0,0,0,?4,?5)", params![run_id,id,user.user_id,details.to_string(),now]) {
        return db_error("persist evaluation run", e);
    }
    if let Err(e) = conn.execute(
        "UPDATE agent_evaluations SET status='completed',score=0,last_run=?1 WHERE id=?2",
        params![now, id],
    ) {
        return db_error("update evaluation", e);
    }
    (
        StatusCode::OK,
        Json(
            json!({"runId": run_id, "evaluationId": id, "status": "completed", "summary": {"total": 0, "passed": 0, "failed": 0, "skipped": 0}, "duration": 0, "details": details}),
        ),
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
) -> impl IntoResponse {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let mut stmt = match conn
        .prepare("SELECT id,name,enabled,threshold,description FROM gc_policies ORDER BY rowid")
    {
        Ok(s) => s,
        Err(e) => return db_error("gc policies prepare", e),
    };
    let rows=match stmt.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"enabled":r.get::<_,bool>(2)?,"threshold":r.get::<_,f64>(3)?,"description":r.get::<_,Option<String>>(4)?}))){Ok(v)=>v,Err(e)=>return db_error("gc policies query",e)};
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
    Json(body): Json<UpdateGcPolicyRequest>,
) -> impl IntoResponse {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
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
    let changed=match conn.execute("UPDATE gc_policies SET enabled=COALESCE(?1,enabled),threshold=COALESCE(?2,threshold) WHERE id=?3",params![body.enabled,body.threshold,id]){Ok(n)=>n,Err(e)=>return db_error("update gc policy",e)};
    if changed == 0 {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error":"GC policy not found"})),
        );
    }
    let policy=match conn.query_row("SELECT id,name,enabled,threshold,description FROM gc_policies WHERE id=?1",params![id],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"enabled":r.get::<_,bool>(2)?,"threshold":r.get::<_,f64>(3)?,"description":r.get::<_,Option<String>>(4)?}))){Ok(v)=>v,Err(e)=>return db_error("read gc policy",e)};
    (StatusCode::OK, Json(json!({"policy":policy})))
}

async fn gc_queue(
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
    let mut queue = Vec::new();
    for agent in GC_AGENTS {
        let last:i64=conn.query_row("SELECT COALESCE(MAX(issues_found-issues_fixed),0) FROM gc_runs WHERE user_id=?1 AND agent_name=?2",params![user.user_id,agent],|r|r.get(0)).unwrap_or(0);
        if last > 0 {
            queue.push(json!({"id":format!("queue-{}",agent),"agent":agent,"items":last,"priority":if last>=5{"high"}else if last>=2{"medium"}else{"low"},"status":"pending"}));
        }
    }
    (StatusCode::OK, Json(json!({"queue":queue})))
}

fn execute_gc(conn: &Connection, user_id: &str, agent: &str) -> Result<Value, rusqlite::Error> {
    // No GC analysis engine exists yet: record an honest empty run (no issues found or fixed).
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    let issues: Vec<Value> = Vec::new();
    conn.execute("INSERT INTO gc_runs(id,user_id,agent_name,agents_run,issues_found,issues_fixed,entropy_reduction,issues,executed_at) VALUES(?1,?2,?3,1,0,0,0.0,?4,?5)",params![id,user_id,agent,json!(issues).to_string(),now])?;
    Ok(
        json!({"runId":id,"agentName":agent,"executedAt":now,"issuesFound":issues,"issuesFixed":0,"entropyReduction":0.0,"metadata":{}}),
    )
}

async fn run_gc_agent(
    State(state): State<Arc<AppState>>,
    Path(agent): Path<String>,
    Extension(_): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
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
    match execute_gc(&conn, &user.user_id, &agent) {
        Ok(v) => (StatusCode::OK, Json(v)),
        Err(e) => db_error("run gc agent", e),
    }
}

async fn gc_cleanup(
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
    let mut stmt = match conn.prepare("SELECT id FROM gc_policies WHERE enabled=1 ORDER BY rowid") {
        Ok(s) => s,
        Err(e) => return db_error("enabled gc policies", e),
    };
    let agents: Vec<String> = match stmt.query_map([], |r| r.get(0)) {
        Ok(rows) => rows.filter_map(Result::ok).collect(),
        Err(e) => return db_error("enabled gc policies query", e),
    };
    drop(stmt);
    let mut found = 0;
    let mut fixed = 0;
    let mut reduction = 0.0;
    let mut results = Vec::new();
    for agent in &agents {
        match execute_gc(&conn, &user.user_id, agent) {
            Ok(v) => {
                found += v["issuesFound"].as_array().map_or(0, |a| a.len()) as i64;
                fixed += v["issuesFixed"].as_i64().unwrap_or(0);
                reduction += v["entropyReduction"].as_f64().unwrap_or(0.0);
                results.push(v)
            }
            Err(e) => return db_error("full gc cleanup", e),
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
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return unauthorized(),
    };
    let conn = match connect(&state) {
        Ok(c) => c,
        Err(r) => return r,
    };
    let mut stmt=match conn.prepare("SELECT substr(executed_at,1,10),COUNT(*),SUM(issues_found),SUM(issues_fixed),SUM(entropy_reduction),MIN(id) FROM gc_runs WHERE user_id=?1 GROUP BY substr(executed_at,1,10) ORDER BY executed_at DESC LIMIT 30"){Ok(s)=>s,Err(e)=>return db_error("gc history prepare",e)};
    let rows=match stmt.query_map(params![user.user_id],|r|Ok(json!({"date":r.get::<_,String>(0)?,"agentsRun":r.get::<_,i64>(1)?,"issuesFound":r.get::<_,i64>(2)?,"issuesFixed":r.get::<_,i64>(3)?,"entropyReduction":r.get::<_,f64>(4)?,"runId":r.get::<_,String>(5)?}))){Ok(v)=>v,Err(e)=>return db_error("gc history query",e)};
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
