//! Routing policies (B5): score the Gizzi catalog against benchmark weights
//! and pick a winner model plus a cross-provider fallback chain.
//!
//! Flow for a policy alias (`auto`, `allternit-*`):
//!   1. Resolve weights — a tenant-defined row in `llm_routing_policies`
//!      matching the policy name overrides the preset weight map.
//!   2. Collect candidate models from providers Gizzi reports as connected.
//!   3. Score every candidate:
//!      `quality` = Σ(weight × normalized benchmark) / Σ(weight) over the
//!      benchmarks the model actually has rows for (`llm_benchmark_scores`,
//!      fuzzy-matched). Models with no usable rows fall back to the
//!      cost-quartile heuristic ported from Gizzi's `buildAutoTiers`
//!      (`cmd/gizzi-code/src/runtime/providers/provider.ts:918-1005`):
//!      costScore = input + 3×output per 1M tokens, quartile buckets.
//!      `cost_efficiency` = min-max position of costScore within the priced
//!      candidate set (free/unpriced models score 1.0, matching Gizzi's
//!      free-bucket preference).
//!   4. `total = 0.75 × quality + 0.25 × cost_efficiency` — quality dominates,
//!      cost breaks roughly-equal candidates toward the cheaper model.
//!      (Heuristic-scored models have a cost-derived quality by design, so
//!      unbenchmarked models are effectively ranked by cost.)
//!   5. Winner = highest total; fallbacks = next candidates, top 3 distinct
//!      providers (winner's provider excluded — failover is cross-provider).
//!
//! Scoring is fully deterministic: candidates are pre-sorted, ties break on
//! (provider_id, model_id), and all inputs come from the DB + catalog.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap, HashSet};

use super::benchmarks;
use super::proxy::ProviderCatalog;

/// Benchmarks understood by the router (seeded by `benchmarks.rs`).
pub const BENCHMARKS: [&str; 6] = ["humaneval", "mmlu", "gpqa", "gsm8k", "arena_elo", "aider"];

/// Blend of quality vs. cost-efficiency in the final score.
const QUALITY_WEIGHT: f64 = 0.75;
const COST_WEIGHT: f64 = 0.25;

/// How many fallback models (distinct providers) are derived per decision.
pub const FALLBACK_COUNT: usize = 3;

/// A model the router considered.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct CandidateRef {
    pub provider_id: String,
    pub model_id: String,
}

impl CandidateRef {
    pub fn full_id(&self) -> String {
        format!("{}/{}", self.provider_id, self.model_id)
    }
}

/// Per-candidate scorecard entry.
#[derive(Debug, Clone, Serialize)]
pub struct CandidateScore {
    pub provider_id: String,
    pub model_id: String,
    /// Blended benchmark quality in [0, 1], or the cost-quartile heuristic.
    pub quality: f64,
    /// Relative cheapness in [0, 1] (1 = cheapest / free).
    pub cost_efficiency: f64,
    /// Final score: 0.75×quality + 0.25×cost_efficiency.
    pub total: f64,
    /// True when no benchmark rows existed and the cost heuristic was used.
    pub heuristic: bool,
    /// Raw benchmark values that fed the quality blend.
    pub benchmarks: BTreeMap<String, f64>,
}

/// The outcome of one routing decision — persisted to
/// `llm_routing_decisions` and linked to the usage event row.
#[derive(Debug, Clone, Serialize)]
pub struct RoutingDecision {
    pub policy: String,
    pub winner: CandidateRef,
    pub fallbacks: Vec<CandidateRef>,
    pub scores: Vec<CandidateScore>,
    pub rules_fired: Vec<String>,
}

#[derive(Debug)]
pub enum RouterError {
    /// Gizzi reports no connected providers at all.
    NoConnectedProviders,
    /// Connected providers offer no usable models.
    NoCandidates,
    Db(rusqlite::Error),
}

impl From<rusqlite::Error> for RouterError {
    fn from(err: rusqlite::Error) -> Self {
        RouterError::Db(err)
    }
}

// ─── Policy weights ──────────────────────────────────────────────────────────

/// Normalization range per benchmark: percentage benchmarks map to [0, 1]
/// directly; Arena Elo is normalized against the observed public range.
fn benchmark_range(benchmark: &str) -> (f64, f64) {
    match benchmark {
        "arena_elo" => (1100.0, 1500.0),
        _ => (0.0, 100.0),
    }
}

/// Normalize a raw benchmark score into [0, 1] (clamped).
fn normalize(benchmark: &str, score: f64) -> f64 {
    let (min, max) = benchmark_range(benchmark);
    ((score - min) / (max - min)).clamp(0.0, 1.0)
}

/// Preset weight maps per policy alias. `auto` is an alias for balanced.
pub fn preset_weights(policy: &str) -> Option<BTreeMap<&'static str, f64>> {
    let mut map = BTreeMap::new();
    match policy {
        "auto" | "allternit-balanced" => {
            for benchmark in BENCHMARKS {
                map.insert(benchmark, 1.0);
            }
        }
        "allternit-code" => {
            map.insert("humaneval", 3.0);
            map.insert("aider", 3.0);
            map.insert("gpqa", 1.0);
            map.insert("gsm8k", 1.0);
            map.insert("mmlu", 0.5);
            map.insert("arena_elo", 0.5);
        }
        "allternit-reasoning" => {
            map.insert("gpqa", 3.0);
            map.insert("gsm8k", 1.5);
            map.insert("mmlu", 1.0);
            map.insert("humaneval", 0.5);
            map.insert("aider", 0.5);
            map.insert("arena_elo", 0.5);
        }
        "allternit-knowledge" => {
            map.insert("mmlu", 3.0);
            map.insert("gpqa", 1.0);
            map.insert("gsm8k", 1.0);
            map.insert("arena_elo", 1.0);
            map.insert("humaneval", 0.5);
            map.insert("aider", 0.5);
        }
        "allternit-instruct" => {
            map.insert("arena_elo", 3.0);
            map.insert("aider", 1.0);
            map.insert("mmlu", 1.0);
            map.insert("humaneval", 0.5);
            map.insert("gpqa", 0.5);
            map.insert("gsm8k", 0.5);
        }
        _ => return None,
    }
    Some(map)
}

/// Load a tenant-defined weight map from `llm_routing_policies` by name.
/// Tenant-specific rows win over global (tenant_id IS NULL) rows. Unknown
/// benchmark keys and non-positive weights are dropped; a row that leaves
/// nothing usable is treated as absent.
fn custom_weights(
    conn: &Connection,
    tenant_id: Option<&str>,
    name: &str,
) -> rusqlite::Result<Option<BTreeMap<String, f64>>> {
    let json: Option<String> = conn
        .query_row(
            "SELECT weights FROM llm_routing_policies
             WHERE name = ?1 AND (tenant_id = ?2 OR tenant_id IS NULL)
             ORDER BY (tenant_id IS NULL) ASC
             LIMIT 1",
            params![name, tenant_id],
            |row| row.get(0),
        )
        .optional()?;

    let Some(json) = json else {
        return Ok(None);
    };
    let parsed: Option<BTreeMap<String, f64>> = serde_json::from_str(&json).ok();
    let weights = parsed.map(|weights| {
        weights
            .into_iter()
            .filter(|(benchmark, weight)| {
                BENCHMARKS.contains(&benchmark.as_str()) && weight.is_finite() && *weight > 0.0
            })
            .collect::<BTreeMap<_, _>>()
    });
    Ok(weights.filter(|weights: &BTreeMap<String, f64>| !weights.is_empty()))
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

struct Candidate {
    provider_id: String,
    model_id: String,
    /// $ per 1M input tokens; None when the catalog reports no cost.
    cost_input: Option<f64>,
    /// $ per 1M output tokens.
    cost_output: Option<f64>,
}

impl Candidate {
    /// Gizzi's tiering cost score: input + 3×output per 1M tokens.
    /// 0 means free/unknown (mirrors provider.ts:936).
    fn cost_score(&self) -> f64 {
        match (self.cost_input, self.cost_output) {
            (Some(input), Some(output)) => input + 3.0 * output,
            (Some(input), None) => input,
            (None, Some(output)) => 3.0 * output,
            (None, None) => 0.0,
        }
    }
}

/// Quality proxy for models without benchmark rows: quartile position of the
/// model's costScore among the priced candidates (cheapest quartile = best),
/// ported from Gizzi's `buildAutoTiers`. Free/unpriced models land in the
/// middle (unknown quality, but cost nothing).
fn heuristic_quality(cost_score: f64, priced_scores_asc: &[f64]) -> (f64, String) {
    if cost_score <= 0.0 || priced_scores_asc.is_empty() {
        return (0.5, "heuristic:free-or-unpriced".to_string());
    }
    let rank = priced_scores_asc
        .iter()
        .filter(|score| **score < cost_score)
        .count();
    let quartile = (rank * 4 / priced_scores_asc.len()).min(3);
    let quality = 0.75 - 0.10 * quartile as f64;
    (quality, format!("heuristic:cost-quartile:q{quartile}"))
}

/// Resolve a routing policy to a winner + fallback chain.
///
/// `policy` is one of the aliases in `proxy::POLICY_ALIASES` (or any name a
/// tenant defined in `llm_routing_policies`); unknown names fall back to the
/// balanced preset so a typo never breaks completions.
pub fn resolve(
    conn: &Connection,
    tenant_id: Option<&str>,
    policy: &str,
    catalog: &ProviderCatalog,
) -> Result<RoutingDecision, RouterError> {
    let mut rules_fired: Vec<String> = Vec::new();

    // 1. Weights: tenant custom policy overrides the preset by name.
    let weights: BTreeMap<String, f64> = match custom_weights(conn, tenant_id, policy)? {
        Some(custom) => {
            rules_fired.push(format!("policy:custom:{policy}"));
            custom
        }
        None => {
            let preset = preset_weights(policy).unwrap_or_else(|| {
                preset_weights("allternit-balanced").expect("balanced preset exists")
            });
            rules_fired.push(if preset_weights(policy).is_some() {
                format!("policy:preset:{policy}")
            } else {
                format!("policy:defaulted:balanced (unknown policy `{policy}`)")
            });
            preset.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
        }
    };

    // 2. Candidates from connected providers, sorted for determinism.
    if catalog.connected.is_empty() {
        return Err(RouterError::NoConnectedProviders);
    }
    let mut candidates: Vec<Candidate> = Vec::new();
    for provider in &catalog.all {
        if !catalog.connected.contains(&provider.id) {
            continue;
        }
        for (model_id, entry) in &provider.models {
            // Non-active (alpha/beta/deprecated) models are skipped, mirroring
            // Gizzi's buildAutoTiers filter; a missing status means active.
            if entry.status.as_deref().is_some_and(|status| status != "active") {
                continue;
            }
            let (cost_input, cost_output) = entry
                .cost
                .as_ref()
                .map(|cost| (Some(cost.input), Some(cost.output)))
                .unwrap_or((None, None));
            candidates.push(Candidate {
                provider_id: provider.id.clone(),
                model_id: model_id.clone(),
                cost_input,
                cost_output,
            });
        }
    }
    candidates.sort_by(|a, b| (&a.provider_id, &a.model_id).cmp(&(&b.provider_id, &b.model_id)));
    if candidates.is_empty() {
        return Err(RouterError::NoCandidates);
    }
    rules_fired.push(format!(
        "availability:{} connected providers, {} candidate models",
        catalog.connected.len(),
        candidates.len()
    ));

    // 3. Benchmark rows (one table scan; fuzzy per-model lookup).
    let all_scores = benchmarks::load_all_scores(conn)?;

    // 4. Cost-efficiency: min-max over priced candidates.
    let mut priced_scores: Vec<f64> = candidates
        .iter()
        .map(Candidate::cost_score)
        .filter(|score| *score > 0.0)
        .collect();
    priced_scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let (min_cost, max_cost) = (
        priced_scores.first().copied().unwrap_or(0.0),
        priced_scores.last().copied().unwrap_or(0.0),
    );
    let cost_efficiency = |cost_score: f64| -> f64 {
        if cost_score <= 0.0 {
            return 1.0; // free/local — Gizzi's free bucket wins ties
        }
        if max_cost <= min_cost {
            return 1.0;
        }
        1.0 - (cost_score - min_cost) / (max_cost - min_cost)
    };

    // 5. Score every candidate.
    let mut heuristic_count = 0usize;
    let mut scores: Vec<CandidateScore> = Vec::with_capacity(candidates.len());
    for candidate in &candidates {
        let cost_score = candidate.cost_score();
        let rows = benchmarks::fuzzy_scores(&all_scores, &candidate.model_id);

        // Quality blend over the benchmarks this model actually has rows
        // for (weights of absent benchmarks simply don't participate).
        let mut numerator = 0.0;
        let mut denominator = 0.0;
        let mut used: BTreeMap<String, f64> = BTreeMap::new();
        if let Some(rows) = rows {
            for (benchmark, weight) in &weights {
                if let Some(score) = rows.get(benchmark) {
                    numerator += weight * normalize(benchmark, *score);
                    denominator += weight;
                    used.insert(benchmark.clone(), *score);
                }
            }
        }

        let (quality, heuristic) = if denominator > 0.0 {
            (numerator / denominator, false)
        } else {
            heuristic_count += 1;
            let (quality, rule) = heuristic_quality(cost_score, &priced_scores);
            rules_fired.push(format!("{rule} for {}/{}", candidate.provider_id, candidate.model_id));
            (quality, true)
        };

        let efficiency = cost_efficiency(cost_score);
        scores.push(CandidateScore {
            provider_id: candidate.provider_id.clone(),
            model_id: candidate.model_id.clone(),
            quality,
            cost_efficiency: efficiency,
            total: QUALITY_WEIGHT * quality + COST_WEIGHT * efficiency,
            heuristic,
            benchmarks: used,
        });
    }
    rules_fired.push(format!(
        "coverage:{}/{} models benchmarked, {} on cost-quartile heuristic",
        scores.len() - heuristic_count,
        scores.len(),
        heuristic_count
    ));

    // 6. Rank: total desc, then (provider, model) asc — fully deterministic.
    scores.sort_by(|a, b| {
        b.total
            .partial_cmp(&a.total)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| (&a.provider_id, &a.model_id).cmp(&(&b.provider_id, &b.model_id)))
    });

    let first = scores.first().expect("candidates checked non-empty");
    let winner = CandidateRef {
        provider_id: first.provider_id.clone(),
        model_id: first.model_id.clone(),
    };
    rules_fired.push(format!("winner:{} score {:.4}", winner.full_id(), first.total));

    // 7. Fallback chain: next best candidates, top N distinct providers,
    //    excluding the winner's provider (failover is cross-provider).
    let mut fallback_providers: HashSet<String> = HashSet::from([winner.provider_id.clone()]);
    let mut fallbacks: Vec<CandidateRef> = Vec::new();
    for score in scores.iter().skip(1) {
        if fallbacks.len() >= FALLBACK_COUNT {
            break;
        }
        if !fallback_providers.insert(score.provider_id.clone()) {
            continue;
        }
        fallbacks.push(CandidateRef {
            provider_id: score.provider_id.clone(),
            model_id: score.model_id.clone(),
        });
    }
    rules_fired.push(format!(
        "fallbacks:{} (top {FALLBACK_COUNT} distinct providers)",
        fallbacks
            .iter()
            .map(CandidateRef::full_id)
            .collect::<Vec<_>>()
            .join(", ")
    ));

    Ok(RoutingDecision {
        policy: policy.to_string(),
        winner,
        fallbacks,
        scores,
        rules_fired,
    })
}

/// Derive a fallback chain for an explicit `provider/model` request: the
/// balanced scorecard, minus the requested pair, top N distinct providers.
/// The explicit model stays the primary — routing is bypassed for selection,
/// only the failover chain is borrowed. Failures (empty catalog, no
/// providers) yield an empty chain, never an error.
pub fn fallback_chain_for_explicit(
    conn: &Connection,
    tenant_id: Option<&str>,
    catalog: &ProviderCatalog,
    requested_provider: &str,
    requested_model: &str,
) -> Vec<CandidateRef> {
    let Ok(decision) = resolve(conn, tenant_id, "allternit-balanced", catalog) else {
        return Vec::new();
    };
    let mut providers: HashSet<String> = HashSet::new();
    let mut chain = Vec::new();
    for score in &decision.scores {
        if chain.len() >= FALLBACK_COUNT {
            break;
        }
        if score.provider_id == requested_provider && score.model_id == requested_model {
            continue;
        }
        if !providers.insert(score.provider_id.clone()) {
            continue;
        }
        chain.push(CandidateRef {
            provider_id: score.provider_id.clone(),
            model_id: score.model_id.clone(),
        });
    }
    chain
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/// Persist a routing decision linked to its usage event row. Called from the
/// single `record_usage_event` choke point with the same connection, so the
/// decision and the usage row commit together.
pub fn persist_decision(
    conn: &Connection,
    usage_event_id: &str,
    decision: &RoutingDecision,
) -> rusqlite::Result<()> {
    let candidates: Vec<String> = decision
        .scores
        .iter()
        .map(|score| format!("{}/{}", score.provider_id, score.model_id))
        .collect();
    let scores_json: HashMap<String, serde_json::Value> = decision
        .scores
        .iter()
        .map(|score| {
            (
                format!("{}/{}", score.provider_id, score.model_id),
                serde_json::json!({
                    "quality": score.quality,
                    "cost_efficiency": score.cost_efficiency,
                    "total": score.total,
                    "heuristic": score.heuristic,
                    "benchmarks": score.benchmarks,
                }),
            )
        })
        .collect();

    conn.execute(
        "INSERT INTO llm_routing_decisions
            (id, usage_event_id, policy, candidates, scores, winner, rules_fired)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            uuid::Uuid::new_v4().to_string(),
            usage_event_id,
            decision.policy,
            serde_json::to_string(&candidates).unwrap_or_else(|_| "[]".to_string()),
            serde_json::to_string(&scores_json).unwrap_or_else(|_| "{}".to_string()),
            decision.winner.full_id(),
            serde_json::to_string(&decision.rules_fired).unwrap_or_else(|_| "[]".to_string()),
        ],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm_gateway::proxy::{ModelCost, ModelEntry, ProviderCatalog, ProviderEntry};

    fn catalog() -> ProviderCatalog {
        let model = |input: f64, output: f64| ModelEntry {
            cost: Some(ModelCost { input, output }),
            ..ModelEntry::default()
        };
        ProviderCatalog {
            all: vec![
                ProviderEntry {
                    id: "anthropic".to_string(),
                    models: HashMap::from([
                        ("claude-sonnet-4-5".to_string(), model(3.0, 15.0)),
                        ("claude-haiku-4-5".to_string(), model(0.8, 4.0)),
                    ]),
                },
                ProviderEntry {
                    id: "openai".to_string(),
                    models: HashMap::from([
                        ("gpt-5".to_string(), model(1.25, 10.0)),
                        ("gpt-4o".to_string(), model(2.5, 10.0)),
                        ("mystery-9".to_string(), model(50.0, 200.0)),
                    ]),
                },
                ProviderEntry {
                    id: "offline-co".to_string(),
                    models: HashMap::from([("offline-1".to_string(), model(1.0, 1.0))]),
                },
            ],
            connected: vec!["anthropic".to_string(), "openai".to_string()],
        }
    }

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE llm_benchmark_scores (
                model_id TEXT NOT NULL, benchmark TEXT NOT NULL, score REAL, source TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (model_id, benchmark)
            );
            CREATE TABLE llm_routing_policies (
                id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, weights TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE llm_usage_events (id TEXT PRIMARY KEY);
            CREATE TABLE llm_routing_decisions (
                id TEXT PRIMARY KEY, usage_event_id TEXT, policy TEXT,
                candidates TEXT, scores TEXT, winner TEXT, rules_fired TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .unwrap();
        // Seed only the rows the test catalog needs (subset of the real seed).
        conn.execute_batch(
            "INSERT INTO llm_benchmark_scores (model_id, benchmark, score, source) VALUES
                ('claude-sonnet-4.5', 'gpqa', 83.4, 'published'),
                ('claude-sonnet-4.5', 'aider', 82.0, 'published'),
                ('claude-sonnet-4.5', 'arena_elo', 1390.0, 'published'),
                ('claude-haiku-4.5', 'aider', 77.0, 'published'),
                ('gpt-5', 'gpqa', 85.7, 'published'),
                ('gpt-5', 'aider', 88.0, 'published'),
                ('gpt-5', 'arena_elo', 1442.0, 'published'),
                ('gpt-4o', 'humaneval', 90.2, 'published'),
                ('gpt-4o', 'mmlu', 88.7, 'published'),
                ('gpt-4o', 'gpqa', 53.6, 'published'),
                ('gpt-4o', 'gsm8k', 95.8, 'published'),
                ('gpt-4o', 'arena_elo', 1287.0, 'published');",
        )
        .unwrap();
        conn
    }

    #[test]
    fn presets_cover_all_benchmarks() {
        for policy in [
            "auto",
            "allternit-balanced",
            "allternit-code",
            "allternit-reasoning",
            "allternit-knowledge",
            "allternit-instruct",
        ] {
            let weights = preset_weights(policy).expect(policy);
            assert_eq!(weights.len(), BENCHMARKS.len(), "{policy}");
            assert!(weights.values().all(|w| *w > 0.0));
        }
        assert!(preset_weights("nope").is_none());
    }

    #[test]
    fn disconnected_providers_are_excluded() {
        let conn = test_conn();
        let decision = resolve(&conn, None, "auto", &catalog()).unwrap();
        assert!(decision
            .scores
            .iter()
            .all(|s| s.provider_id != "offline-co"));
    }

    #[test]
    fn code_policy_picks_strongest_code_model() {
        let conn = test_conn();
        let decision = resolve(&conn, None, "allternit-code", &catalog()).unwrap();
        // gpt-5 has the top aider score (88.0) — code policy weights aider 3x.
        assert_eq!(decision.winner.model_id, "gpt-5");
        assert_eq!(decision.winner.provider_id, "openai");
        // Fallbacks must be distinct providers, excluding the winner's.
        assert!(!decision.fallbacks.is_empty());
        assert!(decision
            .fallbacks
            .iter()
            .all(|f| f.provider_id != "openai"));
        assert!(decision
            .rules_fired
            .iter()
            .any(|r| r == "policy:preset:allternit-code"));
    }

    #[test]
    fn scoring_is_deterministic() {
        let conn = test_conn();
        for policy in ["auto", "allternit-code", "allternit-reasoning"] {
            let first = resolve(&conn, None, policy, &catalog()).unwrap();
            let second = resolve(&conn, None, policy, &catalog()).unwrap();
            let sig = |d: &RoutingDecision| {
                d.scores
                    .iter()
                    .map(|s| format!("{}/{}:{:.10}", s.provider_id, s.model_id, s.total))
                    .collect::<Vec<_>>()
                    .join("|")
            };
            assert_eq!(sig(&first), sig(&second), "{policy} must be deterministic");
            assert_eq!(first.winner.full_id(), second.winner.full_id());
        }
    }

    #[test]
    fn unbenchmarked_models_use_cost_quartile_heuristic() {
        let conn = test_conn();
        let decision = resolve(&conn, None, "auto", &catalog()).unwrap();
        let mystery = decision
            .scores
            .iter()
            .find(|s| s.model_id == "mystery-9")
            .unwrap();
        assert!(mystery.heuristic);
        // mystery-9 is the most expensive priced model → worst quartile.
        assert!((mystery.quality - 0.45).abs() < 1e-9);
        assert!(decision
            .rules_fired
            .iter()
            .any(|r| r.starts_with("heuristic:cost-quartile:q3 for openai/mystery-9")));
    }

    #[test]
    fn fuzzy_benchmark_rows_apply_to_dated_variants() {
        let conn = test_conn();
        let decision = resolve(&conn, None, "auto", &catalog()).unwrap();
        // Catalog id "claude-sonnet-4-5" fuzzily matches seed "claude-sonnet-4.5".
        let sonnet = decision
            .scores
            .iter()
            .find(|s| s.model_id == "claude-sonnet-4-5")
            .unwrap();
        assert!(!sonnet.heuristic);
        assert_eq!(sonnet.benchmarks.get("gpqa"), Some(&83.4));
    }

    #[test]
    fn tenant_custom_policy_overrides_preset() {
        let conn = test_conn();
        // A tenant policy that only cares about MMLU → gpt-4o (88.7) should
        // beat models with no MMLU rows (heuristic) even under a code alias.
        conn.execute(
            "INSERT INTO llm_routing_policies (id, tenant_id, name, weights)
             VALUES ('p1', 't1', 'allternit-code', '{\"mmlu\": 5.0}')",
            params![],
        )
        .unwrap();

        let decision = resolve(&conn, Some("t1"), "allternit-code", &catalog()).unwrap();
        assert!(decision
            .rules_fired
            .iter()
            .any(|r| r == "policy:custom:allternit-code"));
        assert_eq!(decision.winner.model_id, "gpt-4o");

        // Another tenant is unaffected by t1's override.
        let other = resolve(&conn, Some("t2"), "allternit-code", &catalog()).unwrap();
        assert_eq!(other.winner.model_id, "gpt-5");
    }

    #[test]
    fn explicit_fallback_chain_skips_requested_pair() {
        let conn = test_conn();
        let chain = fallback_chain_for_explicit(
            &conn,
            None,
            &catalog(),
            "anthropic",
            "claude-sonnet-4-5",
        );
        assert!(chain
            .iter()
            .all(|c| !(c.provider_id == "anthropic" && c.model_id == "claude-sonnet-4-5")));
        assert!(chain.len() <= FALLBACK_COUNT);
        let providers: HashSet<_> = chain.iter().map(|c| c.provider_id.clone()).collect();
        assert_eq!(providers.len(), chain.len(), "fallback providers must be distinct");
    }

    #[test]
    fn empty_connected_set_errors() {
        let conn = test_conn();
        let mut empty = catalog();
        empty.connected = vec![];
        assert!(matches!(
            resolve(&conn, None, "auto", &empty),
            Err(RouterError::NoConnectedProviders)
        ));
    }

    #[test]
    fn persist_decision_roundtrip() {
        let conn = test_conn();
        conn.execute("INSERT INTO llm_usage_events (id) VALUES ('evt-1')", params![])
            .unwrap();
        let decision = resolve(&conn, None, "allternit-code", &catalog()).unwrap();
        persist_decision(&conn, "evt-1", &decision).unwrap();

        let (policy, winner, scores, rules): (String, String, String, String) = conn
            .query_row(
                "SELECT policy, winner, scores, rules_fired FROM llm_routing_decisions
                 WHERE usage_event_id = 'evt-1'",
                params![],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(policy, "allternit-code");
        assert_eq!(winner, "openai/gpt-5");
        let scores: serde_json::Value = serde_json::from_str(&scores).unwrap();
        assert!(scores["openai/gpt-5"]["total"].as_f64().unwrap() > 0.0);
        let rules: Vec<String> = serde_json::from_str(&rules).unwrap();
        assert!(rules.iter().any(|r| r.starts_with("winner:openai/gpt-5")));
    }
}
