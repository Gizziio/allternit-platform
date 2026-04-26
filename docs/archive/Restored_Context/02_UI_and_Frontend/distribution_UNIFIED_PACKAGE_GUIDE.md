# Allternit Unified Package - Seamless Desktop + Backend

## The Goal

**One download, works immediately.** No separate backend install. No lag. User installs Desktop, backend "just works".

## User Experience Flow

### First Time User (Online)

```
1. User visits allternit.com
2. Clicks "Download Allternit Desktop" (50MB)
3. Installs and opens app
4. Sees: "Setting up Allternit for the first time... [progress bar]"
5. Downloads backend (30MB, ~5 seconds)
6. "Ready!" → Platform UI loads
7. Future launches: Instant, no setup
```

### First Time User (Offline/Enterprise)

```
1. User downloads "Allternit Platform Full" (80MB)
2. Installer includes Desktop + Backend
3. Opens app → Works immediately
```

### Existing User (Update)

```
1. Desktop auto-updates (electron-updater)
2. Backend auto-updates in background (if needed)
3. Seamless, no interruption
```

### VPS User (Remote Backend)

```
1. User has backend on their VPS
2. Desktop detects no local backend
3. Shows: "Connect to your Allternit server"
4. User enters: https://my-vps.com:4096
5. Desktop connects, remembers URL
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Allternit Desktop (Electron)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Connection Manager                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ Auto-Install │  │   Bundled    │  │    Remote    │   │  │
│  │  │  (Download)  │  │  (Included)  │  │  (User VPS)  │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │  │
│  │         └─────────────────┴─────────────────┘            │  │
│  │                      │                                   │  │
│  │              ┌───────┴───────┐                          │  │
│  │              │ Backend       │                          │  │
│  │              │ Process       │                          │  │
│  │              └───────┬───────┘                          │  │
│  └──────────────────────┼──────────────────────────────────┘  │
│                         │                                       │
│  ┌──────────────────────┼──────────────────────────────────┐  │
│  │   Local Backend      │  (Auto-installed or bundled)     │  │
│  │   ┌──────────────────┴──────────────────┐               │  │
│  │   │  http://localhost:4096               │               │  │
│  │   │  - allternit-api (main gateway)            │               │  │
│  │   │  - allternit-kernel (agent kernel)         │               │  │
│  │   │  - allternit-memory (persistence)          │               │  │
│  │   │  - SQLite database                   │               │  │
│  │   └─────────────────────────────────────┘               │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Allternit Platform UI │
                    │  (React/Web UI)  │
                    └──────────────────┘
```

---

## Implementation Files

### 1. Connection Manager (`connection-manager.ts`)

**Purpose**: Orchestrates all connection modes

**Logic**:
```typescript
async autoConnect() {
  // 1. Dev server running?
  if (await check('http://localhost:4096')) return connect('development');
  
  // 2. System backend installed?
  if (await isSystemBackendRunning()) return connect('system');
  
  // 3. Remote URL saved?
  if (await check(savedRemoteUrl)) return connect('remote');
  
  // 4. Previously auto-installed?
  if (fs.exists(localBackendPath)) return startLocal();
  
  // 5. Bundled backend included?
  if (fs.exists(bundledBackendPath)) return startBundled();
  
  // 6. Auto-install from GitHub
  return autoInstall();
}
```

### 2. Backend Manager (`backend-manager.ts`)

**Purpose**: Download, install, and manage local backend

**Features**:
- Downloads from GitHub releases
- Shows progress UI
- Extracts to `~/Library/Application Support/Allternit/backend/`
- Creates default config
- Starts/stops processes
- Auto-restart on crash

### 3. Modified Main Process (`main.ts`)

**Purpose**: Splash screen during setup, then main window

**Flow**:
```typescript
app.whenReady().then(async () => {
  // Show splash
  splashWindow = createSplashWindow();
  
  // Setup backend
  const backendUrl = await connectionManager.autoConnect();
  
  // Close splash, open main
  splashWindow.close();
  mainWindow = createMainWindow(backendUrl);
});
```

---

## Build Variants

### Variant A: Standard Desktop (Auto-Install)

**Size**: ~50MB
**First Launch**: 5-10s download delay
**Best For**: Most users, always gets latest backend

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

### Variant B: Full Platform (Bundled)

**Size**: ~80MB
**First Launch**: Instant
**Best For**: Enterprise, offline users

```bash
# Pre-download all backends
node scripts/bundle-backend.js

# Build with extraResources
npm run dist:mac
npm run dist:win
npm run dist:linux
```

### Variant C: Thin Client Only (Remote Only)

**Size**: ~50MB
**First Launch**: Prompts for remote URL
**Best For**: VPS users

```bash
THIN_CLIENT_ONLY=true npm run dist
```

---

## Installation Paths

### Auto-Install Backend

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Allternit/backend/` |
| Windows | `%APPDATA%\Allternit\backend\` |
| Linux | `~/.local/share/Allternit/backend/` |

### Bundled Backend

| Platform | Path |
|----------|------|
| macOS | `Allternit.app/Contents/Resources/backend/` |
| Windows | `resources/backend/` |
| Linux | `resources/backend/` |

### System Backend (Optional)

| Platform | Path |
|----------|------|
| All | `/opt/allternit/` (if installed separately) |

---

## Update Strategy

### Desktop Updates

Uses `electron-updater`:
```typescript
autoUpdater.checkForUpdatesAndNotify();
```

### Backend Updates

Two approaches:

**A. Auto-update with Desktop**
```typescript
// When Desktop updates, also download new backend
autoUpdater.on('update-downloaded', async () => {
  await backendManager.downloadLatest();
  autoUpdater.quitAndInstall();
});
```

**B. Background Update**
```typescript
// Check for backend updates periodically
setInterval(async () => {
  const latest = await checkLatestBackendVersion();
  if (latest > current) {
    await backendManager.downloadUpdate();
    // Apply on next restart
  }
}, 24 * 60 * 60 * 1000); // Daily
```

---

## Security Considerations

### Code Signing

All binaries must be code-signed:
- Desktop: Apple Developer ID (macOS), EV cert (Windows)
- Backend: Same certificates

### Download Verification

```typescript
// Verify checksums
const sha256 = await download(`${url}.sha256`);
const file = await download(url);
if (!verifyChecksum(file, sha256)) {
  throw new Error('Checksum mismatch');
}
```

### Sandboxing

Even though backend runs locally, it should:
- Bind to `127.0.0.1` only (not `0.0.0.0`)
- Use random JWT secret
- Run as unprivileged user (macOS/Linux)

---

## Distribution Strategy

### Website Downloads

| Package | Size | Target User | URL |
|---------|------|-------------|-----|
| Allternit Desktop | 50MB | General users | `allternit.com/download` |
| Allternit Platform | 80MB | Enterprise/offline | `allternit.com/download/full` |
| Allternit CLI | 10MB | Developers | `allternit.com/download/cli` |

### Package Managers

```bash
# Homebrew (macOS)
brew install --cask allternit
# → Installs Desktop + auto-installs backend on first run

# Homebrew (Full)
brew install --cask allternit-platform
# → Bundled version with backend included

# Windows Package Manager
winget install Allternit.Desktop
winget install Allternit.Platform

# Linux
snap install allternit-desktop
apt install allternit-platform
```

---

## Migration Path

### From Source-Only

```bash
# User currently runs from source
git clone ...
cargo build --release
npm run dev

# Migration:
# 1. Install Desktop from website
# 2. Desktop detects existing backend at /target/release/
# 3. Offers: "Use existing backend" or "Install fresh"
```

### From Docker

```bash
# User currently uses docker-compose up
# Desktop detects localhost:4096 responding
# Shows: "Connect to local Docker backend?"
```

---

## Testing Checklist

### First-Run Experience

- [ ] Clean machine, download Desktop
- [ ] Open app → Splash shows
- [ ] Progress bar updates during download
- [ ] Backend starts successfully
- [ ] Main window loads Platform UI
- [ ] Second launch: instant, no splash

### Update Experience

- [ ] Desktop update downloads
- [ ] Backend updates in background
- [ ] Seamless restart

### Remote Connection

- [ ] Enter VPS URL
- [ ] Validates connection
- [ ] Saves URL for next time
- [ ] Bypasses local backend setup

### Offline Mode

- [ ] Download Full Platform
- [ ] Disconnect internet
- [ ] Install and run
- [ ] Works immediately

---

## Summary

| Aspect | Standard (Auto-Install) | Full (Bundled) |
|--------|------------------------|----------------|
| Download | 50MB | 80MB |
| First Launch | 5-10s delay | Instant |
| Offline Works | No | Yes |
| Always Latest | Yes | No |
| Build Complexity | Low | Medium |
| **Recommendation** | ✅ Default | Enterprise |

The result: **User installs Desktop, backend "just works"** - whether that's auto-downloaded, bundled, or connecting to their VPS. Zero friction.
