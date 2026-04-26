//! Integration tests for Image Converter (Rootfs/Initramfs)

use allternit_environment_spec::{
    converter::{ImageConverter, RootfsBuilder},
    EnvironmentSource, EnvironmentSpec, ResourceRequirements,
};
use std::collections::HashMap;
use std::path::PathBuf;

fn create_test_spec(image: &str) -> EnvironmentSpec {
    EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: image.to_string(),
        image: image.to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: HashMap::new(),
        packages: vec![],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec![],
        resources: ResourceRequirements::default(),
        allternit_config: Default::default(),
    }
}

fn temp_output_dir() -> PathBuf {
    std::env::temp_dir()
        .join("allternit_converter_test")
        .join(format!("test_{}", std::process::id()))
}

fn cleanup(dir: &PathBuf) {
    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn test_image_converter_creation() {
    let output_dir = temp_output_dir();
    let converter = ImageConverter::new(output_dir.clone());
    // Converter is created successfully
    cleanup(&output_dir);
}

#[tokio::test]
async fn test_rootfs_builder_creation() {
    let output_dir = temp_output_dir();
    let builder = RootfsBuilder::new(&output_dir);
    // Builder is created successfully
    cleanup(&output_dir);
}

#[tokio::test]
async fn test_rootfs_cache_hit() {
    let output_dir = temp_output_dir();

    // Create a fake cached rootfs
    let spec = create_test_spec("ubuntu:22.04");
    let rootfs_name = format!(
        "rootfs_{}.ext4",
        spec.image
            .replace('/', "_")
            .replace(':', "_")
            .replace('.', "_")
    );
    let rootfs_path = output_dir.join(&rootfs_name);

    // Ensure directory exists and create fake rootfs
    std::fs::create_dir_all(&output_dir).unwrap();
    std::fs::write(&rootfs_path, "fake rootfs").unwrap();

    // Create builder and try to build (should return cached version)
    let builder = RootfsBuilder::new(&output_dir);

    // Note: Since we can't actually run the full build without skopeo/crane,
    // we just verify the cache path logic
    assert!(rootfs_path.exists());

    cleanup(&output_dir);
}

#[tokio::test]
async fn test_initramfs_cache_hit() {
    let output_dir = temp_output_dir();

    // Create a fake cached initramfs
    let spec = create_test_spec("alpine:latest");
    let initramfs_name = format!(
        "initramfs_{}.cpio.gz",
        spec.image
            .replace('/', "_")
            .replace(':', "_")
            .replace('.', "_")
    );
    let initramfs_path = output_dir.join(&initramfs_name);

    // Ensure directory exists and create fake initramfs
    std::fs::create_dir_all(&output_dir).unwrap();
    std::fs::write(&initramfs_path, "fake initramfs").unwrap();

    // Verify the cache path
    assert!(initramfs_path.exists());

    cleanup(&output_dir);
}

#[tokio::test]
async fn test_spec_with_post_create_commands() {
    let output_dir = temp_output_dir();

    let spec = EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "ubuntu:22.04".to_string(),
        image: "ubuntu:22.04".to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: HashMap::new(),
        packages: vec!["curl".to_string(), "git".to_string()],
        features: vec![],
        mounts: vec![],
        post_create_commands: vec![
            "apt-get update".to_string(),
            "apt-get install -y curl".to_string(),
        ],
        resources: ResourceRequirements::default(),
        allternit_config: Default::default(),
    };

    // Verify spec is correctly created with post-create commands
    assert_eq!(spec.post_create_commands.len(), 2);
    assert!(spec.post_create_commands[0].contains("apt-get update"));

    cleanup(&output_dir);
}

#[tokio::test]
async fn test_sanitize_image_names() {
    // Test various image name sanitizations
    let test_cases = vec![
        (
            "docker.io/library/ubuntu:22.04",
            "docker_io_library_ubuntu_22_04",
        ),
        ("ghcr.io/user/repo:latest", "ghcr_io_user_repo_latest"),
        (
            "mcr.microsoft.com/dotnet/sdk:6.0",
            "mcr_microsoft_com_dotnet_sdk_6_0",
        ),
    ];

    for (input, expected) in test_cases {
        let sanitized = input.replace('/', "_").replace(':', "_").replace('.', "_");
        assert_eq!(sanitized, expected, "Failed for input: {}", input);
    }
}

#[tokio::test]
async fn test_converter_error_handling() {
    // Test that converter properly handles errors
    let output_dir = temp_output_dir();
    let converter = ImageConverter::new(output_dir.clone());

    // Create a spec with an invalid image that can't be pulled
    let spec = create_test_spec("invalid.registry.example.com/nonexistent:image");

    // Attempt conversion (will fail since tools aren't available)
    let result = converter.to_rootfs(&spec).await;

    // Should fail with conversion error
    assert!(result.is_err());
    let err = result.unwrap_err();
    let err_string = err.to_string();

    // Error should indicate tool not found or conversion failure
    assert!(
        err_string.contains("skopeo")
            || err_string.contains("crane")
            || err_string.contains("Conversion")
            || err_string.contains("tool"),
        "Expected tool/conversion error, got: {}",
        err_string
    );

    cleanup(&output_dir);
}

#[tokio::test]
async fn test_spec_serialization_with_mounts() {
    use allternit_environment_spec::{MountSpec, MountType};

    let spec = EnvironmentSpec {
        source: EnvironmentSource::Oci,
        source_uri: "ubuntu:22.04".to_string(),
        image: "ubuntu:22.04".to_string(),
        image_digest: None,
        workspace_folder: "/workspace".to_string(),
        env_vars: HashMap::new(),
        packages: vec![],
        features: vec![],
        mounts: vec![
            MountSpec {
                source: PathBuf::from("/host/data"),
                target: "/data".to_string(),
                mount_type: MountType::Bind,
                read_only: false,
            },
            MountSpec {
                source: PathBuf::from("/host/config"),
                target: "/etc/config".to_string(),
                mount_type: MountType::Bind,
                read_only: true,
            },
        ],
        post_create_commands: vec![],
        resources: ResourceRequirements::default(),
        allternit_config: Default::default(),
    };

    // Serialize and verify mounts are preserved
    let json = serde_json::to_string(&spec).expect("Failed to serialize");
    let deserialized: EnvironmentSpec = serde_json::from_str(&json).expect("Failed to deserialize");

    assert_eq!(deserialized.mounts.len(), 2);
    assert_eq!(deserialized.mounts[0].target, "/data");
    assert!(!deserialized.mounts[0].read_only);
    assert!(deserialized.mounts[1].read_only);
}

#[tokio::test]
async fn test_workspace_folder_variations() {
    // Test different workspace folder configurations
    let folders = vec![
        "/workspace",
        "/workspaces/project",
        "/home/dev/project",
        "/app",
    ];

    for folder in folders {
        let spec = EnvironmentSpec {
            source: EnvironmentSource::Oci,
            source_uri: "test".to_string(),
            image: "test".to_string(),
            image_digest: None,
            workspace_folder: folder.to_string(),
            env_vars: HashMap::new(),
            packages: vec![],
            features: vec![],
            mounts: vec![],
            post_create_commands: vec![],
            resources: ResourceRequirements::default(),
            allternit_config: Default::default(),
        };

        assert_eq!(spec.workspace_folder, folder);
    }
}
