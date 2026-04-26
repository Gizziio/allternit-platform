# VM Images for Allternit Desktop

VM images are packaged with the desktop app for each platform. This eliminates the download step during onboarding.

## Directory Structure

```
resources/vm/
├── darwin/     # macOS - Apple Virtualization.framework
├── linux/      # Linux - Firecracker microVMs  
└── win32/      # Windows - WSL2 or Hyper-V
```

## Adding VM Images

### macOS (darwin)

Place these files in `resources/vm/darwin/`:

- `disk.img` - Root filesystem image (raw format)
- `kernel` - Linux kernel
- `initrd` - Initial ramdisk (optional)

Or for Apple Silicon macOS VMs:
- `restore.ipsw` - IPSW firmware image

### Linux

Place these files in `resources/vm/linux/`:

- `rootfs.ext4` - Root filesystem
- `kernel` - Linux kernel (vmlinux)

### Windows

Place these files in `resources/vm/win32/`:

- `rootfs.vhdx` - WSL2 VHDX image

## Build Process

During electron-builder packaging, the appropriate platform directory is copied to:
```
<app>/Contents/Resources/vm/  (macOS)
<app>/resources/vm/           (Windows/Linux)
```

The onboarding wizard will detect packaged VMs and skip the download step.

## Size Considerations

VM images add to the installer size:
- Minimal Alpine-based: ~50-100MB
- Ubuntu-based: ~200-500MB
- Full developer environment: ~1-2GB

Consider compressing images and using differential updates for large VMs.
