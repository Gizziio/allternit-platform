# Performance Guide

Benchmarks, scaling limits, and optimization guidance.

## Benchmarks

### Spawn Latency

| Scenario | p50 | p99 | Max |
|----------|-----|-----|-----|
| With OCI extraction | 2.5s | 5s | 10s |
| Cached rootfs | 0.8s | 1.5s | 3s |
| No network setup | 0.5s | 1s | 2s |

*Measured on: Intel Xeon 3.0GHz, NVMe SSD, 10Gbps network*

### Throughput

| Metric | Value |
|--------|-------|
| Max concurrent VMs | 100+ per node |
| Spawns/sec (cached) | ~50 |
| Spawns/sec (OCI extract) | ~10 |
| Destroy latency | < 500ms |

### Resource Overhead

| Resource | Per VM | Driver Total |
|----------|--------|--------------|
| Memory | ~50MB | Base + 50MB × VMs |
| Disk (rootfs) | 10GB default | N/A (sparse files) |
| CPU | Negligible | 1-2% at 100 VMs |
| Network | Configurable | Depends on policy |

## Scaling Limits

### Hard Limits

| Limit | Value | Configurable |
|-------|-------|--------------|
| Max VMs per node | 1000 | Limited by IP range |
| Max IPs per subnet | /16 (65k) | vm_subnet config |
| Max concurrent spawns | 20 | Semaphore in code |
| Rootfs size | 100GB | disk_mib param |

### Soft Limits (Recommended)

| Resource | Recommended | Notes |
|----------|-------------|-------|
| VMs per node | 50-100 | For stability |
| Memory per VM | 512MB-8GB | Total < 80% host |
| Network per VM | 10-100 Mbps | Use TC shaping |
| Spawn burst | 10/sec | Rate limit API |

## Optimization

### For Low Latency

1. **Pre-extract OCI images**
   ```bash
   # Cache common images
   mkdir -p /var/lib/allternit/cache/alpine-latest
   skopeo copy docker://alpine:latest oci:/var/lib/allternit/cache/alpine-latest
   ```

2. **Use smaller rootfs**
   ```rust
   ResourceSpec {
       disk_mib: Some(1024),  // Instead of 10240
       ..Default::default()
   }
   ```

3. **Disable unnecessary features**
   ```rust
   // Skip health monitoring for short-lived VMs
   let monitor = GuestAgentMonitor::new(vm.id, vsock_path)
       .with_max_failures(1);  // Fail fast
   ```

### For High Throughput

1. **Increase spawn parallelism**
   ```rust
   // In spawn(), adjust semaphore
   let semaphore = Arc::new(tokio::sync::Semaphore::new(50));
   ```

2. **Use larger subnets**
   ```rust
   FirecrackerConfig {
       vm_subnet: "10.0.0.0/16".to_string(),  // 65k IPs
   }
   ```

3. **Batch operations**
   ```rust
   // Spawn multiple VMs concurrently
   let handles: Vec<_> = specs
       .into_iter()
       .map(|s| driver.spawn(s))
       .collect();
   ```

### For Resource Efficiency

1. **Memory deduplication**
   - Use KSM (Kernel Samepage Merging)
   ```bash
   echo 1 > /sys/kernel/mm/ksm/run
   echo 1000 > /sys/kernel/mm/ksm/pages_to_scan
   ```

2. **CPU limits per VM**
   ```rust
   ResourceSpec {
       cpu_millis: 500,  // 0.5 cores
       ..Default::default()
   }
   ```

3. **Disk compression**
   - Use compressed rootfs (future feature)

## Monitoring Performance

### Key Metrics

```prometheus
# Spawn latency
allternit_vm_spawn_duration_ms{quantile="0.99"}

# Active VMs
allternit_vm_active

# Resource usage
allternit_resources_memory_used_mib
allternit_resources_ip_available

# API latency
allternit_driver_api_duration_ms
```

### Debugging Slow Spawns

1. **Check rootfs creation time**
   ```bash
   # Look for rootfs_create_duration_ms metric
   ```

2. **Check OCI extraction**
   ```bash
   # Enable debug logging
   RUST_LOG=allternit_firecracker_driver=debug
   ```

3. **Profile resources**
   ```bash
   # Monitor during spawn
   iostat -x 1
   vmstat 1
   ```

## Bottlenecks

| Bottleneck | Cause | Solution |
|------------|-------|----------|
| High spawn latency | OCI extraction | Pre-cache images |
| IP exhaustion | Small subnet | Use /16 instead of /24 |
| CPU throttling | Too many VMs | Add nodes or reduce CPU per VM |
| Network drops | Strict TC rules | Increase burst size |
| Memory pressure | Overcommit | Enable swap or reduce VM memory |

## Capacity Planning

### Formula

```
Max VMs = min(
    HostMemory / (VMMemory + 50MB overhead),
    SubnetSize - 3,  # network, gateway, broadcast
    cgroups controller limits
)

Example:
- Host: 64GB RAM
- VM: 1GB each
- Subnet: /24 (253 usable IPs)

Max VMs = min(64, 253, ∞) = 64 VMs
```

### Scaling Guide

| VMs | RAM | CPU | Disk | Network |
|-----|-----|-----|------|---------|
| 10 | 16GB | 8 cores | 200GB | 1Gbps |
| 50 | 64GB | 16 cores | 1TB | 10Gbps |
| 100 | 128GB | 32 cores | 2TB | 25Gbps |
| 500+ | Cluster | Cluster | SAN | 100Gbps |
