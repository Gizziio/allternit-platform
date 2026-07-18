//! LLM gateway — the OpenAI-compatible control plane in front of Gizzi.
//!
//! Three routers:
//!
//! - [`llm_gateway_router`] — the public OpenAI surface, nested at `/v1` in
//!   main.rs: `POST /v1/chat/completions`, `GET /v1/models`. It carries its
//!   own middleware chain (virtual-key auth → rate limit → DLP → budget
//!   pre-check) and is therefore mounted on the *public* router, outside
//!   Clerk auth.
//! - [`gateway_keys_router`] — key management, merged into the
//!   Clerk-protected `/api/v1` chain in main.rs (`/api/v1/gateway/keys*`).
//! - [`admin_routes::gateway_admin_router`] — observability + tenant config
//!   (usage, logs, routing decisions/policies, DLP rules, budgets), merged
//!   next to the keys router (`/api/v1/gateway/*`).
//!
//! Middleware order on the gateway router (first to run listed first):
//!   1. `auth::llm_key_middleware` — Bearer `ak-…` → [`auth::LlmKeyContext`]
//!      request extension.
//!   2. `auth::rate_limit_middleware` — per-key sliding window.
//!   3. `dlp::dlp_middleware` — B6 secret scanning + injection screening.
//!   4. `auth::budget_middleware` — monthly key/tenant cap pre-check.
//!
//! Cross-cutting modules:
//! - `router` + `benchmarks` — B5 routing policies: benchmark-weighted model
//!   selection with fallback-chain derivation; decisions persisted to
//!   `llm_routing_decisions`, linked to the usage row.
//! - `llm_pricing` — B4: server-side cost recompute from the models.dev
//!   cache; both costs stored, mismatch flagged, Prometheus series emitted
//!   from the single `proxy::record_usage_event` choke point.

pub mod admin_routes;
pub mod auth;
pub mod benchmarks;
pub mod dlp;
pub mod dlp_patterns;
pub mod gizzi_bus;
pub mod keys;
pub mod llm_pricing;
pub mod proxy;
pub mod router;
pub mod translate;

use axum::{
    routing::{get, patch, post},
    Router,
};
use std::sync::Arc;

use crate::AppState;

/// Public OpenAI-compatible router (mounted at `/v1` in main.rs). Carries
/// its own virtual-key middleware chain — do not put it behind Clerk auth.
///
/// Takes the shared state because `from_fn_with_state` layers need it at
/// construction time (same pattern as `auth_middleware` in main.rs).
pub fn llm_gateway_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/chat/completions", post(proxy::chat_completions))
        .route("/models", get(proxy::list_models))
        // Layer order: the LAST layer added runs FIRST. Execution order is
        // therefore llm_key auth → rate limit → DLP → budget → handler.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::budget_middleware,
        ))
        // B6: DLP runs between rate limiting and the budget pre-check so
        // secrets are caught before any spend is accounted.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            dlp::dlp_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::rate_limit_middleware,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state,
            auth::llm_key_middleware,
        ))
}

/// Clerk-protected key-management router (merged into the `/api/v1` chain in
/// main.rs, so paths land at `/api/v1/gateway/keys*`).
pub fn gateway_keys_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/gateway/keys", post(keys::create_key).get(keys::list_keys))
        .route(
            "/gateway/keys/:id",
            patch(keys::update_key).delete(keys::revoke_key),
        )
}
