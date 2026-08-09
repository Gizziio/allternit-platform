//! Outcome rubric management and scoring
//!
//! Organization-scoped rubrics define reusable criteria for evaluating agent
//! runs. Scores can be recorded against a rubric for a specific run or session.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/outcome-rubrics", post(create_rubric).get(list_rubrics))
        .route(
            "/admin/outcome-rubrics/:id",
            get(get_rubric).put(update_rubric).delete(delete_rubric),
        )
        .route("/admin/outcome-rubrics/:id/scores", post(score_rubric).get(list_scores))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "outcome rubric operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn admin_org(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = user.organization_id.as_deref().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })?;
    if !crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage outcome rubrics.",
        ));
    }
    Ok(org.to_string())
}

fn validate_name(name: &str) -> Result<(), ApiError> {
    if name.trim().is_empty() || name.len() > 128 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Name must be 1-128 characters.",
        ));
    }
    Ok(())
}

fn validate_criteria(criteria: &[Criterion]) -> Result<(), ApiError> {
    if criteria.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_criteria",
            "At least one criterion is required.",
        ));
    }
    for c in criteria {
        if c.id.trim().is_empty() || c.name.trim().is_empty() {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_criterion",
                "Each criterion must have a non-empty id and name.",
            ));
        }
        match c.scoring_type.as_str() {
            "pass_fail" | "numeric" | "scale" => {}
            _ => {
                return Err(error(
                    StatusCode::BAD_REQUEST,
                    "invalid_scoring_type",
                    "Scoring type must be one of: pass_fail, numeric, scale.",
                ));
            }
        }
    }
    Ok(())
}

fn rubric_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let criteria: Value = serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(json!([]));
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "organization_id": row.get::<_, String>(1)?,
        "name": row.get::<_, String>(2)?,
        "description": row.get::<_, Option<String>>(3)?,
        "criteria": criteria,
        "created_by": row.get::<_, String>(5)?,
        "created_at": row.get::<_, String>(6)?,
        "updated_at": row.get::<_, String>(7)?,
    }))
}

fn find_rubric(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, organization_id, name, description, criteria, created_by,
                created_at, updated_at
         FROM outcome_rubrics
         WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        rubric_json,
    )
    .optional()
    .map_err(internal)?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "rubric_not_found", "No such outcome rubric."))
}

#[derive(Deserialize, Serialize, Clone)]
struct Criterion {
    id: String,
    name: String,
    description: Option<String>,
    scoring_type: String,
    weight: Option<f64>,
}

#[derive(Deserialize)]
struct CreateRubric {
    name: String,
    description: Option<String>,
    criteria: Vec<Criterion>,
}

async fn create_rubric(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateRubric>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    validate_name(&body.name)?;
    validate_criteria(&body.criteria)?;

    let id = uuid::Uuid::new_v4().to_string();
    let criteria_json = serde_json::to_string(&body.criteria).map_err(internal)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO outcome_rubrics
         (id, organization_id, name, description, criteria, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            org,
            body.name.trim(),
            body.description.as_deref().map(str::trim),
            criteria_json,
            user.user_id,
            now,
            now,
        ],
    )
    .map_err(internal)?;

    let rubric = find_rubric(&conn, &id, &org)?;
    Ok::<Response, ApiError>((StatusCode::CREATED, Json(rubric)).into_response())
}

async fn list_rubrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, organization_id, name, description, criteria, created_by,
                    created_at, updated_at
             FROM outcome_rubrics
             WHERE organization_id = ?1
             ORDER BY updated_at DESC",
        )
        .map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![org], rubric_json)
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

async fn get_rubric(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;
    let rubric = find_rubric(&conn, &id, &org)?;
    Ok::<Json<Value>, ApiError>(Json(rubric))
}

#[derive(Deserialize)]
struct UpdateRubric {
    name: Option<String>,
    description: Option<String>,
    criteria: Option<Vec<Criterion>>,
}

async fn update_rubric(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRubric>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;

    let _ = find_rubric(&conn, &id, &org)?;

    if let Some(ref name) = body.name {
        validate_name(name)?;
    }
    if let Some(ref criteria) = body.criteria {
        validate_criteria(criteria)?;
    }

    let criteria_json = body
        .criteria
        .as_ref()
        .map(|c| serde_json::to_string(c).map_err(internal))
        .transpose()?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE outcome_rubrics SET
            name = COALESCE(?1, name),
            description = COALESCE(?2, description),
            criteria = COALESCE(?3, criteria),
            updated_at = ?4
         WHERE id = ?5 AND organization_id = ?6",
        params![
            body.name.as_deref().map(str::trim),
            body.description.as_deref().map(str::trim),
            criteria_json,
            now,
            id,
            org,
        ],
    )
    .map_err(internal)?;

    let rubric = find_rubric(&conn, &id, &org)?;
    Ok::<Json<Value>, ApiError>(Json(rubric))
}

async fn delete_rubric(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;

    let rows = conn
        .execute(
            "DELETE FROM outcome_rubrics WHERE id = ?1 AND organization_id = ?2",
            params![id, org],
        )
        .map_err(internal)?;

    if rows == 0 {
        return Err(error(StatusCode::NOT_FOUND, "rubric_not_found", "No such outcome rubric."));
    }

    Ok::<Json<Value>, ApiError>(Json(json!({ "deleted": true })))
}

#[derive(Deserialize, Serialize)]
struct CriterionScore {
    criterion_id: String,
    value: f64,
    comment: Option<String>,
}

#[derive(Deserialize)]
struct ScoreRubric {
    run_id: Option<String>,
    session_id: Option<String>,
    scores: Vec<CriterionScore>,
}

fn compute_total(criteria: &[Criterion], scores: &[CriterionScore]) -> Result<f64, ApiError> {
    let total_weight: f64 = criteria.iter().filter_map(|c| c.weight).sum();
    if total_weight == 0.0 {
        // Simple average when no weights are set.
        if scores.is_empty() {
            return Ok(0.0);
        }
        return Ok(scores.iter().map(|s| s.value).sum::<f64>() / scores.len() as f64);
    }

    let mut weighted = 0.0;
    for score in scores {
        let weight = criteria
            .iter()
            .find(|c| c.id == score.criterion_id)
            .and_then(|c| c.weight)
            .unwrap_or(1.0);
        weighted += score.value * weight;
    }
    Ok(weighted / total_weight)
}

async fn score_rubric(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<ScoreRubric>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;

    let rubric = find_rubric(&conn, &id, &org)?;
    let criteria: Vec<Criterion> =
        serde_json::from_value(rubric["criteria"].clone()).map_err(internal)?;

    let total = compute_total(&criteria, &body.scores)?;
    let score_id = uuid::Uuid::new_v4().to_string();
    let scores_json = serde_json::to_string(&body.scores).map_err(internal)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO outcome_rubric_scores
         (id, rubric_id, run_id, session_id, scores, total_score, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            score_id,
            id,
            body.run_id,
            body.session_id,
            scores_json,
            total,
            user.user_id,
            now,
        ],
    )
    .map_err(internal)?;

    Ok::<Response, ApiError>(
        (
            StatusCode::CREATED,
            Json(json!({
                "id": score_id,
                "rubric_id": id,
                "run_id": body.run_id,
                "session_id": body.session_id,
                "scores": body.scores,
                "total_score": total,
                "created_by": user.user_id,
                "created_at": now,
            })),
        )
            .into_response(),
    )
}

async fn list_scores(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let conn = state.db.connect().map_err(internal)?;
    let org = admin_org(&conn, &user)?;

    // Ensure rubric exists and belongs to org.
    let _ = find_rubric(&conn, &id, &org)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, rubric_id, run_id, session_id, scores, total_score, created_by, created_at
             FROM outcome_rubric_scores
             WHERE rubric_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(internal)?;
    let rows: Vec<Value> = stmt
        .query_map(params![id], |row| {
            let scores: Value = serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(json!([]));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "rubric_id": row.get::<_, String>(1)?,
                "run_id": row.get::<_, Option<String>>(2)?,
                "session_id": row.get::<_, Option<String>>(3)?,
                "scores": scores,
                "total_score": row.get::<_, f64>(5)?,
                "created_by": row.get::<_, String>(6)?,
                "created_at": row.get::<_, String>(7)?,
            }))
        })
        .map_err(internal)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(internal)?;

    Ok::<Json<Value>, ApiError>(Json(json!({ "items": rows })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::path::Path;
    use tower::ServiceExt;

    fn test_user(user_id: &str, org_id: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: Some("org:admin".to_string()),
            organization_slug: None,
        }
    }

    async fn test_app_state(temp: &Path) -> Arc<AppState> {
        let config = crate::AppConfig {
            company: Default::default(),
            user: Default::default(),
        };
        let db = crate::db::DbHandle::new(temp.join("test.db")).expect("test db");
        let conn = db.connect().expect("test db conn");
        for (org_id, user_id, role) in [
            ("org-1", "admin-1", "owner"),
            ("org-1", "member-1", "member"),
            ("org-2", "admin-2", "owner"),
        ] {
            conn.execute(
                "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
                params![org_id],
            )
            .unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
                params![user_id, format!("{}@test.local", user_id)],
            )
            .unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
                params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
            )
            .unwrap();
        }
        drop(conn);
        let auth_config = crate::auth::AuthConfig::from_app_config(&config);
        let jwks = crate::auth::JwksManager::new(&auth_config);
        let rails = crate::rails::RailsState::new(temp.join("rails"))
            .await
            .expect("test rails");
        Arc::new(AppState {
            config,
            db,
            data_dir: temp.to_path_buf(),
            jwks,
            auth_config,
            vm_driver: None,
            rails,
            vm_sessions: crate::vm_session_routes::new_vm_session_store(),
            cowork_scheduler: None,
            cowork_background: None,
            cowork_run_manager: None,
            webhook_secret: None,
            office_runtime: Arc::new(tokio::sync::RwLock::new(
                crate::office_routes::OfficeRuntimeFile::default(),
            )),
            office_cli_docs: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            office_cli_watches: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            office_cli_mcp_sessions: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            design_skill_cache: crate::design_connector_routes::DesignSkillCache::new(),
            terminal_sessions: crate::terminal_routes::TerminalSessionStore::new(),
            mcp_dispatcher: crate::mcp_dispatcher::McpDispatcher::new(),
            approval_store: Arc::new(crate::permission_policy::ApprovalStore::new()),
        })
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    fn json_body(value: &Value) -> Body {
        Body::from(value.to_string())
    }

    #[tokio::test]
    async fn rubric_crud_and_score_lifecycle() {
        let temp = tempfile::tempdir().unwrap().into_path();
        let state = test_app_state(&temp).await;
        let app = router().with_state(state);

        let create = json!({
            "name": "Code quality",
            "description": "Evaluates generated code quality",
            "criteria": [
                { "id": "correctness", "name": "Correctness", "scoring_type": "numeric", "weight": 2.0 },
                { "id": "style", "name": "Style", "scoring_type": "pass_fail", "weight": 1.0 }
            ]
        });

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/outcome-rubrics")
                    .header("content-type", "application/json")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(json_body(&create))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp.into_body()).await;
        let id = body["id"].as_str().unwrap().to_string();
        assert_eq!(body["name"], "Code quality");

        // Score
        let score = json!({
            "run_id": "run-1",
            "scores": [
                { "criterion_id": "correctness", "value": 4.0 },
                { "criterion_id": "style", "value": 1.0 }
            ]
        });
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(&format!("/admin/outcome-rubrics/{}/scores", id))
                    .header("content-type", "application/json")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(json_body(&score))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let score_body = body_json(resp.into_body()).await;
        // weighted average: (4*2 + 1*1) / (2+1) = 3.0
        assert_eq!(score_body["total_score"], 3.0);

        // List scores
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(&format!("/admin/outcome-rubrics/{}/scores", id))
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let list = body_json(resp.into_body()).await;
        assert_eq!(list["items"].as_array().unwrap().len(), 1);

        // Delete rubric
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(&format!("/admin/outcome-rubrics/{}", id))
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn rubric_rejects_invalid_criteria() {
        let temp = tempfile::tempdir().unwrap().into_path();
        let state = test_app_state(&temp).await;
        let app = router().with_state(state);

        let create = json!({
            "name": "Bad rubric",
            "criteria": [
                { "id": "c1", "name": "C1", "scoring_type": "invalid_type" }
            ]
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/outcome-rubrics")
                    .header("content-type", "application/json")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(json_body(&create))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn rubric_isolation_by_organization() {
        let temp = tempfile::tempdir().unwrap().into_path();
        let state = test_app_state(&temp).await;
        let app = router().with_state(state);

        let create = json!({
            "name": "org1 rubric",
            "criteria": [{ "id": "c1", "name": "C1", "scoring_type": "pass_fail" }]
        });
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/outcome-rubrics")
                    .header("content-type", "application/json")
                    .extension(test_user("admin-1", Some("org-1")))
                    .body(json_body(&create))
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = body_json(resp.into_body()).await;
        let id = body["id"].as_str().unwrap().to_string();

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(&format!("/admin/outcome-rubrics/{}", id))
                    .extension(test_user("admin-2", Some("org-2")))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
