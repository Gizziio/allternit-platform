//! Wire-level conformance tests for the LLM gateway chat-completions path.
//!
//! The gateway's upstream "provider" in production is the Gizzi runtime, and
//! the chat path is not a plain HTTP proxy: the gateway
//!   1. `POST {gizzi}/v1/session`                        → `{id}` (session create)
//!   2. `GET  {gizzi}/v1/provider`                       → provider/model catalog
//!   3. `POST {gizzi}/v1/session/:id/message`            → 200 (payload: parts,
//!      model {providerID, modelID}, optional system/fallbackModels/…)
//!   4. `GET  {gizzi}/v1/event` (SSE, one process-wide reconnecting stream) —
//!      bus events `{type, properties}` drive the response:
//!      `session.status` (busy/idle), `message.part.delta` (field=text),
//!      `message.updated` (assistant info: tokens/cost/finish/providerID),
//!      `session.error`, `session.model_fallback`.
//!
//! `MockGizzi` below implements exactly those endpoints and mirrors the event
//! shapes the gateway's collector (`llm_gateway/proxy.rs`) consumes. The
//! gateway is pointed at it with the existing `TERMINAL_SERVER_URL` env
//! override (read by `AppConfig::terminal_server_url`), initialized once per
//! test process before `APP_CONFIG` is first touched.
//!
//! Everything is localhost (`127.0.0.1:0`); no external network is used.
//!
//! Beyond the gizzi-protocol cases, the harness covers the gateway's DB-backed
//! wire behaviors: BYOK route credentials (`user_route_credentials`) attached
//! as `provider_credentials` on the upstream payload and stripped on failover
//! to a provider without one, and G13 data-residency enforcement
//! (`data_residency_policies` + `providers.region`) failing a non-compliant
//! candidate set with HTTP 451 `data_residency_violation`.

use std::collections::HashSet;
use std::convert::Infallible;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use allternit_api::db::DbHandle;
use allternit_api::llm_gateway::{self, auth};
use allternit_api::AppState;
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tower::ServiceExt;
use rusqlite::OptionalExtension as _;

// ─── Shared multi-thread runtime ────────────────────────────────────────────
//
// `gizzi_bus::subscribe()` spawns the process-wide event-bus pump on whichever
// runtime is current at first use. A `#[tokio::test]` runtime is torn down
// when that test finishes, which would kill the pump under later tests. All
// conformance tests therefore drive one process-lifetime runtime.

static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("shared test runtime")
    })
}

// ─── Mock Gizzi runtime ─────────────────────────────────────────────────────

/// One recorded `POST /v1/session/:id/message` for test assertions.
#[derive(Debug, Clone)]
struct MessagePost {
    session_id: String,
    provider_id: String,
    model_id: String,
    /// HTTP status the mock returned for this POST.
    returned: u16,
    /// Raw request body (marker substrings are matched against it).
    body: String,
}

#[derive(Default)]
struct MockState {
    /// Serialized bus-event JSON frames, fanned out to `/v1/event` SSE clients.
    events: Option<broadcast::Sender<String>>,
    session_counter: AtomicU64,
    sse_connected: AtomicUsize,
    message_posts: Mutex<Vec<MessagePost>>,
    /// Hash of a `parts` payload that already received its one flaky failure.
    flaky_seen: Mutex<HashSet<String>>,
}

impl MockState {
    fn publish(&self, frame: Value) {
        if let Some(tx) = &self.events {
            let _ = tx.send(frame.to_string());
        }
    }

    /// Posts whose request body contains `marker`.
    fn posts_with(&self, marker: &str) -> Vec<MessagePost> {
        self.message_posts
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .iter()
            .filter(|p| p.body.contains(marker))
            .cloned()
            .collect()
    }
}

/// Marker → the mock fails the FIRST message POST carrying it with a 500,
/// every later POST (the gateway retry resends the same `parts`) succeeds.
const FLAKY_MARKER: &str = "FLAKY500";
/// Marker → the mock answers EVERY message POST with 429 (failover exhausts).
const ALWAYS_429_MARKER: &str = "ALWAYS429";
/// Marker prefix → `DELAY_MS=<n>` sleeps n ms before emitting bus events.
const DELAY_PREFIX: &str = "DELAY_MS=";
/// Marker in the session title → session creation itself fails with a 500.
const SESSFAIL_MARKER: &str = "SESSFAIL";

/// Usage numbers the mock reports, asserted by the conformance cases.
const MOCK_INPUT_TOKENS: i64 = 11;
const MOCK_OUTPUT_TOKENS: i64 = 7;
const MOCK_TEXT: &str = "Hello from the mock gizzi runtime.";

fn completion_events(session_id: &str, provider_id: &str, model_id: &str) -> Vec<Value> {
    let text = MOCK_TEXT;
    let (first, second) = text.split_at(text.len() / 2);
    vec![
        json!({
            "type": "session.status",
            "properties": { "sessionID": session_id, "status": { "type": "busy" } },
        }),
        json!({
            "type": "message.part.delta",
            "properties": { "sessionID": session_id, "field": "text", "delta": first },
        }),
        json!({
            "type": "message.part.delta",
            "properties": { "sessionID": session_id, "field": "text", "delta": second },
        }),
        json!({
            "type": "message.updated",
            "properties": {
                "sessionID": session_id,
                "info": {
                    "role": "assistant",
                    "providerID": provider_id,
                    "modelID": model_id,
                    "tokens": {
                        "input": MOCK_INPUT_TOKENS,
                        "output": MOCK_OUTPUT_TOKENS,
                        "reasoning": 0,
                        "cache": { "read": 0, "write": 0 },
                    },
                    "cost": 0.000123,
                    "finish": "stop",
                },
            },
        }),
        json!({
            "type": "session.status",
            "properties": { "sessionID": session_id, "status": { "type": "idle" } },
        }),
    ]
}

fn parse_delay_ms(body: &str) -> Option<u64> {
    let idx = body.find(DELAY_PREFIX)? + DELAY_PREFIX.len();
    let digits: String = body[idx..].chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

async fn mock_create_session(
    State(state): State<Arc<MockState>>,
    body: String,
) -> Response {
    if body.contains(SESSFAIL_MARKER) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "mock: session creation failed",
        )
            .into_response();
    }
    let n = state.session_counter.fetch_add(1, Ordering::SeqCst);
    let id = format!("sess-mock-{n}");
    (StatusCode::OK, axum::Json(json!({ "id": id }))).into_response()
}

async fn mock_provider_catalog() -> Response {
    // Two connected providers so the gateway's B5 failover chain for an
    // explicit `mock-a/...` request derives `mock-b/model-b` as fallback.
    let catalog = json!({
        "all": [
            { "id": "mock-a", "models": { "model-a": {} } },
            { "id": "mock-b", "models": { "model-b": {} } },
        ],
        "connected": ["mock-a", "mock-b"],
    });
    (StatusCode::OK, axum::Json(catalog)).into_response()
}

async fn mock_send_message(
    State(state): State<Arc<MockState>>,
    axum::extract::Path(session_id): axum::extract::Path<String>,
    body: String,
) -> Response {
    let payload: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let provider_id = payload
        .pointer("/model/providerID")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let model_id = payload
        .pointer("/model/modelID")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();

    let mut returned = 200u16;
    if body.contains(ALWAYS_429_MARKER) {
        returned = 429;
    } else if body.contains(FLAKY_MARKER) {
        // Fail only the first POST for a given `parts` payload: the gateway
        // retry creates a fresh session and re-sends identical parts.
        let parts_key = payload
            .get("parts")
            .map(Value::to_string)
            .unwrap_or_else(|| body.clone());
        let digest = hex::encode(Sha256::digest(parts_key.as_bytes()));
        let mut seen = state.flaky_seen.lock().unwrap_or_else(|p| p.into_inner());
        if !seen.insert(digest) {
            // Already failed once for these parts → serve normally below.
        } else {
            returned = 500;
        }
    }

    state
        .message_posts
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .push(MessagePost {
            session_id: session_id.clone(),
            provider_id: provider_id.clone(),
            model_id: model_id.clone(),
            returned,
            body: body.clone(),
        });

    if returned != 200 {
        let status = match returned {
            429 => StatusCode::TOO_MANY_REQUESTS,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        return (status, format!("mock: message rejected ({returned})")).into_response();
    }

    if let Some(ms) = parse_delay_ms(&body) {
        tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
    }

    for frame in completion_events(&session_id, &provider_id, &model_id) {
        state.publish(frame);
    }
    (StatusCode::OK, axum::Json(json!({ "ok": true }))).into_response()
}

async fn mock_event_bus(State(state): State<Arc<MockState>>) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let tx = state.events.as_ref().expect("bus initialized").clone();
    let mut rx = tx.subscribe();
    state.sse_connected.fetch_add(1, Ordering::SeqCst);
    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(frame) => yield Ok(Event::default().data(frame)),
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
}

struct Fixture {
    state: Arc<MockState>,
    base_url: String,
}

impl Fixture {
    fn posts_with(&self, marker: &str) -> Vec<MessagePost> {
        self.state.posts_with(marker)
    }
}

static FIXTURE: tokio::sync::OnceCell<Fixture> = tokio::sync::OnceCell::const_new();

/// Boot the mock gizzi runtime once per process and point the gateway at it
/// via `TERMINAL_SERVER_URL` (existing `AppConfig` override), initialized
/// before the process-wide `APP_CONFIG`/`gizzi_bus` first use.
async fn fixture() -> &'static Fixture {
    FIXTURE
        .get_or_init(|| async {
            let state = Arc::new(MockState {
                events: Some(broadcast::channel(512).0),
                ..Default::default()
            });
            let app = Router::new()
                .route("/v1/session", post(mock_create_session))
                .route("/v1/provider", get(mock_provider_catalog))
                .route("/v1/session/:id/message", post(mock_send_message))
                .route("/v1/event", get(mock_event_bus))
                .with_state(state.clone());
            let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind mock");
            let addr = listener.local_addr().unwrap();
            tokio::spawn(async move {
                axum::serve(listener, app)
                    .await
                    .expect("mock gizzi server");
            });
            let base_url = format!("http://{addr}");

            std::env::set_var("TERMINAL_SERVER_URL", &base_url);
            // Initialize the process-wide config BEFORE any gateway code reads
            // APP_CONFIG.get() (proxy.rs/gizzi_bus.rs fall back to the hardcoded
            // 127.0.0.1:4096 when the OnceCell is still unset).
            allternit_api::init_app_config();

            // Start the gateway's process-wide bus pump on the shared runtime
            // and wait until its SSE connection to the mock is established, so
            // no bus event published by an early test is missed.
            drop(llm_gateway::gizzi_bus::subscribe().await);
            let fixture = Fixture { state, base_url };
            for _ in 0..200 {
                if fixture.state.sse_connected.load(Ordering::SeqCst) >= 1 {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            }
            assert!(
                fixture.state.sse_connected.load(Ordering::SeqCst) >= 1,
                "gizzi bus pump never connected to the mock"
            );
            fixture
        })
        .await
}

// ─── Gateway test app ───────────────────────────────────────────────────────

/// A fresh in-process gateway: real migrated SQLite schema, real middleware
/// chain (`llm_gateway_router` mounted at `/v1`), seeded virtual key.
struct Gateway {
    state: Arc<AppState>,
    app: Router,
    plaintext_key: String,
    key_id: String,
    unique: String,
}

async fn gateway(key_prefix: &str) -> Gateway {
    let temp = tempfile::tempdir().unwrap().keep();
    let state = allternit_api::test_helpers::app_state(&temp).await;
    let unique = uuid::Uuid::new_v4().to_string();
    let key_id = format!("vk-{unique}");
    let plaintext_key = format!("ak-wire-{unique}");
    let prefix = format!("{key_prefix}{unique}");
    let hash = auth::hash_key(&plaintext_key);
    let conn = state.db.connect().expect("connect");
    conn.execute(
        "INSERT INTO users (id, email) VALUES (?1, ?2)",
        rusqlite::params![format!("user-{unique}"), "wire@example.com"],
    )
    .expect("seed user");
    conn.execute(
        "INSERT INTO llm_virtual_keys (id, user_id, key_hash, key_prefix)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![key_id, format!("user-{unique}"), hash, prefix],
    )
    .expect("seed key");

    let app = Router::new()
        .nest("/v1", llm_gateway::llm_gateway_router(state.clone()))
        .with_state(state.clone());
    Gateway {
        state,
        app,
        plaintext_key,
        key_id,
        unique,
    }
}

fn chat_request(gw: &Gateway, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/v1/chat/completions")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", gw.plaintext_key))
        .body(Body::from(body.to_string()))
        .unwrap()
}

async fn body_json(response: Response) -> Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    serde_json::from_slice(&bytes).expect("body is JSON")
}

async fn body_text(response: Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    String::from_utf8(bytes.to_vec()).expect("body is UTF-8")
}

fn chat_body(model: &str, content: &str, stream: bool) -> Value {
    let mut body = json!({
        "model": model,
        "messages": [{ "role": "user", "content": content }],
    });
    if stream {
        body["stream"] = json!(true);
        body["stream_options"] = json!({ "include_usage": true });
    }
    body
}

/// Poll the migrated SQLite DB until the usage row for `key_id` lands
/// (`record_usage_event` runs on a spawned blocking task).
async fn wait_for_usage(db: &DbHandle, key_id: &str) -> Option<Value> {
    for _ in 0..100 {
        let conn = db.connect().ok()?;
        let row: Option<Value> = conn
            .query_row(
                "SELECT status, error_type, provider_id, model_id, prompt_tokens,
                        completion_tokens, gizzi_session_id, latency_ms
                 FROM llm_usage_events WHERE virtual_key_id = ?1
                 ORDER BY created_at DESC LIMIT 1",
                rusqlite::params![key_id],
                |row: &rusqlite::Row<'_>| {
                    Ok(json!({
                        "status": row.get::<_, String>(0)?,
                        "error_type": row.get::<_, Option<String>>(1)?,
                        "provider_id": row.get::<_, Option<String>>(2)?,
                        "model_id": row.get::<_, Option<String>>(3)?,
                        "prompt_tokens": row.get::<_, i64>(4)?,
                        "completion_tokens": row.get::<_, i64>(5)?,
                        "gizzi_session_id": row.get::<_, Option<String>>(6)?,
                        "latency_ms": row.get::<_, i64>(7)?,
                    }))
                },
            )
            .optional()
            .ok()
            .flatten();
        if row.is_some() {
            return row;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    None
}

async fn usage_count_for_key(db: &DbHandle, key_id: &str) -> i64 {
    let conn = db.connect().expect("connect");
    conn.query_row(
        "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id = ?1",
        rusqlite::params![key_id],
        |row: &rusqlite::Row<'_>| row.get(0),
    )
    .expect("count usage rows")
}

// ─── Cases ──────────────────────────────────────────────────────────────────

/// a. Non-stream happy path: 200, OpenAI-shaped body, usage recorded.
#[test]
fn nonstream_happy_path_records_usage() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", "Say hello, wire conformance a", false),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(
            response
                .headers()
                .contains_key("x-allternit-session-id"),
            "gateway should return the gizzi session id header"
        );
        let body = body_json(response).await;
        assert_eq!(body["object"], "chat.completion");
        assert_eq!(body["model"], "mock-a/model-a");
        assert_eq!(
            body["choices"][0]["message"]["content"],
            MOCK_TEXT,
            "gateway must forward the text collected from bus events"
        );
        assert_eq!(body["choices"][0]["finish_reason"], "stop");
        assert_eq!(body["usage"]["prompt_tokens"], MOCK_INPUT_TOKENS);
        assert_eq!(body["usage"]["completion_tokens"], MOCK_OUTPUT_TOKENS);

        let row = wait_for_usage(&gw.state.db, &gw.key_id)
            .await
            .expect("usage row recorded");
        assert_eq!(row["status"], "ok");
        assert_eq!(row["provider_id"], "mock-a");
        assert_eq!(row["prompt_tokens"], MOCK_INPUT_TOKENS);
        assert_eq!(row["completion_tokens"], MOCK_OUTPUT_TOKENS);
        assert!(
            row["gizzi_session_id"]
                .as_str()
                .is_some_and(|s| s.starts_with("sess-mock-"))
        );
    });
}

/// b. Streaming happy path: SSE role/content/finish chunks, usage event,
/// terminal `[DONE]`, usage recorded.
#[test]
fn streaming_happy_path_forwards_sse_and_usage() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", "Stream hello, wire conformance b", true),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        assert!(
            content_type.starts_with("text/event-stream"),
            "streaming response must be SSE, got {content_type}"
        );

        let raw = body_text(response).await;
        let data_lines: Vec<&str> = raw
            .lines()
            .filter_map(|l| l.strip_prefix("data: "))
            .collect();
        assert!(data_lines.len() >= 5, "expected SSE frames, got:\n{raw}");
        assert_eq!(data_lines.last().copied(), Some("[DONE]"));

        let frames: Vec<Value> = data_lines[..data_lines.len() - 1]
            .iter()
            .map(|d| serde_json::from_str(d).expect("chunk is JSON"))
            .collect();
        for frame in &frames {
            assert_eq!(frame["object"], "chat.completion.chunk");
            assert_eq!(frame["model"], "mock-a/model-a");
        }
        assert_eq!(
            frames[0]["choices"][0]["delta"]["role"],
            "assistant",
            "first chunk must be the role chunk"
        );
        let content_joined: String = frames
            .iter()
            .filter_map(|f| f["choices"][0]["delta"]["content"].as_str())
            .collect();
        assert_eq!(content_joined, MOCK_TEXT);
        assert!(
            frames
                .iter()
                .any(|f| f["choices"][0]["finish_reason"] == "stop"),
            "a chunk must carry finish_reason stop"
        );
        let usage_frame = frames
            .iter()
            .find(|f| f.get("usage").is_some())
            .expect("usage chunk present when stream_options.include_usage");
        assert_eq!(usage_frame["usage"]["prompt_tokens"], MOCK_INPUT_TOKENS);
        assert_eq!(
            usage_frame["usage"]["completion_tokens"],
            MOCK_OUTPUT_TOKENS
        );

        let row = wait_for_usage(&gw.state.db, &gw.key_id)
            .await
            .expect("usage row recorded");
        assert_eq!(row["status"], "ok");
    });
}

/// d. Upstream 500 on the primary, then success on the failover retry:
/// final response is the retried 200 served by the fallback provider, and the
/// recorded usage row names the fallback provider (proving the retry ran).
#[test]
fn upstream_500_then_success_retries_via_fallback() {
    runtime().block_on(async {
        let fx = fixture().await;
        let gw = gateway("wire").await;
        let marker = format!("{FLAKY_MARKER}-{}", gw.unique);
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", &format!("flaky please {marker}"), false),
            ))
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::OK,
            "gateway must retry a retryable upstream failure against its fallback chain"
        );
        let body = body_json(response).await;
        assert_eq!(body["object"], "chat.completion");
        assert_eq!(body["choices"][0]["message"]["content"], MOCK_TEXT);

        let posts = fx.posts_with(&marker);
        assert_eq!(
            posts.len(),
            2,
            "mock must see the primary 500 and the retry POST: {posts:?}"
        );
        assert_eq!(posts[0].returned, 500);
        assert_eq!(posts[0].provider_id, "mock-a");
        assert_eq!(posts[1].returned, 200);
        assert_eq!(
            posts[1].provider_id, "mock-b",
            "retry must be dispatched to the derived fallback provider"
        );

        let row = wait_for_usage(&gw.state.db, &gw.key_id)
            .await
            .expect("usage row recorded");
        assert_eq!(row["status"], "ok");
        assert_eq!(
            row["provider_id"], "mock-b",
            "usage must be attributed to the provider that actually served the retry"
        );
    });
}

/// c. Upstream 429 on every attempt: the gateway retries per its failover
/// policy (default: retried attempts while a fallback remains), then surfaces
/// one terminal OpenAI-shaped 502 with the stable `allternit.upstream_error`
/// code, and records a single error usage row.
#[test]
fn upstream_429_exhausts_failover_and_returns_502() {
    runtime().block_on(async {
        let fx = fixture().await;
        let gw = gateway("wire").await;
        let marker = format!("{ALWAYS_429_MARKER}-{}", gw.unique);
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", &format!("rate limited please {marker}"), false),
            ))
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::BAD_GATEWAY,
            "exhausted upstream failures surface as 502"
        );
        let body = body_json(response).await;
        // 429s are surfaced with a distinct rate-limit error type so the
        // failover cooldown tracker can classify them (P0.1).
        assert_eq!(body["error"]["code"], "allternit.upstream_error");
        assert_eq!(body["error"]["type"], "rate_limit_error");

        // Default policy: one primary + one fallback attempt (the 2-provider
        // catalog yields a single fallback), then the loop gives up.
        let posts = fx.posts_with(&marker);
        assert!(
            posts.len() >= 2,
            "failover policy must retry before giving up: {posts:?}"
        );
        assert!(
            posts.iter().all(|p| p.returned == 429),
            "every attempt hit the 429 fixture: {posts:?}"
        );

        let row = wait_for_usage(&gw.state.db, &gw.key_id)
            .await
            .expect("error usage row recorded");
        assert_eq!(row["status"], "error");
        assert_eq!(row["error_type"], "rate_limit_error");
    });
}

/// e. Request validation error: OpenAI-shaped 4xx with a stable allternit.* code.
#[test]
fn validation_error_has_stable_allternit_code() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                json!({ "model": "mock-a/model-a", "messages": [] }),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = body_json(response).await;
        assert_eq!(body["error"]["type"], "invalid_request_error");
        assert_eq!(body["error"]["code"], "allternit.invalid_request");
        assert_eq!(body["error"]["param"], "messages");
    });
}

/// f. Auth: missing and invalid virtual keys → 401 with stable code.
#[test]
fn auth_missing_and_invalid_key_rejected_401() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;

        let no_header = gw
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/chat/completions")
                    .header("content-type", "application/json")
                    .body(Body::from(chat_body("mock-a/model-a", "hi", false).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(no_header.status(), StatusCode::UNAUTHORIZED);
        let body = body_json(no_header).await;
        assert_eq!(body["error"]["code"], "allternit.authentication_failed");

        let bad_key = gw
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/chat/completions")
                    .header("content-type", "application/json")
                    .header("authorization", "Bearer ak-does-not-exist")
                    .body(Body::from(chat_body("mock-a/model-a", "hi", false).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_key.status(), StatusCode::UNAUTHORIZED);
        let body = body_json(bad_key).await;
        assert_eq!(body["error"]["code"], "allternit.authentication_failed");
    });
}

/// Session-create failure (upstream 500 on `POST /v1/session`): the gateway
/// answers 502 with `allternit.upstream_error`. The failure happens before
/// the idempotency/usage choke point, so NO usage row is recorded — asserted
/// here as the externally visible contract.
#[test]
fn session_create_failure_is_502_and_records_no_usage() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway(SESSFAIL_MARKER).await;
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", "hello, wire conformance sessfail", false),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = body_json(response).await;
        assert_eq!(body["error"]["code"], "allternit.upstream_error");

        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        assert_eq!(
            usage_count_for_key(&gw.state.db, &gw.key_id).await,
            0,
            "session-create failures must not leave a usage row"
        );
    });
}

/// g. BYOK attach/strip (route_credentials): a tenant credential registered
/// for the primary provider rides the first attempt as
/// `provider_credentials.apiKey`; when failover promotes a provider the
/// caller has no credential for, the credential is stripped from the retry
/// payload — a user key never travels to a provider they did not supply it
/// for. The key must also never appear in the client-facing response.
#[test]
fn byok_attached_on_primary_and_stripped_on_failover() {
    runtime().block_on(async {
        let fx = fixture().await;
        let gw = gateway("wire").await;
        let tenant_key = format!("sk-tenant-byok-{}", gw.unique);
        llm_gateway::route_credentials::upsert_credential(
            &gw.state.db,
            &format!("user-{}", gw.unique),
            None,
            "mock-a",
            &tenant_key,
            None,
            Some("wire conformance byok"),
            true,
        )
        .expect("seed tenant credential");

        let marker = format!("{FLAKY_MARKER}-byok-{}", gw.unique);
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", &format!("flaky please {marker}"), false),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body_raw = {
            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read body");
            String::from_utf8(bytes.to_vec()).expect("body is UTF-8")
        };
        assert!(
            !body_raw.contains(&tenant_key),
            "the tenant credential must never leak into the response: {body_raw}"
        );

        let posts = fx.posts_with(&marker);
        assert_eq!(
            posts.len(),
            2,
            "mock must see the primary 500 and the retry POST: {posts:?}"
        );
        assert_eq!(posts[0].provider_id, "mock-a");
        assert!(
            posts[0].body.contains("\"provider_credentials\""),
            "primary attempt must carry provider_credentials: {}",
            posts[0].body
        );
        assert!(
            posts[0].body.contains(&format!("\"apiKey\":\"{tenant_key}\"")),
            "the attached credential must be the tenant key: {}",
            posts[0].body
        );
        assert_eq!(posts[1].provider_id, "mock-b");
        assert!(
            !posts[1].body.contains("provider_credentials"),
            "failover to a provider without a caller credential must strip it: {}",
            posts[1].body
        );
        assert!(
            !posts[1].body.contains(&tenant_key),
            "the tenant key must never ride along to mock-b: {}",
            posts[1].body
        );
    });
}

/// h. Residency → 451 (G13): the org pins inference to `eu`; neither mock
/// provider has a `providers.region` row (so both resolve to `global`, which
/// never satisfies a pin). The request must fail with HTTP 451 and the
/// documented `data_residency_violation` error shape — never routed around.
#[test]
fn residency_violation_returns_451() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;
        let org_id = format!("org-{}", gw.unique);
        {
            let conn = gw.state.db.connect().expect("connect");
            conn.execute(
                "INSERT INTO organizations (id, name) VALUES (?1, 'Wire Org')",
                rusqlite::params![org_id],
            )
            .expect("seed org");
            conn.execute(
                "UPDATE llm_virtual_keys SET tenant_id = ?1 WHERE id = ?2",
                rusqlite::params![org_id, gw.key_id],
            )
            .expect("pin key to org");
            conn.execute(
                "INSERT INTO data_residency_policies
                     (org_id, pinned_regions, default_region, enforce_region_pinning)
                 VALUES (?1, '[\"eu\"]', NULL, 1)",
                rusqlite::params![org_id],
            )
            .expect("seed residency policy");
        }

        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body("mock-a/model-a", "hello, wire conformance residency", false),
            ))
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
            "a fully non-compliant candidate set must fail with 451"
        );
        let body = body_json(response).await;
        assert_eq!(body["error"]["type"], "data_residency_violation");
        assert_eq!(body["error"]["code"], "data_residency_violation");
        assert!(
            body["error"]["message"]
                .as_str()
                .is_some_and(|m| m.contains("eu")),
            "the message must name the pinned regions: {body}"
        );
    });
}

/// Configurable-delay fixture: a slow upstream still completes; the recorded
/// latency reflects the delay.
#[test]
fn configurable_delay_completes() {
    runtime().block_on(async {
        let _fx = fixture().await;
        let gw = gateway("wire").await;
        let response = gw
            .app
            .clone()
            .oneshot(chat_request(
                &gw,
                chat_body(
                    "mock-a/model-a",
                    "take your time DELAY_MS=400",
                    false,
                ),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let row = wait_for_usage(&gw.state.db, &gw.key_id)
            .await
            .expect("usage row recorded");
        assert_eq!(row["status"], "ok");
        assert!(
            row["latency_ms"].as_i64().unwrap_or(0) >= 400,
            "latency_ms must include the upstream delay, got {row:?}"
        );
    });
}
