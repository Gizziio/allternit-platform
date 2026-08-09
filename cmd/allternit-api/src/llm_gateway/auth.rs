//! Virtual-key authentication, per-key rate limiting, and budget pre-checks
//! for the LLM gateway.
//!
//! Middleware order on the gateway router (outermost first):
//!   1. [`llm_key_middleware`] — Bearer `ak-…` → SHA-256 lookup, attaches
//!      [`LlmKeyContext`] to request extensions.
//!   2. [`rate_limit_middleware`] — per-key in-memory sliding window.
//!   3. [`budget_middleware`] — monthly key cap + tenant hard cap pre-check.
//! (B6 DLP will slot in between 2 and 3; see `llm_gateway::mod`.)
//!
//! All rejections use the OpenAI error shape so existing OpenAI clients
//! surface them correctly.

use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::warn;

use crate::db::DbHandle;
use crate::AppState;

use super::translate::OpenAiErrorResponse;

/// Default per-key rate limit when the key row has no override.
pub const DEFAULT_RATE_LIMIT_RPM: i64 = 600;
/// Sliding-window length for the rate limiter.
const RATE_WINDOW: Duration = Duration::from_secs(60);
/// Microdollars per cent — `llm_usage_events.cost_microdollars` vs. the
/// `*_budget_cents` columns.
const MICRODOLLARS_PER_CENT: i64 = 10_000;

/// Virtual-key context attached to request extensions by
/// [`llm_key_middleware`]. Handlers and later middleware (rate limit, budget,
/// B4 metering, B5 routing) read it via `Extension<LlmKeyContext>`.
#[derive(Clone, Debug)]
pub struct LlmKeyContext {
    pub key_id: String,
    pub user_id: String,
    pub tenant_id: Option<String>,
    pub key_prefix: String,
    pub monthly_budget_cents: Option<i64>,
    pub rate_limit_rpm: Option<i64>,
    /// Allowed model ids / policy aliases; `None` means all models.
    pub allowed_models: Option<Vec<String>>,
}

impl LlmKeyContext {
    /// Whether this key may use `model` (a requested model string, policy
    /// alias, or `provider/model` id).
    pub fn model_allowed(&self, model: &str) -> bool {
        match &self.allowed_models {
            None => true,
            Some(allowed) => allowed.iter().any(|m| m == model),
        }
    }
}

/// SHA-256 hex of a plaintext virtual key — the stored lookup form.
pub fn hash_key(plaintext: &str) -> String {
    hex::encode(Sha256::digest(plaintext.as_bytes()))
}

fn invalid_api_key(message: &str) -> OpenAiErrorResponse {
    OpenAiErrorResponse::new(
        StatusCode::UNAUTHORIZED,
        message,
        "invalid_request_error",
        None,
        Some(crate::llm_gateway::translate::error_code::AUTHENTICATION_FAILED),
    )
}

fn server_error(message: String) -> OpenAiErrorResponse {
    OpenAiErrorResponse::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        message,
        "server_error",
        None,
        Some(crate::llm_gateway::translate::error_code::INTERNAL_ERROR),
    )
}

// ─── 1. Key authentication ──────────────────────────────────────────────────

/// Extract the Bearer token from the Authorization header.
fn bearer_token(headers: &axum::http::HeaderMap) -> Option<&str> {
    headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|token| !token.is_empty())
}

/// Look up a live (not revoked, not expired) virtual key by hash.
fn lookup_key(db: &DbHandle, key_hash: &str) -> rusqlite::Result<Option<LlmKeyContext>> {
    let conn = db.connect()?;
    let row = conn
        .query_row(
            "SELECT id, user_id, tenant_id, key_prefix, monthly_budget_cents,
                    rate_limit_rpm, allowed_models
             FROM llm_virtual_keys
             WHERE key_hash = ?1
               AND revoked = 0
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
            params![key_hash],
            |row| {
                let allowed_models: Option<String> = row.get(6)?;
                Ok(LlmKeyContext {
                    key_id: row.get(0)?,
                    user_id: row.get(1)?,
                    tenant_id: row.get(2)?,
                    key_prefix: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    monthly_budget_cents: row.get(4)?,
                    rate_limit_rpm: row.get(5)?,
                    allowed_models: allowed_models
                        .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
                })
            },
        )
        .optional()?;

    if let Some(ctx) = &row {
        // Best-effort touch; a failed timestamp update must not fail the request.
        if let Err(err) = conn.execute(
            "UPDATE llm_virtual_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![ctx.key_id],
        ) {
            warn!(error = %err, key_id = %ctx.key_id, "Failed to touch llm_virtual_keys.last_used_at");
        }
    }
    Ok(row)
}

/// Authenticate `Authorization: Bearer ak-…` against `llm_virtual_keys` and
/// attach [`LlmKeyContext`] to the request extensions.
pub async fn llm_key_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    let Some(token) = bearer_token(request.headers()).map(str::to_string) else {
        return invalid_api_key(
            "Missing or malformed Authorization header. Expected `Authorization: Bearer ak-…`.",
        )
        .into_response();
    };
    if !token.starts_with("ak-") {
        return invalid_api_key("Invalid API key format.").into_response();
    }

    let hash = hash_key(&token);
    let db = state.db.clone();
    match tokio::task::spawn_blocking(move || lookup_key(&db, &hash)).await {
        Ok(Ok(Some(ctx))) => {
            request.extensions_mut().insert(ctx);
            next.run(request).await
        }
        Ok(Ok(None)) => invalid_api_key("Unknown, revoked, or expired API key.").into_response(),
        Ok(Err(err)) => {
            warn!(error = %err, "llm_virtual_keys lookup failed");
            server_error(format!("Internal error: {err}")).into_response()
        }
        Err(err) => {
            warn!(error = %err, "llm_virtual_keys lookup task failed");
            server_error(format!("Internal error: {err}")).into_response()
        }
    }
}

// ─── 2. Rate limiting ───────────────────────────────────────────────────────

/// Per-key sliding-window request timestamps, process-wide. Entries are
/// pruned on access; a key with no traffic in the window costs one small
/// VecDeque.
static RATE_LIMIT_WINDOWS: Lazy<Mutex<HashMap<String, VecDeque<Instant>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Per-key sliding-window rate limit. Runs after [`llm_key_middleware`] so
/// the key context (and its `rate_limit_rpm` override) is available.
fn check_rate_limit(key_id: &str, limit: usize) -> bool {
    let now = Instant::now();
    let mut windows = RATE_LIMIT_WINDOWS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let window = windows.entry(key_id.to_string()).or_default();
    while window
        .front()
        .map(|t| now.duration_since(*t) > RATE_WINDOW)
        .unwrap_or(false)
    {
        window.pop_front();
    }
    if window.len() >= limit {
        return false;
    }
    window.push_back(now);
    true
}

pub async fn rate_limit_middleware(
    State(_state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(ctx) = request.extensions().get::<LlmKeyContext>() else {
        warn!("rate_limit_middleware ran without LlmKeyContext (middleware order bug)");
        return server_error("Internal error: missing key context".to_string()).into_response();
    };
    let limit = ctx.rate_limit_rpm.unwrap_or(DEFAULT_RATE_LIMIT_RPM).max(1) as usize;
    if !check_rate_limit(&ctx.key_id, limit) {
        let retry_after = RATE_WINDOW.as_secs().max(1);
        let body = json!({
            "error": {
                "message": "Rate limit exceeded for this API key. Please retry after the Retry-After interval.",
                "type": "rate_limit_exceeded",
                "code": crate::llm_gateway::translate::error_code::RATE_LIMITED
            }
        });
        return (
            StatusCode::TOO_MANY_REQUESTS,
            [(header::RETRY_AFTER, retry_after.to_string())],
            Json(body),
        )
            .into_response();
    }
    next.run(request).await
}

/// Read-only view of a key's current request-rate state.
#[derive(Debug, Clone, Serialize)]
pub struct RateLimitStatus {
    pub remaining: usize,
    pub limit: usize,
    pub reset_in_secs: u64,
}

/// Snapshot of the caller's token (budget) quota.
#[derive(Debug, Clone, Serialize)]
pub struct TokenBudgetStatus {
    pub limit_cents: Option<i64>,
    pub remaining_cents: Option<i64>,
}

/// Returns the number of requests still allowed in the current sliding window
/// and the seconds until the oldest tracked request falls out. Read-only:
/// it prunes stale entries but never records a new request.
pub fn rate_limit_status(key_id: &str, limit: usize) -> RateLimitStatus {
    let now = Instant::now();
    let mut windows = RATE_LIMIT_WINDOWS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let window = windows.entry(key_id.to_string()).or_default();
    while window
        .front()
        .map(|t| now.duration_since(*t) > RATE_WINDOW)
        .unwrap_or(false)
    {
        window.pop_front();
    }
    let used = window.len().min(limit);
    let remaining = limit.saturating_sub(used);
    let reset_in_secs = window
        .front()
        .map(|t| {
            let elapsed = now.duration_since(*t);
            if elapsed >= RATE_WINDOW {
                0
            } else {
                (RATE_WINDOW - elapsed).as_secs().max(1)
            }
        })
        .unwrap_or(0);
    RateLimitStatus {
        remaining,
        limit,
        reset_in_secs,
    }
}

/// Compute the effective monthly token budget and what remains of it.
/// When both a key-level budget and a tenant hard cap exist, the tighter
/// (smaller remaining) value wins.
pub fn token_budget_status(
    conn: &Connection,
    ctx: &LlmKeyContext,
) -> rusqlite::Result<TokenBudgetStatus> {
    let mut limit_cents: Option<i64> = None;
    let mut remaining_cents: Option<i64> = None;

    if let Some(cap_cents) = ctx.monthly_budget_cents {
        let spent = key_month_spend_microdollars(conn, &ctx.key_id)?;
        let remaining_micro = (cap_cents * MICRODOLLARS_PER_CENT).saturating_sub(spent);
        limit_cents = Some(cap_cents);
        remaining_cents = Some(remaining_micro / MICRODOLLARS_PER_CENT);
    }

    if let Some(tenant_id) = &ctx.tenant_id {
        if let Some(cap_cents) = tenant_hard_budget_cents(conn, tenant_id)? {
            let spent = tenant_month_spend_microdollars(conn, tenant_id)?;
            let remaining_micro = (cap_cents * MICRODOLLARS_PER_CENT).saturating_sub(spent);
            let tenant_remaining_cents = remaining_micro / MICRODOLLARS_PER_CENT;
            limit_cents = Some(limit_cents.map(|l| l.min(cap_cents)).unwrap_or(cap_cents));
            remaining_cents = Some(
                remaining_cents
                    .map(|r| r.min(tenant_remaining_cents))
                    .unwrap_or(tenant_remaining_cents),
            );
        }
    }

    Ok(TokenBudgetStatus {
        limit_cents,
        remaining_cents,
    })
}

// ─── 3. Budget pre-check ────────────────────────────────────────────────────

/// Current-calendar-month spend for one virtual key, in microdollars.
/// Bills off the gateway-recomputed cost when present (single source of
/// truth, per V27).
fn key_month_spend_microdollars(
    conn: &rusqlite::Connection,
    key_id: &str,
) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(COALESCE(recomputed_cost_microdollars, cost_microdollars)), 0)
         FROM llm_usage_events
         WHERE virtual_key_id = ?1
           AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')",
        params![key_id],
        |row| row.get(0),
    )
}

/// Current-calendar-month spend for one tenant, in microdollars.
fn tenant_month_spend_microdollars(
    conn: &rusqlite::Connection,
    tenant_id: &str,
) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(COALESCE(recomputed_cost_microdollars, cost_microdollars)), 0)
         FROM llm_usage_events
         WHERE tenant_id = ?1
           AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')",
        params![tenant_id],
        |row| row.get(0),
    )
}

/// Latest hard monthly budget for a tenant, in cents.
fn tenant_hard_budget_cents(
    conn: &rusqlite::Connection,
    tenant_id: &str,
) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT budget_cents
         FROM llm_budgets
         WHERE tenant_id = ?1 AND period = 'monthly' AND hard = 1
         ORDER BY created_at DESC
         LIMIT 1",
        params![tenant_id],
        |row| row.get(0),
    )
    .optional()
}

fn budget_exceeded(message: String) -> OpenAiErrorResponse {
    OpenAiErrorResponse::new(
        StatusCode::TOO_MANY_REQUESTS,
        message,
        "budget_exceeded",
        None,
        Some(crate::llm_gateway::translate::error_code::BUDGET_EXCEEDED),
    )
}

/// Reject requests whose key or tenant is already at/over its monthly cap.
/// Runs after [`llm_key_middleware`]. Post-request actuals are written to
/// `llm_usage_events` by the proxy handler, so the next request sees them.
pub async fn budget_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Some(ctx) = request.extensions().get::<LlmKeyContext>().cloned() else {
        warn!("budget_middleware ran without LlmKeyContext (middleware order bug)");
        return server_error("Internal error: missing key context".to_string()).into_response();
    };
    // Fast path: no key cap and no tenant to check against.
    if ctx.monthly_budget_cents.is_none() && ctx.tenant_id.is_none() {
        return next.run(request).await;
    }

    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<(), Response> {
        let conn = db.connect().map_err(|err| {
            warn!(error = %err, "budget pre-check DB connect failed");
            server_error(format!("Internal error: {err}")).into_response()
        })?;

        if let Some(cap_cents) = ctx.monthly_budget_cents {
            let spent = key_month_spend_microdollars(&conn, &ctx.key_id).map_err(|err| {
                warn!(error = %err, "budget pre-check key spend query failed");
                server_error(format!("Internal error: {err}")).into_response()
            })?;
            if spent >= cap_cents * MICRODOLLARS_PER_CENT {
                return Err(budget_exceeded(format!(
                    "Monthly budget exceeded for this API key ({:.2} USD cap).",
                    cap_cents as f64 / 100.0
                ))
                .into_response());
            }
        }

        if let Some(tenant_id) = &ctx.tenant_id {
            let cap_cents = tenant_hard_budget_cents(&conn, tenant_id).map_err(|err| {
                warn!(error = %err, "budget pre-check tenant budget query failed");
                server_error(format!("Internal error: {err}")).into_response()
            })?;
            if let Some(cap_cents) = cap_cents {
                let spent = tenant_month_spend_microdollars(&conn, tenant_id).map_err(|err| {
                    warn!(error = %err, "budget pre-check tenant spend query failed");
                    server_error(format!("Internal error: {err}")).into_response()
                })?;
                if spent >= cap_cents * MICRODOLLARS_PER_CENT {
                    return Err(budget_exceeded(format!(
                        "Monthly budget exceeded for this tenant ({:.2} USD cap).",
                        cap_cents as f64 / 100.0
                    ))
                    .into_response());
                }
            }
        }

        Ok(())
    })
    .await;

    match result {
        Ok(Ok(())) => next.run(request).await,
        Ok(Err(response)) => response,
        Err(err) => {
            warn!(error = %err, "budget pre-check task failed");
            server_error(format!("Internal error: {err}")).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn rate_limit_status_defaults_to_limit_when_no_traffic() {
        let status = rate_limit_status("key-1", 100);
        assert_eq!(status.limit, 100);
        assert_eq!(status.remaining, 100);
        assert_eq!(status.reset_in_secs, 0);
    }

    #[test]
    fn rate_limit_status_is_read_only() {
        // Populate the window for a key.
        {
            let mut windows = RATE_LIMIT_WINDOWS
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let window = windows.entry("key-ro".to_string()).or_default();
            window.push_back(Instant::now());
            window.push_back(Instant::now());
        }

        let first = rate_limit_status("key-ro", 10);
        assert_eq!(first.remaining, 8);

        // A second status check must not consume another slot.
        let second = rate_limit_status("key-ro", 10);
        assert_eq!(second.remaining, 8);
    }

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE llm_usage_events (
                id TEXT PRIMARY KEY,
                virtual_key_id TEXT,
                user_id TEXT,
                tenant_id TEXT,
                policy TEXT,
                provider_id TEXT,
                model_id TEXT,
                fallback_from TEXT,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                cached_tokens INTEGER NOT NULL DEFAULT 0,
                cost_microdollars INTEGER NOT NULL DEFAULT 0,
                latency_ms INTEGER NOT NULL DEFAULT 0,
                ttft_ms INTEGER,
                status TEXT NOT NULL,
                error_type TEXT,
                gizzi_session_id TEXT,
                idempotency_key TEXT UNIQUE,
                response_body TEXT,
                recomputed_cost_microdollars INTEGER,
                cost_mismatch INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE llm_budgets (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                period TEXT NOT NULL DEFAULT 'monthly',
                budget_cents INTEGER NOT NULL,
                hard INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .unwrap();
        conn
    }

    fn ctx_with_budget(key_id: &str, budget_cents: i64) -> LlmKeyContext {
        LlmKeyContext {
            key_id: key_id.to_string(),
            user_id: "u1".to_string(),
            tenant_id: None,
            key_prefix: "ak-test".to_string(),
            monthly_budget_cents: Some(budget_cents),
            rate_limit_rpm: None,
            allowed_models: None,
        }
    }

    #[test]
    fn token_budget_status_uses_key_budget() {
        let conn = in_memory_db();
        let ctx = ctx_with_budget("key-budget", 1000); // $10.00

        // No usage yet → full budget remains.
        let status = token_budget_status(&conn, &ctx).unwrap();
        assert_eq!(status.limit_cents, Some(1000));
        assert_eq!(status.remaining_cents, Some(1000));

        // Spend $1.23 (123 cents = 1_230_000 microdollars).
        conn.execute(
            "INSERT INTO llm_usage_events
             (id, virtual_key_id, status, cost_microdollars)
             VALUES ('e1', 'key-budget', 'ok', 1230000)",
            [],
        )
        .unwrap();

        let status = token_budget_status(&conn, &ctx).unwrap();
        assert_eq!(status.remaining_cents, Some(877));
    }

    #[test]
    fn token_budget_status_uses_tenant_cap_when_tighter() {
        let conn = in_memory_db();
        let ctx = LlmKeyContext {
            key_id: "key-tenant".to_string(),
            user_id: "u1".to_string(),
            tenant_id: Some("t1".to_string()),
            key_prefix: "ak-test".to_string(),
            monthly_budget_cents: Some(1000),
            rate_limit_rpm: None,
            allowed_models: None,
        };

        // Tenant hard cap is tighter than the key budget.
        conn.execute(
            "INSERT INTO llm_budgets (id, tenant_id, budget_cents, hard)
             VALUES ('b1', 't1', 500, 1)",
            [],
        )
        .unwrap();

        let status = token_budget_status(&conn, &ctx).unwrap();
        assert_eq!(status.limit_cents, Some(500));
        assert_eq!(status.remaining_cents, Some(500));
    }
}
