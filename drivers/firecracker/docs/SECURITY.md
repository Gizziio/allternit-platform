# Security Guide

Security architecture and threat model for the Firecracker driver.

## Threat Model

### Assets Protected

1. **Host System**: Kernel, system resources, other workloads
2. **VM Isolation**: Prevent VM escape or cross-VM access
3. **Network Isolation**: Prevent unauthorized network access
4. **Data Confidentiality**: VM memory, disk, and network traffic

### Threats Addressed

| Threat | Mitigation | Status |
|--------|------------|--------|
| VM Escape | Jailer chroot + namespaces | ✅ |
| Privilege Escalation | Jailer UID/GID dropping | ✅ |
| Resource Exhaustion | cgroups limits | ✅ |
| Network Eavesdropping | Network namespaces | ✅ |
| Unauthorized Egress | iptables/Tc rules | ✅ |
| Symlink Attacks | Private socket directories | ✅ |
| Resource Leaks | Transactional cleanup | ✅ |

## Security Architecture

### Layer 1: Jailer Isolation

```
┌─────────────────────────────────────┐
│ Host (root)                         │
├─────────────────────────────────────┤
│ Jailer (root → drops to UID 1000)  │
│ ├── chroot to /srv/jailer/{vm_id}/ │
│ ├── network namespace              │
│ ├── mount namespace                │
│ └── pid namespace                  │
├─────────────────────────────────────┤
│ Firecracker (UID 1000)             │
│ └── seccomp-bpf (future)           │
├─────────────────────────────────────┤
│ MicroVM (guest kernel)             │
└─────────────────────────────────────┘
```

### Layer 2: cgroups Resource Limits

```
/sys/fs/cgroup/allternit/
├── global/              # All VMs combined
└── vms/
    └── {vm_id}/        # Per-VM limits
        ├── cpu.max     # CPU quota
        ├── memory.max  # Memory limit
        ├── io.max      # IO throttling
        └── pids.max    # Process limit
```

### Layer 3: Network Isolation

```
VM Network Namespace
├── TAP device (veth pair)
├── iptables rules
│   ├── Allow established
│   ├── Allow specific hosts
│   └── Drop all else
└── TC HTB qdisc
    └── Rate limiting
```

## Configuration Security

### Recommended Settings

```rust
FirecrackerConfig {
    // Use jailer (required)
    jailer_bin: PathBuf::from("/usr/local/bin/jailer"),
    
    // Non-privileged user
    uid: 1000,
    gid: 1000,
    
    // Resource limits
    max_open_fds: 1024,
    
    // Secure paths
    chroot_base_dir: PathBuf::from("/srv/jailer"),
    vm_root_dir: PathBuf::from("/var/lib/allternit/vms"),
}
```

### Network Policy

```rust
// Restrictive default
PolicySpec {
    network_policy: NetworkPolicy {
        egress_allowed: false,  // Deny by default
        allowed_hosts: vec![],  // Explicit allowlist
        allowed_ports: vec![443, 80],
        dns_allowed: false,
    },
    ..Default::default()
}
```

## Auditing

### Log Locations

- **Driver logs**: `journalctl -u allternit-firecracker-driver`
- **Audit logs**: `/var/log/audit/audit.log` (if auditd enabled)
- **Resource usage**: `/sys/fs/cgroup/allternit/vms/{id}/`)

### Security Events

Events logged at ERROR level:
- VM escape attempts (detected via namespace checks)
- Resource limit violations (OOM, CPU throttle)
- Network policy violations (dropped packets)
- Health check failures

## Hardening Checklist

- [ ] Firecracker/jailer binaries owned by root, mode 755
- [ ] Kernel image owned by root, mode 644
- [ ] Chroot base directory owned by root, mode 755
- [ ] VM root directory owned by allternit user
- [ ] Socket directories mode 0700
- [ ] cgroups v2 mounted with all controllers
- [ ] iptables rules persisted across reboots
- [ ] Audit logging enabled

## Known Limitations

1. **seccomp**: Not yet implemented (relies on jailer for syscall filtering)
2. **SELinux/AppArmor**: Not integrated (cgroups provide container-level isolation)
3. **Encrypted rootfs**: Not implemented (VM disk encryption future work)
