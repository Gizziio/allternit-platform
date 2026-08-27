//! Partial / Best-of Sampling (A17).
//!
//! Allows clients to request multiple candidate completions for the same
//! prompt, with optional early stopping of lower-quality candidates.
//! Mounted under `/v1` by the LLM gateway router.
//!
//! This extends the standard chat completions API with:
//! - `best_of: N` — generate N candidates and return the best
//! - `partial: true` — return candidates as they complete (streaming)
//!
//! Endpoints:
//! - `POST /v1/chat/completions/best_of` — best-of-N sampling
//! - `POST /v1/chat/completions/partial` — partial/streaming best-of

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::convert::Infallible;
use std::sync::Arc;

use crate::AppState;

use super::{
    auth::LlmKeyContext,
    translate::{ChatCompletionRequest, OpenAiErrorResponse},
};

// ─── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BestOfRequest {
    #[serde(flatten)]
    pub completion: ChatCompletionRequest,
    /// Number of candidate completions to generate. Must be 2-10.
    pub best_of: u32,
    /// Scoring method for selecting the best candidate.
    #[serde(default = "default_scoring")]
    pub scoring: String,
}

fn default_scoring() -> String {
    "logprob".to_string()
}

#[derive(Debug, Deserialize)]
pub struct PartialRequest {
    #[serde(flatten)]
    pub completion: ChatCompletionRequest,
    /// Number of candidates to generate concurrently.
    pub candidates: u32,
    /// Return candidates as they finish (true) or wait for all (false).
    #[serde(default = "default_true")]
    pub streaming: bool,
}

fn default_true() -> bool {
    true
}

// ─── Response types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BestOfResponse {
    pub id: String,
    pub object: &'static str,
    pub created: i64,
    pub model: String,
    pub candidates: Vec<Candidate>,
    pub selected: usize,
    pub selection_reason: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct Candidate {
    pub index: usize,
    pub message: CandidateMessage,
    pub finish_reason: String,
    pub logprobs: Option<f64>,
    pub tokens: CandidateTokens,
}

#[derive(Debug, Serialize, Clone)]
pub struct CandidateMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CandidateTokens {
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
}

// ─── Scoring ────────────────────────────────────────────────────────────────

fn select_best(candidates: &[Candidate], scoring: &str) -> (usize, String) {
    if candidates.is_empty() {
        return (0, "empty".to_string());
    }

    match scoring {
        "length" => {
            let idx = candidates
                .iter()
                .enumerate()
                .max_by_key(|(_, c)| c.message.content.len())
                .map(|(i, _)| i)
                .unwrap_or(0);
            (idx, "longest_response".to_string())
        }
        "shortest" => {
            let idx = candidates
                .iter()
                .enumerate()
                .min_by_key(|(_, c)| c.message.content.len())
                .map(|(i, _)| i)
                .unwrap_or(0);
            (idx, "shortest_response".to_string())
        }
        _ => {
            // Default: highest logprob score.
            let idx = candidates
                .iter()
                .enumerate()
                .max_by(|(_, a), (_, b)| {
                    a.logprobs
                        .unwrap_or(f64::NEG_INFINITY)
                        .partial_cmp(&b.logprobs.unwrap_or(f64::NEG_INFINITY))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|(i, _)| i)
                .unwrap_or(0);
            (idx, "highest_logprob".to_string())
        }
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/// `POST /v1/chat/completions/best_of` — generate N candidates and select the best.
pub async fn best_of_completions(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<BestOfRequest>,
) -> Response {
    if !(2..=10).contains(&body.best_of) {
        return OpenAiErrorResponse::invalid_request(
            "`best_of` must be between 2 and 10.",
            Some("best_of"),
        )
        .into_response();
    }

    match body.scoring.as_str() {
        "logprob" | "length" | "shortest" => {}
        _ => {
            return OpenAiErrorResponse::invalid_request(
                "`scoring` must be `logprob`, `length`, or `shortest`.",
                Some("scoring"),
            )
            .into_response();
        }
    }

    let created = chrono::Utc::now().timestamp();
    let id = format!("bestof_{}", uuid::Uuid::new_v4().simple());

    // Generate N candidate responses.
    // In production, each candidate would be an independent LLM call.
    // For now, generate deterministic placeholder candidates.
    let prompt_text = body
        .completion
        .messages
        .last()
        .map(|m| m.content_text())
        .unwrap_or_default();

    let candidates: Vec<Candidate> = (0..body.best_of)
        .map(|i| {
            let variation_seed = (i * 31 + prompt_text.len() as u32) as usize;
            let content = format!(
                "Candidate {idx}/{total} for: \"{prompt}\" (seed: {seed})",
                idx = i + 1,
                total = body.best_of,
                prompt = if prompt_text.len() > 50 {
                    format!("{}...", &prompt_text[..47])
                } else {
                    prompt_text.clone()
                },
                seed = variation_seed,
            );
            let completion_tokens = (content.len() as u64 + 3) / 4;
            let prompt_tokens = (prompt_text.len() as u64 + 3) / 4;

            Candidate {
                index: i as usize,
                message: CandidateMessage {
                    role: "assistant".to_string(),
                    content,
                },
                finish_reason: "stop".to_string(),
                logprobs: Some(-(0.5 + (i as f64) * 0.3)),
                tokens: CandidateTokens {
                    prompt_tokens,
                    completion_tokens,
                    total_tokens: prompt_tokens + completion_tokens,
                },
            }
        })
        .collect();

    let (selected, selection_reason) = select_best(&candidates, &body.scoring);

    let _ = state; // suppress unused warning

    (
        StatusCode::OK,
        Json(json!({
            "id": id,
            "object": "chat.completion.best_of",
            "created": created,
            "model": body.completion.model,
            "candidates": candidates,
            "selected": selected,
            "selection_reason": selection_reason,
            "usage": {
                "prompt_tokens": candidates.first().map(|c| c.tokens.prompt_tokens).unwrap_or(0),
                "completion_tokens": candidates.iter().map(|c| c.tokens.completion_tokens).sum::<u64>(),
                "total_tokens": candidates.iter().map(|c| c.tokens.total_tokens).sum::<u64>(),
            },
        })),
    )
        .into_response()
}

/// `POST /v1/chat/completions/partial` — streaming best-of sampling.
pub async fn partial_completions(
    State(state): State<Arc<AppState>>,
    Extension(_key): Extension<LlmKeyContext>,
    Json(body): Json<PartialRequest>,
) -> Response {
    if !(1..=10).contains(&body.candidates) {
        return OpenAiErrorResponse::invalid_request(
            "`candidates` must be between 1 and 10.",
            Some("candidates"),
        )
        .into_response();
    }

    let created = chrono::Utc::now().timestamp();
    let id = format!("partial_{}", uuid::Uuid::new_v4().simple());

    let prompt_text = body
        .completion
        .messages
        .last()
        .map(|m| m.content_text())
        .unwrap_or_default();

    if body.streaming {
        // Stream candidates as SSE events.
        let model = body.completion.model.clone();
        let num_candidates = body.candidates;
        let id_clone = id.clone();

        let stream = async_stream::stream! {
            for i in 0..num_candidates {
                let content = format!(
                    "Partial candidate {}/{} for: \"{prompt}\"",
                    i + 1,
                    num_candidates,
                    prompt = if prompt_text.len() > 50 {
                        format!("{}...", &prompt_text[..47])
                    } else {
                        prompt_text.clone()
                    },
                );
                let event = Event::default()
                    .json_data(json!({
                        "id": id_clone,
                        "object": "chat.completion.partial",
                        "created": created,
                        "model": model,
                        "candidate": {
                            "index": i,
                            "message": {
                                "role": "assistant",
                                "content": content,
                            },
                            "finish_reason": "stop",
                        },
                    }))
                    .unwrap_or_else(|_| Event::default().data(""));
                yield Ok::<_, Infallible>(event);
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            yield Ok(Event::default().data("[DONE]"));
        };

        Sse::new(stream)
            .keep_alive(KeepAlive::default())
            .into_response()
    } else {
        // Non-streaming: return all candidates at once.
        let candidates: Vec<serde_json::Value> = (0..body.candidates)
            .map(|i| {
                json!({
                    "index": i,
                    "message": {
                        "role": "assistant",
                        "content": format!(
                            "Partial candidate {}/{} for: \"{prompt}\"",
                            i + 1,
                            body.candidates,
                            prompt = if prompt_text.len() > 50 {
                                format!("{}...", &prompt_text[..47])
                            } else {
                                prompt_text.clone()
                            },
                        ),
                    },
                    "finish_reason": "stop",
                })
            })
            .collect();

        let _ = state;

        (
            StatusCode::OK,
            Json(json!({
                "id": id,
                "object": "chat.completion.partial",
                "created": created,
                "model": body.completion.model,
                "candidates": candidates,
            })),
        )
            .into_response()
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn select_best_by_length() {
        let candidates = vec![
            Candidate {
                index: 0,
                message: CandidateMessage {
                    role: "assistant".into(),
                    content: "short".into(),
                },
                finish_reason: "stop".into(),
                logprobs: None,
                tokens: CandidateTokens {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            },
            Candidate {
                index: 1,
                message: CandidateMessage {
                    role: "assistant".into(),
                    content: "this is a much longer response".into(),
                },
                finish_reason: "stop".into(),
                logprobs: None,
                tokens: CandidateTokens {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            },
        ];
        let (idx, reason) = select_best(&candidates, "length");
        assert_eq!(idx, 1);
        assert_eq!(reason, "longest_response");
    }

    #[test]
    fn select_best_by_logprob() {
        let candidates = vec![
            Candidate {
                index: 0,
                message: CandidateMessage {
                    role: "assistant".into(),
                    content: "a".into(),
                },
                finish_reason: "stop".into(),
                logprobs: Some(-1.5),
                tokens: CandidateTokens {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            },
            Candidate {
                index: 1,
                message: CandidateMessage {
                    role: "assistant".into(),
                    content: "b".into(),
                },
                finish_reason: "stop".into(),
                logprobs: Some(-0.5),
                tokens: CandidateTokens {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            },
        ];
        let (idx, reason) = select_best(&candidates, "logprob");
        assert_eq!(idx, 1);
        assert_eq!(reason, "highest_logprob");
    }
}
