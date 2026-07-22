//! Checkpoints routes — git-based checkpoint/commit/tag/restore for a workspace.
//!
//! Backs `surfaces/ai.allternit.com/src/views/dag/Checkpointing.tsx`, which models
//! checkpoints as git commits (hash/message/author/tags/branch) with restore-via-reset.
//! This is a distinct concept from the cowork run/job checkpoints in
//! `rails/routes_cowork.rs` (agent-run cursor/step state, not workspace file state).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path as FsPath, PathBuf};
use std::process::Command;
use std::sync::Arc;

use crate::AppState;

pub fn checkpoints_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/checkpoints",
            get(list_checkpoints).post(create_checkpoint),
        )
        .route("/checkpoints/commit", post(create_checkpoint))
        .route("/checkpoints/tag", post(tag_checkpoint))
        .route("/checkpoints/:id/restore", post(restore_checkpoint))
}

fn resolve_workdir(explicit: Option<String>) -> PathBuf {
    explicit
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

fn run_git(workdir: &FsPath, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(workdir)
        .args(args)
        .output()
        .map_err(|e| format!("failed to run git: {e}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn is_git_repo(workdir: &FsPath) -> bool {
    Command::new("git")
        .current_dir(workdir)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn err_response(status: StatusCode, message: String) -> axum::response::Response {
    (status, Json(json!({ "error": message }))).into_response()
}

#[derive(Debug, Deserialize)]
struct ListCheckpointsQuery {
    #[serde(default)]
    workdir: Option<String>,
}

async fn list_checkpoints(
    State(_state): State<Arc<AppState>>,
    Query(query): Query<ListCheckpointsQuery>,
) -> impl IntoResponse {
    let workdir = resolve_workdir(query.workdir);

    if !is_git_repo(&workdir) {
        return Json(json!({
            "checkpoints": [],
            "currentBranch": "main",
            "initialized": false,
        }))
        .into_response();
    }

    let branch = run_git(&workdir, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_else(|_| "main".to_string());

    let mut tags_by_hash: HashMap<String, Vec<String>> = HashMap::new();
    if let Ok(raw) = run_git(
        &workdir,
        &["for-each-ref", "refs/tags", "--format=%(objectname) %(refname:short)"],
    ) {
        for line in raw.lines() {
            if let Some((hash, name)) = line.split_once(' ') {
                tags_by_hash
                    .entry(hash.to_string())
                    .or_default()
                    .push(name.to_string());
            }
        }
    }

    let log = run_git(
        &workdir,
        &[
            "log",
            "--pretty=format:%H%x1f%an%x1f%aI%x1f%s",
            "-n",
            "100",
        ],
    );

    let checkpoints: Vec<serde_json::Value> = match log {
        Ok(raw) if !raw.is_empty() => raw
            .split('\n')
            .filter_map(|line| {
                let mut parts = line.splitn(4, '\u{1f}');
                let hash = parts.next()?.to_string();
                let author = parts.next()?.to_string();
                let timestamp = parts.next()?.to_string();
                let message = parts.next().unwrap_or("").to_string();
                let tags = tags_by_hash.get(&hash).cloned().unwrap_or_default();
                Some(json!({
                    "id": hash,
                    "hash": hash,
                    "message": message,
                    "author": author,
                    "timestamp": timestamp,
                    "tags": tags,
                    "branch": branch,
                }))
            })
            .collect(),
        _ => Vec::new(),
    };

    Json(json!({
        "checkpoints": checkpoints,
        "currentBranch": branch,
        "initialized": true,
    }))
    .into_response()
}

#[derive(Debug, Deserialize)]
struct CreateCheckpointRequest {
    message: String,
    #[serde(default)]
    workdir: Option<String>,
}

async fn create_checkpoint(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<CreateCheckpointRequest>,
) -> impl IntoResponse {
    let workdir = resolve_workdir(body.workdir);
    let message = body.message.trim();
    if message.is_empty() {
        return err_response(StatusCode::BAD_REQUEST, "message is required".to_string());
    }
    if !is_git_repo(&workdir) {
        return err_response(
            StatusCode::CONFLICT,
            "workdir is not a git repository".to_string(),
        );
    }

    if let Err(e) = run_git(&workdir, &["add", "-A"]) {
        return err_response(StatusCode::INTERNAL_SERVER_ERROR, e);
    }

    if let Err(e) = run_git(&workdir, &["commit", "--allow-empty", "-m", message]) {
        return err_response(StatusCode::INTERNAL_SERVER_ERROR, e);
    }

    let hash = run_git(&workdir, &["rev-parse", "HEAD"]).unwrap_or_default();
    let author = run_git(&workdir, &["log", "-1", "--pretty=format:%an"])
        .unwrap_or_else(|_| "Unknown".to_string());

    Json(json!({
        "hash": hash,
        "id": hash,
        "author": author,
        "status": "created",
    }))
    .into_response()
}

#[derive(Debug, Deserialize)]
struct TagCheckpointRequest {
    #[serde(rename = "checkpointId")]
    checkpoint_id: String,
    #[serde(rename = "tagName")]
    tag_name: String,
    #[serde(default)]
    workdir: Option<String>,
}

async fn tag_checkpoint(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<TagCheckpointRequest>,
) -> impl IntoResponse {
    let workdir = resolve_workdir(body.workdir);
    let tag_name = body.tag_name.trim();
    if tag_name.is_empty() {
        return err_response(StatusCode::BAD_REQUEST, "tagName is required".to_string());
    }

    match run_git(&workdir, &["tag", tag_name, &body.checkpoint_id]) {
        Ok(_) => Json(json!({
            "status": "tagged",
            "checkpointId": body.checkpoint_id,
            "tagName": tag_name,
        }))
        .into_response(),
        Err(e) => err_response(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn restore_checkpoint(
    State(_state): State<Arc<AppState>>,
    Path(checkpoint_id): Path<String>,
) -> impl IntoResponse {
    let workdir = resolve_workdir(None);

    if run_git(
        &workdir,
        &["cat-file", "-e", &format!("{checkpoint_id}^{{commit}}")],
    )
    .is_err()
    {
        return err_response(StatusCode::NOT_FOUND, "unknown checkpoint".to_string());
    }

    // Stash any uncommitted work before moving the branch pointer — never lose
    // in-progress changes silently. `git stash push` is a no-op (exit 0) when
    // the tree is already clean.
    let _ = run_git(
        &workdir,
        &[
            "stash",
            "push",
            "-u",
            "-m",
            &format!("pre-restore-{checkpoint_id}"),
        ],
    );

    match run_git(&workdir, &["reset", "--hard", &checkpoint_id]) {
        Ok(_) => Json(json!({ "restored": true, "checkpointId": checkpoint_id })).into_response(),
        Err(e) => err_response(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}
