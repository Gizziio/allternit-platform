//! Static model alias catalog.
//!
//! Maps Allternit-facing model ids to upstream provider/model pairs. This is
//! intentionally conservative: only models we can actually route today are
//! listed. Live upstream metadata is merged in by the router at runtime.

use std::collections::HashMap;

/// One entry in the alias catalog.
#[derive(Debug, Clone)]
pub struct ModelAliasEntry {
    /// Allternit-facing model id (e.g. `llama-3.1-8b`).
    pub alias: String,
    /// Which provider owns this alias (e.g. `openrouter`).
    pub provider: String,
    /// The provider's native model id (e.g. `meta-llama/llama-3.1-8b-instruct`).
    pub upstream_id: String,
    /// Additional ids that resolve to this same model.
    pub aliases: Option<Vec<String>>,
    /// Unix timestamp for the `/v1/models` `created` field.
    pub created: u64,
}

/// Immutable catalog of model aliases.
#[derive(Debug, Clone, Default)]
pub struct ModelAliasMap {
    entries: Vec<ModelAliasEntry>,
    by_alias: HashMap<String, usize>,
}

impl ModelAliasMap {
    /// Build a catalog from a list of entries.
    pub fn new(entries: Vec<ModelAliasEntry>) -> Self {
        let mut by_alias = HashMap::with_capacity(entries.len() * 2);
        for (idx, entry) in entries.iter().enumerate() {
            by_alias.insert(entry.alias.clone(), idx);
            if let Some(aliases) = &entry.aliases {
                for a in aliases {
                    by_alias.insert(a.clone(), idx);
                }
            }
        }
        Self { entries, by_alias }
    }

    /// Resolve an Allternit model id to its catalog entry.
    pub fn resolve(&self, alias: &str) -> Option<&ModelAliasEntry> {
        self.by_alias.get(alias).and_then(|&idx| self.entries.get(idx))
    }

    /// Iterate all primary entries (one per model, not per alias).
    pub fn entries(&self) -> &[ModelAliasEntry] {
        &self.entries
    }
}

/// The production starter catalog. These are all routed through OpenRouter for
/// Phase A; later phases will add direct-provider and other upstream routes.
pub fn starter_catalog() -> ModelAliasMap {
    ModelAliasMap::new(vec![
        ModelAliasEntry {
            alias: "llama-3.1-8b".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "meta-llama/llama-3.1-8b-instruct".to_string(),
            aliases: Some(vec!["llama3.1-8b".to_string()]),
            created: 1722470400, // 2024-08-01
        },
        ModelAliasEntry {
            alias: "llama-3.1-70b".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "meta-llama/llama-3.1-70b-instruct".to_string(),
            aliases: Some(vec!["llama3.1-70b".to_string()]),
            created: 1722470400,
        },
        ModelAliasEntry {
            alias: "claude-sonnet-4".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "anthropic/claude-sonnet-4-20250514".to_string(),
            aliases: Some(vec!["claude-sonnet".to_string()]),
            created: 1746057600, // 2025-05-01
        },
        ModelAliasEntry {
            alias: "gpt-4o".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "openai/gpt-4o".to_string(),
            aliases: Some(vec!["gpt4o".to_string()]),
            created: 1715731200, // 2024-05-15
        },
        ModelAliasEntry {
            alias: "qwen-2.5-72b".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "qwen/qwen-2.5-72b-instruct".to_string(),
            aliases: Some(vec!["qwen2.5-72b".to_string()]),
            created: 1727740800, // 2024-10-01
        },
        ModelAliasEntry {
            alias: "mistral-large".to_string(),
            provider: "openrouter".to_string(),
            upstream_id: "mistralai/mistral-large".to_string(),
            aliases: Some(vec!["mistral".to_string()]),
            created: 1709251200, // 2024-03-01
        },
    ])
}
