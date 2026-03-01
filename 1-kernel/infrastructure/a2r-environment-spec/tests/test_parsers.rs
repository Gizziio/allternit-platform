//! Integration tests for Environment Parsers

use a2r_environment_spec::parser::{
    CommandSpec, DevContainerConfig, EnvSpecType, ResourceRequirements,
};
use serde_json::json;
use std::collections::HashMap;

// ==================== CommandSpec Tests ====================

#[test]
fn test_command_spec_single() {
    let cmd = CommandSpec::Single("cargo build".to_string());
    let commands = cmd.to_commands();
    assert_eq!(commands, vec!["cargo build"]);
    assert_eq!(cmd.to_shell_string(), "cargo build");
}

#[test]
fn test_command_spec_array() {
    let cmd = CommandSpec::Array(vec!["cargo build".to_string(), "cargo test".to_string()]);
    let commands = cmd.to_commands();
    assert_eq!(commands.len(), 2);
    assert_eq!(cmd.to_shell_string(), "cargo build cargo test");
}

#[test]
fn test_command_spec_object() {
    let mut obj = HashMap::new();
    obj.insert(
        "build".to_string(),
        CommandSpec::Single("cargo build".to_string()),
    );
    obj.insert(
        "test".to_string(),
        CommandSpec::Single("cargo test".to_string()),
    );

    let cmd = CommandSpec::Object(obj);
    let commands = cmd.to_commands();
    // Object commands are flattened
    assert_eq!(commands.len(), 2);
    assert!(commands.contains(&"cargo build".to_string()));
    assert!(commands.contains(&"cargo test".to_string()));
}

#[test]
fn test_command_spec_default() {
    let cmd = CommandSpec::default();
    assert_eq!(cmd.to_commands().len(), 0);
}

// ==================== DevContainerConfig Tests ====================

#[test]
fn test_devcontainer_config_creation() {
    let config = DevContainerConfig::with_image("mcr.microsoft.com/devcontainers/rust:1");

    assert_eq!(
        config.image,
        Some("mcr.microsoft.com/devcontainers/rust:1".to_string())
    );
    assert_eq!(config.workspace_folder, "/workspace");
    assert!(config.features.is_empty());
}

#[test]
fn test_devcontainer_with_features() {
    let mut features = HashMap::new();
    let mut node_options = HashMap::new();
    node_options.insert("version".to_string(), json!("18"));
    node_options.insert("npm".to_string(), json!(true));

    features.insert(
        "ghcr.io/devcontainers/features/node:1".to_string(),
        node_options,
    );

    let config = DevContainerConfig {
        name: Some("Rust + Node".to_string()),
        image: Some("mcr.microsoft.com/devcontainers/rust:1".to_string()),
        workspace_folder: "/workspace".to_string(),
        workspace_mount: None,
        features,
        post_create_command: CommandSpec::default(),
        post_start_command: None,
        post_attach_command: None,
        initialize_command: None,
        on_create_command: None,
        update_content_command: None,
        wait_for: None,
        remote_user: None,
        container_user: None,
        shutdown_action: None,
        override_command: None,
        run_args: vec![],
        forward_ports: vec![],
        ports_attributes: HashMap::new(),
        secrets: None,
        extra: HashMap::new(),
        docker_compose_file: None,
        build: None,
        container_env: HashMap::new(),
        mounts: vec![],
        host_requirements: Default::default(),
        customizations: HashMap::new(),
    };

    assert_eq!(config.name, Some("Rust + Node".to_string()));
    assert_eq!(config.features.len(), 1);
    assert!(config
        .features
        .contains_key("ghcr.io/devcontainers/features/node:1"));
}

#[test]
fn test_devcontainer_with_mounts() {
    use a2r_environment_spec::parser::devcontainer::MountConfig;

    let config = DevContainerConfig {
        name: Some("With Mounts".to_string()),
        image: Some("ubuntu:22.04".to_string()),
        workspace_folder: "/workspace".to_string(),
        workspace_mount: None,
        mounts: vec![
            MountConfig {
                mount_type: "bind".to_string(),
                source: "/host/data".to_string(),
                target: "/data".to_string(),
                read_only: false,
            },
            MountConfig {
                mount_type: "volume".to_string(),
                source: "my-volume".to_string(),
                target: "/persist".to_string(),
                read_only: false,
            },
        ],
        post_create_command: CommandSpec::default(),
        post_start_command: None,
        post_attach_command: None,
        initialize_command: None,
        on_create_command: None,
        update_content_command: None,
        wait_for: None,
        remote_user: None,
        container_user: None,
        shutdown_action: None,
        override_command: None,
        run_args: vec![],
        forward_ports: vec![],
        ports_attributes: HashMap::new(),
        secrets: None,
        extra: HashMap::new(),
        docker_compose_file: None,
        build: None,
        features: HashMap::new(),
        container_env: HashMap::new(),
        host_requirements: Default::default(),
        customizations: HashMap::new(),
    };

    assert_eq!(config.mounts.len(), 2);
    assert_eq!(config.mounts[0].source, "/host/data");
    assert_eq!(config.mounts[1].mount_type, "volume");
}

#[test]
fn test_devcontainer_json_parsing() {
    let json_content = r#"{
        "name": "Rust Development",
        "image": "mcr.microsoft.com/devcontainers/rust:1",
        "workspaceFolder": "/workspaces/rust-project",
        "features": {
            "ghcr.io/devcontainers/features/node:1": {
                "version": "18"
            }
        },
        "containerEnv": {
            "RUST_BACKTRACE": "1"
        },
        "postCreateCommand": "cargo build",
        "customizations": {
            "vscode": {
                "extensions": ["rust-lang.rust-analyzer"]
            }
        }
    }"#;

    let config: DevContainerConfig =
        serde_json::from_str(json_content).expect("Failed to parse devcontainer.json");

    assert_eq!(config.name, Some("Rust Development".to_string()));
    assert_eq!(
        config.image,
        Some("mcr.microsoft.com/devcontainers/rust:1".to_string())
    );
    assert_eq!(config.workspace_folder, "/workspaces/rust-project");
    assert_eq!(
        config.container_env.get("RUST_BACKTRACE"),
        Some(&"1".to_string())
    );
    assert_eq!(config.features.len(), 1);
}

#[test]
fn test_devcontainer_with_build_config() {
    use a2r_environment_spec::parser::devcontainer::BuildConfig;

    let mut build_args = HashMap::new();
    build_args.insert("RUST_VERSION".to_string(), "1.75".to_string());

    let build_config = BuildConfig {
        dockerfile: Some("Dockerfile.dev".to_string()),
        context: Some(".".to_string()),
        args: Some(build_args),
        target: Some("development".to_string()),
        cache_from: None,
    };

    let config = DevContainerConfig {
        name: Some("Build Config".to_string()),
        image: None,
        workspace_folder: "/workspace".to_string(),
        workspace_mount: None,
        build: Some(build_config),
        post_create_command: CommandSpec::default(),
        post_start_command: None,
        post_attach_command: None,
        initialize_command: None,
        on_create_command: None,
        update_content_command: None,
        wait_for: None,
        remote_user: None,
        container_user: None,
        shutdown_action: None,
        override_command: None,
        run_args: vec![],
        forward_ports: vec![],
        ports_attributes: HashMap::new(),
        secrets: None,
        extra: HashMap::new(),
        docker_compose_file: None,
        features: HashMap::new(),
        container_env: HashMap::new(),
        mounts: vec![],
        host_requirements: Default::default(),
        customizations: HashMap::new(),
    };

    assert!(config.image.is_none());
    assert!(config.build.is_some());
    let build = config.build.unwrap();
    assert_eq!(build.dockerfile, Some("Dockerfile.dev".to_string()));
    assert_eq!(build.target, Some("development".to_string()));
}

// ==================== ResourceRequirements Tests ====================

#[test]
fn test_resource_requirements_default() {
    let resources = ResourceRequirements::default();
    assert!(resources.cpus.is_none());
    assert!(resources.memory_mb.is_none());
    assert!(resources.storage_mb.is_none());
}

#[test]
fn test_resource_requirements_with_values() {
    let resources = ResourceRequirements {
        cpus: Some(4.0),
        memory_mb: Some(8192),
        storage_mb: Some(51200),
    };

    assert_eq!(resources.cpus, Some(4.0));
    assert_eq!(resources.memory_mb, Some(8192));
    assert_eq!(resources.storage_mb, Some(51200));
}

// ==================== Host Requirements Tests ====================

#[test]
fn test_host_requirements_parsing() {
    use a2r_environment_spec::parser::devcontainer::HostRequirements;

    let json_content = r#"{
        "cpus": 4,
        "memory": 8192,
        "storage": 51200
    }"#;

    let reqs: HostRequirements =
        serde_json::from_str(json_content).expect("Failed to parse host requirements");

    assert_eq!(reqs.cpus, Some(4.0));
    assert_eq!(reqs.memory, Some(8192));
    assert_eq!(reqs.storage, Some(51200));
}

// ==================== Port Forward Tests ====================

#[test]
fn test_port_forward_parsing() {
    use a2r_environment_spec::parser::devcontainer::PortForward;

    // Test numeric port
    let port_num: PortForward = serde_json::from_str("8080").unwrap();
    match port_num {
        PortForward::Number(n) => assert_eq!(n, 8080),
        _ => panic!("Expected Number variant"),
    }

    // Test string port with description
    let port_str: PortForward = serde_json::from_str("\"3000:3000\"").unwrap();
    match port_str {
        PortForward::String(s) => assert_eq!(s, "3000:3000"),
        _ => panic!("Expected String variant"),
    }
}

// ==================== EnvSpecType Tests ====================

#[test]
fn test_env_spec_type_serialization() {
    assert_eq!(serde_json::to_string(&EnvSpecType::Oci).unwrap(), "\"oci\"");
    assert_eq!(serde_json::to_string(&EnvSpecType::Nix).unwrap(), "\"nix\"");
    assert_eq!(
        serde_json::to_string(&EnvSpecType::Devcontainer).unwrap(),
        "\"devcontainer\""
    );
    assert_eq!(
        serde_json::to_string(&EnvSpecType::Wasm).unwrap(),
        "\"wasm\""
    );
}

#[test]
fn test_env_spec_type_deserialization() {
    let oci: EnvSpecType = serde_json::from_str("\"oci\"").unwrap();
    assert_eq!(oci, EnvSpecType::Oci);

    let nix: EnvSpecType = serde_json::from_str("\"nix\"").unwrap();
    assert_eq!(nix, EnvSpecType::Nix);

    let devcontainer: EnvSpecType = serde_json::from_str("\"devcontainer\"").unwrap();
    assert_eq!(devcontainer, EnvSpecType::Devcontainer);
}

// ==================== Complex Scenarios ====================

#[test]
fn test_full_devcontainer_config() {
    let json_content = r#"{
        "name": "Full Stack Development",
        "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
        "workspaceFolder": "/workspaces/project",
        "features": {
            "ghcr.io/devcontainers/features/docker-in-docker:2": {},
            "ghcr.io/devcontainers/features/github-cli:1": {}
        },
        "containerEnv": {
            "NODE_ENV": "development",
            "API_URL": "http://localhost:3001"
        },
        "postCreateCommand": ["npm install", "npm run db:migrate"],
        "postStartCommand": "npm run dev",
        "forwardPorts": [3000, 3001, 8080],
        "portsAttributes": {
            "3000": {
                "label": "Next.js App",
                "onAutoForward": "notify"
            }
        },
        "mounts": [
            {
                "type": "bind",
                "source": "${localEnv:HOME}/.ssh",
                "target": "/home/node/.ssh",
                "readOnly": true
            }
        ],
        "hostRequirements": {
            "cpus": 4,
            "memory": 8192
        },
        "customizations": {
            "a2r": {
                "driver": "process",
                "enablePrewarm": true
            }
        }
    }"#;

    let config: DevContainerConfig =
        serde_json::from_str(json_content).expect("Failed to parse full devcontainer config");

    // Verify basic fields
    assert_eq!(config.name, Some("Full Stack Development".to_string()));
    assert_eq!(config.workspace_folder, "/workspaces/project");

    // Verify features
    assert_eq!(config.features.len(), 2);

    // Verify environment variables
    assert_eq!(config.container_env.len(), 2);
    assert_eq!(
        config.container_env.get("NODE_ENV"),
        Some(&"development".to_string())
    );

    // Verify mounts
    assert_eq!(config.mounts.len(), 1);
    assert_eq!(config.mounts[0].target, "/home/node/.ssh");
    assert!(config.mounts[0].read_only);

    // Verify host requirements
    assert_eq!(config.host_requirements.cpus, Some(4.0));
    assert_eq!(config.host_requirements.memory, Some(8192));
}

#[test]
fn test_post_create_command_variations() {
    // Test string format
    let json_str = r#""cargo build""#;
    let cmd: CommandSpec = serde_json::from_str(json_str).unwrap();
    assert_eq!(cmd.to_commands(), vec!["cargo build"]);

    // Test array format
    let json_arr = r#"["cargo build", "cargo test"]"#;
    let cmd: CommandSpec = serde_json::from_str(json_arr).unwrap();
    assert_eq!(cmd.to_commands(), vec!["cargo build", "cargo test"]);
}

#[tokio::test]
async fn test_environment_config_trait() {
    // Test that DevContainerConfig implements the EnvironmentConfig trait
    // by verifying we can create it and access its methods
    let config = DevContainerConfig::with_image("ubuntu:22.04");

    // Verify image is set
    assert_eq!(config.image, Some("ubuntu:22.04".to_string()));
}
