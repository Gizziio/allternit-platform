//! Provider routing policies: Hermes Agent-style `provider_routing`
//! (Allternit Brain `Products/ProviderRouting.md`), re-platformed as a
//! tenant-scoped Allternit Cloud policy.
//!
//! The policy controls *which backend provider* serves a model request when
//! the platform proxies to an OpenAI-compatible aggregator
//! (OpenRouter-style): `sort` (price/throughput/latency), `only`/`ignore`
//! (whitelist/blacklist), `order` (priority with unlisted providers as
//! fallbacks), `require_parameters`, and `data_collection`. A `models` map
//! pins any of those per model id; unset keys fall through to the flat
//! values.
//!
//! Orthogonal to B5 model routing (`router.rs`): the router decides *which
//! model* serves a request; this module decides *which provider serves that
//! model*. The override follows the currently-active resolved model —
//! primary and every failover attempt each resolve their own pin.
//!
//! Resolution output is the top-level `provider` object forwarded on the
//! wire (via the Gizzi session-message payload). An entirely-empty policy
//! resolves to `None` and the key is omitted from the payload.

use std::collections::BTreeMap;

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::benchmarks::normalize_model_id;
use crate::db::DbHandle;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sort {
    Price,
    Throughput,
    Latency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataCollection {
    Allow,
    Deny,
}

/// Per-model override: same keys as the flat policy; every field optional so
/// unset keys fall through to the flat defaults at resolution time.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ModelOverride {
    pub sort: Option<Sort>,
    #[serde(default)]
    pub only: Vec<String>,
    #[serde(default)]
    pub ignore: Vec<String>,
    #[serde(default)]
    pub order: Vec<String>,
    pub require_parameters: Option<bool>,
    pub data_collection: Option<DataCollection>,
}

/// Flat + per-model provider routing policy (one row per tenant).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ProviderRoutingPolicy {
    pub sort: Option<Sort>,
    #[serde(default)]
    pub only: Vec<String>,
    #[serde(default)]
    pub ignore: Vec<String>,
    #[serde(default)]
    pub order: Vec<String>,
    pub require_parameters: Option<bool>,
    pub data_collection: Option<DataCollection>,
    /// Model id → override. Matching is spelling-tolerant
    /// (`benchmarks::normalize_model_id`), with or without provider/`openrouter/`
    /// prefixes.
    #[serde(default)]
    pub models: BTreeMap<String, ModelOverride>,
}

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("invalid stored JSON: {0}")]
    Json(String),
}

/// Provider slugs: lowercase OpenRouter-style ids (`anthropic`, `google`,
/// `amazon-bedrock`), 1-64 chars, no whitespace.
fn validate_slug(slug: &str) -> Result<(), String> {
    if slug.is_empty() || slug.len() > 64 {
        return Err(format!("Provider slug `{slug}` must be 1-64 characters."));
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    {
        return Err(format!(
            "Provider slug `{slug}` must be lowercase letters, digits, `-` or `_`."
        ));
    }
    Ok(())
}

fn validate_slug_list(key: &str, slugs: &[String]) -> Result<(), String> {
    for slug in slugs {
        validate_slug(slug).map_err(|err| format!("`{key}`: {err}"))?;
    }
    Ok(())
}

/// Validate an incoming policy body (admin API). Returns the canonical policy.
pub fn validate(value: &Value) -> Result<ProviderRoutingPolicy, String> {
    let policy: ProviderRoutingPolicy = serde_json::from_value(value.clone())
        .map_err(|err| format!("Invalid provider routing policy: {err}"))?;

    validate_slug_list("only", &policy.only)?;
    validate_slug_list("ignore", &policy.ignore)?;
    validate_slug_list("order", &policy.order)?;
    let overlap: Vec<_> = policy
        .only
        .iter()
        .filter(|slug| policy.ignore.contains(slug))
        .cloned()
        .collect();
    if !overlap.is_empty() {
        return Err(format!(
            "`only` and `ignore` must not overlap: {overlap:?}."
        ));
    }
    for slug in &policy.order {
        if policy.ignore.contains(slug) {
            return Err(format!(
                "`order` provider `{slug}` is also in `ignore`."
            ));
        }
    }
    for (model, override_) in &policy.models {
        if model.is_empty() || model.len() > 128 {
            return Err(format!("`models` key `{model}` must be 1-128 characters."));
        }
        validate_slug_list(&format!("models.{model}.only"), &override_.only)?;
        validate_slug_list(&format!("models.{model}.ignore"), &override_.ignore)?;
        validate_slug_list(&format!("models.{model}.order"), &override_.order)?;
    }
    Ok(policy)
}

/// Load the provider routing policy for a tenant. A tenant-specific row wins;
/// absent that, the NULL-tenant (platform-global) row applies. Returns `None`
/// when neither exists.
pub fn load_policy(db: &DbHandle, tenant_id: &str) -> Result<Option<ProviderRoutingPolicy>, LoadError> {
    let conn = db.connect()?;
    let stored: Option<String> = match conn
        .query_row(
            "SELECT policy FROM llm_provider_routing_policies WHERE tenant_id = ?1",
            params![tenant_id],
            |row| row.get(0),
        )
        .optional()?
    {
        Some(policy) => Some(policy),
        None => conn
            .query_row(
                "SELECT policy FROM llm_provider_routing_policies WHERE tenant_id IS NULL",
                [],
                |row| row.get(0),
            )
            .optional()?,
    };
    match stored {
        Some(json) => serde_json::from_str(&json).map(Some).map_err(|err| {
            LoadError::Json(format!("llm_provider_routing_policies row: {err}"))
        }),
        None => Ok(None),
    }
}

/// Upsert the policy for a tenant (`None` = platform-global row).
pub fn save_policy(
    db: &DbHandle,
    tenant_id: Option<&str>,
    policy: &ProviderRoutingPolicy,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    let json = serde_json::to_string(policy).expect("ProviderRoutingPolicy serializes");
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM llm_provider_routing_policies WHERE tenant_id IS ?1",
            params![tenant_id],
            |row| row.get(0),
        )
        .optional()?;
    match existing {
        Some(id) => conn.execute(
            "UPDATE llm_provider_routing_policies
             SET policy = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, json],
        )?,
        None => conn.execute(
            "INSERT INTO llm_provider_routing_policies (id, tenant_id, policy)
             VALUES (?1, ?2, ?3)",
            params![uuid::Uuid::new_v4().to_string(), tenant_id, json],
        )?,
    };
    Ok(())
}

/// The candidate ids a model can be known by, most specific first.
fn candidate_ids(provider_id: &str, model_id: &str) -> Vec<String> {
    vec![
        format!("{provider_id}/{model_id}"),
        format!("openrouter/{provider_id}/{model_id}"),
        model_id.to_string(),
    ]
}

/// Find the `models` override entry for a provider/model pair, if any.
/// Spelling-tolerant like Hermes' per-model overrides: exact match on any
/// candidate form, then normalized (dash/dot/prefix-insensitive) equality.
/// Deterministic when several keys normalize equal: lexicographically
/// smallest key wins.
fn find_override<'a>(
    models: &'a BTreeMap<String, ModelOverride>,
    provider_id: &str,
    model_id: &str,
) -> Option<&'a ModelOverride> {
    let candidates = candidate_ids(provider_id, model_id);
    for candidate in &candidates {
        if let Some(override_) = models.get(candidate) {
            return Some(override_);
        }
    }
    let normalized: Vec<String> = candidates.iter().map(|id| normalize_model_id(id)).collect();
    let mut matches: Vec<(&String, &ModelOverride)> = models
        .iter()
        .filter(|(key, _)| normalized.contains(&normalize_model_id(key)))
        .collect();
    matches.sort_by(|a, b| a.0.cmp(b.0));
    matches.first().map(|(_, override_)| *override_)
}

/// Resolve the effective routing for the currently-active model: the model
/// override replaces any flat value it sets; everything else falls through.
/// Returns the wire `provider` object, or `None` when the policy is empty for
/// this model (caller omits the key).
pub fn resolve_for_model(policy: &ProviderRoutingPolicy, provider_id: &str, model_id: &str) -> Option<Value> {
    let empty = ModelOverride::default();
    let override_ = find_override(&policy.models, provider_id, model_id).unwrap_or(&empty);

    let sort = override_.sort.or(policy.sort);
    let only = if !override_.only.is_empty() { &override_.only } else { &policy.only };
    let ignore = if !override_.ignore.is_empty() { &override_.ignore } else { &policy.ignore };
    let order = if !override_.order.is_empty() { &override_.order } else { &policy.order };
    let require_parameters = override_.require_parameters.or(policy.require_parameters);
    let data_collection = override_.data_collection.or(policy.data_collection);

    if sort.is_none()
        && only.is_empty()
        && ignore.is_empty()
        && order.is_empty()
        && require_parameters.is_none()
        && data_collection.is_none()
    {
        return None;
    }

    let mut object = serde_json::Map::new();
    if let Some(sort) = sort {
        object.insert("sort".into(), json!(sort));
    }
    if !only.is_empty() {
        object.insert("only".into(), json!(only));
    }
    if !ignore.is_empty() {
        object.insert("ignore".into(), json!(ignore));
    }
    if !order.is_empty() {
        object.insert("order".into(), json!(order));
    }
    if let Some(require_parameters) = require_parameters {
        object.insert("require_parameters".into(), json!(require_parameters));
    }
    if let Some(data_collection) = data_collection {
        object.insert("data_collection".into(), json!(data_collection));
    }
    Some(Value::Object(object))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> DbHandle {
        // Runs the full embedded migration stack (including V133), so the
        // save/load tests validate the real schema.
        DbHandle::new_memory().unwrap()
    }

    fn policy_json() -> Value {
        json!({
            "sort": "price",
            "ignore": ["together"],
            "models": {
                "anthropic/claude-fable-5.1": { "only": ["anthropic"] },
                "moonshotai/kimi-k2.6": { "order": ["moonshotai", "together"], "sort": "throughput" }
            }
        })
    }

    #[test]
    fn validate_accepts_canonical_policy() {
        let policy = validate(&policy_json()).unwrap();
        assert_eq!(policy.sort, Some(Sort::Price));
        assert_eq!(policy.models.len(), 2);
    }

    #[test]
    fn validate_rejects_bad_values() {
        assert!(validate(&json!({"sort": "cheapest"})).is_err());
        assert!(validate(&json!({"data_collection": "maybe"})).is_err());
        assert!(validate(&json!({"only": ["Not A Slug"]})).is_err());
        assert!(validate(&json!({"only": ["a"], "ignore": ["a"]})).is_err());
        assert!(validate(&json!({"order": ["a"], "ignore": ["a"]})).is_err());
        assert!(validate(&json!({"models": {"x": {"only": ["UPPER"]}}})).is_err());
    }

    #[test]
    fn resolve_flat_policy_for_unpinned_model() {
        let policy = validate(&policy_json()).unwrap();
        let resolved = resolve_for_model(&policy, "openai", "gpt-5").unwrap();
        assert_eq!(resolved["sort"], json!("price"));
        assert_eq!(resolved["ignore"], json!(["together"]));
        assert!(resolved.get("only").is_none());
    }

    #[test]
    fn resolve_empty_policy_is_none() {
        let policy = ProviderRoutingPolicy::default();
        assert!(resolve_for_model(&policy, "openai", "gpt-5").is_none());
    }

    #[test]
    fn per_model_override_replaces_and_falls_through() {
        let policy = validate(&policy_json()).unwrap();
        // Pinned: `only` replaces the flat absence; `sort` falls through to
        // the flat "price".
        let resolved = resolve_for_model(&policy, "anthropic", "claude-fable-5.1").unwrap();
        assert_eq!(resolved["only"], json!(["anthropic"]));
        assert_eq!(resolved["sort"], json!("price"));
        // The pinned model's `ignore` falls through to the flat value.
        assert_eq!(resolved["ignore"], json!(["together"]));
    }

    #[test]
    fn override_sort_replaces_flat_sort() {
        let policy = validate(&policy_json()).unwrap();
        let resolved = resolve_for_model(&policy, "moonshotai", "kimi-k2.6").unwrap();
        assert_eq!(resolved["sort"], json!("throughput"));
        assert_eq!(resolved["order"], json!(["moonshotai", "together"]));
    }

    #[test]
    fn model_matching_is_spelling_tolerant() {
        let policy = validate(&json!({
            "models": { "claude-fable-5.1": { "only": ["anthropic"] } }
        }))
        .unwrap();
        // Catalog-style id (dash variant, no vendor prefix) still hits the pin.
        let resolved = resolve_for_model(&policy, "anthropic", "claude-fable-5-1").unwrap();
        assert_eq!(resolved["only"], json!(["anthropic"]));
        // openrouter/ prefix form also matches.
        let resolved = resolve_for_model(&policy, "anthropic", "claude-fable-5.1").unwrap();
        assert_eq!(resolved["only"], json!(["anthropic"]));
        // A different model is untouched.
        assert!(resolve_for_model(&policy, "openai", "gpt-5").is_none());
    }

    #[test]
    fn save_and_load_roundtrip() {
        let db = test_db();
        let policy = validate(&policy_json()).unwrap();
        save_policy(&db, Some("t1"), &policy).unwrap();

        let loaded = load_policy(&db, "t1").unwrap().unwrap();
        assert_eq!(loaded, policy);

        // Another tenant has no row → None.
        assert!(load_policy(&db, "t2").unwrap().is_none());
    }

    #[test]
    fn global_row_falls_back_when_tenant_missing() {
        let db = test_db();
        let global = validate(&json!({"sort": "latency"})).unwrap();
        save_policy(&db, None, &global).unwrap();

        // Tenant without its own row inherits the global row.
        let loaded = load_policy(&db, "t9").unwrap().unwrap();
        assert_eq!(loaded.sort, Some(Sort::Latency));

        // A tenant row overrides the global row.
        let tenant = validate(&json!({"sort": "throughput"})).unwrap();
        save_policy(&db, Some("t9"), &tenant).unwrap();
        let loaded = load_policy(&db, "t9").unwrap().unwrap();
        assert_eq!(loaded.sort, Some(Sort::Throughput));
    }
}
