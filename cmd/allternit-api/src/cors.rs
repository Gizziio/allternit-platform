//! CORS policy for the API.
//!
//! The API is served both to local/desktop callers (which carry no `Origin`
//! header and are unaffected by CORS) and to browsers on the public
//! `api.allternit.com` origin, where mirroring any origin is no longer
//! acceptable. The policy matrix:
//!
//! - `ALLTERNIT_LOCAL_DEV_BYPASS=true` — keep the legacy permissive behavior
//!   (`Access-Control-Allow-Origin` mirrors the request origin). Intended only
//!   for local development.
//! - Otherwise — an explicit origin allowlist: `ALLTERNIT_CORS_ORIGINS`
//!   (comma-separated) when set, else [`DEFAULT_ALLOWED_ORIGINS`]. Requests
//!   without an `Origin` header always pass (non-browser clients such as the
//!   packaged desktop launcher, git, curl, and service-to-service calls).
//!   Requests with a disallowed `Origin` are rejected with 403 by
//!   [`origin_gate`], including preflights; allowed origins get the full
//!   preflight response and `Vary: Origin` from `tower-http`.
//!
//! Self-hosted (VPS Desktop-Cloud) deployments do not need a separate mode:
//! the default allowlist already contains `platform.allternit.com` and
//! `ai.allternit.com`, whose browsers reach the VPS through the nginx proxy
//! with those origins intact.

use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::AppConfig;

/// Origins allowed to make cross-origin browser calls when
/// `ALLTERNIT_CORS_ORIGINS` is not set. Covers the public surfaces, local Vite
/// (5173) / Next.js (3000) dev servers, this API's own UI (8013), and the
/// packaged desktop launcher UI (`http://127.0.0.1:3456`, see
/// `cmd/launcher/src/main.rs`).
pub const DEFAULT_ALLOWED_ORIGINS: &[&str] = &[
    "https://platform.allternit.com",
    "https://ai.allternit.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8013",
    "http://127.0.0.1:8013",
    "http://localhost:3456",
    "http://127.0.0.1:3456",
];

/// Parse a comma-separated origin list (as stored in `ALLTERNIT_CORS_ORIGINS`)
/// into header values. Empty entries and values that are not valid header
/// values are skipped; an empty result falls back to
/// [`DEFAULT_ALLOWED_ORIGINS`].
pub fn parse_allowed_origins(raw: Option<&str>) -> Vec<HeaderValue> {
    let parsed: Vec<HeaderValue> = raw
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .filter_map(|s| match HeaderValue::from_str(s) {
                    Ok(v) => Some(v),
                    Err(err) => {
                        tracing::warn!(origin = s, %err, "ignoring invalid CORS origin");
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    if parsed.is_empty() {
        return DEFAULT_ALLOWED_ORIGINS
            .iter()
            .map(|s| HeaderValue::from_static(s))
            .collect();
    }
    parsed
}

/// The CORS layer for the whole app, from the resolved config. See the module
/// docs for the policy.
///
/// `Access-Control-Allow-Credentials` stays enabled (the local UIs use
/// `credentials: 'include'`); a concrete origin list composes with credentials,
/// unlike a wildcard.
pub fn cors_layer_from_config(cfg: &AppConfig) -> CorsLayer {
    cors_layer(cfg.local_dev_bypass(), cfg.cors_origins())
}

/// Build the CORS layer from explicit policy inputs.
///
/// `bypass` mirrors any origin (local-dev mode); otherwise `origins` is the
/// allowlist used for `Access-Control-Allow-Origin`.
pub fn cors_layer(bypass: bool, origins: Vec<HeaderValue>) -> CorsLayer {
    let allow_origin = if bypass {
        AllowOrigin::mirror_request()
    } else {
        AllowOrigin::list(origins)
    };
    CorsLayer::new()
        .allow_origin(allow_origin)
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(allowed_request_headers())
}

/// Request headers permitted on cross-origin calls. Keep in sync with the
/// custom `x-allternit-*` auth/bootstrap headers, the OfficeCLI taskpane
/// upload headers, and the LLM gateway surface.
fn allowed_request_headers() -> Vec<HeaderName> {
    [
        header::ACCEPT,
        header::AUTHORIZATION,
        header::CONTENT_TYPE,
        header::ORIGIN,
        HeaderName::from_static("x-client-version"),
        HeaderName::from_static("x-allternit-desktop-access-token"),
        HeaderName::from_static("x-allternit-self-hosted-token"),
        HeaderName::from_static("x-allternit-user-id"),
        HeaderName::from_static("x-allternit-user-email"),
        HeaderName::from_static("x-allternit-user-name"),
        HeaderName::from_static("x-allternit-tenant-id"),
        HeaderName::from_static("x-office-filename"),
        HeaderName::from_static("x-office-host"),
        HeaderName::from_static("x-office-binding-id"),
        HeaderName::from_static("idempotency-key"),
        HeaderName::from_static("x-allternit-session-id"),
    ]
    .to_vec()
}

/// Shared state for [`origin_gate`]: the configured allowlist.
#[derive(Clone)]
pub struct CorsGateState {
    allowed: Arc<Vec<HeaderValue>>,
}

impl CorsGateState {
    pub fn new(origins: Vec<HeaderValue>) -> Self {
        Self {
            allowed: Arc::new(origins),
        }
    }
}

/// Reject requests whose `Origin` header is present but not in the allowlist
/// with a 403. Applied only when the dev bypass is off; requests without an
/// `Origin` header (non-browser clients) always pass. Runs outside the
/// [`CorsLayer`] (installed after it) so disallowed preflights are rejected
/// before the layer would answer them itself; rejections set `Vary: Origin`
/// manually, matching what the layer adds to allowed responses.
pub async fn origin_gate(State(state): State<CorsGateState>, req: Request, next: Next) -> Response {
    if let Some(origin) = req.headers().get(&header::ORIGIN) {
        if !state.allowed.contains(origin) {
            let mut res = StatusCode::FORBIDDEN.into_response();
            res.headers_mut()
                .insert(header::VARY, HeaderValue::from_static("origin"));
            return res;
        }
    }
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::get, Router};
    use tower::ServiceExt;

    fn app(bypass: bool, origins: Vec<HeaderValue>) -> Router {
        let mut router = Router::new()
            .route("/health", get(|| async { "ok" }))
            .layer(cors_layer(bypass, origins.clone()));
        if !bypass {
            // Mirror main.rs: the gate is installed outside the CORS layer.
            router = router.layer(axum::middleware::from_fn_with_state(
                CorsGateState::new(origins),
                origin_gate,
            ));
        }
        router
    }

    #[test]
    fn parse_defaults_when_unset() {
        let origins = parse_allowed_origins(None);
        assert_eq!(origins.len(), DEFAULT_ALLOWED_ORIGINS.len());
    }

    #[test]
    fn parse_trims_and_skips_empty_entries() {
        let origins = parse_allowed_origins(Some(" https://a.com , ,https://b.com "));
        let values: Vec<&str> = origins.iter().map(|v| v.to_str().unwrap()).collect();
        assert_eq!(values, vec!["https://a.com", "https://b.com"]);
    }

    #[test]
    fn parse_falls_back_when_only_whitespace() {
        let origins = parse_allowed_origins(Some(" , ,"));
        assert_eq!(origins.len(), DEFAULT_ALLOWED_ORIGINS.len());
    }

    #[tokio::test]
    async fn allowed_origin_simple_request_succeeds() {
        let res = app(false, parse_allowed_origins(Some("https://platform.allternit.com")))
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header(header::ORIGIN, "https://platform.allternit.com")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            "https://platform.allternit.com"
        );
        assert!(res
            .headers()
            .get_all(header::VARY)
            .iter()
            .any(|v| v.to_str().unwrap().contains("origin")));
    }

    #[tokio::test]
    async fn disallowed_origin_simple_request_is_rejected() {
        let res = app(false, parse_allowed_origins(Some("https://platform.allternit.com")))
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header(header::ORIGIN, "https://evil.example.com")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::FORBIDDEN);
        assert!(res
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .is_none());
        assert_eq!(res.headers().get(header::VARY).unwrap(), "origin");
    }

    #[tokio::test]
    async fn disallowed_origin_preflight_is_rejected() {
        let res = app(false, parse_allowed_origins(Some("https://platform.allternit.com")))
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/health")
                    .header(header::ORIGIN, "https://evil.example.com")
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::FORBIDDEN);
        assert!(res
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .is_none());
    }

    #[tokio::test]
    async fn allowed_origin_preflight_succeeds() {
        let res = app(false, parse_allowed_origins(Some("https://ai.allternit.com")))
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/health")
                    .header(header::ORIGIN, "https://ai.allternit.com")
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "authorization")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            "https://ai.allternit.com"
        );
        assert!(res
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_METHODS)
            .is_some());
        assert!(res
            .headers()
            .get_all(header::VARY)
            .iter()
            .any(|v| v.to_str().unwrap().contains("origin")));
    }

    #[tokio::test]
    async fn request_without_origin_passes() {
        let res = app(false, parse_allowed_origins(Some("https://platform.allternit.com")))
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn dev_bypass_mode_mirrors_any_origin() {
        let res = app(true, vec![])
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header(header::ORIGIN, "https://anything.example.com")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            "https://anything.example.com"
        );
    }
}
