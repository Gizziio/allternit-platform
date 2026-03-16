# Deployment Guide - Gizzi Thin Client

Guide for deploying and distributing the Gizzi Thin Client to end users.

## Table of Contents

- [Distribution Channels](#distribution-channels)
- [Release Process](#release-process)
- [Auto-Updater Setup](#auto-updater-setup)
- [Enterprise Deployment](#enterprise-deployment)
- [Analytics & Monitoring](#analytics--monitoring)

## Distribution Channels

### 1. Direct Download (Recommended for Beta)

Host builds on your own infrastructure:

```
https://download.a2r.io/thin-client/
├── latest/
│   ├── Gizzi-Thin-Client-0.1.0.dmg (macOS)
│   ├── Gizzi-Thin-Client-0.1.0.exe (Windows)
│   └── gizzi-thin-client-0.1.0.AppImage (Linux)
└── changelog.json
```

### 2. GitHub Releases (Open Source)

```bash
# Create a new release
git tag -a v0.1.0 -m "Release version 0.1.0"
git push origin v0.1.0

# GitHub Actions will automatically build and attach artifacts
```

### 3. App Stores

#### macOS App Store
- Requires additional entitlements
- Sandboxing restrictions apply
- Review process: 1-2 days

#### Microsoft Store
- MSIX packaging required
- Desktop Bridge for Win32 apps
- Review process: hours to days

#### Snap Store (Linux)

```yaml
# snap/snapcraft.yaml
name: gizzi-thin-client
version: '0.1.0'
summary: Gizzi Thin Client
base: core20

parts:
  thin-client:
    plugin: nil
    source: .
    override-build: |
      npm install
      npm run build:prod -- --linux snap
```

## Release Process

### Semantic Versioning

Follow [SemVer](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Example: `0.1.0`, `0.1.1`, `1.0.0`

### Release Checklist

```markdown
## Pre-Release
- [ ] All features complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped in package.json

## Build
- [ ] Build for macOS (signed & notarized)
- [ ] Build for Windows (signed)
- [ ] Build for Linux
- [ ] Verify signatures
- [ ] Test auto-updater

## Release
- [ ] Create GitHub release
- [ ] Upload to download server
- [ ] Update website download links
- [ ] Announce on social media
- [ ] Update documentation

## Post-Release
- [ ] Monitor error reports
- [ ] Monitor analytics
- [ ] Respond to user feedback
```

### Automated Release with GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          
      - run: npm ci
      - run: npm run build:prod
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release/*.dmg
            release/*.exe
            release/*.AppImage
            release/*.deb
          draft: true
```

## Auto-Updater Setup

The thin client uses `electron-updater` for automatic updates.

### Update Server Requirements

1. **Static file server** serving:
   - `latest-mac.yml` - macOS update manifest
   - `latest.yml` - Windows/Linux manifest
   - Binary files (.dmg, .exe, .AppImage)

2. **HTTPS required** for security

### Update Manifest Format

```yaml
# latest-mac.yml
version: 0.1.0
files:
  - url: Gizzi Thin Client-0.1.0-mac.zip
    sha512: abc123...
    size: 12345678
    blockMapSize: 1234
path: Gizzi Thin Client-0.1.0-mac.zip
sha512: abc123...
releaseDate: '2024-01-15T10:00:00.000Z'
```

### Configuration

```json
// package.json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://download.a2r.io/thin-client/"
    }
  }
}
```

### Update Check Flow

```
1. App checks for updates on startup
2. If update available:
   - Download in background
   - Notify user
   - Install on quit (or prompt to restart)
3. If no update:
   - Silent, no user notification
```

### Code Implementation

```typescript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater';
import { dialog } from 'electron';

export function setupUpdater() {
  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
  
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available. It will be downloaded in the background.',
    });
  });
  
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart to install?',
      buttons: ['Restart', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
}
```

## Enterprise Deployment

### Mass Deployment Options

#### macOS

**MDM (Mobile Device Management)**
```bash
# Deploy via Jamf Pro, Workspace ONE, etc.
# Upload .pkg or .dmg to MDM
# Configure as managed app
```

**Command Line Installation**
```bash
# Silent install
hdiutil attach Gizzi-Thin-Client.dmg
cp -R "/Volumes/Gizzi Thin Client/Gizzi Thin Client.app" /Applications/
hdiutil detach "/Volumes/Gizzi Thin Client"
```

#### Windows

**Group Policy (GPO)**
```powershell
# Deploy via GPO
# Create MSI wrapper with WiX
# Assign to computer or user
```

**SCCM/MEMCM**
```powershell
# Deploy via System Center
# Use .exe or .msi package
# Configure detection method
```

**Silent Installation**
```powershell
# NSIS installer
Gizzi-Thin-Client-Setup.exe /S

# Check installation
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*
```

#### Linux

**Package Repositories**
```bash
# Debian/Ubuntu
sudo add-apt-repository ppa:a2r/thin-client
sudo apt-get update
sudo apt-get install gizzi-thin-client

# Fedora
sudo dnf copr enable a2r/thin-client
sudo dnf install gizzi-thin-client
```

**Configuration Management**
```puppet
# Puppet example
package { 'gizzi-thin-client':
  ensure => 'installed',
  source => 'https://download.a2r.io/thin-client/gizzi-thin-client.deb',
  provider => 'dpkg',
}
```

### Enterprise Configuration

**Pre-configured Settings**
```json
// /etc/gizzi-thin-client/config.json (Linux)
// C:\ProgramData\Gizzi\config.json (Windows)
// /Library/Application Support/Gizzi/config.json (macOS)
{
  "backend": {
    "type": "desktop",
    "url": "http://localhost:4096"
  },
  "features": {
    "agentMode": true,
    "computerUse": true
  },
  "theme": "system"
}
```

**Environment Variables**
```bash
export GIZZI_BACKEND_URL=http://company-server:4096
export GIZZI_DISABLE_AUTO_UPDATE=true
export GIZZI_LOG_LEVEL=info
```

## Analytics & Monitoring

### Error Tracking

**Sentry Integration**
```typescript
import * as Sentry from '@sentry/electron';

Sentry.init({
  dsn: 'https://xxx@xxx.ingest.sentry.io/xxx',
  environment: process.env.NODE_ENV,
  release: app.getVersion(),
});
```

**Crash Reports**
- Automatically sent on crash
- Includes stack trace and system info
- User can opt-out in settings

### Usage Analytics

**Privacy-First Approach**
```typescript
// Only collect anonymous metrics
const metrics = {
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  // No personally identifiable information
};
```

**Metrics to Track**
- App launches
- Session duration
- Feature usage (agent mode, computer use)
- Error rates
- Update success rates

### Health Monitoring

**Heartbeat Endpoint**
```typescript
// Periodic health check to your server
setInterval(async () => {
  await fetch('https://api.a2r.io/health', {
    method: 'POST',
    body: JSON.stringify({
      version: app.getVersion(),
      timestamp: Date.now(),
    }),
  });
}, 24 * 60 * 60 * 1000); // Daily
```

## Rollback Strategy

### Emergency Rollback

If a release has critical issues:

1. **Disable auto-updater** (server-side)
2. **Remove affected binaries** from download server
3. **Update website** with warning
4. **Publish fixed release**

### User Rollback

```bash
# macOS - Downgrade manually
# 1. Download older version
# 2. Replace in /Applications

# Windows - Use installer
# 1. Uninstall current version
# 2. Install older version
# 3. Disable auto-updater

# Linux - Package manager
sudo apt-get install gizzi-thin-client=0.1.0
```

## Support Channels

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| GitHub Issues | Bug reports, feature requests | 24-48 hours |
| Email | Enterprise support | 4 hours |
| Discord | Community support | Community |
| Documentation | Self-service | Instant |

## Resources

- [Electron Deployment](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Auto Updater](https://www.electron.build/auto-update.html)
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
