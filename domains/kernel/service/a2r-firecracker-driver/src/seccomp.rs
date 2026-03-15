//! # seccomp-bpf Profile for Firecracker
//!
//! Restricts Firecracker process to only necessary syscalls.
//! Uses libseccomp for easier management.

use std::collections::HashSet;
use tracing::{debug, error, info, warn};

/// Syscall categories for Firecracker
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SyscallCategory {
    /// File operations
    File,
    /// Memory operations
    Memory,
    /// Process operations
    Process,
    /// Network operations
    Network,
    /// Signal operations
    Signal,
    /// Timer operations
    Timer,
    /// Epoll operations
    Epoll,
    /// KVM operations
    Kvm,
    /// Miscellaneous
    Misc,
}

/// Default seccomp profile for Firecracker
pub struct SeccompProfile {
    /// Allowed syscalls with their categories
    allowed_syscalls: HashSet<(String, SyscallCategory)>,
    /// Default action when syscall is not allowed
    default_action: SeccompAction,
}

/// Seccomp filter actions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeccompAction {
    /// Kill the process
    Kill,
    /// Return EPERM error
    Errno(i32),
    /// Log the violation
    Log,
    /// Allow the syscall
    Allow,
}

impl Default for SeccompProfile {
    fn default() -> Self {
        Self::firecracker_default()
    }
}

impl SeccompProfile {
    /// Create a minimal profile for Firecracker
    pub fn firecracker_default() -> Self {
        let mut allowed = HashSet::new();

        // File operations
        allowed.insert(("read".to_string(), SyscallCategory::File));
        allowed.insert(("write".to_string(), SyscallCategory::File));
        allowed.insert(("openat".to_string(), SyscallCategory::File));
        allowed.insert(("close".to_string(), SyscallCategory::File));
        allowed.insert(("lseek".to_string(), SyscallCategory::File));
        allowed.insert(("pread64".to_string(), SyscallCategory::File));
        allowed.insert(("pwrite64".to_string(), SyscallCategory::File));
        allowed.insert(("stat".to_string(), SyscallCategory::File));
        allowed.insert(("fstat".to_string(), SyscallCategory::File));
        allowed.insert(("lstat".to_string(), SyscallCategory::File));
        allowed.insert(("fstatat".to_string(), SyscallCategory::File));
        allowed.insert(("access".to_string(), SyscallCategory::File));
        allowed.insert(("faccessat".to_string(), SyscallCategory::File));
        allowed.insert(("readlink".to_string(), SyscallCategory::File));
        allowed.insert(("readlinkat".to_string(), SyscallCategory::File));
        allowed.insert(("ioctl".to_string(), SyscallCategory::File));
        allowed.insert(("fcntl".to_string(), SyscallCategory::File));

        // Memory operations
        allowed.insert(("mmap".to_string(), SyscallCategory::Memory));
        allowed.insert(("mprotect".to_string(), SyscallCategory::Memory));
        allowed.insert(("munmap".to_string(), SyscallCategory::Memory));
        allowed.insert(("brk".to_string(), SyscallCategory::Memory));
        allowed.insert(("mremap".to_string(), SyscallCategory::Memory));

        // Process operations
        allowed.insert(("exit".to_string(), SyscallCategory::Process));
        allowed.insert(("exit_group".to_string(), SyscallCategory::Process));
        allowed.insert(("getpid".to_string(), SyscallCategory::Process));
        allowed.insert(("gettid".to_string(), SyscallCategory::Process));
        allowed.insert(("getuid".to_string(), SyscallCategory::Process));
        allowed.insert(("getgid".to_string(), SyscallCategory::Process));
        allowed.insert(("geteuid".to_string(), SyscallCategory::Process));
        allowed.insert(("getegid".to_string(), SyscallCategory::Process));
        allowed.insert(("setuid".to_string(), SyscallCategory::Process));
        allowed.insert(("setgid".to_string(), SyscallCategory::Process));
        allowed.insert(("prctl".to_string(), SyscallCategory::Process));
        allowed.insert(("arch_prctl".to_string(), SyscallCategory::Process));
        allowed.insert(("clone3".to_string(), SyscallCategory::Process));
        allowed.insert(("wait4".to_string(), SyscallCategory::Process));
        allowed.insert(("waitid".to_string(), SyscallCategory::Process));

        // Signal operations
        allowed.insert(("rt_sigaction".to_string(), SyscallCategory::Signal));
        allowed.insert(("rt_sigprocmask".to_string(), SyscallCategory::Signal));
        allowed.insert(("rt_sigreturn".to_string(), SyscallCategory::Signal));
        allowed.insert(("kill".to_string(), SyscallCategory::Signal));
        allowed.insert(("tkill".to_string(), SyscallCategory::Signal));
        allowed.insert(("tgkill".to_string(), SyscallCategory::Signal));

        // Timer operations
        allowed.insert(("clock_gettime".to_string(), SyscallCategory::Timer));
        allowed.insert(("clock_getres".to_string(), SyscallCategory::Timer));
        allowed.insert(("gettimeofday".to_string(), SyscallCategory::Timer));
        allowed.insert(("nanosleep".to_string(), SyscallCategory::Timer));
        allowed.insert(("timerfd_create".to_string(), SyscallCategory::Timer));
        allowed.insert(("timerfd_settime".to_string(), SyscallCategory::Timer));
        allowed.insert(("timerfd_gettime".to_string(), SyscallCategory::Timer));

        // Epoll operations
        allowed.insert(("epoll_create1".to_string(), SyscallCategory::Epoll));
        allowed.insert(("epoll_ctl".to_string(), SyscallCategory::Epoll));
        allowed.insert(("epoll_pwait".to_string(), SyscallCategory::Epoll));
        allowed.insert(("epoll_wait".to_string(), SyscallCategory::Epoll));

        // Eventfd
        allowed.insert(("eventfd2".to_string(), SyscallCategory::Misc));

        // Pipe
        allowed.insert(("pipe2".to_string(), SyscallCategory::Misc));

        // KVM operations (these need ioctl)
        allowed.insert(("ioctl".to_string(), SyscallCategory::Kvm));

        // Socket operations (for VSOCK)
        allowed.insert(("socket".to_string(), SyscallCategory::Network));
        allowed.insert(("socketpair".to_string(), SyscallCategory::Network));
        allowed.insert(("bind".to_string(), SyscallCategory::Network));
        allowed.insert(("listen".to_string(), SyscallCategory::Network));
        allowed.insert(("accept".to_string(), SyscallCategory::Network));
        allowed.insert(("accept4".to_string(), SyscallCategory::Network));
        allowed.insert(("connect".to_string(), SyscallCategory::Network));
        allowed.insert(("shutdown".to_string(), SyscallCategory::Network));
        allowed.insert(("setsockopt".to_string(), SyscallCategory::Network));
        allowed.insert(("getsockopt".to_string(), SyscallCategory::Network));
        allowed.insert(("getsockname".to_string(), SyscallCategory::Network));
        allowed.insert(("getpeername".to_string(), SyscallCategory::Network));
        allowed.insert(("sendto".to_string(), SyscallCategory::Network));
        allowed.insert(("recvfrom".to_string(), SyscallCategory::Network));
        allowed.insert(("sendmsg".to_string(), SyscallCategory::Network));
        allowed.insert(("recvmsg".to_string(), SyscallCategory::Network));

        // Miscellaneous
        allowed.insert(("uname".to_string(), SyscallCategory::Misc));
        allowed.insert(("sysinfo".to_string(), SyscallCategory::Misc));
        allowed.insert(("getrandom".to_string(), SyscallCategory::Misc));
        allowed.insert(("dup".to_string(), SyscallCategory::Misc));
        allowed.insert(("dup2".to_string(), SyscallCategory::Misc));
        allowed.insert(("dup3".to_string(), SyscallCategory::Misc));
        allowed.insert(("fadvise64".to_string(), SyscallCategory::Misc));
        allowed.insert(("fsync".to_string(), SyscallCategory::Misc));
        allowed.insert(("fdatasync".to_string(), SyscallCategory::Misc));
        allowed.insert(("sync_file_range".to_string(), SyscallCategory::Misc));

        Self {
            allowed_syscalls: allowed,
            default_action: SeccompAction::Errno(1), // EPERM
        }
    }

    /// Create a more permissive profile for debugging
    pub fn permissive() -> Self {
        Self {
            allowed_syscalls: HashSet::new(), // Empty = allow all
            default_action: SeccompAction::Allow,
        }
    }

    /// Check if a syscall is allowed
    pub fn is_allowed(&self, syscall: &str) -> bool {
        self.allowed_syscalls.is_empty() || self.allowed_syscalls.iter().any(|(s, _)| s == syscall)
    }

    /// Get allowed syscalls by category
    pub fn get_by_category(&self, category: SyscallCategory) -> Vec<&String> {
        self.allowed_syscalls
            .iter()
            .filter(|(_, c)| *c == category)
            .map(|(s, _)| s)
            .collect()
    }

    /// Get all allowed syscalls
    pub fn allowed_syscalls(&self) -> &HashSet<(String, SyscallCategory)> {
        &self.allowed_syscalls
    }
}

/// Apply seccomp filter to current process
///
/// # Safety
///
/// This function is unsafe because it modifies process-level state.
/// Once applied, the filter cannot be removed.
pub unsafe fn apply_seccomp_filter(profile: &SeccompProfile) -> Result<(), SeccompError> {
    info!(
        "Applying seccomp filter with {} allowed syscalls",
        profile.allowed_syscalls.len()
    );

    #[cfg(feature = "libseccomp")]
    {
        apply_libseccomp_filter(profile)
    }

    #[cfg(not(feature = "libseccomp"))]
    {
        warn!("libseccomp feature not enabled, seccomp filter not applied");
        debug!("Would have allowed: {:?}", profile.allowed_syscalls);
        Ok(())
    }
}

#[cfg(feature = "libseccomp")]
fn apply_libseccomp_filter(profile: &SeccompProfile) -> Result<(), SeccompError> {
    use libseccomp::{ScmpAction, ScmpFilterContext, ScmpSyscall};

    let mut filter = ScmpFilterContext::new_filter(ScmpAction::Errno(libc::EPERM))
        .map_err(|e| SeccompError::InitFailed(e.to_string()))?;

    // Add all allowed syscalls
    for (syscall, category) in &profile.allowed_syscalls {
        match ScmpSyscall::from_name(syscall) {
            Ok(sys) => {
                filter
                    .add_rule(ScmpAction::Allow, sys)
                    .map_err(|e| SeccompError::AddRuleFailed(syscall.clone(), e.to_string()))?;
                debug!("Added allowed syscall: {} ({:?})", syscall, category);
            }
            Err(e) => {
                warn!("Failed to resolve syscall {}: {}", syscall, e);
            }
        }
    }

    // Load the filter
    filter
        .load()
        .map_err(|e| SeccompError::LoadFailed(e.to_string()))?;

    info!("Seccomp filter applied successfully");
    Ok(())
}

/// Seccomp errors
#[derive(Debug, thiserror::Error)]
pub enum SeccompError {
    #[error("Failed to initialize seccomp filter: {0}")]
    InitFailed(String),

    #[error("Failed to add rule for {0}: {1}")]
    AddRuleFailed(String, String),

    #[error("Failed to load seccomp filter: {0}")]
    LoadFailed(String),

    #[error("Seccomp not supported on this platform")]
    NotSupported,
}

/// Generate a JSON seccomp profile for use with Docker/runc
pub fn generate_json_profile(profile: &SeccompProfile) -> String {
    let syscalls: Vec<_> = profile
        .allowed_syscalls
        .iter()
        .map(|(s, _)| s.clone())
        .collect();

    let profile_json = serde_json::json!({
        "defaultAction": "SCMP_ACT_ERRNO",
        "architectures": ["SCMP_ARCH_X86_64"],
        "syscalls": [
            {
                "names": syscalls,
                "action": "SCMP_ACT_ALLOW"
            }
        ]
    });

    profile_json.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_profile() {
        let profile = SeccompProfile::firecracker_default();
        assert!(!profile.allowed_syscalls.is_empty());
        assert!(profile.is_allowed("read"));
        assert!(profile.is_allowed("write"));
        assert!(!profile.is_allowed("execve")); // Not in default profile
    }

    #[test]
    fn test_permissive_profile() {
        let profile = SeccompProfile::permissive();
        assert!(profile.allowed_syscalls.is_empty());
        assert!(profile.is_allowed("anything"));
    }

    #[test]
    fn test_get_by_category() {
        let profile = SeccompProfile::firecracker_default();
        let file_syscalls = profile.get_by_category(SyscallCategory::File);
        assert!(!file_syscalls.is_empty());
        assert!(file_syscalls.contains(&&"read".to_string()));
    }

    #[test]
    fn test_json_generation() {
        let profile = SeccompProfile::firecracker_default();
        let json = generate_json_profile(&profile);
        assert!(json.contains("SCMP_ACT_ALLOW"));
        assert!(json.contains("read"));
    }
}
