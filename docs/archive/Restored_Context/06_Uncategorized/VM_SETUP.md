# Allternit VM Setup Guide

## Current Status

The Allternit CLI compiles and runs, but VM mode requires additional setup.

## macOS (Apple Virtualization.framework)

### Requirements

1. **macOS 11.0 (Big Sur) or later** - Required for Virtualization.framework
2. **VM Image Files** - Linux kernel and rootfs
3. **Entitlements** - May need to be signed with VM entitlements

### VM Image Files

Create these directories and files:

```bash
sudo mkdir -p /var/lib/allternit/rootfs
sudo mkdir -p /var/lib/allternit/apple-vf

# Download Linux kernel for macOS VMs
# Note: Must be compiled for Apple Virtualization
sudo curl -o /var/lib/allternit/rootfs/vmlinux \
    https://example.com/linux-6.1-macos-arm64-vmlinux

# Download or create rootfs
sudo curl -o /var/lib/allternit/rootfs/ubuntu-22.04-minimal.ext4 \
    https://example.com/ubuntu-22.04-arm64-minimal.ext4

# Set permissions
sudo chmod 644 /var/lib/allternit/rootfs/*
```

### Guest Agent Setup

The VM image needs a running guest agent:

```bash
# Inside the VM, install and enable guest agent:
systemctl enable allternit-guest-agent
systemctl start allternit-guest-agent
```

### Entitlements (if needed)

If you get sandbox errors, the binary may need entitlements:

```xml
<!-- allternit.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
</dict>
</plist>
```

Sign the binary:
```bash
codesign --sign - --entitlements allternit.entitlements \
    --force ./target/debug/allternit
```

## Linux (Firecracker)

### Requirements

1. **Linux with KVM support**
2. **Firecracker binary** installed
3. **virtiofsd** (optional, for workspace mounts)

### Installation

```bash
# Install Firecracker
release_url="https://github.com/firecracker-microvm/firecracker/releases"
latest=$(basename $(curl -fsSLI -o /dev/null -w %{url_effective} ${release_url}/latest))
curl -L ${release_url}/download/${latest}/firecracker-${latest}-$(uname -m).tgz \
    | tar -xz

sudo mv firecracker-${latest}-$(uname -m) /usr/local/bin/firecracker
sudo chmod +x /usr/local/bin/firecracker

# Install virtiofsd (optional)
sudo apt-get install virtiofsd  # Ubuntu/Debian
# or
sudo dnf install virtiofsd       # Fedora
```

### VM Image Files

```bash
sudo mkdir -p /var/lib/allternit/kernels
sudo mkdir -p /var/lib/allternit/rootfs

# Download kernel
sudo curl -o /var/lib/allternit/kernels/vmlinux \
    https://example.com/linux-5.10-firecracker-vmlinux

# Download rootfs
sudo curl -o /var/lib/allternit/rootfs/ubuntu-22.04-minimal.ext4 \
    https://example.com/ubuntu-22.04-ext4-rootfs
```

### Test KVM

```bash
# Check if KVM is available
ls /dev/kvm

# Check permissions
sudo usermod -a -G kvm $USER
# Log out and back in
```

## Testing

### Test Local Mode (should work everywhere)

```bash
./target/debug/allternit run echo "hello"
```

### Test VM Mode (requires setup above)

```bash
# macOS
./target/debug/allternit --vm run echo "hello"

# Linux
./target/debug/allternit --vm run echo "hello"
```

## Troubleshooting

### macOS Bus Error

```
Bus error: 10
```

**Causes:**
- Missing kernel/rootfs files
- Missing entitlements
- Trying to run on Intel Mac (not yet tested)

**Fix:**
1. Check files exist in `/var/lib/allternit/rootfs/`
2. Try signing with entitlements
3. Check Console.app for crash logs

### Linux /dev/kvm not found

```
DriverError::NotAvailable("Firecracker requires KVM")
```

**Fix:**
```bash
sudo modprobe kvm
sudo modprobe kvm_intel  # or kvm_amd
sudo usermod -a -G kvm $USER
```

### Firecracker "No such file or directory"

```bash
which firecracker
# If not found:
export PATH="/usr/local/bin:$PATH"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Allternit CLI                                  │
├─────────────────────────────────────────────────────────────┤
│  allternit run          → LocalSession → Direct execution          │
│  allternit --vm run     → AppleVfDriver/FirecrackerDriver → VM     │
├─────────────────────────────────────────────────────────────┤
│  macOS: Apple Virtualization.framework                       │
│         - VZVirtualMachine for Linux VMs                     │
│         - Dedicated thread for VM ops (Send/Sync safety)     │
│                                                              │
│  Linux: Firecracker MicroVMs                                 │
│         - KVM-based lightweight VMs                          │
│         - virtio-fs for workspace mounts                     │
│         - 50 sessions per VM                                 │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Create VM images** with guest agent pre-installed
2. **Set up CI/CD** to build VM images
3. **Test on both platforms**
4. **Implement desktop app** for persistent VM sharing
