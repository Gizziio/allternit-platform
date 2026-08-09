//! OpenAI-compatible chat completions backed by the Gizzi runtime.
//!
//! Flow: parse/validate → allowlist → idempotency → model resolution →
//! Gizzi session (fresh, or reused via `x-allternit-session-id`) → send
//! message → collect the response off the shared Gizzi event bus
//! (`gizzi_bus`) → OpenAI-shaped response (JSON or SSE stream).
//!
//! Every completed request — ok or error — writes one `llm_usage_events`
//! row with token/cost numbers taken verbatim from Gizzi events. The
//! collected [`RequestOutcome`] struct flows into the single
//! [`record_usage_event`] choke point, where B4 (pricing recompute,
//! Prometheus series) and B5 (routing-decision persistence) plug in.
//!
//! Notes / deliberate v1 limitations:
//! - `tools`/`tool_choice` are validated but not forwarded: Gizzi's agent
//!   loop owns tool execution and its `PromptInput` has no OpenAI-style tool
//!   field. Tool-use happens inside Gizzi; the final text is what returns.
//! - `Idempotency-Key` is honored for non-streaming requests only (a stream
//!   cannot be replayed from a stored body).
//! - B4 (pricing recompute + Prometheus counters) is wired into
//!   [`record_usage_event`]; B5 (routing policies) is wired into
//!   [`resolve_model`] — policy aliases resolve through `router::resolve`,
//!   and the derived fallback chain is sent to Gizzi as `fallbackModels`.

use axum::{
    extract::{Extension, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    Json,
};
use futures::StreamExt;
use rusqlite::OptionalExtension;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::db::DbHandle;
use crate::AppState;

use super::auth::LlmKeyContext;
use super::gizzi_bus::{self, GizziEvent};
use super::llm_pricing::{self, TokenBreakdown};
use super::router::{self, RoutingDecision};
use super::translate::{
    map_finish_reason, messages_to_prompt, new_completion_id, stream_error_data, validate_request,
    ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, OpenAiErrorResponse, Usage,
};

/// Hard cap on a single completion, from send to `session.status` idle.
const COMPLETION_TIMEOUT: Duration = Duration::from_secs(120);

/// Routing-policy aliases accepted in the `model` field. Aliases are scored
/// by `router::resolve` (B5); when routing cannot decide, the request
/// degrades to a Gizzi `auto/auto` passthrough.
pub const POLICY_ALIASES: [&str; 6] = [
    "auto",
    "allternit-balanced",
    "allternit-code",
    "allternit-reasoning",
    "allternit-knowledge",
    "allternit-instruct",
];

/// An `in_progress` idempotency row older than this is assumed abandoned
/// (worker died mid-request) and may be retried.
const IDEMPOTENCY_STALE_SECS: i64 = 600;

const SESSION_HEADER: &str = "x-allternit-session-id";
const FALLBACK_HEADER: &str = "x-allternit-fallback";

fn gizzi_base() -> String {
    crate::APP_CONFIG
        .get()
        .map(|c| c.terminal_server_url())
        .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn http_client() -> reqwest::Client {
    // Bounds the HTTP calls to Gizzi (session create, catalog); the
    // completion wait itself is bounded by COMPLETION_TIMEOUT on the event
    // collection loop, not by this client.
    reqwest::Client::builder()
        .timeout(COMPLETION_TIMEOUT + Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

/// Read a JSON number as i64 regardless of its wire representation.
fn json_i64(value: Option<&Value>) -> i64 {
    value
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f.round() as i64)))
        .unwrap_or(0)
}

// ─── Model resolution ───────────────────────────────────────────────────────

/// Resolved target model for a request.
struct ResolvedModel {
    /// Policy alias when the request named one (auto, allternit-*).
    policy: Option<String>,
    provider_id: String,
    model_id: String,
    /// Cross-provider failover chain sent to Gizzi as `fallbackModels`.
    fallbacks: Vec<router::CandidateRef>,
    /// The routing decision, when a policy alias drove resolution. Persisted
    /// to `llm_routing_decisions` (linked to the usage row) at record time.
    routing_decision: Option<RoutingDecision>,
}

impl ResolvedModel {
    /// `provider/model`, or None for policy-driven resolution (the requested
    /// alias is what allowlists check).
    fn full_id(&self) -> Option<String> {
        if self.policy.is_some() {
            None
        } else {
            Some(format!("{}/{}", self.provider_id, self.model_id))
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderCatalog {
    #[serde(default)]
    pub all: Vec<ProviderEntry>,
    #[serde(default)]
    pub connected: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderEntry {
    pub id: String,
    #[serde(default)]
    pub models: HashMap<String, ModelEntry>,
}

/// Catalog model entry. `cost` feeds routing's cost-efficiency score and the
/// cost-quartile heuristic; `status` filters non-active models (Gizzi's
/// `status` field; absent means active).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ModelEntry {
    #[serde(default)]
    pub release_date: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub cost: Option<ModelCost>,
    #[serde(default)]
    pub limit: Option<ModelLimit>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct ModelLimit {
    #[serde(default)]
    pub context: u64,
    #[serde(default)]
    pub output: u64,
}

/// $ per 1M tokens as reported by the Gizzi catalog (extra fields ignored).
#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct ModelCost {
    #[serde(default)]
    pub input: f64,
    #[serde(default)]
    pub output: f64,
}

async fn fetch_catalog(
    client: &reqwest::Client,
    base: &str,
) -> Result<ProviderCatalog, OpenAiErrorResponse> {
    let resp = client
        .get(format!("{base}/v1/provider/"))
        .send()
        .await
        .map_err(|err| {
            OpenAiErrorResponse::upstream(
                format!("Gizzi runtime unreachable: {err}"),
                "upstream_error",
            )
        })?;
    if !resp.status().is_success() {
        return Err(OpenAiErrorResponse::upstream(
            format!("Gizzi provider catalog returned {}", resp.status()),
            "upstream_error",
        ));
    }
    resp.json::<ProviderCatalog>().await.map_err(|err| {
        OpenAiErrorResponse::upstream(
            format!("Gizzi provider catalog was not decodable: {err}"),
            "upstream_error",
        )
    })
}

/// Resolve the requested `model` string to a concrete provider/model pair.
///
/// - policy alias → B5 routing: `router::resolve` scores the catalog against
///   benchmark weights; the winner becomes the primary model and the derived
///   chain (top 3 distinct providers) is sent as `fallbackModels`. When the
///   router cannot decide (no connected providers / no candidates) the
///   request degrades to the previous `auto/auto` passthrough so completions
///   keep working.
/// - `provider/model` → passed through unchanged as the primary; the
///   fallback chain is still derived from the balanced scorecard (routing is
///   bypassed for *selection*, borrowed for *failover*).
/// - bare model id → looked up in the Gizzi catalog, preferring connected
///   providers (the ones that can actually serve it); same fallback
///   derivation as explicit requests.
async fn resolve_model(
    db: &DbHandle,
    tenant_id: Option<&str>,
    client: &reqwest::Client,
    base: &str,
    requested: &str,
) -> Result<ResolvedModel, OpenAiErrorResponse> {
    if POLICY_ALIASES.contains(&requested) {
        let catalog = fetch_catalog(client, base).await?;
        let decision = {
            let db = db.clone();
            let tenant_id = tenant_id.map(str::to_string);
            let requested = requested.to_string();
            tokio::task::spawn_blocking(move || -> Result<RoutingDecision, router::RouterError> {
                let conn = db.connect().map_err(router::RouterError::from)?;
                router::resolve(&conn, tenant_id.as_deref(), &requested, &catalog)
            })
            .await
        };
        return match decision {
            Ok(Ok(decision)) => Ok(ResolvedModel {
                policy: Some(requested.to_string()),
                provider_id: decision.winner.provider_id.clone(),
                model_id: decision.winner.model_id.clone(),
                fallbacks: decision.fallbacks.clone(),
                routing_decision: Some(decision),
            }),
            Ok(Err(err)) => {
                // Routing could not decide — degrade to Gizzi auto so the
                // completion still works (previous behavior).
                warn!(policy = requested, error = ?err, "Routing failed; falling back to auto passthrough");
                Ok(ResolvedModel {
                    policy: Some(requested.to_string()),
                    provider_id: "auto".to_string(),
                    model_id: "auto".to_string(),
                    fallbacks: Vec::new(),
                    routing_decision: None,
                })
            }
            Err(err) => {
                warn!(error = %err, "Routing task failed; falling back to auto passthrough");
                Ok(ResolvedModel {
                    policy: Some(requested.to_string()),
                    provider_id: "auto".to_string(),
                    model_id: "auto".to_string(),
                    fallbacks: Vec::new(),
                    routing_decision: None,
                })
            }
        };
    }

    if let Some((provider, model)) = requested.split_once('/') {
        if provider.is_empty() || model.is_empty() {
            return Err(OpenAiErrorResponse::invalid_request(
                format!("Invalid model id `{requested}`; expected `provider/model`."),
                Some("model"),
            ));
        }
        let fallbacks = explicit_fallbacks(db, tenant_id, client, base, provider, model).await;
        return Ok(ResolvedModel {
            policy: None,
            provider_id: provider.to_string(),
            model_id: model.to_string(),
            fallbacks,
            routing_decision: None,
        });
    }

    let catalog = fetch_catalog(client, base).await?;
    let offers = |provider: &&ProviderEntry| provider.models.contains_key(requested);
    let found = catalog
        .all
        .iter()
        .filter(|p| catalog.connected.contains(&p.id))
        .find(offers)
        .or_else(|| catalog.all.iter().find(offers));

    match found {
        Some(provider) => {
            let fallbacks =
                derive_fallbacks(db, tenant_id, &catalog, &provider.id, requested).await;
            Ok(ResolvedModel {
                policy: None,
                provider_id: provider.id.clone(),
                model_id: requested.to_string(),
                fallbacks,
                routing_decision: None,
            })
        }
        None => Err(OpenAiErrorResponse::new(
            StatusCode::BAD_REQUEST,
            format!("The model `{requested}` does not exist or is not offered by any provider."),
            "invalid_request_error",
            Some("model"),
            Some(crate::llm_gateway::translate::error_code::MODEL_NOT_FOUND),
        )),
    }
}

/// Fallback-chain derivation for explicit `provider/model` requests: fetch
/// the catalog and score it with the balanced policy. Tolerates a missing
/// catalog (chain simply stays empty) — explicit requests must not start
/// failing because routing inputs are unavailable.
async fn explicit_fallbacks(
    db: &DbHandle,
    tenant_id: Option<&str>,
    client: &reqwest::Client,
    base: &str,
    provider_id: &str,
    model_id: &str,
) -> Vec<router::CandidateRef> {
    match fetch_catalog(client, base).await {
        Ok(catalog) => derive_fallbacks(db, tenant_id, &catalog, provider_id, model_id).await,
        Err(err) => {
            warn!(error = %err.error.message, "Catalog unavailable; no fallback chain for explicit model");
            Vec::new()
        }
    }
}

/// Run `router::fallback_chain_for_explicit` off the async executor.
async fn derive_fallbacks(
    db: &DbHandle,
    tenant_id: Option<&str>,
    catalog: &ProviderCatalog,
    provider_id: &str,
    model_id: &str,
) -> Vec<router::CandidateRef> {
    let db = db.clone();
    let tenant_id = tenant_id.map(str::to_string);
    let provider_id = provider_id.to_string();
    let model_id = model_id.to_string();
    let catalog = catalog.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        Some(router::fallback_chain_for_explicit(
            &conn,
            tenant_id.as_deref(),
            &catalog,
            &provider_id,
            &model_id,
        ))
    })
    .await
    .unwrap_or_default()
    .unwrap_or_default()
}

// ─── Gizzi session plumbing ─────────────────────────────────────────────────

async fn create_session(
    client: &reqwest::Client,
    base: &str,
    title: &str,
) -> Result<String, OpenAiErrorResponse> {
    let resp = client
        .post(format!("{base}/v1/session"))
        .json(&json!({ "title": title }))
        .send()
        .await
        .map_err(|err| {
            OpenAiErrorResponse::upstream(
                format!("Gizzi runtime unreachable: {err}"),
                "upstream_error",
            )
        })?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(OpenAiErrorResponse::upstream(
            format!("Gizzi session creation failed ({status}): {body}"),
            "upstream_error",
        ));
    }
    let session: Value = resp.json().await.map_err(|err| {
        OpenAiErrorResponse::upstream(
            format!("Gizzi session creation was not decodable: {err}"),
            "upstream_error",
        )
    })?;
    session
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| {
            OpenAiErrorResponse::upstream(
                "Gizzi session creation returned no id.",
                "upstream_error",
            )
        })
}

// ─── Event collection ───────────────────────────────────────────────────────

/// Usage numbers captured verbatim from Gizzi `message.updated` events.
#[derive(Debug, Clone, Default)]
pub struct GizziUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub reasoning_tokens: i64,
    pub cached_tokens: i64,
    /// Cache-write tokens, kept separately from `cached_tokens` (read) because
    /// the pricing recompute bills them at different rates.
    pub cache_write_tokens: i64,
    pub cost_microdollars: i64,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub finish: Option<String>,
}

/// What the collector learned from one bus event. `TextDelta` lets the
/// streaming path forward content as it arrives while the collector keeps
/// the aggregate.
enum EventEffect {
    None,
    TextDelta(String),
    Done,
    Error(String, String),
}

/// Per-request aggregation of Gizzi bus events.
struct Collector {
    started: Instant,
    text: String,
    was_busy: bool,
    usage: GizziUsage,
    assistant_error: Option<(String, String)>,
    fallback_from: Option<String>,
    fallback_to: Option<String>,
    ttft: Option<Duration>,
}

impl Collector {
    fn new(started: Instant) -> Self {
        Self {
            started,
            text: String::new(),
            was_busy: false,
            usage: GizziUsage::default(),
            assistant_error: None,
            fallback_from: None,
            fallback_to: None,
            ttft: None,
        }
    }

    /// Fold one bus event (already filtered to this session) into the
    /// collection state.
    fn handle_event(&mut self, event: &GizziEvent) -> EventEffect {
        let props = &event.properties;
        match event.event_type.as_str() {
            "message.part.delta" => {
                let field = props.get("field").and_then(Value::as_str).unwrap_or("text");
                if field != "text" {
                    return EventEffect::None;
                }
                if let Some(delta) = props.get("delta").and_then(Value::as_str) {
                    if self.ttft.is_none() {
                        self.ttft = Some(self.started.elapsed());
                    }
                    self.text.push_str(delta);
                    return EventEffect::TextDelta(delta.to_string());
                }
                EventEffect::None
            }
            "message.updated" => {
                let Some(info) = props.get("info") else {
                    return EventEffect::None;
                };
                if info.get("role").and_then(Value::as_str) != Some("assistant") {
                    return EventEffect::None;
                }
                self.usage = parse_assistant_usage(info);
                if let Some(error) = info.get("error") {
                    let name = error
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or("upstream_error")
                        .to_string();
                    let message = error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Gizzi reported an assistant error")
                        .to_string();
                    self.assistant_error = Some((name, message));
                }
                EventEffect::None
            }
            "session.status" => {
                let status_type = props
                    .get("status")
                    .and_then(|s| s.get("type"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if status_type == "busy" {
                    self.was_busy = true;
                    EventEffect::None
                } else if status_type == "idle" && (self.was_busy || !self.text.is_empty()) {
                    EventEffect::Done
                } else {
                    EventEffect::None
                }
            }
            // Deprecated Gizzi event, still emitted alongside session.status.
            "session.idle" => {
                if self.was_busy || !self.text.is_empty() {
                    EventEffect::Done
                } else {
                    EventEffect::None
                }
            }
            "session.error" => {
                let error = props.get("error").cloned().unwrap_or(Value::Null);
                let name = error
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("upstream_error")
                    .to_string();
                let message = error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("Gizzi session error")
                    .to_string();
                EventEffect::Error(name, message)
            }
            // Emitted by the Gizzi failover chain (Part A1); absent until it
            // lands, in which case fallback_* simply stay None.
            "session.model_fallback" => {
                let render = |key: &str| -> Option<String> {
                    let node = props.get(key)?;
                    let provider = node.get("providerID").and_then(Value::as_str)?;
                    let model = node.get("modelID").and_then(Value::as_str)?;
                    Some(format!("{provider}/{model}"))
                };
                if let Some(from) = render("from") {
                    self.fallback_from = Some(from);
                }
                if let Some(to) = render("to") {
                    self.fallback_to = Some(to);
                }
                EventEffect::None
            }
            _ => EventEffect::None,
        }
    }
}

/// Parse usage numbers off a Gizzi assistant message (`message.updated` info).
fn parse_assistant_usage(info: &Value) -> GizziUsage {
    let tokens = info.get("tokens");
    let cache = tokens.and_then(|t| t.get("cache"));
    let cost_dollars = info.get("cost").and_then(Value::as_f64).unwrap_or(0.0);
    GizziUsage {
        prompt_tokens: json_i64(tokens.and_then(|t| t.get("input"))),
        completion_tokens: json_i64(tokens.and_then(|t| t.get("output"))),
        reasoning_tokens: json_i64(tokens.and_then(|t| t.get("reasoning"))),
        cached_tokens: json_i64(cache.and_then(|c| c.get("read"))),
        cache_write_tokens: json_i64(cache.and_then(|c| c.get("write"))),
        cost_microdollars: (cost_dollars * 1_000_000.0).round() as i64,
        provider_id: info
            .get("providerID")
            .and_then(Value::as_str)
            .map(str::to_string),
        model_id: info
            .get("modelID")
            .and_then(Value::as_str)
            .map(str::to_string),
        finish: info
            .get("finish")
            .and_then(Value::as_str)
            .map(str::to_string),
    }
}

/// Everything learned about one completed request. This is the struct B4
/// (metering / pricing recompute) consumes — see the `record_usage_event`
/// call sites.
pub struct RequestOutcome {
    pub status: &'static str,
    pub error_type: Option<String>,
    pub usage: GizziUsage,
    pub policy: Option<String>,
    pub fallback_from: Option<String>,
    pub gizzi_session_id: Option<String>,
    pub latency_ms: i64,
    pub ttft_ms: Option<i64>,
    pub response_body: Option<Value>,
    /// B5 routing decision for policy-alias requests; persisted (linked to
    /// this row) by `record_usage_event`.
    pub routing_decision: Option<RoutingDecision>,
}

/// Result of the collection loop: the aggregated state plus either success
/// or a terminal (error_type, message).
struct Collection {
    collector: Collector,
    failure: Option<(String, String)>,
}

/// Drive the send task and the event stream to completion. The send runs on
/// a task because Gizzi only answers `POST /session/:id/message` after its
/// agent loop settles; events must be collected concurrently.
async fn collect(
    mut send_task: JoinHandle<Result<reqwest::Response, reqwest::Error>>,
    events: impl futures::Stream<Item = GizziEvent> + Send + 'static,
    started: Instant,
) -> Collection {
    let mut collector = Collector::new(started);
    let mut send_done = false;
    let mut failure: Option<(String, String)> = None;
    tokio::pin!(events);
    let deadline = tokio::time::sleep(COMPLETION_TIMEOUT);
    tokio::pin!(deadline);

    loop {
        tokio::select! {
            send_result = &mut send_task, if !send_done => {
                send_done = true;
                match send_result {
                    Ok(Ok(resp)) if resp.status().is_success() => {}
                    Ok(Ok(resp)) => {
                        let status = resp.status();
                        let body = resp.text().await.unwrap_or_default();
                        failure = Some((
                            "upstream_error".to_string(),
                            format!("Gizzi message endpoint returned {status}: {body}"),
                        ));
                    }
                    Ok(Err(err)) => {
                        failure = Some((
                            "upstream_error".to_string(),
                            format!("Failed to send message to Gizzi: {err}"),
                        ));
                    }
                    Err(err) => {
                        failure = Some((
                            "upstream_error".to_string(),
                            format!("Gizzi send task failed: {err}"),
                        ));
                    }
                }
                if failure.is_some() {
                    break;
                }
            }
            maybe_event = events.next() => {
                match maybe_event {
                    Some(event) => match collector.handle_event(&event) {
                        EventEffect::Done => break,
                        EventEffect::Error(name, message) => {
                            failure = Some((name, message));
                            break;
                        }
                        _ => {}
                    },
                    // The bus never closes in practice; treat as done.
                    None => break,
                }
            }
            _ = &mut deadline => {
                failure = Some((
                    "upstream_error".to_string(),
                    format!("Completion timed out after {}s.", COMPLETION_TIMEOUT.as_secs()),
                ));
                break;
            }
        }
    }

    Collection { collector, failure }
}

// ─── Usage recording (B4 choke point) ───────────────────────────────────────

/// Persist one `llm_usage_events` row for a completed request. When an
/// idempotency pre-insert exists (`status = 'in_progress'`) it is updated in
/// place, preserving the one-row-per-request invariant.
///
/// B4 hardening, all applied here at the single choke point:
/// - cost is recomputed server-side from the models.dev cache
///   ([`llm_pricing`]); both figures are stored and a |Δ| > 1% is flagged
///   (`cost_mismatch`) and logged. Billing reads
///   `COALESCE(recomputed_cost_microdollars, cost_microdollars)`.
/// - a B5 routing decision attached to the outcome is persisted to
///   `llm_routing_decisions`, linked by the usage row id, in the same
///   connection so both rows commit together.
/// - Prometheus counters/histograms (`crate::metrics`) are emitted.
pub(crate) fn record_usage_event(
    db: &DbHandle,
    key: &LlmKeyContext,
    outcome: &RequestOutcome,
    idempotency_key: Option<&str>,
) {
    // B4: recompute cost from the models.dev cache (skipped → NULL when the
    // file or model is unavailable; the Gizzi-reported cost stands alone).
    let recomputed = match (&outcome.usage.provider_id, &outcome.usage.model_id) {
        (Some(provider_id), Some(model_id)) => llm_pricing::recompute_cost_microdollars(
            provider_id,
            model_id,
            &TokenBreakdown {
                input: outcome.usage.prompt_tokens,
                output: outcome.usage.completion_tokens,
                reasoning: outcome.usage.reasoning_tokens,
                cache_read: outcome.usage.cached_tokens,
                cache_write: outcome.usage.cache_write_tokens,
            },
        ),
        _ => None,
    };
    let gizzi_cost = outcome.usage.cost_microdollars;
    let cost_mismatch = recomputed.is_some_and(|re| llm_pricing::is_mismatch(re, gizzi_cost));
    if cost_mismatch {
        warn!(
            key_id = %key.key_id,
            provider = ?outcome.usage.provider_id,
            model = ?outcome.usage.model_id,
            gizzi_cost_microdollars = gizzi_cost,
            recomputed_cost_microdollars = ?recomputed,
            "LLM cost mismatch >1% between Gizzi-reported and gateway-recomputed cost"
        );
    }

    let result = (|| -> rusqlite::Result<String> {
        let conn = db.connect()?;
        let response_body = outcome.response_body.as_ref().map(Value::to_string);
        if let Some(idem) = idempotency_key {
            let updated = conn.execute(
                "UPDATE llm_usage_events SET
                    policy = ?2, provider_id = ?3, model_id = ?4, fallback_from = ?5,
                    prompt_tokens = ?6, completion_tokens = ?7, reasoning_tokens = ?8,
                    cached_tokens = ?9, cost_microdollars = ?10, latency_ms = ?11,
                    ttft_ms = ?12, status = ?13, error_type = ?14,
                    gizzi_session_id = ?15, response_body = ?16,
                    recomputed_cost_microdollars = ?17, cost_mismatch = ?18
                 WHERE idempotency_key = ?1 AND status = 'in_progress'",
                rusqlite::params![
                    idem,
                    outcome.policy,
                    outcome.usage.provider_id,
                    outcome.usage.model_id,
                    outcome.fallback_from,
                    outcome.usage.prompt_tokens,
                    outcome.usage.completion_tokens,
                    outcome.usage.reasoning_tokens,
                    outcome.usage.cached_tokens,
                    outcome.usage.cost_microdollars,
                    outcome.latency_ms,
                    outcome.ttft_ms,
                    outcome.status,
                    outcome.error_type,
                    outcome.gizzi_session_id,
                    response_body,
                    recomputed,
                    cost_mismatch as i64,
                ],
            )?;
            if updated > 0 {
                let row_id: String = conn.query_row(
                    "SELECT id FROM llm_usage_events WHERE idempotency_key = ?1",
                    rusqlite::params![idem],
                    |row| row.get(0),
                )?;
                if let Some(decision) = &outcome.routing_decision {
                    router::persist_decision(&conn, &row_id, decision)?;
                }
                return Ok(row_id);
            }
            warn!("idempotency pre-insert missing at record time; inserting fresh row");
        }
        let row_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO llm_usage_events
                (id, virtual_key_id, user_id, tenant_id, policy, provider_id, model_id,
                 fallback_from, prompt_tokens, completion_tokens, reasoning_tokens,
                 cached_tokens, cost_microdollars, latency_ms, ttft_ms, status,
                 error_type, gizzi_session_id, idempotency_key, response_body,
                 recomputed_cost_microdollars, cost_mismatch)
             VALUES
                (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                 ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
            rusqlite::params![
                row_id,
                key.key_id,
                key.user_id,
                key.tenant_id,
                outcome.policy,
                outcome.usage.provider_id,
                outcome.usage.model_id,
                outcome.fallback_from,
                outcome.usage.prompt_tokens,
                outcome.usage.completion_tokens,
                outcome.usage.reasoning_tokens,
                outcome.usage.cached_tokens,
                outcome.usage.cost_microdollars,
                outcome.latency_ms,
                outcome.ttft_ms,
                outcome.status,
                outcome.error_type,
                outcome.gizzi_session_id,
                idempotency_key,
                response_body,
                recomputed,
                cost_mismatch as i64,
            ],
        )?;
        if let Some(decision) = &outcome.routing_decision {
            router::persist_decision(&conn, &row_id, decision)?;
        }
        Ok(row_id)
    })();

    match result {
        Ok(_row_id) => emit_llm_metrics(key, outcome, recomputed),
        Err(err) => {
            warn!(error = %err, key_id = %key.key_id, "Failed to record llm_usage_events row")
        }
    }
}

/// Emit the `llm_*` Prometheus series for one recorded request (B7). Cost
/// uses the recomputed figure when available (single source of truth).
fn emit_llm_metrics(key: &LlmKeyContext, outcome: &RequestOutcome, recomputed: Option<i64>) {
    let model = outcome.usage.model_id.as_deref().unwrap_or("unknown");
    let provider = outcome.usage.provider_id.as_deref().unwrap_or("unknown");
    let tenant = key.tenant_id.as_deref().unwrap_or("none");

    crate::metrics::record_llm_request(model, provider, outcome.status);
    crate::metrics::observe_llm_duration(model, outcome.latency_ms as f64 / 1000.0);
    if outcome.usage.prompt_tokens > 0 {
        crate::metrics::record_llm_tokens(model, "prompt", outcome.usage.prompt_tokens);
    }
    if outcome.usage.completion_tokens > 0 {
        crate::metrics::record_llm_tokens(model, "completion", outcome.usage.completion_tokens);
    }
    if outcome.usage.reasoning_tokens > 0 {
        crate::metrics::record_llm_tokens(model, "reasoning", outcome.usage.reasoning_tokens);
    }
    if outcome.usage.cached_tokens > 0 {
        crate::metrics::record_llm_tokens(model, "cached", outcome.usage.cached_tokens);
    }
    let effective_cost = recomputed.unwrap_or(outcome.usage.cost_microdollars);
    if effective_cost > 0 {
        crate::metrics::record_llm_cost(tenant, model, effective_cost);
    }
    if let Some(from) = &outcome.fallback_from {
        crate::metrics::inc_llm_fallback(from, &format!("{provider}/{model}"));
    }
}

// ─── Streaming client-disconnect guard ───────────────────────────────────────

/// Latest known state of an in-flight stream, shared with [`StreamUsageGuard`]
/// so a dropped stream can record its partial usage.
#[derive(Default)]
struct StreamProgress {
    /// Set when the stream reached its normal end (ok or handled error) —
    /// the guard then records nothing.
    disarmed: bool,
    usage: GizziUsage,
    fallback_from: Option<String>,
    ttft_ms: Option<i64>,
}

impl StreamProgress {
    fn sync_from(&mut self, collector: &Collector) {
        self.usage = collector.usage.clone();
        self.fallback_from = collector.fallback_from.clone();
        self.ttft_ms = collector.ttft.map(|d| d.as_millis() as i64);
    }
}

/// B4 gap fix: a streaming client that disconnects mid-stream used to leave
/// no usage row at all. This guard lives inside the SSE stream; when the
/// stream is dropped before its normal end (client disconnect, connection
/// reset), `Drop` records the partial usage seen so far with status
/// `client_disconnected`. The normal completion path disarms it before the
/// regular `record_usage_event` call, so exactly one row is written either
/// way.
struct StreamUsageGuard {
    db: DbHandle,
    key: LlmKeyContext,
    session_id: String,
    policy: Option<String>,
    routing_decision: Option<RoutingDecision>,
    started: Instant,
    progress: Arc<Mutex<StreamProgress>>,
}

impl Drop for StreamUsageGuard {
    fn drop(&mut self) {
        let mut progress = self
            .progress
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if progress.disarmed {
            return;
        }
        progress.disarmed = true;
        let outcome = RequestOutcome {
            status: "client_disconnected",
            error_type: None,
            usage: progress.usage.clone(),
            policy: self.policy.clone(),
            fallback_from: progress.fallback_from.clone(),
            gizzi_session_id: Some(self.session_id.clone()),
            latency_ms: self.started.elapsed().as_millis() as i64,
            ttft_ms: progress.ttft_ms,
            response_body: None,
            routing_decision: self.routing_decision.take(),
        };
        drop(progress);

        let db = self.db.clone();
        let key = self.key.clone();
        match tokio::runtime::Handle::try_current() {
            Ok(handle) => {
                handle.spawn_blocking(move || record_usage_event(&db, &key, &outcome, None));
            }
            // No runtime context (should not happen under axum): record
            // synchronously rather than lose the row.
            Err(_) => record_usage_event(&db, &key, &outcome, None),
        }
    }
}

// ─── Idempotency ────────────────────────────────────────────────────────────

enum IdemBegin {
    /// No prior request with this key; an `in_progress` row was pre-inserted.
    Proceed,
    /// A completed request with this key exists — replay its stored body.
    Replay(String),
    /// Reject with this response (409 in-flight, or 500 on DB failure).
    Reject(Response),
}

fn idempotency_conflict(message: &str) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::CONFLICT,
        message,
        "invalid_request_error",
        None,
        Some(crate::llm_gateway::translate::error_code::IDEMPOTENCY_CONFLICT),
    )
    .into_response()
}

async fn idempotency_begin(db: &DbHandle, key: &LlmKeyContext, idem_key: &str) -> IdemBegin {
    let db = db.clone();
    let key_id = key.key_id.clone();
    let user_id = key.user_id.clone();
    let tenant_id = key.tenant_id.clone();
    let idem = idem_key.to_string();

    let result = tokio::task::spawn_blocking(move || -> rusqlite::Result<IdemBegin> {
        let conn = db.connect()?;
        let existing = conn
            .query_row(
                "SELECT status, response_body,
                        CAST(strftime('%s', 'now') AS INTEGER)
                          - CAST(strftime('%s', created_at) AS INTEGER) AS age_secs
                 FROM llm_usage_events
                 WHERE idempotency_key = ?1 AND virtual_key_id = ?2",
                rusqlite::params![idem, key_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )
            .optional()?;

        if let Some((status, response_body, age_secs)) = existing {
            match (status.as_str(), response_body) {
                ("in_progress", _) if age_secs > IDEMPOTENCY_STALE_SECS => {
                    // Abandoned attempt (process died mid-request): allow retry.
                    conn.execute(
                        "DELETE FROM llm_usage_events WHERE idempotency_key = ?1 AND virtual_key_id = ?2",
                        rusqlite::params![idem, key_id],
                    )?;
                }
                ("in_progress", _) => {
                    return Ok(IdemBegin::Reject(idempotency_conflict(
                        "A request with this Idempotency-Key is already in progress.",
                    )));
                }
                (_, Some(body)) => return Ok(IdemBegin::Replay(body)),
                _ => {
                    return Ok(IdemBegin::Reject(idempotency_conflict(
                        "This Idempotency-Key was already used and cannot be replayed.",
                    )));
                }
            }
        }

        match conn.execute(
            "INSERT INTO llm_usage_events
                (id, virtual_key_id, user_id, tenant_id, status, idempotency_key)
             VALUES (?1, ?2, ?3, ?4, 'in_progress', ?5)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                key_id,
                user_id,
                tenant_id,
                idem
            ],
        ) {
            Ok(_) => Ok(IdemBegin::Proceed),
            Err(rusqlite::Error::SqliteFailure(failure, _))
                if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
            {
                // Lost a race against a concurrent request with the same key.
                Ok(IdemBegin::Reject(idempotency_conflict(
                    "A request with this Idempotency-Key is already in progress.",
                )))
            }
            Err(err) => Err(err),
        }
    })
    .await;

    match result {
        Ok(Ok(decision)) => decision,
        Ok(Err(err)) => {
            warn!(error = %err, "idempotency pre-check failed");
            IdemBegin::Reject(
                OpenAiErrorResponse::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Internal error: {err}"),
                    "server_error",
                    None,
                    Some(crate::llm_gateway::translate::error_code::INTERNAL_ERROR),
                )
                .into_response(),
            )
        }
        Err(err) => {
            warn!(error = %err, "idempotency pre-check task failed");
            IdemBegin::Reject(
                OpenAiErrorResponse::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Internal error: {err}"),
                    "server_error",
                    None,
                    Some(crate::llm_gateway::translate::error_code::INTERNAL_ERROR),
                )
                .into_response(),
            )
        }
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// Deterministic, provider-independent estimate used for preflight sizing.
/// Four UTF-8 characters per token is intentionally simple and stable.
pub fn estimate_tokens(request: &ChatCompletionRequest) -> u64 {
    let characters = request
        .messages
        .iter()
        .map(|message| message.role.chars().count() + message.content_text().chars().count())
        .sum::<usize>();
    ((characters + 3) / 4) as u64
}

/// `POST /tokens` — estimate input tokens for a chat-completions-shaped body.
pub async fn count_tokens(
    Extension(key): Extension<LlmKeyContext>,
    body: axum::body::Bytes,
) -> Response {
    let request: ChatCompletionRequest = match serde_json::from_slice(&body) {
        Ok(request) => request,
        Err(err) => {
            return OpenAiErrorResponse::invalid_request(
                format!("Invalid request body: {err}"),
                None,
            )
            .into_response()
        }
    };
    if let Err(response) = validate_request(&request) {
        return response.into_response();
    }
    if !key.model_allowed(&request.model) {
        return OpenAiErrorResponse::new(
            StatusCode::FORBIDDEN,
            format!(
                "This API key is not allowed to use model `{}`.",
                request.model
            ),
            "permission_error",
            Some("model"),
            Some(crate::llm_gateway::translate::error_code::PERMISSION_DENIED),
        )
        .into_response();
    }
    Json(json!({
        "object": "token_count",
        "model": request.model,
        "input_tokens": estimate_tokens(&request),
    }))
    .into_response()
}

/// `POST /chat/completions` — OpenAI-compatible completion via Gizzi.
#[tracing::instrument(skip_all, name = "llm_gateway.chat_completions")]
pub async fn chat_completions(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    let started = Instant::now();

    let request: ChatCompletionRequest = match serde_json::from_slice(&body) {
        Ok(request) => request,
        Err(err) => {
            return OpenAiErrorResponse::invalid_request(
                format!("Invalid request body: {err}"),
                None,
            )
            .into_response();
        }
    };
    if let Err(response) = validate_request(&request) {
        return response.into_response();
    }

    let stream = request.stream.unwrap_or(false);

    // Idempotency-Key is honored for non-streaming requests only (a stream
    // cannot be replayed from a stored body; the header is ignored there).
    let idempotency_key = headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if stream && idempotency_key.is_some() {
        warn!("Idempotency-Key header ignored for streaming request");
    }

    let base = gizzi_base();
    let client = http_client();

    // Resolve the requested model (policy alias, provider/model, or bare id).
    // Policy aliases go through B5 routing (winner + fallback chain).
    let resolved = match resolve_model(
        &state.db,
        key.tenant_id.as_deref(),
        &client,
        &base,
        &request.model,
    )
    .await
    {
        Ok(resolved) => resolved,
        Err(response) => return response.into_response(),
    };

    // Per-key model allowlist: the requested string and, for explicit ids,
    // the resolved provider/model form are both accepted.
    let allowed = key.model_allowed(&request.model)
        || resolved
            .full_id()
            .is_some_and(|full_id| key.model_allowed(&full_id));
    if !allowed {
        return OpenAiErrorResponse::new(
            StatusCode::FORBIDDEN,
            format!(
                "This API key is not allowed to use model `{}`.",
                request.model
            ),
            "permission_error",
            Some("model"),
            Some(crate::llm_gateway::translate::error_code::PERMISSION_DENIED),
        )
        .into_response();
    }

    // Prompt: system messages → Gizzi `system` field; history → transcript.
    let (system, transcript) = messages_to_prompt(&request.messages);

    // Session strategy: fresh session titled `gateway:<key_prefix>`, or
    // reuse via header — then only the last user message is sent and Gizzi's
    // own session history provides the context.
    let reuse_session_id = headers
        .get(SESSION_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let (session_id, prompt_text) = match &reuse_session_id {
        Some(existing) => {
            let last_user = request
                .messages
                .iter()
                .rev()
                .find(|m| m.role == "user")
                .map(|m| m.content_text())
                .filter(|t| !t.trim().is_empty());
            match last_user {
                Some(text) => (existing.clone(), text),
                None => {
                    return OpenAiErrorResponse::invalid_request(
                        "`messages` must contain a non-empty user message when reusing a session.",
                        Some("messages"),
                    )
                    .into_response();
                }
            }
        }
        None => {
            let title = format!("gateway:{}", key.key_prefix);
            match create_session(&client, &base, &title).await {
                Ok(id) => (id, transcript),
                Err(response) => return response.into_response(),
            }
        }
    };

    if prompt_text.trim().is_empty() && system.is_none() {
        return OpenAiErrorResponse::invalid_request(
            "`messages` contain no usable content.",
            Some("messages"),
        )
        .into_response();
    }

    // Idempotency gate: everything fallible above (parse, validation,
    // allowlist, resolution, session create) runs first so rejected requests
    // never leave a stranded in_progress row. From here to the send there is
    // no fallible step, so the pre-inserted row always gets finalized by
    // record_usage_event.
    let mut idem_active = false;
    if let Some(idem) = &idempotency_key {
        if !stream {
            match idempotency_begin(&state.db, &key, idem).await {
                IdemBegin::Proceed => idem_active = true,
                IdemBegin::Replay(body) => {
                    return (
                        StatusCode::OK,
                        [(header::CONTENT_TYPE, "application/json")],
                        body,
                    )
                        .into_response();
                }
                IdemBegin::Reject(response) => return response,
            }
        }
    }

    // Subscribe to the session's bus events BEFORE sending the message.
    let events = gizzi_bus::session_events(session_id.clone()).await;

    let mut payload = json!({
        "parts": [{ "type": "text", "text": prompt_text }],
        "model": { "providerID": resolved.provider_id, "modelID": resolved.model_id },
    });
    if let Some(system) = &system {
        payload["system"] = json!(system);
    }
    if let Some(format) = &request.response_format {
        if format.format_type == "json_schema" {
            let schema = format
                .json_schema
                .as_ref()
                .map(|value| value.schema.clone())
                .or_else(|| format.schema.clone())
                .unwrap_or_else(|| json!({}));
            payload["format"] = json!({ "type": "json_schema", "schema": schema });
        }
    }
    // Gizzi variants are the provider-neutral reasoning control and are
    // translated by its provider adapters to reasoning_effort/thinking.
    if let Some(effort) = &request.reasoning_effort {
        payload["variant"] = json!(effort);
    }
    // B5: the router-derived failover chain (top 3 distinct providers).
    // Gizzi switches down this list on non-retryable provider errors and
    // reports each switch as `session.model_fallback`.
    if !resolved.fallbacks.is_empty() {
        payload["fallbackModels"] = json!(resolved
            .fallbacks
            .iter()
            .map(|fallback| json!({
                "providerID": fallback.provider_id,
                "modelID": fallback.model_id,
            }))
            .collect::<Vec<_>>());
    }

    let message_url = format!(
        "{base}/v1/session/{}/message",
        urlencoding::encode(&session_id)
    );
    let send_task = tokio::spawn(client.post(message_url).json(&payload).send());

    info!(
        session_id = %session_id,
        model = %request.model,
        stream,
        key_prefix = %key.key_prefix,
        "LLM gateway request dispatched to Gizzi"
    );

    let idem_for_record = if idem_active { idempotency_key } else { None };

    if stream {
        stream_completion(
            state,
            key,
            send_task,
            events,
            started,
            session_id,
            request.model,
            resolved.policy,
            resolved.routing_decision,
            request
                .stream_options
                .and_then(|o| o.include_usage)
                .unwrap_or(false),
            idem_for_record,
        )
        .await
    } else {
        nonstream_completion(
            state,
            key,
            send_task,
            events,
            started,
            session_id,
            request.model,
            resolved.policy,
            resolved.routing_decision,
            idem_for_record,
        )
        .await
    }
}

/// Non-streaming path: collect to completion, return one chat.completion.
async fn nonstream_completion(
    state: Arc<AppState>,
    key: LlmKeyContext,
    send_task: JoinHandle<Result<reqwest::Response, reqwest::Error>>,
    events: impl futures::Stream<Item = GizziEvent> + Send + 'static,
    started: Instant,
    session_id: String,
    requested_model: String,
    policy: Option<String>,
    routing_decision: Option<RoutingDecision>,
    idempotency_key: Option<String>,
) -> Response {
    let Collection { collector, failure } = collect(send_task, events, started).await;
    let latency_ms = started.elapsed().as_millis() as i64;

    match failure.or(collector.assistant_error.clone()) {
        Some((error_type, message)) => {
            let outcome = RequestOutcome {
                status: "error",
                error_type: Some(error_type.clone()),
                usage: collector.usage,
                policy,
                fallback_from: collector.fallback_from,
                gizzi_session_id: Some(session_id),
                latency_ms,
                ttft_ms: collector.ttft.map(|d| d.as_millis() as i64),
                response_body: None,
                routing_decision,
            };
            let db = state.db.clone();
            let key_ctx = key.clone();
            tokio::task::spawn_blocking(move || {
                record_usage_event(&db, &key_ctx, &outcome, idempotency_key.as_deref())
            });
            OpenAiErrorResponse::upstream(message, &error_type).into_response()
        }
        None => {
            let completion_id = new_completion_id();
            let created = chrono::Utc::now().timestamp();
            let finish = map_finish_reason(collector.usage.finish.as_deref());
            let usage = Usage::new(
                collector.usage.prompt_tokens,
                collector.usage.completion_tokens,
                collector.usage.reasoning_tokens,
                collector.usage.cached_tokens,
            );
            let response = ChatCompletionResponse::new(
                completion_id,
                created,
                requested_model,
                collector.text.clone(),
                finish.to_string(),
                Some(usage),
            );
            let body = serde_json::to_value(&response)
                .unwrap_or_else(|_| json!({"error": "serialization failure"}));

            let outcome = RequestOutcome {
                status: "ok",
                error_type: None,
                usage: collector.usage,
                policy,
                fallback_from: collector.fallback_from.clone(),
                gizzi_session_id: Some(session_id.clone()),
                latency_ms,
                ttft_ms: collector.ttft.map(|d| d.as_millis() as i64),
                response_body: Some(body.clone()),
                routing_decision,
            };
            let db = state.db.clone();
            tokio::task::spawn_blocking(move || {
                record_usage_event(&db, &key, &outcome, idempotency_key.as_deref())
            });

            let mut resp = (StatusCode::OK, Json(body)).into_response();
            if let Ok(value) = HeaderValue::from_str(&session_id) {
                resp.headers_mut()
                    .insert(HeaderName::from_static(SESSION_HEADER), value);
            }
            if let (Some(from), Some(to)) = (collector.fallback_from, collector.fallback_to) {
                if let Ok(value) = HeaderValue::from_str(&format!("{from}->{to}")) {
                    resp.headers_mut()
                        .insert(HeaderName::from_static(FALLBACK_HEADER), value);
                }
            }
            resp
        }
    }
}

/// One iteration of the streaming collection loop. Kept separate from the
/// `tokio::select!` so SSE yields never happen inside a select arm.
enum Progress {
    Continue,
    Delta(String),
    Done,
    Failed(String, String),
}

/// Streaming path: SSE frames — role chunk, content deltas, finish chunk,
/// optional usage chunk, then `[DONE]`. Mid-stream failures emit an
/// OpenAI-shaped error frame before closing. A [`StreamUsageGuard`] inside
/// the stream records partial usage if the client disconnects mid-stream.
async fn stream_completion(
    state: Arc<AppState>,
    key: LlmKeyContext,
    send_task: JoinHandle<Result<reqwest::Response, reqwest::Error>>,
    events: impl futures::Stream<Item = GizziEvent> + Send + 'static,
    started: Instant,
    session_id: String,
    requested_model: String,
    policy: Option<String>,
    routing_decision: Option<RoutingDecision>,
    include_usage: bool,
    idempotency_key: Option<String>,
) -> Response {
    let completion_id = new_completion_id();
    let created = chrono::Utc::now().timestamp();
    let wire_model = requested_model;
    let session_id_for_header = session_id.clone();

    // Client-disconnect metering: the guard lives in the stream and records
    // partial usage on drop unless the normal end path disarms it first.
    let shared_progress = Arc::new(Mutex::new(StreamProgress::default()));
    let mut guard = StreamUsageGuard {
        db: state.db.clone(),
        key: key.clone(),
        session_id: session_id.clone(),
        policy: policy.clone(),
        routing_decision,
        started,
        progress: shared_progress.clone(),
    };

    let stream = async_stream::stream! {
        let mut collector = Collector::new(started);
        let mut send_task = send_task;
        let mut send_done = false;
        let mut failure: Option<(String, String)> = None;
        tokio::pin!(events);
        let deadline = tokio::time::sleep(COMPLETION_TIMEOUT);
        tokio::pin!(deadline);

        yield Ok::<_, Infallible>(Event::default().data(
            ChatCompletionChunk::role_chunk(&completion_id, created, &wire_model).to_sse_data(),
        ));

        'collect: loop {
            let progress = tokio::select! {
                send_result = &mut send_task, if !send_done => {
                    send_done = true;
                    match send_result {
                        Ok(Ok(resp)) if resp.status().is_success() => Progress::Continue,
                        Ok(Ok(resp)) => {
                            let status = resp.status();
                            let body = resp.text().await.unwrap_or_default();
                            Progress::Failed(
                                "upstream_error".to_string(),
                                format!("Gizzi message endpoint returned {status}: {body}"),
                            )
                        }
                        Ok(Err(err)) => Progress::Failed(
                            "upstream_error".to_string(),
                            format!("Failed to send message to Gizzi: {err}"),
                        ),
                        Err(err) => Progress::Failed(
                            "upstream_error".to_string(),
                            format!("Gizzi send task failed: {err}"),
                        ),
                    }
                }
                maybe_event = events.next() => {
                    match maybe_event {
                        Some(event) => {
                            let effect = collector.handle_event(&event);
                            // Keep the disconnect guard's snapshot current.
                            if let Ok(mut snapshot) = shared_progress.lock() {
                                snapshot.sync_from(&collector);
                            }
                            match effect {
                                EventEffect::TextDelta(delta) => Progress::Delta(delta),
                                EventEffect::Done => Progress::Done,
                                EventEffect::Error(name, message) => Progress::Failed(name, message),
                                EventEffect::None => Progress::Continue,
                            }
                        },
                        // The bus never closes in practice; treat as done.
                        None => Progress::Done,
                    }
                }
                _ = &mut deadline => {
                    Progress::Failed(
                        "upstream_error".to_string(),
                        format!("Completion timed out after {}s.", COMPLETION_TIMEOUT.as_secs()),
                    )
                }
            };

            match progress {
                Progress::Continue => {}
                Progress::Delta(delta) => {
                    yield Ok(Event::default().data(
                        ChatCompletionChunk::content_chunk(
                            &completion_id, created, &wire_model, &delta,
                        )
                        .to_sse_data(),
                    ));
                }
                Progress::Done => break 'collect,
                Progress::Failed(name, message) => {
                    failure = Some((name, message));
                    break 'collect;
                }
            }
        }

        let latency_ms = started.elapsed().as_millis() as i64;
        // The stream reached its normal end — the guard must not record.
        if let Ok(mut snapshot) = shared_progress.lock() {
            snapshot.disarmed = true;
        }
        let routing_decision = guard.routing_decision.take();
        let outcome: RequestOutcome;

        match failure.or_else(|| collector.assistant_error.clone()) {
            Some((error_type, message)) => {
                yield Ok(Event::default().data(stream_error_data(
                    &message,
                    &error_type,
                    None,
                )));
                yield Ok(Event::default().data("[DONE]"));
                outcome = RequestOutcome {
                    status: "error",
                    error_type: Some(error_type),
                    usage: collector.usage,
                    policy,
                    fallback_from: collector.fallback_from,
                    gizzi_session_id: Some(session_id),
                    latency_ms,
                    ttft_ms: collector.ttft.map(|d| d.as_millis() as i64),
                    response_body: None,
                    routing_decision,
                };
            }
            None => {
                let finish = map_finish_reason(collector.usage.finish.as_deref());
                yield Ok(Event::default().data(
                    ChatCompletionChunk::finish_chunk(&completion_id, created, &wire_model, finish)
                        .to_sse_data(),
                ));
                if include_usage {
                    let usage = Usage::new(
                        collector.usage.prompt_tokens,
                        collector.usage.completion_tokens,
                        collector.usage.reasoning_tokens,
                        collector.usage.cached_tokens,
                    );
                    yield Ok(Event::default().data(
                        ChatCompletionChunk::usage_chunk(
                            &completion_id, created, &wire_model, usage,
                        )
                        .to_sse_data(),
                    ));
                }
                yield Ok(Event::default().data("[DONE]"));
                outcome = RequestOutcome {
                    status: "ok",
                    error_type: None,
                    usage: collector.usage,
                    policy,
                    fallback_from: collector.fallback_from,
                    gizzi_session_id: Some(session_id),
                    latency_ms,
                    ttft_ms: collector.ttft.map(|d| d.as_millis() as i64),
                    response_body: None,
                    routing_decision,
                };
            }
        }

        // B4: single metering choke point — persists the usage row (with
        // pricing recompute + routing decision) and emits Prometheus series.
        let db = state.db.clone();
        tokio::task::spawn_blocking(move || {
            record_usage_event(&db, &key, &outcome, idempotency_key.as_deref())
        });
    };

    let mut response = Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response();
    if let Ok(value) = HeaderValue::from_str(&session_id_for_header) {
        response
            .headers_mut()
            .insert(HeaderName::from_static(SESSION_HEADER), value);
    }
    response
}

/// `GET /models` — OpenAI model list built from the Gizzi catalog plus the
/// policy aliases, filtered by the key's allowlist.
pub async fn list_models(
    State(_state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    let base = gizzi_base();
    let client = http_client();
    let catalog = match fetch_catalog(&client, &base).await {
        Ok(catalog) => catalog,
        Err(response) => return response.into_response(),
    };

    let mut data: Vec<Value> = Vec::new();
    for alias in POLICY_ALIASES {
        if key.model_allowed(alias) {
            data.push(json!({
                "id": alias,
                "object": "model",
                "created": 0,
                "owned_by": "allternit",
            }));
        }
    }

    let mut entries: Vec<(String, String, i64, Option<ModelLimit>)> = Vec::new();
    for provider in &catalog.all {
        for model_id in provider.models.keys() {
            let full_id = format!("{}/{}", provider.id, model_id);
            if !(key.model_allowed(&full_id) || key.model_allowed(model_id)) {
                continue;
            }
            let created = provider
                .models
                .get(model_id)
                .and_then(|m| m.release_date.as_deref())
                .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
                .and_then(|d| d.and_hms_opt(0, 0, 0))
                .map(|dt| dt.and_utc().timestamp())
                .unwrap_or(0);
            entries.push((
                full_id,
                provider.id.clone(),
                created,
                provider.models.get(model_id).and_then(|model| model.limit),
            ));
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    for (full_id, provider_id, created, limit) in entries {
        data.push(json!({
            "id": full_id,
            "object": "model",
            "created": created,
            "owned_by": provider_id,
            "context_window": limit.map(|value| value.context),
            "max_output_tokens": limit.map(|value| value.output),
        }));
    }

    Json(json!({ "object": "list", "data": data })).into_response()
}

/// `GET /rate-limits` — caller quota snapshot derived from the key's rate
/// limit, key monthly budget, and tenant hard cap (when present).
pub async fn rate_limits(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    let limit = key
        .rate_limit_rpm
        .unwrap_or(super::auth::DEFAULT_RATE_LIMIT_RPM)
        .max(1) as usize;
    let rate = super::auth::rate_limit_status(&key.key_id, limit);

    let budget = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let key = key.clone();
        move || -> Result<super::auth::TokenBudgetStatus, rusqlite::Error> {
            let conn = db.connect()?;
            super::auth::token_budget_status(&conn, &key)
        }
    })
    .await;

    match budget {
        Ok(Ok(budget)) => {
            let reset_at = chrono::Utc::now()
                + chrono::Duration::seconds(rate.reset_in_secs as i64);
            Json(json!({
                "object": "rate_limits",
                "requests_remaining": rate.remaining,
                "requests_limit": rate.limit,
                "tokens_remaining": budget.remaining_cents,
                "tokens_limit": budget.limit_cents,
                "reset_at": reset_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            }))
            .into_response()
        }
        Ok(Err(err)) => {
            warn!(error = %err, "rate_limits DB query failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": {
                        "message": format!("Internal error: {err}"),
                        "type": "server_error",
                    }
                })),
            )
                .into_response()
        }
        Err(err) => {
            warn!(error = %err, "rate_limits task failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": {
                        "message": format!("Internal error: {err}"),
                        "type": "server_error",
                    }
                })),
            )
                .into_response()
        }
    }
}

#[cfg(test)]
mod token_tests {
    use super::*;

    #[test]
    fn token_estimate_is_deterministic_and_rounds_up() {
        let request: ChatCompletionRequest = serde_json::from_value(json!({
            "model": "test/model",
            "messages": [{ "role": "user", "content": "hello" }]
        }))
        .unwrap();
        // "user" + "hello" = 9 characters, rounded up at four chars/token.
        assert_eq!(estimate_tokens(&request), 3);
    }
}
