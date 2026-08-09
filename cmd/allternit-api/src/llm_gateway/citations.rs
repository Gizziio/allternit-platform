//! RAG-attribution fallback for non-Anthropic providers.
//!
//! `CitationsService` stores retrieved passages and provides helpers to:
//! - prepend a formatted citations context block to a prompt, and
//! - parse `[cite:<id>]` references out of model output into `Citation` objects.
//!
//! Anthropic models receive native `citations: true` support through Gizzi;
//! every other provider falls back to the explicit context block + inline
//! citation markers implemented here.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// A passage retrieved by a RAG pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievedPassage {
    pub id: String,
    pub title: String,
    pub url: String,
    pub content: String,
    pub score: f64,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Provider-agnostic citation emitted by the gateway fallback path.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Citation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cited_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_number: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

/// In-memory store for retrieved passages used by the citation fallback.
///
/// A single global instance is exposed via [`CitationsService::global()`] so
/// the gateway handler can reach stored passages without threading the service
/// through every `AppState` constructor. Unit tests should prefer
/// [`CitationsService::new()`] to avoid cross-test interference.
#[derive(Debug, Clone)]
pub struct CitationsService {
    passages: Arc<Mutex<HashMap<String, RetrievedPassage>>>,
}

static GLOBAL_CITATIONS: Lazy<CitationsService> = Lazy::new(CitationsService::new);

static CITE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\[cite:([a-zA-Z0-9_\-]+)\]").expect("cite regex is valid"));

impl Default for CitationsService {
    fn default() -> Self {
        Self::new()
    }
}

impl CitationsService {
    /// Create a new, empty service instance.
    pub fn new() -> Self {
        Self {
            passages: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Return the global service instance used by the gateway.
    pub fn global() -> &'static CitationsService {
        &GLOBAL_CITATIONS
    }

    /// Store or replace a retrieved passage.
    pub fn insert(&self, passage: RetrievedPassage) {
        if let Ok(mut store) = self.passages.lock() {
            store.insert(passage.id.clone(), passage);
        }
    }

    /// Look up a passage by id.
    pub fn get(&self, id: &str) -> Option<RetrievedPassage> {
        self.passages.lock().ok().and_then(|store| store.get(id).cloned())
    }

    /// Return all stored passages, sorted by score descending.
    pub fn list(&self) -> Vec<RetrievedPassage> {
        let mut passages: Vec<RetrievedPassage> = self
            .passages
            .lock()
            .map(|store| store.values().cloned().collect())
            .unwrap_or_default();
        passages.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        passages
    }

    /// Remove all stored passages.
    pub fn clear(&self) {
        if let Ok(mut store) = self.passages.lock() {
            store.clear();
        }
    }

    /// Count stored passages.
    pub fn len(&self) -> usize {
        self.passages.lock().map(|store| store.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Build a prompt context block that asks the model to cite sources by id.
    ///
    /// Returns `None` when no passages are available, so callers can skip the
    /// injection entirely.
    pub fn format_prompt_context(&self) -> Option<String> {
        let passages = self.list();
        if passages.is_empty() {
            return None;
        }

        let mut context = String::from(
            "Use the following retrieved sources to answer. \
             Cite any source you use with an inline marker like [cite:<id>].\n\n",
        );
        for passage in passages {
            context.push_str(&format!(
                "[source id={}] title=\"{}\" url=\"{}\" score={:.4}\n{}\n\n",
                passage.id, passage.title, passage.url, passage.score, passage.content
            ));
        }
        Some(context)
    }

    /// Parse `[cite:<id>]` references from model output and hydrate `Citation`
    /// objects from the stored passage metadata. References to unknown ids are
    /// dropped so the response only contains attributable citations.
    pub fn parse_citations(&self, text: &str) -> Vec<Citation> {
        let mut seen = std::collections::HashSet::new();
        CITE_RE
            .captures_iter(text)
            .filter_map(|cap| {
                let id = cap.get(1)?.as_str().to_string();
                if !seen.insert(id.clone()) {
                    return None;
                }
                let passage = self.get(&id)?;
                Some(Citation {
                    id: Some(id),
                    cited_text: Some(passage.content.clone()),
                    title: Some(passage.title.clone()),
                    url: Some(passage.url.clone()),
                    document_title: Some(
                        passage
                            .metadata
                            .get("document_title")
                            .and_then(|v| v.as_str().map(str::to_string))
                            .unwrap_or_else(|| passage.title.clone()),
                    ),
                    page_number: passage
                        .metadata
                        .get("page_number")
                        .and_then(|v| v.as_u64().map(|n| n as usize)),
                    score: Some(passage.score),
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_passage(id: &str, score: f64) -> RetrievedPassage {
        RetrievedPassage {
            id: id.to_string(),
            title: format!("Title {id}"),
            url: format!("https://example.test/{id}"),
            content: format!("Content of passage {id}."),
            score,
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn stores_and_retrieves_passages() {
        let service = CitationsService::new();
        let p1 = sample_passage("abc123", 0.95);
        let p2 = sample_passage("def456", 0.87);

        service.insert(p1.clone());
        service.insert(p2.clone());

        assert_eq!(service.len(), 2);
        assert_eq!(service.get("abc123").map(|p| p.id), Some("abc123".to_string()));
        assert_eq!(service.get("def456").map(|p| p.title), Some("Title def456".to_string()));

        let list = service.list();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, "abc123"); // higher score first
        assert_eq!(list[1].id, "def456");
    }

    #[test]
    fn replaces_passage_with_same_id() {
        let service = CitationsService::new();
        let mut p = sample_passage("abc123", 0.95);
        service.insert(p.clone());
        p.score = 0.50;
        service.insert(p);

        assert_eq!(service.len(), 1);
        assert!((service.get("abc123").unwrap().score - 0.50).abs() < f64::EPSILON);
    }

    #[test]
    fn clear_removes_all_passages() {
        let service = CitationsService::new();
        service.insert(sample_passage("abc123", 0.95));
        service.clear();
        assert!(service.is_empty());
        assert!(service.get("abc123").is_none());
    }

    #[test]
    fn format_prompt_context_includes_passages() {
        let service = CitationsService::new();
        service.insert(sample_passage("abc123", 0.95));

        let context = service.format_prompt_context().expect("context exists");
        assert!(context.contains("[source id=abc123]"));
        assert!(context.contains("Cite any source you use"));
        assert!(context.contains("Content of passage abc123."));
    }

    #[test]
    fn format_prompt_context_returns_none_when_empty() {
        let service = CitationsService::new();
        assert!(service.format_prompt_context().is_none());
    }

    #[test]
    fn parse_citations_hydrates_from_stored_passages() {
        let service = CitationsService::new();
        let mut p = sample_passage("abc123", 0.95);
        p.metadata.insert("page_number".to_string(), json!(42));
        p.metadata.insert("document_title".to_string(), json!("PDF Guide"));
        service.insert(p);

        let text = "According to the source [cite:abc123], this is true.";
        let citations = service.parse_citations(text);

        assert_eq!(citations.len(), 1);
        let c = &citations[0];
        assert_eq!(c.id.as_deref(), Some("abc123"));
        assert_eq!(c.title.as_deref(), Some("Title abc123"));
        assert_eq!(c.url.as_deref(), Some("https://example.test/abc123"));
        assert_eq!(c.page_number, Some(42));
        assert_eq!(c.document_title.as_deref(), Some("PDF Guide"));
        assert!((c.score.unwrap() - 0.95).abs() < f64::EPSILON);
    }

    #[test]
    fn parse_citations_deduplicates_repeated_refs() {
        let service = CitationsService::new();
        service.insert(sample_passage("abc123", 0.95));

        let text = "[cite:abc123] and again [cite:abc123].";
        let citations = service.parse_citations(text);
        assert_eq!(citations.len(), 1);
    }

    #[test]
    fn parse_citations_ignores_unknown_ids() {
        let service = CitationsService::new();
        service.insert(sample_passage("abc123", 0.95));

        let text = "[cite:abc123] [cite:unknown]";
        let citations = service.parse_citations(text);
        assert_eq!(citations.len(), 1);
        assert_eq!(citations[0].id.as_deref(), Some("abc123"));
    }
}
