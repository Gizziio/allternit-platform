//! Published benchmark scores for routing decisions (B5).
//!
//! `benchmark_seed.json` (embedded via `include_str!`) carries publicly
//! reported figures — HumanEval, MMLU, GPQA, GSM8K, LMSYS Chatbot Arena Elo
//! and the Aider polyglot leaderboard — for the major model families in the
//! Gizzi catalog (Claude 4.x, GPT-4o/4.1/5/o-series, Gemini 2.x, DeepSeek,
//! Kimi, Qwen). Only figures vendors or public leaderboards actually
//! published are included, at the precision they were reported; benchmarks a
//! vendor never reported are simply absent for that model (the router
//! re-normalizes over whatever rows exist, and models with no rows at all
//! fall back to the cost-quartile heuristic).
//!
//! At startup the seed is upserted into `llm_benchmark_scores` idempotently:
//! rows are only written when missing or changed, and only when the stored
//! row still says `source = 'published'` — hand-tuned rows (any other
//! source) are never clobbered.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{info, warn};

use crate::db::DbHandle;

/// Embedded seed file (same directory as this module).
const SEED_JSON: &str = include_str!("benchmark_seed.json");

/// Source marker for seed-maintained rows. Rows with any other source are
/// treated as hand-edited and left alone by [`seed_scores`].
pub const SEED_SOURCE: &str = "published";

#[derive(Debug, Deserialize)]
struct SeedRow {
    model_id: String,
    benchmark: String,
    score: f64,
    #[serde(default)]
    source: Option<String>,
}

/// Parse the embedded seed JSON. Only rows marked `published` (the factual
/// seed set) are seed-managed; any other source is skipped so a hand-edited
/// seed file can't silently become source-of-truth data.
pub fn parse_seed() -> Result<Vec<(String, String, f64)>, serde_json::Error> {
    let rows: Vec<SeedRow> = serde_json::from_str(SEED_JSON)?;
    Ok(rows
        .into_iter()
        .filter(|row| row.source.as_deref().unwrap_or(SEED_SOURCE) == SEED_SOURCE)
        .map(|row| (row.model_id, row.benchmark, row.score))
        .collect())
}

/// Upsert the seed into `llm_benchmark_scores`. Idempotent: a row is written
/// only when it is missing or its score changed. Returns the number of rows
/// written (0 on a warm database).
pub fn seed_scores(conn: &Connection) -> rusqlite::Result<usize> {
    let rows = parse_seed().map_err(|err| {
        warn!(error = %err, "benchmark_seed.json is not decodable");
        rusqlite::Error::InvalidQuery
    })?;

    let mut written = 0usize;
    for (model_id, benchmark, score) in rows {
        let existing: Option<(f64, String)> = conn
            .query_row(
                "SELECT score, source FROM llm_benchmark_scores
                 WHERE model_id = ?1 AND benchmark = ?2",
                params![model_id, benchmark],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        let needs_write = match &existing {
            None => true,
            Some((current, source)) => {
                source == SEED_SOURCE && (current - score).abs() > f64::EPSILON
            }
        };
        if !needs_write {
            continue;
        }

        conn.execute(
            "INSERT INTO llm_benchmark_scores (model_id, benchmark, score, source, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
             ON CONFLICT(model_id, benchmark) DO UPDATE SET
                 score = excluded.score,
                 source = excluded.source,
                 updated_at = CURRENT_TIMESTAMP",
            params![model_id, benchmark, score, SEED_SOURCE],
        )?;
        written += 1;
    }
    Ok(written)
}

/// Startup hook called once from main.rs after migrations. Seeding failures
/// are logged and non-fatal: the router simply falls back to cost heuristics.
pub fn sync_at_startup(db: &DbHandle) {
    match db.connect().and_then(|conn| seed_scores(&conn)) {
        Ok(written) if written > 0 => {
            info!(written, "llm_benchmark_scores seeded from benchmark_seed.json")
        }
        Ok(_) => info!("llm_benchmark_scores already up to date"),
        Err(err) => warn!(error = %err, "Failed to seed llm_benchmark_scores; routing will use cost heuristics"),
    }
}

/// Normalize a model id for fuzzy matching: lowercase alphanumerics only
/// (so `claude-sonnet-4.5` ≡ `claude-sonnet-4-5`), with a trailing 8-digit
/// date stamp stripped (so `claude-sonnet-4-5-20250929` matches both).
pub fn normalize_model_id(id: &str) -> String {
    let mut normalized: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    if normalized.len() > 8 {
        let tail = &normalized[normalized.len() - 8..];
        if tail.chars().all(|c| c.is_ascii_digit()) {
            normalized.truncate(normalized.len() - 8);
        }
    }
    normalized
}

/// Load every benchmark row into memory. The table is tiny (a few hundred
/// rows), so one full scan per routing decision beats N queries and keeps
/// fuzzy matching simple and deterministic.
pub fn load_all_scores(conn: &Connection) -> rusqlite::Result<HashMap<String, HashMap<String, f64>>> {
    let mut stmt =
        conn.prepare("SELECT model_id, benchmark, score FROM llm_benchmark_scores")?;
    let rows = stmt.query_map(params![], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
        ))
    })?;
    let mut map: HashMap<String, HashMap<String, f64>> = HashMap::new();
    for row in rows {
        let (model_id, benchmark, score) = row?;
        map.entry(model_id).or_default().insert(benchmark, score);
    }
    Ok(map)
}

/// Fuzzy lookup of a model's benchmark rows in a map from
/// [`load_all_scores`]. Exact normalized match wins; otherwise the longest
/// seed id that is a prefix of (or prefixed by) the query wins, so dated or
/// suffixed variants (`claude-sonnet-4-5-20250929`, `gpt-4o-2024-11-20`)
/// resolve to their canonical entry. Ties break on the seed id for
/// determinism.
pub fn fuzzy_scores<'a>(
    all: &'a HashMap<String, HashMap<String, f64>>,
    model_id: &str,
) -> Option<&'a HashMap<String, f64>> {
    if let Some(scores) = all.get(model_id) {
        return Some(scores);
    }
    let needle = normalize_model_id(model_id);
    if needle.is_empty() {
        return None;
    }

    // Pass 1: exact normalized equality beats any prefix relation (so the
    // query "gpt-4o" resolves to "gpt-4o", never to "gpt-4o-mini").
    let mut exact: Option<&String> = None;
    for seed_id in all.keys() {
        if normalize_model_id(seed_id) == needle {
            exact = match exact {
                Some(current) if current <= seed_id => Some(current),
                _ => Some(seed_id),
            };
        }
    }
    if let Some(seed_id) = exact {
        return all.get(seed_id);
    }

    // Pass 2: prefix relation in either direction; the longest (most
    // specific) seed wins, ties on the seed id.
    let mut best: Option<(&String, usize)> = None;
    for seed_id in all.keys() {
        let seed_norm = normalize_model_id(seed_id);
        if seed_norm.is_empty()
            || !(seed_norm.starts_with(&needle) || needle.starts_with(&seed_norm))
        {
            continue;
        }
        let specific = seed_norm.len();
        best = match best {
            Some((current_id, current_len))
                if current_len > specific
                    || (current_len == specific && current_id <= seed_id) =>
            {
                Some((current_id, current_len))
            }
            _ => Some((seed_id, specific)),
        };
    }
    best.and_then(|(seed_id, _)| all.get(seed_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed_map() -> HashMap<String, HashMap<String, f64>> {
        let mut map = HashMap::new();
        map.insert(
            "claude-sonnet-4.5".to_string(),
            HashMap::from([
                ("gpqa".to_string(), 83.4),
                ("aider".to_string(), 82.0),
                ("arena_elo".to_string(), 1390.0),
            ]),
        );
        map.insert(
            "gpt-4o".to_string(),
            HashMap::from([("mmlu".to_string(), 88.7)]),
        );
        map.insert(
            "gpt-4o-mini".to_string(),
            HashMap::from([("mmlu".to_string(), 82.0)]),
        );
        map
    }

    #[test]
    fn embedded_seed_is_valid_and_sourced() {
        let rows = parse_seed().expect("benchmark_seed.json must parse");
        assert!(rows.len() > 50, "seed should cover the major families");
        for (model_id, benchmark, score) in &rows {
            assert!(!model_id.is_empty());
            assert!(
                ["humaneval", "mmlu", "gpqa", "gsm8k", "arena_elo", "aider"]
                    .contains(&benchmark.as_str()),
                "unknown benchmark {benchmark}"
            );
            assert!(*score > 0.0 && score.is_finite());
        }
    }

    #[test]
    fn normalize_strips_separators_and_dates() {
        assert_eq!(normalize_model_id("claude-sonnet-4.5"), "claudesonnet45");
        assert_eq!(
            normalize_model_id("claude-sonnet-4-5-20250929"),
            "claudesonnet45"
        );
        assert_eq!(normalize_model_id("GPT-4o"), "gpt4o");
        assert_eq!(normalize_model_id("gpt-4o-2024-11-20"), "gpt4o");
        // Short numeric suffixes that are not dates survive.
        assert_eq!(normalize_model_id("qwen3-235b-a22b"), "qwen3235ba22b");
    }

    #[test]
    fn fuzzy_match_exact_and_dated_variants() {
        let map = seed_map();
        assert!(fuzzy_scores(&map, "claude-sonnet-4.5").is_some());
        assert!(fuzzy_scores(&map, "claude-sonnet-4-5").is_some());
        assert!(fuzzy_scores(&map, "claude-sonnet-4-5-20250929").is_some());
        assert_eq!(
            fuzzy_scores(&map, "claude-sonnet-4-5-20250929").unwrap()["gpqa"],
            83.4
        );
    }

    #[test]
    fn fuzzy_match_prefers_more_specific_seed() {
        let map = seed_map();
        // "gpt-4o-mini" must not resolve to the "gpt-4o" row...
        let scores = fuzzy_scores(&map, "gpt-4o-mini").unwrap();
        assert_eq!(scores["mmlu"], 82.0);
        // ...and the bare "gpt-4o" query must not resolve to "gpt-4o-mini".
        let scores = fuzzy_scores(&map, "gpt-4o").unwrap();
        assert_eq!(scores["mmlu"], 88.7);
        assert_eq!(fuzzy_scores(&map, "gpt-4o-2024-11-20").unwrap()["mmlu"], 88.7);
    }

    #[test]
    fn fuzzy_match_unknown_model_returns_none() {
        let map = seed_map();
        assert!(fuzzy_scores(&map, "llama-4-maverick").is_none());
        assert!(fuzzy_scores(&map, "").is_none());
    }

    #[test]
    fn seed_scores_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE llm_benchmark_scores (
                model_id  TEXT NOT NULL,
                benchmark TEXT NOT NULL,
                score     REAL,
                source    TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (model_id, benchmark)
            );",
        )
        .unwrap();

        let first = seed_scores(&conn).unwrap();
        assert!(first > 0);
        let second = seed_scores(&conn).unwrap();
        assert_eq!(second, 0, "second run must be a no-op");

        // Hand-tuned rows (source != published) are never clobbered.
        conn.execute(
            "UPDATE llm_benchmark_scores SET score = 1.0, source = 'manual'
             WHERE model_id = 'claude-sonnet-4.5' AND benchmark = 'gpqa'",
            params![],
        )
        .unwrap();
        let third = seed_scores(&conn).unwrap();
        assert_eq!(third, 0);
        let kept: f64 = conn
            .query_row(
                "SELECT score FROM llm_benchmark_scores
                 WHERE model_id = 'claude-sonnet-4.5' AND benchmark = 'gpqa'",
                params![],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(kept, 1.0);
    }
}
