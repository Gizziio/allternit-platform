
//! Artifact API routes — local SQLite persistence.
//!
//! Mirrors the Next.js `/api/v1/artifacts` layer.

use axum::extract::Extension;
use axum::{
    extract::{Json, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch},
    Router,
};
use rusqlite::{params, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn artifact_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/artifacts", get(list_artifacts).post(create_artifact))
        .route("/artifacts/search", get(search_artifacts))
        .route("/artifacts/stats", get(get_artifact_stats))
        .route("/artifacts/:id", get(get_artifact).patch(update_artifact).delete(delete_artifact))
        .route("/artifacts/:id/revisions", get(list_revisions))
        .route("/artifacts/:id/sections", get(list_sections).post(add_section))
        .route("/artifacts/:id/sections/:section_id", patch(update_section).delete(delete_section))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data models
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
struct ArtifactRow {
    id: String,
    user_id: String,
    workspace_id: String,
    title: String,
    #[serde(rename = "type")]
    artifact_type: String,
    status: String,
    summary: Option<String>,
    tags: Vec<String>,
    created_at: String,
    updated_at: String,
    sections: Vec<SectionRow>,
    revisions: Vec<RevisionRow>,
}

#[derive(Serialize, Clone)]
struct SectionRow {
    id: String,
    artifact_id: String,
    heading: String,
    kind: String,
    body: String,
    position: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct RevisionRow {
    id: String,
    artifact_id: String,
    reason: String,
    snapshot: serde_json::Value,
    created_at: String,
}

#[derive(Deserialize)]
struct ListQuery {
    workspace_id: Option<String>,
    status: Option<String>,
    #[serde(rename = "type")]
    artifact_type: Option<String>,
    _q: Option<String>,
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
    workspace_id: Option<String>,
}

#[derive(Deserialize)]
struct CreateBody {
    workspace_id: String,
    title: String,
    #[serde(rename = "type")]
    artifact_type: Option<String>,
    status: Option<String>,
    summary: Option<String>,
    tags: Option<serde_json::Value>,
    sections: Option<Vec<CreateSectionBody>>,
}

#[derive(Deserialize)]
struct CreateSectionBody {
    heading: Option<String>,
    kind: Option<String>,
    body: Option<String>,
    position: Option<i64>,
}

#[derive(Deserialize)]
struct UpdateBody {
    title: Option<String>,
    #[serde(rename = "type")]
    artifact_type: Option<String>,
    status: Option<String>,
    summary: Option<String>,
    tags: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct SectionBody {
    heading: Option<String>,
    kind: Option<String>,
    body: Option<String>,
    position: Option<i64>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

fn normalize_tags(input: Option<serde_json::Value>) -> Vec<String> {
    input
        .and_then(|v| v.as_array().cloned())
        .map(|arr| {
            arr.into_iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn fetch_artifact_with_related(
    conn: &rusqlite::Connection,
    artifact_id: &str,
    user_id: &str,
) -> Result<Option<ArtifactRow>, rusqlite::Error> {
    let artifact: Option<(String, String, String, String, String, String, Option<String>, Option<String>, String, String)> = conn.query_row(
        "SELECT id, user_id, workspace_id, title, type, status, summary, tags, created_at, updated_at
         FROM artifacts WHERE id = ?1 AND user_id = ?2",
        params![artifact_id, user_id],
        |row| Ok((
            row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
            row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
        )),
    ).ok();

    let artifact = match artifact {
        Some(a) => a,
        None => return Ok(None),
    };

    let mut stmt = conn.prepare(
        "SELECT id, artifact_id, heading, kind, body, position, created_at, updated_at
         FROM artifact_sections WHERE artifact_id = ?1 ORDER BY position ASC, created_at ASC"
    )?;
    let sections: Vec<SectionRow> = stmt.query_map(params![artifact_id], |row| {
        Ok(SectionRow {
            id: row.get(0)?,
            artifact_id: row.get(1)?,
            heading: row.get(2)?,
            kind: row.get(3)?,
            body: row.get(4)?,
            position: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut stmt = conn.prepare(
        "SELECT id, artifact_id, reason, snapshot, created_at
         FROM artifact_revisions WHERE artifact_id = ?1 ORDER BY created_at DESC"
    )?;
    let revisions: Vec<RevisionRow> = stmt.query_map(params![artifact_id], |row| {
        let snapshot_str: String = row.get(3)?;
        let snapshot = serde_json::from_str(&snapshot_str).unwrap_or(json!({}));
        Ok(RevisionRow {
            id: row.get(0)?,
            artifact_id: row.get(1)?,
            reason: row.get(2)?,
            snapshot,
            created_at: row.get(4)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(Some(ArtifactRow {
        id: artifact.0,
        user_id: artifact.1,
        workspace_id: artifact.2,
        title: artifact.3,
        artifact_type: artifact.4,
        status: artifact.5,
        summary: artifact.6,
        tags: artifact.7.and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default(),
        created_at: artifact.8,
        updated_at: artifact.9,
        sections,
        revisions,
    }))
}

fn serialize_snapshot(artifact: &ArtifactRow) -> String {
    json!({
        "title": artifact.title,
        "type": artifact.artifact_type,
        "status": artifact.status,
        "summary": artifact.summary,
        "tags": artifact.tags,
        "sections": artifact.sections.iter().map(|s| json!({
            "id": s.id,
            "artifactId": s.artifact_id,
            "heading": s.heading,
            "kind": s.kind,
            "body": s.body,
            "position": s.position,
            "createdAt": s.created_at,
            "updatedAt": s.updated_at,
        })).collect::<Vec<_>>(),
        "updatedAt": artifact.updated_at,
    }).to_string()
}

fn create_revision(
    tx: &Transaction,
    artifact_id: &str,
    reason: &str,
    artifact: &ArtifactRow,
) -> Result<(), rusqlite::Error> {
    let rev_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO artifact_revisions (id, artifact_id, reason, snapshot, created_at)
         VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)",
        params![rev_id, artifact_id, reason, serialize_snapshot(artifact)],
    )?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts
// ═══════════════════════════════════════════════════════════════════════════════

async fn list_artifacts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT id, user_id, workspace_id, title, type, status, summary, tags, created_at, updated_at
             FROM artifacts WHERE user_id = ?1"
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
        if let Some(tp) = &q.artifact_type {
            sql.push_str(" AND type = ?");
            params_vec.push(tp.clone());
        }
        sql.push_str(" ORDER BY updated_at DESC");

        let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<(String, String, String, String, String, String, Option<String>, Option<String>, String, String)> = stmt.query_map(rusqlite::params_from_iter(params_ref), |row| {
            Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
                row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
            ))
        })?.collect::<Result<Vec<_>, _>>()?;

        let mut artifacts = Vec::new();
        for row in rows {
            let artifact_id = &row.0;
            let mut stmt = conn.prepare(
                "SELECT id, artifact_id, heading, kind, body, position, created_at, updated_at
                 FROM artifact_sections WHERE artifact_id = ?1 ORDER BY position ASC, created_at ASC"
            )?;
            let sections: Vec<SectionRow> = stmt.query_map(params![artifact_id], |row| {
                Ok(SectionRow {
                    id: row.get(0)?,
                    artifact_id: row.get(1)?,
                    heading: row.get(2)?,
                    kind: row.get(3)?,
                    body: row.get(4)?,
                    position: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?.collect::<Result<Vec<_>, _>>()?;

            let mut stmt = conn.prepare(
                "SELECT id, artifact_id, reason, snapshot, created_at
                 FROM artifact_revisions WHERE artifact_id = ?1 ORDER BY created_at DESC"
            )?;
            let revisions: Vec<RevisionRow> = stmt.query_map(params![artifact_id], |row| {
                let snapshot_str: String = row.get(3)?;
                let snapshot = serde_json::from_str(&snapshot_str).unwrap_or(json!({}));
                Ok(RevisionRow {
                    id: row.get(0)?,
                    artifact_id: row.get(1)?,
                    reason: row.get(2)?,
                    snapshot,
                    created_at: row.get(4)?,
                })
            })?.collect::<Result<Vec<_>, _>>()?;

            artifacts.push(ArtifactRow {
                id: row.0,
                user_id: row.1,
                workspace_id: row.2,
                title: row.3,
                artifact_type: row.4,
                status: row.5,
                summary: row.6,
                tags: row.7.and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default(),
                created_at: row.8,
                updated_at: row.9,
                sections,
                revisions,
            });
        }

        Ok::<_, rusqlite::Error>(artifacts)
    }).await;

    match result {
        Ok(Ok(artifacts)) => Json(json!({"artifacts": artifacts})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing artifacts: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /artifacts
// ═══════════════════════════════════════════════════════════════════════════════

async fn create_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateBody>,
) -> impl IntoResponse {

    let workspace_id = body.workspace_id.trim().to_string();
    let title = body.title.trim().to_string();
    if workspace_id.is_empty() || title.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "workspace_id and title are required"}))).into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let artifact_type = body.artifact_type.unwrap_or_else(|| "document".to_string());
    let status = body.status.unwrap_or_else(|| "draft".to_string());
    let summary = body.summary.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let tags = normalize_tags(body.tags);
    let _tags_json = serde_json::to_string(&tags).unwrap_or_default();
    let sections_input = body.sections.unwrap_or_default();

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        let artifact_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        tx.execute(
            "INSERT INTO artifacts (id, user_id, workspace_id, title, type, status, summary, tags, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![&artifact_id, &user_id, workspace_id, title, artifact_type, status, summary, serde_json::to_string(&tags).unwrap_or_default(), &now],
        )?;

        for (index, section) in sections_input.iter().enumerate() {
            let section_id = uuid::Uuid::new_v4().to_string();
            let heading = section.heading.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| format!("Section {}", index + 1));
            let kind = section.kind.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "document/markdown".to_string());
            let body_text = section.body.as_ref().map(|s| s.to_string()).unwrap_or_default();
            let position = section.position.unwrap_or(index as i64);

            tx.execute(
                "INSERT INTO artifact_sections (id, artifact_id, heading, kind, body, position, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                params![&section_id, &artifact_id, &heading, &kind, &body_text, position, &now],
            )?;
        }

        // Create initial revision
        let artifact = fetch_artifact_with_related(&tx, &artifact_id, &user_id)?.unwrap();
        create_revision(&tx, &artifact_id, "created", &artifact)?;

        tx.commit()?;
        Ok::<_, rusqlite::Error>(artifact)
    }).await;

    match result {
        Ok(Ok(artifact)) => (StatusCode::CREATED, Json(json!({"artifact": artifact}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error creating artifact: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts/:id
// ═══════════════════════════════════════════════════════════════════════════════

async fn get_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        fetch_artifact_with_related(&conn, &id, &user_id)
    }).await;

    match result {
        Ok(Ok(Some(artifact))) => Json(json!({"artifact": artifact})).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error getting artifact: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /artifacts/:id
// ═══════════════════════════════════════════════════════════════════════════════

async fn update_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        // Verify ownership
        let exists: bool = tx.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(None);
        }

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(title) = body.title {
            let t = title.trim();
            if !t.is_empty() {
                updates.push("title = ?".to_string());
                params_vec.push(Box::new(t.to_string()));
            }
        }
        if let Some(tp) = body.artifact_type {
            updates.push("type = ?".to_string());
            params_vec.push(Box::new(tp));
        }
        if let Some(st) = body.status {
            updates.push("status = ?".to_string());
            params_vec.push(Box::new(st));
        }
        if body.summary.is_some() {
            updates.push("summary = ?".to_string());
            params_vec.push(Box::new(body.summary.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())));
        }
        if body.tags.is_some() {
            updates.push("tags = ?".to_string());
            params_vec.push(Box::new(serde_json::to_string(&normalize_tags(body.tags)).unwrap_or_default()));
        }

        if !updates.is_empty() {
            updates.push("updated_at = CURRENT_TIMESTAMP".to_string());
            let sql = format!("UPDATE artifacts SET {} WHERE id = ?", updates.join(", "));
            params_vec.push(Box::new(id.clone()));
            let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            tx.execute(&sql, rusqlite::params_from_iter(params_ref))?;
        }

        let artifact = fetch_artifact_with_related(&tx, &id, &user_id)?.unwrap();
        create_revision(&tx, &id, "updated", &artifact)?;

        tx.commit()?;
        Ok(Some(artifact))
    }).await;

    match result {
        Ok(Ok(Some(artifact))) => Json(json!({"artifact": artifact})).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating artifact: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /artifacts/:id
// ═══════════════════════════════════════════════════════════════════════════════

async fn delete_artifact(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let rows = conn.execute(
            "DELETE FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
        )?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match result {
        Ok(Ok(0)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Ok(_)) => Json(json!({"ok": true})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting artifact: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts/search
// ═══════════════════════════════════════════════════════════════════════════════

async fn search_artifacts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Query(q): Query<SearchQuery>,
) -> impl IntoResponse {

    let query = q.q.unwrap_or_default().trim().to_lowercase();
    if query.is_empty() {
        return Json(json!({"artifacts": []})).into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let workspace_id = q.workspace_id;
    let like = format!("%{}%", query);

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Search artifacts + sections via JOIN, then dedupe
        let mut sql = String::from(
            "SELECT DISTINCT a.id, a.user_id, a.workspace_id, a.title, a.type, a.status, a.summary, a.tags, a.created_at, a.updated_at
             FROM artifacts a
             LEFT JOIN artifact_sections s ON a.id = s.artifact_id
             WHERE a.user_id = ?1 AND (
                LOWER(a.title) LIKE ?2 OR
                LOWER(COALESCE(a.summary, '')) LIKE ?2 OR
                LOWER(COALESCE(a.tags, '')) LIKE ?2 OR
                LOWER(s.heading) LIKE ?2 OR
                LOWER(s.body) LIKE ?2
             )"
        );
        let mut params_vec: Vec<String> = vec![user_id, like.clone()];
        if let Some(ws) = &workspace_id {
            sql.push_str(" AND a.workspace_id = ?");
            params_vec.push(ws.clone());
        }
        sql.push_str(" ORDER BY a.updated_at DESC");

        let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<(String, String, String, String, String, String, Option<String>, Option<String>, String, String)> = stmt.query_map(rusqlite::params_from_iter(params_ref), |row| {
            Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
                row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
            ))
        })?.collect::<Result<Vec<_>, _>>()?;

        let mut artifacts = Vec::new();
        for row in rows {
            if let Some(artifact) = fetch_artifact_with_related(&conn, &row.0, &row.1)? {
                artifacts.push(artifact);
            }
        }

        Ok::<_, rusqlite::Error>(artifacts)
    }).await;

    match result {
        Ok(Ok(artifacts)) => Json(json!({"artifacts": artifacts})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error searching artifacts: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts/stats
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
struct ArtifactStats {
    workspace_id: String,
    total: i64,
    drafts: i64,
    #[serde(rename = "final")]
    final_count: i64,
    updated_at: String,
}

async fn get_artifact_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let mut stmt = conn.prepare(
            "SELECT workspace_id,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
                    SUM(CASE WHEN status = 'final' THEN 1 ELSE 0 END) as finals,
                    MAX(updated_at) as latest
             FROM artifacts WHERE user_id = ?1
             GROUP BY workspace_id
             ORDER BY latest DESC"
        )?;
        let stats: Vec<ArtifactStats> = stmt.query_map(params![user_id], |row| {
            Ok(ArtifactStats {
                workspace_id: row.get(0)?,
                total: row.get(1)?,
                drafts: row.get(2)?,
                final_count: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(stats)
    }).await;

    match result {
        Ok(Ok(stats)) => Json(json!({"stats": stats})).into_response(),
        Ok(Err(e)) => {
            warn!("DB error getting artifact stats: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts/:id/revisions
// ═══════════════════════════════════════════════════════════════════════════════

async fn list_revisions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Verify ownership
        let exists: bool = conn.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(None);
        }

        let mut stmt = conn.prepare(
            "SELECT id, artifact_id, reason, snapshot, created_at
             FROM artifact_revisions WHERE artifact_id = ?1 ORDER BY created_at DESC"
        )?;
        let revisions: Vec<RevisionRow> = stmt.query_map(params![&id], |row| {
            let snapshot_str: String = row.get(3)?;
            let snapshot = serde_json::from_str(&snapshot_str).unwrap_or(json!({}));
            Ok(RevisionRow {
                id: row.get(0)?,
                artifact_id: row.get(1)?,
                reason: row.get(2)?,
                snapshot,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(Some(revisions))
    }).await;

    match result {
        Ok(Ok(Some(revisions))) => Json(json!({"revisions": revisions})).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing revisions: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /artifacts/:id/sections
// ═══════════════════════════════════════════════════════════════════════════════

async fn list_sections(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let exists: bool = conn.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(None);
        }

        let mut stmt = conn.prepare(
            "SELECT id, artifact_id, heading, kind, body, position, created_at, updated_at
             FROM artifact_sections WHERE artifact_id = ?1 ORDER BY position ASC, created_at ASC"
        )?;
        let sections: Vec<SectionRow> = stmt.query_map(params![&id], |row| {
            Ok(SectionRow {
                id: row.get(0)?,
                artifact_id: row.get(1)?,
                heading: row.get(2)?,
                kind: row.get(3)?,
                body: row.get(4)?,
                position: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(Some(sections))
    }).await;

    match result {
        Ok(Ok(Some(sections))) => Json(json!({"sections": sections})).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error listing sections: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /artifacts/:id/sections
// ═══════════════════════════════════════════════════════════════════════════════

async fn add_section(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<SectionBody>,
) -> impl IntoResponse {

    let heading = body.heading.unwrap_or_default().trim().to_string();
    if heading.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "heading is required"}))).into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let kind = body.kind.unwrap_or_else(|| "document/markdown".to_string());
    let body_text = body.body.unwrap_or_default();

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        let exists: bool = tx.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(None);
        }

        let position = if let Some(pos) = body.position {
            pos
        } else {
            tx.query_row(
                "SELECT COUNT(*) FROM artifact_sections WHERE artifact_id = ?1",
                params![&id],
                |row| row.get::<_, i64>(0),
            ).unwrap_or(0)
        };

        let section_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        tx.execute(
            "INSERT INTO artifact_sections (id, artifact_id, heading, kind, body, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![&section_id, &id, &heading, &kind, &body_text, position, &now],
        )?;

        tx.execute(
            "UPDATE artifacts SET updated_at = ?1 WHERE id = ?2",
            params![&now, &id],
        )?;

        let artifact = fetch_artifact_with_related(&tx, &id, &user_id)?.unwrap();
        create_revision(&tx, &id, &format!("section:{}:created", section_id), &artifact)?;

        tx.commit()?;

        let section = SectionRow {
            id: section_id,
            artifact_id: id.clone(),
            heading,
            kind,
            body: body_text,
            position,
            created_at: now.clone(),
            updated_at: now,
        };

        Ok(Some(section))
    }).await;

    match result {
        Ok(Ok(Some(section))) => (StatusCode::CREATED, Json(json!({"section": section}))).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Artifact not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error adding section: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /artifacts/:id/sections/:section_id
// ═══════════════════════════════════════════════════════════════════════════════

async fn update_section(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path((artifact_id, section_id)): Path<(String, String)>,
    Json(body): Json<SectionBody>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        let exists: bool = tx.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&artifact_id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(None);
        }

        let has_section: bool = tx.query_row(
            "SELECT 1 FROM artifact_sections WHERE id = ?1 AND artifact_id = ?2",
            params![&section_id, &artifact_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !has_section {
            return Ok(None);
        }

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(h) = body.heading {
            let trimmed = h.trim();
            if !trimmed.is_empty() {
                updates.push("heading = ?".to_string());
                params_vec.push(Box::new(trimmed.to_string()));
            }
        }
        if let Some(k) = body.kind {
            updates.push("kind = ?".to_string());
            params_vec.push(Box::new(k));
        }
        if let Some(b) = body.body {
            updates.push("body = ?".to_string());
            params_vec.push(Box::new(b));
        }
        if let Some(p) = body.position {
            updates.push("position = ?".to_string());
            params_vec.push(Box::new(p));
        }

        if !updates.is_empty() {
            updates.push("updated_at = CURRENT_TIMESTAMP".to_string());
            let sql = format!("UPDATE artifact_sections SET {} WHERE id = ?", updates.join(", "));
            params_vec.push(Box::new(section_id.clone()));
            let params_ref: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            tx.execute(&sql, rusqlite::params_from_iter(params_ref))?;
        }

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "UPDATE artifacts SET updated_at = ?1 WHERE id = ?2",
            params![&now, &artifact_id],
        )?;

        let artifact = fetch_artifact_with_related(&tx, &artifact_id, &user_id)?.unwrap();
        create_revision(&tx, &artifact_id, &format!("section:{}:updated", section_id), &artifact)?;

        tx.commit()?;

        let mut stmt = conn.prepare(
            "SELECT id, artifact_id, heading, kind, body, position, created_at, updated_at
             FROM artifact_sections WHERE id = ?1"
        )?;
        let section: Option<SectionRow> = stmt.query_map(params![&section_id], |row| {
            Ok(SectionRow {
                id: row.get(0)?,
                artifact_id: row.get(1)?,
                heading: row.get(2)?,
                kind: row.get(3)?,
                body: row.get(4)?,
                position: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?.next().transpose()?;

        Ok(section)
    }).await;

    match result {
        Ok(Ok(Some(section))) => Json(json!({"section": section})).into_response(),
        Ok(Ok(None)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Section not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error updating section: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /artifacts/:id/sections/:section_id
// ═══════════════════════════════════════════════════════════════════════════════

async fn delete_section(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Path((artifact_id, section_id)): Path<(String, String)>,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let mut conn = db.connect()?;
        let tx = conn.transaction()?;

        let exists: bool = tx.query_row(
            "SELECT 1 FROM artifacts WHERE id = ?1 AND user_id = ?2",
            params![&artifact_id, &user_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !exists {
            return Ok::<_, rusqlite::Error>(false);
        }

        let has_section: bool = tx.query_row(
            "SELECT 1 FROM artifact_sections WHERE id = ?1 AND artifact_id = ?2",
            params![&section_id, &artifact_id],
            |_row| Ok(true),
        ).unwrap_or(false);
        if !has_section {
            return Ok(false);
        }

        tx.execute(
            "DELETE FROM artifact_sections WHERE id = ?1",
            params![&section_id],
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "UPDATE artifacts SET updated_at = ?1 WHERE id = ?2",
            params![&now, &artifact_id],
        )?;

        let artifact = fetch_artifact_with_related(&tx, &artifact_id, &user_id)?.unwrap();
        create_revision(&tx, &artifact_id, &format!("section:{}:deleted", section_id), &artifact)?;

        tx.commit()?;
        Ok(true)
    }).await;

    match result {
        Ok(Ok(true)) => Json(json!({"ok": true})).into_response(),
        Ok(Ok(false)) => (StatusCode::NOT_FOUND, Json(json!({"error": "Section not found"}))).into_response(),
        Ok(Err(e)) => {
            warn!("DB error deleting section: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}
