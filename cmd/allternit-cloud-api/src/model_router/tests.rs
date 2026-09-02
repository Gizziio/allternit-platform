//! Unit tests for the model router.

use super::catalog::{starter_catalog, ModelAliasEntry, ModelAliasMap};
use super::{ChatCompletionRequest, Message, ModelRouter};

#[test]
fn starter_catalog_resolves_known_aliases() {
    let catalog = starter_catalog();

    assert!(catalog.resolve("llama-3.1-8b").is_some());
    assert!(catalog.resolve("llama3.1-8b").is_some()); // alternate alias
    assert!(catalog.resolve("gpt-4o").is_some());
    assert!(catalog.resolve("claude-sonnet-4").is_some());
    assert!(catalog.resolve("qwen-2.5-72b").is_some());
    assert!(catalog.resolve("mistral-large").is_some());
}

#[test]
fn unknown_model_returns_none() {
    let catalog = starter_catalog();
    assert!(catalog.resolve("not-a-real-model").is_none());
}

#[test]
fn catalog_entries_are_primary_aliases_only() {
    let catalog = starter_catalog();
    // Six primary models, each with optional secondary aliases.
    assert_eq!(catalog.entries().len(), 6);
}

#[test]
fn model_alias_map_supports_multiple_aliases() {
    let catalog = ModelAliasMap::new(vec![ModelAliasEntry {
        alias: "primary".to_string(),
        provider: "openrouter".to_string(),
        upstream_id: "upstream/primary".to_string(),
        aliases: Some(vec!["alt1".to_string(), "alt2".to_string()]),
        created: 12345,
    }]);

    let primary = catalog.resolve("primary").unwrap();
    assert_eq!(primary.upstream_id, "upstream/primary");

    let alt1 = catalog.resolve("alt1").unwrap();
    assert_eq!(alt1.alias, "primary");

    let alt2 = catalog.resolve("alt2").unwrap();
    assert_eq!(alt2.alias, "primary");
}

#[test]
fn disabled_router_reports_not_enabled() {
    let router = ModelRouter::disabled(starter_catalog());
    assert!(!router.is_enabled());
}

#[tokio::test]
async fn disabled_router_list_models_returns_static_catalog() {
    let router = ModelRouter::disabled(starter_catalog());
    let models = router.list_models().await;
    assert_eq!(models.len(), 6);
    assert!(models.iter().any(|m| m.id == "llama-3.1-8b"));
}

#[tokio::test]
async fn chat_completion_request_detects_streaming() {
    let non_stream = ChatCompletionRequest {
        model: "gpt-4o".to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: "hello".to_string(),
        }],
        temperature: None,
        max_tokens: None,
        stream: None,
        top_p: None,
        extra: serde_json::Map::new(),
    };
    assert!(!non_stream.is_streaming());

    let stream = ChatCompletionRequest {
        stream: Some(true),
        ..non_stream
    };
    assert!(stream.is_streaming());
}
