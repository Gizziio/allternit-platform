//! Organization-scoped pre/post inference HTTP hooks.
//!
//! The execution engine lives here; `proxy::chat_completions` drives it
//! immediately before and after provider inference so pre-hooks can mutate
//! the request body and post-hooks can mutate the final response.

use axum::{
    body::{to_bytes, Body, Bytes},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use rusqlite::OptionalExtension;
use serde_json::{json, Value};
use std::time::Duration;
use tracing::warn;

use super::translate::OpenAiErrorResponse;
use crate::AppState;

/// Default HTTP timeout for a single hook attempt.
pub const HOOK_TIMEOUT: Duration = Duration::from_secs(5);
/// Number of retries after the first failed attempt.
const HOOK_RETRIES: usize = 1;
/// Header carrying the HMAC-SHA256 signature of the hook payload.
pub const HOOK_SIGNATURE_HEADER: &str = "X-Allternit-Hook-Signature";

#[derive(Clone, Debug, Default)]
pub struct InferenceHooks {
    pub pre_inference_url: Option<String>,
    pub post_inference_url: Option<String>,
    pub abort_on_pre_error: bool,
    pub hook_secret: String,
}

impl InferenceHooks {
    pub fn has_hooks(&self) -> bool {
        self.pre_inference_url.is_some() || self.post_inference_url.is_some()
    }
}

/// Generate a fresh per-organization hook signing secret.
pub fn generate_hook_secret() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// HMAC-SHA256 hex signature for a hook payload.
pub fn sign_hook_payload(secret: &str, payload: &[u8]) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .expect("HMAC can accept a key of any size");
    mac.update(payload);
    hex::encode(mac.finalize().into_bytes())
}

pub fn hook_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(HOOK_TIMEOUT + Duration::from_secs(1))
        .build()
        .unwrap_or_default()
}

/// Load the hook configuration for an organization, if any URLs are configured.
pub fn load_hooks(
    db: &crate::db::DbHandle,
    organization_id: &str,
) -> rusqlite::Result<Option<InferenceHooks>> {
    let hooks: Option<InferenceHooks> = db.connect()?.query_row(
        "SELECT pre_inference_url, post_inference_url, abort_on_pre_error, COALESCE(hook_secret, '')
         FROM llm_inference_hooks WHERE organization_id = ?1",
        [organization_id],
        |row| {
            Ok(InferenceHooks {
                pre_inference_url: row.get(0)?,
                post_inference_url: row.get(1)?,
                abort_on_pre_error: row.get::<_, i64>(2)? != 0,
                hook_secret: row.get(3)?,
            })
        },
    ).optional()?;
    Ok(hooks.filter(|h| h.has_hooks()))
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

fn json_or_string(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(bytes).to_string()))
}

fn response_from_bytes(status: StatusCode, body: Bytes) -> Response {
    match serde_json::from_slice::<Value>(&body) {
        Ok(json) => (status, axum::Json(json)).into_response(),
        Err(_) => (status, body).into_response(),
    }
}

async fn hook_response_to_abort(resp: reqwest::Response, fallback: &str) -> Response {
    let status = resp.status();
    match resp.bytes().await {
        Ok(body) => response_from_bytes(status, body),
        Err(_) => hook_failure(fallback.to_string()),
    }
}

/// Outcome of a pre-inference hook: proceed (possibly with a mutated body) or
/// abort the request with a configured response.
pub enum PreHookOutcome {
    Proceed(Bytes),
    Abort(Response),
}

/// Run the pre-inference hook with a 5s timeout and one retry.
///
/// A successful hook may return a non-empty body that replaces the original
/// request body. A failed hook aborts when `abort_on_pre_error` is true.
pub async fn run_pre_hook(
    client: &reqwest::Client,
    hooks: &InferenceHooks,
    body: Bytes,
) -> PreHookOutcome {
    let Some(url) = &hooks.pre_inference_url else {
        return PreHookOutcome::Proceed(body);
    };

    let signature = sign_hook_payload(&hooks.hook_secret, &body);
    let mut last_result = client
        .post(url)
        .header("content-type", "application/json")
        .header(HOOK_SIGNATURE_HEADER, signature)
        .body(body.to_vec())
        .timeout(HOOK_TIMEOUT)
        .send()
        .await;

    for _ in 0..HOOK_RETRIES {
        if let Ok(resp) = &last_result {
            if resp.status().is_success() {
                break;
            }
        }
        let signature = sign_hook_payload(&hooks.hook_secret, &body);
        last_result = client
            .post(url)
            .header("content-type", "application/json")
            .header(HOOK_SIGNATURE_HEADER, signature)
            .body(body.to_vec())
            .timeout(HOOK_TIMEOUT)
            .send()
            .await;
    }

    match last_result {
        Ok(resp) if resp.status().is_success() => match resp.bytes().await {
            Ok(new_body) if !new_body.is_empty() => PreHookOutcome::Proceed(new_body),
            _ => PreHookOutcome::Proceed(body),
        },
        Ok(resp) => {
            warn!(status = %resp.status(), %url, "Pre-inference hook returned non-success");
            if hooks.abort_on_pre_error {
                PreHookOutcome::Abort(
                    hook_response_to_abort(resp, "Pre-inference hook rejected the request.").await,
                )
            } else {
                PreHookOutcome::Proceed(body)
            }
        }
        Err(err) => {
            warn!(error = %err, %url, "Pre-inference hook request failed");
            if hooks.abort_on_pre_error {
                PreHookOutcome::Abort(hook_failure(
                    "Pre-inference hook rejected the request.".into(),
                ))
            } else {
                PreHookOutcome::Proceed(body)
            }
        }
    }
}

async fn collect_response(
    response: Response,
) -> Result<(StatusCode, HeaderMap, Bytes), Response> {
    let status = response.status();
    let headers = response.headers().clone();
    match to_bytes(response.into_body(), 10 * 1024 * 1024).await {
        Ok(body) => Ok((status, headers, body)),
        Err(_) => Err(rebuild_response(status, headers, Bytes::new())),
    }
}

fn rebuild_response(status: StatusCode, headers: HeaderMap, body: Bytes) -> Response {
    let mut resp = Response::new(Body::from(body));
    *resp.status_mut() = status;
    resp.headers_mut().extend(headers);
    resp
}

fn build_post_payload(
    request_body: &Bytes,
    response_status: u16,
    response_body: &Bytes,
    latency_ms: u64,
) -> Value {
    json!({
        "request": json_or_string(request_body),
        "response": {
            "status_code": response_status,
            "body": json_or_string(response_body),
            "latency_ms": latency_ms,
        }
    })
}

/// Run the post-inference hook with a 5s timeout and one retry.
///
/// A successful response replaces the inference response body. A non-success
/// response from the hook aborts by returning the hook's response instead.
/// Transport failures fall back to the original response.
pub async fn run_post_hook(
    client: &reqwest::Client,
    hooks: &InferenceHooks,
    request_body: Bytes,
    response: Response,
    latency_ms: u64,
) -> Response {
    let Some(url) = &hooks.post_inference_url else {
        return response;
    };

    let (status, headers, body_bytes) = match collect_response(response).await {
        Ok(parts) => parts,
        Err(response) => return response,
    };

    let payload = build_post_payload(&request_body, status.as_u16(), &body_bytes, latency_ms);
    let payload_bytes = serde_json::to_vec(&payload).unwrap_or_else(|_| payload.to_string().into_bytes());
    let signature = sign_hook_payload(&hooks.hook_secret, &payload_bytes);

    let mut last_result = client
        .post(url)
        .header("content-type", "application/json")
        .header(HOOK_SIGNATURE_HEADER, signature)
        .body(payload_bytes.clone())
        .timeout(HOOK_TIMEOUT)
        .send()
        .await;

    for _ in 0..HOOK_RETRIES {
        if let Ok(resp) = &last_result {
            if resp.status().is_success() {
                break;
            }
        }
        let signature = sign_hook_payload(&hooks.hook_secret, &payload_bytes);
        last_result = client
            .post(url)
            .header("content-type", "application/json")
            .header(HOOK_SIGNATURE_HEADER, signature)
            .body(payload_bytes.clone())
            .timeout(HOOK_TIMEOUT)
            .send()
            .await;
    }

    match last_result {
        Ok(resp) => {
            let status = resp.status();
            match resp.bytes().await {
                Ok(body) => response_from_bytes(status, body),
                Err(_) => rebuild_response(status, headers, body_bytes),
            }
        }
        Err(err) => {
            warn!(error = %err, %url, "Post-inference hook request failed; returning original response");
            rebuild_response(status, headers, body_bytes)
        }
    }
}

/// Fire a best-effort post-inference hook for streaming responses, where the
/// response body is not available for mutation.
pub async fn fire_post_hook(
    client: &reqwest::Client,
    hooks: &InferenceHooks,
    request_body: Bytes,
    response_status: u16,
    latency_ms: u64,
) {
    let Some(url) = &hooks.post_inference_url else {
        return;
    };

    let payload = json!({
        "request": json_or_string(&request_body),
        "response": {
            "status_code": response_status,
            "streaming": true,
            "latency_ms": latency_ms,
        }
    });
    let payload_bytes = serde_json::to_vec(&payload).unwrap_or_else(|_| payload.to_string().into_bytes());
    let signature = sign_hook_payload(&hooks.hook_secret, &payload_bytes);

    let mut last_result = client
        .post(url)
        .header("content-type", "application/json")
        .header(HOOK_SIGNATURE_HEADER, signature)
        .body(payload_bytes.clone())
        .timeout(HOOK_TIMEOUT)
        .send()
        .await;

    for _ in 0..HOOK_RETRIES {
        if let Ok(resp) = &last_result {
            if resp.status().is_success() {
                break;
            }
        }
        let signature = sign_hook_payload(&hooks.hook_secret, &payload_bytes);
        last_result = client
            .post(url)
            .header("content-type", "application/json")
            .header(HOOK_SIGNATURE_HEADER, signature)
            .body(payload_bytes.clone())
            .timeout(HOOK_TIMEOUT)
            .send()
            .await;
    }

    if let Err(err) = last_result {
        warn!(error = %err, %url, "Post-inference hook failed for streaming response");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::post, Json, Router};

    async fn serve_app(app: Router) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}/")
    }

    #[tokio::test]
    async fn pre_hook_mutates_request_body() {
        let app = Router::new().route(
            "/",
            post(|headers: axum::http::HeaderMap, body: Bytes| async move {
                let signature = headers
                    .get(HOOK_SIGNATURE_HEADER)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                let expected = sign_hook_payload("super-secret", &body);
                assert_eq!(signature, expected);
                body
            }),
        );
        let url = serve_app(app).await;

        let hooks = InferenceHooks {
            pre_inference_url: Some(url.clone()),
            abort_on_pre_error: true,
            hook_secret: "super-secret".into(),
            ..Default::default()
        };
        let client = hook_client();
        let body = Bytes::from_static(br#"{"model":"test"}"#);
        let PreHookOutcome::Proceed(new_body) = run_pre_hook(&client, &hooks, body.clone()).await else {
            panic!("expected proceed");
        };
        assert_eq!(new_body, body);
    }

    #[tokio::test]
    async fn pre_hook_returns_mutated_body() {
        let app = Router::new().route(
            "/",
            post(|_body: Bytes| async move { Bytes::from_static(br#"{"mutated":true}"#) }),
        );
        let url = serve_app(app).await;

        let hooks = InferenceHooks {
            pre_inference_url: Some(url),
            abort_on_pre_error: true,
            hook_secret: "super-secret".into(),
            ..Default::default()
        };
        let client = hook_client();
        let body = Bytes::from_static(br#"{}"#);
        let PreHookOutcome::Proceed(new_body) = run_pre_hook(&client, &hooks, body).await else {
            panic!("expected proceed");
        };
        assert_eq!(new_body, Bytes::from_static(br#"{"mutated":true}"#));
    }

    #[tokio::test]
    async fn pre_hook_aborts_on_non_success_when_configured() {
        let app = Router::new().route(
            "/",
            post(|| async move {
                (
                    StatusCode::FORBIDDEN,
                    Bytes::from_static(br#"{"error":"blocked"}"#),
                )
            }),
        );
        let url = serve_app(app).await;

        let hooks = InferenceHooks {
            pre_inference_url: Some(url),
            abort_on_pre_error: true,
            hook_secret: "super-secret".into(),
            ..Default::default()
        };
        let client = hook_client();
        let body = Bytes::from_static(br#"{}"#);
        let PreHookOutcome::Abort(response) = run_pre_hook(&client, &hooks, body).await else {
            panic!("expected abort");
        };
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn pre_hook_proceeds_on_non_success_when_not_aborting() {
        let app = Router::new()
            .route("/", post(|| async move { StatusCode::BAD_GATEWAY }));
        let url = serve_app(app).await;

        let hooks = InferenceHooks {
            pre_inference_url: Some(url),
            abort_on_pre_error: false,
            hook_secret: "super-secret".into(),
            ..Default::default()
        };
        let client = hook_client();
        let body = Bytes::from_static(br#"{}"#);
        let PreHookOutcome::Proceed(new_body) = run_pre_hook(&client, &hooks, body.clone()).await else {
            panic!("expected proceed");
        };
        assert_eq!(new_body, body);
    }

    #[tokio::test]
    async fn post_hook_mutates_response() {
        let app = Router::new().route(
            "/",
            post(|body: Bytes| async move {
                assert!(body.starts_with(br#"{"request":"#));
                Bytes::from_static(br#"{"transformed":true}"#)
            }),
        );
        let url = serve_app(app).await;

        let hooks = InferenceHooks {
            post_inference_url: Some(url),
            abort_on_pre_error: true,
            hook_secret: "super-secret".into(),
            ..Default::default()
        };
        let client = hook_client();
        let request_body = Bytes::from_static(br#"{"model":"test"}"#);
        let original = (StatusCode::OK, Json(json!({"original": true}))).into_response();
        let response = run_post_hook(&client, &hooks, request_body, original, 100).await;
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), 1024).await.unwrap();
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["transformed"], true);
    }

    #[test]
    fn default_hooks_do_not_abort() {
        let hooks = InferenceHooks::default();
        assert!(!hooks.abort_on_pre_error);
        assert!(hooks.pre_inference_url.is_none());
    }
}
