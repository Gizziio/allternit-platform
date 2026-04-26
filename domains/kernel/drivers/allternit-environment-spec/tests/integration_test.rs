//! Integration Tests for N5 Environment Spec
//!
//! Tests the full flow from source → resolved spec → converted image

use allternit_environment_spec::{
    EnvironmentSource, EnvironmentSpec, EnvironmentSpecLoader, FeatureSpec, MountSpec, MountType,
    ResourceRequirements,
};
use std::collections::HashMap;
use std::path::PathBuf;

/// Helper to get fixture path
fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

/// Helper to create temp cache dir
fn temp_cache_dir() -> PathBuf {
    std::env::temp_dir()
        .join("allternit_integration_test")
        .join(format!("test_{}", std::process::id()))
}

fn cleanup_cache(dir: &PathBuf) {
    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn test_load_devcontainer_rust() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    let config_path = fixture_path("rust-devcontainer");
    let spec = loader.load(config_path.to_str().unwrap()).await;

    // Should parse successfully
    assert!(
        spec.is_ok(),
        "Failed to load Rust devcontainer: {:?}",
        spec.err()
    );

    let spec = spec.unwrap();
    assert_eq!(spec.source, EnvironmentSource::DevContainer);
    assert!(spec.image.contains("rust"));
    assert_eq!(spec.workspace_folder, "/workspace");

    // Check features
    assert!(!spec.features.is_empty(), "Should have features installed");

    // Check mounts
    assert!(!spec.mounts.is_empty(), "Should have mounts configured");

    // Check resources
    assert!(spec.resources.cpus.is_some());
    assert!(spec.resources.memory_gb.is_some());

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_load_devcontainer_nodejs() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    let config_path = fixture_path("nodejs-devcontainer");
    let spec = loader.load(config_path.to_str().unwrap()).await;

    assert!(
        spec.is_ok(),
        "Failed to load Node.js devcontainer: {:?}",
        spec.err()
    );

    let spec = spec.unwrap();
    assert!(spec.image.contains("node"));
    assert!(spec.image.contains("20"));

    // Check environment variables
    assert_eq!(
        spec.env_vars.get("NODE_ENV"),
        Some(&"development".to_string())
    );

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_load_devcontainer_python() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    let config_path = fixture_path("python-devcontainer");
    let spec = loader.load(config_path.to_str().unwrap()).await;

    assert!(
        spec.is_ok(),
        "Failed to load Python devcontainer: {:?}",
        spec.err()
    );

    let spec = spec.unwrap();
    assert!(spec.image.contains("python"));
    assert!(spec.image.contains("3.11"));

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_load_devcontainer_go() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    let config_path = fixture_path("go-devcontainer");
    let spec = loader.load(config_path.to_str().unwrap()).await;

    assert!(
        spec.is_ok(),
        "Failed to load Go devcontainer: {:?}",
        spec.err()
    );

    let spec = spec.unwrap();
    assert!(spec.image.contains("go"));
    assert!(spec.image.contains("1.21"));

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_oci_image_resolution() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    // Test various OCI image formats
    let test_cases = vec![
        "docker.io/library/alpine:latest",
        "ubuntu:22.04",
        "mcr.microsoft.com/devcontainers/base:ubuntu",
    ];

    for image in test_cases {
        let result = loader.load(image).await;

        // Should succeed or fail with registry error (not parse error)
        match result {
            Ok(spec) => {
                assert_eq!(spec.source, EnvironmentSource::Oci);
                assert!(!spec.image.is_empty());
                println!("✓ Resolved: {}", image);
            }
            Err(e) => {
                let err_str = e.to_string();
                // Registry/network errors are acceptable in tests
                assert!(
                    err_str.contains("Registry")
                        || err_str.contains("network")
                        || err_str.contains("skopeo")
                        || err_str.contains("crane"),
                    "Unexpected error for {}: {}",
                    image,
                    err_str
                );
                println!("⚠ Could not resolve (expected in tests): {}", image);
            }
        }
    }

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_environment_caching() {
    let cache_dir = temp_cache_dir();

    // First loader instance
    {
        let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

        // Load from fixture
        let config_path = fixture_path("rust-devcontainer");
        let spec1 = loader.load(config_path.to_str().unwrap()).await.unwrap();

        // Load again - should be cached
        let spec2 = loader.load(config_path.to_str().unwrap()).await.unwrap();

        // Should be identical
        assert_eq!(spec1.image, spec2.image);
        assert_eq!(spec1.source, spec2.source);
    }

    // Second loader instance (same cache dir)
    {
        let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

        // Load again - should still be cached
        let config_path = fixture_path("rust-devcontainer");
        let spec3 = loader.load(config_path.to_str().unwrap()).await.unwrap();

        assert!(spec3.image.contains("rust"));
    }

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_convert_to_rootfs_error_handling() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    // Create a simple spec
    let spec = EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "alpine:latest".to_string(),
        image: "alpine:latest".to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: HashMap::new(),
        packages: vec![],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec![],
        resources: ResourceRequirements::default(),
        allternit_config: Default::default(),
    };

    // Attempt conversion (will fail without skopeo/crane in test environment)
    let result = loader.to_rootfs(&spec).await;

    // Should fail gracefully
    assert!(result.is_err());
    let err = result.unwrap_err();
    let err_str = err.to_string();

    // Should indicate tool not found
    assert!(
        err_str.contains("skopeo") || err_str.contains("crane") || err_str.contains("Conversion"),
        "Expected tool/conversion error, got: {}",
        err_str
    );

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_environment_spec_serialization() {
    let spec = EnvironmentSpec {
        source: EnvironmentSource::DevContainer,
        source_uri: ".devcontainer/devcontainer.json".to_string(),
        image: "mcr.microsoft.com/devcontainers/rust:1".to_string(),
        image_digest: Some("sha256:abc123".to_string()),
        workspace_folder: "/workspaces/project".to_string(),
        env_vars: {
            let mut m = HashMap::new();
            m.insert("RUST_BACKTRACE".to_string(), "1".to_string());
            m
        },
        packages: vec!["cargo-watch".to_string(), "rustfmt".to_string()],
        features: vec![FeatureSpec {
            id: "ghcr.io/devcontainers/features/node:1".to_string(),
            options: {
                let mut m = HashMap::new();
                m.insert("version".to_string(), serde_json::json!("18"));
                m
            },
        }],
        mounts: vec![MountSpec {
            source: PathBuf::from("/host/project"),
            target: "/workspace".to_string(),
            mount_type: MountType::Bind,
            read_only: false,
        }],
        post_create_commands: vec!["cargo build".to_string()],
        resources: ResourceRequirements {
            cpus: Some(4.0),
            memory_gb: Some(8.0),
            disk_gb: Some(20.0),
        },
        allternit_config: Default::default(),
    };

    // Serialize to JSON
    let json = serde_json::to_string(&spec).expect("Failed to serialize");

    // Deserialize back
    let deserialized: EnvironmentSpec = serde_json::from_str(&json).expect("Failed to deserialize");

    // Verify all fields preserved
    assert_eq!(deserialized.source, spec.source);
    assert_eq!(deserialized.source_uri, spec.source_uri);
    assert_eq!(deserialized.image, spec.image);
    assert_eq!(deserialized.image_digest, spec.image_digest);
    assert_eq!(deserialized.workspace_folder, spec.workspace_folder);
    assert_eq!(deserialized.env_vars, spec.env_vars);
    assert_eq!(deserialized.packages, spec.packages);
    assert_eq!(deserialized.features.len(), spec.features.len());
    assert_eq!(deserialized.mounts.len(), spec.mounts.len());
    assert_eq!(deserialized.post_create_commands, spec.post_create_commands);
    assert_eq!(deserialized.resources.cpus, spec.resources.cpus);
    assert_eq!(deserialized.resources.memory_gb, spec.resources.memory_gb);
    assert_eq!(deserialized.resources.disk_gb, spec.resources.disk_gb);
}

#[tokio::test]
async fn test_invalid_source_handling() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    // Test invalid sources
    let invalid_sources = vec![
        "/nonexistent/path/devcontainer.json",
        "github:invalid-flake-reference",
        "not-a-valid-source",
    ];

    for source in invalid_sources {
        let result = loader.load(source).await;
        assert!(
            result.is_err(),
            "Should fail for invalid source: {}",
            source
        );
    }

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_environment_source_display() {
    let sources = vec![
        (EnvironmentSource::DevContainer, "devcontainer"),
        (EnvironmentSource::Nix, "nix"),
        (EnvironmentSource::Oci, "oci"),
        (EnvironmentSource::Dockerfile, "dockerfile"),
    ];

    for (source, expected) in sources {
        let display = format!("{}", source);
        assert_eq!(display, expected, "Display mismatch for {:?}", source);
    }
}

#[tokio::test]
async fn test_mount_spec_variations() {
    let mount_types = vec![
        MountType::Bind,
        MountType::Volume,
        MountType::Tmpfs,
        MountType::Secret,
    ];

    for mount_type in mount_types {
        let mount = MountSpec {
            source: PathBuf::from("/host/data"),
            target: "/data".to_string(),
            mount_type,
            read_only: true,
        };

        let json = serde_json::to_string(&mount).expect("Failed to serialize mount");
        let deserialized: MountSpec =
            serde_json::from_str(&json).expect("Failed to deserialize mount");

        assert_eq!(deserialized.mount_type, mount_type);
        assert_eq!(deserialized.read_only, true);
    }
}

#[tokio::test]
async fn test_feature_spec_with_complex_options() {
    let mut options = HashMap::new();
    options.insert("version".to_string(), serde_json::json!("18"));
    options.insert("pnpm".to_string(), serde_json::json!(true));
    options.insert(
        "packages".to_string(),
        serde_json::json!(["eslint", "prettier"]),
    );
    options.insert("config".to_string(), serde_json::json!({"key": "value"}));

    let feature = FeatureSpec {
        id: "ghcr.io/devcontainers/features/node:1".to_string(),
        options: options.clone(),
    };

    let json = serde_json::to_string(&feature).expect("Failed to serialize feature");
    let deserialized: FeatureSpec =
        serde_json::from_str(&json).expect("Failed to deserialize feature");

    assert_eq!(deserialized.id, feature.id);
    assert_eq!(deserialized.options.len(), 4);
    assert_eq!(deserialized.options.get("version").unwrap(), "18");
    assert_eq!(
        deserialized.options.get("pnpm").unwrap(),
        &serde_json::json!(true)
    );
}
