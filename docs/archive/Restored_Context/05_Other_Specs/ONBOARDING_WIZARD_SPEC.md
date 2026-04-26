# Allternit Desktop App - Onboarding Wizard Specification

## Overview

The onboarding wizard guides users through initial setup, including VM image download and configuration. It handles both first-time setup and migration scenarios.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ONBOARDING WIZARD                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    STEP 1: WELCOME SCREEN                           │   │
│  │                                                                     │   │
│  │  [Logo Animation]                                                   │   │
│  │                                                                     │   │
│  │  Welcome to Allternit                                                     │   │
│  │  Your AI-powered development environment                            │   │
│  │                                                                     │   │
│  │  [Get Started]                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              STEP 2: INTERNET CONNECTIVITY CHECK                    │   │
│  │                                                                     │   │
│  │  Checking connectivity...  [Spinner]                                │   │
│  │                                                                     │   │
│  │  ✅ Connected to internet                                           │   │
│  │  ✅ GitHub accessible                                               │   │
│  │  ✅ Allternit services reachable                                          │   │
│  │                                                                     │   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️  NO INTERNET CONNECTION                                         │   │
│  │                                                                     │   │
│  │  To use Allternit in a VM, we need to download VM images (~500MB).       │   │
│  │                                                                     │   │
│  │  Options:                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ • Connect to the internet and try again                     │   │   │
│  │  │   [Check Again]                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ • Use Local Mode (limited features)                         │   │   │
│  │  │   Run commands directly on your machine without VM          │   │   │
│  │  │   isolation. Good for quick tasks.                          │   │   │
│  │  │   [Continue in Local Mode]                                  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ • Build images locally (advanced)                           │   │   │
│  │  │   Requires: Linux, debootstrap, 10GB disk space             │   │   │
│  │  │   [Build Locally]                                           │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              STEP 3: VM IMAGE SETUP                                 │   │
│  │                                                                     │   │
│  │  Download VM Images                                                 │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ Ubuntu 22.04 LTS with Allternit Toolchains                         │   │   │
│  │  │ • Node.js 20, Python 3.10, Rust, Docker                     │   │   │
│  │  │ • Allternit VM Executor pre-installed                             │   │   │
│  │  │ • ~500 MB download                                          │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  [████████████████████░░░░░░░░░░░░] 45%                           │   │
│  │  Downloading: ubuntu-22.04-allternit-v1.1.0.ext4.zst                    │   │
│  │  234 MB / 500 MB at 12 MB/s - ETA 22s                              │   │
│  │                                                                     │   │
│  │  [Cancel Download]  [Advanced Options ▼]                           │   │
│  │                                                                     │   │
│  │  Advanced Options:                                                  │   │
│  │  ├── Image Version: [v1.1.0 ▼]                                     │   │
│  │  ├── Architecture:  [Auto-detect ▼]                                │   │
│  │  └── Download Path: [~/.allternit/vm-images] [Browse]                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              STEP 3b: LOCAL BUILD (Alternative)                     │   │
│  │                                                                     │   │
│  │  Build VM Images Locally                                            │   │
│  │                                                                     │   │
│  │  ⚠️  This requires a Linux system with debootstrap.                 │   │
│  │      On macOS, you must use download mode.                          │   │
│  │                                                                     │   │
│  │  Prerequisites:                                                     │   │
│  │  ✅ Linux kernel available                                          │   │
│  │  ✅ debootstrap installed                                           │   │
│  │  ✅ 10 GB free disk space                                           │   │
│  │  ⚠️  sudo access required                                           │   │
│  │                                                                     │   │
│  │  [Start Local Build]                                                │   │
│  │                                                                     │   │
│  │  Build Progress:                                                    │   │
│  │  [████████████████░░░░░░░░░░░░░░░░] 35%                           │   │
│  │  Step 3/6: Installing toolchains...                                 │   │
│  │  Estimated time remaining: 15 minutes                               │   │
│  │                                                                     │   │
│  │  [View Build Log]  [Cancel]                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              STEP 4: VM INITIALIZATION                              │   │
│  │                                                                     │   │
│  │  Starting VM for the first time...                                  │   │
│  │                                                                     │   │
│  │  [████████████████████████████████░░] 90%                           │   │
│  │                                                                     │   │
│  │  ✅ Images verified                                                 │   │
│  │  ✅ VM booted successfully                                          │   │
│  │  ✅ Guest agent connected                                           │   │
│  │  🔄 Running first-time setup...                                     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              STEP 5: READY TO USE                                   │   │
│  │                                                                     │   │
│  │  🎉 Allternit is ready!                                                   │   │
│  │                                                                     │   │
│  │  You can now:                                                       │   │
│  │  • Run commands in isolated VMs from the terminal                   │   │
│  │  • Use the Allternit CLI: allternit run "npm test"                              │   │
│  │  • Open workspaces in VS Code with full sandboxing                  │   │
│  │                                                                     │   │
│  │  [Open Allternit]  [View Documentation]                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flow States

### State Machine

```
                    ┌─────────────────┐
                    │     START       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    WELCOME      │
                    │    SCREEN       │
                    └────────┬────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   INTERNET CONNECTIVITY CHECK  │
            └────────┬─────────────┬─────────┘
                     │             │
          ┌──────────┘             └──────────┐
          │                                  │
          ▼                                  ▼
┌─────────────────────┐         ┌─────────────────────┐
│   HAS INTERNET      │         │  NO INTERNET        │
│                     │         │                     │
│ → Proceed to        │         │ Show options:       │
│   Download step     │         │ 1. Retry            │
│                     │         │ 2. Local mode       │
└────────┬────────────┘         │ 3. Build locally    │
         │                      └────────┬────────────┘
         │                               │
         ▼                               │
┌─────────────────────┐                  │
│   DOWNLOAD IMAGES   │◄─────────────────┘ (if user chooses)
│   (or Build Local)  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   VERIFY IMAGES     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   START VM          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   CONNECT GUEST     │
│   AGENT             │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│    READY            │
└─────────────────────┘
```

## Component Specification

### 1. ConnectivityChecker

```typescript
// surfaces/desktop/src/components/onboarding/ConnectivityChecker.tsx

interface ConnectivityStatus {
  internet: boolean;
  github: boolean;
  allternitServices: boolean;
  details: string;
}

class ConnectivityChecker {
  async check(): Promise<ConnectivityStatus> {
    // Check internet connectivity
    // Check GitHub releases accessibility
    // Check Allternit services (if any)
  }
  
  async checkInternet(): Promise<boolean> {
    // Try to fetch a reliable endpoint (Google, Cloudflare, etc.)
  }
  
  async checkGitHub(): Promise<boolean> {
    // Try to reach api.github.com
  }
}
```

### 2. ImageDownloader

```typescript
// surfaces/desktop/src/components/onboarding/ImageDownloader.tsx

interface DownloadProgress {
  stage: 'downloading' | 'verifying' | 'extracting' | 'complete';
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number; // bytes/sec
  eta: number; // seconds
}

interface DownloadOptions {
  version: string;
  architecture: 'auto' | 'x86_64' | 'aarch64';
  downloadPath: string;
  verifyChecksums: boolean;
}

class ImageDownloader {
  async download(options: DownloadOptions, onProgress: (p: DownloadProgress) => void): Promise<void>;
  async cancel(): Promise<void>;
  async verify(): Promise<boolean>;
}
```

### 3. LocalBuilderPanel

```typescript
// surfaces/desktop/src/components/onboarding/LocalBuilderPanel.tsx

interface BuildProgress {
  step: number;
  totalSteps: number;
  stepName: string;
  logOutput: string[];
  estimatedTimeRemaining: number;
}

interface BuildOptions {
  ubuntuVersion: string;
  additionalPackages: string[];
  includeToolchains: boolean;
}

class LocalBuilder {
  async checkPrerequisites(): Promise<PrerequisiteCheck>;
  async build(options: BuildOptions, onProgress: (p: BuildProgress) => void): Promise<void>;
  async cancel(): Promise<void>;
}
```

### 4. VmInitializer

```typescript
// surfaces/desktop/src/components/onboarding/VmInitializer.tsx

interface VmInitProgress {
  stage: 'verifying' | 'booting' | 'connecting' | 'ready';
  message: string;
  progress: number;
}

class VmInitializer {
  async initialize(onProgress: (p: VmInitProgress) => void): Promise<void>;
  async testGuestAgent(): Promise<boolean>;
}
```

## Settings Integration

### Advanced Settings Panel

```typescript
// surfaces/desktop/src/components/settings/VmSettings.tsx

interface VmSettings {
  // Image source preference
  imageSource: 'download' | 'local' | 'custom';
  
  // Download settings
  downloadVersion: string;
  autoUpdateImages: boolean;
  downloadPath: string;
  
  // Local build settings
  ubuntuVersion: string;
  customPackages: string[];
  buildOutputPath: string;
  
  // VM runtime settings
  vmMemoryMb: number;
  vmCpuCount: number;
  enableRosetta: boolean; // macOS only
}
```

## Error Handling

### Error States and Recovery

| Error | User Message | Recovery Action |
|-------|--------------|-----------------|
| No internet | "Internet connection required" | Show retry + local mode options |
| Download failed | "Failed to download VM images" | Retry, use mirror, or build local |
| Checksum mismatch | "Image verification failed" | Re-download or build local |
| VM boot failed | "VM failed to start" | Check logs, rebuild images, use local mode |
| Guest agent timeout | "VM executor not responding" | Restart VM, check compatibility |
| Disk full | "Not enough disk space" | Clear space or change download path |
| Permission denied | "Cannot write to directory" | Choose different path |

### Error Dialog Example

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Download Failed                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Failed to download ubuntu-22.04-allternit-v1.1.0.ext4.zst            │
│                                                                  │
│  Error: Connection reset by peer at 234 MB                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Options:                                                │    │
│  │ • [Retry Download] - Try downloading again              │    │
│  │ • [Use Mirror] - Try alternative download server        │    │
│  │ • [Build Locally] - Build images from scratch           │    │
│  │ • [Use Local Mode] - Skip VM, use local execution       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [View Full Logs]                                    [Cancel]   │
└─────────────────────────────────────────────────────────────────┘
```

## CLI Integration

### CLI Commands for Onboarding

```bash
# Check if setup is complete
$ allternit status
Allternit Status:
  VM Images:     ❌ Not found (~/.allternit/vm-images)
  Desktop App:   ✅ Running (PID 1234)
  VM:           ❌ Not running

Run 'allternit setup' to complete installation.

# Interactive setup
$ allternit setup
╔════════════════════════════════════════════════════════════════╗
║              Allternit Setup Wizard                                   ║
╠════════════════════════════════════════════════════════════════╣
║  This will download VM images (~500MB) for sandboxed execution. ║
╚════════════════════════════════════════════════════════════════╝

Checking internet connection... ✅
Downloading images... [45%]

# Build images locally (advanced)
$ allternit setup --build-local
This will build VM images locally. Requires Linux and debootstrap.
Continue? [y/N] y

# Force re-download
$ allternit setup --force

# Use local mode only
$ allternit setup --local-mode
```

## Analytics and Telemetry

### Events to Track (opt-in)

- Onboarding started
- Connectivity check result
- Download started/completed/failed
- Build started/completed/failed
- VM initialization result
- Time to ready
- Error occurrences and recovery

## Accessibility

### Requirements

- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support
- High contrast mode
- Reduced motion support
- Minimum font size 14px
- Clear error messaging

## i18n Support

### Supported Languages (Phase 1)

- English (en)
- Chinese Simplified (zh-CN)
- Japanese (ja)
- German (de)
- Spanish (es)

### String Keys Example

```json
{
  "onboarding.welcome.title": "Welcome to Allternit",
  "onboarding.welcome.subtitle": "Your AI-powered development environment",
  "onboarding.connectivity.checking": "Checking connectivity...",
  "onboarding.connectivity.no_internet": "No internet connection detected",
  "onboarding.connectivity.options.retry": "Connect to the internet and try again",
  "onboarding.connectivity.options.local": "Use Local Mode (limited features)",
  "onboarding.connectivity.options.build": "Build images locally (advanced)",
  "onboarding.download.title": "Download VM Images",
  "onboarding.download.size": "~{size} MB download",
  "onboarding.download.progress": "Downloading: {file} - {percent}%",
  "onboarding.build.title": "Build VM Images Locally",
  "onboarding.build.prerequisites.title": "Prerequisites",
  "onboarding.ready.title": "Allternit is ready!",
  "onboarding.ready.description": "You can now run commands in isolated VMs"
}
```

## Implementation Priority

### Phase 1: MVP

1. Welcome screen
2. Internet connectivity check
3. Download with progress
4. VM initialization
5. Ready screen

### Phase 2: Enhanced

1. Local build option
2. Advanced settings
3. Error recovery flows
4. Resume interrupted downloads

### Phase 3: Polish

1. Multiple download mirrors
2. i18n support
3. Accessibility improvements
4. Analytics
