//! Organization-scoped pre/post inference HTTP hooks.

use axum::{
    body::{to_bytes, Body},
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use rusqlite::OptionalExtension;
use serde_json::json;
use std::{sync::Arc, time::Instant};
use tracing::warn;

use super::{auth::LlmKeyContext, translate::OpenAiErrorResponse};
use crate::AppState;

#[derive(Clone, Debug, Default)]
pub struct InferenceHooks {
    pub pre_inference_url: Option<String>,
    pub post_inference_url: Option<String>,
    pub abort_on_pre_error: bool,
}

fn load_hooks(state: &AppState, organization_id: &str) -> rusqlite::Result<InferenceHooks> {
    state.db.connect()?.query_row(
        "SELECT pre_inference_url, post_inference_url, abort_on_pre_error FROM llm_inference_hooks WHERE organization_id = ?1",
        [organization_id],
        |row| Ok(InferenceHooks {
            pre_inference_url: row.get(0)?,
            post_inference_url: row.get(1)?,
            abort_on_pre_error: row.get::<_, i64>(2)? != 0,
        }),
    ).optional().map(|hooks| hooks.unwrap_or_default())
}

fn hook_failure(message: String) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::BAD_GATEWAY,
        message,
        "upstream_error",
        None,
        Some(crate::llm_gateway::translate::error_code::INTERNAL_ERROR),
    )
    .into_response()
}

pub async fn inference_hook_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(organization_id) = request
        .extensions()
        .get::<LlmKeyContext>()
        .and_then(|key| key.tenant_id.clone())
    else {
        return next.run(request).await;
    };
    let hooks = match load_hooks(&state, &organization_id) {
        Ok(hooks) => hooks,
        Err(err) => {
            warn!(error = %err, %organization_id, "Failed to load inference hooks");
            return hook_failure("Could not load inference hook configuration.".into());
        }
    };
    if hooks.pre_inference_url.is_none() && hooks.post_inference_url.is_none() {
        return next.run(request).await;
    }

    let (parts, body) = request.into_parts();
    let body = match to_bytes(body, 10 * 1024 * 1024).await {
        Ok(body) => body,
        Err(err) => return hook_failure(format!("Could not read inference request: {err}")),
    };
    let client = reqwest::Client::new();
    if let Some(url) = &hooks.pre_inference_url {
        let result = client
            .post(url)
            .header("content-type", "application/json")
            .body(body.clone())
            .send()
            .await;
        let failed = match &result {
            Ok(response) => !response.status().is_success(),
            Err(_) => true,
        };
        if failed {
            warn!(%url, ?result, "Pre-inference hook failed");
            if hooks.abort_on_pre_error {
                return hook_failure("Pre-inference hook rejected the request.".into());
            }
        }
    }

    let started = Instant::now();
    let response = next.run(Request::from_parts(parts, Body::from(body))).await;
    if let Some(url) = hooks.post_inference_url {
        let status = response.status().as_u16();
        let latency_ms = started.elapsed().as_millis() as u64;
        tokio::spawn(async move {
            if let Err(err) = client
                .post(&url)
                .json(&json!({
                    "organization_id": organization_id,
                    "status_code": status,
                    "latency_ms": latency_ms,
                }))
                .send()
                .await
                .and_then(|response| response.error_for_status())
            {
                warn!(error = %err, %url, "Post-inference hook failed");
            }
        });
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_hooks_do_not_abort() {
        let hooks = InferenceHooks::default();
        assert!(!hooks.abort_on_pre_error);
        assert!(hooks.pre_inference_url.is_none());
    }
}
