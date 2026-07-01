# Operations Guide

Deployment and operational guidelines for the Firecracker driver.

## System Requirements

### Hardware

- **CPU**: x86_64 with virtualization support (Intel VT-x or AMD-V)
- **Memory**: 4GB minimum, 16GB+ recommended for production
- **Disk**: SSD recommended, 100GB+ for VM rootfs storage
- **Network**: 1Gbps+ for multi-tenant workloads

### Software

- **OS**: Linux kernel 5.10+ with cgroups v2 support
- **Firecracker**: v1.4.0+ (https://github.com/firecracker-microvm/firecracker)
- **Jailer**: Bundled with Firecracker release

### Kernel Configuration

Required kernel options:
```
CONFIG_KVM=y
CONFIG_KVM_INTEL=y (or CONFIG_KVM_AMD=y)
CONFIG_CGROUPS=y
CONFIG_CGROUP_CPUACCT=y
CONFIG_CGROUP_DEVICE=y
CONFIG_CGROUP_FREEZER=y
CONFIG_CGROUP_NET_CLASSID=y
CONFIG_CGROUP_PERF=y
CONFIG_CGROUP_PIDS=y
CONFIG_CGROUP_RDMA=y
CONFIG_CGROUP_SCHED=y
CONFIG_BLK_CGROUP=y
CONFIG_NETFILTER_XT_MATCH_COMMENT=y
```

## Deployment Checklist

### 1. Install Binaries

```bash
# Download Firecracker
VERSION="v1.4.0"
curl -LO https://github.com/firecracker-microvm/firecracker/releases/download/${VERSION}/firecracker-${VERSION}-x86_64.tgz
tar -xzf firecracker-${VERSION}-x86_64.tgz

# Install
sudo mkdir -p /usr/local/bin
sudo mv release-${VERSION}-x86_64/firecracker-${VERSION}-x86_64 /usr/local/bin/firecracker
sudo mv release-${VERSION}-x86_64/jailer-${VERSION}-x86_64 /usr/local/bin/jailer
sudo chmod +x /usr/local/bin/firecracker /usr/local/bin/jailer
```

### 2. Prepare Kernel

```bash
# Download pre-built kernel (or build your own)
sudo mkdir -p /var/lib/allternit
sudo curl -o /var/lib/allternit/vmlinux \
  https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux-5.10.186

# Or build custom kernel with necessary drivers
```

### 3. Setup Directories

```bash
# Create required directories
sudo mkdir -p /var/lib/allternit/vms
sudo mkdir -p /var/lib/allternit/firecracker-vms
sudo mkdir -p /srv/jailer
sudo mkdir -p /run/allternit/firecracker

# Set permissions
sudo chown -R allternit:allternit /var/lib/allternit
sudo chown -R allternit:allternit /srv/jailer
sudo chmod 755 /var/lib/allternit
sudo chmod 750 /srv/jailer
```

### 4. Configure Network

```bash
# Create bridge interface
sudo ip link add fcbridge0 type bridge
sudo ip addr add 172.16.0.1/24 dev fcbridge0
sudo ip link set fcbridge0 up

# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1

# Setup NAT for VMs
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i fcbridge0 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o fcbridge0 -m state --state RELATED,ESTABLISHED -j ACCEPT
```

### 5. cgroups v2 Setup

```bash
# Verify cgroups v2 is mounted
mount | grep cgroup2

# Should show: cgroup2 on /sys/fs/cgroup type cgroup2

# Create allternit cgroup subtree
sudo mkdir -p /sys/fs/cgroup/allternit
sudo chown allternit:allternit /sys/fs/cgroup/allternit

# Enable controllers
sudo sh -c 'echo "+cpu +memory +io +pids" > /sys/fs/cgroup/cgroup.subtree_control'
```

### 6. Runtime User

```bash
# Create dedicated user
sudo useradd -r -s /bin/false -M allternit

# Add capabilities (alternative to running as root)
sudo setcap cap_net_admin,cap_sys_admin,cap_chown=eip /usr/local/bin/firecracker
```

## Configuration

### Minimal Config

```rust
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
```

### High-Performance Config

```rust
let config = FirecrackerConfig {
    firecracker_bin: PathBuf::from("/usr/local/bin/firecracker"),
    jailer_bin: PathBuf::from("/usr/local/bin/jailer"),
    chroot_base_dir: PathBuf::from("/srv/jailer"),
    vm_root_dir: PathBuf::from("/var/lib/allternit/vms"),
    kernel_image: PathBuf::from("/var/lib/allternit/vmlinux"),
    bridge_iface: "fcbridge0".to_string(),
    vm_subnet: "10.0.0.0/16".to_string(),  // Larger subnet
    cgroup_base: PathBuf::from("/sys/fs/cgroup"),
    uid: 1000,
    gid: 1000,
    max_open_fds: 65536,  // Higher limit
};
```

## Monitoring

### Health Checks

```bash
# Check driver health
curl http://localhost:8080/health

# Expected response:
# {"healthy": true, "active_executions": 5, ...}
```

### Metrics

Prometheus metrics available at `/metrics`:

- `allternit_vm_active` - Number of active VMs
- `allternit_vm_spawn_duration_ms` - VM spawn latency
- `allternit_resources_memory_used_mib` - Memory usage
- `allternit_resources_ip_available` - Available IPs

### Logs

Structured logs in JSON format:

```bash
# View logs
journalctl -u allternit-firecracker-driver -f

# Filter for spawn failures
journalctl -u allternit-firecracker-driver | jq 'select(.event == "vm.spawn.failed")'
```

## Backup and Recovery

### IPAM State

```bash
# Backup IPAM state
cp /var/lib/allternit/vms/ipam-state.json /backup/ipam-state-$(date +%Y%m%d).json

# Restore IPAM state
cp /backup/ipam-state-YYYYMMDD.json /var/lib/allternit/vms/ipam-state.json
```

### VM Cache

```bash
# Backup OCI image cache
tar -czf /backup/allternit-cache-$(date +%Y%m%d).tar.gz /var/lib/allternit/vms/cache/
```

## Scaling

### Horizontal Scaling

- Run multiple driver instances on different nodes
- Use shared IPAM state (NFS or distributed storage)
- Or partition subnet per node

### Vertical Scaling

- Increase `max_open_fds` for more concurrent VMs
- Allocate more memory for VM cache
- Use faster storage (NVMe) for rootfs

## Maintenance

### Daily

- Check metrics dashboard
- Review error logs
- Verify IP pool not exhausted

### Weekly

- Clean up stale cache entries
- Review resource usage patterns
- Check for updates

### Monthly

- Full backup of configuration and state
- Review security advisories
- Capacity planning
