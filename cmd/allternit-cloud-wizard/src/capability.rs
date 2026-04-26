//! Capability Matrix
//!
//! Defines the supported surface for deployments:
//! - Providers (API mode)
//! - Operating Systems
//! - Authentication Methods
//!
//! Everything outside this matrix routes to "unsupported" path.

use serde::{Deserialize, Serialize};

/// Supported cloud providers for API-mode provisioning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SupportedProvider {
    /// Hetzner Cloud (primary support)
    Hetzner,
    /// DigitalOcean (primary support)
    DigitalOcean,
    /// AWS EC2 (secondary support)
    Aws,
    /// Manual SSH (universal fallback)
    Manual,
}

impl SupportedProvider {
    /// Get all supported providers
    pub fn all() -> &'static [Self] {
        &[Self::Hetzner, Self::DigitalOcean, Self::Aws, Self::Manual]
    }

    /// Check if provider supports API provisioning
    pub fn supports_api(&self) -> bool {
        matches!(self, Self::Hetzner | Self::DigitalOcean | Self::Aws)
    }

    /// Check if provider requires manual SSH
    pub fn requires_manual(&self) -> bool {
        matches!(self, Self::Manual)
    }
}

/// Supported operating systems for bootstrap
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SupportedOS {
    /// Ubuntu 22.04 LTS
    Ubuntu2204,
    /// Ubuntu 24.04 LTS
    Ubuntu2404,
    /// Debian 12 (Bookworm)
    Debian12,
    /// Debian 11 (Bullseye)
    Debian11,
    /// Rocky Linux 9
    RockyLinux9,
    /// Rocky Linux 8
    RockyLinux8,
    /// Amazon Linux 2023
    AmazonLinux2023,
    /// Unknown/Unsupported (routes to manual path)
    Unknown,
}

impl SupportedOS {
    /// Get all supported OSes
    pub fn all() -> &'static [Self] {
        &[
            Self::Ubuntu2204,
            Self::Ubuntu2404,
            Self::Debian12,
            Self::Debian11,
            Self::RockyLinux9,
            Self::RockyLinux8,
            Self::AmazonLinux2023,
        ]
    }

    /// Check if OS is fully supported
    pub fn is_supported(&self) -> bool {
        !matches!(self, Self::Unknown)
    }

    /// Get package manager for OS
    pub fn package_manager(&self) -> &'static str {
        match self {
            Self::Ubuntu2204 | Self::Ubuntu2404 | Self::Debian12 | Self::Debian11 => "apt",
            Self::RockyLinux9 | Self::RockyLinux8 => "dnf",
            Self::AmazonLinux2023 => "dnf",
            Self::Unknown => "unknown",
        }
    }

    /// Get init system for OS
    pub fn init_system(&self) -> &'static str {
        match self {
            Self::Ubuntu2204 | Self::Ubuntu2404 | Self::Debian12 | Self::Debian11 => "systemd",
            Self::RockyLinux9 | Self::RockyLinux8 => "systemd",
            Self::AmazonLinux2023 => "systemd",
            Self::Unknown => "unknown",
        }
    }

    /// Detect OS from os-release content
    pub fn detect_from_os_release(content: &str) -> Self {
        let content = content.to_lowercase();
        
        if content.contains("ubuntu") {
            if content.contains("24.04") {
                Self::Ubuntu2404
            } else if content.contains("22.04") {
                Self::Ubuntu2204
            } else {
                Self::Unknown
            }
        } else if content.contains("debian") {
            if content.contains("12") {
                Self::Debian12
            } else if content.contains("11") {
                Self::Debian11
            } else {
                Self::Unknown
            }
        } else if content.contains("rocky") {
            if content.contains("9") {
                Self::RockyLinux9
            } else if content.contains("8") {
                Self::RockyLinux8
            } else {
                Self::Unknown
            }
        } else if content.contains("amazon") && content.contains("2023") {
            Self::AmazonLinux2023
        } else {
            Self::Unknown
        }
    }
}

/// Authentication methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    /// SSH key authentication (preferred)
    SshKey,
    /// SSH password authentication (fallback, less secure)
    SshPassword,
    /// API token (for provider API mode)
    ApiToken,
}

impl AuthMethod {
    /// Get all supported auth methods
    pub fn all() -> &'static [Self] {
        &[Self::SshKey, Self::SshPassword, Self::ApiToken]
    }

    /// Check if auth method is SSH-based
    pub fn is_ssh(&self) -> bool {
        matches!(self, Self::SshKey | Self::SshPassword)
    }

    /// Check if auth method is API-based
    pub fn is_api(&self) -> bool {
        matches!(self, Self::ApiToken)
    }
}

/// Capability matrix for deployment validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityMatrix {
    /// Supported providers
    pub providers: Vec<SupportedProvider>,
    /// Supported OSes
    pub oses: Vec<SupportedOS>,
    /// Supported auth methods
    pub auth_methods: Vec<AuthMethod>,
    /// Minimum RAM (MB)
    pub min_ram_mb: u32,
    /// Minimum disk (GB)
    pub min_disk_gb: u32,
    /// Required ports
    pub required_ports: Vec<u16>,
}

impl Default for CapabilityMatrix {
    fn default() -> Self {
        Self {
            providers: SupportedProvider::all().to_vec(),
            oses: SupportedOS::all().to_vec(),
            auth_methods: AuthMethod::all().to_vec(),
            min_ram_mb: 2048,      // 2GB minimum
            min_disk_gb: 20,       // 20GB minimum
            required_ports: vec![443, 8443],  // HTTPS + Allternit port
        }
    }
}

impl CapabilityMatrix {
    /// Create default capability matrix
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if provider is supported
    pub fn is_provider_supported(&self, provider: SupportedProvider) -> bool {
        self.providers.contains(&provider)
    }

    /// Check if OS is supported
    pub fn is_os_supported(&self, os: SupportedOS) -> bool {
        self.oses.contains(&os)
    }

    /// Check if auth method is supported
    pub fn is_auth_supported(&self, auth: AuthMethod) -> bool {
        self.auth_methods.contains(&auth)
    }

    /// Validate deployment configuration
    pub fn validate_deployment(
        &self,
        provider: SupportedProvider,
        os: SupportedOS,
        auth: AuthMethod,
        ram_mb: u32,
        disk_gb: u32,
    ) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Check provider
        if !self.is_provider_supported(provider) {
            errors.push(ValidationError::UnsupportedProvider(provider));
        }

        // Check OS
        if !self.is_os_supported(os) {
            errors.push(ValidationError::UnsupportedOS(os));
        } else if os == SupportedOS::Unknown {
            warnings.push(ValidationWarning::UnknownOS);
        }

        // Check auth method
        if !self.is_auth_supported(auth) {
            errors.push(ValidationError::UnsupportedAuth(auth));
        }

        // Check RAM
        if ram_mb < self.min_ram_mb {
            errors.push(ValidationError::InsufficientRAM {
                required: self.min_ram_mb,
                available: ram_mb,
            });
        }

        // Check disk
        if disk_gb < self.min_disk_gb {
            errors.push(ValidationError::InsufficientDisk {
                required: self.min_disk_gb,
                available: disk_gb,
            });
        }

        ValidationResult {
            valid: errors.is_empty(),
            errors,
            warnings,
        }
    }
}

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

/// Validation error
#[derive(Debug, Clone)]
pub enum ValidationError {
    UnsupportedProvider(SupportedProvider),
    UnsupportedOS(SupportedOS),
    UnsupportedAuth(AuthMethod),
    InsufficientRAM { required: u32, available: u32 },
    InsufficientDisk { required: u32, available: u32 },
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedProvider(p) => write!(f, "Unsupported provider: {:?}", p),
            Self::UnsupportedOS(os) => write!(f, "Unsupported OS: {:?}", os),
            Self::UnsupportedAuth(auth) => write!(f, "Unsupported auth method: {:?}", auth),
            Self::InsufficientRAM { required, available } => {
                write!(f, "Insufficient RAM: {}MB available, {}MB required", available, required)
            }
            Self::InsufficientDisk { required, available } => {
                write!(f, "Insufficient disk: {}GB available, {}GB required", available, required)
            }
        }
    }
}

/// Validation warning
#[derive(Debug, Clone)]
pub enum ValidationWarning {
    UnknownOS,
}

impl std::fmt::Display for ValidationWarning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownOS => write!(f, "Unknown OS - installation may fail"),
        }
    }
}
