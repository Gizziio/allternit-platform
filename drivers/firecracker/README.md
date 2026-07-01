# Allternit Firecracker Driver

Production-ready MicroVM-based execution driver using AWS Firecracker for the Allternit platform.

## Overview

This driver provides hardware-level isolation for multi-tenant workloads using Firecracker MicroVMs. It implements the `ExecutionDriver` trait from `allternit-driver-interface`.

### Key Features

- **🔒 Security**: Firecracker jailer integration (chroot, namespaces, privilege dropping)
- **📊 Resource Enforcement**: cgroups v2 for CPU, memory, IO, and PID limits
- **🌐 Network Policy**: TC/iptables-based egress control and rate limiting
- **🎯 Determinism**: Random seed injection, TSC clocksource, reproducible filesystems
- **🏥 Health Monitoring**: Guest agent health checks with automatic recovery
- **📈 Observability**: Prometheus metrics, structured logging with tracing
- **🧹 Reliable Cleanup**: Transactional resource cleanup with panic safety

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    FirecrackerDriver                        │
├─────────────────────────────────────────────────────────────┤
│  VM Lifecycle          Network Layer        Guest Comm      │
│  ├─ spawn()            ├─ setup_netns()    ├─ vsock_init   │
│  ├─ exec()             ├─ setup_tap()      ├─ health_check │
│  ├─ pause/resume       ├─ netpolicy enforce├─ stream_logs  │
│  └─ destroy()          └─ teardown_net()   └─ get_artifacts│
│         ├─ cgroups limit                                    │
│         ├─ stage_resources (chroot)                         │
│         └─ jailer spawn (privilege drop)                    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

1. **Firecracker & Jailer binaries**:
   ```bash
   # Download from https://github.com/firecracker-microvm/firecracker/releases
   # Place in /usr/local/bin/ or configure path
   ```

2. **Kernel image** (vmlinux):
   ```bash
   # Build or download a Firecracker-compatible kernel
   # Place at /var/lib/allternit/vmlinux or configure path
   ```

3. **cgroups v2**:
   ```bash
   # Verify cgroups v2 is mounted
   mount | grep cgroup
   # Should show: cgroup2 on /sys/fs/cgroup type cgroup2
   ```

4. **Root privileges** (for network setup):
   ```bash
   # Driver needs CAP_NET_ADMIN for TAP devices
   # Jailer drops privileges after setup
   ```

### Configuration

```rust
use allternit_firecracker_driver::{FirecrackerDriver, FirecrackerConfig};

let config = FirecrackerConfig {
    firecracker_bin: PathBuf::from("/usr/local/bin/firecracker"),
    jailer_bin: PathBuf::from("/usr/local/bin/jailer"),
    chroot_base_dir: PathBuf::from("/srv/jailer"),
    vm_root_dir: PathBuf::from("/var/lib/allternit/vms"),
    kernel_image: PathBuf::from("/var/lib/allternit/vmlinux"),
    bridge_iface: "fcbridge0".to_string(),
    vm_subnet: "172.16.0.0/24".to_string(),
    cgroup_base: PathBuf::from("/sys/fs/cgroup"),
    uid: 1000,
    gid: 1000,
    max_open_fds: 1024,
};

let driver = FirecrackerDriver::with_config(config);
```

### Spawning a VM

```rust
use allternit_driver_interface::*;

let spec = SpawnSpec {
    tenant: TenantId::new("tenant-1").unwrap(),
    env: EnvironmentSpec {
        spec_type: EnvSpecType::Oci,
        image: "alpine:latest".to_string(),
        ..Default::default()
    },
    policy: PolicySpec::default_restrictive(),
    resources: ResourceSpec {
        cpu_millis: 1000,
        memory_mib: 512,
        disk_mib: Some(1024),
        network_egress_kib: Some(10240), // 10 MiB/s
        ..Default::default()
    },
    ..Default::default()
};

let handle = driver.spawn(spec).await?;
```

## Module Structure

| Module | Purpose |
|--------|---------|
| `cleanup` | Transactional resource cleanup with panic safety |
| `cgroups` | cgroups v2 resource limit enforcement |
| `ipam` | Persistent IP address management |
| `netpolicy` | Network policy enforcement (TC/iptables) |
| `rootfs` | OCI image extraction and rootfs creation |
| `guest_health` | Guest agent health monitoring |
| `metrics` | Prometheus-compatible metrics |

## Production Deployment

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for deployment checklist and system requirements.

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for runbooks on common issues.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for threat model and security configuration.

## License

[Add your license here]
