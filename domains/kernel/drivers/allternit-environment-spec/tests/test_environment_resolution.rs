//! Integration tests for Environment Resolution
//!
//! Tests the full flow from source URI → EnvironmentSpec → Rootfs

use a2r_environment_spec::{
    EnvironmentSource, EnvironmentSpec, EnvironmentSpecLoader, FeatureSpec, MountSpec, MountType,
    ResourceRequirements,
};
use std::collections::HashMap;

/// Test helper to create a temporary cache directory
fn temp_cache_dir() -> std::path::PathBuf {
    std::env::temp_dir()
        .join("a2r_test")
        .join(format!("test_{}", std::process::id()))
}

/// Clean up test cache directory
fn cleanup_cache(dir: &std::path::PathBuf) {
    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn test_loader_creation() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir);
    assert!(loader.is_ok());
    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_load_oci_image() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    // Test loading a well-known public image
    // Note: This test requires network access
    let result = loader.load("docker.io/library/alpine:latest").await;

    // Should succeed or fail with registry error (not parse error)
    match result {
        Ok(spec) => {
            assert_eq!(spec.source, EnvironmentSource::Oci);
            assert!(spec.image.contains("alpine"));
            assert_eq!(spec.workspace_folder, "/workspace");
        }
        Err(e) => {
            // Network/registry errors are acceptable in tests
            let error_string = e.to_string();
            assert!(
                error_string.contains("Registry")
                    || error_string.contains("network")
                    || error_string.contains("resolution"),
                "Unexpected error: {}",
                error_string
            );
        }
    }

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_load_from_devcontainer_path() {
    let cache_dir = temp_cache_dir();
    let loader = EnvironmentSpecLoader::with_cache_dir(&cache_dir).unwrap();

    // Test detection of devcontainer paths
    // This should fail because the path doesn't exist, but should detect it as devcontainer
    let result = loader.load("/nonexistent/.devcontainer").await;

    match result {
        Err(e) => {
            let error_string = e.to_string();
            // Should be an IO error (file not found), not a parse error
            assert!(
                error_string.contains("No such file")
                    || error_string.contains("cannot find")
                    || error_string.contains("IO error"),
                "Expected IO error for non-existent path, got: {}",
                error_string
            );
        }
        _ => panic!("Expected error for non-existent path"),
    }

    cleanup_cache(&cache_dir);
}

#[tokio::test]
async fn test_environment_spec_builder_pattern() {
    let spec = EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "docker.io/library/rust:1.75".to_string(),
        image: "docker.io/library/rust@sha256:abc123".to_string(),
        image_digest: Some("sha256:abc123".to_string()),
        workspace_folder: "/workspace".to_string(),
        env_vars: {
            let mut m = HashMap::new();
            m.insert("RUST_BACKTRACE".to_string(), "1".to_string());
            m.insert("CARGO_HOME".to_string(), "/usr/local/cargo".to_string());
            m
        },
        packages: vec!["rustfmt".to_string(), "clippy".to_string()],
        features: vec![FeatureSpec {
            id: "ghcr.io/devcontainers/features/node:1".to_string(),
            options: HashMap::new(),
        }],
        mounts: vec![MountSpec {
            source: std::path::PathBuf::from("/host/project"),
            target: "/workspace".to_string(),
            mount_type: MountType::Bind,
            read_only: false,
        }],
        post_create_commands: vec![
            "cargo build".to_string(),
            "rustup component add rustfmt".to_string(),
        ],
        resources: ResourceRequirements {
            cpus: Some(4.0),
            memory_gb: Some(8.0),
            disk_gb: Some(20.0),
        },
        a2r_config: Default::default(),
    };

    // Verify all fields
    assert_eq!(spec.source, EnvironmentSource::Oci);
    assert_eq!(spec.source_uri, "docker.io/library/rust:1.75");
    assert!(spec.image_digest.is_some());
    assert_eq!(spec.env_vars.len(), 2);
    assert_eq!(spec.packages.len(), 2);
    assert_eq!(spec.features.len(), 1);
    assert_eq!(spec.mounts.len(), 1);
    assert_eq!(spec.post_create_commands.len(), 2);
    assert_eq!(spec.resources.cpus, Some(4.0));
}

#[tokio::test]
async fn test_resource_requirements_defaults() {
    let resources = ResourceRequirements::default();
    assert!(resources.cpus.is_none());
    assert!(resources.memory_gb.is_none());
    assert!(resources.disk_gb.is_none());
}

#[tokio::test]
async fn test_mount_spec_creation() {
    let mount = MountSpec {
        source: std::path::PathBuf::from("/host/cache"),
        target: "/cache".to_string(),
        mount_type: MountType::Bind,
        read_only: true,
    };

    assert_eq!(mount.source, std::path::PathBuf::from("/host/cache"));
    assert_eq!(mount.target, "/cache");
    assert_eq!(mount.mount_type, MountType::Bind);
    assert!(mount.read_only);
}

#[tokio::test]
async fn test_feature_spec_with_options() {
    let mut options = HashMap::new();
    options.insert("version".to_string(), serde_json::json!("18"));
    options.insert("npm".to_string(), serde_json::json!(true));

    let feature = FeatureSpec {
        id: "ghcr.io/devcontainers/features/node:1".to_string(),
        options,
    };

    assert_eq!(feature.id, "ghcr.io/devcontainers/features/node:1");
    assert_eq!(feature.options.get("version").unwrap(), "18");
    assert_eq!(
        feature.options.get("npm").unwrap(),
        &serde_json::json!(true)
    );
}

#[tokio::test]
async fn test_serialization_roundtrip() {
    let spec = EnvironmentSpec {
        source: EnvironmentSource::DevContainer,
        source_uri: ".devcontainer/devcontainer.json".to_string(),
        image: "mcr.microsoft.com/devcontainers/rust:1".to_string(),
        image_digest: Some("sha256:xyz789".to_string()),
        workspace_folder: "/workspaces/project".to_string(),
        env_vars: HashMap::new(),
        packages: vec!["cargo-watch".to_string()],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec!["cargo build".to_string()],
        resources: ResourceRequirements {
            cpus: Some(2.0),
            memory_gb: Some(4.0),
            disk_gb: Some(10.0),
        },
        a2r_config: Default::default(),
    };

    // Serialize to JSON
    let json = serde_json::to_string(&spec).expect("Failed to serialize");

    // Deserialize back
    let deserialized: EnvironmentSpec = serde_json::from_str(&json).expect("Failed to deserialize");

    // Verify roundtrip
    assert_eq!(deserialized.source, spec.source);
    assert_eq!(deserialized.source_uri, spec.source_uri);
    assert_eq!(deserialized.image, spec.image);
    assert_eq!(deserialized.workspace_folder, spec.workspace_folder);
    assert_eq!(deserialized.packages, spec.packages);
    assert_eq!(deserialized.resources.cpus, spec.resources.cpus);
}

#[tokio::test]
async fn test_environment_source_display() {
    assert_eq!(
        format!("{}", EnvironmentSource::DevContainer),
        "devcontainer"
    );
    assert_eq!(format!("{}", EnvironmentSource::Nix), "nix");
    assert_eq!(format!("{}", EnvironmentSource::Oci), "oci");
    assert_eq!(format!("{}", EnvironmentSource::Dockerfile), "dockerfile");
}

#[tokio::test]
async fn test_env_var_handling() {
    let mut spec = EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "test".to_string(),
        image: "ubuntu:22.04".to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: HashMap::new(),
        packages: vec![],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec![],
        resources: ResourceRequirements::default(),
        a2r_config: Default::default(),
    };

    // Add environment variables
    spec.env_vars
        .insert("KEY1".to_string(), "value1".to_string());
    spec.env_vars
        .insert("KEY2".to_string(), "value2".to_string());

    assert_eq!(spec.env_vars.len(), 2);
    assert_eq!(spec.env_vars.get("KEY1"), Some(&"value1".to_string()));
}
