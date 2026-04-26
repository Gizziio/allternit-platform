# Allternit Unified Architecture - Product & Codebase Organization

## Product Hierarchy

```
Allternit PLATFORM (The complete self-hosted AI experience)
│
├── Allternit DESKTOP (Control Plane)
│   ├── macOS .dmg
│   ├── Windows .exe
│   └── Linux .AppImage
│   
│   Role: Manages ALL backend instances (local/remote)
│   Size: ~50-80MB (with bundled backend option)
│   Update: Auto-updates via electron-updater
│   Version: Drives everything (1.2.3 = 1.2.3 everywhere)
│   
│   manages
│       │
│       ▼
│
└── Allternit BACKEND (Compute Engine)
    ├── Local (bundled)
    ├── VPS (user hosted)
    └── Dev Server (localhost)
    
    Role: AI runtime, agent execution, persistence
    Distribution: NEVER standalone product
    Version: Locked to Desktop version
    Update: Managed by Desktop control plane
```

## Product Surfaces

| Surface | Implementation | Backend Connection |
|---------|---------------|-------------------|
| Desktop | Electron (Control Plane) | Local or Remote |
| Browser | PWA (React) | Connects to backend URL |
| Mobile | React Native (Future) | Connects to backend URL |
| CLI | gizzi command | Local API or Remote |

All surfaces connect to the SAME backend API.
Desktop just happens to also manage/install that backend.

## Naming Convention

### Products (User-Facing)

| Name | What It Is | How Users Get It |
|------|-----------|------------------|
| Allternit Platform | The complete solution | Conceptual/umbrella term |
| Allternit Desktop | Control plane + UI | Download from allternit.com |
| Allternit Backend | Compute engine | NEVER directly - only via Desktop management |
| gizzi | CLI interface | npm install -g @allternit/gizzi-code |

### Codebase Organization

```
cmd/
├── allternit-desktop/                    # Allternit DESKTOP (Control Plane)
│   ├── src/
│   │   ├── main/
│   │   │   ├── connection-manager.ts   # Routes to local/remote backend
│   │   │   ├── backend-manager.ts      # Install/manage backend instances
│   │   │   └── updater.ts              # Version sync logic
│   │   └── renderer/               # UI (connects to backend API)
│   └── package.json
│
├── allternit-backend/                    # Allternit BACKEND (Compute Engine)
│   ├── Cargo.toml                  # Workspace root
│   ├── crates/
│   │   ├── allternit-api/                # Main API gateway (:4096)
│   │   ├── allternit-kernel/             # Agent execution engine
│   │   ├── allternit-memory/             # Persistence service
│   │   └── allternit-web-server/         # Static file server (:3001)
│   └── web/
│       └── platform/               # React web UI
│
└── gizzi-code/                     # CLI (separate product)
    └── cli-package/

distribution/
├── desktop/                        # Desktop distribution
│   ├── electron-builder/
│   └── after-install.sh
│
└── backend/                        # Backend distribution (for Desktop)
    ├── build-scripts/
    ├── install.sh                  # VPS install script
    └── services/
```

## Version Lock Strategy

```typescript
// Single source of truth
// File: cmd/allternit-desktop/src/main/manifest.ts

export const PLATFORM_MANIFEST = {
  version: "1.2.3",
  releaseDate: "2026-03-13",
  
  // Backend is LOCKED to this version
  backend: {
    version: "1.2.3",  // ALWAYS matches Desktop
    minimumCompatible: "1.2.0",
    
    // SHA256 hashes for verification
    checksums: {
      "x86_64-linux": "sha256:abc123...",
      "aarch64-linux": "sha256:def456...",
      "x86_64-macos": "sha256:ghi789...",
      "aarch64-macos": "sha256:jkl012..."
    }
  }
} as const;

// Desktop refuses to connect to incompatible backend
class ConnectionManager {
  async validateBackend(backendUrl: string): Promise<boolean> {
    const backendVersion = await this.getBackendVersion(backendUrl);
    
    if (backendVersion !== PLATFORM_MANIFEST.backend.version) {
      // Desktop manages the update
      await this.syncBackendVersion(backendUrl);
    }
    
    return true;
  }
}
```

## Desktop Responsibilities (Control Plane)

```
allternit-desktop/src/main/
├── connection/                     # Where's the backend?
│   ├── connection-manager.ts      # Routes to local/remote/dev
│   ├── local-connection.ts        # Bundled/auto-installed backend
│   ├── remote-connection.ts       # User's VPS (via SSH/API)
│   └── dev-connection.ts          # localhost:4096 for development
│
├── backend-management/            # Managing backend instances
│   ├── backend-manager.ts         # High-level orchestration
│   ├── installer.ts               # Download/extract binaries
│   ├── updater.ts                 # Version sync logic
│   └── process-manager.ts         # Start/stop local backend
│
├── update/                        # Unified update system
│   ├── desktop-updater.ts         # electron-updater wrapper
│   ├── backend-updater.ts         # Upload binary to VPS
│   └── version-sync.ts            # Ensures lock
│
└── ui/                            # Desktop-specific UI
    ├── splash-window.ts           # First-run setup UI
    ├── tray-manager.ts            # System tray
    └── onboarding/                # Backend setup wizard
```

## Backend Responsibilities (Compute Engine)

```
allternit-backend/
├── crates/
│   ├── allternit-api/                   # Main API (:4096)
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── routes/            # REST API
│   │   │   └── websocket/         # Real-time
│   │   └── Cargo.toml
│   │
│   ├── allternit-kernel/                # Agent execution
│   ├── allternit-memory/                # Persistence
│   └── allternit-web-server/            # Static UI (:3001)
│
└── web/platform/                  # React UI (served by backend)
    └── src/
        └── App.tsx                # Same UI runs in Desktop webview
```

## Release Process

### Single Release = Desktop + Backend

```bash
# When releasing v1.2.3:

# 1. Build backend for all platforms
cd cmd/allternit-backend
./scripts/build-release.sh

# 2. Update Desktop manifest
# Update PLATFORM_MANIFEST.version = "1.2.3"
# Update PLATFORM_MANIFEST.backend.version = "1.2.3"

# 3. Bundle backend into Desktop
cd cmd/allternit-desktop
./scripts/bundle-backend.sh

# 4. Build Desktop
electron-builder --mac --win --linux

# 5. GitHub Release contains:
# - Allternit-Desktop-1.2.3.dmg (includes backend 1.2.3)
# - Allternit-Desktop-1.2.3.exe (includes backend 1.2.3)
# - Allternit-Desktop-1.2.3.AppImage (includes backend 1.2.3)
# - allternit-backend-1.2.3-update.tar.gz (for VPS updates)
```

## Update Flow

### Local Backend Update
```
User has Desktop 1.2.2 + Backend 1.2.2 (local)

1. Desktop detects update 1.2.3 available
2. Downloads Desktop 1.2.3
3. Quits and installs new Desktop
4. New Desktop starts
5. Detects local backend is 1.2.2
6. Extracts bundled backend 1.2.3
7. Restarts local backend
8. User sees: "Allternit updated to 1.2.3"
```

### Remote Backend Update
```
User has Desktop 1.2.3 + Backend 1.2.1 (on VPS)

1. Desktop connects to VPS
2. API call: GET /version -> "1.2.1"
3. Desktop: "Backend needs update"
4. SSH into VPS (stored credentials)
5. Upload allternit-backend-1.2.3-update.tar.gz
6. Run install script on VPS
7. Restart backend service
8. Reconnect: GET /version -> "1.2.3" OK
9. User sees: "Backend synced to 1.2.3"
```

## Product Surfaces Implementation

### Desktop (Control Plane)
```typescript
class DesktopMain {
  async initialize() {
    // 1. Start control plane UI
    const window = createMainWindow();
    
    // 2. Determine backend location
    const connection = await this.connectionManager.autoConnect();
    
    // 3. Load platform UI from backend
    window.loadURL(`${connection.url}/platform`);
  }
}
```

### Browser (PWA)
```typescript
// Browser connects to existing backend
// User must have backend running somewhere

class BrowserApp {
  constructor() {
    // Ask user for backend URL
    this.backendUrl = localStorage.getItem('backendUrl');
    
    // Connect to it
    this.api = new AllternitAPI(this.backendUrl);
  }
}
```

### CLI (gizzi)
```typescript
// CLI connects to backend via API
class GizziCLI {
  async execute(command: string) {
    const backendUrl = this.config.get('backend.url');
    
    const result = await fetch(`${backendUrl}/api/cli`, {
      method: 'POST',
      body: JSON.stringify({ command })
    });
    
    return result;
  }
}
```

## Key Principles

1. **Desktop is the Control Plane**: Only Desktop manages backend lifecycle
2. **Backend is Never a Product**: Users never "buy Allternit Backend" - it's infrastructure
3. **Version Lock is Absolute**: Desktop 1.2.3 requires Backend 1.2.3, always
4. **Unified Update**: One click updates both (Desktop manages backend)
5. **Surfaces are Dumb**: Browser, Mobile, CLI just connect - Desktop does the work

## User Communication

| What We Say | What It Means |
|-------------|---------------|
| "Download Allternit Desktop" | Download the control plane |
| "Allternit is updating" | Desktop + Backend syncing versions |
| "Add a server" | Desktop will manage backend on your VPS |
| "Allternit Platform" | The whole system (Desktop managing Backend) |
| "Open in browser" | Open PWA connecting to same backend |

This naming makes support simple: "What's your Allternit Desktop version?" tells us everything.
