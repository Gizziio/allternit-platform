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

use std::collections::{BTreeMap, BTreeSet};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::benchmarks::normalize_model_id;
use super::failover::{CooldownTracker, ModelRef, RetryPolicy};
use super::llm_pricing::{find_pricing, PricingMap};
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

/// Which row an effective policy came from: the caller's own tenant row, the
/// NULL-tenant platform-global row, or no policy at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum PolicySource {
    Tenant,
    Global,
    None,
}

impl PolicySource {
    pub fn as_str(&self) -> &'static str {
        match self {
            PolicySource::Tenant => "tenant",
            PolicySource::Global => "global",
            PolicySource::None => "none",
        }
    }
}

/// Load the provider routing policy for a tenant. A tenant-specific row wins;
/// absent that, the NULL-tenant (platform-global) row applies. Returns `None`
/// when neither exists.
pub fn load_policy(db: &DbHandle, tenant_id: &str) -> Result<Option<ProviderRoutingPolicy>, LoadError> {
    Ok(load_policy_with_source(db, tenant_id)?.0)
}

/// Like [`load_policy`] but also reports which row supplied the policy.
pub fn load_policy_with_source(
    db: &DbHandle,
    tenant_id: &str,
) -> Result<(Option<ProviderRoutingPolicy>, PolicySource), LoadError> {
    let conn = db.connect()?;
    let tenant_row: Option<String> = conn
        .query_row(
            "SELECT policy FROM llm_provider_routing_policies WHERE tenant_id = ?1",
            params![tenant_id],
            |row| row.get(0),
        )
        .optional()?;
    let (stored, source) = match tenant_row {
        Some(policy) => (Some(policy), PolicySource::Tenant),
        None => {
            let global_row: Option<String> = conn
                .query_row(
                    "SELECT policy FROM llm_provider_routing_policies WHERE tenant_id IS NULL",
                    [],
                    |row| row.get(0),
                )
                .optional()?;
            match global_row {
                Some(policy) => (Some(policy), PolicySource::Global),
                None => (None, PolicySource::None),
            }
        }
    };
    match stored {
        Some(json) => serde_json::from_str(&json)
            .map(|policy| (Some(policy), source))
            .map_err(|err| LoadError::Json(format!("llm_provider_routing_policies row: {err}"))),
        None => Ok((None, PolicySource::None)),
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
fn find_override_entry<'a>(
    models: &'a BTreeMap<String, ModelOverride>,
    provider_id: &str,
    model_id: &str,
) -> Option<(&'a String, &'a ModelOverride)> {
    let candidates = candidate_ids(provider_id, model_id);
    for candidate in &candidates {
        if let Some(entry) = models.get_key_value(candidate) {
            return Some(entry);
        }
    }
    let normalized: Vec<String> = candidates.iter().map(|id| normalize_model_id(id)).collect();
    let mut matches: Vec<(&String, &ModelOverride)> = models
        .iter()
        .filter(|(key, _)| normalized.contains(&normalize_model_id(key)))
        .collect();
    matches.sort_by(|a, b| a.0.cmp(b.0));
    matches.first().map(|(key, override_)| (*key, *override_))
}

fn find_override<'a>(
    models: &'a BTreeMap<String, ModelOverride>,
    provider_id: &str,
    model_id: &str,
) -> Option<&'a ModelOverride> {
    find_override_entry(models, provider_id, model_id).map(|(_, override_)| override_)
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

/// Answer to "which provider serves this model under current policy" — the
/// resolved wire `provider` object, the `models` key that matched (if any),
/// and which policy row supplied it. `provider` is `None` when no policy (or
/// an empty one) applies.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ResolveAnswer {
    pub provider: Option<Value>,
    pub matched_override: Option<String>,
    pub source: PolicySource,
}

/// Resolve the effective routing for `(provider_id, model_id)` against the
/// caller's tenant policy (falling back to the platform-global row).
pub fn resolve_query(
    db: &DbHandle,
    tenant_id: &str,
    provider_id: &str,
    model_id: &str,
) -> Result<ResolveAnswer, LoadError> {
    let (policy, source) = load_policy_with_source(db, tenant_id)?;
    let Some(policy) = policy else {
        return Ok(ResolveAnswer {
            provider: None,
            matched_override: None,
            source,
        });
    };
    let matched_override =
        find_override_entry(&policy.models, provider_id, model_id).map(|(key, _)| key.clone());
    Ok(ResolveAnswer {
        provider: resolve_for_model(&policy, provider_id, model_id),
        matched_override,
        source,
    })
}

fn override_object(override_: &ModelOverride) -> Value {
    let mut object = serde_json::Map::new();
    if let Some(sort) = &override_.sort {
        object.insert("sort".into(), json!(sort));
    }
    if !override_.only.is_empty() {
        object.insert("only".into(), json!(override_.only));
    }
    if !override_.ignore.is_empty() {
        object.insert("ignore".into(), json!(override_.ignore));
    }
    if !override_.order.is_empty() {
        object.insert("order".into(), json!(override_.order));
    }
    if let Some(require_parameters) = override_.require_parameters {
        object.insert("require_parameters".into(), json!(require_parameters));
    }
    if let Some(data_collection) = &override_.data_collection {
        object.insert("data_collection".into(), json!(data_collection));
    }
    Value::Object(object)
}

/// Render a policy as a Hermes-native `provider_routing` section for
/// `~/.hermes/config.yaml`
/// (https://hermes-agent.nousresearch.com/docs/user-guide/features/provider-routing).
/// Keys the policy leaves unset are omitted (Hermes treats absent keys as
/// defaults). Returns the full YAML document — a single top-level
/// `provider_routing:` mapping.
pub fn to_hermes_yaml(policy: &ProviderRoutingPolicy) -> String {
    let mut section = serde_json::Map::new();
    if let Some(sort) = &policy.sort {
        section.insert("sort".into(), json!(sort));
    }
    if !policy.only.is_empty() {
        section.insert("only".into(), json!(policy.only));
    }
    if !policy.ignore.is_empty() {
        section.insert("ignore".into(), json!(policy.ignore));
    }
    if !policy.order.is_empty() {
        section.insert("order".into(), json!(policy.order));
    }
    if let Some(require_parameters) = policy.require_parameters {
        section.insert("require_parameters".into(), json!(require_parameters));
    }
    if let Some(data_collection) = &policy.data_collection {
        section.insert("data_collection".into(), json!(data_collection));
    }
    if !policy.models.is_empty() {
        let models: serde_json::Map<String, Value> = policy
            .models
            .iter()
            .map(|(model, override_)| (model.clone(), override_object(override_)))
            .collect();
        section.insert("models".into(), Value::Object(models));
    }
    let document = json!({ "provider_routing": Value::Object(section) });
    let mut yaml = serde_yaml::to_string(&document).expect("provider_routing serializes to YAML");
    if !yaml.ends_with('\n') {
        yaml.push('\n');
    }
    yaml
}

// ─── P2.10: declarative config import (policy-as-code) ──────────────────────
//
// SCOPE-DEPTH SEAM: the resolution key today is `(tenant_id, model_pattern)`
// — one row per tenant in `llm_provider_routing_policies`, with
// `model_pattern` living inside the row's `models` map. Adding
// org→project→workload depth later is a resolution-order change (which rows
// participate and in what precedence), NOT a rewrite of this import path:
// `from_hermes_yaml` / `diff_policies` / `apply_import` all operate on a
// single tenant-scope slice, so deeper scopes slot in by repeating this
// per-scope flow under a scope-resolution wrapper. Copy the org-scope pattern
// from V181 (`org_route_credentials`) when that day comes.

/// Parse a Hermes `provider_routing` YAML document — the exact shape
/// [`to_hermes_yaml`] exports — into a validated policy. A bare section
/// (without the top-level `provider_routing:` wrapper) is also accepted, so
/// hand-edited config fragments import cleanly.
pub fn from_hermes_yaml(yaml: &str) -> Result<ProviderRoutingPolicy, String> {
    let document: Value =
        serde_yaml::from_str(yaml).map_err(|err| format!("Invalid YAML: {err}"))?;
    let section = match &document {
        Value::Object(map) => match map.get("provider_routing") {
            Some(section) => section.clone(),
            None => document,
        },
        _ => document,
    };
    validate(&section)
}

/// One key-level change inside a policy diff. `old`/`new` are `null` on the
/// absent side (`added` → old null; `removed` → new null).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct KeyChange {
    pub key: String,
    pub op: &'static str, // "added" | "changed" | "removed"
    pub old: Value,
    pub new: Value,
}

/// Diff of one `models` override entry. For `added`/`removed` overrides the
/// per-key `changes` carry each key with the other side null.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OverrideChange {
    pub op: &'static str, // "added" | "changed" | "removed"
    pub changes: Vec<KeyChange>,
}

/// Structured import-preview diff: flat keys, per-model overrides, and
/// non-fatal warnings. Empty `flat` + `models` means the import is a no-op.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct PolicyDiff {
    pub flat: Vec<KeyChange>,
    pub models: BTreeMap<String, OverrideChange>,
    /// Unknown provider slugs / model ids are flagged here as warnings, NOT
    /// hard errors: a staging→prod import legitimately references providers
    /// this node's pricing catalog doesn't know, and Hermes itself tolerates
    /// unknown entries (they're inert until the provider exists). Hard
    /// failure stays reserved for malformed policy ([`validate`]).
    pub warnings: Vec<String>,
}

impl PolicyDiff {
    /// True when applying the import would change nothing (warnings aside).
    pub fn is_noop(&self) -> bool {
        self.flat.is_empty() && self.models.is_empty()
    }
}

/// Catalog of provider slugs / model ids this node knows about, used to flag
/// unknown references in an import diff.
#[derive(Debug, Clone, Default)]
pub struct RoutingCatalog {
    pub providers: BTreeSet<String>,
    /// Both `provider/model` and bare `model` spellings.
    pub models: BTreeSet<String>,
}

/// Build the warning catalog from the models.dev pricing snapshot (the same
/// catalog the gateway already prices from). An empty snapshot yields an
/// empty catalog → no warnings, never a false alarm when the cache is absent.
pub fn catalog_from_pricing(map: &PricingMap) -> RoutingCatalog {
    let mut catalog = RoutingCatalog::default();
    for key in map.keys() {
        if let Some((provider, model)) = key.split_once('/') {
            catalog.providers.insert(provider.to_string());
            catalog.models.insert(model.to_string());
        }
        catalog.models.insert(key.clone());
    }
    catalog
}

fn flat_map(policy: &ProviderRoutingPolicy) -> BTreeMap<String, Value> {
    let mut map = BTreeMap::new();
    if let Some(sort) = &policy.sort {
        map.insert("sort".to_string(), json!(sort));
    }
    if !policy.only.is_empty() {
        map.insert("only".to_string(), json!(policy.only));
    }
    if !policy.ignore.is_empty() {
        map.insert("ignore".to_string(), json!(policy.ignore));
    }
    if !policy.order.is_empty() {
        map.insert("order".to_string(), json!(policy.order));
    }
    if let Some(require_parameters) = policy.require_parameters {
        map.insert(
            "require_parameters".to_string(),
            json!(require_parameters),
        );
    }
    if let Some(data_collection) = &policy.data_collection {
        map.insert("data_collection".to_string(), json!(data_collection));
    }
    map
}

fn override_map(override_: &ModelOverride) -> BTreeMap<String, Value> {
    override_object(override_)
        .as_object()
        .map(|object| object.clone().into_iter().collect())
        .unwrap_or_default()
}

fn diff_maps(old: &BTreeMap<String, Value>, new: &BTreeMap<String, Value>) -> Vec<KeyChange> {
    let mut changes = Vec::new();
    for (key, old_value) in old {
        match new.get(key) {
            None => changes.push(KeyChange {
                key: key.clone(),
                op: "removed",
                old: old_value.clone(),
                new: Value::Null,
            }),
            Some(new_value) if new_value != old_value => changes.push(KeyChange {
                key: key.clone(),
                op: "changed",
                old: old_value.clone(),
                new: new_value.clone(),
            }),
            _ => {}
        }
    }
    for (key, new_value) in new {
        if !old.contains_key(key) {
            changes.push(KeyChange {
                key: key.clone(),
                op: "added",
                old: Value::Null,
                new: new_value.clone(),
            });
        }
    }
    changes
}

fn warn_unknown_slugs(
    key: &str,
    slugs: &[String],
    catalog: &RoutingCatalog,
    warnings: &mut Vec<String>,
) {
    if catalog.providers.is_empty() {
        return; // No catalog on this node — never fabricate warnings.
    }
    for slug in slugs {
        if !catalog.providers.contains(slug) {
            warnings.push(format!(
                "`{key}` references unknown provider `{slug}` (not in this node's pricing catalog)."
            ));
        }
    }
}

fn warn_unknown_model(model: &str, catalog: &RoutingCatalog, warnings: &mut Vec<String>) {
    if catalog.models.is_empty() {
        return;
    }
    let known = catalog.models.contains(model)
        || catalog
            .models
            .iter()
            .any(|known| normalize_model_id(known) == normalize_model_id(model));
    if !known {
        warnings.push(format!(
            "`models` key `{model}` does not match any model in this node's pricing catalog."
        ));
    }
}

/// Diff `incoming` against `current` (both already validated), collecting
/// per-key and per-model-override changes plus unknown-reference warnings.
/// Pass `catalog: None` to skip the warning pass.
pub fn diff_policies(
    current: &ProviderRoutingPolicy,
    incoming: &ProviderRoutingPolicy,
    catalog: Option<&RoutingCatalog>,
) -> PolicyDiff {
    let mut diff = PolicyDiff {
        flat: diff_maps(&flat_map(current), &flat_map(incoming)),
        ..PolicyDiff::default()
    };

    for (model, current_override) in &current.models {
        match incoming.models.get(model) {
            None => {
                diff.models.insert(
                    model.clone(),
                    OverrideChange {
                        op: "removed",
                        changes: diff_maps(&override_map(current_override), &BTreeMap::new()),
                    },
                );
            }
            Some(incoming_override) => {
                let changes = diff_maps(&override_map(current_override), &override_map(incoming_override));
                if !changes.is_empty() {
                    diff.models.insert(
                        model.clone(),
                        OverrideChange {
                            op: "changed",
                            changes,
                        },
                    );
                }
            }
        };
    }
    for (model, incoming_override) in &incoming.models {
        if !current.models.contains_key(model) {
            diff.models.insert(
                model.clone(),
                OverrideChange {
                    op: "added",
                    changes: diff_maps(&BTreeMap::new(), &override_map(incoming_override)),
                },
            );
        }
    }

    if let Some(catalog) = catalog {
        let warnings = &mut diff.warnings;
        warn_unknown_slugs("only", &incoming.only, catalog, warnings);
        warn_unknown_slugs("ignore", &incoming.ignore, catalog, warnings);
        warn_unknown_slugs("order", &incoming.order, catalog, warnings);
        for (model, override_) in &incoming.models {
            warn_unknown_model(model, catalog, warnings);
            warn_unknown_slugs(&format!("models.{model}.only"), &override_.only, catalog, warnings);
            warn_unknown_slugs(
                &format!("models.{model}.ignore"),
                &override_.ignore,
                catalog,
                warnings,
            );
            warn_unknown_slugs(
                &format!("models.{model}.order"),
                &override_.order,
                catalog,
                warnings,
            );
        }
    }
    diff
}

/// Apply an imported policy inside a single transaction: the upsert either
/// commits whole or rolls back, so a failure can never leave a partial row
/// behind. (Today's policy is a single-row replace, so the transaction is
/// trivially atomic — it is structured this way so deeper scopes, which will
/// write several rows per import, inherit atomicity without a rewrite. See
/// the SCOPE-DEPTH SEAM note above.)
pub fn apply_import(
    db: &DbHandle,
    tenant_id: Option<&str>,
    policy: &ProviderRoutingPolicy,
) -> Result<(), rusqlite::Error> {
    let mut conn = db.connect()?;
    let tx = conn.transaction()?;
    let json = serde_json::to_string(policy).expect("ProviderRoutingPolicy serializes");
    let existing: Option<String> = tx
        .query_row(
            "SELECT id FROM llm_provider_routing_policies WHERE tenant_id IS ?1",
            params![tenant_id],
            |row| row.get(0),
        )
        .optional()?;
    match existing {
        Some(id) => tx.execute(
            "UPDATE llm_provider_routing_policies
             SET policy = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, json],
        )?,
        None => tx.execute(
            "INSERT INTO llm_provider_routing_policies (id, tenant_id, policy)
             VALUES (?1, ?2, ?3)",
            params![uuid::Uuid::new_v4().to_string(), tenant_id, json],
        )?,
    };
    tx.commit()
}

// ─── P2.11: native-mode candidate sorting engine ────────────────────────────
//
// Orders provider/model candidates by explicit signals: health (cooldown
// state from failover's CooldownTracker), cost (models.dev rates via
// llm_pricing), and backend kind (proxied vs native). The engine is pure —
// no DB, no clock — so it is unit-testable in isolation; the wiring helpers
// below gather the signals.

/// Backend execution mode. Today every gateway backend is `Proxied` (an
/// OpenAI-compatible upstream reached over HTTP). `Native` is the reserved
/// variant for when Fabric Runtime joins the backend set (P2.11) — no native
/// backends exist yet, so production code never constructs it; the variant
/// exists so the signal plumbing and ordering rule are settled before the
/// first native backend lands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackendKind {
    Proxied,
    Native,
}

/// The signals [`sort_candidates`] orders one candidate on.
#[derive(Debug, Clone, PartialEq)]
pub struct CandidateSignals {
    /// $/1M-token input rate from the models.dev catalog; `None` = unknown
    /// (unpriced candidates sort after priced ones, never fabricated as 0).
    pub input_cost_per_million: Option<f64>,
    /// $/1M-token output rate; combined with input for the cost key.
    pub output_cost_per_million: Option<f64>,
    /// Set while the candidate is inside a cooldown (remaining time is
    /// informational — the retry loop's fail-open still owns soonest-expiry
    /// selection). `None` = healthy.
    pub cooldown_remaining_ms: Option<u64>,
    pub kind: BackendKind,
}

impl CandidateSignals {
    fn is_cooling(&self) -> bool {
        self.cooldown_remaining_ms.map_or(false, |ms| ms > 0)
    }

    /// Combined per-1M-token cost in microdollars; `None` when neither side
    /// is priced.
    fn cost_microdollars(&self) -> Option<u64> {
        match (self.input_cost_per_million, self.output_cost_per_million) {
            (None, None) => None,
            (input, output) => Some(
                ((input.unwrap_or(0.0) + output.unwrap_or(0.0)) * 1_000_000.0).round() as u64,
            ),
        }
    }
}

/// One candidate plus its ordering signals.
#[derive(Debug, Clone, PartialEq)]
pub struct ScoredCandidate {
    pub model: ModelRef,
    pub signals: CandidateSignals,
}

/// Deterministic, total ordering over candidates:
///   1. healthy before cooling (health demotion — the *hard* skip/filter and
///      fail-open stay in `failover::select_fallback_healthy_at`),
///   2. cheaper combined rate first; unknown cost after known,
///   3. `native` before `proxied` (locality: a native backend avoids egress),
///   4. original position (stable tiebreak — preserves the configured chain
///      order exactly when every signal is equal).
pub fn sort_candidates(candidates: &[ScoredCandidate]) -> Vec<ScoredCandidate> {
    let mut indexed: Vec<(usize, &ScoredCandidate)> = candidates.iter().enumerate().collect();
    indexed.sort_by(|(a_idx, a), (b_idx, b)| {
        let key = |(idx, c): (usize, &ScoredCandidate)| {
            (
                c.signals.is_cooling(),
                c.signals.cost_microdollars().is_none(),
                c.signals.cost_microdollars().unwrap_or(0),
                c.signals.kind == BackendKind::Proxied,
                idx,
            )
        };
        key((*a_idx, a)).cmp(&key((*b_idx, b)))
    });
    indexed
        .into_iter()
        .map(|(_, candidate)| candidate.clone())
        .collect()
}

/// Gather the sorting signals for one candidate: cooldown state from
/// `tracker`, cost from `pricing` (models.dev snapshot). All current backends
/// are `Proxied`; native candidates arrive with Fabric Runtime.
pub fn signals_for(
    model: &ModelRef,
    pricing: &PricingMap,
    cooling: Option<u64>,
) -> CandidateSignals {
    let rates = find_pricing(pricing, &model.provider_id, &model.model_id);
    CandidateSignals {
        input_cost_per_million: rates.map(|r| r.input),
        output_cost_per_million: rates.map(|r| r.output),
        cooldown_remaining_ms: cooling,
        kind: BackendKind::Proxied,
    }
}

/// Retry-loop wiring point (P2.11): sort the fallback chain with
/// [`sort_candidates`] (cost + health + kind) *ahead of* failover's
/// health-aware selection, so the preference order the retry loop walks
/// reflects the signals. Health remains a hard filter — cooling candidates
/// are demoted here AND still skipped by `select_fallback_healthy_at`, whose
/// fail-open semantics (soonest-expiring pick when everything is cooling)
/// are unchanged (P0.1).
///
/// Drop-in replacement for the `proxy.rs` retry loop's
/// `failover::select_fallback_healthy` call: same signature plus the pricing
/// snapshot (`llm_pricing::pricing_snapshot()` at call time).
pub fn select_fallback_sorted(
    attempt: u32,
    primary: &ModelRef,
    fallbacks: &[ModelRef],
    policy: &RetryPolicy,
    pricing: &PricingMap,
    tracker: &CooldownTracker,
) -> Option<ModelRef> {
    select_fallback_sorted_at(
        attempt,
        primary,
        fallbacks,
        policy,
        pricing,
        std::time::Instant::now(),
        tracker,
    )
}

/// Clock-injected variant of [`select_fallback_sorted`] so tests never sleep.
pub fn select_fallback_sorted_at(
    attempt: u32,
    primary: &ModelRef,
    fallbacks: &[ModelRef],
    policy: &RetryPolicy,
    pricing: &PricingMap,
    now: std::time::Instant,
    tracker: &CooldownTracker,
) -> Option<ModelRef> {
    let scored: Vec<ScoredCandidate> = fallbacks
        .iter()
        .map(|model| {
            let cooling = if tracker.is_cooling_down_at(&model.provider_id, &model.model_id, now) {
                // Remaining time is owned by failover's fail-open logic; the
                // sort only needs the cooling flag. A sentinel orders cooling
                // candidates after healthy ones.
                Some(1)
            } else {
                None
            };
            ScoredCandidate {
                model: model.clone(),
                signals: signals_for(model, pricing, cooling),
            }
        })
        .collect();
    let sorted: Vec<ModelRef> = sort_candidates(&scored)
        .into_iter()
        .map(|candidate| candidate.model)
        .collect();
    super::failover::select_fallback_healthy_at(attempt, primary, &sorted, policy, now, tracker)
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

    #[test]
    fn load_with_source_reports_row_origin() {
        let db = test_db();
        let (policy, source) = load_policy_with_source(&db, "t1").unwrap();
        assert!(policy.is_none());
        assert_eq!(source, PolicySource::None);

        save_policy(&db, None, &validate(&json!({"sort": "latency"})).unwrap()).unwrap();
        let (policy, source) = load_policy_with_source(&db, "t1").unwrap();
        assert_eq!(policy.unwrap().sort, Some(Sort::Latency));
        assert_eq!(source, PolicySource::Global);

        save_policy(&db, Some("t1"), &validate(&json!({"sort": "price"})).unwrap()).unwrap();
        let (policy, source) = load_policy_with_source(&db, "t1").unwrap();
        assert_eq!(policy.unwrap().sort, Some(Sort::Price));
        assert_eq!(source, PolicySource::Tenant);
    }

    #[test]
    fn resolve_query_reports_provider_match_and_source() {
        let db = test_db();
        save_policy(&db, Some("t1"), &validate(&policy_json()).unwrap()).unwrap();

        // Pinned model: provider object + the exact models key that matched.
        let answer = resolve_query(&db, "t1", "anthropic", "claude-fable-5.1").unwrap();
        assert_eq!(answer.source, PolicySource::Tenant);
        assert_eq!(
            answer.matched_override.as_deref(),
            Some("anthropic/claude-fable-5.1")
        );
        assert_eq!(answer.provider.unwrap()["only"], json!(["anthropic"]));

        // Unpinned model: flat policy applies, no matched override.
        let answer = resolve_query(&db, "t1", "openai", "gpt-5").unwrap();
        assert_eq!(answer.source, PolicySource::Tenant);
        assert!(answer.matched_override.is_none());
        assert_eq!(answer.provider.unwrap()["sort"], json!("price"));

        // Unknown tenant without global row: nothing applies.
        let answer = resolve_query(&db, "t2", "openai", "gpt-5").unwrap();
        assert_eq!(answer.source, PolicySource::None);
        assert!(answer.provider.is_none());
        assert!(answer.matched_override.is_none());
    }

    #[test]
    fn hermes_yaml_renders_flat_and_per_model() {
        let policy = validate(&json!({
            "sort": "price",
            "ignore": ["together"],
            "require_parameters": true,
            "data_collection": "deny",
            "models": {
                "anthropic/claude-fable-5.1": { "only": ["anthropic"] },
                "moonshotai/kimi-k2.6": { "order": ["moonshotai", "together"], "sort": "throughput" }
            }
        }))
        .unwrap();
        let yaml = to_hermes_yaml(&policy);
        assert!(yaml.starts_with("provider_routing:"));
        // Model ids survive verbatim (round-trip below is the real assertion —
        // YAML needs no quoting for `/`/`.` in keys when editing the file).
        assert!(yaml.contains("anthropic/claude-fable-5.1:"));
        let parsed: Value = serde_yaml::from_str(&yaml).unwrap();
        let routing = &parsed["provider_routing"];
        assert_eq!(routing["sort"], json!("price"));
        assert_eq!(routing["ignore"], json!(["together"]));
        assert_eq!(routing["require_parameters"], json!(true));
        assert_eq!(routing["data_collection"], json!("deny"));
        assert_eq!(
            routing["models"]["anthropic/claude-fable-5.1"]["only"],
            json!(["anthropic"])
        );
        assert_eq!(
            routing["models"]["moonshotai/kimi-k2.6"]["order"],
            json!(["moonshotai", "together"])
        );
        // Unset keys are omitted, not emitted as null/empty.
        assert!(routing.get("only").is_none());
        assert!(
            routing["models"]["anthropic/claude-fable-5.1"]
                .get("order")
                .is_none()
        );
    }

    #[test]
    fn hermes_yaml_empty_policy_is_empty_section() {
        let yaml = to_hermes_yaml(&ProviderRoutingPolicy::default());
        let parsed: Value = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(parsed["provider_routing"], json!({}));
    }

    // ── P2.10: import / diff / apply ────────────────────────────────────────

    fn sample_policy() -> ProviderRoutingPolicy {
        validate(&policy_json()).unwrap()
    }

    #[test]
    fn import_parses_exported_yaml_roundtrip() {
        let policy = sample_policy();
        let yaml = to_hermes_yaml(&policy);
        let imported = from_hermes_yaml(&yaml).unwrap();
        assert_eq!(imported, policy);

        // Bare section (no provider_routing: wrapper) is accepted too.
        let document: Value = serde_yaml::from_str(&yaml).unwrap();
        let bare = serde_yaml::to_string(&document["provider_routing"]).unwrap();
        assert_eq!(from_hermes_yaml(&bare).unwrap(), policy);
    }

    #[test]
    fn import_rejects_malformed_yaml_and_policy() {
        assert!(from_hermes_yaml("provider_routing: [not, a, map").is_err());
        assert!(from_hermes_yaml("provider_routing:\n  sort: cheapest\n").is_err());
        assert!(from_hermes_yaml("provider_routing:\n  only: ['Not A Slug']\n").is_err());
    }

    #[test]
    fn diff_roundtrip_export_import_is_noop() {
        let policy = sample_policy();
        let imported = from_hermes_yaml(&to_hermes_yaml(&policy)).unwrap();
        let diff = diff_policies(&policy, &imported, None);
        assert!(diff.is_noop(), "expected empty diff, got {diff:?}");
        assert!(diff.warnings.is_empty());
    }

    #[test]
    fn diff_reports_flat_and_model_changes() {
        let current = sample_policy();
        let incoming = validate(&json!({
            "sort": "latency",                       // changed
            "only": ["anthropic"],                   // added
            // "ignore" removed
            "models": {
                "anthropic/claude-fable-5.1": { "only": ["anthropic"] },  // unchanged
                "moonshotai/kimi-k2.6": { "sort": "price" },              // changed
                "openai/gpt-5": { "require_parameters": true }            // added model
            }
        }))
        .unwrap();

        let diff = diff_policies(&current, &incoming, None);
        assert!(!diff.is_noop());

        let flat: BTreeMap<_, _> = diff.flat.iter().map(|c| (c.key.as_str(), c)).collect();
        assert_eq!(flat["sort"].op, "changed");
        assert_eq!(flat["sort"].old, json!("price"));
        assert_eq!(flat["sort"].new, json!("latency"));
        assert_eq!(flat["only"].op, "added");
        assert_eq!(flat["only"].old, Value::Null);
        assert_eq!(flat["ignore"].op, "removed");
        assert_eq!(flat["ignore"].new, Value::Null);

        assert!(!diff.models.contains_key("anthropic/claude-fable-5.1"));
        let kimi = &diff.models["moonshotai/kimi-k2.6"];
        assert_eq!(kimi.op, "changed");
        let kimi_changes: BTreeMap<_, _> =
            kimi.changes.iter().map(|c| (c.key.as_str(), c)).collect();
        assert_eq!(kimi_changes["sort"].new, json!("price"));
        assert_eq!(kimi_changes["order"].op, "removed");

        let gpt5 = &diff.models["openai/gpt-5"];
        assert_eq!(gpt5.op, "added");
        assert_eq!(gpt5.changes.len(), 1);
        assert_eq!(gpt5.changes[0].op, "added");
        assert_eq!(gpt5.changes[0].new, json!(true));
    }

    #[test]
    fn diff_warns_on_unknown_providers_and_models() {
        let mut catalog = RoutingCatalog::default();
        catalog.providers.insert("anthropic".to_string());
        catalog.models.insert("anthropic/claude-fable-5.1".to_string());

        let incoming = validate(&json!({
            "order": ["anthropic", "unknown-co"],
            "models": {
                "anthropic/claude-fable-5.1": { "only": ["anthropic"] },
                "unknown-co/mystery-1": { "only": ["unknown-co"] }
            }
        }))
        .unwrap();
        let diff = diff_policies(&ProviderRoutingPolicy::default(), &incoming, Some(&catalog));
        // Warnings, not hard errors: the policy itself validated fine.
        assert_eq!(diff.warnings.len(), 3);
        assert!(diff.warnings.iter().any(|w| w.contains("unknown-co") && w.contains("order")));
        assert!(diff.warnings.iter().any(|w| w.contains("unknown-co/mystery-1")));
        assert!(diff.warnings.iter().any(|w| w.contains("models.unknown-co/mystery-1.only")));

        // An empty catalog (no pricing cache on this node) never fabricates warnings.
        let empty = RoutingCatalog::default();
        let diff = diff_policies(&ProviderRoutingPolicy::default(), &incoming, Some(&empty));
        assert!(diff.warnings.is_empty());
    }

    #[test]
    fn catalog_from_pricing_maps_prefixes_and_bare_ids() {
        let mut map = PricingMap::new();
        map.insert(
            "anthropic/claude-fable-5.1".to_string(),
            super::super::llm_pricing::ModelPricing {
                input: 3.0,
                ..Default::default()
            },
        );
        let catalog = catalog_from_pricing(&map);
        assert!(catalog.providers.contains("anthropic"));
        assert!(catalog.models.contains("anthropic/claude-fable-5.1"));
        assert!(catalog.models.contains("claude-fable-5.1"));
    }

    #[test]
    fn apply_import_persists_and_reexports_identically() {
        let db = test_db();
        let policy = sample_policy();
        apply_import(&db, Some("t1"), &policy).unwrap();

        let loaded = load_policy(&db, "t1").unwrap().unwrap();
        assert_eq!(loaded, policy);
        // Apply → export equals the input semantically (YAML key order may differ).
        let reexported: Value = serde_yaml::from_str(&to_hermes_yaml(&loaded)).unwrap();
        let input: Value = serde_yaml::from_str(&to_hermes_yaml(&policy)).unwrap();
        assert_eq!(reexported, input);

        // Re-apply is an upsert, not a duplicate row.
        let updated = validate(&json!({"sort": "latency"})).unwrap();
        apply_import(&db, Some("t1"), &updated).unwrap();
        let loaded = load_policy(&db, "t1").unwrap().unwrap();
        assert_eq!(loaded.sort, Some(Sort::Latency));
    }

    // ── P2.11: candidate sorting engine ─────────────────────────────────────

    fn cand(provider: &str, model: &str, input: Option<f64>, output: Option<f64>, cooling: Option<u64>, kind: BackendKind) -> ScoredCandidate {
        ScoredCandidate {
            model: ModelRef {
                provider_id: provider.to_string(),
                model_id: model.to_string(),
            },
            signals: CandidateSignals {
                input_cost_per_million: input,
                output_cost_per_million: output,
                cooldown_remaining_ms: cooling,
                kind,
            },
        }
    }

    fn ids(sorted: &[ScoredCandidate]) -> Vec<String> {
        sorted.iter().map(|c| c.model.full_id()).collect()
    }

    #[test]
    fn sort_orders_by_cost_ascending() {
        let candidates = vec![
            cand("expensive", "m", Some(15.0), Some(75.0), None, BackendKind::Proxied),
            cand("cheap", "m", Some(0.5), Some(1.5), None, BackendKind::Proxied),
            cand("mid", "m", Some(3.0), Some(15.0), None, BackendKind::Proxied),
        ];
        assert_eq!(
            ids(&sort_candidates(&candidates)),
            vec!["cheap/m", "mid/m", "expensive/m"]
        );
    }

    #[test]
    fn sort_unknown_cost_after_known() {
        let candidates = vec![
            cand("unpriced", "m", None, None, None, BackendKind::Proxied),
            cand("priced", "m", Some(100.0), None, None, BackendKind::Proxied),
        ];
        assert_eq!(
            ids(&sort_candidates(&candidates)),
            vec!["priced/m", "unpriced/m"],
            "unknown cost sorts after any known cost — never fabricated as 0"
        );
    }

    #[test]
    fn sort_demotes_cooling_candidates() {
        let candidates = vec![
            cand("cheap-hot", "m", Some(0.1), None, Some(1), BackendKind::Proxied),
            cand("pricey-cool", "m", Some(50.0), None, None, BackendKind::Proxied),
        ];
        assert_eq!(
            ids(&sort_candidates(&candidates)),
            vec!["pricey-cool/m", "cheap-hot/m"],
            "health dominates cost"
        );
        // Zero remaining = expired = healthy.
        let candidates = vec![
            cand("cheap-hot", "m", Some(0.1), None, Some(0), BackendKind::Proxied),
            cand("pricey-cool", "m", Some(50.0), None, None, BackendKind::Proxied),
        ];
        assert_eq!(ids(&sort_candidates(&candidates)), vec!["cheap-hot/m", "pricey-cool/m"]);
    }

    #[test]
    fn sort_tiebreak_is_stable() {
        let candidates = vec![
            cand("a", "m", Some(3.0), Some(15.0), None, BackendKind::Proxied),
            cand("b", "m", Some(3.0), Some(15.0), None, BackendKind::Proxied),
            cand("c", "m", Some(3.0), Some(15.0), None, BackendKind::Proxied),
        ];
        assert_eq!(ids(&sort_candidates(&candidates)), vec!["a/m", "b/m", "c/m"]);
    }

    #[test]
    fn sort_prefers_native_on_cost_tie() {
        let candidates = vec![
            cand("cloud", "m", Some(3.0), Some(15.0), None, BackendKind::Proxied),
            cand("fabric", "m", Some(3.0), Some(15.0), None, BackendKind::Native),
        ];
        assert_eq!(
            ids(&sort_candidates(&candidates)),
            vec!["fabric/m", "cloud/m"],
            "native (locality) wins an exact cost tie"
        );
        // Cost still dominates kind: a cheaper proxied backend beats a pricey native one.
        let candidates = vec![
            cand("fabric", "m", Some(30.0), None, None, BackendKind::Native),
            cand("cloud", "m", Some(3.0), None, None, BackendKind::Proxied),
        ];
        assert_eq!(ids(&sort_candidates(&candidates)), vec!["cloud/m", "fabric/m"]);
    }

    fn sort_pricing() -> PricingMap {
        let mut map = PricingMap::new();
        map.insert(
            "cheap/k3".to_string(),
            super::super::llm_pricing::ModelPricing {
                input: 0.5,
                output: 1.5,
                ..Default::default()
            },
        );
        map.insert(
            "pricey/claude".to_string(),
            super::super::llm_pricing::ModelPricing {
                input: 3.0,
                output: 15.0,
                ..Default::default()
            },
        );
        map
    }

    fn model_ref(provider: &str, id: &str) -> ModelRef {
        ModelRef {
            provider_id: provider.to_string(),
            model_id: id.to_string(),
        }
    }

    #[test]
    fn sorted_selection_reflects_cost_order() {
        let tracker = CooldownTracker::new();
        let policy = RetryPolicy::default();
        let t0 = std::time::Instant::now();
        let primary = model_ref("openai", "gpt-5");
        // Chain order lists pricey first; the sorted walk picks cheap first.
        let fallbacks = vec![model_ref("pricey", "claude"), model_ref("cheap", "k3")];

        let picked =
            select_fallback_sorted_at(2, &primary, &fallbacks, &policy, &sort_pricing(), t0, &tracker);
        assert_eq!(picked, Some(model_ref("cheap", "k3")));
    }

    #[test]
    fn sorted_selection_health_stays_a_hard_filter() {
        let tracker = CooldownTracker::new();
        let policy = RetryPolicy::default();
        let t0 = std::time::Instant::now();
        let primary = model_ref("openai", "gpt-5");
        let fallbacks = vec![model_ref("pricey", "claude"), model_ref("cheap", "k3")];

        // The cheap candidate is cooling: demoted by the sort AND skipped by
        // failover's hard filter — the pricey-but-healthy one is picked.
        tracker.record_outcome_at(
            "cheap",
            "k3",
            super::super::failover::AttemptOutcome::RateLimited,
            &policy,
            t0,
        );
        let picked =
            select_fallback_sorted_at(2, &primary, &fallbacks, &policy, &sort_pricing(), t0, &tracker);
        assert_eq!(picked, Some(model_ref("pricey", "claude")));

        // Fail-open survives: when everything is cooling, failover still picks
        // the soonest-expiring candidate rather than erroring.
        tracker.record_outcome_at(
            "pricey",
            "claude",
            super::super::failover::AttemptOutcome::RateLimited,
            &policy,
            t0,
        );
        let picked =
            select_fallback_sorted_at(2, &primary, &fallbacks, &policy, &sort_pricing(), t0, &tracker);
        assert!(picked.is_some(), "fail-open must still return a candidate");
    }

    #[test]
    fn sorted_selection_preserves_chain_when_signals_equal() {
        // Regression: with no pricing (empty map = all costs unknown) and no
        // cooldowns, the sorted walk is identical to the static chain order.
        let tracker = CooldownTracker::new();
        let policy = RetryPolicy::default();
        let t0 = std::time::Instant::now();
        let primary = model_ref("openai", "gpt-5");
        let fallbacks = vec![model_ref("anthropic", "claude"), model_ref("kimi", "k3")];
        let empty = PricingMap::new();

        assert_eq!(
            select_fallback_sorted_at(1, &primary, &fallbacks, &policy, &empty, t0, &tracker),
            Some(primary.clone())
        );
        assert_eq!(
            select_fallback_sorted_at(2, &primary, &fallbacks, &policy, &empty, t0, &tracker),
            Some(fallbacks[0].clone())
        );
        assert_eq!(
            select_fallback_sorted_at(3, &primary, &fallbacks, &policy, &empty, t0, &tracker),
            Some(fallbacks[1].clone())
        );
        assert_eq!(
            select_fallback_sorted_at(4, &primary, &fallbacks, &policy, &empty, t0, &tracker),
            None
        );
    }
}
