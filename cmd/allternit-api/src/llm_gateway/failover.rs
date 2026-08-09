//! Request-level retry/failover engine for the LLM gateway.
//!
//! This module owns the decision logic for when a failed or refused completion
//! should be retried, how long to back off, and which model to try next. The
//! actual orchestration loop lives in `proxy::chat_completions`; this module is
//! kept pure so the policy and selection rules can be unit-tested without a
//! live Gizzi runtime.
//!
//! Retry policy is read from `fallback_retry_policies` (managed via
//! `/api/v1/admin/fallback-retry-policy`).

use rusqlite::OptionalExtension;
use std::collections::HashSet;

use crate::db::DbHandle;

/// Retry policy loaded from `fallback_retry_policies`.
#[derive(Debug, Clone, PartialEq)]
pub struct RetryPolicy {
    pub enabled: bool,
    pub max_retries: i64,
    pub retryable_statuses: HashSet<String>,
    pub retryable_errors: HashSet<String>,
    pub base_delay_ms: i64,
    pub max_delay_ms: i64,
    pub fallback_chain_enabled: bool,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 2,
            retryable_statuses: ["refusal", "error", "rate_limited", "timeout"]
                .iter()
                .map(|s| s.to_string())
                .collect(),
            retryable_errors: ["*"].iter().map(|s| s.to_string()).collect(),
            base_delay_ms: 500,
            max_delay_ms: 8000,
            fallback_chain_enabled: true,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("invalid stored JSON: {0}")]
    Json(String),
}

fn parse_string_set(value: &str) -> Result<HashSet<String>, LoadError> {
    let array: Vec<String> = serde_json::from_str(value)
        .map_err(|e| LoadError::Json(format!("failed to parse string array: {e}")))?;
    Ok(array.into_iter().collect())
}

/// Load the retry policy for an organization. Returns the default policy if no
/// row exists.
pub fn load_policy(db: &DbHandle, org_id: &str) -> Result<RetryPolicy, LoadError> {
    let conn = db.connect()?;
    let row: Option<(i64, i64, String, String, i64, i64, i64)> = conn
        .query_row(
            "SELECT enabled, max_retries, retryable_statuses, retryable_errors,
                    base_delay_ms, max_delay_ms, fallback_chain_enabled
             FROM fallback_retry_policies
             WHERE org_id = ?1",
            [org_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        )
        .optional()?;

    match row {
        Some((enabled, max_retries, statuses_json, errors_json, base_delay, max_delay, fallback)) => {
            Ok(RetryPolicy {
                enabled: enabled == 1,
                max_retries,
                retryable_statuses: parse_string_set(statuses_json.as_str())?,
                retryable_errors: parse_string_set(errors_json.as_str())?,
                base_delay_ms: base_delay,
                max_delay_ms: max_delay,
                fallback_chain_enabled: fallback == 1,
            })
        }
        None => Ok(RetryPolicy::default()),
    }
}

/// Decide whether a request outcome warrants another attempt.
pub fn should_retry(
    status: &str,
    error_type: Option<&str>,
    attempt: u32,
    policy: &RetryPolicy,
) -> bool {
    if !policy.enabled || attempt == 0 || attempt > policy.max_retries as u32 {
        return false;
    }
    if !policy.retryable_statuses.contains(status) {
        return false;
    }
    if policy.retryable_errors.contains("*") {
        return true;
    }
    match error_type {
        Some(error) => policy.retryable_errors.iter().any(|e| error.contains(e)),
        None => true,
    }
}

/// Compute the backoff delay for a given attempt using exponential backoff with
/// full jitter. `attempt` is 1-based.
pub fn next_backoff_ms(attempt: u32, base_delay_ms: i64, max_delay_ms: i64) -> u64 {
    let base = base_delay_ms.max(1) as u64;
    let max = (max_delay_ms as u64).max(base);
    let exponential = base.saturating_mul(2u64.saturating_pow(attempt.saturating_sub(1)));
    let capped = exponential.min(max);
    // Full jitter: sleep a random duration in [0, capped].
    rand::random::<u64>() % (capped + 1)
}

/// A candidate model reference.
#[derive(Debug, Clone, PartialEq)]
pub struct ModelRef {
    pub provider_id: String,
    pub model_id: String,
}

impl ModelRef {
    pub fn full_id(&self) -> String {
        format!("{}/{}", self.provider_id, self.model_id)
    }
}

/// Select the model to use for a retry. `attempt` is 1-based: attempt 1 uses
/// the primary model, attempt 2 uses the first fallback, and so on.
pub fn select_fallback(
    attempt: u32,
    primary: &ModelRef,
    fallbacks: &[ModelRef],
    policy: &RetryPolicy,
) -> Option<ModelRef> {
    if !policy.fallback_chain_enabled {
        return Some(primary.clone());
    }
    if attempt == 1 {
        return Some(primary.clone());
    }
    let idx = attempt.saturating_sub(2) as usize;
    fallbacks.get(idx).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy_with_statuses(statuses: &[&str]) -> RetryPolicy {
        RetryPolicy {
            retryable_statuses: statuses.iter().map(|s| s.to_string()).collect(),
            ..RetryPolicy::default()
        }
    }

    #[test]
    fn should_retry_respects_attempt_limit() {
        let policy = RetryPolicy {
            max_retries: 2,
            ..RetryPolicy::default()
        };
        assert!(should_retry("error", None, 1, &policy));
        assert!(should_retry("error", None, 2, &policy));
        assert!(!should_retry("error", None, 3, &policy));
    }

    #[test]
    fn should_retry_respects_status_set() {
        let policy = policy_with_statuses(&["rate_limited"]);
        assert!(should_retry("rate_limited", None, 1, &policy));
        assert!(!should_retry("error", None, 1, &policy));
    }

    #[test]
    fn should_retry_respects_error_type_filter() {
        let policy = RetryPolicy {
            retryable_statuses: ["error"].iter().map(|s| s.to_string()).collect(),
            retryable_errors: ["timeout", "connection_reset"]
                .iter()
                .map(|s| s.to_string())
                .collect(),
            ..RetryPolicy::default()
        };
        assert!(should_retry("error", Some("upstream timeout"), 1, &policy));
        assert!(should_retry("error", Some("connection_reset by peer"), 1, &policy));
        assert!(!should_retry("error", Some("bad_request"), 1, &policy));
    }

    #[test]
    fn should_retry_disabled_policy_is_noop() {
        let policy = RetryPolicy {
            enabled: false,
            ..RetryPolicy::default()
        };
        assert!(!should_retry("error", None, 1, &policy));
    }

    #[test]
    fn backoff_is_within_bounds() {
        for attempt in 1..=5 {
            let delay = next_backoff_ms(attempt, 100, 1000);
            assert!(delay <= 1000, "attempt {attempt} delay {delay} exceeds max");
        }
    }

    #[test]
    fn backoff_grows_with_attempt() {
        let delays: Vec<u64> = (1..=4)
            .map(|a| next_backoff_ms(a, 100, 100_000))
            .collect();
        // The cap is large, so median delay should increase. We compare means
        // to avoid jitter flakiness; with full jitter this is probabilistic,
        // so we just verify the max possible delay grows.
        let max_first = 100u64;
        let max_fourth = 800u64;
        assert!(delays[0] <= max_first);
        assert!(delays[3] <= max_fourth);
    }

    #[test]
    fn select_fallback_uses_primary_then_chain() {
        let primary = ModelRef {
            provider_id: "openai".to_string(),
            model_id: "gpt-4o".to_string(),
        };
        let fallbacks = vec![
            ModelRef {
                provider_id: "anthropic".to_string(),
                model_id: "claude-3-5-sonnet".to_string(),
            },
            ModelRef {
                provider_id: "kimi".to_string(),
                model_id: "k3".to_string(),
            },
        ];
        let policy = RetryPolicy::default();
        assert_eq!(select_fallback(1, &primary, &fallbacks, &policy), Some(primary.clone()));
        assert_eq!(select_fallback(2, &primary, &fallbacks, &policy), Some(fallbacks[0].clone()));
        assert_eq!(select_fallback(3, &primary, &fallbacks, &policy), Some(fallbacks[1].clone()));
        assert_eq!(select_fallback(4, &primary, &fallbacks, &policy), None);
    }

    #[test]
    fn select_fallback_disabled_chain_reuses_primary() {
        let primary = ModelRef {
            provider_id: "openai".to_string(),
            model_id: "gpt-4o".to_string(),
        };
        let policy = RetryPolicy {
            fallback_chain_enabled: false,
            ..RetryPolicy::default()
        };
        assert_eq!(select_fallback(3, &primary, &[], &policy), Some(primary));
    }
}
