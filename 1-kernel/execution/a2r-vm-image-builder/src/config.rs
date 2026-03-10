//! Configuration for VM image building

use std::path::PathBuf;

/// Image build configuration
#[derive(Debug, Clone)]
pub struct ImageConfig {
    /// Ubuntu version to use as base
    pub ubuntu_version: String,
    /// Additional packages to install
    pub additional_packages: Vec<String>,
    /// Whether to include toolchains
    pub include_toolchains: bool,
    /// Output directory for images
    pub output_dir: PathBuf,
}

impl Default for ImageConfig {
    fn default() -> Self {
        Self {
            ubuntu_version: "22.04".to_string(),
            additional_packages: vec![],
            include_toolchains: true,
            output_dir: PathBuf::from("./vm-images"),
        }
    }
}

/// Image metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageMetadata {
    pub version: String,
    pub build_date: String,
    pub architecture: String,
    pub kernel_version: String,
    pub rootfs_size_mb: u64,
    pub checksums: Checksums,
}

/// File checksums
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Checksums {
    pub vmlinux_sha256: String,
    pub initrd_sha256: String,
    pub rootfs_sha256: String,
}

/// Toolchain versions included in the image
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolchainVersions {
    pub node: String,
    pub npm: String,
    pub python: String,
    pub pip: String,
    pub docker: Option<String>,
    pub cargo: String,
    pub git: String,
}

/// Default packages to install in the VM
pub const DEFAULT_PACKAGES: &[&str] = &[
    // Base utilities
    "curl",
    "wget",
    "ca-certificates",
    "git",
    "openssh-client",
    "nano",
    "vim",
    "htop",
    "jq",
    // Build tools
    "build-essential",
    "pkg-config",
    "libssl-dev",
    // Python
    "python3",
    "python3-pip",
    "python3-venv",
    // Node.js (will be installed via NodeSource)
    // Docker (will be installed via Docker's repo)
    // Bubblewrap (for sandboxing)
    "bubblewrap",
    // Filesystem tools
    "e2fsprogs",
    "parted",
    // Network tools
    "iproute2",
    "iptables",
    "dnsutils",
    // Process management
    "procps",
    "psmisc",
];

/// Toolchains to install
pub const TOOLCHAINS: &[Toolchain] = &[
    Toolchain {
        name: "node",
        version: "20.x",
        install_cmd: r#"
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        "#,
    },
    Toolchain {
        name: "docker",
        version: "latest",
        install_cmd: r#"
            curl -fsSL https://get.docker.com | sh
            usermod -aG docker root
        "#,
    },
    Toolchain {
        name: "rust",
        version: "stable",
        install_cmd: r#"
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
            . $HOME/.cargo/env
        "#,
    },
];

/// Toolchain definition
pub struct Toolchain {
    pub name: &'static str,
    pub version: &'static str,
    pub install_cmd: &'static str,
}
