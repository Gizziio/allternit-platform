//! Server-side media generation plane (Phase 1 media plugins).
//!
//! Two provider lanes per provider: BYOK (the caller's own API key from the
//! V134 credential store, billed to the customer's cloud console) and a
//! platform-funded env-key lane that ships disabled until the operator sets
//! `ALLTERNIT_MEDIA_PLATFORM_FUNDED=1`. Video jobs are submitted async
//! (MiniMax H3 task API, fal queue API) and polled on demand; image
//! generation is synchronous (gpt-image, fal FLUX schnell). Finished video
//! bytes are downloaded server-side into `media_artifacts` and served from
//! this API so provider URLs never leak to the client.

pub mod catalog;
pub mod clients;
pub mod handlers;

#[cfg(test)]
mod tests;

use rusqlite::{params, OptionalExtension};

use crate::db::DbHandle;

pub use clients::{MediaTransport, ProviderKey, ReqwestTransport, VideoBackend, VideoJobHandle, VideoJobSubmit, VideoPoll};

/// A row from `media_jobs`.
#[derive(Debug, Clone)]
pub struct MediaJobRow {
    pub id: String,
    pub user_id: String,
    pub provider: String,
    pub model: String,
    pub kind: String,
    pub prompt: String,
    pub params_json: Option<String>,
    pub provider_task_id: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub artifact_id: Option<String>,
    pub estimated_cost_usd: Option<f64>,
}

impl MediaJobRow {
    pub fn is_terminal(&self) -> bool {
        self.status == "succeeded" || self.status == "failed"
    }

    /// Poll handle reconstruction for fal: poll URLs ride along in
    /// `params_json` next to the original request params.
    pub fn poll_urls(&self) -> (Option<String>, Option<String>) {
        let Some(raw) = &self.params_json else {
            return (None, None);
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
            return (None, None);
        };
        (
            value
                .get("poll_status_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            value
                .get("poll_response_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        )
    }
}

/// A row from `media_artifacts`.
#[derive(Debug, Clone)]
pub struct MediaArtifactRow {
    pub id: String,
    pub user_id: String,
    pub job_id: Option<String>,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

pub fn insert_job(
    db: &DbHandle,
    row: &MediaJobRow,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO media_jobs
             (id, user_id, provider, model, kind, prompt, params_json,
              provider_task_id, status, error, artifact_id, estimated_cost_usd)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            row.id,
            row.user_id,
            row.provider,
            row.model,
            row.kind,
            row.prompt,
            row.params_json,
            row.provider_task_id,
            row.status,
            row.error,
            row.artifact_id,
            row.estimated_cost_usd,
        ],
    )?;
    Ok(())
}

pub fn get_job(
    db: &DbHandle,
    job_id: &str,
    user_id: &str,
) -> Result<Option<MediaJobRow>, rusqlite::Error> {
    let conn = db.connect()?;
    conn.query_row(
        "SELECT id, user_id, provider, model, kind, prompt, params_json,
                provider_task_id, status, error, artifact_id, estimated_cost_usd
         FROM media_jobs WHERE id = ?1 AND user_id = ?2",
        params![job_id, user_id],
        |row| {
            Ok(MediaJobRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                kind: row.get(4)?,
                prompt: row.get(5)?,
                params_json: row.get(6)?,
                provider_task_id: row.get(7)?,
                status: row.get(8)?,
                error: row.get(9)?,
                artifact_id: row.get(10)?,
                estimated_cost_usd: row.get(11)?,
            })
        },
    )
    .optional()
}

pub fn update_job_status(
    db: &DbHandle,
    job_id: &str,
    status: &str,
    error: Option<&str>,
    artifact_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE media_jobs SET status = ?2, error = ?3, artifact_id = ?4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1",
        params![job_id, status, error, artifact_id],
    )?;
    Ok(())
}

pub fn insert_artifact(
    db: &DbHandle,
    user_id: &str,
    job_id: Option<&str>,
    content_type: &str,
    bytes: &[u8],
) -> Result<String, rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO media_artifacts (id, user_id, job_id, content_type, bytes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, user_id, job_id, content_type, bytes],
    )?;
    Ok(id)
}

pub fn get_artifact(
    db: &DbHandle,
    artifact_id: &str,
    user_id: &str,
) -> Result<Option<MediaArtifactRow>, rusqlite::Error> {
    let conn = db.connect()?;
    conn.query_row(
        "SELECT id, user_id, job_id, content_type, bytes
         FROM media_artifacts WHERE id = ?1 AND user_id = ?2",
        params![artifact_id, user_id],
        |row| {
            Ok(MediaArtifactRow {
                id: row.get(0)?,
                user_id: row.get(1)?,
                job_id: row.get(2)?,
                content_type: row.get(3)?,
                bytes: row.get(4)?,
            })
        },
    )
    .optional()
}

/// The credential provider id used in the V134 BYOK store for a media
/// provider lane ("minimax" | "fal" | "openai").
pub fn credential_provider_id(media_provider: &str) -> Option<&'static str> {
    match media_provider {
        "minimax-h3" => Some("minimax"),
        "fal-seedance" => Some("fal"),
        "gpt-image" => Some("openai"),
        "flux-fal" => Some("fal"),
        _ => None,
    }
}

/// Env var holding the platform-funded key for a credential provider id.
fn platform_env_var(credential_provider_id: &str) -> Option<&'static str> {
    match credential_provider_id {
        "minimax" => Some("MINIMAX_API_KEY"),
        "fal" => Some("FAL_KEY"),
        "openai" => Some("OPENAI_API_KEY"),
        _ => None,
    }
}

/// Resolve the key for a media provider lane: BYOK credential first, then the
/// flag-gated platform-funded env lane.
pub fn resolve_provider_key(
    db: &DbHandle,
    user_id: &str,
    media_provider: &str,
) -> Result<Option<ProviderKey>, rusqlite::Error> {
    let Some(cred_id) = credential_provider_id(media_provider) else {
        return Ok(None);
    };
    if let Some(cred) = crate::llm_gateway::route_credentials::get_credential(db, user_id, cred_id)? {
        return Ok(Some(ProviderKey {
            api_key: cred.api_key,
            base_url: cred.base_url,
        }));
    }
    if catalog::platform_funded_enabled() {
        if let Some(var) = platform_env_var(cred_id) {
            if let Ok(key) = std::env::var(var) {
                if !key.is_empty() {
                    return Ok(Some(ProviderKey {
                        api_key: key,
                        base_url: None,
                    }));
                }
            }
        }
    }
    Ok(None)
}
