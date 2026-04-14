# A2R Firecracker Driver - Troubleshooting Guide

This document provides runbooks for diagnosing and resolving common issues in production.

---

## Table of Contents

1. [VM Stuck in Creating State](#vm-stuck-in-creating-state)
2. [Firecracker Process Zombie](#firecracker-process-zombie)
3. [IP Address Exhaustion](#ip-address-exhaustion)
4. [Guest Agent Not Responding](#guest-agent-not-responding)
5. [Network Policy Not Enforced](#network-policy-not-enforced)
6. [OOM Kills](#oom-kills)
7. [Resource Leak Detection](#resource-leak-detection)

---

## VM Stuck in Creating State

### Symptoms

- VM spawn request hangs indefinitely
- Status shows `Creating` or `Configuring`
- No progress after 30+ seconds
- May see timeouts in client

### Diagnostic Steps

1. **Check driver logs**
   ```bash
   journalctl -u a2r-firecracker-driver -f --since "5 minutes ago"
   ```

2. **Verify Firecracker process**
   ```bash
   ps aux | grep firecracker | grep -v grep
   # Should show firecracker process for the VM
   
   # Check if jailer started
   ps aux | grep jailer | grep -v grep
   ```

3. **Check network namespace creation**
   ```bash
   ip netns list | grep a2r-
   
   # Check specific namespace
   sudo ip netns exec a2r-{vm-id} ip addr
   ```

4. **Verify API socket**
   ```bash
   ls -la /srv/jailer/{vm-id}/root/run/firecracker.socket
   # Should exist and be accessible
   ```

5. **Check rootfs creation**
   ```bash
   ls -la /var/lib/a2r/firecracker-vms/{vm-id}/
   # Should contain rootfs file
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| Kernel image missing | `ls /var/lib/a2r/vmlinux` | Download/copy kernel image |
| Firecracker binary not found | `which firecracker` | Install Firecracker |
| Network namespace conflict | `ip netns list` | Delete conflicting namespace |
| TAP device creation failed | `ip tuntap show` | Check CAP_NET_ADMIN capability |
| Rootfs creation stuck | Check OCI extraction | Clear cache, retry |
| Disk full | `df -h` | Free disk space |

### Resolution Steps

```bash
# 1. Get the stuck VM ID from logs
VM_ID="your-vm-id"

# 2. Check Firecracker logs
sudo cat /var/lib/a2r/firecracker-vms/$VM_ID/firecracker.log

# 3. If process is stuck, kill it
sudo pkill -f "firecracker.*$VM_ID"

# 4. Clean up network namespace
sudo ip netns del a2r-$VM_ID 2>/dev/null || true

# 5. Clean up chroot
sudo rm -rf /srv/jailer/$VM_ID

# 6. Clean up VM directory
sudo rm -rf /var/lib/a2r/firecracker-vms/$VM_ID

# 7. Restart driver if needed
sudo systemctl restart a2r-firecracker-driver
```

### Prevention

- Enable health checks before accepting spawn requests
- Set spawn timeouts in client code
- Monitor disk space proactively

---

## Firecracker Process Zombie

### Symptoms

- `ps aux` shows `<defunct>` firecracker processes
- Parent process (jailer) may be stuck
- Resources (TAP devices, network namespaces) not cleaned up
- IP addresses remain allocated

### Diagnostic Steps

1. **Find zombie processes**
   ```bash
   ps aux | grep defunct
   
   # Or more specifically
   ps aux | grep -E '(firecracker|jailer)'
   ```

2. **Check parent process**
   ```bash
   # Find PPID of zombie
   ps -o pid,ppid,stat,comm -p <zombie-pid>
   
   # Check if parent is stuck
   cat /proc/<ppid>/status | grep State
   ```

3. **Check for orphaned resources**
   ```bash
   # Network namespaces
   ip netns list
   
   # TAP devices
   ip tuntap show
   
   # IP allocations (check IPAM state)
   cat /var/lib/a2r/ipam-state.json | jq '.allocated | length'
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| Jailer crashed | Check jailer logs | Kill orphaned processes |
| SIGKILL received | System logs | Implement graceful shutdown |
| Resource cleanup failed | Check cleanup logs | Manual cleanup + fix cleanup code |
| Kernel panic | Firecracker logs | Check kernel compatibility |

### Resolution Steps

```bash
# 1. Kill all firecracker processes for a VM
VM_ID="your-vm-id"
sudo pkill -9 -f "firecracker.*$VM_ID"
sudo pkill -9 -f "jailer.*$VM_ID"

# 2. Wait for reaping
sleep 2

# 3. Clean up network namespace
sudo ip netns del a2r-$VM_ID 2>/dev/null || true

# 4. Clean up TAP device (if still exists)
sudo ip tuntap del tap-${VM_ID:0:8} mode tap 2>/dev/null || true

# 5. Remove iptables rules
sudo iptables -D FORWARD -i tap-${VM_ID:0:8} -j A2R-TAP_${VM_ID:0:8} 2>/dev/null || true
sudo iptables -F A2R-TAP_${VM_ID:0:8} 2>/dev/null || true
sudo iptables -X A2R-TAP_${VM_ID:0:8} 2>/dev/null || true

# 6. Clean up chroot and directories
sudo umount /srv/jailer/$VM_ID/root/rootfs/* 2>/dev/null || true
sudo rm -rf /srv/jailer/$VM_ID
sudo rm -rf /var/lib/a2r/firecracker-vms/$VM_ID

# 7. Release IP from IPAM
# This happens automatically on driver restart
# Or manually edit /var/lib/a2r/ipam-state.json (not recommended)
```

### Automated Cleanup

The `CleanupCoordinator` automatically handles zombie recovery:

```rust
// On driver startup, pending cleanups are loaded and retried
let coordinator = CleanupCoordinator::new("/var/lib/a2r/cleanup").await?;
```

---

## IP Address Exhaustion

### Symptoms

- Spawn fails with `InsufficientResources: IP addresses in subnet`
- IPAM state shows many allocations
- New VMs cannot get IP addresses
- May see IP conflict errors

### Diagnostic Steps

1. **Check IPAM state**
   ```bash
   cat /var/lib/a2r/ipam-state.json | jq
   
   # Count allocations
   cat /var/lib/a2r/ipam-state.json | jq '.allocated | length'
   
   # Check subnet size
   cat /var/lib/a2r/ipam-state.json | jq '.subnet'
   ```

2. **Find orphaned IPs**
   ```bash
   # For each allocated IP, check if VM exists
   for ip in $(cat /var/lib/a2r/ipam-state.json | jq -r '.allocated[]'); do
       ping -c 1 -W 1 $ip > /dev/null 2>&1 && echo "$ip: alive" || echo "$ip: orphaned"
   done
   ```

3. **Check active VMs**
   ```bash
   # List active VM directories
   ls /var/lib/a2r/firecracker-vms/
   
   # Compare with IPAM allocations
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| Subnet too small | CIDR prefix | Expand subnet (e.g., /24 → /22) |
| Orphaned allocations | IPs not responding | Restart driver to reclaim |
| Stuck destroy operations | Destroy errors | Manual cleanup |
| VM leak | Growing VM count | Fix leak source |

### Resolution Steps

```bash
# Option 1: Restart driver (triggers orphan reclamation)
sudo systemctl restart a2r-firecracker-driver

# Option 2: Manual IPAM reset (nuclear option)
# WARNING: This will lose all IP allocations!
sudo systemctl stop a2r-firecracker-driver
sudo mv /var/lib/a2r/ipam-state.json /var/lib/a2r/ipam-state.json.bak
sudo systemctl start a2r-firecracker-driver

# Option 3: Expand subnet
# Edit configuration to use larger subnet
# e.g., change from 172.16.0.0/24 (253 IPs) to 172.16.0.0/22 (1021 IPs)
```

### Prevention

- Use appropriately sized subnets (/22 recommended for production)
- Enable automatic orphan reclamation
- Monitor IP pool utilization
- Set up alerts at 80% utilization

---

## Guest Agent Not Responding

### Symptoms

- `exec()` calls timeout or fail
- `stream_logs()` returns empty
- `get_artifacts()` fails
- VSOCK connection refused/timeout

### Diagnostic Steps

1. **Check if VM is running**
   ```bash
   ps aux | grep firecracker | grep $VM_ID
   ```

2. **Check VSOCK path**
   ```bash
   ls -la /tmp/vsock-$VM_ID.sock
   # OR inside chroot
   ls -la /srv/jailer/$VM_ID/root/run/vsock-*.sock
   ```

3. **Test VSOCK connection**
   ```bash
   # Install vsock tools
   sudo apt-get install socat
   
   # Try to connect
   sudo socat - UNIX-CONNECT:/tmp/vsock-$VM_ID.sock
   ```

4. **Check guest agent logs (inside VM)**
   ```bash
   # Requires VM with console access
   # Check systemd status inside VM
   systemctl status a2r-guest-agent
   
   # Check guest agent logs
   journalctl -u a2r-guest-agent
   ```

5. **Verify guest agent binary**
   ```bash
   # Check if guest agent exists in rootfs
   sudo mkdir -p /mnt/debug
   sudo mount /var/lib/a2r/firecracker-vms/$VM_ID/*-rootfs.ext4 /mnt/debug
   ls -la /mnt/debug/usr/local/bin/a2r-guest-agent
   sudo umount /mnt/debug
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| Guest agent not in rootfs | Check binary exists | Rebuild rootfs with guest agent |
| Guest agent crashed | Check logs | Restart VM, investigate crash |
| VSOCK misconfiguration | Check vsock config | Verify vsock port in Firecracker config |
| VM kernel panic | Check console output | Fix kernel/rootfs compatibility |
| VM out of memory | Check OOM kills | Increase VM memory |

### Resolution Steps

```bash
# 1. Restart the VM (if possible)
# Destroy and respawn

# 2. If guest agent is missing from rootfs:
# Add guest agent to OCI image or use minimal rootfs with agent

# 3. Check Firecracker VSOCK configuration
curl --unix-socket /srv/jailer/$VM_ID/root/run/firecracker.socket \
  http://localhost/vsock

# 4. For debugging, enable Firecracker console
# Add to boot args: console=ttyS0
# Then view console:
sudo socat UNIX-CONNECT:/srv/jailer/$VM_ID/root/run/firecracker.socket -
```

### Debugging Guest Agent

```bash
# Build debug version
cd src/guest-agent
cargo build

# Copy to rootfs and test manually
sudo cp target/debug/a2r-guest-agent /mnt/debug/usr/local/bin/
sudo umount /mnt/debug

# Start VM and check
```

---

## Network Policy Not Enforced

### Symptoms

- VM can reach blocked hosts
- Rate limits not applied
- DNS queries allowed when disabled
- Egress blocking not working

### Diagnostic Steps

1. **Check iptables rules**
   ```bash
   # List custom chains
   sudo iptables -L | grep A2R
   
   # Check specific chain
   sudo iptables -L A2R-TAP_XXXXXXXX -v -n
   
   # Check FORWARD chain
   sudo iptables -L FORWARD -v -n | grep tap-
   ```

2. **Check tc (traffic control) rules**
   ```bash
   # List qdiscs
   sudo tc qdisc show
   
   # Check specific interface
   sudo tc qdisc show dev tap-$VM_ID
   sudo tc class show dev tap-$VM_ID
   ```

3. **Test connectivity from VM**
   ```bash
   # Get VM IP
   VM_IP=$(cat /var/lib/a2r/ipam-state.json | jq -r '.allocated["'$VM_ID'"]')
   
   # Enter network namespace
   sudo ip netns exec a2r-$VM_ID ping -c 3 8.8.8.8
   
   # Test DNS
   sudo ip netns exec a2r-$VM_ID nslookup google.com
   ```

4. **Check policy configuration**
   ```bash
   # Check driver logs for policy application
   grep "Applying network policy" /var/log/a2r/firecracker-driver.log
   grep "Failed to apply network policy" /var/log/a2r/firecracker-driver.log
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| iptables rules not applied | Check FORWARD chain | Restart driver, check CAP_NET_ADMIN |
| tc qdisc creation failed | Check qdisc list | Verify kernel has HTB support |
| Wrong interface | Check TAP name | Verify TAP device name matches |
| Policy apply failed silently | Check logs | Fix error handling |
| FORWARD chain not traversed | Check bridge config | Enable bridge netfilter |

### Resolution Steps

```bash
# 1. Manually apply rules for testing
TAP_NAME="tap-${VM_ID:0:8}"

# Add rate limit
sudo tc qdisc add dev $TAP_NAME root handle 1: htb default 1
sudo tc class add dev $TAP_NAME parent 1: classid 1:1 htb rate 10mbit

# Add iptables rules
sudo iptables -N A2R-TEST
sudo iptables -A A2R-TEST -d 8.8.8.8 -j DROP
sudo iptables -A FORWARD -i $TAP_NAME -j A2R-TEST

# 2. Verify rules are working
sudo ip netns exec a2r-$VM_ID ping -c 3 8.8.8.8
# Should fail

# 3. Clean up test rules
sudo iptables -D FORWARD -i $TAP_NAME -j A2R-TEST
sudo iptables -F A2R-TEST
sudo iptables -X A2R-TEST
```

### Kernel Requirements

```bash
# Verify HTB support
zgrep CONFIG_NET_SCH_HTB /boot/config-$(uname -r)
# Should show CONFIG_NET_SCH_HTB=y or =m

# Verify netfilter
zgrep CONFIG_BRIDGE_NETFILTER /boot/config-$(uname -r)
```

---

## OOM Kills

### Symptoms

- Firecracker process killed by OOM killer
- `dmesg` shows "Out of memory: Kill process"
- VMs killed unexpectedly
- System becomes unresponsive

### Diagnostic Steps

1. **Check OOM killer logs**
   ```bash
   # Recent OOM kills
   dmesg | grep -i "out of memory"
   
   # Specific process
   dmesg | grep -i "firecracker"
   
   # Full OOM report
   dmesg | grep -A 20 "oom-kill"
   ```

2. **Check memory usage**
   ```bash
   # Current memory
   free -h
   
   # Memory per process
   ps aux --sort=-%mem | head -20
   
   # Firecracker memory
   ps -o pid,rss,vsz,comm -p $(pgrep firecracker)
   ```

3. **Check cgroup limits (if enabled)**
   ```bash
   # Check cgroup memory limit
   cat /sys/fs/cgroup/memory/a2r/$VM_ID/memory.limit_in_bytes
   cat /sys/fs/cgroup/memory/a2r/$VM_ID/memory.usage_in_bytes
   ```

4. **Check VM memory configuration**
   ```bash
   # Check VM memory settings
   grep "mem_size_mib" /var/lib/a2r/firecracker-vms/$VM_ID/*.json
   ```

### Common Causes & Solutions

| Cause | Check | Solution |
|-------|-------|----------|
| Host memory exhausted | free -h | Add more RAM or reduce VM count |
| Memory overcommit | Commit limit | Disable overcommit or reduce allocation |
| VM memory too high | VM config | Reduce VM memory size |
| Memory leak | Growing RSS | Fix leak in driver or guest |
| cgroup limit too low | cgroup settings | Increase cgroup memory limit |

### Resolution Steps

```bash
# 1. Immediate relief - kill non-essential VMs
# List VMs by memory usage
for pid in $(pgrep firecracker); do
    echo "PID: $pid, RSS: $(ps -o rss= -p $pid) KB"
done | sort -k3 -n

# Kill highest memory VMs
sudo kill -9 <highest-pid>

# 2. Adjust OOM killer priority (temporary)
sudo echo -1000 > /proc/$(pgrep a2r-firecracker-driver)/oom_score_adj

# 3. Configure memory overcommit
# Edit /etc/sysctl.conf
vm.overcommit_memory=1
vm.overcommit_ratio=100
sudo sysctl -p
```

### Prevention

- Set VM memory limits appropriately
- Monitor host memory usage
- Configure early OOM (oomd)
- Use cgroups v2 memory controller
- Set memory reservations

---

## Resource Leak Detection

### Symptoms

- Gradual increase in resource usage over time
- TAP devices accumulate
- Network namespaces not cleaned up
- Disk space slowly decreases
- File descriptors exhausted

### Diagnostic Steps

1. **Check for leaked TAP devices**
   ```bash
   # Count TAP devices
   ip tuntap show | grep tap- | wc -l
   
   # Check for orphaned TAPs (not in any namespace)
   for tap in $(ip tuntap show | grep tap- | awk '{print $1}'); do
       ns=$(ip netns identify $(cat /sys/class/net/$tap/ifindex) 2>/dev/null)
       if [ -z "$ns" ]; then
           echo "Orphaned: $tap"
       fi
   done
   ```

2. **Check for leaked network namespaces**
   ```bash
   # List all namespaces
   ip netns list
   
   # Count a2r namespaces
   ip netns list | grep a2r- | wc -l
   
   # Check if namespace has running processes
   for ns in $(ip netns list | grep a2r- | awk '{print $1}'); do
       pids=$(sudo ip netns pids $ns 2>/dev/null | wc -l)
       echo "$ns: $pids processes"
   done
   ```

3. **Check for leaked mount points**
   ```bash
   # Show all mounts
   mount | grep -E '(a2r|firecracker|jailer)'
   
   # Count specific mount types
   mount | grep bind | wc -l
   ```

4. **Check for leaked sockets**
   ```bash
   # Unix sockets
   find /run/a2r -type s 2>/dev/null | wc -l
   find /srv/jailer -name "*.socket" 2>/dev/null | wc -l
   
   # Check file descriptor usage
   ls /proc/$(pgrep a2r-firecracker-driver)/fd | wc -l
   ```

5. **Check for leaked chroot directories**
   ```bash
   # Count jailer directories
   ls /srv/jailer/ | wc -l
   
   # Check for empty directories
   find /srv/jailer -type d -empty
   ```

### Common Causes & Solutions

| Resource | Leak Cause | Solution |
|----------|------------|----------|
| TAP devices | Cleanup failure on destroy | Fix teardown_tap_device, add retry |
| Network namespaces | Process stuck in namespace | Kill all processes before deleting ns |
| Mount points | Unmount failure | Lazy unmount, cleanup on boot |
| Sockets | Socket not removed | Add socket cleanup to destroy path |
| File descriptors | FD not closed | Audit FD usage, add close() calls |
| Chroot directories | cleanup_staged_resources failure | Add force cleanup option |

### Automated Detection Script

```bash
#!/bin/bash
# resource-leak-check.sh

THRESHOLD=50

# Check TAP devices
TAP_COUNT=$(ip tuntap show 2>/dev/null | grep tap- | wc -l)
if [ "$TAP_COUNT" -gt "$THRESHOLD" ]; then
    echo "WARNING: High TAP device count: $TAP_COUNT"
fi

# Check network namespaces
NS_COUNT=$(ip netns list 2>/dev/null | grep a2r- | wc -l)
if [ "$NS_COUNT" -gt "$THRESHOLD" ]; then
    echo "WARNING: High network namespace count: $NS_COUNT"
fi

# Check jailer directories
JAILER_COUNT=$(ls /srv/jailer/ 2>/dev/null | wc -l)
if [ "$JAILER_COUNT" -gt "$THRESHOLD" ]; then
    echo "WARNING: High jailer directory count: $JAILER_COUNT"
fi

# Check mount points
MOUNT_COUNT=$(mount | grep -E 'a2r|firecracker|jailer' | wc -l)
if [ "$MOUNT_COUNT" -gt "$THRESHOLD" ]; then
    echo "WARNING: High mount point count: $MOUNT_COUNT"
fi

# Check IPAM state file size
if [ -f /var/lib/a2r/ipam-state.json ]; then
    IPAM_SIZE=$(cat /var/lib/a2r/ipam-state.json | jq '.allocated | length')
    if [ "$IPAM_SIZE" -gt "$THRESHOLD" ]; then
        echo "WARNING: High IP allocation count: $IPAM_SIZE"
    fi
fi
```

### Cleanup Script

```bash
#!/bin/bash
# emergency-cleanup.sh - USE WITH CAUTION

# Stop driver
sudo systemctl stop a2r-firecracker-driver

# Clean up orphaned TAP devices
for tap in $(ip tuntap show 2>/dev/null | grep tap- | awk '{print $1}'); do
    ip tuntap del $tap mode tap 2>/dev/null && echo "Removed $tap"
done

# Clean up orphaned namespaces
for ns in $(ip netns list 2>/dev/null | grep a2r- | awk '{print $1}'); do
    # Kill any processes in namespace
    for pid in $(ip netns pids $ns 2>/dev/null); do
        kill -9 $pid 2>/dev/null
    done
    ip netns del $ns 2>/dev/null && echo "Removed namespace $ns"
done

# Clean up stale mounts
for mount in $(mount | grep -E '/srv/jailer|/var/lib/a2r' | awk '{print $3}'); do
    umount -l $mount 2>/dev/null && echo "Unmounted $mount"
done

# Clean up jailer directories
rm -rf /srv/jailer/*

# Reset IPAM
mv /var/lib/a2r/ipam-state.json /var/lib/a2r/ipam-state.json.bak.$(date +%s)

# Restart driver
sudo systemctl start a2r-firecracker-driver

echo "Emergency cleanup complete"
```

---

## General Debugging Tips

### Enable Debug Logging

```bash
# Set environment variable
export A2R_LOG_LEVEL=debug
export RUST_LOG=a2r_firecracker_driver=debug

# Or use systemd override
sudo systemctl edit a2r-firecracker-driver
# Add:
[Service]
Environment="A2R_LOG_LEVEL=debug"
```

### Firecracker Debugging

```bash
# Enable Firecracker logging
# In driver config, set detailed Firecracker logs

# View Firecracker logs
sudo cat /var/lib/a2r/firecracker-vms/$VM_ID/firecracker.log

# Run Firecracker manually for testing
sudo /usr/bin/firecracker --api-sock /tmp/test.socket --id test-vm
```

### Network Debugging

```bash
# Packet capture on TAP device
sudo tcpdump -i tap-$VM_ID -w /tmp/capture.pcap

# Monitor iptables
sudo watch -n 1 'iptables -L FORWARD -v -n'

# Monitor traffic control
sudo watch -n 1 'tc -s qdisc show dev tap-$VM_ID'
```

### Performance Debugging

```bash
# Profile driver
perf record -p $(pgrep a2r-firecracker-driver) -g -- sleep 30
perf report

# Check async task usage
# Add tokio-console instrumentation
RUSTFLAGS="--cfg tokio_unstable" cargo build
TOKIO_CONSOLE_BIND=127.0.0.1:6669 cargo run
```

---

## Escalation Path

1. **Level 1: Self-Service**
   - Use this troubleshooting guide
   - Check logs and metrics
   - Try resolution steps

2. **Level 2: Team Support**
   - Post in #kernel-team Slack
   - Include logs and diagnostic output
   - Document steps already tried

3. **Level 3: Emergency**
   - Page on-call engineer
   - Provide incident summary
   - Have rollback plan ready
