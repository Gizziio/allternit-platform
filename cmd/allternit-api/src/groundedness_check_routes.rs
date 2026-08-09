//! Groundedness checks for hallucination reduction.
//!
//! Endpoints (org-admin gated, merged at `/api/v1/admin`):
//!   POST /admin/groundedness-checks  — score a response against passages
//!   GET  /admin/groundedness-checks  — list checks for the org
//!
//! The default scorer uses token-overlap coverage: what fraction of response
//! tokens also appear in at least one passage. This is fast, deterministic, and
//! runs without an external embedding model. Future methods can add cosine
//! similarity or LLM-as-judge scores.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Extension, Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/groundedness-checks", get(list_checks))
        .route("/admin/groundedness-checks", post(create_check))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "groundedness check operation failed");
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
            "Only organization owners/admins can manage groundedness checks.",
        ));
    }
    Ok(org.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PassageInput {
    id: String,
    #[serde(default)]
    title: String,
    content: String,
    #[serde(default)]
    url: String,
}

#[derive(Debug, Deserialize, Clone)]
struct CreateCheckBody {
    response_text: String,
    passages: Vec<PassageInput>,
    #[serde(default = "default_method")]
    method: String,
}

fn default_method() -> String {
    "token_overlap".to_string()
}

#[derive(Debug, Serialize)]
struct CheckResult {
    id: String,
    score: f64,
    status: String,
    method: String,
    details: Value,
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty() && s.len() > 2)
        .collect()
}

fn score_token_overlap(response: &str, passages: &[PassageInput]) -> (f64, Value) {
    let response_tokens: HashSet<String> = tokenize(response).into_iter().collect();
    if response_tokens.is_empty() {
        return (0.0, json!({"error": "empty response tokens"}));
    }

    let passage_contents: Vec<String> = passages
        .iter()
        .map(|p| format!("{} {}", p.title, p.content))
        .collect();
    let all_passage_tokens: HashSet<String> = passage_contents
        .iter()
        .flat_map(|c| tokenize(c))
        .collect();

    let matched: HashSet<String> = response_tokens
        .intersection(&all_passage_tokens)
        .cloned()
        .collect();
    let coverage = matched.len() as f64 / response_tokens.len() as f64;

    let mut per_passage = Vec::new();
    for passage in passages {
        let ptokens: HashSet<String> = tokenize(&format!("{} {}", passage.title, passage.content))
            .into_iter()
            .collect();
        let shared: HashSet<String> = response_tokens.intersection(&ptokens).cloned().collect();
        let p_coverage = if response_tokens.is_empty() {
            0.0
        } else {
            shared.len() as f64 / response_tokens.len() as f64
        };
        per_passage.push(json!({
            "id": passage.id,
            "title": passage.title,
            "shared_tokens": shared.len(),
            "coverage": p_coverage,
        }));
    }

    (
        coverage.clamp(0.0, 1.0),
        json!({
            "response_tokens": response_tokens.len(),
            "matched_tokens": matched.len(),
            "coverage": coverage,
            "per_passage": per_passage,
        }),
    )
}

async fn create_check(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateCheckBody>,
) -> Response {
    if body.response_text.trim().is_empty() {
        return error(
            StatusCode::BAD_REQUEST,
            "missing_response",
            "response_text must not be empty.",
        )
        .into_response();
    }
    if body.passages.is_empty() {
        return error(
            StatusCode::BAD_REQUEST,
            "missing_passages",
            "At least one passage is required.",
        )
        .into_response();
    }
    if body.method != "token_overlap" {
        return error(
            StatusCode::BAD_REQUEST,
            "unsupported_method",
            "Only 'token_overlap' is currently supported.",
        )
        .into_response();
    }

    let (score, details) = score_token_overlap(&body.response_text, &body.passages);
    let id = uuid::Uuid::new_v4().to_string();
    let result = CheckResult {
        id: id.clone(),
        score,
        status: "completed".to_string(),
        method: body.method.clone(),
        details: details.clone(),
    };

    let save = tokio::task::spawn_blocking({
        let state = state.clone();
        let user = user.clone();
        let body = body.clone();
        move || {
            let conn = state.db.connect().map_err(internal)?;
            let org = admin_org(&conn, &user)?;
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO groundedness_checks
                    (id, org_id, response_text, passages, method, score, status, details, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'completed', ?7, ?8)",
                params![
                    &id,
                    &org,
                    &body.response_text,
                    serde_json::to_string(&body.passages).unwrap(),
                    &body.method,
                    score,
                    serde_json::to_string(&details).unwrap(),
                    &now,
                ],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(())
        }
    })
    .await;

    match save {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!(result))).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ListChecksQuery {
    #[serde(default)]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn check_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "org_id": row.get::<_, String>(1)?,
        "response_text": row.get::<_, String>(2)?,
        "passages": serde_json::from_str::<Value>(&row.get::<_, String>(3)?)
            .unwrap_or_else(|_| json!([])),
        "method": row.get::<_, String>(4)?,
        "score": row.get::<_, f64>(5)?,
        "status": row.get::<_, String>(6)?,
        "details": serde_json::from_str::<Value>(&row.get::<_, String>(7)?)
            .unwrap_or_else(|_| json!({})),
        "created_at": row.get::<_, String>(8)?,
    }))
}

async fn list_checks(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListChecksQuery>,
) -> Response {
    let limit = query.limit.max(1).min(100);
    let offset = query.offset.max(0);
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, org_id, response_text, passages, method, score,
                        status, details, created_at
                 FROM groundedness_checks
                 WHERE org_id = ?1
                 ORDER BY created_at DESC
                 LIMIT ?2 OFFSET ?3",
            )
            .map_err(internal)?;
        let rows = stmt
            .query_map(params![org, limit, offset], check_json)
            .map_err(internal)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal)?;
        Ok::<_, ApiError>(Json(json!({
            "items": rows,
            "limit": limit,
            "offset": offset,
        })))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_overlap_perfect_match() {
        let response = "The capital of France is Paris.";
        let passages = vec![PassageInput {
            id: "p1".to_string(),
            title: "France".to_string(),
            content: "The capital of France is Paris.".to_string(),
            url: String::new(),
        }];
        let (score, _) = score_token_overlap(response, &passages);
        assert!(score > 0.9, "expected high score, got {score}");
    }

    #[test]
    fn token_overlap_no_match() {
        let response = "The capital of France is Paris.";
        let passages = vec![PassageInput {
            id: "p1".to_string(),
            title: "Quantum".to_string(),
            content: "Superposition allows qubits to exist in multiple states simultaneously.".to_string(),
            url: String::new(),
        }];
        let (score, _) = score_token_overlap(response, &passages);
        assert!(score < 0.3, "expected low score, got {score}");
    }

    #[test]
    fn tokenize_filters_short_words() {
        let tokens = tokenize("The cat sat on a mat.");
        assert!(tokens.contains(&"cat".to_string()));
        assert!(tokens.contains(&"the".to_string()));
        assert!(!tokens.contains(&"a".to_string()));
    }
}
