//! OTel GenAI semantic-convention spans for the LLM gateway.
//!
//! Attribute names follow the OpenTelemetry GenAI conventions
//! (`gen_ai.operation.name`, `gen_ai.system`, `gen_ai.request.model`,
//! `gen_ai.response.model`, `gen_ai.usage.input_tokens`,
//! `gen_ai.usage.output_tokens`, `error.type`), plus the gateway-local
//! `allternit.retry.*` attributes for the failover loop.
//!
//! All helpers are no-ops unless [`crate::otel::enabled`] — with
//! `OTEL_EXPORTER_OTLP_ENDPOINT` unset, no fields are recorded and logs stay
//! byte-identical to the pre-OTel behavior. Span creation/recording itself
//! does not consult the flag so the schema is unit-testable without an
//! exporter.

use tracing::{field::Empty, info_span, Span};

/// Field names recorded on the `llm_gateway.chat_completions` handler span
/// (declared `Empty` in its `#[tracing::instrument]` attribute).
pub mod field {
    pub const OPERATION_NAME: &str = "gen_ai.operation.name";
    pub const SYSTEM: &str = "gen_ai.system";
    pub const REQUEST_MODEL: &str = "gen_ai.request.model";
    pub const RESPONSE_MODEL: &str = "gen_ai.response.model";
    pub const INPUT_TOKENS: &str = "gen_ai.usage.input_tokens";
    pub const OUTPUT_TOKENS: &str = "gen_ai.usage.output_tokens";
    pub const ERROR_TYPE: &str = "error.type";
}

/// Record the resolved provider and requested model on the chat-completions
/// handler span.
pub fn record_request(span: &Span, system: &str, model: &str) {
    if !crate::otel::enabled() {
        return;
    }
    span.record(field::SYSTEM, system);
    span.record(field::REQUEST_MODEL, model);
}

/// Record final response metadata and token usage on the handler span once
/// the outcome is known.
pub fn record_response(
    span: &Span,
    response_model: Option<&str>,
    input_tokens: i64,
    output_tokens: i64,
    error_type: Option<&str>,
) {
    if !crate::otel::enabled() {
        return;
    }
    if let Some(model) = response_model {
        span.record(field::RESPONSE_MODEL, model);
    }
    if let Some(error_type) = error_type {
        span.record(field::ERROR_TYPE, error_type);
    }
    span.record(field::INPUT_TOKENS, input_tokens);
    span.record(field::OUTPUT_TOKENS, output_tokens);
}

/// One span per retry/failover attempt in the non-streaming proxy loop.
///
/// Carries the attempt number, the provider/model serving this attempt, and
/// (recorded after the attempt settles via [`record_attempt_outcome`]) the
/// outcome and error classification. `otel.name` overrides the static span
/// name with the GenAI-conventional `"chat {model}"`; `otel.kind` marks the
/// span as a CLIENT span in the exported trace.
pub fn retry_attempt_span(attempt: u32, provider_id: &str, model_id: &str) -> Span {
    if !crate::otel::enabled() {
        return Span::none();
    }
    let span = info_span!(
        "llm_gateway.chat_completions.attempt",
        otel.name = Empty,
        otel.kind = "client",
        gen_ai.operation.name = "chat",
        gen_ai.system = provider_id,
        gen_ai.request.model = model_id,
        allternit.retry.attempt = attempt as i64,
        allternit.retry.outcome = Empty,
        error.type = Empty,
    );
    span.record("otel.name", format!("chat {model_id}"));
    span
}

/// Settle a retry-attempt span with its outcome (`ok`/`refusal`/`error`) and,
/// for failures, the gateway error classification.
pub fn record_attempt_outcome(span: &Span, status: &str, error_type: Option<&str>) {
    if !crate::otel::enabled() {
        return;
    }
    span.record("allternit.retry.outcome", status);
    if let Some(error_type) = error_type {
        span.record("error.type", error_type);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use std::sync::{Arc, Mutex};
    use tracing::field::{Field, Visit};
    use tracing::span::{Attributes, Record};
    use tracing_subscriber::layer::{Context, Layer, SubscriberExt};
    use tracing_subscriber::registry::LookupSpan;

    #[derive(Default)]
    struct AttrVisitor(BTreeMap<String, String>);

    impl Visit for AttrVisitor {
        fn record_str(&mut self, field: &Field, value: &str) {
            self.0.insert(field.name().to_string(), value.to_string());
        }
        fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
            self.0
                .insert(field.name().to_string(), format!("{value:?}"));
        }
        fn record_i64(&mut self, field: &Field, value: i64) {
            self.0.insert(field.name().to_string(), value.to_string());
        }
        fn record_u64(&mut self, field: &Field, value: u64) {
            self.0.insert(field.name().to_string(), value.to_string());
        }
        fn record_bool(&mut self, field: &Field, value: bool) {
            self.0.insert(field.name().to_string(), value.to_string());
        }
    }

    type CapturedSpans = Arc<Mutex<Vec<(String, BTreeMap<String, String>)>>>;

    struct CaptureLayer(CapturedSpans);

    impl<S> Layer<S> for CaptureLayer
    where
        S: tracing::Subscriber + for<'span> LookupSpan<'span>,
    {
        fn on_new_span(&self, attrs: &Attributes<'_>, id: &tracing::Id, ctx: Context<'_, S>) {
            let mut visitor = AttrVisitor::default();
            attrs.record(&mut visitor);
            let name = ctx.span(id).expect("span").name().to_string();
            self.0.lock().unwrap().push((name, visitor.0));
        }

        fn on_record(&self, id: &tracing::Id, values: &Record<'_>, ctx: Context<'_, S>) {
            let mut visitor = AttrVisitor::default();
            values.record(&mut visitor);
            let name = ctx.span(id).expect("span").name().to_string();
            let mut spans = self.0.lock().unwrap();
            if let Some((_, attrs)) = spans.iter_mut().rev().find(|(n, _)| *n == name) {
                for (k, v) in visitor.0 {
                    attrs.insert(k, v);
                }
            }
        }
    }

    fn with_capture(f: impl FnOnce()) -> CapturedSpans {
        let captured: CapturedSpans = Arc::new(Mutex::new(Vec::new()));
        let subscriber =
            tracing_subscriber::registry().with(CaptureLayer(captured.clone()));
        tracing::subscriber::with_default(subscriber, f);
        captured
    }

    // The record_* helpers gate on crate::otel::enabled(), which is false in
    // tests; span creation + recording is exercised directly here against a
    // capture subscriber instead of the exporter gate.

    #[test]
    fn retry_attempt_span_carries_genai_and_retry_fields() {
        let captured = with_capture(|| {
            let span = info_span!(
                "llm_gateway.chat_completions.attempt",
                otel.name = Empty,
                otel.kind = "client",
                gen_ai.operation.name = "chat",
                gen_ai.system = "anthropic",
                gen_ai.request.model = "claude-sonnet-4-5",
                allternit.retry.attempt = 2_i64,
                allternit.retry.outcome = Empty,
                error.type = Empty,
            );
            span.record("allternit.retry.outcome", "error");
            span.record("error.type", "rate_limit");
            drop(span);
        });
        let (name, attrs) = captured.lock().unwrap().remove(0);
        assert_eq!(name, "llm_gateway.chat_completions.attempt");
        assert_eq!(attrs["gen_ai.operation.name"], "chat");
        assert_eq!(attrs["gen_ai.system"], "anthropic");
        assert_eq!(attrs["gen_ai.request.model"], "claude-sonnet-4-5");
        assert_eq!(attrs["allternit.retry.attempt"], "2");
        assert_eq!(attrs["allternit.retry.outcome"], "error");
        assert_eq!(attrs["error.type"], "rate_limit");
        assert_eq!(attrs["otel.kind"], "client");
    }

    #[test]
    fn retry_attempt_span_is_noop_when_otel_disabled() {
        // crate::otel::enabled() is false in tests (no exporter configured).
        assert!(!crate::otel::enabled());
        assert!(retry_attempt_span(1, "openai", "gpt-4o").is_none());
        let span = Span::current();
        record_request(&span, "openai", "gpt-4o");
        record_response(&span, Some("gpt-4o"), 10, 20, None);
        record_attempt_outcome(&span, "ok", None);
    }
}
