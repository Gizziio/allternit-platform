# Allternit Unified Distribution - Seamless Desktop + Backend

**Goal**: User downloads Allternit Desktop, backend "just works" - no separate install, no lag.

## Two Approaches

### Approach 1: First-Run Auto-Install (Recommended)

Desktop downloads and installs backend on first launch with progress UI.

**User Experience:**
```
1. User downloads Allternit Desktop (50MB)
2. Opens app
3. Sees: "Setting up Allternit for the first time... [progress bar]"
4. Downloads backend (~30MB, 5-10 seconds on good connection)
5. "Ready!" → App opens
6. Future launches: instant, no download
```

**Implementation:**
- `backend-manager.ts` - Downloads/installs backend automatically
- `main.ts` - Shows splash screen during setup
- No backend bundled (smaller initial download)

**Pros:**
- Smaller initial download (50MB vs 80MB)
- Always gets latest backend version
- Works on all platforms without rebuilding

**Cons:**
- Requires internet on first run
- 5-10 second delay on first launch

---

### Approach 2: Bundled Installer

Backend binaries are included in the Desktop installer.

**User Experience:**
```
1. User downloads Allternit Platform (80MB - includes backend)
2. Runs installer
3. Installs Desktop + Backend services
4. Opens app → Works immediately
```

**Implementation:**
- `electron-builder/package.json` - Bundles backend in `extraResources`
- `after-install.sh` - Post-install script sets up backend services
- Build process downloads all platform binaries

**Pros:**
- Works offline immediately
- No first-run delay
- Backend managed by OS (systemd/launchd)

**Cons:**
- Larger download (80MB vs 50MB)
- Must rebuild to update backend
- More complex build process

---

## Hybrid Recommendation

**Best UX**: Combine both approaches

```
Allternit Desktop installer includes:
├── Allternit Desktop app (50MB)
└── Minimal "bootstrap" backend (5MB)
    └── Just enough to serve basic UI

On first launch:
1. App starts with bootstrap backend (instant)
2. In background, downloads full backend
3. Seamlessly hot-swaps to full backend
4. User never notices
```

## Directory Structure

```
distribution/unified/
├── desktop-integration/          # Approach 1: Auto-download
│   ├── backend-manager.ts       # Download/install logic
│   └── main.ts                  # Modified main process
│
├── electron-builder/            # Approach 2: Bundled
│   ├── package.json             # Electron builder config
│   ├── after-install.sh         # macOS/Linux post-install
│   └── after-remove.sh          # Uninstall cleanup
│
├── scripts/
│   ├── bundle-backend.js        # Download backends for all platforms
│   └── build-unified.sh         # Build complete package
│
└── README.md                    # This file
```

## Quick Start

### Option 1: First-Run Auto-Install

```bash
# In your Desktop project
cp distribution/unified/desktop-integration/*.ts src/main/

# Install dependencies
npm install extract-zip

# Build as normal
npm run dist
```

### Option 2: Bundled Installer

```bash
cd distribution/unified/electron-builder

# Download backend binaries for all platforms
npm run bundle-backend

# Build installers (includes backend)
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Implementation Details

### Backend Installation Locations

| Platform | Install Path |
|----------|--------------|
| macOS | `~/Library/Application Support/Allternit/backend/` |
| Windows | `%APPDATA%/Allternit/backend/` |
| Linux | `~/.local/share/Allternit/backend/` |

### Service Management

**macOS:**
- Uses launchd (auto-managed by BackendManager)
- Or bundled: `/Library/LaunchDaemons/io.allternit.backend.plist`

**Linux:**
- Uses systemd (auto-managed by BackendManager)
- Or bundled: `allternit-backend.service`

**Windows:**
- Runs as user process (no service needed for dev mode)
- Or bundled: Windows Service via NSSM

## Migration from Separate Install

If users already have separate Desktop + Backend:

```typescript
// In main.ts, detect existing backend
async function detectExistingBackend(): Promise<string | null> {
  // Check common locations
  const locations = [
    '/opt/allternit/bin/allternit-api',           // System install
    '/usr/local/bin/allternit-api',         // Homebrew
    process.env.ALLTERNIT_BACKEND_PATH,      // Custom
  ];
  
  for (const path of locations) {
    if (await isBackendRunning(path)) {
      return `http://localhost:4096`;
    }
  }
  
  return null;
}
```

## User Scenarios

### Scenario A: New User, Internet Available
```
Download Desktop (50MB) → Open → Auto-download backend (5s) → Ready
```

### Scenario B: New User, No Internet
```
Download Full Package (80MB) → Install → Open → Ready immediately
```

### Scenario C: Existing User (Already Have Backend)
```
Update Desktop → Detects existing backend → Connects → Ready
```

### Scenario D: VPS User (Remote Backend)
```
Download Desktop → Enter VPS URL → Connects to remote → Ready
```

## Build Pipeline

```
1. Build backend binaries (Rust)
   └── outputs: allternit-backend-{version}-{platform}.tar.gz

2. Release to GitHub
   └── creates: github.com/allternit/backend/releases

3. Build Desktop (Auto-install approach)
   ├── Standard Electron build
   └── includes: backend-manager.ts

4. Build Desktop (Bundled approach)
   ├── Run bundle-backend.js
   │   └── downloads all platform backends
   └── Electron build with extraResources

5. Distribute both versions:
   ├── Allternit-Desktop-1.0.0.dmg (auto-install, 50MB)
   └── Allternit-Platform-1.0.0.dmg (bundled, 80MB)
```

## Future Enhancements

- [ ] Delta updates (only download changed backend files)
- [ ] Background updates (update while app is running)
- [ ] Portable mode (backend in same folder as Desktop)
- [ ] Enterprise MSI installer with Group Policy support
- [ ] Auto-detect and use existing Docker backend if present

## Summary

| Approach | Download Size | First Launch | Offline | Complexity |
|----------|--------------|--------------|---------|------------|
| Auto-Install | 50MB | 5-10s delay | No | Low |
| Bundled | 80MB | Instant | Yes | Medium |
| Hybrid | 55MB | Instant | Partial | High |

**Recommendation**: Start with **Auto-Install** (Approach 1) for simplicity, add **Bundled** option for enterprise/offline users.
