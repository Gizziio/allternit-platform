# Shell Applications

## Overview

The Shell is the main user interface for A2rchitect. It comes in **two distribution formats** that share the same UI code:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHELL PRODUCT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────┐         ┌──────────────────────────┐    │
│   │   Web Runtime    │         │    Desktop Wrapper       │    │
│   │   (web/)         │         │    (desktop/)            │    │
│   │                  │         │                          │    │
│   │  • Deploy to     │         │  • Bundles web runtime   │    │
│   │    Vercel/       │         │  • Adds native features: │    │
│   │    Netlify       │         │    - Global shortcuts    │    │
│   │                  │         │    - System tray         │    │
│   │  Standalone      │         │    - Rust sidecar API    │    │
│   │  browser app     │         │    - Native menus        │    │
│   │                  │         │                          │    │
│   └──────────────────┘         └──────────────────────────┘    │
│                                                                 │
│   Terminal (terminal/) - Separate TUI implementation            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Package Breakdown

### 1. `web/` - Web Runtime

**What it is:** The actual UI implementation (React + Vite)

**What it produces:** Static web files (`dist/` folder)

**How it's used:**
- **Development**: `pnpm dev` → Runs dev server on `localhost:5177`
- **Production**: `pnpm build` → Outputs to `dist/` for deployment

**Deployment targets:**
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static web host

**Key files:**
```
web/
├── src/
│   ├── main.tsx          # Entry point - mounts @a2r/platform
│   └── ...               # React components
├── index.html            # HTML template
├── vite.config.ts        # Build config
└── package.json          # @a2rchitech/shell-ui
```

**Package name:** `@a2rchitech/shell-ui`

---

### 2. `desktop/` - Desktop Wrapper

**What it is:** Electron wrapper that packages the web runtime + native features

**What it produces:** Desktop application bundle (.app, .exe, .dmg, etc.)

**How it works:**
```
Development:
┌─────────────────────────────────────┐
│  Electron (desktop/)                │
│  └── loads http://localhost:5177 ───┼──→ Web dev server (web/)
└─────────────────────────────────────┘

Production:
┌─────────────────────────────────────┐
│  Electron (desktop/)                │
│  ├── Bundles web/dist/              │
│  ├── Native API sidecar             │
│  └── System integrations            │
└─────────────────────────────────────┘
```

**Development mode:**
1. `desktop/` starts the web dev server from `web/`
2. Electron loads the web app via `loadURL('http://localhost:5177')`

**Production build:**
1. `desktop/` runs `build:ui` → builds `web/` to `web/dist/`
2. Electron packages the built files + native sidecar

**Key files:**
```
desktop/
├── main/
│   └── index.cjs         # Electron main process
├── preload/
│   └── index.js          # Preload script (bridge)
├── package.json          # @a2rchitech/shell-electron
└── ...
```

**Package name:** `@a2rchitech/shell-electron`

**Depends on:** `web/` (builds it during `npm run build`)

---

### 3. `terminal/` - Terminal UI

**What it is:** Separate terminal-based UI (SolidJS + Bun)

**What it produces:** CLI tool that runs in terminal

**Key difference:** NOT related to web/desktop - completely separate implementation

---

## Build & Deploy Matrix

| Package | Dev Command | Build Command | Output | Deploy Target |
|---------|-------------|---------------|--------|---------------|
| `web/` | `pnpm dev` | `pnpm build` | `dist/` (static) | Vercel, Netlify, S3 |
| `desktop/` | `pnpm dev` | `pnpm build` | Electron bundle | GitHub Releases, CDN |
| `terminal/` | `bun dev` | `bun build` | Binary | npm registry |

## Usage Scenarios

### Scenario 1: Web-Only Deployment
```bash
cd apps/shell/web
pnpm build
# Deploy dist/ to Vercel/Netlify
```
**Result:** Users access via browser at `https://shell.a2rchitect.com`

### Scenario 2: Desktop-Only Distribution
```bash
cd apps/shell/desktop
pnpm build
# Distributes .dmg, .exe, .AppImage
```
**Result:** Users download and install desktop app

### Scenario 3: Both Web and Desktop
```bash
# Build web
cd apps/shell/web && pnpm build

# Build desktop (includes web build)
cd apps/shell/desktop && pnpm build
```
**Result:** Users can use either web version OR download desktop app

### Scenario 4: Development
```bash
# Terminal 1: Run web dev server
cd apps/shell/web && pnpm dev

# Terminal 2: Run Electron (loads web from localhost:5177)
cd apps/shell/desktop && pnpm dev
```

## Naming Convention

| Old Name | New Name | What It Actually Is |
|----------|----------|---------------------|
| `shell-ui` | `web` | Web application (deployable to hosting) |
| `shell-electron` | `desktop` | Electron wrapper (bundles web app + native) |
| `a2r-tui` | `terminal` | Terminal UI (completely separate) |

## Common Confusion

**Q: Is `web/` the same as `desktop/`?**
A: No. `web/` is the UI implementation. `desktop/` is an Electron wrapper that USES `web/` and adds native features.

**Q: Can I deploy `web/` separately from `desktop/`?**
A: Yes! `web/` produces a standalone static site. `desktop/` is optional if you only want web.

**Q: Does `desktop/` contain a copy of `web/` code?**
A: No, it references it. In dev, it loads via URL. In production, it bundles the built files from `web/dist/`.

**Q: Why not just have one package?**
A: Because they have different distribution targets and build processes:
- Web → Static files → Web hosting
- Desktop → Electron bundle → Desktop installers

## File Organization

```
apps/shell/
├── web/                    # Web runtime (the UI)
│   ├── src/main.tsx        # Entry: mounts @a2r/platform
│   ├── dist/               # Build output (deploy this for web)
│   └── package.json        # @a2rchitech/shell-ui
│
├── desktop/                # Desktop wrapper (Electron)
│   ├── main/index.cjs      # Electron main process
│   ├── package.json        # @a2rchitech/shell-electron
│   └── (builds web/ first, then bundles)
│
└── terminal/               # Terminal UI (separate)
    └── src/main.tsx        # TUI entry point
```

## Dependencies

```
desktop/ ──depends on──> web/
   │                        │
   │                        └──depends on──> @a2r/platform
   │
   └── (production) bundles web/dist/

web/ ──depends on──> @a2r/platform (ui-core/)
```
