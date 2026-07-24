//! Agent Preference API routes
//!
//! Per-user response-style preferences (`/agent-preferences`). On every
//! successful PUT the preferences are also synced into each of the user's
//! agent workspaces as a platform-managed `STYLE.md` (best-effort — sync
//! failures are logged but never fail the request).

use axum::{
    extract::{Extension, Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

const SUPPORTED_STYLES: [&str; 4] = ["concise", "balanced", "detailed", "custom"];

pub fn agent_preferences_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/agent-preferences",
        get(get_agent_preferences).put(set_agent_preferences),
    )
}

#[derive(Serialize)]
struct AgentPreferencesPayload {
    response_style: String,
    custom_instructions: String,
    updated_at: String,
}

// ─── GET /agent-preferences ───────────────────────────────────────────────────

async fn get_agent_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let pref: (String, String, String) = conn
            .query_row(
                "SELECT response_style, custom_instructions, updated_at
                 FROM user_agent_preferences WHERE user_id = ?1",
                params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap_or_else(|_| {
                (
                    "balanced".to_string(),
                    String::new(),
                    chrono::Utc::now().to_rfc3339(),
                )
            });
        Ok::<_, rusqlite::Error>(pref)
    })
    .await;

    match result {
        Ok(Ok((response_style, custom_instructions, updated_at))) => {
            Json(json!({
                "response_style": response_style,
                "custom_instructions": custom_instructions,
                "updated_at": updated_at,
            }))
            .into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error reading agent preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── PUT /agent-preferences ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct SetAgentPreferencesBody {
    response_style: Option<String>,
    custom_instructions: Option<String>,
}

async fn set_agent_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<SetAgentPreferencesBody>,
) -> impl IntoResponse {
    let style = body.response_style.clone();
    if let Some(ref s) = style {
        if !SUPPORTED_STYLES.contains(&s.as_str()) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "invalid_response_style",
                    "supported_styles": SUPPORTED_STYLES,
                })),
            )
                .into_response();
        }
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let user_id_for_sync = user_id.clone();
    let style_for_sync = style.clone();
    let instructions_for_sync = body.custom_instructions.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Merge with the existing row so omitted fields keep their values.
        let current: (String, String) = conn
            .query_row(
                "SELECT response_style, custom_instructions
                 FROM user_agent_preferences WHERE user_id = ?1",
                params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or(("balanced".to_string(), String::new()));

        let response_style = style.unwrap_or(current.0);
        let custom_instructions = body.custom_instructions.unwrap_or(current.1);

        conn.execute(
            "INSERT INTO user_agent_preferences (user_id, response_style, custom_instructions)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(user_id) DO UPDATE SET
                response_style = excluded.response_style,
                custom_instructions = excluded.custom_instructions,
                updated_at = CURRENT_TIMESTAMP",
            params![user_id, response_style, custom_instructions],
        )?;

        let updated_at: String = conn.query_row(
            "SELECT updated_at FROM user_agent_preferences WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        )?;

        Ok::<_, rusqlite::Error>(AgentPreferencesPayload {
            response_style,
            custom_instructions,
            updated_at,
        })
    })
    .await;

    match result {
        Ok(Ok(pref)) => {
            // Best-effort STYLE.md sync into every agent workspace the user owns.
            sync_style_md(
                state.db.clone(),
                user_id_for_sync,
                style_for_sync.unwrap_or_else(|| pref.response_style.clone()),
                instructions_for_sync.unwrap_or_else(|| pref.custom_instructions.clone()),
            )
            .await;
            Json(pref).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error setting agent preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── STYLE.md sync ────────────────────────────────────────────────────────────

/// One-line response-style directive written into the managed STYLE.md.
fn style_directive(style: &str) -> &'static str {
    match style {
        "concise" => {
            "Respond concisely. Keep answers short and direct; skip preamble and unnecessary elaboration."
        }
        "detailed" => {
            "Respond in detail. Explain your reasoning, include relevant context, and cover edge cases."
        }
        // "custom" has no directive of its own — the custom instructions carry it.
        "custom" => "",
        _ => "Respond with balanced detail: thorough enough to be useful, concise enough to stay readable.",
    }
}

/// Response-style directive injected into agent-chat system instructions at
/// send time. These strings must match what the iOS client injected before
/// composition moved server-side — change them in lockstep with the clients.
/// Returns None for styles without a directive ("balanced", "custom").
pub(crate) fn chat_style_directive(style: &str) -> Option<&'static str> {
    match style {
        "concise" => Some(
            "Response style: keep responses brief and to the point — no preamble, no recap, no filler.",
        ),
        "detailed" => Some(
            "Response style: give thorough, detailed responses — full context, reasoning, and examples where they help.",
        ),
        _ => None,
    }
}

/// Render the fully platform-managed STYLE.md content.
fn render_style_md(style: &str, custom_instructions: &str) -> String {
    let mut out = String::from(
        "<!-- Managed by Allternit response-style settings. \
         This file is regenerated on every settings change and will be \
         overwritten — do not hand-edit. -->\n\n# Response Style\n\n",
    );
    let directive = style_directive(style);
    if !directive.is_empty() {
        out.push_str(directive);
        out.push_str("\n\n");
    }
    if !custom_instructions.is_empty() {
        out.push_str("## Custom Instructions\n\n");
        out.push_str(custom_instructions);
        out.push('\n');
    }
    out
}

/// Write the managed STYLE.md into every agent workspace owned by the user.
/// Best-effort: any failure is logged and skipped, never propagated.
async fn sync_style_md(
    db: crate::db::DbHandle,
    user_id: String,
    style: String,
    custom_instructions: String,
) {
    let result = tokio::task::spawn_blocking(move || {
        let agent_ids: Vec<String> = {
            let conn = db.connect()?;
            let mut stmt = conn.prepare("SELECT id FROM agents WHERE user_id = ?1")?;
            let ids = stmt
                .query_map(params![user_id], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;
            ids
        };

        let content = render_style_md(&style, &custom_instructions);

        for agent_id in agent_ids {
            let workspace_dir = crate::agent_workspace_paths::workspace_dir_for(&agent_id);
            if let Err(e) = std::fs::create_dir_all(&workspace_dir)
                .and_then(|_| std::fs::write(workspace_dir.join("STYLE.md"), &content))
            {
                warn!(
                    "STYLE.md sync failed for agent {}: {}",
                    agent_id, e
                );
            }
        }
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    if let Err(e) = result {
        warn!("STYLE.md sync task panicked: {}", e);
    } else if let Ok(Err(e)) = result {
        warn!("STYLE.md sync DB error: {}", e);
    }
}
