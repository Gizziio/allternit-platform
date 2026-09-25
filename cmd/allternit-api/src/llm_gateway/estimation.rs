//! Token & Cost Estimation API (A9).
//!
//! Provides token counting and cost estimation for chat completions requests
//! without actually executing them. Mounted under `/v1` by the LLM gateway
//! router.
//!
//! Endpoints:
//! - `POST /v1/estimates/tokens` — estimate tokens for a messages array
//! - `POST /v1/estimates/cost` — estimate cost for a completion request

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tiktoken_rs::CoreBPE;

use crate::AppState;

use super::{
    auth::LlmKeyContext,
    llm_pricing,
    translate::{ChatMessage, OpenAiErrorResponse},
};

// ─── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TokenEstimateRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub tools: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct CostEstimateRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub tools: Option<Vec<serde_json::Value>>,
}

// ─── Token estimation ───────────────────────────────────────────────────────

/// BPE instances are expensive to build; initialize each encoding at most
/// once per process and reuse it for every estimate.
static CL100K_BPE: Lazy<Option<CoreBPE>> = Lazy::new(|| tiktoken_rs::cl100k_base().ok());
static O200K_BPE: Lazy<Option<CoreBPE>> = Lazy::new(|| tiktoken_rs::o200k_base().ok());

/// Map a model id to its BPE encoding. `o200k_base` covers the GPT-4o/4.1/5
/// and o-series families; `cl100k_base` covers GPT-4/3.5 and embeddings and
/// is the default for unknown model ids.
fn encoding_for_model(model: &str) -> Option<&'static CoreBPE> {
    let model = model
        .strip_prefix("openai/")
        .or_else(|| model.strip_prefix("azure/"))
        .unwrap_or(model)
        .to_ascii_lowercase();
    let is_o200k = model.contains("gpt-4o")
        || model.contains("gpt-4.1")
        || model.contains("gpt-5")
        || model.contains("chatgpt-4o")
        || ["o1", "o3", "o4"]
            .iter()
            .any(|prefix| model.starts_with(prefix));
    let bpe = if is_o200k { &*O200K_BPE } else { &*CL100K_BPE };
    bpe.as_ref()
}

/// Exact BPE token count for `text` under the model's encoding, or `None`
/// when the encoding failed to initialize.
fn encode_count(model: &str, text: &str) -> Option<u64> {
    encoding_for_model(model).map(|bpe| bpe.encode_ordinary(text).len() as u64)
}

/// Estimate token count from message text using the model's BPE tokenizer.
/// Falls back to the ~4 chars/token heuristic only if tokenizer init failed.
fn estimate_message_tokens(model: &str, messages: &[ChatMessage]) -> u64 {
    let mut total: u64 = 0;
    // Per-message overhead: 4 tokens for role/delimiter framing.
    for msg in messages {
        total += 4;
        let text = msg.content_text();
        total += estimate_text_tokens(model, &text);
        if msg.name.is_some() {
            total += 1;
        }
    }
    // Assistant priming overhead.
    total += 2;
    total
}

fn estimate_text_tokens(model: &str, text: &str) -> u64 {
    encode_count(model, text).unwrap_or_else(|| heuristic_text_tokens(text))
}

/// Provider-independent fallback: 1 token per ~4 characters.
fn heuristic_text_tokens(text: &str) -> u64 {
    ((text.len() as u64) + 3) / 4
}

fn estimate_tool_tokens(model: &str, tools: &[serde_json::Value]) -> u64 {
    let mut total: u64 = 0;
    for tool in tools {
        // Each tool definition adds ~80-120 tokens of schema overhead.
        let tool_text = serde_json::to_string(tool).unwrap_or_default();
        total += estimate_text_tokens(model, &tool_text);
        total += 10; // per-tool framing overhead
    }
    total
}

/// Estimate output tokens based on max_tokens or a heuristic default.
fn estimate_output_tokens(max_tokens: Option<u32>, _messages: &[ChatMessage]) -> u64 {
    max_tokens.unwrap_or(512) as u64
}

// ─── Cost lookup ────────────────────────────────────────────────────────────

/// Per-model pricing in cents per million tokens (input, output).
/// Falls back to generic pricing when the model is not in the cache.
fn model_pricing(model: &str) -> (f64, f64) {
    // Try the llm_pricing cache first.
    let snapshot = llm_pricing::pricing_snapshot();
    if let Some(price) = llm_pricing::find_pricing(&snapshot, "", model) {
        return (price.input * 100.0, price.output * 100.0);
    }
    // Fallback defaults (cents per million tokens).
    match model {
        m if m.contains("gpt-4") => (300.0, 600.0),
        m if m.contains("gpt-3.5") => (50.0, 150.0),
        m if m.contains("embedding") => (2.0, 0.0),
        _ => (100.0, 300.0),
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// `POST /v1/estimates/tokens` — estimate token count for a messages array.
pub async fn estimate_tokens(
    State(_state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<TokenEstimateRequest>,
) -> Response {
    if body.messages.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`messages` must contain at least one message.",
            Some("messages"),
        )
        .into_response();
    }

    let message_tokens = estimate_message_tokens(&body.model, &body.messages);
    let tool_tokens = body
        .tools
        .as_ref()
        .map(|t| estimate_tool_tokens(&body.model, t))
        .unwrap_or(0);
    let total_input = message_tokens + tool_tokens;

    (
        StatusCode::OK,
        Json(json!({
            "object": "token_estimate",
            "model": body.model,
            "input_tokens": total_input,
            "details": {
                "message_tokens": message_tokens,
                "tool_tokens": tool_tokens,
            },
        })),
    )
        .into_response()
}

/// `POST /v1/estimates/cost` — estimate cost for a completion request.
pub async fn estimate_cost(
    State(_state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<CostEstimateRequest>,
) -> Response {
    if body.messages.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`messages` must contain at least one message.",
            Some("messages"),
        )
        .into_response();
    }

    let message_tokens = estimate_message_tokens(&body.model, &body.messages);
    let tool_tokens = body
        .tools
        .as_ref()
        .map(|t| estimate_tool_tokens(&body.model, t))
        .unwrap_or(0);
    let input_tokens = message_tokens + tool_tokens;
    let output_tokens = estimate_output_tokens(body.max_tokens, &body.messages);

    let (input_price_cents_per_m, output_price_cents_per_m) = model_pricing(&body.model);
    let input_cost_cents = (input_tokens as f64 / 1_000_000.0) * input_price_cents_per_m;
    let output_cost_cents = (output_tokens as f64 / 1_000_000.0) * output_price_cents_per_m;
    let total_cost_cents = input_cost_cents + output_cost_cents;

    (
        StatusCode::OK,
        Json(json!({
            "object": "cost_estimate",
            "model": body.model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "cost": {
                "input_cents": input_cost_cents,
                "output_cents": output_cost_cents,
                "total_cents": total_cost_cents,
                "currency": "USD",
            },
            "details": {
                "message_tokens": message_tokens,
                "tool_tokens": tool_tokens,
                "pricing": {
                    "input_per_million_tokens": input_price_cents_per_m,
                    "output_per_million_tokens": output_price_cents_per_m,
                },
            },
        })),
    )
        .into_response()
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm_gateway::translate::MessageContent;

    fn make_messages(texts: &[&str]) -> Vec<ChatMessage> {
        texts
            .iter()
            .enumerate()
            .map(|(i, t)| ChatMessage {
                role: if i % 2 == 0 {
                    "user".to_string()
                } else {
                    "assistant".to_string()
                },
                content: Some(MessageContent::Text(t.to_string())),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                cache_control: None,
                cache: None,
            })
            .collect()
    }

    #[test]
    fn token_estimate_includes_overhead() {
        let messages = make_messages(&["Hello world"]);
        // cl100k encodes "Hello world" as ["Hello", " world"] = 2 tokens.
        // 4 overhead + 2 + 2 priming = 8.
        let tokens = estimate_message_tokens("gpt-4", &messages);
        assert_eq!(tokens, 8);
    }

    #[test]
    fn cl100k_known_answers() {
        // Canonical tiktoken cl100k_base ids.
        assert_eq!(
            encode_count("gpt-4", "hello world"),
            Some(2) // [15339, 1917]
        );
        assert_eq!(
            encode_count("gpt-3.5-turbo", "hello world!"),
            Some(3) // [15339, 1917, 0]
        );
        assert_eq!(encode_count("gpt-4", ""), Some(0));
    }

    #[test]
    fn o200k_known_answers() {
        // Canonical tiktoken o200k_base ids.
        assert_eq!(
            encode_count("gpt-4o", "hello world"),
            Some(2) // [24912, 2375]
        );
        assert_eq!(
            encode_count("gpt-4o-mini", "hello world!"),
            Some(3) // [24912, 2375, 0]
        );
        assert_eq!(encode_count("o1-preview", "hello world"), Some(2));
        assert_eq!(encode_count("openai/gpt-4o", "hello world"), Some(2));
    }

    #[test]
    fn unknown_model_uses_cl100k() {
        assert_eq!(
            encode_count("some-unknown-model", "hello world!"),
            Some(3) // same ids as cl100k: [15339, 1917, 0]
        );
    }

    #[test]
    fn heuristic_fallback_matches_chars_rule() {
        assert_eq!(heuristic_text_tokens("hello"), 2);
        assert_eq!(heuristic_text_tokens(""), 0);
        assert_eq!(heuristic_text_tokens("abcdefghijklmnop"), 4);
        // The estimators fall back to this only when the BPE failed to init.
        assert!(encode_count("gpt-4", "hello").is_some());
    }

    #[test]
    fn o200k_differs_from_heuristic() {
        // A real BPE count must not equal the 4-chars/token guess in general.
        let text = "The quick brown fox jumps over the lazy dog, again and again.";
        assert_ne!(
            estimate_text_tokens("gpt-4o", text),
            heuristic_text_tokens(text)
        );
    }
}
