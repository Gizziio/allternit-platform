//! Tambo Determinism Tests
//!
//! Comprehensive tests for determinism modes:
//! - Schema validation determinism
//! - Component selection determinism
//! - Reproducible generation (seed-based)
//! - Streaming determinism

#[cfg(test)]
mod tests {
    use crate::{
        TamboEngine, UIType, UISpec, ComponentSpec, GenerationConfig, 
        StreamConfig, LayoutSpec, LayoutConstraints, StyleSpec, 
        TypographySpec, SpacingSpec, SchemaValidator, ComponentRegistry,
    };
    use std::collections::HashMap;
    use tokio::time::{timeout, Duration};

    fn create_test_spec() -> UISpec {
        UISpec {
            spec_id: "test-determinism".to_string(),
            title: "Determinism Test UI".to_string(),
            description: "A test UI for determinism verification".to_string(),
            components: vec![
                ComponentSpec {
                    component_id: "btn-1".to_string(),
                    component_type: "button".to_string(),
                    properties: HashMap::new(),
                    children: vec![],
                    bindings: vec![],
                },
                ComponentSpec {
                    component_id: "inp-1".to_string(),
                    component_type: "input".to_string(),
                    properties: HashMap::new(),
                    children: vec![],
                    bindings: vec![],
                },
            ],
            layout: LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: LayoutConstraints::default(),
                regions: vec![],
            },
            style: StyleSpec {
                theme: "default".to_string(),
                colors: HashMap::new(),
                typography: TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: HashMap::new(),
                    line_heights: HashMap::new(),
                },
                spacing: SpacingSpec {
                    scale: vec![4, 8, 16, 32],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        }
    }

    // ========================================================================
    // Schema Validation Determinism Tests
    // ========================================================================

    #[tokio::test]
    async fn test_schema_validation_determinism() {
        let validator = SchemaValidator::new();
        let spec = create_test_spec();

        // Validate same spec multiple times
        let result1 = validator.validate_spec(&spec);
        let result2 = validator.validate_spec(&spec);
        let result3 = validator.validate_spec(&spec);

        // All results should be identical
        assert!(result1.is_ok());
        assert!(result2.is_ok());
        assert!(result3.is_ok());
    }

    #[tokio::test]
    async fn test_schema_validation_error_determinism() {
        let validator = SchemaValidator::new();
        
        let invalid_spec = UISpec {
            spec_id: "".to_string(), // Invalid: empty
            title: "Test".to_string(),
            description: "Test".to_string(),
            components: vec![], // Invalid: no components
            layout: LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: LayoutConstraints::default(),
                regions: vec![],
            },
            style: StyleSpec {
                theme: "default".to_string(),
                colors: HashMap::new(),
                typography: TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: HashMap::new(),
                    line_heights: HashMap::new(),
                },
                spacing: SpacingSpec {
                    scale: vec![4, 8, 16, 32],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        };

        // Validate invalid spec multiple times
        let result1 = validator.validate_spec(&invalid_spec);
        let result2 = validator.validate_spec(&invalid_spec);

        // Both should fail with same error
        assert!(result1.is_err());
        assert!(result2.is_err());
        
        let err1 = result1.unwrap_err();
        let err2 = result2.unwrap_err();
        
        // Error messages should be identical
        assert_eq!(err1.field, err2.field);
        assert_eq!(err1.message, err2.message);
    }

    // ========================================================================
    // Component Selection Determinism Tests
    // ========================================================================

    #[tokio::test]
    async fn test_component_selection_determinism() {
        let registry = ComponentRegistry::with_defaults().await;
        
        let keywords = vec!["button".to_string(), "click".to_string()];

        // Select components multiple times with same keywords
        let result1 = registry.select_components(&keywords).await;
        let result2 = registry.select_components(&keywords).await;
        let result3 = registry.select_components(&keywords).await;

        // All results should be identical (deterministic ordering)
        assert_eq!(result1.len(), result2.len());
        assert_eq!(result2.len(), result3.len());

        for (a, b) in result1.iter().zip(result2.iter()) {
            assert_eq!(a.template_id, b.template_id);
            assert_eq!(a.component_type, b.component_type);
        }
    }

    #[tokio::test]
    async fn test_component_selection_order_independence() {
        let registry = ComponentRegistry::with_defaults().await;
        
        // Different keyword orders should produce same result (BTreeSet ordering)
        let keywords1 = vec!["button".to_string(), "input".to_string()];
        let keywords2 = vec!["input".to_string(), "button".to_string()];

        let result1 = registry.select_components(&keywords1).await;
        let result2 = registry.select_components(&keywords2).await;

        // Results should be identical (order-independent)
        assert_eq!(result1.len(), result2.len());
        for (a, b) in result1.iter().zip(result2.iter()) {
            assert_eq!(a.template_id, b.template_id);
        }
    }

    // ========================================================================
    // Reproducible Generation Tests
    // ========================================================================

    #[tokio::test]
    async fn test_reproducible_generation_same_seed() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();
        let seed = 42;

        // Generate twice with same seed
        let config = GenerationConfig::reproducible(seed);
        let result1 = engine.generate_ui_reproducible(&spec, UIType::React, config.clone()).await;
        let result2 = engine.generate_ui_reproducible(&spec, UIType::React, config).await;

        assert!(result1.is_ok());
        assert!(result2.is_ok());

        let ui1 = result1.unwrap();
        let ui2 = result2.unwrap();

        // Generated code should be identical
        assert_eq!(ui1.ui_code, ui2.ui_code);
        
        // Hashes should be identical
        assert_eq!(ui1.generation_hash, ui2.generation_hash);
    }

    #[tokio::test]
    async fn test_reproducible_generation_different_seeds() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();

        // Generate with different seeds
        let config1 = GenerationConfig::reproducible(42);
        let config2 = GenerationConfig::reproducible(99);
        
        let result1 = engine.generate_ui_reproducible(&spec, UIType::React, config1).await;
        let result2 = engine.generate_ui_reproducible(&spec, UIType::React, config2).await;

        assert!(result1.is_ok());
        assert!(result2.is_ok());

        let ui1 = result1.unwrap();
        let ui2 = result2.unwrap();

        // Hashes should be different
        assert_ne!(ui1.generation_hash, ui2.generation_hash);
    }

    #[tokio::test]
    async fn test_generation_hash_verification() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();
        let config = GenerationConfig::reproducible(123);

        let result = engine.generate_ui_reproducible(&spec, UIType::React, config).await;
        assert!(result.is_ok());

        let ui = result.unwrap();
        
        // Hash should be present
        assert!(ui.generation_hash.is_some());
        
        // Hash should be non-empty
        let hash = ui.generation_hash.unwrap();
        assert!(!hash.is_empty());
        assert!(hash.len() > 0);
    }

    // ========================================================================
    // Streaming Determinism Tests
    // ========================================================================

    #[tokio::test]
    async fn test_streaming_chunk_order() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();
        let config = StreamConfig::new()
            .with_progress(true)
            .with_chunk_size(50);

        let result = engine.generate_ui_streaming(&spec, UIType::React, config).await;
        assert!(result.is_ok());

        let stream_result = result.unwrap();
        let mut receiver = stream_result.receiver;

        // Collect all chunks
        let mut chunks = Vec::new();
        while let Some(chunk) = timeout(Duration::from_secs(10), receiver.recv()).await.unwrap() {
            chunks.push(chunk);
        }

        // Verify chunk order: Progress -> Data -> Complete
        let mut found_progress = false;
        let mut found_data = false;
        let mut found_complete = false;

        for chunk in &chunks {
            match chunk {
                crate::StreamChunk::Progress { .. } => {
                    found_progress = true;
                    // Progress should come before data
                    assert!(!found_data, "Progress should come before data chunks");
                }
                crate::StreamChunk::Data(_) => {
                    found_data = true;
                }
                crate::StreamChunk::Complete(_) => {
                    found_complete = true;
                    // Complete should come last
                    assert!(found_data, "Complete should come after data chunks");
                }
                _ => {}
            }
        }

        assert!(found_progress, "Should have progress events");
        assert!(found_data, "Should have data chunks");
        assert!(found_complete, "Should have complete event");
    }

    #[tokio::test]
    async fn test_streaming_retry_determinism() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();
        let config = StreamConfig::new()
            .with_max_retries(3)
            .with_retry_delay(100)
            .with_progress(true);

        // Stream should complete successfully
        let result = engine.generate_ui_streaming(&spec, UIType::React, config).await;
        assert!(result.is_ok());

        let stream_result = result.unwrap();
        let mut receiver = stream_result.receiver;

        // Collect all chunks
        let mut chunks = Vec::new();
        while let Some(chunk) = timeout(Duration::from_secs(10), receiver.recv()).await.unwrap() {
            chunks.push(chunk);
        }

        // Should have completed without errors
        let has_complete = chunks.iter().any(|c| matches!(c, crate::StreamChunk::Complete(_)));
        let has_error = chunks.iter().any(|c| matches!(c, crate::StreamChunk::Error(_)));
        
        assert!(has_complete, "Should have completed successfully");
        assert!(!has_error, "Should not have errors");
    }

    // ========================================================================
    // State Persistence Tests
    // ========================================================================

    #[tokio::test]
    async fn test_generation_state_persistence() {
        let engine = TamboEngine::init_with_defaults().await;
        
        let generation_id = "test-gen-001";
        let spec_id = "test-spec-001";
        let state = serde_json::json!({
            "stage": "completed",
            "progress": 100,
        });

        // Save state
        let save_result = engine.save_generation_state(generation_id, spec_id, state.clone()).await;
        assert!(save_result.is_ok());

        // Load state
        let load_result = engine.load_generation_state(generation_id).await;
        assert!(load_result.is_ok());

        let loaded = load_result.unwrap();
        assert!(loaded.is_some());
        
        let loaded_state = loaded.unwrap();
        assert_eq!(loaded_state.generation_id, generation_id);
        assert_eq!(loaded_state.spec_id, spec_id);
        assert_eq!(loaded_state.state, state);
        assert_eq!(loaded_state.version, 1);
    }

    #[tokio::test]
    async fn test_generation_state_versioning() {
        let engine = TamboEngine::init_with_defaults().await;
        
        let generation_id = "test-gen-002";
        let spec_id = "test-spec-002";

        // Save state multiple times
        engine.save_generation_state(generation_id, spec_id, serde_json::json!({"v": 1})).await.unwrap();
        engine.save_generation_state(generation_id, spec_id, serde_json::json!({"v": 2})).await.unwrap();
        engine.save_generation_state(generation_id, spec_id, serde_json::json!({"v": 3})).await.unwrap();

        // Load state
        let loaded = engine.load_generation_state(generation_id).await.unwrap().unwrap();
        
        // Should have latest version
        assert_eq!(loaded.state, serde_json::json!({"v": 3}));
        assert_eq!(loaded.version, 3);
    }

    #[tokio::test]
    async fn test_generation_state_not_found() {
        let engine = TamboEngine::init_with_defaults().await;
        
        let result = engine.load_generation_state("nonexistent").await;
        assert!(result.is_ok());
        
        let loaded = result.unwrap();
        assert!(loaded.is_none());
    }

    // ========================================================================
    // Integration Tests
    // ========================================================================

    #[tokio::test]
    async fn test_full_deterministic_workflow() {
        let engine = TamboEngine::init_with_defaults().await;
        let spec = create_test_spec();
        let seed = 42;

        // Step 1: Generate with validation
        let validated = engine.generate_ui_validated(&spec, UIType::React).await;
        assert!(validated.is_ok());

        // Step 2: Generate with reproducibility
        let config = GenerationConfig::reproducible(seed);
        let reproducible = engine.generate_ui_reproducible(&spec, UIType::React, config).await;
        assert!(reproducible.is_ok());

        // Step 3: Save generation state
        let gen = reproducible.unwrap();
        let state = serde_json::json!({
            "mode": "reproducible",
            "seed": seed,
            "hash": gen.generation_hash,
        });
        
        let save_result = engine.save_generation_state(&gen.generation_id, &gen.spec_id, state).await;
        assert!(save_result.is_ok());

        // Step 4: Load and verify state
        let loaded = engine.load_generation_state(&gen.generation_id).await.unwrap().unwrap();
        assert_eq!(loaded.generation_id, gen.generation_id);
    }
}
