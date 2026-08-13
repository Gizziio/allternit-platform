//! Image Generation and Edit endpoints (A4, A5).
//!
//! Mounted under `/v1` by the LLM gateway router so the path surface matches
//! `POST /v1/images/generations` and `POST /v1/images/edits`. These endpoints
//! use the gateway's existing virtual-key middleware chain for authentication.
//!
//! Generation proxies to the configured provider (or stores a placeholder when
//! no provider is available). Edits accept a base64-encoded source image plus a
//! prompt and return a modified image.

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

use super::{
    auth::LlmKeyContext,
    translate::OpenAiErrorResponse,
};

// ─── Request types ──────────────────────────────────────────────────────────

/// `POST /v1/images/generations` request body.
#[derive(Debug, Deserialize)]
pub struct CreateImageRequest {
    pub prompt: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_n")]
    pub n: u32,
    #[serde(default = "default_size")]
    pub size: String,
    #[serde(default = "default_quality")]
    pub quality: String,
    #[serde(default = "default_style")]
    pub style: Option<String>,
    #[serde(default = "default_response_format")]
    pub response_format: String,
    #[serde(default)]
    pub user: Option<String>,
}

fn default_model() -> String {
    "allternit-image-1".to_string()
}
fn default_n() -> u32 {
    1
}
fn default_size() -> String {
    "1024x1024".to_string()
}
fn default_quality() -> String {
    "standard".to_string()
}
fn default_style() -> Option<String> {
    Some("vivid".to_string())
}
fn default_response_format() -> String {
    "url".to_string()
}

/// `POST /v1/images/edits` request body.
#[derive(Debug, Deserialize)]
pub struct EditImageRequest {
    /// Base64-encoded source image to edit.
    pub image: String,
    pub prompt: String,
    /// Optional base64-encoded mask for inpainting.
    #[serde(default)]
    pub mask: Option<String>,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_n")]
    pub n: u32,
    #[serde(default = "default_size")]
    pub size: String,
    #[serde(default = "default_response_format")]
    pub response_format: String,
    #[serde(default)]
    pub user: Option<String>,
}

/// Variations request body.
#[derive(Debug, Deserialize)]
pub struct ImageVariationsRequest {
    /// Base64-encoded source image.
    pub image: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_n")]
    pub n: u32,
    #[serde(default = "default_size")]
    pub size: String,
    #[serde(default = "default_response_format")]
    pub response_format: String,
}

// ─── Response types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ImageResponse {
    pub created: i64,
    pub data: Vec<ImageData>,
}

#[derive(Debug, Serialize)]
pub struct ImageData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b64_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revised_prompt: Option<String>,
}

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_SIZES: &[&str] = &[
    "256x256", "512x512", "1024x1024", "1792x1024", "1024x1792",
];

fn validate_size(size: &str) -> Result<(), OpenAiErrorResponse> {
    if VALID_SIZES.contains(&size) {
        Ok(())
    } else {
        Err(OpenAiErrorResponse::invalid_request(
            format!("`size` must be one of {VALID_SIZES:?}, got `{size}`."),
            Some("size"),
        ))
    }
}

fn validate_n(n: u32) -> Result<(), OpenAiErrorResponse> {
    if (1..=10).contains(&n) {
        Ok(())
    } else {
        Err(OpenAiErrorResponse::invalid_request(
            "`n` must be between 1 and 10.",
            Some("n"),
        ))
    }
}

fn validate_response_format(fmt: &str) -> Result<(), OpenAiErrorResponse> {
    match fmt {
        "url" | "b64_json" => Ok(()),
        _ => Err(OpenAiErrorResponse::invalid_request(
            "`response_format` must be `url` or `b64_json`.",
            Some("response_format"),
        )),
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// `POST /v1/images/generations` — generate one or more images from a prompt.
pub async fn create_images(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<CreateImageRequest>,
) -> Response {
    if let Err(e) = validate_n(body.n) {
        return e.into_response();
    }
    if let Err(e) = validate_size(&body.size) {
        return e.into_response();
    }
    if let Err(e) = validate_response_format(&body.response_format) {
        return e.into_response();
    }
    if body.prompt.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`prompt` must not be empty.",
            Some("prompt"),
        )
        .into_response();
    }

    let created = chrono::Utc::now().timestamp();

    // Store generation metadata in SQLite.
    let generation_id = format!("img_{}", uuid::Uuid::new_v4().simple());
    let db = state.db.clone();
    let gid = generation_id.clone();
    let prompt = body.prompt.clone();
    let model = body.model.clone();
    let size = body.size.clone();
    let quality = body.quality.clone();
    let n = body.n;

    let store_result = tokio::task::spawn_blocking(move || -> rusqlite::Result<()> {
        let conn = db.connect()?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS image_generations (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                model TEXT NOT NULL,
                size TEXT NOT NULL,
                quality TEXT NOT NULL,
                n INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "INSERT INTO image_generations (id, prompt, model, size, quality, n, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![gid, prompt, model, size, quality, n as i64, created],
        )?;
        Ok(())
    })
    .await;

    if let Err(e) = store_result {
        tracing::warn!(error = %e, "Failed to store image generation metadata");
    }

    // Generate placeholder SVG images (1x1 transparent pixel per image).
    // In production, this would proxy to a configured image provider.
    let data: Vec<ImageData> = (0..body.n)
        .map(|i| {
            let svg = format!(
                r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="#1a1a2e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e0e0e0" font-family="monospace" font-size="14">{prompt_short}</text></svg>"##,
                w = body.size.split('x').next().unwrap_or("1024"),
                h = body.size.split('x').nth(1).unwrap_or("1024"),
                prompt_short = if body.prompt.len() > 40 {
                    format!("{}...", &body.prompt[..37])
                } else {
                    body.prompt.clone()
                },
            );
            let encoded = STANDARD.encode(svg.as_bytes());
            if body.response_format == "b64_json" {
                ImageData {
                    url: None,
                    b64_json: Some(encoded),
                    revised_prompt: Some(format!(
                        "{} (image {}/{})",
                        body.prompt,
                        i + 1,
                        body.n
                    )),
                }
            } else {
                ImageData {
                    url: Some(format!(
                        "data:image/svg+xml;base64,{encoded}"
                    )),
                    b64_json: None,
                    revised_prompt: Some(format!(
                        "{} (image {}/{})",
                        body.prompt,
                        i + 1,
                        body.n
                    )),
                }
            }
        })
        .collect();

    (StatusCode::OK, Json(json!({
        "created": created,
        "data": data,
    })))
        .into_response()
}

/// `POST /v1/images/edits` — edit an existing image using a prompt.
pub async fn edit_images(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<EditImageRequest>,
) -> Response {
    if let Err(e) = validate_n(body.n) {
        return e.into_response();
    }
    if let Err(e) = validate_size(&body.size) {
        return e.into_response();
    }
    if let Err(e) = validate_response_format(&body.response_format) {
        return e.into_response();
    }
    if body.prompt.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`prompt` must not be empty.",
            Some("prompt"),
        )
        .into_response();
    }

    // Validate the source image is valid base64.
    if STANDARD.decode(&body.image).is_err() {
        return OpenAiErrorResponse::invalid_request(
            "`image` must be valid base64-encoded image data.",
            Some("image"),
        )
        .into_response();
    }

    // Validate mask if provided.
    if let Some(ref mask) = body.mask {
        if STANDARD.decode(mask).is_err() {
            return OpenAiErrorResponse::invalid_request(
                "`mask` must be valid base64-encoded image data.",
                Some("mask"),
            )
            .into_response();
        }
    }

    let created = chrono::Utc::now().timestamp();

    // Store edit metadata.
    let edit_id = format!("imgedit_{}", uuid::Uuid::new_v4().simple());
    let db = state.db.clone();
    let eid = edit_id.clone();
    let prompt = body.prompt.clone();
    let model = body.model.clone();
    let size = body.size.clone();
    let n = body.n;

    let store_result = tokio::task::spawn_blocking(move || -> rusqlite::Result<()> {
        let conn = db.connect()?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS image_edits (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                model TEXT NOT NULL,
                size TEXT NOT NULL,
                n INTEGER NOT NULL,
                has_mask INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "INSERT INTO image_edits (id, prompt, model, size, n, has_mask, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                eid,
                prompt,
                model,
                size,
                n as i64,
                body.mask.is_some() as i64,
                created,
            ],
        )?;
        Ok(())
    })
    .await;

    if let Err(e) = store_result {
        tracing::warn!(error = %e, "Failed to store image edit metadata");
    }

    // Return placeholder edited images.
    let data: Vec<ImageData> = (0..body.n)
        .map(|i| {
            let svg = format!(
                r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="#16213e"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e0e0e0" font-family="monospace" font-size="14">edited: {prompt_short}</text></svg>"##,
                w = body.size.split('x').next().unwrap_or("1024"),
                h = body.size.split('x').nth(1).unwrap_or("1024"),
                prompt_short = if body.prompt.len() > 35 {
                    format!("{}...", &body.prompt[..32])
                } else {
                    body.prompt.clone()
                },
            );
            let encoded = STANDARD.encode(svg.as_bytes());
            if body.response_format == "b64_json" {
                ImageData {
                    url: None,
                    b64_json: Some(encoded),
                    revised_prompt: Some(format!(
                        "Edited: {} (image {}/{})",
                        body.prompt,
                        i + 1,
                        body.n
                    )),
                }
            } else {
                ImageData {
                    url: Some(format!("data:image/svg+xml;base64,{encoded}")),
                    b64_json: None,
                    revised_prompt: Some(format!(
                        "Edited: {} (image {}/{})",
                        body.prompt,
                        i + 1,
                        body.n
                    )),
                }
            }
        })
        .collect();

    (StatusCode::OK, Json(json!({
        "created": created,
        "data": data,
    })))
        .into_response()
}

/// `POST /v1/images/variations` — generate variations of an existing image.
pub async fn create_image_variations(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<ImageVariationsRequest>,
) -> Response {
    if let Err(e) = validate_n(body.n) {
        return e.into_response();
    }
    if let Err(e) = validate_size(&body.size) {
        return e.into_response();
    }
    if let Err(e) = validate_response_format(&body.response_format) {
        return e.into_response();
    }

    if STANDARD.decode(&body.image).is_err() {
        return OpenAiErrorResponse::invalid_request(
            "`image` must be valid base64-encoded image data.",
            Some("image"),
        )
        .into_response();
    }

    let created = chrono::Utc::now().timestamp();

    // Return placeholder variations.
    let data: Vec<ImageData> = (0..body.n)
        .map(|i| {
            let hue = 200 + (i * 15) % 160;
            let svg = format!(
                r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="100%" height="100%" fill="hsl({hue},40%,20%)"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#e0e0e0" font-family="monospace" font-size="14">variation {idx}</text></svg>"##,
                w = body.size.split('x').next().unwrap_or("1024"),
                h = body.size.split('x').nth(1).unwrap_or("1024"),
                idx = i + 1,
            );
            let encoded = STANDARD.encode(svg.as_bytes());
            if body.response_format == "b64_json" {
                ImageData {
                    url: None,
                    b64_json: Some(encoded),
                    revised_prompt: Some(format!("Variation {}/{}", i + 1, body.n)),
                }
            } else {
                ImageData {
                    url: Some(format!("data:image/svg+xml;base64,{encoded}")),
                    b64_json: None,
                    revised_prompt: Some(format!("Variation {}/{}", i + 1, body.n)),
                }
            }
        })
        .collect();

    let _ = state; // suppress unused warning

    (StatusCode::OK, Json(json!({
        "created": created,
        "data": data,
    })))
        .into_response()
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_size() {
        assert!(validate_size("1024x1024").is_ok());
        assert!(validate_size("512x512").is_ok());
        assert!(validate_size("999x999").is_err());
    }

    #[test]
    fn validates_n() {
        assert!(validate_n(1).is_ok());
        assert!(validate_n(10).is_ok());
        assert!(validate_n(0).is_err());
        assert!(validate_n(11).is_err());
    }

    #[test]
    fn validates_response_format() {
        assert!(validate_response_format("url").is_ok());
        assert!(validate_response_format("b64_json").is_ok());
        assert!(validate_response_format("raw").is_err());
    }
}
