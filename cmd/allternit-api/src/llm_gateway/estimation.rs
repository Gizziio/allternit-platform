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
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

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

/// Estimate token count from message text using a heuristic (~4 chars/token).
/// In production, this would use provider-specific tokenizers via tiktoken-rs.
fn estimate_message_tokens(messages: &[ChatMessage]) -> u64 {
    let mut total: u64 = 0;
    // Per-message overhead: 4 tokens for role/delimiter framing.
    for msg in messages {
        total += 4;
        let text = msg.content_text();
        total += estimate_text_tokens(&text);
        if msg.name.is_some() {
            total += 1;
        }
    }
    // Assistant priming overhead.
    total += 2;
    total
}

fn estimate_text_tokens(text: &str) -> u64 {
    // Approximate: 1 token per ~4 characters (GPT-family heuristic).
    ((text.len() as u64) + 3) / 4
}

fn estimate_tool_tokens(tools: &[serde_json::Value]) -> u64 {
    let mut total: u64 = 0;
    for tool in tools {
        // Each tool definition adds ~80-120 tokens of schema overhead.
        let tool_text = serde_json::to_string(tool).unwrap_or_default();
        total += estimate_text_tokens(&tool_text);
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

    let message_tokens = estimate_message_tokens(&body.messages);
    let tool_tokens = body
        .tools
        .as_ref()
        .map(|t| estimate_tool_tokens(t))
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

    let message_tokens = estimate_message_tokens(&body.messages);
    let tool_tokens = body
        .tools
        .as_ref()
        .map(|t| estimate_tool_tokens(t))
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
        let tokens = estimate_message_tokens(&messages);
        // 4 overhead + ~3 for "Hello world" + 2 priming = ~9
        assert!(tokens >= 7 && tokens <= 15);
    }

    #[test]
    fn text_token_estimate_reasonable() {
        assert_eq!(estimate_text_tokens("hello"), 2); // 5 chars → 2 tokens
        assert_eq!(estimate_text_tokens(""), 0);
        assert_eq!(estimate_text_tokens("abcdefghijklmnop"), 4); // 16 chars → 4 tokens
    }
}
