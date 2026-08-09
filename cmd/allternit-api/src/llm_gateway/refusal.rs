//! Cross-provider refusal detection for the LLM gateway.
//!
//! Providers signal refusals in different ways:
//! - OpenAI: `finish_reason: "content_filter"` or a `refusal` field.
//! - Anthropic / Kimi / others: refusal text embedded in the assistant message.
//!
//! This module normalizes those signals so the proxy can surface a consistent
//! `refusal` field and `finish_reason: "refusal"` to downstream clients.

/// Provider finish reasons that unambiguously indicate a refusal.
pub const REFUSAL_FINISH_REASONS: &[&str] = &["content_filter"];

/// Case-insensitive textual markers that strongly suggest a refusal. These are
/// intentionally conservative; partial matches are allowed at word boundaries.
const REFUSAL_MARKERS: &[&str] = &[
    "i can't",
    "i cannot",
    "i can not",
    "i'm not able",
    "i am not able",
    "i'm unable",
    "i am unable",
    "i can't assist",
    "i cannot assist",
    "i can't help",
    "i cannot help",
    "i'm sorry, but i can't",
    "i'm sorry, but i cannot",
    "i apologize, but i can't",
    "i apologize, but i cannot",
    "i'm not able to fulfill",
    "i cannot fulfill",
    "i can't fulfill",
    "as an ai",
    "i'm not able to assist",
];

/// Returns `Some("refusal")` when the accumulated assistant content contains a
/// refusal marker. Returns `None` otherwise.
pub fn detect_refusal(content: &str) -> Option<&'static str> {
    let lower = content.to_lowercase();
    for marker in REFUSAL_MARKERS {
        if lower.contains(marker) {
            return Some("refusal");
        }
    }
    None
}

/// Returns `true` if the upstream finish reason is a known refusal signal.
pub fn is_refusal_finish_reason(finish_reason: &str) -> bool {
    REFUSAL_FINISH_REASONS
        .iter()
        .any(|r| r.eq_ignore_ascii_case(finish_reason))
}

/// Given the upstream finish reason and accumulated assistant content, decide
/// the normalized finish reason for the downstream response.
pub fn normalized_finish_reason(finish_reason: Option<&str>, content: &str) -> String {
    if finish_reason.map(is_refusal_finish_reason).unwrap_or(false) {
        return "refusal".to_string();
    }
    if detect_refusal(content).is_some() {
        return "refusal".to_string();
    }
    finish_reason.map(map_finish_reason).unwrap_or_else(|| "stop".to_string())
}

/// Map common upstream finish reason strings to a normalized value.
fn map_finish_reason(reason: &str) -> String {
    match reason.to_lowercase().as_str() {
        "stop" | "end_turn" => "stop".to_string(),
        "length" | "max_tokens" => "length".to_string(),
        "content_filter" | "content-filter" => "refusal".to_string(),
        "tool_calls" | "function_call" => "tool_calls".to_string(),
        _ => reason.to_string(),
    }
}

/// Human-readable refusal text used when a provider signal is detected but no
/// explicit message is available.
pub fn refusal_message() -> &'static str {
    "The model declined to produce output for this request."
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_common_refusal_phrases() {
        assert!(detect_refusal("I can't help with that.").is_some());
        assert!(detect_refusal("I'm sorry, but I cannot assist.").is_some());
        assert!(detect_refusal("As an AI, I am not able to do this.").is_some());
    }

    #[test]
    fn ignores_non_refusal_content() {
        assert!(detect_refusal("Here is the code you requested.").is_none());
        assert!(detect_refusal("I can help with that.").is_none());
    }

    #[test]
    fn content_filter_maps_to_refusal() {
        assert_eq!(
            normalized_finish_reason(Some("content_filter"), ""),
            "refusal"
        );
        assert_eq!(
            normalized_finish_reason(Some("content-filter"), ""),
            "refusal"
        );
    }

    #[test]
    fn refusal_text_overrides_stop() {
        assert_eq!(
            normalized_finish_reason(Some("stop"), "I cannot assist with that."),
            "refusal"
        );
    }

    #[test]
    fn normal_finish_reasons_preserved() {
        assert_eq!(normalized_finish_reason(Some("stop"), "hello"), "stop");
        assert_eq!(normalized_finish_reason(Some("length"), "hello"), "length");
        assert_eq!(
            normalized_finish_reason(Some("tool_calls"), "hello"),
            "tool_calls"
        );
    }
}
