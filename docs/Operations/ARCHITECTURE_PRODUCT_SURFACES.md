# Allternit Platform Architecture - Product Surfaces & Codebase Organization

## Architectural Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Allternit PLATFORM                                         │
│                                                                              │
│  A unified self-hosted AI platform that feels like a cloud service,          │
│  but runs on infrastructure you control.                                     │
│                                                                              │
│  Core Principle: One brain (Gizzi), multiple faces (surfaces),               │
│                  one nervous system (SDK/HTTP).                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer 0: Core Engine (The Brain)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: GIZZI CODE - The True Backend                                      │
│                                                                              │
│  This is the heart of Allternit. Everything else is just interface.               │
│                                                                              │
│  Responsibilities:                                                           │
│  • Agent runtime and execution                                               │
│  • Code analysis and transformation                                          │
│  • AI model orchestration                                                    │
│  • State management                                                          │
│  • Business logic                                                            │
│                                                                              │
│  Code Location:                                                              │
│  cmd/gizzi-code/                                                             │
│  └── src/                                                                    │
│      ├── core/           # Agent runtime, code analysis                      │
│      ├── ai/             # Model clients, prompts, orchestration             │
│      ├── runtime/        # Execution environment                             │
│      └── cli/            # Command-line interface                            │
│                                                                              │
│  Distribution:                                                               │
│  • npm: @allternit/gizzi-code                                                      │
│  • Binary: gizzi (global command)                                            │
│  • Embedded: Used by Allternit Backend                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer 1: Nervous System (Communication)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: SDK / HTTP API - The Nervous System                                │
│                                                                              │
│  Standardized communication layer that all product surfaces use.            │
│  This is the contract between core and UI.                                   │
│                                                                              │
│  Responsibilities:                                                           │
│  • API definitions (REST + WebSocket)                                        │
│  • Authentication & authorization                                            │
│  • Request routing                                                           │
│  • Real-time event streaming                                                 │
│  • SDK clients for all languages                                             │
│                                                                              │
│  Code Location:                                                              │
│  packages/                                                                   │
│  ├── sdk-ts/                    # TypeScript SDK                             │
│  │   ├── src/                                                                │
│  │   │   ├── client.ts          # HTTP client                                │
│  │   │   ├── websocket.ts       # Real-time connection                       │
│  │   │   ├── types/             # API types                                  │
│  │   │   └── resources/         # API resource clients                       │
│  │   └── package.json                                                        │
│  │                                                                           │
│  ├── api-spec/                  # OpenAPI / Protocol definitions             │
│  │   ├── openapi.yaml                                                        │
│  │   └── schemas/                                                            │
│  │                                                                           │
│  └── sdk-python/                # Python SDK (future)                        │
│                                                                              │
│  Allternit Backend (7-apps/allternit-backend/) implements this API:                      │
│  ├── allternit-api/                   # HTTP gateway                               │
│  ├── allternit-kernel/                # Agent execution                            │
│  ├── allternit-memory/                # Persistence                                │
│  └── allternit-websocket/             # Real-time events                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer 2: Control Plane (The Manager)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Allternit DESKTOP - The Control Plane                                    │
│                                                                              │
│  The primary interface for managing Allternit. Controls backend wherever it runs. │
│                                                                              │
│  Responsibilities:                                                           │
│  • Backend lifecycle management (local/VPS)                                  │
│  • Version synchronization (Desktop ↔ Backend)                               │
│  • Unified update experience                                                 │
│  • System tray, shortcuts, native integrations                               │
│  • First-run setup wizard                                                    │
│                                                                              │
│  Code Location:                                                              │
│  7-apps/allternit-desktop/                                                         │
│  ├── src/                                                                    │
│  │   ├── main/                   # Electron main process                     │
│  │   │   ├── index.ts            # Entry point (unified main)                │
│  │   │   ├── manifest.ts         # Version lock manifest                     │
│  │   │   ├── backend-manager.ts  # Backend lifecycle                         │
│  │   │   ├── connection/         # Local/Remote/VPS connection              │
│  │   │   │   ├── connection-manager.ts                                      │
│  │   │   │   ├── local-connection.ts                                        │
│  │   │   │   └── remote-connection.ts                                       │
│  │   │   └── update/             # Unified update system                     │
│  │   │       ├── desktop-updater.ts                                         │
│  │   │       └── version-sync.ts                                            │
│  │   ├── preload/                # Electron preload script                   │
│  │   └── renderer/               # UI (loads from backend)                   │
│  ├── bundled-backend/            # Backend binaries (per platform)           │
│  │   └── darwin/arm64/                                                         │
│  │       └── bin/                                                              │
│  │           └── allternit-api                                                       │
│  └── package.json                                                            │
│                                                                              │
│  Distribution:                                                               │
│  • Allternit-Desktop-1.0.0.dmg        (macOS)                                      │
│  • Allternit-Desktop-1.0.0.exe        (Windows)                                    │
│  • Allternit-Desktop-1.0.0.AppImage   (Linux)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer 3: Product Surfaces (The Faces)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: PRODUCT SURFACES - User Interfaces                                 │
│                                                                              │
│  Multiple ways to interact with Allternit, all connecting to the same backend.    │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SURFACE 1: PLATFORM UI (Web Application)                                    │
│  ─────────────────────────────────────────                                   │
│  The main user interface, served by backend, used by all surfaces.          │
│                                                                              │
│  Responsibilities:                                                           │
│  • Main dashboard and workspace                                              │
│  • Agent management                                                          │
│  • Code editor and visualization                                             │
│  • Settings and configuration                                                │
│                                                                              │
│  Code Location:                                                              │
│  7-apps/allternit-backend/web/platform/                                            │
│  ├── src/                                                                    │
│  │   ├── App.tsx                                                             │
│  │   ├── views/                                                              │
│  │   ├── components/                                                         │
│  │   └── hooks/                                                              │
│  └── package.json                                                            │
│                                                                              │
│  Used By:                                                                    │
│  • Desktop (via webview)                                                     │
│  • Browser (direct connection)                                               │
│  • Mobile (webview)                                                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SURFACE 2: CLI (gizzi command)                                              │
│  ──────────────────────────────                                              │
│  Terminal interface for power users and automation.                         │
│                                                                              │
│  Responsibilities:                                                           │
│  • Command-line agent interactions                                           │
│  • Scripting and automation                                                  │
│  • CI/CD integration                                                         │
│                                                                              │
│  Code Location:                                                              │
│  cmd/gizzi-code/src/cli/                                                     │
│                                                                              │
│  Distribution:                                                               │
│  • npm install -g @allternit/gizzi-code                                            │
│  • brew install allternit/tap/gizzi                                                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SURFACE 3: BROWSER (PWA)                                                    │
│  ───────────────────────                                                     │
│  Web-only access to existing backend instances.                             │
│                                                                              │
│  Responsibilities:                                                           │
│  • Connect to remote backends                                                │
│  • Same UI as Desktop (Platform UI)                                          │
│  • No control plane features                                                 │
│                                                                              │
│  Code Location:                                                              │
│  Same as Platform UI (7-apps/allternit-backend/web/platform/)                      │
│  PWA manifest and service worker included.                                   │
│                                                                              │
│  URL: https://app.allternit.io (connects to user backend)                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SURFACE 4: MOBILE (Future)                                                  │
│  ────────────────────────                                                    │
│  iOS/Android apps for on-the-go access.                                     │
│                                                                              │
│  Responsibilities:                                                           │
│  • Mobile-optimized UI                                                       │
│  • Push notifications                                                        │
│  • Connect to backend (usually VPS)                                          │
│                                                                              │
│  Code Location:                                                              │
│  mobile/ (future)                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure (Proposed Reorg)

```
allternit/
│
├── core/                          # LAYER 0: The Brain
│   └── gizzi/                     # Gizzi Code (true backend)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs             # Core library
│           ├── runtime/           # Agent runtime
│           ├── ai/                # Model orchestration
│           └── cli/               # CLI binary
│
├── nervous-system/                # LAYER 1: Communication
│   ├── api-spec/                  # OpenAPI definitions
│   │   ├── openapi.yaml
│   │   └── schemas/
│   │
│   ├── sdk-ts/                    # TypeScript SDK
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── websocket.ts
│   │   │   └── types/
│   │   └── package.json
│   │
│   └── backend/                   # HTTP API implementation
│       ├── Cargo.toml
│       └── crates/
│           ├── allternit-api/           # API gateway
│           ├── allternit-kernel/        # Agent execution
│           └── allternit-memory/        # Persistence
│
├── control-plane/                 # LAYER 2: The Manager
│   └── desktop/                   # Allternit Desktop
│       ├── package.json
│       ├── electron-builder.yml
│       └── src/
│           ├── main/              # Control plane logic
│           ├── preload/
│           └── renderer/
│
├── surfaces/                      # LAYER 3: User Interfaces
│   ├── platform-ui/               # Main web UI
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── views/
│   │   │   └── components/
│   │   └── package.json
│   │
│   ├── browser/                   # Browser-specific entry
│   │   ├── index.html
│   │   └── pwa-manifest.json
│   │
│   └── mobile/                    # (Future)
│       └── README.md
│
├── distribution/                  # Distribution & packaging
│   ├── desktop/
│   ├── backend/
│   └── cli/
│
└── docs/                          # Documentation
    ├── architecture/
    └── api/
```

## Data Flow

```
User Interaction Flow:
─────────────────────────────────────────────────────────

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Surface   │────▶│    SDK      │────▶│   Backend   │
│   (UI)      │◄────│   (HTTP)    │◄────│   (API)     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                         ┌──────┴──────┐
                                         ▼             ▼
                                    ┌─────────┐   ┌─────────┐
                                    │  Gizzi  │   │  State  │
                                    │  Core   │   │  (DB)   │
                                    └─────────┘   └─────────┘

Control Plane Flow (Desktop):
─────────────────────────────────────────────────────────

┌─────────────┐     ┌─────────────────────────────────────┐
│   Desktop   │────▶│         Backend Manager             │
│  (Control)  │     │  • Extract bundled backend          │
└─────────────┘     │  • Start/stop local backend         │
      │             │  • SSH to VPS for remote mgmt       │
      │             │  • Version synchronization          │
      │             └───────────────────┬─────────────────┘
      │                                 │
      │             ┌───────────────────┴─────────────────┐
      │             ▼                                     ▼
      │      ┌─────────────┐                      ┌─────────────┐
      │      │ Local Backend│                      │ VPS Backend │
      │      │ (bundled)   │                      │ (SSH/API)   │
      │      └──────┬──────┘                      └──────┬──────┘
      │             │                                    │
      └─────────────┴────────────────────────────────────┘
                        Both serve Platform UI
                        at http://localhost:4096
```

## Version Lock Strategy

```
┌─────────────────────────────────────────────────────────────┐
│  VERSION LOCK - The Golden Rule                              │
│                                                              │
│  Desktop Version = Backend Version = SDK Version            │
│                                                              │
│  Example:                                                    │
│  • Desktop: 1.2.3                                           │
│  • Backend:  1.2.3 (locked)                                 │
│  • SDK:      1.2.3 (matched)                                │
│                                                              │
│  Manifest Location:                                          │
│  control-plane/desktop/src/main/manifest.ts                  │
│                                                              │
│  Update Flow:                                                │
│  1. Desktop detects new version (electron-updater)          │
│  2. Downloads & installs new Desktop                        │
│  3. New Desktop extracts bundled backend 1.2.3              │
│  4. OR: Uploads 1.2.3 to VPS via SSH                        │
│  5. User never sees version numbers                         │
└─────────────────────────────────────────────────────────────┘
```

## The Naming That Solves Everything

| Name | Role | User Sees | Developer Knows |
|------|------|-----------|-----------------|
| **Allternit Desktop** | Control Plane | "Download Allternit" | Manages ALL backends (local, VPS, remote) |
| **Allternit Backend** | Compute Engine | Never mentioned directly | Infrastructure that Desktop manages |
| **Allternit Platform** | Umbrella term | "Allternit Platform v1.2.3" | Complete system (Desktop + Backend) |
| **gizzi** | CLI tool | "Run `gizzi` command" | Direct access to core engine |

**Support simplification**: Ask "What Desktop version?" → Knows everything about the user's setup.

## The 4 Key Architectural Decisions

### 1. Desktop IS the Product
Users never "install backend" - they install Desktop, which manages backend wherever it lives.

```
❌ User: "Do I need to install backend separately?"
✅ User: "I installed Allternit and it just worked"
```

### 2. Version Lock is Absolute
```
Desktop 1.2.3 ←→ Backend 1.2.3 (always)
```

- No version matrix
- No compatibility tables
- Support asks one question: "What Desktop version?"

### 3. Single Release Artifact
One GitHub release = Desktop + Backend bundled together

- Desktop contains backend binaries in `bundled-backend/`
- Desktop extracts/updates backend as needed
- User never downloads backend separately

### 4. Unified Update Experience
```
User clicks "Update" in Desktop
    ↓
Desktop downloads new version
    ↓
If local backend: Extracts new bundled backend
If remote backend: SSH uploads new binary to VPS
    ↓
Restarts backend seamlessly
    ↓
User sees: "Allternit updated to 1.2.3"
```

## Product Hierarchy (User-Facing)

```
Allternit PLATFORM (The complete solution)
│
├── Allternit Desktop (Control Plane)
│   └── "Download Allternit" → Manages backend everywhere
│       → User never thinks about "backend"
│
├── Allternit Backend (Compute Engine)
│   └── Never mentioned directly to users
│       → "Where's your backend?" not "Install backend"
│
├── gizzi (CLI)
│   └── "npm install -g @allternit/gizzi-code"
│       → For power users, scripts, CI/CD
│
└── Allternit Web (Browser)
    └── "Open in browser" from Desktop
        → Connects to existing backend
```

## Key Principles

1. **Gizzi is the Core**: Everything else is interface
2. **SDK is the Contract**: All surfaces use the same API
3. **Desktop is Control Plane**: Only Desktop manages backend lifecycle
4. **Version Lock is Absolute**: No version drift, ever
5. **Surfaces are Dumb**: They just render, Desktop does the work
6. **Unified Experience**: User never thinks about "backend"

## User Experience Flows

### New User - Local Mode (Most Common)
```
User: "I want to try Allternit"
    ↓
Download Allternit Desktop (80MB with bundled backend)
    ↓
Open app
    ↓
Splash: "Setting up Allternit for the first time..." [progress bar]
    ↓
(Desktop extracts bundled backend, 5 seconds)
    ↓
"Ready!"
    ↓
Platform UI loads
    ↓
Future launches: Instant
```

### New User - VPS Mode (Power Users)
```
User: "I want Allternit on my server"
    ↓
Download Allternit Desktop
    ↓
Open app
    ↓
"Add your server"
    ↓
Enter SSH credentials or VPS URL
    ↓
Desktop connects via SSH
    ↓
Installs backend on VPS
    ↓
Connects to remote backend
    ↓
Platform UI loads (from VPS)
```

### Existing User - Update
```
Notification: "Allternit update available"
    ↓
User clicks "Update"
    ↓
Desktop downloads v1.2.3
    ↓
Installs new Desktop
    ↓
Checks backend version
    ↓
If local: Extracts new bundled backend
If remote: SSH uploads to VPS
    ↓
Restarts backend
    ↓
"Allternit updated to 1.2.3"
    ↓
Seamless, user continues work
```

### Browser User (No Desktop)
```
User: "I want to access from iPad"
    ↓
Open browser → app.allternit.io
    ↓
"Enter your Allternit backend URL"
    ↓
User enters: https://my-vps.com:4096
    ↓
Platform UI loads (connecting to VPS)
    ↓
Full functionality via browser
```

## Migration Path (Current → Proposed)

```bash
# Current structure:
cmd/gizzi-code/         → core/gizzi/
7-apps/allternit-api/         → nervous-system/backend/
7-apps/allternit-desktop/     → control-plane/desktop/
7-apps/shell/           → surfaces/platform-ui/
packages/               → nervous-system/sdk-ts/

# Gradual migration:
1. Create new directories alongside old
2. Move files incrementally
3. Update imports
4. Deprecate old paths
5. Remove after transition
```

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  ARCHITECTURE SUMMARY                                        │
│                                                              │
│  CORE (gizzi)         → Brain: AI, runtime, business logic  │
│  NERVOUS (sdk/api)    → Communication: HTTP, WebSocket      │
│  CONTROL (desktop)    → Manager: Backend lifecycle          │
│  SURFACES (ui/cli)    → Interface: How users interact       │
│                                                              │
│  Golden Path:                                                │
│  User → Desktop → Backend (local or VPS) → Gizzi Core       │
│                                                              │
│  Alternative:                                                │
│  User → Browser → Backend (VPS) → Gizzi Core                │
│                                                              │
│  All paths converge at the SDK/HTTP layer.                   │
└─────────────────────────────────────────────────────────────┘
```
