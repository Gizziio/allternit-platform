//! Skills / task recipes.
//!
//! Users can save successful agent runs as reusable, parameterized templates.
//! Each skill stores the original goal pattern, default parameters, and a
//! replayable task recipe. The extension (or web UI) can list skills and
//! instantiate a new run by filling in the parameters.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn skills_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/skills", get(list_skills).post(create_skill))
        .route("/skills/:id", get(get_skill).post(update_skill).delete(delete_skill))
        .route("/skills/:id/run", post(run_skill))
}

type ApiError = (StatusCode, Json<serde_json::Value>);

fn err(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(e: impl std::fmt::Display) -> ApiError {
    err(
        StatusCode::INTERNAL_SERVER_ERROR,
        "skills_error",
        e.to_string(),
    )
}

#[derive(Debug, Serialize)]
struct Skill {
    id: String,
    user_id: String,
    organization_id: Option<String>,
    name: String,
    description: Option<String>,
    goal_template: String,
    parameters: serde_json::Value,
    allowed_sites: Option<serde_json::Value>,
    run_count: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateSkillRequest {
    name: String,
    description: Option<String>,
    goal_template: String,
    parameters: Option<serde_json::Value>,
    allowed_sites: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct UpdateSkillRequest {
    name: Option<String>,
    description: Option<String>,
    goal_template: Option<String>,
    parameters: Option<serde_json::Value>,
    allowed_sites: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct RunSkillRequest {
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ListSkillsQuery {
    search: Option<String>,
}

fn row_to_skill(row: &rusqlite::Row<'_>) -> rusqlite::Result<Skill> {
    Ok(Skill {
        id: row.get(0)?,
        user_id: row.get(1)?,
        organization_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        goal_template: row.get(5)?,
        parameters: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or(serde_json::Value::Null),
        allowed_sites: row.get::<_, Option<String>>(7)?.and_then(|s| serde_json::from_str(&s).ok()),
        run_count: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn apply_parameters(template: &str, parameters: &serde_json::Value) -> String {
    let mut rendered = template.to_string();
    if let serde_json::Value::Object(map) = parameters {
        for (key, value) in map {
            let placeholder = format!("{{{{{}}}}}", key);
            rendered = rendered.replace(&placeholder, &value.to_string().trim_matches('"').to_string());
        }
    }
    rendered
}

async fn list_skills(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListSkillsQuery>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let mut sql = "SELECT id, user_id, organization_id, name, description, goal_template, parameters, allowed_sites, run_count, created_at, updated_at FROM skills WHERE user_id = ?1".to_string();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user.user_id.clone())];

        if let Some(ref search) = query.search {
            sql.push_str(" AND (name LIKE ? OR description LIKE ? OR goal_template LIKE ?)");
            let pattern = format!("%{}%", search);
            args.push(Box::new(pattern.clone()));
            args.push(Box::new(pattern.clone()));
            args.push(Box::new(pattern));
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let arg_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
        let mut stmt = conn.prepare(&sql).map_err(internal)?;
        let skills = stmt
            .query_map(arg_refs.as_slice(), row_to_skill)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({"skills": skills})))
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let skill = conn
            .query_row(
                "SELECT id, user_id, organization_id, name, description, goal_template, parameters, allowed_sites, run_count, created_at, updated_at FROM skills WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_skill,
            )
            .optional()
            .map_err(internal)?;
        match skill {
            Some(s) => Ok::<_, ApiError>(Json(json!(s))),
            None => Err(err(StatusCode::NOT_FOUND, "skill_not_found", "No such skill.")),
        }
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn create_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateSkillRequest>,
) -> Response {
    if body.name.trim().is_empty() || body.goal_template.trim().is_empty() {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "name and goal_template are required.",
        )
        .into_response();
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let id = format!("sk_{}", uuid::Uuid::new_v4().simple());
        let params_json = serde_json::to_string(&body.parameters.unwrap_or(serde_json::Value::Object(Default::default()))).map_err(internal)?;
        let allowed_json = body.allowed_sites.as_ref().map(|v| serde_json::to_string(v)).transpose().map_err(internal)?;
        conn.execute(
            "INSERT INTO skills (id, user_id, organization_id, name, description, goal_template, parameters, allowed_sites) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id,
                user.user_id,
                user.organization_id,
                body.name.trim(),
                body.description,
                body.goal_template.trim(),
                params_json,
                allowed_json,
            ],
        ).map_err(internal)?;
        Ok::<_, ApiError>((StatusCode::CREATED, Json(json!({"id": id}))))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn update_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSkillRequest>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let existing = conn
            .query_row(
                "SELECT id, user_id, organization_id, name, description, goal_template, parameters, allowed_sites, run_count, created_at, updated_at FROM skills WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_skill,
            )
            .optional()
            .map_err(internal)?;
        let skill = match existing {
            Some(s) => s,
            None => return Err(err(StatusCode::NOT_FOUND, "skill_not_found", "No such skill.")),
        };

        let name = body.name.unwrap_or(skill.name);
        let description = body.description.or(skill.description);
        let goal_template = body.goal_template.unwrap_or(skill.goal_template);
        let parameters = body.parameters.unwrap_or(skill.parameters);
        let allowed_sites = body.allowed_sites.or(skill.allowed_sites);
        let params_json = serde_json::to_string(&parameters).map_err(internal)?;
        let allowed_json = allowed_sites.as_ref().map(|v| serde_json::to_string(v)).transpose().map_err(internal)?;

        conn.execute(
            "UPDATE skills SET name = ?1, description = ?2, goal_template = ?3, parameters = ?4, allowed_sites = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6 AND user_id = ?7",
            params![name, description, goal_template, params_json, allowed_json, id, user.user_id],
        ).map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({"id": id, "updated": true})))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let affected = conn
            .execute(
                "DELETE FROM skills WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
            )
            .map_err(internal)?;
        if affected == 0 {
            return Err(err(StatusCode::NOT_FOUND, "skill_not_found", "No such skill."));
        }
        Ok::<_, ApiError>(StatusCode::NO_CONTENT.into_response())
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn run_skill(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<RunSkillRequest>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let skill = conn
            .query_row(
                "SELECT id, user_id, organization_id, name, description, goal_template, parameters, allowed_sites, run_count, created_at, updated_at FROM skills WHERE id = ?1 AND user_id = ?2",
                params![id, user.user_id],
                row_to_skill,
            )
            .optional()
            .map_err(internal)?;
        let skill = match skill {
            Some(s) => s,
            None => return Err(err(StatusCode::NOT_FOUND, "skill_not_found", "No such skill.")),
        };

        let goal = apply_parameters(&skill.goal_template, &body.parameters);
        conn.execute(
            "UPDATE skills SET run_count = run_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id],
        ).map_err(internal)?;

        Ok::<_, ApiError>(Json(json!({
            "skill_id": id,
            "goal": goal,
            "allowed_sites": skill.allowed_sites,
        })))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}
