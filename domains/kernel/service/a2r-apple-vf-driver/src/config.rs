//! Configuration for Apple Virtualization Framework driver

use std::path::PathBuf;

/// Configuration for Apple Virtualization Framework driver
#[derive(Debug, Clone)]
pub struct AppleVFConfig {
    /// Base directory for VM storage
    pub vm_storage_dir: PathBuf,
    /// Directory for VM images (IPSW files)
    pub images_dir: PathBuf,
    /// Default number of CPUs for new VMs
    pub default_cpus: u8,
    /// Default memory in MiB for new VMs
    pub default_memory_mib: u32,
    /// Default disk size in MiB for new VMs
    pub default_disk_mib: u32,
    /// Enable Rosetta 2 for x86_64 translation (Apple Silicon only)
    pub use_rosetta: bool,
    /// Enable VirtioFS shared directories
    pub use_virtiofs: bool,
    /// Enable networking via NAT
    pub enable_networking: bool,
    /// Guest agent VSOCK port
    pub guest_agent_port: u32,
    /// Maximum concurrent VMs
    pub max_concurrent_vms: usize,
}

impl Default for AppleVFConfig {
    fn default() -> Self {
        let data_dir = dirs::data_dir()
            .map(|d| d.join("a2r").join("apple-vf"))
            .unwrap_or_else(|| PathBuf::from("/tmp/a2r/apple-vf"));

        Self {
            vm_storage_dir: data_dir.join("vms"),
            images_dir: data_dir.join("images"),
            default_cpus: 2,
            default_memory_mib: 4096,
            default_disk_mib: 20480,
            use_rosetta: true,
            use_virtiofs: true,
            enable_networking: true,
            guest_agent_port: 1024,
            max_concurrent_vms: 4,
        }
    }
}

impl AppleVFConfig {
    /// Create a configuration with custom storage directory
    pub fn with_storage_dir(path: impl Into<PathBuf>) -> Self {
        let storage_dir: PathBuf = path.into();
        Self {
            vm_storage_dir: storage_dir.join("vms"),
            images_dir: storage_dir.join("images"),
            ..Default::default()
        }
    }

    /// Set default resource allocation
    pub fn with_resources(mut self, cpus: u8, memory_mib: u32, disk_mib: u32) -> Self {
        self.default_cpus = cpus;
        self.default_memory_mib = memory_mib;
        self.default_disk_mib = disk_mib;
        self
    }

    /// Enable/disable Rosetta 2
    pub fn with_rosetta(mut self, enabled: bool) -> Self {
        self.use_rosetta = enabled;
        self
    }

    /// Enable/disable VirtioFS
    pub fn with_virtiofs(mut self, enabled: bool) -> Self {
        self.use_virtiofs = enabled;
        self
    }
}
