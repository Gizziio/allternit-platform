//! Data-residency enforcement for the LLM gateway (task G13).
//!
//! `data_residency_routes.rs` lets org admins pin inference to a set of
//! regions (`data_residency_policies.pinned_regions` +
//! `enforce_region_pinning`). This module is the enforcement half: after the
//! gateway resolves a request to a primary model + failover chain, candidates
//! are filtered to providers whose region satisfies the org's policy.
//!
//! Region source: `providers.region` (V149), matched by Gizzi provider id.
//! The column defaults to `'global'` (unknown geography). A provider with no
//! `providers` row — or a `'global'` region — never satisfies a pinned
//! policy: the request fails honestly instead of silently routing around the
//! pin. An org whose policy does not enforce pinning (no row, empty
//! `pinned_regions`, or `enforce_region_pinning = 0`) is unrestricted and
//! every candidate passes through unchanged.
//!
//! Policy loading is cached per org (`POLICY_CACHE_TTL`, currently 10 s) so
//! the hot path does not hit SQLite per request; `data_residency_routes` and
//! the gateway admin surface invalidate the org's entry on every policy
//! write, so a pin takes effect on the next request after the write commits.
//! Provider region lookups are one small indexed query per request.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::http::StatusCode;
use once_cell::sync::Lazy;
use rusqlite::{params, OptionalExtension};

use crate::db::DbHandle;

use super::failover::ModelRef;
use super::translate::{OpenAiErrorResponse, error_code};

/// How long a loaded residency policy is served from the per-org cache before
/// re-reading `data_residency_policies`. Writes invalidate immediately; this
/// TTL only bounds staleness from out-of-band edits.
pub const POLICY_CACHE_TTL: Duration = Duration::from_secs(10);

/// The enforcement-relevant view of one org's data-residency policy row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResidencyPolicy {
    pub pinned_regions: Vec<String>,
    pub enforce: bool,
}

impl ResidencyPolicy {
    /// Whether this policy restricts provider selection at all.
    pub fn is_restrictive(&self) -> bool {
        self.enforce && !self.pinned_regions.is_empty()
    }
}

static POLICY_CACHE: Lazy<Mutex<HashMap<String, (Instant, Option<ResidencyPolicy>)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Drop the cached policy for `org_id`. Called after every policy write so a
/// pin (or its removal) applies to the very next request.
pub fn invalidate_policy_cache(org_id: &str) {
    let mut cache = POLICY_CACHE.lock().unwrap_or_else(|p| p.into_inner());
    cache.remove(org_id);
}

/// Load the org's residency policy, served from the short-TTL per-org cache
/// when fresh. A missing row is unrestricted (`None`) and also cached.
pub fn load_policy(db: &DbHandle, org_id: &str) -> rusqlite::Result<Option<ResidencyPolicy>> {
    {
        let cache = POLICY_CACHE.lock().unwrap_or_else(|p| p.into_inner());
        if let Some((loaded, policy)) = cache.get(org_id) {
            if loaded.elapsed() < POLICY_CACHE_TTL {
                return Ok(policy.clone());
            }
        }
    }

    let conn = db.connect()?;
    let row: Option<(String, i64)> = conn
        .query_row(
            "SELECT pinned_regions, enforce_region_pinning
             FROM data_residency_policies WHERE org_id = ?1",
            params![org_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let policy = row.map(|(pinned_raw, enforce)| ResidencyPolicy {
        pinned_regions: serde_json::from_str(&pinned_raw).unwrap_or_default(),
        enforce: enforce != 0,
    });
    let mut cache = POLICY_CACHE.lock().unwrap_or_else(|p| p.into_inner());
    cache.insert(org_id.to_string(), (Instant::now(), policy.clone()));
    Ok(policy)
}

/// Look up the residency region for each provider id. Providers absent from
/// the `providers` table resolve to `DEFAULT_REGION` (unknown/global).
pub fn provider_regions(
    conn: &rusqlite::Connection,
    provider_ids: &[&str],
) -> rusqlite::Result<HashMap<String, String>> {
    let mut regions = HashMap::new();
    for id in provider_ids {
        let region: Option<String> = conn
            .query_row(
                "SELECT region FROM providers WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;
        regions.insert(
            id.to_string(),
            region.unwrap_or_else(|| DEFAULT_REGION.to_string()),
        );
    }
    Ok(regions)
}

/// Region assigned to providers with no `providers` row (or a NULL region).
pub const DEFAULT_REGION: &str = "global";

/// Error returned when residency filtering leaves no usable candidate.
#[derive(Debug, thiserror::Error)]
#[error("no provider candidate satisfies the data-residency policy (pinned regions: {0:?})")]
pub struct ResidencyViolation(pub Vec<String>);

impl ResidencyViolation {
    /// The 451-style gateway error. The message names the pinned regions so
    /// the caller knows exactly what to fix.
    pub fn to_error_response(&self) -> OpenAiErrorResponse {
        OpenAiErrorResponse::new(
            StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS,
            format!(
                "Data residency violation: this organization pinned inference to [{}], \
                 and no candidate provider for the requested model reports a compliant region.",
                self.0.join(", ")
            ),
            "data_residency_violation",
            None,
            Some(error_code::DATA_RESIDENCY_VIOLATION),
        )
    }
}

/// Outcome of applying an org's residency policy to a resolved request.
#[derive(Debug, Clone, PartialEq)]
pub struct ResidencyOutcome {
    pub primary: ModelRef,
    /// Failover chain, already stripped of non-compliant providers. Empty
    /// when the policy disabled failover or nothing compliant remains.
    pub fallbacks: Vec<ModelRef>,
    /// True when the policy restricted the candidate set (primary promoted
    /// from the chain or fallbacks dropped).
    pub filtered: bool,
}

/// Apply `org_id`'s residency policy to a resolved primary + failover chain.
///
/// - Unrestricted policy (or `org_id = None`): everything passes through
///   unchanged.
/// - Restrictive policy: candidates whose `providers.region` is not in
///   `pinned_regions` are dropped, including every failover entry — a
///   fallback provider violating the pin is skipped like any non-compliant
///   candidate. When the primary is dropped, the first compliant fallback is
///   promoted to primary.
/// - When no candidate is compliant, `ResidencyViolation` is returned; the
///   caller must fail the request — never route around the pin.
pub fn apply_policy(
    conn: &rusqlite::Connection,
    policy: Option<&ResidencyPolicy>,
    primary: &ModelRef,
    fallbacks: &[ModelRef],
) -> Result<ResidencyOutcome, ResidencyViolation> {
    let Some(policy) = policy.filter(|p| p.is_restrictive()) else {
        return Ok(ResidencyOutcome {
            primary: primary.clone(),
            fallbacks: fallbacks.to_vec(),
            filtered: false,
        });
    };

    let mut ids: Vec<&str> = vec![primary.provider_id.as_str()];
    for fallback in fallbacks {
        if !ids.contains(&fallback.provider_id.as_str()) {
            ids.push(fallback.provider_id.as_str());
        }
    }
    let regions = provider_regions(conn, &ids).unwrap_or_default();

    let compliant = |provider_id: &str| {
        regions
            .get(provider_id)
            .is_some_and(|region| policy.pinned_regions.iter().any(|pinned| pinned == region))
    };

    let compliant_fallbacks: Vec<ModelRef> = fallbacks
        .iter()
        .filter(|f| compliant(&f.provider_id))
        .cloned()
        .collect();

    if compliant(&primary.provider_id) {
        let filtered = compliant_fallbacks.len() != fallbacks.len();
        return Ok(ResidencyOutcome {
            primary: primary.clone(),
            fallbacks: compliant_fallbacks,
            filtered,
        });
    }

    if let Some(promoted) = compliant_fallbacks.first() {
        return Ok(ResidencyOutcome {
            primary: promoted.clone(),
            fallbacks: compliant_fallbacks.iter().skip(1).cloned().collect(),
            filtered: true,
        });
    }

    Err(ResidencyViolation(policy.pinned_regions.clone()))
}

/// Async wrapper: load the policy (cached) and apply it to the resolved
/// request. DB work runs on the blocking pool. Returns `Ok(None)` when the
/// org is unrestricted; `Ok(Some(outcome))` when the policy shaped the
/// candidate set; `Err` on violation or internal failure.
pub async fn enforce(
    db: &DbHandle,
    org_id: Option<&str>,
    primary: &ModelRef,
    fallbacks: &[ModelRef],
) -> Result<Option<ResidencyOutcome>, OpenAiErrorResponse> {
    let Some(org_id) = org_id.filter(|id| !id.is_empty()) else {
        return Ok(None);
    };
    let db = db.clone();
    let org_id = org_id.to_string();
    let org_for_log = org_id.clone();
    let primary = primary.clone();
    let fallbacks = fallbacks.to_vec();
    let result = tokio::task::spawn_blocking(move || -> rusqlite::Result<_> {
        let policy = load_policy(&db, &org_id)?;
        let conn = db.connect()?;
        let outcome = apply_policy(&conn, policy.as_ref(), &primary, &fallbacks);
        Ok((policy, outcome))
    })
    .await;

    match result {
        Ok(Ok((policy, outcome))) => match outcome {
            Ok(outcome) => Ok(match policy.as_ref().filter(|p| p.is_restrictive()) {
                Some(_) => Some(outcome),
                None => None,
            }),
            Err(violation) => Err(violation.to_error_response()),
        },
        Ok(Err(err)) => {
            tracing::warn!(error = %err, org_id = %org_for_log, "data-residency enforcement failed");
            Err(OpenAiErrorResponse::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal error: {err}"),
                "server_error",
                None,
                Some(error_code::INTERNAL_ERROR),
            ))
        }
        Err(err) => Err(OpenAiErrorResponse::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal error: {err}"),
            "server_error",
            None,
            Some(error_code::INTERNAL_ERROR),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> DbHandle {
        DbHandle::new_memory().unwrap()
    }

    fn seed_policy(conn: &rusqlite::Connection, org: &str, pinned: &[&str], enforce: bool) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            params![org],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO data_residency_policies
                 (org_id, pinned_regions, default_region, enforce_region_pinning)
             VALUES (?1, ?2, NULL, ?3)",
            params![
                org,
                serde_json::to_string(pinned).unwrap(),
                if enforce { 1 } else { 0 }
            ],
        )
        .unwrap();
    }

    fn set_provider_region(conn: &rusqlite::Connection, id: &str, region: &str) {
        conn.execute(
            "UPDATE providers SET region = ?2 WHERE id = ?1",
            params![id, region],
        )
        .unwrap();
    }

    fn model_ref(provider: &str, model: &str) -> ModelRef {
        ModelRef {
            provider_id: provider.to_string(),
            model_id: model.to_string(),
        }
    }

    fn restricted_policy() -> ResidencyPolicy {
        ResidencyPolicy {
            pinned_regions: vec!["us-east-1".to_string()],
            enforce: true,
        }
    }

    #[test]
    fn unrestricted_policy_passes_candidates_through() {
        let db = test_db();
        let conn = db.connect().unwrap();
        let primary = model_ref("anthropic", "claude-x");
        let fallbacks = vec![model_ref("openai", "gpt-x")];
        let outcome = apply_policy(&conn, None, &primary, &fallbacks).unwrap();
        assert_eq!(outcome.primary, primary);
        assert_eq!(outcome.fallbacks, fallbacks);
        assert!(!outcome.filtered);

        // Policy row exists but enforcement off → unrestricted.
        seed_policy(&conn, "org-loose", &["us-east-1"], false);
        let policy = load_policy(&db, "org-loose").unwrap().unwrap();
        assert!(!policy.is_restrictive());
        let outcome = apply_policy(&conn, Some(&policy), &primary, &fallbacks).unwrap();
        assert!(!outcome.filtered);
    }

    #[test]
    fn pinned_region_allows_compliant_provider() {
        let db = test_db();
        let conn = db.connect().unwrap();
        set_provider_region(&conn, "anthropic", "us-east-1");

        let primary = model_ref("anthropic", "claude-x");
        let fallbacks = vec![
            model_ref("openai", "gpt-x"),       // 'global' → dropped
            model_ref("anthropic", "claude-y"), // compliant, kept
        ];
        let outcome = apply_policy(&conn, Some(&restricted_policy()), &primary, &fallbacks).unwrap();
        assert_eq!(outcome.primary, primary);
        assert_eq!(
            outcome.fallbacks,
            vec![model_ref("anthropic", "claude-y")]
        );
        assert!(outcome.filtered, "non-compliant fallback must be dropped");
    }

    #[test]
    fn pinned_region_blocks_non_compliant_primary_and_promotes() {
        let db = test_db();
        let conn = db.connect().unwrap();
        set_provider_region(&conn, "anthropic", "us-east-1");
        set_provider_region(&conn, "openai", "eu-west-1");

        // Winner is non-compliant; a compliant fallback is promoted.
        let primary = model_ref("openai", "gpt-x");
        let fallbacks = vec![
            model_ref("anthropic", "claude-x"),
            model_ref("openai", "gpt-y"),
        ];
        let outcome = apply_policy(&conn, Some(&restricted_policy()), &primary, &fallbacks).unwrap();
        assert_eq!(outcome.primary, model_ref("anthropic", "claude-x"));
        assert!(outcome
            .fallbacks
            .iter()
            .all(|f| f.provider_id != "openai"));
        assert!(outcome.filtered);
    }

    #[test]
    fn violation_error_when_no_candidate_compliant() {
        let db = test_db();
        let conn = db.connect().unwrap();
        set_provider_region(&conn, "openai", "eu-west-1");

        let primary = model_ref("openai", "gpt-x");
        let fallbacks = vec![model_ref("custom", "local-x")]; // no providers row → 'global'
        let err = apply_policy(&conn, Some(&restricted_policy()), &primary, &fallbacks)
            .unwrap_err();
        assert_eq!(err.0, vec!["us-east-1".to_string()]);
        let response = err.to_error_response();
        assert_eq!(response.status, StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS);
        assert_eq!(
            response.error.code.as_deref(),
            Some(error_code::DATA_RESIDENCY_VIOLATION)
        );
        assert!(response.error.message.contains("us-east-1"));
    }

    #[test]
    fn failover_chain_skips_non_compliant_fallback() {
        let db = test_db();
        let conn = db.connect().unwrap();
        set_provider_region(&conn, "anthropic", "us-east-1");

        // Primary compliant; the first fallback violates the pin and must be
        // skipped like any non-compliant candidate.
        let primary = model_ref("anthropic", "claude-x");
        let fallbacks = vec![
            model_ref("openai", "gpt-x"),
            model_ref("anthropic", "claude-y"),
        ];
        let outcome = apply_policy(&conn, Some(&restricted_policy()), &primary, &fallbacks).unwrap();
        assert_eq!(outcome.fallbacks, vec![model_ref("anthropic", "claude-y")]);
    }

    #[test]
    fn policy_cache_serves_and_invalidates() {
        let db = test_db();
        let unique = format!("org-cache-{}", uuid::Uuid::new_v4());
        let conn = db.connect().unwrap();

        // First load caches "unrestricted".
        assert_eq!(load_policy(&db, &unique).unwrap(), None);

        // Direct DB write (bypassing the invalidation hook) stays stale —
        // proving the cache is actually consulted.
        seed_policy(&conn, &unique, &["us-east-1"], true);
        assert_eq!(load_policy(&db, &unique).unwrap(), None);

        // The write path's invalidation hook makes the next load fresh.
        invalidate_policy_cache(&unique);
        let policy = load_policy(&db, &unique).unwrap().unwrap();
        assert_eq!(policy.pinned_regions, vec!["us-east-1".to_string()]);
        assert!(policy.is_restrictive());
    }

    #[test]
    fn provider_regions_resolve_missing_to_global() {
        let db = test_db();
        let conn = db.connect().unwrap();
        set_provider_region(&conn, "anthropic", "us-east-1");
        // Duplicate ids collapse; a provider with no row resolves to 'global'.
        let regions = provider_regions(&conn, &["anthropic", "anthropic", "missing"]).unwrap();
        assert_eq!(regions.len(), 2);
        assert_eq!(regions["anthropic"], "us-east-1");
        assert_eq!(regions["missing"], DEFAULT_REGION);
    }
}
