use crate::{Registry, RegistryItem, RegistryType, SearchQuery};
use std::collections::HashMap;
use anyhow::Result;
use chrono::Utc;

#[tokio::test]
async fn test_registry_creation() -> Result<()> {
    // Initialize an in-memory registry for testing
    let mut registry = Registry::new("sqlite::memory:").await?;

    // Create a test item
    let test_item = RegistryItem {
        id: "test-item-1".to_string(),
        item_type: RegistryType::Skill,
        name: "test-skill".to_string(),
        version: "1.0.0".to_string(),
        description: Some("A test skill".to_string()),
        tags: vec!["test".to_string(), "example".to_string()],
        content_hash: "abc123".to_string(), // Simplified for test
        metadata: serde_json::json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        publisher_id: "test-node".to_string(),
        channels: vec!["experimental".to_string()],
        downloads: 0,
        rating: None,
    };

    // Publish the item
    let item_id = registry.publish(test_item).await?;

    // Verify the item was published
    let retrieved_item = registry.get_item(&item_id).await?;
    assert!(retrieved_item.is_some());
    assert_eq!(retrieved_item.unwrap().name, "test-skill");

    println!("✓ Registry creation and publishing test passed!");
    Ok(())
}

    #[tokio::test]
    async fn test_registry_search() -> Result<()> {
        // Initialize an in-memory registry for testing
        let mut registry = Registry::new("sqlite::memory:").await?;

    // Create and publish a test item
    let test_item = RegistryItem {
        id: "test-item-2".to_string(),
        item_type: RegistryType::Tool,
        name: "search-test-tool".to_string(),
        version: "1.0.0".to_string(),
        description: Some("A tool for testing search functionality".to_string()),
        tags: vec!["search".to_string(), "test".to_string()],
        content_hash: "def456".to_string(),
        metadata: serde_json::json!({}),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        publisher_id: "test-node".to_string(),
        channels: vec!["stable".to_string()],
        downloads: 5,
        rating: Some(4.5),
    };

        registry.publish(test_item).await?;

        // Test search functionality
    let search_query = SearchQuery {
        text: "search".to_string(),
        filters: HashMap::new(),
        limit: 10,
        offset: 0,
    };

    let (results, total) = registry.search(search_query).await?;

    assert_eq!(total, 1);
    assert!(!results.is_empty());
    assert_eq!(results[0].name, "search-test-tool");

    println!("✓ Registry search test passed!");
    Ok(())
}
